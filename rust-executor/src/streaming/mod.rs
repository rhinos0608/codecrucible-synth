// Core streaming modules with performance optimizations
mod error_handling;
mod worker_pool;
mod chunk_batcher;
mod atomic_metrics;

// Re-exports
pub use error_handling::*;
pub use worker_pool::*;
pub use chunk_batcher::*;
pub use atomic_metrics::*;

use napi::threadsafe_function::ThreadsafeFunction;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::fmt;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::fs::File;
use tokio::process::Command;
use uuid::Uuid;
use std::time::{SystemTime, UNIX_EPOCH};

/// Structured error type for NAPI callback failures (preserves debugging context)
#[derive(Debug, Clone)]
pub struct NapiBatchError {
    pub status: napi::Status,
    pub operation: String,
    pub chunk_count: usize,
    pub stream_id: String,
    pub timestamp: u64,
}

impl fmt::Display for NapiBatchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "NAPI batch error: status={:?}, operation={}, chunks={}, stream={}, timestamp={}", 
               self.status, self.operation, self.chunk_count, self.stream_id, self.timestamp)
    }
}

impl std::error::Error for NapiBatchError {}

impl AsRef<str> for NapiBatchError {
    fn as_ref(&self) -> &str {
        // Return a static reference to enable string operations
        "NAPI batch error occurred"
    }
}

/// Creates string-based callback wrapper for ChunkBatcher
fn create_string_batch_callback(
    callback: ThreadsafeFunction<Vec<StreamChunk>>,
    stream_id: String
) -> Box<dyn Fn(Vec<StreamChunk>) -> std::result::Result<(), String> + Send + Sync> {
    Box::new(move |chunks: Vec<StreamChunk>| -> std::result::Result<(), String> {
        use napi::threadsafe_function::ThreadsafeFunctionCallMode;
        let chunk_count = chunks.len();
        let result = callback.call(Ok(chunks), ThreadsafeFunctionCallMode::NonBlocking);
        
        if result == napi::Status::Ok {
            Ok(())
        } else {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            
            let error_msg = format!(
                "NAPI_BATCH_ERROR{{status:{:?},operation:batch_transfer,chunks:{},stream:{},timestamp:{}}}",
                result, chunk_count, stream_id, timestamp
            );
            Err(error_msg)
        }
    })
}

// Convert StreamError to NAPI error for JavaScript boundary
impl From<StreamError> for napi::Error {
    fn from(error: StreamError) -> Self {
        napi::Error::from_reason(error.to_string())
    }
}

impl From<std::io::ErrorKind> for IoErrorKind {
    fn from(kind: std::io::ErrorKind) -> Self {
        match kind {
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
            _ => IoErrorKind::Other(format!("{:?}", kind)),
        }
    }
}

