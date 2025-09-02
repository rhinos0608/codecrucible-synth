import {
  CouncilDecisionEngine,
  CouncilMode,
  CouncilConfig,
  CouncilDecision,
} from './collaboration/council-decision-engine.js';
import { VoiceDefinition } from './archetype-definitions.js';

/**
 * Wrapper around the CouncilDecisionEngine that focuses on multi-voice
 * collaboration. The orchestrator simply delegates to the underlying
 * engine while providing a friendlier interface for the coordinator.
 */
export class CouncilOrchestrator {
  private engine: CouncilDecisionEngine;

  constructor(engine: CouncilDecisionEngine) {
    this.engine = engine;
  }

  async convene(
    prompt: string,
    voices: VoiceDefinition[],
    config: Partial<CouncilConfig> = {}
  ): Promise<CouncilDecision> {
    const voiceIds = voices.map(v => v.id);
    const base: CouncilConfig = {
      mode: CouncilMode.CONSENSUS,
      maxRounds: 1,
      consensusThreshold: 0.6,
      allowDissent: true,
      requireExplanations: false,
      timeoutMs: 30_000,
    };
    return this.engine.conductCouncilSession(prompt, voiceIds, { ...base, ...config });
  }
}

export { CouncilMode };
