import { access } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { VoiceArchetypeSystemInterface } from '../domain/interfaces/voice-system.js';
import { ILogger, createLogger } from '../infrastructure/logging/logger-adapter.js';
import { type IModelClient } from '../domain/interfaces/model-client.js';
import { RuntimeContext } from './enterprise-voice-prompts.js';
import { VoiceDefinition, createArchetypeDefinitions } from './archetype-definitions.js';
import { selectVoices } from './voice-selector.js';
import { CouncilMode, CouncilOrchestrator } from './council-orchestrator.js';
import {
  formatSynthesisResult,
  type SynthesisResult,
  synthesizePerspectives,
  VoiceOutput,
} from './perspective-synthesizer.js';
import { CouncilDecisionEngine } from './collaboration/council-decision-engine.js';
import { VOICE_GROUPS } from './voice-constants.js';

export interface VoiceCoordinatorResult {
  finalDecision: string;
  voicesUsed: string[];
  consensus: number;
  structuredSynthesis?: import('./perspective-synthesizer.js').SynthesisResult;
}

/**
 * VoiceSystemCoordinator orchestrates the 10-voice archetype system using
 * the Living Spiral methodology (Collapse, Council, Synthesis, Rebirth,
 * Reflection).
 */
export class VoiceSystemCoordinator implements VoiceArchetypeSystemInterface {
  private voices: Map<string, VoiceDefinition> = new Map();
  private readonly logger: ILogger;
  private council: CouncilOrchestrator;

  public constructor(
    private readonly _modelClient?: Readonly<IModelClient>,
    logger?: Readonly<ILogger>
  ) {
    this.logger = logger ?? createLogger('VoiceSystem');
    this.council = new CouncilOrchestrator(new CouncilDecisionEngine(this));
    // NOTE: Call initialize() explicitly after construction.
  }

  public async initialize(): Promise<void> {
    const context = await this.buildContext();
    this.voices = createArchetypeDefinitions(context);
    this.logger.debug('VoiceSystemCoordinator initialized with async context gathering');
  }

  // Living Spiral Phase: Collapse (context gathering) - now async for better performance
  private async buildContext(): Promise<RuntimeContext> {
    const [isGitRepo, currentBranch] = await Promise.all([
      this.isGitRepository(),
      this.getCurrentBranch(),
    ]);

    return {
      workingDirectory: process.cwd(),
      isGitRepo,
      platform: process.platform,
      currentBranch,
      modelId: 'CodeCrucible Synth Enterprise',
      knowledgeCutoff: 'January 2025',
    };
  }

  private async isGitRepository(): Promise<boolean> {
    try {
      await access('.git');
      return true;
    } catch {
      return false;
    }
  }

