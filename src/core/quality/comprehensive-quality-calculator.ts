/**
 * Comprehensive Quality Metric Calculator with Intelligent Recommendation Engine
 * Advanced quality assessment with trend analysis and actionable insights
 * Created: August 26, 2025 - Quality Analyzer Reconstruction Agent
 *
 * Features:
 * - Multi-dimensional quality scoring with weighted composite calculation
 * - AI-driven recommendation engine with priority-based suggestions
 * - Quality trend analysis with regression detection
 * - Technical debt assessment with actionable remediation plans
 * - Security pattern compliance scoring
 * - Performance impact estimation for recommendations
 * - Automated fix identification for common issues
 */

import { performance } from 'perf_hooks';
import { logger } from '../logger.js';
import { ASTComplexityMetrics } from './ast-complexity-analyzer.js';
import {
  ESLintResult,
  PrettierResult,
  TypeScriptResult,
} from './async-tool-integration-manager.js';

export interface QualityMetricsConfig {
  // Complexity thresholds based on industry standards
  complexity: {
    cyclomaticLow: number; // <= 10: Simple
    cyclomaticMedium: number; // 11-20: Moderate
    cyclomaticHigh: number; // 21-30: Complex
    cyclomaticCritical: number; // > 30: Critical

    cognitiveLow: number; // <= 15: Maintainable
    cognitiveMedium: number; // 16-25: Moderate
    cognitiveHigh: number; // > 25: High

    halsteadEffortLow: number; // <= 1000: Simple
    halsteadEffortMedium: number; // 1001-5000: Moderate
    halsteadEffortHigh: number; // > 5000: Complex
  };

  // Maintainability thresholds (Microsoft scale)
  maintainability: {
    excellent: number; // >= 85: Green
    acceptable: number; // 70-84: Yellow
    problematic: number; // 50-69: Orange
    critical: number; // < 50: Red
  };

  // Quality weights for composite scoring (sum must equal 1.0)
  weights: {
    complexity: number; // 25% - Code complexity metrics
    maintainability: number; // 20% - Maintainability index
    linting: number; // 15% - ESLint score
    formatting: number; // 10% - Prettier score
    typeScript: number; // 15% - TypeScript coverage
    documentation: number; // 10% - Comment coverage
    security: number; // 5% - Security patterns
  };

  // Technical debt calculation parameters
  technicalDebt: {
    complexityMultiplier: number; // Weight for complexity debt
    lintingMultiplier: number; // Weight for linting debt
    duplicationMultiplier: number; // Weight for duplication debt
    maintenanceMultiplier: number; // Weight for maintenance debt
    securityMultiplier: number; // Weight for security debt
  };
}

export interface QualityRecommendation {
  id: string;
  category:
    | 'complexity'
    | 'maintainability'
    | 'linting'
    | 'formatting'
    | 'typescript'
    | 'documentation'
    | 'security'
    | 'performance';
  priority: 'critical' | 'high' | 'medium' | 'low';
  severity: 'blocker' | 'major' | 'minor' | 'info';

  title: string;
  description: string;
  suggestion: string;
  rationale: string;

  // Impact assessment
  estimatedImpact: number; // 1-100 quality score improvement
  effortEstimate: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';

  // Automation and fixes
  automated: boolean; // Can be auto-fixed
  autoFixCommand?: string; // Command to auto-fix
  codeExample?: string; // Example of fix

  // Metrics
  affectedMetrics: string[]; // Which metrics this improves
  businessImpact: string; // Business value description
  technicalDebtReduction: number; // Debt reduction estimate
}

export interface QualityTrend {
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  trendDirection: 'improving' | 'stable' | 'declining' | 'volatile';

  // Trend analysis over time
  improvementRate: number; // Average score change per analysis
  volatility: number; // Score variation coefficient
  consistency: number; // Trend consistency score

  // Regression detection
  regressionDetected: boolean; // Significant quality drop
  regressionSeverity?: 'minor' | 'moderate' | 'severe';
  regressionCause?: string; // Likely cause of regression

