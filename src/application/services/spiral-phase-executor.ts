/**
 * Spiral Phase Executor
 * Application Layer - Single responsibility phase execution
 * 
 * Extracted from LivingSpiralCoordinator for clean separation of concerns
 * Handles: Individual phase execution with proper input/output transformation
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

import { IVoiceOrchestrationService } from '../../domain/services/voice-orchestration-service.js';
import { IModelSelectionService } from '../../domain/services/model-selection-service.js';
import { ProcessingRequest } from '../../domain/entities/request.js';
import { SimpleCouncilCoordinator } from './simple-council-coordinator.js';

export type SpiralPhase = 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';

export interface PhaseInput {
  content: string;
  phase: SpiralPhase;
  iteration: number;
  previousPhases: string[];
  context: Record<string, unknown>;
}

export interface PhaseOutput {
  content: string;
  phase: SpiralPhase;
  voicesUsed: string[];
  confidence: number;
  processingTime: number;
  qualityMetrics: {
    clarity: number;
    completeness: number;
    actionability: number;
  };
}

/**
 * Executes individual phases of the Living Spiral process
 * Single responsibility: Phase execution only
 */
export class SpiralPhaseExecutor {
  private councilCoordinator: SimpleCouncilCoordinator;

  constructor(
    private voiceOrchestrationService: IVoiceOrchestrationService,
    private modelSelectionService: IModelSelectionService
  ) {
    this.councilCoordinator = new SimpleCouncilCoordinator(
      voiceOrchestrationService,
      modelSelectionService
    );
  }

  /**
   * Execute a specific phase of the spiral
   */
  async executePhase(input: PhaseInput): Promise<PhaseOutput> {
    const startTime = Date.now();

    switch (input.phase) {
      case 'collapse':
        return await this.executeCollapsePhase(input, startTime);
      case 'council':
        return await this.executeCouncilPhase(input, startTime);
      case 'synthesis':
        return await this.executeSynthesisPhase(input, startTime);
      case 'rebirth':
        return await this.executeRebirthPhase(input, startTime);
      case 'reflection':
        return await this.executeReflectionPhase(input, startTime);
      default:
        throw new Error(`Unknown spiral phase: ${input.phase}`);
    }
  }

  private async executeCollapsePhase(input: PhaseInput, startTime: number): Promise<PhaseOutput> {
    const request = ProcessingRequest.create({
      prompt: this.buildCollapsePrompt(input.content),
      type: 'problem-decomposition',
      constraints: { mustIncludeVoices: ['explorer'] },
      context: input.context,
    });

    const model = await this.modelSelectionService.selectOptimalModel(request);
    const response = await model.generateResponse(request, { id: 'explorer' });

    return {
      content: response.content,
      phase: 'collapse',
      voicesUsed: ['explorer'],
      confidence: response.confidence || 0.8,
      processingTime: Date.now() - startTime,
      qualityMetrics: this.calculateQualityMetrics(response.content),
    };
  }

  private async executeCouncilPhase(input: PhaseInput, startTime: number): Promise<PhaseOutput> {
    const voiceIds = this.selectCouncilVoices(input.context);
    
    const councilResponse = await this.councilCoordinator.coordinateCouncil({
      prompt: input.content,
      voiceIds,
      synthesisMode: 'collaborative',
      context: input.context,
    });

    return {
      content: councilResponse.finalDecision,
      phase: 'council',
      voicesUsed: councilResponse.voiceContributions.map(vc => vc.voiceId),
      confidence: councilResponse.consensusLevel,
      processingTime: Date.now() - startTime,
      qualityMetrics: this.calculateQualityMetrics(councilResponse.finalDecision),
    };
  }

  private async executeSynthesisPhase(input: PhaseInput, startTime: number): Promise<PhaseOutput> {
    const request = ProcessingRequest.create({
      prompt: this.buildSynthesisPrompt(input.content),
      type: 'solution-synthesis',
      constraints: { mustIncludeVoices: ['architect'] },
      context: input.context,
    });

    const model = await this.modelSelectionService.selectOptimalModel(request);
    const response = await model.generateResponse(request, { id: 'architect' });

    return {
      content: response.content,
      phase: 'synthesis',
      voicesUsed: ['architect'],
      confidence: response.confidence || 0.8,
      processingTime: Date.now() - startTime,
      qualityMetrics: this.calculateQualityMetrics(response.content),
    };
  }

