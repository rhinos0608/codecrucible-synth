/**
 * Multi-LLM Provider System inspired by Archon's architecture
 * Supports OpenAI, Google Gemini, Anthropic Claude, and local Ollama models
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';

export interface LLMConfig {
  provider: 'openai' | 'google' | 'anthropic' | 'ollama';
  apiKey?: string;
  endpoint?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  provider: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export abstract class BaseLLMProvider {
  protected config: LLMConfig;
  protected client: AxiosInstance;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = axios.create({
      timeout: config.timeout || 30000,
      headers: this.getHeaders()
    });
  }

  abstract generateResponse(messages: ChatMessage[]): Promise<LLMResponse>;
  abstract validateConfig(): boolean;
  abstract getHeaders(): Record<string, string>;
  abstract formatMessages(messages: ChatMessage[]): any;

  protected handleError(error: any, context: string): never {
    logger.error(`${this.config.provider} provider error in ${context}:`, error);
    
    if (error.response?.status === 401) {
      throw new Error(`Invalid API key for ${this.config.provider}`);
    } else if (error.response?.status === 429) {
      throw new Error(`Rate limit exceeded for ${this.config.provider}`);
    } else if (error.response?.status === 503) {
      throw new Error(`Service unavailable for ${this.config.provider}`);
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused to ${this.config.provider} endpoint`);
    }
    
    throw new Error(`${this.config.provider} provider error: ${error.message}`);
  }
}

export class OpenAIProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super({
      ...config,
      endpoint: config.endpoint || 'https://api.openai.com/v1'
    });
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.model);
  }

  getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  formatMessages(messages: ChatMessage[]): any {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  async generateResponse(messages: ChatMessage[]): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      throw new Error('OpenAI provider: API key and model are required');
    }

    try {
      const response = await this.client.post(`${this.config.endpoint}/chat/completions`, {
        model: this.config.model,
        messages: this.formatMessages(messages),
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7
      });

      const data = response.data;
      return {
        content: data.choices[0].message.content,
        usage: data.usage,
        model: this.config.model,
        provider: 'openai'
      };
    } catch (error) {
      this.handleError(error, 'generateResponse');
    }
  }
}

export class GoogleProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super({
      ...config,
      endpoint: config.endpoint || 'https://generativelanguage.googleapis.com/v1beta'
    });
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.model);
  }

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }

  formatMessages(messages: ChatMessage[]): any {
    const contents = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    const systemInstruction = messages.find(msg => msg.role === 'system');
    
    return {
      contents,
      systemInstruction: systemInstruction ? {
        parts: [{ text: systemInstruction.content }]
      } : undefined
    };
  }

  async generateResponse(messages: ChatMessage[]): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      throw new Error('Google provider: API key and model are required');
    }

    try {
      const url = `${this.config.endpoint}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
      const payload = {
        ...this.formatMessages(messages),
        generationConfig: {
          maxOutputTokens: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.7
        }
      };

      const response = await this.client.post(url, payload);
      const data = response.data;

      return {
        content: data.candidates[0].content.parts[0].text,
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata?.totalTokenCount || 0
        },
        model: this.config.model,
        provider: 'google'
      };
    } catch (error) {
      this.handleError(error, 'generateResponse');
    }
  }
}

export class AnthropicProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super({
      ...config,
      endpoint: config.endpoint || 'https://api.anthropic.com/v1'
    });
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.model);
  }

  getHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey!,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };
  }

  formatMessages(messages: ChatMessage[]): any {
    const systemMessage = messages.find(msg => msg.role === 'system');
    const conversationMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    return {
      system: systemMessage?.content,
      messages: conversationMessages
    };
  }

  async generateResponse(messages: ChatMessage[]): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      throw new Error('Anthropic provider: API key and model are required');
    }

    try {
      const { system, messages: formattedMessages } = this.formatMessages(messages);
      
      const response = await this.client.post(`${this.config.endpoint}/messages`, {
        model: this.config.model,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
        system,
        messages: formattedMessages
      });

      const data = response.data;
      return {
        content: data.content[0].text,
        usage: {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens
        },
        model: this.config.model,
        provider: 'anthropic'
      };
    } catch (error) {
      this.handleError(error, 'generateResponse');
    }
  }
}

export class OllamaProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super({
      ...config,
      endpoint: config.endpoint || 'http://localhost:11434'
    });
  }

  validateConfig(): boolean {
    return !!this.config.model;
  }

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }

  formatMessages(messages: ChatMessage[]): any {
    return messages;
  }

  async generateResponse(messages: ChatMessage[]): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      throw new Error('Ollama provider: model is required');
    }

    try {
      const response = await this.client.post(`${this.config.endpoint}/api/chat`, {
        model: this.config.model,
        messages: this.formatMessages(messages),
        stream: false,
        options: {
          temperature: this.config.temperature || 0.7,
          num_predict: this.config.maxTokens || 4096
        }
      });

      const data = response.data;
      return {
        content: data.message.content,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        model: this.config.model,
        provider: 'ollama'
      };
    } catch (error) {
      this.handleError(error, 'generateResponse');
    }
  }
}

export class MultiLLMProvider {
  private providers: Map<string, BaseLLMProvider> = new Map();
  private defaultProvider?: string;

  addProvider(name: string, provider: BaseLLMProvider): void {
    this.providers.set(name, provider);
    
    if (!this.defaultProvider) {
      this.defaultProvider = name;
    }
    
    logger.info(`Added LLM provider: ${name} (${provider['config'].provider})`);
  }

  removeProvider(name: string): void {
    this.providers.delete(name);
    
    if (this.defaultProvider === name) {
      this.defaultProvider = this.providers.keys().next().value;
    }
    
    logger.info(`Removed LLM provider: ${name}`);
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} not found`);
    }
    
    this.defaultProvider = name;
    logger.info(`Set default LLM provider: ${name}`);
  }

  async generateResponse(
    messages: ChatMessage[], 
    providerName?: string
  ): Promise<LLMResponse> {
    const name = providerName || this.defaultProvider;
    
    if (!name) {
      throw new Error('No LLM provider configured');
    }
    
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }
    
    logger.info(`Generating response with ${name} provider`);
    return await provider.generateResponse(messages);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProviderInfo(name: string): LLMConfig | undefined {
    const provider = this.providers.get(name);
    return provider ? { ...provider['config'] } : undefined;
  }

  async testProvider(name: string): Promise<boolean> {
    try {
      const testMessages: ChatMessage[] = [
        { role: 'user', content: 'Hello, can you respond with just "OK"?' }
      ];
      
      await this.generateResponse(testMessages, name);
      logger.info(`Provider ${name} test successful`);
      return true;
    } catch (error) {
      logger.error(`Provider ${name} test failed:`, error);
      return false;
    }
  }
}

export function createMultiLLMProvider(configs: { name: string; config: LLMConfig }[]): MultiLLMProvider {
  const multiProvider = new MultiLLMProvider();
  
  for (const { name, config } of configs) {
    let provider: BaseLLMProvider;
    
    switch (config.provider) {
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'google':
        provider = new GoogleProvider(config);
        break;
      case 'anthropic':
        provider = new AnthropicProvider(config);
        break;
      case 'ollama':
        provider = new OllamaProvider(config);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
    
    multiProvider.addProvider(name, provider);
  }
  
  return multiProvider;
}