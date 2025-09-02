/**
 * Performance Profiler - Phase 2 Implementation
 *
 * Integrates with existing MetricsCollector and AdaptivePerformanceTuner
 * to provide detailed timing and performance analysis for LLM operations,
 * tool execution, and event bus latency.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { MetricsCollector } from '../monitoring/metrics-collector.js';
import { AdaptivePerformanceTuner, PerformanceMetrics } from './adaptive-performance-tuner.js';
import { logger } from '../logger.js';

export interface ProfileOperation {
  id: string;
  name: string;
  category:
    | 'llm_inference'
    | 'tool_execution'
    | 'prompt_preparation'
    | 'event_bus'
    | 'cache_operation';
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  error?: Error;
}

export interface ProfilingSession {
  sessionId: string;
  startTime: number;
  operations: Map<string, ProfileOperation>;
  totalDuration?: number;
  summary?: OperationSummary;
}

export interface OperationSummary {
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  durationsByCategory: Record<string, number[]>;
  slowestOperations: ProfileOperation[];
}

export interface PerformanceProfilerConfig {
  enableDetailedLogging: boolean;
  sessionTimeoutMs: number;
  maxOperationsPerSession: number;
  slowOperationThresholdMs: number;
  autoCleanupIntervalMs: number;
}

/**
 * Performance Profiler that extends existing performance infrastructure
 * with detailed operation timing and analysis capabilities.
 */
export class PerformanceProfiler extends EventEmitter {
  private metricsCollector: MetricsCollector;
  private performanceTuner?: AdaptivePerformanceTuner;
  private config: PerformanceProfilerConfig;

