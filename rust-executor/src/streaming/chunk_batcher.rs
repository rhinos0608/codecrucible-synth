use super::error_handling::{StreamError, StreamResult};
use super::StreamChunk;
use serde::Serialize;
use std::time::Instant;
use std::collections::VecDeque;

/// Adaptive chunk batcher to reduce NAPI overhead by intelligently batching small chunks
pub struct ChunkBatcher {
    /// Configuration for batching behavior
    config: BatcherConfig,
    
    /// Current batch being accumulated
    current_batch: ChunkBatch,
    
    /// Performance metrics for adaptive behavior
    metrics: BatcherMetrics,
    
    /// Type-safe callback for sending chunk batches (true NAPI optimization)
    batch_callback: Box<dyn Fn(Vec<StreamChunk>) -> Result<(), String> + Send + Sync>,
    
    /// Timing for adaptive thresholds
    last_flush: Instant,
    
    /// Track recent performance to adjust batching
    recent_performance: VecDeque<BatchPerformance>,
}

#[derive(Debug, Clone)]
pub struct BatcherConfig {
    /// Maximum number of chunks per batch
    pub max_chunks_per_batch: usize,
    
    /// Maximum total bytes per batch
    pub max_bytes_per_batch: usize,
    
    /// Maximum time to hold chunks before flushing (microseconds)
    pub max_hold_time_us: u64,
    
    /// Minimum bytes to trigger immediate flush
    pub immediate_flush_threshold: usize,
    
    /// Enable adaptive batching based on performance
    pub enable_adaptive_batching: bool,
    
    /// Context-specific optimizations
    pub context_optimizations: ContextOptimizations,
}

#[derive(Debug, Clone)]
pub struct ContextOptimizations {
    /// For file reading - larger batches acceptable
    pub file_reading: BatchParams,
    
    /// For command output - prioritize low latency
    pub command_output: BatchParams,
    
    /// For network streams - balance throughput vs latency
    pub network_stream: BatchParams,
    
    /// For code generation - optimize for IDE responsiveness
    pub code_generation: BatchParams,
}

#[derive(Debug, Clone)]
pub struct BatchParams {
    pub max_chunks: usize,
    pub max_bytes: usize,
    pub max_hold_us: u64,
    pub priority_threshold: usize, // Bytes that trigger immediate flush
}

impl Default for ContextOptimizations {
    fn default() -> Self {
        Self {
            file_reading: BatchParams {
                max_chunks: 32,
                max_bytes: 256 * 1024, // 256KB batches for throughput
                max_hold_us: 5000, // 5ms max latency
                priority_threshold: 64 * 1024, // 64KB immediate flush
            },
            command_output: BatchParams {
                max_chunks: 4,
                max_bytes: 8 * 1024, // 8KB batches for low latency
                max_hold_us: 1000, // 1ms max latency
                priority_threshold: 1024, // 1KB immediate flush
            },
            network_stream: BatchParams {
                max_chunks: 16,
                max_bytes: 128 * 1024, // 128KB batches
                max_hold_us: 2000, // 2ms max latency
                priority_threshold: 32 * 1024, // 32KB immediate flush
            },
            code_generation: BatchParams {
                max_chunks: 8,
                max_bytes: 32 * 1024, // 32KB batches for IDE responsiveness
                max_hold_us: 1500, // 1.5ms max latency
                priority_threshold: 4 * 1024, // 4KB immediate flush
            },
        }
    }
}

impl Default for BatcherConfig {
    fn default() -> Self {
        Self {
            max_chunks_per_batch: 16,
            max_bytes_per_batch: 128 * 1024,
            max_hold_time_us: 2000,
            immediate_flush_threshold: 32 * 1024,
            enable_adaptive_batching: true,
            context_optimizations: ContextOptimizations::default(),
        }
    }
}

#[derive(Debug, Clone, Default)]
struct ChunkBatch {
    chunks: Vec<StreamChunk>,
    total_bytes: usize,
    first_chunk_time: Option<Instant>,
    stream_id: String,
    sequence_range: Option<(u64, u64)>, // (start, end)
}

#[derive(Debug, Clone, Default)]
struct BatcherMetrics {
    total_chunks_processed: u64,
    total_batches_sent: u64,
    total_bytes_processed: u64,
    avg_batch_size: f64,
    avg_latency_us: f64,
    adaptive_adjustments: u64,
}