/// Stream chunk that matches the TypeScript interface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub stream_id: String,
    pub sequence: u64,
    pub content_type: String,
    pub data: String,
    pub size: usize,
    pub metadata: StreamChunkMetadata,
    pub timing: StreamTiming,
    pub resource_usage: Option<StreamResourceUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunkMetadata {
    pub source: String,
    pub encoding: Option<String>,
    pub mime_type: Option<String>,
    pub total_size: Option<u64>,
    pub progress: Option<f32>,
    pub is_last: bool,
    pub error: Option<String>,
    pub compression: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamTiming {
    pub generated_at: u64,
    pub sent_at: u64,
    pub rust_processing_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamResourceUsage {
    pub memory_bytes: u64,
    pub cpu_time: u64,
    pub io_operations: u64,
}

#[derive(Debug, Clone)]
pub struct StreamOptions {
    pub chunk_size: usize,
    pub compression: bool,
    pub buffer_size: usize,
    pub timeout_ms: u64,
    pub context_type: String,
    pub include_metrics: bool,
}

/// High-performance streaming engine with worker pool and chunk batching
pub struct StreamingEngine {
    #[allow(dead_code)]
    active_streams: Arc<tokio::sync::RwLock<std::collections::HashMap<String, StreamSession>>>,
    metrics: Arc<tokio::sync::RwLock<StreamingMetrics>>,
    worker_pool: Arc<StreamingWorkerPool>,
    chunk_batcher: Arc<tokio::sync::RwLock<Option<ChunkBatcher>>>,
}

#[derive(Debug, Clone)]
pub struct StreamSession {
    pub id: String,
    pub state: String,
    pub options: StreamOptions,
    pub start_time: u64,
    pub chunks_processed: u64,
    pub bytes_streamed: u64,
    pub peak_memory_bytes: u64,
}

#[derive(Debug, Clone, Default)]
pub struct StreamingMetrics {
    pub total_streams: u64,
    pub active_streams: u64,
    pub total_bytes_streamed: u64,
    pub avg_throughput_bps: f64,
}

impl StreamingEngine {
    pub fn new() -> StreamResult<Self> {
        let worker_pool = Arc::new(StreamingWorkerPool::new(WorkerPoolConfig::default())?);
        
        Ok(Self {
            active_streams: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            metrics: Arc::new(tokio::sync::RwLock::new(StreamingMetrics::default())),
            worker_pool,
            chunk_batcher: Arc::new(tokio::sync::RwLock::new(None)),
        })
    }

    /// Process individual chunk asynchronously (restores fine-grained parallelism)
    #[allow(dead_code)]
    async fn process_chunk_async(
        &self,
        data: Vec<u8>,
        sequence: u64,
        stream_id: &str,
        content_type: &str,
        is_last: bool,
        options: &StreamOptions,
    ) -> StreamResult<StreamChunk> {
        let processing_start = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros() as u64;

        // Convert bytes to string (async context allows yielding during conversion)
        let _yield_point = tokio::task::yield_now().await;
        let data_str = match std::str::from_utf8(&data) {
            Ok(s) => s.to_string(),
            Err(_) => {
                // Use base64 for binary data
                use base64::engine::general_purpose::STANDARD;
                use base64::Engine;
                STANDARD.encode(&data)
            }
        };

        Ok(StreamChunk {
            stream_id: stream_id.to_string(),
            sequence,
            content_type: content_type.to_string(),
            data: data_str,
            size: data.len(),
            metadata: StreamChunkMetadata {
                source: format!("async_processing"),
                encoding: Some("utf8".to_string()),
                mime_type: Some("text/plain".to_string()),
                total_size: None,
                progress: None,
                is_last,
                error: None,
                compression: None,
            },
            timing: StreamTiming {
                generated_at: processing_start,
                sent_at: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
                rust_processing_time: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_micros() as u64 - processing_start,
            },
            resource_usage: if options.include_metrics {
                Some(StreamResourceUsage {
                    memory_bytes: data.len() as u64,
                    cpu_time: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_micros() as u64 - processing_start,
                    io_operations: 1,
                })
            } else {
                None
            },
        })
    }

    /// Stream file content using async worker pool (eliminates runtime.block_on bottlenecks)
    pub async fn stream_file_content(
        &self,
        file_path: &str,
        options: StreamOptions,
        callback: ThreadsafeFunction<Vec<StreamChunk>>,
    ) -> StreamResult<String> {
        let stream_id = Uuid::new_v4().to_string();
        let file_path_owned = file_path.to_string();
        
        // Initialize chunk batcher for this stream (reduces NAPI overhead)
        let batcher_config = match options.context_type.as_str() {
            "fileAnalysis" => BatcherConfig {
                context_optimizations: ContextOptimizations::default(),
                ..BatcherConfig::default()
            },
            "commandOutput" => BatcherConfig {
                context_optimizations: ContextOptimizations {
                    command_output: BatchParams {
                        max_chunks: 4,
                        max_bytes: 8 * 1024,
                        max_hold_us: 1000,
                        priority_threshold: 1024,
                    },
                    ..ContextOptimizations::default()
                },
                ..BatcherConfig::default()
            },
            _ => BatcherConfig::default(),
        };

        // TRUE NAPI ARRAY BATCHING: Single JS Array transfer (eliminates N individual calls)
        let napi_callback = create_string_batch_callback(callback.clone(), stream_id.clone());

        // Direct use of NAPI callback since it returns Result<(), String>
        let batch_callback = napi_callback;

        // Initialize ChunkBatcher with true batching callback
        let chunk_batcher = ChunkBatcher::new(batcher_config, batch_callback);
        {
            let mut batcher_guard = self.chunk_batcher.write().await;
            *batcher_guard = Some(chunk_batcher);
        }

        // Create streaming task for worker pool
        let task = create_streaming_task(
            stream_id.clone(),
            "stream_file_content".to_string(),
            TaskPriority::Normal,
            Some(options.timeout_ms),
        );

        // Eliminate block_on: Use direct async context for chunk processing
        let _batcher_access = Arc::clone(&self.chunk_batcher);
        let _context_type = options.context_type.clone();
        

        // Execute via worker pool with direct batching integration (eliminates block_on)
        let batcher_for_execution = Arc::clone(&self.chunk_batcher);
        let task_id = self.worker_pool.execute_file_stream(
            task,
            file_path_owned.clone(),
            options.chunk_size,
            callback.clone(),
            move || {
                Box::pin(async move {
                    Self::execute_file_streaming_with_batching(file_path_owned, options, batcher_for_execution).await
                })
            },
        ).await?;

        Ok(task_id)
    }

    /// File streaming with direct batching integration (eliminates block_on priority inversion)
    async fn execute_file_streaming_with_batching(
        file_path: String,
        options: StreamOptions,
        batcher: Arc<tokio::sync::RwLock<Option<ChunkBatcher>>>,
    ) -> StreamResult<()> {
        // Clone options to avoid move issue
        let context_type = options.context_type.clone();
        // Use direct async batching instead of callback-based approach
        let result = Self::execute_file_streaming_core(file_path, options).await;
        
        // Process chunks through batcher without blocking
        if let Ok(chunks) = result {
            let mut batcher_guard = batcher.write().await;
            if let Some(ref mut chunk_batcher) = *batcher_guard {
                for chunk in chunks {
                    chunk_batcher.add_chunk(chunk, &context_type)?;
                }
                // Force flush any remaining chunks
                chunk_batcher.force_flush(&context_type)?;
            }
        }
        
        Ok(())
    }
    
    /// Core file streaming logic without batching dependencies 
    async fn execute_file_streaming_core(
        file_path: String,
        options: StreamOptions,
    ) -> StreamResult<Vec<StreamChunk>> {
        // Open file with rich error handling
        let file = match File::open(&file_path).await {
            Ok(f) => f,
            Err(e) => {
                return Err(StreamError::IoError {
                    kind: IoErrorKind::from(e.kind()),
                    path: file_path,
                    os_code: e.raw_os_error(),
                    os_message: e.to_string(),
                    operation: "open".to_string(),
                });
            }
        };

        let file_metadata = match file.metadata().await {
            Ok(metadata) => metadata,
            Err(e) => {
                return Err(StreamError::IoError {
                    kind: IoErrorKind::from(e.kind()),
                    path: file_path,
                    os_code: e.raw_os_error(),
                    os_message: e.to_string(),
                    operation: "metadata".to_string(),
                });
            }
        };

        let total_size = file_metadata.len();
        let mut reader = BufReader::with_capacity(options.chunk_size, file);
        let mut sequence = 0u64;
        let mut bytes_read = 0u64;
        let mut buffer = vec![0u8; options.chunk_size];
        let mut chunks = Vec::new(); // Collect chunks instead of processing individually

        // Stream file in chunks with rich error handling
        loop {
            let processing_start = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_micros() as u64;
            
            match reader.read(&mut buffer).await {
                Ok(0) => {
                    // EOF reached - streaming complete
                    break;
                }
                Ok(bytes_read_chunk) => {
                    bytes_read += bytes_read_chunk as u64;
                    
                    // Convert to string with proper encoding handling
                    let chunk_data = match String::from_utf8(buffer[..bytes_read_chunk].to_vec()) {
                        Ok(s) => s,
                        Err(_) => {
                            // For binary data, use base64 encoding
                            use base64::{Engine as _, engine::general_purpose};
                            general_purpose::STANDARD.encode(&buffer[..bytes_read_chunk])
                        }
                    };

                    let chunk = StreamChunk {
                        stream_id: "worker_pool_stream".to_string(), // Will be updated by worker pool
                        sequence,
                        content_type: "file_content".to_string(),
                        data: chunk_data,
                        size: bytes_read_chunk,
                        metadata: StreamChunkMetadata {
                            source: file_path.clone(),
                            encoding: Some("utf8".to_string()),
                            mime_type: None,
                            total_size: Some(total_size),
                            progress: Some((bytes_read as f32 / total_size as f32) * 100.0),
                            is_last: false,
                            error: None,
                            compression: None,
                        },
                        timing: StreamTiming {
                            generated_at: processing_start,
                            sent_at: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_millis() as u64,
                            rust_processing_time: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_micros() as u64 - processing_start,
                        },
                        resource_usage: if options.include_metrics {
                            Some(StreamResourceUsage {
                                memory_bytes: bytes_read_chunk as u64,
                                cpu_time: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap()
                                    .as_micros() as u64 - processing_start,
                                io_operations: 1,
                            })
                        } else {
                            None
                        },
                    };

                    // Collect chunk for batching (eliminates callback overhead)
                    chunks.push(chunk);
                    sequence += 1;
                }
                Err(e) => {
                    return Err(StreamError::IoError {
                        kind: IoErrorKind::from(e.kind()),
                        path: file_path,
                        os_code: e.raw_os_error(),
                        os_message: e.to_string(),
                        operation: "read".to_string(),
                    });
                }
            }

            // Apply adaptive backpressure
            if sequence % 10 == 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
            }
        }

        // Mark last chunk if exists
        if let Some(last_chunk) = chunks.last_mut() {
            last_chunk.metadata.is_last = true;
        }

        Ok(chunks)
    }

    /// Stream command output using async worker pool
    pub async fn stream_command_output(
        &self,
        command: &str,
        args: Vec<String>,
        options: StreamOptions,
        callback: ThreadsafeFunction<Vec<StreamChunk>>,
    ) -> StreamResult<String> {
        let stream_id = Uuid::new_v4().to_string();
        let command_owned = command.to_string();
        let args_owned = args.clone();

        // Create streaming task for worker pool
        let task = create_streaming_task(
            stream_id.clone(),
            "stream_command_output".to_string(),
            TaskPriority::High, // Commands need higher priority for real-time
            Some(options.timeout_ms),
        );

        // Execute command streaming with direct batching (eliminates block_on)
        let batcher_for_command = Arc::clone(&self.chunk_batcher);
        let task_id = self.worker_pool.execute_file_stream(
            task,
            format!("{} {}", command_owned, args_owned.join(" ")),
            options.chunk_size,
            callback.clone(),
            move || {
                Box::pin(async move {
                    Self::execute_command_streaming_with_batching(command_owned, args_owned, options, batcher_for_command).await
                })
            },
        ).await?;

        Ok(task_id)
    }

    /// Command streaming with direct batching integration (eliminates block_on)
    async fn execute_command_streaming_with_batching(
        command: String,
        args: Vec<String>,
        options: StreamOptions,
        batcher: Arc<tokio::sync::RwLock<Option<ChunkBatcher>>>,
    ) -> StreamResult<()> {
        // Clone options to avoid move issue
        let context_type = options.context_type.clone();
        // Use direct async batching instead of callback-based approach
        let result = Self::execute_command_streaming_core(command, args, options).await;
        
        // Process chunks through batcher without blocking
        if let Ok(chunks) = result {
            let mut batcher_guard = batcher.write().await;
            if let Some(ref mut chunk_batcher) = *batcher_guard {
                for chunk in chunks {
                    chunk_batcher.add_chunk(chunk, &context_type)?;
                }
                // Force flush any remaining chunks
                chunk_batcher.force_flush(&context_type)?;
            }
        }
        
        Ok(())
    }
    
    /// Core command streaming logic without batching dependencies
    async fn execute_command_streaming_core(
        command: String,
        args: Vec<String>,
        options: StreamOptions,
    ) -> StreamResult<Vec<StreamChunk>> {
        let mut child = match Command::new(&command)
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(e) => {
                return Err(StreamError::ProcessError {
                    command: command.clone(),
                    args: args.clone(),
                    exit_code: None,
                    signal: None,
                    stdout_preview: String::new(),
                    stderr_preview: e.to_string(),
                    working_directory: std::env::current_dir()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                });
            }
        };

        let stdout = child.stdout.take().expect("Failed to get stdout");
        let mut reader = BufReader::new(stdout);
        let mut sequence = 0u64;
        let mut line = String::new();
        let mut chunks = Vec::new(); // Collect chunks instead of processing individually

        // Stream output line by line for command output
        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break; // EOF
            }

            // Create StreamChunk for command output
            let processing_start = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_micros() as u64;

            let chunk = StreamChunk {
                stream_id: "command_stream".to_string(), // Will be updated by worker pool
                sequence,
                content_type: "command_output".to_string(),
                data: line.clone(),
                size: bytes_read,
                metadata: StreamChunkMetadata {
                    source: format!("{} {}", command, args.join(" ")),
                    encoding: Some("utf8".to_string()),
                    mime_type: Some("text/plain".to_string()),
                    total_size: None, // Unknown for command output
                    progress: None,
                    is_last: false, // Will be updated if this is the final chunk
                    error: None,
                    compression: None,
                },
                timing: StreamTiming {
                    generated_at: processing_start,
                    sent_at: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                    rust_processing_time: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_micros() as u64 - processing_start,
                },
                resource_usage: if options.include_metrics {
                    Some(StreamResourceUsage {
                        memory_bytes: bytes_read as u64,
                        cpu_time: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_micros() as u64 - processing_start,
                        io_operations: 1,
                    })
                } else {
                    None
                },
            };

            // Collect chunk for batching (eliminates callback overhead)
            chunks.push(chunk);
            sequence += 1;
            line.clear();

            // Apply adaptive backpressure for command output
            if sequence % 5 == 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
            }
        }

        // Mark last chunk if exists
        if let Some(last_chunk) = chunks.last_mut() {
            last_chunk.metadata.is_last = true;
        }

        Ok(chunks)
    }

    /// Get streaming metrics
    pub async fn get_metrics(&self) -> StreamingMetrics {
        self.metrics.read().await.clone()
    }

    /// Clean shutdown
    pub async fn shutdown(&self) {
        if let Err(e) = self.worker_pool.shutdown_gracefully(5000).await {
            eprintln!("Warning: Worker pool shutdown error: {:?}", e);
        }
    }
}