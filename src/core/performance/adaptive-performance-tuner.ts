// Adaptive Performance Tuner
// Core layer adaptive performance optimization

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

export interface TuningRecommendation {
  parameter: string;
  currentValue: unknown;
  recommendedValue: unknown;
  impact: 'low' | 'medium' | 'high';
  reason: string;
}

export interface AdaptivePerformanceTunerInterface {
  analyzePerformance(metrics: PerformanceMetrics): TuningRecommendation[];
  applyTuning(recommendations: TuningRecommendation[]): Promise<boolean>;
  getOptimalConfiguration(): Record<string, unknown>;
  
  // Additional method expected by request-execution-manager
  recordMetrics(responseTime: number, throughput: number, errorRate: number): void;
}

export class AdaptivePerformanceTuner implements AdaptivePerformanceTunerInterface {
  private currentConfig = {
    maxConcurrency: 10,
    batchSize: 5,
    timeout: 5000,
    cacheSize: 1000,
    retryAttempts: 3
  };
  
  private metricsHistory: Array<{
    responseTime: number;
    throughput: number;
    errorRate: number;
    timestamp: number;
  }> = [];
  
  private readonly MAX_HISTORY_SIZE = 1000;

  analyzePerformance(metrics: PerformanceMetrics): TuningRecommendation[] {
    const recommendations: TuningRecommendation[] = [];

    // CPU usage optimization
    if (metrics.cpuUsage > 80) {
      recommendations.push({
        parameter: 'maxConcurrency',
        currentValue: this.currentConfig.maxConcurrency,
        recommendedValue: Math.max(1, this.currentConfig.maxConcurrency - 2),
        impact: 'high',
        reason: 'High CPU usage detected, reducing concurrency'
      });
    } else if (metrics.cpuUsage < 30) {
      recommendations.push({
        parameter: 'maxConcurrency',
        currentValue: this.currentConfig.maxConcurrency,
        recommendedValue: this.currentConfig.maxConcurrency + 1,
        impact: 'medium',
        reason: 'Low CPU usage, can increase concurrency'
      });
    }

    // Memory optimization
    if (metrics.memoryUsage > 85) {
      recommendations.push({
        parameter: 'cacheSize',
        currentValue: this.currentConfig.cacheSize,
        recommendedValue: Math.max(100, this.currentConfig.cacheSize - 200),
        impact: 'medium',
        reason: 'High memory usage, reducing cache size'
      });
    }

    // Response time optimization
    if (metrics.responseTime > 2000) {
      recommendations.push({
        parameter: 'batchSize',
        currentValue: this.currentConfig.batchSize,
        recommendedValue: Math.min(20, this.currentConfig.batchSize + 2),
        impact: 'medium',
        reason: 'High response time, increasing batch size for efficiency'
      });
    }

    return recommendations;
  }

  async applyTuning(recommendations: TuningRecommendation[]): Promise<boolean> {
    try {
      for (const rec of recommendations) {
        if (rec.parameter in this.currentConfig) {
          (this.currentConfig as any)[rec.parameter] = rec.recommendedValue;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  getOptimalConfiguration(): Record<string, unknown> {
    return { ...this.currentConfig };
  }

  /**
   * Record performance metrics for later analysis
   */
  recordMetrics(responseTime: number, throughput: number, errorRate: number): void {
    const metric = {
      responseTime,
      throughput,
      errorRate,
      timestamp: Date.now()
    };

    this.metricsHistory.push(metric);

    // Trim history to prevent memory bloat
    if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) {
      this.metricsHistory = this.metricsHistory.slice(-this.MAX_HISTORY_SIZE / 2);
    }

    // Auto-tune based on recent metrics if needed
    if (this.metricsHistory.length >= 10) {
      this.autoTuneBasedOnMetrics();
    }
  }

  /**
   * Automatically apply tuning based on recorded metrics
   */
  private autoTuneBasedOnMetrics(): void {
    const recentMetrics = this.metricsHistory.slice(-10);
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
    const avgErrorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length;

    const syntheticMetrics: PerformanceMetrics = {
      cpuUsage: avgResponseTime > 5000 ? 85 : 45, // High response time indicates high CPU
      memoryUsage: 60, // Default
      responseTime: avgResponseTime,
      throughput: recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length,
      errorRate: avgErrorRate
    };

    const recommendations = this.analyzePerformance(syntheticMetrics);
    if (recommendations.length > 0) {
      this.applyTuning(recommendations);
    }
  }
}

export const adaptivePerformanceTuner = new AdaptivePerformanceTuner();

// Export alias for backward compatibility
export const adaptiveTuner = adaptivePerformanceTuner;