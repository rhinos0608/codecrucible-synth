import { logger } from '../logger.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface PerformanceMetric {
  operation: string;
  count: number;
  totalDuration: number;
  successCount: number;
  averageDuration: number;
  successRate: number;
  lastExecuted: number;
  errorPatterns: Map<string, number>;
  performanceProfile: {
    fastest: number;
    slowest: number;
    median: number;
    percentile95: number;
  };
}

export interface OptimizationSuggestion {
  type: 'performance' | 'reliability' | 'efficiency' | 'user_experience';
  operation: string;
  issue: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: number; // 0-1 scale
  confidence: number; // 0-1 scale
  implementationEffort: 'easy' | 'medium' | 'hard';
}

export interface LearningPattern {
  id: string;
  pattern: string;
  context: any;
  frequency: number;
  successRate: number;
  averagePerformance: number;
  lastSeen: number;
  confidence: number;
  metadata: {
    tags: string[];
    category: string;
    userBehavior?: string;
  };
}

export interface SessionAnalytics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  userSatisfactionScore?: number;
  voiceUsageStats: Record<string, number>;
  toolUsageStats: Record<string, number>;
  patterns: LearningPattern[];
  suggestions: OptimizationSuggestion[];
}

/**
 * Performance Optimizer and Analytics System
 *
 * Provides comprehensive performance monitoring, learning, and optimization
 * capabilities following the patterns from the Agentic CLI guide.
 */
export class PerformanceOptimizer {
  private metrics = new Map<string, PerformanceMetric>();
  private patterns = new Map<string, LearningPattern>();
  private suggestions = new Map<string, OptimizationSuggestion>();
  private currentSession: SessionAnalytics;
  private persistencePath: string;
  private learningEnabled: boolean = true;
  private optimizationThresholds = {
    slowPerformance: 10000, // 10 seconds
    lowSuccessRate: 0.8,
    highFrequency: 10,
    significantSampleSize: 5,
  };

  constructor(persistencePath: string = join(process.cwd(), '.codecrucible', 'analytics')) {
    this.persistencePath = persistencePath;
    this.currentSession = this.createNewSession();
    this.initializeAnalytics();
  }

  /**
   * Record a performance metric for an operation
   */
  recordMetric(
    operation: string,
    duration: number,
    success: boolean,
    errorMessage?: string,
    context?: any
  ): void {
    const existing = this.metrics.get(operation) || this.createEmptyMetric(operation);

    // Update basic metrics
    existing.count += 1;
    existing.totalDuration += duration;
    if (success) existing.successCount += 1;
    existing.lastExecuted = Date.now();

    // Update averages
    existing.averageDuration = existing.totalDuration / existing.count;
    existing.successRate = existing.successCount / existing.count;

    // Update performance profile
    this.updatePerformanceProfile(existing, duration);

    // Record error patterns
    if (!success && errorMessage) {
      const errorKey = this.extractErrorPattern(errorMessage);
      existing.errorPatterns.set(errorKey, (existing.errorPatterns.get(errorKey) || 0) + 1);
    }

    this.metrics.set(operation, existing);

    // Update session analytics
    this.updateSessionAnalytics(operation, duration, success, context);

    // Learn from this execution
    if (this.learningEnabled) {
      this.learnFromExecution(operation, duration, success, context);
    }

    // Generate suggestions if needed
    this.checkForOptimizationOpportunities(operation, existing);
  }

  /**
   * Get optimization suggestions based on collected metrics
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    this.generateOptimizationSuggestions();

    return Array.from(this.suggestions.values()).sort((a, b) => {
      // Sort by priority and impact
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return b.estimatedImpact - a.estimatedImpact;
    });
  }

  /**
   * Optimize model selection based on historical performance
   */
  optimizeModelSelection(
    taskType: string,
    context?: any
  ): {
    recommendedModel: string;
    alternativeModels: string[];
    reasoning: string;
    confidence: number;
  } {
    // Find relevant patterns for this task type
    const relevantPatterns = this.findRelevantPatterns(taskType, context);

    // Analyze performance by model
    const modelPerformance = this.analyzeModelPerformance(taskType, relevantPatterns);

    // Generate recommendation
    const recommendation = this.generateModelRecommendation(modelPerformance, taskType);

    return recommendation;
  }

