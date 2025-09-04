use std::time::{Duration, Instant};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::timeout;
use std::collections::HashMap;
use uuid::Uuid;
use crate::security::validation::SecurityValidator;

#[cfg(unix)]
use nix::sys::resource::{Resource, setrlimit};
#[cfg(unix)]
use nix::unistd::{chroot, setuid, setgid, Uid, Gid};

#[cfg(windows)]
use winapi::um::jobapi2::*;
#[cfg(windows)]
use winapi::um::processthreadsapi::*;
#[cfg(windows)]
use winapi::um::handleapi::CloseHandle;
#[cfg(windows)]
use std::ptr;

pub struct SandboxConfig {
    pub max_memory_mb: u64,
    pub max_cpu_time_ms: u64,
    pub execution_timeout: Duration,
    pub allowed_paths: Vec<std::path::PathBuf>,
    pub enable_network: bool,
    pub enable_file_write: bool,
    pub max_processes: u32,
    pub jail_directory: Option<std::path::PathBuf>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 512,
            max_cpu_time_ms: 30000,
            execution_timeout: Duration::from_secs(60),
            allowed_paths: vec![std::path::PathBuf::from("/tmp")],
            enable_network: false,
            enable_file_write: false,
            max_processes: 1,
            jail_directory: None,
        }
    }
}

#[derive(Debug)]
pub struct SandboxedProcess {
    pub id: Uuid,
    pub start_time: Instant,
    pub memory_usage: u64,
    pub cpu_time: Duration,
    pub status: ProcessStatus,
}

#[derive(Debug, Clone)]
pub enum ProcessStatus {
    Running,
    Completed,
    TimedOut,
    MemoryLimitExceeded,
    CpuLimitExceeded,
    SecurityViolation(String),
    Failed(String),
}

pub struct SecureExecutor {
    config: SandboxConfig,
    validator: SecurityValidator,
    active_processes: Arc<Mutex<HashMap<Uuid, SandboxedProcess>>>,
}

