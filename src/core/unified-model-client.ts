import { logger } from './logger.js';
import { HuggingFaceClient } from './huggingface-client.js';
import { LocalModelClient, LocalModelConfig, VoiceResponse, ProjectContext } from './local-model-client.js';
import chalk from 'chalk';
import axios from 'axios';

export interface UnifiedModelConfig {
  primaryModel: 'gpt-oss-20b' | 'auto';
  huggingfaceApiKey?: string;
  ollamaEndpoint?: string;
  fallbackToOllama?: boolean;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Unified Model Client that embeds GPT-OSS-20B with automatic fallback
 * Priority: GPT-OSS-20B (HuggingFace) -> GPT-OSS-20B (Ollama) -> Other Ollama models
 */
export class UnifiedModelClient {
  private huggingfaceClient: HuggingFaceClient;
  private ollamaClient: LocalModelClient | null = null;
  private config: UnifiedModelConfig;
  private isInitialized = false;
  private currentBackend: 'huggingface' | 'ollama' | 'fallback' = 'huggingface';

  constructor(config?: Partial<UnifiedModelConfig>) {
    this.config = {
      primaryModel: 'gpt-oss-20b',
      ollamaEndpoint: 'http://localhost:11434',
      fallbackToOllama: true,
      timeout: 5000,
      maxTokens: 2048,
      temperature: 0.7,
      ...config
    };

    // Initialize Hugging Face client for GPT-OSS-20B
    this.huggingfaceClient = new HuggingFaceClient({
      apiKey: this.config.huggingfaceApiKey,
      modelId: 'openai/gpt-oss-20b'
    });

    // Initialize Ollama client as fallback
    if (this.config.fallbackToOllama) {
      this.ollamaClient = new LocalModelClient({
        endpoint: this.config.ollamaEndpoint!,
        model: 'gpt-oss:20b', // Try to use GPT-OSS in Ollama too
        timeout: this.config.timeout!,
        maxTokens: this.config.maxTokens!,
        temperature: this.config.temperature!
      });
    }
  }

  /**
   * Initialize and ensure GPT-OSS-20B is available
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Initialize Hugging Face client
    try {
      await this.huggingfaceClient.initialize();
      const status = this.huggingfaceClient.getStatus();
      
      if (status.modelLoaded && (status.transformers || status.ollama || status.inferenceAPI)) {
        logger.info(chalk.green('✅ GPT-OSS-20B ready via Hugging Face'));
        this.currentBackend = 'huggingface';
      }
    } catch (error) {
      logger.warn('⚠️ Hugging Face initialization failed, will use fallback');
    }

    // Check if GPT-OSS is available in Ollama
    if (this.ollamaClient && this.config.fallbackToOllama) {
      try {
        await this.ensureGptOssInOllama();
      } catch (error) {
        logger.warn('⚠️ Could not setup GPT-OSS in Ollama');
      }
    }

    this.isInitialized = true;
    this.displayStatus();
  }

  /**
   * Ensure GPT-OSS-20B is available in Ollama
   */
  private async ensureGptOssInOllama(): Promise<void> {
    try {
      // Check if Ollama is running
      const response = await axios.get(`${this.config.ollamaEndpoint}/api/tags`);
      const models = response.data.models || [];
      
      // Check if gpt-oss:20b is already installed
      const hasGptOss = models.some((m: any) => 
        m.name === 'gpt-oss:20b' || m.name.includes('gpt-oss')
      );

      if (!hasGptOss) {
        logger.info('📥 Installing GPT-OSS-20B in Ollama...');
        try {
          await axios.post(`${this.config.ollamaEndpoint}/api/pull`, {
            name: 'gpt-oss:20b'
          });
          logger.info('✅ GPT-OSS-20B installed in Ollama');
          this.currentBackend = 'ollama';
        } catch (pullError) {
          logger.warn('Could not pull GPT-OSS to Ollama, will use other models');
        }
      } else {
        logger.info('✅ GPT-OSS-20B already available in Ollama');
        this.currentBackend = 'ollama';
      }
    } catch (error) {
      logger.debug('Ollama not available:', error);
    }
  }

  /**
   * Display current status
   */
  private displayStatus(): void {
    console.log('');
    console.log(chalk.bold('📊 Model System Status:'));
    
    const hfStatus = this.huggingfaceClient.getStatus();
    
    console.log(chalk.cyan('  Hugging Face:'));
    console.log(`    • Model Loaded: ${hfStatus.modelLoaded ? '✅' : '❌'}`);
    console.log(`    • Transformers: ${hfStatus.transformers ? '✅' : '❌'}`);
    console.log(`    • Inference API: ${hfStatus.inferenceAPI ? '✅' : '❌'}`);
    
    if (this.ollamaClient) {
      console.log(chalk.cyan('  Ollama:'));
      console.log(`    • GPT-OSS-20B: ${this.currentBackend === 'ollama' ? '✅' : '⏳'}`);
    }
    
    console.log(chalk.bold.green(`\n  🎯 Primary Backend: ${this.currentBackend}`));
    console.log('');
  }

