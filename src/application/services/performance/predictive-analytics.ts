/**
 * Predictive Analytics Engine
 * Implements machine learning patterns for performance prediction and optimization
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../infrastructure/logging/logger-adapter.js';
import type {
  SystemMetrics,
  PredictiveInsights,
  RealTimeOptimizationAction,
  IPredictiveAnalytics,
  MetricTrend,
  TrendDirection,
  PriorityLevel
} from './performance-types.js';

const logger = createLogger('PredictiveAnalytics');

interface PredictionModel {
  name: string;
  type: 'linear_regression' | 'exponential_smoothing' | 'moving_average' | 'seasonal';
  accuracy: number;
  lastTrained: number;
  parameters: Record<string, number>;
}

interface SeasonalPattern {
  period: number; // Period in metrics intervals
  amplitude: number;
  phase: number;
  confidence: number;
}

interface PredictionConfig {
  minDataPoints: number;
  maxHistorySize: number;
  trainingWindowSize: number;
  predictionHorizons: number[];
  enableSeasonalDetection: boolean;
  accuracyThreshold: number;
}

interface MetricPrediction {
  metric: string;
  currentValue: number;
  predictions: {
    nextValue: number;
    nextHour: number;
    nextDay: number;
    confidence: number;
  };
  trend: MetricTrend;
  seasonality?: SeasonalPattern;
}

export class PredictiveAnalytics extends EventEmitter implements IPredictiveAnalytics {
  private metricsHistory: SystemMetrics[] = [];
  private models: Map<string, PredictionModel> = new Map();
  private lastInsights?: PredictiveInsights;
  private seasonalPatterns: Map<string, SeasonalPattern> = new Map();
  
  private readonly config: PredictionConfig = {
    minDataPoints: 20,
    maxHistorySize: 1000,
    trainingWindowSize: 100,
    predictionHorizons: [1, 60, 1440], // Next, 1 hour, 1 day (in intervals)
    enableSeasonalDetection: true,
    accuracyThreshold: 0.7
  };

  constructor(config?: Partial<PredictionConfig>) {
    super();
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.initializePredictionModels();
    
    logger.info('PredictiveAnalytics initialized', { config: this.config });
  }

  /**
   * Generate predictive insights from metrics history
   */
  public async generateInsights(metricsHistory: SystemMetrics[]): Promise<PredictiveInsights> {
    // Store metrics for analysis
    this.storeMetrics(metricsHistory);
    
    if (this.metricsHistory.length < this.config.minDataPoints) {
      logger.debug('Insufficient data for prediction', { 
        available: this.metricsHistory.length, 
        required: this.config.minDataPoints 
      });
      
      return this.createBasicInsights();
    }
    
    try {
      // Update prediction models
      await this.updatePredictionModels();
      
      // Generate predictions for key metrics
      const predictions = await this.generateMetricPredictions();
      
      // Analyze trends
      const trends = this.analyzeTrends();
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(predictions, trends);
      
      // Create insights object
      const insights: PredictiveInsights = {
        timestamp: Date.now(),
        predictions: {
          nextHour: this.buildPredictedMetrics(predictions, 60) as SystemMetrics, // 1 hour ahead
          nextDay: this.buildPredictedMetrics(predictions, 1440, true) as Partial<SystemMetrics>, // 1 day ahead, partial
          confidence: this.calculateOverallConfidence(predictions)
        },
        trends,
        recommendations
      };
      
      this.lastInsights = insights;
      
      logger.info('Predictive insights generated', {
        metricsAnalyzed: this.metricsHistory.length,
        confidence: insights.predictions.confidence,
        recommendationsCount: insights.recommendations.length
      });
      
      this.emit('insights-generated', insights);
      
      return insights;
      
    } catch (error) {
      logger.error('Error generating predictive insights', { error });
      return this.createBasicInsights();
    }
  }

  /**
   * Get current predictions
   */
  public async getPredictions(): Promise<PredictiveInsights | undefined> {
    return this.lastInsights;
  }

  /**
   * Get optimization recommendations
   */
  public async getOptimizationRecommendations(): Promise<RealTimeOptimizationAction[]> {
    if (!this.lastInsights) {
      return [];
    }
    
    const recommendations: RealTimeOptimizationAction[] = [];
    const now = Date.now();
    
    // Convert insight recommendations to optimization actions
    for (const rec of this.lastInsights.recommendations) {
      const action: RealTimeOptimizationAction = {
        timestamp: now,
        type: this.mapRecommendationToActionType(rec.action),
        reason: `Predictive analytics: ${rec.action}`,
        parameters: {
          priority: rec.priority,
          impact: rec.impact,
          effort: rec.effort,
          confidence: this.lastInsights.predictions.confidence
        },
        estimatedImpact: this.estimateActionImpact(rec),
        applied: false
      };
      
      recommendations.push(action);
    }
    
    // Add proactive scaling recommendations
    if (this.shouldRecommendScaling()) {
      recommendations.push(this.createScalingRecommendation());
    }
    
    // Add cache optimization recommendations
    if (this.shouldRecommendCacheOptimization()) {
      recommendations.push(this.createCacheOptimizationRecommendation());
    }
    
    logger.debug('Generated optimization recommendations', { 
      count: recommendations.length,
      confidence: this.lastInsights.predictions.confidence 
    });
    
    return recommendations;
  }

  /**
   * Update prediction model with new data
   */
  public async updatePredictionModel(metrics: SystemMetrics[]): Promise<void> {
    this.storeMetrics(metrics);
    await this.updatePredictionModels();
    
    logger.debug('Prediction models updated', { 
      modelsCount: this.models.size,
      dataPoints: this.metricsHistory.length 
    });
  }

  /**
   * Store metrics for analysis
   */
  private storeMetrics(metrics: SystemMetrics[]): void {
    this.metricsHistory.push(...metrics);
    
    // Maintain history size limit
    if (this.metricsHistory.length > this.config.maxHistorySize) {
      const excess = this.metricsHistory.length - this.config.maxHistorySize;
      this.metricsHistory.splice(0, excess);
    }
    
    // Sort by timestamp to ensure chronological order
    this.metricsHistory.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Initialize prediction models
   */
  private initializePredictionModels(): void {
    const metrics = ['cpu_usage', 'memory_usage', 'gc_pause_time', 'network_latency'];
    
    metrics.forEach(metric => {
      // Initialize with linear regression model
      this.models.set(metric, {
        name: metric,
        type: 'linear_regression',
        accuracy: 0.5, // Initial low accuracy
        lastTrained: Date.now(),
        parameters: {
          slope: 0,
          intercept: 0,
          correlation: 0
        }
      });
    });
    
    logger.debug('Prediction models initialized', { count: this.models.size });
  }

  /**
   * Update prediction models with latest data
   */
  private async updatePredictionModels(): Promise<void> {
    if (this.metricsHistory.length < this.config.minDataPoints) {
      return;
    }
    
    const trainingData = this.metricsHistory.slice(-this.config.trainingWindowSize);
    
    // Update each model
    for (const [metricName, model] of this.models.entries()) {
      const values = this.extractMetricValues(trainingData, metricName);
      
      if (values.length >= this.config.minDataPoints) {
        await this.trainModel(model, values);
        
        // Detect seasonal patterns if enabled
        if (this.config.enableSeasonalDetection) {
          const seasonality = this.detectSeasonality(values, metricName);
          if (seasonality) {
            this.seasonalPatterns.set(metricName, seasonality);
          }
        }
      }
    }
  }

  /**
   * Train a specific prediction model
   */
  private async trainModel(model: PredictionModel, values: number[]): Promise<void> {
    switch (model.type) {
      case 'linear_regression':
        this.trainLinearRegression(model, values);
        break;
      case 'exponential_smoothing':
        this.trainExponentialSmoothing(model, values);
        break;
      case 'moving_average':
        this.trainMovingAverage(model, values);
        break;
      case 'seasonal':
        this.trainSeasonalModel(model, values);
        break;
    }
    
    model.lastTrained = Date.now();
  }

  /**
   * Train linear regression model
   */
  private trainLinearRegression(model: PredictionModel, values: number[]): void {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    // Calculate linear regression parameters
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + (val * values[i]), 0);
    const sumX2 = x.reduce((sum, val) => sum + (val * val), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation coefficient
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = x.reduce((sum, val, i) => sum + ((val - meanX) * (values[i] - meanY)), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
    const correlation = denomX && denomY ? numerator / (denomX * denomY) : 0;
    
    model.parameters = { slope, intercept, correlation };
    model.accuracy = Math.abs(correlation);
  }

  /**
   * Train exponential smoothing model
   */
  private trainExponentialSmoothing(model: PredictionModel, values: number[]): void {
    const alpha = 0.3; // Smoothing factor
    let smoothed = values[0];
    
    for (let i = 1; i < values.length; i++) {
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
    }
    
    model.parameters = { alpha, lastSmoothed: smoothed };
    
    // Calculate accuracy based on recent predictions
    const predictions = this.generateExpSmoothedPredictions(values, alpha);
    model.accuracy = this.calculatePredictionAccuracy(values.slice(-predictions.length), predictions);
  }

  /**
   * Train moving average model
   */
  private trainMovingAverage(model: PredictionModel, values: number[]): void {
    const windowSize = Math.min(10, Math.floor(values.length / 3));
    const recentValues = values.slice(-windowSize);
    const average = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    model.parameters = { windowSize, average };
    
    // Calculate accuracy
    const predictions = Array(windowSize).fill(average);
    model.accuracy = this.calculatePredictionAccuracy(recentValues, predictions);
  }

  /**
   * Train seasonal model
   */
  private trainSeasonalModel(model: PredictionModel, values: number[]): void {
    const seasonality = this.seasonalPatterns.get(model.name);
    if (!seasonality) {
      // Fallback to linear regression
      this.trainLinearRegression(model, values);
      return;
    }
    
    model.parameters = {
      period: seasonality.period,
      amplitude: seasonality.amplitude,
      phase: seasonality.phase,
      baseline: values.reduce((sum, val) => sum + val, 0) / values.length
    };
    
    model.accuracy = seasonality.confidence;
  }

  /**
   * Detect seasonal patterns in data
   */
  private detectSeasonality(values: number[], metricName: string): SeasonalPattern | null {
    if (values.length < 48) { // Need at least 48 data points for seasonal detection
      return null;
    }
    
    // Test for common periods (hourly patterns, daily patterns, etc.)
    const testPeriods = [12, 24, 48, 96]; // 12min, 24min, 48min, 96min intervals
    let bestPattern: SeasonalPattern | null = null;
    let bestScore = 0;
    
    for (const period of testPeriods) {
      if (values.length < period * 2) continue;
      
      const pattern = this.analyzePeriod(values, period);
      if (pattern && pattern.confidence > bestScore) {
        bestScore = pattern.confidence;
        bestPattern = pattern;
      }
    }
    
    if (bestPattern && bestPattern.confidence > 0.6) {
      logger.debug('Seasonal pattern detected', { 
        metric: metricName, 
        period: bestPattern.period,
        confidence: bestPattern.confidence 
      });
      return bestPattern;
    }
    
    return null;
  }

  /**
   * Analyze specific period for seasonality
   */
  private analyzePeriod(values: number[], period: number): SeasonalPattern | null {
    const cycles = Math.floor(values.length / period);
    if (cycles < 2) return null;
    
    // Extract complete cycles
    const cycleData: number[][] = [];
    for (let i = 0; i < cycles; i++) {
      const cycle = values.slice(i * period, (i + 1) * period);
      cycleData.push(cycle);
    }
    
    // Calculate average cycle
    const averageCycle = new Array(period).fill(0);
    for (let j = 0; j < period; j++) {
      for (let i = 0; i < cycles; i++) {
        averageCycle[j] += cycleData[i][j];
      }
      averageCycle[j] /= cycles;
    }
    
    // Calculate variance and amplitude
    const mean = averageCycle.reduce((sum, val) => sum + val, 0) / period;
    const variance = averageCycle.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const amplitude = Math.sqrt(variance);
    
    // Find phase (offset of peak)
    const maxIndex = averageCycle.indexOf(Math.max(...averageCycle));
    const phase = (maxIndex / period) * 2 * Math.PI;
    
    // Calculate confidence based on consistency across cycles
    let consistency = 0;
    for (let j = 0; j < period; j++) {
      const cycleValues = cycleData.map(cycle => cycle[j]);
      const cycleVariance = cycleValues.reduce((sum, val) => {
        return sum + Math.pow(val - averageCycle[j], 2);
      }, 0) / cycles;
      consistency += 1 / (1 + Math.sqrt(cycleVariance));
    }
    consistency /= period;
    
    return {
      period,
      amplitude,
      phase,
      confidence: Math.min(1, consistency * (amplitude / mean))
    };
  }

  /**
   * Generate predictions for key metrics
   */
  private async generateMetricPredictions(): Promise<MetricPrediction[]> {
    const predictions: MetricPrediction[] = [];
    
    for (const [metricName, model] of this.models.entries()) {
      if (model.accuracy < this.config.accuracyThreshold) {
        continue; // Skip low-accuracy models
      }
      
      const currentValue = this.getCurrentMetricValue(metricName);
      const prediction = this.predictMetricValue(model, metricName);
      const trend = this.calculateMetricTrend(metricName);
      
      // Skip if we can't calculate trend (insufficient data)
      if (!trend) {
        continue;
      }
      
      predictions.push({
        metric: metricName,
        currentValue,
        predictions: prediction,
        trend,
        seasonality: this.seasonalPatterns.get(metricName)
      });
    }
    
    return predictions;
  }

  /**
   * Predict future values for a metric
   */
  private predictMetricValue(model: PredictionModel, metricName: string): MetricPrediction['predictions'] {
    const currentValue = this.getCurrentMetricValue(metricName);
    let nextValue = currentValue;
    let nextHour = currentValue;
    let nextDay = currentValue;
    
    switch (model.type) {
      case 'linear_regression':
        const n = this.metricsHistory.length;
        nextValue = model.parameters.slope * n + model.parameters.intercept;
        nextHour = model.parameters.slope * (n + 60) + model.parameters.intercept;
        nextDay = model.parameters.slope * (n + 1440) + model.parameters.intercept;
        break;
        
      case 'exponential_smoothing':
        nextValue = model.parameters.lastSmoothed;
        nextHour = model.parameters.lastSmoothed;
        nextDay = model.parameters.lastSmoothed;
        break;
        
      case 'moving_average':
        nextValue = model.parameters.average;
        nextHour = model.parameters.average;
        nextDay = model.parameters.average;
        break;
        
      case 'seasonal':
        const seasonality = this.seasonalPatterns.get(metricName);
        if (seasonality) {
          const time1 = (Date.now() / 1000) / seasonality.period;
          const time60 = time1 + (60 * 60) / seasonality.period;
          const time1440 = time1 + (24 * 60 * 60) / seasonality.period;
          
          nextValue = model.parameters.baseline + 
            seasonality.amplitude * Math.sin(2 * Math.PI * time1 + seasonality.phase);
          nextHour = model.parameters.baseline + 
            seasonality.amplitude * Math.sin(2 * Math.PI * time60 + seasonality.phase);
          nextDay = model.parameters.baseline + 
            seasonality.amplitude * Math.sin(2 * Math.PI * time1440 + seasonality.phase);
        }
        break;
    }
    
    // Ensure predictions are within reasonable bounds
    nextValue = this.boundPrediction(nextValue, metricName);
    nextHour = this.boundPrediction(nextHour, metricName);
    nextDay = this.boundPrediction(nextDay, metricName);
    
    return {
      nextValue,
      nextHour,
      nextDay,
      confidence: model.accuracy
    };
  }

  /**
   * Bound predictions within reasonable limits
   */
  private boundPrediction(value: number, metricName: string): number {
    switch (metricName) {
      case 'cpu_usage':
      case 'memory_usage':
        return Math.max(0, Math.min(100, value));
      case 'gc_pause_time':
        return Math.max(0, Math.min(1000, value));
      case 'network_latency':
        return Math.max(0, Math.min(10000, value));
      default:
        return Math.max(0, value);
    }
  }

  /**
   * Get current value for a metric
   */
  private getCurrentMetricValue(metricName: string): number {
    if (this.metricsHistory.length === 0) return 0;
    
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    return this.extractMetricValue(latest, metricName);
  }

  /**
   * Extract specific metric value from SystemMetrics
   */
  private extractMetricValue(metrics: SystemMetrics, metricName: string): number {
    switch (metricName) {
      case 'cpu_usage': return metrics.cpu.usage;
      case 'memory_usage': return metrics.memory.usage;
      case 'gc_pause_time': return metrics.gc.pauseTime;
      case 'network_latency': return metrics.network.latencyP95;
      default: return 0;
    }
  }

  /**
   * Extract metric values from metrics array
   */
  private extractMetricValues(metricsArray: SystemMetrics[], metricName: string): number[] {
    return metricsArray.map(metrics => this.extractMetricValue(metrics, metricName));
  }

  /**
   * Analyze trends in metrics
   */
  private analyzeTrends(): PredictiveInsights['trends'] {
    const cpuTrend = this.calculateMetricTrend('cpu_usage');
    const memoryTrend = this.calculateMetricTrend('memory_usage');
    const latencyTrend = this.calculateMetricTrend('network_latency');
    
    return {
      cpu: cpuTrend?.direction || 'STABLE',
      memory: memoryTrend?.direction || 'STABLE',
      latency: latencyTrend?.direction || 'STABLE'
    };
  }

  /**
   * Calculate trend for specific metric
   */
  private calculateMetricTrend(metricName: string): MetricTrend | null {
    if (this.metricsHistory.length < 10) return null;
    
    const recentValues = this.extractMetricValues(
      this.metricsHistory.slice(-20), 
      metricName
    );
    
    // Simple linear regression for trend
    const n = recentValues.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = recentValues.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + (val * recentValues[i]), 0);
    const sumX2 = x.reduce((sum, val) => sum + (val * val), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const meanY = sumY / n;
    
    let direction: TrendDirection = 'STABLE';
    const threshold = meanY * 0.01; // 1% of mean as threshold
    
    if (slope > threshold) direction = 'INCREASING';
    else if (slope < -threshold) direction = 'DECREASING';
    
    // Calculate confidence based on R-squared
    const predictions = x.map(xi => slope * xi + (sumY - slope * sumX) / n);
    const confidence = this.calculatePredictionAccuracy(recentValues, predictions);
    
    return {
      metric: metricName,
      direction,
      confidence: Math.max(0, Math.min(1, confidence)),
      rate: Math.abs(slope)
    };
  }

  /**
   * Calculate prediction accuracy
   */
  private calculatePredictionAccuracy(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;
    
    const mse = actual.reduce((sum, val, i) => {
      return sum + Math.pow(val - predicted[i], 2);
    }, 0) / actual.length;
    
    const variance = actual.reduce((sum, val) => {
      const mean = actual.reduce((s, v) => s + v, 0) / actual.length;
      return sum + Math.pow(val - mean, 2);
    }, 0) / actual.length;
    
    // R-squared
    return Math.max(0, 1 - (mse / variance));
  }

  /**
   * Generate exponential smoothed predictions
   */
  private generateExpSmoothedPredictions(values: number[], alpha: number): number[] {
    const predictions: number[] = [];
    let smoothed = values[0];
    
    for (let i = 1; i < values.length; i++) {
      predictions.push(smoothed);
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
    }
    
    return predictions;
  }

  /**
   * Build predicted system metrics
   */
  private buildPredictedMetrics(predictions: MetricPrediction[], horizon: number, partial: boolean = false): SystemMetrics | Partial<SystemMetrics> {
    const baseMetrics: Partial<SystemMetrics> = {
      timestamp: Date.now() + (horizon * 60 * 1000) // Convert minutes to milliseconds
    };
    
    predictions.forEach(pred => {
      const value = horizon === 1 ? pred.predictions.nextValue :
                   horizon === 60 ? pred.predictions.nextHour :
                   pred.predictions.nextDay;
      
      switch (pred.metric) {
        case 'cpu_usage':
          if (!baseMetrics.cpu) baseMetrics.cpu = {} as any;
          (baseMetrics.cpu as any).usage = Math.round(value);
          break;
        case 'memory_usage':
          if (!baseMetrics.memory) baseMetrics.memory = {} as any;
          (baseMetrics.memory as any).usage = Math.round(value);
          break;
        case 'gc_pause_time':
          if (!baseMetrics.gc) baseMetrics.gc = {} as any;
          (baseMetrics.gc as any).pauseTime = Math.round(value * 100) / 100;
          break;
        case 'network_latency':
          if (!baseMetrics.network) baseMetrics.network = {} as any;
          (baseMetrics.network as any).latencyP95 = Math.round(value);
          break;
      }
    });
    
    if (partial) {
      return baseMetrics;
    }
    
    // Fill in missing fields with current values if building complete metrics
    const current = this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null;
    if (current) {
      return {
        timestamp: baseMetrics.timestamp!,
        cpu: { ...current.cpu, ...(baseMetrics.cpu || {}) },
        memory: { ...current.memory, ...(baseMetrics.memory || {}) },
        network: { ...current.network, ...(baseMetrics.network || {}) },
        disk: current.disk,
        gc: { ...current.gc, ...(baseMetrics.gc || {}) }
      } as SystemMetrics;
    }
    
    return baseMetrics;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(predictions: MetricPrediction[]): number {
    if (predictions.length === 0) return 0;
    
    const totalConfidence = predictions.reduce((sum, pred) => sum + pred.predictions.confidence, 0);
    return Math.round((totalConfidence / predictions.length) * 100) / 100;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(predictions: MetricPrediction[], trends: PredictiveInsights['trends']): PredictiveInsights['recommendations'] {
    const recommendations: PredictiveInsights['recommendations'] = [];
    
    // CPU-based recommendations
    const cpuPred = predictions.find(p => p.metric === 'cpu_usage');
    if (cpuPred && cpuPred.predictions.nextHour > 80) {
      recommendations.push({
        action: 'Scale up processing capacity or optimize CPU-intensive operations',
        priority: cpuPred.predictions.nextHour > 90 ? 'HIGH' : 'MEDIUM',
        impact: 'Prevent CPU bottlenecks and maintain performance',
        effort: 'Medium - requires resource scaling or code optimization'
      });
    }
    
    // Memory-based recommendations
    const memoryPred = predictions.find(p => p.metric === 'memory_usage');
    if (memoryPred && (memoryPred.predictions.nextHour > 85 || trends.memory === 'INCREASING')) {
      recommendations.push({
        action: 'Implement memory optimization or increase available memory',
        priority: memoryPred.predictions.nextHour > 90 ? 'HIGH' : 'MEDIUM',
        impact: 'Prevent memory exhaustion and reduce GC pressure',
        effort: 'Low to Medium - memory tuning and garbage collection optimization'
      });
    }
    
    // Latency-based recommendations
    const latencyPred = predictions.find(p => p.metric === 'network_latency');
    if (latencyPred && latencyPred.predictions.nextHour > 1000) {
      recommendations.push({
        action: 'Optimize routing strategy for lower latency',
        priority: 'MEDIUM',
        impact: 'Improve response times and user experience',
        effort: 'Low - adjust routing preferences and load balancing'
      });
    }
    
    // Trend-based recommendations
    if (trends.cpu === 'INCREASING' && trends.memory === 'INCREASING') {
      recommendations.push({
        action: 'Investigate potential resource leaks or excessive load',
        priority: 'HIGH',
        impact: 'Prevent system degradation and potential failures',
        effort: 'Medium - requires investigation and debugging'
      });
    }
    
    // Proactive recommendations based on patterns
    if (this.seasonalPatterns.size > 0) {
      recommendations.push({
        action: 'Implement predictive scaling based on detected usage patterns',
        priority: 'LOW',
        impact: 'Optimize resource utilization and cost efficiency',
        effort: 'Medium - implement automated scaling policies'
      });
    }
    
    return recommendations;
  }

  /**
   * Create basic insights when insufficient data
   */
  private createBasicInsights(): PredictiveInsights {
    const now = Date.now();
    const currentMetrics = this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
    
    return {
      timestamp: now,
      predictions: {
        nextHour: currentMetrics || {} as SystemMetrics,
        nextDay: currentMetrics ? {
          timestamp: currentMetrics.timestamp,
          cpu: { 
            usage: currentMetrics.cpu.usage,
            loadAvg: currentMetrics.cpu.loadAvg,
            cores: currentMetrics.cpu.cores
          },
          memory: { 
            usage: currentMetrics.memory.usage,
            used: currentMetrics.memory.used,
            free: currentMetrics.memory.free,
            total: currentMetrics.memory.total,
            heapUsed: currentMetrics.memory.heapUsed,
            heapTotal: currentMetrics.memory.heapTotal,
            external: currentMetrics.memory.external
          }
        } : {} as Partial<SystemMetrics>,
        confidence: 0.3 // Low confidence with insufficient data
      },
      trends: {
        cpu: 'STABLE',
        memory: 'STABLE',
        latency: 'STABLE'
      },
      recommendations: [{
        action: 'Continue monitoring to build prediction accuracy',
        priority: 'LOW',
        impact: 'Improve predictive analytics over time',
        effort: 'No action required - automatic data collection'
      }]
    };
  }

  /**
   * Map recommendation to optimization action type
   */
  private mapRecommendationToActionType(action: string): RealTimeOptimizationAction['type'] {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('scale') || actionLower.includes('capacity')) {
      return 'SCALE_ADJUSTMENT';
    }
    if (actionLower.includes('routing') || actionLower.includes('latency')) {
      return 'ROUTING_ADJUSTMENT';
    }
    if (actionLower.includes('memory') || actionLower.includes('cache')) {
      return 'CACHE_EVICTION';
    }
    if (actionLower.includes('circuit') || actionLower.includes('breaker')) {
      return 'CIRCUIT_BREAKER';
    }
    if (actionLower.includes('load') || actionLower.includes('balance')) {
      return 'LOAD_BALANCE';
    }
    
    return 'ROUTING_ADJUSTMENT'; // Default
  }

  /**
   * Estimate impact of optimization action
   */
  private estimateActionImpact(recommendation: PredictiveInsights['recommendations'][0]): RealTimeOptimizationAction['estimatedImpact'] {
    const impact: RealTimeOptimizationAction['estimatedImpact'] = {};
    
    const actionLower = recommendation.action.toLowerCase();
    
    if (actionLower.includes('cpu') || actionLower.includes('scale')) {
      impact.resourceReduction = 15; // 15% CPU reduction
      impact.latencyImprovement = 100; // 100ms improvement
    }
    
    if (actionLower.includes('memory')) {
      impact.resourceReduction = 20; // 20% memory reduction
    }
    
    if (actionLower.includes('latency') || actionLower.includes('routing')) {
      impact.latencyImprovement = 200; // 200ms improvement
      impact.throughputGain = 10; // 10% throughput gain
    }
    
    return impact;
  }

  /**
   * Check if scaling recommendation is needed
   */
  private shouldRecommendScaling(): boolean {
    if (!this.lastInsights) return false;
    
    const { predictions } = this.lastInsights;
    const cpuUsage = predictions.nextHour.cpu?.usage || 0;
    const memoryUsage = predictions.nextHour.memory?.usage || 0;
    
    return cpuUsage > 80 || memoryUsage > 85;
  }

  /**
   * Create scaling recommendation
   */
  private createScalingRecommendation(): RealTimeOptimizationAction {
    return {
      timestamp: Date.now(),
      type: 'SCALE_ADJUSTMENT',
      reason: 'Predictive analytics indicates upcoming resource constraints',
      parameters: {
        trigger: 'predictive_scaling',
        confidence: this.lastInsights?.predictions.confidence || 0.5
      },
      estimatedImpact: {
        resourceReduction: 25,
        latencyImprovement: 150,
        throughputGain: 20
      },
      applied: false
    };
  }

  /**
   * Check if cache optimization is recommended
   */
  private shouldRecommendCacheOptimization(): boolean {
    if (this.metricsHistory.length < 10) return false;
    
    const recent = this.metricsHistory.slice(-10);
    const avgGCPause = recent.reduce((sum, m) => sum + m.gc.pauseTime, 0) / recent.length;
    const avgFragmentation = recent.reduce((sum, m) => sum + m.gc.heapFragmentation, 0) / recent.length;
    
    return avgGCPause > 50 || avgFragmentation > 0.3;
  }

  /**
   * Create cache optimization recommendation
   */
  private createCacheOptimizationRecommendation(): RealTimeOptimizationAction {
    return {
      timestamp: Date.now(),
      type: 'CACHE_EVICTION',
      reason: 'High GC pressure detected, cache optimization recommended',
      parameters: {
        trigger: 'gc_pressure',
        avgGCPause: this.metricsHistory.length > 0 
          ? this.metricsHistory.slice(-5).reduce((sum, m) => sum + m.gc.pauseTime, 0) / 5
          : 0
      },
      estimatedImpact: {
        resourceReduction: 15,
        latencyImprovement: 75
      },
      applied: false
    };
  }

  /**
   * Get model statistics
   */
  public getModelStats(): {
    totalModels: number;
    modelAccuracy: Record<string, number>;
    seasonalPatterns: number;
    dataPoints: number;
    lastUpdate: number;
  } {
    const modelAccuracy: Record<string, number> = {};
    this.models.forEach((model, name) => {
      modelAccuracy[name] = Math.round(model.accuracy * 100) / 100;
    });
    
    return {
      totalModels: this.models.size,
      modelAccuracy,
      seasonalPatterns: this.seasonalPatterns.size,
      dataPoints: this.metricsHistory.length,
      lastUpdate: Math.max(...Array.from(this.models.values()).map(m => m.lastTrained))
    };
  }
}