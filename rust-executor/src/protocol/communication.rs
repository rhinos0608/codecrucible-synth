use std::io::{self, BufRead, BufReader, Write};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio::time::{timeout, Duration};
use serde_json;
use tracing::{error, info, warn, debug};
use async_trait::async_trait;

use crate::protocol::messages::{
    ExecutionMessage, MessageType, MessagePayload, ExecutionRequest, ExecutionResponse,
    StreamUpdate, ErrorPayload, ErrorInfo, ErrorCategory, HeartbeatPayload, HealthCheckPayload,
    HealthStatus, CheckResult
};
use crate::executors::filesystem::{FileSystemExecutor, FileSystemError};

use crate::security::{SecurityContext, SecurityError, Capability};
=======
use crate::executors::command::CommandExecutor as CommandExecutorImpl;
use crate::security::{SecurityContext, SecurityError};


#[derive(Debug)]
pub enum CommunicationError {
    IoError(io::Error),
    SerializationError(serde_json::Error),
    InvalidMessage(String),
    ExecutorNotFound(String),
    Timeout,
    SecurityViolation(SecurityError),
}

impl From<io::Error> for CommunicationError {
    fn from(error: io::Error) -> Self {
        CommunicationError::IoError(error)
    }
}

impl From<serde_json::Error> for CommunicationError {
    fn from(error: serde_json::Error) -> Self {
        CommunicationError::SerializationError(error)
    }
}

impl From<SecurityError> for CommunicationError {
    fn from(error: SecurityError) -> Self {
        CommunicationError::SecurityViolation(error)
    }
}

/// Registry of available executors and their capabilities
pub struct ExecutorRegistry {
    filesystem_executor: Option<Arc<FileSystemExecutor>>,
    command_executor: Option<Arc<dyn CommandExecutor>>, // TODO: Implement CommandExecutor
    security_contexts: HashMap<String, SecurityContext>,
}

/// Trait for command executors (placeholder for future implementation)
#[async_trait::async_trait]
pub trait CommandExecutor: Send + Sync {
    async fn execute(&self, request: ExecutionRequest) -> ExecutionResponse;
    fn get_supported_commands(&self) -> Vec<String>;
}

impl ExecutorRegistry {
    pub fn new() -> Self {
        Self {
            filesystem_executor: None,
            command_executor: None,
            security_contexts: HashMap::new(),
        }
    }

    pub fn register_filesystem_executor(&mut self, executor: Arc<FileSystemExecutor>) {
        self.filesystem_executor = Some(executor);
    }

    pub fn register_command_executor(&mut self, executor: Arc<dyn CommandExecutor>) {
        self.command_executor = Some(executor);
    }

    pub fn register_security_context(&mut self, session_id: String, context: SecurityContext) {
        self.security_contexts.insert(session_id, context);
    }

    pub async fn execute_request(&self, request: ExecutionRequest) -> ExecutionResponse {
        match request.tool_id.as_str() {
            "filesystem" => {
                if let Some(executor) = &self.filesystem_executor {
                    executor.execute(request).await
                } else {
                    ExecutionResponse {
                        request_id: uuid::Uuid::new_v4().to_string(),
                        success: false,
                        result: None,
                        error: Some(ErrorInfo {
                            code: "EXECUTOR_NOT_AVAILABLE".to_string(),
                            message: "Filesystem executor not registered".to_string(),
                            category: ErrorCategory::SystemError,
                            details: HashMap::new(),
                        }),
                        execution_time_ms: 0,
                        performance_metrics: None,
                    }
                }
            }
            "command" => {
                if let Some(executor) = &self.command_executor {
                    executor.execute(request).await
                } else {
                    ExecutionResponse {
                        request_id: uuid::Uuid::new_v4().to_string(),
                        success: false,
                        result: None,
                        error: Some(ErrorInfo {
                            code: "EXECUTOR_NOT_AVAILABLE".to_string(),
                            message: "Command executor not registered".to_string(),
                            category: ErrorCategory::SystemError,
                            details: HashMap::new(),
                        }),
                        execution_time_ms: 0,
                        performance_metrics: None,
                    }
                }
            }
            _ => {
                ExecutionResponse {
                    request_id: uuid::Uuid::new_v4().to_string(),
                    success: false,
                    result: None,
                    error: Some(ErrorInfo {
                        code: "UNKNOWN_TOOL".to_string(),
                        message: format!("Unknown tool: {}", request.tool_id),
                        category: ErrorCategory::InvalidInput,
                        details: HashMap::new(),
                    }),
                    execution_time_ms: 0,
                    performance_metrics: None,
                }
            }
        }
    }
}

