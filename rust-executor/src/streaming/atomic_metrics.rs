use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};
use tokio::time::interval;

/// Lock-free atomic metrics for streaming operations - eliminates RwLock contention
#[derive(Debug)]
pub struct AtomicStreamingMetrics {
    // Core operational counters (updated on hot path - lock-free)
    pub bytes_processed: AtomicU64,
    pub chunks_processed: AtomicU64,
    pub active_streams: AtomicU64,
    pub total_streams_created: AtomicU64,
    pub total_streams_completed: AtomicU64,
    
    // Error tracking (lock-free)
    pub total_errors: AtomicU64,
    pub timeout_errors: AtomicU64,
    pub permission_errors: AtomicU64,
    pub network_errors: AtomicU64,
    
    // Performance tracking (lock-free)
    pub peak_memory_usage_bytes: AtomicU64,
    pub peak_active_streams: AtomicU64,
    pub total_execution_time_ns: AtomicU64,
    pub total_napi_calls: AtomicU64,
    
    // Batching metrics (NAPI optimization tracking)
    pub batches_sent: AtomicU64,
    pub chunks_per_batch_sum: AtomicU64, // For calculating average batch size
    pub napi_array_transfers: AtomicU64,  // Track true array batching efficiency
    
    // Backpressure metrics
    pub backpressure_activations: AtomicU64,
    pub circuit_breaker_trips: AtomicU64,
    pub rejected_streams: AtomicU64,
}

/// Point-in-time consistent snapshot of metrics (for external consumption)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    pub bytes_processed: u64,
    pub chunks_processed: u64,
    pub active_streams: u64,
    pub total_streams_created: u64,
    pub total_streams_completed: u64,
    
    pub total_errors: u64,
    pub error_rate_percent: f64,
    
    pub peak_memory_usage_bytes: u64,
    pub peak_active_streams: u64,
    pub average_execution_time_ms: f64,
    
    // Batching efficiency metrics
    pub batches_sent: u64,
    pub average_batch_size: f64,
    pub napi_efficiency_ratio: f64, // napi_calls / chunks_processed (lower is better)
    
    // Performance indicators
    pub throughput_bytes_per_second: f64,
    pub throughput_chunks_per_second: f64,
    
    // System health
    pub backpressure_activation_rate: f64,
    pub circuit_breaker_health: CircuitBreakerHealth,
    
    pub timestamp: u64, // Unix timestamp when snapshot was taken
    pub snapshot_duration_ms: u64, // How long snapshot collection took
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CircuitBreakerHealth {
    Healthy,    // < 1% failure rate
    Degraded,   // 1-5% failure rate
    Critical,   // 5-15% failure rate  
    Failed,     // > 15% failure rate
}

impl AtomicStreamingMetrics {
    pub fn new() -> Self {
        Self {
            bytes_processed: AtomicU64::new(0),
            chunks_processed: AtomicU64::new(0),
            active_streams: AtomicU64::new(0),
            total_streams_created: AtomicU64::new(0),
            total_streams_completed: AtomicU64::new(0),
            
            total_errors: AtomicU64::new(0),
            timeout_errors: AtomicU64::new(0),
            permission_errors: AtomicU64::new(0),
            network_errors: AtomicU64::new(0),
            
            peak_memory_usage_bytes: AtomicU64::new(0),
            peak_active_streams: AtomicU64::new(0),
            total_execution_time_ns: AtomicU64::new(0),
            total_napi_calls: AtomicU64::new(0),
            
            batches_sent: AtomicU64::new(0),
            chunks_per_batch_sum: AtomicU64::new(0),
            napi_array_transfers: AtomicU64::new(0),
            
            backpressure_activations: AtomicU64::new(0),
            circuit_breaker_trips: AtomicU64::new(0),
            rejected_streams: AtomicU64::new(0),
        }
    }
    
    /// Record stream lifecycle events (uses AcqRel for visibility across threads)
    #[inline]
    pub fn stream_started(&self) {
        self.total_streams_created.fetch_add(1, Ordering::Relaxed);
        let active = self.active_streams.fetch_add(1, Ordering::AcqRel);
        
        // Update peak tracking
        let current_peak = self.peak_active_streams.load(Ordering::Relaxed);
        if active + 1 > current_peak {
            // Use CAS to avoid race conditions in peak tracking
            let _ = self.peak_active_streams.compare_exchange_weak(
                current_peak, 
                active + 1, 
                Ordering::Relaxed, 
                Ordering::Relaxed
            );
        }
    }
    
    #[inline]
    pub fn stream_completed(&self) {
        self.total_streams_completed.fetch_add(1, Ordering::Relaxed);
        self.active_streams.fetch_sub(1, Ordering::AcqRel);
    }
    
    /// Record chunk processing (hot path - ultra fast)
    #[inline]
    pub fn chunk_processed(&self, bytes: usize) {
        self.chunks_processed.fetch_add(1, Ordering::Relaxed);
        self.bytes_processed.fetch_add(bytes as u64, Ordering::Relaxed);
    }
    
