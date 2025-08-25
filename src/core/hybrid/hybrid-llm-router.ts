/**
 * Hybrid LLM Router - Routes tasks between LM Studio (fast) and Ollama (quality)
 * Implements the core hybrid architecture described in Docs/Hybrid-LLM-Architecture.md
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface TaskComplexityMetrics {
  linesOfCode?: number;
  fileCount?: number;
  hasMultipleFiles?: boolean;
  requiresDeepAnalysis?: boolean;
  isTemplateGeneration?: boolean;
  hasSecurityImplications?: boolean;
  estimatedProcessingTime?: number;
}

export interface RoutingDecision {
  selectedLLM: 'lm-studio' | 'ollama' | 'hybrid';
  confidence: number;
  reasoning: string;
  fallbackStrategy: string;
  estimatedResponseTime: number;
  escalationThreshold?: number;
}

export interface HybridConfig {
  lmStudio: {
    endpoint: string;
    enabled: boolean;
    models: string[];
    maxConcurrent: number;
    strengths: string[];
  };
  ollama: {
    endpoint: string;
    enabled: boolean;
    models: string[];
    maxConcurrent: number;
    strengths: string[];
  };
  routing: {
    defaultProvider: 'auto' | 'lm-studio' | 'ollama';
    escalationThreshold: number;
    confidenceScoring: boolean;
    learningEnabled: boolean;
  };
}

export class HybridLLMRouter extends EventEmitter {
  private config: HybridConfig;
  private taskHistory: Map<string, RoutingDecision & { actualPerformance: any }> = new Map();
  private currentLoads: { lmStudio: number; ollama: number } = { lmStudio: 0, ollama: 0 };

  // PERFORMANCE OPTIMIZATIONS: Caching and metrics
  private routingDecisionCache: Map<string, { decision: RoutingDecision; timestamp: number }> =
    new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  constructor(config: HybridConfig) {
    super();
    this.config = config;
    this.setMaxListeners(20); // Prevent memory leak warnings
  }

  /**
   * Determine which LLM should handle a task based on complexity and current load
   * PERFORMANCE OPTIMIZED: Includes caching and intelligent fallback
   */
  async routeTask(
    taskType: string,
    prompt: string,
    metrics?: TaskComplexityMetrics
  ): Promise<RoutingDecision> {
    try {
      // PERFORMANCE FIX: Check cache first
      const cacheKey = this.generateCacheKey(taskType, prompt, metrics);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug('Using cached routing decision');
        return cached;
      }

      const complexity = this.analyzeTaskComplexity(taskType, prompt, metrics);
      const decision = this.makeRoutingDecision(taskType, complexity);

      // Learn from historical performance if enabled
      if (this.config.routing.learningEnabled) {
        this.adjustDecisionBasedOnHistory(decision, taskType);
      }

      // Check current system load and adjust if necessary
      const loadAdjustedDecision = this.adjustForCurrentLoad(decision);

      // PERFORMANCE FIX: Cache the decision
      this.cacheDecision(cacheKey, loadAdjustedDecision);

      // Emit routing event for monitoring
      this.emit('routing-decision', {
        taskType,
        decision: loadAdjustedDecision,
        complexity,
        timestamp: Date.now(),
      });

      return loadAdjustedDecision;
    } catch (error) {
      logger.error('Error in task routing:', error);
      return this.getFailsafeDecision();
    }
  }

  /**
   * Analyze task complexity to inform routing decisions
   */
  private analyzeTaskComplexity(
    taskType: string,
    prompt: string,
    metrics?: TaskComplexityMetrics
  ): number {
    let complexityScore = 0;

    // Base complexity by task type
    const taskTypeComplexity: Record<string, number> = {
      template: 0.2, // LM Studio territory
      format: 0.1, // LM Studio territory
      edit: 0.3, // Could go either way
      boilerplate: 0.2, // LM Studio territory
      analysis: 0.8, // Ollama territory
      security: 0.9, // Ollama territory
      architecture: 0.9, // Ollama territory
      'multi-file': 0.7, // Ollama territory
      debugging: 0.6, // Moderate complexity
      documentation: 0.4, // Moderate complexity
    };

    complexityScore += taskTypeComplexity[taskType] || 0.5;

    // Analyze prompt characteristics
    if (prompt.length > 1000) complexityScore += 0.2;
    if (prompt.includes('analyze') || prompt.includes('review')) complexityScore += 0.3;
    if (prompt.includes('secure') || prompt.includes('vulnerability')) complexityScore += 0.4;
    if (prompt.includes('architecture') || prompt.includes('design')) complexityScore += 0.3;
    if (prompt.includes('multiple') || prompt.includes('several')) complexityScore += 0.2;

    // Apply metrics if provided
    if (metrics) {
      if (metrics.hasMultipleFiles) complexityScore += 0.3;
      if (metrics.requiresDeepAnalysis) complexityScore += 0.4;
      if (metrics.hasSecurityImplications) complexityScore += 0.3;
      if (metrics.fileCount && metrics.fileCount > 5) complexityScore += 0.2;
      if (metrics.linesOfCode && metrics.linesOfCode > 500) complexityScore += 0.2;
    }

    return Math.min(complexityScore, 1.0);
  }

  /**
   * Make routing decision based on complexity analysis
   */
  private makeRoutingDecision(taskType: string, complexity: number): RoutingDecision {
    const { routing } = this.config;

    // Force specific provider if configured
    if (routing.defaultProvider !== 'auto') {
      return {
        selectedLLM: routing.defaultProvider as 'lm-studio' | 'ollama',
        confidence: 0.9,
        reasoning: `Forced to ${routing.defaultProvider} by configuration`,
        fallbackStrategy: routing.defaultProvider === 'lm-studio' ? 'ollama' : 'lm-studio',
        estimatedResponseTime: this.estimateResponseTime(
          routing.defaultProvider as any,
          complexity
        ),
      };
    }

    // Hybrid routing logic
    if (complexity < 0.3) {
      // Simple tasks → LM Studio
      return {
        selectedLLM: 'lm-studio',
        confidence: 0.9,
        reasoning: 'Low complexity task suited for fast generation',
        fallbackStrategy: 'ollama',
        estimatedResponseTime: this.estimateResponseTime('lm-studio', complexity),
        escalationThreshold: routing.escalationThreshold,
      };
    } else if (complexity > 0.7) {
      // Complex tasks → Ollama
      return {
        selectedLLM: 'ollama',
        confidence: 0.9,
        reasoning: 'High complexity task requiring deep reasoning',
        fallbackStrategy: 'lm-studio',
        estimatedResponseTime: this.estimateResponseTime('ollama', complexity),
      };
    } else {
      // Medium complexity → Start with LM Studio, escalate if needed
      return {
        selectedLLM: 'hybrid',
        confidence: 0.7,
        reasoning: 'Medium complexity task - start fast, escalate if needed',
        fallbackStrategy: 'ollama',
        estimatedResponseTime: this.estimateResponseTime('lm-studio', complexity),
        escalationThreshold: routing.escalationThreshold,
      };
    }
  }

  /**
   * Adjust decision based on historical performance
   */
  private adjustDecisionBasedOnHistory(decision: RoutingDecision, taskType: string): void {
    const historicalPerformance = this.getHistoricalPerformance(taskType, decision.selectedLLM);

    if (historicalPerformance.successRate < 0.7 && decision.confidence > 0.5) {
      // Lower confidence if historically poor performance
      decision.confidence *= 0.8;
      decision.reasoning += ' (adjusted for historical performance)';
    }

    if (historicalPerformance.avgResponseTime > decision.estimatedResponseTime * 2) {
      // Adjust time estimate based on history
      decision.estimatedResponseTime = Math.min(
        decision.estimatedResponseTime * 1.5,
        historicalPerformance.avgResponseTime * 1.1
      );
    }
  }

  /**
   * Adjust routing based on current system load
   */
  private adjustForCurrentLoad(decision: RoutingDecision): RoutingDecision {
    const { lmStudio, ollama } = this.currentLoads;
    const maxLmStudio = this.config.lmStudio.maxConcurrent;
    const maxOllama = this.config.ollama.maxConcurrent;

    // Check if preferred LLM is overloaded
    if (decision.selectedLLM === 'lm-studio' && lmStudio >= maxLmStudio) {
      if (ollama < maxOllama) {
        return {
          ...decision,
          selectedLLM: 'ollama',
          reasoning: `${decision.reasoning  } (LM Studio overloaded, using Ollama)`,
          confidence: Math.max(decision.confidence - 0.2, 0.3),
        };
      }
    } else if (decision.selectedLLM === 'ollama' && ollama >= maxOllama) {
      if (lmStudio < maxLmStudio) {
        return {
          ...decision,
          selectedLLM: 'lm-studio',
          reasoning: `${decision.reasoning  } (Ollama overloaded, using LM Studio)`,
          confidence: Math.max(decision.confidence - 0.2, 0.3),
        };
      }
    }

    return decision;
  }

  /**
   * Estimate response time based on LLM and complexity
   */
  private estimateResponseTime(llm: 'lm-studio' | 'ollama', complexity: number): number {
    const baseTimes = {
      'lm-studio': 1000, // 1 second base
      ollama: 15000, // 15 seconds base
    };

    const complexityMultiplier = 1 + complexity * 2; // 1x to 3x based on complexity
    return baseTimes[llm] * complexityMultiplier;
  }

  /**
   * Get historical performance for a task type and LLM
   */
  private getHistoricalPerformance(
    taskType: string,
    llm: string
  ): {
    successRate: number;
    avgResponseTime: number;
    sampleSize: number;
  } {
    const relevantHistory = Array.from(this.taskHistory.values()).filter(
      h => h.selectedLLM === llm && h.actualPerformance?.taskType === taskType
    );

    if (relevantHistory.length === 0) {
      return { successRate: 0.8, avgResponseTime: 5000, sampleSize: 0 }; // Default assumptions
    }

    const successes = relevantHistory.filter(h => h.actualPerformance?.success).length;
    const avgTime =
      relevantHistory.reduce((sum, h) => sum + (h.actualPerformance?.responseTime || 0), 0) /
      relevantHistory.length;

    return {
      successRate: successes / relevantHistory.length,
      avgResponseTime: avgTime,
      sampleSize: relevantHistory.length,
    };
  }

  /**
   * Failsafe decision when routing fails
   */
  private getFailsafeDecision(): RoutingDecision {
    return {
      selectedLLM: 'ollama',
      confidence: 0.5,
      reasoning: 'Failsafe routing due to error',
      fallbackStrategy: 'lm-studio',
      estimatedResponseTime: 20000,
    };
  }

  /**
   * Record task performance for learning
   */
  recordPerformance(
    taskId: string,
    performance: {
      success: boolean;
      responseTime: number;
      qualityScore?: number;
      errorType?: string;
      taskType: string;
    }
  ): void {
    const decision = this.taskHistory.get(taskId);
    if (decision) {
      decision.actualPerformance = performance;
      this.taskHistory.set(taskId, decision);
    }

    // Emit performance event for monitoring
    this.emit('performance-recorded', {
      taskId,
      decision,
      performance,
      timestamp: Date.now(),
    });
  }

  /**
   * Update current load tracking
   */
  updateLoad(llm: 'lm-studio' | 'ollama', delta: number): void {
    if (llm === 'lm-studio') {
      this.currentLoads.lmStudio = Math.max(0, this.currentLoads.lmStudio + delta);
    } else {
      this.currentLoads.ollama = Math.max(0, this.currentLoads.ollama + delta);
    }

    this.emit('load-updated', {
      loads: { ...this.currentLoads },
      timestamp: Date.now(),
    });
  }

  /**
   * Get current system status
   */
  getStatus() {
    return {
      config: this.config,
      currentLoads: { ...this.currentLoads },
      historySize: this.taskHistory.size,
      performance: this.getAggregatePerformance(),
    };
  }

  /**
   * Get aggregate performance metrics
   */
  private getAggregatePerformance() {
    const allHistory = Array.from(this.taskHistory.values());
    const lmStudioHistory = allHistory.filter(h => h.selectedLLM === 'lm-studio');
    const ollamaHistory = allHistory.filter(h => h.selectedLLM === 'ollama');

    return {
      lmStudio: this.calculateAggregateMetrics(lmStudioHistory),
      ollama: this.calculateAggregateMetrics(ollamaHistory),
      total: this.calculateAggregateMetrics(allHistory),
    };
  }

  /**
   * Calculate aggregate metrics for a set of history entries
   */
  private calculateAggregateMetrics(history: any[]) {
    if (history.length === 0) {
      return { successRate: 0, avgResponseTime: 0, sampleSize: 0 };
    }

    const withPerformance = history.filter(h => h.actualPerformance);
    const successes = withPerformance.filter(h => h.actualPerformance.success).length;
    const avgTime =
      withPerformance.reduce((sum, h) => sum + (h.actualPerformance.responseTime || 0), 0) /
      withPerformance.length;

    return {
      successRate: withPerformance.length > 0 ? successes / withPerformance.length : 0,
      avgResponseTime: avgTime || 0,
      sampleSize: withPerformance.length,
    };
  }

  /**
   * Clear performance history (for testing or reset)
   */
  clearHistory(): void {
    this.taskHistory.clear();
    this.emit('history-cleared', { timestamp: Date.now() });
  }

  /**
   * PERFORMANCE FIX: Generate cache key for routing decisions
   */
  private generateCacheKey(
    taskType: string,
    prompt: string,
    metrics?: TaskComplexityMetrics
  ): string {
    const metricHash = metrics ? JSON.stringify(metrics) : '';
    const promptHash = prompt.length > 100 ? `${prompt.substring(0, 100)  }...` : prompt;
    return `${taskType}:${promptHash}:${metricHash}`.replace(/[^a-zA-Z0-9:]/g, '_');
  }

  /**
   * PERFORMANCE FIX: Get cached routing decision
   */
  private getFromCache(key: string): RoutingDecision | null {
    const cached = this.routingDecisionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.decision;
    }
    // Remove expired entry
    if (cached) {
      this.routingDecisionCache.delete(key);
    }
    return null;
  }

  /**
   * PERFORMANCE FIX: Cache routing decision
   */
  private cacheDecision(key: string, decision: RoutingDecision): void {
    // Implement LRU behavior
    if (this.routingDecisionCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.routingDecisionCache.keys().next().value;
      if (firstKey !== undefined) {
        this.routingDecisionCache.delete(firstKey);
      }
    }

    this.routingDecisionCache.set(key, {
      decision,
      timestamp: Date.now(),
    });
  }

  /**
   * PERFORMANCE FIX: Track performance metrics for learning
   */
  trackPerformance(provider: string, responseTime: number, success: boolean): void {
    const key = `${provider}_${success ? 'success' : 'failure'}`;

    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }

    const metrics = this.performanceMetrics.get(key)!;
    metrics.push(responseTime);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }

    logger.debug(`Performance tracked: ${key} - ${responseTime}ms`);
  }

  /**
   * Get performance statistics for a provider
   */
  getPerformanceStats(provider: string): { avgResponseTime: number; successRate: number } {
    const successMetrics = this.performanceMetrics.get(`${provider}_success`) || [];
    const failureMetrics = this.performanceMetrics.get(`${provider}_failure`) || [];

    const totalRequests = successMetrics.length + failureMetrics.length;
    const successRate = totalRequests > 0 ? successMetrics.length / totalRequests : 0;

    const allTimes = [...successMetrics, ...failureMetrics];
    const avgResponseTime =
      allTimes.length > 0 ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length : 0;

    return { avgResponseTime, successRate };
  }

  /**
   * Clear performance cache (for memory management)
   */
  clearCache(): void {
    this.routingDecisionCache.clear();
    this.performanceMetrics.clear();
    logger.info('Hybrid router cache cleared');
  }

  /**
   * Get current cache status
   */
  getCacheStatus(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.routingDecisionCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: 0.0, // TODO: Implement hit rate tracking
    };
  }

  /**
   * Destroy router and cleanup resources
   */
  destroy(): void {
    this.removeAllListeners();
    this.taskHistory.clear();
    this.routingDecisionCache.clear();
    this.performanceMetrics.clear();
    this.currentLoads = { lmStudio: 0, ollama: 0 };
  }
}
