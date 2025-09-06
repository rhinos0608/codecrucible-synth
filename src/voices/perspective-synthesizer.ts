export interface VoiceOutput {
  voiceId: string;
  content: string;
}

export interface SynthesisResult {
  consensus: { content: string; voices: string[] }[];
  divergences: { content: string; voices: string[] }[];
  totalVoices: number;
  consensusLevel: number; // 0-1, percentage of voices in consensus
}

/**
 * Combine multiple voice outputs into structured synthesis data.
 */
export function synthesizePerspectives(outputs: VoiceOutput[]): SynthesisResult {
  if (outputs.length === 0) {
    return {
      consensus: [],
      divergences: [],
      totalVoices: 0,
      consensusLevel: 0,
    };
  }

  // Group outputs by content
  const contentMap: Map<string, string[]> = new Map();
  for (const o of outputs) {
    if (!contentMap.has(o.content)) {
      contentMap.set(o.content, []);
    }
    const voices = contentMap.get(o.content);
    if (voices) {
      voices.push(o.voiceId);
    }
  }

  const consensus: { content: string; voices: string[] }[] = [];
  const divergences: { content: string; voices: string[] }[] = [];

  for (const [content, voices] of contentMap.entries()) {
    if (voices.length > 1) {
      consensus.push({ content, voices });
    } else {
      divergences.push({ content, voices });
    }
  }

  // Calculate consensus level
  const voicesInConsensus = consensus.reduce((sum, c) => sum + c.voices.length, 0);
  const consensusLevel = outputs.length > 0 ? voicesInConsensus / outputs.length : 0;

  return {
    consensus,
    divergences,
    totalVoices: outputs.length,
    consensusLevel,
  };
}

/**
 * Convert synthesis result to formatted string for backwards compatibility.
 */
export function formatSynthesisResult(result: SynthesisResult): string {
  let output = '';
  if (result.consensus.length > 0) {
    output += 'Consensus:\n';
    for (const c of result.consensus) {
      output += `- (${c.voices.join(', ')}) ${c.content}\n`;
    }
  }
  if (result.divergences.length > 0) {
    if (output.length > 0) output += '\n';
    output += 'Divergences:\n';
    for (const d of result.divergences) {
      output += `- (${d.voices[0]}) ${d.content}\n`;
    }
  }
  return output.trim();
}
