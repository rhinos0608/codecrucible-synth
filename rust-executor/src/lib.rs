use napi::{threadsafe_function::ThreadsafeFunction, JsFunction, Result};
use napi_derive::napi;
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};
use uuid::Uuid;

// Module declarations - keeping full complexity
pub mod executors;
pub mod protocol;
pub mod runtime;
pub mod security;
pub mod streaming;
pub mod tools;
pub mod utils;

use crate::protocol::communication::CommunicationHandler;
use crate::protocol::messages::{
    ExecutionContext, ExecutionRequest, ResourceLimitConfig, SecurityLevel as ProtocolSecurityLevel,
};
use crate::streaming::{StreamingEngine, StreamChunk, StreamOptions};

/// Main Rust Executor class exposed to Node.js via NAPI
#[napi]
pub struct RustExecutor {
    id: String,
    communication_handler: Arc<CommunicationHandler>,
    streaming_engine: Arc<StreamingEngine>,
    initialized: bool,
    performance_metrics: Arc<RwLock<PerformanceMetrics>>,
}

// Explicitly implement Send and Sync since all fields are thread-safe
unsafe impl Send for RustExecutor {}
unsafe impl Sync for RustExecutor {}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct PerformanceMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_execution_time_ms: f64,
    pub total_execution_time_ms: u64,
}

/// Security level enumeration for JavaScript interop
#[napi]
pub enum SecurityLevel {
    Low,
    Medium,
    High,
}

impl From<SecurityLevel> for ProtocolSecurityLevel {
    fn from(level: SecurityLevel) -> Self {
        match level {
            SecurityLevel::Low => ProtocolSecurityLevel::Low,
            SecurityLevel::Medium => ProtocolSecurityLevel::Medium,
            SecurityLevel::High => ProtocolSecurityLevel::High,
        }
    }
}

/// Execution options for JavaScript interop
#[napi(object)]
pub struct ExecutionOptions {
    pub session_id: Option<String>,
    pub working_directory: Option<String>,
    pub timeout_ms: Option<u32>,
    pub security_level: Option<SecurityLevel>,
    pub capabilities: Option<Vec<String>>,
    pub environment: Option<HashMap<String, String>>,
    pub stream_response: Option<bool>,
}

/// Execution result for JavaScript interop
#[napi(object)]
pub struct ExecutionResult {
    pub success: bool,
    pub result: Option<String>, // JSON string
    pub error: Option<String>,
    pub execution_time_ms: u32,
    pub performance_metrics: Option<String>, // JSON string
}

#[napi]
impl RustExecutor {
    /// Create a new RustExecutor instance
    #[napi(constructor)]
    pub fn new() -> Self {
        // Initialize tracing for logging
        if tracing::subscriber::set_global_default(
            tracing_subscriber::FmtSubscriber::builder()
                .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
                .finish(),
        )
        .is_err()
        {
            // Subscriber already set, ignore error
        }

        let id = Uuid::new_v4().to_string();
        let communication_handler = Arc::new(CommunicationHandler::new());
        let streaming_engine =
            Arc::new(StreamingEngine::new().expect("Failed to create streaming engine"));

        info!("RustExecutor created with ID: {}", id);

        Self {
            id,
            communication_handler,
            streaming_engine,
            initialized: false,
            performance_metrics: Arc::new(RwLock::new(PerformanceMetrics::default())),
        }
    }

    /// Get the executor ID
    #[napi]
    pub fn id(&self) -> String {
        self.id.clone()
    }

    /// Initialize the executor with default settings
    #[napi]
    pub async unsafe fn initialize(&mut self) -> bool {
        if self.initialized {
            return true;
        }

        // NAPI-RS automatically provides Tokio runtime, no manual setup needed
        match self.communication_handler.initialize().await {
            Ok(_) => {
                // Initialize metrics aggregation
                self.initialize_metrics_aggregation().await;
                
                self.initialized = true;
                info!("RustExecutor initialized successfully: {}", self.id);
                true
            }
            Err(e) => {
                error!("Communication handler initialization failed: {:?}", e);
                false
            }
        }
    }

