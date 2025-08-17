import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';

export interface LMStudioConfig {
  endpoint: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
  streamingEnabled: boolean;
}

export interface LMStudioResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LMStudioClient {
  private httpClient: AxiosInstance;
  private config: LMStudioConfig;
  private isAvailable = false;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 30000; // 30 seconds

  constructor(config: Partial<LMStudioConfig> = {}) {
    this.config = {
      endpoint: config.endpoint || 'http://localhost:1234',
      timeout: config.timeout || 10000,
      maxTokens: config.maxTokens || 2048,
      temperature: config.temperature || 0.1,
      streamingEnabled: config.streamingEnabled || true
    };

    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.initializeHealthChecking();
  }

  /**
   * Initialize periodic health checking
   */
  private async initializeHealthChecking(): Promise<void> {
    await this.checkHealth();
    setInterval(async () => {
      await this.checkHealth();
    }, this.healthCheckInterval);
  }

  /**
   * Check if LM Studio server is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/v1/models', { timeout: 5000 });
      this.isAvailable = response.status === 200;
      this.lastHealthCheck = Date.now();
      
      if (this.isAvailable) {
        logger.debug('LM Studio health check passed');
      }
      
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      logger.warn('LM Studio health check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get available models from LM Studio
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.httpClient.get('/v1/models');
      return response.data.data.map((model: { id: string }) => model.id);
    } catch (error) {
      logger.error('Failed to get LM Studio models:', error);
      return [];
    }
  }

  /**
   * Generate code using LM Studio
   */
  async generateCode(
    prompt: string, 
    context: string[] = [],
    options: {
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
    } = {}
  ): Promise<{
    code: string;
    explanation: string;
    confidence: number;
    latency: number;
    fromCache: boolean;
  }> {
    const startTime = Date.now();

    if (!this.isAvailable) {
      await this.checkHealth();
      if (!this.isAvailable) {
        throw new Error('LM Studio server is not available');
      }
    }

    try {
      const messages = this.formatMessages(prompt, context);
      
      const requestData = {
        model: await this.getOptimalModel(),
        messages,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        stream: options.stream || false
      };

      const response = await this.httpClient.post('/v1/chat/completions', requestData);
      const lmStudioResponse: LMStudioResponse = response.data;
      
      const content = lmStudioResponse.choices[0]?.message?.content || '';
      const latency = Date.now() - startTime;

      // Parse the response to extract code and explanation
      const parsed = this.parseCodeResponse(content);
      
      // Calculate confidence based on response quality
      const confidence = this.calculateConfidence(content, prompt, latency);

      logger.info(`LM Studio generation completed in ${latency}ms`, {
        confidence,
        tokens: lmStudioResponse.usage?.total_tokens || 0
      });

      return {
        code: parsed.code,
        explanation: parsed.explanation,
        confidence,
        latency,
        fromCache: false
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('LM Studio generation failed:', error);
      throw new Error(`LM Studio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream code generation for real-time responses
   */
  async *streamGenerateCode(
    prompt: string,
    context: string[] = []
  ): AsyncGenerator<{
    chunk: string;
    complete: boolean;
    confidence: number;
  }> {
    if (!this.isAvailable) {
      throw new Error('LM Studio server is not available');
    }

    const messages = this.formatMessages(prompt, context);
    
    try {
      const response = await this.httpClient.post('/v1/chat/completions', {
        model: await this.getOptimalModel(),
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true
      }, {
        responseType: 'stream'
      });

      let buffer = '';
      let confidence = 0.5; // Initial confidence

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              yield { chunk: '', complete: true, confidence: this.finalConfidence(buffer) };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              
              if (content) {
                buffer += content;
                confidence = this.calculateStreamingConfidence(buffer);
                yield { chunk: content, complete: false, confidence };
              }
            } catch (e) {
              // Ignore JSON parse errors for streaming
            }
          }
        }
      }
    } catch (error) {
      logger.error('LM Studio streaming failed:', error);
      throw error;
    }
  }

  /**
   * Format messages for LM Studio API
   */
  private formatMessages(prompt: string, context: string[]): Array<{role: string, content: string}> {
    const messages = [
      {
        role: 'system',
        content: 'You are a expert programming assistant. Generate high-quality code with clear explanations. Focus on correctness, efficiency, and best practices.'
      }
    ];

    // Add context if provided
    if (context.length > 0) {
      messages.push({
        role: 'user',
        content: `Context:\n${context.join('\n\n')}`
      });
    }

    // Add the main prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    return messages;
  }

  /**
   * Parse the LM Studio response to extract code and explanation
   */
  private parseCodeResponse(content: string): { code: string; explanation: string } {
    // Look for code blocks
    const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push(match[1].trim());
    }

    if (codeBlocks.length > 0) {
      const code = codeBlocks.join('\n\n');
      const explanation = content.replace(/```[\s\S]*?```/g, '').trim();
      return { code, explanation };
    }

    // If no code blocks found, treat entire content as code
    return {
      code: content,
      explanation: 'Generated code without explicit explanation'
    };
  }

  /**
   * Calculate confidence score for the generated response
   */
  private calculateConfidence(content: string, prompt: string, latency: number): number {
    let confidence = 0.5; // Base confidence

    // Factors that increase confidence
    if (content.includes('```')) confidence += 0.2; // Has code blocks
    if (content.length > 100) confidence += 0.1; // Substantial response
    if (latency < 5000) confidence += 0.1; // Fast response
    if (content.includes('function') || content.includes('class')) confidence += 0.1; // Contains code structures

    // Factors that decrease confidence  
    if (content.length < 50) confidence -= 0.2; // Too short
    if (latency > 15000) confidence -= 0.1; // Too slow
    if (content.includes('sorry') || content.includes("can't")) confidence -= 0.2; // Apologetic response

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate confidence for streaming responses
   */
  private calculateStreamingConfidence(buffer: string): number {
    // Simple heuristic for streaming confidence
    if (buffer.length < 20) return 0.3;
    if (buffer.includes('```')) return 0.8;
    if (buffer.length > 100) return 0.7;
    return 0.5;
  }

  /**
   * Final confidence calculation when streaming is complete
   */
  private finalConfidence(content: string): number {
    return this.calculateConfidence(content, '', 0);
  }

  /**
   * Get the optimal model for the current task
   */
  private async getOptimalModel(): Promise<string> {
    const models = await this.getAvailableModels();
    
    // Prefer code-focused models
    const preferredModels = [
      'codellama-7b-instruct',
      'gemma-2b-it', 
      'qwen2.5-coder',
      'deepseek-coder'
    ];

    for (const preferred of preferredModels) {
      const found = models.find(model => model.toLowerCase().includes(preferred.toLowerCase()));
      if (found) return found;
    }

    // Fallback to first available model
    return models[0] || 'default';
  }

  /**
   * Get client status and metrics
   */
  getStatus(): {
    available: boolean;
    lastHealthCheck: number;
    endpoint: string;
    config: LMStudioConfig;
  } {
    return {
      available: this.isAvailable,
      lastHealthCheck: this.lastHealthCheck,
      endpoint: this.config.endpoint,
      config: this.config
    };
  }
}
