use std::collections::HashSet;
use std::path::{PathBuf, Path};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum Capability {
    FileRead(PathBuf),
    FileWrite(PathBuf),
    ProcessSpawn,
    NetworkAccess(String),
    SystemInfo,
    TempFileAccess,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: u64,
    pub max_cpu_time_ms: u64,
    pub max_file_handles: u32,
    pub max_network_connections: u32,
    pub max_child_processes: u8,
    pub max_disk_usage_mb: u64,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_memory_mb: 512,
            max_cpu_time_ms: 30000,
            max_file_handles: 100,
            max_network_connections: 10,
            max_child_processes: 5,
            max_disk_usage_mb: 1024,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityContext {
    pub capabilities: HashSet<Capability>,
    pub resource_limits: ResourceLimits,
    pub execution_timeout: Duration,
    pub allowed_paths: Vec<PathBuf>,
    pub restricted_paths: Vec<PathBuf>,
    pub environment_allowlist: HashSet<String>,
}

#[derive(Error, Debug)]
pub enum SecurityError {
    #[error("Capability denied: {capability:?}")]
    CapabilityDenied { capability: String },
    #[error("Path access denied: {path}")]
    PathAccessDenied { path: String },
    #[error("Resource limit exceeded: {resource} ({current} > {limit})")]
    ResourceLimitExceeded { resource: String, current: u64, limit: u64 },
    #[error("Environment variable not allowed: {variable}")]
    EnvironmentVariableDenied { variable: String },
    #[error("Process isolation failed: {reason}")]
    IsolationFailed { reason: String },
}

impl SecurityContext {
    pub fn new() -> Self {
        let mut allowed_paths = vec![
            PathBuf::from("/tmp"),
            PathBuf::from(std::env::temp_dir()),
        ];
        
        // Add current working directory if safe
        if let Ok(cwd) = std::env::current_dir() {
            allowed_paths.push(cwd);
        }

        Self {
            capabilities: HashSet::new(),
            resource_limits: ResourceLimits::default(),
            execution_timeout: Duration::from_secs(60),
            allowed_paths,
            restricted_paths: vec![
                PathBuf::from("/etc"),
                PathBuf::from("/sys"),
                PathBuf::from("/proc"),
                PathBuf::from("/dev"),
                PathBuf::from("/root"),
                PathBuf::from("C:\\Windows\\System32"),
                PathBuf::from("C:\\Windows\\SysWOW64"),
            ],
            environment_allowlist: [
                "PATH", "HOME", "USER", "TEMP", "TMP", "NODE_ENV"
            ].iter().map(|s| s.to_string()).collect(),
        }
    }
    
    /// Create a security context for file operations
    pub fn for_file_operations(base_path: &Path) -> Self {
        let mut context = Self::new();
        context.add_capability(Capability::FileRead(base_path.to_path_buf()));
        context.add_capability(Capability::FileWrite(base_path.to_path_buf()));
        context.add_capability(Capability::TempFileAccess);
        context.allowed_paths = vec![base_path.to_path_buf(), std::env::temp_dir()];
        context.resource_limits.max_memory_mb = 256;
        context.execution_timeout = Duration::from_secs(30);
        context
    }
    
    /// Create a security context for command execution
    pub fn for_command_execution() -> Self {
        let mut context = Self::new();
        context.add_capability(Capability::ProcessSpawn);
        context.add_capability(Capability::TempFileAccess);
        context.resource_limits.max_memory_mb = 1024;
        context.resource_limits.max_child_processes = 3;
        context.execution_timeout = Duration::from_secs(120);
        context
    }
    
    /// Validate a capability against this security context
    pub fn validate_capability(&self, capability: &Capability) -> Result<(), SecurityError> {
        match capability {
            Capability::FileRead(requested_path) | Capability::FileWrite(requested_path) => {
                // First validate path access
                self.validate_path_access(requested_path)?;
                
                // Check if we have a matching capability for the directory containing this file
                let has_capability = self.capabilities.iter().any(|cap| {
                    match (cap, capability) {
                        (Capability::FileRead(allowed_path), Capability::FileRead(req_path)) |
                        (Capability::FileWrite(allowed_path), Capability::FileWrite(req_path)) => {
                            let canonical_allowed = allowed_path.canonicalize().unwrap_or_else(|_| allowed_path.clone());
                            let canonical_requested = req_path.canonicalize().unwrap_or_else(|_| req_path.clone());
                            canonical_requested.starts_with(&canonical_allowed)
                        }
                        _ => false
                    }
                });
                
                if has_capability {
                    Ok(())
                } else {
                    Err(SecurityError::CapabilityDenied {
                        capability: format!("{:?}", capability),
                    })
                }
            }
            _ => {
                // For non-path capabilities, use exact match
                if self.capabilities.contains(capability) {
                    Ok(())
                } else {
                    Err(SecurityError::CapabilityDenied {
                        capability: format!("{:?}", capability),
                    })
                }
            }
        }
    }
    
    /// Validate path access against allowed and restricted paths
    pub fn validate_path_access(&self, path: &Path) -> Result<(), SecurityError> {
        let canonical_path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        
        // Check if path is explicitly restricted
        for restricted in &self.restricted_paths {
            let canonical_restricted = restricted.canonicalize().unwrap_or_else(|_| restricted.clone());
            if canonical_path.starts_with(&canonical_restricted) {
                return Err(SecurityError::PathAccessDenied {
                    path: path.display().to_string(),
                });
            }
        }
        
        // Check if path is in allowed list - canonicalize both for consistent comparison
        for allowed in &self.allowed_paths {
            let canonical_allowed = allowed.canonicalize().unwrap_or_else(|_| allowed.clone());
            if canonical_path.starts_with(&canonical_allowed) {
                return Ok(());
            }
        }
        
        Err(SecurityError::PathAccessDenied {
            path: path.display().to_string(),
        })
    }
    
    /// Validate environment variable access
    pub fn validate_environment_access(&self, variable: &str) -> Result<(), SecurityError> {
        if self.environment_allowlist.contains(variable) {
            Ok(())
        } else {
            Err(SecurityError::EnvironmentVariableDenied {
                variable: variable.to_string(),
            })
        }
    }
    
    /// Add a capability to this security context
    pub fn add_capability(&mut self, capability: Capability) {
        self.capabilities.insert(capability);
    }
    
    /// Add an allowed path
    pub fn add_allowed_path(&mut self, path: PathBuf) {
        self.allowed_paths.push(path);
    }
    
    /// Add a restricted path
    pub fn add_restricted_path(&mut self, path: PathBuf) {
        self.restricted_paths.push(path);
    }
    
    /// Update resource limits
    pub fn set_resource_limits(&mut self, limits: ResourceLimits) {
        self.resource_limits = limits;
    }
    
    /// Create a minimal security context for safe operations
    pub fn minimal() -> Self {
        let mut context = Self::new();
        context.add_capability(Capability::TempFileAccess);
        context.resource_limits.max_memory_mb = 128;
        context.resource_limits.max_cpu_time_ms = 10000;
        context.execution_timeout = Duration::from_secs(15);
        context.allowed_paths = vec![std::env::temp_dir()];
        context
    }
}

impl Default for SecurityContext {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_capability_validation() {
        let mut context = SecurityContext::new();
        let temp_path = std::env::temp_dir();
        
        context.add_capability(Capability::FileRead(temp_path.clone()));
        
        assert!(context.validate_capability(&Capability::FileRead(temp_path)).is_ok());
        assert!(context.validate_capability(&Capability::ProcessSpawn).is_err());
    }
    
    #[test]
    fn test_path_validation() {
        let context = SecurityContext::new();
        let temp_path = std::env::temp_dir().join("test.txt");
        
        assert!(context.validate_path_access(&temp_path).is_ok());
        assert!(context.validate_path_access(&PathBuf::from("/etc/passwd")).is_err());
    }
    
    #[test]
    fn test_environment_validation() {
        let context = SecurityContext::new();
        
        assert!(context.validate_environment_access("PATH").is_ok());
        assert!(context.validate_environment_access("SENSITIVE_VAR").is_err());
    }
}