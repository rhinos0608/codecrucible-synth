/**
 * Spiral Convergence Analyzer
 * Application Layer - Single responsibility convergence analysis
 *
 * Extracted from LivingSpiralCoordinator for clean separation of concerns
 * Handles: Quality assessment and convergence detection
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

export interface IterationResult {
  iteration: number;
  phase: string;
  content: string;
  quality: number;
  confidence: number;
  processingTime: number;
  qualityMetrics: {
    clarity: number;
    completeness: number;
    actionability: number;
  };
}

export interface ConvergenceAnalysis {
  isConverged: boolean;
  currentQuality: number;
  qualityTrend: number[];
  convergenceScore: number;
  recommendation: 'continue' | 'converged' | 'max_iterations' | 'quality_plateau';
  reasoning: string;
}

/**
 * Analyzes spiral iteration convergence and quality trends
 * Single responsibility: Convergence analysis only
 */
export class SpiralConvergenceAnalyzer {
  constructor(
    private qualityThreshold: number = 0.8,
    private convergenceThreshold: number = 0.85
  ) {}

  /**
   * Analyze convergence based on iteration history
   */
  analyzeConvergence(iterations: IterationResult[], maxIterations: number): ConvergenceAnalysis {
    if (iterations.length === 0) {
      return {
        isConverged: false,
        currentQuality: 0,
        qualityTrend: [],
        convergenceScore: 0,
        recommendation: 'continue',
        reasoning: 'No iterations to analyze',
      };
    }

    const currentIteration = iterations[iterations.length - 1];
    const qualityTrend = iterations.map(iter => iter.quality);
    const convergenceScore = this.calculateConvergenceScore(iterations);

    // Check convergence conditions
    const qualityConverged = currentIteration.quality >= this.qualityThreshold;
    const trendConverged = convergenceScore >= this.convergenceThreshold;
    const maxIterationsReached = iterations.length >= maxIterations;
    const qualityPlateau = this.isQualityPlateau(qualityTrend);

    let recommendation: 'continue' | 'converged' | 'max_iterations' | 'quality_plateau';
    let reasoning: string;
    let isConverged = false;

    if (qualityConverged && trendConverged) {
      isConverged = true;
      recommendation = 'converged';
      reasoning = `Solution has converged with quality ${currentIteration.quality.toFixed(2)} and convergence score ${convergenceScore.toFixed(2)}`;
    } else if (maxIterationsReached) {
      recommendation = 'max_iterations';
      reasoning = `Maximum iterations (${maxIterations}) reached. Current quality: ${currentIteration.quality.toFixed(2)}`;
    } else if (qualityPlateau) {
      recommendation = 'quality_plateau';
      reasoning =
        'Quality improvement has plateaued. Consider adjusting approach or accepting current solution.';
    } else {
      recommendation = 'continue';
      reasoning = `Continue iterating. Current quality: ${currentIteration.quality.toFixed(2)}, target: ${this.qualityThreshold}`;
    }

    return {
      isConverged,
      currentQuality: currentIteration.quality,
      qualityTrend,
      convergenceScore,
      recommendation,
      reasoning,
    };
  }

  /**
   * Calculate overall quality score from multiple metrics
   */
  calculateOverallQuality(
    content: string,
    qualityMetrics?: { clarity: number; completeness: number; actionability: number }
  ): number {
    // If specific metrics are provided, use weighted average
    if (qualityMetrics) {
      const weights = { clarity: 0.3, completeness: 0.4, actionability: 0.3 };
      return (
        qualityMetrics.clarity * weights.clarity +
        qualityMetrics.completeness * weights.completeness +
        qualityMetrics.actionability * weights.actionability
      );
    }

    // Fallback to content-based quality calculation
    return this.calculateContentQuality(content);
  }