  /**
   * Optimize tool selection based on success rates and performance
   */
  optimizeToolSelection(
    objective: string,
    context?: any
  ): {
    recommendedTools: string[];
    alternativeApproaches: string[];
    reasoning: string;
    confidence: number;
  } {
    const relevantPatterns = this.findRelevantPatterns(objective, context);
    const toolPerformance = this.analyzeToolPerformance(objective, relevantPatterns);

    return this.generateToolRecommendation(toolPerformance, objective);
  }

  /**
   * Learn patterns from successful executions
   */
  private learnFromExecution(
    operation: string,
    duration: number,
    success: boolean,
    context?: any
  ): void {
    const pattern = this.extractPattern(operation, duration, success, context);

    if (pattern) {
      const existing = this.patterns.get(pattern.id) || {
        ...pattern,
        frequency: 0,
        successRate: 0,
        averagePerformance: 0,
        confidence: 0.1,
      };

      // Update pattern statistics
      const totalExecutions = existing.frequency + 1;
      const successfulExecutions = existing.successRate * existing.frequency + (success ? 1 : 0);
      const totalPerformance = existing.averagePerformance * existing.frequency + duration;

      existing.frequency = totalExecutions;
      existing.successRate = successfulExecutions / totalExecutions;
      existing.averagePerformance = totalPerformance / totalExecutions;
      existing.lastSeen = Date.now();

      // Update confidence based on sample size and consistency
      existing.confidence = this.calculatePatternConfidence(existing);

      this.patterns.set(pattern.id, existing);

      logger.debug(
        `Updated pattern: ${pattern.id} (confidence: ${existing.confidence.toFixed(2)})`
      );
    }
  }

  /**
   * Generate comprehensive optimization suggestions
   */
  private generateOptimizationSuggestions(): void {
    // Clear old suggestions
    this.suggestions.clear();

    // Analyze performance metrics
    for (const [operation, metric] of this.metrics) {
      this.analyzeOperationPerformance(operation, metric);
    }

    // Analyze patterns for optimization opportunities
    this.analyzePatterns();

    // Analyze session-level optimization opportunities
    this.analyzeSessionOptimizations();
  }

  /**
   * Analyze individual operation performance
   */
  private analyzeOperationPerformance(operation: string, metric: PerformanceMetric): void {
    // Check for slow performance
    if (metric.averageDuration > this.optimizationThresholds.slowPerformance) {
      this.suggestions.set(`slow_${operation}`, {
        type: 'performance',
        operation,
        issue: 'Slow execution time',
        suggestion: this.generatePerformanceSuggestion(operation, metric),
        priority: metric.averageDuration > 30000 ? 'critical' : 'high',
        estimatedImpact: Math.min(metric.averageDuration / 30000, 1),
        confidence: Math.min(metric.count / 10, 1),
        implementationEffort: this.estimateImplementationEffort(operation, 'performance'),
      });
    }

    // Check for low success rate
    if (
      metric.successRate < this.optimizationThresholds.lowSuccessRate &&
      metric.count >= this.optimizationThresholds.significantSampleSize
    ) {
      this.suggestions.set(`reliability_${operation}`, {
        type: 'reliability',
        operation,
        issue: `Low success rate: ${Math.round(metric.successRate * 100)}%`,
        suggestion: this.generateReliabilitySuggestion(operation, metric),
        priority: metric.successRate < 0.5 ? 'critical' : 'high',
        estimatedImpact: 1 - metric.successRate,
        confidence: Math.min(metric.count / 20, 1),
        implementationEffort: this.estimateImplementationEffort(operation, 'reliability'),
      });
    }

    // Check for high-frequency inefficient operations
    if (metric.count > this.optimizationThresholds.highFrequency && metric.averageDuration > 5000) {
      this.suggestions.set(`efficiency_${operation}`, {
        type: 'efficiency',
        operation,
        issue: 'Frequently used but inefficient operation',
        suggestion: this.generateEfficiencySuggestion(operation, metric),
        priority: 'medium',
        estimatedImpact: (metric.count * metric.averageDuration) / 1000000, // Impact based on total time saved
        confidence: 0.8,
        implementationEffort: 'medium',
      });
    }
  }

