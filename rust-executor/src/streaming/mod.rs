use napi::{
    threadsafe_function::{ThreadsafeFunction, ThreadSafeFunctionCallMode},
    JsFunction, JsObject, JsString, JsNumber, JsBoolean,
    Result, Env, CallContext, Status
};
use base64;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::fs::File;
use tokio::process::Command;
use uuid::Uuid;
use std::time::{SystemTime, UNIX_EPOCH};

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

/// High-performance streaming engine for Rust -> TypeScript communication
pub struct StreamingEngine {
    active_streams: Arc<tokio::sync::RwLock<std::collections::HashMap<String, StreamSession>>>,
    metrics: Arc<tokio::sync::RwLock<StreamingMetrics>>,
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
    pub fn new() -> Self {
        Self {
            active_streams: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            metrics: Arc::new(tokio::sync::RwLock::new(StreamingMetrics::default())),
        }
    }

    /// Stream file content with true chunked reading (no memory accumulation)
    pub async fn stream_file_content(
        &self,
        file_path: &str,
        options: StreamOptions,
        callback: ThreadsafeFunction<StreamChunk>,
    ) -> Result<String> {
        let stream_id = Uuid::new_v4().to_string();
        let start_time = self.current_timestamp();
        
        // Create session
        let session = StreamSession {
            id: stream_id.clone(),
            state: "streaming".to_string(),
            options: options.clone(),
            start_time,
            chunks_processed: 0,
            bytes_streamed: 0,
            peak_memory_bytes: 0,
        };
        
        {
            let mut sessions = self.active_streams.write().await;
            sessions.insert(stream_id.clone(), session);
        }

        // Open file for streaming
        let file = match File::open(file_path).await {
            Ok(f) => f,
            Err(e) => {
                self.send_error_chunk(&stream_id, &format!("Failed to open file: {}", e), callback).await;
                return Err(Status::GenericFailure.into());
            }
        };

        let file_metadata = match file.metadata().await {
            Ok(metadata) => metadata,
            Err(e) => {
                self.send_error_chunk(&stream_id, &format!("Failed to read metadata: {}", e), callback).await;
                return Err(Status::GenericFailure.into());
            }
        };

        let total_size = file_metadata.len();
        let mut reader = BufReader::with_capacity(options.chunk_size, file);
        let mut sequence = 0u64;
        let mut bytes_read = 0u64;
        let mut buffer = vec![0u8; options.chunk_size];

        // Stream file in chunks
        loop {
            let processing_start = self.current_timestamp_micros();
            
            match reader.read(&mut buffer).await {
                Ok(0) => {
                    // EOF - send final chunk
                    let chunk = self.create_final_chunk(
                        &stream_id,
                        sequence,
                        file_path,
                        bytes_read,
                        total_size,
                        processing_start,
                    );
                    
                    self.send_chunk_to_js(chunk, &callback).await;
                    break;
                }
                Ok(bytes_read_chunk) => {
                    bytes_read += bytes_read_chunk as u64;
                    
                    // Convert to string (assuming UTF-8, handle errors gracefully)
                    let chunk_data = match String::from_utf8(buffer[..bytes_read_chunk].to_vec()) {
                        Ok(s) => s,
                        Err(_) => {
                            // For binary data, use base64
                            base64::encode(&buffer[..bytes_read_chunk])
                        }
                    };

                    let chunk = StreamChunk {
                        stream_id: stream_id.clone(),
                        sequence,
                        content_type: "file_content".to_string(),
                        data: chunk_data,
                        size: bytes_read_chunk,
                        metadata: StreamChunkMetadata {
                            source: file_path.to_string(),
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
                            sent_at: self.current_timestamp(),
                            rust_processing_time: self.current_timestamp_micros() - processing_start,
                        },
                        resource_usage: if options.include_metrics {
                            Some(StreamResourceUsage {
                                memory_bytes: bytes_read_chunk as u64,
                                cpu_time: self.current_timestamp_micros() - processing_start,
                                io_operations: 1,
                            })
                        } else {
                            None
                        },
                    };

                    self.send_chunk_to_js(chunk, &callback).await;
                    sequence += 1;

                    // Update session
                    if let Some(mut session) = self.active_streams.write().await.get_mut(&stream_id) {
                        session.chunks_processed += 1;
                        session.bytes_streamed += bytes_read_chunk as u64;
                    }
                }
                Err(e) => {
                    self.send_error_chunk(&stream_id, &format!("Read error: {}", e), callback).await;
                    return Err(Status::GenericFailure.into());
                }
            }

            // Apply backpressure if needed
            if sequence % 10 == 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
            }
        }