  private async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { encoding: 'utf8' });
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  // Interface implementation
  public getAvailableVoices(): string[] {
    return Array.from(this.voices.keys());
  }

  public getDefaultVoices(): string[] {
    // Return default voice group for typical operations
    return VOICE_GROUPS.DEFAULT.filter(voice => this.voices.has(voice));
  }

  public getVoice(id: string): VoiceDefinition | undefined {
    return this.voices.get(id);
  }

  // Living Spiral Phase: Council + Synthesis
  public async processPrompt(
    prompt: string,
    options?: Readonly<{ requiredVoices?: readonly string[]; councilMode?: CouncilMode }>
  ): Promise<VoiceCoordinatorResult> {
    const selected = selectVoices(this.voices, options?.requiredVoices ? [...options.requiredVoices] : undefined, this.logger);

    // Parallel processing - all voices get perspectives concurrently
    this.logger.debug(`Processing ${selected.length} voices in parallel for synthesis`);

    const perspectivePromises = selected.map(async (voice: Readonly<typeof selected[number]>) =>
      this.getVoicePerspective(voice.id, prompt)
        .then((perspective: Readonly<{ position: string }>) => ({ voiceId: voice.id, content: perspective.position }))
        .catch((error: unknown) => {
          this.logger.warn(`Voice ${voice.id} failed during parallel processing:`, error);
          const errorMsg = (typeof error === 'object' && error !== null && 'message' in error)
            ? (error as { message?: string }).message
            : String(error);
          return {
            voiceId: voice.id,
            content: `${voice.name || voice.id} perspective unavailable due to error: ${errorMsg}`,
          };
        })
    );

    const perspectives = await Promise.all(perspectivePromises);

    // Convert to VoiceOutput format for synthesis
    const voiceOutputs: VoiceOutput[] = perspectives.map(p => ({
      voiceId: p.voiceId,
      content: p.content,
    }));

    const structuredSynthesis: SynthesisResult = synthesizePerspectives(voiceOutputs);
    const finalDecision: string = formatSynthesisResult(structuredSynthesis);

    this.logger.info('Voices synthesized', {
      voices: selected.map((v: Readonly<typeof selected[number]>) => v.id).join(', '),
      consensusLevel: typeof structuredSynthesis.consensusLevel === 'number' ? structuredSynthesis.consensusLevel : 0,
      totalVoices: typeof structuredSynthesis.totalVoices === 'number' ? structuredSynthesis.totalVoices : 0,
    });

    // Living Spiral Phase: Rebirth (deliver result) & Reflection (logging above)
    return {
      finalDecision,
      voicesUsed: selected.map((v: Readonly<typeof selected[number]>) => v.id),
      consensus: typeof structuredSynthesis.consensusLevel === 'number' ? structuredSynthesis.consensusLevel : 0,
      structuredSynthesis,
    };
  }

  public async generateMultiVoiceSolutions(
    voices: readonly string[],
    prompt: string,
    options?: { files?: string[] }
  ): Promise<
    Array<{
      voice: string;
      content: string;
      confidence: number;
      files: string[];
    }>
  > {
    const result = await this.processPrompt(prompt, { requiredVoices: [...voices] });
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

  public async getVoicePerspective(
    voiceId: string,
    prompt: string
  ): Promise<{
    voiceId: string;
    position: string;
    confidence: number;
    reasoning: string;
    supportingEvidence: string[];
    concerns: string[];
    alternatives: string[];
  }> {
    const voice = this.voices.get(voiceId);

    // If no voice found, return minimal response
    if (!voice) {
      this.logger.warn(`Voice ${voiceId} not found - returning static response`);
      return {
        voiceId,
        position: `Unknown voice perspective on: ${prompt}`,
        confidence: 0.1,
        reasoning: 'Voice not found in system',
        supportingEvidence: [],
        concerns: ['Voice archetype not available'],
        alternatives: [],
      };
    }

    // If no model client available, return static response with voice characteristics
    if (!this._modelClient) {
      this.logger.debug(
        `No model client available for ${voiceId} - returning static response with voice characteristics`
      );
      return {
        voiceId,
        position: `${voice.name} perspective: ${this.generateStaticPerspective(voice, prompt)}`,
        confidence: 0.3,
        reasoning: `Based on ${voice.name} archetype characteristics`,
        supportingEvidence: ['General expertise'],
        concerns: voice.systemPrompt?.includes('risk') ? ['Risk assessment needed'] : [],
        alternatives: [],
      };
    }

    try {
      // Generate real perspective using model client
      const voicePerspectivePrompt = this.buildVoicePerspectivePrompt(voice, prompt);

      this.logger.debug(
        `Generating real perspective for ${voice.name} on: ${prompt.substring(0, 50)}...`
      );

      const response = await this._modelClient.request({
        prompt: voicePerspectivePrompt,
        model: 'default',
        maxTokens: 500,
        temperature: 0.7,
      });

      // Parse the structured response
      const parsedResponse = this.parseVoicePerspectiveResponse(
        response.content || String(response),
        voice
      );

      return {
        voiceId,
        position: parsedResponse.position ?? `${voice.name} perspective on the given topic`,
        confidence: parsedResponse.confidence ?? 0.7,
        reasoning: parsedResponse.reasoning ?? 'Generated through AI analysis',
        supportingEvidence: parsedResponse.supportingEvidence ?? [],
        concerns: parsedResponse.concerns ?? [],
        alternatives: parsedResponse.alternatives ?? [],
      };
    } catch (error) {
      this.logger.error(`Failed to generate perspective for ${voiceId}:`, error);

      // Fallback to enhanced static response
      return {
        voiceId,
        position: `${voice.name} perspective: ${this.generateStaticPerspective(voice, prompt)}`,
        confidence: 0.4,
        reasoning: `Fallback response due to error: ${error instanceof Error ? error.message : String(error)}`,
        supportingEvidence: [`${voice.name} archetype expertise`],
        concerns: ['Unable to generate full AI-powered perspective'],
        alternatives: [],
      };
    }
  }

  private generateStaticPerspective(voice: VoiceDefinition, prompt: string): string {
    // Generate a more intelligent static response based on voice characteristics
    const voiceType = voice.name.toLowerCase();
    const promptLower = prompt.toLowerCase();

    if (
      voiceType.includes('security') &&
      (promptLower.includes('security') || promptLower.includes('risk'))
    ) {
      return 'Focus on security implications and risk assessment';
    } else if (
      voiceType.includes('architect') &&
      (promptLower.includes('design') || promptLower.includes('structure'))
    ) {
      return 'Emphasize architectural design patterns and system structure';
    } else if (
      voiceType.includes('maintainer') &&
      (promptLower.includes('maintain') || promptLower.includes('stability'))
    ) {
      return 'Prioritize long-term maintainability and stability';
    } else if (
      voiceType.includes('explorer') &&
      (promptLower.includes('new') || promptLower.includes('innovate'))
    ) {
      return 'Explore innovative approaches and emerging possibilities';
    } else {
      return `Apply ${voice.name} principles to evaluate and provide specialized insights`;
    }
  }

  private buildVoicePerspectivePrompt(voice: VoiceDefinition, prompt: string): string {
    return `You are ${voice.name}, a specialized AI archetype with the following characteristics:

Role: ${voice.systemPrompt || 'Specialized advisor'}
Strengths: Domain expertise, ${voice.name} specialized capabilities

Your task is to provide a perspective on the following topic from your specialized viewpoint:

"${prompt}"

Please provide your response in this structured format:

POSITION: [Your main stance or recommendation]
CONFIDENCE: [A number from 0.0 to 1.0 representing your confidence]
REASONING: [Your logical reasoning and analysis]
SUPPORTING_EVIDENCE: [Key points that support your position, separated by |]
CONCERNS: [Potential risks or issues you identify, separated by |]
ALTERNATIVES: [Alternative approaches you would suggest, separated by |]

Respond as ${voice.name} would, focusing on your specialized domain and perspective.`;
  }

  private parseVoicePerspectiveResponse(
    response: string,
    _voice: Readonly<VoiceDefinition>
  ): {
    position?: string;
    confidence?: number;
    reasoning?: string;
    supportingEvidence?: string[];
    concerns?: string[];
    alternatives?: string[];
  } {
    const result: {
      position?: string;
      confidence?: number;
      reasoning?: string;
      supportingEvidence?: string[];
      concerns?: string[];
      alternatives?: string[];
    } = {};

    try {
      // Parse structured response format
      const lines = response.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('POSITION:')) {
          result.position = trimmed.replace('POSITION:', '').trim();
        } else if (trimmed.startsWith('CONFIDENCE:')) {
          const confStr = trimmed.replace('CONFIDENCE:', '').trim();
          result.confidence = Math.max(0.1, Math.min(1.0, parseFloat(confStr) || 0.7));
        } else if (trimmed.startsWith('REASONING:')) {
          result.reasoning = trimmed.replace('REASONING:', '').trim();
        } else if (trimmed.startsWith('SUPPORTING_EVIDENCE:')) {
          const evidence = trimmed.replace('SUPPORTING_EVIDENCE:', '').trim();
          result.supportingEvidence = evidence
            ? evidence
                .split('|')
                .map(s => s.trim())
                .filter(s => s)
            : [];
        } else if (trimmed.startsWith('CONCERNS:')) {
          const concerns = trimmed.replace('CONCERNS:', '').trim();
          result.concerns = concerns
            ? concerns
                .split('|')
                .map(s => s.trim())
                .filter(s => s)
            : [];
        } else if (trimmed.startsWith('ALTERNATIVES:')) {
          const alternatives = trimmed.replace('ALTERNATIVES:', '').trim();
          result.alternatives = alternatives
            ? alternatives
                .split('|')
                .map(s => s.trim())
                .filter(s => s)
            : [];
        }
      }

      // If no structured response found, treat entire response as position
      if (!result.position && response.trim()) {
        result.position = response.trim().substring(0, 200) + (response.length > 200 ? '...' : '');
      }
    } catch (error) {
      this.logger.error('Error parsing voice perspective response:', error);
      result.position = response.substring(0, 200);
      result.confidence = 0.5;
      result.reasoning = 'Parsed from unstructured response';
    }

    return result;
  }

  public getLivingSpiralCoordinator(): CouncilOrchestrator {
    return this.council;
  }

  public setLivingSpiralCoordinator(_coordinator: Readonly<CouncilOrchestrator>): void {
    // Update the council with the provided spiral coordinator
    this.council = _coordinator as CouncilOrchestrator;
  }

  public async synthesizeMultipleVoices(
    request: string,
    context: Readonly<{ requiredVoices?: string[]; councilMode?: CouncilMode }> = {}
  ): Promise<VoiceCoordinatorResult> {
    // Map context to the expected type for processPrompt
    const options: { requiredVoices?: string[]; councilMode?: CouncilMode } = {};
    if (Array.isArray(context.requiredVoices)) {
      options.requiredVoices = context.requiredVoices;
    }
    if (typeof context.councilMode === 'string' || typeof context.councilMode === 'number') {
      options.councilMode = context.councilMode;
    }
    return this.processPrompt(request, options);
  }
}

export { CouncilMode };
export { VoiceSystemCoordinator as VoiceArchetypeSystem };
