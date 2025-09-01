use std::sync::atomic::{AtomicU64, Ordering};

pub struct PerformanceMonitor {
    operations_count: AtomicU64,
    total_duration_ms: AtomicU64,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            operations_count: AtomicU64::new(0),
            total_duration_ms: AtomicU64::new(0),
        }
    }
    
    pub fn record_operation(&self, duration_ms: u64) {
        self.operations_count.fetch_add(1, Ordering::SeqCst);
        self.total_duration_ms.fetch_add(duration_ms, Ordering::SeqCst);
    }
    
    pub fn get_average_duration(&self) -> f64 {
        let count = self.operations_count.load(Ordering::SeqCst);
        let total = self.total_duration_ms.load(Ordering::SeqCst);
        
        if count > 0 {
            total as f64 / count as f64
        } else {
            0.0
        }
    }
}

impl Default for PerformanceMonitor {
    fn default() -> Self {
        Self::new()
    }
}