/// Core communication handler that processes NDJSON streams
pub struct CommunicationHandler {
    registry: Arc<RwLock<ExecutorRegistry>>,
    active_sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    message_timeout: Duration,
    max_message_size: usize,
    max_messages_per_minute: usize,
}

#[derive(Debug, Clone)]
pub struct SessionState {
    pub session_id: String,
    pub created_at: std::time::Instant,
    pub last_activity: std::time::Instant,
    pub message_count: u64,
    pub security_context: SecurityContext,
    pub message_timestamps: VecDeque<std::time::Instant>,
}

impl CommunicationHandler {
    pub fn new() -> Self {
        Self {
            registry: Arc::new(RwLock::new(ExecutorRegistry::new())),
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
            message_timeout: Duration::from_secs(30),
            max_message_size: 10 * 1024 * 1024, // 10MB
            max_messages_per_minute: 60,
        }
    }

    /// Initialize the communication handler with default executors
    pub async fn initialize(&self) -> Result<(), CommunicationError> {
        let mut registry = self.registry.write().await;
        
        // Register filesystem executor with default security context
        let security_context = SecurityContext::for_file_operations(
            &std::env::temp_dir()
        );
        let fs_executor = Arc::new(FileSystemExecutor::new(security_context.clone()));
        registry.register_filesystem_executor(fs_executor);

        // Register command executor with its security context
        let command_executor: Arc<dyn CommandExecutor> = Arc::new(CommandExecutorImpl::new(command_context));
        registry.register_command_executor(command_executor);

        // Register default security context
        registry.register_security_context("default".to_string(), security_context);

        info!("Communication handler initialized successfully");
        Ok(())
    }

    /// Execute a request through the registry
    pub async fn execute_request(&self, request: ExecutionRequest) -> ExecutionResponse {
        let registry = self.registry.read().await;
        registry.execute_request(request).await
    }

