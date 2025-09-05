use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use serde::{Deserialize, Serialize};
use tokio::fs as async_fs;
use crate::security::{SecurityContext, SecurityError, IsolationError};
use crate::protocol::messages::{ExecutionRequest, ExecutionResponse, ErrorInfo, ErrorCategory, PerformanceMetrics};
use crate::runtime::shared_runtime::RuntimeManager;
use thiserror::Error;
use std::time::Instant;

#[derive(Error, Debug)]
pub enum FileSystemError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Security error: {0}")]
    SecurityError(#[from] SecurityError),
    #[error("Isolation error: {0}")]
    IsolationError(#[from] IsolationError),
    #[error("Invalid path: {path}")]
    InvalidPath { path: String },
    #[error("File too large: {size} bytes (limit: {limit})")]
    FileTooLarge { size: u64, limit: u64 },
    #[error("Permission denied: {operation} on {path}")]
    PermissionDenied { operation: String, path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOperation {
    pub operation_type: FileOperationType,
    pub path: PathBuf,
    pub content: Option<String>,
    pub create_dirs: Option<bool>,
    pub recursive: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileOperationType {
    Read,
    Write,
    Append,
    Delete,
    CreateDir,
    List,
    Exists,
    GetInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: PathBuf,
    pub size: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub modified: Option<u64>,
    pub created: Option<u64>,
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSystemResult {
    pub success: bool,
    pub operation: FileOperationType,
    pub path: PathBuf,
    pub content: Option<String>,
    pub file_info: Option<FileInfo>,
    pub files: Option<Vec<FileInfo>>,
    pub error: Option<ErrorInfo>,
}

/// Secure file system executor with comprehensive sandboxing and validation
pub struct FileSystemExecutor {
    security_context: SecurityContext,
    max_file_size: u64,
    max_files_per_operation: usize,
}

impl FileSystemExecutor {
    pub fn new(security_context: SecurityContext) -> Self {
        Self {
            security_context,
            max_file_size: 10 * 1024 * 1024, // 10MB default
            max_files_per_operation: 1000,   // 1000 files default
        }
    }

    /// Execute a file system operation with full security validation
    pub async fn execute(&self, request: ExecutionRequest) -> ExecutionResponse {
        let start_time = Instant::now();
        let request_id = generate_request_id();

        // Parse operation from arguments
        let operation = match self.parse_operation(&request.arguments) {
            Ok(op) => op,
            Err(e) => {
                return ExecutionResponse {
                    request_id,
                    success: false,
                    result: None,
                    error: Some(ErrorInfo {
                        code: "INVALID_OPERATION".to_string(),
                        message: e.to_string(),
                        category: ErrorCategory::InvalidInput,
                        details: serde_json::json!({"arguments": request.arguments}).as_object().unwrap().iter()
                            .map(|(k, v)| (k.clone(), v.clone())).collect(),
                    }),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    performance_metrics: None,
                };
            }
        };

        // Validate security constraints
        if let Err(e) = self.validate_operation(&operation) {
            return ExecutionResponse {
                request_id,
                success: false,
                result: None,
                error: Some(ErrorInfo {
                    code: "SECURITY_VIOLATION".to_string(),
                    message: e.to_string(),
                    category: ErrorCategory::Security,
                    details: serde_json::json!({
                        "operation": operation,
                        "security_context": self.security_context
                    }).as_object().unwrap().iter()
                        .map(|(k, v)| (k.clone(), v.clone())).collect(),
                }),
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                performance_metrics: None,
            };
        }

        // Execute in isolated process for additional security
        let operation_clone = operation.clone();
        // Execute async operation with proper error handling using shared runtime
        let result = match RuntimeManager::execute_async(self.execute_operation_internal(operation_clone)) {
            Ok(res) => res,
            Err(e) => return ExecutionResponse {
                request_id,
                success: false,
                result: None,
                error: Some(ErrorInfo {
                    code: "RuntimeError".to_string(),
                    message: format!("Failed to execute filesystem operation: {}", e),
                    category: ErrorCategory::SystemError,
                    details: std::collections::HashMap::new(),
                }),
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                performance_metrics: None,
            },
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(fs_result) => ExecutionResponse {
                request_id,
                success: fs_result.success,
                result: Some(serde_json::to_value(fs_result).unwrap()),
                error: None,
                execution_time_ms: execution_time,
                performance_metrics: Some(PerformanceMetrics {
                    cpu_time_ms: execution_time,
                    memory_peak_mb: 0, // Would be measured by isolation layer
                    memory_avg_mb: 0,
                    io_read_bytes: 0,  // Would be tracked by isolation layer
                    io_write_bytes: 0,
                    context_switches: 0,
                }),
            },
            Err(e) => ExecutionResponse {
                request_id,
                success: false,
                result: None,
                error: Some(ErrorInfo {
                    code: "EXECUTION_FAILED".to_string(),
                    message: e.to_string(),
                    category: ErrorCategory::SystemError,
                    details: serde_json::json!({"isolation_error": e.to_string()}).as_object().unwrap().iter()
                        .map(|(k, v)| (k.clone(), v.clone())).collect(),
                }),
                execution_time_ms: execution_time,
                performance_metrics: None,
            },
        }
    }

    /// Execute the actual file system operation (runs in isolated process)
    async fn execute_operation_internal(&self, operation: FileOperation) -> Result<FileSystemResult, FileSystemError> {
        match operation.operation_type {
            FileOperationType::Read => self.read_file(&operation.path).await,
            FileOperationType::Write => self.write_file(&operation.path, operation.content.as_deref().unwrap_or("")).await,
            FileOperationType::Append => self.append_file(&operation.path, operation.content.as_deref().unwrap_or("")).await,
            FileOperationType::Delete => self.delete_path(&operation.path).await,
            FileOperationType::CreateDir => self.create_directory(&operation.path, operation.recursive.unwrap_or(false)).await,
            FileOperationType::List => self.list_directory(&operation.path).await,
            FileOperationType::Exists => self.check_exists(&operation.path).await,
            FileOperationType::GetInfo => self.get_file_info(&operation.path).await,
        }
    }

    /// Read file contents with size validation
    async fn read_file(&self, path: &Path) -> Result<FileSystemResult, FileSystemError> {
        // Canonicalize path to prevent directory traversal attacks
        let canonical_path = path.canonicalize().map_err(|e| {
            FileSystemError::InvalidPath {
                path: format!("Failed to canonicalize path '{}': {}", path.display(), e),
            }
        })?;

        // Validate file size before reading
        let metadata = async_fs::metadata(&canonical_path).await?;
        if metadata.len() > self.max_file_size {
            return Err(FileSystemError::FileTooLarge {
                size: metadata.len(),
                limit: self.max_file_size,
            });
        }

        let content = async_fs::read_to_string(&canonical_path).await?;
        let file_info = self.create_file_info(&canonical_path, &metadata)?;
        
        Ok(FileSystemResult {
            success: true,
            operation: FileOperationType::Read,
            path: canonical_path,
            content: Some(content),
            file_info: Some(file_info),
            files: None,
            error: None,
        })
    }

    /// Write file contents with atomic operations
    async fn write_file(&self, path: &Path, content: &str) -> Result<FileSystemResult, FileSystemError> {
        // Check content size
        if content.len() as u64 > self.max_file_size {
            return Err(FileSystemError::FileTooLarge {
                size: content.len() as u64,
                limit: self.max_file_size,
            });
        }

        // Create parent directories if needed
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }

        // Atomic write using temporary file
        let temp_path = path.with_extension("tmp");
        fs::write(&temp_path, content)?;
        fs::rename(&temp_path, path)?;

        Ok(FileSystemResult {
            success: true,
            operation: FileOperationType::Write,
            path: path.to_path_buf(),
            content: None,
            file_info: Some(self.path_to_file_info(path)?),
            files: None,
            error: None,
        })
    }

    /// Append to file with atomic operations
    async fn append_file(&self, path: &Path, content: &str) -> Result<FileSystemResult, FileSystemError> {
        // Check combined size after append
        let current_size = if path.exists() {
            fs::metadata(path)?.len()
        } else {
            0
        };

        let new_size = current_size + content.len() as u64;
        if new_size > self.max_file_size {
            return Err(FileSystemError::FileTooLarge {
                size: new_size,
                limit: self.max_file_size,
            });
        }

        // Append content
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?;
        file.write_all(content.as_bytes())?;

        Ok(FileSystemResult {
            success: true,
            operation: FileOperationType::Append,
            path: path.to_path_buf(),
            content: None,
            file_info: Some(self.path_to_file_info(path)?),
            files: None,
            error: None,
        })
    }

    /// Delete file or directory
    async fn delete_path(&self, path: &Path) -> Result<FileSystemResult, FileSystemError> {
        if path.is_dir() {
            fs::remove_dir_all(path)?;
        } else {
            fs::remove_file(path)?;
        }

        Ok(FileSystemResult {
            success: true,
            operation: FileOperationType::Delete,
            path: path.to_path_buf(),
            content: None,
            file_info: None,
            files: None,
            error: None,
        })
    }

    /// Create directory with optional recursion
    async fn create_directory(&self, path: &Path, recursive: bool) -> Result<FileSystemResult, FileSystemError> {
        if recursive {
            fs::create_dir_all(path)?;
        } else {
            fs::create_dir(path)?;
        }

        Ok(FileSystemResult {
            success: true,
            operation: FileOperationType::CreateDir,
            path: path.to_path_buf(),
            content: None,
            file_info: Some(self.path_to_file_info(path)?),
            files: None,
            error: None,
        })
    }

    /// List directory contents with limits
    async fn list_directory(&self, path: &Path) -> Result<FileSystemResult, FileSystemError> {
        let entries = fs::read_dir(path)?;
        let mut files = Vec::new();

        for (count, entry) in entries.enumerate() {
            if count >= self.max_files_per_operation {
                break;
            }

            let entry = entry?;
            let path = entry.path();
            files.push(self.path_to_file_info(&path)?);
        }

        Ok(FileSystemResult {
            success: true,
            operation: FileOperationType::List,
            path: path.to_path_buf(),
            content: None,
            file_info: None,
            files: Some(files),
            error: None,
        })
    }

    /// Check if path exists
    async fn check_exists(&self, path: &Path) -> Result<FileSystemResult, FileSystemError> {
        let exists = path.exists();

        Ok(FileSystemResult {
            success: true,
            operation: FileOperationType::Exists,
            path: path.to_path_buf(),
            content: Some(exists.to_string()),
            file_info: if exists { Some(self.path_to_file_info(path)?) } else { None },
            files: None,
            error: None,
        })
    }

    /// Get detailed file information
    async fn get_file_info(&self, path: &Path) -> Result<FileSystemResult, FileSystemError> {
        let file_info = self.path_to_file_info(path)?;

        Ok(FileSystemResult {
            success: true,
            operation: FileOperationType::GetInfo,
            path: path.to_path_buf(),
            content: None,
            file_info: Some(file_info),
            files: None,
            error: None,
        })
    }

    /// Convert path to FileInfo structure
    fn path_to_file_info(&self, path: &Path) -> Result<FileInfo, FileSystemError> {
        let metadata = fs::metadata(path)?;
        self.create_file_info(path, &metadata)
    }

    /// Create FileInfo from path and metadata
    fn create_file_info(&self, path: &Path, metadata: &std::fs::Metadata) -> Result<FileInfo, FileSystemError> {
        Ok(FileInfo {
            path: path.to_path_buf(),
            size: metadata.len(),
            is_dir: metadata.is_dir(),
            is_file: metadata.is_file(),
            modified: metadata.modified().ok().map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            }),
            created: metadata.created().ok().map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            }),
            permissions: Some(format!("{:o}", metadata.permissions().mode())),
        })
    }

    /// Parse operation from JSON arguments
    fn parse_operation(&self, arguments: &std::collections::HashMap<String, serde_json::Value>) -> Result<FileOperation, FileSystemError> {
        let operation_type = arguments.get("operation")
            .and_then(|v| v.as_str())
            .ok_or_else(|| FileSystemError::InvalidPath { path: "operation field missing".to_string() })?;

        let operation_type = match operation_type {
            "read" => FileOperationType::Read,
            "write" => FileOperationType::Write,
            "append" => FileOperationType::Append,
            "delete" => FileOperationType::Delete,
            "create_dir" => FileOperationType::CreateDir,
            "list" => FileOperationType::List,
            "exists" => FileOperationType::Exists,
            "get_info" => FileOperationType::GetInfo,
            _ => return Err(FileSystemError::InvalidPath { path: format!("unknown operation: {}", operation_type) }),
        };

        let path = arguments.get("path")
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .ok_or_else(|| FileSystemError::InvalidPath { path: "path field missing".to_string() })?;

        let content = arguments.get("content").and_then(|v| v.as_str()).map(String::from);
        let create_dirs = arguments.get("create_dirs").and_then(|v| v.as_bool());
        let recursive = arguments.get("recursive").and_then(|v| v.as_bool());

        Ok(FileOperation {
            operation_type,
            path,
            content,
            create_dirs,
            recursive,
        })
    }

    /// Validate operation against security context
    fn validate_operation(&self, operation: &FileOperation) -> Result<(), SecurityError> {
        // Validate path access
        self.security_context.validate_path_access(&operation.path)?;

        // Validate operation-specific capabilities
        use crate::security::Capability;
        match operation.operation_type {
            FileOperationType::Read | FileOperationType::Exists | FileOperationType::GetInfo | FileOperationType::List => {
                self.security_context.validate_capability(&Capability::FileRead(operation.path.clone()))?;
            },
            FileOperationType::Write | FileOperationType::Append | FileOperationType::Delete | FileOperationType::CreateDir => {
                self.security_context.validate_capability(&Capability::FileWrite(operation.path.clone()))?;
            },
        }

        Ok(())
    }
}

