use serde::{Deserialize, Serialize};
use std::fmt;

/// Rich error types for streaming operations with detailed context
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum StreamError {
    /// File system I/O errors with OS-level details
    IoError {
        kind: IoErrorKind,
        path: String,
        os_code: Option<i32>,
        os_message: String,
        operation: String, // "read", "write", "open", "seek"
    },
    
    /// Permission denied with specific requirements
    PermissionDenied {
        path: String,
        required_permissions: Vec<String>,
        current_user: Option<String>,
        file_owner: Option<String>,
        file_mode: Option<String>,
    },
    
    /// Timeout errors with operation context
    Timeout {
        operation: String,
        duration_ms: u64,
        timeout_limit_ms: u64,
        partial_progress: Option<u64>, // bytes processed before timeout
    },
    
    /// Encoding/parsing errors with precise location
    ParseError {
        encoding: String,
        byte_offset: u64,
        line_number: Option<u32>,
        column_number: Option<u32>,
        invalid_sequence: Vec<u8>,
        suggestion: Option<String>,
    },
    
    /// Resource exhaustion with current usage
    ResourceExhaustion {
        resource: String, // "memory", "file_handles", "network_connections"
        current: u64,
        limit: u64,
        process_id: Option<u32>,
        suggested_action: String,
    },
    
    /// Network-related errors for remote streaming
    NetworkError {
        url: String,
        status_code: Option<u16>,
        error_kind: NetworkErrorKind,
        retry_after: Option<u64>, // seconds
        dns_resolution_time: Option<u64>, // ms
        connection_time: Option<u64>, // ms
    },
    
    /// Process execution errors with detailed context
    ProcessError {
        command: String,
        args: Vec<String>,
        exit_code: Option<i32>,
        signal: Option<String>,
        stdout_preview: String, // First 512 chars
        stderr_preview: String, // First 512 chars
        working_directory: String,
    },
    
    /// Security validation errors
    SecurityError {
        violation_type: SecurityViolationType,
        path: Option<String>,
        command: Option<String>,
        risk_level: String, // "low", "medium", "high", "critical"
        blocked_reason: String,
        policy_reference: Option<String>,
    },
    
    /// Internal streaming errors
    StreamingError {
        stage: StreamingStage,
        stream_id: String,
        sequence: Option<u64>,
        buffer_state: BufferState,
        performance_context: PerformanceContext,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IoErrorKind {
    NotFound,
    PermissionDenied, 
    ConnectionRefused,
    ConnectionAborted,
    NotConnected,
    AddrInUse,
    AddrNotAvailable,
    BrokenPipe,
    AlreadyExists,
    InvalidInput,
    InvalidData,
    TimedOut,
    WriteZero,
    Interrupted,
    UnexpectedEof,
    OutOfMemory,
    Other(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NetworkErrorKind {
    DnsResolutionFailed,
    ConnectionTimeout,
    SslHandshakeFailed,
    HttpProtocolError,
    ResponseTooLarge,
    InvalidUrl,
    ProxyError,
    RateLimited,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityViolationType {
    PathTraversalAttempt,
    UnauthorizedFileAccess,
    CommandInjection,
    ResourceLimitExceeded,
    SuspiciousPattern,
    BlacklistedCommand,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StreamingStage {
    Initialization,
    ChunkReading,
    ChunkProcessing,
    ChunkTransmission,
    BufferManagement,
    Finalization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferState {
    pub current_size: usize,
    pub max_size: usize,
    pub pending_chunks: usize,
    pub flush_threshold: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceContext {
    pub start_time: u64,
    pub bytes_processed: u64,
    pub chunks_processed: u64,
    pub current_throughput_bps: f64,
    pub memory_usage_bytes: u64,
    pub cpu_usage_percent: f32,
}

impl fmt::Display for StreamError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StreamError::IoError { kind, path, operation, os_message, .. } => {
                write!(f, "IO error during {} on '{}': {} ({:?})", operation, path, os_message, kind)
            }
            
            StreamError::PermissionDenied { path, required_permissions, .. } => {
                write!(f, "Permission denied for '{}'. Required: [{}]", path, required_permissions.join(", "))
            }
            
            StreamError::Timeout { operation, duration_ms, timeout_limit_ms, partial_progress } => {
                let progress_info = partial_progress
                    .map(|p| format!(" (processed {} bytes)", p))
                    .unwrap_or_default();
                write!(f, "Timeout during {} after {}ms (limit: {}ms){}", operation, duration_ms, timeout_limit_ms, progress_info)
            }
            
            StreamError::ParseError { encoding, byte_offset, invalid_sequence, .. } => {
                write!(f, "Parse error in {} at byte offset {}: invalid sequence {:?}", encoding, byte_offset, invalid_sequence)
            }
            
            StreamError::ResourceExhaustion { resource, current, limit, suggested_action, .. } => {
                write!(f, "Resource exhaustion: {} usage {}/{} - {}", resource, current, limit, suggested_action)
            }
            
            StreamError::NetworkError { url, status_code, error_kind, .. } => {
                let status = status_code.map(|s| format!(" (HTTP {})", s)).unwrap_or_default();
                write!(f, "Network error for '{}'{}: {:?}", url, status, error_kind)
            }
            
            StreamError::ProcessError { command, exit_code, stderr_preview, .. } => {
                let exit_info = exit_code.map(|c| format!(" (exit code: {})", c)).unwrap_or_default();
                write!(f, "Process error: '{}'{} - {}", command, exit_info, stderr_preview)
            }
            
            StreamError::SecurityError { violation_type, blocked_reason, risk_level, .. } => {
                write!(f, "Security violation ({:?}, {} risk): {}", violation_type, risk_level, blocked_reason)
            }
            
            StreamError::StreamingError { stage, stream_id, sequence, .. } => {
                let seq_info = sequence.map(|s| format!(" at sequence {}", s)).unwrap_or_default();
                write!(f, "Streaming error in {:?} stage for stream {}{}", stage, stream_id, seq_info)
            }
        }
    }
}

impl std::error::Error for StreamError {}

impl From<std::io::Error> for StreamError {
    fn from(error: std::io::Error) -> Self {
        let kind = match error.kind() {
            std::io::ErrorKind::NotFound => IoErrorKind::NotFound,
            std::io::ErrorKind::PermissionDenied => IoErrorKind::PermissionDenied,
            std::io::ErrorKind::ConnectionRefused => IoErrorKind::ConnectionRefused,
            std::io::ErrorKind::ConnectionAborted => IoErrorKind::ConnectionAborted,
            std::io::ErrorKind::NotConnected => IoErrorKind::NotConnected,
            std::io::ErrorKind::AddrInUse => IoErrorKind::AddrInUse,
            std::io::ErrorKind::AddrNotAvailable => IoErrorKind::AddrNotAvailable,
            std::io::ErrorKind::BrokenPipe => IoErrorKind::BrokenPipe,
            std::io::ErrorKind::AlreadyExists => IoErrorKind::AlreadyExists,
            std::io::ErrorKind::InvalidInput => IoErrorKind::InvalidInput,
            std::io::ErrorKind::InvalidData => IoErrorKind::InvalidData,
            std::io::ErrorKind::TimedOut => IoErrorKind::TimedOut,
            std::io::ErrorKind::WriteZero => IoErrorKind::WriteZero,
            std::io::ErrorKind::Interrupted => IoErrorKind::Interrupted,
            std::io::ErrorKind::UnexpectedEof => IoErrorKind::UnexpectedEof,
            _ => IoErrorKind::Other(format!("{:?}", error.kind())),
        };

        StreamError::IoError {
            kind,
            path: "<unknown>".to_string(),
            os_code: error.raw_os_error(),
            os_message: error.to_string(),
            operation: "unknown".to_string(),
        }
    }
}

/// Helper trait for enriching errors with context
pub trait StreamErrorContext {
    fn with_path<P: AsRef<str>>(self, path: P) -> StreamError;
    fn with_operation<O: AsRef<str>>(self, operation: O) -> StreamError;
    fn with_performance_context(self, context: PerformanceContext) -> StreamError;
}

impl StreamErrorContext for std::io::Error {
    fn with_path<P: AsRef<str>>(self, path: P) -> StreamError {
        let mut error = StreamError::from(self);
        if let StreamError::IoError { path: ref mut p, .. } = error {
            *p = path.as_ref().to_string();
        }
        error
    }
    
    fn with_operation<O: AsRef<str>>(self, operation: O) -> StreamError {
        let mut error = StreamError::from(self);
        if let StreamError::IoError { operation: ref mut op, .. } = error {
            *op = operation.as_ref().to_string();
        }
        error
    }
    
    fn with_performance_context(self, context: PerformanceContext) -> StreamError {
        StreamError::StreamingError {
            stage: StreamingStage::ChunkReading,
            stream_id: "unknown".to_string(),
            sequence: None,
            buffer_state: BufferState {
                current_size: 0,
                max_size: 0,
                pending_chunks: 0,
                flush_threshold: 0,
            },
            performance_context: context,
        }
    }
}

/// Result type for streaming operations
pub type StreamResult<T> = Result<T, StreamError>;

/// Create timeout error with detailed context
pub fn timeout_error(operation: &str, duration_ms: u64, limit_ms: u64, partial_progress: Option<u64>) -> StreamError {
    StreamError::Timeout {
        operation: operation.to_string(),
        duration_ms,
        timeout_limit_ms: limit_ms,
        partial_progress,
    }
}

/// Create security error with detailed context
pub fn security_error(violation: SecurityViolationType, reason: &str, risk_level: &str) -> StreamError {
    StreamError::SecurityError {
        violation_type: violation,
        path: None,
        command: None,
        risk_level: risk_level.to_string(),
        blocked_reason: reason.to_string(),
        policy_reference: None,
    }
}

/// Create resource exhaustion error
pub fn resource_exhaustion_error(resource: &str, current: u64, limit: u64, action: &str) -> StreamError {
    StreamError::ResourceExhaustion {
        resource: resource.to_string(),
        current,
        limit,
        process_id: std::process::id().into(),
        suggested_action: action.to_string(),
    }
}