    /// Execute a command with the given arguments and options  
    #[napi]
    pub fn execute(
        &self,
        tool_id: String,
        arguments: String,
        options: Option<ExecutionOptions>,
    ) -> ExecutionResult {
        let start_time = std::time::Instant::now();

        if !self.initialized {
            return ExecutionResult {
                success: false,
                result: None,
                error: Some("Executor not initialized".to_string()),
                execution_time_ms: 0,
                performance_metrics: None,
            };
        }

        // Parse arguments from JSON
        let parsed_arguments: HashMap<String, serde_json::Value> =
            match serde_json::from_str(&arguments) {
                Ok(args) => args,
                Err(e) => {
                    return ExecutionResult {
                        success: false,
                        result: None,
                        error: Some(format!("Invalid arguments JSON: {}", e)),
                        execution_time_ms: start_time.elapsed().as_millis() as u32,
                        performance_metrics: None,
                    };
                }
            };

        // Build execution context from options
        let execution_context = self.build_execution_context(options.as_ref());

        // Create execution request
        let request = ExecutionRequest {
            tool_id,
            operation: "execute".to_string(),
            arguments: parsed_arguments,
            context: execution_context,
            timeout_ms: options
                .as_ref()
                .and_then(|o| o.timeout_ms.map(|t| t as u64)),
            stream_response: options
                .as_ref()
                .and_then(|o| o.stream_response)
                .unwrap_or(false),
        };

        // Execute request through communication handler - NAPI-RS handles async automatically
        let response = tokio::runtime::Handle::current().block_on(async {
            let response = self.communication_handler.execute_request(request).await;
            self._update_performance_metrics(response.success, response.execution_time_ms)
                .await;
            response
        });

        // Serialize response fields
        let result_str = match response.result {
            Some(val) => match serde_json::to_string(&val) {
                Ok(s) => Some(s),
                Err(e) => {
                    error!("Failed to serialize result: {}", e);
                    None
                }
            },
            None => None,
        };

        let perf_str = match response.performance_metrics {
            Some(metrics) => match serde_json::to_string(&metrics) {
                Ok(s) => Some(s),
                Err(e) => {
                    error!("Failed to serialize performance metrics: {}", e);
                    None
                }
            },
            None => None,
        };

        let error_str = response
            .error
            .map(|e| serde_json::to_string(&e).unwrap_or_else(|_| e.message));

        ExecutionResult {
            success: response.success,
            result: result_str,
            error: error_str,
            execution_time_ms: response.execution_time_ms as u32,
            performance_metrics: perf_str,
        }
    }

    /// Execute a file system operation
    #[napi]
    pub fn execute_filesystem(
        &self,
        operation: String,
        path: String,
        content: Option<String>,
        options: Option<ExecutionOptions>,
    ) -> ExecutionResult {
        let mut arguments = HashMap::new();
        arguments.insert(
            "operation".to_string(),
            serde_json::Value::String(operation),
        );
        arguments.insert("path".to_string(), serde_json::Value::String(path));

        if let Some(content) = content {
            arguments.insert("content".to_string(), serde_json::Value::String(content));
        }

        let arguments_json = serde_json::to_string(&arguments).unwrap_or_default();

        self.execute("filesystem".to_string(), arguments_json, options)
    }

    /// Execute a command
    #[napi]
    pub fn execute_command(
        &self,
        command: String,
        args: Vec<String>,
        options: Option<ExecutionOptions>,
    ) -> ExecutionResult {
        let mut arguments = HashMap::new();
        arguments.insert("command".to_string(), serde_json::Value::String(command));
        arguments.insert(
            "args".to_string(),
            serde_json::Value::Array(args.into_iter().map(serde_json::Value::String).collect()),
        );

        let arguments_json = serde_json::to_string(&arguments).unwrap_or_default();

        self.execute("command".to_string(), arguments_json, options)
    }