        // Clean up session
        {
            let mut sessions = self.active_streams.write().await;
            sessions.remove(&stream_id);
        }

        Ok(stream_id)
    }

    /// Stream command output with real-time processing
    pub async fn stream_command_output(
        &self,
        command: &str,
        args: Vec<String>,
        options: StreamOptions,
        callback: ThreadsafeFunction<StreamChunk>,
    ) -> Result<String> {
        let stream_id = Uuid::new_v4().to_string();
        
        let mut child = match Command::new(command)
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(e) => {
                self.send_error_chunk(&stream_id, &format!("Failed to spawn command: {}", e), callback).await;
                return Err(Status::GenericFailure.into());
            }
        };

        let stdout = child.stdout.take().expect("Failed to get stdout");
        let mut reader = BufReader::new(stdout);
        let mut sequence = 0u64;
        let mut line = String::new();

        // Stream output line by line for command output
        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break; // EOF
            }

            let processing_start = self.current_timestamp_micros();

            let chunk = StreamChunk {
                stream_id: stream_id.clone(),
                sequence,
                content_type: "command_output".to_string(),
                data: line.clone(),
                size: line.len(),
                metadata: StreamChunkMetadata {
                    source: format!("{} {}", command, args.join(" ")),
                    encoding: Some("utf8".to_string()),
                    mime_type: Some("text/plain".to_string()),
                    total_size: None,
                    progress: None,
                    is_last: false,
                    error: None,
                    compression: None,
                },
                timing: StreamTiming {
                    generated_at: processing_start,
                    sent_at: self.current_timestamp(),
                    rust_processing_time: self.current_timestamp_micros() - processing_start,
                },
                resource_usage: if options.include_metrics {
                    Some(StreamResourceUsage {
                        memory_bytes: line.len() as u64,
                        cpu_time: self.current_timestamp_micros() - processing_start,
                        io_operations: 1,
                    })
                } else {
                    None
                },
            };

            self.send_chunk_to_js(chunk, &callback).await;
            sequence += 1;
            line.clear();
        }

        // Send completion chunk
        let final_chunk = self.create_final_chunk(
            &stream_id,
            sequence,
            &format!("{} {}", command, args.join(" ")),
            0, // Unknown total for commands
            0,
            self.current_timestamp_micros(),
        );
        
        self.send_chunk_to_js(final_chunk, &callback).await;

        Ok(stream_id)
    }

    async fn send_chunk_to_js(&self, chunk: StreamChunk, callback: &ThreadsafeFunction<StreamChunk>) {
        let chunk_clone = chunk.clone();
        callback.call(chunk_clone, ThreadSafeFunctionCallMode::Blocking);
    }

    async fn send_error_chunk(&self, stream_id: &str, error: &str, callback: ThreadsafeFunction<StreamChunk>) {
        let error_chunk = StreamChunk {
            stream_id: stream_id.to_string(),
            sequence: 0,
            content_type: "error".to_string(),
            data: String::new(),
            size: 0,
            metadata: StreamChunkMetadata {
                source: "error".to_string(),
                encoding: None,
                mime_type: None,
                total_size: None,
                progress: None,
                is_last: true,
                error: Some(error.to_string()),
                compression: None,
            },
            timing: StreamTiming {
                generated_at: self.current_timestamp(),
                sent_at: self.current_timestamp(),
                rust_processing_time: 0,
            },
            resource_usage: None,
        };

        self.send_chunk_to_js(error_chunk, &callback).await;
    }

    fn create_final_chunk(
        &self,
        stream_id: &str,
        sequence: u64,
        source: &str,
        bytes_processed: u64,
        total_size: u64,
        processing_start: u64,
    ) -> StreamChunk {
        StreamChunk {
            stream_id: stream_id.to_string(),
            sequence,
            content_type: "completion".to_string(),
            data: String::new(),
            size: 0,
            metadata: StreamChunkMetadata {
                source: source.to_string(),
                encoding: None,
                mime_type: None,
                total_size: Some(total_size),
                progress: Some(100.0),
                is_last: true,
                error: None,
                compression: None,
            },
            timing: StreamTiming {
                generated_at: processing_start,
                sent_at: self.current_timestamp(),
                rust_processing_time: self.current_timestamp_micros() - processing_start,
            },
            resource_usage: Some(StreamResourceUsage {
                memory_bytes: bytes_processed,
                cpu_time: self.current_timestamp_micros() - processing_start,
                io_operations: 1,
            }),
        }
    }

    fn current_timestamp(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    fn current_timestamp_micros(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros() as u64
    }
}