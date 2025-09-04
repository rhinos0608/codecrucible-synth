/**
 * Living Spiral Process Use Case
 * Application Layer - Simplified iterative development methodology
 *
 * Handles: 5-phase iterative process with clean separation of concerns
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

import { IVoiceOrchestrationService } from '../../domain/services/voice-orchestration-service.js';
import { ProcessingRequest } from '../../domain/entities/request.js';
import { IModelClient } from '../../domain/interfaces/model-client.js';

export interface LivingSpiralInput {
  initialPrompt: string;
  maxIterations?: number;
  qualityThreshold?: number;
  enableReflection?: boolean;
  context?: Record<string, unknown>;
}

export interface LivingSpiralOutput {
  finalSolution: string;
  iterations: SpiralIteration[];
  convergenceAchieved: boolean;
  totalIterations: number;
  finalQuality: number;
}

export interface SpiralIteration {
  phase: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
  iteration: number;
  input: string;
  output: string;
  quality: number;
  voicesUsed: string[];
  duration: number;
}

/**
 * Use Case: Execute Living Spiral iterative development process
 * Simplified single responsibility implementation
 */
export class LivingSpiralProcessUseCase {
  constructor(
    private voiceOrchestrationService: IVoiceOrchestrationService,
    private modelClient: IModelClient
  ) {}

  async execute(input: LivingSpiralInput): Promise<LivingSpiralOutput> {
    const config = this.buildConfig(input);
    const iterations: SpiralIteration[] = [];
    let currentInput = input.initialPrompt;
    let convergenceAchieved = false;
    let iterationCount = 0;

    while (iterationCount < config.maxIterations && !convergenceAchieved) {
      iterationCount++;

      const iteration = await this.executeSingleSpiral(currentInput, iterationCount, config);

      iterations.push(iteration);

      // Check convergence
      if (iteration.quality >= config.qualityThreshold) {
        convergenceAchieved = true;
      } else {
        currentInput = this.prepareNextIteration(iteration);
      }
    }

    return {
      finalSolution: iterations[iterations.length - 1]?.output || '',
      iterations,
      convergenceAchieved,
      totalIterations: iterationCount,
      finalQuality: iterations[iterations.length - 1]?.quality || 0,
    };
  }

  private async executeSingleSpiral(
    input: string,
    iteration: number,
    config: any
  ): Promise<SpiralIteration> {
    const startTime = Date.now();

    // Phase 1: Collapse - Problem decomposition
    const collapsed = await this.collapsePhase(input);

    // Phase 2: Council - Multi-voice perspective gathering
    const councilResult = await this.councilPhase(collapsed);

    // Phase 3: Synthesis - Unified design creation
    const synthesized = await this.synthesisPhase(councilResult);

    // Phase 4: Rebirth - Implementation
    const reborn = await this.rebirthPhase(synthesized);

    // Phase 5: Reflection (optional)
    const final = config.enableReflection ? await this.reflectionPhase(reborn) : reborn;

    const duration = Date.now() - startTime;
    const quality = this.calculateQuality(final.output);

    return {
      phase: 'reflection',
      iteration,
      input,
      output: final.output,
      quality,
      voicesUsed: final.voices,
      duration,
    };
  }

  private async collapsePhase(input: string): Promise<{ output: string; voices: string[] }> {
    const prompt = this.buildCollapsePrompt(input);

    try {
      const response = await this.modelClient.generate(prompt);
      return {
        output: response,
        voices: ['explorer'],
      };
    } catch (error) {
      console.warn('Collapse phase failed, using fallback:', error);
      return {
        output: `Problem decomposition failed: ${prompt}\n\nFallback analysis:\n1. Core requirements: Needs detailed analysis\n2. Key constraints: Requires investigation\n3. Essential sub-problems: To be identified\n4. Dependencies: Unknown\n5. Success criteria: Undefined`,
        voices: ['explorer'],
      };
    }
  }

