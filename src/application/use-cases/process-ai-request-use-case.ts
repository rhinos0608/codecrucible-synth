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
  public constructor(
    private readonly modelSelectionService: Readonly<ModelSelectionService>,
    private readonly voiceOrchestrationService: Readonly<VoiceOrchestrationService>,
    private readonly modelClient: Readonly<UnifiedModelClient>
  ) {}

  public async execute(input: Readonly<AIRequestInput>): Promise<AIRequestOutput> {
    // Input validation and transformation
    const request = this.transformToProcessingRequest(input);

    // Domain orchestration
    const selectedModel = await this.modelSelectionService.selectOptimalModel(request);
    const { primaryVoice } = await this.voiceOrchestrationService.selectVoicesForRequest(request);

    // Use primary voice for single request

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
          tokensUsed: modelResponse.usage?.totalTokens ?? 0,
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
    const safeResponse: ModelResponse =
      typeof response === 'string' ? { content: response } : response;
    return this.transformToOutput(safeResponse, selectedModel.primaryModel, primaryVoice);
  }

  // Define a minimal response type for safe property access

  private transformToProcessingRequest(input: Readonly<AIRequestInput>): ProcessingRequest {
    // Basic validation
    if (typeof input.prompt !== 'string' || input.prompt.trim().length === 0) {
      throw new Error('AIRequestInput.prompt is required and must be a non-empty string.');
    }

    // Normalise and clamp numeric parameters
    const normalizeNumber = (
      value: number | undefined,
      min: number,
      max: number,
      fallback: number
    ): number =>
      typeof value === 'number' && !Number.isNaN(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;

    const temperature = normalizeNumber(input.temperature, 0, 1, 0.7);
    const maxTokens = Math.max(1, Math.floor(normalizeNumber(input.maxTokens, 1, 100000, 1024)));

    // Preferred model string (trim or undefined)
    const preferredModel =
      typeof input.model === 'string' && input.model.trim().length > 0
        ? input.model.trim()
        : undefined;

    // Voice requirements: keep structured so voice orchestration can make decisions
    const voiceRequirements = input.voice
      ? {
          ids: [input.voice],
          // allow future expansion (language, gender, style, sampleRate, etc.)
        }
      : undefined;

    // Create a stable request id (use crypto.randomUUID when available)
    const generateId = (): string => {
      try {
        const maybeCrypto = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto;
        if (
          maybeCrypto &&
          typeof maybeCrypto === 'object' &&
          typeof maybeCrypto.randomUUID === 'function'
        ) {
          return maybeCrypto.randomUUID();
        }
      } catch {
        /* noop */
      }
      return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    };

    // Build ProcessingRequest with explicit fields expected by domain services.
    // The exact ProcessingRequest shape lives in domain/entities/request; keep fields
    // the domain likely expects: id, prompt, type, constraints and context.
    const request: ProcessingRequest = {
      // keep the shape minimal but explicit; domain can extend this type
      id: generateId(),
      prompt: input.prompt,
      type: 'general-query',
      createdAt: new Date(),
      constraints: {
        preferredModel,
        temperature,
        maxTokens,
        voiceRequirements,
      },
      context: input.context ?? {},
    } as unknown as ProcessingRequest; // cast because domain shape may be richer

    return request;
  }

  private transformToOutput(
    response: Readonly<ModelResponse>,
    model: Readonly<Model>,
    voice: Readonly<{ id?: string; name?: string }> | string | undefined
  ): AIRequestOutput {
    // Helper guards for common response shapes
    const getContent = (resp: unknown): string => {
      if (resp && typeof resp === 'object') {
        const r = resp as ModelResponse;
        if (typeof r.content === 'string' && r.content.length) return r.content;
        // OpenAI-like chat/completion
        if (Array.isArray(r.choices) && r.choices.length) {
          interface Choice {
            text?: string;
            message?: { content?: string };
          }
          const [first]: (Choice | undefined)[] = r.choices;
          if (typeof first.text === 'string' && first.text.length > 0) return first.text;
          if (typeof first.message?.content === 'string' && first.message.content.length > 0)
            return first.message.content;
        }
        // Some model clients use `text` or `output` or `data`
        if (typeof r.text === 'string') return r.text;
        if (typeof r.output === 'string') return r.output;
        if (
          Array.isArray(r.outputs) &&
          r.outputs.length > 0 &&
          typeof r.outputs[0]?.content === 'string'
        ) {
          return r.outputs[0].content;
        }
      }
      return String(resp);
    };

    const getTokensUsed = (resp: unknown): number => {
      if (resp && typeof resp === 'object') {
        const r = resp as ModelResponse;
        if (typeof r.tokensUsed === 'number') return r.tokensUsed;
        if (r.usage && typeof r.usage.totalTokens === 'number') return r.usage.totalTokens;
        if (r.usage && typeof r.usage.total_tokens === 'number') return r.usage.total_tokens;
        // OpenAI style:
        if (
          r.usage &&
          typeof r.usage.prompt_tokens === 'number' &&
          typeof r.usage.completion_tokens === 'number'
        ) {
          return r.usage.prompt_tokens + r.usage.completion_tokens;
        }
      }
      return 0;
    };

    const getProcessingTime = (resp: ModelResponse | undefined): number => {
      if (!resp) return 0;
      if (typeof resp.processingTime === 'number') return resp.processingTime;
      if (typeof resp.durationMs === 'number') return resp.durationMs;
      if (
        (typeof resp.timestamp === 'string' ||
          typeof resp.timestamp === 'number' ||
          resp.timestamp instanceof Date) &&
        (typeof resp.generatedAt === 'string' ||
          typeof resp.generatedAt === 'number' ||
          resp.generatedAt instanceof Date)
      ) {
        // support two timestamps
        const a = new Date(resp.timestamp).getTime();
        const b = new Date(resp.generatedAt).getTime();
        if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) return b - a;
      }
      if (typeof resp.timestamp === 'number') {
        // timestamp may be ms since epoch; assume 0 processing if no end time
        return 0;
      }
      return 0;
    };

    const getConfidence = (resp: ModelResponse | undefined): number => {
      if (!resp) return 0.5;
      if (typeof resp.confidence === 'number') return Math.min(1, Math.max(0, resp.confidence));
      if (typeof resp.score === 'number') return Math.min(1, Math.max(0, resp.score));
      // Heuristic: if there were tokens and no error, assume high confidence
      const tokens = getTokensUsed(resp);
      if (tokens > 0 && !resp.error) return 0.9;
      if (resp.error) return 0.1;
      return 0.5;
    };

    const content = getContent(response);
    const tokensUsed = getTokensUsed(response);
    const processingTime = getProcessingTime(response);
    const confidence = getConfidence(response);

    // Normalize model name to string
    const modelName = ((): string => {
      try {
        // Model may expose a name string or an object that stringifies
        if (typeof model.name === 'string') return model.name;
        return String(model.name);
      } catch {
        /* noop */
      }
      return 'unknown-model';
    })();

    // Normalize voice id
    const voiceId = ((): string => {
      if (!voice) return 'default';
      if (typeof voice === 'string') return voice;
      if (typeof voice.id === 'string') return voice.id;
      if (typeof voice.name === 'string') return voice.name;
      return 'default';
    })();

    return {
      content,
      model: modelName,
      voice: voiceId,
      metadata: {
        tokensUsed: tokensUsed || 0,
        processingTime: processingTime || 0,
        confidence: typeof confidence === 'number' ? confidence : 0.5,
      },
    };
  }
}

export interface ModelResponse {
  content?: string;
  choices?: Array<{ text?: string; message?: { content?: string } }>;
  text?: string;
  output?: string;
  outputs?: Array<{ content?: string }>;
  tokensUsed?: number;
  usage?: {
    totalTokens?: number;
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  processingTime?: number;
  durationMs?: number;
  timestamp?: string | number | Date;
  generatedAt?: string | number | Date;
  confidence?: number;
  score?: number;
  error?: boolean;
  [key: string]: unknown;
}
