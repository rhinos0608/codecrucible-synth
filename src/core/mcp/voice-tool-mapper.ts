/**
 * Voice Tool Mapper
 *
 * Maps MCP tools to voice archetype capabilities. Acts as a central registry
 * so voices can discover which MCP tools support their requested capabilities
 * and vice-versa.
 */

import { createLogger } from '../logger.js';

export interface ToolMapping {
  voiceId: string;
  capability: string;
  tools: string[];
}

/**
 * Maintains bidirectional mappings between voice capabilities and MCP tools.
 * This enables the coordinator to quickly determine which tools should be
 * invoked for a given voice request and to understand which voices can
 * leverage a particular MCP tool.
 */
export class VoiceToolMapper {
  private readonly logger = createLogger('VoiceToolMapper');
  private readonly mappings: ToolMapping[] = [];

  /** Register mapping between a voice capability and one or more tools. */
  registerMapping(mapping: ToolMapping): void {
    this.logger.debug('Registering voice tool mapping', mapping);
    this.mappings.push(mapping);
  }

  /** Get tools that can satisfy a voice capability. */
  getToolsForVoice(voiceId: string, capability: string): string[] {
    return this.mappings
      .filter(m => m.voiceId === voiceId && m.capability === capability)
      .flatMap(m => m.tools);
  }

  /** List all mappings that reference a specific tool. */
  getCapabilitiesForTool(tool: string): ToolMapping[] {
    return this.mappings.filter(m => m.tools.includes(tool));
  }
}

export const voiceToolMapper = new VoiceToolMapper();