  /**
   * Calculate quality trend analysis
   */
  calculateQualityTrend(qualityTrend: number[]): {
    direction: 'improving' | 'declining' | 'stable';
    rate: number;
    volatility: number;
  } {
    if (qualityTrend.length < 2) {
      return { direction: 'stable', rate: 0, volatility: 0 };
    }

    // Calculate moving average to smooth out noise
    const smoothedTrend = this.calculateMovingAverage(
      qualityTrend,
      Math.min(3, qualityTrend.length)
    );

    // Calculate trend direction
    const recent = smoothedTrend[smoothedTrend.length - 1];
    const previous = smoothedTrend[Math.max(0, smoothedTrend.length - 3)];
    const improvement = recent - previous;

    let direction: 'improving' | 'declining' | 'stable';
    if (improvement > 0.05) {
      direction = 'improving';
    } else if (improvement < -0.05) {
      direction = 'declining';
    } else {
      direction = 'stable';
    }

    // Calculate improvement rate
    const rate = Math.abs(improvement);

    // Calculate volatility (standard deviation)
    const mean = qualityTrend.reduce((sum, q) => sum + q, 0) / qualityTrend.length;
    const variance =
      qualityTrend.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / qualityTrend.length;
    const volatility = Math.sqrt(variance);

    return { direction, rate, volatility };
  }

  /**
   * Provide iteration recommendations
   */
  getIterationRecommendations(
    analysis: ConvergenceAnalysis,
    iterations: IterationResult[]
  ): string[] {
    const recommendations: string[] = [];

    if (analysis.recommendation === 'converged') {
      recommendations.push('Solution has converged successfully');
      recommendations.push('Consider final review and deployment preparation');
    } else if (analysis.recommendation === 'continue') {
      // Analyze what needs improvement
      const currentIteration = iterations[iterations.length - 1];
      const metrics = currentIteration.qualityMetrics;

      if (metrics.clarity < 0.7) {
        recommendations.push('Focus on improving solution clarity and structure');
      }
      if (metrics.completeness < 0.7) {
        recommendations.push('Expand solution detail and address missing aspects');
      }
      if (metrics.actionability < 0.7) {
        recommendations.push('Add more specific, actionable implementation steps');
      }

      recommendations.push('Continue with next spiral iteration');
    } else if (analysis.recommendation === 'quality_plateau') {
      recommendations.push('Consider changing approach or voice composition');
      recommendations.push('Evaluate whether current quality level is sufficient for deployment');
    } else if (analysis.recommendation === 'max_iterations') {
      recommendations.push('Maximum iterations reached - evaluate current solution');
      recommendations.push('Consider manual refinement or alternative approach');
    }

    return recommendations;
  }

  private calculateConvergenceScore(iterations: IterationResult[]): number {
    if (iterations.length < 2) {
      return iterations[0]?.quality || 0;
    }

    const qualityTrend = iterations.map(iter => iter.quality);
    const trend = this.calculateQualityTrend(qualityTrend);

    // Base convergence on current quality and trend stability
    const currentQuality = qualityTrend[qualityTrend.length - 1];
    const stabilityBonus = trend.direction === 'stable' ? 0.1 : 0;
    const improvementPenalty = trend.direction === 'improving' ? -0.05 : 0; // Still improving = not fully converged

    return Math.min(1.0, currentQuality + stabilityBonus + improvementPenalty);
  }

  private isQualityPlateau(qualityTrend: number[]): boolean {
    if (qualityTrend.length < 3) {
      return false;
    }

    // Check if last 3 iterations show minimal improvement
    const recentTrend = qualityTrend.slice(-3);
    const maxImprovement = Math.max(...recentTrend) - Math.min(...recentTrend);

    return maxImprovement < 0.05; // Less than 5% improvement
  }

  private calculateContentQuality(content: string): number {
    let score = 0.5; // Base score

    // Structure and formatting
    const hasStructure = /#{1,3}/.test(content) || /\d+\./.test(content);
    if (hasStructure) score += 0.1;

    // Length and detail
    if (content.length > 500) score += 0.1;
    if (content.length > 1000) score += 0.1;

    // Code examples
    const hasCode = /```[\s\S]*```/.test(content);
    if (hasCode) score += 0.15;

    // Actionable content
    const hasActionable = /step|implement|create|build|deploy|install|configure/i.test(content);
    if (hasActionable) score += 0.1;

    // Examples and explanations
    const hasExamples = /example|for instance|such as|e\.g\./i.test(content);
    if (hasExamples) score += 0.05;

    return Math.min(score, 1.0);
  }

  private calculateMovingAverage(values: number[], windowSize: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const average = window.reduce((sum, val) => sum + val, 0) / window.length;
      result.push(average);
    }

    return result;
  }
}
