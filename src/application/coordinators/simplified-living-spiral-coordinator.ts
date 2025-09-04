/**
 * Simplified Living Spiral Coordinator
 * Application Layer - Clean orchestration with single responsibility
 *
 * Replaces the complex LivingSpiralCoordinator with clean separation of concerns
 * Handles: High-level spiral process orchestration only
 * Imports: Application services and domain services only (follows ARCHITECTURE.md)
 */

import { PhaseInput, SpiralPhaseExecutor } from '../services/spiral-phase-executor.js';
import {
  IterationResult,
  SpiralConvergenceAnalyzer,
} from '../services/spiral-convergence-analyzer.js';
import { IVoiceOrchestrationService } from '../../domain/services/voice-orchestration-service.js';
import { IModelSelectionService } from '../../domain/services/model-selection-service.js';

export interface SimplifiedSpiralConfig {
  maxIterations: number;
  qualityThreshold: number;
  convergenceThreshold: number;
  enableReflection: boolean;
  phases: ('collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection')[];
}

export interface SimplifiedSpiralInput {
  initialPrompt: string;
  config?: Partial<SimplifiedSpiralConfig>;
  context?: Record<string, unknown>;
}

export interface SimplifiedSpiralOutput {
  finalSolution: string;
  iterations: IterationResult[];
  convergenceAchieved: boolean;
  totalIterations: number;
  finalQuality: number;
  recommendations: string[];
  metadata: {
    totalProcessingTime: number;
    averageQuality: number;
    voicesUsed: string[];
    phasesCompleted: string[];
  };
}

/**
 * Simplified Living Spiral Coordinator
 * Single responsibility: High-level process orchestration
 */
export class SimplifiedLivingSpiralCoordinator {
  private phaseExecutor: SpiralPhaseExecutor;
  private convergenceAnalyzer: SpiralConvergenceAnalyzer;
  private defaultConfig: SimplifiedSpiralConfig = {
    maxIterations: 3,
    qualityThreshold: 0.8,
    convergenceThreshold: 0.85,
    enableReflection: true,
    phases: ['collapse', 'council', 'synthesis', 'rebirth', 'reflection'],
  };

  constructor(
    voiceOrchestrationService: IVoiceOrchestrationService,
    modelSelectionService: IModelSelectionService
  ) {
    this.phaseExecutor = new SpiralPhaseExecutor(voiceOrchestrationService, modelSelectionService);
    this.convergenceAnalyzer = new SpiralConvergenceAnalyzer();
  }

  /**
   * Execute the complete Living Spiral process
   * Single responsibility: Process orchestration
   */
  public async executeSpiralProcess(
    input: Readonly<SimplifiedSpiralInput>
  ): Promise<SimplifiedSpiralOutput> {
    const startTime = Date.now();
    const config = { ...this.defaultConfig, ...input.config };

    // Initialize convergence analyzer with config
    this.convergenceAnalyzer = new SpiralConvergenceAnalyzer(
      config.qualityThreshold,
      config.convergenceThreshold
    );

    const iterations: IterationResult[] = [];
    let currentInput = input.initialPrompt;
    let convergenceAchieved = false;
    let iterationCount = 0;

    while (iterationCount < config.maxIterations && !convergenceAchieved) {
      iterationCount++;

      // Execute single iteration
      const iteration = await this.executeSingleIteration(
        currentInput,
        iterationCount,
        config,
        input.context ?? {}
      );

      iterations.push(iteration);

      // Analyze convergence
      const analysis = this.convergenceAnalyzer.analyzeConvergence(
        [...iterations],
        config.maxIterations
      );

      if (analysis.isConverged || analysis.recommendation === 'converged') {
        convergenceAchieved = true;
      } else if (
        analysis.recommendation === 'quality_plateau' ||
        analysis.recommendation === 'max_iterations'
      ) {
        break; // Stop iterating
      } else {
        // Prepare input for next iteration
        currentInput = this.prepareNextIterationInput(iteration, analysis);
      }
    }

    // Generate final recommendations
    const finalAnalysis = this.convergenceAnalyzer.analyzeConvergence(
      [...iterations],
      config.maxIterations
    );
    const recommendations = this.convergenceAnalyzer.getIterationRecommendations(finalAnalysis, [
      ...iterations,
    ]);

    return {
      finalSolution: iterations[iterations.length - 1]?.content || '',
      iterations,
      convergenceAchieved,
      totalIterations: iterationCount,
      finalQuality: finalAnalysis.currentQuality,
      recommendations,
      metadata: {
        totalProcessingTime: Date.now() - startTime,
        averageQuality: this.calculateAverageQuality(iterations),
        voicesUsed: this.extractUniqueVoices(iterations),
        phasesCompleted: this.extractCompletedPhases(iterations),
      },
    };
  }

