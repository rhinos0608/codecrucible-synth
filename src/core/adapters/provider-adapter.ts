/**
 * Provider Adapter - Bridges LLMProvider to IModelProvider interface
 * Implements enterprise adapter patterns based on research findings
 */

import {
  IModelProvider,
  ModelRequest,
  ModelResponse,
} from '../../domain/interfaces/model-client.js';
import { LLMProvider, LLMResponse } from '../../domain/interfaces/llm-interfaces.js';
import { logger } from '../logger.js';

/**
 * Adapter that converts LLMProvider interface to IModelProvider interface
 * Following enterprise integration patterns for legacy system bridging
 */
export class ProviderAdapter implements IModelProvider {
  public readonly type: string;
  public readonly endpoint: string;
  public readonly name: string; // Keep for compatibility

  constructor(
    private readonly llmProvider: LLMProvider,
    private readonly providerName: string
  ) {
    this.name = providerName;
    this.type = providerName;
    this.endpoint = llmProvider.endpoint;
  }

  /**
   * Check provider availability
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.llmProvider.isAvailable();
    } catch (error) {
      logger.debug(`Provider ${this.name} availability check failed:`, error);
      return false;
    }
  }

  /**
   * Generate text using the adapted provider
   */
  async generateText(prompt: string, options: any = {}): Promise<ModelResponse> {
    try {
      // Check if provider has generateText method
      if (
        'generateText' in this.llmProvider &&
        typeof this.llmProvider.generateText === 'function'
      ) {
        const llmResponse: LLMResponse = await this.llmProvider.generateText(prompt, options);
        return this.adaptLLMResponse(llmResponse);
      }

      // Fallback to generateCode if generateText not available
      if (
        'generateCode' in this.llmProvider &&
        typeof this.llmProvider.generateCode === 'function'
      ) {
        const llmResponse: LLMResponse = await this.llmProvider.generateCode(prompt, options);
        return this.adaptLLMResponse(llmResponse);
      }

      throw new Error(`Provider ${this.name} does not support text generation`);
    } catch (error) {
      logger.error(`Text generation failed for provider ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate code using the adapted provider
   */
  async generateCode(prompt: string, options: any = {}): Promise<ModelResponse> {
    try {
      // Check if provider has generateCode method
      if (
        'generateCode' in this.llmProvider &&
        typeof this.llmProvider.generateCode === 'function'
      ) {
        const llmResponse: LLMResponse = await this.llmProvider.generateCode(prompt, options);
        return this.adaptLLMResponse(llmResponse);
      }

      // Fallback to generateText if generateCode not available
      if (
        'generateText' in this.llmProvider &&
        typeof this.llmProvider.generateText === 'function'
      ) {
        const llmResponse: LLMResponse = await this.llmProvider.generateText(prompt, options);
        return this.adaptLLMResponse(llmResponse);
      }

      throw new Error(`Provider ${this.name} does not support code generation`);
    } catch (error) {
      logger.error(`Code generation failed for provider ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Process a generic request - implements IModelProvider interface
   */
  async request(request: ModelRequest): Promise<ModelResponse> {
    const options = {
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      stream: request.stream,
      tools: request.tools,
    };

    // Default to generateText
    return await this.generateText(request.prompt, options);
  }

  /**
   * Get supported models for this provider
   */
  async getSupportedModels(): Promise<
    import('../../domain/interfaces/model-client.js').ModelInfo[]
  > {
    // Return default model info - can be enhanced with actual model discovery
    return [
      {
        id: 'default',
        name: 'Default Model',
        provider: this.name,
        description: `Default model for ${this.name} provider`,
        contextLength: 4096,
        capabilities: [
          { type: 'completion', supported: true },
          { type: 'chat', supported: true },
          { type: 'code', supported: true },
        ],
      },
    ];
  }

  /**
   * Generate voice-specific response (for voice system integration)
   */
  async generateVoiceResponse(
    prompt: string,
    voiceId: string,
    options: any = {}
  ): Promise<ModelResponse> {
    // Add voice context to options
    const voiceOptions = {
      ...options,
      voiceId,
      context: `Voice: ${voiceId}`,
    };

    return await this.generateText(prompt, voiceOptions);
  }

  /**
   * Get provider status
   */
  async getStatus(): Promise<any> {
    try {
      if ('getStatus' in this.llmProvider && typeof this.llmProvider.getStatus === 'function') {
        return await this.llmProvider.getStatus();
      }

      // Return basic status if getStatus not available
      return {
        name: this.name,
        available: await this.isAvailable(),
        endpoint: this.endpoint,
      };
    } catch (error) {
      logger.error(`Failed to get status for provider ${this.name}:`, error);
      return {
        name: this.name,
        available: false,
        error: error.message,
      };
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): any {
    if (
      'getCapabilities' in this.llmProvider &&
      typeof this.llmProvider.getCapabilities === 'function'
    ) {
      return this.llmProvider.getCapabilities();
    }

    // Return default capabilities
    return {
      supportsCodeGeneration: true,
      supportsTextGeneration: true,
      supportsStreaming: false,
      maxConcurrentRequests: 5,
    };
  }

  /**
   * Convert LLMResponse to ModelResponse format
   */
  private adaptLLMResponse(llmResponse: LLMResponse): ModelResponse {
    return {
      id: `${this.name}-${Date.now()}`,
      content: llmResponse.content,
      model: llmResponse.model,
      provider: this.name,
      confidence: llmResponse.confidence,
      usage: {
        promptTokens: llmResponse.metadata?.promptTokens || 0,
        completionTokens: llmResponse.metadata?.completionTokens || 0,
        totalTokens: llmResponse.metadata?.tokens || 0,
      },
      metadata: {
        ...llmResponse.metadata,
        adaptedFrom: 'LLMProvider',
        originalProvider: llmResponse.provider,
        responseTime: llmResponse.responseTime,
      },
    };
  }

  /**
   * Health check for monitoring systems
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.isAvailable();
    } catch (error) {
      logger.debug(`Health check failed for provider ${this.name}:`, error);
      return false;
    }
  }
}
