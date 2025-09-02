/**
 * Active Process Manager
 * Monitors system resources and actively terminates/switches processes when needed
 */

import { Logger } from '../logging/logger.js';
import { EventEmitter } from 'events';
import { HardwareAwareModelSelector } from './hardware-aware-model-selector.js';
import { UserWarningSystem } from '../monitoring/user-warning-system.js';
import { resourceManager } from './resource-cleanup-manager.js';
import * as os from 'os';

export interface ActiveProcess {
  id: string;
  type: 'model_inference' | 'analysis' | 'generation' | 'streaming';
  modelName: string;
  startTime: Date;
  estimatedMemoryUsage: number;
  abortController: AbortController;
  promise: Promise<any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceThresholds {
  memoryWarning: number; // 75% - warn but continue
  memoryCritical: number; // 85% - start terminating low priority
  memoryEmergency: number; // 95% - terminate all and switch models
  cpuWarning: number; // 80%
  cpuCritical: number; // 90%
}

export interface ProcessTerminationEvent {
  processId: string;
  reason: 'memory_pressure' | 'cpu_pressure' | 'timeout' | 'model_switch';
  resourceUsage: {
    memory: number;
    cpu: number;
  };
  newModel?: string;
  timestamp: Date;
}

export class ActiveProcessManager extends EventEmitter {
  private logger: Logger;
  private hardwareSelector: HardwareAwareModelSelector;
  private userWarningSystem: UserWarningSystem;
  private activeProcesses: Map<string, ActiveProcess> = new Map();
  private resourceMonitorIntervalId: string | null = null;
  private thresholds: ResourceThresholds;
  private isTerminating = false;
  private modelSwitchInProgress = false;
  private lastCriticalWarning = 0;
  private lastEmergencyWarning = 0;

  // Compatibility properties for core interface
  public config: any;
  public processes = new Map<string, any>();
  public processHandlers = new Map<string, AbortController>();

  constructor(hardwareSelector: HardwareAwareModelSelector) {
    super();
    this.logger = new Logger('ActiveProcessManager');
    this.hardwareSelector = hardwareSelector;
    this.userWarningSystem = new UserWarningSystem({
      memoryWarningThreshold: 0.85, // Warn at 85% memory (industry standard)
      repetitiveToolThreshold: 15, // Warn after 15 uses of same tool
      longRunningWarningInterval: 1800000, // 30 minute intervals
    });

    this.thresholds = {
      memoryWarning: 0.99, // 99% - only warn at extreme usage
      memoryCritical: 0.995, // 99.5% - only critical at extreme usage
      memoryEmergency: 0.999, // 99.9% - virtually never trigger (AI-friendly)
      cpuWarning: 0.95, // 95%
      cpuCritical: 0.98, // 98%
    };

    this.startResourceMonitoring();
    this.setupModelSelectorEvents();
  }

  /**
   * Register a new active process for monitoring
   */
  registerProcess(
    process: Omit<ActiveProcess, 'id' | 'startTime' | 'abortController'>
  ): ActiveProcess {
    const id = this.generateProcessId();
    const abortController = new AbortController();

    const activeProcess: ActiveProcess = {
      id,
      startTime: new Date(),
      abortController,
      ...process,
    };

    this.activeProcesses.set(id, activeProcess);

    this.logger.info(
      `Registered process ${id} (${process.type}) using model ${process.modelName}`,
      {
        estimatedMemory: `${process.estimatedMemoryUsage.toFixed(1)}MB`,
        priority: process.priority,
      }
    );

    // DISABLED: Immediate resource pressure check disabled to allow AI requests to start
    // this.checkResourcePressure();

    return activeProcess;
  }

  /**
   * Unregister a completed process
   */
  unregisterProcess(processId: string): void {
    const process = this.activeProcesses.get(processId);
    if (process) {
      this.activeProcesses.delete(processId);
      this.logger.debug(`Unregistered process ${processId}`);
    }
  }

  /**
   * Start a process with automatic resource management
   * Compatible with core ActiveProcessManager interface
   */
  async startProcess(processName: string, handler: () => Promise<any>): Promise<string> {
    const processConfig = {
      type: 'analysis' as const,
      modelName: 'unknown',
      estimatedMemoryUsage: 50 * 1024 * 1024, // 50MB default
      promise: handler(),
      priority: 'medium' as const,
    };

    const { id } = this.registerProcess(processConfig);

    try {
      await processConfig.promise;
    } catch (error) {
      this.logger.warn(`Process ${id} failed:`, error);
    } finally {
      this.unregisterProcess(id);
    }

    return id;
  }

