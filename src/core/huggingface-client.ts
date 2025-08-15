import { logger } from './logger.js';
import chalk from 'chalk';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

export interface HuggingFaceConfig {
  apiKey?: string;
  modelId: string;
  cacheDir?: string;
  useInferenceAPI?: boolean;
  maxRetries?: number;
}

export interface ModelInfo {
  id: string;
  pipeline_tag: string;
  library_name: string;
  model_size?: number;
  downloads?: number;
  likes?: number;
  tags?: string[];
}

/**
 * Hugging Face client for GPT-OSS-20B model
 * Provides automatic download, caching, and inference capabilities
 */
export class HuggingFaceClient {
  private config: HuggingFaceConfig;
  private modelPath: string;
  private isModelLoaded = false;
  private transformersAvailable = false;
  private ollamaAvailable = false;
  
  constructor(config?: Partial<HuggingFaceConfig>) {
    this.config = {
      modelId: 'openai/gpt-oss-20b',
      cacheDir: path.join(process.env.HOME || process.env.USERPROFILE || '.', '.codecrucible', 'models'),
      useInferenceAPI: false,
      maxRetries: 3,
      ...config
    };
    
    this.modelPath = path.join(this.config.cacheDir!, this.config.modelId.replace('/', '_'));
  }

  /**
   * Initialize the client and check available backends
   */
  async initialize(): Promise<void> {
    logger.info('🤗 Initializing Hugging Face client for GPT-OSS-20B...');
    
    // Check Python and transformers availability
    await this.checkTransformers();
    
    // Check Ollama availability as fallback
    await this.checkOllama();
    
    // Ensure model is available
    await this.ensureModel();
    
    logger.info('✅ Hugging Face client initialized successfully');
  }

