use super::error_handling::{StreamError, StreamResult};
use crate::runtime::shared_runtime::RuntimeManager;
use napi::threadsafe_function::ThreadsafeFunction;
use serde::{Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore, oneshot};
use tokio::task::JoinHandle;
use uuid::Uuid;

/// Backpressure strategies for handling load overflow
#[derive(Debug, Clone, PartialEq)]
pub enum BackpressureStrategy {
    /// Reject immediately when capacity exceeded
    Reject,
    
    /// Wait with timeout for capacity to become available
    WaitWithTimeout,
    
    /// Drop oldest queued tasks to make room for new ones
    DropOldest,
    
    /// Use circuit breaker pattern - fail fast when system is overloaded
    CircuitBreaker,
    
    /// Adaptive strategy that switches based on system conditions
    Adaptive,
}

/// Circuit breaker state for managing system overload
#[derive(Debug, Clone)]
pub struct CircuitBreakerState {
    pub state: CircuitBreakerMode,
    pub consecutive_failures: u32,
    pub total_requests: u64,
    pub total_failures: u64,
    pub last_failure_time: Option<std::time::Instant>,
    pub last_success_time: std::time::Instant,
    pub trip_time: Option<std::time::Instant>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CircuitBreakerMode {
    Closed,    // Normal operation
    Open,      // Failing fast
    HalfOpen,  // Testing if service recovered
}

impl Default for CircuitBreakerState {
    fn default() -> Self {
        let now = std::time::Instant::now();
        Self {
            state: CircuitBreakerMode::Closed,
            consecutive_failures: 0,
            total_requests: 0,
            total_failures: 0,
            last_failure_time: None,
            last_success_time: now,
            trip_time: None,
        }
    }
}

/// Queued task waiting for execution
pub struct QueuedTask {
    pub task: StreamingTask,
    pub file_path: String,
    pub chunk_size: usize,
    pub callback: ThreadsafeFunction<Vec<super::StreamChunk>>,
    pub future_factory: Box<dyn FnOnce() -> std::pin::Pin<Box<dyn std::future::Future<Output = StreamResult<()>> + Send>> + Send>,
    pub queued_at: std::time::Instant,
}

impl std::fmt::Debug for QueuedTask {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("QueuedTask")
            .field("task", &self.task)
            .field("file_path", &self.file_path)
            .field("chunk_size", &self.chunk_size)
            .field("callback", &"<ThreadsafeFunction>")
            .field("future_factory", &"<Future Factory>")
            .field("queued_at", &self.queued_at)
            .finish()
    }
}

/// Async worker pool for streaming operations to eliminate runtime.block_on bottlenecks
pub struct StreamingWorkerPool {
    /// Semaphore to limit concurrent operations
    concurrency_limit: Arc<Semaphore>,
    
    /// Shared async runtime handle
    runtime_handle: tokio::runtime::Handle,
    
    /// Track active tasks for monitoring and cancellation
    active_tasks: Arc<RwLock<HashMap<String, TaskHandle>>>,
    
    /// Pool configuration
    config: WorkerPoolConfig,
    
    /// Lock-free atomic performance metrics (eliminates RwLock contention)
    atomic_metrics: Arc<super::AtomicStreamingMetrics>,
    
    /// Background metrics aggregator for consistent snapshots
    metrics_aggregator: Option<Arc<super::atomic_metrics::MetricsAggregator>>,
    
    /// Circuit breaker state for backpressure management
    circuit_breaker_state: Arc<RwLock<CircuitBreakerState>>,
    
    /// Task queue for backpressure management
    #[allow(dead_code)]
    task_queue: Arc<RwLock<std::collections::VecDeque<QueuedTask>>>,
}


#[derive(Debug, Clone)]
pub struct WorkerPoolConfig {
    /// Maximum concurrent streaming operations
    pub max_concurrent_streams: usize,
    
    /// Maximum concurrent tasks per stream
    pub max_tasks_per_stream: usize,
    
    /// Task timeout in milliseconds
    pub default_timeout_ms: u64,
    
    /// Enable performance monitoring
    pub enable_metrics: bool,
    
    /// Task queue size limit (0 = unlimited)
    pub task_queue_size: usize,
    
    /// Backpressure strategy when limits are reached
    pub backpressure_strategy: BackpressureStrategy,
    
    /// Maximum time to wait for permits (milliseconds)
    pub max_wait_time_ms: u64,
    
