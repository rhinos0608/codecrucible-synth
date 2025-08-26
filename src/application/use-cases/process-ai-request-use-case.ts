/**
 * Process AI Request Use Case
 * Application Layer - Clean orchestration of domain operations
 * 
 * Handles: Single AI request processing with proper input/output transformation
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

import { ModelSelectionService } from '../../domain/services/model-selection-service.js';
import { VoiceOrchestrationService } from '../../domain/services/voice-orchestration-service.js';
import { ProcessingRequest } from '../../domain/entities/request.js';
import { Model } from '../../domain/entities/model.js';

export interface AIRequestInput {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  voice?: string;
  context?: Record<string, unknown>;
}

export interface AIRequestOutput {
  content: string;
  model: string;
  voice: string;
  metadata: {
    tokensUsed: number;
    processingTime: number;
    confidence: number;
  };
}

/**
 * Use Case: Process a single AI request
 * Coordinates model selection and response generation
 */
export class ProcessAIRequestUseCase {
  constructor(
    private modelSelectionService: ModelSelectionService,
    private voiceOrchestrationService: VoiceOrchestrationService
  ) {}

  async execute(input: AIRequestInput): Promise<AIRequestOutput> {
    // Input validation and transformation
    const request = this.transformToProcessingRequest(input);
    
    // Domain orchestration
    const selectedModel = await this.modelSelectionService.selectOptimalModel(request);
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request);
    
    // Use primary voice for single request
    const primaryVoice = voiceSelection.primaryVoice;
    
    // Generate response through model (domain operation)
    const response = await selectedModel.generateResponse(request, primaryVoice);
    
    // Output transformation
    return this.transformToOutput(response, selectedModel, primaryVoice);
  }

  private transformToProcessingRequest(input: AIRequestInput): ProcessingRequest {
    // Create a simple processing request (simplified for now)
    return {
      prompt: input.prompt,
      type: 'general-query',
      constraints: {
        preferredModel: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        mustIncludeVoices: input.voice ? [input.voice] : undefined,
      },
      context: input.context || {},
    } as any;
  }

  private transformToOutput(
    response: any,
    model: Model,
    voice: any
  ): AIRequestOutput {
    return {
      content: response.content,
      model: model.id,
      voice: voice.id,
      metadata: {
        tokensUsed: response.tokensUsed || 0,
        processingTime: response.processingTime || 0,
        confidence: response.confidence || 0.8,
      },
    };
  }
}