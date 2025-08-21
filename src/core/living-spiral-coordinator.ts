/**
 * Living Spiral Coordinator for CodeCrucible Synth
 * Implements the core Living Spiral philosophy for iterative development
 */

import { logger } from './logger.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { UnifiedModelClient } from './client.js';

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

export class LivingSpiralCoordinator {
  private voiceSystem: VoiceArchetypeSystem;
  private modelClient: UnifiedModelClient;
  private config: SpiralConfig;

  constructor(
    voiceSystem: VoiceArchetypeSystem,
    modelClient: UnifiedModelClient,
    config: SpiralConfig
  ) {
    this.voiceSystem = voiceSystem;
    this.modelClient = modelClient;
    this.config = config;
  }

  /**
   * Execute the complete Living Spiral process
   */
  async executeSpiralProcess(initialPrompt: string): Promise<SpiralResult> {
    const iterations: SpiralIteration[] = [];
    let currentInput = initialPrompt;
    let convergenceAchieved = false;
    let iterationCount = 0;

    logger.info('🌀 Starting Living Spiral process', {
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
        logger.info('✅ Spiral convergence achieved', {
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

    logger.info('🎯 Living Spiral process completed', {
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

    logger.info(`🌀 Spiral iteration ${iteration} starting`, { phase: 'beginning' });

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
    logger.debug('📉 Collapse phase starting');

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

    const output = await this.modelClient.generate(collapsePrompt);

    return {
      output,
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
    logger.debug('🏛️ Council phase starting');

    const councilVoices = this.selectCouncilVoices();
    const perspectives: string[] = [];

    if (this.config.parallelVoices) {
      // Parallel council - all voices respond simultaneously using the voice system
      const responses = await this.voiceSystem.generateMultiVoiceSolutions(
        councilVoices,
        collapsed.output
      );
      perspectives.push(...responses.map(r => r.content));
    } else {
      // Sequential council - voices build on each other
      for (const voice of councilVoices) {
        const response = await this.voiceSystem.generateSingleVoiceResponse(
          voice,
          collapsed.output,
          this.modelClient
        );
        perspectives.push(response.content);
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
    logger.debug('⚗️ Synthesis phase starting');

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

    const output = await this.modelClient.generate(synthesisPrompt);

    return {
      output,
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
    logger.debug('🎯 Rebirth phase starting');

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

    const output = await this.modelClient.generate(rebirthPrompt);

    return {
      output,
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
    logger.debug('🔄 Reflection phase starting');

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
   * Calculate quality score for iteration output
   */
  private async calculateQuality(output: string): Promise<number> {
    // Basic quality metrics
    const hasCode = /```/.test(output);
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
}

export default LivingSpiralCoordinator;
