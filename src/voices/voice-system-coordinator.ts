import { accessSync } from 'fs';
import { execSync } from 'child_process';
import { VoiceArchetypeSystemInterface } from '../domain/interfaces/voice-system.js';
import { ILogger, createLogger } from '../infrastructure/logging/logger-adapter.js';
import { RuntimeContext } from './enterprise-voice-prompts.js';
import { VoiceDefinition, createArchetypeDefinitions } from './archetype-definitions.js';
import { selectVoices } from './voice-selector.js';
import { CouncilMode, CouncilOrchestrator } from './council-orchestrator.js';
import { VoiceOutput, synthesizePerspectives } from './perspective-synthesizer.js';
import { CouncilDecisionEngine } from './collaboration/council-decision-engine.js';

export interface SynthesisResult {
  finalDecision: string;
  voicesUsed: string[];
  consensus: number;
}

/**
 * VoiceSystemCoordinator orchestrates the 10-voice archetype system using
 * the Living Spiral methodology (Collapse, Council, Synthesis, Rebirth,
 * Reflection).
 */
export class VoiceSystemCoordinator implements VoiceArchetypeSystemInterface {
  private voices: Map<string, VoiceDefinition> = new Map();
  private logger: ILogger;
  private council: CouncilOrchestrator;

  public constructor(
    private readonly _modelClient?: unknown,
    logger?: ILogger
  ) {
    this.logger = logger ?? createLogger('VoiceSystem');
    this.council = new CouncilOrchestrator(new CouncilDecisionEngine(this));
    // NOTE: Call initialize() explicitly after construction.
  }

  public initialize(): void {
    const context = this.buildContext();
    this.voices = createArchetypeDefinitions(context);
  }

  // Living Spiral Phase: Collapse (context gathering)
  private buildContext(): RuntimeContext {
    return {
      workingDirectory: process.cwd(),
      isGitRepo: this.isGitRepository(),
      platform: process.platform,
      currentBranch: this.getCurrentBranch(),
      modelId: 'CodeCrucible Synth Enterprise',
      knowledgeCutoff: 'January 2025',
    };
  }

  private isGitRepository(): boolean {
    try {
      accessSync('.git');
      return true;
    } catch {
      return false;
    }
  }

  private getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  // Interface implementation
  getAvailableVoices(): string[] {
    return Array.from(this.voices.keys());
  }

  getDefaultVoices(): string[] {
    // Return a subset of commonly used voices for typical operations
    const defaults = ['developer', 'analyzer', 'architect'];
    return defaults.filter(voice => this.voices.has(voice));
  }

  getVoice(id: string): VoiceDefinition | undefined {
    return this.voices.get(id);
  }

  // Living Spiral Phase: Council + Synthesis
  async processPrompt(
    prompt: string,
    options?: { requiredVoices?: string[]; councilMode?: CouncilMode }
  ): Promise<SynthesisResult> {
    const selected = selectVoices(this.voices, options?.requiredVoices);
    const perspectives: VoiceOutput[] = [];

    for (const voice of selected) {
      const perspective = await this.getVoicePerspective(voice.id, prompt);
      perspectives.push({ voiceId: voice.id, content: perspective.position });
    }

    const finalDecision = synthesizePerspectives(perspectives);
    this.logger.info('Voices synthesized', {
      voices: selected.map(v => v.id).join(', '),
    });

    // Living Spiral Phase: Rebirth (deliver result) & Reflection (logging above)
    return {
      finalDecision,
      voicesUsed: selected.map(v => v.id),
      consensus: 1,
    };
  }

  public async generateMultiVoiceSolutions(
    voices: string[],
    prompt: string,
    options?: { files?: string[] }
  ): Promise<Array<{
    voice: string;
    content: string;
    confidence: number;
    files: string[];
  }>> {
    const result = await this.processPrompt(prompt, { requiredVoices: voices });
    // Convert single result to array format expected by callers
    return [
      {
        voice: result.voicesUsed?.[0] || 'synthesized',
        content: result.finalDecision,
        confidence: result.consensus || 0.8,
        files: options && Array.isArray(options.files) ? options.files : [],
      },
    ];
  }

  public getVoicePerspective(voiceId: string, prompt: string): Promise<{
    voiceId: string;
    position: string;
    confidence: number;
    reasoning: string;
    supportingEvidence: unknown[];
    concerns: unknown[];
    alternatives: unknown[];
  }> {
    const voice = this.voices.get(voiceId);
    return Promise.resolve({
      voiceId,
      position: `${voice?.name ?? voiceId} perspective on: ${prompt}`,
      confidence: 0.5,
      reasoning: '',
      supportingEvidence: [],
      concerns: [],
      alternatives: [],
    });
  }

  public getLivingSpiralCoordinator(): CouncilOrchestrator {
    return this.council;
  }

  public setLivingSpiralCoordinator(_coordinator: unknown): void {
    // Update the council with the spiral coordinator if needed
    this.council = new CouncilOrchestrator(new CouncilDecisionEngine(this));
  }

  public async synthesizeMultipleVoices(
    request: string,
    context: { requiredVoices?: string[]; councilMode?: CouncilMode } = {}
  ): Promise<SynthesisResult> {
    // Map context to the expected type for processPrompt
    const options: { requiredVoices?: string[]; councilMode?: CouncilMode } = {};
    if (context && typeof context === 'object') {
      if (Array.isArray(context.requiredVoices)) {
        options.requiredVoices = context.requiredVoices;
      }
      if (
        typeof context.councilMode === 'string' ||
        typeof context.councilMode === 'number'
      ) {
        options.councilMode = context.councilMode;
      }
    }
    return this.processPrompt(request, options);
  }
}

export { CouncilMode };
export { VoiceSystemCoordinator as VoiceArchetypeSystem };
