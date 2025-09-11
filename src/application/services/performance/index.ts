/**
 * Performance System Module Exports
 * Barrel exports for the real-time performance optimization system
 */

// Types and Interfaces
export type * from './performance-types.js';

// Core Modules
export { SystemMetricsCollector } from './system-metrics-collector.js';
export { CircuitBreakerManager } from './circuit-breaker-manager.js';
export { PerformanceAnomalyDetector } from './anomaly-detector.js';
export { PredictiveAnalytics } from './predictive-analytics.js';
export { PerformanceOptimizationEngine } from './optimization-engine.js';

// Default configurations
export const DEFAULT_METRICS_CONFIG = {
  intervalMs: 1000,
  bufferSize: 300,
  enableGCMonitoring: true,
  enableNetworkEstimation: true,
  enableDiskEstimation: true,
};

export const DEFAULT_PERFORMANCE_SYSTEM_CONFIG = {
  monitoringIntervalMs: 1000,
  metricBufferSize: 300,
  predictionWindowSize: 60,
  maxAnomalyHistory: 1000,
  circuitBreakers: {
    'routing-coordinator': { threshold: 5, timeout: 60000, resetTimeout: 30000 },
    'cli-processing': { threshold: 3, timeout: 45000, resetTimeout: 20000 },
    'spiral-processing': { threshold: 4, timeout: 50000, resetTimeout: 25000 },
    analytics: { threshold: 6, timeout: 70000, resetTimeout: 35000 },
    'external-api': { threshold: 5, timeout: 60000, resetTimeout: 30000 },
  },
  thresholds: {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    latency: { warning: 1000, critical: 5000 },
    errorRate: { warning: 5, critical: 15 },
    throughput: { warning: 100, critical: 50 },
    gcPause: { warning: 50, critical: 200 },
  },
};

export const DEFAULT_ANOMALY_DETECTION_CONFIG = {
  maxHistorySize: 1000,
  trendWindowSize: 20,
  baselineWindowSize: 100,
  sensitivityFactor: 2.0,
  autoRemediationEnabled: true,
};

export const DEFAULT_PREDICTIVE_CONFIG = {
  minDataPoints: 20,
  maxHistorySize: 1000,
  trainingWindowSize: 100,
  predictionHorizons: [1, 60, 1440],
  enableSeasonalDetection: true,
  accuracyThreshold: 0.7,
};

export const DEFAULT_OPTIMIZATION_CONFIG = {
  enableAutoApply: true,
  maxActionsPerMinute: 5,
  cooldownFactor: 1.5,
  emergencyThresholds: {
    cpu: 95,
    memory: 98,
    latency: 10000,
  },
};
