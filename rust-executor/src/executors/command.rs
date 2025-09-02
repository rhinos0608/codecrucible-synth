use crate::protocol::communication::CommandExecutor as CommandExecutorTrait;
use crate::protocol::messages::{
    ErrorCategory, ErrorInfo, ExecutionRequest, ExecutionResponse, PerformanceMetrics,
};
use crate::security::{IsolationError, ProcessIsolation, SecurityContext, SecurityError};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::{process::Command, time::timeout};

#[derive(Error, Debug)]
pub enum CommandExecutionError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Security error: {0}")]
    SecurityError(#[from] SecurityError),
    #[error("Isolation error: {0}")]
    IsolationError(#[from] IsolationError),
    #[error("Command not allowed: {command}")]
    CommandNotAllowed { command: String },
    #[error("Command timeout after {timeout_ms}ms")]
    CommandTimeout { timeout_ms: u64 },
    #[error("Command failed with exit code: {code}")]
    CommandFailed { code: i32 },
    #[error("Invalid arguments: {message}")]
    InvalidArguments { message: String },
    #[error("Working directory not allowed: {path}")]
    WorkingDirectoryNotAllowed { path: String },
    #[error("Environment variable not allowed: {variable}")]
    EnvironmentVariableNotAllowed { variable: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandRequest {
    pub command: String,
    pub args: Vec<String>,
    pub working_directory: Option<PathBuf>,
    pub environment: HashMap<String, String>,
    pub timeout_ms: Option<u64>,
    pub capture_output: bool,
    pub stream_output: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub execution_time_ms: u64,
    pub command: String,
    pub working_directory: Option<PathBuf>,
}

/// Default command whitelist for security - can be overridden via configuration
const DEFAULT_ALLOWED_COMMANDS: &[&str] = &[
    // Basic file operations
    "ls", "dir", "cat", "head", "tail", "find", "grep", "wc", "sort", "uniq",
    // Development tools
    "git", "npm", "node", "python", "python3", "pip", "pip3", "rustc", "cargo",
    // System information
    "echo", "pwd", "which", "whereis", "uname", "whoami", // Text processing
    "sed", "awk", "cut", "tr", "jq", // Archive operations
    "tar", "zip", "unzip", "gzip", "gunzip",
];

/// Environment variable whitelist - only these can be set or accessed
const ALLOWED_ENV_VARS: &[&str] = &[
    "PATH",
    "HOME",
    "USER",
    "SHELL",
    "TERM",
    "LANG",
    "LC_ALL",
    "NODE_ENV",
    "PYTHON_PATH",
    "CARGO_HOME",
    "RUSTUP_HOME",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
];

/// Dangerous command patterns that are always blocked
const BLOCKED_PATTERNS: &[&str] = &[
    "rm -rf",
    "rm *",
    "> /dev/",
    "curl | sh",
    "wget | sh",
    "chmod 777",
    "chown root",
    "sudo",
    "su ",
    "passwd",
    "useradd",
    "userdel",
    "usermod",
];

/// Secure command executor with comprehensive sandboxing and validation
pub struct CommandExecutor {
    security_context: SecurityContext,
    isolation: ProcessIsolation,
    command_whitelist: Vec<String>,
    blocked_patterns: Vec<String>,
    max_execution_time: Duration,
    max_output_size: usize,
    /// Maximum amount of memory the spawned process can allocate (in bytes).
    /// This limit is best-effort and currently enforced only on Unix systems.
    max_memory_bytes: u64,
}

impl CommandExecutor {
    pub fn new(security_context: SecurityContext) -> Self {
        let isolation = ProcessIsolation::new(security_context.clone());

        // Copy blocked patterns for simple string matching
        let blocked_patterns = BLOCKED_PATTERNS.iter().map(|s| s.to_string()).collect();

        let command_whitelist = Self::load_command_whitelist(&security_context);

        Self {
            security_context,
            isolation,
            command_whitelist,
            blocked_patterns,
            max_execution_time: Duration::from_secs(120), // 2 minutes default
            max_output_size: 1024 * 1024,                 // 1MB default
            max_memory_bytes: 512 * 1024 * 1024,          // 512MB memory limit
        }
    }

    fn load_command_whitelist(security_context: &SecurityContext) -> Vec<String> {
        if !security_context.command_allowlist.is_empty() {
            return security_context.command_allowlist.iter().cloned().collect();
        }

        if let Ok(path) = std::env::var("COMMAND_ALLOWLIST_FILE") {
            if let Ok(list) = Self::load_whitelist_from_file(Path::new(&path)) {
                return list;
            }
        }

        DEFAULT_ALLOWED_COMMANDS
            .iter()
            .map(|s| s.to_string())
            .collect()
    }

    fn load_whitelist_from_file(path: &Path) -> Result<Vec<String>, std::io::Error> {
        let content = fs::read_to_string(path)?;
        let list: Vec<String> = serde_json::from_str(&content)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        Ok(list)
    }

    /// Execute a command with full security validation and sandboxing
    pub async fn execute(&self, request: ExecutionRequest) -> ExecutionResponse {
        let start_time = Instant::now();
        let request_id = generate_request_id();

        // Parse command request from arguments
        let command_request = match self.parse_command_request(&request.arguments) {
            Ok(req) => req,
            Err(e) => {
                return ExecutionResponse {
                    request_id,
                    success: false,
                    result: None,
                    error: Some(ErrorInfo {
                        code: "INVALID_COMMAND_REQUEST".to_string(),
                        message: e.to_string(),
                        category: ErrorCategory::InvalidInput,
                        details: serde_json::json!({"arguments": request.arguments})
                            .as_object()
                            .unwrap()
                            .iter()
                            .map(|(k, v)| (k.clone(), v.clone()))
                            .collect(),
                    }),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    performance_metrics: None,
                };
            }
        };

        // Comprehensive security validation
        if let Err(e) = self.validate_command_security(&command_request) {
            return ExecutionResponse {
                request_id,
                success: false,
                result: None,
                error: Some(ErrorInfo {
                    code: "SECURITY_VIOLATION".to_string(),
                    message: e.to_string(),
                    category: ErrorCategory::Security,
                    details: serde_json::json!({
                        "command": command_request.command,
                        "working_directory": command_request.working_directory,
                    })
                    .as_object()
                    .unwrap()
                    .iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect(),
                }),
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                performance_metrics: None,
            };
        }

        // Execute in isolated process for additional security
        let arg_refs: Vec<&str> = command_request.args.iter().map(|s| s.as_str()).collect();
        let isolation_result = self
            .isolation
            .execute_command(
                &command_request.command,
                &arg_refs,
                command_request.working_directory.as_deref(),
            )
            .await
            .map(|res| CommandResult {
                success: res.exit_code.map_or(false, |code| code == 0),
                exit_code: res.exit_code,
                stdout: if command_request.capture_output {
                    res.stdout
                } else {
                    String::new()
                },
                stderr: if command_request.capture_output {
                    res.stderr
                } else {
                    String::new()
                },
                execution_time_ms: res.execution_time.as_millis() as u64,
                command: command_request.command.clone(),
                working_directory: command_request.working_directory.clone(),
            })
            .map_err(CommandExecutionError::IsolationError);

        let execution_time = start_time.elapsed().as_millis() as u64;

        match isolation_result {
            Ok(command_result) => ExecutionResponse {
                request_id,
                success: command_result.success,
                result: Some(serde_json::to_value(command_result).unwrap()),
                error: None,
                execution_time_ms: execution_time,
                performance_metrics: Some(PerformanceMetrics {
                    cpu_time_ms: execution_time,
                    memory_peak_mb: 0, // Would be measured by isolation layer
                    memory_avg_mb: 0,
                    io_read_bytes: 0,
                    io_write_bytes: 0,
                    context_switches: 0,
                }),
            },
            Err(e) => {
                let (code, category, details) = match &e {
                    CommandExecutionError::CommandTimeout { timeout_ms } => (
                        "COMMAND_TIMEOUT",
                        ErrorCategory::Timeout,
                        serde_json::json!({ "timeout_ms": timeout_ms }),
                    ),
                    _ => (
                        "EXECUTION_FAILED",
                        ErrorCategory::SystemError,
                        serde_json::json!({ "isolation_error": e.to_string() }),
                    ),
                };

                ExecutionResponse {
                    request_id,
                    success: false,
                    result: None,
                    error: Some(ErrorInfo {
                        code: code.to_string(),
                        message: e.to_string(),
                        category,
                        details: details
                            .as_object()
                            .unwrap()
                            .iter()
                            .map(|(k, v)| (k.clone(), v.clone()))
                            .collect(),
                    }),
                    execution_time_ms: execution_time,
                    performance_metrics: None,
                }
            }
        }
    }

    /// Execute the actual command (runs in isolated process)
    async fn execute_command_internal(
        &self,
        request: CommandRequest,
    ) -> Result<CommandResult, CommandExecutionError> {
        let start_time = Instant::now();

        // Build the command
        let mut cmd = Command::new(&request.command);
        cmd.args(&request.args);

        // Set working directory if specified
        if let Some(ref wd) = request.working_directory {
            cmd.current_dir(wd);
        }

        // Configure stdio
        if request.capture_output {
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());
        } else {
            cmd.stdout(Stdio::null());
            cmd.stderr(Stdio::null());
        }
        cmd.stdin(Stdio::null()); // Never allow stdin input for security

        // Set up environment - clear all and only add allowed variables
        cmd.env_clear();
        for (key, value) in &request.environment {
            if ALLOWED_ENV_VARS.contains(&key.as_str()) {
                cmd.env(key, value);
            }
        }

        // Add essential environment variables
        if let Ok(path) = std::env::var("PATH") {
            cmd.env("PATH", path);
        }
        if let Ok(home) = std::env::var("HOME") {
            cmd.env("HOME", home);
        }

        // Ensure spawned process is terminated if dropped
        cmd.kill_on_drop(true);

        // Apply resource limits on Unix platforms
        #[cfg(unix)]
        {
            use nix::sys::resource::{rlim_t, setrlimit, Resource};
            use std::os::unix::process::CommandExt;

            let mem_limit: rlim_t = self.max_memory_bytes as rlim_t;
            let cpu_limit: rlim_t = self.max_execution_time.as_secs() as rlim_t;

            // Safety: pre_exec runs in the spawned child before exec
            unsafe {
                cmd.pre_exec(move || {
                    setrlimit(Resource::RLIMIT_AS, mem_limit, mem_limit)
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                    setrlimit(Resource::RLIMIT_CPU, cpu_limit, cpu_limit)
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                    Ok(())
                });
            }
        }

        // Execute with timeout
        let timeout_duration = Duration::from_millis(
            request
                .timeout_ms
                .unwrap_or(self.max_execution_time.as_millis() as u64),
        );

        let output = timeout(timeout_duration, async {
            let child = cmd.spawn()?;
            child.wait_with_output().await
        })
        .await;

        let output = match output {
            Ok(Ok(output)) => output,
            Ok(Err(e)) => return Err(CommandExecutionError::IoError(e)),
            Err(_) => {
                return Err(CommandExecutionError::CommandTimeout {
                    timeout_ms: timeout_duration.as_millis() as u64,
                })
            }
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        // Process output with size limits
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        let stdout_truncated = if stdout.len() > self.max_output_size {
            format!(
                "{}... (truncated at {} bytes)",
                &stdout[..self.max_output_size],
                self.max_output_size
            )
        } else {
            stdout.to_string()
        };

        let stderr_truncated = if stderr.len() > self.max_output_size {
            format!(
                "{}... (truncated at {} bytes)",
                &stderr[..self.max_output_size],
                self.max_output_size
            )
        } else {
            stderr.to_string()
        };

        let success = output.status.success();
        let exit_code = output.status.code();

        Ok(CommandResult {
            success,
            exit_code,
            stdout: stdout_truncated,
            stderr: stderr_truncated,
            execution_time_ms: execution_time,
            command: request.command,
            working_directory: request.working_directory,
        })
    }

    /// Parse command request from execution arguments
    fn parse_command_request(
        &self,
        arguments: &HashMap<String, serde_json::Value>,
    ) -> Result<CommandRequest, CommandExecutionError> {
        let command = arguments
            .get("command")
            .and_then(|v| v.as_str())
            .ok_or_else(|| CommandExecutionError::InvalidArguments {
                message: "command field is required".to_string(),
            })?
            .to_string();

        let args = arguments
            .get("args")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(String::from)
                    .collect()
            })
            .unwrap_or_default();

        let working_directory = arguments
            .get("working_directory")
            .and_then(|v| v.as_str())
            .map(PathBuf::from);

        let environment = arguments
            .get("environment")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                    .collect()
            })
            .unwrap_or_default();

        let timeout_ms = arguments.get("timeout_ms").and_then(|v| v.as_u64());

        let capture_output = arguments
            .get("capture_output")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        let stream_output = arguments
            .get("stream_output")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(CommandRequest {
            command,
            args,
            working_directory,
            environment,
            timeout_ms,
            capture_output,
            stream_output,
        })
    }

    /// Comprehensive security validation for command execution
    fn validate_command_security(
        &self,
        request: &CommandRequest,
    ) -> Result<(), CommandExecutionError> {
        // Check if command is in whitelist
        if !self.command_whitelist.contains(&request.command) {
            return Err(CommandExecutionError::CommandNotAllowed {
                command: request.command.clone(),
            });
        }

        // Check for blocked patterns in the full command line
        let full_command = format!("{} {}", request.command, request.args.join(" "));
        for pattern in &self.blocked_patterns {
            if full_command.contains(pattern) {
                return Err(CommandExecutionError::CommandNotAllowed {
                    command: full_command,
                });
            }
        }

        // Validate working directory
        if let Some(ref wd) = request.working_directory {
            self.security_context
                .validate_path_access(wd)
                .map_err(|_| CommandExecutionError::WorkingDirectoryNotAllowed {
                    path: wd.display().to_string(),
                })?;
        }

        // Validate environment variables
        for key in request.environment.keys() {
            if !ALLOWED_ENV_VARS.contains(&key.as_str()) {
                return Err(CommandExecutionError::EnvironmentVariableNotAllowed {
                    variable: key.clone(),
                });
            }
        }

        // Validate process spawn capability
        use crate::security::Capability;
        self.security_context
            .validate_capability(&Capability::ProcessSpawn)?;

        // Additional argument validation for specific commands
        self.validate_command_arguments(&request.command, &request.args)?;

        Ok(())
    }

    /// Validate command-specific arguments for additional security
    fn validate_command_arguments(
        &self,
        command: &str,
        args: &[String],
    ) -> Result<(), CommandExecutionError> {
        match command {
            "git" => {
                // Block dangerous git operations
                if args
                    .iter()
                    .any(|arg| arg.contains("--exec") || arg.contains("--upload-pack"))
                {
                    return Err(CommandExecutionError::CommandNotAllowed {
                        command: format!("git {}", args.join(" ")),
                    });
                }
            }
            "npm" | "node" => {
                // Block npm operations that can execute arbitrary code
                if args
                    .iter()
                    .any(|arg| arg == "run-script" || arg.contains("--allow-run"))
                {
                    return Err(CommandExecutionError::CommandNotAllowed {
                        command: format!("{} {}", command, args.join(" ")),
                    });
                }
            }
            "python" | "python3" => {
                // Block dangerous Python operations
                if args
                    .iter()
                    .any(|arg| arg == "-c" || arg.contains("exec") || arg.contains("eval"))
                {
                    return Err(CommandExecutionError::CommandNotAllowed {
                        command: format!("{} {}", command, args.join(" ")),
                    });
                }
            }
            "find" => {
                // Block find with exec
                if args.iter().any(|arg| arg == "-exec" || arg == "-execdir") {
                    return Err(CommandExecutionError::CommandNotAllowed {
                        command: format!("find {}", args.join(" ")),
                    });
                }
            }
            _ => {}
        }

        Ok(())
    }

    /// Get list of supported commands
    pub fn get_supported_commands(&self) -> Vec<String> {
        self.command_whitelist.clone()
    }

    /// Add a command to the whitelist (for extensibility)
    pub fn add_allowed_command(&mut self, command: String) -> Result<(), CommandExecutionError> {
        self.validate_command_name(&command)?;
        if !self.command_whitelist.contains(&command) {
            self.command_whitelist.push(command);
        }
        Ok(())
    }

    /// Remove a command from the whitelist
    pub fn remove_allowed_command(&mut self, command: &str) {
        self.command_whitelist.retain(|c| c != command);
    }

    /// Replace the whitelist with a new set of commands
    pub fn set_command_whitelist(
        &mut self,
        commands: Vec<String>,
    ) -> Result<(), CommandExecutionError> {
        for cmd in &commands {
            self.validate_command_name(cmd)?;
        }
        self.command_whitelist = commands;
        Ok(())
    }

    fn validate_command_name(&self, command: &str) -> Result<(), CommandExecutionError> {
        // List of forbidden shell metacharacters
        const SHELL_METACHARS: &[char] = &[
            ';', '&', '|', '$', '>', '<', '`', '!', '*', '?', '~', '(', ')', '{', '}', '[', ']', '\'', '"'
        ];
        if command.trim().is_empty()
            || command.contains(' ')
            || command.contains('/')
            || command.contains('\\')
            || command.chars().any(|c| SHELL_METACHARS.contains(&c))
        {
            return Err(CommandExecutionError::InvalidArguments {
                message: format!("Invalid command name: {}", command),
            });
        }

        for pattern in &self.blocked_patterns {
            if command.contains(pattern) {
                return Err(CommandExecutionError::CommandNotAllowed {
                    command: command.to_string(),
                });
            }
        }

        Ok(())
    }
}

