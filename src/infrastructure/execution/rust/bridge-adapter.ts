/**
 * BridgeAdapter wraps RustBridgeManager to expose a simple executor/metrics surface.
 * This keeps RustExecutionBackend free of NAPI/module-loading concerns.
 */
import { RustBridgeManager, type BridgeHealth } from './rust-bridge-manager.js';

export interface BridgeResult {
  success: boolean;
  result?: unknown;
  error?: string;
  // Support both camelCase (NAPI) and snake_case (older typings)
  executionTimeMs?: number;
  execution_time_ms?: number;
  performance_metrics?: string;
}

export interface IRustExecutionBridge {
  initialize(): Promise<boolean>;
  isAvailable(): boolean;
  executeFilesystem(
    operation: string,
    path: string,
    content?: string,
    options?: unknown
  ): Promise<BridgeResult>;
  executeCommand(command: string, args: string[], options?: unknown): Promise<BridgeResult>;
  execute(toolId: string, argsJson: string, options?: unknown): Promise<BridgeResult>;
  getSupportedTools(): string[];
  getPerformanceMetrics(): string;
  resetPerformanceMetrics(): void;
  cleanup(): Promise<void>;
  getId(): string | undefined;
  getHealth(): BridgeHealth;
}

type NativeExecutor = {
  initialize(): boolean;
  executeFilesystem: (
    op: string,
    path: string,
    content?: string,
    options?: unknown
  ) => Promise<BridgeResult>;
  executeCommand: (cmd: string, args: string[], options?: unknown) => Promise<BridgeResult>;
  execute: (toolId: string, argsJson: string, options?: unknown) => Promise<BridgeResult>;
  getPerformanceMetrics: () => string;
  resetPerformanceMetrics: () => void;
  getSupportedTools: () => string[];
  id: string;
};

export class BridgeAdapter implements IRustExecutionBridge {
  private manager = RustBridgeManager.getInstance();
  private executor: NativeExecutor | null = null;
  private available = false;

  async initialize(): Promise<boolean> {
    const ok = await this.manager.initialize().catch(() => false);
    if (!ok) return false;
    const mod: any = this.manager.getRustModule();
    if (!mod) return false;
    const exec: NativeExecutor = (
      mod.createRustExecutor ? mod.createRustExecutor() : new mod.RustExecutor()
    ) as NativeExecutor;
    const inited = exec && typeof exec.initialize === 'function' ? exec.initialize() : false;
    this.available = !!inited;
    this.executor = inited ? exec : null;
    return this.available;
  }

  isAvailable(): boolean {
    return this.available && !!this.executor;
  }

  async executeFilesystem(
    operation: string,
    path: string,
    content?: string,
    options?: unknown
  ): Promise<BridgeResult> {
    if (!this.executor) throw new Error('executor not available');
    return this.executor.executeFilesystem(operation, path, content, options);
  }

  async executeCommand(command: string, args: string[], options?: unknown): Promise<BridgeResult> {
    if (!this.executor) throw new Error('executor not available');
    return this.executor.executeCommand(command, args, options);
  }

  async execute(toolId: string, argsJson: string, options?: unknown): Promise<BridgeResult> {
    if (!this.executor) throw new Error('executor not available');
    return this.executor.execute(toolId, argsJson, options);
  }

  getSupportedTools(): string[] {
    return this.executor?.getSupportedTools() ?? [];
  }
  getPerformanceMetrics(): string {
    return this.executor?.getPerformanceMetrics() ?? '{}';
  }
  resetPerformanceMetrics(): void {
    this.executor?.resetPerformanceMetrics();
  }
  async cleanup(): Promise<void> {
    await this.manager.shutdown();
    this.executor = null;
    this.available = false;
  }
  getId(): string | undefined {
    return this.executor?.id;
  }
  getHealth(): BridgeHealth {
    return this.manager.getHealth();
  }
}

export default BridgeAdapter;
