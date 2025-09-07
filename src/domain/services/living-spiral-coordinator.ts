/**
 * Living Spiral Coordinator for CodeCrucible Synth
 * Implements the core Living Spiral philosophy for iterative development
 */

import { ILogger } from '../interfaces/logger.js';
import { IModelClient } from '../interfaces/model-client.js';
import { IVoiceOrchestrationService } from '../interfaces/voice-orchestration.js';
import {
  LivingSpiralCoordinatorInterface,
  WorkflowContext,
  OrchestratorDependencies,
} from '../interfaces/workflow-orchestrator.js';

export enum SpiralPhase {
  COLLAPSE = 'collapse',
  COUNCIL = 'council',
  SYNTHESIS = 'synthesis',
  REBIRTH = 'rebirth',
  REFLECTION = 'reflection',
}

export interface SpiralConfig {
  maxIterations: number;
  qualityThreshold: number;
  convergenceTarget: number;
  enableReflection: boolean;
  parallelVoices: boolean;
  councilSize: number;
}

export interface SpiralIteration {
  phase: SpiralPhase;
  iteration: number;
  input: string;
  output: string;
  quality: number;
  voices: string[];
  metadata: {
    timestamp: Date;
    duration: number;
    convergence: number;
  };
}

export interface SpiralResult {
  final: string;
  iterations: SpiralIteration[];
  convergenceAchieved: boolean;
  totalIterations: number;
  quality: number;
  synthesisResults: any[];
}

export class LivingSpiralCoordinator implements LivingSpiralCoordinatorInterface {
  private config: SpiralConfig;

  constructor(
    private voiceSystem: IVoiceOrchestrationService,
    private modelClient: IModelClient,
    private logger: ILogger,
    config: SpiralConfig
  ) {
    this.config = config;
    this.logger.info('LivingSpiralCoordinator initialized');
  }

  /**
   * Execute the complete Living Spiral process
   */
  async executeSpiralProcess(initialPrompt: string): Promise<SpiralResult> {
    const iterations: SpiralIteration[] = [];
    let currentInput = initialPrompt;
    let convergenceAchieved = false;
    let iterationCount = 0;

    this.logger.info('🌀 Starting Living Spiral process', {
      prompt: initialPrompt.substring(0, 100),
      config: this.config,
    });

    while (iterationCount < this.config.maxIterations && !convergenceAchieved) {
      iterationCount++;

      const spiralIteration = await this.executeSingleSpiral(
        currentInput,
        iterationCount,
        iterations
      );

      iterations.push(spiralIteration);

      // Check for convergence
      if (spiralIteration.quality >= this.config.qualityThreshold) {
        convergenceAchieved = true;
        this.logger.info('✅ Spiral convergence achieved', {
          iteration: iterationCount,
          quality: spiralIteration.quality,
        });
      } else {
        // Prepare input for next iteration
        currentInput = await this.prepareNextIteration(spiralIteration);
      }
    }

    const result: SpiralResult = {
      final: iterations[iterations.length - 1]?.output || '',
      iterations,
      convergenceAchieved,
      totalIterations: iterationCount,
      quality: iterations[iterations.length - 1]?.quality || 0,
      synthesisResults: this.extractSynthesisResults(iterations),
    };

    this.logger.info('🎯 Living Spiral process completed', {
      iterations: iterationCount,
      converged: convergenceAchieved,
      finalQuality: result.quality,
    });

    return result;
  }