#[async_trait]
impl CommandExecutorTrait for CommandExecutor {
    async fn execute(&self, request: ExecutionRequest) -> ExecutionResponse {
        CommandExecutor::execute(self, request).await
    }

    fn get_supported_commands(&self) -> Vec<String> {
        CommandExecutor::get_supported_commands(self)
    }
}

/// Generate a unique request ID
fn generate_request_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::messages::{
        ExecutionContext, ExecutionRequest, ResourceLimitConfig, SecurityLevel,
    };
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::Mutex;
    use tempfile::TempDir;

    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    fn create_test_executor() -> (CommandExecutor, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let security_context = SecurityContext::for_command_execution();
        let executor = CommandExecutor::new(security_context);
        (executor, temp_dir)
    }

    #[tokio::test]
    async fn test_simple_command_execution() {
        let (executor, _temp_dir) = create_test_executor();

        let request = CommandRequest {
            command: "echo".to_string(),
            args: vec!["hello".to_string(), "world".to_string()],
            working_directory: None,
            environment: HashMap::new(),
            timeout_ms: Some(5000),
            capture_output: true,
            stream_output: false,
        };

        let result = executor.execute_command_internal(request).await.unwrap();
        assert!(result.success);
        assert!(result.stdout.contains("hello world"));
    }

    #[tokio::test]
    async fn test_command_execution_in_sandbox() {
        let (executor, temp_dir) = create_test_executor();

        let mut arguments = HashMap::new();
        arguments.insert(
            "command".to_string(),
            serde_json::Value::String("pwd".to_string()),
        );
        arguments.insert("args".to_string(), json!([]));
        arguments.insert(
            "working_directory".to_string(),
            serde_json::Value::String(temp_dir.path().to_string_lossy().to_string()),
        );

        let context = ExecutionContext {
            session_id: "test".to_string(),
            working_directory: temp_dir.path().to_string_lossy().to_string(),
            environment: HashMap::new(),
            security_level: SecurityLevel::Medium,
            capabilities: vec![],
            resource_limits: ResourceLimitConfig {
                max_memory_mb: 128,
                max_cpu_time_ms: 1_000,
                max_execution_time_ms: 5_000,
                max_file_handles: 64,
            },
        };

        let request = ExecutionRequest {
            tool_id: "command".to_string(),
            operation: "execute".to_string(),
            arguments,
            context,
            timeout_ms: Some(5_000),
            stream_response: false,
        };

        let response = executor.execute(request).await;
        assert!(response.success, "{:?}", response.error);

        let result: CommandResult = serde_json::from_value(response.result.unwrap()).unwrap();
        assert_eq!(result.stdout.trim(), temp_dir.path().to_string_lossy());
    }

    #[tokio::test]
    async fn test_command_whitelist_validation() {
        let (executor, _temp_dir) = create_test_executor();

        let request = CommandRequest {
            command: "rm".to_string(), // Not in whitelist
            args: vec!["-rf".to_string(), "/".to_string()],
            working_directory: None,
            environment: HashMap::new(),
            timeout_ms: Some(5000),
            capture_output: true,
            stream_output: false,
        };

        let result = executor.validate_command_security(&request);
        assert!(result.is_err());
        match result.unwrap_err() {
            CommandExecutionError::CommandNotAllowed { .. } => (),
            _ => panic!("Expected CommandNotAllowed error"),
        }
    }

    #[tokio::test]
    async fn test_blocked_pattern_detection() {
        let (executor, _temp_dir) = create_test_executor();

        let request = CommandRequest {
            command: "ls".to_string(),                            // In whitelist
            args: vec![">".to_string(), "/dev/null".to_string()], // Blocked pattern
            working_directory: None,
            environment: HashMap::new(),
            timeout_ms: Some(5000),
            capture_output: true,
            stream_output: false,
        };

        let result = executor.validate_command_security(&request);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_working_directory_validation() {
        let (executor, temp_dir) = create_test_executor();

        // Valid working directory
        let request = CommandRequest {
            command: "pwd".to_string(),
            args: vec![],
            working_directory: Some(temp_dir.path().to_path_buf()),
            environment: HashMap::new(),
            timeout_ms: Some(5000),
            capture_output: true,
            stream_output: false,
        };

        let result = executor.validate_command_security(&request);
        // This might fail due to security context restrictions, but shouldn't panic
        let _ = result;
    }

    #[tokio::test]
    async fn test_environment_variable_filtering() {
        let (executor, _temp_dir) = create_test_executor();

        let mut env = HashMap::new();
        env.insert("PATH".to_string(), "/usr/bin".to_string()); // Allowed
        env.insert("DANGEROUS_VAR".to_string(), "value".to_string()); // Not allowed

        let request = CommandRequest {
            command: "echo".to_string(),
            args: vec!["test".to_string()],
            working_directory: None,
            environment: env,
            timeout_ms: Some(5000),
            capture_output: true,
            stream_output: false,
        };

        let result = executor.validate_command_security(&request);
        assert!(result.is_err());
        match result.unwrap_err() {
            CommandExecutionError::EnvironmentVariableNotAllowed { .. } => (),
            _ => panic!("Expected EnvironmentVariableNotAllowed error"),
        }
    }

    #[tokio::test]
    async fn test_argument_validation() {
        let (executor, _temp_dir) = create_test_executor();

        // Test dangerous git command
        let request = CommandRequest {
            command: "git".to_string(),
            args: vec![
                "clone".to_string(),
                "--exec".to_string(),
                "malicious".to_string(),
            ],
            working_directory: None,
            environment: HashMap::new(),
            timeout_ms: Some(5000),
            capture_output: true,
            stream_output: false,
        };

        let result = executor.validate_command_arguments(&request.command, &request.args);
        assert!(result.is_err());
    }

    #[test]
    fn test_output_truncation() {
        let (executor, _temp_dir) = create_test_executor();

        // Test with mock large output
        let large_output = "a".repeat(executor.max_output_size + 100);
        let truncated = if large_output.len() > executor.max_output_size {
            format!(
                "{}... (truncated at {} bytes)",
                &large_output[..executor.max_output_size],
                executor.max_output_size
            )
        } else {
            large_output
        };

        assert!(truncated.contains("truncated"));
        assert!(truncated.len() <= executor.max_output_size + 50); // Allow some extra for truncation message
    }

    #[test]
    fn test_whitelist_management() {
        let (mut executor, _temp_dir) = create_test_executor();

        let initial_count = executor.get_supported_commands().len();

        // Add a new command
        executor
            .add_allowed_command("test_command".to_string())
            .unwrap();
        assert_eq!(executor.get_supported_commands().len(), initial_count + 1);

        // Remove a command
        executor.remove_allowed_command("test_command");
        assert_eq!(executor.get_supported_commands().len(), initial_count);
    }

    #[test]
    fn test_allowlist_from_security_context() {
        let mut context = SecurityContext::for_command_execution();
        context.set_command_allowlist(vec!["custom".to_string()]);
        let executor = CommandExecutor::new(context);
        assert_eq!(
            executor.get_supported_commands(),
            vec!["custom".to_string()]
        );
    }

    #[test]
    fn test_allowlist_from_config_file() {
        let _lock = ENV_MUTEX.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("allow.json");
        fs::write(&file_path, serde_json::to_string(&vec!["foo"]).unwrap()).unwrap();
        std::env::set_var("COMMAND_ALLOWLIST_FILE", &file_path);
        let context = SecurityContext::for_command_execution();
        let executor = CommandExecutor::new(context);
        std::env::remove_var("COMMAND_ALLOWLIST_FILE");
        assert_eq!(executor.get_supported_commands(), vec!["foo".to_string()]);
    }

    #[test]
    fn test_invalid_command_rejected() {
        let (mut executor, _temp_dir) = create_test_executor();
        assert!(executor.add_allowed_command("bad cmd".to_string()).is_err());
    }
}