  private async councilPhase(collapsed: {
    output: string;
    voices: string[];
  }): Promise<{ output: string; voices: string[] }> {
    const request = ProcessingRequest.create(
      collapsed.output,
      'multi-perspective-analysis' as any,
      'medium',
      {},
      {}
    );

    // Use multi-voice synthesis for council
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 3,
      minVoices: 2,
      synthesisMode: 'COLLABORATIVE' as any,
    });

    const allVoices = [voiceSelection.primaryVoice, ...voiceSelection.supportingVoices];

    // Generate responses from multiple voices
    const responses = [];
    for (const voice of allVoices) {
      try {
        const response = await this.modelClient.generate(
          `${voice.id} perspective: ${request.prompt}`
        );
        responses.push({
          voiceId: voice.id,
          content: response,
          confidence: 0.8,
        });
      } catch (error) {
        console.warn(`Council phase failed for voice ${voice.id}, using fallback:`, error);
        responses.push({
          voiceId: voice.id,
          content: `${voice.id} analysis would appear here after model integration`,
          confidence: 0.3,
        });
      }
    }

    // Synthesize council perspectives
    const synthesisResult = await this.voiceOrchestrationService.synthesizeVoiceResponses(
      responses,
      voiceSelection.synthesisMode
    );

    return {
      output: synthesisResult.finalResponse,
      voices: allVoices.map(v => v.id),
    };
  }

  private async synthesisPhase(council: {
    output: string;
    voices: string[];
  }): Promise<{ output: string; voices: string[] }> {
    const prompt = this.buildSynthesisPrompt(council.output);

    try {
      const response = await this.modelClient.generate(prompt);
      return {
        output: response,
        voices: [...council.voices, 'architect'],
      };
    } catch (error) {
      console.warn('Synthesis phase failed, using fallback:', error);
      return {
        output: `Synthesis of council perspectives:\n\n${council.output}\n\nArchitect synthesis would appear here after model integration.\n\nUnified approach: Requires proper model connection\nImplementation guidance: Pending model integration`,
        voices: [...council.voices, 'architect'],
      };
    }
  }

  private async rebirthPhase(synthesis: {
    output: string;
    voices: string[];
  }): Promise<{ output: string; voices: string[] }> {
    const prompt = this.buildRebirthPrompt(synthesis.output);

    try {
      const response = await this.modelClient.generate(prompt);
      return {
        output: response,
        voices: [...synthesis.voices, 'implementor'],
      };
    } catch (error) {
      console.warn('Rebirth phase failed, using fallback:', error);
      return {
        output: `Implementation planning for:\n\n${synthesis.output}\n\nImplementor guidance would appear here after model integration.\n\n1. Specific implementation steps: Requires model connection\n2. Code examples: Pending AI model integration\n3. Testing strategies: To be generated\n4. Deployment considerations: Awaiting analysis\n5. Success metrics: TBD\n6. Potential risks: Require assessment`,
        voices: [...synthesis.voices, 'implementor'],
      };
    }
  }

  private async reflectionPhase(rebirth: {
    output: string;
    voices: string[];
  }): Promise<{ output: string; voices: string[] }> {
    try {
      const response = await this.modelClient.generate(this.buildReflectionPrompt(rebirth.output));
      const enhancedOutput = `${rebirth.output}\n\n---\n\n## REFLECTION INSIGHTS:\n${response}`;

      return {
        output: enhancedOutput,
        voices: [...rebirth.voices, 'guardian'],
      };
    } catch (error) {
      console.warn('Reflection phase failed, using fallback:', error);
      const fallbackReflection = `Guardian quality assessment would appear here after model integration.\n\n1. Quality assessment: Requires AI analysis\n2. Gaps identification: Pending model connection\n3. Lessons learned: To be analyzed\n4. Improvement recommendations: Awaiting AI insights\n5. Deployment readiness: Needs evaluation`;

      const enhancedOutput = `${rebirth.output}\n\n---\n\n## REFLECTION INSIGHTS:\n${fallbackReflection}`;

      return {
        output: enhancedOutput,
        voices: [...rebirth.voices, 'guardian'],
      };
    }
  }

  private buildConfig(input: LivingSpiralInput) {
    return {
      maxIterations: input.maxIterations || 3,
      qualityThreshold: input.qualityThreshold || 0.8,
      enableReflection: input.enableReflection ?? true,
    };
  }

  private buildCollapsePrompt(input: string): string {
    return `Act as The Explorer archetype. Decompose this complex problem into its essential components:

${input}

Break it down into:
1. Core requirements
2. Key constraints  
3. Essential sub-problems
4. Dependencies
5. Success criteria

Provide a clear, structured breakdown that eliminates unnecessary complexity.`;
  }

  private buildSynthesisPrompt(councilOutput: string): string {
    return `Act as The Architect archetype. You must synthesize the following council perspectives into a unified, coherent solution:

${councilOutput}

Your synthesis should:
1. Identify common themes and agreements
2. Resolve conflicts between perspectives
3. Create a unified approach that leverages the best insights
4. Provide clear implementation guidance
5. Ensure all critical concerns are addressed

Deliver a comprehensive synthesis that represents the collective wisdom of the council.`;
  }

  private buildRebirthPrompt(synthesisOutput: string): string {
    return `Act as The Implementor archetype. Transform this synthesized design into concrete, actionable implementation:

${synthesisOutput}

Provide:
1. Specific implementation steps
2. Code examples where applicable
3. Testing strategies
4. Deployment considerations
5. Success metrics
6. Potential risks and mitigations

Focus on practical, executable solutions that can be immediately implemented.`;
  }

  private buildReflectionPrompt(rebirthOutput: string): string {
    return `Act as The Guardian archetype. Reflect on this implementation and assess its quality:

${rebirthOutput}

Provide critical reflection on:
1. Quality assessment of the current solution
2. Gaps or weaknesses that need addressing
3. Lessons learned from this iteration
4. Recommendations for improvement
5. Readiness for deployment vs. need for iteration

Be honest about quality and provide specific guidance for next steps.`;
  }

  private calculateQuality(output: string): number {
    // Simple quality metrics
    let score = 0.5; // Base score

    const hasCode = /```[\s\S]*```/.test(output);
    const hasStructure = /#{1,3}/.test(output) || /\d+\./.test(output);
    const hasDetail = output.length > 500;
    const hasActionable = /step|implement|create|build|deploy/i.test(output);
    const hasExamples = /example|for instance|such as/i.test(output);

    if (hasCode) score += 0.15;
    if (hasStructure) score += 0.15;
    if (hasDetail) score += 0.1;
    if (hasActionable) score += 0.1;
    if (hasExamples) score += 0.1;

    return Math.min(score, 1.0);
  }

  private prepareNextIteration(iteration: SpiralIteration): string {
    return `Based on the previous iteration results, please improve upon this solution:

PREVIOUS OUTPUT:
${iteration.output}

QUALITY SCORE: ${iteration.quality.toFixed(2)}

Focus on addressing any identified weaknesses and gaps while building upon the strengths.`;
  }
}
