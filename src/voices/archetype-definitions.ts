import { EnterpriseVoicePromptBuilder, RuntimeContext } from './enterprise-voice-prompts.js';

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

  const build = (
    id: string,
    name: string,
    style: string,
    temperature: number
  ): VoiceDefinition => ({
    id,
    name,
    style,
    temperature,
    systemPrompt: EnterpriseVoicePromptBuilder.buildPrompt(id, context),
    prompt: EnterpriseVoicePromptBuilder.buildPrompt(id, context),
  });

  voices.set('explorer', build('explorer', 'Explorer', 'experimental', 0.7));
  voices.set('maintainer', build('maintainer', 'Maintainer', 'conservative', 0.5));
  voices.set('analyzer', build('analyzer', 'Analyzer', 'analytical', 0.4));
  voices.set('developer', build('developer', 'Developer', 'pragmatic', 0.5));
  voices.set('implementor', build('implementor', 'Implementor', 'action-oriented', 0.4));
  voices.set('security', build('security', 'Security', 'defensive', 0.3));
  voices.set('architect', build('architect', 'Architect', 'strategic', 0.3));
  voices.set('designer', build('designer', 'Designer', 'user-centered', 0.6));
  voices.set('optimizer', build('optimizer', 'Optimizer', 'performance-focused', 0.3));
  voices.set('guardian', build('guardian', 'Guardian', 'protective', 0.2));

  return voices;
}