  /**
   * Execute a single spiral iteration through all phases
   */
  private async executeSingleSpiral(
    input: string,
    iteration: number,
    previousIterations: SpiralIteration[]
  ): Promise<SpiralIteration> {
    const startTime = Date.now();

    this.logger.info(`🌀 Spiral iteration ${iteration} starting`, { phase: 'beginning' });

    // Phase 1: Collapse - Break down the problem
    const collapsed = await this.collapsePhase(input);

    // Phase 2: Council - Gather diverse perspectives
    const councilResults = await this.councilPhase(collapsed);

    // Phase 3: Synthesis - Merge wisdom
    const synthesized = await this.synthesisPhase(councilResults);

    // Phase 4: Rebirth - Implement solution
    const reborn = await this.rebirthPhase(synthesized);

    // Phase 5: Reflection - Learn and adapt
    const reflected = this.config.enableReflection
      ? await this.reflectionPhase(reborn, previousIterations)
      : reborn;

    const duration = Date.now() - startTime;
    const quality = await this.calculateQuality(reflected.output);
    const convergence = this.calculateConvergence(previousIterations, quality);

    return {
      phase: SpiralPhase.REFLECTION,
      iteration,
      input,
      output: reflected.output,
      quality,
      voices: reflected.voices,
      metadata: {
        timestamp: new Date(),
        duration,
        convergence,
      },
    };
  }

  /**
   * Phase 1: Collapse - Decompose complexity into manageable atoms
   */
  private async collapsePhase(input: string): Promise<{ output: string; voices: string[] }> {
    this.logger.debug('📉 Collapse phase starting');

    const collapsePrompt = `
Act as The Explorer archetype. Decompose this complex problem into its essential components:

${input}

Break it down into:
1. Core requirements
2. Key constraints  
3. Essential sub-problems
4. Dependencies
5. Success criteria

Provide a clear, structured breakdown that eliminates unnecessary complexity.
`;

    const response = await this.modelClient.generate(collapsePrompt);

    return {
      output: response,
      voices: ['explorer'],
    };
  }

  /**
   * Phase 2: Council - Gather diverse perspectives and expertise
   */
  private async councilPhase(collapsed: {
    output: string;
    voices: string[];
  }): Promise<{ output: string; voices: string[] }> {
    this.logger.debug('🏛️ Council phase starting');

    const councilVoices = this.selectCouncilVoices();
    const perspectives: string[] = [];

    if (this.config.parallelVoices) {
      // Parallel council - all voices respond simultaneously using the voice system
      const responses = await this.voiceSystem.generateMultiVoiceSolutions(
        councilVoices,
        collapsed.output
      );
      perspectives.push(...responses.map((r: any) => r.content));
    } else {
      // Sequential council - voices build on each other
      for (const voice of councilVoices) {
        const response = await this.voiceSystem.generateSingleVoiceResponse(
          voice,
          collapsed.output,
          this.modelClient
        );
        perspectives.push(response.response);
      }
    }

    const councilOutput = `
COUNCIL PERSPECTIVES:

${perspectives
  .map(
    (p, i) => `
### ${councilVoices[i].toUpperCase()} PERSPECTIVE:
${p}
`
  )
  .join('\n')}
`;

    return {
      output: councilOutput,
      voices: councilVoices,
    };
  }

  /**
   * Phase 3: Synthesis - Merge wisdom into unified design
   */
  private async synthesisPhase(council: {
    output: string;
    voices: string[];
  }): Promise<{ output: string; voices: string[] }> {
    this.logger.debug('⚗️ Synthesis phase starting');

    const synthesisPrompt = `
Act as The Architect archetype. You must synthesize the following council perspectives into a unified, coherent solution:

${council.output}

Your synthesis should:
1. Identify common themes and agreements
2. Resolve conflicts between perspectives
3. Create a unified approach that leverages the best insights
4. Provide clear implementation guidance
5. Ensure all critical concerns are addressed

Deliver a comprehensive synthesis that represents the collective wisdom of the council.
`;

    const response = await this.modelClient.generate(synthesisPrompt);

    return {
      output: response,
      voices: [...council.voices, 'architect'],
    };
  }

