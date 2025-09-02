/**
 * MCP Voice Coordinator
 *
 * High level orchestrator that connects the Voice Archetype System with MCP
 * tools. It relies on auxiliary modules to keep the codebase modular:
 * - {@link VoiceToolMapper} maps voice capabilities to MCP tools
 * - {@link ContextTranslator} converts context between systems
 * - {@link ResponseSynthesizer} merges voice output with MCP results
 * - {@link IntegrationMonitor} provides basic health metrics
 *
 * The coordinator exposes a minimal API for issuing voice driven MCP requests
 * and retrieving synthesized responses.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';
import { voiceToolMapper, VoiceToolMapper } from './voice-tool-mapper.js';
import { contextTranslator, ContextTranslator } from './context-translator.js';
import { responseSynthesizer, ResponseSynthesizer } from './response-synthesizer.js';
import { integrationMonitor, IntegrationMonitor } from './integration-monitor.js';
import { intelligentMCPLoadBalancer } from './intelligent-mcp-load-balancer.js';

export interface MCPVoiceRequest {
  requestId: string;
  voiceId: string;
  capability: string;
  context: any;
  parameters?: any;
}

export interface MCPVoiceResult {
  requestId: string;
  voiceId: string;
  content: string;
  mcpResults: any[];
}

export class MCPVoiceCoordinator extends EventEmitter {
  private readonly logger = createLogger('MCPVoiceCoordinator');

  constructor(
    private readonly tools: VoiceToolMapper = voiceToolMapper,
    private readonly translator: ContextTranslator = contextTranslator,
    private readonly synthesizer: ResponseSynthesizer = responseSynthesizer,
    private readonly monitor: IntegrationMonitor = integrationMonitor
  ) {
    super();
  }

  /** Register a mapping between a voice capability and MCP tools. */
  registerVoiceTools(mapping: { voiceId: string; capability: string; tools: string[] }): void {
    this.tools.registerMapping(mapping);
  }

  /** Execute an MCP request initiated by a voice. */
  async handleRequest(request: MCPVoiceRequest): Promise<MCPVoiceResult> {
    this.logger.info('Processing MCP-Voice request', {
      requestId: request.requestId,
      voiceId: request.voiceId,
      capability: request.capability,
    });

    try {
      // Determine which tools can satisfy the capability
      const tools = this.tools.getToolsForVoice(request.voiceId, request.capability);
      this.logger.debug('Resolved tools', { tools });

      // Translate voice context to MCP friendly structure
      const mcpContext = this.translator.toMCPContext(request.context);

      // Placeholder: choose server via discovery/load balancer
      let decision = null;
      try {
        decision = await intelligentMCPLoadBalancer.getConnection('default', [request.capability]);
      } catch (err) {
        this.logger.warn('Load balancer unavailable, using default server', { err });
      }
      this.logger.debug('Selected connection', { decision });

      // Placeholder: security and reliability checks
      const safeContext = mcpContext; // TODO integrate security and reliability systems

      // Placeholder: execute tools (not yet implemented)
      const mcpResults = tools.map(tool => ({
        tool,
        result: `[simulated] ${tool} executed`,
      }));

      // Translate results back for the voice system
      const voiceContext = this.translator.toVoiceContext(safeContext);
      const synthesized = this.synthesizer.synthesize(voiceContext, mcpResults);

      this.monitor.recordSuccess();
      this.emit('request-completed', synthesized);
      return synthesized;
    } catch (error) {
      this.monitor.recordFailure(error as Error);
      this.emit('request-failed', error);
      throw error;
    }
  }

  /** Expose simple health metrics from the bridge. */
  getHealth() {
    return this.monitor.getHealth();
  }
}

export const mcpVoiceCoordinator = new MCPVoiceCoordinator();
