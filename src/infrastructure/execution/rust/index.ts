/**
 * Consolidated Rust Execution System - Clean Architecture
 *
 * Eliminates duplication between legacy RustExecutionBackend, RustProviderClient,
 * RustBridgeManager, and RustStreamingClient with a unified approach.
 */

// Core unified system exports
export {
  UnifiedRustExecutor,
  type UnifiedRustExecutorConfig,
  type RustExecutorHealth,
  type RustExecutorMetrics,
} from './unified-rust-executor.js';

export {
  UnifiedRustProvider,
  type RustProviderRequest,
  type RustProviderCapabilities,
} from './unified-rust-provider.js';

export {
  ConsolidatedRustSystem,
  createConsolidatedRustSystem,
  consolidatedRustSystem,
  type RustExecutionMode,
  type ConsolidatedRustConfig,
} from './consolidated-rust-system.js';

// Bridge adapter (still needed for NAPI interface)
export { BridgeAdapter, type IRustExecutionBridge } from './bridge-adapter.js';

// Local import for factory functions
import {
  ConsolidatedRustSystem,
  createConsolidatedRustSystem,
  type ConsolidatedRustConfig,
} from './consolidated-rust-system.js';

// Factory functions for common use cases
export const createRustToolExecutor = (fallbackOrchestrator?: any): ConsolidatedRustSystem =>
  createConsolidatedRustSystem({
    moduleName: 'rust-tool-executor',
    mode: 'tool-execution',
    fallbackToTypescript: true,
    typescriptOrchestrator: fallbackOrchestrator,
  });

export const createRustProvider = (): ConsolidatedRustSystem =>
  createConsolidatedRustSystem({
    moduleName: 'rust-provider',
    mode: 'provider-service',
  });

export const createRustStreaming = (): ConsolidatedRustSystem =>
  createConsolidatedRustSystem({
    moduleName: 'rust-streaming',
    mode: 'streaming',
  });

// Singleton instance
let globalRustSystem: ConsolidatedRustSystem | null = null;

/**
 * Get or create the global Rust execution system
 */
export function getRustExecutor(fallbackOrchestrator?: any): ConsolidatedRustSystem {
  if (!globalRustSystem) {
    globalRustSystem = createRustToolExecutor(fallbackOrchestrator);
  }
  return globalRustSystem;
}

/**
 * Initialize the global Rust system
 */
export async function initializeRustExecutor(fallbackOrchestrator?: any): Promise<boolean> {
  const system = getRustExecutor(fallbackOrchestrator);
  return system.initialize();
}

/**
 * Cleanup the global Rust system
 */
export async function cleanupRustExecutor(): Promise<void> {
  if (globalRustSystem) {
    await globalRustSystem.destroy();
    globalRustSystem = null;
  }
}
