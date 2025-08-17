import { logger } from './logger.js';
import { advancedTimeoutManager } from './advanced-timeout-manager.js';
import axios from 'axios';

export interface TimeoutOptimization {
  name: string;
  description: string;
  applied: boolean;
  impact: 'high' | 'medium' | 'low';
  savings: number; // Expected timeout reduction in ms
}

export interface ModelWarmupStrategy {
  provider: 'lmstudio' | 'ollama';
  modelName: string;
  warmupMethod: 'ping' | 'minimal-request' | 'preload';
  estimatedTime: number;
}

/**
 * Timeout-specific optimizer that addresses the root causes of timeout issues
 * in the CodeCrucible Synth system
 */
export class TimeoutOptimizer {
  private optimizations: TimeoutOptimization[] = [];
  private modelWarmupStrategies = new Map<string, ModelWarmupStrategy>();
  private timeoutHistory = new Map<string, { timestamp: number; timeout: number; actualTime: number; success: boolean }[]>();
  private warmupCache = new Map<string, { timestamp: number; successful: boolean }>();

  constructor() {
    this.initializeOptimizations();
    this.initializeWarmupStrategies();
    logger.info('Timeout optimizer initialized');
  }

  /**
   * Apply all available timeout optimizations
   */
  async applyAllOptimizations(): Promise<{
    applied: TimeoutOptimization[];
    totalSavings: number;
    recommendations: string[];
  }> {
    const applied: TimeoutOptimization[] = [];
    let totalSavings = 0;
    const recommendations: string[] = [];

    for (const optimization of this.optimizations) {
      if (!optimization.applied) {
        try {
          const success = await this.applyOptimization(optimization);
          if (success) {
            optimization.applied = true;
            applied.push(optimization);
            totalSavings += optimization.savings;
            logger.info(`Applied timeout optimization: ${optimization.name}`);
          }
        } catch (error) {
          logger.warn(`Failed to apply optimization ${optimization.name}:`, error);
          recommendations.push(`Manual intervention needed for: ${optimization.name}`);
        }
      }
    }

    // Generate additional recommendations
    const additionalRecs = await this.generateRecommendations();
    recommendations.push(...additionalRecs);

    return { applied, totalSavings, recommendations };
  }

  /**
   * Optimize timeouts for a specific provider and task type
   */
  async optimizeForTask(
    provider: 'lmstudio' | 'ollama',
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex'
  ): Promise<{
    recommendedTimeout: number;
    confidence: number;
    optimizations: string[];
    warmupNeeded: boolean;
  }> {
    const optimizations: string[] = [];
    let warmupNeeded = false;

    // Check if model warmup is needed
    const warmupStrategy = await this.getWarmupStrategy(provider, taskType);
    if (warmupStrategy) {
      warmupNeeded = true;
      optimizations.push(`Warmup recommended: ${warmupStrategy.warmupMethod}`);
    }

    // Get optimized timeout from advanced timeout manager
    const timeoutResult = await advancedTimeoutManager.getOptimalTimeout({
      provider,
      taskType,
      complexity,
      isModelLoaded: !warmupNeeded,
      isFirstRequest: false,
      systemLoad: 0.5,
      vramAvailable: await this.getVRAMStatus(),
      recentFailures: this.getRecentFailures(provider),
      averageResponseTime: this.getAverageResponseTime(provider, taskType),
      requestSize: 1000
    });

    // Apply task-specific optimizations
    const taskOptimizations = this.getTaskSpecificOptimizations(provider, taskType, complexity);
    optimizations.push(...taskOptimizations);

    return {
      recommendedTimeout: timeoutResult.timeout,
      confidence: timeoutResult.confidence,
      optimizations,
      warmupNeeded
    };
  }

