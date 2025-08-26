/**
 * Voice Performance Analytics System (2025 Pattern)
 * Agent 3: Voice System Optimization Specialist
 * 
 * Features:
 * - Real-time voice performance monitoring
 * - Cost optimization analytics and recommendations
 * - Voice effectiveness metrics and scoring
 * - Performance trend analysis and predictions
 * - Automated optimization suggestions
 * - ROI tracking and reporting
 */

import { logger } from '../core/logger.js';
import { LRUCache } from 'lru-cache';

export interface VoiceMetrics {
  voiceId: string;
  timestamp: Date;
  responseTime: number;
  tokenUsage: number;
  qualityScore: number;
  confidenceLevel: number;
  taskComplexity: 'simple' | 'moderate' | 'complex';
  success: boolean;
  costEstimate: number;
  userSatisfaction?: number;
}

export interface PerformanceTrend {
  voiceId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  averageResponseTime: number;
  averageQuality: number;
  successRate: number;
  costEfficiency: number;
  trendDirection: 'improving' | 'stable' | 'declining';
  changePercentage: number;
}

export interface VoiceEffectiveness {
  voiceId: string;
  overallScore: number; // 0-100 scale
  strengths: string[];
  weaknesses: string[];
  optimalUseCases: string[];
  improvementRecommendations: string[];
  costPerQualityPoint: number;
  roiScore: number;
}

export interface CostOptimizationReport {
  totalCostSavings: number;
  percentageSavings: number;
  optimizationOpportunities: OptimizationOpportunity[];
  recommendedActions: string[];
  projectedBenefits: {
    monthlySavings: number;
    qualityImprovements: number;
    efficiencyGains: number;
  };
}

export interface OptimizationOpportunity {
  type: 'voice-selection' | 'mode-switching' | 'caching' | 'batching';
  description: string;
  potentialSavings: number;
  implementationEffort: 'low' | 'medium' | 'high';
  expectedROI: number;
  priority: 'high' | 'medium' | 'low';
}

export interface AnalyticsConfig {
  metricsRetentionDays: number;
  samplingRate: number;
  alertThresholds: {
    responseTimeMs: number;
    qualityScore: number;
    successRate: number;
    costPerRequest: number;
  };
  enablePredictiveAnalytics: boolean;
  enableRealTimeAlerts: boolean;
}

/**
 * Comprehensive Voice Performance Analytics System
 */
export class VoicePerformanceAnalytics2025 {
  private metricsBuffer: VoiceMetrics[] = [];
  private trendsCache: LRUCache<string, PerformanceTrend>;
  private effectivenessCache: LRUCache<string, VoiceEffectiveness>;
  private config: AnalyticsConfig;
  private alertCallbacks: Array<(alert: any) => void> = [];
  private baselineCosts: Map<string, number> = new Map();
  private startTime: Date;

  constructor(config?: Partial<AnalyticsConfig>) {
    this.startTime = new Date();
    
    this.config = {
      metricsRetentionDays: 30,
      samplingRate: 1.0, // 100% sampling by default
      alertThresholds: {
        responseTimeMs: 10000,
        qualityScore: 0.6,
        successRate: 0.7,
        costPerRequest: 0.10
      },
      enablePredictiveAnalytics: true,
      enableRealTimeAlerts: true,
      ...config
    };

    this.trendsCache = new LRUCache<string, PerformanceTrend>({
      max: 1000,
      ttl: 1000 * 60 * 60 // 1 hour TTL
    });

    this.effectivenessCache = new LRUCache<string, VoiceEffectiveness>({
      max: 100,
      ttl: 1000 * 60 * 60 * 24 // 24 hour TTL
    });

    // Initialize baseline costs for comparison
    this.initializeBaselineCosts();

    logger.info('📊 Voice Performance Analytics initialized', {
      retentionDays: this.config.metricsRetentionDays,
      samplingRate: this.config.samplingRate,
      predictiveAnalytics: this.config.enablePredictiveAnalytics
    });
  }

