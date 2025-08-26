/**
 * Quality Analyzer Integration Adapter
 * Provides backward compatibility for SequentialDualAgentSystem while migrating to the reconstructed analyzer
 * Created: August 26, 2025 - Quality Analyzer Reconstruction Agent
 * 
 * This adapter:
 * - Maps old API to new reconstructed analyzer
 * - Provides data transformation between old and new metrics formats
 * - Maintains backward compatibility during migration
 * - Adds enhanced functionality while preserving existing behavior
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { 
  ReconstructedCodeQualityAnalyzer, 
  ReconstructedQualityConfig,
  AnalysisResult
} from './reconstructed-code-quality-analyzer.js';

// Legacy types from the old analyzer for backward compatibility
export interface ComprehensiveQualityMetrics {
  overallScore: number;
  complexity: {
    cyclomaticComplexity: number;
    halsteadComplexity: {
      programLength: number;
      vocabulary: number;
      programLevel: number;
      difficulty: number;
      effort: number;
      timeRequired: number;
      bugsDelivered: number;
    };
    maintainabilityIndex: number;
    linesOfCode: number;
    logicalLinesOfCode: number;
    commentLines: number;
    commentRatio: number;
  };
  linting: {
    totalErrors: number;
    totalWarnings: number;
    totalIssues: number;
    score: number;
    errorsByCategory: Record<string, number>;
    fixableIssues: number;
  };
  formatting: {
    isFormatted: boolean;
    formattingIssues: number;
    score: number;
    fixedCode?: string;
  };
  typeCoverage: {
    totalSymbols: number;
    typedSymbols: number;
    coverage: number;
    untypedAreas: Array<{
      file: string;
      line: number;
      symbol: string;
    }>;
  };
  duplication: {
    duplicatedLines: number;
    totalLines: number;
    duplicationPercentage: number;
    duplicatedBlocks: Array<{
      lines: number;
      tokens: number;
      files: string[];
    }>;
  };
  technicalDebtRatio: number;
  recommendations: QualityRecommendation[];
  trendData?: QualityTrend;
}

export interface QualityRecommendation {
  category: 'complexity' | 'maintainability' | 'linting' | 'formatting' | 'types' | 'duplication' | 'documentation';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
  estimatedImpact: number;
  automated: boolean;
}

export interface QualityTrend {
  previousScore: number;
  currentScore: number;
  improvement: number;
  trendDirection: 'improving' | 'stable' | 'declining';
  improvementRate: number;
}

// Legacy configuration interface
export interface QualityMetricsConfig {
  cyclomaticComplexity: {
    lowThreshold: number;
    mediumThreshold: number;
    highThreshold: number;
  };
  maintainabilityIndex: {
    lowThreshold: number;
    mediumThreshold: number;
    highThreshold: number;
  };
  weights: {
    cyclomaticComplexity: number;
    maintainabilityIndex: number;
    lintingScore: number;
    formattingScore: number;
    typeCoverage: number;
    documentation: number;
    duplication: number;
    halsteadComplexity: number;
  };
  eslintConfigPath?: string;
  prettierConfigPath?: string;
  tsconfigPath?: string;
}

/**
 * Adapter that provides the legacy CodeQualityAnalyzer interface
 * while using the new ReconstructedCodeQualityAnalyzer internally
 */
export class QualityAnalyzerIntegrationAdapter extends EventEmitter {
  private reconstructedAnalyzer: ReconstructedCodeQualityAnalyzer;
  private adapterConfig: QualityMetricsConfig;

