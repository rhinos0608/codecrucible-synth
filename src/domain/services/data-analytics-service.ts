/**
 * Data Analytics Domain Service
 * Pure business logic for data processing and analytics
 * 
 * Architecture Compliance:
 * - Domain layer: pure business logic only
 * - No infrastructure dependencies
 * - Analytics strategies and calculations
 * - Statistical operations and insights generation
 */

export interface VoiceInteractionAnalytics {
  totalInteractions: number;
  averageConfidence: number;
  interactions24h: number;
  voicePerformance: Map<string, VoicePerformanceMetrics>;
  confidenceTrends: ConfidenceTrend[];
  tokenUsagePatterns: TokenUsagePattern[];
}

export interface VoicePerformanceMetrics {
  voiceName: string;
  totalUsage: number;
  averageConfidence: number;
  averageLatency: number;
  successRate: number;
  preferredForTasks: string[];
}

export interface ConfidenceTrend {
  timeWindow: Date;
  averageConfidence: number;
  interactionCount: number;
  confidenceDistribution: ConfidenceDistribution;
}

export interface ConfidenceDistribution {
  low: number;      // 0-0.3
  medium: number;   // 0.3-0.7
  high: number;     // 0.7-1.0
}

export interface TokenUsagePattern {
  timeWindow: Date;
  totalTokens: number;
  averageTokensPerRequest: number;
  peakUsage: number;
  costEstimate: number;
}

export interface CodeAnalysisInsights {
  totalAnalyses: number;
  averageQualityScore: number;
  analysisTypeDistribution: Map<string, number>;
  qualityTrends: QualityTrend[];
  projectInsights: ProjectInsight[];
  fileTypeAnalytics: FileTypeAnalytic[];
}

export interface QualityTrend {
  timeWindow: Date;
  averageQuality: number;
  analysisCount: number;
  qualityDistribution: QualityDistribution;
}

export interface QualityDistribution {
  poor: number;     // 0-0.4
  fair: number;     // 0.4-0.6
  good: number;     // 0.6-0.8
  excellent: number; // 0.8-1.0
}

export interface ProjectInsight {
  projectId: number;
  totalAnalyses: number;
  averageQuality: number;
  mostAnalyzedFiles: string[];
  qualityImprovement: number;
  riskAreas: string[];
}

export interface FileTypeAnalytic {
  fileExtension: string;
  analysisCount: number;
  averageQuality: number;
  commonIssues: string[];
}

export interface DatabaseOptimizationInsights {
  queryPerformancePatterns: QueryPerformancePattern[];
  indexRecommendations: IndexRecommendation[];
  cacheEfficiencyMetrics: CacheEfficiencyMetric[];
  connectionPoolAnalytics: ConnectionPoolAnalytic[];
}

export interface QueryPerformancePattern {
  queryType: string;
  averageLatency: number;
  executionCount: number;
  peakLatency: number;
  optimizationPotential: number;
}

export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  expectedImprovement: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface CacheEfficiencyMetric {
  cacheType: string;
  hitRate: number;
  missRate: number;
  averageRetrievalTime: number;
  recommendedTTL: number;
}

export interface ConnectionPoolAnalytic {
  poolName: string;
  averageUtilization: number;
  peakUtilization: number;
  connectionLeaks: number;
  recommendedSize: number;
}

/**
 * Data Analytics Domain Service
 * Processes raw data to generate business insights and analytics
 */
export class DataAnalyticsService {
  
  /**
   * Analyze voice interaction patterns and performance
   */
  analyzeVoiceInteractions(
    interactions: Array<{
      sessionId: string;
      voiceName: string;
      confidence: number;
      tokensUsed: number;
      createdAt: Date;
      responseTime?: number;
    }>
  ): VoiceInteractionAnalytics {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Basic statistics
    const totalInteractions = interactions.length;
    const averageConfidence = this.calculateMean(interactions.map(i => i.confidence));
    const interactions24h = interactions.filter(i => i.createdAt >= yesterday).length;

    // Voice performance analysis
    const voicePerformance = this.analyzeVoicePerformance(interactions);

    // Confidence trends (grouped by hour for last 24h)
    const confidenceTrends = this.analyzeConfidenceTrends(interactions, 24);

    // Token usage patterns
    const tokenUsagePatterns = this.analyzeTokenUsagePatterns(interactions);

    return {
      totalInteractions,
      averageConfidence,
      interactions24h,
      voicePerformance,
      confidenceTrends,
      tokenUsagePatterns,
    };
  }

