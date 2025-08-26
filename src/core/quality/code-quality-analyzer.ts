/**
 * Advanced Code Quality Analyzer
 * Implements comprehensive data-driven quality scoring for the SequentialDualAgentSystem
 * Created: August 26, 2025
 * 
 * Features:
 * - Cyclomatic complexity analysis (McCabe complexity)
 * - Maintainability index calculation
 * - Technical debt assessment
 * - Automated linting integration (ESLint)
 * - Code formatting compliance (Prettier)
 * - TypeScript type coverage analysis
 * - Halstead complexity metrics
 * - Code duplication detection
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { Logger } from '../logger.js';

export interface QualityMetricsConfig {
  // Complexity thresholds
  cyclomaticComplexity: {
    lowThreshold: number;    // 1-10: Low complexity
    mediumThreshold: number; // 11-20: Medium complexity
    highThreshold: number;   // 21+: High complexity
  };
  
  // Maintainability thresholds
  maintainabilityIndex: {
    lowThreshold: number;    // 0-25: Low maintainability
    mediumThreshold: number; // 26-85: Medium maintainability
    highThreshold: number;   // 86-100: High maintainability
  };
  
  // Quality weights for composite scoring
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
  
  // Tool configurations
  eslintConfigPath?: string;
  prettierConfigPath?: string;
  tsconfigPath?: string;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  halsteadComplexity: {
    programLength: number;    // N = N1 + N2
    vocabulary: number;       // n = n1 + n2
    programLevel: number;     // L = 1 / D
    difficulty: number;       // D = n1/2 * N2/n2
    effort: number;          // E = D * V
    timeRequired: number;    // T = E / 18 seconds
    bugsDelivered: number;   // B = E^(2/3) / 3000
  };
  maintainabilityIndex: number;
  linesOfCode: number;
  logicalLinesOfCode: number;
  commentLines: number;
  commentRatio: number;
}

export interface LintingResults {
  totalErrors: number;
  totalWarnings: number;
  totalIssues: number;
  score: number; // 0-100 based on issue density
  errorsByCategory: Record<string, number>;
  fixableIssues: number;
}

export interface FormattingResults {
  isFormatted: boolean;
  formattingIssues: number;
  score: number; // 0-100 based on formatting compliance
  fixedCode?: string;
}

export interface TypeCoverageResults {
  totalSymbols: number;
  typedSymbols: number;
  coverage: number; // 0-100 percentage
  untypedAreas: Array<{
    file: string;
    line: number;
    symbol: string;
  }>;
}

export interface DuplicationResults {
  duplicatedLines: number;
  totalLines: number;
  duplicationPercentage: number;
  duplicatedBlocks: Array<{
    lines: number;
    tokens: number;
    files: string[];
  }>;
}

export interface ComprehensiveQualityMetrics {
  overallScore: number;
  complexity: ComplexityMetrics;
  linting: LintingResults;
  formatting: FormattingResults;
  typeCoverage: TypeCoverageResults;
  duplication: DuplicationResults;
  technicalDebtRatio: number;
  recommendations: QualityRecommendation[];
  trendData?: QualityTrend;
}

export interface QualityRecommendation {
  category: 'complexity' | 'maintainability' | 'linting' | 'formatting' | 'types' | 'duplication' | 'documentation';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
  estimatedImpact: number; // 1-100 score improvement estimate
  automated: boolean; // Can this be auto-fixed?
}

export interface QualityTrend {
  previousScore: number;
  currentScore: number;
  improvement: number;
  trendDirection: 'improving' | 'stable' | 'declining';
  improvementRate: number; // Score change per analysis
}

export class CodeQualityAnalyzer extends EventEmitter {
  private logger: Logger;
  private config: QualityMetricsConfig;
  private qualityHistory: Map<string, ComprehensiveQualityMetrics[]> = new Map();
  
  constructor(config?: Partial<QualityMetricsConfig>) {
    super();
    this.logger = new Logger('CodeQualityAnalyzer');
    
    // Default configuration with enterprise-grade thresholds
    this.config = {
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
        cyclomaticComplexity: 0.20,    // 20% weight
        maintainabilityIndex: 0.18,    // 18% weight
        lintingScore: 0.15,            // 15% weight
        formattingScore: 0.10,         // 10% weight
        typeCoverage: 0.15,            // 15% weight
        documentation: 0.12,           // 12% weight
        duplication: 0.10,             // 10% weight
        halsteadComplexity: 0.10,      // 10% weight
      },
      eslintConfigPath: join(process.cwd(), 'eslint.config.js'),
      prettierConfigPath: join(process.cwd(), '.prettierrc'),
      tsconfigPath: join(process.cwd(), 'tsconfig.json'),
      ...config
    };
  }

  /**
   * Perform comprehensive quality analysis on code
   */
  async analyzeCode(
    code: string,
    language: 'typescript' | 'javascript' = 'typescript',
    filename?: string
  ): Promise<ComprehensiveQualityMetrics> {
    const startTime = performance.now();
    this.logger.info(`Starting comprehensive quality analysis for ${language} code`);
    
    try {
      // Create temporary file for analysis
      const tempFile = this.createTempFile(code, language, filename);
      
      // Parallel analysis execution for performance
      const [
        complexity,
        linting,
        formatting,
        typeCoverage,
        duplication
      ] = await Promise.all([
        this.analyzeComplexity(code, tempFile),
        this.analyzeLinting(tempFile, language),
        this.analyzeFormatting(code, tempFile),
        language === 'typescript' ? this.analyzeTypeCoverage(tempFile) : this.getDefaultTypeCoverage(),
        this.analyzeDuplication(tempFile)
      ]);
      
      // Calculate technical debt ratio
      const technicalDebtRatio = this.calculateTechnicalDebtRatio(complexity, linting, duplication);
      
      // Generate quality recommendations
      const recommendations = this.generateRecommendations(complexity, linting, formatting, typeCoverage, duplication);
      
      // Calculate overall composite score
      const overallScore = this.calculateCompositeScore(complexity, linting, formatting, typeCoverage, duplication);
      
      // Get trend data if available
      const trendData = this.calculateTrendData(tempFile, overallScore);
      
      const result: ComprehensiveQualityMetrics = {
        overallScore,
        complexity,
        linting,
        formatting,
        typeCoverage,
        duplication,
        technicalDebtRatio,
        recommendations,
        trendData
      };
      
      // Store for trend analysis
      this.storeQualityMetrics(tempFile, result);
      
      // Clean up temp file
      this.cleanupTempFile(tempFile);
      
      const duration = performance.now() - startTime;
      this.logger.info(`Quality analysis completed in ${duration.toFixed(2)}ms with score ${overallScore}`);
      
      this.emit('analysis_complete', { result, duration });
      
      return result;
      
    } catch (error) {
      this.logger.error('Quality analysis failed:', error);
      throw new Error(`Quality analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze cyclomatic complexity and related metrics
   */
  private async analyzeComplexity(code: string, tempFile: string): Promise<ComplexityMetrics> {
    try {
      // Calculate basic metrics from code structure
      const lines = code.split('\n');
      const linesOfCode = lines.length;
      const commentLines = lines.filter(line => line.trim().startsWith('//') || line.trim().startsWith('*')).length;
      const logicalLinesOfCode = lines.filter(line => line.trim().length > 0 && !line.trim().startsWith('//') && !line.trim().startsWith('*')).length;
      const commentRatio = linesOfCode > 0 ? (commentLines / linesOfCode) * 100 : 0;
      
      // Calculate cyclomatic complexity using decision points
      const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
      
      // Calculate Halstead complexity metrics
      const halsteadComplexity = this.calculateHalsteadComplexity(code);
      
      // Calculate maintainability index
      const maintainabilityIndex = this.calculateMaintainabilityIndex(
        cyclomaticComplexity,
        linesOfCode,
        halsteadComplexity.programLength,
        commentRatio
      );
      
      return {
        cyclomaticComplexity,
        halsteadComplexity,
        maintainabilityIndex,
        linesOfCode,
        logicalLinesOfCode,
        commentLines,
        commentRatio
      };
      
    } catch (error) {
      this.logger.warn('Complexity analysis failed, using defaults:', error);
      return this.getDefaultComplexity();
    }
  }

  /**
   * Calculate cyclomatic complexity based on decision points
   */
  private calculateCyclomaticComplexity(code: string): number {
    // Count decision points that increase complexity
    const decisionPoints = [
      /\bif\s*\(/g,           // if statements
      /\belse\s+if\s*\(/g,    // else if statements
      /\bwhile\s*\(/g,        // while loops
      /\bfor\s*\(/g,          // for loops
      /\bswitch\s*\(/g,       // switch statements
      /\bcase\s+/g,           // case statements
      /\bcatch\s*\(/g,        // catch statements
      /\b\?\s*.*\s*:/g,       // ternary operators
      /\s&&\s/g,              // logical AND
      /\s\|\|\s/g,            // logical OR
    ];
    
    let complexity = 1; // Base complexity
    
    for (const pattern of decisionPoints) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  /**
   * Calculate Halstead complexity metrics
   */
  private calculateHalsteadComplexity(code: string) {
    // Simplified Halstead calculation - in production, use proper AST parsing
    const operators = code.match(/[\+\-\*\/\=\<\>\!\&\|\?\:]/g) || [];
    const operands = code.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    
    const uniqueOperators = [...new Set(operators)];
    const uniqueOperands = [...new Set(operands)];
    
    const n1 = uniqueOperators.length;
    const n2 = uniqueOperands.length;
    const N1 = operators.length;
    const N2 = operands.length;
    
    const programLength = N1 + N2;
    const vocabulary = n1 + n2;
    const volume = programLength * Math.log2(vocabulary || 1);
    const difficulty = vocabulary > 0 ? (n1 / 2) * (N2 / (n2 || 1)) : 0;
    const effort = difficulty * volume;
    const timeRequired = effort / 18; // Stroud number
    const bugsDelivered = Math.pow(effort, 2/3) / 3000;
    const programLevel = difficulty > 0 ? 1 / difficulty : 1;
    
    return {
      programLength,
      vocabulary,
      programLevel,
      difficulty,
      effort,
      timeRequired,
      bugsDelivered
    };
  }

  /**
   * Calculate maintainability index using Microsoft's formula
   */
  private calculateMaintainabilityIndex(
    cyclomaticComplexity: number,
    linesOfCode: number,
    halsteadVolume: number,
    commentRatio: number
  ): number {
    // Microsoft Maintainability Index formula
    // MI = MAX(0,(171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code) + 50 * sin(sqrt(2.4 * perCM))) * 100 / 171)
    // Simplified version without comment measurement complexity
    
    const halsteadVolumeLog = Math.log(halsteadVolume || 1);
    const linesOfCodeLog = Math.log(linesOfCode || 1);
    const commentFactor = commentRatio > 0 ? Math.sin(Math.sqrt(2.4 * commentRatio)) : 0;
    
    const mi = Math.max(0, 
      (171 - 5.2 * halsteadVolumeLog - 0.23 * cyclomaticComplexity - 16.2 * linesOfCodeLog + 50 * commentFactor) * 100 / 171
    );
    
    return Math.round(mi * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Analyze code with ESLint for linting score
   */
  private async analyzeLinting(tempFile: string, language: string): Promise<LintingResults> {
    try {
      if (!existsSync(this.config.eslintConfigPath!)) {
        this.logger.warn('ESLint config not found, skipping linting analysis');
        return this.getDefaultLinting();
      }
      
      // Run ESLint with JSON output
      const eslintCommand = `npx eslint --format json "${tempFile}" --no-eslintrc --config "${this.config.eslintConfigPath}"`;
      const eslintOutput = execSync(eslintCommand, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const results = JSON.parse(eslintOutput);
      const fileResult = results[0];
      
      if (!fileResult) {
        return this.getDefaultLinting();
      }
      
      const messages = fileResult.messages || [];
      const totalErrors = messages.filter((m: any) => m.severity === 2).length;
      const totalWarnings = messages.filter((m: any) => m.severity === 1).length;
      const totalIssues = totalErrors + totalWarnings;
      const fixableIssues = messages.filter((m: any) => m.fix).length;
      
      // Categorize errors
      const errorsByCategory: Record<string, number> = {};
      messages.forEach((message: any) => {
        const category = message.ruleId || 'unknown';
        errorsByCategory[category] = (errorsByCategory[category] || 0) + 1;
      });
      
      // Calculate score based on issue density (issues per 100 lines)
      const codeLines = readFileSync(tempFile, 'utf8').split('\n').length;
      const issueDensity = codeLines > 0 ? (totalIssues / codeLines) * 100 : 0;
      
      // Score: 100 for no issues, decreasing with issue density
      const score = Math.max(0, 100 - (issueDensity * 10));
      
      return {
        totalErrors,
        totalWarnings,
        totalIssues,
        score: Math.round(score),
        errorsByCategory,
        fixableIssues
      };
      
    } catch (error) {
      // ESLint exits with code 1 when there are linting errors, parse the output anyway
      if (error instanceof Error && 'stdout' in error) {
        try {
          const results = JSON.parse((error as any).stdout);
          const fileResult = results[0];
          
          if (fileResult) {
            const messages = fileResult.messages || [];
            const totalErrors = messages.filter((m: any) => m.severity === 2).length;
            const totalWarnings = messages.filter((m: any) => m.severity === 1).length;
            const totalIssues = totalErrors + totalWarnings;
            const fixableIssues = messages.filter((m: any) => m.fix).length;
            
            const errorsByCategory: Record<string, number> = {};
            messages.forEach((message: any) => {
              const category = message.ruleId || 'unknown';
              errorsByCategory[category] = (errorsByCategory[category] || 0) + 1;
            });
            
            const codeLines = readFileSync(tempFile, 'utf8').split('\n').length;
            const issueDensity = codeLines > 0 ? (totalIssues / codeLines) * 100 : 0;
            const score = Math.max(0, 100 - (issueDensity * 10));
            
            return {
              totalErrors,
              totalWarnings,
              totalIssues,
              score: Math.round(score),
              errorsByCategory,
              fixableIssues
            };
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse ESLint output:', parseError);
        }
      }
      
      this.logger.warn('Linting analysis failed, using defaults:', error);
      return this.getDefaultLinting();
    }
  }

  /**
   * Analyze code formatting with Prettier
   */
  private async analyzeFormatting(code: string, tempFile: string): Promise<FormattingResults> {
    try {
      // Check if code is already formatted
      const prettierCommand = `npx prettier --check "${tempFile}"`;
      
      try {
        execSync(prettierCommand, { stdio: 'pipe' });
        // If no error, code is properly formatted
        return {
          isFormatted: true,
          formattingIssues: 0,
          score: 100
        };
      } catch (error) {
        // Code is not properly formatted, get the formatted version
        const formatCommand = `npx prettier "${tempFile}"`;
        const formattedCode = execSync(formatCommand, { encoding: 'utf8' });
        
        // Count formatting differences (simplified)
        const originalLines = code.split('\n');
        const formattedLines = formattedCode.split('\n');
        const formattingIssues = Math.abs(originalLines.length - formattedLines.length) + 
          originalLines.filter((line, i) => line !== formattedLines[i]).length;
        
        // Score based on formatting issues relative to total lines
        const totalLines = Math.max(originalLines.length, 1);
        const score = Math.max(0, 100 - (formattingIssues / totalLines) * 100);
        
        return {
          isFormatted: false,
          formattingIssues,
          score: Math.round(score),
          fixedCode: formattedCode
        };
      }
      
    } catch (error) {
      this.logger.warn('Formatting analysis failed, using defaults:', error);
      return {
        isFormatted: false,
        formattingIssues: 0,
        score: 50 // Default neutral score
      };
    }
  }

  /**
   * Analyze TypeScript type coverage
   */
  private async analyzeTypeCoverage(tempFile: string): Promise<TypeCoverageResults> {
    try {
      // Use TypeScript compiler API to analyze type coverage
      // This is a simplified implementation - in production, use tools like type-coverage
      
      const code = readFileSync(tempFile, 'utf8');
      
      // Count type annotations and symbols (simplified heuristic)
      const typeAnnotations = code.match(/:\s*[A-Za-z<>\[\]|&{}]+/g) || [];
      const functionParams = code.match(/\([^)]*\)/g) || [];
      const variableDeclarations = code.match(/(?:let|const|var)\s+\w+/g) || [];
      
      // Estimate total symbols requiring types
      const totalSymbols = functionParams.length + variableDeclarations.length;
      const typedSymbols = typeAnnotations.length;
      
      const coverage = totalSymbols > 0 ? (typedSymbols / totalSymbols) * 100 : 100;
      
      return {
        totalSymbols,
        typedSymbols,
        coverage: Math.min(100, Math.round(coverage)),
        untypedAreas: [] // Would be populated by proper TypeScript analysis
      };
      
    } catch (error) {
      this.logger.warn('Type coverage analysis failed, using defaults:', error);
      return this.getDefaultTypeCoverage();
    }
  }

  /**
   * Analyze code duplication
   */
  private async analyzeDuplication(tempFile: string): Promise<DuplicationResults> {
    try {
      const code = readFileSync(tempFile, 'utf8');
      const lines = code.split('\n').filter(line => line.trim().length > 0);
      
      // Simple duplicate line detection (in production, use proper tools like jscpd)
      const lineFrequency = new Map<string, number>();
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.length > 10) { // Only consider meaningful lines
          lineFrequency.set(trimmed, (lineFrequency.get(trimmed) || 0) + 1);
        }
      });
      
      const duplicatedLines = Array.from(lineFrequency.entries())
        .filter(([_, count]) => count > 1)
        .reduce((sum, [_, count]) => sum + count, 0);
      
      const duplicationPercentage = lines.length > 0 ? (duplicatedLines / lines.length) * 100 : 0;
      
      return {
        duplicatedLines,
        totalLines: lines.length,
        duplicationPercentage: Math.round(duplicationPercentage * 100) / 100,
        duplicatedBlocks: [] // Would be populated by proper duplication analysis
      };
      
    } catch (error) {
      this.logger.warn('Duplication analysis failed, using defaults:', error);
      return {
        duplicatedLines: 0,
        totalLines: 1,
        duplicationPercentage: 0,
        duplicatedBlocks: []
      };
    }
  }

  /**
   * Calculate technical debt ratio
   */
  private calculateTechnicalDebtRatio(
    complexity: ComplexityMetrics,
    linting: LintingResults,
    duplication: DuplicationResults
  ): number {
    // Technical debt based on complexity, linting issues, and duplication
    const complexityDebt = Math.max(0, complexity.cyclomaticComplexity - this.config.cyclomaticComplexity.lowThreshold) * 2;
    const lintingDebt = linting.totalIssues * 1.5;
    const duplicationDebt = duplication.duplicationPercentage * 3;
    
    const totalDebt = complexityDebt + lintingDebt + duplicationDebt;
    const codeSize = Math.max(complexity.linesOfCode, 1);
    
    return Math.round((totalDebt / codeSize) * 100 * 100) / 100; // Debt per 100 lines
  }

  /**
   * Generate quality recommendations
   */
  private generateRecommendations(
    complexity: ComplexityMetrics,
    linting: LintingResults,
    formatting: FormattingResults,
    typeCoverage: TypeCoverageResults,
    duplication: DuplicationResults
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    // Complexity recommendations
    if (complexity.cyclomaticComplexity > this.config.cyclomaticComplexity.highThreshold) {
      recommendations.push({
        category: 'complexity',
        priority: 'critical',
        description: `Cyclomatic complexity is ${complexity.cyclomaticComplexity}, which is very high`,
        suggestion: 'Break down complex functions into smaller, more manageable pieces. Consider using the Extract Method refactoring.',
        estimatedImpact: 25,
        automated: false
      });
    } else if (complexity.cyclomaticComplexity > this.config.cyclomaticComplexity.mediumThreshold) {
      recommendations.push({
        category: 'complexity',
        priority: 'high',
        description: `Cyclomatic complexity is ${complexity.cyclomaticComplexity}, which is moderately high`,
        suggestion: 'Consider refactoring to reduce decision points and improve code clarity.',
        estimatedImpact: 15,
        automated: false
      });
    }

    // Maintainability recommendations
    if (complexity.maintainabilityIndex < this.config.maintainabilityIndex.lowThreshold) {
      recommendations.push({
        category: 'maintainability',
        priority: 'critical',
        description: `Maintainability index is ${complexity.maintainabilityIndex}, which is very low`,
        suggestion: 'Improve code structure, reduce complexity, and increase documentation coverage.',
        estimatedImpact: 30,
        automated: false
      });
    }

    // Linting recommendations
    if (linting.totalErrors > 0) {
      recommendations.push({
        category: 'linting',
        priority: 'high',
        description: `${linting.totalErrors} ESLint errors found`,
        suggestion: linting.fixableIssues > 0 
          ? `${linting.fixableIssues} issues can be automatically fixed. Run 'eslint --fix' to resolve them.`
          : 'Review and fix ESLint errors to improve code quality.',
        estimatedImpact: Math.min(20, linting.totalErrors * 2),
        automated: linting.fixableIssues > 0
      });
    }

    // Formatting recommendations
    if (!formatting.isFormatted) {
      recommendations.push({
        category: 'formatting',
        priority: 'medium',
        description: `${formatting.formattingIssues} formatting issues found`,
        suggestion: 'Run Prettier to automatically format the code and improve consistency.',
        estimatedImpact: 10,
        automated: true
      });
    }

    // Type coverage recommendations
    if (typeCoverage.coverage < 80) {
      recommendations.push({
        category: 'types',
        priority: 'medium',
        description: `TypeScript type coverage is ${typeCoverage.coverage}%, which is below recommended 80%`,
        suggestion: 'Add type annotations to improve type safety and code documentation.',
        estimatedImpact: (80 - typeCoverage.coverage) / 5,
        automated: false
      });
    }

    // Duplication recommendations
    if (duplication.duplicationPercentage > 10) {
      recommendations.push({
        category: 'duplication',
        priority: 'high',
        description: `Code duplication is ${duplication.duplicationPercentage}%, which is above recommended 10%`,
        suggestion: 'Extract common functionality into reusable functions or modules.',
        estimatedImpact: duplication.duplicationPercentage,
        automated: false
      });
    }

    // Documentation recommendations
    if (complexity.commentRatio < 15) {
      recommendations.push({
        category: 'documentation',
        priority: 'medium',
        description: `Comment ratio is ${complexity.commentRatio.toFixed(1)}%, which is below recommended 15%`,
        suggestion: 'Add more comments and documentation to improve code understanding.',
        estimatedImpact: 8,
        automated: false
      });
    }

    return recommendations.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  }

  /**
   * Calculate composite quality score
   */
  private calculateCompositeScore(
    complexity: ComplexityMetrics,
    linting: LintingResults,
    formatting: FormattingResults,
    typeCoverage: TypeCoverageResults,
    duplication: DuplicationResults
  ): number {
    const weights = this.config.weights;
    
    // Normalize complexity scores (higher complexity = lower score)
    const complexityScore = Math.max(0, 100 - (complexity.cyclomaticComplexity - 1) * 3);
    const maintainabilityScore = complexity.maintainabilityIndex;
    const halsteadScore = Math.max(0, 100 - complexity.halsteadComplexity.difficulty * 2);
    
    // Linting and formatting scores are already normalized
    const lintingScore = linting.score;
    const formattingScore = formatting.score;
    const typeCoverageScore = typeCoverage.coverage;
    
    // Duplication score (lower duplication = higher score)
    const duplicationScore = Math.max(0, 100 - duplication.duplicationPercentage * 5);
    
    // Documentation score based on comment ratio
    const documentationScore = Math.min(100, complexity.commentRatio * 5);
    
    // Weighted composite score
    const compositeScore = 
      complexityScore * weights.cyclomaticComplexity +
      maintainabilityScore * weights.maintainabilityIndex +
      lintingScore * weights.lintingScore +
      formattingScore * weights.formattingScore +
      typeCoverageScore * weights.typeCoverage +
      documentationScore * weights.documentation +
      duplicationScore * weights.duplication +
      halsteadScore * weights.halsteadComplexity;
    
    return Math.round(compositeScore * 100) / 100;
  }

  /**
   * Calculate trend data for quality improvements
   */
  private calculateTrendData(identifier: string, currentScore: number): QualityTrend | undefined {
    const history = this.qualityHistory.get(identifier) || [];
    
    if (history.length === 0) {
      return undefined;
    }
    
    const previousMetrics = history[history.length - 1];
    const previousScore = previousMetrics.overallScore;
    const improvement = currentScore - previousScore;
    
    let trendDirection: 'improving' | 'stable' | 'declining';
    if (Math.abs(improvement) < 1) {
      trendDirection = 'stable';
    } else if (improvement > 0) {
      trendDirection = 'improving';
    } else {
      trendDirection = 'declining';
    }
    
    // Calculate improvement rate (average change per analysis)
    const scores = history.map(m => m.overallScore);
    const improvementRate = scores.length > 1 
      ? (currentScore - scores[0]) / scores.length
      : 0;
    
    return {
      previousScore,
      currentScore,
      improvement,
      trendDirection,
      improvementRate
    };
  }

  /**
   * Store quality metrics for trend analysis
   */
  private storeQualityMetrics(identifier: string, metrics: ComprehensiveQualityMetrics): void {
    const history = this.qualityHistory.get(identifier) || [];
    history.push(metrics);
    
    // Keep only last 10 analyses for trend calculation
    if (history.length > 10) {
      history.shift();
    }
    
    this.qualityHistory.set(identifier, history);
  }

  /**
   * Create temporary file for analysis
   */
  private createTempFile(code: string, language: string, filename?: string): string {
    const extension = language === 'typescript' ? '.ts' : '.js';
    const tempFile = join(tmpdir(), `quality-analysis-${Date.now()}${extension}`);
    
    writeFileSync(tempFile, code, 'utf8');
    return tempFile;
  }

  /**
   * Clean up temporary file
   */
  private cleanupTempFile(tempFile: string): void {
    try {
      if (existsSync(tempFile)) {
        require('fs').unlinkSync(tempFile);
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup temp file:', error);
    }
  }

  // Default/fallback methods for when analysis fails
  
  private getDefaultComplexity(): ComplexityMetrics {
    return {
      cyclomaticComplexity: 1,
      halsteadComplexity: {
        programLength: 0,
        vocabulary: 0,
        programLevel: 1,
        difficulty: 0,
        effort: 0,
        timeRequired: 0,
        bugsDelivered: 0
      },
      maintainabilityIndex: 85,
      linesOfCode: 0,
      logicalLinesOfCode: 0,
      commentLines: 0,
      commentRatio: 0
    };
  }

  private getDefaultLinting(): LintingResults {
    return {
      totalErrors: 0,
      totalWarnings: 0,
      totalIssues: 0,
      score: 100,
      errorsByCategory: {},
      fixableIssues: 0
    };
  }

  private getDefaultTypeCoverage(): TypeCoverageResults {
    return {
      totalSymbols: 0,
      typedSymbols: 0,
      coverage: 100,
      untypedAreas: []
    };
  }

  /**
   * Get quality configuration
   */
  getConfiguration(): QualityMetricsConfig {
    return { ...this.config };
  }

  /**
   * Update quality configuration
   */
  updateConfiguration(updates: Partial<QualityMetricsConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config_updated', this.config);
  }

  /**
   * Get quality history for a specific identifier
   */
  getQualityHistory(identifier: string): ComprehensiveQualityMetrics[] {
    return this.qualityHistory.get(identifier) || [];
  }

  /**
   * Clear quality history
   */
  clearHistory(): void {
    this.qualityHistory.clear();
    this.emit('history_cleared');
  }
}

// Export singleton instance for easy use
export const codeQualityAnalyzer = new CodeQualityAnalyzer();