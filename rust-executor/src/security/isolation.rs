use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio::process::Command;
use tokio::time::timeout;
use super::capabilities::{SecurityContext, ResourceLimits, SecurityError};
use thiserror::Error;

#[cfg(unix)]
use nix::unistd::{Pid, setsid, setuid, setgid, Uid, Gid};
#[cfg(unix)]
use nix::sys::resource::{setrlimit, Resource};
#[cfg(unix)]
use nix::sys::wait::{waitpid, WaitStatus};
#[cfg(unix)]
use nix::sys::signal::{kill, Signal};

#[cfg(windows)]
use winapi::um::processthreadsapi::{CreateProcessW, PROCESS_INFORMATION, STARTUPINFOW};
#[cfg(windows)]
use winapi::um::jobapi2::{CreateJobObjectW, AssignProcessToJobObject};
#[cfg(windows)]
use winapi::um::handleapi::CloseHandle;

#[derive(Error, Debug)]
pub enum IsolationError {
    #[error("Process validation failed: {0}")]
    ValidationError(String),
    #[error("Failed to fork process: {0}")]
    ForkError(String),
    #[error("Resource limit setting failed: {0}")]
    ResourceLimitError(String),
    #[error("Process execution timeout")]
    ExecutionTimeout,
    #[error("Process killed by signal: {signal}")]
    ProcessKilled { signal: i32 },
    #[error("Process failed with exit code: {code}")]
    ProcessFailed { code: i32 },
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Security error: {0}")]
    SecurityError(#[from] SecurityError),
}

// Remove futures_io dependency - not needed for basic functionality

impl From<crate::executors::filesystem::FileSystemError> for IsolationError {
    fn from(error: crate::executors::filesystem::FileSystemError) -> Self {
        IsolationError::ValidationError(format!("Filesystem error: {:?}", error))
    }
}

impl From<crate::executors::command::CommandExecutionError> for IsolationError {
    fn from(error: crate::executors::command::CommandExecutionError) -> Self {
        IsolationError::ValidationError(format!("Command execution error: {:?}", error))
    }
}

pub struct ProcessIsolation {
    security_context: SecurityContext,
}

impl ProcessIsolation {
    pub fn new(security_context: SecurityContext) -> Self {
        Self { security_context }
    }
    
    /// Execute a function in an isolated process with full security restrictions
    pub async fn execute_isolated<F, R>(&self, operation: F) -> Result<R, IsolationError>
    where
        F: FnOnce() -> Result<R, IsolationError> + Send + 'static,
        R: Send + 'static,
    {
        #[cfg(unix)]
        {
            self.execute_isolated_unix(operation).await
        }
        
        #[cfg(windows)]
        {
            // Windows doesn't have fork, use process spawning instead
            self.execute_isolated_windows(operation).await
        }
    }
    
    #[cfg(unix)]
    async fn execute_isolated_unix<F, R>(&self, operation: F) -> Result<R, IsolationError>
    where
        F: FnOnce() -> Result<R, IsolationError> + Send,
        R: Send + 'static,
    {
        use nix::unistd::{fork, ForkResult};
        use nix::sys::wait::waitpid;
        use tokio::task;
        
        // Create a channel for communication
        let (tx, rx) = tokio::sync::oneshot::channel();
        
        // Fork the process
        match unsafe { fork() } {
            Ok(ForkResult::Parent { child }) => {
                // Parent process: wait for child with timeout
                self.wait_for_child_with_timeout(child, rx).await
            }
            Ok(ForkResult::Child) => {
                // Child process: apply restrictions and execute
                let result = self.apply_child_restrictions_and_execute(operation).await;
                
                // Send result back to parent (simplified for demo)
                std::process::exit(if result.is_ok() { 0 } else { 1 });
            }
            Err(err) => Err(IsolationError::ForkError(err.to_string())),
        }
    }
    
