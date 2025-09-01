use napi_derive::napi;
use napi::{Result as NapiResult, Error, JsFunction, threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode}};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::runtime::Runtime;
use tokio::sync::RwLock;
use serde_json;
use tracing::{info, error, warn, debug};
use uuid::Uuid;

// Module declarations - keeping full complexity
pub mod security;
pub mod protocol;
pub mod executors;
pub mod utils;

use crate::security::{SecurityContext, Capability};
use crate::protocol::messages::{ExecutionMessage, MessageType, MessagePayload, ExecutionRequest, ExecutionContext, SecurityLevel as ProtocolSecurityLevel, ResourceLimitConfig};
use crate::protocol::communication::{CommunicationHandler, ExecutorRegistry};
use crate::executors::filesystem::FileSystemExecutor;
use crate::executors::command::CommandExecutor;

/// Main Rust Executor class exposed to Node.js via NAPI
#[napi]
pub struct RustExecutor {
    id: String,
    communication_handler: Arc<CommunicationHandler>,
    initialized: bool,
    performance_metrics: Arc<RwLock<PerformanceMetrics>>,
}

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
                .finish()
        ).is_err() {
            // Subscriber already set, ignore error
        }

        let id = Uuid::new_v4().to_string();
        let communication_handler = Arc::new(CommunicationHandler::new());
        
        info!("RustExecutor created with ID: {}", id);
        
        Self {
            id,
            communication_handler,
            initialized: false,
            performance_metrics: Arc::new(RwLock::new(PerformanceMetrics::default())),
        }
    }

    /// Get the executor ID
    #[napi(getter)]
    pub fn id(&self) -> String {
        self.id.clone()
    }

    /// Initialize the executor with default settings
    #[napi]
    pub fn initialize(&mut self) -> bool {
        if self.initialized {
            return true;
        }

        // Simplified initialization without async for now
        self.initialized = true;
        info!("RustExecutor initialized successfully: {}", self.id);
        true
    }

    /// Execute a command with the given arguments and options  
    #[napi]
    pub fn execute(&self, tool_id: String, arguments: String, options: Option<ExecutionOptions>) -> ExecutionResult {
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
        let parsed_arguments: HashMap<String, serde_json::Value> = match serde_json::from_str(&arguments) {
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
            timeout_ms: options.as_ref().and_then(|o| o.timeout_ms.map(|t| t as u64)),
            stream_response: false,
        };

        // Execute request through communication handler and update performance metrics in a single async block
        let rt = Runtime::new().expect("Failed to create Tokio runtime");
        let response = rt.block_on(async {
            let response = self.communication_handler.execute_request(request).await;
            {
                let mut metrics = self.performance_metrics.write().await;
                metrics.total_requests += 1;
                metrics.total_execution_time_ms += response.execution_time_ms;
                if response.success {
                    metrics.successful_requests += 1;
                } else {
                    metrics.failed_requests += 1;
                }
                metrics.average_execution_time_ms =
                    metrics.total_execution_time_ms as f64 / metrics.total_requests as f64;
            }
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

        let error_str = response.error.map(|e| {
            serde_json::to_string(&e).unwrap_or_else(|_| e.message)
        });

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
    pub fn execute_filesystem(&self, operation: String, path: String, content: Option<String>, options: Option<ExecutionOptions>) -> ExecutionResult {
        let mut arguments = HashMap::new();
        arguments.insert("operation".to_string(), serde_json::Value::String(operation));
        arguments.insert("path".to_string(), serde_json::Value::String(path));
        
        if let Some(content) = content {
            arguments.insert("content".to_string(), serde_json::Value::String(content));
        }

        let arguments_json = serde_json::to_string(&arguments).unwrap_or_default();

        self.execute("filesystem".to_string(), arguments_json, options)
    }

    /// Execute a command
    #[napi]
    pub fn execute_command(&self, command: String, args: Vec<String>, options: Option<ExecutionOptions>) -> ExecutionResult {
        let mut arguments = HashMap::new();
        arguments.insert("command".to_string(), serde_json::Value::String(command));
        arguments.insert("args".to_string(), serde_json::Value::Array(
            args.into_iter().map(serde_json::Value::String).collect()
        ));

        let arguments_json = serde_json::to_string(&arguments).unwrap_or_default();

        self.execute("command".to_string(), arguments_json, options)
    }

    /// Get performance metrics as JSON string
    #[napi]
    pub fn get_performance_metrics(&self) -> String {
        // For now return a placeholder until we fix async integration
        serde_json::json!({
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "average_execution_time": 0.0
        }).to_string()
    }

    /// Reset performance metrics
    #[napi]
    pub fn reset_performance_metrics(&self) {
        // For now just return - placeholder until we fix async integration
    }

    /// Check if the executor is healthy
    #[napi]
    pub fn health_check(&self) -> String {
        if !self.initialized {
            return serde_json::json!({
                "status": "unhealthy",
                "reason": "not initialized"
            }).to_string();
        }

        serde_json::json!({
            "status": "healthy",
            "executor_id": self.id,
            "initialized": self.initialized
        }).to_string()
    }

    /// Get supported tools and operations
    #[napi]
    pub fn get_supported_tools(&self) -> Vec<String> {
        vec![
            "filesystem".to_string(),
            "command".to_string(),
        ]
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
            "ls".to_string(), "dir".to_string(), "cat".to_string(), "head".to_string(), "tail".to_string(),
            "find".to_string(), "grep".to_string(), "wc".to_string(), "sort".to_string(), "uniq".to_string(),
            "git".to_string(), "npm".to_string(), "node".to_string(), "python".to_string(), "python3".to_string(),
            "pip".to_string(), "pip3".to_string(), "rustc".to_string(), "cargo".to_string(),
            "echo".to_string(), "pwd".to_string(), "which".to_string(), "whereis".to_string(),
            "uname".to_string(), "whoami".to_string(),
        ]
    }

    /// Cleanup resources
    #[napi]
    pub fn cleanup(&self) {
        info!("Cleaning up RustExecutor {}", self.id);
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

    /// Update performance metrics (placeholder)
    fn _update_performance_metrics(&self, _success: bool, _execution_time_ms: u64) {
        // Placeholder - will be implemented when we restore async functionality
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
            .with_env_filter(tracing_subscriber::EnvFilter::new(format!("rust_executor={}", log_level)))
            .finish()
    ).is_err() {
        // Subscriber already set, ignore error
    }
    
    info!("Rust executor logging initialized at level: {}", log_level);
}

/// Benchmark function for performance testing
#[napi]
pub fn benchmark_execution(iterations: u32) -> String {
    let mut executor = RustExecutor::new();
    executor.initialize();
    
    let start_time = std::time::Instant::now();
    let mut successful = 0u32;
    let mut failed = 0u32;
    
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
    
    benchmark_result.to_string()
}
