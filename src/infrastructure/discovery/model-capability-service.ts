/**
 * Model Capability Service
 *
 * Dynamically detects model capabilities using HuggingFace API and local provider queries.
 * Replaces hardcoded capability assumptions with real-time capability detection.
 */

import { InferenceClient } from '@huggingface/inference';
import { logger } from '../logging/unified-logger.js';

export interface ModelCapabilities {
  functionCalling: boolean;
  toolUse: boolean;
  jsonMode: boolean;
  streaming: boolean;
  codeGeneration: boolean;
  chatCompletion: boolean;
  instruct: boolean;
  reasoning: boolean;
  multimodal: boolean;
  lastChecked: Date;
  confidence: number; // 0-1 confidence in capability detection
  source: 'huggingface' | 'local_test' | 'inference' | 'fallback';
}

export interface ModelInfo {
  name: string;
  provider: 'ollama' | 'lm-studio' | 'huggingface' | 'openai' | 'anthropic';
  capabilities?: ModelCapabilities;
  size?: string;
  family?: string;
  isAvailable: boolean;
}

/**
 * Service for dynamically detecting model capabilities
 */
export class ModelCapabilityService {
  private hf: InferenceClient | null = null;
  private capabilityCache: Map<string, ModelCapabilities> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Known function calling models (as fallback knowledge)
  private readonly KNOWN_FUNCTION_CALLING_MODELS = [
    'llama3.1',
    'llama3.2',
    'mistral-',
    'mixtral-',
    'qwen2.5',
    'deepseek',
    'codellama',
    'phi-3',
    'gemma-2',
  ];

  public constructor() {
    // Initialize HuggingFace client if API key is available
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (apiKey && apiKey !== 'your_huggingface_api_key_here') {
      this.hf = new InferenceClient(apiKey);
      logger.info('HuggingFace API initialized for capability detection');
    } else {
      logger.debug('HuggingFace API key not found, using fallback capability detection');
    }
  }

  /**
   * Get or detect capabilities for a model
   */
  public async getModelCapabilities(
    modelName: string,
    provider: string = 'unknown'
  ): Promise<ModelCapabilities> {
    // Check cache first
    const cacheKey = `${provider}:${modelName}`;
    const cached = this.capabilityCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      logger.debug(`Using cached capabilities for ${modelName}`, {
        capabilities: cached,
        cacheAge: Date.now() - cached.lastChecked.getTime(),
      });
      return cached;
    }

    logger.info(`Detecting capabilities for model: ${modelName} (${provider})`);

    let capabilities: ModelCapabilities;