  // Progress tracking
  targetScore?: number; // Quality improvement target
  progressToTarget?: number; // Progress percentage to target
  estimatedTimeToTarget?: number; // Days to reach target at current rate
}

export interface ComprehensiveQualityMetrics {
  // Overall assessment
  overallScore: number; // Composite quality score (0-100)
  qualityGrade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D' | 'F';

  // Component scores
  complexityScore: number;
  maintainabilityScore: number;
  lintingScore: number;
  formattingScore: number;
  typeScriptScore: number;
  documentationScore: number;
  securityScore: number;

  // Technical metrics
  technicalDebtRatio: number; // Debt per 1000 lines of code
  technicalDebtMinutes: number; // Estimated time to fix debt
  codeHealthIndex: number; // Overall code health (0-100)

  // Analysis metadata
  recommendations: QualityRecommendation[];
  trendData?: QualityTrend;
  analysisTime: number; // Time taken for analysis

  // Raw metrics for reference
  astMetrics: ASTComplexityMetrics;
  eslintResults: ESLintResult;
  prettierResults: PrettierResult;
  typescriptResults: TypeScriptResult;
}

export class ComprehensiveQualityCalculator {
  private readonly config: QualityMetricsConfig;
  private qualityHistory = new Map<string, ComprehensiveQualityMetrics[]>();
  private readonly maxHistoryEntries = 20;

  constructor(config?: Partial<QualityMetricsConfig>) {
    this.config = {
      complexity: {
        cyclomaticLow: 10,
        cyclomaticMedium: 20,
        cyclomaticHigh: 30,
        cyclomaticCritical: 40,
        cognitiveLow: 15,
        cognitiveMedium: 25,
        cognitiveHigh: 35,
        halsteadEffortLow: 1000,
        halsteadEffortMedium: 5000,
        halsteadEffortHigh: 10000,
      },
      maintainability: {
        excellent: 85,
        acceptable: 70,
        problematic: 50,
        critical: 25,
      },
      weights: {
        complexity: 0.25,
        maintainability: 0.2,
        linting: 0.15,
        formatting: 0.1,
        typeScript: 0.15,
        documentation: 0.1,
        security: 0.05,
      },
      technicalDebt: {
        complexityMultiplier: 2.0,
        lintingMultiplier: 1.5,
        duplicationMultiplier: 3.0,
        maintenanceMultiplier: 2.5,
        securityMultiplier: 4.0,
      },
      ...config,
    };

    // Validate weights sum to 1.0
    const weightSum = Object.values(this.config.weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      logger.warn(`Quality weights sum to ${weightSum}, should be 1.0`);
    }
  }

