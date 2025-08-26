/**
 * MCP Performance Analytics System
 * 
 * Comprehensive monitoring and analytics for MCP server performance including:
 * - Real-time performance metrics collection and analysis
 * - Predictive performance modeling and capacity planning
 * - Anomaly detection and automated optimization
 * - Business intelligence and reporting dashboards
 * - SLA monitoring and compliance tracking
 * - Cost optimization and resource efficiency analysis
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface PerformanceMetric {
  metricId: string;
  timestamp: Date;
  connectionId: string;
  serverId: string;
  serverName: string;
  voiceId?: string;
  capability?: string;
  
  // Performance measurements
  responseTime: number;
  throughput: number; // requests per second
  errorRate: number; // percentage
  availability: number; // percentage
  
  // Resource utilization
  cpuUsage?: number;
  memoryUsage?: number;
  networkLatency?: number;
  diskIoLatency?: number;
  
  // Quality metrics
  successRate: number;
  reliability: number;
  accuracy?: number;
  
  // Business metrics
  cost?: number;
  userSatisfaction?: number;
  businessValue?: number;
}

export interface PerformanceAlert {
  alertId: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: 'performance' | 'availability' | 'error-rate' | 'capacity' | 'cost';
  
  connectionId: string;
  serverId: string;
  description: string;
  
  // Alert details
  currentValue: number;
  threshold: number;
  duration: number; // milliseconds
  
  // Context
  affectedComponents: string[];
  potentialImpact: string;
  recommendedActions: string[];
  
  // Status
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceTrend {
  metricType: string;
  timeRange: string;
  
  // Statistical analysis
  mean: number;
  median: number;
  standardDeviation: number;
  percentile95: number;
  percentile99: number;
  
  // Trend analysis
  trend: 'improving' | 'stable' | 'degrading';
  trendConfidence: number; // 0-100
  changeRate: number; // percentage change over time
  
  // Seasonality
  hasSeasonality: boolean;
  seasonalPeriod?: number;
  seasonalAmplitude?: number;
  
  // Forecasting
  forecast: number[];
  forecastConfidence: number[];
}

export interface CapacityPlan {
  planId: string;
  serverId: string;
  planDate: Date;
  
  // Current capacity
  currentCapacity: {
    maxThroughput: number;
    maxConcurrentConnections: number;
    storageCapacity: number;
    networkBandwidth: number;
  };
  
  // Usage projections
  projectedLoad: {
    timeHorizon: string; // e.g., "3 months", "1 year"
    expectedThroughput: number;
    expectedConnections: number;
    confidenceInterval: [number, number];
  };
  
  // Scaling recommendations
  scalingRecommendations: {
    scaleType: 'horizontal' | 'vertical' | 'hybrid';
    timeToScale: Date;
    resourceRequirements: any;
    estimatedCost: number;
  };
  
  // Risk assessment
  riskFactors: string[];
  probabilityOfBottleneck: number;
  criticalPath: string[];
}

export interface PerformanceReport {
  reportId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  generatedAt: Date;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  
  // Executive summary
  summary: {
    totalRequests: number;
    avgResponseTime: number;
    overallAvailability: number;
    topPerformingServers: string[];
    problemAreas: string[];
  };
  
  // Detailed metrics
  serverPerformance: Map<string, ServerPerformanceReport>;
  voicePerformance: Map<string, VoicePerformanceReport>;
  
  // SLA compliance
  slaCompliance: SLAComplianceReport;
  
  // Cost analysis
  costAnalysis: CostAnalysisReport;
  
  // Recommendations
  recommendations: PerformanceRecommendation[];
}

export interface ServerPerformanceReport {
  serverId: string;
  serverName: string;
  
  // Aggregate metrics
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
  availability: number;
  
  // Performance trends
  responseTimeTrend: PerformanceTrend;
  throughputTrend: PerformanceTrend;
  errorRateTrend: PerformanceTrend;
  
  // Resource utilization
  resourceUtilization: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    peakNetworkUsage: number;
  };
  
  // Quality assessment
  reliabilityScore: number;
  performanceScore: number;
  userSatisfactionScore: number;
  
  // Issues and alerts
  totalAlerts: number;
  criticalAlerts: number;
  resolvedIssues: number;
}

export interface VoicePerformanceReport {
  voiceId: string;
  voiceName: string;
  
  // Usage statistics
  totalRequests: number;
  preferredCapabilities: string[];
  serverUsageDistribution: Map<string, number>;
  
  // Performance metrics
  avgResponseTime: number;
  successRate: number;
  userSatisfactionScore: number;
  
  // Efficiency analysis
  costPerRequest: number;
  timeToComplete: number;
  resourceEfficiency: number;
}

export interface SLAComplianceReport {
  overallCompliance: number; // percentage
  
  slaBreaches: {
    responseTime: number;
    availability: number;
    errorRate: number;
  };
  
  complianceByServer: Map<string, number>;
  impactAssessment: string[];
}

export interface CostAnalysisReport {
  totalCost: number;
  costBreakdown: {
    serverCosts: Map<string, number>;
    networkCosts: number;
    storageCosts: number;
    operationalCosts: number;
  };
  
  costOptimizationOpportunities: {
    potentialSavings: number;
    optimizationStrategies: string[];
  };
  
  costTrends: {
    monthOverMonth: number;
    yearOverYear: number;
  };
}

export interface PerformanceRecommendation {
  recommendationId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'capacity' | 'cost' | 'reliability' | 'security';
  
  title: string;
  description: string;
  rationale: string;
  
  // Implementation details
  implementationComplexity: 'low' | 'medium' | 'high';
  estimatedEffort: string;
  expectedBenefit: string;
  
  // Business impact
  businessValue: number;
  riskReduction: number;
  costImpact: number;
  
  // Timeline
  recommendedBy: Date;
  targetImplementation: Date;
  
  // Status tracking
  status: 'proposed' | 'approved' | 'in-progress' | 'completed' | 'rejected';
  implementationNotes?: string;
}

export class MCPPerformanceAnalyticsSystem extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private trends: Map<string, PerformanceTrend> = new Map();
  private capacityPlans: Map<string, CapacityPlan> = new Map();
  private reports: PerformanceReport[] = [];
  
  // Real-time monitoring
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private alertThresholds: Map<string, any> = new Map();
  
  // Machine learning models
  private performancePredictor: PerformancePredictor = new PerformancePredictor();
  private anomalyDetector: PerformanceAnomalyDetector = new PerformanceAnomalyDetector();
  private optimizationEngine: OptimizationEngine = new OptimizationEngine();
  
  // Configuration
  private readonly METRIC_RETENTION_DAYS = 90;
  private readonly ALERT_RETENTION_DAYS = 30;
  private readonly MONITORING_INTERVAL = 60000; // 1 minute
  private readonly TREND_ANALYSIS_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
  
  constructor() {
    super();
    this.initializeDefaultThresholds();
    this.startRealTimeMonitoring();
    this.startTrendAnalysis();
    this.startReportGeneration();
  }

  /**
   * Initialize default alert thresholds
   */
  private initializeDefaultThresholds(): void {
    const defaultThresholds = {
      responseTime: {
        warning: 5000, // 5 seconds
        error: 10000,  // 10 seconds
        critical: 30000, // 30 seconds
      },
      errorRate: {
        warning: 5,   // 5%
        error: 10,    // 10%
        critical: 20, // 20%
      },
      availability: {
        warning: 95,  // 95%
        error: 90,    // 90%
        critical: 85, // 85%
      },
      throughput: {
        warning: 10,  // requests per second
        error: 5,
        critical: 1,
      },
      cpuUsage: {
        warning: 80,  // 80%
        error: 90,    // 90%
        critical: 95, // 95%
      },
      memoryUsage: {
        warning: 80,  // 80%
        error: 90,    // 90%
        critical: 95, // 95%
      },
    };

    this.alertThresholds.set('default', defaultThresholds);
    logger.info('Initialized default performance alert thresholds');
  }

  /**
   * Record performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Emit real-time metric event
    this.emit('metric-recorded', metric);
    
    // Check for alert conditions
    this.checkAlertConditions(metric);
    
    // Update ML models
    this.performancePredictor.addDataPoint(metric);
    this.anomalyDetector.analyzeMetric(metric);
    
    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(metric: PerformanceMetric): void {
    const thresholds = this.alertThresholds.get('default') || {};
    
    // Check response time
    if (metric.responseTime > thresholds.responseTime?.critical) {
      this.createAlert(metric, 'performance', 'critical', 
        `Response time critically high: ${metric.responseTime}ms`);
    } else if (metric.responseTime > thresholds.responseTime?.error) {
      this.createAlert(metric, 'performance', 'error',
        `Response time high: ${metric.responseTime}ms`);
    } else if (metric.responseTime > thresholds.responseTime?.warning) {
      this.createAlert(metric, 'performance', 'warning',
        `Response time elevated: ${metric.responseTime}ms`);
    }

    // Check error rate
    if (metric.errorRate > thresholds.errorRate?.critical) {
      this.createAlert(metric, 'error-rate', 'critical',
        `Error rate critically high: ${metric.errorRate}%`);
    } else if (metric.errorRate > thresholds.errorRate?.error) {
      this.createAlert(metric, 'error-rate', 'error',
        `Error rate high: ${metric.errorRate}%`);
    } else if (metric.errorRate > thresholds.errorRate?.warning) {
      this.createAlert(metric, 'error-rate', 'warning',
        `Error rate elevated: ${metric.errorRate}%`);
    }

    // Check availability
    if (metric.availability < thresholds.availability?.critical) {
      this.createAlert(metric, 'availability', 'critical',
        `Availability critically low: ${metric.availability}%`);
    } else if (metric.availability < thresholds.availability?.error) {
      this.createAlert(metric, 'availability', 'error',
        `Availability low: ${metric.availability}%`);
    } else if (metric.availability < thresholds.availability?.warning) {
      this.createAlert(metric, 'availability', 'warning',
        `Availability degraded: ${metric.availability}%`);
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(
    metric: PerformanceMetric,
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    description: string
  ): void {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const alert: PerformanceAlert = {
      alertId,
      timestamp: new Date(),
      severity,
      type,
      connectionId: metric.connectionId,
      serverId: metric.serverId,
      description,
      currentValue: this.extractRelevantValue(metric, type),
      threshold: this.getThreshold(type, severity),
      duration: 0,
      affectedComponents: [metric.serverName],
      potentialImpact: this.assessPotentialImpact(severity, type),
      recommendedActions: this.getRecommendedActions(type, severity),
      acknowledged: false,
      resolved: false,
    };

    this.alerts.push(alert);
    
    logger.warn(`Performance alert created: ${description}`, {
      alertId,
      severity,
      serverId: metric.serverId,
    });
    
    this.emit('alert-created', alert);
    
    // Auto-acknowledge info alerts
    if (severity === 'info') {
      setTimeout(() => this.acknowledgeAlert(alertId), 5000);
    }
  }

  private extractRelevantValue(metric: PerformanceMetric, type: PerformanceAlert['type']): number {
    switch (type) {
      case 'performance':
        return metric.responseTime;
      case 'availability':
        return metric.availability;
      case 'error-rate':
        return metric.errorRate;
      case 'capacity':
        return metric.throughput;
      default:
        return 0;
    }
  }

  private getThreshold(type: PerformanceAlert['type'], severity: PerformanceAlert['severity']): number {
    const thresholds = this.alertThresholds.get('default') || {};
    
    switch (type) {
      case 'performance':
        return thresholds.responseTime?.[severity] || 0;
      case 'availability':
        return thresholds.availability?.[severity] || 0;
      case 'error-rate':
        return thresholds.errorRate?.[severity] || 0;
      default:
        return 0;
    }
  }

  private assessPotentialImpact(severity: PerformanceAlert['severity'], type: PerformanceAlert['type']): string {
    if (severity === 'critical') {
      return 'Service degradation or outage affecting multiple users';
    } else if (severity === 'error') {
      return 'Performance degradation affecting user experience';
    } else if (severity === 'warning') {
      return 'Potential performance issues may develop';
    }
    return 'Minimal impact expected';
  }

  private getRecommendedActions(type: PerformanceAlert['type'], severity: PerformanceAlert['severity']): string[] {
    const actions: string[] = [];
    
    if (type === 'performance') {
      actions.push('Check server resource utilization');
      actions.push('Review recent configuration changes');
      if (severity === 'critical') {
        actions.push('Consider scaling server resources');
        actions.push('Implement traffic throttling if necessary');
      }
    } else if (type === 'availability') {
      actions.push('Check server connectivity');
      actions.push('Verify server health status');
      actions.push('Review system logs for errors');
    } else if (type === 'error-rate') {
      actions.push('Analyze error patterns in logs');
      actions.push('Check for recent deployments');
      actions.push('Verify input validation and error handling');
    }
    
    return actions;
  }

  /**
   * Analyze performance trends
   */
  async analyzePerformanceTrends(): Promise<void> {
    logger.info('Starting performance trend analysis...');
    
    const now = Date.now();
    const analysisWindow = now - this.TREND_ANALYSIS_WINDOW;
    
    // Filter metrics within analysis window
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp.getTime() > analysisWindow
    );
    
    // Group metrics by server and metric type
    const metricGroups = this.groupMetricsByServer(recentMetrics);
    
    for (const [serverId, serverMetrics] of metricGroups) {
      // Analyze each metric type
      const metricTypes = ['responseTime', 'errorRate', 'availability', 'throughput'];
      
      for (const metricType of metricTypes) {
        const trend = await this.analyzeTrendForMetric(serverMetrics, metricType);
        if (trend) {
          this.trends.set(`${serverId}-${metricType}`, trend);
        }
      }
    }
    
    logger.info(`Completed trend analysis for ${metricGroups.size} servers`);
    this.emit('trend-analysis-completed', this.trends);
  }

  private groupMetricsByServer(metrics: PerformanceMetric[]): Map<string, PerformanceMetric[]> {
    const groups = new Map<string, PerformanceMetric[]>();
    
    for (const metric of metrics) {
      if (!groups.has(metric.serverId)) {
        groups.set(metric.serverId, []);
      }
      groups.get(metric.serverId)!.push(metric);
    }
    
    return groups;
  }

  private async analyzeTrendForMetric(
    metrics: PerformanceMetric[],
    metricType: string
  ): Promise<PerformanceTrend | null> {
    if (metrics.length < 10) {
      return null; // Insufficient data for trend analysis
    }
    
    // Extract values for the specific metric type
    const values = metrics.map(m => this.extractMetricValue(m, metricType));
    const timestamps = metrics.map(m => m.timestamp.getTime());
    
    // Statistical analysis
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    const percentile95 = sortedValues[Math.floor(sortedValues.length * 0.95)];
    const percentile99 = sortedValues[Math.floor(sortedValues.length * 0.99)];
    
    // Trend analysis using linear regression
    const trendAnalysis = this.calculateLinearTrend(timestamps, values);
    
    // Seasonality detection
    const seasonality = this.detectSeasonality(values);
    
    // Forecasting
    const forecast = await this.performancePredictor.forecast(metricType, values, 12); // 12 future points
    
    return {
      metricType,
      timeRange: '24h',
      mean,
      median,
      standardDeviation,
      percentile95,
      percentile99,
      trend: trendAnalysis.trend,
      trendConfidence: trendAnalysis.confidence,
      changeRate: trendAnalysis.changeRate,
      hasSeasonality: seasonality.detected,
      seasonalPeriod: seasonality.period,
      seasonalAmplitude: seasonality.amplitude,
      forecast: forecast.values,
      forecastConfidence: forecast.confidence,
    };
  }

  private extractMetricValue(metric: PerformanceMetric, metricType: string): number {
    switch (metricType) {
      case 'responseTime':
        return metric.responseTime;
      case 'errorRate':
        return metric.errorRate;
      case 'availability':
        return metric.availability;
      case 'throughput':
        return metric.throughput;
      default:
        return 0;
    }
  }

  private calculateLinearTrend(timestamps: number[], values: number[]): any {
    // Simple linear regression
    const n = values.length;
    const sumX = timestamps.reduce((sum, t) => sum + t, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = timestamps.reduce((sum, t, i) => sum + t * values[i], 0);
    const sumX2 = timestamps.reduce((sum, t) => sum + t * t, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const totalSumSquares = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const residualSumSquares = timestamps.reduce((sum, x, i) => {
      const predicted = slope * x + intercept;
      return sum + Math.pow(values[i] - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    const confidence = Math.max(0, Math.min(100, rSquared * 100));
    
    // Determine trend direction
    let trend: 'improving' | 'stable' | 'degrading';
    if (Math.abs(slope) < 0.01) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'degrading'; // For most metrics, increasing is bad
    } else {
      trend = 'improving';
    }
    
    const changeRate = Math.abs(slope) / yMean * 100;
    
    return { trend, confidence, changeRate, slope, intercept };
  }

  private detectSeasonality(values: number[]): { detected: boolean; period?: number; amplitude?: number } {
    if (values.length < 24) {
      return { detected: false };
    }
    
    // Simple autocorrelation-based seasonality detection
    // This is a simplified approach - production would use more sophisticated methods
    const autocorrelations: number[] = [];
    
    for (let lag = 1; lag <= Math.min(12, Math.floor(values.length / 2)); lag++) {
      const correlation = this.calculateAutocorrelation(values, lag);
      autocorrelations.push(correlation);
    }
    
    const maxCorrelation = Math.max(...autocorrelations);
    const period = autocorrelations.indexOf(maxCorrelation) + 1;
    
    if (maxCorrelation > 0.3) { // Threshold for seasonality detection
      const amplitude = this.calculateSeasonalAmplitude(values, period);
      return { detected: true, period, amplitude };
    }
    
    return { detected: false };
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (lag >= values.length) return 0;
    
    const n = values.length - lag;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }
    
    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    return numerator / denominator;
  }

  private calculateSeasonalAmplitude(values: number[], period: number): number {
    if (period >= values.length) return 0;
    
    // Calculate the amplitude of seasonal variation
    const seasonalMeans: number[] = [];
    
    for (let phase = 0; phase < period; phase++) {
      const phaseValues = [];
      for (let i = phase; i < values.length; i += period) {
        phaseValues.push(values[i]);
      }
      
      if (phaseValues.length > 0) {
        const phaseMean = phaseValues.reduce((sum, val) => sum + val, 0) / phaseValues.length;
        seasonalMeans.push(phaseMean);
      }
    }
    
    const maxMean = Math.max(...seasonalMeans);
    const minMean = Math.min(...seasonalMeans);
    
    return maxMean - minMean;
  }

  /**
   * Generate capacity planning recommendations
   */
  async generateCapacityPlan(serverId: string): Promise<CapacityPlan> {
    logger.info(`Generating capacity plan for server: ${serverId}`);
    
    const serverMetrics = this.metrics.filter(m => m.serverId === serverId);
    if (serverMetrics.length === 0) {
      throw new Error(`No metrics available for server: ${serverId}`);
    }
    
    // Analyze current capacity
    const currentCapacity = this.analyzeCurrentCapacity(serverMetrics);
    
    // Project future load
    const projectedLoad = await this.projectFutureLoad(serverMetrics);
    
    // Generate scaling recommendations
    const scalingRecommendations = this.generateScalingRecommendations(
      currentCapacity,
      projectedLoad
    );
    
    // Assess risks
    const riskAssessment = this.assessCapacityRisks(serverMetrics, projectedLoad);
    
    const plan: CapacityPlan = {
      planId: `plan-${serverId}-${Date.now()}`,
      serverId,
      planDate: new Date(),
      currentCapacity,
      projectedLoad,
      scalingRecommendations,
      riskFactors: riskAssessment.riskFactors,
      probabilityOfBottleneck: riskAssessment.probabilityOfBottleneck,
      criticalPath: riskAssessment.criticalPath,
    };
    
    this.capacityPlans.set(plan.planId, plan);
    
    logger.info(`Generated capacity plan: ${plan.planId}`);
    this.emit('capacity-plan-generated', plan);
    
    return plan;
  }

  private analyzeCurrentCapacity(metrics: PerformanceMetric[]): any {
    const recentMetrics = metrics.slice(-100); // Last 100 metrics
    
    const maxThroughput = Math.max(...recentMetrics.map(m => m.throughput));
    const avgThroughput = recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length;
    
    return {
      maxThroughput,
      maxConcurrentConnections: Math.floor(maxThroughput * 10), // Estimate
      storageCapacity: 1000000, // Placeholder - would come from actual monitoring
      networkBandwidth: 1000, // Placeholder - would come from actual monitoring
    };
  }

  private async projectFutureLoad(metrics: PerformanceMetric[]): Promise<any> {
    const throughputValues = metrics.map(m => m.throughput);
    const forecast = await this.performancePredictor.forecast('throughput', throughputValues, 90); // 90 days
    
    const projectedThroughput = forecast.values[forecast.values.length - 1];
    const confidenceInterval: [number, number] = [
      projectedThroughput * 0.8,
      projectedThroughput * 1.2,
    ];
    
    return {
      timeHorizon: '3 months',
      expectedThroughput: projectedThroughput,
      expectedConnections: projectedThroughput * 10,
      confidenceInterval,
    };
  }

  private generateScalingRecommendations(currentCapacity: any, projectedLoad: any): any {
    const capacityRatio = projectedLoad.expectedThroughput / currentCapacity.maxThroughput;
    
    if (capacityRatio > 0.8) {
      const scaleUpDate = new Date();
      scaleUpDate.setDate(scaleUpDate.getDate() + 30); // 30 days from now
      
      return {
        scaleType: capacityRatio > 1.5 ? 'horizontal' : 'vertical',
        timeToScale: scaleUpDate,
        resourceRequirements: {
          additionalInstances: Math.max(1, Math.ceil(capacityRatio - 1)),
          memoryIncrease: capacityRatio > 1.2 ? '50%' : '25%',
          cpuIncrease: capacityRatio > 1.2 ? '100%' : '50%',
        },
        estimatedCost: capacityRatio * 1000, // Placeholder cost estimate
      };
    }
    
    return {
      scaleType: 'none',
      timeToScale: null,
      resourceRequirements: {},
      estimatedCost: 0,
    };
  }

  private assessCapacityRisks(metrics: PerformanceMetric[], projectedLoad: any): any {
    const riskFactors: string[] = [];
    let probabilityOfBottleneck = 0;
    
    // Check response time trends
    const recentResponseTimes = metrics.slice(-50).map(m => m.responseTime);
    const avgResponseTime = recentResponseTimes.reduce((sum, rt) => sum + rt, 0) / recentResponseTimes.length;
    
    if (avgResponseTime > 5000) {
      riskFactors.push('High response times indicating potential performance bottlenecks');
      probabilityOfBottleneck += 30;
    }
    
    // Check error rate trends
    const recentErrorRates = metrics.slice(-50).map(m => m.errorRate);
    const avgErrorRate = recentErrorRates.reduce((sum, er) => sum + er, 0) / recentErrorRates.length;
    
    if (avgErrorRate > 5) {
      riskFactors.push('Elevated error rates suggesting system stress');
      probabilityOfBottleneck += 25;
    }
    
    // Check load growth
    if (projectedLoad.expectedThroughput > metrics[0]?.throughput * 1.5) {
      riskFactors.push('Rapid load growth may outpace scaling capabilities');
      probabilityOfBottleneck += 20;
    }
    
    return {
      riskFactors,
      probabilityOfBottleneck: Math.min(100, probabilityOfBottleneck),
      criticalPath: ['response-time', 'throughput', 'error-rate'],
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(
    reportType: PerformanceReport['reportType'],
    startDate?: Date,
    endDate?: Date
  ): Promise<PerformanceReport> {
    logger.info(`Generating ${reportType} performance report...`);
    
    const reportPeriod = this.calculateReportPeriod(reportType, startDate, endDate);
    const filteredMetrics = this.filterMetricsByPeriod(reportPeriod);
    
    // Generate executive summary
    const summary = this.generateExecutiveSummary(filteredMetrics);
    
    // Generate server performance reports
    const serverPerformance = this.generateServerPerformanceReports(filteredMetrics);
    
    // Generate voice performance reports
    const voicePerformance = this.generateVoicePerformanceReports(filteredMetrics);
    
    // Generate SLA compliance report
    const slaCompliance = this.generateSLAComplianceReport(filteredMetrics);
    
    // Generate cost analysis
    const costAnalysis = this.generateCostAnalysisReport(filteredMetrics);
    
    // Generate recommendations
    const recommendations = await this.generatePerformanceRecommendations(filteredMetrics);
    
    const report: PerformanceReport = {
      reportId: `report-${reportType}-${Date.now()}`,
      reportType,
      generatedAt: new Date(),
      reportPeriod,
      summary,
      serverPerformance,
      voicePerformance,
      slaCompliance,
      costAnalysis,
      recommendations,
    };
    
    this.reports.push(report);
    
    logger.info(`Generated performance report: ${report.reportId}`);
    this.emit('performance-report-generated', report);
    
    return report;
  }

  private calculateReportPeriod(
    reportType: PerformanceReport['reportType'],
    startDate?: Date,
    endDate?: Date
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    const end = endDate || now;
    let start: Date;
    
    switch (reportType) {
      case 'daily':
        start = new Date(end);
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start = new Date(end);
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start = new Date(end);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start = new Date(end);
        start.setMonth(start.getMonth() - 3);
        break;
      default:
        start = startDate || new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }
    
    return { startDate: start, endDate: end };
  }

  private filterMetricsByPeriod(period: { startDate: Date; endDate: Date }): PerformanceMetric[] {
    return this.metrics.filter(m =>
      m.timestamp >= period.startDate && m.timestamp <= period.endDate
    );
  }

  private generateExecutiveSummary(metrics: PerformanceMetric[]): any {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        overallAvailability: 0,
        topPerformingServers: [],
        problemAreas: [],
      };
    }
    
    const totalRequests = metrics.length;
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const overallAvailability = metrics.reduce((sum, m) => sum + m.availability, 0) / totalRequests;
    
    // Find top performing servers
    const serverPerformance = new Map<string, { responseTime: number; availability: number; count: number }>();
    
    metrics.forEach(m => {
      const existing = serverPerformance.get(m.serverId) || { responseTime: 0, availability: 0, count: 0 };
      existing.responseTime += m.responseTime;
      existing.availability += m.availability;
      existing.count += 1;
      serverPerformance.set(m.serverId, existing);
    });
    
    const topPerformingServers = Array.from(serverPerformance.entries())
      .map(([serverId, stats]) => ({
        serverId,
        avgResponseTime: stats.responseTime / stats.count,
        avgAvailability: stats.availability / stats.count,
      }))
      .sort((a, b) => (b.avgAvailability - b.avgResponseTime) - (a.avgAvailability - a.avgResponseTime))
      .slice(0, 5)
      .map(s => s.serverId);
    
    // Identify problem areas
    const problemAreas: string[] = [];
    if (avgResponseTime > 5000) {
      problemAreas.push('High response times');
    }
    if (overallAvailability < 95) {
      problemAreas.push('Low availability');
    }
    
    const errorMetrics = metrics.filter(m => m.errorRate > 5);
    if (errorMetrics.length > totalRequests * 0.1) {
      problemAreas.push('High error rates');
    }
    
    return {
      totalRequests,
      avgResponseTime,
      overallAvailability,
      topPerformingServers,
      problemAreas,
    };
  }

  private generateServerPerformanceReports(metrics: PerformanceMetric[]): Map<string, ServerPerformanceReport> {
    const serverReports = new Map<string, ServerPerformanceReport>();
    const serverGroups = this.groupMetricsByServer(metrics);
    
    for (const [serverId, serverMetrics] of serverGroups) {
      const report: ServerPerformanceReport = {
        serverId,
        serverName: serverMetrics[0].serverName,
        totalRequests: serverMetrics.length,
        avgResponseTime: serverMetrics.reduce((sum, m) => sum + m.responseTime, 0) / serverMetrics.length,
        errorRate: serverMetrics.reduce((sum, m) => sum + m.errorRate, 0) / serverMetrics.length,
        availability: serverMetrics.reduce((sum, m) => sum + m.availability, 0) / serverMetrics.length,
        
        responseTimeTrend: this.trends.get(`${serverId}-responseTime`) || this.createDefaultTrend('responseTime'),
        throughputTrend: this.trends.get(`${serverId}-throughput`) || this.createDefaultTrend('throughput'),
        errorRateTrend: this.trends.get(`${serverId}-errorRate`) || this.createDefaultTrend('errorRate'),
        
        resourceUtilization: {
          avgCpuUsage: serverMetrics.reduce((sum, m) => sum + (m.cpuUsage || 0), 0) / serverMetrics.length,
          avgMemoryUsage: serverMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / serverMetrics.length,
          peakNetworkUsage: Math.max(...serverMetrics.map(m => m.networkLatency || 0)),
        },
        
        reliabilityScore: this.calculateReliabilityScore(serverMetrics),
        performanceScore: this.calculatePerformanceScore(serverMetrics),
        userSatisfactionScore: this.calculateUserSatisfactionScore(serverMetrics),
        
        totalAlerts: this.alerts.filter(a => a.serverId === serverId).length,
        criticalAlerts: this.alerts.filter(a => a.serverId === serverId && a.severity === 'critical').length,
        resolvedIssues: this.alerts.filter(a => a.serverId === serverId && a.resolved).length,
      };
      
      serverReports.set(serverId, report);
    }
    
    return serverReports;
  }

  private generateVoicePerformanceReports(metrics: PerformanceMetric[]): Map<string, VoicePerformanceReport> {
    const voiceReports = new Map<string, VoicePerformanceReport>();
    
    // Group metrics by voice
    const voiceGroups = new Map<string, PerformanceMetric[]>();
    metrics.filter(m => m.voiceId).forEach(m => {
      const voiceId = m.voiceId!;
      if (!voiceGroups.has(voiceId)) {
        voiceGroups.set(voiceId, []);
      }
      voiceGroups.get(voiceId)!.push(m);
    });
    
    for (const [voiceId, voiceMetrics] of voiceGroups) {
      // Calculate server usage distribution
      const serverUsage = new Map<string, number>();
      voiceMetrics.forEach(m => {
        serverUsage.set(m.serverId, (serverUsage.get(m.serverId) || 0) + 1);
      });
      
      // Get preferred capabilities (would come from voice configuration)
      const preferredCapabilities = voiceMetrics
        .filter(m => m.capability)
        .map(m => m.capability!)
        .filter((cap, index, arr) => arr.indexOf(cap) === index);
      
      const report: VoicePerformanceReport = {
        voiceId,
        voiceName: this.getVoiceName(voiceId),
        totalRequests: voiceMetrics.length,
        preferredCapabilities,
        serverUsageDistribution: serverUsage,
        avgResponseTime: voiceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / voiceMetrics.length,
        successRate: voiceMetrics.reduce((sum, m) => sum + m.successRate, 0) / voiceMetrics.length,
        userSatisfactionScore: this.calculateUserSatisfactionScore(voiceMetrics),
        costPerRequest: this.calculateCostPerRequest(voiceMetrics),
        timeToComplete: voiceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / voiceMetrics.length,
        resourceEfficiency: this.calculateResourceEfficiency(voiceMetrics),
      };
      
      voiceReports.set(voiceId, report);
    }
    
    return voiceReports;
  }

  private generateSLAComplianceReport(metrics: PerformanceMetric[]): SLAComplianceReport {
    // Define SLA thresholds
    const slaThresholds = {
      responseTime: 5000, // 5 seconds
      availability: 99.5, // 99.5%
      errorRate: 1, // 1%
    };
    
    // Calculate compliance
    const responseTimeCompliant = metrics.filter(m => m.responseTime <= slaThresholds.responseTime).length;
    const availabilityCompliant = metrics.filter(m => m.availability >= slaThresholds.availability).length;
    const errorRateCompliant = metrics.filter(m => m.errorRate <= slaThresholds.errorRate).length;
    
    const totalMetrics = metrics.length;
    const overallCompliance = totalMetrics > 0 ? 
      ((responseTimeCompliant + availabilityCompliant + errorRateCompliant) / (totalMetrics * 3)) * 100 : 100;
    
    // SLA breaches
    const slaBreaches = {
      responseTime: totalMetrics - responseTimeCompliant,
      availability: totalMetrics - availabilityCompliant,
      errorRate: totalMetrics - errorRateCompliant,
    };
    
    // Compliance by server
    const complianceByServer = new Map<string, number>();
    const serverGroups = this.groupMetricsByServer(metrics);
    
    for (const [serverId, serverMetrics] of serverGroups) {
      const serverCompliant = serverMetrics.filter(m => 
        m.responseTime <= slaThresholds.responseTime &&
        m.availability >= slaThresholds.availability &&
        m.errorRate <= slaThresholds.errorRate
      ).length;
      
      complianceByServer.set(serverId, (serverCompliant / serverMetrics.length) * 100);
    }
    
    const impactAssessment = [];
    if (overallCompliance < 95) {
      impactAssessment.push('Poor SLA compliance may affect user satisfaction and business reputation');
    }
    if (slaBreaches.availability > totalMetrics * 0.1) {
      impactAssessment.push('Availability issues may result in service level penalties');
    }
    
    return {
      overallCompliance,
      slaBreaches,
      complianceByServer,
      impactAssessment,
    };
  }

  private generateCostAnalysisReport(metrics: PerformanceMetric[]): CostAnalysisReport {
    // Placeholder cost analysis - would integrate with actual cost data
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0.01), 0);
    
    const serverCosts = new Map<string, number>();
    metrics.forEach(m => {
      const cost = m.cost || 0.01;
      serverCosts.set(m.serverId, (serverCosts.get(m.serverId) || 0) + cost);
    });
    
    return {
      totalCost,
      costBreakdown: {
        serverCosts,
        networkCosts: totalCost * 0.1,
        storageCosts: totalCost * 0.05,
        operationalCosts: totalCost * 0.15,
      },
      costOptimizationOpportunities: {
        potentialSavings: totalCost * 0.2,
        optimizationStrategies: [
          'Right-size underutilized servers',
          'Implement auto-scaling to reduce idle capacity',
          'Optimize network traffic routing',
        ],
      },
      costTrends: {
        monthOverMonth: 5, // 5% increase (placeholder)
        yearOverYear: 12, // 12% increase (placeholder)
      },
    };
  }

  private async generatePerformanceRecommendations(metrics: PerformanceMetric[]): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];
    
    // Analyze metrics for optimization opportunities
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;
    const avgAvailability = metrics.reduce((sum, m) => sum + m.availability, 0) / metrics.length;
    
    if (avgResponseTime > 5000) {
      recommendations.push({
        recommendationId: `rec-${Date.now()}-1`,
        priority: 'high',
        category: 'performance',
        title: 'Optimize Response Times',
        description: 'Average response times are above acceptable thresholds',
        rationale: `Current average response time is ${avgResponseTime.toFixed(0)}ms, which exceeds the 5000ms threshold`,
        implementationComplexity: 'medium',
        estimatedEffort: '2-3 weeks',
        expectedBenefit: 'Improved user experience and reduced latency',
        businessValue: 85,
        riskReduction: 70,
        costImpact: -10000,
        recommendedBy: new Date(),
        targetImplementation: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'proposed',
      });
    }
    
    if (avgErrorRate > 2) {
      recommendations.push({
        recommendationId: `rec-${Date.now()}-2`,
        priority: 'critical',
        category: 'reliability',
        title: 'Reduce Error Rates',
        description: 'Error rates are significantly higher than acceptable levels',
        rationale: `Current average error rate is ${avgErrorRate.toFixed(1)}%, which exceeds the 2% threshold`,
        implementationComplexity: 'high',
        estimatedEffort: '4-6 weeks',
        expectedBenefit: 'Improved system reliability and user satisfaction',
        businessValue: 95,
        riskReduction: 90,
        costImpact: -5000,
        recommendedBy: new Date(),
        targetImplementation: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'proposed',
      });
    }
    
    if (avgAvailability < 95) {
      recommendations.push({
        recommendationId: `rec-${Date.now()}-3`,
        priority: 'high',
        category: 'reliability',
        title: 'Improve System Availability',
        description: 'System availability is below SLA requirements',
        rationale: `Current availability is ${avgAvailability.toFixed(1)}%, which is below the 99% SLA target`,
        implementationComplexity: 'medium',
        estimatedEffort: '3-4 weeks',
        expectedBenefit: 'Meeting SLA requirements and avoiding penalties',
        businessValue: 90,
        riskReduction: 85,
        costImpact: -20000,
        recommendedBy: new Date(),
        targetImplementation: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        status: 'proposed',
      });
    }
    
    return recommendations;
  }

  /**
   * Helper methods
   */
  private createDefaultTrend(metricType: string): PerformanceTrend {
    return {
      metricType,
      timeRange: '24h',
      mean: 0,
      median: 0,
      standardDeviation: 0,
      percentile95: 0,
      percentile99: 0,
      trend: 'stable',
      trendConfidence: 0,
      changeRate: 0,
      hasSeasonality: false,
      forecast: [],
      forecastConfidence: [],
    };
  }

  private calculateReliabilityScore(metrics: PerformanceMetric[]): number {
    const avgAvailability = metrics.reduce((sum, m) => sum + m.availability, 0) / metrics.length;
    const avgSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length;
    return (avgAvailability + avgSuccessRate) / 2;
  }

  private calculatePerformanceScore(metrics: PerformanceMetric[]): number {
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
    
    // Normalize scores (lower response time and higher throughput are better)
    const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 100));
    const throughputScore = Math.min(100, avgThroughput * 10);
    
    return (responseTimeScore + throughputScore) / 2;
  }

  private calculateUserSatisfactionScore(metrics: PerformanceMetric[]): number {
    // Combine multiple factors to estimate user satisfaction
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgAvailability = metrics.reduce((sum, m) => sum + m.availability, 0) / metrics.length;
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;
    
    // Weight factors
    const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 100));
    const availabilityScore = avgAvailability;
    const errorRateScore = Math.max(0, 100 - (avgErrorRate * 10));
    
    return (responseTimeScore * 0.4 + availabilityScore * 0.4 + errorRateScore * 0.2);
  }

  private calculateCostPerRequest(metrics: PerformanceMetric[]): number {
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0.01), 0);
    return totalCost / metrics.length;
  }

  private calculateResourceEfficiency(metrics: PerformanceMetric[]): number {
    // Calculate efficiency as throughput per unit of resource usage
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
    const avgResourceUsage = metrics.reduce((sum, m) => {
      const cpu = m.cpuUsage || 50;
      const memory = m.memoryUsage || 50;
      return sum + (cpu + memory) / 2;
    }, 0) / metrics.length;
    
    return avgResourceUsage > 0 ? (avgThroughput / avgResourceUsage) * 100 : 0;
  }

  private getVoiceName(voiceId: string): string {
    const voiceNames: { [key: string]: string } = {
      'explorer': 'Explorer',
      'maintainer': 'Maintainer',
      'security': 'Security Guardian',
      'architect': 'System Architect',
      'developer': 'Developer',
    };
    return voiceNames[voiceId] || voiceId;
  }

  /**
   * Start monitoring services
   */
  private startRealTimeMonitoring(): void {
    const monitoringInterval = setInterval(() => {
      this.performRealTimeChecks();
    }, this.MONITORING_INTERVAL);
    
    this.monitoringIntervals.set('real-time', monitoringInterval);
    logger.info('Started real-time performance monitoring');
  }

  private startTrendAnalysis(): void {
    const trendInterval = setInterval(async () => {
      try {
        await this.analyzePerformanceTrends();
      } catch (error) {
        logger.error('Trend analysis failed:', error);
      }
    }, this.TREND_ANALYSIS_WINDOW);
    
    this.monitoringIntervals.set('trends', trendInterval);
    logger.info('Started performance trend analysis');
  }

  private startReportGeneration(): void {
    // Generate daily reports
    const dailyReportInterval = setInterval(async () => {
      try {
        await this.generatePerformanceReport('daily');
      } catch (error) {
        logger.error('Daily report generation failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    this.monitoringIntervals.set('daily-reports', dailyReportInterval);
    logger.info('Started automated report generation');
  }

  private performRealTimeChecks(): void {
    // Check for active alerts that need attention
    const activeAlerts = this.alerts.filter(a => !a.resolved && !a.acknowledged);
    
    if (activeAlerts.length > 0) {
      this.emit('active-alerts', activeAlerts);
    }
    
    // Run optimization recommendations
    this.optimizationEngine.optimize(this.metrics.slice(-100));
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (this.METRIC_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const initialCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);
    
    const removedCount = initialCount - this.metrics.length;
    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} old metrics`);
    }
  }

  /**
   * Public API methods
   */
  
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  resolveAlert(alertId: string, resolution: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert-resolved', alert, resolution);
      return true;
    }
    return false;
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getPerformanceTrends(): Map<string, PerformanceTrend> {
    return new Map(this.trends);
  }

  getCapacityPlans(): CapacityPlan[] {
    return Array.from(this.capacityPlans.values());
  }

  getPerformanceReports(): PerformanceReport[] {
    return this.reports.slice(-10); // Return last 10 reports
  }

  getAnalyticsStats(): any {
    return {
      totalMetrics: this.metrics.length,
      activeAlerts: this.alerts.filter(a => !a.resolved).length,
      totalAlerts: this.alerts.length,
      trendsAnalyzed: this.trends.size,
      capacityPlansGenerated: this.capacityPlans.size,
      reportsGenerated: this.reports.length,
      metricsRetentionDays: this.METRIC_RETENTION_DAYS,
      lastTrendAnalysis: new Date(),
    };
  }
}

/**
 * Supporting classes for ML and optimization
 */
class PerformancePredictor {
  private dataPoints: Map<string, number[]> = new Map();

  addDataPoint(metric: PerformanceMetric): void {
    const metricTypes = ['responseTime', 'errorRate', 'availability', 'throughput'];
    
    metricTypes.forEach(type => {
      if (!this.dataPoints.has(type)) {
        this.dataPoints.set(type, []);
      }
      
      const value = this.extractMetricValue(metric, type);
      const points = this.dataPoints.get(type)!;
      points.push(value);
      
      // Keep only recent data
      if (points.length > 1000) {
        points.shift();
      }
    });
  }

  async forecast(metricType: string, values: number[], periods: number): Promise<{ values: number[]; confidence: number[] }> {
    // Simple moving average forecast (would use more sophisticated models in production)
    const windowSize = Math.min(10, values.length);
    const recentValues = values.slice(-windowSize);
    const average = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Simple trend calculation
    const trend = recentValues.length > 1 ? 
      (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length : 0;
    
    const forecastValues: number[] = [];
    const confidenceValues: number[] = [];
    
    for (let i = 0; i < periods; i++) {
      const forecastValue = average + (trend * i);
      forecastValues.push(Math.max(0, forecastValue));
      confidenceValues.push(Math.max(0, 80 - (i * 5))); // Decreasing confidence over time
    }
    
    return {
      values: forecastValues,
      confidence: confidenceValues,
    };
  }

  private extractMetricValue(metric: PerformanceMetric, metricType: string): number {
    switch (metricType) {
      case 'responseTime':
        return metric.responseTime;
      case 'errorRate':
        return metric.errorRate;
      case 'availability':
        return metric.availability;
      case 'throughput':
        return metric.throughput;
      default:
        return 0;
    }
  }
}

class PerformanceAnomalyDetector {
  private baseline: Map<string, { mean: number; stddev: number; count: number }> = new Map();
  
  analyzeMetric(metric: PerformanceMetric): boolean {
    const key = `${metric.serverId}-responseTime`;
    const existing = this.baseline.get(key) || { mean: 0, stddev: 0, count: 0 };
    
    // Update baseline using exponential moving average
    const alpha = 0.1;
    existing.mean = existing.count === 0 ? metric.responseTime : 
      existing.mean * (1 - alpha) + metric.responseTime * alpha;
    
    // Simple standard deviation estimation
    if (existing.count > 0) {
      const variance = Math.pow(metric.responseTime - existing.mean, 2);
      existing.stddev = existing.stddev * (1 - alpha) + variance * alpha;
    }
    
    existing.count++;
    this.baseline.set(key, existing);
    
    // Detect anomaly (value more than 3 standard deviations from mean)
    const threshold = existing.mean + (3 * Math.sqrt(existing.stddev));
    return metric.responseTime > threshold && existing.count > 10;
  }
}

class OptimizationEngine {
  optimize(recentMetrics: PerformanceMetric[]): void {
    if (recentMetrics.length < 10) return;
    
    // Simple optimization recommendations based on patterns
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
    
    if (avgResponseTime > 5000) {
      logger.info('Optimization recommendation: Consider caching frequently accessed data');
    }
    
    const highErrorRateMetrics = recentMetrics.filter(m => m.errorRate > 5);
    if (highErrorRateMetrics.length > recentMetrics.length * 0.2) {
      logger.info('Optimization recommendation: Investigate error patterns and improve error handling');
    }
  }
}

// Global instance
export const mcpPerformanceAnalyticsSystem = new MCPPerformanceAnalyticsSystem();