    /// Fast file read using spawn_blocking with std::fs (optimal performance)
    /// This method uses Tokio's spawn_blocking to offload file I/O to a thread pool,
    /// preventing blocking of the async runtime while maintaining optimal performance.
    #[napi]
    pub async fn read_file_fast(&self, file_path: String) -> Result<String> {
        let start_time = std::time::Instant::now();
        
        // Validate file path before processing
        if file_path.is_empty() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "File path cannot be empty",
            ));
        }

        // Log the operation start
        info!("Starting fast file read for: {}", file_path);

        // Clone path for use in closure (necessary for move semantics)
        let path_for_closure = file_path.clone();

        // Use spawn_blocking to avoid blocking the async runtime
        // This is the optimal approach for file I/O operations
        let result = tokio::task::spawn_blocking(move || {
            // Use std::fs for maximum performance - no async overhead
            let path = std::path::Path::new(&path_for_closure);
            
            // Check if file exists first
            if !path.exists() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("File not found: {}", path_for_closure),
                ));
            }

            // Check if it's a file (not a directory)
            if !path.is_file() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    format!("Path is not a file: {}", path_for_closure),
                ));
            }

            // Get file metadata for logging
            let metadata = std::fs::metadata(&path);
            let file_size = metadata.map(|m| m.len()).unwrap_or(0);
            
            if file_size > 0 {
                info!("Reading file: {} ({} bytes)", path_for_closure, file_size);
            }

            // Perform the actual read operation
            std::fs::read_to_string(&path)
        })
        .await;

        // Handle the join result first
        let io_result = result.map_err(|join_err| {
            error!("Task join error during file read: {:?}", join_err);
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("Background task failed: {}", join_err),
            )
        })?;

        // Handle the I/O result
        match io_result {
            Ok(content) => {
                let elapsed = start_time.elapsed();
                let content_size = content.len();
                
                info!(
                    "✅ Fast file read completed: {} ({} chars, {} bytes) in {:.2}ms",
                    file_path,
                    content_size,
                    content.as_bytes().len(),
                    elapsed.as_secs_f64() * 1000.0
                );
                
                // Update performance metrics if available
                if let Ok(mut metrics) = self.performance_metrics.try_write() {
                    metrics.total_requests += 1;
                    metrics.successful_requests += 1;
                    let elapsed_ms = elapsed.as_millis() as u64;
                    metrics.total_execution_time_ms += elapsed_ms;
                    metrics.average_execution_time_ms = 
                        metrics.total_execution_time_ms as f64 / metrics.total_requests as f64;
                }
                
                Ok(content)
            }
            Err(io_err) => {
                let elapsed = start_time.elapsed();
                
                error!(
                    "❌ Fast file read failed: {} after {:.2}ms - {}",
                    file_path,
                    elapsed.as_secs_f64() * 1000.0,
                    io_err
                );

                // Update failure metrics
                if let Ok(mut metrics) = self.performance_metrics.try_write() {
                    metrics.total_requests += 1;
                    metrics.failed_requests += 1;
                    let elapsed_ms = elapsed.as_millis() as u64;
                    metrics.total_execution_time_ms += elapsed_ms;
                    metrics.average_execution_time_ms = 
                        metrics.total_execution_time_ms as f64 / metrics.total_requests as f64;
                }

                // Map I/O errors to appropriate NAPI errors
                let napi_status = match io_err.kind() {
                    std::io::ErrorKind::NotFound => napi::Status::InvalidArg,
                    std::io::ErrorKind::PermissionDenied => napi::Status::InvalidArg,
                    std::io::ErrorKind::InvalidInput => napi::Status::InvalidArg,
                    std::io::ErrorKind::InvalidData => napi::Status::InvalidArg,
                    _ => napi::Status::GenericFailure,
                };

                Err(napi::Error::new(
                    napi_status,
                    format!("Failed to read file '{}': {}", file_path, io_err),
                ))
            }
        }
    }

    /// Check if Tokio runtime is available
    #[napi]
    pub fn is_runtime_available(&self) -> bool {
        tokio::runtime::Handle::try_current().is_ok()
    }

    /// Ensure Tokio runtime is available for metrics aggregation
    #[napi]
    pub fn ensure_tokio_runtime(&self) -> bool {
        self.is_runtime_available()
    }

    /// Get runtime statistics
    #[napi]
    pub fn get_runtime_stats(&self) -> String {
        if self.is_runtime_available() {
            serde_json::json!({
                "runtime_available": true,
                "metrics_enabled": true,
                "thread_id": format!("{:?}", std::thread::current().id()),
                "tokio_handle": "available"
            }).to_string()
        } else {
            serde_json::json!({
                "runtime_available": false,
                "metrics_enabled": false,
                "error": "Tokio runtime not available"
            }).to_string()
        }
    }

    /// Get performance metrics as JSON string
    #[napi]
    pub async fn get_performance_metrics(&self) -> String {
        let metrics = self.performance_metrics.read().await.clone();
        serde_json::to_string(&metrics).unwrap_or_else(|_| "{}".to_string())
    }

    /// Reset performance metrics
    #[napi]
    pub async fn reset_performance_metrics(&self) {
        let mut metrics = self.performance_metrics.write().await;
        *metrics = PerformanceMetrics::default();
    }

    /// Check if the executor is healthy
    #[napi]
    pub fn health_check(&self) -> String {
        if !self.initialized {
            return serde_json::json!({
                "status": "unhealthy",
                "reason": "not initialized"
            })
            .to_string();
        }

        serde_json::json!({
            "status": "healthy",
            "executor_id": self.id,
            "initialized": self.initialized
        })
        .to_string()
    }

    /// Get supported tools and operations
    #[napi]
    pub fn get_supported_tools(&self) -> Vec<String> {
        vec!["filesystem".to_string(), "command".to_string()]
    }

    /// Get supported file system operations
    #[napi]
    pub fn get_filesystem_operations(&self) -> Vec<String> {
        vec![
            "read".to_string(),
            "write".to_string(),
            "append".to_string(),
            "delete".to_string(),
            "create_dir".to_string(),
            "list".to_string(),
            "exists".to_string(),
            "get_info".to_string(),
        ]
    }

    /// Get supported commands for command executor
    #[napi]
    pub fn get_supported_commands(&self) -> Vec<String> {
        // Return the same whitelist as the command executor
        vec![
            "ls".to_string(),
            "dir".to_string(),
            "cat".to_string(),
            "head".to_string(),
            "tail".to_string(),
            "find".to_string(),
            "grep".to_string(),
            "wc".to_string(),
            "sort".to_string(),
            "uniq".to_string(),
            "git".to_string(),
            "npm".to_string(),
            "node".to_string(),
            "python".to_string(),
            "python3".to_string(),
            "pip".to_string(),
            "pip3".to_string(),
            "rustc".to_string(),
            "cargo".to_string(),
            "echo".to_string(),
            "pwd".to_string(),
            "which".to_string(),
            "whereis".to_string(),
            "uname".to_string(),
            "whoami".to_string(),
        ]
    }

    /// Cleanup resources
    #[napi]
    pub fn cleanup(&self) {
        info!("Cleaning up RustExecutor {}", self.id);

        // Runtime is managed by NAPI-RS, no manual cleanup needed
        info!("RustExecutor cleaned up: {}", self.id);
    }

    // Private helper methods

    /// Build execution context from options
    fn build_execution_context(&self, options: Option<&ExecutionOptions>) -> ExecutionContext {
        let default_session_id = format!("session-{}", Uuid::new_v4());
        let default_working_directory = std::env::current_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("/tmp"))
            .to_string_lossy()
            .to_string();

        ExecutionContext {
            session_id: options
                .and_then(|o| o.session_id.as_ref())
                .unwrap_or(&default_session_id)
                .clone(),
            working_directory: options
                .and_then(|o| o.working_directory.as_ref())
                .unwrap_or(&default_working_directory)
                .clone(),
            environment: options
                .and_then(|o| o.environment.as_ref())
                .cloned()
                .unwrap_or_default(),
            security_level: options
                .and_then(|o| o.security_level.as_ref())
                .map(|s| match s {
                    SecurityLevel::Low => ProtocolSecurityLevel::Low,
                    SecurityLevel::Medium => ProtocolSecurityLevel::Medium,
                    SecurityLevel::High => ProtocolSecurityLevel::High,
                })
                .unwrap_or(ProtocolSecurityLevel::Medium),
            capabilities: options
                .and_then(|o| o.capabilities.as_ref())
                .cloned()
                .unwrap_or_else(|| vec!["file-read".to_string(), "file-write".to_string()]),
            resource_limits: ResourceLimitConfig::default(),
        }
    }

    /// Update performance metrics after each execution
    async fn _update_performance_metrics(&self, success: bool, execution_time_ms: u64) {
        let mut metrics = self.performance_metrics.write().await;
        metrics.total_requests += 1;
        metrics.total_execution_time_ms += execution_time_ms;
        if success {
            metrics.successful_requests += 1;
        } else {
            metrics.failed_requests += 1;
        }
        metrics.average_execution_time_ms =
            metrics.total_execution_time_ms as f64 / metrics.total_requests as f64;
    }

    /// Initialize metrics aggregation with proper Tokio runtime context
    async fn initialize_metrics_aggregation(&self) {
        use crate::streaming::atomic_metrics::{AtomicStreamingMetrics, MetricsAggregator};
        use std::sync::Arc;
        
        // Create atomic metrics for the streaming engine
        let atomic_metrics = Arc::new(AtomicStreamingMetrics::new());
        
        // Create metrics aggregator with 5-second intervals
        let aggregator = Arc::new(MetricsAggregator::new(atomic_metrics, 5000));
        
        // Start background aggregation task within the runtime context
        // This ensures the Tokio runtime is available for the background tasks
        tokio::spawn(async move {
            // The aggregator will now start successfully since we're in a runtime context
            aggregator.start_aggregation_task();
            info!("Metrics aggregation task started successfully");
        });
        
        info!("Metrics system initialized with Tokio runtime context");
    }

    /// Stream file content with true streaming (no memory accumulation)
    #[napi]
    pub fn stream_file(
        &self,
        file_path: String,
        chunk_size: Option<u32>,
        context_type: Option<String>,
        callback: JsFunction,
    ) -> Result<String> {
        // TRUE NAPI ARRAY BATCHING: Single JS Array transfer instead of N individual calls
        let callback: ThreadsafeFunction<Vec<StreamChunk>> =
            callback.create_threadsafe_function(0, |ctx| {
                let chunks: Vec<StreamChunk> = ctx.value;
                let env = ctx.env;

                // Create JS Array with exact size (single allocation)
                let mut js_array = env.create_array_with_length(chunks.len())?;

                // Populate array with all chunks in single operation
                for (index, chunk) in chunks.iter().enumerate() {
                    // Convert Rust StreamChunk to JavaScript object
                    let mut js_chunk = env.create_object()?;
                    js_chunk.set_named_property(
                        "streamId",
                        env.create_string_from_std(chunk.stream_id.clone())?,
                    )?;
                    js_chunk.set_named_property(
                        "sequence",
                        env.create_double(chunk.sequence as f64)?,
                    )?;
                    js_chunk.set_named_property(
                        "contentType",
                        env.create_string_from_std(chunk.content_type.clone())?,
                    )?;
                    js_chunk.set_named_property(
                        "data",
                        env.create_string_from_std(chunk.data.clone())?,
                    )?;
                    js_chunk.set_named_property("size", env.create_double(chunk.size as f64)?)?;

                    // Convert metadata to JS object
                    let mut js_metadata = env.create_object()?;
                    js_metadata.set_named_property(
                        "source",
                        env.create_string_from_std(chunk.metadata.source.clone())?,
                    )?;
                    js_metadata
                        .set_named_property("isLast", env.get_boolean(chunk.metadata.is_last)?)?;
                    if let Some(progress) = chunk.metadata.progress {
                        js_metadata
                            .set_named_property("progress", env.create_double(progress as f64)?)?;
                    }
                    if let Some(total_size) = chunk.metadata.total_size {
                        js_metadata.set_named_property(
                            "totalSize",
                            env.create_double(total_size as f64)?,
                        )?;
                    }
                    if let Some(error) = &chunk.metadata.error {
                        js_metadata.set_named_property(
                            "error",
                            env.create_string_from_std(error.clone())?,
                        )?;
                    }
                    js_chunk.set_named_property("metadata", js_metadata)?;

                    // Set chunk in array
                    js_array.set_element(index as u32, js_chunk)?;
                }

                // Return single JS Array instead of Vec of individual objects
                Ok(vec![js_array])
            })?;

        let streaming_engine = Arc::clone(&self.streaming_engine);
        let options = StreamOptions {
            chunk_size: chunk_size.unwrap_or(16384) as usize,
            compression: true,
            buffer_size: 65536,
            timeout_ms: 30000,
            context_type: context_type.unwrap_or_else(|| "default".to_string()),
            include_metrics: true,
        };

        // NAPI-RS provides Tokio runtime automatically
        let handle = tokio::runtime::Handle::current();

        // Use the runtime handle to spawn async work
        match handle.block_on(streaming_engine.stream_file_content(&file_path, options, callback))
        {
            Ok(stream_id) => Ok(stream_id),
            Err(stream_error) => {
                // Convert StreamError to NAPI error with rich context
                let error_message = match stream_error {
                    crate::streaming::StreamError::IoError {
                        kind,
                        path,
                        os_message,
                        operation,
                        ..
                    } => {
                        format!(
                            "IO error during {} on '{}': {} ({:?})",
                            operation, path, os_message, kind
                        )
                    }
                    crate::streaming::StreamError::PermissionDenied {
                        path,
                        required_permissions,
                        ..
                    } => {
                        format!(
                            "Permission denied for '{}'. Required: [{}]",
                            path,
                            required_permissions.join(", ")
                        )
                    }
                    crate::streaming::StreamError::ResourceExhaustion {
                        resource,
                        current,
                        limit,
                        suggested_action,
                        ..
                    } => {
                        format!(
                            "Resource exhaustion: {} usage {}/{} - {}",
                            resource, current, limit, suggested_action
                        )
                    }
                    crate::streaming::StreamError::Timeout {
                        operation,
                        duration_ms,
                        timeout_limit_ms,
                        partial_progress,
                    } => {
                        let progress_info = partial_progress
                            .map(|p| format!(" (processed {} bytes)", p))
                            .unwrap_or_default();
                        format!(
                            "Timeout during {} after {}ms (limit: {}ms){}",
                            operation, duration_ms, timeout_limit_ms, progress_info
                        )
                    }
                    crate::streaming::StreamError::ParseError {
                        encoding,
                        byte_offset,
                        line_number,
                        column_number,
                        invalid_sequence,
                        suggestion,
                    } => {
                        let location = match (line_number, column_number) {
                            (Some(line), Some(col)) => format!(" at line {}, column {}", line, col),
                            (Some(line), None) => format!(" at line {}", line),
                            _ => String::new(),
                        };
                        let invalid_preview = if invalid_sequence.len() > 8 {
                            format!("{:02X?}...", &invalid_sequence[..8])
                        } else {
                            format!("{:02X?}", invalid_sequence)
                        };
                        let suggestion_text = suggestion
                            .as_ref()
                            .map(|s| format!(" Suggestion: {}", s))
                            .unwrap_or_default();
                        format!(
                            "Parse error: Invalid {} encoding at byte offset {}{} [{}]{}",
                            encoding, byte_offset, location, invalid_preview, suggestion_text
                        )
                    }
                    crate::streaming::StreamError::NetworkError {
                        url,
                        status_code,
                        error_kind,
                        retry_after,
                        dns_resolution_time,
                        connection_time,
                    } => {
                        let status_info = status_code
                            .map(|code| format!(" (HTTP {})", code))
                            .unwrap_or_default();
                        let timing_info = match (dns_resolution_time, connection_time) {
                            (Some(dns), Some(conn)) => {
                                format!(" [DNS: {}ms, Connect: {}ms]", dns, conn)
                            }
                            (Some(dns), None) => format!(" [DNS: {}ms]", dns),
                            (None, Some(conn)) => format!(" [Connect: {}ms]", conn),
                            _ => String::new(),
                        };
                        let retry_info = retry_after
                            .map(|secs| format!(" Retry after: {}s", secs))
                            .unwrap_or_default();
                        format!(
                            "Network error: {:?} for '{}'{}{}{}",
                            error_kind, url, status_info, timing_info, retry_info
                        )
                    }
                    crate::streaming::StreamError::StreamingError {
                        stage,
                        stream_id,
                        sequence,
                        buffer_state,
                        performance_context,
                    } => {
                        let seq_info = sequence
                            .map(|s| format!(" sequence {}", s))
                            .unwrap_or_default();
                        let buffer_info = format!(
                            " [Buffer: {}/{} bytes, {} pending chunks]",
                            buffer_state.current_size,
                            buffer_state.max_size,
                            buffer_state.pending_chunks
                        );
                        let perf_info = format!(
                            " [Processed: {} bytes/{} chunks, {} bps, {}% CPU]",
                            performance_context.bytes_processed,
                            performance_context.chunks_processed,
                            performance_context.current_throughput_bps as u64,
                            performance_context.cpu_usage_percent
                        );
                        format!(
                            "Streaming error: {:?} in stream '{}'{}{}{}",
                            stage, stream_id, seq_info, buffer_info, perf_info
                        )
                    }
                    _ => format!("Streaming error: {}", stream_error),
                };
                Err(napi::Error::new(
                    napi::Status::GenericFailure,
                    error_message,
                ))
            }
        }
    }

    /// Stream command output with real-time processing
    #[napi]
    pub fn stream_command(
        &self,
        command: String,
        args: Vec<String>,
        chunk_size: Option<u32>,
        callback: JsFunction,
    ) -> Result<String> {
        // TRUE NAPI ARRAY BATCHING: Single JS Array transfer for command output
        let callback: ThreadsafeFunction<Vec<StreamChunk>> =
            callback.create_threadsafe_function(0, |ctx| {
                let chunks: Vec<StreamChunk> = ctx.value;
                let env = ctx.env;

                // Create JS Array with exact size (single allocation)
                let mut js_array = env.create_array_with_length(chunks.len())?;

                // Populate array with all chunks in single operation
                for (index, chunk) in chunks.iter().enumerate() {
                    // Convert Rust StreamChunk to JavaScript object
                    let mut js_chunk = env.create_object()?;
                    js_chunk.set_named_property(
                        "streamId",
                        env.create_string_from_std(chunk.stream_id.clone())?,
                    )?;
                    js_chunk.set_named_property(
                        "sequence",
                        env.create_double(chunk.sequence as f64)?,
                    )?;
                    js_chunk.set_named_property(
                        "contentType",
                        env.create_string_from_std(chunk.content_type.clone())?,
                    )?;
                    js_chunk.set_named_property(
                        "data",
                        env.create_string_from_std(chunk.data.clone())?,
                    )?;
                    js_chunk.set_named_property("size", env.create_double(chunk.size as f64)?)?;

                    // Convert metadata to JS object
                    let mut js_metadata = env.create_object()?;
                    js_metadata.set_named_property(
                        "source",
                        env.create_string_from_std(chunk.metadata.source.clone())?,
                    )?;
                    js_metadata
                        .set_named_property("isLast", env.get_boolean(chunk.metadata.is_last)?)?;
                    if let Some(error) = &chunk.metadata.error {
                        js_metadata.set_named_property(
                            "error",
                            env.create_string_from_std(error.clone())?,
                        )?;
                    }
                    js_chunk.set_named_property("metadata", js_metadata)?;

                    // Set chunk in array
                    js_array.set_element(index as u32, js_chunk)?;
                }

                // Return single JS Array instead of Vec of individual objects
                Ok(vec![js_array])
            })?;

        let streaming_engine = Arc::clone(&self.streaming_engine);
        let options = StreamOptions {
            chunk_size: chunk_size.unwrap_or(8192) as usize,
            compression: false, // Don't compress command output
            buffer_size: 32768,
            timeout_ms: 30000,
            context_type: "commandOutput".to_string(),
            include_metrics: true,
        };

        // NAPI-RS provides Tokio runtime automatically
        let handle = tokio::runtime::Handle::current();

        match handle
            .block_on(streaming_engine.stream_command_output(&command, args, options, callback))
        {
            Ok(stream_id) => Ok(stream_id),
            Err(stream_error) => {
                // Convert StreamError to NAPI error with rich context
                let error_message = match stream_error {
                    crate::streaming::StreamError::ProcessError {
                        command,
                        args,
                        exit_code,
                        stderr_preview,
                        ..
                    } => {
                        let exit_info = exit_code
                            .map(|c| format!(" (exit code: {})", c))
                            .unwrap_or_default();
                        format!(
                            "Process error: '{}{}'{} - {}",
                            command,
                            args.join(" "),
                            exit_info,
                            stderr_preview
                        )
                    }
                    crate::streaming::StreamError::ResourceExhaustion {
                        resource,
                        current,
                        limit,
                        suggested_action,
                        ..
                    } => {
                        format!(
                            "Resource exhaustion: {} usage {}/{} - {}",
                            resource, current, limit, suggested_action
                        )
                    }
                    crate::streaming::StreamError::Timeout {
                        operation,
                        duration_ms,
                        timeout_limit_ms,
                        ..
                    } => {
                        format!(
                            "Timeout during {} after {}ms (limit: {}ms)",
                            operation, duration_ms, timeout_limit_ms
                        )
                    }
                    crate::streaming::StreamError::SecurityError {
                        violation_type,
                        blocked_reason,
                        risk_level,
                        ..
                    } => {
                        format!(
                            "Security violation ({:?}, {} risk): {}",
                            violation_type, risk_level, blocked_reason
                        )
                    }
                    crate::streaming::StreamError::ParseError {
                        encoding,
                        byte_offset,
                        line_number,
                        column_number,
                        invalid_sequence,
                        suggestion,
                    } => {
                        let location = match (line_number, column_number) {
                            (Some(line), Some(col)) => format!(" at line {}, column {}", line, col),
                            (Some(line), None) => format!(" at line {}", line),
                            _ => String::new(),
                        };
                        let invalid_preview = if invalid_sequence.len() > 8 {
                            format!("{:02X?}...", &invalid_sequence[..8])
                        } else {
                            format!("{:02X?}", invalid_sequence)
                        };
                        let suggestion_text = suggestion
                            .as_ref()
                            .map(|s| format!(" Suggestion: {}", s))
                            .unwrap_or_default();
                        format!(
                            "Command parse error: Invalid {} encoding at byte offset {}{} [{}]{}",
                            encoding, byte_offset, location, invalid_preview, suggestion_text
                        )
                    }
                    crate::streaming::StreamError::NetworkError {
                        url,
                        status_code,
                        error_kind,
                        retry_after,
                        dns_resolution_time,
                        connection_time,
                    } => {
                        let status_info = status_code
                            .map(|code| format!(" (HTTP {})", code))
                            .unwrap_or_default();
                        let timing_info = match (dns_resolution_time, connection_time) {
                            (Some(dns), Some(conn)) => {
                                format!(" [DNS: {}ms, Connect: {}ms]", dns, conn)
                            }
                            (Some(dns), None) => format!(" [DNS: {}ms]", dns),
                            (None, Some(conn)) => format!(" [Connect: {}ms]", conn),
                            _ => String::new(),
                        };
                        let retry_info = retry_after
                            .map(|secs| format!(" Retry after: {}s", secs))
                            .unwrap_or_default();
                        format!(
                            "Command network error: {:?} for '{}'{}{}{}",
                            error_kind, url, status_info, timing_info, retry_info
                        )
                    }
                    crate::streaming::StreamError::IoError {
                        kind,
                        path,
                        os_message,
                        operation,
                        ..
                    } => {
                        format!(
                            "Command IO error during {} on '{}': {} ({:?})",
                            operation, path, os_message, kind
                        )
                    }
                    crate::streaming::StreamError::PermissionDenied {
                        path,
                        required_permissions,
                        ..
                    } => {
                        format!(
                            "Command permission denied for '{}'. Required: [{}]",
                            path,
                            required_permissions.join(", ")
                        )
                    }
                    crate::streaming::StreamError::StreamingError {
                        stage,
                        stream_id,
                        sequence,
                        buffer_state,
                        performance_context,
                    } => {
                        let seq_info = sequence
                            .map(|s| format!(" sequence {}", s))
                            .unwrap_or_default();
                        let buffer_info = format!(
                            " [Buffer: {}/{} bytes, {} pending chunks]",
                            buffer_state.current_size,
                            buffer_state.max_size,
                            buffer_state.pending_chunks
                        );
                        let perf_info = format!(
                            " [Processed: {} bytes/{} chunks, {} bps, {}% CPU]",
                            performance_context.bytes_processed,
                            performance_context.chunks_processed,
                            performance_context.current_throughput_bps as u64,
                            performance_context.cpu_usage_percent
                        );
                        format!(
                            "Command streaming error: {:?} in stream '{}'{}{}{}",
                            stage, stream_id, seq_info, buffer_info, perf_info
                        )
                    }
                };
                Err(napi::Error::new(
                    napi::Status::GenericFailure,
                    error_message,
                ))
            }
        }
    }
}

