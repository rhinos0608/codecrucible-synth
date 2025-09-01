/**
 * Multi-Voice Synthesis Use Case
 * Application Layer - Orchestrates multi-voice collaboration
 *
 * Handles: Coordinating multiple AI voices for complex problems
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

import {
  IVoiceOrchestrationService,
  VoiceSelectionPreferences,
  SynthesisMode,
} from '../../domain/services/voice-orchestration-service.js';
import { IModelSelectionService } from '../../domain/services/model-selection-service.js';
import { ProcessingRequest } from '../../domain/entities/request.js';
import { Voice } from '../../domain/entities/voice.js';

export interface MultiVoiceSynthesisInput {
  prompt: string;
  voiceCount?: number;
  synthesisMode?: 'competitive' | 'collaborative' | 'consensus' | 'weighted';
  requiredVoices?: string[];
  excludedVoices?: string[];
  context?: Record<string, unknown>;
}

export interface MultiVoiceSynthesisOutput {
  synthesizedResponse: string;
  voiceContributions: VoiceContribution[];
  consensus: {
    level: number;
    conflicts: ConflictSummary[];
  };
  metadata: {
    voicesUsed: number;
    synthesisMethod: string;
    processingTime: number;
    confidenceScore: number;
  };
}

export interface VoiceContribution {
  voiceId: string;
  voiceName: string;
  content: string;
  confidence: number;
  expertise: string[];
}

export interface ConflictSummary {
  topic: string;
  conflictingVoices: string[];
  resolution: string;
}

/**
 * Use Case: Synthesize responses from multiple AI voices
 * Handles complex problems requiring diverse perspectives
 */
export class MultiVoiceSynthesisUseCase {
  constructor(
    private voiceOrchestrationService: IVoiceOrchestrationService,
    private modelSelectionService: IModelSelectionService
  ) {}

  async execute(input: MultiVoiceSynthesisInput): Promise<MultiVoiceSynthesisOutput> {
    const startTime = Date.now();

    // Input validation and transformation
    const request = this.transformToProcessingRequest(input);
    const preferences = this.transformToVoicePreferences(input);

    // Domain orchestration - Voice Selection
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(
      request,
      preferences
    );

    // Domain orchestration - Model Selection
    const selectedModel = await this.modelSelectionService.selectOptimalModel(request);

    // Generate responses from all selected voices
    const allVoices = [voiceSelection.primaryVoice, ...voiceSelection.supportingVoices];
    const voiceResponses = await this.generateVoiceResponses(allVoices, request, selectedModel);

    // Domain orchestration - Synthesis
    const synthesisResult = await this.voiceOrchestrationService.synthesizeVoiceResponses(
      voiceResponses,
      voiceSelection.synthesisMode
    );

    // Domain orchestration - Conflict Resolution
    const conflicts = await this.voiceOrchestrationService.detectVoiceConflicts(voiceResponses);
    const conflictResolutions = await this.voiceOrchestrationService.resolveVoiceConflicts(
      conflicts,
      allVoices
    );

    // Output transformation
    return this.transformToOutput(
      synthesisResult,
      voiceResponses,
      allVoices,
      conflicts,
      conflictResolutions,
      startTime
    );
  }

  private transformToProcessingRequest(input: MultiVoiceSynthesisInput): ProcessingRequest {
    return new ProcessingRequest(
      `request-${Date.now()}`, // id
      input.prompt, // content
      'multi-voice-synthesis' as any, // type
      'medium' as any, // priority
      input.context || {}, // context
      {
        mustIncludeVoices: input.requiredVoices,
        excludedVoices: input.excludedVoices,
      } // constraints
    );
  }

  private transformToVoicePreferences(input: MultiVoiceSynthesisInput): VoiceSelectionPreferences {
    return {
      maxVoices: input.voiceCount || 3,
      minVoices: Math.max(2, Math.min(input.voiceCount || 2, 2)), // At least 2 for multi-voice
      synthesisMode:
        input.synthesisMode === 'competitive'
          ? SynthesisMode.COMPETITIVE
          : input.synthesisMode === 'consensus'
            ? SynthesisMode.CONSENSUS
            : input.synthesisMode === 'weighted'
              ? SynthesisMode.WEIGHTED
              : SynthesisMode.COLLABORATIVE,
      preferredVoices: input.requiredVoices,
      diversityWeight: 0.7,
    };
  }

  private async generateVoiceResponses(
    voices: Voice[],
    request: ProcessingRequest,
    model: any
  ): Promise<any[]> {
    const responses = [];

    for (const voice of voices) {
      try {
        const response = await model.generateResponse(request, voice);
        responses.push({
          voiceId: voice.id,
          content: response.content,
          confidence: response.confidence || 0.8,
          expertiseMatch: this.calculateExpertiseMatch(voice, request),
          processingTime: response.processingTime || 0,
        });
      } catch (error) {
        // Log error but continue with other voices
        console.warn(`Voice ${voice.id} failed to generate response:`, error);
      }
    }

    return responses;
  }

  private calculateExpertiseMatch(voice: Voice, request: ProcessingRequest): number {
    const requiredCapabilities = request.requiresCapabilities();
    const voiceExpertise = voice.expertise;

    const matches = requiredCapabilities.filter(capability =>
      voiceExpertise.some(expertise => expertise.toLowerCase().includes(capability.toLowerCase()))
    ).length;

    return requiredCapabilities.length > 0 ? matches / requiredCapabilities.length : 1.0;
  }

  private transformToOutput(
    synthesisResult: any,
    voiceResponses: any[],
    voices: Voice[],
    conflicts: any[],
    conflictResolutions: any[],
    startTime: number
  ): MultiVoiceSynthesisOutput {
    const voiceContributions: VoiceContribution[] = voiceResponses.map(response => {
      const voice = voices.find(v => v.id === response.voiceId);
      return {
        voiceId: response.voiceId,
        voiceName: voice?.name || 'Unknown Voice',
        content: response.content,
        confidence: response.confidence,
        expertise: voice?.expertise ? [...voice.expertise] : [],
      };
    });

    const conflictSummaries: ConflictSummary[] = conflicts.map((conflict, index) => {
      const resolution = conflictResolutions[index];
      return {
        topic: conflict.topic,
        conflictingVoices: [conflict.voice1Id, conflict.voice2Id],
        resolution: resolution?.reasoning || 'Unresolved',
      };
    });

    return {
      synthesizedResponse: synthesisResult.finalResponse,
      voiceContributions,
      consensus: {
        level: synthesisResult.consensusLevel,
        conflicts: conflictSummaries,
      },
      metadata: {
        voicesUsed: voices.length,
        synthesisMethod: synthesisResult.synthesisMethod,
        processingTime: Date.now() - startTime,
        confidenceScore: synthesisResult.confidenceScore,
      },
    };
  }
}