impl SecureExecutor {
    pub fn new(config: SandboxConfig) -> Self {
        Self { 
            config,
            validator: SecurityValidator::new(),
            active_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    pub async fn execute_isolated<F, R>(&self, operation: F) -> Result<R, Box<dyn std::error::Error>>
    where
        F: FnOnce() -> Result<R, Box<dyn std::error::Error>> + Send + 'static,
        R: Send + 'static,
    {
        let process_id = Uuid::new_v4();
        let start_time = Instant::now();
        
        // Create sandboxed process record
        let mut processes = self.active_processes.lock().await;
        processes.insert(process_id, SandboxedProcess {
            id: process_id,
            start_time,
            memory_usage: 0,
            cpu_time: Duration::new(0, 0),
            status: ProcessStatus::Running,
        });
        drop(processes);

        let result = self.execute_with_platform_sandbox(process_id, operation).await;
        
        // Update process status
        let mut processes = self.active_processes.lock().await;
        if let Some(process) = processes.get_mut(&process_id) {
            process.status = match &result {
                Ok(_) => ProcessStatus::Completed,
                Err(e) => ProcessStatus::Failed(e.to_string()),
            };
        }
        
        result
    }

    async fn execute_with_platform_sandbox<F, R>(&self, process_id: Uuid, operation: F) -> Result<R, Box<dyn std::error::Error>>
    where
        F: FnOnce() -> Result<R, Box<dyn std::error::Error>> + Send + 'static,
        R: Send + 'static,
    {
        // Apply timeout wrapper
        let timeout_result = timeout(self.config.execution_timeout, async move {
            // Platform-specific sandboxing
            #[cfg(unix)]
            {
                self.execute_unix_sandbox(process_id, operation).await
            }
            #[cfg(windows)]
            {
                self.execute_windows_sandbox(process_id, operation).await
            }
            #[cfg(not(any(unix, windows)))]
            {
                // Fallback for unsupported platforms - basic resource monitoring
                self.execute_basic_sandbox(process_id, operation).await
            }
        }).await;

        match timeout_result {
            Ok(result) => result,
            Err(_) => {
                // Update process status to timed out
                let mut processes = self.active_processes.lock().await;
                if let Some(process) = processes.get_mut(&process_id) {
                    process.status = ProcessStatus::TimedOut;
                }
                Err("Operation timed out".into())
            }
        }
    }

    #[cfg(unix)]
    async fn execute_unix_sandbox<F, R>(&self, _process_id: Uuid, operation: F) -> Result<R, Box<dyn std::error::Error>>
    where
        F: FnOnce() -> Result<R, Box<dyn std::error::Error>> + Send + 'static,
        R: Send + 'static,
    {
        use tokio::task;
        
        // Execute in a separate task with Unix-specific isolation
        let config = &self.config;
        let max_memory = config.max_memory_mb * 1024 * 1024; // Convert to bytes
        
        task::spawn_blocking(move || {
            // Set resource limits
            if let Err(e) = setrlimit(Resource::RLIMIT_AS, max_memory, max_memory) {
                tracing::warn!("Failed to set memory limit: {}", e);
            }
            
            // Set CPU time limit (in seconds)
            let cpu_limit = config.max_cpu_time_ms / 1000;
            if let Err(e) = setrlimit(Resource::RLIMIT_CPU, cpu_limit, cpu_limit) {
                tracing::warn!("Failed to set CPU time limit: {}", e);
            }
            
            // Set process limit
            if let Err(e) = setrlimit(Resource::RLIMIT_NPROC, config.max_processes as u64, config.max_processes as u64) {
                tracing::warn!("Failed to set process limit: {}", e);
            }
            
            // Disable network if configured
            if !config.enable_network {
                // Note: Full network isolation requires more complex setup with namespaces
                tracing::debug!("Network isolation requested but not fully implemented");
            }
            
            // Apply chroot jail if specified (requires root privileges)
            if let Some(ref jail_dir) = config.jail_directory {
                if let Err(e) = chroot(jail_dir) {
                    tracing::warn!("Failed to chroot to {:?}: {}", jail_dir, e);
                }
            }
            
            // Execute the operation
            operation()
        }).await?
    }

    #[cfg(windows)]
    async fn execute_windows_sandbox<F, R>(&self, _process_id: Uuid, operation: F) -> Result<R, Box<dyn std::error::Error>>
    where
        F: FnOnce() -> Result<R, Box<dyn std::error::Error>> + Send + 'static,
        R: Send + 'static,
    {
        use tokio::task;
        
        // Capture config values before moving into closure
        let max_processes = self.config.max_processes;
        let max_memory_mb = self.config.max_memory_mb;
        
        task::spawn_blocking(move || {
            unsafe {
                // Create a Job Object for resource limiting
                let job_handle = CreateJobObjectA(ptr::null_mut(), ptr::null());
                if job_handle.is_null() {
                    tracing::warn!("Failed to create job object for sandboxing");
                    return operation();
                }
                
                // Set up job limits
                let mut job_limits: winapi::um::winnt::JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                job_limits.BasicLimitInformation.LimitFlags = 
                    winapi::um::winnt::JOB_OBJECT_LIMIT_PROCESS_MEMORY |
                    winapi::um::winnt::JOB_OBJECT_LIMIT_JOB_MEMORY |
                    winapi::um::winnt::JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
                
                job_limits.BasicLimitInformation.ActiveProcessLimit = max_processes;
                job_limits.ProcessMemoryLimit = (max_memory_mb * 1024 * 1024) as usize;
                job_limits.JobMemoryLimit = (max_memory_mb * 1024 * 1024) as usize;
                
                if SetInformationJobObject(
                    job_handle,
                    winapi::um::winnt::JobObjectExtendedLimitInformation,
                    &job_limits as *const _ as *const std::ffi::c_void,
                    std::mem::size_of_val(&job_limits) as u32,
                ) == 0 {
                    tracing::warn!("Failed to set job object limits");
                }
                
                // Get current process handle and assign to job
                let current_process = GetCurrentProcess();
                if AssignProcessToJobObject(job_handle, current_process) == 0 {
                    tracing::warn!("Failed to assign process to job object");
                }
                
                // Execute operation
                let result = operation();
                
                // Clean up
                CloseHandle(job_handle);
                
                result
            }
        }).await?
    }

    #[cfg(not(any(unix, windows)))]
    async fn execute_basic_sandbox<F, R>(&self, process_id: Uuid, operation: F) -> Result<R, Box<dyn std::error::Error>>
    where
        F: FnOnce() -> Result<R, Box<dyn std::error::Error>> + Send + 'static,
        R: Send + 'static,
    {
        use tokio::task;
        
        // Basic monitoring for unsupported platforms
        let processes = self.active_processes.clone();
        let max_memory_mb = self.config.max_memory_mb;
        let max_cpu_time_ms = self.config.max_cpu_time_ms;
        
        // Start a monitoring task
        let monitor_handle = tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(100)).await;
                
                let mut procs = processes.lock().await;
                if let Some(process) = procs.get_mut(&process_id) {
                    // Basic resource monitoring using system information
                    let sys = sysinfo::System::new_all();
                    process.memory_usage = sys.used_memory();
                    process.cpu_time = process.start_time.elapsed();
                    
                    // Check limits
                    if process.memory_usage > max_memory_mb * 1024 * 1024 {
                        process.status = ProcessStatus::MemoryLimitExceeded;
                        break;
                    }
                    
                    if process.cpu_time > Duration::from_millis(max_cpu_time_ms) {
                        process.status = ProcessStatus::CpuLimitExceeded;
                        break;
                    }
                }
            }
        });
        
        // Execute operation in separate task
        let result = task::spawn_blocking(operation).await?;
        
        // Stop monitoring
        monitor_handle.abort();
        
        result
    }

    pub async fn get_process_status(&self, process_id: Uuid) -> Option<ProcessStatus> {
        let processes = self.active_processes.lock().await;
        processes.get(&process_id).map(|p| p.status.clone())
    }

    pub async fn list_active_processes(&self) -> Vec<SandboxedProcess> {
        let processes = self.active_processes.lock().await;
        processes.values().cloned().collect()
    }

    pub async fn cleanup_completed_processes(&self) {
        let mut processes = self.active_processes.lock().await;
        processes.retain(|_, process| {
            matches!(process.status, ProcessStatus::Running)
        });
    }

    pub fn validate_operation_security(&self, operation_description: &str) -> Result<(), Box<dyn std::error::Error>> {
        if !self.validator.validate_input(operation_description)? {
            return Err("Operation failed security validation".into());
        }
        Ok(())
    }
}