  /**
   * Check if transformers library is available
   */
  private async checkTransformers(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('python -c "import transformers; print(transformers.__version__)"');
      logger.info(`📦 Transformers version: ${stdout.trim()}`);
      this.transformersAvailable = true;
      return true;
    } catch (error) {
      logger.warn('⚠️ Transformers not found. Attempting to install...');
      try {
        await this.installTransformers();
        this.transformersAvailable = true;
        return true;
      } catch (installError) {
        logger.warn('❌ Could not install transformers. Will use fallback methods.');
        this.transformersAvailable = false;
        return false;
      }
    }
  }

  /**
   * Install transformers and dependencies
   */
  private async installTransformers(): Promise<void> {
    logger.info('📦 Installing transformers and dependencies...');
    logger.info('This may take a few minutes on first run...');
    
    const packages = [
      'transformers',
      'torch',
      'accelerate',
      'sentencepiece',
      'protobuf',
      'huggingface-hub'
    ];
    
    try {
      // Check if pip is available
      try {
        await execAsync('pip --version');
      } catch {
        logger.error('pip is not installed. Please install Python and pip first.');
        logger.info('Visit: https://www.python.org/downloads/');
        return;
      }
      
      // Actually run the installation with visible output
      const command = `pip install ${packages.join(' ')}`;
      logger.info(`Running: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minute timeout for installation
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      if (stdout) logger.debug('Install output:', stdout);
      if (stderr && !stderr.includes('WARNING')) logger.warn('Install warnings:', stderr);
      
      logger.info('✅ Transformers installed successfully');
    } catch (error) {
      logger.error('Failed to install transformers:', error);
      logger.info('You can manually install with: pip install transformers torch');
      throw error;
    }
  }

  /**
   * Check if Ollama is available and has the model
   */
  private async checkOllama(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('ollama list');
      this.ollamaAvailable = true;
      
      // Check if gpt-oss:20b is already in Ollama
      if (stdout.includes('gpt-oss:20b')) {
        logger.info('✅ GPT-OSS-20B already available in Ollama');
        return true;
      }
      
      // Try to pull the model
      logger.info('📥 Pulling GPT-OSS-20B into Ollama...');
      await execAsync('ollama pull gpt-oss:20b');
      logger.info('✅ GPT-OSS-20B pulled successfully');
      return true;
      
    } catch (error) {
      logger.warn('⚠️ Ollama not available or model pull failed');
      this.ollamaAvailable = false;
      return false;
    }
  }

  /**
   * Ensure the model is downloaded and available
   */
  private async ensureModel(): Promise<void> {
    // Check if model already exists locally
    try {
      await fs.access(this.modelPath);
      logger.info('✅ Model already cached locally');
      this.isModelLoaded = true;
      return;
    } catch {
      // Model not cached, need to download
    }

    // If we have API key, try Inference API first
    if (this.config.apiKey && this.config.useInferenceAPI) {
      logger.info('🌐 Will use Hugging Face Inference API');
      this.isModelLoaded = true;
      return;
    }

    // Download model weights
    await this.downloadModel();
  }

  /**
   * Download model from Hugging Face Hub
   */
  private async downloadModel(): Promise<void> {
    logger.info('📥 Downloading GPT-OSS-20B from Hugging Face...');
    logger.info('⚠️ This is a 21.5B parameter model and may take some time...');
    
    try {
      // Create cache directory
      await fs.mkdir(this.config.cacheDir!, { recursive: true });
      
      // Use huggingface-cli if available
      try {
        await execAsync(
          `huggingface-cli download ${this.config.modelId} --local-dir ${this.modelPath} --include "*.safetensors" "*.json" "*.txt"`,
          { timeout: 600000 } // 10 minute timeout
        );
        logger.info('✅ Model downloaded successfully');
        this.isModelLoaded = true;
        return;
      } catch {
        logger.warn('huggingface-cli not found, using direct download...');
      }

      // Fallback to direct download of essential files
      const essentialFiles = [
        'config.json',
        'tokenizer.json',
        'tokenizer_config.json',
        'model.safetensors.index.json'
      ];

      for (const file of essentialFiles) {
        await this.downloadFile(
          `https://huggingface.co/${this.config.modelId}/resolve/main/${file}`,
          path.join(this.modelPath, file)
        );
      }

      logger.info('✅ Essential model files downloaded');
      this.isModelLoaded = true;
      
    } catch (error) {
      logger.error('Failed to download model:', error);
      throw new Error('Could not download GPT-OSS-20B model');
    }
  }

  /**
   * Download a single file
   */
  private async downloadFile(url: string, destination: string): Promise<void> {
    const dir = path.dirname(destination);
    await fs.mkdir(dir, { recursive: true });
    
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      headers: this.config.apiKey ? {
        'Authorization': `Bearer ${this.config.apiKey}`
      } : {}
    });
    
    await pipeline(
      response.data,
      createWriteStream(destination)
    );
  }

  /**
   * Generate text using the best available method
   */
  async generate(prompt: string, options?: {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    reasoningLevel?: 'low' | 'medium' | 'high';
  }): Promise<string> {
    const opts = {
      maxTokens: 1024,
      temperature: 0.7,
      stream: false,
      reasoningLevel: 'medium' as 'low' | 'medium' | 'high',
      ...options
    };

    // Format prompt with reasoning level
    const formattedPrompt = this.formatPrompt(prompt, opts.reasoningLevel as 'low' | 'medium' | 'high');

    // Try methods in order of preference
    const methods = [
      () => this.generateWithTransformers(formattedPrompt, opts),
      () => this.generateWithOllama(formattedPrompt, opts),
      () => this.generateWithInferenceAPI(formattedPrompt, opts),
      () => this.generateFallback(prompt)
    ];

    for (const method of methods) {
      try {
        return await method();
      } catch (error) {
        logger.debug(`Method failed, trying next: ${error}`);
        continue;
      }
    }

    throw new Error('All generation methods failed. Please ensure Python/Transformers or Ollama is installed.');
  }

  /**
   * Format prompt with GPT-OSS harmony format
   */
  private formatPrompt(prompt: string, reasoningLevel: 'low' | 'medium' | 'high'): string {
    return `<|system|>
You are GPT-OSS, an AI assistant created by OpenAI.
Reasoning: ${reasoningLevel}
<|end|>
<|user|>
${prompt}
<|end|>
<|assistant|>`;
  }

  /**
   * Generate using transformers library
   */
  private async generateWithTransformers(prompt: string, options: any): Promise<string> {
    if (!this.transformersAvailable) {
      throw new Error('Transformers not available');
    }

    const pythonScript = `
import sys
import json
from transformers import pipeline
import torch

model_id = "${this.config.modelId}"
prompt = json.loads(sys.argv[1])
max_tokens = int(sys.argv[2])
temperature = float(sys.argv[3])

pipe = pipeline(
    "text-generation",
    model=model_id,
    torch_dtype="auto",
    device_map="auto",
    trust_remote_code=True
)

result = pipe(
    prompt,
    max_new_tokens=max_tokens,
    temperature=temperature,
    do_sample=True,
    return_full_text=False
)

print(json.dumps(result[0]["generated_text"]))
`;

    const scriptPath = path.join(this.config.cacheDir!, 'generate.py');
    await fs.writeFile(scriptPath, pythonScript);

    try {
      const { stdout } = await execAsync(
        `python "${scriptPath}" "${JSON.stringify(prompt).replace(/"/g, '\\"')}" ${options.maxTokens} ${options.temperature}`,
        { timeout: 60000 }
      );
      
      const result = JSON.parse(stdout.trim());
      return result;
    } catch (error) {
      logger.error('Transformers generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate using Ollama
   */
  private async generateWithOllama(prompt: string, options: any): Promise<string> {
    if (!this.ollamaAvailable) {
      throw new Error('Ollama not available');
    }

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'gpt-oss:20b',
        prompt,
        stream: false,
        options: {
          num_predict: options.maxTokens,
          temperature: options.temperature
        }
      });

      return response.data.response;
    } catch (error) {
      logger.error('Ollama generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate using Hugging Face Inference API
   */
  private async generateWithInferenceAPI(prompt: string, options: any): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('No API key for Inference API');
    }

    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.config.modelId}`,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: options.maxTokens,
            temperature: options.temperature,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data[0].generated_text;
    } catch (error) {
      logger.error('Inference API generation failed:', error);
      throw error;
    }
  }

  /**
   * Fallback generation when all methods fail
   */
  private generateFallback(prompt: string): string {
    logger.warn('⚠️ Using fallback generation (no model available)');
    
    const responses = {
      'code': 'I would generate code here, but no model backend is available. Please install Transformers or Ollama.',
      'explain': 'I would provide an explanation, but no model backend is available.',
      'debug': 'I would help debug, but no model backend is available.',
      'default': 'GPT-OSS-20B model is not available. Please ensure Python/Transformers or Ollama is installed.'
    };

    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('class')) {
      return responses.code;
    }
    if (lowerPrompt.includes('explain') || lowerPrompt.includes('what') || lowerPrompt.includes('how')) {
      return responses.explain;
    }
    if (lowerPrompt.includes('debug') || lowerPrompt.includes('error') || lowerPrompt.includes('fix')) {
      return responses.debug;
    }
    
    return responses.default;
  }

  /**
   * Get model information from Hugging Face
   */
  async getModelInfo(): Promise<ModelInfo> {
    try {
      const response = await axios.get(
        `https://huggingface.co/api/models/${this.config.modelId}`,
        {
          headers: this.config.apiKey ? {
            'Authorization': `Bearer ${this.config.apiKey}`
          } : {}
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get model info:', error);
      throw error;
    }
  }

  /**
   * Check if model is ready for use
   */
  isReady(): boolean {
    return this.isModelLoaded && (this.transformersAvailable || this.ollamaAvailable);
  }

  /**
   * Get status information
   */
  getStatus(): {
    modelLoaded: boolean;
    transformers: boolean;
    ollama: boolean;
    inferenceAPI: boolean;
    modelPath: string;
  } {
    return {
      modelLoaded: this.isModelLoaded,
      transformers: this.transformersAvailable,
      ollama: this.ollamaAvailable,
      inferenceAPI: !!this.config.apiKey && this.config.useInferenceAPI!,
      modelPath: this.modelPath
    };
  }
}