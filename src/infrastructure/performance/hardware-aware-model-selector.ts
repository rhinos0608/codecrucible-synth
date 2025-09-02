/**
 * Hardware-Aware Model Selector
 * Automatically switches models based on hardware capabilities and performance issues
 */

import { Logger } from '../logging/logger.js';
import {
  IntelligentModelDetector,
  ModelInfo,
  OptimalConfiguration,
} from './intelligent-model-detector.js';
import { EventEmitter } from 'events';
import * as os from 'os';
import { resourceManager } from './resource-cleanup-manager.js';

export interface HardwareProfile {
  totalMemoryGB: number;
  availableMemoryGB: number;
  cpuCores: number;
  hasGPU: boolean;
  gpuMemoryGB?: number;
  platform: string;
  arch: string;
}

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  tokensPerSecond: number;
  consecutiveErrors: number;
  lastSuccessTime: number;
}

export interface ModelSwitchEvent {
  reason: 'hardware_constraint' | 'performance_degradation' | 'error_threshold' | 'timeout' | 'oom';
  fromModel: string;
  toModel: string;
  metrics: PerformanceMetrics;
  hardwareProfile: HardwareProfile;
  timestamp: Date;
}

export class HardwareAwareModelSelector extends EventEmitter {
  private logger: Logger;
  private modelDetector: IntelligentModelDetector;
  private hardwareProfile: HardwareProfile;
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private currentModel: string | null = null;
  private fallbackModels: ModelInfo[] = [];
  private switchingInProgress = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private monitoringIntervalId: string | null = null;

  // Performance thresholds for automatic switching
  private readonly thresholds = {
    maxResponseTime: 30000, // 30 seconds
    maxMemoryUsage: 0.85, // 85% of available memory
    maxErrorRate: 0.3, // 30% error rate
    maxConsecutiveErrors: 3,
    minTokensPerSecond: 0.5,
    memoryWarningThreshold: 0.75, // 75% memory usage warning
  };

  constructor() {
    super();
    this.logger = new Logger('HardwareAwareModelSelector');
    this.modelDetector = new IntelligentModelDetector();
    this.hardwareProfile = this.assessHardware();
    this.startPerformanceMonitoring();
  }

  /**
   * Assess current hardware capabilities
   */
  private assessHardware(): HardwareProfile {
    const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
    const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);

