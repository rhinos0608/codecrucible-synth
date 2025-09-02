import { VoiceDefinition } from './archetype-definitions.js';

/**
 * Select appropriate voices for a task.
 * If specific voices are requested, return those available; otherwise
 * return all available voices.
 */
export function selectVoices(
  available: Map<string, VoiceDefinition>,
  required?: string[]
): VoiceDefinition[] {
  const ids = required && required.length > 0 ? required : Array.from(available.keys());
  const selected: VoiceDefinition[] = [];
  for (const id of ids) {
    const voice = available.get(id);
    if (voice) {
      selected.push(voice);
    }
  }
  return selected;
}
