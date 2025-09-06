import { VoiceDefinition } from './archetype-definitions.js';

/**
 * Select appropriate voices for a task.
 * If specific voices are requested, return those available; otherwise
 * return all available voices.
 * Now warns about missing requested voices for better debugging.
 */
export function selectVoices(
  available: Map<string, VoiceDefinition>,
  required?: string[],
  logger?: { warn: (message: string, meta?: any) => void }
): VoiceDefinition[] {
  const ids = required && required.length > 0 ? required : Array.from(available.keys());
  const selected: VoiceDefinition[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const voice = available.get(id);
    if (voice) {
      selected.push(voice);
    } else {
      missing.push(id);
    }
  }

  // Warn about missing requested voices
  if (missing.length > 0 && required && required.length > 0) {
    const availableIds = Array.from(available.keys());
    const warningMessage = `Voice selection: ${missing.length} requested voices not found`;

    if (logger) {
      logger.warn(warningMessage, {
        requestedVoices: required,
        missingVoices: missing,
        availableVoices: availableIds,
        selectedCount: selected.length,
        missingCount: missing.length,
      });
    } else {
      // Fallback to console for when no logger is provided
      console.warn(`[VoiceSelector] ${warningMessage}`, {
        missing: missing.join(', '),
        available: availableIds.join(', '),
      });
    }
  }

  return selected;
}