  /**
   * Phase 4: Rebirth - Implement, test, and deploy
   */
  private async rebirthPhase(synthesis: {
    output: string;
    voices: string[];
  }): Promise<{ output: string; voices: string[] }> {
    this.logger.debug('🎯 Rebirth phase starting');

    const rebirthPrompt = `
Act as The Implementor archetype. Transform this synthesized design into concrete, actionable implementation:

${synthesis.output}

Provide:
1. Specific implementation steps
2. Code examples where applicable
3. Testing strategies
4. Deployment considerations
5. Success metrics
6. Potential risks and mitigations

Focus on practical, executable solutions that can be immediately implemented.
`;

    const response = await this.modelClient.generate(rebirthPrompt);

    return {
      output: response,
      voices: [...synthesis.voices, 'implementor'],
    };
  }

  /**
   * Phase 5: Reflection - Learn, adapt, and prepare for next iteration
   */
  private async reflectionPhase(
    rebirth: { output: string; voices: string[] },
    previousIterations: SpiralIteration[]
  ): Promise<{ output: string; voices: string[] }> {
    this.logger.debug('🔄 Reflection phase starting');

    const iterationHistory =
      previousIterations.length > 0
        ? `\nPREVIOUS ITERATIONS:\n${previousIterations
            .map(iter => `Iteration ${iter.iteration}: Quality ${iter.quality.toFixed(2)}`)
            .join('\n')}`
        : '';

    const reflectionPrompt = `
Act as The Guardian archetype. Reflect on this implementation and the overall spiral process:

CURRENT IMPLEMENTATION:
${rebirth.output}

${iterationHistory}

Provide critical reflection on:
1. Quality assessment of the current solution
2. Gaps or weaknesses that need addressing
3. Lessons learned from this iteration
4. Recommendations for improvement
5. Readiness for deployment vs. need for iteration

Be honest about quality and provide specific guidance for next steps.
`;

    const reflectionContent = await this.modelClient.generate(reflectionPrompt);

    // Combine rebirth output with reflection insights
    const finalOutput = `
${rebirth.output}

---

## REFLECTION INSIGHTS:
${reflectionContent}
`;

    return {
      output: finalOutput,
      voices: [...rebirth.voices, 'guardian'],
    };
  }

  /**
   * Select appropriate voices for the council based on config
   */
  private selectCouncilVoices(): string[] {
    const allVoices = ['explorer', 'maintainer', 'analyzer', 'developer', 'security', 'architect'];

    if (this.config.councilSize >= allVoices.length) {
      return allVoices;
    }

    // Select diverse set of voices
    const selected = ['explorer', 'maintainer', 'security']; // Always include these core voices
    const remaining = allVoices.filter(v => !selected.includes(v));

    while (selected.length < this.config.councilSize && remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(randomIndex, 1)[0]);
    }