  /**
   * Analyze code analysis results for insights
   */
  analyzeCodeAnalysisResults(
    analyses: Array<{
      projectId: number;
      filePath: string;
      analysisType: string;
      qualityScore: number;
      createdAt: Date;
      results: any;
    }>
  ): CodeAnalysisInsights {
    const totalAnalyses = analyses.length;
    const averageQualityScore = this.calculateMean(
      analyses.filter(a => a.qualityScore != null).map(a => a.qualityScore)
    );

    // Analysis type distribution
    const analysisTypeDistribution = this.calculateDistribution(
      analyses,
      a => a.analysisType
    );

    // Quality trends over time
    const qualityTrends = this.analyzeQualityTrends(analyses, 7); // Last 7 days

    // Project-specific insights
    const projectInsights = this.generateProjectInsights(analyses);

    // File type analytics
    const fileTypeAnalytics = this.analyzeFileTypePatterns(analyses);

    return {
      totalAnalyses,
      averageQualityScore,
      analysisTypeDistribution,
      qualityTrends,
      projectInsights,
      fileTypeAnalytics,
    };
  }

  /**
   * Analyze database performance patterns
   */
  analyzeDatabasePerformance(
    queryMetrics: Array<{
      queryType: string;
      latency: number;
      timestamp: Date;
      cacheHit: boolean;
      connectionPool: string;
    }>
  ): DatabaseOptimizationInsights {
    // Query performance patterns
    const queryPerformancePatterns = this.analyzeQueryPerformance(queryMetrics);

    // Cache efficiency
    const cacheEfficiencyMetrics = this.analyzeCacheEfficiency(queryMetrics);

    // Connection pool analytics
    const connectionPoolAnalytics = this.analyzeConnectionPoolUsage(queryMetrics);

    // Index recommendations (simplified heuristics)
    const indexRecommendations = this.generateIndexRecommendations(queryPerformancePatterns);

    return {
      queryPerformancePatterns,
      indexRecommendations,
      cacheEfficiencyMetrics,
      connectionPoolAnalytics,
    };
  }

