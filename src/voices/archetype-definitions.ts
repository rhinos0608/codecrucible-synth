import { EnterpriseVoicePromptBuilder, RuntimeContext } from './enterprise-voice-prompts.js';
import { 
  VOICE_IDS, 
  VOICE_NAMES, 
  VOICE_STYLES, 
  VOICE_TEMPERATURES,
  type VoiceId 
} from './voice-constants.js';

export interface VoiceDefinition {
  id: string;
  name: string;
  style: string;
  temperature: number;
  systemPrompt: string;
  prompt: string;
}

/**
 * Build voice archetype definitions using the enterprise prompt builder.
 * Runtime context is provided by the coordinator so prompts can adapt
 * to the current repository and execution environment.
 */
export function createArchetypeDefinitions(context: RuntimeContext): Map<string, VoiceDefinition> {
  const voices = new Map<string, VoiceDefinition>();

  const build = (id: VoiceId): VoiceDefinition => ({
    id,
    name: VOICE_NAMES[id],
    style: VOICE_STYLES[id],
    temperature: VOICE_TEMPERATURES[id],
    systemPrompt: EnterpriseVoicePromptBuilder.buildPrompt(id, context),
    prompt: EnterpriseVoicePromptBuilder.buildPrompt(id, context),
  });

  // Build all voices using constants
  for (const voiceId of Object.values(VOICE_IDS)) {
    voices.set(voiceId, build(voiceId));
  }

  return voices;
}