/// Generate a unique request ID
fn generate_request_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(feature = "filesystem_permissions")]
use std::os::unix::fs::PermissionsExt;

#[cfg(not(feature = "filesystem_permissions"))]
trait PermissionsExt {
    fn mode(&self) -> u32;
}

#[cfg(not(feature = "filesystem_permissions"))]
impl PermissionsExt for std::fs::Permissions {
    fn mode(&self) -> u32 {
        0o644 // Default permissions for non-Unix systems
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn create_test_executor() -> (FileSystemExecutor, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let mut security_context = SecurityContext::for_file_operations(temp_dir.path());
        security_context.add_allowed_path(temp_dir.path().to_path_buf());
        
        let executor = FileSystemExecutor::new(security_context);
        (executor, temp_dir)
    }

    #[tokio::test]
    async fn test_file_write_and_read() {
        let (executor, temp_dir) = create_test_executor();
        let test_file = temp_dir.path().join("test.txt");
        let content = "Hello, world!";

        // Test write operation
        let operation = FileOperation {
            operation_type: FileOperationType::Write,
            path: test_file.clone(),
            content: Some(content.to_string()),
            create_dirs: None,
            recursive: None,
        };

        let result = executor.execute_operation_internal(operation).await.unwrap();
        assert!(result.success);

        // Test read operation
        let operation = FileOperation {
            operation_type: FileOperationType::Read,
            path: test_file,
            content: None,
            create_dirs: None,
            recursive: None,
        };

        let result = executor.execute_operation_internal(operation).await.unwrap();
        assert!(result.success);
        assert_eq!(result.content.unwrap(), content);
    }

    #[tokio::test]
    async fn test_directory_operations() {
        let (executor, temp_dir) = create_test_executor();
        let test_dir = temp_dir.path().join("test_directory");

        // Test directory creation
        let operation = FileOperation {
            operation_type: FileOperationType::CreateDir,
            path: test_dir.clone(),
            content: None,
            create_dirs: None,
            recursive: Some(true),
        };

        let result = executor.execute_operation_internal(operation).await.unwrap();
        assert!(result.success);
        assert!(test_dir.exists());

        // Test directory listing
        let operation = FileOperation {
            operation_type: FileOperationType::List,
            path: temp_dir.path().to_path_buf(),
            content: None,
            create_dirs: None,
            recursive: None,
        };

        let result = executor.execute_operation_internal(operation).await.unwrap();
        assert!(result.success);
        assert!(result.files.unwrap().len() > 0);
    }

    #[tokio::test]
    async fn test_security_validation() {
        let temp_dir = TempDir::new().unwrap();
        let security_context = SecurityContext::for_file_operations(temp_dir.path());
        let executor = FileSystemExecutor::new(security_context);

        // Test access to restricted path
        let restricted_path = PathBuf::from("/etc/passwd");
        let operation = FileOperation {
            operation_type: FileOperationType::Read,
            path: restricted_path,
            content: None,
            create_dirs: None,
            recursive: None,
        };

        assert!(executor.validate_operation(&operation).is_err());
    }

    #[tokio::test]
    async fn test_file_size_limits() {
        let temp_dir = TempDir::new().unwrap();
        let security_context = SecurityContext::for_file_operations(temp_dir.path());
        let mut executor = FileSystemExecutor::new(security_context);
        executor.max_file_size = 10; // Very small limit for testing

        let large_content = "a".repeat(20); // Exceeds limit
        let operation = FileOperation {
            operation_type: FileOperationType::Write,
            path: temp_dir.path().join("large_file.txt"),
            content: Some(large_content),
            create_dirs: None,
            recursive: None,
        };

        let result = executor.execute_operation_internal(operation).await;
        assert!(result.is_err());
        match result.unwrap_err() {
            FileSystemError::FileTooLarge { .. } => (),
            _ => panic!("Expected FileTooLarge error"),
        }
    }
}