import { logger } from './logger.js';
import { modelPersistenceManager } from './model-persistence-manager.js';

export interface TimeoutStrategy {
  name: string;
  condition: (context: TimeoutContext) => boolean;
  calculateTimeout: (context: TimeoutContext) => number;
  priority: number;
}

export interface TimeoutContext {
  provider: 'lmstudio' | 'ollama';
  taskType: string;
  complexity: 'simple' | 'medium' | 'complex';
  modelName?: string;
  isModelLoaded: boolean;
  isFirstRequest: boolean;
  systemLoad: number;
  vramAvailable: number;
  recentFailures: number;
  averageResponseTime: number;
  requestSize: number;
}

export interface AdaptiveTimeoutConfig {
  enablePredictiveTimeouts: boolean;
  enableSystemLoadAdjustment: boolean;
  enableFailureAdjustment: boolean;
  baseTimeouts: {
    lmstudio: { min: number; max: number; default: number };
    ollama: { min: number; max: number; default: number };
  };
  modelLoadingTimeouts: {
    lmstudio: { warm: number; cold: number; jit: number };
    ollama: { warm: number; cold: number; loading: number };
  };
}

/**
 * Advanced timeout manager with predictive capabilities, system load awareness,
 * and intelligent timeout escalation strategies
 */
export class AdvancedTimeoutManager {
  private strategies: TimeoutStrategy[] = [];
  private performanceHistory = new Map<string, number[]>();
  private systemMetrics = new Map<string, number>();
  private config: AdaptiveTimeoutConfig;
  private modelLoadingHistory = new Map<string, { loadTime: number; timestamp: number }[]>();

  constructor(config: Partial<AdaptiveTimeoutConfig> = {}) {
    this.config = {
      enablePredictiveTimeouts: config.enablePredictiveTimeouts !== false,
      enableSystemLoadAdjustment: config.enableSystemLoadAdjustment !== false,
      enableFailureAdjustment: config.enableFailureAdjustment !== false,
      baseTimeouts: config.baseTimeouts || {
        lmstudio: { min: 2000, max: 30000, default: 10000 },
        ollama: { min: 10000, max: 180000, default: 45000 }
      },
      modelLoadingTimeouts: config.modelLoadingTimeouts || {
        lmstudio: { warm: 2000, cold: 15000, jit: 45000 },
        ollama: { warm: 5000, cold: 30000, loading: 120000 }
      }
    };

    this.initializeStrategies();
    this.startSystemMonitoring();
    
    logger.info('Advanced timeout manager initialized with predictive capabilities');
  }

  /**
   * Get optimal timeout with advanced prediction
   */
  async getOptimalTimeout(context: TimeoutContext): Promise<{
    timeout: number;
    strategy: string;
    reasoning: string;
    confidence: number;
  }> {
    // Update context with current system state
    const enrichedContext = await this.enrichContext(context);
    
    // Find the best strategy for this context
    const bestStrategy = this.selectBestStrategy(enrichedContext);
    
    // Calculate timeout using the selected strategy
    const timeout = bestStrategy.calculateTimeout(enrichedContext);
    
    // Apply safety bounds
    const safeTimeout = this.applySafetyBounds(timeout, enrichedContext);
    
    // Calculate confidence based on historical data
    const confidence = this.calculateConfidence(enrichedContext, bestStrategy);
    
    const reasoning = this.generateReasoning(enrichedContext, bestStrategy, safeTimeout);
    
    logger.debug(`Timeout calculated: ${safeTimeout}ms using ${bestStrategy.name}`, {
      context: enrichedContext,
      confidence,
      reasoning
    });

    return {
      timeout: safeTimeout,
      strategy: bestStrategy.name,
      reasoning,
      confidence
    };
  }