  private async executeRebirthPhase(input: PhaseInput, startTime: number): Promise<PhaseOutput> {
    const request = ProcessingRequest.create({
      prompt: this.buildRebirthPrompt(input.content),
      type: 'implementation-planning',
      constraints: { mustIncludeVoices: ['implementor'] },
      context: input.context,
    });

    const model = await this.modelSelectionService.selectOptimalModel(request);
    const response = await model.generateResponse(request, { id: 'implementor' });

    return {
      content: response.content,
      phase: 'rebirth',
      voicesUsed: ['implementor'],
      confidence: response.confidence || 0.8,
      processingTime: Date.now() - startTime,
      qualityMetrics: this.calculateQualityMetrics(response.content),
    };
  }

  private async executeReflectionPhase(input: PhaseInput, startTime: number): Promise<PhaseOutput> {
    const request = ProcessingRequest.create({
      prompt: this.buildReflectionPrompt(input.content, input.previousPhases),
      type: 'quality-assessment',
      constraints: { mustIncludeVoices: ['guardian'] },
      context: input.context,
    });

    const model = await this.modelSelectionService.selectOptimalModel(request);
    const response = await model.generateResponse(request, { id: 'guardian' });

    // Combine original content with reflection insights
    const enhancedContent = `${input.content}\n\n---\n\n## REFLECTION INSIGHTS:\n${response.content}`;

    return {
      content: enhancedContent,
      phase: 'reflection',
      voicesUsed: ['guardian'],
      confidence: response.confidence || 0.8,
      processingTime: Date.now() - startTime,
      qualityMetrics: this.calculateQualityMetrics(enhancedContent),
    };
  }

  private selectCouncilVoices(context: Record<string, unknown>): string[] {
    // Default council voices for balanced perspective
    const defaultVoices = ['explorer', 'maintainer', 'analyzer'];
    
    // Customize based on context
    const requestType = context.requestType as string;
    if (requestType) {
      switch (requestType) {
        case 'security-analysis':
          return ['security', 'guardian', 'analyzer'];
        case 'performance-optimization':
          return ['optimizer', 'analyzer', 'implementor'];
        case 'architecture-design':
          return ['architect', 'maintainer', 'analyzer'];
        default:
          return defaultVoices;
      }
    }
    
    return defaultVoices;
  }

  private buildCollapsePrompt(content: string): string {
    return `Act as The Explorer archetype. Decompose this complex problem into its essential components:

${content}

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

  private buildReflectionPrompt(rebirthOutput: string, previousPhases: string[]): string {
    const phaseHistory = previousPhases.length > 0 
      ? `\nPrevious phases completed: ${previousPhases.join(' → ')}`
      : '';

    return `Act as The Guardian archetype. Reflect on this implementation and assess its quality:

${rebirthOutput}${phaseHistory}

Provide critical reflection on:
1. Quality assessment of the current solution
2. Gaps or weaknesses that need addressing
3. Lessons learned from this iteration
4. Recommendations for improvement
5. Readiness for deployment vs. need for iteration

Be honest about quality and provide specific guidance for next steps.`;
  }

  private calculateQualityMetrics(content: string): { clarity: number; completeness: number; actionability: number } {
    // Simplified quality metrics calculation
    let clarity = 0.6; // Base score
    let completeness = 0.6;
    let actionability = 0.6;

    // Check for structure (improves clarity)
    if (/#{1,3}/.test(content) || /\d+\./.test(content)) {
      clarity += 0.2;
    }

    // Check for detail (improves completeness)
    if (content.length > 500) {
      completeness += 0.2;
    }
    if (content.length > 1000) {
      completeness += 0.1;
    }

    // Check for actionable elements (improves actionability)
    if (/step|implement|create|build|deploy/i.test(content)) {
      actionability += 0.2;
    }
    if (/```[\s\S]*```/.test(content)) {
      actionability += 0.2;
    }

    return {
      clarity: Math.min(clarity, 1.0),
      completeness: Math.min(completeness, 1.0),
      actionability: Math.min(actionability, 1.0),
    };
  }
}