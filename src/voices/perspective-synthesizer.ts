export interface VoiceOutput {
  voiceId: string;
  content: string;
}

/**
 * Combine multiple voice outputs into a single synthesized perspective.
 */
export function synthesizePerspectives(outputs: VoiceOutput[]): string {
  if (outputs.length === 0) return "";

  // Group outputs by content
  const contentMap: Map<string, string[]> = new Map();
  for (const o of outputs) {
    if (!contentMap.has(o.content)) {
      contentMap.set(o.content, []);
    }
    contentMap.get(o.content)!.push(o.voiceId);
  }

  const consensus: {content: string, voices: string[]}[] = [];
  const divergences: {content: string, voices: string[]}[] = [];

  for (const [content, voices] of contentMap.entries()) {
    if (voices.length > 1) {
      consensus.push({content, voices});
    } else {
      divergences.push({content, voices});
    }
  }

  let result = "";
  if (consensus.length > 0) {
    result += "Consensus:\n";
    for (const c of consensus) {
      result += `- (${c.voices.join(", ")}) ${c.content}\n`;
    }
  }
  if (divergences.length > 0) {
    if (result.length > 0) result += "\n";
    result += "Divergences:\n";
    for (const d of divergences) {
      result += `- (${d.voices[0]}) ${d.content}\n`;
    }
  }
  return result.trim();
}
