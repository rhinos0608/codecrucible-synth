import { logger } from './logger.js';
import { AutonomousErrorHandler } from './autonomous-error-handler.js';
import { AdvancedQuantizationOptimizer, QuantizationRecommendation, UseCase } from './advanced-quantization-optimizer.js';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import axios from 'axios';

const execAsync = promisify(exec);

export interface SystemSpecs {
  cpu: {
    cores: number;
    threads: number;
    frequency: number;
    usage: number;
  };
  memory: {
    total: number;
    available: number;
    usage: number;
  };
  gpu: {
    available: boolean;
    vram: number;
    type: 'nvidia' | 'amd' | 'intel' | 'none';
  };
}

export interface ModelCapability {
  name: string;
  provider: 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'google' | 'huggingface';
  type: 'local' | 'api';
  strengths: string[];
  weaknesses: string[];
  recommendedFor: string[];
  size: 'small' | 'medium' | 'large';
  speed: 'fast' | 'medium' | 'slow';
  requirements: {
    minRam: number; // MB
    minVram?: number; // MB
    minCores: number;
  };
  apiKey?: string;
  endpoint?: string;
  contextWindow?: number;
}

export interface TaskRoutingDecision {
  selectedLLM: 'lmstudio' | 'ollama' | 'hybrid';
  confidence: number;
  reasoning: string;
  fallbackStrategy: string;
  escalationThreshold?: number;
}

export interface HybridRoutingConfig {
  enabled: boolean;
  defaultProvider: 'auto' | 'lmstudio' | 'ollama';
  escalationThreshold: number;
  confidenceScoring: boolean;
  learningEnabled: boolean;
  lmStudio: {
    endpoint: string;
    enabled: boolean;
    models: string[];
    taskTypes: string[];
    streamingEnabled: boolean;
    maxConcurrent: number;
  };
  ollama: {
    endpoint: string;
    enabled: boolean;
    models: string[];
    taskTypes: string[];
    maxConcurrent: number;
  };
  routing: {
    escalationThreshold: number;
    rules: RoutingRule[];
  };
}

export interface RoutingRule {
  condition: string;
  target: 'lmstudio' | 'ollama';
  confidence: number;
  description: string;
}

export interface RoutingMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  escalationRate: number;
  lastUpdated: number;
}

export interface TaskClassification {
  type: string;
  complexity: 'simple' | 'medium' | 'complex';
  confidence: number;
  reasoning: string;
  suggestedProvider: 'lmstudio' | 'ollama';
}

/**
 * Intelligent Model Selector with Hybrid LLM Routing
 * 
 * Automatically selects the best model for each task based on:
 * - Task requirements and complexity
 * - Available resources
 * - Historical performance
 * - Model capabilities
 * - Hybrid routing between LM Studio and Ollama
 */
export class IntelligentModelSelector {
  private errorHandler: AutonomousErrorHandler;
  private performanceHistory = new Map<string, number[]>();
  private quantizationOptimizer: AdvancedQuantizationOptimizer;
  private hybridConfig: HybridRoutingConfig;
  private routingMetrics = new Map<string, RoutingMetrics>();
  
  private systemSpecs?: SystemSpecs;
  private availableModels: string[] = [];
  private lastModelCheck = 0;
  private optimizationCache = new Map<string, ModelOptimizationResult>();

  // Model capability database with system requirements
  private modelCapabilities: ModelCapability[] = [
    {
      name: 'codellama:34b',
      provider: 'ollama',
      type: 'local',
      strengths: ['code generation', 'debugging', 'code analysis', 'complex coding'],
      weaknesses: ['general chat', 'creative writing', 'slower than smaller models'],
      recommendedFor: ['complex_coding', 'debugging', 'code_review'],
      size: 'large',
      speed: 'slow',
      requirements: { minRam: 16384, minVram: 16384, minCores: 4 },
      contextWindow: 8192
    },
    {
      name: 'codellama:7b',
      provider: 'ollama',
      type: 'local',
      strengths: ['fast responses', 'lightweight'],
      weaknesses: ['complex tasks', 'accuracy'],
      recommendedFor: ['simple_coding', 'quick_help'],
      size: 'small',
      speed: 'fast',
      requirements: { minRam: 4096, minVram: 4096, minCores: 2 },
      contextWindow: 4096
    },
    {
      name: 'llama3.1:70b',
      provider: 'ollama',
      type: 'local',
      strengths: ['reasoning', 'complex tasks', 'accuracy'],
      weaknesses: ['speed', 'resource usage'],
      recommendedFor: ['planning', 'analysis', 'complex_reasoning'],
      size: 'large',
      speed: 'slow',
      requirements: { minRam: 32768, minVram: 40960, minCores: 8 },
      contextWindow: 128000
    },
    {
      name: 'llama3.2:latest',
      provider: 'ollama',
      type: 'local',
      strengths: ['balance', 'general purpose', 'good speed'],
      weaknesses: ['not specialized'],
      recommendedFor: ['general', 'chat', 'mixed_tasks'],
      size: 'small',
      speed: 'fast',
      requirements: { minRam: 2048, minCores: 1 },
      contextWindow: 8192
    },
    {
      name: 'llama3.2:8b',
      provider: 'ollama',
      type: 'local',
      strengths: ['balance', 'general purpose', 'good speed'],
      weaknesses: ['not specialized'],
      recommendedFor: ['general', 'chat', 'mixed_tasks'],
      size: 'medium',
      speed: 'medium',
      requirements: { minRam: 6144, minVram: 6144, minCores: 2 },
      contextWindow: 8192
    },
    {
      name: 'qwen2.5:72b',
      provider: 'ollama',
      type: 'local',
      strengths: ['multilingual', 'reasoning', 'coding'],
      weaknesses: ['speed', 'resource usage'],
      recommendedFor: ['complex_coding', 'analysis', 'planning'],
      size: 'large', 
      speed: 'slow',
      requirements: { minRam: 32768, minVram: 40960, minCores: 8 },
      contextWindow: 32768
    },
    {
      name: 'qwen2.5:7b',
      provider: 'ollama',
      type: 'local',
      strengths: ['fast', 'coding', 'lightweight'],
      weaknesses: ['complex reasoning'],
      recommendedFor: ['simple_coding', 'quick_tasks'],
      size: 'small',
      speed: 'fast',
      requirements: { minRam: 4096, minVram: 4096, minCores: 2 },
      contextWindow: 32768
    },
    {
      name: 'gemma2:27b',
      provider: 'ollama',
      type: 'local',
      strengths: ['reasoning', 'safety', 'accuracy'],
      weaknesses: ['speed'],
      recommendedFor: ['analysis', 'safe_operations'],
      size: 'large',
      speed: 'slow',
      requirements: { minRam: 16384, minVram: 20480, minCores: 4 },
      contextWindow: 8192
    },
    {
      name: 'gemma2:9b',
      provider: 'ollama',
      type: 'local',
      strengths: ['balanced', 'efficient', 'safe'],
      weaknesses: ['not specialized'],
      recommendedFor: ['general', 'safe_operations'],
      size: 'medium',
      speed: 'medium',
      requirements: { minRam: 6144, minVram: 6144, minCores: 2 },
      contextWindow: 8192
    },
    {
      name: 'gemma:latest',
      provider: 'ollama',
      type: 'local',
      strengths: ['general purpose', 'fast', 'reliable', 'good for coding', 'stable', 'tool usage'],
      weaknesses: ['not as powerful as larger models'],
      recommendedFor: ['coding', 'general', 'chat', 'simple_tasks', 'quick_help'],
      size: 'medium',
      speed: 'fast',
      requirements: { minRam: 4096, minVram: 4096, minCores: 2 },
      contextWindow: 4096
    },
    {
      name: 'gemma3n:e4b',
      provider: 'ollama',
      type: 'local',
      strengths: ['balanced', 'fast'],
      weaknesses: ['not as powerful as larger models', 'limited tool usage', 'weak reasoning'],
      recommendedFor: ['simple_tasks', 'quick_help'],
      size: 'small',
      speed: 'fast',
      requirements: { minRam: 6144, minVram: 6144, minCores: 2 },
      contextWindow: 8192
    },
    {
      name: 'gpt-oss:20b',
      provider: 'ollama',
      type: 'local',
      strengths: ['code generation', 'reasoning', 'analysis', 'debugging'],
      weaknesses: ['speed', 'resource usage', 'timeouts'],
      recommendedFor: ['complex_coding', 'debugging', 'code_review', 'analysis'],
      size: 'large',
      speed: 'slow',
      requirements: { minRam: 16384, minVram: 12288, minCores: 4 },
      contextWindow: 8192
    },
    // API Models
    {
      name: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      type: 'api',
      strengths: ['code generation', 'reasoning', 'analysis', 'complex tasks', 'tool calling'],
      weaknesses: ['cost per token', 'requires internet'],
      recommendedFor: ['complex_coding', 'analysis', 'planning', 'debugging'],
      size: 'large',
      speed: 'medium',
      requirements: { minRam: 1024, minCores: 1 },
      contextWindow: 200000,
      endpoint: 'https://api.anthropic.com/v1'
    },
    {
      name: 'gpt-4o',
      provider: 'openai',
      type: 'api',
      strengths: ['code generation', 'reasoning', 'multimodal', 'tool calling'],
      weaknesses: ['cost per token', 'requires internet'],
      recommendedFor: ['complex_coding', 'analysis', 'planning'],
      size: 'large',
      speed: 'medium',
      requirements: { minRam: 1024, minCores: 1 },
      contextWindow: 128000,
      endpoint: 'https://api.openai.com/v1'
    },
    {
      name: 'gemini-1.5-pro',
      provider: 'google',
      type: 'api',
      strengths: ['reasoning', 'large context', 'multimodal'],
      weaknesses: ['cost per token', 'requires internet'],
      recommendedFor: ['analysis', 'planning', 'complex_reasoning'],
      size: 'large',
      speed: 'medium',
      requirements: { minRam: 1024, minCores: 1 },
      contextWindow: 1000000,
      endpoint: 'https://generativelanguage.googleapis.com/v1'
    }
  ];