    /// Record batch operations (NAPI optimization tracking)
    #[inline]
    pub fn batch_sent(&self, chunk_count: usize) {
        self.batches_sent.fetch_add(1, Ordering::Relaxed);
        self.chunks_per_batch_sum.fetch_add(chunk_count as u64, Ordering::Relaxed);
        self.napi_array_transfers.fetch_add(1, Ordering::Relaxed);
        
        // Track NAPI efficiency - fewer calls per chunk is better
        self.total_napi_calls.fetch_add(1, Ordering::Relaxed);
    }
    
    /// Record various error types for health monitoring
    #[inline]
    pub fn error_occurred(&self, error_type: ErrorType) {
        self.total_errors.fetch_add(1, Ordering::Relaxed);
        match error_type {
            ErrorType::Timeout => self.timeout_errors.fetch_add(1, Ordering::Relaxed),
            ErrorType::Permission => self.permission_errors.fetch_add(1, Ordering::Relaxed),  
            ErrorType::Network => self.network_errors.fetch_add(1, Ordering::Relaxed),
            ErrorType::Other => 0, // Only increment total_errors
        };
    }
    
    /// Record backpressure and circuit breaker events  
    #[inline]
    pub fn backpressure_activated(&self) {
        self.backpressure_activations.fetch_add(1, Ordering::Relaxed);
    }
    
    #[inline]
    pub fn circuit_breaker_tripped(&self) {
        self.circuit_breaker_trips.fetch_add(1, Ordering::Relaxed);
    }
    
    #[inline]
    pub fn stream_rejected(&self) {
        self.rejected_streams.fetch_add(1, Ordering::Relaxed);
    }
    
    /// Update memory usage tracking (with atomic max update)
    #[inline]
    pub fn update_memory_usage(&self, current_bytes: u64) {
        let current_peak = self.peak_memory_usage_bytes.load(Ordering::Relaxed);
        if current_bytes > current_peak {
            // Atomic max update
            let _ = self.peak_memory_usage_bytes.compare_exchange_weak(
                current_peak,
                current_bytes,
                Ordering::Relaxed,
                Ordering::Relaxed
            );
        }
    }
    
    /// Record execution time in nanoseconds
    #[inline]  
    pub fn add_execution_time(&self, duration_ns: u64) {
        self.total_execution_time_ns.fetch_add(duration_ns, Ordering::Relaxed);
    }
}

/// Error types for categorized error tracking
#[derive(Debug, Clone, Copy)]
pub enum ErrorType {
    Timeout,
    Permission,
    Network,
    Other,
}

/// Background metrics aggregator - creates consistent snapshots without blocking hot path
pub struct MetricsAggregator {
    atomic_metrics: Arc<AtomicStreamingMetrics>,
    snapshot_cache: Arc<tokio::sync::RwLock<MetricsSnapshot>>,
    aggregation_interval: Duration,
    start_time: Instant,
}

impl MetricsAggregator {
    pub fn new(
        atomic_metrics: Arc<AtomicStreamingMetrics>,
        aggregation_interval_ms: u64,
    ) -> Self {
        // Create temporary instance to compute initial snapshot
        let temp_aggregator = Self {
            atomic_metrics: atomic_metrics.clone(),
            snapshot_cache: Arc::new(tokio::sync::RwLock::new(MetricsSnapshot {
                bytes_processed: 0,
                chunks_processed: 0,
                active_streams: 0,
                total_streams_created: 0,
                total_streams_completed: 0,
                total_errors: 0,
                error_rate_percent: 0.0,
                peak_memory_usage_bytes: 0,
                peak_active_streams: 0,
                average_execution_time_ms: 0.0,
                batches_sent: 0,
                average_batch_size: 0.0,
                napi_efficiency_ratio: 0.0,
                throughput_bytes_per_second: 0.0,
                throughput_chunks_per_second: 0.0,
                backpressure_activation_rate: 0.0,
                circuit_breaker_health: CircuitBreakerHealth::Healthy,
                timestamp: 0,
                snapshot_duration_ms: 0,
            })), 
            aggregation_interval: Duration::from_millis(aggregation_interval_ms),
            start_time: Instant::now(),
        };
        
        temp_aggregator
    }
    
    /// Get cached snapshot (fast read from pre-computed data, with on-demand fallback)
    pub async fn get_snapshot(&self) -> MetricsSnapshot {
        let cached = self.snapshot_cache.read().await;
        
        // If cache is uninitialized (timestamp = 0), compute on-demand
        if cached.timestamp == 0 {
            drop(cached); // Release read lock
            self.collect_snapshot().await
        } else {
            cached.clone()
        }
    }
    