/// Create a RustExecutor instance - convenience function for JavaScript
#[napi]
pub fn create_rust_executor() -> RustExecutor {
    RustExecutor::new()
}

/// Get version information
#[napi]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Initialize logging for the Rust executor
#[napi]
pub fn init_logging(level: Option<String>) {
    let log_level = level.unwrap_or_else(|| "info".to_string());

    if tracing::subscriber::set_global_default(
        tracing_subscriber::FmtSubscriber::builder()
            .with_env_filter(tracing_subscriber::EnvFilter::new(format!(
                "rust_executor={}",
                log_level
            )))
            .finish(),
    )
    .is_err()
    {
        // Subscriber already set, ignore error
    }

    info!("Rust executor logging initialized at level: {}", log_level);
}

/// Benchmark function for performance testing
#[napi]
pub async fn benchmark_execution(iterations: u32) -> Result<String> {
    let mut executor = RustExecutor::new();
    if !unsafe { executor.initialize().await } {
        return Err(napi::Error::new(
            napi::Status::GenericFailure,
            "Failed to initialize executor for benchmark",
        ));
    }

    let start_time = std::time::Instant::now();
    let mut successful = 0u32;
    let failed = 0u32;

    for _i in 0..iterations {
        // Simplified benchmark without async operations for now
        // In a real implementation, we'd call the actual executor methods
        std::thread::sleep(std::time::Duration::from_millis(1));
        successful += 1;
    }

    let total_time = start_time.elapsed();
    let avg_time_ms = total_time.as_millis() as f64 / iterations as f64;

    let benchmark_result = serde_json::json!({
        "iterations": iterations,
        "successful": successful,
        "failed": failed,
        "total_time_ms": total_time.as_millis(),
        "average_time_ms": avg_time_ms,
        "operations_per_second": (iterations as f64 / total_time.as_secs_f64()).round()
    });

    Ok(benchmark_result.to_string())
}
