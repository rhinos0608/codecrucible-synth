import { RustExecutionBackend } from './rust-execution-backend.js';
export { RustExecutionBackend };
export { RustBridgeManager } from './rust-bridge-manager.js';
export type {
  RustExecutorOptions,
  RustExecutionContext,
  RustExecutionResult,
} from './rust-execution-backend.js';
export type { BridgeConfiguration, BridgeHealth } from './rust-bridge-manager.js';
import type { IToolExecutor } from '@/domain/interfaces/tool-system.js';
import type { IRustExecutionBridge } from './bridge-adapter.js';

let globalBackend: RustExecutionBackend | null = null;

/**
 * Get or create a shared Rust execution backend instance.
 */
export function getRustExecutor(
  options: RustExecutorOptions = {},
  tsOrchestrator?: IToolExecutor,
  bridge?: IRustExecutionBridge
): RustExecutionBackend {
  if (!globalBackend) {
    globalBackend = new RustExecutionBackend(options, tsOrchestrator, bridge);
  }
  return globalBackend;
}

/**
 * Initialize the shared Rust execution backend.
 */
export async function initializeRustExecutor(
  options: RustExecutorOptions = {},
  tsOrchestrator?: IToolExecutor,
  bridge?: IRustExecutionBridge
): Promise<boolean> {
  const backend = getRustExecutor(options, tsOrchestrator, bridge);
  return backend.initialize();
}

/**
 * Cleanup the shared Rust execution backend and reset state.
 */
export async function cleanupRustExecutor(): Promise<void> {
  if (globalBackend) {
    await globalBackend.cleanup();
    globalBackend = null;
  }
}