    return {
      totalMemoryGB,
      availableMemoryGB: freeMemoryGB,
      cpuCores: os.cpus().length,
      hasGPU: this.detectGPU(),
      gpuMemoryGB: this.estimateGPUMemory(),
      platform: os.platform(),
      arch: os.arch(),
    };
  }

  /**
   * Detect if GPU is available (simplified)
   */
  private detectGPU(): boolean {
    // This is a simplified check - in real implementation,
    // you'd use nvidia-ml-py or similar
    return (
      process.env.CUDA_VISIBLE_DEVICES !== undefined ||
      process.env.HIP_VISIBLE_DEVICES !== undefined
    );
  }

  /**
   * Estimate GPU memory (simplified)
   */
  private estimateGPUMemory(): number | undefined {
    if (!this.detectGPU()) return undefined;

    // Rough estimation based on common GPU configs
    // In real implementation, query actual GPU memory
    return 8; // Default estimate: 8GB
  }

  /**
   * Get optimal model configuration based on hardware
   */
  async getOptimalModelForHardware(): Promise<OptimalConfiguration> {
    await this.modelDetector.scanAvailableModels();
    const availableModels = await this.modelDetector.scanAvailableModels();

    this.logger.info('Selecting models based on hardware profile:', {
      memory: `${this.hardwareProfile.totalMemoryGB.toFixed(1)}GB total, ${this.hardwareProfile.availableMemoryGB.toFixed(1)}GB available`,
      cpu: `${this.hardwareProfile.cpuCores} cores`,
      gpu: this.hardwareProfile.hasGPU ? `${this.hardwareProfile.gpuMemoryGB}GB` : 'none',
    });

    // Filter models based on hardware constraints
    const suitableModels = this.filterModelsByHardware(availableModels);

    if (suitableModels.length === 0) {
      throw new Error('No models compatible with current hardware configuration');
    }

    // Prioritize qwen2.5-coder if available
    const qwenCoder = suitableModels.find(m => m.name.toLowerCase().includes('qwen2.5-coder'));
    let sortedModels = this.sortModelsByHardwareCompatibility(suitableModels);

    if (qwenCoder) {
      // Move qwen2.5-coder to the front if it's available
      sortedModels = [qwenCoder, ...sortedModels.filter(m => m !== qwenCoder)];
    }

    // Create fallback chain - only include models smaller or equal in size to primary
    const primaryModelSize = this.estimateModelMemoryUsage(sortedModels[0]);
    this.fallbackModels = sortedModels
      .slice(1, 5)
      .filter(m => this.estimateModelMemoryUsage(m) <= primaryModelSize)
      .slice(0, 3); // Keep top 3 smaller/equal fallbacks

    const primaryModel = sortedModels[0];
    const secondaryModel = sortedModels[1] || primaryModel;

    return {
      writer: {
        model: primaryModel.name,
        platform: primaryModel.platform,
        reasoning: `Hardware-optimized: ${primaryModel.size} model fits ${this.hardwareProfile.availableMemoryGB.toFixed(1)}GB available memory`,
      },
      auditor: {
        model: secondaryModel.name,
        platform: secondaryModel.platform,
        reasoning: `Secondary model for review tasks`,
      },
      confidence: this.calculateHardwareConfidence(primaryModel),
    };
  }

  /**
   * Filter models that can run on current hardware
   */
  private filterModelsByHardware(models: ModelInfo[]): ModelInfo[] {
    return models.filter(model => {
      const estimatedMemoryGB = this.estimateModelMemoryUsage(model);

      // Adaptive safety margin based on current memory pressure
      const currentMemoryUsage =
        1 - this.hardwareProfile.availableMemoryGB / this.hardwareProfile.totalMemoryGB;
      let safetyMargin = 0.7; // Default 70% safety margin

      if (currentMemoryUsage > 0.8) {
        safetyMargin = 0.5; // More aggressive under high memory pressure
      } else if (currentMemoryUsage > 0.7) {
        safetyMargin = 0.6; // Moderate adjustment
      }

      const memoryFitsWithBuffer =
        estimatedMemoryGB <= this.hardwareProfile.availableMemoryGB * safetyMargin;

      // Additional hardware-specific filters
      const cpuSuitable = this.hardwareProfile.cpuCores >= this.getMinCoresForModel(model);

      this.logger.debug(
        `Model ${model.name}: memory=${estimatedMemoryGB.toFixed(1)}GB, fits=${memoryFitsWithBuffer}, cpu=${cpuSuitable}, margin=${(safetyMargin * 100).toFixed(0)}%`
      );

      return memoryFitsWithBuffer && cpuSuitable;
    });
  }

  /**
   * Sort models by hardware compatibility score
   */
  private sortModelsByHardwareCompatibility(models: ModelInfo[]): ModelInfo[] {
    return models.sort((a, b) => {
      // Give priority to qwen2.5-coder
      const aIsQwenCoder = a.name.toLowerCase().includes('qwen2.5-coder');
      const bIsQwenCoder = b.name.toLowerCase().includes('qwen2.5-coder');

      if (aIsQwenCoder && !bIsQwenCoder) return -1;
      if (!aIsQwenCoder && bIsQwenCoder) return 1;

      const scoreA = this.calculateHardwareCompatibilityScore(a);
      const scoreB = this.calculateHardwareCompatibilityScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate hardware compatibility score
   */
  private calculateHardwareCompatibilityScore(model: ModelInfo): number {
    let score = 0;

    // Memory efficiency
    const memoryUsage = this.estimateModelMemoryUsage(model);
    const memoryEfficiency = 1 - memoryUsage / this.hardwareProfile.availableMemoryGB;
    score += memoryEfficiency * 40; // 40% weight for memory efficiency

    // Performance characteristics
    const speedBonus =
      model.performance.speed === 'fast' ? 30 : model.performance.speed === 'medium' ? 20 : 10;
    score += speedBonus; // 30% weight for speed

    // Quality vs resource trade-off
    const qualityBonus =
      model.performance.quality === 'excellent'
        ? 20
        : model.performance.quality === 'good'
          ? 15
          : 10;
    score += qualityBonus; // 20% weight for quality

    // Hardware-specific bonuses
    if (this.hardwareProfile.hasGPU && model.name.includes('gpu')) {
      score += 10; // GPU acceleration bonus
    }

    return score;
  }

  /**
   * Estimate memory usage for a model
   */
  private estimateModelMemoryUsage(model: ModelInfo): number {
    if (model.sizeBytes) {
      // Rule of thumb: model needs 1.2x its size in RAM for inference
      return (model.sizeBytes / (1024 * 1024 * 1024)) * 1.2;
    }

    // Fallback estimation based on name
    const nameLower = model.name.toLowerCase();
    if (nameLower.includes('72b') || nameLower.includes('70b')) return 40;
    if (nameLower.includes('34b') || nameLower.includes('32b')) return 20;
    if (nameLower.includes('13b') || nameLower.includes('14b')) return 8;
    if (nameLower.includes('7b') || nameLower.includes('8b')) return 4;
    if (nameLower.includes('3b') || nameLower.includes('2b')) return 2;

    return 4; // Default estimate
  }

  /**
   * Get minimum CPU cores required for model
   */
  private getMinCoresForModel(model: ModelInfo): number {
    const memoryGB = this.estimateModelMemoryUsage(model);

    if (memoryGB > 20) return 8; // Large models need more cores
    if (memoryGB > 10) return 4;
    return 2; // Minimum for any model
  }

  /**
   * Estimate memory usage by model name string
   */
  private estimateModelMemoryUsageByName(modelName: string): number {
    const nameLower = modelName.toLowerCase();
    if (nameLower.includes('72b') || nameLower.includes('70b')) return 40;
    if (nameLower.includes('34b') || nameLower.includes('32b') || nameLower.includes('30b'))
      return 20;
    if (nameLower.includes('13b') || nameLower.includes('14b')) return 8;
    if (nameLower.includes('7b') || nameLower.includes('8b')) return 4;
    if (nameLower.includes('3b') || nameLower.includes('2b')) return 2;
    if (nameLower.includes('gemma') && nameLower.includes('2b')) return 2;
    if (nameLower.includes('qwen2.5-coder')) return 4; // Qwen 2.5 Coder 7B
    if (nameLower.includes('llama3.2')) return 2; // Llama 3.2 is small

    return 4; // Default estimate
  }

  /**
   * Calculate confidence in hardware configuration
   */
  private calculateHardwareConfidence(model: ModelInfo): number {
    const memoryUsage = this.estimateModelMemoryUsage(model);
    const memoryUtilization = memoryUsage / this.hardwareProfile.availableMemoryGB;

    let confidence = 1.0;

    // Reduce confidence based on memory pressure
    if (memoryUtilization > 0.8) confidence -= 0.4;
    else if (memoryUtilization > 0.6) confidence -= 0.2;
    else if (memoryUtilization > 0.4) confidence -= 0.1;

    // CPU considerations
    const minCores = this.getMinCoresForModel(model);
    if (this.hardwareProfile.cpuCores < minCores) confidence -= 0.3;

    // GPU bonus
    if (this.hardwareProfile.hasGPU) confidence += 0.1;

    return Math.max(confidence, 0.1);
  }

  /**
   * Record performance metrics for a model
   */
  recordPerformance(modelName: string, metrics: Partial<PerformanceMetrics>): void {
    const existing = this.performanceMetrics.get(modelName) || {
      responseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      errorRate: 0,
      tokensPerSecond: 0,
      consecutiveErrors: 0,
      lastSuccessTime: Date.now(),
    };

    const updated = { ...existing, ...metrics };

    // Update consecutive errors
    if (metrics.errorRate !== undefined) {
      if (metrics.errorRate > 0) {
        updated.consecutiveErrors = existing.consecutiveErrors + 1;
      } else {
        updated.consecutiveErrors = 0;
        updated.lastSuccessTime = Date.now();
      }
    }

    this.performanceMetrics.set(modelName, updated);

    // Check if automatic switching is needed
    this.checkForAutomaticSwitch(modelName, updated);
  }

  /**
   * Check if model should be switched automatically
   */
  private checkForAutomaticSwitch(modelName: string, metrics: PerformanceMetrics): void {
    if (this.switchingInProgress || !this.currentModel || this.currentModel !== modelName) {
      return;
    }

    let switchReason: ModelSwitchEvent['reason'] | null = null;

    // Check various failure conditions
    if (metrics.responseTime > this.thresholds.maxResponseTime) {
      switchReason = 'timeout';
    } else if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      switchReason = 'oom';
    } else if (metrics.errorRate > this.thresholds.maxErrorRate) {
      switchReason = 'error_threshold';
    } else if (metrics.consecutiveErrors >= this.thresholds.maxConsecutiveErrors) {
      switchReason = 'error_threshold';
    } else if (
      metrics.tokensPerSecond < this.thresholds.minTokensPerSecond &&
      metrics.tokensPerSecond > 0
    ) {
      switchReason = 'performance_degradation';
    }

    if (switchReason) {
      this.performAutomaticSwitch(switchReason, metrics);
    }
  }

  /**
   * Perform automatic model switch
   */
  private async performAutomaticSwitch(
    reason: ModelSwitchEvent['reason'],
    metrics: PerformanceMetrics
  ): Promise<void> {
    if (this.switchingInProgress || this.fallbackModels.length === 0) {
      return;
    }

    this.switchingInProgress = true;
    const originalModel = this.currentModel!;

    try {
      this.logger.warn(`Switching model due to ${reason}:`, {
        from: originalModel,
        metrics: {
          responseTime: metrics.responseTime,
          memoryUsage: `${(metrics.memoryUsage * 100).toFixed(1)}%`,
          errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
          consecutiveErrors: metrics.consecutiveErrors,
        },
      });

      // Find next suitable model
      const nextModel = this.selectFallbackModel(reason, metrics);

      if (!nextModel) {
        this.logger.error('No suitable fallback models available');
        return;
      }

      this.currentModel = nextModel.name;

      // Emit switch event
      const switchEvent: ModelSwitchEvent = {
        reason,
        fromModel: originalModel,
        toModel: nextModel.name,
        metrics,
        hardwareProfile: this.hardwareProfile,
        timestamp: new Date(),
      };

      this.emit('modelSwitch', switchEvent);

      this.logger.info(`Successfully switched to ${nextModel.name} (${nextModel.size})`);
    } catch (error) {
      this.logger.error('Failed to switch model:', error);
    } finally {
      this.switchingInProgress = false;
    }
  }

  /**
   * Select appropriate fallback model based on failure reason
   */
  private selectFallbackModel(
    reason: ModelSwitchEvent['reason'],
    metrics: PerformanceMetrics
  ): ModelInfo | null {
    // Check if current model is already small/efficient
    if (this.currentModel) {
      const currentModelSize = this.estimateModelMemoryUsageByName(this.currentModel);

      // If we're already using a small model (<=4GB) and facing memory issues, don't switch to larger
      if ((reason === 'oom' || reason === 'hardware_constraint') && currentModelSize <= 4) {
        this.logger.info(
          `Keeping current efficient model ${this.currentModel} (${currentModelSize}GB) despite memory pressure`
        );
        return null; // Don't switch if already using efficient model
      }
    }

    const sortedFallbacks = [...this.fallbackModels];

    // Sort fallbacks based on failure reason
    if (reason === 'oom' || reason === 'hardware_constraint') {
      // Prioritize smaller models for memory issues
      sortedFallbacks.sort((a, b) => {
        const sizeA = this.estimateModelMemoryUsage(a);
        const sizeB = this.estimateModelMemoryUsage(b);
        return sizeA - sizeB;
      });
    } else if (reason === 'timeout' || reason === 'performance_degradation') {
      // Prioritize faster models for performance issues
      sortedFallbacks.sort((a, b) => {
        const speedOrder = { fast: 3, medium: 2, slow: 1 };
        return speedOrder[b.performance.speed] - speedOrder[a.performance.speed];
      });
    }

    // Find first fallback that hasn't been problematic
    for (const model of sortedFallbacks) {
      const modelMetrics = this.performanceMetrics.get(model.name);

      if (
        !modelMetrics ||
        (modelMetrics.consecutiveErrors < this.thresholds.maxConsecutiveErrors &&
          modelMetrics.errorRate < this.thresholds.maxErrorRate)
      ) {
        return model;
      }
    }

    // If all models have issues, return the smallest one
    return sortedFallbacks[0] || null;
  }

  /**
   * Set current model and initialize monitoring
   */
  setCurrentModel(modelName: string): void {
    this.currentModel = modelName;
    this.logger.info(`Now monitoring model: ${modelName}`);
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      try {
        this.updateHardwareProfile();
      } catch (error) {
        console.error('Hardware monitoring error:', error);
      }
    }, 30000); // Update every 30 seconds

    // Prevent the interval from keeping the process alive
    if (this.monitoringInterval.unref) {
      this.monitoringInterval.unref();
    }

    this.monitoringIntervalId = resourceManager.registerInterval(
      this.monitoringInterval,
      'HardwareAwareModelSelector',
      'hardware monitoring'
    );
  }

  /**
   * Update hardware profile (memory availability changes)
   */
  private updateHardwareProfile(): void {
    const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);
    this.hardwareProfile.availableMemoryGB = freeMemoryGB;

    // Check for memory pressure
    const memoryUsage = 1 - freeMemoryGB / this.hardwareProfile.totalMemoryGB;

    if (memoryUsage > this.thresholds.memoryWarningThreshold && this.currentModel) {
      // DISABLED: High memory usage warnings disabled for normal operation

      const metrics: PerformanceMetrics = {
        responseTime: 0,
        memoryUsage,
        cpuUsage: 0,
        errorRate: 0,
        tokensPerSecond: 0,
        consecutiveErrors: 0,
        lastSuccessTime: Date.now(),
      };

      if (memoryUsage > this.thresholds.maxMemoryUsage) {
        // Don't switch if we're already using an efficient model
        const currentModelSize = this.estimateModelMemoryUsageByName(this.currentModel);
        if (currentModelSize > 4) {
          // Only switch if current model is larger than 4GB
          this.checkForAutomaticSwitch(this.currentModel, metrics);
        } else {
          // DISABLED: Model keeping info disabled for cleaner operation
        }
      }
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): any {
    return {
      hardware: this.hardwareProfile,
      currentModel: this.currentModel,
      fallbackModels: this.fallbackModels.map(m => ({ name: m.name, size: m.size })),
      thresholds: this.thresholds,
      metrics: Object.fromEntries(this.performanceMetrics),
    };
  }

  /**
   * Get optimal fallback model for a specific failure reason
   */
  async getFallbackModel(
    currentModel: string,
    reason: ModelSwitchEvent['reason']
  ): Promise<ModelInfo | null> {
    // Set current model for context
    this.currentModel = currentModel;

    // Create minimal performance metrics
    const metrics: PerformanceMetrics = {
      responseTime: 0,
      memoryUsage: 0.8, // Assume high memory usage since we're in fallback
      cpuUsage: 0.5,
      errorRate: 0,
      tokensPerSecond: 1,
      consecutiveErrors: 1,
      lastSuccessTime: Date.now(),
    };

    // Use the private method to select fallback
    return this.selectFallbackModel(reason, metrics);
  }

  /**
   * Force model switch for testing
   */
  async forceModelSwitch(targetModel?: string): Promise<boolean> {
    if (this.switchingInProgress) return false;

    const metrics: PerformanceMetrics = {
      responseTime: 0,
      memoryUsage: 0.5,
      cpuUsage: 0.5,
      errorRate: 0,
      tokensPerSecond: 1,
      consecutiveErrors: 0,
      lastSuccessTime: Date.now(),
    };

    if (targetModel) {
      const targetModelInfo = this.fallbackModels.find(m => m.name === targetModel);
      if (targetModelInfo) {
        this.currentModel = targetModel;
        this.emit('modelSwitch', {
          reason: 'hardware_constraint',
          fromModel: this.currentModel || 'unknown',
          toModel: targetModel,
          metrics,
          hardwareProfile: this.hardwareProfile,
          timestamp: new Date(),
        });
        return true;
      }
    }

    await this.performAutomaticSwitch('hardware_constraint', metrics);
    return true;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.monitoringIntervalId) {
      resourceManager.cleanup(this.monitoringIntervalId);
      this.monitoringIntervalId = null;
    }
    this.removeAllListeners();
  }
}

export default HardwareAwareModelSelector;
