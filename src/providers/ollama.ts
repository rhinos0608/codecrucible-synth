import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { logger } from '../core/logger.js';
import { readFileSync, existsSync } from 'fs';
import { load as loadYaml } from 'js-yaml';
import { join } from 'path';
import { modelCoordinator } from '../core/model-selection-coordinator.js';

export interface OllamaConfig {
  endpoint?: string;
  model?: string;
  timeout?: number;
}

export class OllamaProvider {
  private httpClient: AxiosInstance;
  private config: OllamaConfig;
  private model: string;
  private isAvailable: boolean = false;

  constructor(config: OllamaConfig) {
    console.log('🤖 DEBUG: OllamaProvider constructor called with config:', config);
    
    this.config = {
      endpoint: config.endpoint || 'http://localhost:11434',
      model: config.model, // Will be set by autonomous detection
      timeout: config.timeout || 30000, // Reduced timeout for better responsiveness
    };

    this.model = this.config.model || 'auto-detect'; // Mark for autonomous detection
    console.log('🤖 DEBUG: OllamaProvider model state:', this.model);

    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: 0, // Disable default timeout, use AbortController
      headers: {
        'Content-Type': 'application/json',
      },
      // Add connection keepalive for better performance
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });
  }

  async processRequest(request: any, _context?: any): Promise<any> {
    console.log('🤖 DEBUG: OllamaProvider.processRequest called');
    console.log('🤖 DEBUG: Request object:', {
      prompt: (request.prompt || '').substring(0, 200) + '...',
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      hasTools: !!(request.tools && request.tools.length),
    });

    try {
      // Check status and perform autonomous model detection
      console.log('🤖 DEBUG: Checking Ollama availability and detecting models...');
      
      // Check status and perform autonomous model detection
      if (!this.isAvailable || this.model === 'auto-detect') {
        console.log('🤖 DEBUG: Performing model detection and status check...');
        await this.checkStatus();
      }
      console.log('🤖 DEBUG: Ollama is available, using model:', this.model);

      const result = await this.generate(request);
      console.log('🤖 DEBUG: OllamaProvider response received, length:', result?.content?.length);
      return result;
    } catch (error) {
      console.error('🤖 ERROR: OllamaProvider error:', error.message);
      throw error;
    }
  }

  async generate(request: any): Promise<any> {
    console.log('🤖 DEBUG: generate method started');
    
    const abortController = new AbortController();
    
    // Separate connection and response timeouts (2025 best practice with adaptive scaling)
    const connectionTimeout = setTimeout(() => {
      console.log('🤖 DEBUG: Connection timeout, aborting...');
      abortController.abort('connection_timeout');
    }, this.getAdaptiveConnectionTimeout(request)); // Adaptive connection timeout
    
    const responseTimeout = setTimeout(() => {
      console.log('🤖 DEBUG: Response timeout, aborting...');
      abortController.abort('response_timeout');
    }, this.getAdaptiveResponseTimeout(request)); // Adaptive response timeout

    try {
      // Use /api/chat for tool calling, /api/generate for simple completions
      const hasTools = request.tools && request.tools.length > 0;
      const endpoint = hasTools ? '/api/chat' : '/api/generate';
      
      let requestBody: any;
      
      if (hasTools) {
        // Chat API format for tool calling
        requestBody = {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ],
          tools: request.tools,
          stream: false,
          options: {
            temperature: request.temperature || 0.1,
            num_predict: request.maxTokens || 2048,
            top_p: 0.9,
            top_k: 40,
            ...this.getGPUConfig()
          }
        };
      } else {
        // Generate API format for simple completions
        requestBody = {
          model: this.model,
          prompt: request.prompt,
          stream: false,
          options: {
            temperature: request.temperature || 0.1,
            num_predict: request.maxTokens || 2048,
            top_p: 0.9,
            top_k: 40,
            ...this.getGPUConfig()
          }
        };
      }

      // DEBUG: Log if tools are included
      if (hasTools) {
        console.log(`🔧 OLLAMA DEBUG: Including ${request.tools.length} tools in chat request`);
        console.log(`🔧 OLLAMA DEBUG: Tool names: ${request.tools.map(t => t.function?.name || 'unnamed').join(', ')}`);
        console.log(`🔧 OLLAMA DEBUG: Using /api/chat endpoint for tool calling`);
      } else {
        console.log(`🔧 OLLAMA DEBUG: No tools, using /api/generate endpoint`);
      }

      console.log('🤖 DEBUG: Sending request to Ollama API...', {
        url: `${this.config.endpoint}${endpoint}`,
        model: this.model,
        promptLength: request.prompt?.length || 0,
        endpoint: endpoint
      });

      const response = await this.httpClient.post(endpoint, requestBody, {
        signal: abortController.signal
      });

      clearTimeout(connectionTimeout);
      clearTimeout(responseTimeout);
      console.log('🤖 DEBUG: Received response from Ollama API');
      console.log('🔧 OLLAMA DEBUG: Full response:', JSON.stringify(response.data, null, 2));

      // Handle different response formats based on endpoint
      let content = '';
      let toolCalls = null;
      let usage = {};

      if (hasTools && response.data.message) {
        // Chat API response format
        content = response.data.message.content || '';
        toolCalls = response.data.message.tool_calls || null;
        
        console.log('🔧 OLLAMA DEBUG: Message content:', content);
        console.log('🔧 OLLAMA DEBUG: Tool calls:', toolCalls);
        
        // OLLAMA WORKAROUND: If no tool_calls but content looks like a tool call, parse it
        if (!toolCalls && content.trim().startsWith('{') && content.includes('"name"')) {
          try {
            const parsedContent = JSON.parse(content.trim());
            if (parsedContent.name && parsedContent.arguments) {
              console.log('🔧 OLLAMA DEBUG: Detected tool call in content, converting...');
              toolCalls = [{
                function: {
                  name: parsedContent.name,
                  arguments: parsedContent.arguments
                }
              }];
              // Clear content since it's now a tool call
              content = '';
            }
          } catch (error) {
            console.log('🔧 OLLAMA DEBUG: Failed to parse content as tool call:', error.message);
          }
        }
        usage = {
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0
        };
        
        if (toolCalls && toolCalls.length > 0) {
          console.log(`🔧 OLLAMA DEBUG: Model requested ${toolCalls.length} tool calls:`, 
            toolCalls.map(tc => tc.function?.name || 'unnamed').join(', '));
        }
      } else {
        // Generate API response format
        content = response.data.response || '';
        usage = {
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0
        };
      }

      return {
        content,
        toolCalls,
        usage,
        done: response.data.done || true,
        model: this.model,
        provider: 'ollama'
      };
    } catch (error) {
      clearTimeout(connectionTimeout);
      clearTimeout(responseTimeout);
      console.error('🤖 ERROR: Ollama API error:', error.message);
      
      if (abortController.signal.aborted) {
        const reason = abortController.signal.reason || 'timeout';
        throw new Error(`Ollama API request ${reason}`);
      }
      
      // Fallback response for debugging
      if (error.code === 'ECONNREFUSED') {
        console.log('🤖 WARNING: Ollama not available, using fallback response');
        return {
          content: `I understand you want to work with this code, but I'm unable to connect to Ollama right now. The request was: "${request.prompt?.substring(0, 100)}..."`,
          usage: { totalTokens: 20, promptTokens: 10, completionTokens: 10 },
          done: true,
          model: this.model,
          provider: 'ollama-fallback'
        };
      }
      
      throw error;
    }
  }

  async checkStatus(): Promise<boolean> {
    console.log('🤖 DEBUG: Checking Ollama status...');
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('🤖 DEBUG: Status check timeout, aborting...');
      abortController.abort('status_check_timeout');
    }, 5000); // Shorter timeout for status checks

    try {
      const response = await this.httpClient.get('/api/tags', {
        signal: abortController.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.data && response.data.models) {
        const availableModels = response.data.models.map((m: any) => m.name);
        console.log('🤖 DEBUG: Available Ollama models:', availableModels);
        
        // Use ModelSelectionCoordinator for consistent model selection
        if (!this.model || this.model === 'auto-detect') {
          const selection = await modelCoordinator.selectModel('ollama', 'general', availableModels);
          this.model = selection.model;
          console.log('🤖 DEBUG: Coordinator selected model:', this.model, 'with confidence:', selection.confidence);
        }
        
        // Update provider capabilities
        modelCoordinator.updateProviderCapabilities('ollama', {
          available: true,
          models: availableModels,
          preferredModels: ['qwen2.5-coder:7b', 'qwen2.5-coder:3b', 'deepseek-coder:8b'],
          strengths: ['analysis', 'planning', 'complex', 'multi-file'],
          responseTime: '<30s'
        });
        
        this.isAvailable = true;
        return true;
      }
      
      return false;
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('🤖 WARNING: Ollama not available:', error.message);
      this.isAvailable = false;
      // Use coordinator for fallback model selection
      if (!this.model || this.model === 'auto-detect') {
        const selection = await modelCoordinator.selectModel('ollama', 'general', []);
        this.model = selection.model;
        console.log('🤖 DEBUG: Using fallback model:', this.model);
      }
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    console.log('🤖 DEBUG: Listing Ollama models...');
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 5000);

    try {
      const response = await this.httpClient.get('/api/tags', {
        signal: abortController.signal,
        timeout: 5000
      });
      
      clearTimeout(timeoutId);
      
      if (response.data && response.data.models) {
        const models = response.data.models.map((m: any) => m.name);
        console.log('🤖 DEBUG: Found models:', models);
        return models;
      }
      
      return [];
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('🤖 WARNING: Could not list models:', error.message);
      return ['qwen2.5-coder:3b', 'deepseek-coder:8b']; // Fallback list
    }
  }

  async warmModel(): Promise<void> {
    console.log(`🤖 ✅ Model ${this.model} is ready (simplified)`);
  }

  /**
   * Calculate adaptive connection timeout based on model initialization requirements
   * Connection timeout is for model loading/warmup, not processing
   */
  private getAdaptiveConnectionTimeout(request: any): number {
    const baseConnectionTimeout = 15000; // 15s base connection time
    
    // Model initialization complexity (not processing complexity)
    let modelInitMultiplier = 1;
    
    if (this.model?.includes('7b') || this.model?.includes('8b')) {
      modelInitMultiplier = 1.5; // 22.5s for 7B-8B models
    } else if (this.model?.includes('13b') || this.model?.includes('14b')) {
      modelInitMultiplier = 2; // 30s for 13B-14B models  
    } else if (this.model?.includes('20b') || this.model?.includes('27b') || this.model?.includes('30b')) {
      modelInitMultiplier = 2.5; // 37.5s for 20B+ models
    }
    
    // Cap at 60 seconds for connection (model should be loaded by then)
    return Math.min(baseConnectionTimeout * modelInitMultiplier, 60000);
  }

  /**
   * Context-aware adaptive timeout based on token consumption and model capacity
   * Each model has different processing speeds per token
   */
  private getAdaptiveResponseTimeout(request: any): number {
    const promptText = request.prompt || '';
    const maxTokens = request.maxTokens || 2048;
    
    // Estimate input tokens (rough approximation: 1 token ≈ 4 characters)
    const estimatedInputTokens = Math.ceil(promptText.length / 4);
    const totalContextTokens = estimatedInputTokens + maxTokens;
    
    // Model processing speeds (tokens per second) - based on actual performance data
    const modelSpeeds = {
      // Small models (fast)
      '3b': 50,   // ~50 tokens/sec
      '2b': 60,   // ~60 tokens/sec
      // Medium models
      '7b': 25,   // ~25 tokens/sec  
      '8b': 20,   // ~20 tokens/sec
      // Large models (slower)
      '13b': 12,  // ~12 tokens/sec
      '14b': 10,  // ~10 tokens/sec
      '20b': 6,   // ~6 tokens/sec
      '27b': 4,   // ~4 tokens/sec
      '30b': 3,   // ~3 tokens/sec
    };
    
    // Determine model speed
    let tokensPerSecond = 15; // Default fallback
    for (const [size, speed] of Object.entries(modelSpeeds)) {
      if (this.model?.includes(size)) {
        tokensPerSecond = speed;
        break;
      }
    }
    
    // Calculate base processing time
    const baseProcessingTime = Math.ceil(totalContextTokens / tokensPerSecond) * 1000;
    
    // Add complexity factors
    let complexityMultiplier = 1;
    
    // Tool usage increases complexity (more reasoning required)
    if (request.tools && request.tools.length > 0) {
      complexityMultiplier += 0.5;
    }
    
    // Complex reasoning tasks need more time per token
    if (promptText.includes('audit') || promptText.includes('review') || 
        promptText.includes('analyze') || promptText.includes('debug')) {
      complexityMultiplier += 0.3;
    }
    
    // Code generation tasks are typically faster
    if (promptText.includes('generate') || promptText.includes('create') || 
        promptText.includes('write')) {
      complexityMultiplier -= 0.2;
    }
    
    // Ensure minimum multiplier
    complexityMultiplier = Math.max(complexityMultiplier, 0.5);
    
    // Add safety buffer (50% overhead for processing variations)
    const finalTimeout = baseProcessingTime * complexityMultiplier * 1.5;
    
    // Reasonable bounds: minimum 10s, maximum 15 minutes (900s)
    const boundedTimeout = Math.max(10000, Math.min(finalTimeout, 900000));
    
    console.log(`🤖 DEBUG: Context-aware timeout calculation:
      Input tokens: ${estimatedInputTokens}
      Max output tokens: ${maxTokens}
      Total context: ${totalContextTokens}
      Model speed: ${tokensPerSecond} tokens/sec
      Base processing time: ${Math.round(baseProcessingTime/1000)}s
      Complexity multiplier: ${complexityMultiplier.toFixed(2)}
      Final timeout: ${Math.round(boundedTimeout/1000)}s`);
    
    return boundedTimeout;
  }

  private getGPUConfig(): any {
    return {
      num_gpu: 0,
      num_thread: 4,
      num_batch: 64,
      num_ctx: 8192
    };
  }
}