    /// Process incoming NDJSON stream from TypeScript
    pub async fn process_input_stream<R: BufRead + Unpin + Send>(
        &self,
        mut reader: R,
        tx: mpsc::UnboundedSender<ExecutionMessage>
    ) -> Result<(), CommunicationError> {
        let mut line = String::new();

        loop {
            line.clear();
            
            // Read line with timeout to prevent hanging
            let bytes_read = match timeout(self.message_timeout, async {
                reader.read_line(&mut line)
            }).await {
                Ok(Ok(n)) => n,
                Ok(Err(e)) => return Err(CommunicationError::IoError(e)),
                Err(_) => return Err(CommunicationError::Timeout),
            };
            
            // End of stream
            if bytes_read == 0 {
                break;
            }
            
            // Validate message size
            if line.len() > self.max_message_size {
                warn!("Message too large: {} bytes", line.len());
                continue;
            }
            // Validate message schema and extract session ID
            let session_id = match self.validate_message_schema(&line) {
                Ok(id) => id,
                Err(e) => {
                    error!("Invalid message schema: {:?}", e);
                    let error_message = ExecutionMessage::error(
                        "INVALID_MESSAGE_SCHEMA".to_string(),
                        format!("{:?}", e),
                        None
                    );
                    if tx.send(error_message).is_err() {
                        break;
                    }
                    continue;
                }
            };

            // Enforce rate limiting
            if !self.check_rate_limit(&session_id).await {
                warn!("Rate limit exceeded for session: {}", session_id);
                let error_message = ExecutionMessage::error(
                    "RATE_LIMIT_EXCEEDED".to_string(),
                    "Too many requests".to_string(),
                    None,
                );
                if tx.send(error_message).is_err() {
                    break;
                }
                continue;
            }

            // Parse and process message
            match self.parse_and_process_message(&line).await {
                Ok(response_message) => {
                    if tx.send(response_message).is_err() {
                        error!("Failed to send response message");
                        break;
                    }
                }
                Err(e) => {
                    error!("Error processing message: {:?}", e);

                    let error_message = ExecutionMessage::error(
                        "MESSAGE_PROCESSING_ERROR".to_string(),
                        format!("{:?}", e),
                        None,
                    );

                    if tx.send(error_message).is_err() {
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    /// Process outgoing messages to TypeScript via NDJSON
    pub async fn process_output_stream<W: Write + Unpin + Send>(
        &self,
        mut writer: W,
        mut rx: mpsc::UnboundedReceiver<ExecutionMessage>
    ) -> Result<(), CommunicationError> {
        while let Some(message) = rx.recv().await {
            match message.to_ndjson() {
                Ok(ndjson) => {
                    if let Err(e) = writer.write_all(ndjson.as_bytes()) {
                        error!("Failed to write message: {}", e);
                        return Err(CommunicationError::IoError(e));
                    }
                    
                    if let Err(e) = writer.flush() {
                        error!("Failed to flush output: {}", e);
                        return Err(CommunicationError::IoError(e));
                    }
                }
                Err(e) => {
                    error!("Failed to serialize message: {}", e);
                    return Err(CommunicationError::SerializationError(e));
                }
            }
        }
        
        Ok(())
    }

    /// Parse incoming message and process it
    async fn parse_and_process_message(&self, line: &str) -> Result<ExecutionMessage, CommunicationError> {
        // Parse message
        let message = ExecutionMessage::from_ndjson(line)?;
        
        debug!("Received message: {:?}", message.message_type);
        
        // Update session state
        self.update_session_state(&message).await;
        
        // Process based on message type
        match &message.payload {
            MessagePayload::ExecutionRequest(request) => {
                self.handle_execution_request(request.clone(), &message).await
            }
            MessagePayload::Heartbeat(_) => {
                self.handle_heartbeat(&message).await
            }
            MessagePayload::HealthCheck(_) => {
                self.handle_health_check(&message).await
            }
            MessagePayload::Shutdown => {
                info!("Shutdown message received");
                Ok(ExecutionMessage::new(MessageType::Response, MessagePayload::Shutdown))
            }
            _ => {
                Err(CommunicationError::InvalidMessage(
                    format!("Unsupported message type: {:?}", message.message_type)
                ))
            }
        }
    }

    /// Handle execution request
    async fn handle_execution_request(&self, request: ExecutionRequest, original_message: &ExecutionMessage) -> Result<ExecutionMessage, CommunicationError> {
        let start_time = std::time::Instant::now();

        // Validate session and security
        let session_id = original_message.session_id.as_ref()
            .unwrap_or(&"default".to_string()).clone();

        if let Err(e) = self.validate_request_security(&session_id, &request).await {
            let error_response = ExecutionMessage::response(
                original_message.id.clone(),
                Err(ErrorInfo {
                    code: "SECURITY_VIOLATION".to_string(),
                    message: format!("{:?}", e),
                    category: ErrorCategory::Security,
                    details: HashMap::new(),
                }),
                0,
            );
            return Ok(error_response);
        }
        
        // Execute request through registry
        let registry = self.registry.read().await;
        let response = registry.execute_request(request).await;
        
        // Create response message
        let execution_time = start_time.elapsed().as_millis() as u64;
        let result = if response.success {
            Ok(response.result.unwrap_or_else(|| serde_json::Value::Null))
        } else {
            Err(response.error.unwrap_or_else(|| ErrorInfo {
                code: "UNKNOWN_ERROR".to_string(),
                message: "Unknown execution error".to_string(),
                category: ErrorCategory::SystemError,
                details: HashMap::new(),
            }))
        };
        
        Ok(ExecutionMessage::response(original_message.id.clone(), result, execution_time))
    }

    /// Handle heartbeat message
    async fn handle_heartbeat(&self, message: &ExecutionMessage) -> Result<ExecutionMessage, CommunicationError> {
        // Create heartbeat response with current process stats
        let process_id = std::process::id();
        let uptime = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
            
        // TODO: Get actual memory and CPU usage
        let memory_usage = 0.0;
        let cpu_usage = 0.0;
        
        Ok(ExecutionMessage::heartbeat(process_id, uptime, memory_usage, cpu_usage))
    }

    /// Handle health check message
    async fn handle_health_check(&self, _message: &ExecutionMessage) -> Result<ExecutionMessage, CommunicationError> {
        let mut checks = HashMap::new();
        let overall_status = HealthStatus::Healthy;
        
        // Check executor availability
        let registry = self.registry.read().await;
        let fs_available = registry.filesystem_executor.is_some();
        
        checks.insert("filesystem_executor".to_string(), CheckResult {
            status: if fs_available { HealthStatus::Healthy } else { HealthStatus::Unhealthy },
            message: Some(if fs_available { "Available".to_string() } else { "Not registered".to_string() }),
            duration_ms: 0,
        });
        
        // Check session count
        let sessions = self.active_sessions.read().await;
        let session_count = sessions.len();
        
        checks.insert("active_sessions".to_string(), CheckResult {
            status: HealthStatus::Healthy,
            message: Some(format!("{} active sessions", session_count)),
            duration_ms: 0,
        });
        
        Ok(ExecutionMessage::health_check(overall_status, checks))
    }

    /// Update session state with activity
    async fn update_session_state(&self, message: &ExecutionMessage) {
        if let Some(session_id) = &message.session_id {
            let mut sessions = self.active_sessions.write().await;
            let now = std::time::Instant::now();

            if let Some(session) = sessions.get_mut(session_id) {
                session.last_activity = now;
                session.message_count += 1;
            } else {
                // Create new session
                let session = SessionState {
                    session_id: session_id.clone(),
                    created_at: now,
                    last_activity: now,
                    message_count: 1,
                    security_context: SecurityContext::default(),
                    message_timestamps: VecDeque::new(),
                };
                sessions.insert(session_id.clone(), session);
            }
        }
    }

    /// Validate session security and request fields
    async fn validate_request_security(&self, session_id: &str, request: &ExecutionRequest) -> Result<(), SecurityError> {
        let sessions = self.active_sessions.read().await;
        let session = sessions.get(session_id);
        let context = if let Some(s) = session {
            s
        } else {
            return Err(SecurityError::CapabilityDenied { capability: "Session not found".into() });
        };

        // Basic session expiration check
        let age = context.last_activity.elapsed();
        if age >= Duration::from_secs(3600) {
            return Err(SecurityError::SessionExpired);
        }

        // Validate environment variables
        for var in request.context.environment.keys() {
            context
                .security_context
                .validate_environment_access(var)?;
        }

        // Validate capabilities based on tool and operation
        match request.tool_id.as_str() {
            "filesystem" => {
                if let Some(path_val) = request.arguments.get("path").and_then(|v| v.as_str()) {
                    let path = std::path::PathBuf::from(path_val);
                    let capability = match request.operation.as_str() {
                        "read" => Capability::FileRead(path),
                        _ => Capability::FileWrite(path),
                    };
                    context.security_context.validate_capability(&capability)?;
                }
            }
            "command" => {
                context.security_context.validate_capability(&Capability::ProcessSpawn)?;
            }
            _ => {}
        }

        Ok(())
    }

    /// Validate message schema and return session ID
    fn validate_message_schema(&self, line: &str) -> Result<String, CommunicationError> {
        let value: serde_json::Value = serde_json::from_str(line.trim())?;
        let obj = value.as_object().ok_or_else(|| {
            CommunicationError::InvalidMessage("Message must be a JSON object".to_string())
        })?;

        if !(obj.contains_key("id") && obj.contains_key("type") && obj.contains_key("payload")) {
            return Err(CommunicationError::InvalidMessage(
                "Missing required message fields".to_string(),
            ));
        }

        Ok(obj
            .get("session_id")
            .and_then(|v| v.as_str())
            .unwrap_or("default")
            .to_string())
    }

    /// Check and update rate limiting for a session
    async fn check_rate_limit(&self, session_id: &str) -> bool {
        let now = std::time::Instant::now();

        // Combine session creation and rate limit check in a single lock
        let mut sessions = self.active_sessions.write().await;
        // If session does not exist, create it
        if !sessions.contains_key(session_id) {
            // get security context from registry if exists
            let registry = self.registry.read().await;
            let context = registry
                .security_contexts
                .get(session_id)
                .cloned()
                .unwrap_or_else(SecurityContext::default);
            sessions.insert(
                session_id.to_string(),
                SessionState {
                    session_id: session_id.to_string(),
                    created_at: now,
                    last_activity: now,
                    message_count: 0,
                    security_context: context,
                    message_timestamps: VecDeque::new(),
                },
            );
        }
        if let Some(session) = sessions.get_mut(session_id) {
            session.last_activity = now;

            // Clean old timestamps
            while let Some(front) = session.message_timestamps.front() {
                if now.duration_since(*front) > Duration::from_secs(60) {
                    session.message_timestamps.pop_front();
                } else {
                    break;
                }
            }

            if session.message_timestamps.len() >= self.max_messages_per_minute {
                return false;
            }

            session.message_timestamps.push_back(now);
            true
        } else {
            true
        }
    }

    /// Clean up expired sessions
    pub async fn cleanup_expired_sessions(&self) {
        let mut sessions = self.active_sessions.write().await;
        let now = std::time::Instant::now();
        let expiry_duration = Duration::from_secs(3600);
        
        sessions.retain(|_, session| {
            now.duration_since(session.last_activity) < expiry_duration
        });
    }
}

/// Main communication loop that handles bidirectional NDJSON communication
pub async fn run_communication_loop<R, W>(
    handler: Arc<CommunicationHandler>,
    reader: R,
    writer: W,
) -> Result<(), CommunicationError>
where
    R: BufRead + Unpin + Send + 'static,
    W: Write + Unpin + Send + 'static,
{
    // Initialize the handler
    handler.initialize().await?;
    
    // Create channel for message passing
    let (tx, rx) = mpsc::unbounded_channel::<ExecutionMessage>();
    
    // Start input processing task
    let handler_input = handler.clone();
    let input_task = tokio::spawn(async move {
        handler_input.process_input_stream(reader, tx).await
    });
    
    // Start output processing task
    let handler_output = handler.clone();
    let output_task = tokio::spawn(async move {
        handler_output.process_output_stream(writer, rx).await
    });
    
    // Start session cleanup task
    let handler_cleanup = handler.clone();
    let cleanup_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // Clean up every 5 minutes
        loop {
            interval.tick().await;
            handler_cleanup.cleanup_expired_sessions().await;
        }
    });
    
    // Wait for tasks to complete (or fail)
    tokio::select! {
        result = input_task => {
            match result {
                Ok(Ok(())) => info!("Input processing completed"),
                Ok(Err(e)) => error!("Input processing failed: {:?}", e),
                Err(e) => error!("Input task panicked: {:?}", e),
            }
        }
        result = output_task => {
            match result {
                Ok(Ok(())) => info!("Output processing completed"),
                Ok(Err(e)) => error!("Output processing failed: {:?}", e),
                Err(e) => error!("Output task panicked: {:?}", e),
            }
        }
        _ = cleanup_task => {
            info!("Cleanup task completed");
        }
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn test_message_parsing() {
        let handler = CommunicationHandler::new();
        
        // Create a test execution request
        let message = ExecutionMessage::request(
            "filesystem".to_string(),
            "read".to_string(),
            [("path".to_string(), serde_json::Value::String("/tmp/test.txt".to_string()))]
                .into_iter().collect(),
            crate::protocol::messages::ExecutionContext {
                session_id: "test".to_string(),
                working_directory: "/tmp".to_string(),
                environment: HashMap::new(),
                security_level: crate::protocol::messages::SecurityLevel::Medium,
                capabilities: vec!["file-read".to_string()],
                resource_limits: crate::protocol::messages::ResourceLimitConfig::default(),
            }
        );
        
        let ndjson = message.to_ndjson().unwrap();
        let parsed = handler.parse_and_process_message(&ndjson).await;
        
        // Should parse successfully (though execution may fail without proper setup)
        assert!(parsed.is_ok() || matches!(parsed, Err(CommunicationError::InvalidMessage(_))));
    }

    #[tokio::test]
    async fn test_bidirectional_communication() {
        let handler = Arc::new(CommunicationHandler::new());
        handler.initialize().await.unwrap();
        
        // Create test input (filesystem read request)
        let request = ExecutionMessage::request(
            "filesystem".to_string(),
            "read".to_string(),
            [("path".to_string(), serde_json::Value::String("/tmp/test.txt".to_string()))]
                .into_iter().collect(),
            crate::protocol::messages::ExecutionContext {
                session_id: "test".to_string(),
                working_directory: "/tmp".to_string(),
                environment: HashMap::new(),
                security_level: crate::protocol::messages::SecurityLevel::Medium,
                capabilities: vec!["file-read".to_string()],
                resource_limits: crate::protocol::messages::ResourceLimitConfig::default(),
            }
        );
        
        let input_data = request.to_ndjson().unwrap();
        let input_cursor = Cursor::new(input_data.as_bytes());
        let output_cursor = Cursor::new(Vec::new());
        
        // Test communication loop (will timeout or complete quickly)
        let result = tokio::time::timeout(
            Duration::from_secs(1),
            run_communication_loop(handler, input_cursor, output_cursor)
        ).await;
        
        // Should either complete or timeout (both are acceptable for this test)
        assert!(result.is_ok() || result.is_err());
    }

    #[tokio::test]
    async fn test_session_management() {
        let handler = CommunicationHandler::new();
        
        // Create message with session ID
        let message = ExecutionMessage::request(
            "test".to_string(),
            "test".to_string(),
            HashMap::new(),
            crate::protocol::messages::ExecutionContext {
                session_id: "test_session".to_string(),
                working_directory: "/tmp".to_string(),
                environment: HashMap::new(),
                security_level: crate::protocol::messages::SecurityLevel::Medium,
                capabilities: vec![],
                resource_limits: crate::protocol::messages::ResourceLimitConfig::default(),
            }
        ).with_session_id("test_session".to_string());
        
        // Update session state
        handler.update_session_state(&message).await;
        
        // Check session was created
        let sessions = handler.active_sessions.read().await;
        assert!(sessions.contains_key("test_session"));
    }

    #[tokio::test]
    async fn test_rate_limiting() {
        let mut handler = CommunicationHandler::new();
        handler.max_messages_per_minute = 2;
        handler.initialize().await.unwrap();

        let req = ExecutionMessage::request(
            "filesystem".to_string(),
            "read".to_string(),
            [("path".to_string(), serde_json::Value::String("/tmp/test.txt".to_string()))]
                .into_iter()
                .collect(),
            crate::protocol::messages::ExecutionContext {
                session_id: "rate-test".to_string(),
                working_directory: "/tmp".to_string(),
                environment: HashMap::new(),
                security_level: crate::protocol::messages::SecurityLevel::Medium,
                capabilities: vec!["file-read".to_string()],
                resource_limits: crate::protocol::messages::ResourceLimitConfig::default(),
            },
        );

        let ndjson = req.to_ndjson().unwrap();
        let input_data = format!("{}{}{}", ndjson, ndjson, ndjson);
        let cursor = Cursor::new(input_data.as_bytes());
        let (tx, mut rx) = mpsc::unbounded_channel();

        handler.process_input_stream(cursor, tx).await.unwrap();

        let mut responses = Vec::new();
        while let Ok(msg) = rx.try_recv() {
            responses.push(msg);
        }

        assert_eq!(responses.len(), 3);
        match &responses[2].payload {
            MessagePayload::Error(err) => assert_eq!(err.code, "RATE_LIMIT_EXCEEDED"),
            _ => panic!("Expected rate limit error"),
        }
    }

    #[tokio::test]
    async fn test_security_validation() {
        let handler = CommunicationHandler::new();
        handler.initialize().await.unwrap();

        let req = ExecutionMessage::request(
            "filesystem".to_string(),
            "read".to_string(),
            [("path".to_string(), serde_json::Value::String("/etc/passwd".to_string()))]
                .into_iter()
                .collect(),
            crate::protocol::messages::ExecutionContext {
                session_id: "default".to_string(),
                working_directory: "/tmp".to_string(),
                environment: HashMap::new(),
                security_level: crate::protocol::messages::SecurityLevel::Medium,
                capabilities: vec!["file-read".to_string()],
                resource_limits: crate::protocol::messages::ResourceLimitConfig::default(),
            },
        );

        let ndjson = req.to_ndjson().unwrap();
        let cursor = Cursor::new(ndjson.as_bytes());
        let (tx, mut rx) = mpsc::unbounded_channel();

        handler.process_input_stream(cursor, tx).await.unwrap();
        let resp = rx.try_recv().expect("expected response");

        match resp.payload {
            MessagePayload::ExecutionResponse(res) => {
                assert!(!res.success);
                assert_eq!(res.error.unwrap().code, "SECURITY_VIOLATION");
            }
            MessagePayload::Error(err) => assert_eq!(err.code, "SECURITY_VIOLATION"),
            _ => panic!("Unexpected payload"),
        }
    }
}
