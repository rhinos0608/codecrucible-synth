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
  
  // Hit rate tracking for cache performance analysis
  private cacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
  };

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
   * Enhanced task complexity analysis with sophisticated pattern recognition
   */
  private analyzeTaskComplexity(
    taskType: string,
    prompt: string,
    metrics?: TaskComplexityMetrics
  ): number {
    let complexityScore = 0;

    // Enhanced base complexity by task type with more granular scoring
    const taskTypeComplexity: Record<string, number> = {
      template: 0.15, // Simple template generation
      format: 0.1,   // Basic formatting tasks
      edit: 0.25,     // Simple edits
      boilerplate: 0.2, // Standard boilerplate
      analysis: 0.75,   // Code analysis
      security: 0.9,    // Security analysis
      architecture: 0.85, // System design
      'multi-file': 0.7,  // Cross-file operations
      debugging: 0.65,    // Bug investigation
      documentation: 0.35, // Documentation tasks
      refactoring: 0.7,   // Code restructuring
      optimization: 0.8,  // Performance tuning
      testing: 0.6,      // Test creation
      integration: 0.75,  // System integration
      migration: 0.8,    // Data/code migration
    };

    complexityScore += taskTypeComplexity[taskType] || 0.5;

    // Enhanced prompt pattern analysis with weighted scoring
    const promptPatterns = this.analyzePromptPatterns(prompt);
    complexityScore += promptPatterns.complexityBoost;

    // Apply enhanced metrics analysis
    if (metrics) {
      complexityScore += this.analyzeTaskMetrics(metrics);
    }

    // Context-aware adjustments based on historical patterns
    complexityScore = this.applyContextualAdjustments(complexityScore, taskType, prompt);

    return Math.min(Math.max(complexityScore, 0.05), 1.0); // Clamp between 0.05 and 1.0
  }

  /**
   * Analyze prompt patterns for complexity indicators
   */
  private analyzePromptPatterns(prompt: string): { complexityBoost: number; patterns: string[] } {
    let complexityBoost = 0;
    const foundPatterns: string[] = [];

    // High complexity patterns (significant cognitive load)
    const highComplexityPatterns = [
      { pattern: /\b(analyze|review|evaluate|assess|investigate)\b/gi, weight: 0.3, name: 'deep-analysis' },
      { pattern: /\b(secure|security|vulnerability|exploit|attack)\b/gi, weight: 0.35, name: 'security' },
      { pattern: /\b(architecture|design|structure|framework|pattern)\b/gi, weight: 0.3, name: 'architectural' },
      { pattern: /\b(optimize|performance|efficiency|scalable?|benchmark)\b/gi, weight: 0.25, name: 'optimization' },
      { pattern: /\b(complex|complicated|intricate|sophisticated)\b/gi, weight: 0.2, name: 'complexity-indicator' },
      { pattern: /\b(algorithm|data structure|computational)\b/gi, weight: 0.3, name: 'algorithmic' },
    ];

    // Medium complexity patterns
    const mediumComplexityPatterns = [
      { pattern: /\b(multiple|several|various|different)\b/gi, weight: 0.15, name: 'multi-entity' },
      { pattern: /\b(integrate|combine|merge|connect)\b/gi, weight: 0.2, name: 'integration' },
      { pattern: /\b(refactor|restructure|reorganize)\b/gi, weight: 0.25, name: 'refactoring' },
      { pattern: /\b(test|testing|validation|verification)\b/gi, weight: 0.15, name: 'testing' },
      { pattern: /\b(debug|troubleshoot|diagnose|fix)\b/gi, weight: 0.2, name: 'debugging' },
    ];

    // Low complexity reducers (simple tasks)
    const lowComplexityPatterns = [
      { pattern: /\b(simple|basic|quick|easy)\b/gi, weight: -0.1, name: 'simplicity' },
      { pattern: /\b(format|formatting|style|prettify)\b/gi, weight: -0.05, name: 'formatting' },
      { pattern: /\b(template|boilerplate|skeleton)\b/gi, weight: -0.1, name: 'template' },
    ];

    // Apply all pattern checks
    [...highComplexityPatterns, ...mediumComplexityPatterns, ...lowComplexityPatterns].forEach(({ pattern, weight, name }) => {
      const matches = prompt.match(pattern);
      if (matches) {
        complexityBoost += weight * Math.min(matches.length / 10, 1); // Diminishing returns
        foundPatterns.push(`${name}(${matches.length})`);
      }
    });

    // Length-based complexity (more sophisticated than simple threshold)
    if (prompt.length > 500) {
      const lengthMultiplier = Math.min((prompt.length - 500) / 2000, 0.3); // Max 0.3 boost
      complexityBoost += lengthMultiplier;
      foundPatterns.push(`length-boost(${lengthMultiplier.toFixed(2)})`);
    }

    // Technical depth indicators
    const technicalTerms = prompt.match(/\b(database|API|protocol|algorithm|encryption|authentication|authorization)\b/gi);
    if (technicalTerms) {
      complexityBoost += Math.min(technicalTerms.length * 0.1, 0.25);
      foundPatterns.push(`technical-depth(${technicalTerms.length})`);
    }

    return { complexityBoost, patterns: foundPatterns };
  }

  /**
   * Enhanced metrics analysis with more sophisticated scoring
   */
  private analyzeTaskMetrics(metrics: TaskComplexityMetrics): number {
    let metricScore = 0;

    // File-based complexity with exponential scaling
    if (metrics.fileCount) {
      if (metrics.fileCount > 10) {
        metricScore += 0.4; // Many files = high complexity
      } else if (metrics.fileCount > 3) {
        metricScore += 0.2; // Multiple files = medium complexity
      }
    }

    // Code volume with logarithmic scaling
    if (metrics.linesOfCode) {
      const logScale = Math.log(metrics.linesOfCode + 1) / Math.log(10); // log10
      metricScore += Math.min(logScale * 0.1, 0.3);
    }

    // Binary flags with adjusted weights
    if (metrics.hasMultipleFiles) metricScore += 0.25;
    if (metrics.requiresDeepAnalysis) metricScore += 0.35;
    if (metrics.hasSecurityImplications) metricScore += 0.4;
    if (metrics.isTemplateGeneration) metricScore -= 0.1; // Templates are usually simpler

    // Processing time estimates
    if (metrics.estimatedProcessingTime) {
      const timeComplexity = Math.min(metrics.estimatedProcessingTime / 60000, 1); // Minutes to 0-1 scale
      metricScore += timeComplexity * 0.2;
    }

    return metricScore;
  }

  /**
   * Apply contextual adjustments based on historical patterns and system state
   */
  private applyContextualAdjustments(baseScore: number, taskType: string, prompt: string): number {
    let adjustedScore = baseScore;

    // Time-of-day adjustments (complex tasks might be better suited for specific times)
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      // Business hours - slightly favor faster responses
      adjustedScore *= 0.95;
    } else if (hour >= 22 || hour <= 6) {
      // Off hours - can afford slower, higher quality responses
      adjustedScore *= 1.05;
    }

    // Historical performance adjustment
    const historicalData = this.getHistoricalPerformance(taskType, 'lm-studio');
    if (historicalData.sampleSize > 5) {
      if (historicalData.successRate < 0.7) {
        // LM Studio has been struggling with this task type
        adjustedScore += 0.15;
      } else if (historicalData.successRate > 0.9) {
        // LM Studio handles this well
        adjustedScore -= 0.1;
      }
    }

    // System load consideration
    const totalLoad = this.currentLoads.lmStudio + this.currentLoads.ollama;
    if (totalLoad > 5) {
      // High system load - favor the less loaded provider
      if (this.currentLoads.lmStudio < this.currentLoads.ollama) {
        adjustedScore -= 0.05; // Favor LM Studio
      } else {
        adjustedScore += 0.05; // Favor Ollama
      }
    }

    return adjustedScore;
  }

  /**
   * Enhanced routing decision with dynamic thresholds and intelligent reasoning
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

    // Calculate dynamic thresholds based on system performance
    const thresholds = this.calculateDynamicThresholds();
    const providerPerformance = this.getProviderPerformanceMetrics();

    // Enhanced routing logic with dynamic thresholds
    if (complexity < thresholds.lowComplexity) {
      // Simple tasks → LM Studio (unless it's consistently failing)
      const confidence = providerPerformance.lmStudio.successRate > 0.8 ? 0.95 : 0.7;
      return {
        selectedLLM: 'lm-studio',
        confidence,
        reasoning: `Low complexity (${complexity.toFixed(2)}) - LM Studio optimal for speed (success rate: ${(providerPerformance.lmStudio.successRate * 100).toFixed(1)}%)`,
        fallbackStrategy: 'ollama',
        estimatedResponseTime: this.estimateResponseTime('lm-studio', complexity),
        escalationThreshold: routing.escalationThreshold,
      };
    } else if (complexity > thresholds.highComplexity) {
      // Complex tasks → Ollama
      const confidence = providerPerformance.ollama.successRate > 0.8 ? 0.95 : 0.8;
      return {
        selectedLLM: 'ollama',
        confidence,
        reasoning: `High complexity (${complexity.toFixed(2)}) - Ollama required for deep reasoning (success rate: ${(providerPerformance.ollama.successRate * 100).toFixed(1)}%)`,
        fallbackStrategy: 'lm-studio',
        estimatedResponseTime: this.estimateResponseTime('ollama', complexity),
      };
    } else {
      // Medium complexity → Intelligent selection based on current conditions
      const lmStudioLoad = this.currentLoads.lmStudio / this.config.lmStudio.maxConcurrent;
      const ollamaLoad = this.currentLoads.ollama / this.config.ollama.maxConcurrent;
      
      // Prefer less loaded provider for medium complexity tasks
      if (lmStudioLoad < ollamaLoad && providerPerformance.lmStudio.successRate > 0.75) {
        return {
          selectedLLM: 'lm-studio',
          confidence: 0.8,
          reasoning: `Medium complexity (${complexity.toFixed(2)}) - LM Studio chosen (load: ${(lmStudioLoad * 100).toFixed(0)}% vs Ollama: ${(ollamaLoad * 100).toFixed(0)}%)`,
          fallbackStrategy: 'ollama',
          estimatedResponseTime: this.estimateResponseTime('lm-studio', complexity),
          escalationThreshold: routing.escalationThreshold,
        };
      } else {
        // Use hybrid approach - start with LM Studio, escalate to Ollama if needed
        return {
          selectedLLM: 'hybrid',
          confidence: 0.75,
          reasoning: `Medium complexity (${complexity.toFixed(2)}) - hybrid approach with escalation (LM Studio load: ${(lmStudioLoad * 100).toFixed(0)}%)`,
          fallbackStrategy: 'ollama',
          estimatedResponseTime: this.estimateResponseTime('lm-studio', complexity),
          escalationThreshold: Math.max(0.5, routing.escalationThreshold),
        };
      }
    }
  }

  /**
   * Calculate dynamic thresholds based on historical performance
   */
  private calculateDynamicThresholds(): { lowComplexity: number; highComplexity: number } {
    const lmStudioPerf = this.getPerformanceStats('lm-studio');
    const ollamaPerf = this.getPerformanceStats('ollama');

    let lowThreshold = 0.3;  // Default
    let highThreshold = 0.7; // Default

    // Adjust thresholds based on relative performance
    if (lmStudioPerf.successRate > 0.9 && lmStudioPerf.avgResponseTime < 5000) {
      // LM Studio is performing very well - expand its range
      lowThreshold = 0.35;
    } else if (lmStudioPerf.successRate < 0.7) {
      // LM Studio struggling - restrict its range
      lowThreshold = 0.25;
    }

    if (ollamaPerf.successRate > 0.95) {
      // Ollama very reliable - can handle medium complexity
      highThreshold = 0.6;
    } else if (ollamaPerf.successRate < 0.8) {
      // Ollama having issues - increase threshold
      highThreshold = 0.75;
    }

    return { lowComplexity: lowThreshold, highComplexity: highThreshold };
  }

  /**
   * Get current provider performance metrics
   */
  private getProviderPerformanceMetrics(): {
    lmStudio: { successRate: number; avgResponseTime: number };
    ollama: { successRate: number; avgResponseTime: number };
  } {
    return {
      lmStudio: this.getPerformanceStats('lm-studio'),
      ollama: this.getPerformanceStats('ollama'),
    };
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
          reasoning: `${decision.reasoning} (LM Studio overloaded, using Ollama)`,
          confidence: Math.max(decision.confidence - 0.2, 0.3),
        };
      }
    } else if (decision.selectedLLM === 'ollama' && ollama >= maxOllama) {
      if (lmStudio < maxLmStudio) {
        return {
          ...decision,
          selectedLLM: 'lm-studio',
          reasoning: `${decision.reasoning} (Ollama overloaded, using LM Studio)`,
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
    const promptHash = prompt.length > 100 ? `${prompt.substring(0, 100)}...` : prompt;
    return `${taskType}:${promptHash}:${metricHash}`.replace(/[^a-zA-Z0-9:]/g, '_');
  }

  /**
   * PERFORMANCE FIX: Get cached routing decision with hit rate tracking
   */
  private getFromCache(key: string): RoutingDecision | null {
    this.cacheStats.totalRequests++;
    
    const cached = this.routingDecisionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.cacheStats.hits++;
      return cached.decision;
    }
    
    this.cacheStats.misses++;
    
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
   * Clear performance cache and reset statistics (for memory management)
   */
  clearCache(): void {
    this.routingDecisionCache.clear();
    this.performanceMetrics.clear();
    this.cacheStats = { hits: 0, misses: 0, totalRequests: 0 };
    logger.info('Hybrid router cache and statistics cleared');
  }

  /**
   * Get current cache status with accurate hit rate
   */
  getCacheStatus(): { size: number; maxSize: number; hitRate: number; stats: typeof this.cacheStats } {
    const hitRate = this.cacheStats.totalRequests > 0 
      ? this.cacheStats.hits / this.cacheStats.totalRequests 
      : 0;
      
    return {
      size: this.routingDecisionCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: Number(hitRate.toFixed(3)),
      stats: { ...this.cacheStats },
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