  constructor(config?: Partial<QualityMetricsConfig>) {
    super();
    
    // Convert legacy config to new format
    this.adapterConfig = {
      cyclomaticComplexity: {
        lowThreshold: 10,
        mediumThreshold: 20,
        highThreshold: 30,
      },
      maintainabilityIndex: {
        lowThreshold: 25,
        mediumThreshold: 85,
        highThreshold: 100,
      },
      weights: {
        cyclomaticComplexity: 0.20,
        maintainabilityIndex: 0.18,
        lintingScore: 0.15,
        formattingScore: 0.10,
        typeCoverage: 0.15,
        documentation: 0.12,
        duplication: 0.10,
        halsteadComplexity: 0.10,
      },
      eslintConfigPath: 'eslint.config.js',
      prettierConfigPath: '.prettierrc',
      tsconfigPath: 'tsconfig.json',
      ...config
    };

    // Create reconstructed analyzer with mapped configuration
    const reconstructedConfig: Partial<ReconstructedQualityConfig> = {
      quality: {
        complexity: {
          cyclomaticLow: this.adapterConfig.cyclomaticComplexity.lowThreshold,
          cyclomaticMedium: this.adapterConfig.cyclomaticComplexity.mediumThreshold,
          cyclomaticHigh: this.adapterConfig.cyclomaticComplexity.highThreshold,
          cyclomaticCritical: this.adapterConfig.cyclomaticComplexity.highThreshold + 10,
          cognitiveLow: 15,
          cognitiveMedium: 25,
          cognitiveHigh: 35,
          halsteadEffortLow: 1000,
          halsteadEffortMedium: 5000,
          halsteadEffortHigh: 10000
        },
        maintainability: {
          excellent: this.adapterConfig.maintainabilityIndex.highThreshold,
          acceptable: this.adapterConfig.maintainabilityIndex.mediumThreshold,
          problematic: this.adapterConfig.maintainabilityIndex.lowThreshold + 25,
          critical: this.adapterConfig.maintainabilityIndex.lowThreshold
        },
        weights: {
          complexity: this.adapterConfig.weights.cyclomaticComplexity,
          maintainability: this.adapterConfig.weights.maintainabilityIndex,
          linting: this.adapterConfig.weights.lintingScore,
          formatting: this.adapterConfig.weights.formattingScore,
          typeScript: this.adapterConfig.weights.typeCoverage,
          documentation: this.adapterConfig.weights.documentation,
          security: 0.05 // Add security weight not present in legacy
        }
      },
      tools: {
        eslintConfigPath: this.adapterConfig.eslintConfigPath,
        prettierConfigPath: this.adapterConfig.prettierConfigPath,
        tsconfigPath: this.adapterConfig.tsconfigPath
      },
      performance: {
        maxMemoryMB: 512,
        maxAnalysisTimeMs: 60000,
        maxConcurrentAnalyses: 3
      },
      analysis: {
        enableProgressReporting: false, // Disable for compatibility
        enableTrendAnalysis: true,
        enablePerformanceMonitoring: true,
        enableDetailedRecommendations: true
      }
    };

    this.reconstructedAnalyzer = new ReconstructedCodeQualityAnalyzer(reconstructedConfig);

    // Forward events from reconstructed analyzer
    this.reconstructedAnalyzer.on('analysisComplete', (result) => {
      this.emit('analysis_complete', { 
        result: this.transformToLegacyFormat(result), 
        duration: result.performanceMetrics.totalDuration 
      });
    });

    this.reconstructedAnalyzer.on('performanceAlert', (alert) => {
      logger.warn(`Quality analysis performance alert: ${alert.message}`);
    });

    logger.info('Quality Analyzer Integration Adapter initialized with legacy compatibility');
  }