  /**
   * Calculate comprehensive quality metrics with recommendations
   */
  async calculateQualityMetrics(
    astMetrics: ASTComplexityMetrics,
    eslintResults: ESLintResult,
    prettierResults: PrettierResult,
    typescriptResults: TypeScriptResult,
    identifier?: string
  ): Promise<ComprehensiveQualityMetrics> {
    const startTime = performance.now();

    try {
      // Calculate component scores
      const complexityScore = this.calculateComplexityScore(astMetrics);
      const maintainabilityScore = this.normalizeMaintainabilityScore(
        astMetrics.maintainabilityIndex
      );
      const lintingScore = eslintResults.score;
      const formattingScore = prettierResults.score;
      const typeScriptScore = typescriptResults.score;
      const documentationScore = this.calculateDocumentationScore(astMetrics);
      const securityScore = this.calculateSecurityScore(astMetrics, eslintResults);

      // Calculate weighted composite score
      const overallScore = this.calculateCompositeScore({
        complexityScore,
        maintainabilityScore,
        lintingScore,
        formattingScore,
        typeScriptScore,
        documentationScore,
        securityScore,
      });

      // Calculate technical debt metrics
      const technicalDebtRatio = this.calculateTechnicalDebtRatio(
        astMetrics,
        eslintResults,
        prettierResults,
        typescriptResults
      );
      const technicalDebtMinutes = this.estimateTechnicalDebtTime(
        technicalDebtRatio,
        astMetrics.linesOfCode
      );
      const codeHealthIndex = this.calculateCodeHealthIndex(overallScore, technicalDebtRatio);

      // Generate recommendations
      const recommendations = this.generateIntelligentRecommendations(
        astMetrics,
        eslintResults,
        prettierResults,
        typescriptResults,
        {
          complexityScore,
          maintainabilityScore,
          lintingScore,
          formattingScore,
          typeScriptScore,
          documentationScore,
          securityScore,
        }
      );

      // Calculate trend data if identifier provided
      const trendData = identifier
        ? this.calculateTrendAnalysis(identifier, overallScore)
        : undefined;

      const qualityMetrics: ComprehensiveQualityMetrics = {
        overallScore: Math.round(overallScore * 100) / 100,
        qualityGrade: this.calculateQualityGrade(overallScore),

        complexityScore: Math.round(complexityScore * 100) / 100,
        maintainabilityScore: Math.round(maintainabilityScore * 100) / 100,
        lintingScore: Math.round(lintingScore * 100) / 100,
        formattingScore: Math.round(formattingScore * 100) / 100,
        typeScriptScore: Math.round(typeScriptScore * 100) / 100,
        documentationScore: Math.round(documentationScore * 100) / 100,
        securityScore: Math.round(securityScore * 100) / 100,

        technicalDebtRatio: Math.round(technicalDebtRatio * 100) / 100,
        technicalDebtMinutes: Math.round(technicalDebtMinutes),
        codeHealthIndex: Math.round(codeHealthIndex * 100) / 100,

        recommendations,
        trendData,
        analysisTime: performance.now() - startTime,

        astMetrics,
        eslintResults,
        prettierResults,
        typescriptResults,
      };

      // Store in history for trend analysis
      if (identifier) {
        this.storeQualityHistory(identifier, qualityMetrics);
      }

      logger.debug(
        `Quality calculation completed in ${qualityMetrics.analysisTime.toFixed(2)}ms with score ${overallScore}`
      );

      return qualityMetrics;
    } catch (error) {
      logger.error('Quality calculation failed:', error);
      throw new Error(
        `Quality calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate complexity score from AST metrics
   */
  private calculateComplexityScore(astMetrics: ASTComplexityMetrics): number {
    const { cyclomaticComplexity, cognitiveComplexity, halsteadMetrics } = astMetrics;
    const { complexity } = this.config;

    // Cyclomatic complexity score (40% weight)
    let cyclomaticScore = 100;
    if (cyclomaticComplexity > complexity.cyclomaticCritical) {
      cyclomaticScore = 0;
    } else if (cyclomaticComplexity > complexity.cyclomaticHigh) {
      cyclomaticScore = 25;
    } else if (cyclomaticComplexity > complexity.cyclomaticMedium) {
      cyclomaticScore = 50;
    } else if (cyclomaticComplexity > complexity.cyclomaticLow) {
      cyclomaticScore = 75;
    }

    // Cognitive complexity score (35% weight)
    let cognitiveScore = 100;
    if (cognitiveComplexity > complexity.cognitiveHigh) {
      cognitiveScore = 25;
    } else if (cognitiveComplexity > complexity.cognitiveMedium) {
      cognitiveScore = 50;
    } else if (cognitiveComplexity > complexity.cognitiveLow) {
      cognitiveScore = 75;
    }

    // Halstead effort score (25% weight)
    let halsteadScore = 100;
    if (halsteadMetrics.effort > complexity.halsteadEffortHigh) {
      halsteadScore = 25;
    } else if (halsteadMetrics.effort > complexity.halsteadEffortMedium) {
      halsteadScore = 50;
    } else if (halsteadMetrics.effort > complexity.halsteadEffortLow) {
      halsteadScore = 75;
    }

    // Weighted complexity score
    return cyclomaticScore * 0.4 + cognitiveScore * 0.35 + halsteadScore * 0.25;
  }

  /**
   * Normalize maintainability index to 0-100 scale
   */
  private normalizeMaintainabilityScore(maintainabilityIndex: number): number {
    const { maintainability } = this.config;

    if (maintainabilityIndex >= maintainability.excellent) {
      return 100;
    } else if (maintainabilityIndex >= maintainability.acceptable) {
      return (
        70 +
        ((maintainabilityIndex - maintainability.acceptable) /
          (maintainability.excellent - maintainability.acceptable)) *
          30
      );
    } else if (maintainabilityIndex >= maintainability.problematic) {
      return (
        40 +
        ((maintainabilityIndex - maintainability.problematic) /
          (maintainability.acceptable - maintainability.problematic)) *
          30
      );
    } else if (maintainabilityIndex >= maintainability.critical) {
      return (
        10 +
        ((maintainabilityIndex - maintainability.critical) /
          (maintainability.problematic - maintainability.critical)) *
          30
      );
    } else {
      return Math.max(0, (maintainabilityIndex / maintainability.critical) * 10);
    }
  }

  /**
   * Calculate documentation score based on comment coverage and quality
   */
  private calculateDocumentationScore(astMetrics: ASTComplexityMetrics): number {
    const { commentRatio, functionCount, classCount } = astMetrics;

    // Base score from comment ratio
    let score = Math.min(100, commentRatio * 5); // 20% comments = 100 points

    // Bonus for good comment distribution
    const expectedComments = Math.max(1, functionCount + classCount);
    const commentDensity = commentRatio / 100;

    if (commentDensity > 0.15 && expectedComments > 0) {
      score += 10; // Bonus for adequate documentation
    }

    if (commentDensity > 0.25) {
      score += 5; // Extra bonus for excellent documentation
    }

    return Math.min(100, score);
  }

  /**
   * Calculate security score based on patterns and linting results
   */
  private calculateSecurityScore(
    astMetrics: ASTComplexityMetrics,
    eslintResults: ESLintResult
  ): number {
    let score = 100;

    // Deduct points for security-related ESLint errors
    const securityRules = [
      'no-eval',
      'no-implied-eval',
      'no-new-func',
      'no-script-url',
      'no-unsafe-innerHTML',
      'no-danger',
    ];

    let securityIssues = 0;
    for (const rule of securityRules) {
      if (eslintResults.errorsByCategory[rule]) {
        securityIssues += eslintResults.errorsByCategory[rule];
      }
    }

    // Each security issue reduces score by 15 points
    score -= securityIssues * 15;

    // Additional deductions for high complexity (security anti-pattern)
    if (astMetrics.cyclomaticComplexity > this.config.complexity.cyclomaticHigh) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate weighted composite quality score
   */
  private calculateCompositeScore(scores: {
    complexityScore: number;
    maintainabilityScore: number;
    lintingScore: number;
    formattingScore: number;
    typeScriptScore: number;
    documentationScore: number;
    securityScore: number;
  }): number {
    const { weights } = this.config;

    return (
      scores.complexityScore * weights.complexity +
      scores.maintainabilityScore * weights.maintainability +
      scores.lintingScore * weights.linting +
      scores.formattingScore * weights.formatting +
      scores.typeScriptScore * weights.typeScript +
      scores.documentationScore * weights.documentation +
      scores.securityScore * weights.security
    );
  }

  /**
   * Calculate technical debt ratio (debt per 1000 lines)
   */
  private calculateTechnicalDebtRatio(
    astMetrics: ASTComplexityMetrics,
    eslintResults: ESLintResult,
    prettierResults: PrettierResult,
    typescriptResults: TypeScriptResult
  ): number {
    const { technicalDebt } = this.config;
    const linesOfCode = Math.max(1, astMetrics.linesOfCode);

    // Calculate debt components
    const complexityDebt = Math.max(
      0,
      (astMetrics.cyclomaticComplexity - this.config.complexity.cyclomaticLow) *
        technicalDebt.complexityMultiplier +
        (astMetrics.cognitiveComplexity - this.config.complexity.cognitiveLow) *
          technicalDebt.complexityMultiplier *
          0.5
    );

    const lintingDebt = eslintResults.totalIssues * technicalDebt.lintingMultiplier;
    const formattingDebt = prettierResults.formattingIssues * 0.5; // Formatting is less critical
    const typescriptDebt = typescriptResults.totalErrors * technicalDebt.lintingMultiplier;

    const maintenanceDebt = Math.max(
      0,
      (this.config.maintainability.acceptable - astMetrics.maintainabilityIndex) *
        technicalDebt.maintenanceMultiplier
    );

    const totalDebt =
      complexityDebt + lintingDebt + formattingDebt + typescriptDebt + maintenanceDebt;

    // Return debt per 1000 lines
    return (totalDebt / linesOfCode) * 1000;
  }

  /**
   * Estimate time to resolve technical debt in minutes
   */
  private estimateTechnicalDebtTime(debtRatio: number, linesOfCode: number): number {
    // Base estimation: 1 minute per debt point per 100 lines
    const baseTimeMinutes = (debtRatio * linesOfCode) / 100;

    // Apply complexity multiplier for larger codebases
    const complexityMultiplier = Math.min(2.0, 1.0 + linesOfCode / 10000);

    return baseTimeMinutes * complexityMultiplier;
  }

  /**
   * Calculate code health index considering quality and debt
   */
  private calculateCodeHealthIndex(qualityScore: number, debtRatio: number): number {
    // Base health from quality score
    let healthIndex = qualityScore;

    // Penalize high technical debt
    const debtPenalty = Math.min(30, debtRatio * 2); // Max 30 point penalty
    healthIndex -= debtPenalty;

    return Math.max(0, Math.min(100, healthIndex));
  }

  /**
   * Calculate quality grade from overall score
   */
  private calculateQualityGrade(
    score: number
  ): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D' | 'F' {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 65) return 'D+';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate intelligent recommendations with business impact
   */
  private generateIntelligentRecommendations(
    astMetrics: ASTComplexityMetrics,
    eslintResults: ESLintResult,
    prettierResults: PrettierResult,
    typescriptResults: TypeScriptResult,
    scores: any
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];
    let recommendationId = 1;

    // Complexity recommendations
    if (astMetrics.cyclomaticComplexity > this.config.complexity.cyclomaticCritical) {
      recommendations.push({
        id: `CC-${recommendationId++}`,
        category: 'complexity',
        priority: 'critical',
        severity: 'blocker',
        title: 'Critical Cyclomatic Complexity',
        description: `Cyclomatic complexity is ${astMetrics.cyclomaticComplexity}, which exceeds critical threshold of ${this.config.complexity.cyclomaticCritical}`,
        suggestion:
          'Break down complex functions using Extract Method refactoring. Consider implementing Strategy or Command patterns to reduce decision points.',
        rationale:
          'High cyclomatic complexity makes code difficult to test, debug, and maintain, increasing defect probability.',
        estimatedImpact: 30,
        effortEstimate: 'high',
        riskLevel: 'medium',
        automated: false,
        affectedMetrics: ['complexity', 'maintainability', 'testability'],
        businessImpact: 'Reduces development velocity and increases bug fix time',
        technicalDebtReduction: astMetrics.cyclomaticComplexity * 2,
      });
    } else if (astMetrics.cyclomaticComplexity > this.config.complexity.cyclomaticHigh) {
      recommendations.push({
        id: `CC-${recommendationId++}`,
        category: 'complexity',
        priority: 'high',
        severity: 'major',
        title: 'High Cyclomatic Complexity',
        description: `Cyclomatic complexity is ${astMetrics.cyclomaticComplexity}, consider refactoring`,
        suggestion:
          'Identify and extract complex conditional logic into separate functions or use polymorphism to replace switch statements.',
        rationale: 'Moderately complex code is harder to understand and test effectively.',
        estimatedImpact: 15,
        effortEstimate: 'medium',
        riskLevel: 'low',
        automated: false,
        affectedMetrics: ['complexity', 'maintainability'],
        businessImpact: 'Improves code maintainability and reduces onboarding time',
        technicalDebtReduction:
          (astMetrics.cyclomaticComplexity - this.config.complexity.cyclomaticMedium) * 1.5,
      });
    }

    // Cognitive complexity recommendations
    if (astMetrics.cognitiveComplexity > this.config.complexity.cognitiveHigh) {
      recommendations.push({
        id: `COG-${recommendationId++}`,
        category: 'complexity',
        priority: 'high',
        severity: 'major',
        title: 'High Cognitive Complexity',
        description: `Cognitive complexity is ${astMetrics.cognitiveComplexity}, which impacts code readability`,
        suggestion:
          'Reduce nested conditions and loops. Consider early returns, guard clauses, or breaking logic into smaller functions.',
        rationale:
          'High cognitive complexity makes code harder for humans to understand and mentally process.',
        estimatedImpact: 20,
        effortEstimate: 'medium',
        riskLevel: 'low',
        automated: false,
        codeExample: 'if (condition) { return result; } // Early return instead of nested if-else',
        affectedMetrics: ['complexity', 'readability', 'maintainability'],
        businessImpact: 'Improves developer productivity and reduces code review time',
        technicalDebtReduction: astMetrics.cognitiveComplexity,
      });
    }

    // Maintainability recommendations
    if (astMetrics.maintainabilityIndex < this.config.maintainability.critical) {
      recommendations.push({
        id: `MI-${recommendationId++}`,
        category: 'maintainability',
        priority: 'critical',
        severity: 'blocker',
        title: 'Critical Maintainability Issues',
        description: `Maintainability index is ${astMetrics.maintainabilityIndex.toFixed(2)}, below critical threshold`,
        suggestion:
          'Comprehensive refactoring needed: reduce complexity, increase documentation, and improve code structure.',
        rationale:
          'Critical maintainability issues indicate code that is extremely difficult and expensive to maintain.',
        estimatedImpact: 40,
        effortEstimate: 'high',
        riskLevel: 'high',
        automated: false,
        affectedMetrics: ['maintainability', 'complexity', 'documentation'],
        businessImpact: 'Prevents technical debt from becoming unmanageable',
        technicalDebtReduction:
          (this.config.maintainability.acceptable - astMetrics.maintainabilityIndex) * 3,
      });
    }

    // ESLint recommendations
    if (eslintResults.totalErrors > 0) {
      const priority = eslintResults.totalErrors > 10 ? 'high' : 'medium';
      recommendations.push({
        id: `ES-${recommendationId++}`,
        category: 'linting',
        priority,
        severity: eslintResults.totalErrors > 5 ? 'major' : 'minor',
        title: 'ESLint Errors Found',
        description: `${eslintResults.totalErrors} ESLint errors and ${eslintResults.totalWarnings} warnings detected`,
        suggestion:
          eslintResults.fixableIssues > 0
            ? `${eslintResults.fixableIssues} issues can be automatically fixed. Run 'eslint --fix' to resolve them.`
            : 'Review and manually fix ESLint errors to improve code quality.',
        rationale:
          'ESLint errors indicate potential bugs, security issues, or style inconsistencies.',
        estimatedImpact: Math.min(25, eslintResults.totalErrors * 2),
        effortEstimate:
          eslintResults.fixableIssues > eslintResults.totalErrors * 0.7 ? 'low' : 'medium',
        riskLevel: 'low',
        automated: eslintResults.fixableIssues > 0,
        autoFixCommand: eslintResults.fixableIssues > 0 ? 'eslint --fix' : undefined,
        affectedMetrics: ['linting', 'quality', 'consistency'],
        businessImpact: 'Reduces potential bugs and improves code consistency across team',
        technicalDebtReduction: eslintResults.totalIssues * 1.5,
      });
    }

    // Formatting recommendations
    if (!prettierResults.isFormatted && prettierResults.formattingIssues > 5) {
      recommendations.push({
        id: `PR-${recommendationId++}`,
        category: 'formatting',
        priority: 'medium',
        severity: 'minor',
        title: 'Code Formatting Issues',
        description: `${prettierResults.formattingIssues} formatting inconsistencies found`,
        suggestion:
          'Run Prettier to automatically format code and ensure consistent style across the project.',
        rationale:
          'Consistent formatting improves code readability and reduces diff noise in version control.',
        estimatedImpact: 10,
        effortEstimate: 'low',
        riskLevel: 'low',
        automated: true,
        autoFixCommand: 'prettier --write',
        affectedMetrics: ['formatting', 'consistency', 'readability'],
        businessImpact: 'Improves code review efficiency and team collaboration',
        technicalDebtReduction: prettierResults.formattingIssues * 0.5,
      });
    }

    // TypeScript recommendations
    if (typescriptResults.totalErrors > 0) {
      recommendations.push({
        id: `TS-${recommendationId++}`,
        category: 'typescript',
        priority: typescriptResults.totalErrors > 5 ? 'high' : 'medium',
        severity: 'major',
        title: 'TypeScript Errors',
        description: `${typescriptResults.totalErrors} TypeScript errors found`,
        suggestion:
          'Fix TypeScript type errors to improve type safety and catch potential runtime errors.',
        rationale:
          'TypeScript errors indicate type mismatches that could lead to runtime failures.',
        estimatedImpact: typescriptResults.totalErrors * 3,
        effortEstimate: 'medium',
        riskLevel: 'medium',
        automated: false,
        affectedMetrics: ['typescript', 'type-safety', 'reliability'],
        businessImpact: 'Prevents runtime type errors and improves application stability',
        technicalDebtReduction: typescriptResults.totalErrors * 2,
      });
    }

    // Documentation recommendations
    if (astMetrics.commentRatio < 15) {
      recommendations.push({
        id: `DOC-${recommendationId++}`,
        category: 'documentation',
        priority: 'medium',
        severity: 'minor',
        title: 'Insufficient Code Documentation',
        description: `Comment ratio is ${astMetrics.commentRatio.toFixed(1)}%, below recommended 15%`,
        suggestion:
          'Add JSDoc comments to functions and classes. Document complex business logic and edge cases.',
        rationale:
          'Good documentation improves code maintainability and helps new team members understand the codebase.',
        estimatedImpact: 8,
        effortEstimate: 'medium',
        riskLevel: 'low',
        automated: false,
        codeExample:
          '/**\n * Description of function\n * @param {type} param - Parameter description\n * @returns {type} Return description\n */',
        affectedMetrics: ['documentation', 'maintainability', 'onboarding'],
        businessImpact: 'Reduces knowledge transfer time and improves team productivity',
        technicalDebtReduction: (15 - astMetrics.commentRatio) * 2,
      });
    }

    // Security recommendations
    if (scores.securityScore < 80) {
      recommendations.push({
        id: `SEC-${recommendationId++}`,
        category: 'security',
        priority: 'high',
        severity: 'major',
        title: 'Security Pattern Compliance Issues',
        description: 'Code contains patterns that may pose security risks',
        suggestion:
          'Review code for security anti-patterns: avoid eval(), validate inputs, use secure coding practices.',
        rationale: 'Security issues can lead to vulnerabilities and potential data breaches.',
        estimatedImpact: 15,
        effortEstimate: 'medium',
        riskLevel: 'high',
        automated: false,
        affectedMetrics: ['security', 'reliability', 'compliance'],
        businessImpact: 'Reduces security risk and ensures compliance with security standards',
        technicalDebtReduction: (80 - scores.securityScore) * 3,
      });
    }

    // Sort recommendations by priority and impact
    return recommendations.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];

      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedImpact - a.estimatedImpact;
    });
  }

  /**
   * Calculate trend analysis and regression detection
   */
  private calculateTrendAnalysis(
    identifier: string,
    currentScore: number
  ): QualityTrend | undefined {
    const history = this.qualityHistory.get(identifier) || [];

    if (history.length === 0) {
      return undefined;
    }

    const previousMetrics = history[history.length - 1];
    const previousScore = previousMetrics.overallScore;
    const scoreDelta = currentScore - previousScore;

    // Determine trend direction
    let trendDirection: 'improving' | 'stable' | 'declining' | 'volatile';
    const recentScores = history.slice(-5).map(m => m.overallScore);
    const volatility = this.calculateVolatility(recentScores);

    if (volatility > 10) {
      trendDirection = 'volatile';
    } else if (Math.abs(scoreDelta) < 2) {
      trendDirection = 'stable';
    } else if (scoreDelta > 0) {
      trendDirection = 'improving';
    } else {
      trendDirection = 'declining';
    }

    // Calculate improvement rate
    const scores = history.map(m => m.overallScore);
    const improvementRate = scores.length > 1 ? this.calculateLinearTrend(scores) : 0;

    // Detect regression
    const regressionDetected = scoreDelta < -5; // 5+ point drop
    let regressionSeverity: 'minor' | 'moderate' | 'severe' | undefined;
    let regressionCause: string | undefined;

    if (regressionDetected) {
      if (scoreDelta < -15) {
        regressionSeverity = 'severe';
      } else if (scoreDelta < -10) {
        regressionSeverity = 'moderate';
      } else {
        regressionSeverity = 'minor';
      }

      regressionCause = this.identifyRegressionCause(previousMetrics, currentScore);
    }

    // Calculate consistency
    const consistency = Math.max(0, 100 - volatility * 5);

    return {
      previousScore,
      currentScore,
      scoreDelta: Math.round(scoreDelta * 100) / 100,
      trendDirection,
      improvementRate: Math.round(improvementRate * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      regressionDetected,
      regressionSeverity,
      regressionCause,
    };
  }

  /**
   * Calculate volatility of score series
   */
  private calculateVolatility(scores: number[]): number {
    if (scores.length < 2) return 0;

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate linear trend of scores
   */
  private calculateLinearTrend(scores: number[]): number {
    if (scores.length < 2) return 0;

    const n = scores.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = scores.reduce((sum, score) => sum + score, 0);
    const sumXY = scores.reduce((sum, score, i) => sum + score * (i + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return slope;
  }

  /**
   * Identify likely cause of quality regression
   */
  private identifyRegressionCause(
    previousMetrics: ComprehensiveQualityMetrics,
    currentScore: number
  ): string {
    const scoreDiff = currentScore - previousMetrics.overallScore;

    if (scoreDiff < -10) {
      return 'Significant code changes likely introduced complexity or quality issues';
    } else if (scoreDiff < -5) {
      return 'New code may have introduced linting errors or formatting issues';
    } else {
      return 'Minor quality degradation, possibly due to rushed commits';
    }
  }

  /**
   * Store quality metrics in history
   */
  private storeQualityHistory(identifier: string, metrics: ComprehensiveQualityMetrics): void {
    const history = this.qualityHistory.get(identifier) || [];
    history.push(metrics);

    // Keep only recent entries
    if (history.length > this.maxHistoryEntries) {
      history.shift();
    }

    this.qualityHistory.set(identifier, history);
  }

  /**
   * Get quality history for identifier
   */
  getQualityHistory(identifier: string): ComprehensiveQualityMetrics[] {
    return this.qualityHistory.get(identifier) || [];
  }

  /**
   * Clear all quality history
   */
  clearHistory(): void {
    this.qualityHistory.clear();
  }

  /**
   * Get current configuration
   */
  getConfiguration(): QualityMetricsConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const comprehensiveQualityCalculator = new ComprehensiveQualityCalculator();