  /**
   * Stop a running process
   * Compatible with core ActiveProcessManager interface
   */
  async stopProcess(processId: string): Promise<boolean> {
    const process = this.activeProcesses.get(processId);
    if (!process) {
      return false;
    }

    try {
      process.abortController.abort();
      this.unregisterProcess(processId);
      this.logger.debug(`Stopped process ${processId}`);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to stop process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Pause process (compatibility method - not fully implemented for infrastructure layer)
   */
  async pauseProcess(processId: string): Promise<boolean> {
    // Infrastructure layer doesn't support pause/resume, but return false to indicate unsupported
    this.logger.warn(
      `Pause operation not supported for process ${processId} in infrastructure layer`
    );
    return false;
  }

  /**
   * Resume process (compatibility method - not fully implemented for infrastructure layer)
   */
  async resumeProcess(processId: string): Promise<boolean> {
    // Infrastructure layer doesn't support pause/resume, but return false to indicate unsupported
    this.logger.warn(
      `Resume operation not supported for process ${processId} in infrastructure layer`
    );
    return false;
  }

  /**
   * Get process information (compatibility method)
   */
  getProcessInfo(processId: string): any | null {
    const process = this.activeProcesses.get(processId);
    if (!process) {
      return null;
    }

    return {
      id: processId,
      name: process.type,
      startTime: process.startTime.getTime(),
      status: 'running',
      progress: 0, // Not tracked in infrastructure layer
      priority: process.priority,
      metadata: {
        modelName: process.modelName,
        estimatedMemoryUsage: process.estimatedMemoryUsage,
      },
    };
  }

  /**
   * Get all active processes (compatibility method)
   */
  getActiveProcesses(): any[] {
    const processes = [];
    for (const [id, process] of this.activeProcesses.entries()) {
      processes.push({
        id,
        name: process.type,
        startTime: process.startTime.getTime(),
        status: 'running',
        progress: 0,
        priority: process.priority,
        metadata: {
          modelName: process.modelName,
          estimatedMemoryUsage: process.estimatedMemoryUsage,
        },
      });
    }
    return processes;
  }

  /**
   * Start monitoring system resources
   */
  private startResourceMonitoring(): void {
    const monitorInterval = setInterval(() => {
      try {
        this.checkResourcePressure();
      } catch (error) {
        console.error('Resource monitoring error:', error);
      }
    }, 60000); // Check every 60 seconds (reduced frequency to allow AI requests to complete)

    // Prevent the interval from keeping the process alive
    if (monitorInterval.unref) {
      monitorInterval.unref();
    }

    // Register with resource cleanup manager for proper cleanup
    this.resourceMonitorIntervalId = resourceManager.registerInterval(
      monitorInterval,
      'ActiveProcessManager',
      'resource monitoring'
    );
  }

  /**
   * Check current resource usage and warn user if needed (NEVER TERMINATE)
   */
  private checkResourcePressure(): void {
    if (this.isTerminating) return;

    const memoryUsage = this.getCurrentMemoryUsage();
    const cpuUsage = this.getCurrentCpuUsage();

    this.logger.debug(
      `Resource usage: Memory ${(memoryUsage * 100).toFixed(1)}%, CPU ${(cpuUsage * 100).toFixed(1)}%`
    );

    // INDUSTRY STANDARD: Only warn users, never terminate processes
    this.userWarningSystem.checkMemoryUsage(memoryUsage);

    // Log for debugging but don't take any termination actions
    if (memoryUsage >= 0.9) {
      this.logger.info(
        `High memory usage: ${(memoryUsage * 100).toFixed(1)}% - continuing normally`
      );
    }

    if (cpuUsage >= 0.9) {
      this.logger.info(`High CPU usage: ${(cpuUsage * 100).toFixed(1)}% - continuing normally`);
    }
  }

  /**
   * Handle emergency memory pressure (95%+) - terminate all and switch models
   */
  private async handleEmergencyMemoryPressure(memoryUsage: number): Promise<void> {
    if (this.modelSwitchInProgress) return;

    // DISABLED: Emergency warnings disabled for normal operation

    this.modelSwitchInProgress = true;
    this.isTerminating = true;

    try {
      // Terminate ALL processes immediately
      const terminatedCount = await this.terminateAllProcesses('memory_pressure');

      this.logger.warn(`Terminated ${terminatedCount} processes due to memory emergency`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.logger.info('Forced garbage collection');
      }

      // Wait a moment for resources to free up
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Switch to a smaller model
      const switched = await this.hardwareSelector.forceModelSwitch();
      if (switched) {
        this.logger.info('✅ Successfully switched to smaller model due to memory pressure');
      }
    } catch (error) {
      this.logger.error('Failed to handle emergency memory pressure:', error);
    } finally {
      this.isTerminating = false;
      this.modelSwitchInProgress = false;
    }
  }

  /**
   * Handle critical memory pressure (90%+) - terminate low priority processes
   */
  private async handleCriticalMemoryPressure(memoryUsage: number): Promise<void> {
    // DISABLED: Critical memory warnings disabled for normal operation
    // Still perform the cleanup but don't log

    // Terminate low and medium priority processes
    const processesToTerminate = Array.from(this.activeProcesses.values())
      .filter(p => p.priority === 'low' || p.priority === 'medium')
      .sort((a, b) => {
        // Sort by priority (low first) then by memory usage (high first) then by age (old first)
        if (a.priority !== b.priority) {
          const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.estimatedMemoryUsage !== b.estimatedMemoryUsage) {
          return b.estimatedMemoryUsage - a.estimatedMemoryUsage;
        }
        return a.startTime.getTime() - b.startTime.getTime();
      });

    let terminatedCount = 0;
    for (const process of processesToTerminate) {
      await this.terminateProcess(process.id, 'memory_pressure');
      terminatedCount++;

      // Check if memory usage has improved enough
      const currentUsage = this.getCurrentMemoryUsage();
      if (currentUsage < this.thresholds.memoryWarning) {
        this.logger.info(
          `✅ Memory pressure relieved after terminating ${terminatedCount} processes`
        );
        break;
      }
    }

    if (terminatedCount > 0) {
      this.logger.warn(`Terminated ${terminatedCount} low/medium priority processes`);
    }
  }

  /**
   * Handle memory warning (75%+) - log warning and prepare for potential action
   */
  private handleMemoryWarning(memoryUsage: number): void {
    // DISABLED: Memory warnings disabled for normal operation
    // Only emit event but don't log
    this.emit('memoryWarning', {
      usage: memoryUsage,
      threshold: this.thresholds.memoryWarning,
      activeProcesses: this.activeProcesses.size,
    });
  }

  /**
   * Handle critical CPU pressure
   */
  private async handleCriticalCpuPressure(cpuUsage: number): Promise<void> {
    this.logger.warn(
      `⚠️ High CPU usage at ${(cpuUsage * 100).toFixed(1)}% - terminating CPU-intensive processes`
    );

    // Find and terminate CPU-intensive processes
    const cpuIntensiveProcesses = Array.from(this.activeProcesses.values())
      .filter(p => p.type === 'analysis' || p.type === 'generation')
      .filter(p => p.priority !== 'critical')
      .sort((a, b) => b.estimatedMemoryUsage - a.estimatedMemoryUsage); // Terminate largest first

    let terminatedCount = 0;
    for (const process of cpuIntensiveProcesses.slice(0, 2)) {
      // Terminate up to 2 processes
      await this.terminateProcess(process.id, 'cpu_pressure');
      terminatedCount++;
    }

    if (terminatedCount > 0) {
      this.logger.warn(`Terminated ${terminatedCount} CPU-intensive processes`);
    }
  }

  /**
   * Terminate a specific process
   */
  private async terminateProcess(
    processId: string,
    reason: ProcessTerminationEvent['reason']
  ): Promise<boolean> {
    const process = this.activeProcesses.get(processId);
    if (!process) return false;

    try {
      this.logger.warn(`Terminating process ${processId} (${process.type}) due to ${reason}`);

      // Signal the process to abort
      process.abortController.abort();

      // Remove from active processes
      this.activeProcesses.delete(processId);

      // Emit termination event
      const event: ProcessTerminationEvent = {
        processId,
        reason,
        resourceUsage: {
          memory: this.getCurrentMemoryUsage(),
          cpu: this.getCurrentCpuUsage(),
        },
        timestamp: new Date(),
      };

      this.emit('processTerminated', event);

      return true;
    } catch (error) {
      this.logger.error(`Failed to terminate process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Terminate all active processes
   */
  private async terminateAllProcesses(reason: ProcessTerminationEvent['reason']): Promise<number> {
    const processIds = Array.from(this.activeProcesses.keys());
    let terminatedCount = 0;

    for (const processId of processIds) {
      const success = await this.terminateProcess(processId, reason);
      if (success) terminatedCount++;
    }

    return terminatedCount;
  }

  /**
   * Get current memory usage as percentage
   */
  private getCurrentMemoryUsage(): number {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return usedMemory / totalMemory;
  }

  /**
   * Get current CPU usage (simplified estimation)
   */
  private getCurrentCpuUsage(): number {
    const loadAvg = os.loadavg()[0]; // 1-minute load average
    const cpuCores = os.cpus().length;
    return Math.min(loadAvg / cpuCores, 1.0); // Cap at 100%
  }

  /**
   * Setup event listeners for model selector
   */
  private setupModelSelectorEvents(): void {
    this.hardwareSelector.on('modelSwitch', event => {
      this.logger.info(
        `Model switched from ${event.fromModel} to ${event.toModel} due to ${event.reason}`
      );

      // Update all future processes to use the new model
      this.emit('modelSwitched', {
        fromModel: event.fromModel,
        toModel: event.toModel,
        reason: event.reason,
        timestamp: event.timestamp,
      });
    });
  }

  /**
   * Get process statistics
   */
  getProcessStats(): any {
    const processes = Array.from(this.activeProcesses.values());
    return {
      activeProcesses: processes.length,
      byType: {
        model_inference: processes.filter(p => p.type === 'model_inference').length,
        analysis: processes.filter(p => p.type === 'analysis').length,
        generation: processes.filter(p => p.type === 'generation').length,
        streaming: processes.filter(p => p.type === 'streaming').length,
      },
      byPriority: {
        critical: processes.filter(p => p.priority === 'critical').length,
        high: processes.filter(p => p.priority === 'high').length,
        medium: processes.filter(p => p.priority === 'medium').length,
        low: processes.filter(p => p.priority === 'low').length,
      },
      totalEstimatedMemory: processes.reduce((sum, p) => sum + p.estimatedMemoryUsage, 0),
      oldestProcess:
        processes.length > 0 ? Math.min(...processes.map(p => p.startTime.getTime())) : null,
    };
  }

  /**
   * Force terminate all processes (for emergency shutdown)
   */
  async emergencyShutdown(): Promise<void> {
    this.logger.error('🚨 EMERGENCY SHUTDOWN - terminating all processes immediately');

    this.isTerminating = true;
    const terminatedCount = await this.terminateAllProcesses('memory_pressure');

    this.logger.error(`Emergency shutdown complete - terminated ${terminatedCount} processes`);
  }

  /**
   * Update resource thresholds
   */
  updateThresholds(newThresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.logger.info('Updated resource thresholds:', this.thresholds);
  }

  /**
   * Get current resource usage
   */
  getCurrentResourceUsage(): { memory: number; cpu: number; processes: number } {
    return {
      memory: this.getCurrentMemoryUsage(),
      cpu: this.getCurrentCpuUsage(),
      processes: this.activeProcesses.size,
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.logger.info('Destroying ActiveProcessManager');

    // Cleanup resource monitoring interval using resource manager
    if (this.resourceMonitorIntervalId) {
      resourceManager.cleanup(this.resourceMonitorIntervalId);
      this.resourceMonitorIntervalId = null;
    }

    // Emergency terminate all processes
    this.terminateAllProcesses('memory_pressure');

    this.removeAllListeners();
    this.logger.info('ActiveProcessManager destroyed');
  }

  // Utility methods
  private generateProcessId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private lastWarningTime: number = 0;
  private getLastWarningTime(): number {
    return this.lastWarningTime;
  }
  private setLastWarningTime(time: number): void {
    this.lastWarningTime = time;
  }
}

export default ActiveProcessManager;