#[derive(Debug, Clone)]
struct BatchPerformance {
    batch_size: usize,
    byte_size: usize,
    hold_time_us: u64,
    js_processing_time_us: u64,
    timestamp: Instant,
}

/// Batched chunks sent to JavaScript
#[derive(Debug, Clone, Serialize)]
pub struct BatchedChunks {
    pub batch_id: String,
    pub stream_id: String,
    pub chunks: Vec<StreamChunk>,
    pub batch_metadata: BatchMetadata,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchMetadata {
    pub total_chunks: usize,
    pub total_bytes: usize,
    pub sequence_range: (u64, u64),
    pub hold_time_us: u64,
    pub batch_type: BatchType,
    pub performance_hint: PerformanceHint,
}

#[derive(Debug, Clone, Serialize)]
pub enum BatchType {
    /// Regular batching for throughput
    Throughput,
    
    /// Low-latency batch for real-time data
    LowLatency,
    
    /// Priority flush for important data
    Priority,
    
    /// Adaptive batch based on performance feedback
    Adaptive,
    
    /// Final batch (stream ending)
    Final,
}

#[derive(Debug, Clone, Serialize)]
pub struct PerformanceHint {
    pub expected_processing_time_us: u64,
    pub priority_level: u8, // 1-10, higher = more urgent
    pub memory_usage_hint: usize,
    pub next_batch_eta_us: Option<u64>,
}

impl ChunkBatcher {
    /// Create new chunk batcher with true NAPI batching (eliminates individual chunk calls)
    pub fn new(
        config: BatcherConfig, 
        batch_callback: Box<dyn Fn(Vec<StreamChunk>) -> Result<(), String> + Send + Sync>
    ) -> Self {
        Self {
            config,
            current_batch: ChunkBatch::default(),
            metrics: BatcherMetrics::default(),
            batch_callback,
            last_flush: Instant::now(),
            recent_performance: VecDeque::with_capacity(100),
        }
    }

    /// Add chunk to batch, flushing if necessary
    pub fn add_chunk(&mut self, chunk: StreamChunk, context_type: &str) -> StreamResult<()> {
        // Initialize batch if empty
        if self.current_batch.chunks.is_empty() {
            self.current_batch.stream_id = chunk.stream_id.clone();
            self.current_batch.first_chunk_time = Some(Instant::now());
            self.current_batch.sequence_range = Some((chunk.sequence, chunk.sequence));
        } else {
            // Update sequence range
            if let Some((_start, end)) = &mut self.current_batch.sequence_range {
                *end = chunk.sequence.max(*end);
            }
        }

        // Add chunk to current batch
        self.current_batch.total_bytes += chunk.size;
        self.current_batch.chunks.push(chunk);
        
        // Check flush conditions
        if self.should_flush(context_type)? {
            self.flush_batch(context_type)?;
        }

        Ok(())
    }

    /// Check if batch should be flushed based on adaptive criteria
    fn should_flush(&self, context_type: &str) -> StreamResult<bool> {
        let batch_params = self.get_context_params(context_type);
        let current_batch = &self.current_batch;
        
        // Always flush if batch is empty (shouldn't happen but safety first)
        if current_batch.chunks.is_empty() {
            return Ok(false);
        }
        
        // Immediate flush conditions
        if current_batch.total_bytes >= batch_params.priority_threshold {
            return Ok(true);
        }
        
        // Size-based conditions
        if current_batch.chunks.len() >= batch_params.max_chunks {
            return Ok(true);
        }
        
        if current_batch.total_bytes >= batch_params.max_bytes {
            return Ok(true);
        }
        
        // Time-based condition
        if let Some(first_time) = current_batch.first_chunk_time {
            let hold_time = first_time.elapsed().as_micros() as u64;
            if hold_time >= batch_params.max_hold_us {
                return Ok(true);
            }
        }
        
        // Final chunk condition
        if let Some(last_chunk) = current_batch.chunks.last() {
            if last_chunk.metadata.is_last {
                return Ok(true);
            }
        }
        
        // Adaptive condition based on performance feedback
        if self.config.enable_adaptive_batching && self.should_adaptive_flush()? {
            return Ok(true);
        }
        
        Ok(false)
    }

