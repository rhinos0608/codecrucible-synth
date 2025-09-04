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
import { UnifiedModelClient } from '../services/model-client.js';

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
    private voiceOrchestrationService: VoiceOrchestrationService,
    private modelClient: UnifiedModelClient
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
    const startTime = Date.now();
    let response;

    try {
      if (selectedModel.generateResponse) {
        response = await selectedModel.generateResponse(request.prompt);
      } else {
        // Generate response using UnifiedModelClient
        const modelRequest = {
          prompt: request.prompt,
          model: selectedModel.primaryModel.name.toString(),
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        };

        const modelResponse = await this.modelClient.request(modelRequest);
        const processingTime = Date.now() - startTime;

        response = {
          content: modelResponse.content,
          model: selectedModel.primaryModel.name,
          timestamp: new Date(),
          tokensUsed: modelResponse.usage?.totalTokens || 0,
          processingTime,
          confidence: 0.9, // High confidence for successful model responses
        };
      }
    } catch (error) {
      // Fallback for model errors
      const processingTime = Date.now() - startTime;
      response = {
        content: `Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        model: selectedModel.primaryModel.name,
        timestamp: new Date(),
        tokensUsed: 0,
        processingTime,
        confidence: 0.1, // Low confidence for error responses
        error: true,
      };
    }

    // Output transformation
    return this.transformToOutput(response, selectedModel.primaryModel, primaryVoice);
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

  private transformToOutput(response: any, model: Model, voice: any): AIRequestOutput {
    return {
      content: response.content,
      model: model.name as unknown as string,
      voice: voice.id,
      metadata: {
        tokensUsed: response.tokensUsed || 0,
        processingTime: response.processingTime || 0,
        confidence: response.confidence || 0.8,
      },
    };
  }
}