    return selected;
  }

  /**
   * Calculate quality score for iteration output using QWAN-compliant comprehensive quality assessment
   * Implements measurable quality gates as required by AI Coding Grimoire
   */
  private async calculateQuality(output: string): Promise<number> {
    try {
      // QWAN-compliant quality assessment with measurable gates
      const qualityMetrics = await this.assessOutputQuality(output);

      // Apply QWAN quality gates (>90% threshold for excellence)
      const qualityScore = Math.max(0.0, Math.min(1.0, qualityMetrics.overallScore));

      // Log quality assessment for transparency
      this.logger?.info(`Living Spiral quality assessment`, {
        score: qualityScore,
        grade: qualityMetrics.qualityGrade,
        hasCode: qualityMetrics.hasCodeImplementation,
        hasDocumentation: qualityMetrics.hasDocumentation,
        hasTests: qualityMetrics.hasTestCoverage,
        actionableSteps: qualityMetrics.actionableSteps,
      });

      return qualityScore;
    } catch (error) {
      this.logger?.warn('Quality calculation failed, using basic assessment', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.calculateBasicQuality(output);
    }
  }

  /**
   * Comprehensive quality assessment for Living Spiral output
   * Implements QWAN principles with measurable quality gates
   */
  private async assessOutputQuality(output: string): Promise<{
    overallScore: number;
    qualityGrade: string;
    hasCodeImplementation: boolean;
    hasDocumentation: boolean;
    hasTestCoverage: boolean;
    actionableSteps: number;
  }> {
    // QWAN Quality Gates Assessment
    const hasCodeImplementation = /```[\s\S]*?```/.test(output);
    const hasDocumentation = /#+\s/.test(output) || output.includes('/**') || output.includes('##');
    const hasTestCoverage = /test|spec|describe|it\(|expect\(/i.test(output);
    const hasErrorHandling = /try|catch|throw|error|exception/i.test(output);
    const hasTypeDefinitions = /interface|type|class.*\{|extends|implements/i.test(output);
    const hasSecurityConsiderations = /security|auth|validation|sanitiz|encrypt|token/i.test(
      output
    );

    // Actionable steps assessment
    const actionableSteps = (
      output.match(
        /(step|implement|create|build|deploy|install|configure|setup|add|update|remove|fix)/gi
      ) || []
    ).length;

    // Content quality metrics
    const wordCount = output.split(/\s+/).length;
    const hasDetail = wordCount >= 100; // Minimum detail threshold
    const hasStructure = /^\s*[\d\-\*]\.|#+\s|^###?/m.test(output);
    const hasExamples = /example|instance|sample|demo/i.test(output);

    // Calculate weighted quality score using QWAN principles
    let score = 0.3; // Base score for basic response

    // Code implementation quality (30% weight)
    if (hasCodeImplementation) score += 0.3;
    if (hasTypeDefinitions) score += 0.1;
    if (hasErrorHandling) score += 0.1;

    // Documentation quality (25% weight)
    if (hasDocumentation) score += 0.2;
    if (hasExamples) score += 0.05;

    // Test coverage quality (20% weight) - Critical for QWAN
    if (hasTestCoverage) score += 0.2;

    // Security and best practices (15% weight)
    if (hasSecurityConsiderations) score += 0.1;
    if (hasDetail) score += 0.05;

    // Structure and actionability (10% weight)
    if (hasStructure) score += 0.05;
    if (actionableSteps >= 3) score += 0.05;

    // Determine quality grade based on score
    let qualityGrade = 'F';
    if (score >= 0.9) qualityGrade = 'A+';
    else if (score >= 0.85) qualityGrade = 'A';
    else if (score >= 0.8) qualityGrade = 'B+';
    else if (score >= 0.75) qualityGrade = 'B';
    else if (score >= 0.7) qualityGrade = 'C+';
    else if (score >= 0.65) qualityGrade = 'C';
    else if (score >= 0.6) qualityGrade = 'D';

    return {
      overallScore: Math.min(1.0, score),
      qualityGrade,
      hasCodeImplementation,
      hasDocumentation,
      hasTestCoverage,
      actionableSteps,
    };
  }

  /**
   * Fallback basic quality calculation for error scenarios
   */
  private calculateBasicQuality(output: string): number {
    const hasCode = output.includes('```');
    const hasStructure = /#{1,3}/.test(output) || /\d+\./.test(output);
    const hasDetail = output.length > 500;
    const hasActionable = /step|implement|create|build|deploy/.test(output.toLowerCase());

    let score = 0.5; // Base score
    if (hasCode) score += 0.15;
    if (hasStructure) score += 0.15;
    if (hasDetail) score += 0.1;
    if (hasActionable) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate convergence towards optimal solution
   */
  private calculateConvergence(
    previousIterations: SpiralIteration[],
    currentQuality: number
  ): number {
    if (previousIterations.length === 0) {
      return currentQuality;
    }

    const qualityTrend = previousIterations.map(iter => iter.quality);
    qualityTrend.push(currentQuality);

    // Calculate improvement rate
    if (qualityTrend.length < 2) {
      return currentQuality;
    }

    const improvement = currentQuality - qualityTrend[qualityTrend.length - 2];
    return Math.max(0, Math.min(1, currentQuality + improvement * 0.5));
  }

  /**
   * Prepare input for next iteration based on reflection
   */
  private async prepareNextIteration(iteration: SpiralIteration): Promise<string> {
    return `
Based on the previous iteration results, please improve upon this solution:

PREVIOUS OUTPUT:
${iteration.output}

QUALITY SCORE: ${iteration.quality.toFixed(2)}
CONVERGENCE: ${iteration.metadata.convergence.toFixed(2)}

Focus on addressing any identified weaknesses and gaps while building upon the strengths.
`;
  }

  /**
   * Extract synthesis results for analysis
   */
  private extractSynthesisResults(iterations: SpiralIteration[]): any[] {
    return iterations.map(iter => ({
      iteration: iter.iteration,
      phase: iter.phase,
      quality: iter.quality,
      convergence: iter.metadata.convergence,
      duration: iter.metadata.duration,
      voiceCount: iter.voices.length,
    }));
  }

  // === Interface Implementation Methods ===

  /**
   * Execute a single spiral iteration (public interface method)
   */
  async executeSpiralIteration(input: string, iteration: number): Promise<any> {
    this.logger.info(`Executing spiral iteration ${iteration}`);
    const previousIterations: SpiralIteration[] = [];
    return await this.executeSingleSpiral(input, iteration, previousIterations);
  }

  /**
   * Check if convergence has been achieved
   */
  async checkConvergence(results: ReadonlyArray<unknown>): Promise<boolean> {
    if (results.length === 0) return false;

    const qualities = results.map((r: any) => r.quality || 0);
    const avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;

    return avgQuality >= this.config.qualityThreshold;
  }

  /**
   * Analyze code or files
   */
  async analyzeCode(filePath: string, context: WorkflowContext): Promise<any> {
    this.logger.info(`Analyzing code: ${filePath}`);

    const analysisPrompt = `
Please analyze the code file: ${filePath}

Context:
- Working Directory: ${context.workingDirectory}
- Security Level: ${context.securityLevel}
- Permissions: ${context.permissions.join(', ')}

Provide a comprehensive analysis including:
1. Code quality assessment
2. Potential improvements
3. Security considerations
4. Performance implications
5. Architectural feedback
`;

    const response = await this.modelClient.generate(analysisPrompt);

    return {
      filePath,
      analysis: response,
      quality: this.calculateQualityScore(response),
      recommendations: this.extractRecommendations(response),
      context,
    };
  }

  /**
   * Initialize the orchestrator with dependencies
   */
  async initialize(dependencies: OrchestratorDependencies): Promise<void> {
    this.logger.info('Initializing LivingSpiralCoordinator with dependencies');

    // Store references to dependencies if needed
    // For now, we assume the coordinator is already initialized in constructor
    // But this provides a hook for future dependency injection

    this.logger.info('LivingSpiralCoordinator initialization completed');
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down LivingSpiralCoordinator');

    // Cleanup any resources, stop timers, etc.
    // Currently no cleanup needed, but this provides the interface hook

    this.logger.info('LivingSpiralCoordinator shutdown completed');
  }

  // === Helper Methods for Interface Implementation ===

  private calculateQualityScore(content: string): number {
    // Simple heuristic for quality scoring
    const length = content.length;
    const hasStructure = content.includes('\n') && content.includes('1.');
    const hasRecommendations = content.toLowerCase().includes('recommend');

    let score = 0.5; // Base score
    if (length > 500) score += 0.2;
    if (hasStructure) score += 0.2;
    if (hasRecommendations) score += 0.1;

    return Math.min(1.0, score);
  }

  private extractRecommendations(content: string): string[] {
    // Extract recommendations from analysis content
    const lines = content.split('\n');
    const recommendations: string[] = [];

    for (const line of lines) {
      if (
        line.toLowerCase().includes('recommend') ||
        line.toLowerCase().includes('suggest') ||
        line.toLowerCase().includes('should')
      ) {
        recommendations.push(line.trim());
      }
    }

    return recommendations;
  }
}

export default LivingSpiralCoordinator;