  /**
   * Execute a single spiral iteration through all phases
   * Single responsibility: Iteration orchestration
   */
  private async executeSingleIteration(
    input: string,
    iteration: number,
    config: SimplifiedSpiralConfig,
    context: Record<string, unknown>
  ): Promise<IterationResult> {
    let currentContent = input;
    const allVoicesUsed: string[] = [];
    let totalProcessingTime = 0;
    const phasesCompleted: string[] = [];

    // Execute each phase in sequence
    for (const phaseName of config.phases) {
      // Skip reflection phase if disabled
      if (phaseName === 'reflection' && !config.enableReflection) {
        continue;
      }

      const phaseInput: PhaseInput = {
        content: currentContent,
        phase: phaseName,
        iteration,
        previousPhases: phasesCompleted,
        context,
      };

      const phaseOutput = await this.phaseExecutor.executePhase(phaseInput);

      currentContent = phaseOutput.content;
      allVoicesUsed.push(...phaseOutput.voicesUsed);
      totalProcessingTime += phaseOutput.processingTime;
      phasesCompleted.push(phaseName);
    }

    // Calculate overall quality for the iteration
    const finalPhaseOutput = await this.phaseExecutor.executePhase({
      content: currentContent,
      phase: 'reflection',
      iteration,
      previousPhases: phasesCompleted,
      context,
    });

    const overallQuality = this.convergenceAnalyzer.calculateOverallQuality(
      currentContent,
      finalPhaseOutput.qualityMetrics
    );

    return {
      iteration,
      phase: 'complete',
      content: currentContent,
      quality: overallQuality,
      confidence: finalPhaseOutput.confidence,
      processingTime: totalProcessingTime,
      qualityMetrics: finalPhaseOutput.qualityMetrics,
    };
  }

  private prepareNextIterationInput(
    iteration: IterationResult,
    analysis: { reasoning: string }
  ): string {
    return `Based on the previous iteration results, please improve upon this solution:

PREVIOUS OUTPUT:
${iteration.content}

QUALITY SCORE: ${iteration.quality.toFixed(2)}
ANALYSIS: ${analysis.reasoning}

Focus on addressing any identified weaknesses and gaps while building upon the strengths.`;
  }

  private calculateAverageQuality(iterations: IterationResult[]): number {
    if (iterations.length === 0) return 0;
    const totalQuality = iterations.reduce((sum, iter) => sum + iter.quality, 0);
    return totalQuality / iterations.length;
  }

  private extractUniqueVoices(iterations: IterationResult[]): string[] {
    const allVoices = iterations.flatMap(
      (_iter: Readonly<IterationResult>) =>
        // Extract voices from iteration metadata (simplified)
        ['explorer', 'architect', 'implementor', 'guardian'] // Default voices used
    );
    return [...new Set(allVoices)];
  }

  private extractCompletedPhases(_iterations: ReadonlyArray<IterationResult>): string[] {
    // For simplified tracking, assume all standard phases completed
    return ['collapse', 'council', 'synthesis', 'rebirth', 'reflection'];
  }

  /**
   * Get current spiral status
   */
  public async getSpiralStatus(iterations: ReadonlyArray<IterationResult>): Promise<{
    currentQuality: number;
    convergenceScore: number;
    recommendation: string;
    nextSteps: string[];
  }> {
    if (iterations.length === 0) {
      return Promise.resolve({
        currentQuality: 0,
        convergenceScore: 0,
        recommendation: 'Start spiral process',
        nextSteps: ['Begin with collapse phase'],
      });
    }

    // Convert readonly array to a mutable array before passing to analyzers
    const mutableIterations = Array.from(iterations);

    const analysis = this.convergenceAnalyzer.analyzeConvergence(
      mutableIterations,
      this.defaultConfig.maxIterations
    );
    const recommendations = this.convergenceAnalyzer.getIterationRecommendations(
      analysis,
      mutableIterations
    );

    return Promise.resolve({
      currentQuality: analysis.currentQuality,
      convergenceScore: analysis.convergenceScore,
      recommendation: analysis.reasoning,
      nextSteps: recommendations,
    });
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Readonly<Partial<SimplifiedSpiralConfig>>): void {
    const updatedConfig = { ...this.defaultConfig, ...newConfig };
    this.defaultConfig = Object.freeze(updatedConfig);
    this.convergenceAnalyzer = new SpiralConvergenceAnalyzer(
      this.defaultConfig.qualityThreshold,
      this.defaultConfig.convergenceThreshold
    );
  }
}
