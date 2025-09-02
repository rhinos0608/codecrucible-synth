/**
 * Cross-platform Rust NAPI module integration
 * Replaces hardcoded path resolution with dynamic platform detection
 */

import { loadRustExecutorSafely, createFallbackRustExecutor } from '../../../utils/rust-module-loader.js';
import { logger } from '../../../infrastructure/logging/unified-logger.js';

// Load the Rust module with cross-platform support
const rustModuleResult = loadRustExecutorSafely();

let rustModule: any;

if (rustModuleResult.available && rustModuleResult.module) {
  rustModule = rustModuleResult.module;
  logger.info(`✅ Rust executor module loaded successfully from: ${rustModuleResult.binaryPath}`);
} else {
  logger.warn(`⚠️ Failed to load Rust executor module: ${rustModuleResult.error}`);
  
  // Create fallback module with helpful error messages
  rustModule = createFallbackRustExecutor(rustModuleResult.error || 'Unknown error');
}

// Export the module interfaces with proper TypeScript types
export const RustExecutor = rustModule.RustExecutor;
export const createRustExecutor = rustModule.createRustExecutor || rustModule.create_rust_executor;
export const initLogging = rustModule.initLogging || rustModule.init_logging;
export const getVersion = rustModule.getVersion || rustModule.get_version;
export const benchmarkExecution = rustModule.benchmarkExecution || rustModule.benchmark_execution;

// Additional exports that might be available
export const SecurityLevel = rustModule.SecurityLevel;

// Export the entire module for dynamic access
export default rustModule;

// Export availability status for conditional usage
export const isRustAvailable = rustModuleResult.available;
export const rustModuleError = rustModuleResult.error;
export const rustBinaryPath = rustModuleResult.binaryPath;