// Active Process Manager
// Core layer process management functionality

import { EventEmitter } from 'events';

export interface ProcessInfo {
  id: string;
  name: string;
  startTime: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  metadata?: Record<string, unknown>;
}

export interface ProcessManagerConfig {
  maxConcurrentProcesses: number;
  processTimeout: number;
  enableMonitoring: boolean;
  cleanupInterval: number;
}

export interface ActiveProcessManagerInterface {
  startProcess(processName: string, handler: () => Promise<any>): Promise<string>;
  pauseProcess(processId: string): Promise<boolean>;
  resumeProcess(processId: string): Promise<boolean>;
  stopProcess(processId: string): Promise<boolean>;
  getProcessInfo(processId: string): ProcessInfo | null;
  getActiveProcesses(): ProcessInfo[];
}

export class ActiveProcessManager extends EventEmitter implements ActiveProcessManagerInterface {
  private config: ProcessManagerConfig;
  private processes = new Map<string, ProcessInfo>();
  private processHandlers = new Map<string, AbortController>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<ProcessManagerConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentProcesses: 10,
      processTimeout: 300000, // 5 minutes
      enableMonitoring: true,
      cleanupInterval: 60000, // 1 minute
      ...config
    };

    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }
  }

  async startProcess(processName: string, handler: () => Promise<any>): Promise<string> {
    if (this.processes.size >= this.config.maxConcurrentProcesses) {
      throw new Error('Maximum concurrent processes reached');
    }

    const processId = `${processName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const abortController = new AbortController();

    const processInfo: ProcessInfo = {
      id: processId,
      name: processName,
      startTime: Date.now(),
      status: 'running',
      progress: 0
    };

    this.processes.set(processId, processInfo);
    this.processHandlers.set(processId, abortController);

    this.emit('process:started', { processId, processName });

    // Execute process with timeout
    this.executeProcessWithTimeout(processId, handler, abortController);

    return processId;
  }

  async pauseProcess(processId: string): Promise<boolean> {
    const processInfo = this.processes.get(processId);
    if (!processInfo || processInfo.status !== 'running') {
      return false;
    }

    processInfo.status = 'paused';
    this.emit('process:paused', { processId });
    return true;
  }

  async resumeProcess(processId: string): Promise<boolean> {
    const processInfo = this.processes.get(processId);
    if (!processInfo || processInfo.status !== 'paused') {
      return false;
    }

    processInfo.status = 'running';
    this.emit('process:resumed', { processId });
    return true;
  }

  async stopProcess(processId: string): Promise<boolean> {
    const processInfo = this.processes.get(processId);
    const abortController = this.processHandlers.get(processId);

    if (!processInfo) {
      return false;
    }

    if (abortController) {
      abortController.abort();
    }

    processInfo.status = 'completed';
    this.emit('process:stopped', { processId });
    return true;
  }

  getProcessInfo(processId: string): ProcessInfo | null {
    return this.processes.get(processId) || null;
  }

  getActiveProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values())
      .filter(p => p.status === 'running' || p.status === 'paused');
  }

  // Utility methods
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  getProcessStatistics(): {
    total: number;
    running: number;
    paused: number;
    completed: number;
    failed: number;
  } {
    const processes = this.getAllProcesses();
    
    return {
      total: processes.length,
      running: processes.filter(p => p.status === 'running').length,
      paused: processes.filter(p => p.status === 'paused').length,
      completed: processes.filter(p => p.status === 'completed').length,
      failed: processes.filter(p => p.status === 'failed').length
    };
  }

  private async executeProcessWithTimeout(
    processId: string, 
    handler: () => Promise<any>, 
    abortController: AbortController
  ): Promise<void> {
    const processInfo = this.processes.get(processId);
    if (!processInfo) return;

    try {
      // Set up timeout
      const timeout = setTimeout(() => {
        abortController.abort();
      }, this.config.processTimeout);

      // Execute handler
      const result = await handler();
      
      clearTimeout(timeout);
      
      if (!abortController.signal.aborted) {
        processInfo.status = 'completed';
        processInfo.progress = 100;
        this.emit('process:completed', { processId, result });
      }

    } catch (error) {
      processInfo.status = 'failed';
      this.emit('process:failed', { processId, error });
    } finally {
      // Cleanup will be handled by monitoring
    }
  }

  private startMonitoring(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const processesToRemove: string[] = [];

    for (const [processId, processInfo] of this.processes) {
      // Remove completed/failed processes older than 5 minutes
      if ((processInfo.status === 'completed' || processInfo.status === 'failed') &&
          now - processInfo.startTime > 300000) {
        processesToRemove.push(processId);
      }
    }

    for (const processId of processesToRemove) {
      this.processes.delete(processId);
      this.processHandlers.delete(processId);
    }

    if (processesToRemove.length > 0) {
      this.emit('processes:cleaned', { removed: processesToRemove.length });
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop all active processes
    for (const [processId] of this.processes) {
      this.stopProcess(processId);
    }

    this.processes.clear();
    this.processHandlers.clear();
  }
}

export const activeProcessManager = new ActiveProcessManager();

// Export type alias for backward compatibility
export type ActiveProcess = ProcessInfo;