    try {
      // Try dynamic detection methods in order of preference
      if (this.hf && provider === 'huggingface') {
        capabilities = await this.detectHuggingFaceCapabilities(modelName);
      } else if (provider === 'ollama') {
        capabilities = await this.detectOllamaCapabilities(modelName);
      } else if (provider === 'lm-studio') {
        capabilities = await this.detectLMStudioCapabilities(modelName);
      } else {
        capabilities = this.inferCapabilitiesFromName(modelName);
      }

      // Cache the results
      this.capabilityCache.set(cacheKey, capabilities);

      logger.info(`Capabilities detected for ${modelName}:`, {
        functionCalling: capabilities.functionCalling,
        toolUse: capabilities.toolUse,
        confidence: capabilities.confidence,
        source: capabilities.source,
      });

      return capabilities;
    } catch (error) {
      // Use debug instead of warn since falling back to inference is expected behavior
      logger.debug(
        `Capability detection failed for ${modelName}, using inference fallback:`,
        { error }
      );
      capabilities = this.inferCapabilitiesFromName(modelName);
      this.capabilityCache.set(cacheKey, capabilities);
      return capabilities;
    }
  }

  /**
   * Detect capabilities using HuggingFace API
   */
  private async detectHuggingFaceCapabilities(modelName: string): Promise<ModelCapabilities> {
    if (!this.hf) {
      throw new Error('HuggingFace API not initialized');
    }

    try {
      // Get model info from HuggingFace using fetch directly
      const response = await fetch(`https://huggingface.co/api/models/${modelName}`, {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HuggingFace API returned ${response.status}`);
      }

      interface HuggingFaceModelInfo {
        tags?: string[];
        pipeline_tag?: string;
        config?: Record<string, unknown>;
        [key: string]: unknown;
      }
      const modelInfoRaw: unknown = await response.json();
      if (
        typeof modelInfoRaw === 'object' &&
        modelInfoRaw !== null &&
        ('tags' in modelInfoRaw || 'pipeline_tag' in modelInfoRaw || 'config' in modelInfoRaw)
      ) {
        const modelInfo = modelInfoRaw as HuggingFaceModelInfo;
        const tags: string[] = Array.isArray(modelInfo.tags) ? modelInfo.tags : [];
        const pipeline: string = typeof modelInfo.pipeline_tag === 'string' ? modelInfo.pipeline_tag : '';
        const config: Record<string, unknown> = (modelInfo.config && typeof modelInfo.config === 'object') ? modelInfo.config : {};

        // Analyze model configuration and tags for function calling capability
        const functionCalling = this.analyzeForFunctionCalling(tags, config, modelName);

        const capabilities: ModelCapabilities = {
          functionCalling,
          toolUse: functionCalling, // Tool use is similar to function calling
          jsonMode: this.hasJSONMode(tags, config),
          streaming: true, // Most HF models support streaming via API
          codeGeneration: this.hasCodeGeneration(tags, pipeline),
          chatCompletion: pipeline === 'text-generation' || pipeline === 'conversational',
          instruct: tags.includes('instruction-tuned') || modelName.includes('instruct'),
          reasoning: this.hasReasoning(tags, modelName),
          multimodal: this.hasMultimodal(tags, pipeline),
          lastChecked: new Date(),
          confidence: 0.8, // High confidence from HF API
          source: 'huggingface',
        };

        return capabilities;
      } else {
        throw new Error('Unexpected HuggingFace API response structure');
      }
    } catch (error) {
      logger.debug(`HuggingFace API failed for ${modelName}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Detect capabilities for Ollama models by querying the local API
   */
  private async detectOllamaCapabilities(modelName: string): Promise<ModelCapabilities> {
    try {
      // Query Ollama API for model info
      const response = await fetch('http://localhost:11434/api/show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }

      // Define the expected Ollama model info structure
      interface OllamaModelInfo {
        template?: unknown;
        system?: unknown;
        [key: string]: unknown;
      }

      const modelInfoRaw: unknown = await response.json();
      const modelInfo: OllamaModelInfo = (typeof modelInfoRaw === 'object' && modelInfoRaw !== null)
        ? modelInfoRaw as OllamaModelInfo
        : {};

      const template: string = typeof modelInfo.template === 'string' ? modelInfo.template : '';
      const system: string = typeof modelInfo.system === 'string' ? modelInfo.system : '';

      // Analyze template and system prompt for function calling patterns
      const functionCalling = this.analyzeOllamaForFunctionCalling(template, system, modelName);

      const capabilities: ModelCapabilities = {
        functionCalling,
        toolUse: functionCalling,
        jsonMode: this.hasJSONModeFromTemplate(template),
        streaming: true, // Ollama supports streaming
        codeGeneration: this.hasCodeGenerationFromName(modelName),
        chatCompletion: true, // Ollama models are generally chat-capable
        instruct: template.includes('{{.Input}}') || modelName.includes('instruct'),
        reasoning: this.hasReasoningFromName(modelName),
        multimodal: false, // Most local Ollama models are text-only
        lastChecked: new Date(),
        confidence: 0.7, // Good confidence from local API
        source: 'local_test',
      };

      return capabilities;
    } catch (error) {
      logger.debug(`Ollama API query failed for ${modelName}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Detect capabilities for LM Studio models
   */
  private async detectLMStudioCapabilities(modelName: string): Promise<ModelCapabilities> {
    try {
      // Query LM Studio API for available models
      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`LM Studio API returned ${response.status}`);
      }

      interface LMStudioModel {
        id: string;
        // Add other properties as needed
        [key: string]: unknown;
      }

      interface LMStudioModelsResponse {
        data?: LMStudioModel[];
        [key: string]: unknown;
      }

      const dataRaw: unknown = await response.json();
      const data: LMStudioModelsResponse = typeof dataRaw === 'object' && dataRaw !== null ? dataRaw as LMStudioModelsResponse : {};
      const model = data.data?.find((m: Readonly<LMStudioModel>) => m.id === modelName);

      if (!model) {
        throw new Error(`Model ${modelName} not found in LM Studio`);
      }

      // Infer capabilities from model name and LM Studio context
      const functionCalling = this.inferFunctionCallingFromName(modelName);

      const capabilities: ModelCapabilities = {
        functionCalling,
        toolUse: functionCalling,
        jsonMode: true, // LM Studio generally supports JSON mode
        streaming: true, // LM Studio supports streaming
        codeGeneration: this.hasCodeGenerationFromName(modelName),
        chatCompletion: true, // LM Studio models are typically chat models
        instruct: modelName.includes('instruct') || modelName.includes('chat'),
        reasoning: this.hasReasoningFromName(modelName),
        multimodal: false, // Most LM Studio models are text-only
        lastChecked: new Date(),
        confidence: 0.6, // Medium confidence from name inference
        source: 'inference',
      };

      return capabilities;
    } catch (error) {
      logger.debug(`LM Studio API query failed for ${modelName}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Infer capabilities from model name patterns (fallback method)
   */
  private inferCapabilitiesFromName(modelName: string): ModelCapabilities {
    const nameLower = modelName.toLowerCase();
    const functionCalling = this.inferFunctionCallingFromName(modelName);

    return {
      functionCalling,
      toolUse: functionCalling,
      jsonMode: functionCalling, // Models with function calling usually support JSON
      streaming: true, // Assume most modern models support streaming
      codeGeneration: this.hasCodeGenerationFromName(modelName),
      chatCompletion: !nameLower.includes('base') && !nameLower.includes('pretrain'),
      instruct: nameLower.includes('instruct') || nameLower.includes('chat'),
      reasoning: this.hasReasoningFromName(modelName),
      multimodal: nameLower.includes('vision') || nameLower.includes('multimodal'),
      lastChecked: new Date(),
      confidence: 0.4, // Lower confidence for inference-based detection
      source: 'fallback',
    };
  }

  /**
     * Analyze HuggingFace model for function calling capability
     */
    private analyzeForFunctionCalling(
      tags: readonly string[],
      config: Readonly<{ architectures?: readonly string[] }>,
      modelName: string
    ): boolean {
      // Check for explicit function calling support in tags
      if (
        tags.some(
          tag =>
            tag.includes('function') ||
            tag.includes('tool') ||
            tag.includes('agent') ||
            tag.includes('reasoning')
        )
      ) {
        return true;
      }
  
      // Check config for function calling related settings
      if (
        Array.isArray(config.architectures) &&
        config.architectures.some(
          (arch: string) => arch.includes('ForCausalLM') || arch.includes('ForConditional')
        )
      ) {
        // These architectures can potentially do function calling
        return this.inferFunctionCallingFromName(modelName);
      }
  
      return this.inferFunctionCallingFromName(modelName);
    }

  /**
   * Analyze Ollama model template for function calling patterns
   */
  private analyzeOllamaForFunctionCalling(
    template: string,
    system: string,
    modelName: string
  ): boolean {
    // Look for function calling patterns in template
    if (
      template.includes('tools') ||
      template.includes('function') ||
      template.includes('{{.Tools}}') ||
      system.includes('function') ||
      system.includes('tool')
    ) {
      return true;
    }

    // Check if it's a known function calling model
    return this.inferFunctionCallingFromName(modelName);
  }

  /**
   * Infer function calling capability from model name
   */
  private inferFunctionCallingFromName(modelName: string): boolean {
    const nameLower = modelName.toLowerCase();

    return this.KNOWN_FUNCTION_CALLING_MODELS.some(pattern => nameLower.includes(pattern));
  }

  /**
   * Helper methods for capability detection
   */
  private hasJSONMode(tags: readonly string[], config: Readonly<{ json_mode?: boolean }>): boolean {
    return tags.includes('json') || (typeof config.json_mode === 'boolean' && config.json_mode);
  }

  private hasJSONModeFromTemplate(template: string): boolean {
    return template.includes('json') || template.includes('JSON');
  }

  private hasCodeGeneration(tags: readonly string[], pipeline: string): boolean {
    return tags.includes('code') || pipeline === 'text-generation' || tags.includes('programming');
  }

  private hasCodeGenerationFromName(modelName: string): boolean {
    const nameLower = modelName.toLowerCase();
    return (
      nameLower.includes('code') || nameLower.includes('coding') || nameLower.includes('programmer')
    );
  }

  private hasReasoning(tags: string[], modelName: string): boolean {
    return tags.includes('reasoning') || this.hasReasoningFromName(modelName);
  }

  private hasReasoningFromName(modelName: string): boolean {
    const nameLower = modelName.toLowerCase();
    return (
      nameLower.includes('reasoning') || nameLower.includes('think') || nameLower.includes('logic')
    );
  }

  private hasMultimodal(tags: string[], pipeline: string): boolean {
    return (
      tags.includes('multimodal') ||
      pipeline === 'image-to-text' ||
      pipeline === 'visual-question-answering'
    );
  }

  /**
   * Check if cached capability is still valid
   */
  private isCacheValid(capabilities: Readonly<ModelCapabilities>): boolean {
    return Date.now() - capabilities.lastChecked.getTime() < this.CACHE_TTL;
  }

  /**
   * Clear capability cache
   */
  public clearCache(): void {
    this.capabilityCache.clear();
    logger.info('Model capability cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const entries = Array.from(this.capabilityCache.entries());

    return {
      totalEntries: entries.length,
      validEntries: entries.filter(([_key, cap]: readonly [string, Readonly<ModelCapabilities>]) => this.isCacheValid(cap)).length,
      oldestEntry:
        entries.length > 0
          ? Math.min(...entries.map(([_key, cap]: readonly [string, Readonly<ModelCapabilities>]) => cap.lastChecked.getTime()))
          : null,
      newestEntry:
        entries.length > 0
          ? Math.max(...entries.map(([_key, cap]: readonly [string, Readonly<ModelCapabilities>]) => cap.lastChecked.getTime()))
          : null,
    };
  }

  /**
   * Check if a model supports function calling
   */
  public async supportsFunctionCalling(modelName: string, provider: string = 'unknown'): Promise<boolean> {
    try {
      const capabilities = await this.getModelCapabilities(modelName, provider);
      return capabilities.functionCalling;
    } catch (error) {
      logger.warn(
        `Failed to check function calling support for ${modelName}:`,
        { error: error instanceof Error ? error.message : String(error) }
      );
      // Fallback to name-based inference
      return this.inferFunctionCallingFromName(modelName);
    }
  }
}

// Export singleton instance
export const modelCapabilityService = new ModelCapabilityService();
