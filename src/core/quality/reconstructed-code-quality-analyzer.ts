/**
 * Reconstructed Production-Grade Code Quality Analyzer
 * Enterprise-ready quality analysis with AST processing, async tool integration, and comprehensive metrics
 * Created: August 26, 2025 - Quality Analyzer Reconstruction Agent
 *
 * REPLACES: src/core/quality/code-quality-analyzer.ts (broken implementation)
 *
 * Key Improvements:
 * - AST-based complexity analysis (replaces regex-based approach)
 * - Non-blocking asynchronous tool integration (replaces execSync)
 * - Mathematically correct Halstead metrics
 * - Enterprise-grade performance monitoring and resource management
 * - Comprehensive error handling with circuit breaker patterns
 * - Production-ready timeout handling and graceful degradation
 * - Advanced recommendation engine with business impact assessment
 * - Real-time progress reporting and trend analysis
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../logger.js';

// Import our new production-grade components
import { ASTComplexityAnalyzer, ASTComplexityMetrics } from './ast-complexity-analyzer.js';
import {
  AsyncToolIntegrationManager,
  ESLintResult,
  PrettierResult,
  TypeScriptResult,
  ToolExecutionOptions,
} from './async-tool-integration-manager.js';
import {
  ComprehensiveQualityCalculator,
  ComprehensiveQualityMetrics,
  QualityMetricsConfig,
  QualityRecommendation,
  QualityTrend,
} from './comprehensive-quality-calculator.js';
import {
  QualityAnalysisMonitor,
  PerformanceMetrics,
  ResourceLimits,
  AnalysisProgressInfo,
} from './quality-analysis-monitor.js';

export interface ReconstructedQualityConfig {
  // Analysis configuration
  quality: Partial<QualityMetricsConfig>;

  // Performance and resource limits
  performance: Partial<ResourceLimits>;

  // Tool execution options
  tools: {
    eslintConfigPath?: string;
    prettierConfigPath?: string;
    tsconfigPath?: string;
    defaultTimeout?: number;
    retries?: number;
  };

  // Analysis behavior
  analysis: {
    enableProgressReporting?: boolean;
    enableTrendAnalysis?: boolean;
    enablePerformanceMonitoring?: boolean;
    enableDetailedRecommendations?: boolean;
  };
}

export interface AnalysisResult {
  // Main quality metrics
  qualityMetrics: ComprehensiveQualityMetrics;

  // Performance information
  performanceMetrics: PerformanceMetrics;

  // Analysis metadata
  analysisId: string;
  analysisTimestamp: number;
  configurationUsed: ReconstructedQualityConfig;

  // System information
  systemHealth: {
    memoryUsage: number;
    activeAnalyses: number;
    systemLoad: 'low' | 'medium' | 'high';
  };
}

export class ReconstructedCodeQualityAnalyzer extends EventEmitter {
  private readonly config: ReconstructedQualityConfig;
  private readonly astAnalyzer: ASTComplexityAnalyzer;
  private readonly toolManager: AsyncToolIntegrationManager;
  private readonly qualityCalculator: ComprehensiveQualityCalculator;
  private readonly performanceMonitor: QualityAnalysisMonitor;

  private analysisCounter = 0;

  constructor(config?: Partial<ReconstructedQualityConfig>) {
    super();

    // Set default configuration
    this.config = {
      quality: {},
      performance: {
        maxMemoryMB: 512,
        maxAnalysisTimeMs: 60000,
        maxConcurrentAnalyses: 3,
        maxFileSizeMB: 10,
        maxLinesPerFile: 50000,
      },
      tools: {
        eslintConfigPath: join(process.cwd(), 'eslint.config.js'),
        prettierConfigPath: join(process.cwd(), '.prettierrc'),
        tsconfigPath: join(process.cwd(), 'tsconfig.json'),
        defaultTimeout: 15000,
        retries: 2,
      },
      analysis: {
        enableProgressReporting: true,
        enableTrendAnalysis: true,
        enablePerformanceMonitoring: true,
        enableDetailedRecommendations: true,
      },
      ...config,
    };

    // Initialize components with configuration
    this.astAnalyzer = new ASTComplexityAnalyzer();
    this.toolManager = new AsyncToolIntegrationManager();
    this.qualityCalculator = new ComprehensiveQualityCalculator(this.config.quality);
    this.performanceMonitor = new QualityAnalysisMonitor(this.config.performance);

    // Set up event forwarding for progress reporting
    this.setupEventForwarding();

    logger.info('Reconstructed Code Quality Analyzer initialized with enterprise configuration');
  }

  /**
   * Analyze code quality with comprehensive metrics and recommendations
   * MAIN PUBLIC API - Non-blocking, production-ready analysis
   */
  async analyzeCode(
    code: string,
    language: 'typescript' | 'javascript' = 'typescript',
    options: {
      filename?: string;
      identifier?: string;
      enableProgressReporting?: boolean;
    } = {}
  ): Promise<AnalysisResult> {
    const analysisId = `analysis-${++this.analysisCounter}-${Date.now()}`;
    const startTime = performance.now();

    logger.info(`Starting comprehensive quality analysis: ${analysisId}`);

    try {
      // Pre-flight checks
      const codeLines = code.split('\n').length;
      const codeSizeMB = Buffer.byteLength(code, 'utf8') / 1024 / 1024;

      const resourceCheck = this.performanceMonitor.canStartAnalysis(codeSizeMB, codeLines);
      if (!resourceCheck.allowed) {
        throw new Error(`Analysis rejected: ${resourceCheck.reason}`);
      }

      // Start performance monitoring
      const monitoringId = this.performanceMonitor.startAnalysis(analysisId);

      // Create temporary file for tool analysis
      const tempFile = this.createTempFile(code, language, options.filename);

      try {
        // Execute analysis pipeline with progress reporting
        const analysisResult = await this.executeAnalysisPipeline(
          code,
          tempFile,
          language,
          analysisId,
          options
        );

        // Complete performance monitoring
        const performanceMetrics = this.performanceMonitor.completeAnalysis(
          monitoringId,
          codeLines,
          analysisResult.qualityMetrics.astMetrics.functionCount,
          analysisResult.qualityMetrics.overallScore
        );

        // Prepare final result
        const finalResult: AnalysisResult = {
          qualityMetrics: analysisResult.qualityMetrics,
          performanceMetrics,
          analysisId,
          analysisTimestamp: Date.now(),
          configurationUsed: this.config,
          systemHealth: {
            memoryUsage: performanceMetrics.peakMemoryUsage,
            activeAnalyses: this.performanceMonitor.getPerformanceStatus().activeAnalyses,
            systemLoad: this.performanceMonitor.getPerformanceStatus().systemLoad,
          },
        };

        const totalDuration = performance.now() - startTime;
        logger.info(
          `Quality analysis completed: ${analysisId} (${totalDuration.toFixed(2)}ms, score: ${analysisResult.qualityMetrics.overallScore})`
        );

        // Emit completion event
        this.emit('analysisComplete', finalResult);

        return finalResult;
      } finally {
        // Clean up temporary file
        this.cleanupTempFile(tempFile);
      }
    } catch (error) {
      // Handle analysis failures gracefully
      logger.error(`Quality analysis failed: ${analysisId}`, error);

      // Try to clean up monitoring if it was started
      this.performanceMonitor.forceCleanupAnalysis(analysisId);

      // Emit error event
      this.emit('analysisError', { analysisId, error });

      throw new Error(
        `Quality analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute the complete analysis pipeline with progress reporting
   */
  private async executeAnalysisPipeline(
    code: string,
    tempFile: string,
    language: 'typescript' | 'javascript',
    analysisId: string,
    options: any
  ): Promise<{ qualityMetrics: ComprehensiveQualityMetrics }> {
    const toolOptions: ToolExecutionOptions = {
      timeout: this.config.tools.defaultTimeout,
      retries: this.config.tools.retries,
      fallbackOnError: true,
    };

    // Stage 1: AST Analysis
    this.updateProgress(analysisId, 'ast', 0, 'Parsing AST and analyzing complexity');
    const astMetrics = await this.performanceMonitor.enforceTimeoutLimit(
      async () => this.astAnalyzer.analyzeComplexity(code),
      this.config.performance?.maxAnalysisTimeMs || 60000,
      'AST analysis'
    );
    this.performanceMonitor.trackComponentTime(analysisId, 'astAnalysisTime', performance.now());
    this.updateProgress(analysisId, 'ast', 100, 'AST analysis complete');

    // Stage 2: ESLint Analysis (parallel execution starts here)
    this.updateProgress(analysisId, 'linting', 0, 'Running ESLint analysis');
    const eslintPromise = this.toolManager.runESLint(
      tempFile,
      this.config.tools.eslintConfigPath,
      toolOptions
    );

    // Stage 3: Prettier Analysis (parallel)
    this.updateProgress(analysisId, 'formatting', 0, 'Running Prettier analysis');
    const prettierPromise = this.toolManager.runPrettier(code, tempFile, toolOptions);

    // Stage 4: TypeScript Analysis (parallel)
    this.updateProgress(analysisId, 'typescript', 0, 'Running TypeScript analysis');
    const typescriptPromise =
      language === 'typescript'
        ? this.toolManager.runTypeScript(tempFile, this.config.tools.tsconfigPath, toolOptions)
        : Promise.resolve(this.getDefaultTypeScriptResult());

    // Wait for all tool analyses to complete
    const [eslintResults, prettierResults, typescriptResults] = await Promise.all([
      eslintPromise,
      prettierPromise,
      typescriptPromise,
    ]);

    // Track tool execution times
    this.performanceMonitor.trackComponentTime(
      analysisId,
      'lintingTime',
      eslintResults.executionTime
    );
    this.performanceMonitor.trackComponentTime(
      analysisId,
      'formattingTime',
      prettierResults.executionTime
    );
    this.performanceMonitor.trackComponentTime(
      analysisId,
      'typescriptTime',
      typescriptResults.executionTime
    );

    this.updateProgress(
      analysisId,
      'calculation',
      0,
      'Calculating quality metrics and recommendations'
    );

    // Stage 5: Quality Calculation
    const calculationStart = performance.now();
    const qualityMetrics = await this.qualityCalculator.calculateQualityMetrics(
      astMetrics,
      eslintResults,
      prettierResults,
      typescriptResults,
      options.identifier
    );

    const calculationTime = performance.now() - calculationStart;
    this.performanceMonitor.trackComponentTime(analysisId, 'calculationTime', calculationTime);

    this.updateProgress(analysisId, 'complete', 100, 'Analysis complete');

    return { qualityMetrics };
  }

  /**
   * Update analysis progress and emit progress events
   */
  private updateProgress(
    analysisId: string,
    stage: AnalysisProgressInfo['stage'],
    progress: number,
    operation: string
  ): void {
    if (this.config.analysis?.enableProgressReporting) {
      this.performanceMonitor.updateAnalysisProgress(analysisId, stage, {
        stageProgress: progress,
        currentOperation: operation,
      });
    }
  }

  /**
   * Get system health and performance status
   */
  getSystemStatus(): {
    performance: ReturnType<QualityAnalysisMonitor['getPerformanceStatus']>;
    analytics: ReturnType<QualityAnalysisMonitor['getPerformanceAnalytics']>;
    toolAvailability: ReturnType<AsyncToolIntegrationManager['getToolAvailabilityStatus']>;
    configuration: ReconstructedQualityConfig;
  } {
    return {
      performance: this.performanceMonitor.getPerformanceStatus(),
      analytics: this.performanceMonitor.getPerformanceAnalytics(),
      toolAvailability: this.toolManager.getToolAvailabilityStatus(),
      configuration: this.config,
    };
  }

  /**
   * Update analyzer configuration
   */
  updateConfiguration(updates: Partial<ReconstructedQualityConfig>): void {
    Object.assign(this.config, updates);

    // Update component configurations
    if (updates.performance) {
      this.performanceMonitor.updateResourceLimits(updates.performance);
    }

    logger.info('Quality analyzer configuration updated');
    this.emit('configurationUpdated', this.config);
  }

  /**
   * Get quality history for trend analysis
   */
  getQualityHistory(identifier: string): ComprehensiveQualityMetrics[] {
    return this.qualityCalculator.getQualityHistory(identifier);
  }

  /**
   * Clear all quality history and performance data
   */
  clearHistory(): void {
    this.qualityCalculator.clearHistory();
    logger.info('Quality analysis history cleared');
  }

  /**
   * Reset circuit breakers for external tools
   */
  resetToolCircuitBreakers(): void {
    this.toolManager.resetCircuitBreakers();
    logger.info('Tool circuit breakers reset');
  }

  /**
   * Cleanup resources and shutdown analyzer
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down quality analyzer...');

    // Clean up all components
    this.performanceMonitor.cleanup();
    this.clearHistory();

    // Remove all listeners
    this.removeAllListeners();

    logger.info('Quality analyzer shutdown complete');
  }

  /**
   * Private utility methods
   */

  private setupEventForwarding(): void {
    // Forward performance monitoring events
    this.performanceMonitor.on('progressUpdate', data => {
      if (this.config.analysis?.enableProgressReporting) {
        this.emit('progress', data);
      }
    });

    this.performanceMonitor.on('performanceAlert', alert => {
      this.emit('performanceAlert', alert);
      logger.warn(`Performance alert: ${alert.message}`);
    });
  }

  private createTempFile(code: string, language: string, filename?: string): string {
    const extension = language === 'typescript' ? '.ts' : '.js';
    const tempFilename = filename
      ? `${filename.replace(/\.[^/.]+$/, '')}${extension}`
      : `quality-analysis-${Date.now()}${extension}`;

    const tempFile = join(tmpdir(), tempFilename);

    try {
      writeFileSync(tempFile, code, 'utf8');
      return tempFile;
    } catch (error) {
      logger.error('Failed to create temporary file:', error);
      throw new Error(
        `Failed to create temporary file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private cleanupTempFile(tempFile: string): void {
    try {
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    } catch (error) {
      logger.warn('Failed to cleanup temporary file:', error);
    }
  }

  private getDefaultTypeScriptResult(): TypeScriptResult {
    return {
      available: false,
      totalErrors: 0,
      totalWarnings: 0,
      score: 100,
      coverage: 100,
      executionTime: 0,
    };
  }
}

// Export singleton instance for backward compatibility
export const reconstructedCodeQualityAnalyzer = new ReconstructedCodeQualityAnalyzer();

// Re-export important types for consumers
export type {
  ComprehensiveQualityMetrics,
  QualityRecommendation,
  QualityTrend,
  ASTComplexityMetrics,
  PerformanceMetrics,
  AnalysisProgressInfo,
};
