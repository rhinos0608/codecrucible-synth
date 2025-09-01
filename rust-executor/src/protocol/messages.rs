use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionMessage {
    pub id: String,
    #[serde(rename = "type")]
    pub message_type: MessageType,
    pub timestamp: DateTime<Utc>,
    pub session_id: Option<String>,
    pub correlation_id: Option<String>,
    pub payload: MessagePayload,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Request,
    Response,
    Stream,
    Error,
    Heartbeat,
    HealthCheck,
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum MessagePayload {
    ExecutionRequest(ExecutionRequest),
    ExecutionResponse(ExecutionResponse),
    StreamUpdate(StreamUpdate),
    Error(ErrorPayload),
    Heartbeat(HeartbeatPayload),
    HealthCheck(HealthCheckPayload),
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRequest {
    pub tool_id: String,
    pub operation: String,
    pub arguments: HashMap<String, serde_json::Value>,
    pub context: ExecutionContext,
    pub timeout_ms: Option<u64>,
    pub stream_response: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub session_id: String,
    pub working_directory: String,
    pub environment: HashMap<String, String>,
    pub security_level: SecurityLevel,
    pub capabilities: Vec<String>,
    pub resource_limits: ResourceLimitConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimitConfig {
    pub max_memory_mb: u64,
    pub max_cpu_time_ms: u64,
    pub max_execution_time_ms: u64,
    pub max_file_handles: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResponse {
    pub request_id: String,
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<ErrorInfo>,
    pub execution_time_ms: u64,
    pub performance_metrics: Option<PerformanceMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamUpdate {
    pub request_id: String,
    pub sequence: u64,
    pub progress: f32,
    pub message: String,
    pub data: Option<serde_json::Value>,
    pub is_final: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub stack_trace: Option<String>,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub code: String,
    pub message: String,
    pub category: ErrorCategory,
    pub details: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorCategory {
    Security,
    ResourceLimit,
    Timeout,
    InvalidInput,
    SystemError,
    ToolError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatPayload {
    pub process_id: u32,
    pub uptime_ms: u64,
    pub memory_usage_mb: f64,
    pub cpu_usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckPayload {
    pub status: HealthStatus,
    pub checks: HashMap<String, CheckResult>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub status: HealthStatus,
    pub message: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub cpu_time_ms: u64,
    pub memory_peak_mb: u64,
    pub memory_avg_mb: u64,
    pub io_read_bytes: u64,
    pub io_write_bytes: u64,
    pub context_switches: u64,
}

impl ExecutionMessage {
    pub fn new(message_type: MessageType, payload: MessagePayload) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            message_type,
            timestamp: Utc::now(),
            session_id: None,
            correlation_id: None,
            payload,
            metadata: HashMap::new(),
        }
    }
    
    pub fn request(tool_id: String, operation: String, arguments: HashMap<String, serde_json::Value>, context: ExecutionContext) -> Self {
        Self::new(
            MessageType::Request,
            MessagePayload::ExecutionRequest(ExecutionRequest {
                tool_id,
                operation,
                arguments,
                context,
                timeout_ms: None,
                stream_response: false,
            })
        )
    }
    
    pub fn response(request_id: String, result: Result<serde_json::Value, ErrorInfo>, execution_time_ms: u64) -> Self {
        let payload = match result {
            Ok(data) => MessagePayload::ExecutionResponse(ExecutionResponse {
                request_id,
                success: true,
                result: Some(data),
                error: None,
                execution_time_ms,
                performance_metrics: None,
            }),
            Err(error) => MessagePayload::ExecutionResponse(ExecutionResponse {
                request_id,
                success: false,
                result: None,
                error: Some(error),
                execution_time_ms,
                performance_metrics: None,
            }),
        };
        
        Self::new(MessageType::Response, payload)
    }
    
    pub fn stream_update(request_id: String, sequence: u64, progress: f32, message: String, is_final: bool) -> Self {
        Self::new(
            MessageType::Stream,
            MessagePayload::StreamUpdate(StreamUpdate {
                request_id,
                sequence,
                progress,
                message,
                data: None,
                is_final,
            })
        )
    }
    
    pub fn error(code: String, message: String, request_id: Option<String>) -> Self {
        Self::new(
            MessageType::Error,
            MessagePayload::Error(ErrorPayload {
                code,
                message,
                details: None,
                stack_trace: None,
                request_id,
            })
        )
    }
    
    pub fn heartbeat(process_id: u32, uptime_ms: u64, memory_usage_mb: f64, cpu_usage_percent: f64) -> Self {
        Self::new(
            MessageType::Heartbeat,
            MessagePayload::Heartbeat(HeartbeatPayload {
                process_id,
                uptime_ms,
                memory_usage_mb,
                cpu_usage_percent,
            })
        )
    }
    
    pub fn health_check(status: HealthStatus, checks: HashMap<String, CheckResult>) -> Self {
        Self::new(
            MessageType::HealthCheck,
            MessagePayload::HealthCheck(HealthCheckPayload {
                status,
                checks,
                timestamp: Utc::now(),
            })
        )
    }
    
    pub fn with_session_id(mut self, session_id: String) -> Self {
        self.session_id = Some(session_id);
        self
    }
    
    pub fn with_correlation_id(mut self, correlation_id: String) -> Self {
        self.correlation_id = Some(correlation_id);
        self
    }
    
    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }
    
    /// Serialize message to NDJSON format
    pub fn to_ndjson(&self) -> Result<String, serde_json::Error> {
        let mut json = serde_json::to_string(self)?;
        json.push('\n');
        Ok(json)
    }
    
    /// Deserialize message from NDJSON format
    pub fn from_ndjson(line: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(line.trim())
    }
}

impl Default for SecurityLevel {
    fn default() -> Self {
        SecurityLevel::Medium
    }
}

impl Default for ResourceLimitConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 512,
            max_cpu_time_ms: 30000,
            max_execution_time_ms: 60000,
            max_file_handles: 100,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_message_serialization() {
        let mut context = ExecutionContext {
            session_id: "test-session".to_string(),
            working_directory: "/tmp".to_string(),
            environment: HashMap::new(),
            security_level: SecurityLevel::Medium,
            capabilities: vec!["file-read".to_string()],
            resource_limits: ResourceLimitConfig::default(),
        };
        
        let mut args = HashMap::new();
        args.insert("file_path".to_string(), serde_json::Value::String("/tmp/test.txt".to_string()));
        
        let message = ExecutionMessage::request(
            "file-reader".to_string(),
            "read".to_string(),
            args,
            context
        );
        
        let ndjson = message.to_ndjson().unwrap();
        assert!(ndjson.ends_with('\n'));
        
        let parsed = ExecutionMessage::from_ndjson(&ndjson).unwrap();
        assert_eq!(message.id, parsed.id);
        assert_eq!(message.message_type, parsed.message_type);
    }
    
    #[test]
    fn test_response_creation() {
        let result = Ok(serde_json::Value::String("success".to_string()));
        let response = ExecutionMessage::response("test-id".to_string(), result, 150);
        
        match &response.payload {
            MessagePayload::ExecutionResponse(exec_response) => {
                assert!(exec_response.success);
                assert_eq!(exec_response.execution_time_ms, 150);
            }
            _ => panic!("Expected ExecutionResponse payload"),
        }
    }
    
    #[test]
    fn test_error_message() {
        let error_msg = ExecutionMessage::error(
            "SECURITY_VIOLATION".to_string(),
            "Path access denied".to_string(),
            Some("test-request".to_string())
        );
        
        match &error_msg.payload {
            MessagePayload::Error(error) => {
                assert_eq!(error.code, "SECURITY_VIOLATION");
                assert_eq!(error.request_id, Some("test-request".to_string()));
            }
            _ => panic!("Expected Error payload"),
        }
    }
}