  /**
   * Generate text using GPT-OSS-20B with automatic fallback
   */
  async generate(prompt: string, options?: {
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
    reasoningLevel?: 'low' | 'medium' | 'high';
  }): Promise<string> {
    const opts = {
      stream: false,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      reasoningLevel: 'medium' as const,
      ...options
    };

    // Ensure initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    let lastError: Error | null = null;

    // Try Hugging Face first (with embedded GPT-OSS-20B)
    try {
      logger.debug('Attempting generation with Hugging Face GPT-OSS-20B...');
      const response = await this.huggingfaceClient.generate(prompt, opts);
      logger.info('✅ Generated with GPT-OSS-20B (Hugging Face)');
      return response;
    } catch (error) {
      lastError = error as Error;
      logger.debug('Hugging Face generation failed:', error);
    }

    // Try Ollama with GPT-OSS-20B
    if (this.ollamaClient && this.config.fallbackToOllama) {
      try {
        logger.debug('Attempting generation with Ollama GPT-OSS-20B...');
        const response = await this.generateWithOllama(prompt, opts, 'gpt-oss:20b');
        logger.info('✅ Generated with GPT-OSS-20B (Ollama)');
        return response;
      } catch (error) {
        lastError = error as Error;
        logger.debug('Ollama GPT-OSS generation failed:', error);
      }

      // Try other Ollama models as last resort
      try {
        logger.debug('Attempting generation with Ollama fallback models...');
        const response = await this.ollamaClient.generate(prompt);
        logger.info('✅ Generated with Ollama fallback model');
        return response;
      } catch (error) {
        lastError = error as Error;
        logger.debug('Ollama fallback generation failed:', error);
      }
    }

    // If all methods fail, provide helpful error
    const errorMessage = `Failed to generate response. Please ensure:
1. Python and transformers are installed: pip install transformers torch
2. Or Ollama is running: ollama serve
3. Or provide a Hugging Face API key

Last error: ${lastError?.message || 'Unknown error'}`;
    
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  /**
   * Generate with specific Ollama model
   */
  private async generateWithOllama(
    prompt: string, 
    options: any, 
    model: string
  ): Promise<string> {
    const response = await axios.post(
      `${this.config.ollamaEndpoint}/api/generate`,
      {
        model,
        prompt,
        stream: false,
        options: {
          num_predict: options.maxTokens,
          temperature: options.temperature
        }
      },
      { timeout: this.config.timeout }
    );

    return response.data.response;
  }

  /**
   * Generate voice response (for compatibility)
   */
  async generateVoiceResponse(
    prompt: string,
    voice: any,
    context?: ProjectContext
  ): Promise<VoiceResponse> {
    const systemPrompt = voice.systemPrompt || '';
    const fullPrompt = `${systemPrompt}\n\nContext: ${JSON.stringify(context || {})}\n\nUser: ${prompt}\n\nAssistant:`;
    
    const response = await this.generate(fullPrompt, {
      temperature: voice.temperature || 0.7,
      reasoningLevel: this.getReasoningLevel(prompt)
    });

    return {
      content: response,
      voice: voice.name,
      confidence: 0.9,
      reasoning: 'Generated with GPT-OSS-20B',
      tokens_used: response.length / 4 // Approximate
    };
  }

  /**
   * Determine reasoning level based on prompt
   */
  private getReasoningLevel(prompt: string): 'low' | 'medium' | 'high' {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('complex') || lower.includes('detailed') || lower.includes('comprehensive')) {
      return 'high';
    }
    
    if (lower.includes('simple') || lower.includes('quick') || lower.includes('brief')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Check if Ollama connection is available
   */
  async checkOllamaConnection(): Promise<boolean> {
    if (!this.ollamaClient) return false;
    return await this.ollamaClient.checkConnection();
  }

  /**
   * Get available models (for compatibility)
   */
  async getAvailableModels(): Promise<string[]> {
    const models = ['gpt-oss:20b'];
    
    if (this.ollamaClient) {
      try {
        const ollamaModels = await this.ollamaClient.getAvailableModels();
        models.push(...ollamaModels);
      } catch {
        // Ignore errors
      }
    }
    
    return [...new Set(models)]; // Remove duplicates
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return 'gpt-oss:20b';
  }

  /**
   * Display available models
   */
  async displayAvailableModels(): Promise<void> {
    console.log(chalk.bold.cyan('\n🤖 Model Information:'));
    console.log(chalk.green('  Primary Model: GPT-OSS-20B (21.5B parameters)'));
    console.log(chalk.gray('  • Designed for powerful reasoning and agentic tasks'));
    console.log(chalk.gray('  • Configurable reasoning levels: low, medium, high'));
    console.log(chalk.gray('  • Apache 2.0 license - fully open source'));
    
    const status = this.huggingfaceClient.getStatus();
    console.log(chalk.cyan('\n  Available Backends:'));
    
    if (status.transformers) {
      console.log(chalk.green('  ✅ Transformers (Local Python)'));
    }
    if (status.ollama) {
      console.log(chalk.green('  ✅ Ollama (Local Server)'));
    }
    if (status.inferenceAPI) {
      console.log(chalk.green('  ✅ Hugging Face Inference API'));
    }
    
    console.log('');
  }

  /**
   * Select model (for compatibility - always uses GPT-OSS-20B)
   */
  async selectModel(): Promise<void> {
    console.log(chalk.yellow('ℹ️ This app is configured to use GPT-OSS-20B exclusively'));
    console.log(chalk.gray('   The model will automatically use the best available backend'));
  }

  /**
   * Get model info
   */
  async getModelInfo(): Promise<any> {
    try {
      return await this.huggingfaceClient.getModelInfo();
    } catch (error) {
      return {
        id: 'openai/gpt-oss-20b',
        pipeline_tag: 'text-generation',
        library_name: 'transformers',
        model_size: 21500000000,
        description: 'Open-weight model designed for powerful reasoning and agentic tasks'
      };
    }
  }
}