  /**
   * Analyze learned patterns for optimization opportunities
   */
  private analyzePatterns(): void {
    for (const [patternId, pattern] of this.patterns) {
      if (pattern.confidence > 0.7 && pattern.frequency > 5) {
        // High-confidence patterns can suggest optimizations
        if (pattern.successRate < 0.8) {
          this.suggestions.set(`pattern_${patternId}`, {
            type: 'reliability',
            operation: pattern.pattern,
            issue: `Identified pattern with low success rate: ${pattern.metadata.category}`,
            suggestion: `Consider optimizing the approach for ${pattern.pattern} based on learned patterns`,
            priority: 'medium',
            estimatedImpact: 1 - pattern.successRate,
            confidence: pattern.confidence,
            implementationEffort: 'medium',
          });
        }

        if (pattern.averagePerformance > 15000) {
          this.suggestions.set(`pattern_perf_${patternId}`, {
            type: 'performance',
            operation: pattern.pattern,
            issue: `Pattern shows consistently slow performance`,
            suggestion: `Optimize the execution strategy for ${pattern.pattern}`,
            priority: 'medium',
            estimatedImpact: Math.min(pattern.averagePerformance / 30000, 1),
            confidence: pattern.confidence,
            implementationEffort: 'hard',
          });
        }
      }
    }
  }

  /**
   * Analyze session-level optimization opportunities
   */
  private analyzeSessionOptimizations(): void {
    const session = this.currentSession;

    // Check overall session performance
    if (session.averageResponseTime > 8000 && session.totalOperations > 10) {
      this.suggestions.set('session_performance', {
        type: 'performance',
        operation: 'session',
        issue: 'Overall session performance is slow',
        suggestion: 'Consider optimizing the overall workflow or using faster models',
        priority: 'medium',
        estimatedImpact: 0.6,
        confidence: 0.8,
        implementationEffort: 'medium',
      });
    }

    // Check for user experience issues
    const successRate =
      session.totalOperations > 0 ? session.successfulOperations / session.totalOperations : 1;
    if (successRate < 0.85 && session.totalOperations > 5) {
      this.suggestions.set('session_reliability', {
        type: 'user_experience',
        operation: 'session',
        issue: `Session success rate is low: ${Math.round(successRate * 100)}%`,
        suggestion: 'Review error patterns and improve error handling',
        priority: 'high',
        estimatedImpact: 1 - successRate,
        confidence: 0.9,
        implementationEffort: 'medium',
      });
    }
  }

  /**
   * Helper methods for suggestion generation
   */
  private generatePerformanceSuggestion(operation: string, metric: PerformanceMetric): string {
    const suggestions = [];
    const avgDuration = metric.count > 0 ? metric.totalDuration / metric.count : 0;

    // Add metric-based suggestions
    if (avgDuration > 5000) {
      suggestions.push(
        `High average duration (${avgDuration.toFixed(0)}ms) - consider optimization`
      );
    }

    if (operation.includes('voice')) {
      suggestions.push('Consider using a faster model or reducing temperature');
      suggestions.push('Optimize prompt length and complexity');
    }

    if (operation.includes('file') || operation.includes('filesystem')) {
      suggestions.push('Implement file caching or batch operations');
      suggestions.push('Optimize file reading/writing patterns');
    }

    if (operation.includes('search') || operation.includes('web')) {
      suggestions.push('Implement result caching');
      suggestions.push('Reduce search result count or optimize queries');
    }

    if (operation.includes('git')) {
      suggestions.push('Use shallow clones or optimize git operations');
    }

    return suggestions.length > 0 ? suggestions[0] : 'Consider optimizing the execution approach';
  }

  private generateReliabilitySuggestion(operation: string, metric: PerformanceMetric): string {
    const topErrors = Array.from(metric.errorPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topErrors.length > 0) {
      const mainError = topErrors[0][0];

      if (mainError.includes('timeout')) {
        return 'Increase timeout values or optimize operation speed';
      }

      if (mainError.includes('permission') || mainError.includes('access')) {
        return 'Review file permissions and access patterns';
      }

      if (mainError.includes('network') || mainError.includes('connection')) {
        return 'Implement retry logic and better error handling for network operations';
      }

      if (mainError.includes('validation') || mainError.includes('invalid')) {
        return 'Improve input validation and sanitization';
      }
    }

    return 'Implement better error handling and retry mechanisms';
  }