    /// Determine if adaptive logic suggests flushing
    fn should_adaptive_flush(&self) -> StreamResult<bool> {
        // If we don't have enough performance history, use default behavior
        if self.recent_performance.len() < 5 {
            return Ok(false);
        }
        
        // Calculate recent average JS processing time
        let recent_avg_processing_time: u64 = self.recent_performance
            .iter()
            .rev()
            .take(5)
            .map(|p| p.js_processing_time_us)
            .sum::<u64>() / 5;
        
        // If JS processing is getting slower, flush more aggressively to reduce latency
        let js_processing_threshold = 10_000; // 10ms
        if recent_avg_processing_time > js_processing_threshold {
            let current_hold_time = self.current_batch.first_chunk_time
                .map(|t| t.elapsed().as_micros() as u64)
                .unwrap_or(0);
                
            // Flush if we've been holding for more than half the recent average processing time
            return Ok(current_hold_time > recent_avg_processing_time / 2);
        }
        
        // If JS processing is fast, we can batch more aggressively for throughput
        if recent_avg_processing_time < 1_000 && self.current_batch.chunks.len() < 4 {
            return Ok(false); // Hold longer for better batching
        }
        
        Ok(false)
    }

    /// Flush current batch to JavaScript
    fn flush_batch(&mut self, context_type: &str) -> StreamResult<()> {
        if self.current_batch.chunks.is_empty() {
            return Ok(()); // Nothing to flush
        }
        
        let batch_start_time = Instant::now();
        let hold_time_us = self.current_batch.first_chunk_time
            .map(|t| t.elapsed().as_micros() as u64)
            .unwrap_or(0);
        
        // Determine batch type
        let batch_type = self.determine_batch_type(context_type, hold_time_us);
        
        // Create performance hint
        let performance_hint = PerformanceHint {
            expected_processing_time_us: self.estimate_processing_time(),
            priority_level: self.calculate_priority_level(context_type, &batch_type),
            memory_usage_hint: self.current_batch.total_bytes,
            next_batch_eta_us: self.estimate_next_batch_time(),
        };
        
        // Create batch metadata
        let batch_metadata = BatchMetadata {
            total_chunks: self.current_batch.chunks.len(),
            total_bytes: self.current_batch.total_bytes,
            sequence_range: self.current_batch.sequence_range.unwrap_or((0, 0)),
            hold_time_us,
            batch_type,
            performance_hint,
        };
        
        // Create batched chunks
        let batched_chunks = BatchedChunks {
            batch_id: uuid::Uuid::new_v4().to_string(),
            stream_id: self.current_batch.stream_id.clone(),
            chunks: std::mem::take(&mut self.current_batch.chunks),
            batch_metadata,
        };
        
        // Send entire batch via single NAPI call (true performance optimization)
        let chunks_to_send = batched_chunks.chunks;
        let chunk_count = chunks_to_send.len();
        
        if let Err(error) = (self.batch_callback)(chunks_to_send) {
            eprintln!("Batch callback error for {} chunks: {}", chunk_count, error);
            return Err(StreamError::StreamingError {
                stage: super::error_handling::StreamingStage::ChunkProcessing,
                stream_id: self.current_batch.stream_id.clone(),
                sequence: None,
                buffer_state: super::error_handling::BufferState {
                    current_size: self.current_batch.total_bytes,
                    max_size: self.config.max_bytes_per_batch,
                    pending_chunks: chunk_count,
                    flush_threshold: self.config.immediate_flush_threshold,
                },
                performance_context: super::error_handling::PerformanceContext {
                    start_time: batch_start_time.elapsed().as_millis() as u64,
                    bytes_processed: self.current_batch.total_bytes as u64,
                    chunks_processed: chunk_count as u64,
                    current_throughput_bps: 0.0,
                    memory_usage_bytes: self.current_batch.total_bytes as u64,
                    cpu_usage_percent: 0.0,
                },
            });
        }
        
        // Record performance for adaptive behavior
        let batch_performance = BatchPerformance {
            batch_size: self.current_batch.chunks.len(),
            byte_size: self.current_batch.total_bytes,
            hold_time_us,
            js_processing_time_us: 0, // Will be updated by feedback from JS
            timestamp: batch_start_time,
        };
        
        self.recent_performance.push_back(batch_performance);
        if self.recent_performance.len() > 100 {
            self.recent_performance.pop_front();
        }
        
        // Update metrics
        self.metrics.total_batches_sent += 1;
        self.metrics.total_chunks_processed += self.current_batch.chunks.len() as u64;
        self.metrics.total_bytes_processed += self.current_batch.total_bytes as u64;
        self.metrics.avg_batch_size = self.metrics.total_chunks_processed as f64 / self.metrics.total_batches_sent as f64;
        self.metrics.avg_latency_us = (self.metrics.avg_latency_us * (self.metrics.total_batches_sent - 1) as f64 + hold_time_us as f64) / self.metrics.total_batches_sent as f64;
        
        // Reset current batch
        self.current_batch = ChunkBatch::default();
        self.last_flush = Instant::now();
        
        Ok(())
    }