    /// Start background aggregation task (requires active Tokio runtime)
    pub fn start_aggregation_task(self: Arc<Self>) {
        // Only start if there's an active Tokio runtime
        if tokio::runtime::Handle::try_current().is_ok() {
            let aggregator = self;
            tokio::spawn(async move {
                let mut interval = interval(aggregator.aggregation_interval);
                
                loop {
                    interval.tick().await;
                    
                    let snapshot_start = Instant::now();
                    let snapshot = aggregator.collect_snapshot().await;
                    let snapshot_duration = snapshot_start.elapsed();
                    
                    // Update cached snapshot (brief write lock only for cache update)
                    {
                        let mut cache = aggregator.snapshot_cache.write().await;
                        *cache = MetricsSnapshot {
                            snapshot_duration_ms: snapshot_duration.as_millis() as u64,
                            ..snapshot
                        };
                    }
                }
            });
        } else {
            // FIXED: Use proper Rust logging instead of eprintln! to reduce noise
            // No runtime available - metrics will be computed on-demand only
            // This is normal behavior when not in an async context
            tracing::debug!("No Tokio runtime available for metrics aggregation. Using on-demand computation only.");
        }
    }
    
    /// Collect point-in-time snapshot (lock-free reads from atomic counters)
    async fn collect_snapshot(&self) -> MetricsSnapshot {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
            
        let elapsed_seconds = self.start_time.elapsed().as_secs_f64();
        
        // Collect all atomic values atomically (no locks)
        let bytes_processed = self.atomic_metrics.bytes_processed.load(Ordering::Relaxed);
        let chunks_processed = self.atomic_metrics.chunks_processed.load(Ordering::Relaxed);
        let active_streams = self.atomic_metrics.active_streams.load(Ordering::Acquire);
        let total_streams = self.atomic_metrics.total_streams_created.load(Ordering::Relaxed);
        let completed_streams = self.atomic_metrics.total_streams_completed.load(Ordering::Relaxed);
        let total_errors = self.atomic_metrics.total_errors.load(Ordering::Relaxed);
        let batches_sent = self.atomic_metrics.batches_sent.load(Ordering::Relaxed);
        let chunks_per_batch_sum = self.atomic_metrics.chunks_per_batch_sum.load(Ordering::Relaxed);
        let napi_calls = self.atomic_metrics.total_napi_calls.load(Ordering::Relaxed);
        let backpressure_activations = self.atomic_metrics.backpressure_activations.load(Ordering::Relaxed);
        let circuit_breaker_trips = self.atomic_metrics.circuit_breaker_trips.load(Ordering::Relaxed);
        let execution_time_ns = self.atomic_metrics.total_execution_time_ns.load(Ordering::Relaxed);
        
        // Calculate derived metrics
        let error_rate_percent = if completed_streams > 0 {
            (total_errors as f64 / completed_streams as f64) * 100.0
        } else { 0.0 };
        
        let average_batch_size = if batches_sent > 0 {
            chunks_per_batch_sum as f64 / batches_sent as f64
        } else { 0.0 };
        
        let napi_efficiency_ratio = if chunks_processed > 0 {
            napi_calls as f64 / chunks_processed as f64
        } else { 0.0 };
        
        let throughput_bytes_per_second = if elapsed_seconds > 0.0 {
            bytes_processed as f64 / elapsed_seconds  
        } else { 0.0 };
        
        let throughput_chunks_per_second = if elapsed_seconds > 0.0 {
            chunks_processed as f64 / elapsed_seconds
        } else { 0.0 };
        
        let backpressure_activation_rate = if total_streams > 0 {
            backpressure_activations as f64 / total_streams as f64
        } else { 0.0 };
        
        let average_execution_time_ms = if completed_streams > 0 {
            (execution_time_ns as f64 / completed_streams as f64) / 1_000_000.0
        } else { 0.0 };
        
        // Circuit breaker health should be calculated by the WorkerPool based on actual state
        // This is a fallback for when WorkerPool health data is not available
        let circuit_breaker_health = if circuit_breaker_trips > 0 {
            // If we've had recent trips, health is at least degraded
            if error_rate_percent > 15.0 {
                CircuitBreakerHealth::Failed
            } else if error_rate_percent > 5.0 {
                CircuitBreakerHealth::Critical
            } else {
                CircuitBreakerHealth::Degraded
            }
        } else {
            // No trips, use error rate as fallback
            if error_rate_percent < 1.0 {
                CircuitBreakerHealth::Healthy
            } else if error_rate_percent < 5.0 {
                CircuitBreakerHealth::Degraded
            } else if error_rate_percent < 15.0 {
                CircuitBreakerHealth::Critical
            } else {
                CircuitBreakerHealth::Failed
            }
        };
        
        MetricsSnapshot {
            bytes_processed,
            chunks_processed,
            active_streams,
            total_streams_created: total_streams,
            total_streams_completed: completed_streams,
            total_errors,
            error_rate_percent,
            peak_memory_usage_bytes: self.atomic_metrics.peak_memory_usage_bytes.load(Ordering::Relaxed),
            peak_active_streams: self.atomic_metrics.peak_active_streams.load(Ordering::Relaxed),
            average_execution_time_ms,
            batches_sent,
            average_batch_size,
            napi_efficiency_ratio,
            throughput_bytes_per_second,
            throughput_chunks_per_second,
            backpressure_activation_rate,
            circuit_breaker_health,
            timestamp: now,
            snapshot_duration_ms: 0, // Will be filled by caller
        }
    }
}

impl Default for AtomicStreamingMetrics {
    fn default() -> Self {
        Self::new()
    }
}