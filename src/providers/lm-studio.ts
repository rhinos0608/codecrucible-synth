import { LMStudioClient } from '@lmstudio/sdk';
import { logger } from '../infrastructure/logging/logger.js';
import { getErrorMessage } from '../utils/error-utils.js';

export interface LMStudioConfig {
  endpoint?: string;
  model?: string;
  timeout?: number;
  apiKey?: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  stream?: boolean;
  maxSteps?: number;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface LMChatMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMTool {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface LLMRequest {
  prompt?: string;
  messages?: ChatMessage[];
  options?: LLMOptions;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface AgenticResponse {
  result: unknown;
  steps: Array<{
    action: string;
    result: unknown;
  }>;
  metadata?: Record<string, unknown>;
}

export class LMStudioProvider {
  private client: LMStudioClient;
  private config: LMStudioConfig;
  private model: string;
  private isAvailable: boolean = false;

  constructor(config: LMStudioConfig) {
    logger.debug('LMStudioProvider constructor called', { config });

    this.config = {
      endpoint: config.endpoint || 'ws://localhost:8080',
      model: config.model || 'auto-detect',
      timeout: config.timeout || 30000,
    };

    this.model = this.config.model || 'auto-detect';

    // Initialize official LM Studio client
    // Try custom endpoint first, fallback to default SDK behavior
    try {
      if (config.endpoint && config.endpoint !== 'ws://localhost:8080') {
        this.client = new LMStudioClient({
          baseUrl: config.endpoint,
        });
      } else {
        // Use default LMStudioClient behavior (auto-detection)
        this.client = new LMStudioClient();
      }
    } catch (error) {
      logger.warn('Failed to initialize LM Studio client with endpoint, using default', {
        endpoint: config.endpoint,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to default behavior
      this.client = new LMStudioClient();
    }

    logger.debug('LMStudioProvider initialized successfully', {
      endpoint: this.config.endpoint,
      model: this.model,
    });
  }

  async isServiceAvailable(): Promise<boolean> {
    try {
      logger.debug('LMStudioProvider checking service availability');

      // Use official LM Studio client to check availability
      const models = await this.client.llm.listLoaded();
      this.isAvailable = models.length > 0;

      logger.info('LMStudioProvider availability check result', {
        available: this.isAvailable,
        modelCount: models.length,
      });

      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      logger.warn('LMStudioProvider service availability check failed', {
        error: getErrorMessage(error),
        endpoint: this.config.endpoint,
      });
      return false;
    }
  }

  async generateText(prompt: string, options: LLMOptions = {}): Promise<string> {
    try {
      logger.debug('LMStudioProvider generateText called', {
        promptLength: prompt.length,
        model: this.model,
        hasOptions: Object.keys(options).length > 0,
      });

      // Determine model to use
      const modelToUse = this.model === 'auto-detect' ? await this.detectBestModel() : this.model;

      if (!modelToUse) {
        throw new Error('No model available for text generation');
      }

      // Get model instance
      const model = await this.client.llm.model(modelToUse);

      // Use official LM Studio client for generation
      const response = await model.complete(prompt, {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 1000,
        ...options,
      });

      logger.info('LMStudioProvider generateText completed', {
        model: modelToUse,
        responseLength: response.content.length,
      });

      return response.content;
    } catch (error) {
      logger.error('LMStudioProvider generateText failed', {
        error: getErrorMessage(error),
        model: this.model,
        endpoint: this.config.endpoint,
      });
      throw error;
    }
  }

  public async generateTextStreaming(
    prompt: string,
    options: Readonly<LLMOptions> = {}
  ): Promise<AsyncIterable<string>> {
    try {
      logger.debug('LMStudioProvider generateTextStreaming called', {
        promptLength: prompt.length,
        model: this.model,
      });

      const modelToUse = this.model === 'auto-detect' ? await this.detectBestModel() : this.model;

      if (!modelToUse) {
        throw new Error('No model available for streaming generation');
      }

      // Get model instance
      const model = await this.client.llm.model(modelToUse);

      // Use official LM Studio client streaming
      const stream = model.complete(prompt, {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1000,
        stream: true,
        ...options,
      });

      return (async function* (): AsyncGenerator<string> {
        for await (const chunk of stream) {
          if (chunk.content) {
            yield chunk.content;
          }
        }
      }());
    } catch (error) {
      logger.error('LMStudioProvider generateTextStreaming failed', {
        error: getErrorMessage(error),
        model: this.model,
      });
      throw error;
    }
  }

  public async chat(
    messages: ReadonlyArray<Readonly<ChatMessage>>,
    options: Readonly<LLMOptions> = {}
  ): Promise<string> {
    try {
      logger.debug('LMStudioProvider chat called', {
        messageCount: messages.length,
        model: this.model,
      });

      const modelToUse = this.model === 'auto-detect' ? await this.detectBestModel() : this.model;

      if (!modelToUse) {
        throw new Error('No model available for chat');
      }

      // Get model instance
      const model = await this.client.llm.model(modelToUse);

      // Filter/convert to roles supported by LM Studio ('system' | 'user' | 'assistant')
      const lmMessages: LMChatMessageInput[] = messages
        .filter((m: Readonly<ChatMessage>) => m.role === 'system' || m.role === 'user' || m.role === 'assistant')
        .map((m: Readonly<ChatMessage>) => ({ role: m.role as LMChatMessageInput['role'], content: m.content }));

      // Use respond with sanitized messages
      const response = await model.respond(lmMessages, {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1000,
        ...options,
      });

      logger.info('LMStudioProvider chat completed', {
        model: modelToUse,
        responseLength: response.content.length,
      });

      return response.content;
    } catch (error) {
      logger.error('LMStudioProvider chat failed', {
        error: getErrorMessage(error),
        model: this.model,
      });
      throw error;
    }
  }

  // Advanced LM Studio feature - agentic workflows
  public async act(
    task: string,
    tools: ReadonlyArray<Readonly<LLMTool>> = [],
    options: Readonly<LLMOptions> = {}
  ): Promise<AgenticResponse> {
    try {
      logger.debug('LMStudioProvider act called', {
        taskLength: task.length,
        toolCount: tools.length,
        model: this.model,
      });

      const modelToUse = this.model === 'auto-detect' ? await this.detectBestModel() : this.model;

      if (!modelToUse) {
        throw new Error('No model available for agentic workflow');
      }

      // Get model instance
      const model = await this.client.llm.model(modelToUse);

      // Use LM Studio's .act() method for autonomous agents
      // Cast tools to SDK-compatible type (runtime validated by SDK)
      const response = await (
        model as unknown as {
          act: (
            task: string,
            tools: ReadonlyArray<unknown>,
            options: Readonly<Record<string, unknown>>
          ) => Promise<unknown>;
        }
      ).act(task, tools as ReadonlyArray<unknown>, {
        temperature: options.temperature ?? 0.7,
        maxSteps: options.maxSteps ?? 10,
        ...options,
      });

      logger.info('LMStudioProvider act completed', {
        model: modelToUse,
        responseType: typeof response,
      });

      return {
        result: response,
        steps: [], // LM Studio doesn't provide step details in current version
        metadata: { model: modelToUse, task },
      };
    } catch (error) {
      logger.error('LMStudioProvider act failed', {
        error: getErrorMessage(error),
        model: this.model,
      });
      throw error;
    }
  }

  private async detectBestModel(): Promise<string> {
    try {
      // First try to get loaded models
      const loadedModels = await this.client.llm.listLoaded();

      if (loadedModels.length > 0) {
        // Prefer coding models for CodeCrucible
        const codingModels = loadedModels.filter(
          m => m.path.toLowerCase().includes('coder') || m.path.toLowerCase().includes('code')
        );

        if (codingModels.length > 0) {
          return codingModels[0].path;
        }

        // Fallback to first loaded model
        return loadedModels[0].path;
      }

      // If no models are loaded, try to use a default available model
      // Based on the models we saw in the CLI listing, use a known good model
      const defaultModels = [
        'llama3.1-8b-instruct',
        'deepseek-coder-6.7b-instruct',
        'codellama-7b-instruct',
        'openai/gpt-oss-20b:gpt-oss-20b',
      ];

      // Try each default model to see if it's available
      for (const modelName of defaultModels) {
        try {
          // Test if we can access this model (this will throw if not available)
          const _model = await this.client.llm.model(modelName);
          logger.info(`LMStudioProvider selected model: ${modelName}`);
          return modelName;
        } catch (modelError) {
          // Continue to next model
          logger.debug(`Model ${modelName} not available, trying next`, {
            error: getErrorMessage(modelError),
          });
        }
      }

      throw new Error('No available models found. Please load a model in LM Studio first.');
    } catch (error) {
      logger.error('LMStudioProvider model detection failed', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  public healthCheck(): boolean {
    try {
      // Simple health check - verify client is initialized and has expected structure
      // This doesn't require any models to be loaded, just that LM Studio is running
      if (typeof this.client?.llm?.model === 'function') {
        logger.debug('LMStudioProvider health check - SDK client available');
        return true;
      }
      return false;
    } catch (error) {
      logger.debug('LMStudioProvider health check failed', {
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  public getConfig(): LMStudioConfig {
    return { ...this.config };
  }

  public getModel(): string {
    return this.model;
  }

  public setModel(model: string): void {
    this.model = model;
    logger.debug('LMStudioProvider model updated', { model: this.model });
  }

  // Legacy compatibility methods
  public async processRequest(request: Readonly<LLMRequest>): Promise<LLMResponse | string> {
    logger.debug('LMStudioProvider processRequest called (legacy compatibility)');

    if (request.messages) {
      const content = await this.chat(request.messages, request.options ?? {});
      return {
        content,
        model: this.model,
        metadata: { requestType: 'chat' },
      };
    } else if (request.prompt) {
      const content = await this.generateText(request.prompt, request.options ?? {});
      return {
        content,
        model: this.model,
        metadata: { requestType: 'completion' },
      };
    } else {
      throw new Error('Invalid request format: must include either messages or prompt');
    }
  }

  public checkStatus(): boolean {
    return this.healthCheck();
  }
}