  /**
   * Legacy API: analyzeCode method with old signature
   * Maps to new reconstructed analyzer while maintaining compatibility
   */
  async analyzeCode(
    code: string,
    language: 'typescript' | 'javascript' = 'typescript',
    filename?: string
  ): Promise<ComprehensiveQualityMetrics> {
    try {
      logger.debug(`Adapter: analyzing code with legacy API compatibility (language: ${language})`);
      
      const analysisResult = await this.reconstructedAnalyzer.analyzeCode(code, language, {
        filename,
        identifier: filename ? this.generateIdentifier(filename) : undefined,
        enableProgressReporting: false // Disabled for legacy compatibility
      });

      // Transform new format to legacy format
      const legacyMetrics = this.transformToLegacyFormat(analysisResult);
      
      logger.debug(`Adapter: analysis complete, transformed to legacy format (score: ${legacyMetrics.overallScore})`);
      
      return legacyMetrics;

    } catch (error) {
      logger.error('Adapter: analysis failed:', error);
      throw new Error(`Quality analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transform new format to legacy format for backward compatibility
   */
  private transformToLegacyFormat(analysisResult: AnalysisResult): ComprehensiveQualityMetrics {
    const { qualityMetrics, performanceMetrics } = analysisResult;
    
    // Map new AST metrics to legacy complexity format
    const complexity = {
      cyclomaticComplexity: qualityMetrics.astMetrics.cyclomaticComplexity,
      halsteadComplexity: {
        programLength: qualityMetrics.astMetrics.halsteadMetrics.programLength,
        vocabulary: qualityMetrics.astMetrics.halsteadMetrics.programVocabulary,
        programLevel: qualityMetrics.astMetrics.halsteadMetrics.programLevel,
        difficulty: qualityMetrics.astMetrics.halsteadMetrics.difficulty,
        effort: qualityMetrics.astMetrics.halsteadMetrics.effort,
        timeRequired: qualityMetrics.astMetrics.halsteadMetrics.timeRequired,
        bugsDelivered: qualityMetrics.astMetrics.halsteadMetrics.bugsDelivered
      },
      maintainabilityIndex: qualityMetrics.astMetrics.maintainabilityIndex,
      linesOfCode: qualityMetrics.astMetrics.linesOfCode,
      logicalLinesOfCode: qualityMetrics.astMetrics.logicalLinesOfCode,
      commentLines: qualityMetrics.astMetrics.commentLines,
      commentRatio: qualityMetrics.astMetrics.commentRatio
    };

    // Map tool results to legacy formats
    const linting = {
      totalErrors: qualityMetrics.eslintResults.totalErrors,
      totalWarnings: qualityMetrics.eslintResults.totalWarnings,
      totalIssues: qualityMetrics.eslintResults.totalIssues,
      score: qualityMetrics.eslintResults.score,
      errorsByCategory: qualityMetrics.eslintResults.errorsByCategory,
      fixableIssues: qualityMetrics.eslintResults.fixableIssues
    };

    const formatting = {
      isFormatted: qualityMetrics.prettierResults.isFormatted,
      formattingIssues: qualityMetrics.prettierResults.formattingIssues,
      score: qualityMetrics.prettierResults.score,
      fixedCode: qualityMetrics.prettierResults.fixedCode
    };

    // Map TypeScript results to legacy type coverage format
    const typeCoverage = {
      totalSymbols: qualityMetrics.typescriptResults.totalErrors + qualityMetrics.typescriptResults.totalWarnings + 100, // Estimate
      typedSymbols: Math.max(0, 100 - qualityMetrics.typescriptResults.totalErrors), // Estimate
      coverage: qualityMetrics.typescriptResults.coverage,
      untypedAreas: [] // Would need more detailed analysis
    };

    // Create minimal duplication data (not available from new analyzer by default)
    const duplication = {
      duplicatedLines: 0, // Not calculated in new analyzer
      totalLines: qualityMetrics.astMetrics.linesOfCode,
      duplicationPercentage: 0, // Not calculated in new analyzer
      duplicatedBlocks: []
    };

    // Transform recommendations to legacy format
    const recommendations: QualityRecommendation[] = qualityMetrics.recommendations.map(rec => ({
      category: this.mapRecommendationCategory(rec.category),
      priority: rec.priority,
      description: rec.description,
      suggestion: rec.suggestion,
      estimatedImpact: rec.estimatedImpact,
      automated: rec.automated
    }));

    // Transform trend data if available
    let trendData: QualityTrend | undefined;
    if (qualityMetrics.trendData) {
      trendData = {
        previousScore: qualityMetrics.trendData.previousScore,
        currentScore: qualityMetrics.trendData.currentScore,
        improvement: qualityMetrics.trendData.scoreDelta,
        trendDirection: qualityMetrics.trendData.trendDirection === 'volatile' ? 'stable' : qualityMetrics.trendData.trendDirection,
        improvementRate: qualityMetrics.trendData.improvementRate
      };
    }

    return {
      overallScore: qualityMetrics.overallScore,
      complexity,
      linting,
      formatting,
      typeCoverage,
      duplication,
      technicalDebtRatio: qualityMetrics.technicalDebtRatio,
      recommendations,
      trendData
    };
  }

  /**
   * Map new recommendation categories to legacy categories
   */
  private mapRecommendationCategory(
    newCategory: string
  ): 'complexity' | 'maintainability' | 'linting' | 'formatting' | 'types' | 'duplication' | 'documentation' {
    switch (newCategory) {
      case 'typescript':
        return 'types';
      case 'security':
        return 'maintainability'; // Map security to maintainability in legacy
      case 'performance':
        return 'complexity'; // Map performance to complexity in legacy
      default:
        return newCategory as any; // Direct mapping for matching categories
    }
  }

  /**
   * Generate identifier for trend tracking
   */
  private generateIdentifier(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9]/g, '-');
  }

  /**
   * Legacy API: getConfiguration
   */
  getConfiguration(): QualityMetricsConfig {
    return { ...this.adapterConfig };
  }

  /**
   * Legacy API: updateConfiguration
   */
  updateConfiguration(updates: Partial<QualityMetricsConfig>): void {
    Object.assign(this.adapterConfig, updates);
    
    // Update the underlying reconstructed analyzer configuration
    const reconstructedUpdates: Partial<ReconstructedQualityConfig> = {
      quality: {
        complexity: updates.cyclomaticComplexity ? {
          cyclomaticLow: updates.cyclomaticComplexity.lowThreshold,
          cyclomaticMedium: updates.cyclomaticComplexity.mediumThreshold,
          cyclomaticHigh: updates.cyclomaticComplexity.highThreshold
        } : undefined,
        weights: updates.weights ? {
          complexity: updates.weights.cyclomaticComplexity,
          maintainability: updates.weights.maintainabilityIndex,
          linting: updates.weights.lintingScore,
          formatting: updates.weights.formattingScore,
          typeScript: updates.weights.typeCoverage,
          documentation: updates.weights.documentation,
          security: 0.05 // Maintain security weight
        } : undefined
      },
      tools: {
        eslintConfigPath: updates.eslintConfigPath,
        prettierConfigPath: updates.prettierConfigPath,
        tsconfigPath: updates.tsconfigPath
      }
    };

    this.reconstructedAnalyzer.updateConfiguration(reconstructedUpdates);
    this.emit('config_updated', this.adapterConfig);
  }

  /**
   * Legacy API: getQualityHistory
   */
  getQualityHistory(identifier: string): ComprehensiveQualityMetrics[] {
    const newHistory = this.reconstructedAnalyzer.getQualityHistory(identifier);
    
    // Transform each entry to legacy format
    return newHistory.map(metrics => ({
      overallScore: metrics.overallScore,
      complexity: {
        cyclomaticComplexity: metrics.astMetrics.cyclomaticComplexity,
        halsteadComplexity: {
          programLength: metrics.astMetrics.halsteadMetrics.programLength,
          vocabulary: metrics.astMetrics.halsteadMetrics.programVocabulary,
          programLevel: metrics.astMetrics.halsteadMetrics.programLevel,
          difficulty: metrics.astMetrics.halsteadMetrics.difficulty,
          effort: metrics.astMetrics.halsteadMetrics.effort,
          timeRequired: metrics.astMetrics.halsteadMetrics.timeRequired,
          bugsDelivered: metrics.astMetrics.halsteadMetrics.bugsDelivered
        },
        maintainabilityIndex: metrics.astMetrics.maintainabilityIndex,
        linesOfCode: metrics.astMetrics.linesOfCode,
        logicalLinesOfCode: metrics.astMetrics.logicalLinesOfCode,
        commentLines: metrics.astMetrics.commentLines,
        commentRatio: metrics.astMetrics.commentRatio
      },
      linting: {
        totalErrors: metrics.eslintResults.totalErrors,
        totalWarnings: metrics.eslintResults.totalWarnings,
        totalIssues: metrics.eslintResults.totalIssues,
        score: metrics.eslintResults.score,
        errorsByCategory: metrics.eslintResults.errorsByCategory,
        fixableIssues: metrics.eslintResults.fixableIssues
      },
      formatting: {
        isFormatted: metrics.prettierResults.isFormatted,
        formattingIssues: metrics.prettierResults.formattingIssues,
        score: metrics.prettierResults.score,
        fixedCode: metrics.prettierResults.fixedCode
      },
      typeCoverage: {
        totalSymbols: 100,
        typedSymbols: Math.max(0, 100 - metrics.typescriptResults.totalErrors),
        coverage: metrics.typescriptResults.coverage,
        untypedAreas: []
      },
      duplication: {
        duplicatedLines: 0,
        totalLines: metrics.astMetrics.linesOfCode,
        duplicationPercentage: 0,
        duplicatedBlocks: []
      },
      technicalDebtRatio: metrics.technicalDebtRatio,
      recommendations: metrics.recommendations.map(rec => ({
        category: this.mapRecommendationCategory(rec.category),
        priority: rec.priority,
        description: rec.description,
        suggestion: rec.suggestion,
        estimatedImpact: rec.estimatedImpact,
        automated: rec.automated
      })),
      trendData: metrics.trendData ? {
        previousScore: metrics.trendData.previousScore,
        currentScore: metrics.trendData.currentScore,
        improvement: metrics.trendData.scoreDelta,
        trendDirection: metrics.trendData.trendDirection === 'volatile' ? 'stable' : metrics.trendData.trendDirection,
        improvementRate: metrics.trendData.improvementRate
      } : undefined
    }));
  }

  /**
   * Legacy API: clearHistory
   */
  clearHistory(): void {
    this.reconstructedAnalyzer.clearHistory();
    this.emit('history_cleared');
  }

  /**
   * Enhanced API: Get system status with new functionality
   */
  getSystemStatus() {
    return this.reconstructedAnalyzer.getSystemStatus();
  }

  /**
   * Enhanced API: Reset circuit breakers
   */
  resetCircuitBreakers(): void {
    this.reconstructedAnalyzer.resetToolCircuitBreakers();
  }

  /**
   * Shutdown the adapter and underlying analyzer
   */
  async shutdown(): Promise<void> {
    await this.reconstructedAnalyzer.shutdown();
    this.removeAllListeners();
    logger.info('Quality Analyzer Integration Adapter shut down');
  }
}

// Export the adapter as the default export for drop-in replacement
export { QualityAnalyzerIntegrationAdapter as CodeQualityAnalyzer };

// Export singleton instance for backward compatibility
export const codeQualityAnalyzer = new QualityAnalyzerIntegrationAdapter();