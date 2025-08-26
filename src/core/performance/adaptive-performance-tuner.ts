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
}

export class AdaptivePerformanceTuner implements AdaptivePerformanceTunerInterface {
  private currentConfig = {
    maxConcurrency: 10,
    batchSize: 5,
    timeout: 5000,
    cacheSize: 1000,
    retryAttempts: 3
  };

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
}

export const adaptivePerformanceTuner = new AdaptivePerformanceTuner();

// Export alias for backward compatibility
export const adaptiveTuner = adaptivePerformanceTuner;