  /**
   * Record voice performance metrics
   */
  recordMetrics(metrics: VoiceMetrics): void {
    // Apply sampling rate
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    this.metricsBuffer.push(metrics);

    // Check for real-time alerts
    if (this.config.enableRealTimeAlerts) {
      this.checkAlertThresholds(metrics);
    }

    // Clean up old metrics
    this.cleanupOldMetrics();

    logger.debug('📊 Voice metrics recorded', {
      voiceId: metrics.voiceId,
      responseTime: metrics.responseTime,
      quality: metrics.qualityScore,
      cost: metrics.costEstimate
    });
  }

  /**
   * Get comprehensive performance analytics for a voice
   */
  async getVoiceAnalytics(voiceId: string, period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<{
    currentMetrics: any;
    trends: PerformanceTrend;
    effectiveness: VoiceEffectiveness;
    recommendations: string[];
  }> {
    const currentMetrics = this.calculateCurrentMetrics(voiceId, period);
    const trends = await this.calculateTrends(voiceId, period);
    const effectiveness = await this.calculateEffectiveness(voiceId);
    const recommendations = this.generateRecommendations(voiceId, currentMetrics, trends, effectiveness);

    return {
      currentMetrics,
      trends,
      effectiveness,
      recommendations
    };
  }

  /**
   * Generate comprehensive cost optimization report
   */
  async generateCostOptimizationReport(): Promise<CostOptimizationReport> {
    const startTime = Date.now();
    
    // Calculate current total costs
    const currentCosts = this.calculateTotalCosts();
    const baselineCosts = this.calculateBaselineCosts();
    const savings = baselineCosts - currentCosts;
    const percentageSavings = (savings / baselineCosts) * 100;

    // Identify optimization opportunities
    const opportunities = await this.identifyOptimizationOpportunities();
    
    // Generate recommended actions
    const recommendedActions = this.generateOptimizationActions(opportunities);
    
    // Project future benefits
    const projectedBenefits = this.calculateProjectedBenefits(opportunities);

    const report: CostOptimizationReport = {
      totalCostSavings: savings,
      percentageSavings,
      optimizationOpportunities: opportunities,
      recommendedActions,
      projectedBenefits
    };

    const reportTime = Date.now() - startTime;
    logger.info('💰 Cost optimization report generated', {
      reportTime: `${reportTime}ms`,
      totalSavings: savings.toFixed(2),
      percentageSavings: percentageSavings.toFixed(1),
      opportunityCount: opportunities.length
    });

    return report;
  }

  /**
   * Get system-wide performance dashboard
   */
  getPerformanceDashboard(): any {
    const allMetrics = this.getAllMetrics();
    const voiceIds = [...new Set(allMetrics.map(m => m.voiceId))];
    
    return {
      overview: {
        totalRequests: allMetrics.length,
        averageResponseTime: this.calculateAverage(allMetrics, 'responseTime'),
        averageQuality: this.calculateAverage(allMetrics, 'qualityScore'),
        overallSuccessRate: allMetrics.filter(m => m.success).length / allMetrics.length,
        totalCost: allMetrics.reduce((sum, m) => sum + m.costEstimate, 0),
        activeVoices: voiceIds.length
      },
      voiceSummaries: voiceIds.map(voiceId => {
        const voiceMetrics = allMetrics.filter(m => m.voiceId === voiceId);
        return {
          voiceId,
          requestCount: voiceMetrics.length,
          averageResponseTime: this.calculateAverage(voiceMetrics, 'responseTime'),
          averageQuality: this.calculateAverage(voiceMetrics, 'qualityScore'),
          successRate: voiceMetrics.filter(m => m.success).length / voiceMetrics.length,
          totalCost: voiceMetrics.reduce((sum, m) => sum + m.costEstimate, 0)
        };
      }),
      trends: this.calculateSystemTrends(),
      alerts: this.getActiveAlerts(),
      recommendations: this.getSystemRecommendations()
    };
  }

  /**
   * Initialize baseline costs for comparison
   */
  private initializeBaselineCosts(): void {
    // Baseline costs before optimization (higher values)
    this.baselineCosts.set('developer', 0.08);
    this.baselineCosts.set('security', 0.12);
    this.baselineCosts.set('architect', 0.10);
    this.baselineCosts.set('analyzer', 0.09);
    this.baselineCosts.set('maintainer', 0.07);
    this.baselineCosts.set('designer', 0.08);
    this.baselineCosts.set('optimizer', 0.09);
    this.baselineCosts.set('implementor', 0.08);
    this.baselineCosts.set('explorer', 0.10);
    this.baselineCosts.set('guardian', 0.11);
  }

  /**
   * Check if metrics breach alert thresholds
   */
  private checkAlertThresholds(metrics: VoiceMetrics): void {
    const alerts = [];

    if (metrics.responseTime > this.config.alertThresholds.responseTimeMs) {
      alerts.push({
        type: 'response_time',
        voiceId: metrics.voiceId,
        threshold: this.config.alertThresholds.responseTimeMs,
        actual: metrics.responseTime,
        severity: 'warning'
      });
    }

    if (metrics.qualityScore < this.config.alertThresholds.qualityScore) {
      alerts.push({
        type: 'quality_score',
        voiceId: metrics.voiceId,
        threshold: this.config.alertThresholds.qualityScore,
        actual: metrics.qualityScore,
        severity: 'warning'
      });
    }

    if (metrics.costEstimate > this.config.alertThresholds.costPerRequest) {
      alerts.push({
        type: 'cost_overrun',
        voiceId: metrics.voiceId,
        threshold: this.config.alertThresholds.costPerRequest,
        actual: metrics.costEstimate,
        severity: 'info'
      });
    }

    // Trigger alert callbacks
    for (const alert of alerts) {
      this.triggerAlert(alert);
    }
  }

  /**
   * Trigger alert to registered callbacks
   */
  private triggerAlert(alert: any): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback failed', { error: error.message });
      }
    }
  }

  /**
   * Clean up old metrics based on retention policy
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - this.config.metricsRetentionDays);
    
    this.metricsBuffer = this.metricsBuffer.filter(metric => 
      metric.timestamp > cutoffTime
    );
  }

  /**
   * Calculate current metrics for a voice
   */
  private calculateCurrentMetrics(voiceId: string, period: string): any {
    const periodStart = this.getPeriodStart(period);
    const metrics = this.getVoiceMetrics(voiceId, periodStart);

    if (metrics.length === 0) {
      return {
        requestCount: 0,
        averageResponseTime: 0,
        averageQuality: 0,
        successRate: 0,
        totalCost: 0,
        averageConfidence: 0
      };
    }

    return {
      requestCount: metrics.length,
      averageResponseTime: this.calculateAverage(metrics, 'responseTime'),
      averageQuality: this.calculateAverage(metrics, 'qualityScore'),
      successRate: metrics.filter(m => m.success).length / metrics.length,
      totalCost: metrics.reduce((sum, m) => sum + m.costEstimate, 0),
      averageConfidence: this.calculateAverage(metrics, 'confidenceLevel'),
      complexityBreakdown: this.getComplexityBreakdown(metrics)
    };
  }

  /**
   * Calculate performance trends for a voice
   */
  private async calculateTrends(voiceId: string, period: string): Promise<PerformanceTrend> {
    const cacheKey = `${voiceId}_${period}`;
    const cachedTrend = this.trendsCache.get(cacheKey);
    
    if (cachedTrend) {
      return cachedTrend;
    }

    const currentPeriod = this.getPeriodStart(period);
    const previousPeriod = this.getPreviousPeriodStart(period);
    
    const currentMetrics = this.getVoiceMetrics(voiceId, currentPeriod);
    const previousMetrics = this.getVoiceMetrics(voiceId, previousPeriod, currentPeriod);

    const currentAvgResponse = this.calculateAverage(currentMetrics, 'responseTime');
    const previousAvgResponse = this.calculateAverage(previousMetrics, 'responseTime');
    const responseTimeChange = this.calculatePercentageChange(previousAvgResponse, currentAvgResponse);

    const currentAvgQuality = this.calculateAverage(currentMetrics, 'qualityScore');
    const previousAvgQuality = this.calculateAverage(previousMetrics, 'qualityScore');
    const qualityChange = this.calculatePercentageChange(previousAvgQuality, currentAvgQuality);

    const trend: PerformanceTrend = {
      voiceId,
      period,
      averageResponseTime: currentAvgResponse,
      averageQuality: currentAvgQuality,
      successRate: currentMetrics.filter(m => m.success).length / Math.max(currentMetrics.length, 1),
      costEfficiency: this.calculateCostEfficiency(currentMetrics),
      trendDirection: this.determineTrendDirection(responseTimeChange, qualityChange),
      changePercentage: (Math.abs(responseTimeChange) + Math.abs(qualityChange)) / 2
    };

    this.trendsCache.set(cacheKey, trend);
    return trend;
  }

  /**
   * Calculate voice effectiveness score
   */
  private async calculateEffectiveness(voiceId: string): Promise<VoiceEffectiveness> {
    const cachedEffectiveness = this.effectivenessCache.get(voiceId);
    
    if (cachedEffectiveness) {
      return cachedEffectiveness;
    }

    const metrics = this.getVoiceMetrics(voiceId);
    
    if (metrics.length === 0) {
      return {
        voiceId,
        overallScore: 50,
        strengths: [],
        weaknesses: ['Insufficient data'],
        optimalUseCases: [],
        improvementRecommendations: ['Collect more performance data'],
        costPerQualityPoint: 0,
        roiScore: 0
      };
    }

    // Calculate component scores (0-100 scale)
    const qualityScore = this.calculateAverage(metrics, 'qualityScore') * 100;
    const speedScore = this.calculateSpeedScore(metrics);
    const reliabilityScore = (metrics.filter(m => m.success).length / metrics.length) * 100;
    const costEfficiencyScore = this.calculateCostEfficiencyScore(metrics);

    const overallScore = (qualityScore * 0.3) + (speedScore * 0.2) + (reliabilityScore * 0.3) + (costEfficiencyScore * 0.2);

    const effectiveness: VoiceEffectiveness = {
      voiceId,
      overallScore: Math.round(overallScore),
      strengths: this.identifyStrengths(qualityScore, speedScore, reliabilityScore, costEfficiencyScore),
      weaknesses: this.identifyWeaknesses(qualityScore, speedScore, reliabilityScore, costEfficiencyScore),
      optimalUseCases: this.identifyOptimalUseCases(voiceId, metrics),
      improvementRecommendations: this.generateImprovementRecommendations(voiceId, metrics),
      costPerQualityPoint: this.calculateCostPerQualityPoint(metrics),
      roiScore: this.calculateROIScore(metrics)
    };

    this.effectivenessCache.set(voiceId, effectiveness);
    return effectiveness;
  }

  /**
   * Identify optimization opportunities
   */
  private async identifyOptimizationOpportunities(): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = [];
    
    // Voice selection optimization
    const underutilizedVoices = this.findUnderutilizedVoices();
    if (underutilizedVoices.length > 0) {
      opportunities.push({
        type: 'voice-selection',
        description: `Consolidate ${underutilizedVoices.length} underutilized voices`,
        potentialSavings: underutilizedVoices.length * 0.02,
        implementationEffort: 'low',
        expectedROI: 0.8,
        priority: 'medium'
      });
    }

    // Mode switching optimization
    const inefficientMultiVoiceUsage = this.findInefficientMultiVoiceUsage();
    if (inefficientMultiVoiceUsage > 0) {
      opportunities.push({
        type: 'mode-switching',
        description: 'Optimize multi-voice vs single-voice decisions',
        potentialSavings: inefficientMultiVoiceUsage * 0.05,
        implementationEffort: 'medium',
        expectedROI: 1.2,
        priority: 'high'
      });
    }

    // Caching optimization
    const cachingPotential = this.assessCachingPotential();
    if (cachingPotential > 0.1) {
      opportunities.push({
        type: 'caching',
        description: 'Implement prompt and response caching',
        potentialSavings: cachingPotential,
        implementationEffort: 'medium',
        expectedROI: 2.0,
        priority: 'high'
      });
    }

    // Batching optimization
    const batchingPotential = this.assessBatchingPotential();
    if (batchingPotential > 0.05) {
      opportunities.push({
        type: 'batching',
        description: 'Optimize request batching for better throughput',
        potentialSavings: batchingPotential,
        implementationEffort: 'low',
        expectedROI: 1.5,
        priority: 'medium'
      });
    }

    return opportunities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Helper methods for calculations
   */
  private getAllMetrics(): VoiceMetrics[] {
    return this.metricsBuffer;
  }

  private getVoiceMetrics(voiceId: string, fromDate?: Date, toDate?: Date): VoiceMetrics[] {
    return this.metricsBuffer.filter(metric => {
      if (metric.voiceId !== voiceId) return false;
      if (fromDate && metric.timestamp < fromDate) return false;
      if (toDate && metric.timestamp > toDate) return false;
      return true;
    });
  }

  private calculateAverage(metrics: VoiceMetrics[], field: keyof VoiceMetrics): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((total, metric) => {
      const value = metric[field];
      return total + (typeof value === 'number' ? value : 0);
    }, 0);
    return sum / metrics.length;
  }

  private calculateTotalCosts(): number {
    const recentMetrics = this.getRecentMetrics();
    return recentMetrics.reduce((sum, metric) => sum + metric.costEstimate, 0);
  }

  private calculateBaselineCosts(): number {
    const recentMetrics = this.getRecentMetrics();
    return recentMetrics.reduce((sum, metric) => {
      const baselineCost = this.baselineCosts.get(metric.voiceId) || 0.08;
      return sum + baselineCost;
    }, 0);
  }

  private getRecentMetrics(hours: number = 24): VoiceMetrics[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    return this.metricsBuffer.filter(metric => metric.timestamp > cutoff);
  }

  private getPeriodStart(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'hour':
        now.setHours(now.getHours() - 1);
        break;
      case 'day':
        now.setDate(now.getDate() - 1);
        break;
      case 'week':
        now.setDate(now.getDate() - 7);
        break;
      case 'month':
        now.setMonth(now.getMonth() - 1);
        break;
    }
    return now;
  }

  private getPreviousPeriodStart(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'hour':
        now.setHours(now.getHours() - 2);
        break;
      case 'day':
        now.setDate(now.getDate() - 2);
        break;
      case 'week':
        now.setDate(now.getDate() - 14);
        break;
      case 'month':
        now.setMonth(now.getMonth() - 2);
        break;
    }
    return now;
  }

  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue === 0 ? 0 : 100;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  private determineTrendDirection(responseChange: number, qualityChange: number): 'improving' | 'stable' | 'declining' {
    const avgChange = (Math.abs(responseChange) + qualityChange) / 2;
    
    if (avgChange > 5) {
      return responseChange < 0 && qualityChange > 0 ? 'improving' : 'declining';
    }
    
    return 'stable';
  }

  private calculateCostEfficiency(metrics: VoiceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const totalCost = metrics.reduce((sum, m) => sum + m.costEstimate, 0);
    const totalQuality = metrics.reduce((sum, m) => sum + m.qualityScore, 0);
    
    return totalQuality / Math.max(totalCost, 0.01); // Avoid division by zero
  }

  private getComplexityBreakdown(metrics: VoiceMetrics[]): any {
    const breakdown = { simple: 0, moderate: 0, complex: 0 };
    
    for (const metric of metrics) {
      breakdown[metric.taskComplexity]++;
    }
    
    return breakdown;
  }

  private calculateSpeedScore(metrics: VoiceMetrics[]): number {
    const avgResponseTime = this.calculateAverage(metrics, 'responseTime');
    // Convert response time to score (lower is better)
    // Assuming 5000ms is baseline, 1000ms is excellent
    return Math.max(0, Math.min(100, (5000 - avgResponseTime) / 5000 * 100));
  }

  private calculateCostEfficiencyScore(metrics: VoiceMetrics[]): number {
    const costEfficiency = this.calculateCostEfficiency(metrics);
    // Normalize to 0-100 scale
    return Math.min(100, costEfficiency * 20);
  }

  private identifyStrengths(quality: number, speed: number, reliability: number, cost: number): string[] {
    const strengths = [];
    
    if (quality > 85) strengths.push('High quality responses');
    if (speed > 85) strengths.push('Fast response times');
    if (reliability > 90) strengths.push('Excellent reliability');
    if (cost > 85) strengths.push('Cost-effective operation');
    
    return strengths;
  }

  private identifyWeaknesses(quality: number, speed: number, reliability: number, cost: number): string[] {
    const weaknesses = [];
    
    if (quality < 70) weaknesses.push('Response quality needs improvement');
    if (speed < 70) weaknesses.push('Response times are slow');
    if (reliability < 80) weaknesses.push('Reliability issues detected');
    if (cost < 70) weaknesses.push('Cost efficiency could be improved');
    
    return weaknesses;
  }

  private identifyOptimalUseCases(voiceId: string, metrics: VoiceMetrics[]): string[] {
    const useCases = [];
    
    // Analyze task complexity performance
    const complexityPerformance = this.analyzeComplexityPerformance(metrics);
    
    if (complexityPerformance.simple > 0.8) useCases.push('Simple implementation tasks');
    if (complexityPerformance.moderate > 0.8) useCases.push('Moderate complexity projects');
    if (complexityPerformance.complex > 0.8) useCases.push('Complex system design');
    
    // Add voice-specific use cases based on ID
    const voiceUseCases: Record<string, string[]> = {
      'security': ['Security reviews', 'Vulnerability assessments', 'Authentication systems'],
      'architect': ['System architecture', 'Design patterns', 'Scalability planning'],
      'developer': ['Code implementation', 'API development', 'Feature development'],
      'analyzer': ['Performance analysis', 'Code optimization', 'Bottleneck identification']
    };
    
    if (voiceUseCases[voiceId]) {
      useCases.push(...voiceUseCases[voiceId]);
    }
    
    return useCases;
  }

  private analyzeComplexityPerformance(metrics: VoiceMetrics[]): { simple: number; moderate: number; complex: number } {
    const byComplexity = {
      simple: metrics.filter(m => m.taskComplexity === 'simple'),
      moderate: metrics.filter(m => m.taskComplexity === 'moderate'),
      complex: metrics.filter(m => m.taskComplexity === 'complex')
    };
    
    return {
      simple: byComplexity.simple.length > 0 ? this.calculateAverage(byComplexity.simple, 'qualityScore') : 0,
      moderate: byComplexity.moderate.length > 0 ? this.calculateAverage(byComplexity.moderate, 'qualityScore') : 0,
      complex: byComplexity.complex.length > 0 ? this.calculateAverage(byComplexity.complex, 'qualityScore') : 0
    };
  }

  private generateImprovementRecommendations(voiceId: string, metrics: VoiceMetrics[]): string[] {
    const recommendations = [];
    
    const avgQuality = this.calculateAverage(metrics, 'qualityScore');
    const avgResponseTime = this.calculateAverage(metrics, 'responseTime');
    const successRate = metrics.filter(m => m.success).length / metrics.length;
    
    if (avgQuality < 0.8) {
      recommendations.push('Improve response quality through better prompt engineering');
    }
    
    if (avgResponseTime > 5000) {
      recommendations.push('Optimize response time through caching or model optimization');
    }
    
    if (successRate < 0.9) {
      recommendations.push('Improve reliability through better error handling');
    }
    
    return recommendations;
  }

  private calculateCostPerQualityPoint(metrics: VoiceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const totalCost = metrics.reduce((sum, m) => sum + m.costEstimate, 0);
    const totalQualityPoints = metrics.reduce((sum, m) => sum + (m.qualityScore * 100), 0);
    
    return totalCost / Math.max(totalQualityPoints, 1);
  }

  private calculateROIScore(metrics: VoiceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const avgQuality = this.calculateAverage(metrics, 'qualityScore');
    const avgCost = this.calculateAverage(metrics, 'costEstimate');
    
    // ROI = (Quality Benefit - Cost) / Cost
    const qualityBenefit = avgQuality; // Assuming quality directly translates to benefit
    return ((qualityBenefit - avgCost) / Math.max(avgCost, 0.01)) * 100;
  }

  private findUnderutilizedVoices(): string[] {
    const allMetrics = this.getAllMetrics();
    const voiceUsage = new Map<string, number>();
    
    for (const metric of allMetrics) {
      voiceUsage.set(metric.voiceId, (voiceUsage.get(metric.voiceId) || 0) + 1);
    }
    
    const averageUsage = Array.from(voiceUsage.values()).reduce((sum, count) => sum + count, 0) / voiceUsage.size;
    const underutilizedThreshold = averageUsage * 0.3; // 30% of average usage
    
    return Array.from(voiceUsage.entries())
      .filter(([_, count]) => count < underutilizedThreshold)
      .map(([voiceId]) => voiceId);
  }

  private findInefficientMultiVoiceUsage(): number {
    // Placeholder implementation - would analyze actual multi-voice usage patterns
    return 0.1; // Assuming 10% inefficiency
  }

  private assessCachingPotential(): number {
    // Placeholder implementation - would analyze request patterns for caching opportunities
    return 0.15; // Assuming 15% caching potential
  }

  private assessBatchingPotential(): number {
    // Placeholder implementation - would analyze request timing for batching opportunities
    return 0.08; // Assuming 8% batching potential
  }

  private generateOptimizationActions(opportunities: OptimizationOpportunity[]): string[] {
    return opportunities
      .filter(opp => opp.priority === 'high')
      .map(opp => `Implement ${opp.type} optimization: ${opp.description}`);
  }

  private calculateProjectedBenefits(opportunities: OptimizationOpportunity[]): any {
    const totalSavings = opportunities.reduce((sum, opp) => sum + opp.potentialSavings, 0);
    
    return {
      monthlySavings: totalSavings * 30, // Assuming daily savings * 30
      qualityImprovements: 0.05, // 5% quality improvement
      efficiencyGains: 0.20 // 20% efficiency improvement
    };
  }

  private calculateSystemTrends(): any {
    const recentMetrics = this.getRecentMetrics();
    const previousMetrics = this.getRecentMetrics(48).slice(0, -recentMetrics.length);
    
    if (previousMetrics.length === 0) {
      return { trend: 'insufficient_data' };
    }
    
    const recentAvgQuality = this.calculateAverage(recentMetrics, 'qualityScore');
    const previousAvgQuality = this.calculateAverage(previousMetrics, 'qualityScore');
    const qualityChange = this.calculatePercentageChange(previousAvgQuality, recentAvgQuality);
    
    return {
      qualityTrend: qualityChange > 2 ? 'improving' : qualityChange < -2 ? 'declining' : 'stable',
      qualityChange: qualityChange.toFixed(1)
    };
  }

  private getActiveAlerts(): any[] {
    // Placeholder - would return current active alerts
    return [];
  }

  private getSystemRecommendations(): string[] {
    const recommendations = [];
    const recentMetrics = this.getRecentMetrics();
    
    if (recentMetrics.length === 0) {
      recommendations.push('Start collecting performance metrics for optimization insights');
      return recommendations;
    }
    
    const avgResponseTime = this.calculateAverage(recentMetrics, 'responseTime');
    if (avgResponseTime > 5000) {
      recommendations.push('System-wide response time optimization needed');
    }
    
    const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
    if (successRate < 0.9) {
      recommendations.push('Improve system reliability - success rate below 90%');
    }
    
    return recommendations;
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: any) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'voiceId', 'responseTime', 'qualityScore', 'success', 'costEstimate'];
      const rows = this.metricsBuffer.map(m => [
        m.timestamp.toISOString(),
        m.voiceId,
        m.responseTime.toString(),
        m.qualityScore.toString(),
        m.success.toString(),
        m.costEstimate.toString()
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
    
    return JSON.stringify(this.metricsBuffer, null, 2);
  }
}