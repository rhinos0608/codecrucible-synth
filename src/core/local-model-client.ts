/**
 * Local Model Client for CodeCrucible Synth
 * Provides interface to local AI models (Ollama, LM Studio)
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';

export interface LocalModelConfig {
  provider: 'ollama' | 'lmstudio';
  endpoint: string;
  model: string;
  timeout: number;
  temperature: number;
  maxTokens: number;
  streamingEnabled: boolean;
}

export interface ModelResponse {
  content: string;
  model: string;
  metadata: {
    tokens: number;
    duration: number;
    temperature: number;
  };
}

export interface VoiceResponse {
  content: string;
  voice: string;
  confidence: number;
}

export class LocalModelClient {
  private client: AxiosInstance;
  private config: LocalModelConfig;

  constructor(config: LocalModelConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check connection to the model provider
   */
  async checkConnection(): Promise<boolean> {
    try {
      const endpoint = this.config.provider === 'ollama' ? '/api/tags' : '/v1/models';
      const response = await this.client.get(endpoint);
      return response.status === 200;
    } catch (error) {
      logger.warn(`Connection check failed for ${this.config.provider}:`, error.message);
      return false;
    }
  }

  /**
   * Check status of the model provider
   */
  async checkStatus(): Promise<boolean> {
    return this.checkConnection();
  }

  /**
   * Generate response from model
   */
  async generate(prompt: string): Promise<string> {
    try {
      if (this.config.provider === 'ollama') {
        return await this.generateOllama(prompt);
      } else {
        return await this.generateLMStudio(prompt);
      }
    } catch (error) {
      logger.error('Generation failed:', error);
      throw new Error(`Model generation failed: ${error.message}`);
    }
  }

  /**
   * Generate voice-specific response
   */
  async generateVoiceResponse(prompt: string, voice: string): Promise<VoiceResponse> {
    const voicePrompt = this.buildVoicePrompt(prompt, voice);
    const content = await this.generate(voicePrompt);
    
    return {
      content,
      voice,
      confidence: 0.8 // Default confidence score
    };
  }

  /**
   * Generate multiple voice responses
   */
  async generateMultiVoiceResponses(prompt: string, voices: string[]): Promise<VoiceResponse[]> {
    const responses = await Promise.all(
      voices.map(voice => this.generateVoiceResponse(prompt, voice))
    );
    return responses;
  }

  /**
   * Analyze code with AI
   */
  async analyzeCode(code: string, language?: string): Promise<string> {
    const analysisPrompt = this.buildCodeAnalysisPrompt(code, language);
    return await this.generate(analysisPrompt);
  }

  /**
   * List available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      if (this.config.provider === 'ollama') {
        const response = await this.client.get('/api/tags');
        return response.data.models?.map((model: any) => model.name) || [];
      } else {
        const response = await this.client.get('/v1/models');
        return response.data.data?.map((model: any) => model.id) || [];
      }
    } catch (error) {
      logger.warn('Failed to get available models:', error.message);
      return [];
    }
  }

  /**
   * Get best available model for the task
   */
  async getBestAvailableModel(): Promise<string> {
    const models = await this.getAvailableModels();
    if (models.length === 0) {
      throw new Error('No models available');
    }
    
    // Prefer coding models
    const codingModels = models.filter(model => 
      model.includes('code') || model.includes('deepseek') || model.includes('qwen')
    );
    
    return codingModels.length > 0 ? codingModels[0] : models[0];
  }

  private async generateOllama(prompt: string): Promise<string> {
    const response = await this.client.post('/api/generate', {
      model: this.config.model,
      prompt,
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens,
      },
    });

    return response.data.response || '';
  }

  private async generateLMStudio(prompt: string): Promise<string> {
    const response = await this.client.post('/v1/chat/completions', {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false,
    });

    return response.data.choices?.[0]?.message?.content || '';
  }

  private buildVoicePrompt(prompt: string, voice: string): string {
    const voicePersonalities = {
      explorer: 'You are an innovative explorer who pushes boundaries and investigates alternatives.',
      maintainer: 'You are a careful maintainer focused on long-term sustainability and clean code.',
      analyzer: 'You are a thorough analyzer who examines code for patterns and improvements.',
      developer: 'You are a practical developer focused on efficient implementation.',
      implementor: 'You are a detail-oriented implementor who ensures proper execution.',
      security: 'You are a security expert focused on identifying vulnerabilities and threats.',
      architect: 'You are a system architect focused on scalable and maintainable design.',
      designer: 'You are a user experience designer focused on usability and accessibility.',
      optimizer: 'You are a performance optimizer focused on efficiency and speed.',
      guardian: 'You are a quality guardian focused on code standards and best practices.',
    };

    const personality = voicePersonalities[voice] || voicePersonalities.developer;
    return `${personality}\n\n${prompt}`;
  }

  private buildCodeAnalysisPrompt(code: string, language?: string): string {
    const langHint = language ? ` (${language})` : '';
    return `Please analyze the following code${langHint} and provide insights on:
1. Code quality and potential improvements
2. Security considerations
3. Performance optimizations
4. Best practices compliance

Code:
\`\`\`${language || 'text'}
${code}
\`\`\`

Please provide a comprehensive analysis with specific recommendations.`;
  }

  /**
   * Legacy compatibility methods
   */
  async checkOllamaStatus(): Promise<boolean> {
    return this.checkConnection();
  }

  async getAllAvailableModels(): Promise<any[]> {
    const models = await this.getAvailableModels();
    return models.map(name => ({ name, id: name }));
  }

  async pullModel(name: string): Promise<boolean> {
    if (this.config.provider !== 'ollama') {
      return false;
    }

    try {
      await this.client.post('/api/pull', { name });
      return true;
    } catch (error) {
      logger.error('Failed to pull model:', error);
      return false;
    }
  }
}

export default LocalModelClient;