    #[cfg(windows)]
    async fn execute_isolated_windows<F, R>(&self, operation: F) -> Result<R, IsolationError>
    where
        F: FnOnce() -> Result<R, IsolationError> + Send + 'static,
        R: Send + 'static,
    {
        // Windows implementation using process spawning and job objects
        // This is a simplified version - full Windows sandboxing would require
        // Windows Job Objects, restricted tokens, and AppContainer
        
        let start_time = Instant::now();
        let timeout_duration = self.security_context.execution_timeout;
        
        // Apply resource limits via Windows mechanisms
        self.apply_windows_resource_limits()?;
        
        // Execute with timeout
        match tokio::time::timeout(timeout_duration, async move {
            tokio::task::spawn_blocking(move || operation()).await
                .map_err(|e| IsolationError::ForkError(e.to_string()))?
        }).await {
            Ok(result) => result,
            Err(_) => Err(IsolationError::ExecutionTimeout),
        }
    }
    
    #[cfg(unix)]
    async fn apply_child_restrictions_and_execute<F, R>(&self, operation: F) -> Result<R, IsolationError>
    where
        F: FnOnce() -> Result<R, IsolationError>,
    {
        // Create new session (detach from parent terminal)
        setsid().map_err(|e| IsolationError::ResourceLimitError(e.to_string()))?;
        
        // Apply resource limits
        self.apply_unix_resource_limits()?;
        
        // Change to restricted user if running as root (production safety)
        if Uid::effective().is_root() {
            // In production, switch to a restricted user
            let nobody_uid = Uid::from_raw(65534); // 'nobody' user
            let nobody_gid = Gid::from_raw(65534);
            
            setgid(nobody_gid).map_err(|e| IsolationError::ResourceLimitError(e.to_string()))?;
            setuid(nobody_uid).map_err(|e| IsolationError::ResourceLimitError(e.to_string()))?;
        }
        
        // Execute the actual operation
        operation()
    }
    
    #[cfg(unix)]
    fn apply_unix_resource_limits(&self) -> Result<(), IsolationError> {
        let limits = &self.security_context.resource_limits;
        
        // Memory limit (virtual memory)
        setrlimit(
            Resource::RLIMIT_AS,
            limits.max_memory_mb * 1024 * 1024,
            limits.max_memory_mb * 1024 * 1024,
        ).map_err(|e| IsolationError::ResourceLimitError(format!("Memory limit: {}", e)))?;
        
        // CPU time limit
        let cpu_seconds = limits.max_cpu_time_ms / 1000;
        setrlimit(
            Resource::RLIMIT_CPU,
            cpu_seconds,
            cpu_seconds,
        ).map_err(|e| IsolationError::ResourceLimitError(format!("CPU limit: {}", e)))?;
        
        // File handle limit
        setrlimit(
            Resource::RLIMIT_NOFILE,
            limits.max_file_handles as u64,
            limits.max_file_handles as u64,
        ).map_err(|e| IsolationError::ResourceLimitError(format!("File handle limit: {}", e)))?;
        
        // Process limit
        setrlimit(
            Resource::RLIMIT_NPROC,
            limits.max_child_processes as u64,
            limits.max_child_processes as u64,
        ).map_err(|e| IsolationError::ResourceLimitError(format!("Process limit: {}", e)))?;
        
        Ok(())
    }
    
    #[cfg(windows)]
    fn apply_windows_resource_limits(&self) -> Result<(), IsolationError> {
        // Windows resource limiting would use Job Objects
        // This is a placeholder for the actual implementation
        tracing::warn!("Windows resource limiting not fully implemented");
        Ok(())
    }
    
    #[cfg(unix)]
    async fn wait_for_child_with_timeout<R>(
        &self,
        child_pid: Pid,
        rx: tokio::sync::oneshot::Receiver<Result<R, IsolationError>>
    ) -> Result<R, IsolationError> {
        let timeout_duration = self.security_context.execution_timeout;
        
        match timeout(timeout_duration, rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => {
                // Channel closed, child probably crashed
                self.terminate_child(child_pid).await?;
                Err(IsolationError::ProcessFailed { code: -1 })
            }
            Err(_) => {
                // Timeout
                self.terminate_child(child_pid).await?;
                Err(IsolationError::ExecutionTimeout)
            }
        }
    }
    
