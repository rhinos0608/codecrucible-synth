/**
 * Simple Council Coordinator
 * Application Layer - Simplified voice coordination service
 *
 * Replaces the overly complex CouncilDecisionEngine with clean orchestration
 * Handles: Multi-voice coordination without unnecessary abstraction layers
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

import {
  IVoiceOrchestrationService,
  VoiceResponse,
} from '../../domain/services/voice-orchestration-service.js';
import { IModelSelectionService } from '../../domain/services/model-selection-service.js';
import { ProcessingRequest } from '../../domain/entities/request.js';

export interface CouncilRequest {
  prompt: string;
  voiceIds: string[];
  synthesisMode: 'collaborative' | 'competitive' | 'consensus' | 'weighted';
  maxRounds?: number;
  context?: Record<string, unknown>;
}

export interface CouncilResponse {
  finalDecision: string;
  voiceContributions: VoiceContribution[];
  consensusLevel: number;
  synthesisMethod: string;
  processingTime: number;
}

export interface VoiceContribution {
  voiceId: string;
  content: string;
  confidence: number;
  round: number;
}

/**
 * Simplified Council Coordinator
 * Clean orchestration without unnecessary complexity
 */
export class SimpleCouncilCoordinator {
  constructor(
    private voiceOrchestrationService: IVoiceOrchestrationService,
    private modelSelectionService: IModelSelectionService
  ) {}

  /**
   * Coordinate multiple voices for a decision
   * Clean single responsibility implementation
   */
  async coordinateCouncil(request: CouncilRequest): Promise<CouncilResponse> {
    const startTime = Date.now();

    // Input transformation
    const processingRequest = this.transformToProcessingRequest(request);

    // Domain orchestration
    const selectedModel = await Promise.resolve(
      this.modelSelectionService.selectOptimalModel(processingRequest)
    );

    // Generate responses from all voices
    const voiceResponses = await this.generateVoiceResponses(
      request.voiceIds,
      processingRequest,
      selectedModel
    );

    // Synthesize responses using domain service
    const synthesisResult = await Promise.resolve(
      this.voiceOrchestrationService.synthesizeVoiceResponses(
      voiceResponses,
      this.mapSynthesisMode(request.synthesisMode)
    )
    );

    // Output transformation
    return this.transformToCouncilResponse(synthesisResult, voiceResponses, startTime);
  }

  /**
   * Get voice recommendations without synthesis
   * For cases where individual perspectives are needed
   */
  async getVoiceRecommendations(request: CouncilRequest): Promise<VoiceContribution[]> {
    const processingRequest = this.transformToProcessingRequest(request);
    const selectedModel = await Promise.resolve(
      this.modelSelectionService.selectOptimalModel(processingRequest)
    );

    const voiceResponses = await this.generateVoiceResponses(
      request.voiceIds,
      processingRequest,
      selectedModel
    );

    return voiceResponses.map(response => ({
      voiceId: response.voiceId,
      content: response.content,
      confidence: response.confidence,
      round: 1,
    }));
  }

  private transformToProcessingRequest(request: CouncilRequest): ProcessingRequest {
    return ProcessingRequest.create(
      request.prompt,
      'council-decision' as any,
      'medium',
      request.context || {},
      {
        mustIncludeVoices: request.voiceIds,
      }
    );
  }

  private async generateVoiceResponses(
    voiceIds: string[],
    request: ProcessingRequest,
    model: any
  ): Promise<VoiceResponse[]> {
    const responses: VoiceResponse[] = [];

    for (const voiceId of voiceIds) {
      try {
        const voiceRequest = ProcessingRequest.create(
          request.prompt,
          request.type as any,
          'medium',
          request.context,
          {
            ...request.constraints,
            mustIncludeVoices: [voiceId],
          }
        );

        const response = await Promise.resolve(
          model.generateResponse(voiceRequest, { id: voiceId })
        );

        responses.push({
          voiceId,
          content: response.content,
          confidence: response.confidence || 0.8,
          expertiseMatch: 1.0, // Simplified - could calculate based on voice/request match
          processingTime: response.processingTime || 0,
        });
      } catch (error) {
        console.warn(`Voice ${voiceId} failed to generate response:`, error);

        // Add fallback response to avoid breaking the council
        responses.push({
          voiceId,
          content: `Voice ${voiceId} is currently unavailable.`,
          confidence: 0.1,
          expertiseMatch: 0.1,
          processingTime: 0,
        });
      }
    }

    return responses;
  }

  private mapSynthesisMode(mode: string): any {
    const modeMap: Record<string, string> = {
      collaborative: 'COLLABORATIVE',
      competitive: 'COMPETITIVE',
      consensus: 'CONSENSUS',
      weighted: 'WEIGHTED',
    };

    return modeMap[mode] || 'COLLABORATIVE';
  }

  private transformToCouncilResponse(
    synthesisResult: any,
    voiceResponses: VoiceResponse[],
    startTime: number
  ): CouncilResponse {
    const voiceContributions: VoiceContribution[] = voiceResponses.map(response => ({
      voiceId: response.voiceId,
      content: response.content,
      confidence: response.confidence,
      round: 1,
    }));

    return {
      finalDecision: synthesisResult.finalResponse,
      voiceContributions,
      consensusLevel: synthesisResult.consensusLevel,
      synthesisMethod: synthesisResult.synthesisMethod,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Check if voices have conflicts in their recommendations
   * Simplified conflict detection
   */
  async detectConflicts(voiceResponses: VoiceResponse[]): Promise<boolean> {
    if (voiceResponses.length < 2) {
      return false;
    }

    const conflicts = await Promise.resolve(
      this.voiceOrchestrationService.detectVoiceConflicts(voiceResponses)
    );
    return conflicts.length > 0;
  }

  /**
   * Get consensus level between voices
   * Simple consensus calculation
   */
  calculateConsensus(voiceResponses: VoiceResponse[]): number {
    if (voiceResponses.length <= 1) {
      return 1.0;
    }

    // Calculate average confidence as a simple consensus metric
    const avgConfidence =
      voiceResponses.reduce((sum, response) => sum + response.confidence, 0) /
      voiceResponses.length;

    // Adjust for number of voices (more voices = potentially less consensus)
    const voiceCountFactor = Math.min(1.0, 2.0 / voiceResponses.length);

    return avgConfidence * voiceCountFactor;
  }
}