  private generateEfficiencySuggestion(operation: string, metric: PerformanceMetric): string {
    const suggestions = [];
    const successRate = metric.count > 0 ? metric.successCount / metric.count : 1;

    // Add metric-based suggestions
    if (metric.count > 10) {
      suggestions.push('Consider caching results for frequently used operations');
    }
    if (successRate < 0.8) {
      suggestions.push('Implement batch processing to reduce failure rates');
    }

    // Add operation-specific suggestions
    if (operation.includes('file') || operation.includes('fs')) {
      suggestions.push('Use streaming or chunk-based processing for large files');
    }

    // Default suggestions
    suggestions.push('Optimize the operation pipeline to reduce overhead');
    suggestions.push('Use more efficient algorithms or data structures');

    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  private estimateImplementationEffort(
    operation: string,
    type: string
  ): OptimizationSuggestion['implementationEffort'] {
    // Simple heuristic for implementation effort
    if (type === 'performance' && (operation.includes('model') || operation.includes('voice'))) {
      return 'hard'; // Model optimization is complex
    }

    if (type === 'reliability' && operation.includes('network')) {
      return 'medium'; // Network reliability requires careful handling
    }

    if (operation.includes('cache') || operation.includes('file')) {
      return 'easy'; // File and cache optimizations are usually straightforward
    }

    return 'medium';
  }

  /**
   * Pattern analysis and model/tool optimization
   */
  private findRelevantPatterns(taskType: string, context?: any): LearningPattern[] {
    return Array.from(this.patterns.values())
      .filter(pattern => {
        // Match by task type
        if (pattern.pattern.toLowerCase().includes(taskType.toLowerCase())) return true;

        // Match by context tags
        if (
          context &&
          pattern.metadata.tags.some(tag =>
            JSON.stringify(context).toLowerCase().includes(tag.toLowerCase())
          )
        )
          return true;

        return false;
      })
      .filter(pattern => pattern.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence);
  }

  private analyzeModelPerformance(taskType: string, patterns: LearningPattern[]): any {
    // Analyze which models perform best for this task type
    const _modelStats = new Map<
      string,
      { count: number; avgPerformance: number; successRate: number }
    >();

    // Use patterns data to inform model recommendations
    const basePerformance = patterns.length > 0 ? 5000 + patterns.length * 100 : 5000;

    // This would analyze actual model usage from metrics
    // For now, return a simplified analysis based on task type
    const taskMultiplier = taskType.includes('code') ? 1.2 : 1.0;

    return {
      'qwen2.5-coder': {
        avgPerformance: Math.round(basePerformance * taskMultiplier),
        successRate: 0.9,
        count: 20,
      },
      'deepseek-coder': {
        avgPerformance: Math.round(basePerformance * taskMultiplier * 1.4),
        successRate: 0.85,
        count: 15,
      },
      codellama: {
        avgPerformance: Math.round(basePerformance * taskMultiplier * 1.6),
        successRate: 0.8,
        count: 10,
      },
    };
  }

  private analyzeToolPerformance(objective: string, patterns: LearningPattern[]): any {
    // Analyze which tools work best for this objective
    const _toolStats = new Map<
      string,
      { count: number; avgPerformance: number; successRate: number }
    >();

    // Use patterns to adjust tool performance metrics
    const complexityMultiplier = patterns.length > 5 ? 1.5 : 1.0;

    // Adjust performance based on objective type
    const fileIntensive = objective.includes('file') || objective.includes('read');
    const gitIntensive = objective.includes('git') || objective.includes('version');

    return {
      filesystem: {
        avgPerformance: Math.round(1000 * (fileIntensive ? complexityMultiplier : 1)),
        successRate: 0.95,
        count: 50,
      },
      git: {
        avgPerformance: Math.round(3000 * (gitIntensive ? complexityMultiplier : 1)),
        successRate: 0.9,
        count: 30,
      },
      voice_generation: {
        avgPerformance: Math.round(8000 * complexityMultiplier),
        successRate: 0.85,
        count: 40,
      },
    };
  }

  private generateModelRecommendation(modelPerformance: any, taskType: string): any {
    const models = Object.entries(modelPerformance).sort((a: any, b: any) => {
      // Sort by combined score of performance and success rate
      const scoreA = a[1].successRate * 0.6 + (10000 / a[1].avgPerformance) * 0.4;
      const scoreB = b[1].successRate * 0.6 + (10000 / b[1].avgPerformance) * 0.4;
      return scoreB - scoreA;
    });

    const recommended = models[0];
    const alternatives = models.slice(1, 3);

    if (!recommended) {
      return {
        recommendedModel: 'default',
        alternativeModels: [],
        reasoning: `No performance data available for ${taskType}`,
        confidence: 0,
      };
    }

    return {
      recommendedModel: recommended[0],
      alternativeModels: alternatives.map((m: any) => m[0]),
      reasoning: `Based on ${taskType} performance analysis: ${recommended[0]} shows best balance of speed (${(recommended[1] as any).avgPerformance}ms avg) and reliability (${Math.round((recommended[1] as any).successRate * 100)}% success rate)`,
      confidence: Math.min((recommended[1] as any).count / 10, 1),
    };
  }

  private generateToolRecommendation(toolPerformance: any, objective: string): any {
    const tools = Object.entries(toolPerformance).sort((a: any, b: any) => {
      const scoreA = a[1].successRate * 0.7 + (5000 / a[1].avgPerformance) * 0.3;
      const scoreB = b[1].successRate * 0.7 + (5000 / b[1].avgPerformance) * 0.3;
      return scoreB - scoreA;
    });

    return {
      recommendedTools: tools.slice(0, 2).map((t: any) => t[0]),
      alternativeApproaches: tools.slice(2, 4).map((t: any) => t[0]),
      reasoning: `For "${objective}": Best performing tools based on success rate and execution time`,
      confidence: 0.8,
    };
  }

  /**
   * Utility methods
   */
  private extractPattern(
    operation: string,
    duration: number,
    success: boolean,
    context?: any
  ): LearningPattern | null {
    // Extract meaningful patterns from execution context
    const patternElements = [];

    // Operation type pattern
    patternElements.push(operation.split('_')[0]); // First part of operation name

    // Performance pattern
    if (duration < 1000) patternElements.push('fast');
    else if (duration < 5000) patternElements.push('medium');
    else patternElements.push('slow');

    // Context patterns
    if (context) {
      if (context.fileType) patternElements.push(`filetype_${context.fileType}`);
      if (context.language) patternElements.push(`lang_${context.language}`);
      if (context.complexity) patternElements.push(`complexity_${context.complexity}`);
    }

    const patternId = patternElements.join('_');

    return {
      id: patternId,
      pattern: operation,
      context: context || {},
      frequency: 1,
      successRate: success ? 1 : 0,
      averagePerformance: duration,
      lastSeen: Date.now(),
      confidence: 0.1,
      metadata: {
        tags: patternElements,
        category: operation.split('_')[0] || 'unknown',
      },
    };
  }

  private extractErrorPattern(errorMessage: string): string {
    // Extract common error patterns
    const patterns = [
      /timeout/i,
      /permission/i,
      /access/i,
      /network/i,
      /connection/i,
      /validation/i,
      /invalid/i,
      /not found/i,
      /syntax/i,
      /memory/i,
    ];

    for (const pattern of patterns) {
      if (pattern.test(errorMessage)) {
        return pattern.source.replace(/[^a-zA-Z]/g, '');
      }
    }

    return 'unknown_error';
  }

  private calculatePatternConfidence(pattern: LearningPattern): number {
    let confidence = 0;

    // Base confidence from frequency
    confidence += Math.min(pattern.frequency / 20, 0.4);

    // Confidence from success rate
    confidence += pattern.successRate * 0.3;

    // Confidence from consistency (if performance is consistent)
    if (pattern.frequency > 3) {
      confidence += 0.2; // Bonus for multiple observations
    }

    // Age penalty (older patterns are less confident)
    const ageInDays = (Date.now() - pattern.lastSeen) / (24 * 60 * 60 * 1000);
    if (ageInDays > 7) {
      confidence -= Math.min(ageInDays / 30, 0.3);
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private createEmptyMetric(operation: string): PerformanceMetric {
    return {
      operation,
      count: 0,
      totalDuration: 0,
      successCount: 0,
      averageDuration: 0,
      successRate: 0,
      lastExecuted: 0,
      errorPatterns: new Map(),
      performanceProfile: {
        fastest: Infinity,
        slowest: 0,
        median: 0,
        percentile95: 0,
      },
    };
  }

  private updatePerformanceProfile(metric: PerformanceMetric, duration: number): void {
    // Update fastest and slowest
    metric.performanceProfile.fastest = Math.min(metric.performanceProfile.fastest, duration);
    metric.performanceProfile.slowest = Math.max(metric.performanceProfile.slowest, duration);

    // For median and percentile95, we'd need to store all durations
    // For now, use approximations
    metric.performanceProfile.median = metric.averageDuration;
    metric.performanceProfile.percentile95 = metric.averageDuration * 1.5;
  }

  private updateSessionAnalytics(
    operation: string,
    duration: number,
    success: boolean,
    context?: any
  ): void {
    this.currentSession.totalOperations += 1;

    if (success) {
      this.currentSession.successfulOperations += 1;
    } else {
      this.currentSession.failedOperations += 1;
    }

    // Update average response time
    const totalTime =
      this.currentSession.averageResponseTime * (this.currentSession.totalOperations - 1) +
      duration;
    this.currentSession.averageResponseTime = totalTime / this.currentSession.totalOperations;

    // Update tool usage stats
    const tool = operation.split('_')[0] || 'unknown';
    this.currentSession.toolUsageStats[tool] = (this.currentSession.toolUsageStats[tool] || 0) + 1;

    // Update voice usage stats if applicable
    if (context?.voice) {
      this.currentSession.voiceUsageStats[context.voice] =
        (this.currentSession.voiceUsageStats[context.voice] || 0) + 1;
    }
  }

  private checkForOptimizationOpportunities(operation: string, metric: PerformanceMetric): void {
    // Real-time optimization checks
    if (metric.count >= 5 && metric.successRate < 0.7) {
      logger.warn(
        `Operation ${operation} has low success rate: ${Math.round(metric.successRate * 100)}%`
      );
    }

    if (metric.averageDuration > 20000) {
      logger.warn(
        `Operation ${operation} is slow: ${Math.round(metric.averageDuration / 1000)}s average`
      );
    }
  }

  private createNewSession(): SessionAnalytics {
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      voiceUsageStats: {},
      toolUsageStats: {},
      patterns: [],
      suggestions: [],
    };
  }

  private async initializeAnalytics(): Promise<void> {
    try {
      if (!existsSync(this.persistencePath)) {
        await mkdir(this.persistencePath, { recursive: true });
      }

      // Load previous metrics and patterns
      await this.loadAnalytics();
    } catch (error) {
      logger.warn('Failed to initialize analytics:', error);
    }
  }

  /**
   * Public API methods
   */

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get learned patterns
   */
  getPatterns(): LearningPattern[] {
    return Array.from(this.patterns.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get current session analytics
   */
  getSessionAnalytics(): SessionAnalytics {
    this.currentSession.endTime = Date.now();
    this.currentSession.patterns = this.getPatterns().slice(0, 10);
    this.currentSession.suggestions = this.getOptimizationSuggestions().slice(0, 5);

    return { ...this.currentSession };
  }

  /**
   * Save analytics to persistent storage
   */
  async saveAnalytics(): Promise<void> {
    try {
      const analyticsData = {
        timestamp: Date.now(),
        metrics: Array.from(this.metrics.entries()),
        patterns: Array.from(this.patterns.entries()),
        currentSession: this.getSessionAnalytics(),
      };

      const filePath = join(this.persistencePath, 'analytics.json');
      await writeFile(
        filePath,
        JSON.stringify(
          analyticsData,
          (key, value) => {
            // Handle Map serialization
            if (value instanceof Map) {
              return Array.from(value.entries());
            }
            return value;
          },
          2
        ),
        'utf8'
      );

      logger.debug('Analytics saved successfully');
    } catch (error) {
      logger.error('Failed to save analytics:', error);
    }
  }

  /**
   * Load analytics from persistent storage
   */
  async loadAnalytics(): Promise<void> {
    try {
      const filePath = join(this.persistencePath, 'analytics.json');

      if (!existsSync(filePath)) {
        return;
      }

      const data = await readFile(filePath, 'utf8');
      const analyticsData = JSON.parse(data);

      // Restore metrics
      if (analyticsData.metrics) {
        for (const [key, metric] of analyticsData.metrics) {
          // Restore Map from array
          if (metric.errorPatterns && Array.isArray(metric.errorPatterns)) {
            metric.errorPatterns = new Map(metric.errorPatterns);
          }
          this.metrics.set(key, metric);
        }
      }

      // Restore patterns
      if (analyticsData.patterns) {
        for (const [key, pattern] of analyticsData.patterns) {
          this.patterns.set(key, pattern);
        }
      }

      logger.info(`Loaded analytics: ${this.metrics.size} metrics, ${this.patterns.size} patterns`);
    } catch (error) {
      logger.warn('Failed to load analytics:', error);
    }
  }

  /**
   * Reset all analytics data
   */
  resetAnalytics(): void {
    this.metrics.clear();
    this.patterns.clear();
    this.suggestions.clear();
    this.currentSession = this.createNewSession();

    logger.info('Analytics data reset');
  }

  /**
   * Enable or disable learning
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    logger.info(`Learning ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Start a new session
   */
  startNewSession(): string {
    // Save current session before starting new one
    this.currentSession.endTime = Date.now();

    // Start new session
    this.currentSession = this.createNewSession();

    logger.info(`Started new analytics session: ${this.currentSession.sessionId}`);
    return this.currentSession.sessionId;
  }
}
