/**
 * Multi-Voice Synthesis Use Case
 * Application Layer - Orchestrates multi-voice collaboration
 *
 * Handles: Coordinating multiple AI voices for complex problems
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

import {
  IVoiceOrchestrationService,
  SynthesisMode,
  VoiceSelectionPreferences,
} from '../../domain/services/voice-orchestration-service.js';
import { IModelSelectionService } from '../../domain/services/model-selection-service.js';
import { ProcessingRequest, RequestType } from '../../domain/entities/request.js';
import { RequestPriority } from '../../domain/value-objects/voice-values.js';
import { Voice } from '../../domain/entities/voice.js';

// Define VoiceResponse type for proper typing
export interface VoiceResponse {
  voiceId: string;
  content: string;
  confidence: number;
  expertiseMatch: number;
  processingTime: number;
}

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
  public constructor(
    private readonly voiceOrchestrationService: IVoiceOrchestrationService,
    private readonly modelSelectionService: IModelSelectionService
  ) {}

  public async execute(
    input: Readonly<MultiVoiceSynthesisInput>
  ): Promise<MultiVoiceSynthesisOutput> {
    const startTime = Date.now();

    // Input validation and transformation
    const request = this.transformToProcessingRequest(input);
    const preferences = this.transformToVoicePreferences(input);

    // Local types to ensure strong typing for service interactions
    interface VoiceSelectionResult {
      primaryVoice: Voice;
      supportingVoices: Voice[];
      synthesisMode: SynthesisMode;
      // other fields may exist but are not required here
    }

    interface Conflict {
      topic: string;
      voice1Id: string;
      voice2Id: string;
    }

    interface ConflictResolution {
      reasoning: string;
    }

    interface RequiredVoiceOrchestration {
      selectVoices: (
        request: Readonly<ProcessingRequest>,
        prefs: Readonly<VoiceSelectionPreferences>
      ) => Promise<VoiceSelectionResult>;
      synthesizeVoiceResponses: (
        voiceResponses: ReadonlyArray<VoiceResponse>,
        mode: SynthesisMode
      ) => {
        finalResponse: string;
        consensusLevel: number;
        synthesisMethod: string;
        confidenceScore: number;
      };
      detectVoiceConflicts: (voiceResponses: ReadonlyArray<VoiceResponse>) => Promise<Conflict[]>;
      resolveVoiceConflicts: (
        conflicts: ReadonlyArray<Conflict>,
        voices: ReadonlyArray<Voice>
      ) => Promise<ConflictResolution[]>;
    }

    interface ModelGenerator {
      generateResponse: (
        request: Readonly<ProcessingRequest>,
        voice: Readonly<Voice>
      ) => Promise<{
        content: string;
        confidence?: number;
        processingTime?: number;
      }>;
    }

    interface ModelSelectionServiceTyped {
      selectModel: (
        request: Readonly<ProcessingRequest>,
        voiceSelection: Readonly<VoiceSelectionResult>
      ) => Promise<ModelGenerator>;
    }

    // Cast domain service instances to the stricter local types
    const orchestration = this.voiceOrchestrationService as unknown as RequiredVoiceOrchestration;
    const modelSelector = this.modelSelectionService as unknown as ModelSelectionServiceTyped;

    // Select voices and model using domain services
    const voiceSelection = await orchestration.selectVoices(request, preferences);
    const selectedModel = await modelSelector.selectModel(request, voiceSelection);

    // Generate responses from all selected voices
    const allVoices = [voiceSelection.primaryVoice, ...voiceSelection.supportingVoices];
    const voiceResponses = await this.generateVoiceResponses(allVoices, request, selectedModel);

    // Domain orchestration - Synthesis
    const synthesisResult = orchestration.synthesizeVoiceResponses(
      voiceResponses,
      voiceSelection.synthesisMode
    );

    // Domain orchestration - Conflict Resolution
    const conflicts = await orchestration.detectVoiceConflicts(voiceResponses);
    const conflictResolutions = await orchestration.resolveVoiceConflicts(conflicts, allVoices);

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

  private transformToProcessingRequest(
    input: Readonly<MultiVoiceSynthesisInput>
  ): ProcessingRequest {
    // Import the correct enums for RequestType and RequestPriority
    // import { RequestType, RequestPriority } from '../../domain/entities/request.js';

    // (Removed unused resolveEnumByValue function)

    // Use the enum member directly for type safety
    const requestTypeValues = Object.values(RequestType) as RequestType[];
    const type: RequestType = requestTypeValues.includes('MULTI_VOICE_SYNTHESIS' as RequestType)
      ? ('MULTI_VOICE_SYNTHESIS' as RequestType)
      : requestTypeValues[0];

    const requestPriorityValues = Object.values(RequestPriority);
    const priority: RequestPriority = requestPriorityValues.includes(RequestPriority.medium())
      ? RequestPriority.medium()
      : requestPriorityValues[0];

    return new ProcessingRequest(
      `request-${Date.now()}`, // id
      input.prompt, // content
      type, // type
      priority, // priority
      input.context ?? {}, // context
      {
        mustIncludeVoices: input.requiredVoices,
        excludedVoices: input.excludedVoices,
      } // constraints
    );
  }

  private transformToVoicePreferences(
    input: Readonly<MultiVoiceSynthesisInput>
  ): VoiceSelectionPreferences {
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
    voices: ReadonlyArray<Voice>,
    request: Readonly<ProcessingRequest>,
    model: {
      generateResponse: (
        request: Readonly<ProcessingRequest>,
        voice: Readonly<Voice>
      ) => Promise<{
        content: string;
        confidence?: number;
        processingTime?: number;
      }>;
    }
  ): Promise<VoiceResponse[]> {
    const responses: VoiceResponse[] = [];

    for (const voice of voices) {
      try {
        const response = await model.generateResponse(request, voice);
        responses.push({
          voiceId: voice.id,
          content: response.content,
          confidence: response.confidence ?? 0.8,
          expertiseMatch: this.calculateExpertiseMatch(voice, request),
          processingTime: response.processingTime ?? 0,
        });
      } catch (error) {
        // Log error but continue with other voices
        console.warn(`Voice ${voice.id} failed to generate response:`, error);
      }
    }

    return responses;
  }

  private calculateExpertiseMatch(voice: Voice, request: Readonly<ProcessingRequest>): number {
    const requiredCapabilities = request.requiresCapabilities();
    const voiceExpertise = voice.expertise;

    const matches = requiredCapabilities.filter(capability =>
      voiceExpertise.some(expertise => expertise.toLowerCase().includes(capability.toLowerCase()))
    ).length;

    return requiredCapabilities.length > 0 ? matches / requiredCapabilities.length : 1.0;
  }

  private transformToOutput(
    synthesisResult: {
      finalResponse: string;
      consensusLevel: number;
      synthesisMethod: string;
      confidenceScore: number;
    },
    voiceResponses: ReadonlyArray<VoiceResponse>,
    voices: ReadonlyArray<Voice>,
    conflicts: ReadonlyArray<{ topic: string; voice1Id: string; voice2Id: string }>,
    conflictResolutions: ReadonlyArray<{ reasoning: string } | undefined>,
    startTime: number
  ): MultiVoiceSynthesisOutput {
    const voiceContributions: VoiceContribution[] = voiceResponses.map(
      (response: VoiceResponse) => {
        const voice = voices.find((v: Voice) => v.id === response.voiceId);
        return {
          voiceId: response.voiceId,
          voiceName: voice?.name ?? 'Unknown Voice',
          content: response.content,
          confidence: response.confidence,
          expertise: voice?.expertise ? [...voice.expertise] : [],
        };
      }
    );

    const conflictSummaries: ConflictSummary[] = conflicts.map((conflict, index) => {
      const resolution = conflictResolutions[index];
      return {
        topic: conflict.topic,
        conflictingVoices: [conflict.voice1Id, conflict.voice2Id],
        resolution: resolution?.reasoning ?? 'Unresolved',
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