  constructor(endpoint: string = 'http://localhost:11434', hybridConfig?: Partial<HybridRoutingConfig>) {
    this.errorHandler = new AutonomousErrorHandler();
    this.quantizationOptimizer = new AdvancedQuantizationOptimizer(endpoint);
    
    // Initialize hybrid configuration with defaults
    this.hybridConfig = this.initializeHybridConfig(hybridConfig);
    
    this.initializeSystemAnalysis();
    this.initializeRoutingMetrics();
  }

  /**
   * Initialize hybrid configuration with defaults
   */
  private initializeHybridConfig(config?: Partial<HybridRoutingConfig>): HybridRoutingConfig {
    const defaultConfig: HybridRoutingConfig = {
      enabled: true,
      defaultProvider: 'auto',
      escalationThreshold: 0.7,
      confidenceScoring: true,
      learningEnabled: true,
      lmStudio: {
        endpoint: 'http://localhost:1234',
        enabled: true,
        models: ['codellama-7b-instruct', 'gemma-2b-it'],
        taskTypes: ['template', 'edit', 'format', 'boilerplate'],
        streamingEnabled: true,
        maxConcurrent: 3
      },
      ollama: {
        endpoint: 'http://localhost:11434',
        enabled: true,
        models: ['codellama:34b', 'qwen2.5:72b'],
        taskTypes: ['analysis', 'planning', 'complex', 'multi-file'],
        maxConcurrent: 1
      },
      routing: {
        escalationThreshold: 0.7,
        rules: [
          {
            condition: 'taskType == "template"',
            target: 'lmstudio',
            confidence: 0.9,
            description: 'Templates are fast tasks best handled by LM Studio'
          },
          {
            condition: 'complexity == "complex"',
            target: 'ollama',
            confidence: 0.95,
            description: 'Complex tasks require Ollama\'s reasoning capabilities'
          },
          {
            condition: 'context.length > 5',
            target: 'ollama',
            confidence: 0.8,
            description: 'Large context requires Ollama\'s context handling'
          }
        ]
      }
    };

    return { ...defaultConfig, ...config };
  }

  /**
   * Initialize routing metrics tracking
   */
  private initializeRoutingMetrics(): void {
    const providers = ['lmstudio', 'ollama', 'hybrid'];
    
    for (const provider of providers) {
      this.routingMetrics.set(provider, {
        totalRequests: 0,
        successRate: 1.0,
        averageResponseTime: 0,
        escalationRate: 0,
        lastUpdated: Date.now()
      });
    }
  }

  /**
   * Update hybrid configuration
   */
  updateHybridConfig(config: Partial<HybridRoutingConfig>): void {
    this.hybridConfig = { ...this.hybridConfig, ...config };
    logger.info('Hybrid routing configuration updated');
  }

  /**
   * Classify task type and complexity for routing decisions
   */
  classifyTask(prompt: string, context: any = {}): TaskClassification {
    const lowerPrompt = prompt.toLowerCase();
    
    // Determine task type
    let taskType = 'general';
    if (lowerPrompt.includes('template') || lowerPrompt.includes('boilerplate') || lowerPrompt.includes('generate')) {
      taskType = 'template';
    } else if (lowerPrompt.includes('format') || lowerPrompt.includes('lint') || lowerPrompt.includes('style')) {
      taskType = 'format';
    } else if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review') || lowerPrompt.includes('audit')) {
      taskType = 'analysis';
    } else if (lowerPrompt.includes('plan') || lowerPrompt.includes('design') || lowerPrompt.includes('architecture')) {
      taskType = 'planning';
    } else if (lowerPrompt.includes('debug') || lowerPrompt.includes('fix') || lowerPrompt.includes('error')) {
      taskType = 'debugging';
    } else if (lowerPrompt.includes('refactor') && (lowerPrompt.includes('multiple') || lowerPrompt.includes('files'))) {
      taskType = 'multi-file';
    }

    // Determine complexity
    let complexity: 'simple' | 'medium' | 'complex' = 'simple';
    let complexityScore = 0;
    
    // Complexity indicators
    if (lowerPrompt.length > 500) complexityScore += 1;
    if (lowerPrompt.includes('complex') || lowerPrompt.includes('advanced')) complexityScore += 2;
    if (lowerPrompt.includes('multiple') || lowerPrompt.includes('several')) complexityScore += 1;
    if (lowerPrompt.includes('architecture') || lowerPrompt.includes('system')) complexityScore += 2;
    if (context.files && context.files.length > 3) complexityScore += 1;
    if (lowerPrompt.includes('security') || lowerPrompt.includes('performance')) complexityScore += 1;

    if (complexityScore >= 4) complexity = 'complex';
    else if (complexityScore >= 2) complexity = 'medium';

    // Suggest provider based on task characteristics
    const suggestedProvider: 'lmstudio' | 'ollama' = 
      (taskType === 'template' || taskType === 'format' || complexity === 'simple') ? 'lmstudio' : 'ollama';

    const confidence = Math.min(0.9, 0.6 + (complexityScore * 0.05));