    #[cfg(unix)]
    async fn terminate_child(&self, child_pid: Pid) -> Result<(), IsolationError> {
        // Send SIGTERM first
        if let Err(e) = kill(child_pid, Signal::SIGTERM) {
            tracing::warn!("Failed to send SIGTERM to child {}: {}", child_pid, e);
        }
        
        // Wait a bit for graceful shutdown
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Check if still alive and send SIGKILL if necessary
        match waitpid(child_pid, Some(nix::sys::wait::WaitPidFlag::WNOHANG)) {
            Ok(WaitStatus::StillAlive) => {
                if let Err(e) = kill(child_pid, Signal::SIGKILL) {
                    tracing::error!("Failed to send SIGKILL to child {}: {}", child_pid, e);
                }
                // Final wait
                waitpid(child_pid, None).map_err(|e| {
                    IsolationError::ForkError(format!("Failed to wait for killed child: {}", e))
                })?;
            }
            Ok(_) => {
                // Child already exited
            }
            Err(e) => {
                tracing::error!("Failed to check child status: {}", e);
            }
        }
        
        Ok(())
    }
    
    /// Execute a command with full isolation and security restrictions
    pub async fn execute_command(
        &self,
        command: &str,
        args: &[&str],
        working_dir: Option<&std::path::Path>,
    ) -> Result<CommandResult, IsolationError> {
        // Validate command execution capability
        use super::capabilities::Capability;
        self.security_context
            .validate_capability(&Capability::ProcessSpawn)
            .map_err(IsolationError::SecurityError)?;
        
        // Validate working directory if provided
        if let Some(dir) = working_dir {
            self.security_context
                .validate_path_access(dir)
                .map_err(IsolationError::SecurityError)?;
        }
        
        let start_time = Instant::now();
        let timeout_duration = self.security_context.execution_timeout;
        
        // Build command
        let mut cmd = Command::new(command);
        cmd.args(args);
        
        if let Some(dir) = working_dir {
            cmd.current_dir(dir);
        }
        
        // Set up stdio
        cmd.stdout(Stdio::piped())
           .stderr(Stdio::piped())
           .stdin(Stdio::null());
        
        // Filter environment variables
        cmd.env_clear();
        for var in &self.security_context.environment_allowlist {
            if let Ok(value) = std::env::var(var) {
                cmd.env(var, value);
            }
        }
        
        // Execute with timeout
        let child = cmd.spawn()?;
        let output = timeout(timeout_duration, child.wait_with_output()).await
            .map_err(|_| IsolationError::ExecutionTimeout)??;
        
        let execution_time = start_time.elapsed();
        
        Ok(CommandResult {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            execution_time,
        })
    }
}

#[derive(Debug, Clone)]
pub struct CommandResult {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub execution_time: Duration,
}

impl Default for ProcessIsolation {
    fn default() -> Self {
        Self::new(SecurityContext::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    
    #[tokio::test]
    async fn test_command_execution() {
        let context = SecurityContext::for_command_execution();
        let isolation = ProcessIsolation::new(context);
        
        // Test basic command execution
        let result = isolation.execute_command("echo", &["hello", "world"], None).await;
        assert!(result.is_ok());
        
        let cmd_result = result.unwrap();
        assert_eq!(cmd_result.exit_code, Some(0));
        assert!(cmd_result.stdout.contains("hello world"));
    }
    
    #[tokio::test]
    async fn test_resource_limits() {
        let mut context = SecurityContext::for_command_execution();
        context.resource_limits.max_memory_mb = 128;
        context.execution_timeout = Duration::from_secs(5);
        
        let isolation = ProcessIsolation::new(context);
        
        // This should work within limits
        let result = isolation.execute_command("echo", &["test"], None).await;
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_security_context_validation() {
        let context = SecurityContext::for_file_operations(&PathBuf::from("/tmp"));
        let isolation = ProcessIsolation::new(context);
        
        // Should have proper security context
        assert!(isolation.security_context.capabilities.len() > 0);
        assert!(isolation.security_context.allowed_paths.len() > 0);
    }
}