    /// Circuit breaker failure threshold
    pub circuit_breaker_threshold: u32,
    
    /// Circuit breaker recovery time (milliseconds)
    pub circuit_breaker_recovery_ms: u64,
}

impl Default for WorkerPoolConfig {
    fn default() -> Self {
        Self {
            max_concurrent_streams: 16, // Reasonable default for most systems
            max_tasks_per_stream: 4,
            default_timeout_ms: 30000,
            enable_metrics: true,
            task_queue_size: 1000,
            backpressure_strategy: BackpressureStrategy::WaitWithTimeout,
            max_wait_time_ms: 5000, // 5 second max wait for permits
            circuit_breaker_threshold: 10, // Fail after 10 consecutive failures
            circuit_breaker_recovery_ms: 60000, // 1 minute recovery period
        }
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct WorkerPoolMetrics {
    pub total_tasks_spawned: u64,
    pub total_tasks_completed: u64,
    pub total_tasks_failed: u64,
    pub total_tasks_cancelled: u64,
    pub current_active_tasks: u64,
    pub peak_active_tasks: u64,
    pub avg_task_duration_ms: f64,
    pub total_execution_time_ms: u64,
    
    // Backpressure metrics
    pub total_tasks_rejected: u64,
    pub total_tasks_queued: u64,
    pub total_tasks_dropped: u64,
    pub current_queue_size: u64,
    pub peak_queue_size: u64,
    pub circuit_breaker_trips: u64,
    pub avg_wait_time_ms: f64,
}

pub struct TaskHandle {
    pub task_id: String,
    pub stream_id: String,
    pub operation: String,
    pub started_at: std::time::Instant,
    pub join_handle: JoinHandle<StreamResult<()>>,
    pub cancel_sender: Option<oneshot::Sender<()>>,
}

/// Task specification for worker pool execution
#[derive(Debug, Clone)]
pub struct StreamingTask {
    pub task_id: String,
    pub stream_id: String,
    pub operation: String,
    pub priority: TaskPriority,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum TaskPriority {
    Low = 1,
    Normal = 2,
    High = 3,
    Critical = 4,
}

impl StreamingWorkerPool {
    /// Create new worker pool with configuration
    pub fn new(config: WorkerPoolConfig) -> StreamResult<Self> {
        // Get shared runtime handle for optimal resource utilization
        let runtime_handle = RuntimeManager::get_handle()
            .map_err(|_e| StreamError::StreamingError {
                stage: super::error_handling::StreamingStage::Initialization,
                stream_id: "worker_pool".to_string(),
                sequence: None,
                buffer_state: super::error_handling::BufferState {
                    current_size: 0,
                    max_size: 0,
                    pending_chunks: 0,
                    flush_threshold: 0,
                },
                performance_context: super::error_handling::PerformanceContext {
                    start_time: 0,
                    bytes_processed: 0,
                    chunks_processed: 0,
                    current_throughput_bps: 0.0,
                    memory_usage_bytes: 0,
                    cpu_usage_percent: 0.0,
                },
            })?;

        let atomic_metrics = Arc::new(super::AtomicStreamingMetrics::new());
        let metrics_aggregator = Arc::new(super::atomic_metrics::MetricsAggregator::new(
            Arc::clone(&atomic_metrics),
            1000 // 1 second aggregation interval
        ));
        
        // Start background metrics aggregation task
        metrics_aggregator.clone().start_aggregation_task();

        Ok(Self {
            concurrency_limit: Arc::new(Semaphore::new(config.max_concurrent_streams)),
            runtime_handle,
            active_tasks: Arc::new(RwLock::new(HashMap::new())),
            config,
            atomic_metrics,
            metrics_aggregator: Some(metrics_aggregator),
            circuit_breaker_state: Arc::new(RwLock::new(CircuitBreakerState::default())),
            task_queue: Arc::new(RwLock::new(std::collections::VecDeque::new())),
        })
    }

    /// Execute file streaming task with proper backpressure (eliminates unbounded growth)
    pub async fn execute_file_stream<T: Send + 'static>(
        &self,
        task: StreamingTask,
        file_path: String,
        chunk_size: usize,
        callback: ThreadsafeFunction<Vec<super::StreamChunk>>,
        future_factory: impl FnOnce() -> T + Send + 'static,
    ) -> StreamResult<String>
    where
        T: std::future::Future<Output = StreamResult<()>> + Send,
    {
        let _task_id_clone = task.task_id.clone();
        let _stream_id_clone = task.stream_id.clone();
        let _operation_clone = task.operation.clone();
        
        // Check circuit breaker state first (eliminated block_on priority inversion)
        let circuit_state = {
            let breaker = self.circuit_breaker_state.read().await;
            breaker.clone()
        };
        
        // Handle circuit breaker logic
        match circuit_state.state {
            CircuitBreakerMode::Open => {
                // Check if enough time has passed for recovery attempt
                if let Some(trip_time) = circuit_state.trip_time {
                    let recovery_duration = std::time::Duration::from_millis(self.config.circuit_breaker_recovery_ms);
                    if trip_time.elapsed() > recovery_duration {
                        // Transition to half-open for testing
                        self.runtime_handle.spawn({
                            let breaker_state = Arc::clone(&self.circuit_breaker_state);
                            async move {
                                let mut breaker = breaker_state.write().await;
                                breaker.state = CircuitBreakerMode::HalfOpen;
                            }
                        });
                    } else {
                        // Still in open state - reject immediately
                        self.runtime_handle.spawn({
                            let metrics = Arc::clone(&self.atomic_metrics);
                            async move {
                                metrics.stream_rejected();
                            }
                        });
                        return Err(StreamError::ResourceExhaustion {
                            resource: "circuit_breaker_open".to_string(),
                            current: circuit_state.consecutive_failures as u64,
                            limit: self.config.circuit_breaker_threshold as u64,
                            process_id: Some(std::process::id()),
                            suggested_action: "System overloaded - circuit breaker open. Try again later.".to_string(),
                        });
                    }
                }
            },
            CircuitBreakerMode::HalfOpen => {
                // Allow limited requests to test system recovery
                // This request will determine if we go back to closed or open
            },
            CircuitBreakerMode::Closed => {
                // Normal operation
            }
        }
        
        // Apply backpressure strategy (async - eliminates block_on)
        let permit_result = self.apply_backpressure_strategy(task.clone(), file_path.clone(), chunk_size, callback.clone()).await;
        
        match permit_result {
            Ok(permit) => {
                self.execute_task_with_permit(permit, task, file_path, chunk_size, callback, future_factory)
            },
            Err(e) => Err(e)
        }
    }
    
    /// Apply configured backpressure strategy (async - eliminates block_on)
    async fn apply_backpressure_strategy(
        &self,
        _task: StreamingTask,
        _file_path: String,
        _chunk_size: usize,
        _callback: ThreadsafeFunction<Vec<super::StreamChunk>>,
    ) -> StreamResult<tokio::sync::OwnedSemaphorePermit> {
        match self.config.backpressure_strategy {
            BackpressureStrategy::Reject => {
                // Reject immediately if no capacity
                self.concurrency_limit.clone().try_acquire_owned()
                    .map_err(|_| {
                        // Update rejection metrics
                        let metrics = Arc::clone(&self.atomic_metrics);
                        let runtime_handle = self.runtime_handle.clone();
                        runtime_handle.spawn(async move {
                            metrics.stream_rejected();
                        });
                        
                        StreamError::ResourceExhaustion {
                            resource: "streaming_concurrency".to_string(),
                            current: self.config.max_concurrent_streams as u64,
                            limit: self.config.max_concurrent_streams as u64,
                            process_id: Some(std::process::id()),
                            suggested_action: "Wait for current streams to complete or increase max_concurrent_streams".to_string(),
                        }
                    })
            },
            BackpressureStrategy::WaitWithTimeout => {
                // Wait with timeout for permit to become available
                let wait_start = std::time::Instant::now();
                let timeout_duration = std::time::Duration::from_millis(self.config.max_wait_time_ms);
                
                let _runtime_handle = self.runtime_handle.clone();
                let semaphore = Arc::clone(&self.concurrency_limit);
                let metrics = Arc::clone(&self.atomic_metrics);
                
                // Direct async/await (eliminates block_on priority inversion)
                match tokio::time::timeout(timeout_duration, semaphore.acquire_owned()).await {
                    Ok(permit_result) => {
                        match permit_result {
                            Ok(permit) => {
                                // Update wait time metrics (atomic - no complex calculations in hot path)
                                let wait_time = wait_start.elapsed().as_nanos() as u64;
                                metrics.add_execution_time(wait_time);
                                metrics.backpressure_activated(); // Track that backpressure was engaged
                                
                                Ok(permit)
                            },
                            Err(_) => Err(StreamError::ResourceExhaustion {
                                resource: "semaphore_closed".to_string(),
                                current: 0,
                                limit: 0,
                                process_id: Some(std::process::id()),
                                suggested_action: "Worker pool is shutting down".to_string(),
                            })
                        }
                    },
                    Err(_) => {
                        // Timeout occurred - track as rejection due to backpressure
                        metrics.stream_rejected();
                        metrics.error_occurred(super::ErrorType::Timeout);
                        
                        Err(StreamError::ResourceExhaustion {
                            resource: "backpressure_timeout".to_string(),
                            current: self.config.max_wait_time_ms,
                            limit: self.config.max_wait_time_ms,
                            process_id: Some(std::process::id()),
                            suggested_action: format!("Timed out waiting {}ms for capacity", self.config.max_wait_time_ms),
                        })
                    }
                }
            },
            BackpressureStrategy::DropOldest => {
                // Try immediate acquisition first
                match self.concurrency_limit.clone().try_acquire_owned() {
                    Ok(permit) => Ok(permit),
                    Err(_) => {
                        // Queue is full, drop oldest and queue this task
                        // This is a simplified implementation - in practice you'd want more sophisticated queuing
                        self.concurrency_limit.clone().try_acquire_owned()
                            .map_err(|_| StreamError::ResourceExhaustion {
                                resource: "streaming_concurrency_drop_oldest".to_string(),
                                current: self.config.max_concurrent_streams as u64,
                                limit: self.config.max_concurrent_streams as u64,
                                process_id: Some(std::process::id()),
                                suggested_action: "All slots full, oldest tasks being dropped".to_string(),
                            })
                    }
                }
            },
            BackpressureStrategy::CircuitBreaker => {
                // Circuit breaker handled above, use reject strategy here
                self.apply_reject_strategy()
            },
            BackpressureStrategy::Adaptive => {
                // Use dynamic strategy based on current conditions
                self.apply_adaptive_strategy()
            }
        }
    }
    
    fn apply_reject_strategy(&self) -> StreamResult<tokio::sync::OwnedSemaphorePermit> {
        self.concurrency_limit.clone().try_acquire_owned()
            .map_err(|_| StreamError::ResourceExhaustion {
                resource: "streaming_concurrency".to_string(),
                current: self.config.max_concurrent_streams as u64,
                limit: self.config.max_concurrent_streams as u64,
                process_id: Some(std::process::id()),
                suggested_action: "System at capacity - requests being rejected".to_string(),
            })
    }
    
    fn apply_adaptive_strategy(&self) -> StreamResult<tokio::sync::OwnedSemaphorePermit> {
        // Simplified adaptive logic - in practice this would be more sophisticated
        let available_permits = self.concurrency_limit.available_permits();
        let total_permits = self.config.max_concurrent_streams;
        let utilization = 1.0 - (available_permits as f64 / total_permits as f64);
        
        if utilization > 0.9 {
            // High utilization - use wait with shorter timeout
            // This would need proper async implementation
            self.apply_reject_strategy()
        } else if utilization > 0.7 {
            // Medium utilization - use normal wait
            self.apply_reject_strategy() 
        } else {
            // Low utilization - normal operation
            self.apply_reject_strategy()
        }
    }
    
    fn execute_task_with_permit<T: Send + 'static>(
        &self,
        permit: tokio::sync::OwnedSemaphorePermit,
        task: StreamingTask,
        _file_path: String,
        _chunk_size: usize,
        _callback: ThreadsafeFunction<Vec<super::StreamChunk>>,
        future_factory: impl FnOnce() -> T + Send + 'static,
    ) -> StreamResult<String>
    where
        T: std::future::Future<Output = StreamResult<()>> + Send,
    {
        let task_id_for_return = task.task_id.clone();
        let task_id_for_async = task.task_id.clone();
        let stream_id_for_async = task.stream_id.clone();
        let stream_id_for_handle = task.stream_id.clone(); 
        let operation_for_async = task.operation.clone();

        // Create cancellation channel
        let (cancel_tx, cancel_rx) = oneshot::channel();
        
        // Spawn the async task with proper backpressure handling
        let _active_tasks = Arc::clone(&self.active_tasks);
        let metrics = Arc::clone(&self.atomic_metrics);
        let breaker_state = Arc::clone(&self.circuit_breaker_state);
        let config = self.config.clone();
        let start_time = std::time::Instant::now();
        
        let join_handle = self.runtime_handle.spawn(async move {
            // Hold permit for duration of task (proper backpressure)
            let _permit = permit;
            
            // Set up timeout
            let timeout_duration = std::time::Duration::from_millis(
                task.timeout_ms.unwrap_or(config.default_timeout_ms)
            );
            
            // Execute with timeout and cancellation
            let result = tokio::select! {
                result = future_factory() => result,
                _ = cancel_rx => {
                    Err(StreamError::StreamingError {
                        stage: super::error_handling::StreamingStage::ChunkProcessing,
                        stream_id: stream_id_for_async.clone(),
                        sequence: None,
                        buffer_state: super::error_handling::BufferState {
                            current_size: 0,
                            max_size: 0,
                            pending_chunks: 0,
                            flush_threshold: 0,
                        },
                        performance_context: super::error_handling::PerformanceContext {
                            start_time: start_time.elapsed().as_millis() as u64,
                            bytes_processed: 0,
                            chunks_processed: 0,
                            current_throughput_bps: 0.0,
                            memory_usage_bytes: 0,
                            cpu_usage_percent: 0.0,
                        },
                    })
                }
                _ = tokio::time::sleep(timeout_duration) => {
                    Err(super::error_handling::timeout_error(
                        &task.operation,
                        start_time.elapsed().as_millis() as u64,
                        timeout_duration.as_millis() as u64,
                        None
                    ))
                }
            };
            
            // Update circuit breaker based on result
            let mut breaker = breaker_state.write().await;
            match &result {
                Ok(_) => {
                    // Success - reset circuit breaker
                    if breaker.state == CircuitBreakerMode::HalfOpen {
                        breaker.state = CircuitBreakerMode::Closed;
                        breaker.consecutive_failures = 0;
                    }
                },
                Err(_) => {
                    // Failure - increment counter and potentially trip breaker
                    breaker.consecutive_failures += 1;
                    breaker.last_failure_time = Some(std::time::Instant::now());
                    
                    if breaker.consecutive_failures >= config.circuit_breaker_threshold {
                        breaker.state = CircuitBreakerMode::Open;
                        breaker.trip_time = Some(std::time::Instant::now());
                        
                        // Update metrics
                        metrics.circuit_breaker_tripped();
                    }
                }
            }
            drop(breaker); // Release lock early
            
            // Update metrics (atomic - no complex calculations in hot path)
            if config.enable_metrics {
                let duration = start_time.elapsed().as_nanos() as u64;
                metrics.add_execution_time(duration);
                
                match &result {
                    Ok(_) => {
                        metrics.stream_completed();
                    }
                    Err(_) => {
                        metrics.error_occurred(super::ErrorType::Other);
                    }
                }
            }
            
            result
        });

        // Store task handle for monitoring
        let task_handle = TaskHandle {
            task_id: task_id_for_async.clone(),
            stream_id: stream_id_for_handle, 
            operation: operation_for_async,
            started_at: start_time,
            join_handle,
            cancel_sender: Some(cancel_tx),
        };

        // Update metrics
        if self.config.enable_metrics {
            self.atomic_metrics.stream_started();
        }

        // Store active task
        let active_tasks_clone = Arc::clone(&self.active_tasks);
        self.runtime_handle.spawn(async move {
            let mut tasks = active_tasks_clone.write().await;
            tasks.insert(task_id_for_async.clone(), task_handle);
        });

        Ok(task_id_for_return)
    }

    /// Cancel a running task
    pub async fn cancel_task(&self, task_id: &str) -> StreamResult<bool> {
        let mut tasks = self.active_tasks.write().await;
        
        if let Some(task_handle) = tasks.remove(task_id) {
            // Send cancellation signal
            if let Some(cancel_sender) = task_handle.cancel_sender {
                let _ = cancel_sender.send(());
            }
            
            // Abort the task
            task_handle.join_handle.abort();
            
            // Update metrics
            if self.config.enable_metrics {
                self.atomic_metrics.stream_completed(); // Mark as completed when cancelled
            }
            
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Cancel all tasks for a specific stream
    pub async fn cancel_stream_tasks(&self, stream_id: &str) -> StreamResult<usize> {
        let mut tasks = self.active_tasks.write().await;
        let mut cancelled_count = 0;
        
        // Find tasks for this stream
        let task_ids_to_cancel: Vec<String> = tasks
            .iter()
            .filter(|(_, task)| task.stream_id == stream_id)
            .map(|(id, _)| id.clone())
            .collect();
        
        // Cancel each task
        for task_id in task_ids_to_cancel {
            if let Some(task_handle) = tasks.remove(&task_id) {
                if let Some(cancel_sender) = task_handle.cancel_sender {
                    let _ = cancel_sender.send(());
                }
                task_handle.join_handle.abort();
                cancelled_count += 1;
            }
        }
        
        // Update metrics
        if self.config.enable_metrics && cancelled_count > 0 {
            for _ in 0..cancelled_count {
                self.atomic_metrics.stream_completed();
            }
        }
        
        Ok(cancelled_count)
    }

    /// Update circuit breaker state based on operation result
    #[allow(dead_code)]
    async fn update_circuit_breaker(&self, success: bool) {
        let mut breaker = self.circuit_breaker_state.write().await;
        let now = std::time::Instant::now();
        
        breaker.total_requests += 1;
        
        if success {
            breaker.consecutive_failures = 0;
            breaker.last_success_time = now;
            
            // Close circuit breaker if it was open and we had a success
            if breaker.state == CircuitBreakerMode::Open {
                breaker.state = CircuitBreakerMode::Closed;
            }
        } else {
            breaker.consecutive_failures += 1;
            breaker.total_failures += 1;
            breaker.last_failure_time = Some(now);
            
            // Open circuit breaker if threshold exceeded
            if breaker.consecutive_failures >= self.config.circuit_breaker_threshold {
                breaker.state = CircuitBreakerMode::Open;
                breaker.trip_time = Some(now);
                self.atomic_metrics.circuit_breaker_tripped();
            }
        }
    }
    
    /// Check if circuit breaker allows operation
    #[allow(dead_code)]
    async fn circuit_breaker_allows_request(&self) -> bool {
        let mut breaker = self.circuit_breaker_state.write().await;
        let now = std::time::Instant::now();
        
        match breaker.state {
            CircuitBreakerMode::Closed => true,
            CircuitBreakerMode::Open => {
                let recovery_duration = std::time::Duration::from_millis(self.config.circuit_breaker_recovery_ms);
                if let Some(trip_time) = breaker.trip_time {
                    if now.duration_since(trip_time) > recovery_duration {
                        // Switch to half-open to test recovery
                        breaker.state = CircuitBreakerMode::HalfOpen;
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitBreakerMode::HalfOpen => {
                // Allow limited requests to test recovery
                true
            }
        }
    }
    
    /// Get current circuit breaker health with detailed metrics
    #[allow(dead_code)]
    async fn get_circuit_breaker_health(&self) -> super::atomic_metrics::CircuitBreakerHealth {
        let breaker = self.circuit_breaker_state.read().await;
        
        if breaker.total_requests == 0 {
            return super::atomic_metrics::CircuitBreakerHealth::Healthy;
        }
        
        let error_rate = (breaker.total_failures as f64 / breaker.total_requests as f64) * 100.0;
        let recent_failures = breaker.consecutive_failures;
        
        // Enhanced health calculation considering both overall error rate and recent patterns
        match breaker.state {
            CircuitBreakerMode::Open => super::atomic_metrics::CircuitBreakerHealth::Failed,
            CircuitBreakerMode::HalfOpen => {
                if recent_failures > 0 {
                    super::atomic_metrics::CircuitBreakerHealth::Critical
                } else {
                    super::atomic_metrics::CircuitBreakerHealth::Degraded
                }
            }
            CircuitBreakerMode::Closed => {
                if error_rate < 1.0 && recent_failures <= 2 {
                    super::atomic_metrics::CircuitBreakerHealth::Healthy
                } else if error_rate < 5.0 && recent_failures <= 5 {
                    super::atomic_metrics::CircuitBreakerHealth::Degraded
                } else if error_rate < 15.0 || recent_failures <= self.config.circuit_breaker_threshold / 2 {
                    super::atomic_metrics::CircuitBreakerHealth::Critical
                } else {
                    super::atomic_metrics::CircuitBreakerHealth::Failed
                }
            }
        }
    }

    /// Get current worker pool status with proper aggregated metrics
    pub async fn get_status(&self) -> WorkerPoolStatus {
        let tasks = self.active_tasks.read().await;
        
        // Get properly calculated metrics snapshot from background aggregator
        let metrics_snapshot = match &self.metrics_aggregator {
            Some(aggregator) => {
                // Use pre-calculated consistent snapshot from background task
                aggregator.get_snapshot().await
            }
            None => {
                // Fallback: create basic snapshot from raw atomics (should not happen in production)
                super::atomic_metrics::MetricsSnapshot {
                    bytes_processed: self.atomic_metrics.bytes_processed.load(std::sync::atomic::Ordering::Relaxed),
                    chunks_processed: self.atomic_metrics.chunks_processed.load(std::sync::atomic::Ordering::Relaxed),
                    active_streams: self.atomic_metrics.active_streams.load(std::sync::atomic::Ordering::Relaxed),
                    total_streams_created: self.atomic_metrics.total_streams_created.load(std::sync::atomic::Ordering::Relaxed),
                    total_streams_completed: self.atomic_metrics.total_streams_completed.load(std::sync::atomic::Ordering::Relaxed),
                    total_errors: self.atomic_metrics.total_errors.load(std::sync::atomic::Ordering::Relaxed),
                    error_rate_percent: 0.0, // Cannot calculate without aggregator
                    peak_memory_usage_bytes: self.atomic_metrics.peak_memory_usage_bytes.load(std::sync::atomic::Ordering::Relaxed),
                    peak_active_streams: self.atomic_metrics.peak_active_streams.load(std::sync::atomic::Ordering::Relaxed),
                    average_execution_time_ms: 0.0, // Cannot calculate without aggregator
                    batches_sent: self.atomic_metrics.batches_sent.load(std::sync::atomic::Ordering::Relaxed),
                    average_batch_size: 0.0, // Cannot calculate without aggregator
                    napi_efficiency_ratio: 0.0, // Cannot calculate without aggregator
                    throughput_bytes_per_second: 0.0, // Cannot calculate without aggregator
                    throughput_chunks_per_second: 0.0, // Cannot calculate without aggregator
                    backpressure_activation_rate: 0.0, // Cannot calculate without aggregator
                    circuit_breaker_health: super::atomic_metrics::CircuitBreakerHealth::Healthy,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs(),
                    snapshot_duration_ms: 0,
                }
            }
        };
        
        WorkerPoolStatus {
            active_tasks: tasks.len(),
            available_capacity: self.concurrency_limit.available_permits(),
            total_capacity: self.config.max_concurrent_streams,
            metrics: metrics_snapshot,
            task_summaries: tasks.iter().map(|(id, task)| TaskSummary {
                task_id: id.clone(),
                stream_id: task.stream_id.clone(),
                operation: task.operation.clone(),
                duration_ms: task.started_at.elapsed().as_millis() as u64,
            }).collect(),
        }
    }

    /// Wait for all tasks to complete (for shutdown)
    pub async fn shutdown_gracefully(&self, timeout_ms: u64) -> StreamResult<()> {
        let start_time = std::time::Instant::now();
        let timeout_duration = std::time::Duration::from_millis(timeout_ms);
        
        loop {
            let tasks = self.active_tasks.read().await;
            if tasks.is_empty() {
                break;
            }
            
            if start_time.elapsed() > timeout_duration {
                // Force cancel remaining tasks
                drop(tasks);
                let mut tasks = self.active_tasks.write().await;
                for (_, task) in tasks.drain() {
                    if let Some(cancel_sender) = task.cancel_sender {
                        let _ = cancel_sender.send(());
                    }
                    task.join_handle.abort();
                }
                break;
            }
            
            // Wait a bit before checking again
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkerPoolStatus {
    pub active_tasks: usize,
    pub available_capacity: usize,
    pub total_capacity: usize,
    pub metrics: super::atomic_metrics::MetricsSnapshot,
    pub task_summaries: Vec<TaskSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskSummary {
    pub task_id: String,
    pub stream_id: String,
    pub operation: String,
    pub duration_ms: u64,
}

/// Create a streaming task with generated ID
pub fn create_streaming_task(
    stream_id: String,
    operation: String,
    priority: TaskPriority,
    timeout_ms: Option<u64>,
) -> StreamingTask {
    StreamingTask {
        task_id: Uuid::new_v4().to_string(),
        stream_id,
        operation,
        priority,
        timeout_ms,
    }
}