    return {
      type: taskType,
      complexity,
      confidence,
      reasoning: `Task type: ${taskType}, complexity: ${complexity} (score: ${complexityScore})`,
      suggestedProvider
    };
  }

  /**
   * Make routing decision based on task classification and system state
   */
  async makeRoutingDecision(prompt: string, context: any = {}): Promise<TaskRoutingDecision> {
    if (!this.hybridConfig.enabled) {
      return {
        selectedLLM: 'ollama',
        confidence: 1.0,
        reasoning: 'Hybrid routing disabled, using Ollama',
        fallbackStrategy: 'none'
      };
    }

    const classification = this.classifyTask(prompt, context);
    
    // Check provider availability
    const lmStudioAvailable = this.hybridConfig.lmStudio.enabled;
    const ollamaAvailable = this.hybridConfig.ollama.enabled;

    if (!lmStudioAvailable && !ollamaAvailable) {
      throw new Error('No LLM providers available');
    }

    if (!lmStudioAvailable) {
      return {
        selectedLLM: 'ollama',
        confidence: 1.0,
        reasoning: 'LM Studio unavailable, using Ollama',
        fallbackStrategy: 'none'
      };
    }

    if (!ollamaAvailable) {
      return {
        selectedLLM: 'lmstudio',
        confidence: 1.0,
        reasoning: 'Ollama unavailable, using LM Studio',
        fallbackStrategy: 'none'
      };
    }

    // Apply routing rules
    for (const rule of this.hybridConfig.routing.rules) {
      if (this.evaluateRoutingRule(rule, classification, context)) {
        const decision: TaskRoutingDecision = {
          selectedLLM: rule.target,
          confidence: rule.confidence,
          reasoning: `Rule match: ${rule.description}`,
          fallbackStrategy: rule.target === 'lmstudio' ? 'ollama' : 'lmstudio',
          escalationThreshold: this.hybridConfig.escalationThreshold
        };

        logger.debug('Routing decision:', decision);
        return decision;
      }
    }

    // Default routing based on classification
    const selectedLLM = classification.suggestedProvider;
    const fallbackStrategy = selectedLLM === 'lmstudio' ? 'ollama' : 'lmstudio';

    return {
      selectedLLM,
      confidence: classification.confidence,
      reasoning: `Default routing: ${classification.reasoning}`,
      fallbackStrategy,
      escalationThreshold: this.hybridConfig.escalationThreshold
    };
  }

  /**
   * Evaluate routing rule against task classification
   */
  private evaluateRoutingRule(rule: RoutingRule, classification: TaskClassification, context: any): boolean {
    const condition = rule.condition.toLowerCase();
    
    // Simple rule evaluation (can be extended with more sophisticated logic)
    if (condition.includes('tasktype') && condition.includes(classification.type)) {
      return true;
    }
    
    if (condition.includes('complexity') && condition.includes(classification.complexity)) {
      return true;
    }
    
    if (condition.includes('context.length') && context.files) {
      const contextLength = context.files.length;
      const match = condition.match(/context\.length\s*([><=]+)\s*(\d+)/);
      if (match) {
        const operator = match[1];
        const threshold = parseInt(match[2]);
        
        switch (operator) {
          case '>': return contextLength > threshold;
          case '<': return contextLength < threshold;
          case '>=': return contextLength >= threshold;
          case '<=': return contextLength <= threshold;
          case '=': return contextLength === threshold;
        }
      }
    }
    
    return false;
  }

  /**
   * Record routing decision outcome for learning
   */
  recordRoutingOutcome(
    provider: 'lmstudio' | 'ollama' | 'hybrid',
    success: boolean,
    responseTime: number,
    escalated: boolean = false
  ): void {
    const metrics = this.routingMetrics.get(provider);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.successRate = (metrics.successRate * (metrics.totalRequests - 1) + (success ? 1 : 0)) / metrics.totalRequests;
    metrics.averageResponseTime = (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;
    
    if (escalated) {
      metrics.escalationRate = (metrics.escalationRate * (metrics.totalRequests - 1) + 1) / metrics.totalRequests;
    }
    
    metrics.lastUpdated = Date.now();

    if (this.hybridConfig.learningEnabled) {
      this.updateRoutingStrategies(provider, success, responseTime, escalated);
    }
  }

  /**
   * Update routing strategies based on performance data
   */
  private updateRoutingStrategies(
    provider: 'lmstudio' | 'ollama' | 'hybrid',
    success: boolean,
    responseTime: number,
    escalated: boolean
  ): void {
    // Simple learning: adjust escalation threshold based on success rates
    const lmStudioMetrics = this.routingMetrics.get('lmstudio');
    const ollamaMetrics = this.routingMetrics.get('ollama');

    if (lmStudioMetrics && ollamaMetrics) {
      // If LM Studio success rate is low, lower escalation threshold (escalate more often)
      if (lmStudioMetrics.successRate < 0.8) {
        this.hybridConfig.escalationThreshold = Math.max(0.5, this.hybridConfig.escalationThreshold - 0.05);
        logger.debug('Lowered escalation threshold due to LM Studio performance');
      }
      
      // If both providers are performing well, can be more selective
      if (lmStudioMetrics.successRate > 0.9 && ollamaMetrics.successRate > 0.9) {
        this.hybridConfig.escalationThreshold = Math.min(0.9, this.hybridConfig.escalationThreshold + 0.05);
        logger.debug('Raised escalation threshold due to good performance');
      }
    }
  }

  /**
   * Get hybrid routing status and metrics
   */
  getHybridStatus(): any {
    const lmStudioMetrics = this.routingMetrics.get('lmstudio');
    const ollamaMetrics = this.routingMetrics.get('ollama');
    const hybridMetrics = this.routingMetrics.get('hybrid');

    return {
      enabled: this.hybridConfig.enabled,
      escalationThreshold: this.hybridConfig.escalationThreshold,
      providers: {
        lmStudio: {
          ...this.hybridConfig.lmStudio,
          metrics: lmStudioMetrics
        },
        ollama: {
          ...this.hybridConfig.ollama,
          metrics: ollamaMetrics
        }
      },
      routing: {
        rules: this.hybridConfig.routing.rules.length,
        metrics: hybridMetrics
      }
    };
  }

  /**
   * Add API model configuration
   */
  addApiModel(config: {
    name: string;
    provider: 'openai' | 'anthropic' | 'google' | 'huggingface';
    apiKey: string;
    endpoint?: string;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Find existing model configuration to update
        const existingModel = this.modelCapabilities.find(m => 
          m.name === config.name || 
          (m.provider === config.provider && m.type === 'api')
        );

        if (existingModel) {
          existingModel.apiKey = config.apiKey;
          if (config.endpoint) {
            existingModel.endpoint = config.endpoint;
          }
          logger.info(`Updated API model configuration: ${config.name}`);
        } else {
          // Add new API model (basic configuration)
          const newModel: ModelCapability = {
            name: config.name,
            provider: config.provider,
            type: 'api',
            strengths: ['api_model'],
            weaknesses: ['requires_internet', 'cost'],
            recommendedFor: ['general'],
            size: 'medium',
            speed: 'medium',
            requirements: { minRam: 1024, minCores: 1 },
            apiKey: config.apiKey,
            endpoint: config.endpoint,
            contextWindow: 8192
          };
          
          this.modelCapabilities.push(newModel);
          logger.info(`Added new API model: ${config.name}`);
        }

        resolve(true);
      } catch (error) {
        logger.error('Failed to add API model:', error);
        resolve(false);
      }
    });
  }

  /**
   * Test API model connection
   */
  async testApiModel(modelName: string): Promise<boolean> {
    const model = this.modelCapabilities.find(m => m.name === modelName);
    if (!model || model.type !== 'api' || !model.apiKey) {
      return false;
    }

    try {
      switch (model.provider) {
        case 'anthropic':
          return await this.testAnthropicModel(model);
        case 'openai':
          return await this.testOpenAIModel(model);
        case 'google':
          return await this.testGoogleModel(model);
        default:
          return false;
      }
    } catch (error) {
      logger.error(`API model test failed for ${modelName}:`, error);
      return false;
    }
  }

  private async testAnthropicModel(model: ModelCapability): Promise<boolean> {
    try {
      const response = await axios.post(
        `${model.endpoint}/messages`,
        {
          model: model.name,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        },
        {
          headers: {
            'x-api-key': model.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          timeout: 10000
        }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private async testOpenAIModel(model: ModelCapability): Promise<boolean> {
    try {
      const response = await axios.post(
        `${model.endpoint}/chat/completions`,
        {
          model: model.name,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        },
        {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private async testGoogleModel(model: ModelCapability): Promise<boolean> {
    try {
      const response = await axios.post(
        `${model.endpoint}/models/${model.name}:generateContent?key=${model.apiKey}`,
        {
          contents: [{ parts: [{ text: 'Hi' }] }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all available models (local + API)
   */
  async getAllAvailableModels(): Promise<ModelCapability[]> {
    // Get local models
    const localModels = await this.detectAvailableModels();
    
    // Filter model capabilities to show available ones
    const availableModels = this.modelCapabilities.filter(model => {
      if (model.type === 'local') {
        return localModels.includes(model.name) || 
               localModels.some(local => local.startsWith(model.name.split(':')[0]));
      } else if (model.type === 'api') {
        return !!model.apiKey; // API model is available if it has an API key
      }
      return false;
    });

    return availableModels;
  }

  /**
   * Remove API model
   */
  removeApiModel(modelName: string): boolean {
    const index = this.modelCapabilities.findIndex(m => m.name === modelName && m.type === 'api');
    if (index !== -1) {
      this.modelCapabilities.splice(index, 1);
      logger.info(`Removed API model: ${modelName}`);
      return true;
    }
    return false;
  }

  /**
   * Initialize system analysis and model detection
   */
  private async initializeSystemAnalysis(): Promise<void> {
    try {
      await this.detectSystemSpecs();
      await this.detectAvailableModels();
      logger.info('🔍 System analysis completed');
    } catch (error) {
      logger.warn('⚠️ System analysis failed, using defaults:', error);
    }
  }

  /**
   * Detect system specifications
   */
  private async detectSystemSpecs(): Promise<SystemSpecs> {
    try {
      const specs: SystemSpecs = {
        cpu: await this.detectCPU(),
        memory: await this.detectMemory(),
        gpu: await this.detectGPU()
      };
      
      this.systemSpecs = specs;
      logger.info('💻 System specs detected:', {
        cpu: `${specs.cpu.cores} cores @ ${specs.cpu.frequency}MHz`,
        memory: `${Math.round(specs.memory.total / 1024)} GB (${specs.memory.usage}% used)`,
        gpu: specs.gpu.available ? `${specs.gpu.type} with ${Math.round(specs.gpu.vram / 1024)} GB VRAM` : 'None'
      });
      
      return specs;
    } catch (error) {
      logger.error('Failed to detect system specs:', error);
      // Fallback specs for low-end systems
      const fallback: SystemSpecs = {
        cpu: { cores: 2, threads: 4, frequency: 2000, usage: 50 },
        memory: { total: 8192, available: 4096, usage: 50 },
        gpu: { available: false, vram: 0, type: 'none' }
      };
      this.systemSpecs = fallback;
      return fallback;
    }
  }

  /**
   * Detect CPU specifications
   */
  private async detectCPU(): Promise<SystemSpecs['cpu']> {
    try {
      if (process.platform === 'win32') {
        // Try WMIC first
        let stdout: string | undefined;
        try {
          const result = await execAsync('wmic cpu get NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed /format:csv');
          stdout = result.stdout;
        } catch (wmicError) {
          // WMIC not available, try PowerShell
          try {
            const psResult = await execAsync('powershell "Get-WmiObject -Class Win32_Processor | Select-Object NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed | ConvertTo-Json"');
            const cpuInfo = JSON.parse(psResult.stdout);
            const cpuData = Array.isArray(cpuInfo) ? cpuInfo[0] : cpuInfo;
            return {
              cores: cpuData.NumberOfCores || 2,
              threads: cpuData.NumberOfLogicalProcessors || 4,
              frequency: cpuData.MaxClockSpeed || 2000,
              usage: 25
            };
          } catch (psError) {
            // Try simple PowerShell command
            const altResult = await execAsync('powershell "(Get-CimInstance -ClassName Win32_ComputerSystem).NumberOfLogicalProcessors"');
            const threads = parseInt(altResult.stdout.trim()) || 4;
            return {
              cores: Math.max(1, Math.floor(threads / 2)),
              threads,
              frequency: 2400,
              usage: 25
            };
          }
        }
        const lines = stdout?.split('\n').filter((line: string) => line.includes(',')) || [];
        if (lines.length > 1) {
          const parts = lines[1].split(',');
          return {
            cores: parseInt(parts[2]) || 2,
            threads: parseInt(parts[3]) || 4,
            frequency: parseInt(parts[1]) || 2000,
            usage: 25 // Default estimate
          };
        }
      } else {
        const { stdout: cores } = await execAsync('nproc');
        const { stdout: freq } = await execAsync('cat /proc/cpuinfo | grep "cpu MHz" | head -1 | awk \'{print $4}\'').catch(() => ({ stdout: '2000' }));
        return {
          cores: parseInt(cores.trim()) || 2,
          threads: parseInt(cores.trim()) || 4,
          frequency: parseFloat(freq.trim()) || 2000,
          usage: 25
        };
      }
    } catch (error) {
      logger.warn('CPU detection failed:', error);
    }
    
    return { cores: 2, threads: 4, frequency: 2000, usage: 25 };
  }

  /**
   * Detect memory specifications
   */
  private async detectMemory(): Promise<SystemSpecs['memory']> {
    try {
      if (process.platform === 'win32') {
        // Try WMIC first
        let stdout: string | undefined;
        try {
          const result = await execAsync('wmic computersystem get TotalPhysicalMemory /format:csv');
          stdout = result.stdout;
        } catch (wmicError) {
          // WMIC not available, try PowerShell
          try {
            const psResult = await execAsync('powershell "Get-WmiObject -Class Win32_ComputerSystem | Select-Object TotalPhysicalMemory | ConvertTo-Json"');
            const memInfo = JSON.parse(psResult.stdout);
            const totalBytes = parseInt(memInfo.TotalPhysicalMemory);
            const totalMB = Math.round(totalBytes / (1024 * 1024));
            return {
              total: totalMB,
              available: Math.round(totalMB * 0.6),
              usage: 40
            };
          } catch (psError) {
            // Try alternative method
            const altResult = await execAsync('powershell "[math]::round((Get-CimInstance -ClassName Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1MB)"');
            const totalMB = parseInt(altResult.stdout.trim()) || 8192;
            return {
              total: totalMB,
              available: Math.round(totalMB * 0.6),
              usage: 40
            };
          }
        }
        const lines = stdout?.split('\n').filter((line: string) => line.includes(',')) || [];
        if (lines.length > 1) {
          const totalBytes = parseInt(lines[1].split(',')[1]);
          const totalMB = Math.round(totalBytes / (1024 * 1024));
          return {
            total: totalMB,
            available: Math.round(totalMB * 0.6), // Estimate 60% available
            usage: 40
          };
        }
      } else {
        const { stdout } = await execAsync('free -m | grep "^Mem:" | awk \'{print $2,$7}\'');
        const [total, available] = stdout.trim().split(' ').map(Number);
        return {
          total: total || 8192,
          available: available || 4096,
          usage: Math.round(((total - available) / total) * 100)
        };
      }
    } catch (error) {
      logger.warn('Memory detection failed:', error);
    }
    
    return { total: 8192, available: 4096, usage: 50 };
  }

  /**
   * Detect GPU specifications
   */
  private async detectGPU(): Promise<SystemSpecs['gpu']> {
    try {
      // Try nvidia-smi first
      try {
        const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits');
        const vramMB = parseInt(stdout.trim()) || 0;
        if (vramMB > 0) {
          return { available: true, vram: vramMB, type: 'nvidia' };
        }
      } catch {
        // nvidia-smi not available
      }

      // Try AMD ROCm
      try {
        const { stdout } = await execAsync('rocm-smi --showmeminfo vram --csv');
        if (stdout.includes('GB')) {
          const vramGB = parseFloat(stdout.match(/(\d+\.?\d*)\s*GB/)?.[1] || '0');
          return { available: true, vram: vramGB * 1024, type: 'amd' };
        }
      } catch {
        // ROCm not available
      }

      // Check for Intel GPU on Windows
      if (process.platform === 'win32') {
        try {
          // Try WMIC first
          let stdout: string | undefined;
          try {
            const result = await execAsync('wmic path win32_VideoController get AdapterRAM,Name /format:csv');
            stdout = result.stdout;
          } catch (wmicError) {
            // WMIC not available, try PowerShell
            const psResult = await execAsync('powershell "Get-WmiObject -Class Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"');
            const gpuInfo = JSON.parse(psResult.stdout);
            const gpuArray = Array.isArray(gpuInfo) ? gpuInfo : [gpuInfo];
            const intelGpu = gpuArray.find(gpu => gpu.Name && gpu.Name.includes('Intel'));
            if (intelGpu) {
              return { available: true, vram: 1024, type: 'intel' };
            }
            return { available: false, vram: 0, type: 'none' };
          }
          const lines = stdout?.split('\n').filter((line: string) => line.includes('Intel')) || [];
          if (lines.length > 0) {
            return { available: true, vram: 1024, type: 'intel' }; // Estimate for Intel iGPU
          }
        } catch {
          // Intel GPU detection failed
        }
      }

    } catch (error) {
      logger.warn('GPU detection failed:', error);
    }
    
    return { available: false, vram: 0, type: 'none' };
  }

  /**
   * Get model size information from Ollama
   */
  private async getModelSizes(): Promise<Map<string, number>> {
    const modelSizes = new Map<string, number>();
    try {
      const { stdout } = await execAsync('ollama list');
      const lines = stdout.split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        if (line.trim()) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3) {
            const modelName = parts[0];
            const sizeStr = parts[2];
            // Parse size (e.g., "5.0 GB", "19 GB")
            const sizeMatch = sizeStr.match(/(\d+\.?\d*)\s*(GB|MB)/i);
            if (sizeMatch) {
              const size = parseFloat(sizeMatch[1]);
              const unit = sizeMatch[2].toLowerCase();
              const sizeInMB = unit === 'gb' ? size * 1024 : size;
              modelSizes.set(modelName, sizeInMB);
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to get model sizes:', error);
    }
    return modelSizes;
  }

  /**
   * Check if model can actually run on the system (memory check)
   */
  private async canModelActuallyRun(modelName: string): Promise<boolean> {
    try {
      const modelSizes = await this.getModelSizes();
      const modelSize = modelSizes.get(modelName);
      
      // Known models and their actual memory requirements (more realistic estimates)
      const modelMemoryEstimates: Record<string, number> = {
        'codellama:34b': 19000,   // ~19 GB (actual disk size, not load requirement)
        'qwq:32b': 19000,         // ~19 GB
        'llama3.1:70b': 40000,    // ~40 GB
        'qwen2.5:72b': 41000,     // ~41 GB
      };
      
      // Check if it's a known model with specific memory requirements
      if (modelMemoryEstimates[modelName]) {
        const estimatedMemory = modelMemoryEstimates[modelName];
        const totalMemory = this.systemSpecs?.memory?.total || 0;
        const availableMemory = this.systemSpecs?.memory?.available || 0;
        
        // Use 70% of total memory as usable threshold (more realistic for large models)
        const usableMemory = totalMemory * 0.7;
        
        // For 32GB+ systems, be more lenient with codellama:34b specifically
        if (modelName === 'codellama:34b' && totalMemory >= 30000) {
          logger.info(`✅ ${modelName} (${estimatedMemory}MB) allowed on high-memory system (${Math.round(totalMemory/1024)}GB total)`);
          return true;
        }
        
        if (estimatedMemory > usableMemory) {
          logger.info(`❌ ${modelName} requires ~${estimatedMemory}MB but only ${usableMemory.toFixed(0)}MB usable (${Math.round(totalMemory/1024)}GB total)`);
          return false;
        } else {
          logger.info(`✅ ${modelName} (${estimatedMemory}MB) fits in usable memory (${usableMemory.toFixed(0)}MB)`);
        }
      }
      
      if (!modelSize || !this.systemSpecs) {
        logger.debug(`Cannot determine exact size for ${modelName} - checking known constraints`);
        
        // Conservative: reject known large models when we can't determine size
        if (modelName.includes('34b') || modelName.includes('70b') || modelName.includes('72b')) {
          logger.info(`⚠️ Rejecting large model ${modelName} - cannot verify memory requirements`);
          return false;
        }
        
        // Allow smaller models by default
        return true;
      }
      
      // Rule: Model should use less than 80% of available memory
      const usableMemory = this.systemSpecs.memory.available * 0.8;
      const canRun = modelSize <= usableMemory;
      
      if (!canRun) {
        logger.info(`❌ ${modelName} (${modelSize.toFixed(1)}MB) exceeds available memory (${usableMemory.toFixed(1)}MB)`);
      } else {
        logger.debug(`✅ ${modelName} (${modelSize.toFixed(1)}MB) fits in memory (${usableMemory.toFixed(1)}MB available)`);
      }
      
      return canRun;
    } catch (error) {
      logger.warn(`Error checking if ${modelName} can run:`, error);
      // Conservative: reject if we can't check
      return false;
    }
  }

  /**
   * Detect available Ollama models
   */
  private async detectAvailableModels(): Promise<string[]> {
    try {
      // Check cache first (refresh every 5 minutes)
      if (Date.now() - this.lastModelCheck < 300000 && this.availableModels.length > 0) {
        return this.availableModels;
      }

      // Try Ollama API first
      try {
        const response = await axios.get('http://localhost:11434/api/tags', { timeout: 30000 });
        const models = response.data.models?.map((m: any) => m.name) || [];
        this.availableModels = models;
        this.lastModelCheck = Date.now();
        
        logger.info(`🤖 Detected ${models.length} available models:`, models.slice(0, 5));
        return models;
      } catch (apiError) {
        // Fallback to ollama list command
        const { stdout } = await execAsync('ollama list');
        const lines = stdout.split('\n').slice(1); // Skip header
        const models = lines
          .filter(line => line.trim() && !line.startsWith('NAME'))
          .map(line => line.split(/\s+/)[0])
          .filter(Boolean);
        
        this.availableModels = models;
        this.lastModelCheck = Date.now();
        
        logger.info(`🤖 Detected ${models.length} available models via CLI`);
        return models;
      }
    } catch (error) {
      logger.warn('Failed to detect available models:', error);
      // Return common fallback models
      const fallback = ['llama3.2:latest', 'gemma2:9b', 'qwen2.5:7b'];
      this.availableModels = fallback;
      return fallback;
    }
  }

  /**
   * Check if model can run on current system
   */
  private canModelRun(model: ModelCapability): boolean {
    if (!this.systemSpecs) {
      logger.warn(`No system specs available for ${model.name}, allowing model to run`);
      return true; // Conservative fallback
    }
    
    const specs = this.systemSpecs;
    const req = model.requirements;
    
    // Check RAM requirement - use total instead of available for better compatibility
    const usableRam = Math.min(specs.memory.total * 0.8, specs.memory.available); // 80% of total or available
    if (usableRam < req.minRam) {
      logger.debug(`${model.name} requires ${req.minRam}MB RAM, but only ${Math.round(usableRam)}MB usable`);
      return false;
    }
    
    // Check CPU cores
    if (specs.cpu.cores < req.minCores) {
      logger.debug(`${model.name} requires ${req.minCores} cores, but only ${specs.cpu.cores} available`);
      return false;
    }
    
    // Check VRAM if required - only fail if GPU is available but insufficient
    if (req.minVram && specs.gpu.available && specs.gpu.vram < req.minVram) {
      logger.debug(`${model.name} requires ${req.minVram}MB VRAM, but only ${specs.gpu.vram}MB available`);
      return false;
    }
    
    // If VRAM required but no GPU, still allow (CPU inference)
    if (req.minVram && !specs.gpu.available) {
      logger.debug(`${model.name} prefers GPU but will run on CPU`);
    }
    
    logger.debug(`✅ ${model.name} is compatible with system specs`);
    return true;
  }

  /**
   * Get best model that can actually run on the system
   */
  async getBestRunnableModel(taskType: string = 'coding'): Promise<string> {
    await this.detectSystemSpecs();
    const availableModels = await this.detectAvailableModels();
    
    // Filter models that can actually run
    const runnableModels = [];
    for (const model of availableModels) {
      if (await this.canModelActuallyRun(model)) {
        runnableModels.push(model);
      }
    }
    
    if (runnableModels.length === 0) {
      throw new Error('No models can run on this system. Please install a smaller model.');
    }
    
    // Prioritize models based on task type and quality
    // For coding, prioritize codellama models which are specifically designed for code
    // Use specific model names to avoid gemma3n:e4b being selected over gemma:latest
    const modelPreferences = {
      'coding': ['codellama', 'gemma:latest', 'llama3.2', 'qwen', 'gemma2'],
      'general': ['gemma:latest', 'llama3.2', 'qwen', 'codellama', 'gemma2'],
      'analysis': ['llama3.2', 'qwen', 'gemma:latest', 'codellama']
    };
    
    const preferences = modelPreferences[taskType as keyof typeof modelPreferences] || modelPreferences.general;
    
    // Find best match
    for (const preference of preferences) {
      const match = runnableModels.find(model => 
        model.toLowerCase().includes(preference) && 
        !model.includes('2b') && // Avoid very small models
        !model.includes('1b')
      );
      if (match) {
        logger.info(`🎯 Selected best runnable model for ${taskType}: ${match}`);
        return match;
      }
    }
    
    // Fallback to any runnable model
    const fallback = runnableModels[0];
    logger.warn(`⚠️ Using fallback model: ${fallback}`);
    return fallback;
  }

  /**
   * Select the best model for a given task with autonomous system analysis
   */
  async selectOptimalModel(
    taskType: string,
    requirements: {
      speed?: 'fast' | 'medium' | 'slow';
      accuracy?: 'high' | 'medium' | 'low';
      complexity?: 'simple' | 'medium' | 'complex';
      resources?: 'limited' | 'normal' | 'unlimited';
    } = {},
    providedModels: string[] = []
  ): Promise<string> {
    
    logger.info(`🧠 Autonomous model selection for task: ${taskType}`);
    
    // Ensure system specs and models are up to date
    if (!this.systemSpecs) {
      await this.detectSystemSpecs();
    }
    
    // Get available models
    const availableModels = providedModels.length > 0 ? providedModels : await this.detectAvailableModels();
    
    // Auto-adjust requirements based on system capabilities
    const autoRequirements = this.optimizeRequirementsForSystem(requirements);
    
    // Get task-specific model preferences
    let candidates = this.getTaskSpecificModels(taskType);
    
    // Filter by system compatibility first
    const compatibleCandidates = candidates.filter(model => this.canModelRun(model));
    logger.debug(`Compatible models after system check: ${compatibleCandidates.map(m => m.name).join(', ')}`);
    
    // Filter by availability with more robust matching
    const availableCandidates = compatibleCandidates.filter(model => {
      const modelBase = model.name.split(':')[0];
      const isAvailable = availableModels.some(available => {
        const availableBase = available.split(':')[0];
        return available === model.name || availableBase === modelBase || available.includes(modelBase);
      });
      
      if (!isAvailable) {
        logger.debug(`❌ ${model.name} not found in available models: ${availableModels.join(', ')}`);
      } else {
        logger.debug(`✅ ${model.name} is available`);
      }
      
      return isAvailable;
    });
    
    candidates = availableCandidates;
    logger.info(`Final candidate models: ${candidates.map(m => m.name).join(', ')}`);
    
    if (candidates.length === 0) {
      logger.warn(`⚠️ No compatible models found for task: ${taskType}`);
      logger.info(`Available models from Ollama: ${availableModels.join(', ')}`);
      logger.info(`Original candidates: ${this.getTaskSpecificModels(taskType).map(m => m.name).join(', ')}`);
      
      // Fallback to any available model
      const simplestModel = this.findSimplestCompatibleModel(availableModels);
      if (simplestModel) {
        logger.info(`🔄 Using fallback model: ${simplestModel}`);
        return simplestModel;
      }
      
      // Ultimate fallback - use first available model
      if (availableModels.length > 0) {
        logger.warn(`🚨 Using first available model as last resort: ${availableModels[0]}`);
        return availableModels[0];
      }
      
      throw new Error('No models available in Ollama. Please install a model with: ollama pull llama3.2:latest');
    }
    
    // Apply requirement filters
    candidates = this.filterByRequirements(candidates, autoRequirements);
    
    // Sort by comprehensive score including system performance
    candidates.sort((a, b) => {
      const aScore = this.calculateComprehensiveScore(a, taskType, autoRequirements);
      const bScore = this.calculateComprehensiveScore(b, taskType, autoRequirements);
      return bScore - aScore;
    });
    
    const selectedModel = candidates[0]?.name;
    
    if (selectedModel) {
      logger.info(`✅ Autonomously selected model: ${selectedModel} for task: ${taskType}`, {
        systemSpecs: this.systemSpecs ? {
          ram: `${Math.round(this.systemSpecs.memory.available / 1024)}GB available`,
          cpu: `${this.systemSpecs.cpu.cores} cores`,
          gpu: this.systemSpecs.gpu.available ? `${this.systemSpecs.gpu.type}` : 'none'
        } : 'unknown'
      });
      return selectedModel;
    }
    
    // Ultimate fallback
    const fallback = await this.errorHandler.getRecommendedModel(taskType as any);
    logger.warn(`⚠️ No optimal model found, using system fallback: ${fallback}`);
    return fallback;
  }

  /**
   * Optimize requirements based on system capabilities
   */
  private optimizeRequirementsForSystem(
    requirements: any
  ): any {
    if (!this.systemSpecs) return requirements;
    
    const optimized = { ...requirements };
    const specs = this.systemSpecs;
    
    // Auto-adjust based on available RAM
    if (specs.memory.available < 4096) {
      optimized.resources = 'limited';
      optimized.speed = 'fast';
    } else if (specs.memory.available > 16384) {
      optimized.resources = 'unlimited';
    }
    
    // Auto-adjust based on CPU cores
    if (specs.cpu.cores <= 2) {
      optimized.speed = optimized.speed || 'fast';
    } else if (specs.cpu.cores >= 8) {
      optimized.accuracy = optimized.accuracy || 'high';
    }
    
    // Auto-adjust based on GPU availability
    if (!specs.gpu.available) {
      optimized.resources = optimized.resources || 'limited';
    }
    
    logger.debug('📊 Auto-optimized requirements:', optimized);
    return optimized;
  }

  /**
   * Get optimized configuration for a model using advanced quantization
   */
  async getOptimizedModelConfig(modelName: string, useCase: UseCase = 'coding'): Promise<ModelOptimizationResult> {
    const cacheKey = `${modelName}-${useCase}`;
    
    if (this.optimizationCache.has(cacheKey)) {
      const cached = this.optimizationCache.get(cacheKey)!;
      // Refresh cache if older than 1 hour
      if (Date.now() - cached.timestamp < 3600000) {
        return cached;
      }
    }

    try {
      const quantizationRec = await this.quantizationOptimizer.getOptimalQuantization(modelName, useCase);
      
      const result: ModelOptimizationResult = {
        modelName,
        useCase,
        quantizationRecommendation: quantizationRec,
        ollamaParams: this.generateOllamaParams(quantizationRec),
        environmentVars: this.generateEnvironmentVars(quantizationRec),
        expectedPerformance: this.estimatePerformance(quantizationRec),
        timestamp: Date.now()
      };

      this.optimizationCache.set(cacheKey, result);
      
      logger.info(`🎯 Optimized configuration for ${modelName}:`, {
        quantization: quantizationRec.quantization,
        gpuLayers: quantizationRec.gpuLayers,
        context: quantizationRec.contextLength,
        quality: quantizationRec.qualityScore,
        speed: quantizationRec.speedScore
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate optimized config:', error);
      return this.getFallbackOptimization(modelName, useCase);
    }
  }

  /**
   * Generate Ollama parameters from quantization recommendation
   */
  private generateOllamaParams(rec: QuantizationRecommendation): Record<string, any> {
    const params: Record<string, any> = {
      num_ctx: rec.contextLength,
      num_batch: rec.batchSize,
      num_gpu: rec.gpuLayers,
      low_vram: rec.lowVRAMMode,
      flash_attn: rec.flashAttention
    };

    // K/V cache optimization
    if (rec.kvCacheQuantization !== 'f16') {
      params.cache_type_k = rec.kvCacheQuantization;
      params.cache_type_v = rec.kvCacheQuantization;
    }

    return params;
  }

  /**
   * Generate environment variables for optimization
   */
  private generateEnvironmentVars(rec: QuantizationRecommendation): Record<string, string> {
    const envVars: Record<string, string> = {};

    if (rec.flashAttention) {
      envVars.OLLAMA_FLASH_ATTENTION = '1';
    }

    if (rec.kvCacheQuantization !== 'f16') {
      envVars.OLLAMA_KV_CACHE_TYPE = rec.kvCacheQuantization;
    }

    if (rec.lowVRAMMode) {
      envVars.OLLAMA_NUM_PARALLEL = '1';
      envVars.OLLAMA_MAX_LOADED_MODELS = '1';
    }

    return envVars;
  }

  /**
   * Estimate performance metrics for a configuration
   */
  private estimatePerformance(rec: QuantizationRecommendation): PerformanceEstimate {
    // Base estimates (tokens/second)
    let baseSpeed = 20; // Conservative base
    
    // Adjust for quantization
    const quantSpeedMultiplier: Record<string, number> = {
      'Q4_0': 1.5,
      'Q4_K_S': 1.4,
      'Q4_K_M': 1.3,
      'Q5_K_S': 1.1,
      'Q5_K_M': 1.0,
      'Q6_K': 0.9,
      'Q8_0': 0.7,
      'F16': 0.5
    };
    
    baseSpeed *= quantSpeedMultiplier[rec.quantization] || 1.0;
    
    // Adjust for GPU usage
    if (rec.gpuLayers === -1) {
      baseSpeed *= 3.0; // Full GPU acceleration
    } else if (rec.gpuLayers > 0) {
      baseSpeed *= 1.5 + (rec.gpuLayers / 100); // Partial GPU acceleration
    }
    
    return {
      estimatedTokensPerSecond: Math.round(baseSpeed),
      estimatedMemoryUsageGB: rec.estimatedVRAMUsage,
      estimatedLatencyMs: Math.round(1000 / baseSpeed),
      qualityScore: rec.qualityScore,
      speedScore: rec.speedScore
    };
  }

  /**
   * Get fallback optimization for error cases
   */
  private getFallbackOptimization(modelName: string, useCase: UseCase): ModelOptimizationResult {
    const fallbackRec: QuantizationRecommendation = {
      quantization: 'Q4_K_M',
      kvCacheQuantization: 'q8_0',
      gpuLayers: 20,
      contextLength: 4096,
      batchSize: 1024,
      flashAttention: true,
      lowVRAMMode: true,
      estimatedVRAMUsage: 6,
      qualityScore: 75,
      speedScore: 80,
      reasoning: 'Fallback configuration due to optimization error'
    };

    return {
      modelName,
      useCase,
      quantizationRecommendation: fallbackRec,
      ollamaParams: this.generateOllamaParams(fallbackRec),
      environmentVars: this.generateEnvironmentVars(fallbackRec),
      expectedPerformance: this.estimatePerformance(fallbackRec),
      timestamp: Date.now()
    };
  }

  /**
   * Find the simplest model that can run on the system
   */
  private findSimplestCompatibleModel(availableModels: string[]): string | null {
    // Ordered list of models from simplest to most complex (prioritizing commonly available models)
    const simplicityOrder = [
      'gemma:2b', 'gemma:latest', 'gemma3n:e4b', 'llama3.2:latest', 'llama3.2:8b',
      'gemma2:9b', 'gemma:7b', 'qwen2.5:7b', 'codellama:7b', 
      'qwen2.5:3b', 'llama3.2:3b', 'gemma2:27b'
    ];
    
    logger.debug(`Looking for simple model from available: ${availableModels.join(', ')}`);
    
    for (const simple of simplicityOrder) {
      const found = availableModels.find(available => {
        const simpleBase = simple.split(':')[0];
        const availableBase = available.split(':')[0];
        return available === simple || availableBase === simpleBase || available.includes(simpleBase);
      });
      
      if (found) {
        logger.info(`📋 Selected simplest compatible model: ${found}`);
        return found;
      }
    }
    
    // Return first available model as last resort
    logger.warn('No models in simplicity order found, using first available');
    return availableModels[0] || null;
  }

  /**
   * Calculate comprehensive score including system performance
   */
  private calculateComprehensiveScore(
    model: ModelCapability,
    taskType: string,
    requirements: any
  ): number {
    let score = this.calculateModelScore(model, taskType, requirements);
    
    if (!this.systemSpecs) return score;
    
    const specs = this.systemSpecs;
    const req = model.requirements;
    
    // System compatibility bonus (0-40 points)
    let compatibilityScore = 0;
    
    // RAM efficiency bonus
    const ramEfficiency = specs.memory.available / req.minRam;
    if (ramEfficiency > 2) compatibilityScore += 15;
    else if (ramEfficiency > 1.5) compatibilityScore += 10;
    else if (ramEfficiency > 1.2) compatibilityScore += 5;
    
    // CPU compatibility bonus
    const cpuEfficiency = specs.cpu.cores / req.minCores;
    if (cpuEfficiency > 2) compatibilityScore += 10;
    else if (cpuEfficiency > 1.5) compatibilityScore += 5;
    
    // GPU acceleration bonus
    if (req.minVram && specs.gpu.available && specs.gpu.vram >= req.minVram) {
      compatibilityScore += 15;
    }
    
    score += compatibilityScore;
    
    // Current system load penalty (if high usage, prefer lighter models)
    if (specs.memory.usage > 80 && model.size === 'large') {
      score -= 20;
    } else if (specs.memory.usage > 60 && model.size === 'medium') {
      score -= 10;
    }
    
    logger.debug(`🔢 Comprehensive score for ${model.name}: ${score} (compat: +${compatibilityScore})`);
    return score;
  }

  /**
   * Get models suitable for specific task types
   */
  private getTaskSpecificModels(taskType: string): ModelCapability[] {
    const taskMappings = {
      'coding': ['coding', 'code_generation', 'debugging', 'complex_coding', 'code_review'],
      'analysis': ['analysis', 'reasoning', 'complex_reasoning'],
      'planning': ['planning', 'reasoning', 'complex_reasoning'],
      'chat': ['general', 'chat', 'coding'], // Include coding models for chat about code
      'debugging': ['coding', 'debugging', 'code_review', 'complex_coding'],
      'review': ['code_review', 'analysis', 'coding'],
      'simple': ['simple_tasks', 'quick_help', 'simple_coding'],
      'complex': ['complex_reasoning', 'complex_coding', 'analysis', 'coding']
    };
    
    const relevantTasks = taskMappings[taskType as keyof typeof taskMappings] || ['general'];
    
    const models = this.modelCapabilities.filter(model =>
      model.recommendedFor.some(task => relevantTasks.includes(task))
    );
    
    // Prioritize gpt-oss:20b for coding tasks if available
    if (taskType === 'coding' || taskType === 'debugging' || taskType === 'complex') {
      const gptModel = models.find(m => m.name.includes('gpt-oss'));
      if (gptModel) {
        return [gptModel, ...models.filter(m => !m.name.includes('gpt-oss'))];
      }
    }
    
    return models;
  }

  /**
   * Filter models by requirements
   */
  private filterByRequirements(
    models: ModelCapability[],
    requirements: any
  ): ModelCapability[] {
    let filtered = [...models];
    
    // Speed requirements
    if (requirements.speed === 'fast') {
      filtered = filtered.filter(m => m.speed === 'fast');
    } else if (requirements.speed === 'slow') {
      // Allow medium and slow for slow requirement
      filtered = filtered.filter(m => m.speed !== 'fast');
    }
    
    // Resource constraints
    if (requirements.resources === 'limited') {
      filtered = filtered.filter(m => m.size === 'small' || m.size === 'medium');
    } else if (requirements.resources === 'unlimited') {
      // Prefer larger models for better quality
      filtered.sort((a, b) => {
        const sizeOrder = { 'small': 1, 'medium': 2, 'large': 3 };
        return sizeOrder[b.size] - sizeOrder[a.size];
      });
    }
    
    // Complexity requirements
    if (requirements.complexity === 'simple') {
      filtered = filtered.filter(m => 
        m.size === 'small' || m.speed === 'fast'
      );
    } else if (requirements.complexity === 'complex') {
      filtered = filtered.filter(m => 
        m.size === 'large' || m.strengths.includes('reasoning')
      );
    }
    
    return filtered;
  }

  /**
   * Calculate overall score for a model
   */
  private calculateModelScore(
    model: ModelCapability,
    taskType: string,
    requirements: any
  ): number {
    let score = 0;
    
    // Base suitability score (0-50)
    const taskMappings = {
      'coding': ['code generation', 'debugging', 'coding'],
      'analysis': ['reasoning', 'complex tasks', 'analysis'],
      'planning': ['reasoning', 'complex tasks'],
      'chat': ['general purpose', 'balance'],
      'simple': ['fast responses', 'lightweight']
    };
    
    const relevantStrengths = taskMappings[taskType as keyof typeof taskMappings] || [];
    const matchingStrengths = model.strengths.filter(strength =>
      relevantStrengths.some(relevant => strength.includes(relevant))
    );
    
    score += matchingStrengths.length * 10;
    
    // Performance history bonus (0-20)
    const historicalPerformance = this.getAveragePerformance(model.name, taskType);
    score += Math.min(historicalPerformance * 20, 20);
    
    // Requirements alignment (0-30)
    if (requirements.speed && model.speed === requirements.speed) score += 10;
    if (requirements.accuracy === 'high' && model.size === 'large') score += 10;
    if (requirements.resources === 'limited' && model.size === 'small') score += 10;
    
    return score;
  }

  /**
   * Get average performance for a model on specific task type
   */
  private getAveragePerformance(modelName: string, taskType: string): number {
    const key = `${modelName}-${taskType}`;
    const history = this.performanceHistory.get(key);
    
    if (!history || history.length === 0) return 0.5; // Default neutral score
    
    return history.reduce((sum, score) => sum + score, 0) / history.length;
  }

  /**
   * Record performance for a model
   */
  recordPerformance(
    modelName: string,
    taskType: string,
    success: boolean,
    duration: number = 0,
    quality: number = 1
  ): void {
    const key = `${modelName}-${taskType}`;
    
    // Calculate composite score (0-1)
    // Success contributes 50%, speed 25%, quality 25%
    let score = success ? 0.5 : 0;
    
    if (duration > 0) {
      // Normalize duration (assume 30s is baseline, faster is better)
      const speedScore = Math.max(0, Math.min(0.25, 0.25 * (30 / duration)));
      score += speedScore;
    }
    
    score += quality * 0.25;
    
    const history = this.performanceHistory.get(key) || [];
    history.push(score);
    
    // Keep only last 10 performance records
    if (history.length > 10) {
      history.shift();
    }
    
    this.performanceHistory.set(key, history);
    
    logger.debug(`📊 Recorded performance for ${modelName} on ${taskType}: ${score.toFixed(2)}`);
  }

  /**
   * Get adaptive model recommendation based on context
   */
  async getAdaptiveRecommendation(
    taskType: string,
    context: {
      urgency?: 'low' | 'medium' | 'high';
      complexity?: 'simple' | 'medium' | 'complex';
      accuracy_needed?: boolean;
      resource_constraints?: boolean;
      previous_failures?: string[];
    } = {}
  ): Promise<string> {
    
    const requirements = {
      speed: context.urgency === 'high' ? 'fast' as const : 
             context.urgency === 'low' ? 'slow' as const : 'medium' as const,
      accuracy: context.accuracy_needed ? 'high' as const : 'medium' as const,
      complexity: context.complexity || 'medium' as const,
      resources: context.resource_constraints ? 'limited' as const : 'normal' as const
    };
    
    const selectedModel = await this.selectOptimalModel(taskType, requirements);
    
    // Avoid previously failed models if specified
    if (context.previous_failures && context.previous_failures.includes(selectedModel)) {
      logger.warn(`⚠️ Avoiding previously failed model: ${selectedModel}`);
      const alternatives = await this.getAlternativeModels(selectedModel, taskType, requirements);
      return alternatives[0] || selectedModel;
    }
    
    return selectedModel;
  }

  /**
   * Get alternative models when primary choice fails
   */
  async getAlternativeModels(
    failedModel: string,
    taskType: string,
    requirements: any
  ): Promise<string[]> {
    let candidates = this.getTaskSpecificModels(taskType);
    
    // Remove failed model
    candidates = candidates.filter(model => model.name !== failedModel);
    
    // Apply filters and sort
    candidates = this.filterByRequirements(candidates, requirements);
    candidates.sort((a, b) => {
      const aScore = this.calculateModelScore(a, taskType, requirements);
      const bScore = this.calculateModelScore(b, taskType, requirements);
      return bScore - aScore;
    });
    
    return candidates.map(model => model.name);
  }

  /**
   * Monitor and auto-switch models based on performance
   */
  async autoOptimizeModelSelection(): Promise<void> {
    logger.info('🔄 Running automatic model optimization...');
    
    // Analyze performance patterns
    const taskTypes = ['coding', 'analysis', 'planning', 'chat'];
    
    for (const taskType of taskTypes) {
      const modelPerformance = new Map<string, number>();
      
      // Calculate average performance for each model
      for (const [key, history] of this.performanceHistory.entries()) {
        const [modelName, task] = key.split('-');
        
        if (task === taskType && history.length >= 3) {
          const avgPerformance = history.reduce((sum, score) => sum + score, 0) / history.length;
          modelPerformance.set(modelName, avgPerformance);
        }
      }
      
      // Identify best performing model
      if (modelPerformance.size > 0) {
        const bestModel = Array.from(modelPerformance.entries())
          .sort(([,a], [,b]) => b - a)[0];
        
        logger.info(`📈 Best performing model for ${taskType}: ${bestModel[0]} (score: ${bestModel[1].toFixed(2)})`);
      }
    }
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): any {
    const data: any = {};
    
    for (const [key, history] of this.performanceHistory.entries()) {
      const [modelName, taskType] = key.split('-');
      
      if (!data[taskType]) data[taskType] = {};
      
      data[taskType][modelName] = {
        history: [...history],
        average: history.reduce((sum, score) => sum + score, 0) / history.length,
        samples: history.length
      };
    }
    
    return data;
  }
}

// Additional type definitions for optimization
export interface ModelOptimizationResult {
  modelName: string;
  useCase: UseCase;
  quantizationRecommendation: QuantizationRecommendation;
  ollamaParams: Record<string, any>;
  environmentVars: Record<string, string>;
  expectedPerformance: PerformanceEstimate;
  timestamp: number;
}

export interface PerformanceEstimate {
  estimatedTokensPerSecond: number;
  estimatedMemoryUsageGB: number;
  estimatedLatencyMs: number;
  qualityScore: number;
  speedScore: number;
}