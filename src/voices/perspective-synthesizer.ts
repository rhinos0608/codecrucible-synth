export interface VoiceOutput {
  voiceId: string;
  content: string;
}

/**
 * Combine multiple voice outputs into a single synthesized perspective.
 */
export function synthesizePerspectives(outputs: VoiceOutput[]): string {
  return outputs.map(o => `[${o.voiceId}] ${o.content}`).join('\n');
}