    /// Force flush current batch
    pub fn force_flush(&mut self, context_type: &str) -> StreamResult<()> {
        self.flush_batch(context_type)
    }

    /// Provide feedback from JavaScript about processing performance
    pub fn record_js_performance(&mut self, _batch_id: &str, processing_time_us: u64) {
        // Find the corresponding batch in recent performance
        if let Some(batch_perf) = self.recent_performance.iter_mut().rev().next() {
            batch_perf.js_processing_time_us = processing_time_us;
        }
    }

    /// Get context-specific batch parameters
    fn get_context_params(&self, context_type: &str) -> &BatchParams {
        match context_type {
            "file_reading" | "fileAnalysis" => &self.config.context_optimizations.file_reading,
            "command_output" | "commandOutput" => &self.config.context_optimizations.command_output,
            "network_stream" => &self.config.context_optimizations.network_stream,
            "code_generation" | "codeGeneration" => &self.config.context_optimizations.code_generation,
            _ => &self.config.context_optimizations.file_reading, // Default
        }
    }

    fn determine_batch_type(&self, context_type: &str, hold_time_us: u64) -> BatchType {
        let params = self.get_context_params(context_type);
        
        if self.current_batch.total_bytes >= params.priority_threshold {
            BatchType::Priority
        } else if hold_time_us < params.max_hold_us / 4 {
            BatchType::LowLatency
        } else if self.config.enable_adaptive_batching && self.recent_performance.len() > 10 {
            BatchType::Adaptive
        } else if self.current_batch.chunks.last().map(|c| c.metadata.is_last).unwrap_or(false) {
            BatchType::Final
        } else {
            BatchType::Throughput
        }
    }

    fn estimate_processing_time(&self) -> u64 {
        if self.recent_performance.is_empty() {
            return 5000; // 5ms default estimate
        }
        
        let recent_avg: u64 = self.recent_performance
            .iter()
            .rev()
            .take(5)
            .map(|p| p.js_processing_time_us)
            .sum::<u64>() / self.recent_performance.len().min(5) as u64;
            
        // Scale by batch size
        let size_factor = (self.current_batch.chunks.len() as f64 / 10.0).max(0.1);
        (recent_avg as f64 * size_factor) as u64
    }

    fn calculate_priority_level(&self, context_type: &str, batch_type: &BatchType) -> u8 {
        let base_priority = match context_type {
            "command_output" | "commandOutput" => 8, // High priority for real-time
            "code_generation" | "codeGeneration" => 7, // High priority for IDE
            "network_stream" => 6,
            _ => 5, // Default
        };
        
        let type_modifier = match batch_type {
            BatchType::Priority => 2,
            BatchType::LowLatency => 1,
            BatchType::Final => 3,
            BatchType::Adaptive => 0,
            BatchType::Throughput => -1,
        };
        
        (base_priority + type_modifier).clamp(1, 10) as u8
    }

    fn estimate_next_batch_time(&self) -> Option<u64> {
        // Estimate when the next batch might be ready based on recent patterns
        if self.recent_performance.len() < 3 {
            return None;
        }
        
        let recent_intervals: Vec<u64> = self.recent_performance
            .iter()
            .rev()
            .take(5)
            .map(|p| p.hold_time_us)
            .collect();
            
        if recent_intervals.is_empty() {
            return None;
        }
        
        let avg_interval = recent_intervals.iter().sum::<u64>() / recent_intervals.len() as u64;
        Some(avg_interval)
    }

    /// Get current batching metrics
    pub fn get_metrics(&self) -> BatcherMetrics {
        self.metrics.clone()
    }
}