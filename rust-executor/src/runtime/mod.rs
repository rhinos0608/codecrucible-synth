/**
 * Runtime Module
 * 
 * Provides shared Tokio runtime management for the Rust executor,
 * optimizing resource utilization across filesystem and streaming operations.
 */

pub mod shared_runtime;

pub use shared_runtime::{RuntimeManager, SharedTokioRuntime, RuntimeStats};