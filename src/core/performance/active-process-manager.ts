/**
 * Active Process Manager
 * Monitors system resources and actively terminates/switches processes when needed
 */

import { Logger } from '../logger.js';
import { EventEmitter } from 'events';
import { HardwareAwareModelSelector } from './hardware-aware-model-selector.js';
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
  memoryWarning: number;      // 75% - warn but continue
  memoryCritical: number;     // 85% - start terminating low priority
  memoryEmergency: number;    // 95% - terminate all and switch models
  cpuWarning: number;         // 80%
  cpuCritical: number;        // 90%
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
  private activeProcesses: Map<string, ActiveProcess> = new Map();
  private resourceMonitorInterval: NodeJS.Timeout | null = null;
  private thresholds: ResourceThresholds;
  private isTerminating = false;
  private modelSwitchInProgress = false;

  constructor(hardwareSelector: HardwareAwareModelSelector) {
    super();
    this.logger = new Logger('ActiveProcessManager');
    this.hardwareSelector = hardwareSelector;
    
    this.thresholds = {
      memoryWarning: 0.75,    // 75%
      memoryCritical: 0.85,   // 85% 
      memoryEmergency: 0.95,  // 95%
      cpuWarning: 0.80,       // 80%
      cpuCritical: 0.90       // 90%
    };

    this.startResourceMonitoring();
    this.setupModelSelectorEvents();
  }

  /**
   * Register a new active process for monitoring
   */
  registerProcess(process: Omit<ActiveProcess, 'id' | 'startTime' | 'abortController'>): ActiveProcess {
    const id = this.generateProcessId();
    const abortController = new AbortController();
    
    const activeProcess: ActiveProcess = {
      id,
      startTime: new Date(),
      abortController,
      ...process
    };

    this.activeProcesses.set(id, activeProcess);
    
    this.logger.info(`Registered process ${id} (${process.type}) using model ${process.modelName}`, {
      estimatedMemory: `${process.estimatedMemoryUsage.toFixed(1)}MB`,
      priority: process.priority
    });

    // Check if we should immediately terminate due to current resource pressure
    this.checkResourcePressure();

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
   * Start monitoring system resources
   */
  private startResourceMonitoring(): void {
    this.resourceMonitorInterval = setInterval(() => {
      this.checkResourcePressure();
    }, 2000); // Check every 2 seconds for responsive memory management
  }

  /**
   * Check current resource usage and take action if needed
   */
  private checkResourcePressure(): void {
    if (this.isTerminating) return;

    const memoryUsage = this.getCurrentMemoryUsage();
    const cpuUsage = this.getCurrentCpuUsage();

    this.logger.debug(`Resource usage: Memory ${(memoryUsage * 100).toFixed(1)}%, CPU ${(cpuUsage * 100).toFixed(1)}%`);

    // Memory pressure handling
    if (memoryUsage >= this.thresholds.memoryEmergency) {
      this.handleEmergencyMemoryPressure(memoryUsage);
    } else if (memoryUsage >= this.thresholds.memoryCritical) {
      this.handleCriticalMemoryPressure(memoryUsage);
    } else if (memoryUsage >= this.thresholds.memoryWarning) {
      this.handleMemoryWarning(memoryUsage);
    }

    // CPU pressure handling
    if (cpuUsage >= this.thresholds.cpuCritical) {
      this.handleCriticalCpuPressure(cpuUsage);
    }
  }

  /**
   * Handle emergency memory pressure (95%+) - terminate all and switch models
   */
  private async handleEmergencyMemoryPressure(memoryUsage: number): Promise<void> {
    if (this.modelSwitchInProgress) return;
    
    this.logger.error(`🚨 EMERGENCY: Memory usage at ${(memoryUsage * 100).toFixed(1)}% - terminating all processes and switching to smaller model`);
    
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
   * Handle critical memory pressure (85%+) - terminate low priority processes
   */
  private async handleCriticalMemoryPressure(memoryUsage: number): Promise<void> {
    this.logger.warn(`⚠️ CRITICAL: Memory usage at ${(memoryUsage * 100).toFixed(1)}% - terminating low priority processes`);

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
        this.logger.info(`✅ Memory pressure relieved after terminating ${terminatedCount} processes`);
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
    // Only log warning occasionally to avoid spam
    const now = Date.now();
    const lastWarning = this.getLastWarningTime();
    
    if (!lastWarning || (now - lastWarning) > 30000) { // 30 seconds between warnings
      this.logger.warn(`⚠️ Memory usage at ${(memoryUsage * 100).toFixed(1)}% - monitoring for potential action`);
      this.setLastWarningTime(now);
      
      // Emit warning event for external listeners
      this.emit('memoryWarning', {
        usage: memoryUsage,
        threshold: this.thresholds.memoryWarning,
        activeProcesses: this.activeProcesses.size
      });
    }
  }

  /**
   * Handle critical CPU pressure
   */
  private async handleCriticalCpuPressure(cpuUsage: number): Promise<void> {
    this.logger.warn(`⚠️ High CPU usage at ${(cpuUsage * 100).toFixed(1)}% - terminating CPU-intensive processes`);

    // Find and terminate CPU-intensive processes
    const cpuIntensiveProcesses = Array.from(this.activeProcesses.values())
      .filter(p => p.type === 'analysis' || p.type === 'generation')
      .filter(p => p.priority !== 'critical')
      .sort((a, b) => b.estimatedMemoryUsage - a.estimatedMemoryUsage); // Terminate largest first

    let terminatedCount = 0;
    for (const process of cpuIntensiveProcesses.slice(0, 2)) { // Terminate up to 2 processes
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
  private async terminateProcess(processId: string, reason: ProcessTerminationEvent['reason']): Promise<boolean> {
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
          cpu: this.getCurrentCpuUsage()
        },
        timestamp: new Date()
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
    this.hardwareSelector.on('modelSwitch', (event) => {
      this.logger.info(`Model switched from ${event.fromModel} to ${event.toModel} due to ${event.reason}`);
      
      // Update all future processes to use the new model
      this.emit('modelSwitched', {
        fromModel: event.fromModel,
        toModel: event.toModel,
        reason: event.reason,
        timestamp: event.timestamp
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
        streaming: processes.filter(p => p.type === 'streaming').length
      },
      byPriority: {
        critical: processes.filter(p => p.priority === 'critical').length,
        high: processes.filter(p => p.priority === 'high').length,
        medium: processes.filter(p => p.priority === 'medium').length,
        low: processes.filter(p => p.priority === 'low').length
      },
      totalEstimatedMemory: processes.reduce((sum, p) => sum + p.estimatedMemoryUsage, 0),
      oldestProcess: processes.length > 0 ? Math.min(...processes.map(p => p.startTime.getTime())) : null
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
      processes: this.activeProcesses.size
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.logger.info('Destroying ActiveProcessManager');
    
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = null;
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
  private getLastWarningTime(): number { return this.lastWarningTime; }
  private setLastWarningTime(time: number): void { this.lastWarningTime = time; }
}

export default ActiveProcessManager;