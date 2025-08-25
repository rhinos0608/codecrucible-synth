/**
 * Voice Synthesis Manager - Extracted from UnifiedModelClient
 * Manages multi-voice AI responses and perspective synthesis following Living Spiral methodology
 *
 * Council Perspectives Applied:
 * - Explorer: Multi-voice creative collaboration and perspective diversity
 * - Maintainer: Clean voice coordination and reliable synthesis algorithms
 * - Architect: Structured voice orchestration patterns
 * - Security Guardian: Safe voice isolation and content validation
 * - Performance Engineer: Optimized parallel voice processing
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { getErrorMessage, toError } from '../../utils/error-utils.js';

export interface VoiceResponse {
  voiceId: string;
  content: string;
  confidence: number;
  processingTime: number;
  metadata?: any;
}

export interface MultiVoiceResult {
  responses: VoiceResponse[];
  metadata: {
    totalProcessingTime: number;
    parallelExecution: boolean;
    processedVoices: string[];
    skippedVoices?: string[];
  };
}

export interface VoiceSynthesisOptions {
  synthesisMode?: 'consensus' | 'debate' | 'hierarchical' | 'democratic' | 'council';
  parallel?: boolean;
  maxConcurrent?: number;
  timeout?: number;
}

export interface SynthesizedPerspective {
  content: string;
  perspectives: VoiceResponse[];
  agreements: string[];
  disagreements: any[];
  councilDecision?: any;
  synthesisMode: string;
  metadata: {
    processingTime: number;
    voiceCount: number;
    consensusLevel: number;
  };
}

export interface IVoiceSynthesisManager {
  generateVoiceResponse(prompt: string, voiceId: string, options?: any): Promise<VoiceResponse>;
  generateMultiVoiceResponses(
    voices: string[],
    prompt: string,
    options?: any
  ): Promise<MultiVoiceResult>;
  synthesizeVoicePerspectives(
    voices: string[],
    prompt: string,
    options?: VoiceSynthesisOptions
  ): Promise<SynthesizedPerspective>;
}

export class VoiceSynthesisManager extends EventEmitter implements IVoiceSynthesisManager {
  private voiceArchetypeSystem: any;
  private processingTimeout: number = 30000; // 2025 Best Practice: Quick response times, fail fast
  private processRequest?: (request: any) => Promise<any>;

  constructor(voiceArchetypeSystem?: any, processRequest?: (request: any) => Promise<any>) {
    super();
    this.voiceArchetypeSystem = voiceArchetypeSystem;
    this.processRequest = processRequest;
  }

  /**
   * Generate response from a single voice archetype
   */
  async generateVoiceResponse(
    prompt: string,
    voiceId: string,
    options?: any
  ): Promise<VoiceResponse> {
    const startTime = Date.now();

    try {
      logger.info(`🎭 Generating response from voice: ${voiceId}`);

      let response: any;

      if (this.voiceArchetypeSystem) {
        response = await this.voiceArchetypeSystem.generateResponse(voiceId, prompt, options);
      } else if (this.processRequest) {
        // Fallback: Use voice personalities and process request
        const voiceTemperature = options?.temperature || 0.7;
        let voicePrompt = prompt;

        if (options?.systemPrompt) {
          voicePrompt = `${options.systemPrompt}\n\n${prompt}`;
        } else {
          // Add voice personality prefix based on voiceId
          const voicePersonalities: Record<string, string> = {
            explorer:
              'As an innovative Explorer voice focused on creative solutions and new possibilities:\n',
            maintainer:
              'As a conservative Maintainer voice focused on stability and best practices:\n',
            security:
              'As a Security-focused voice prioritizing safety and vulnerability prevention:\n',
            architect: 'As an Architecture voice focused on system design and scalability:\n',
            developer: 'As a Developer voice focused on practical implementation:\n',
            analyzer: 'As an Analyzer voice focused on data-driven insights:\n',
            optimizer: 'As an Optimizer voice focused on performance and efficiency:\n',
            designer: 'As a Designer voice focused on user experience:\n',
            implementor: 'As an Implementor voice focused on execution:\n',
            guardian: 'As a Guardian voice ensuring quality and standards:\n',
          };

          const personality = voicePersonalities[voiceId.toLowerCase()] || '';
          voicePrompt = personality + prompt;
        }

        response = await this.processRequest({
          prompt: voicePrompt,
          temperature: voiceTemperature,
          ...options,
        });
      } else {
        throw new Error('Neither voice archetype system nor process request function available');
      }

      const processingTime = Date.now() - startTime;

      const voiceResponse: VoiceResponse = {
        voiceId,
        content: response.content || response.response || response,
        confidence: response.confidence || 0.8,
        processingTime,
        metadata: {
          ...response.metadata,
          timestamp: new Date().toISOString(),
        },
      };

      logger.debug(`✅ Voice ${voiceId} completed in ${processingTime}ms`);
      return voiceResponse;
    } catch (error: unknown) {
      const processingTime = Date.now() - startTime;
      const errorMessage = getErrorMessage(error);

      logger.error(`❌ Voice ${voiceId} failed: ${errorMessage}`);

      // Return error response instead of throwing
      return {
        voiceId,
        content: `Error generating response from ${voiceId}: ${errorMessage}`,
        confidence: 0,
        processingTime,
        metadata: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Generate responses from multiple voices with timeout protection
   */
  async generateMultiVoiceResponses(
    voices: string[],
    prompt: string,
    options?: any
  ): Promise<MultiVoiceResult> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.processingTimeout;

    try {
      logger.info(
        `🎭 Generating multi-voice responses from ${voices.length} voices (timeout: ${timeout}ms)`
      );

      const responses: VoiceResponse[] = [];
      const processedVoices: string[] = [];
      const skippedVoices: string[] = [];

      const parallel = options?.parallel !== false;
      const maxConcurrent = options?.maxConcurrent || 5;

      // 2025 Best Practice: Circuit breaker pattern with fail-fast approach
      const processVoices = async () => {
        if (parallel && voices.length <= maxConcurrent) {
          // Process voices with circuit breaker pattern
          const promises = voices.map(async voiceId =>
            Promise.race([
              this.generateVoiceResponse(prompt, voiceId, { ...options, timeout: 15000 }), // Reduced timeout
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Voice ${voiceId} circuit breaker`)), 15000)
              ),
            ])
          );

          return await Promise.allSettled(promises);
        } else {
          // Sequential processing with timeout per voice
          const results: any[] = [];
          for (const voiceId of voices) {
            try {
              const result = await Promise.race([
                this.generateVoiceResponse(prompt, voiceId, options),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error(`Voice ${voiceId} timeout`)),
                    timeout / voices.length
                  )
                ),
              ]);
              results.push({ status: 'fulfilled', value: result });
            } catch (error) {
              results.push({ status: 'rejected', reason: error });
            }
          }
          return results;
        }
      };

      // Add global timeout protection for entire council process
      const results = (await Promise.race([
        processVoices(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Council timeout after ${timeout}ms`)), timeout)
        ),
      ])) as any[];

      results.forEach((result, index) => {
        const voiceId = voices[index];
        if (result.status === 'fulfilled') {
          responses.push(result.value);
          processedVoices.push(voiceId);
        } else {
          logger.warn(`Voice ${voiceId} failed: ${result.reason}`);
          skippedVoices.push(voiceId);
        }
      });

      const endTime = Date.now();

      return {
        responses,
        metadata: {
          totalProcessingTime: endTime - startTime,
          parallelExecution: parallel,
          processedVoices,
          skippedVoices: skippedVoices.length > 0 ? skippedVoices : undefined,
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to generate multi-voice responses:', getErrorMessage(error));
      throw toError(error);
    }
  }

  /**
   * Voice System API: Synthesize multiple voice perspectives into unified response
   */
  async synthesizeVoicePerspectives(
    voices: string[],
    prompt: string,
    options?: VoiceSynthesisOptions
  ): Promise<SynthesizedPerspective> {
    const startTime = Date.now();

    try {
      logger.info(`🎭 Synthesizing perspectives from ${voices.length} voices`);

      // First, get all voice responses
      const multiVoiceResult = await this.generateMultiVoiceResponses(voices, prompt, {
        ...options,
        parallel: true,
      });

      const voicePerspectives = multiVoiceResult.responses;

      // Analyze perspectives for agreements and disagreements
      const agreements: string[] = [];
      const disagreements: any[] = [];

      // Simple consensus analysis (can be enhanced with NLP)
      const commonTerms = new Map<string, number>();
      const perspectives = new Map<string, Set<string>>();

      // Extract key points from each voice
      voicePerspectives.forEach((vp: VoiceResponse) => {
        const keyPoints = this.extractKeyPoints(vp.content);
        perspectives.set(vp.voiceId, new Set(keyPoints));

        // Count common terms
        keyPoints.forEach(point => {
          commonTerms.set(point, (commonTerms.get(point) || 0) + 1);
        });
      });

      // Find agreements (mentioned by majority of voices)
      const majorityThreshold = Math.ceil(voices.length / 2);
      commonTerms.forEach((count, term) => {
        if (count >= majorityThreshold) {
          agreements.push(term);
        }
      });

      // Create synthesized content based on mode
      const synthesisMode = options?.synthesisMode || 'consensus';
      let synthesizedContent = '';
      let councilDecision = null;

      switch (synthesisMode) {
        case 'consensus':
          synthesizedContent = this.synthesizeConsensus(voicePerspectives, agreements);
          break;

        case 'debate':
          synthesizedContent = this.synthesizeDebate(voicePerspectives, agreements, disagreements);
          break;

        case 'hierarchical':
          synthesizedContent = this.synthesizeHierarchical(voicePerspectives, voices);
          break;

        case 'democratic':
          synthesizedContent = this.synthesizeDemocratic(voicePerspectives);
          break;

        case 'council': {
          const councilResult = this.synthesizeCouncil(voicePerspectives, prompt);
          synthesizedContent = councilResult.content;
          councilDecision = councilResult.decision;
          break;
        }

        default:
          synthesizedContent = this.synthesizeConsensus(voicePerspectives, agreements);
      }

      const endTime = Date.now();
      const consensusLevel = agreements.length / Math.max(commonTerms.size, 1);

      const result: SynthesizedPerspective = {
        content: synthesizedContent,
        perspectives: voicePerspectives,
        agreements,
        disagreements,
        councilDecision,
        synthesisMode,
        metadata: {
          processingTime: endTime - startTime,
          voiceCount: voicePerspectives.length,
          consensusLevel,
        },
      };

      this.emit('perspectivesSynthesized', result);

      logger.info(
        `✅ Synthesized ${voices.length} perspectives in ${result.metadata.processingTime}ms`
      );
      return result;
    } catch (error: unknown) {
      logger.error('Failed to synthesize voice perspectives:', getErrorMessage(error));
      throw toError(error);
    }
  }

  /**
   * Extract key points from text using simple heuristics
   */
  private extractKeyPoints(text: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP libraries
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

    // Extract key phrases (simplified approach)
    const keyPoints: string[] = [];

    sentences.forEach(sentence => {
      const words = sentence.toLowerCase().split(/\s+/);
      const keywordPatterns = [
        /^(should|must|need|require|recommend)/,
        /^(consider|suggest|propose)/,
        /^(important|critical|essential|crucial)/,
      ];

      if (keywordPatterns.some(pattern => words.some(word => pattern.test(word)))) {
        keyPoints.push(sentence.trim());
      }
    });

    return keyPoints.slice(0, 5); // Limit to top 5 key points
  }

  /**
   * Synthesize consensus from voice perspectives
   */
  private synthesizeConsensus(perspectives: VoiceResponse[], agreements: string[]): string {
    const consensusPoints =
      agreements.length > 0 ? agreements.slice(0, 3).join(' ') : 'Multiple perspectives analyzed';

    const topPerspectives = perspectives
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2)
      .map(p => p.content.substring(0, 200))
      .join('\n\n');

    return `## Consensus Analysis\n\n**Key Agreements:**\n${consensusPoints}\n\n**Primary Perspectives:**\n\n${topPerspectives}`;
  }

  /**
   * Synthesize debate format from perspectives
   */
  private synthesizeDebate(
    perspectives: VoiceResponse[],
    agreements: string[],
    disagreements: any[]
  ): string {
    const sections = [
      '## Debate Synthesis\n',
      `**Common Ground:** ${agreements.slice(0, 2).join(', ') || 'Various viewpoints presented'}\n`,
      '**Different Perspectives:**\n',
    ];

    perspectives.forEach((p, index) => {
      sections.push(`**Voice ${index + 1} (${p.voiceId}):** ${p.content.substring(0, 150)}...\n`);
    });

    return sections.join('\n');
  }

  /**
   * Synthesize hierarchical format based on voice authority
   */
  private synthesizeHierarchical(perspectives: VoiceResponse[], voices: string[]): string {
    // Sort by confidence and known hierarchy
    const sorted = perspectives.sort((a, b) => {
      // Architect and Maintainer have higher authority for technical decisions
      const authorityOrder = ['architect', 'maintainer', 'security', 'performance'];
      const aAuth = authorityOrder.indexOf(a.voiceId.toLowerCase());
      const bAuth = authorityOrder.indexOf(b.voiceId.toLowerCase());

      if (aAuth !== -1 && bAuth !== -1) return aAuth - bAuth;
      if (aAuth !== -1) return -1;
      if (bAuth !== -1) return 1;

      return b.confidence - a.confidence;
    });

    let result = '## Hierarchical Synthesis\n\n';
    sorted.forEach((p, index) => {
      result += `### ${index + 1}. ${p.voiceId.toUpperCase()}\n${p.content.substring(0, 200)}\n\n`;
    });

    return result;
  }

  /**
   * Synthesize democratic format with equal voice weight
   */
  private synthesizeDemocratic(perspectives: VoiceResponse[]): string {
    let result = '## Democratic Synthesis\n\n';
    result += '**All voices heard equally:**\n\n';

    perspectives.forEach((p, index) => {
      result += `**${p.voiceId}:** ${p.content.substring(0, 180)}...\n\n`;
    });

    return result;
  }

  /**
   * Synthesize council format with structured decision-making
   */
  private synthesizeCouncil(perspectives: VoiceResponse[], prompt: string): any {
    const councilMembers = perspectives.map(p => ({
      voice: p.voiceId,
      position: p.content.substring(0, 100),
      confidence: p.confidence,
    }));

    // Simple council decision logic
    const highConfidenceVoices = perspectives.filter(p => p.confidence > 0.7);
    const decision =
      highConfidenceVoices.length > perspectives.length / 2 ? 'APPROVED' : 'NEEDS_REVIEW';

    const content = [
      '## Council Decision\n',
      `**Motion:** ${prompt.substring(0, 100)}...\n`,
      `**Decision:** ${decision}\n`,
      '**Council Members:**\n',
      ...councilMembers.map(
        m => `- ${m.voice}: ${m.position}... (${Math.round(m.confidence * 100)}% confidence)`
      ),
    ].join('\n');

    return {
      content,
      decision: {
        outcome: decision,
        members: councilMembers,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Graceful shutdown of voice synthesis manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down voice synthesis manager...');
    
    // Clear any references
    this.voiceArchetypeSystem = null;
    this.processRequest = undefined;
    
    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();
    
    logger.info('Voice synthesis manager shutdown completed');
  }

  /**
   * Emergency cleanup of all resources
   */
  async destroy(): Promise<void> {
    logger.warn('Emergency cleanup of voice synthesis manager...');
    
    // Force clear all references
    this.voiceArchetypeSystem = null;
    this.processRequest = undefined;
    
    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();
    
    logger.info('Voice synthesis manager destroyed');
  }
}
