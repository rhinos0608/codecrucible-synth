/**
 * Performance System Types and Interfaces
 * Shared types for the real-time performance optimization system
 */

// ========================= CORE TYPES =========================

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number; // 0-100%
    loadAvg: [number, number, number]; // 1min, 5min, 15min
    cores: number;
  };
  memory: {
    used: number; // MB
    free: number; // MB
    total: number; // MB
    usage: number; // 0-100%
    heapUsed: number; // V8 heap MB
    heapTotal: number; // V8 heap total MB
    external: number; // V8 external memory MB
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
    latencyP95: number; // ms
  };
  disk: {
    reads: number;
    writes: number;
    usage: number; // 0-100%
    iops: number; // operations per second
  };
  gc: {
    collections: number;
    pauseTime: number; // ms
    heapFragmentation: number; // 0-1
  };
}

export interface PerformanceThresholds {
  cpu: { warning: number; critical: number }; // %
  memory: { warning: number; critical: number }; // %
  latency: { warning: number; critical: number }; // ms
  errorRate: { warning: number; critical: number }; // %
  throughput: { warning: number; critical: number }; // req/s
  gcPause: { warning: number; critical: number }; // ms
}

export interface CircuitBreakerState {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  lastFailure?: number;
  threshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface PerformanceAnomalyEvent {
  timestamp: number;
  type: 'SPIKE' | 'DEGRADATION' | 'RESOURCE_EXHAUSTION' | 'CIRCUIT_OPEN' | 'PREDICTION_WARNING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metric: string;
  currentValue: number;
  expectedValue: number;
  threshold: number;
  context: Record<string, unknown>;
  autoRemediation?: {
    action: string;
    applied: boolean;
    result?: string;
  };
}

export interface PredictiveInsights {
  timestamp: number;
  predictions: {
    nextHour: SystemMetrics;
    nextDay: Partial<SystemMetrics>;
    confidence: number; // 0-1
  };
  trends: {
    cpu: 'INCREASING' | 'DECREASING' | 'STABLE';
    memory: 'INCREASING' | 'DECREASING' | 'STABLE';
    latency: 'INCREASING' | 'DECREASING' | 'STABLE';
  };
  recommendations: Array<{
    action: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    impact: string;
    effort: string;
  }>;
}

export interface RealTimeOptimizationAction {
  timestamp: number;
  type:
    | 'ROUTING_ADJUSTMENT'
    | 'LOAD_BALANCE'
    | 'CIRCUIT_BREAKER'
    | 'SCALE_ADJUSTMENT'
    | 'CACHE_EVICTION';
  reason: string;
  parameters: Record<string, unknown>;
  estimatedImpact: {
    latencyImprovement?: number; // ms
    throughputGain?: number; // %
    resourceReduction?: number; // %
  };
  applied: boolean;
  result?: {
    success: boolean;
    actualImpact?: Record<string, number>;
    message: string;
  };
}

// ========================= MODULE INTERFACES =========================

export interface ISystemMetricsCollector {
  startCollection(): Promise<void>;
  stopCollection(): Promise<void>;
  getCurrentMetrics(): Promise<SystemMetrics>;
  getMetricsHistory(timeWindowMs?: number): SystemMetrics[];
  isCollectionActive(): boolean;
}

export interface ICircuitBreakerManager {
  getState(name: string): CircuitBreakerState | undefined;
  getAllStates(): CircuitBreakerState[];
  executeWithBreaker<T>(name: string, operation: () => Promise<T>): Promise<T>;
  resetBreaker(name: string): Promise<void>;
  updateConfig(name: string, config: Partial<CircuitBreakerConfig>): Promise<void>;
}

export interface IPerformanceAnomalyDetector {
  detectAnomalies(
    metrics: SystemMetrics,
    thresholds: PerformanceThresholds
  ): Promise<PerformanceAnomalyEvent[]>;
  getRecentAnomalies(timeWindowMs?: number): PerformanceAnomalyEvent[];
  subscribeToAnomalies(callback: (anomaly: PerformanceAnomalyEvent) => void): void;
  unsubscribeFromAnomalies(callback: (anomaly: PerformanceAnomalyEvent) => void): void;
}

export interface IPredictiveAnalytics {
  generateInsights(metricsHistory: SystemMetrics[]): Promise<PredictiveInsights>;
  getPredictions(): Promise<PredictiveInsights | undefined>;
  getOptimizationRecommendations(): Promise<RealTimeOptimizationAction[]>;
  updatePredictionModel(metrics: SystemMetrics[]): Promise<void>;
}

export interface IPerformanceOptimizationEngine {
  evaluateOptimizationTriggers(
    metrics: SystemMetrics,
    thresholds: PerformanceThresholds
  ): Promise<RealTimeOptimizationAction[]>;
  applyOptimization(action: RealTimeOptimizationAction): Promise<void>;
  getRecentOptimizations(timeWindowMs?: number): RealTimeOptimizationAction[];
  subscribeToOptimizations(callback: (action: RealTimeOptimizationAction) => void): void;
  unsubscribeFromOptimizations(callback: (action: RealTimeOptimizationAction) => void): void;
}

// ========================= CONFIGURATION INTERFACES =========================

export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface PerformanceSystemConfig {
  monitoringIntervalMs: number;
  metricBufferSize: number;
  predictionWindowSize: number;
  maxAnomalyHistory: number;
  circuitBreakers: Record<string, CircuitBreakerConfig>;
  thresholds: PerformanceThresholds;
}

export interface MetricsCollectionConfig {
  intervalMs: number;
  bufferSize: number;
  enableGCMonitoring: boolean;
  enableNetworkEstimation: boolean;
  enableDiskEstimation: boolean;
}

// ========================= EVENT TYPES =========================

export interface PerformanceEvent {
  timestamp: number;
  type: string;
  data: unknown;
}

export interface MetricsEvent extends PerformanceEvent {
  type: 'metrics';
  data: SystemMetrics;
}

export interface AnomalyEvent extends PerformanceEvent {
  type: 'anomaly';
  data: PerformanceAnomalyEvent;
}

export interface OptimizationEvent extends PerformanceEvent {
  type: 'optimization';
  data: RealTimeOptimizationAction;
}

export interface CircuitBreakerEvent extends PerformanceEvent {
  type: 'circuit-breaker';
  data: {
    name: string;
    oldState: CircuitBreakerState['state'];
    newState: CircuitBreakerState['state'];
    reason: string;
  };
}

// ========================= UTILITY TYPES =========================

export type MetricValue = number;
export type Timestamp = number;
export type MetricName = keyof SystemMetrics | string;
export type ThresholdLevel = 'warning' | 'critical';
export type TrendDirection = 'INCREASING' | 'DECREASING' | 'STABLE';
export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface MetricTrend {
  metric: MetricName;
  direction: TrendDirection;
  confidence: number;
  rate: number; // change per unit time
}

export interface ResourceUsage {
  current: number;
  average: number;
  peak: number;
  trend: TrendDirection;
}