  /**
   * Initialize timeout strategies
   */
  private initializeStrategies(): void {
    // Model loading strategy
    this.strategies.push({
      name: 'model-loading',
      priority: 10,
      condition: (ctx) => !ctx.isModelLoaded,
      calculateTimeout: (ctx) => {
        const baseTimeout = this.config.modelLoadingTimeouts[ctx.provider];
        
        if (ctx.isFirstRequest) {
          return baseTimeout.cold;
        }
        
        // Check model persistence status
        const isModelPersistent = this.isModelPersistent(ctx.modelName || '', ctx.provider);
        if (isModelPersistent) {
          return baseTimeout.warm;
        }
        
        // Use historical loading times
        const avgLoadTime = this.getAverageModelLoadTime(ctx.modelName || '', ctx.provider);
        if (avgLoadTime > 0) {
          return Math.min(avgLoadTime * 1.5, baseTimeout.cold);
        }
        
        return ctx.provider === 'lmstudio' ? 
          (baseTimeout as any).jit || baseTimeout.cold : 
          (baseTimeout as any).loading || baseTimeout.cold;
      }
    });

    // High system load strategy
    this.strategies.push({
      name: 'system-load-adjustment',
      priority: 8,
      condition: (ctx) => ctx.systemLoad > 0.8,
      calculateTimeout: (ctx) => {
        const baseTimeout = this.config.baseTimeouts[ctx.provider].default;
        const loadMultiplier = Math.min(ctx.systemLoad * 2, 3.0);
        return Math.round(baseTimeout * loadMultiplier);
      }
    });

    // VRAM pressure strategy
    this.strategies.push({
      name: 'vram-pressure',
      priority: 9,
      condition: (ctx) => ctx.provider === 'lmstudio' && ctx.vramAvailable < 2048,
      calculateTimeout: (ctx) => {
        const baseTimeout = this.config.baseTimeouts.lmstudio.default;
        const vramRatio = Math.max(0.1, ctx.vramAvailable / 4096);
        const vramMultiplier = Math.max(2.0, 1 / vramRatio);
        return Math.round(baseTimeout * vramMultiplier);
      }
    });

    // Recent failures strategy
    this.strategies.push({
      name: 'failure-recovery',
      priority: 7,
      condition: (ctx) => ctx.recentFailures > 0,
      calculateTimeout: (ctx) => {
        const baseTimeout = this.config.baseTimeouts[ctx.provider].default;
        const failureMultiplier = 1 + (ctx.recentFailures * 0.5);
        return Math.round(baseTimeout * failureMultiplier);
      }
    });

    // Performance history strategy
    this.strategies.push({
      name: 'performance-history',
      priority: 6,
      condition: (ctx) => ctx.averageResponseTime > 0,
      calculateTimeout: (ctx) => {
        // Use 95th percentile + buffer
        return Math.round(ctx.averageResponseTime * 1.5);
      }
    });

    // Task complexity strategy
    this.strategies.push({
      name: 'complexity-based',
      priority: 5,
      condition: () => true, // Always applicable
      calculateTimeout: (ctx) => {
        const baseTimeout = this.config.baseTimeouts[ctx.provider].default;
        
        const complexityMultipliers = {
          simple: 0.5,
          medium: 1.0,
          complex: 2.0
        };
        
        const taskTypeMultipliers: Record<string, number> = {
          template: 0.3,
          format: 0.4,
          edit: 0.6,
          analysis: 1.5,
          planning: 2.0,
          complex: 2.5
        };
        
        const complexityMult = complexityMultipliers[ctx.complexity] || 1.0;
        const taskTypeMult = taskTypeMultipliers[ctx.taskType] || 1.0;
        
        return Math.round(baseTimeout * complexityMult * taskTypeMult);
      }
    });

    // Request size strategy
    this.strategies.push({
      name: 'request-size',
      priority: 4,
      condition: (ctx) => ctx.requestSize > 1000,
      calculateTimeout: (ctx) => {
        const baseTimeout = this.config.baseTimeouts[ctx.provider].default;
        const sizeMultiplier = Math.min(ctx.requestSize / 1000, 3.0);
        return Math.round(baseTimeout * sizeMultiplier);
      }
    });

    // Provider-specific strategy
    this.strategies.push({
      name: 'provider-specific',
      priority: 3,
      condition: () => true,
      calculateTimeout: (ctx) => {
        if (ctx.provider === 'lmstudio') {
          // LM Studio is typically faster but can have JIT loading delays
          return ctx.isModelLoaded ? 5000 : 30000;
        } else {
          // Ollama is slower but more consistent
          return ctx.isModelLoaded ? 20000 : 90000;
        }
      }
    });

    // Default fallback strategy
    this.strategies.push({
      name: 'default-fallback',
      priority: 1,
      condition: () => true,
      calculateTimeout: (ctx) => this.config.baseTimeouts[ctx.provider].default
    });

    // Sort strategies by priority (highest first)
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Enrich context with current system state
   */
  private async enrichContext(context: TimeoutContext): Promise<TimeoutContext> {
    return {
      ...context,
      systemLoad: this.getCurrentSystemLoad(),
      vramAvailable: await this.getAvailableVRAM(),
      recentFailures: this.getRecentFailures(context.provider),
      averageResponseTime: this.getAverageResponseTime(context.provider, context.taskType),
      isModelLoaded: await this.checkModelLoaded(context.modelName || '', context.provider)
    };
  }

  /**
   * Select the best strategy for the given context
   */
  private selectBestStrategy(context: TimeoutContext): TimeoutStrategy {
    for (const strategy of this.strategies) {
      if (strategy.condition(context)) {
        return strategy;
      }
    }
    
    // Fallback to default strategy
    return this.strategies[this.strategies.length - 1];
  }

  /**
   * Apply safety bounds to prevent extreme timeouts
   */
  private applySafetyBounds(timeout: number, context: TimeoutContext): number {
    const bounds = this.config.baseTimeouts[context.provider];
    return Math.max(bounds.min, Math.min(bounds.max, timeout));
  }

  /**
   * Calculate confidence in the timeout prediction
   */
  private calculateConfidence(context: TimeoutContext, strategy: TimeoutStrategy): number {
    let confidence = 0.5;
    
    // Higher confidence for specific strategies
    if (strategy.name === 'performance-history' && context.averageResponseTime > 0) {
      confidence += 0.3;
    }
    
    if (strategy.name === 'model-loading' && !context.isModelLoaded) {
      confidence += 0.2;
    }
    
    // Adjust based on data availability
    const historyKey = `${context.provider}_${context.taskType}`;
    const history = this.performanceHistory.get(historyKey);
    if (history && history.length > 10) {
      confidence += 0.2;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * Generate human-readable reasoning for the timeout decision
   */
  private generateReasoning(
    context: TimeoutContext, 
    strategy: TimeoutStrategy, 
    timeout: number
  ): string {
    const reasons = [];
    
    if (!context.isModelLoaded) {
      reasons.push(`Model loading required (${strategy.name})`);
    }
    
    if (context.systemLoad > 0.8) {
      reasons.push(`High system load (${(context.systemLoad * 100).toFixed(0)}%)`);
    }
    
    if (context.vramAvailable < 2048) {
      reasons.push(`Low VRAM (${context.vramAvailable}MB available)`);
    }
    
    if (context.recentFailures > 0) {
      reasons.push(`${context.recentFailures} recent failures`);
    }
    
    if (context.complexity === 'complex') {
      reasons.push('Complex task requiring extended processing');
    }
    
    if (reasons.length === 0) {
      reasons.push(`Standard ${context.provider} timeout for ${context.taskType}`);
    }
    
    return `${timeout}ms timeout based on: ${reasons.join(', ')}`;
  }

  /**
   * Check if model is persistent in memory
   */
  private isModelPersistent(modelName: string, provider: string): boolean {
    const modelStatus = modelPersistenceManager.getModelStatus();
    const key = `${provider}:${modelName}`;
    return modelStatus[key]?.loaded || false;
  }

  /**
   * Get average model loading time from history
   */
  private getAverageModelLoadTime(modelName: string, provider: string): number {
    const key = `${provider}:${modelName}`;
    const history = this.modelLoadingHistory.get(key) || [];
    
    if (history.length === 0) return 0;
    
    // Use recent history (last 10 loads)
    const recentHistory = history.slice(-10);
    const total = recentHistory.reduce((sum, record) => sum + record.loadTime, 0);
    return total / recentHistory.length;
  }

  /**
   * Record model loading time for future predictions
   */
  recordModelLoadTime(modelName: string, provider: string, loadTime: number): void {
    const key = `${provider}:${modelName}`;
    const history = this.modelLoadingHistory.get(key) || [];
    
    history.push({ loadTime, timestamp: Date.now() });
    
    // Keep only recent history (last 50 records)
    if (history.length > 50) {
      history.shift();
    }
    
    this.modelLoadingHistory.set(key, history);
    
    logger.debug(`Recorded model load time: ${modelName} (${provider}) - ${loadTime}ms`);
  }

  /**
   * Get current system load (0.0 - 1.0)
   */
  private getCurrentSystemLoad(): number {
    return this.systemMetrics.get('systemLoad') || 0.5;
  }

  /**
   * Get available VRAM in MB
   */
  private async getAvailableVRAM(): Promise<number> {
    return this.systemMetrics.get('vramAvailable') || 4096;
  }

  /**
   * Get number of recent failures for a provider
   */
  private getRecentFailures(provider: string): number {
    return this.systemMetrics.get(`${provider}_failures`) || 0;
  }

  /**
   * Get average response time for provider/task combination
   */
  private getAverageResponseTime(provider: string, taskType: string): number {
    const key = `${provider}_${taskType}`;
    const history = this.performanceHistory.get(key) || [];
    
    if (history.length === 0) return 0;
    
    // Use recent history for more accurate predictions
    const recentHistory = history.slice(-20);
    const total = recentHistory.reduce((sum, time) => sum + time, 0);
    return total / recentHistory.length;
  }

  /**
   * Check if model is currently loaded
   */
  private async checkModelLoaded(modelName: string, provider: string): Promise<boolean> {
    try {
      return await modelPersistenceManager.ensureModelLoaded(provider as 'lmstudio' | 'ollama', modelName);
    } catch {
      return false;
    }
  }

  /**
   * Start system monitoring for adaptive timeouts
   */
  private startSystemMonitoring(): void {
    if (!this.config.enableSystemLoadAdjustment) return;
    
    setInterval(() => {
      this.updateSystemMetrics();
    }, 5000); // Update every 5 seconds
    
    logger.debug('System monitoring started for adaptive timeouts');
  }

  /**
   * Update system metrics for timeout calculations
   */
  private updateSystemMetrics(): void {
    // Simulate system metrics (in production, use actual system monitoring)
    this.systemMetrics.set('systemLoad', Math.random() * 0.7 + 0.2); // 0.2-0.9
    this.systemMetrics.set('vramAvailable', Math.random() * 4096 + 1024); // 1-5GB
    
    // Reset failure counters periodically
    const now = Date.now();
    const lastReset = this.systemMetrics.get('lastFailureReset') || 0;
    if (now - lastReset > 300000) { // Reset every 5 minutes
      this.systemMetrics.set('lmstudio_failures', 0);
      this.systemMetrics.set('ollama_failures', 0);
      this.systemMetrics.set('lastFailureReset', now);
    }
  }

  /**
   * Record performance data for adaptive learning
   */
  recordPerformance(
    provider: string,
    taskType: string,
    responseTime: number,
    success: boolean
  ): void {
    const key = `${provider}_${taskType}`;
    const history = this.performanceHistory.get(key) || [];
    
    if (success) {
      history.push(responseTime);
      
      // Keep reasonable history size
      if (history.length > 100) {
        history.shift();
      }
      
      this.performanceHistory.set(key, history);
    } else {
      // Record failure
      const failureKey = `${provider}_failures`;
      const currentFailures = this.systemMetrics.get(failureKey) || 0;
      this.systemMetrics.set(failureKey, currentFailures + 1);
    }
    
    logger.debug(`Performance recorded: ${provider}/${taskType} - ${responseTime}ms (${success ? 'success' : 'failure'})`);
  }

  /**
   * Get timeout statistics for monitoring
   */
  getTimeoutStatistics(): {
    strategies: { name: string; usage: number }[];
    averageTimeouts: Record<string, number>;
    performanceMetrics: Record<string, { count: number; avgTime: number }>;
  } {
    const strategies = this.strategies.map(s => ({ name: s.name, usage: 0 }));
    
    const averageTimeouts: Record<string, number> = {};
    const performanceMetrics: Record<string, { count: number; avgTime: number }> = {};
    
    for (const [key, history] of this.performanceHistory.entries()) {
      if (history.length > 0) {
        const avgTime = history.reduce((sum, time) => sum + time, 0) / history.length;
        performanceMetrics[key] = {
          count: history.length,
          avgTime: Math.round(avgTime)
        };
      }
    }
    
    return {
      strategies,
      averageTimeouts,
      performanceMetrics
    };
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.performanceHistory.clear();
    this.modelLoadingHistory.clear();
    this.systemMetrics.clear();
    logger.info('Advanced timeout manager history cleared');
  }

  /**
   * Export configuration and history
   */
  exportData(): {
    config: AdaptiveTimeoutConfig;
    performanceHistory: Record<string, number[]>;
    modelLoadingHistory: Record<string, { loadTime: number; timestamp: number }[]>;
    systemMetrics: Record<string, number>;
  } {
    const performanceHistory: Record<string, number[]> = {};
    for (const [key, value] of this.performanceHistory.entries()) {
      performanceHistory[key] = [...value];
    }
    
    const modelLoadingHistory: Record<string, { loadTime: number; timestamp: number }[]> = {};
    for (const [key, value] of this.modelLoadingHistory.entries()) {
      modelLoadingHistory[key] = [...value];
    }
    
    const systemMetrics: Record<string, number> = {};
    for (const [key, value] of this.systemMetrics.entries()) {
      systemMetrics[key] = value;
    }
    
    return {
      config: this.config,
      performanceHistory,
      modelLoadingHistory,
      systemMetrics
    };
  }
}

// Global instance
export const advancedTimeoutManager = new AdvancedTimeoutManager({
  enablePredictiveTimeouts: true,
  enableSystemLoadAdjustment: true,
  enableFailureAdjustment: true,
  baseTimeouts: {
    lmstudio: { min: 1000, max: 45000, default: 8000 },
    ollama: { min: 5000, max: 120000, default: 30000 }
  },
  modelLoadingTimeouts: {
    lmstudio: { warm: 2000, cold: 15000, jit: 30000 },
    ollama: { warm: 8000, cold: 45000, loading: 90000 }
  }
});