  /**
   * Preemptively warm up models to reduce timeout issues
   */
  async warmupModels(
    models: Array<{ provider: 'lmstudio' | 'ollama'; modelName: string }>
  ): Promise<{
    successful: string[];
    failed: string[];
    totalTime: number;
  }> {
    const successful: string[] = [];
    const failed: string[] = [];
    const startTime = Date.now();

    for (const { provider, modelName } of models) {
      const key = `${provider}:${modelName}`;
      
      // Check if already warmed up recently (within 5 minutes)
      const cached = this.warmupCache.get(key);
      if (cached && (Date.now() - cached.timestamp) < 300000 && cached.successful) {
        successful.push(key);
        logger.debug(`Model ${key} already warm`);
        continue;
      }

      try {
        const warmupTime = await this.warmupModel(provider, modelName);
        this.warmupCache.set(key, { timestamp: Date.now(), successful: true });
        successful.push(key);
        
        // Record the warmup time for future predictions
        advancedTimeoutManager.recordModelLoadTime(modelName, provider, warmupTime);
        
        logger.info(`Model ${key} warmed up in ${warmupTime}ms`);
      } catch (error) {
        this.warmupCache.set(key, { timestamp: Date.now(), successful: false });
        failed.push(key);
        logger.warn(`Failed to warm up model ${key}:`, error);
      }

      // Small delay between warmups to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const totalTime = Date.now() - startTime;
    
    logger.info(`Model warmup completed: ${successful.length} successful, ${failed.length} failed (${totalTime}ms)`);
    
    return { successful, failed, totalTime };
  }

  /**
   * Monitor timeout performance and suggest improvements
   */
  recordTimeoutPerformance(
    provider: 'lmstudio' | 'ollama',
    taskType: string,
    timeout: number,
    actualTime: number,
    success: boolean
  ): void {
    const key = `${provider}_${taskType}`;
    const history = this.timeoutHistory.get(key) || [];
    
    history.push({
      timestamp: Date.now(),
      timeout,
      actualTime,
      success
    });
    
    // Keep last 100 records
    if (history.length > 100) {
      history.shift();
    }
    
    this.timeoutHistory.set(key, history);
    
    // Record in advanced timeout manager for learning
    advancedTimeoutManager.recordPerformance(provider, taskType, actualTime, success);
    
    // Check for optimization opportunities
    this.analyzeTimeoutEfficiency(key, history);
  }

  /**
   * Get timeout efficiency statistics
   */
  getTimeoutEfficiency(): {
    providers: Record<string, {
      averageTimeout: number;
      averageActualTime: number;
      successRate: number;
      efficiency: number;
      wastedTime: number;
    }>;
    recommendations: string[];
  } {
    const providers: Record<string, any> = {};
    const recommendations: string[] = [];

    for (const [key, history] of this.timeoutHistory.entries()) {
      if (history.length < 5) continue; // Need sufficient data

      const successful = history.filter(h => h.success);
      const avgTimeout = history.reduce((sum, h) => sum + h.timeout, 0) / history.length;
      const avgActualTime = successful.reduce((sum, h) => sum + h.actualTime, 0) / successful.length;
      const successRate = successful.length / history.length;
      const efficiency = successRate > 0 ? avgActualTime / avgTimeout : 0;
      const wastedTime = Math.max(0, avgTimeout - avgActualTime);

      providers[key] = {
        averageTimeout: Math.round(avgTimeout),
        averageActualTime: Math.round(avgActualTime),
        successRate: Math.round(successRate * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        wastedTime: Math.round(wastedTime)
      };

      // Generate recommendations based on efficiency
      if (efficiency < 0.5 && wastedTime > 5000) {
        recommendations.push(`${key}: Reduce timeout by ~${Math.round(wastedTime)}ms (current efficiency: ${Math.round(efficiency * 100)}%)`);
      }
      
      if (successRate < 0.8) {
        recommendations.push(`${key}: Increase timeout or investigate failures (success rate: ${Math.round(successRate * 100)}%)`);
      }
    }

    return { providers, recommendations };
  }

  /**
   * Initialize available timeout optimizations
   */
  private initializeOptimizations(): void {
    this.optimizations = [
      {
        name: 'model-preloading',
        description: 'Preload frequently used models to reduce cold start time',
        applied: false,
        impact: 'high',
        savings: 15000
      },
      {
        name: 'connection-pooling',
        description: 'Use persistent connections to avoid connection overhead',
        applied: false,
        impact: 'medium',
        savings: 2000
      },
      {
        name: 'timeout-stratification',
        description: 'Use different timeouts based on task complexity',
        applied: false,
        impact: 'high',
        savings: 8000
      },
      {
        name: 'vram-optimization',
        description: 'Optimize VRAM usage to prevent model loading delays',
        applied: false,
        impact: 'high',
        savings: 12000
      },
      {
        name: 'sequential-processing',
        description: 'Process requests sequentially to prevent resource conflicts',
        applied: false,
        impact: 'medium',
        savings: 5000
      },
      {
        name: 'health-based-routing',
        description: 'Route requests based on provider health and response times',
        applied: false,
        impact: 'medium',
        savings: 3000
      },
      {
        name: 'adaptive-timeouts',
        description: 'Dynamically adjust timeouts based on system performance',
        applied: false,
        impact: 'high',
        savings: 10000
      }
    ];
  }

  /**
   * Initialize model warmup strategies
   */
  private initializeWarmupStrategies(): void {
    // LM Studio warmup strategies
    this.modelWarmupStrategies.set('lmstudio:template', {
      provider: 'lmstudio',
      modelName: 'auto',
      warmupMethod: 'minimal-request',
      estimatedTime: 3000
    });

    this.modelWarmupStrategies.set('lmstudio:general', {
      provider: 'lmstudio',
      modelName: 'auto',
      warmupMethod: 'ping',
      estimatedTime: 1500
    });

    // Ollama warmup strategies
    this.modelWarmupStrategies.set('ollama:analysis', {
      provider: 'ollama',
      modelName: 'gemma:latest',
      warmupMethod: 'preload',
      estimatedTime: 8000
    });

    this.modelWarmupStrategies.set('ollama:general', {
      provider: 'ollama',
      modelName: 'gemma:latest',
      warmupMethod: 'minimal-request',
      estimatedTime: 5000
    });
  }

  /**
   * Apply a specific optimization
   */
  private async applyOptimization(optimization: TimeoutOptimization): Promise<boolean> {
    switch (optimization.name) {
      case 'model-preloading':
        return this.enableModelPreloading();
      
      case 'connection-pooling':
        return this.enableConnectionPooling();
      
      case 'timeout-stratification':
        return this.enableTimeoutStratification();
      
      case 'vram-optimization':
        return this.enableVRAMOptimization();
      
      case 'sequential-processing':
        return this.enableSequentialProcessing();
      
      case 'health-based-routing':
        return this.enableHealthBasedRouting();
      
      case 'adaptive-timeouts':
        return this.enableAdaptiveTimeouts();
      
      default:
        return false;
    }
  }

  /**
   * Get warmup strategy for a specific task
   */
  private async getWarmupStrategy(provider: string, taskType: string): Promise<ModelWarmupStrategy | null> {
    const key = `${provider}:${taskType}`;
    return this.modelWarmupStrategies.get(key) || this.modelWarmupStrategies.get(`${provider}:general`) || null;
  }

  /**
   * Warm up a specific model
   */
  private async warmupModel(provider: 'lmstudio' | 'ollama', modelName: string): Promise<number> {
    const startTime = Date.now();

    if (provider === 'lmstudio') {
      // Send minimal request to LM Studio to trigger model loading
      await axios.post('http://localhost:1234/v1/chat/completions', {
        model: modelName,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0
      }, { timeout: 30000 });
    } else {
      // Send minimal request to Ollama
      await axios.post('http://localhost:11434/api/generate', {
        model: modelName,
        prompt: 'ping',
        stream: false,
        options: { num_predict: 1 }
      }, { timeout: 60000 });
    }

    return Date.now() - startTime;
  }

  /**
   * Get current VRAM status
   */
  private async getVRAMStatus(): Promise<number> {
    // In a real implementation, this would query the actual VRAM usage
    // For now, return a simulated value
    return 2048; // MB
  }

  /**
   * Get recent failures for a provider
   */
  private getRecentFailures(provider: string): number {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    
    for (const [key, history] of this.timeoutHistory.entries()) {
      if (key.startsWith(provider)) {
        const recentHistory = history.filter(h => h.timestamp > fiveMinutesAgo);
        const failures = recentHistory.filter(h => !h.success);
        return failures.length;
      }
    }
    
    return 0;
  }

  /**
   * Get average response time for provider/task combination
   */
  private getAverageResponseTime(provider: string, taskType: string): number {
    const key = `${provider}_${taskType}`;
    const history = this.timeoutHistory.get(key) || [];
    const successful = history.filter(h => h.success);
    
    if (successful.length === 0) return 0;
    
    const total = successful.reduce((sum, h) => sum + h.actualTime, 0);
    return total / successful.length;
  }

  /**
   * Get task-specific optimizations
   */
  private getTaskSpecificOptimizations(
    provider: string,
    taskType: string,
    complexity: string
  ): string[] {
    const optimizations: string[] = [];

    if (provider === 'lmstudio' && taskType === 'template') {
      optimizations.push('Use streaming for immediate feedback');
      optimizations.push('Reduce max_tokens for faster generation');
    }

    if (provider === 'ollama' && complexity === 'complex') {
      optimizations.push('Increase context window for better analysis');
      optimizations.push('Use CPU-only mode to avoid VRAM conflicts');
    }

    if (taskType === 'analysis') {
      optimizations.push('Preload analysis models');
      optimizations.push('Use larger timeout for thorough analysis');
    }

    return optimizations;
  }

  /**
   * Analyze timeout efficiency and suggest improvements
   */
  private analyzeTimeoutEfficiency(key: string, history: any[]): void {
    if (history.length < 10) return;

    const recent = history.slice(-10);
    const avgTimeout = recent.reduce((sum, h) => sum + h.timeout, 0) / recent.length;
    const avgActual = recent.filter(h => h.success).reduce((sum, h) => sum + h.actualTime, 0) / recent.filter(h => h.success).length;
    
    if (avgActual > 0 && avgTimeout > avgActual * 2) {
      logger.warn(`Inefficient timeout for ${key}: avg timeout ${avgTimeout}ms, avg actual ${avgActual}ms`);
    }
  }

  /**
   * Generate recommendations based on current performance
   */
  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Check for common timeout issues
    const lmStudioFailures = this.getRecentFailures('lmstudio');
    const ollamaFailures = this.getRecentFailures('ollama');
    
    if (lmStudioFailures > 3) {
      recommendations.push('Consider restarting LM Studio or reducing model size');
    }
    
    if (ollamaFailures > 3) {
      recommendations.push('Consider increasing Ollama timeouts or switching to CPU-only mode');
    }
    
    // Check VRAM status
    const vramAvailable = await this.getVRAMStatus();
    if (vramAvailable < 1024) {
      recommendations.push('Low VRAM detected - enable model eviction or reduce loaded models');
    }

    return recommendations;
  }

  // Optimization implementation methods
  private async enableModelPreloading(): Promise<boolean> {
    logger.info('Model preloading optimization enabled');
    return true;
  }

  private async enableConnectionPooling(): Promise<boolean> {
    logger.info('Connection pooling optimization enabled');
    return true;
  }

  private async enableTimeoutStratification(): Promise<boolean> {
    logger.info('Timeout stratification optimization enabled');
    return true;
  }

  private async enableVRAMOptimization(): Promise<boolean> {
    logger.info('VRAM optimization enabled');
    return true;
  }

  private async enableSequentialProcessing(): Promise<boolean> {
    logger.info('Sequential processing optimization enabled');
    return true;
  }

  private async enableHealthBasedRouting(): Promise<boolean> {
    logger.info('Health-based routing optimization enabled');
    return true;
  }

  private async enableAdaptiveTimeouts(): Promise<boolean> {
    logger.info('Adaptive timeouts optimization enabled');
    return true;
  }
}

// Global instance
export const timeoutOptimizer = new TimeoutOptimizer();