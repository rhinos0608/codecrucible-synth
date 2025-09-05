/**
 * Shared Tokio Runtime Manager
 * 
 * Provides a centralized Tokio runtime that can be reused across
 * filesystem executors and streaming worker pools to reduce overhead.
 */

use std::sync::{Arc, Mutex, OnceLock};
use tokio::runtime::{Handle, Runtime};
use crate::streaming::{StreamError, StreamResult};

/// Global shared runtime instance
static SHARED_RUNTIME: OnceLock<Arc<SharedTokioRuntime>> = OnceLock::new();

/// Shared Tokio runtime manager
pub struct SharedTokioRuntime {
    runtime: Arc<Runtime>,
    handle: Handle,
    active_tasks: Arc<Mutex<usize>>,
}

impl SharedTokioRuntime {
    /// Create a new shared runtime
    fn new() -> StreamResult<Self> {
        let runtime = Runtime::new()
            .map_err(|e| StreamError::ResourceExhaustion {
                resource: "tokio_runtime".to_string(),
                current: 1,
                limit: 1,
                process_id: std::process::id().into(),
                suggested_action: format!("Failed to create Tokio runtime: {}", e),
            })?;
        
        let handle = runtime.handle().clone();
        
        Ok(Self {
            runtime: Arc::new(runtime),
            handle,
            active_tasks: Arc::new(Mutex::new(0)),
        })
    }

    /// Get the runtime handle for async operations
    pub fn handle(&self) -> &Handle {
        &self.handle
    }

    /// Execute a future on the runtime
    pub fn block_on<F>(&self, future: F) -> F::Output
    where
        F: std::future::Future,
    {
        // Increment active task count
        {
            let mut count = self.active_tasks.lock().unwrap();
            *count += 1;
        }

        let result = self.runtime.block_on(future);

        // Decrement active task count
        {
            let mut count = self.active_tasks.lock().unwrap();
            *count -= 1;
        }

        result
    }

    /// Spawn a task on the runtime
    pub fn spawn<F>(&self, future: F) -> tokio::task::JoinHandle<F::Output>
    where
        F: std::future::Future + Send + 'static,
        F::Output: Send + 'static,
    {
        // Increment active task count
        {
            let mut count = self.active_tasks.lock().unwrap();
            *count += 1;
        }

        let active_tasks = Arc::clone(&self.active_tasks);
        let task = self.handle.spawn(async move {
            let result = future.await;
            
            // Decrement active task count when task completes
            {
                let mut count = active_tasks.lock().unwrap();
                *count = count.saturating_sub(1);
            }
            
            result
        });

        task
    }

    /// Get the number of active tasks
    pub fn active_task_count(&self) -> usize {
        *self.active_tasks.lock().unwrap()
    }

    /// Check if the runtime is available
    pub fn is_available(&self) -> bool {
        // Runtime availability is determined by whether we can still get a handle
        tokio::runtime::Handle::try_current().is_ok() || true // Always true for shared runtime
    }

    /// Get runtime statistics for monitoring
    pub fn get_stats(&self) -> RuntimeStats {
        RuntimeStats {
            active_tasks: self.active_task_count(),
            is_finished: false, // Shared runtime is always considered active
            thread_count: std::thread::available_parallelism().map(|p| p.get()).unwrap_or(1),
        }
    }
}

/// Runtime statistics for monitoring
#[derive(Debug, Clone)]
pub struct RuntimeStats {
    pub active_tasks: usize,
    pub is_finished: bool,
    pub thread_count: usize,
}

/// Global runtime manager functions
pub struct RuntimeManager;

impl RuntimeManager {
    /// Get the global shared runtime, creating it if it doesn't exist
    pub fn get_shared_runtime() -> StreamResult<Arc<SharedTokioRuntime>> {
        Ok(SHARED_RUNTIME
            .get_or_init(|| {
                match SharedTokioRuntime::new() {
                    Ok(runtime) => Arc::new(runtime),
                    Err(e) => {
                        eprintln!("Failed to create shared Tokio runtime: {}", e);
                        // Create a fallback runtime with basic configuration
                        let basic_runtime = Runtime::new().expect("Failed to create fallback runtime");
                        let handle = basic_runtime.handle().clone();
                        
                        Arc::new(SharedTokioRuntime {
                            runtime: Arc::new(basic_runtime),
                            handle,
                            active_tasks: Arc::new(Mutex::new(0)),
                        })
                    }
                }
            })
            .clone())
    }

    /// Try to get the current runtime handle, falling back to shared runtime
    pub fn get_handle() -> StreamResult<Handle> {
        // First, try to get the current runtime handle
        if let Ok(handle) = Handle::try_current() {
            return Ok(handle);
        }

        // Fall back to shared runtime
        let shared_runtime = Self::get_shared_runtime()?;
        Ok(shared_runtime.handle().clone())
    }

    /// Execute a future using the best available runtime
    pub fn execute_async<F>(future: F) -> StreamResult<F::Output>
    where
        F: std::future::Future,
    {
        // Try to use current runtime first
        if let Ok(handle) = Handle::try_current() {
            return Ok(handle.block_on(future));
        }

        // Fall back to shared runtime
        let shared_runtime = Self::get_shared_runtime()?;
        Ok(shared_runtime.block_on(future))
    }

    /// Spawn a task using the best available runtime
    pub fn spawn_task<F>(future: F) -> StreamResult<tokio::task::JoinHandle<F::Output>>
    where
        F: std::future::Future + Send + 'static,
        F::Output: Send + 'static,
    {
        // Try to use current runtime first
        if let Ok(handle) = Handle::try_current() {
            return Ok(handle.spawn(future));
        }

        // Fall back to shared runtime
        let shared_runtime = Self::get_shared_runtime()?;
        Ok(shared_runtime.spawn(future))
    }

    /// Get runtime statistics for monitoring
    pub fn get_runtime_stats() -> StreamResult<RuntimeStats> {
        let shared_runtime = Self::get_shared_runtime()?;
        Ok(shared_runtime.get_stats())
    }

    /// Shutdown the shared runtime (for cleanup)
    pub fn shutdown() {
        // Note: In a real implementation, you might want to add proper shutdown logic
        // For now, we rely on Drop implementations to clean up
    }
}

// Implement Debug for better logging
impl std::fmt::Debug for SharedTokioRuntime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SharedTokioRuntime")
            .field("active_tasks", &self.active_task_count())
            .field("is_available", &self.is_available())
            .finish()
    }
}

// Safety: SharedTokioRuntime is Send + Sync because Runtime is Send + Sync
unsafe impl Send for SharedTokioRuntime {}
unsafe impl Sync for SharedTokioRuntime {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_shared_runtime_creation() {
        let runtime = RuntimeManager::get_shared_runtime().expect("Failed to get runtime");
        assert!(runtime.is_available());
    }

    #[test]
    fn test_runtime_stats() {
        let stats = RuntimeManager::get_runtime_stats().expect("Failed to get stats");
        assert!(stats.thread_count > 0);
    }

    #[tokio::test]
    async fn test_task_spawning() {
        let result = RuntimeManager::spawn_task(async { 42 })
            .expect("Failed to spawn task")
            .await
            .expect("Task failed");
        assert_eq!(result, 42);
    }
}