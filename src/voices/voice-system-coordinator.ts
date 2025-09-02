import { accessSync } from 'fs';
import { execSync } from 'child_process';
import { VoiceArchetypeSystemInterface } from '../domain/interfaces/voice-system.js';
import { createLogger, ILogger } from '../infrastructure/logging/logger-adapter.js';
import { RuntimeContext } from './enterprise-voice-prompts.js';
import { createArchetypeDefinitions, VoiceDefinition } from './archetype-definitions.js';
import { selectVoices } from './voice-selector.js';
import { CouncilOrchestrator, CouncilMode } from './council-orchestrator.js';
import { synthesizePerspectives, VoiceOutput } from './perspective-synthesizer.js';
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

  constructor(
    private modelClient?: any,
    logger?: ILogger
  ) {
    this.logger = logger ?? createLogger('VoiceSystem');
    this.council = new CouncilOrchestrator(new CouncilDecisionEngine(this, modelClient));
    // NOTE: Call initialize() explicitly after construction.
  }

  initialize(): void {
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

  async generateMultiVoiceSolutions(
    voices: string[],
    prompt: string,
    options?: any
  ): Promise<any[]> {
    const result = await this.processPrompt(prompt, { requiredVoices: voices });
    // Convert single result to array format expected by callers
    return [
      {
        voice: result.voicesUsed?.[0] || 'synthesized',
        content: result.finalDecision,
        confidence: result.consensus || 0.8,
        files: options?.files || [],
      },
    ];
  }

  async getVoicePerspective(voiceId: string, prompt: string): Promise<any> {
    const voice = this.voices.get(voiceId);
    return {
      voiceId,
      position: `${voice?.name ?? voiceId} perspective on: ${prompt}`,
      confidence: 0.5,
      reasoning: '',
      supportingEvidence: [],
      concerns: [],
      alternatives: [],
    };
  }

  getLivingSpiralCoordinator(): any {
    return this.council;
  }

  setLivingSpiralCoordinator(coordinator: any): void {
    // Update the council with the spiral coordinator if needed
    this.council = new CouncilOrchestrator(new CouncilDecisionEngine(this, this.modelClient));
  }

  async synthesizeMultipleVoices(request: string, context: any = {}): Promise<any> {
    // Use the existing processPrompt method which handles multiple voices
    return this.processPrompt(request, context);
  }
}

export { CouncilMode };
export { VoiceSystemCoordinator as VoiceArchetypeSystem };