  /**
   * Generate performance optimization recommendations
   */
  generateOptimizationRecommendations(
    voiceAnalytics: VoiceInteractionAnalytics,
    codeAnalytics: CodeAnalysisInsights,
    dbAnalytics: DatabaseOptimizationInsights
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Voice optimization recommendations
    recommendations.push(...this.generateVoiceOptimizationRecommendations(voiceAnalytics));

    // Code quality recommendations
    recommendations.push(...this.generateCodeQualityRecommendations(codeAnalytics));

    // Database optimization recommendations
    recommendations.push(...this.generateDatabaseOptimizationRecommendations(dbAnalytics));

    // Sort by impact and priority
    return recommendations.sort((a, b) => {
      const impactOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }

  // Private helper methods for voice analysis

  private analyzeVoicePerformance(
    interactions: Array<{
      voiceName: string;
      confidence: number;
      tokensUsed: number;
      responseTime?: number;
    }>
  ): Map<string, VoicePerformanceMetrics> {
    const voiceGroups = this.groupBy(interactions, i => i.voiceName);
    const performanceMap = new Map<string, VoicePerformanceMetrics>();

    for (const [voiceName, voiceInteractions] of voiceGroups) {
      const totalUsage = voiceInteractions.length;
      const averageConfidence = this.calculateMean(voiceInteractions.map(i => i.confidence));
      const averageLatency = this.calculateMean(
        voiceInteractions.filter(i => i.responseTime).map(i => i.responseTime!)
      );
      const successRate = voiceInteractions.filter(i => i.confidence > 0.7).length / totalUsage;

      performanceMap.set(voiceName, {
        voiceName,
        totalUsage,
        averageConfidence,
        averageLatency: averageLatency || 0,
        successRate,
        preferredForTasks: [], // Would need task classification data
      });
    }

    return performanceMap;
  }

  private analyzeConfidenceTrends(
    interactions: Array<{ confidence: number; createdAt: Date }>,
    hoursBack: number
  ): ConfidenceTrend[] {
    const now = new Date();
    const trends: ConfidenceTrend[] = [];

    for (let hour = hoursBack; hour >= 0; hour--) {
      const windowStart = new Date(now.getTime() - hour * 60 * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);

      const windowInteractions = interactions.filter(
        i => i.createdAt >= windowStart && i.createdAt < windowEnd
      );

      if (windowInteractions.length > 0) {
        const averageConfidence = this.calculateMean(windowInteractions.map(i => i.confidence));
        const distribution = this.calculateConfidenceDistribution(windowInteractions);

        trends.push({
          timeWindow: windowStart,
          averageConfidence,
          interactionCount: windowInteractions.length,
          confidenceDistribution: distribution,
        });
      }
    }

    return trends;
  }

  private analyzeTokenUsagePatterns(
    interactions: Array<{ tokensUsed: number; createdAt: Date }>
  ): TokenUsagePattern[] {
    // Group by hour for the last 24 hours
    const patterns: TokenUsagePattern[] = [];
    const now = new Date();

    for (let hour = 24; hour >= 0; hour--) {
      const windowStart = new Date(now.getTime() - hour * 60 * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);

      const windowInteractions = interactions.filter(
        i => i.createdAt >= windowStart && i.createdAt < windowEnd
      );

      if (windowInteractions.length > 0) {
        const totalTokens = windowInteractions.reduce((sum, i) => sum + i.tokensUsed, 0);
        const averageTokensPerRequest = totalTokens / windowInteractions.length;
        const peakUsage = Math.max(...windowInteractions.map(i => i.tokensUsed));
        const costEstimate = this.estimateTokenCost(totalTokens);

        patterns.push({
          timeWindow: windowStart,
          totalTokens,
          averageTokensPerRequest,
          peakUsage,
          costEstimate,
        });
      }
    }

    return patterns;
  }

  // Private helper methods for code analysis

  private analyzeQualityTrends(
    analyses: Array<{ qualityScore: number; createdAt: Date }>,
    daysBack: number
  ): QualityTrend[] {
    const trends: QualityTrend[] = [];
    const now = new Date();

    for (let day = daysBack; day >= 0; day--) {
      const windowStart = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

      const dayAnalyses = analyses.filter(
        a => a.createdAt >= windowStart && a.createdAt < windowEnd && a.qualityScore != null
      );

      if (dayAnalyses.length > 0) {
        const averageQuality = this.calculateMean(dayAnalyses.map(a => a.qualityScore));
        const distribution = this.calculateQualityDistribution(dayAnalyses);

        trends.push({
          timeWindow: windowStart,
          averageQuality,
          analysisCount: dayAnalyses.length,
          qualityDistribution: distribution,
        });
      }
    }

    return trends;
  }

  private generateProjectInsights(
    analyses: Array<{
      projectId: number;
      filePath: string;
      qualityScore: number;
      createdAt: Date;
    }>
  ): ProjectInsight[] {
    const projectGroups = this.groupBy(analyses, a => a.projectId);
    const insights: ProjectInsight[] = [];

    for (const [projectId, projectAnalyses] of projectGroups) {
      const totalAnalyses = projectAnalyses.length;
      const averageQuality = this.calculateMean(
        projectAnalyses.filter(a => a.qualityScore != null).map(a => a.qualityScore)
      );

      const fileFrequency = this.calculateDistribution(projectAnalyses, a => a.filePath);
      const mostAnalyzedFiles = Array.from(fileFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);

      // Calculate quality improvement over time (simplified)
      const sortedAnalyses = projectAnalyses
        .filter(a => a.qualityScore != null)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const qualityImprovement = sortedAnalyses.length > 1
        ? sortedAnalyses[sortedAnalyses.length - 1].qualityScore - sortedAnalyses[0].qualityScore
        : 0;

      const riskAreas = this.identifyRiskAreas(projectAnalyses);

      insights.push({
        projectId,
        totalAnalyses,
        averageQuality,
        mostAnalyzedFiles,
        qualityImprovement,
        riskAreas,
      });
    }

    return insights;
  }

  private analyzeFileTypePatterns(
    analyses: Array<{ filePath: string; qualityScore: number }>
  ): FileTypeAnalytic[] {
    const fileTypeGroups = this.groupBy(analyses, a => this.getFileExtension(a.filePath));
    const analytics: FileTypeAnalytic[] = [];

    for (const [extension, fileAnalyses] of fileTypeGroups) {
      const analysisCount = fileAnalyses.length;
      const averageQuality = this.calculateMean(
        fileAnalyses.filter(a => a.qualityScore != null).map(a => a.qualityScore)
      );

      analytics.push({
        fileExtension: extension,
        analysisCount,
        averageQuality,
        commonIssues: [], // Would need issue classification data
      });
    }

    return analytics.sort((a, b) => b.analysisCount - a.analysisCount);
  }

  // Private helper methods for database analysis

  private analyzeQueryPerformance(
    metrics: Array<{ queryType: string; latency: number }>
  ): QueryPerformancePattern[] {
    const queryGroups = this.groupBy(metrics, m => m.queryType);
    const patterns: QueryPerformancePattern[] = [];

    for (const [queryType, queryMetrics] of queryGroups) {
      const latencies = queryMetrics.map(m => m.latency);
      const averageLatency = this.calculateMean(latencies);
      const executionCount = queryMetrics.length;
      const peakLatency = Math.max(...latencies);
      
      // Simple optimization potential calculation
      const optimizationPotential = peakLatency > averageLatency * 2 ? 0.8 : 
                                   averageLatency > 1000 ? 0.6 : 0.3;

      patterns.push({
        queryType,
        averageLatency,
        executionCount,
        peakLatency,
        optimizationPotential,
      });
    }

    return patterns.sort((a, b) => b.optimizationPotential - a.optimizationPotential);
  }

  private analyzeCacheEfficiency(
    metrics: Array<{ cacheHit: boolean; latency: number }>
  ): CacheEfficiencyMetric[] {
    const totalQueries = metrics.length;
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const cacheMisses = totalQueries - cacheHits;

    const hitRate = cacheHits / totalQueries;
    const missRate = cacheMisses / totalQueries;

    const avgRetrievalTime = this.calculateMean(metrics.map(m => m.latency));

    return [{
      cacheType: 'query-cache',
      hitRate,
      missRate,
      averageRetrievalTime: avgRetrievalTime,
      recommendedTTL: this.calculateOptimalTTL(hitRate, avgRetrievalTime),
    }];
  }

  private analyzeConnectionPoolUsage(
    metrics: Array<{ connectionPool: string; timestamp: Date }>
  ): ConnectionPoolAnalytic[] {
    const poolGroups = this.groupBy(metrics, m => m.connectionPool);
    const analytics: ConnectionPoolAnalytic[] = [];

    for (const [poolName, poolMetrics] of poolGroups) {
      // This would need actual connection pool utilization data
      // For now, we'll estimate based on query frequency
      const queryFrequency = poolMetrics.length;
      const estimatedUtilization = Math.min(queryFrequency / 100, 1.0);

      analytics.push({
        poolName,
        averageUtilization: estimatedUtilization,
        peakUtilization: estimatedUtilization * 1.5,
        connectionLeaks: 0, // Would need actual leak detection
        recommendedSize: Math.ceil(estimatedUtilization * 10),
      });
    }

    return analytics;
  }

  private generateIndexRecommendations(
    patterns: QueryPerformancePattern[]
  ): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    patterns.forEach(pattern => {
      if (pattern.optimizationPotential > 0.6 && pattern.averageLatency > 500) {
        recommendations.push({
          tableName: this.extractTableName(pattern.queryType),
          columns: this.extractPotentialIndexColumns(pattern.queryType),
          expectedImprovement: pattern.optimizationPotential,
          priority: pattern.optimizationPotential > 0.8 ? 'high' : 'medium',
          reason: `High latency queries (${pattern.averageLatency}ms avg) with optimization potential`,
        });
      }
    });

    return recommendations;
  }

  // Recommendation generation methods

  private generateVoiceOptimizationRecommendations(
    analytics: VoiceInteractionAnalytics
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for low-confidence voices
    for (const [voiceName, metrics] of analytics.voicePerformance) {
      if (metrics.averageConfidence < 0.6) {
        recommendations.push({
          type: 'voice-optimization',
          title: `Improve ${voiceName} Voice Performance`,
          description: `${voiceName} has low average confidence (${metrics.averageConfidence.toFixed(2)})`,
          impact: 'medium',
          effort: 'medium',
          estimatedImprovement: '25% confidence increase',
        });
      }
    }

    return recommendations;
  }

  private generateCodeQualityRecommendations(
    analytics: CodeAnalysisInsights
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    if (analytics.averageQualityScore < 0.7) {
      recommendations.push({
        type: 'code-quality',
        title: 'Improve Overall Code Quality',
        description: `Average quality score is ${analytics.averageQualityScore.toFixed(2)}, below target of 0.7`,
        impact: 'high',
        effort: 'high',
        estimatedImprovement: 'Reduce technical debt by 30%',
      });
    }

    return recommendations;
  }

  private generateDatabaseOptimizationRecommendations(
    analytics: DatabaseOptimizationInsights
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    analytics.indexRecommendations.forEach(indexRec => {
      recommendations.push({
        type: 'database-performance',
        title: `Add Index to ${indexRec.tableName}`,
        description: `Index on ${indexRec.columns.join(', ')} could improve performance by ${(indexRec.expectedImprovement * 100).toFixed(0)}%`,
        impact: indexRec.priority as any,
        effort: 'low',
        estimatedImprovement: `${(indexRec.expectedImprovement * 100).toFixed(0)}% query performance improvement`,
      });
    });

    return recommendations;
  }

  // Utility methods

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private groupBy<T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of array) {
      const key = keyFn(item);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }
    return map;
  }

  private calculateDistribution<T>(array: T[], keyFn: (item: T) => string): Map<string, number> {
    const distribution = new Map<string, number>();
    for (const item of array) {
      const key = keyFn(item);
      distribution.set(key, (distribution.get(key) || 0) + 1);
    }
    return distribution;
  }

  private calculateConfidenceDistribution(
    interactions: Array<{ confidence: number }>
  ): ConfidenceDistribution {
    const distribution = { low: 0, medium: 0, high: 0 };
    
    interactions.forEach(i => {
      if (i.confidence < 0.3) distribution.low++;
      else if (i.confidence < 0.7) distribution.medium++;
      else distribution.high++;
    });

    return distribution;
  }

  private calculateQualityDistribution(
    analyses: Array<{ qualityScore: number }>
  ): QualityDistribution {
    const distribution = { poor: 0, fair: 0, good: 0, excellent: 0 };
    
    analyses.forEach(a => {
      if (a.qualityScore < 0.4) distribution.poor++;
      else if (a.qualityScore < 0.6) distribution.fair++;
      else if (a.qualityScore < 0.8) distribution.good++;
      else distribution.excellent++;
    });

    return distribution;
  }

  private estimateTokenCost(tokens: number): number {
    // Simplified cost estimation (would use actual pricing models)
    return tokens * 0.0001; // $0.0001 per token
  }

  private identifyRiskAreas(analyses: Array<{ filePath: string; qualityScore: number }>): string[] {
    return analyses
      .filter(a => a.qualityScore < 0.5)
      .map(a => a.filePath)
      .slice(0, 3); // Top 3 risk areas
  }

  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'unknown';
  }

  private calculateOptimalTTL(hitRate: number, avgLatency: number): number {
    // Simple heuristic: higher hit rate and lower latency suggest longer TTL
    const baseTTL = 300; // 5 minutes
    const hitRateMultiplier = hitRate + 0.5; // 0.5 to 1.5
    const latencyMultiplier = avgLatency < 100 ? 1.5 : avgLatency < 500 ? 1.0 : 0.5;
    
    return Math.round(baseTTL * hitRateMultiplier * latencyMultiplier);
  }

  private extractTableName(queryType: string): string {
    // Simplified table name extraction
    return queryType.split('_')[0] || 'unknown_table';
  }

  private extractPotentialIndexColumns(queryType: string): string[] {
    // Simplified column extraction (would need query parsing)
    return ['id', 'created_at']; // Common index candidates
  }
}

export interface OptimizationRecommendation {
  type: 'voice-optimization' | 'code-quality' | 'database-performance';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  estimatedImprovement: string;
}