  private activeSessions = new Map<string, ProfilingSession>();
  private operationHistory: ProfileOperation[] = [];
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    metricsCollector: MetricsCollector,
    performanceTuner?: AdaptivePerformanceTuner,
    config?: Partial<PerformanceProfilerConfig>
  ) {
    super();

    this.metricsCollector = metricsCollector;
    this.performanceTuner = performanceTuner;

    this.config = {
      enableDetailedLogging: false,
      sessionTimeoutMs: 300000, // 5 minutes
      maxOperationsPerSession: 1000,
      slowOperationThresholdMs: 5000, // 5 seconds
      autoCleanupIntervalMs: 60000, // 1 minute
      ...config,
    };

    this.initializeProfilerMetrics();
    this.startCleanupInterval();
  }

  /**
   * Initialize profiler-specific metrics in MetricsCollector
   */
  private initializeProfilerMetrics(): void {
    // LLM inference profiling metrics
    this.metricsCollector.registerHistogram(
      'llm_inference_detailed_duration_seconds',
      'Detailed LLM inference timing by provider and model',
      ['provider', 'model', 'voice', 'operation_type'],
      [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
    );

    // Tool execution profiling metrics
    this.metricsCollector.registerHistogram(
      'tool_execution_detailed_duration_seconds',
      'Detailed tool execution timing by tool type',
      ['tool_type', 'tool_name', 'execution_mode'],
      [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30]
    );

    // Prompt preparation metrics
    this.metricsCollector.registerHistogram(
      'prompt_preparation_duration_seconds',
      'Time spent preparing and formatting prompts',
      ['template_type', 'voice_count', 'complexity'],
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1]
    );

    // Event bus latency metrics
    this.metricsCollector.registerHistogram(
      'event_bus_latency_seconds',
      'Event bus message processing latency',
      ['event_type', 'handler_count'],
      [0.0001, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25]
    );

    // Session and operation tracking
    this.metricsCollector.registerGauge(
      'active_profiling_sessions',
      'Currently active profiling sessions'
    );
    this.metricsCollector.registerCounter(
      'slow_operations_total',
      'Total slow operations detected',
      ['category', 'threshold']
    );
  }

  /**
   * Start a new profiling session
   */
  startSession(sessionId?: string): string {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: ProfilingSession = {
      sessionId: id,
      startTime: performance.now(),
      operations: new Map(),
    };

    this.activeSessions.set(id, session);
    this.metricsCollector.setGauge('active_profiling_sessions', this.activeSessions.size);

    if (this.config.enableDetailedLogging) {
      logger.info(`Started profiling session: ${id}`);
    }

    this.emit('session_started', { sessionId: id });
    return id;
  }

  /**
   * Start profiling an operation
   */
  startOperation(
    sessionId: string,
    operationName: string,
    category: ProfileOperation['category'],
    metadata?: Record<string, any>
  ): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Profiling session not found: ${sessionId}`);
    }

    const operationId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const operation: ProfileOperation = {
      id: operationId,
      name: operationName,
      category,
      startTime: performance.now(),
      status: 'running',
      metadata: metadata || {},
    };

    session.operations.set(operationId, operation);

    if (this.config.enableDetailedLogging) {
      logger.debug(`Started operation: ${operationName} (${operationId}) in session ${sessionId}`);
    }

    this.emit('operation_started', { sessionId, operationId, operation });
    return operationId;
  }

  /**
   * End profiling an operation
   */
  endOperation(sessionId: string, operationId: string, error?: Error): ProfileOperation {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Profiling session not found: ${sessionId}`);
    }

    const operation = session.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    const endTime = performance.now();
    const duration = (endTime - operation.startTime) / 1000; // Convert to seconds

    operation.endTime = endTime;
    operation.duration = duration;
    operation.status = error ? 'failed' : 'completed';
    operation.error = error;

    // Record metrics based on category
    const labels = this.buildMetricLabels(operation);

    switch (operation.category) {
      case 'llm_inference':
        this.metricsCollector.observeHistogram(
          'llm_inference_detailed_duration_seconds',
          duration,
          labels
        );
        break;
      case 'tool_execution':
        this.metricsCollector.observeHistogram(
          'tool_execution_detailed_duration_seconds',
          duration,
          labels
        );
        break;
      case 'prompt_preparation':
        this.metricsCollector.observeHistogram(
          'prompt_preparation_duration_seconds',
          duration,
          labels
        );
        break;
      case 'event_bus':
        this.metricsCollector.observeHistogram('event_bus_latency_seconds', duration, labels);
        break;
    }

    // Check for slow operations
    if (duration * 1000 > this.config.slowOperationThresholdMs) {
      this.metricsCollector.incrementCounter('slow_operations_total', {
        category: operation.category,
        threshold: this.config.slowOperationThresholdMs.toString(),
      });

      logger.warn(`Slow operation detected: ${operation.name} took ${duration.toFixed(3)}s`);
      this.emit('slow_operation', { sessionId, operationId, operation, duration });
    }

    // Store in history
    this.operationHistory.push({ ...operation });

    if (this.config.enableDetailedLogging) {
      logger.debug(
        `Completed operation: ${operation.name} (${operationId}) in ${duration.toFixed(3)}s`
      );
    }

    this.emit('operation_completed', { sessionId, operationId, operation, duration });
    return operation;
  }

  /**
   * End a profiling session and generate summary
   */
  endSession(sessionId: string): OperationSummary {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Profiling session not found: ${sessionId}`);
    }

    const operations = Array.from(session.operations.values());
    const completedOps = operations.filter(op => op.status === 'completed');
    const durations = completedOps.map(op => op.duration!).filter(d => d > 0);

    const summary: OperationSummary = {
      totalOperations: operations.length,
      completedOperations: completedOps.length,
      failedOperations: operations.filter(op => op.status === 'failed').length,
      averageDuration:
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      durationsByCategory: this.groupDurationsByCategory(completedOps),
      slowestOperations: completedOps
        .filter(op => op.duration! * 1000 > this.config.slowOperationThresholdMs)
        .sort((a, b) => b.duration! - a.duration!)
        .slice(0, 10),
    };

    session.summary = summary;
    session.totalDuration = performance.now() - session.startTime;

    this.activeSessions.delete(sessionId);
    this.metricsCollector.setGauge('active_profiling_sessions', this.activeSessions.size);

    if (this.config.enableDetailedLogging) {
      logger.info(`Ended profiling session: ${sessionId}`, {
        totalOperations: summary.totalOperations,
        averageDuration: summary.averageDuration.toFixed(3),
        slowOperations: summary.slowestOperations.length,
      });
    }

    this.emit('session_ended', { sessionId, summary });
    return summary;
  }

  /**
   * Time an async operation with automatic profiling
   */
  async timeOperation<T>(
    sessionId: string,
    operationName: string,
    category: ProfileOperation['category'],
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const operationId = this.startOperation(sessionId, operationName, category, metadata);

    try {
      const result = await operation();
      this.endOperation(sessionId, operationId);
      return result;
    } catch (error) {
      this.endOperation(sessionId, operationId, error as Error);
      throw error;
    }
  }

  /**
   * Get current performance insights
   */
  getPerformanceInsights(): {
    activeSessions: number;
    recentOperations: ProfileOperation[];
    categoryAverages: Record<string, number>;
    slowOperationCount: number;
  } {
    const recent = this.operationHistory.slice(-100);
    const categoryOps = new Map<string, number[]>();

    recent.forEach(op => {
      if (op.status === 'completed' && op.duration) {
        if (!categoryOps.has(op.category)) {
          categoryOps.set(op.category, []);
        }
        categoryOps.get(op.category)!.push(op.duration);
      }
    });

    const categoryAverages: Record<string, number> = {};
    categoryOps.forEach((durations, category) => {
      categoryAverages[category] = durations.reduce((a, b) => a + b, 0) / durations.length;
    });

    return {
      activeSessions: this.activeSessions.size,
      recentOperations: recent.slice(-20),
      categoryAverages,
      slowOperationCount: recent.filter(
        op => op.duration && op.duration * 1000 > this.config.slowOperationThresholdMs
      ).length,
    };
  }

  /**
   * Build metric labels for operation
   */
  private buildMetricLabels(operation: ProfileOperation): Record<string, string> {
    const baseLabels = {
      category: operation.category,
      status: operation.status,
    };

    // Add category-specific labels
    switch (operation.category) {
      case 'llm_inference':
        return {
          ...baseLabels,
          provider: operation.metadata?.provider || 'unknown',
          model: operation.metadata?.model || 'unknown',
          voice: operation.metadata?.voice || 'default',
          operation_type: operation.metadata?.operationType || 'generate',
        };
      case 'tool_execution':
        return {
          ...baseLabels,
          tool_type: operation.metadata?.toolType || 'unknown',
          tool_name: operation.metadata?.toolName || 'unknown',
          execution_mode: operation.metadata?.executionMode || 'sync',
        };
      case 'prompt_preparation':
        return {
          ...baseLabels,
          template_type: operation.metadata?.templateType || 'default',
          voice_count: (operation.metadata?.voiceCount || 1).toString(),
          complexity: operation.metadata?.complexity || 'medium',
        };
      case 'event_bus':
        return {
          ...baseLabels,
          event_type: operation.metadata?.eventType || 'unknown',
          handler_count: (operation.metadata?.handlerCount || 1).toString(),
        };
      default:
        return baseLabels;
    }
  }

  /**
   * Group durations by category
   */
  private groupDurationsByCategory(operations: ProfileOperation[]): Record<string, number[]> {
    const grouped: Record<string, number[]> = {};

    operations.forEach(op => {
      if (op.duration) {
        if (!grouped[op.category]) {
          grouped[op.category] = [];
        }
        grouped[op.category].push(op.duration);
      }
    });

    return grouped;
  }

  /**
   * Start cleanup interval for old sessions and history
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.autoCleanupIntervalMs);
  }

  /**
   * Cleanup old sessions and trim operation history
   */
  private cleanup(): void {
    const now = performance.now();
    const expiredSessions: string[] = [];

    // Find expired sessions
    this.activeSessions.forEach((session, sessionId) => {
      if (now - session.startTime > this.config.sessionTimeoutMs) {
        expiredSessions.push(sessionId);
      }
    });

    // Clean up expired sessions
    expiredSessions.forEach(sessionId => {
      logger.warn(`Cleaning up expired profiling session: ${sessionId}`);
      this.activeSessions.delete(sessionId);
    });

    // Trim operation history
    if (this.operationHistory.length > 10000) {
      this.operationHistory = this.operationHistory.slice(-5000);
    }

    this.metricsCollector.setGauge('active_profiling_sessions', this.activeSessions.size);
  }

  /**
   * Stop profiler and cleanup resources
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // End all active sessions
    Array.from(this.activeSessions.keys()).forEach(sessionId => {
      try {
        this.endSession(sessionId);
      } catch (error) {
        logger.error(`Error ending session ${sessionId}:`, error);
      }
    });

    this.activeSessions.clear();
    this.operationHistory = [];

    logger.info('Performance profiler stopped');
  }
}

/**
 * Factory function to create PerformanceProfiler with existing infrastructure
 */
export function createPerformanceProfiler(
  metricsCollector: MetricsCollector,
  performanceTuner?: AdaptivePerformanceTuner,
  config?: Partial<PerformanceProfilerConfig>
): PerformanceProfiler {
  return new PerformanceProfiler(metricsCollector, performanceTuner, config);
}
