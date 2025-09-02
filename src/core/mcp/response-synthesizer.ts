/**
 * Response Synthesizer
 *
 * Merges raw MCP tool outputs with insights from the Voice Archetype System
 * to produce a unified response. This allows voice narratives to be enhanced
 * with concrete data or actions from MCP tools.
 */

import { createLogger } from '../logger.js';

export interface SynthesizedResponse {
  voiceId: string;
  content: string;
  mcpResults: any[];
}

export class ResponseSynthesizer {
  private readonly logger = createLogger('ResponseSynthesizer');

  /** Combine a voice response with MCP outputs. */
  synthesize(voiceResponse: any, mcpResults: any[]): SynthesizedResponse {
    this.logger.debug('Synthesizing voice and MCP responses');
    const content = [voiceResponse?.content ?? voiceResponse]
      .concat(mcpResults.map(r => r.result ?? r))
      .join('\n');
    return {
      voiceId: voiceResponse.voiceId || 'unknown',
      content,
      mcpResults,
    };
  }
}

export const responseSynthesizer = new ResponseSynthesizer();
