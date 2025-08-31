/**
 * Unified Model Client - Application Layer Service
 * 
 * Replaces the missing UnifiedModelClient from the refactor directory.
 * Implements the IModelClient interface and coordinates multiple model providers.
 */

import { EventEmitter } from 'events';
import { 
  IModelClient, 
  StreamToken,
} from '../../core/interfaces/client-interfaces.js';
import { 
  IModelProvider, 
  IModelRouter,
  ModelRequest, 
  ModelResponse, 
  ModelInfo, 
  ModelCapability
} from '../../domain/interfaces/model-client.js';
import { UnifiedConfiguration } from '../../domain/interfaces/configuration.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { OllamaClient } from '../../infrastructure/llm-providers/ollama-client.js';
import { LMStudioClient } from '../../infrastructure/llm-providers/lm-studio-client.js';
import { IntelligentModelRouter, RouterConfig, ModelProvider, ModelSpec, RoutingRequest, TaskType } from '../../core/routing/intelligent-model-router.js';
import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
import { VoiceArchetypeSystemInterface } from '../../domain/interfaces/voice-system.js';
import { LivingSpiralCoordinator, SpiralConfig } from '../../domain/services/living-spiral-coordinator.js';
import { LivingSpiralCoordinatorInterface } from '../../domain/interfaces/workflow-orchestrator.js';

export interface UnifiedModelClientConfig {
  defaultProvider: string;
  providers: ProviderConfig[];
  fallbackStrategy: 'fail-fast' | 'round-robin' | 'priority';
  executionMode?: 'auto' | 'quality' | 'fast' | 'balanced';
  fallbackChain?: string[];
  performanceThresholds?: {
    fastModeMaxTokens: number;
    timeoutMs: number;
    maxConcurrentRequests: number;
  };
  security?: any; // For compatibility with existing usage
  timeout: number;
  retryAttempts: number;
  enableCaching: boolean;
  enableMetrics: boolean;
}

export interface ProviderConfig {
  type: 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
  name: string;
  endpoint: string;
  enabled: boolean;
  priority: number;
  models: string[];
  apiKey?: string;
  timeout?: number;
}

/**
 * Unified Model Client that provides a single interface to multiple AI model providers.
 * Handles provider selection, fallbacks, and coordination.
 */
export interface UnifiedModelClientDependencies {
  providerRepository?: any;
  securityValidator?: any;
  streamingManager?: any;
  cacheCoordinator?: any;
  performanceMonitor?: any;
  hybridRouter?: any;
  voiceSystem?: VoiceArchetypeSystemInterface;
  livingSpiralCoordinator?: LivingSpiralCoordinatorInterface;
  logger?: any;
}

export class UnifiedModelClient extends EventEmitter implements IModelClient {
  private config: UnifiedModelClientConfig;
  private providers: Map<string, IModelProvider> = new Map();
  private router: IModelRouter;
  private intelligentRouter: IntelligentModelRouter;
  private voiceSystem?: VoiceArchetypeSystemInterface;
  private livingSpiralCoordinator?: LivingSpiralCoordinatorInterface;
  private initialized = false;
  private requestCount = 0;
  private cache = new Map<string, { response: ModelResponse; timestamp: number }>();
  private dependencies?: UnifiedModelClientDependencies;
  
  constructor(config: UnifiedModelClientConfig | UnifiedConfiguration, dependencies?: UnifiedModelClientDependencies) {
    super();
    
    this.dependencies = dependencies;
    
    // Handle both config types for backward compatibility
    if ('model' in config) {
      // UnifiedConfiguration format
      this.config = this.convertUnifiedConfig(config);
    } else {
      // Direct UnifiedModelClientConfig
      this.config = config;
    }
    
    this.setupProviders();
    this.setupRouter();
    this.setupIntelligentRouter();
    this.setupVoiceSystem();
    this.setupLivingSpiralCoordinator();
  }
  
  private convertUnifiedConfig(unifiedConfig: UnifiedConfiguration): UnifiedModelClientConfig {
    return {
      defaultProvider: unifiedConfig.model.defaultProvider,
      providers: unifiedConfig.model.providers.map(p => ({
        type: p.type as any,
        name: p.name,
        endpoint: p.endpoint,
        enabled: p.enabled,
        priority: p.priority || 1,
        models: p.models,
        apiKey: p.apiKey,
        timeout: 30000 // Default timeout since ModelProviderConfiguration doesn't have timeout property
      })),
      fallbackStrategy: 'priority',
      timeout: unifiedConfig.model.timeout,
      retryAttempts: 3,
      enableCaching: true,
      enableMetrics: true
    };
  }
  
  private setupProviders(): void {
    for (const providerConfig of this.config.providers) {
      if (!providerConfig.enabled) continue;
      
      try {
        let provider: IModelProvider;
        
        switch (providerConfig.type) {
          case 'ollama':
            provider = new OllamaProvider(providerConfig);
            break;
          case 'lm-studio':
            provider = new LMStudioProvider(providerConfig);
            break;
          default:
            logger.warn(`Unknown provider type: ${providerConfig.type}`);
            continue;
        }
        
        this.providers.set(providerConfig.name, provider);
        logger.info(`Registered provider: ${providerConfig.name} (${providerConfig.type})`);
        
      } catch (error) {
        logger.error(`Failed to setup provider ${providerConfig.name}:`, error);
      }
    }
  }
  
  private setupRouter(): void {
    this.router = new SimpleModelRouter(this.providers, this.config);
  }
  
  private setupIntelligentRouter(): void {
    const routerConfig = this.convertToRouterConfig();
    this.intelligentRouter = new IntelligentModelRouter(routerConfig);
  }
  
  private convertToRouterConfig(): RouterConfig {
    const modelProviders: ModelProvider[] = this.config.providers.map(providerConfig => {
      const models: ModelSpec[] = providerConfig.models.map(modelName => ({
        id: modelName,
        name: modelName,
        displayName: modelName,
        contextWindow: 128000, // Default context window
        maxTokens: 128000,
        strengthProfiles: [
          {
            category: providerConfig.type === 'ollama' ? 'analysis' : 'code-generation',
            score: 0.8,
            examples: [`${modelName} for ${providerConfig.type}`]
          }
        ],
        costPerToken: {
          input: providerConfig.type === 'ollama' || providerConfig.type === 'lm-studio' ? 0 : 0.001,
          output: providerConfig.type === 'ollama' || providerConfig.type === 'lm-studio' ? 0 : 0.002
        },
        latencyProfile: {
          firstToken: providerConfig.type === 'lm-studio' ? 500 : 1000,
          tokensPerSecond: providerConfig.type === 'lm-studio' ? 50 : 30
        },
        qualityScore: 0.8,
        supportedFeatures: ['completion', 'chat']
      }));
      
      return {
        id: providerConfig.name,
        name: providerConfig.name,
        type: providerConfig.type as any,
        endpoint: providerConfig.endpoint,
        models,
        capabilities: [
          { feature: 'streaming', supported: true },
          { feature: 'function-calling', supported: false }
        ],
        costProfile: {
          tier: providerConfig.type === 'ollama' || providerConfig.type === 'lm-studio' ? 'local' : 'paid',
          costPerRequest: 0,
          costOptimized: true
        },
        performanceProfile: {
          averageLatency: providerConfig.timeout || 5000,
          throughput: 1,
          reliability: 0.95,
          uptime: 95
        },
        healthStatus: {
          status: 'healthy',
          lastChecked: new Date(),
          responseTime: 0,
          errorRate: 0,
          availableModels: providerConfig.models
        }
      };
    });
    
    return {
      providers: modelProviders,
      defaultStrategy: {
        primary: 'balanced',
        fallback: 'escalate',
        escalationTriggers: [
          {
            condition: 'low-confidence',
            threshold: 0.5,
            action: 'upgrade-model'
          }
        ]
      },
      costOptimization: {
        enabled: true,
        budgetLimits: {
          daily: 10.0,
          monthly: 100.0
        },
        thresholds: {
          lowCost: 0.01,
          mediumCost: 0.10,
          highCost: 1.00
        }
      },
      performance: {
        healthCheckInterval: 60000,
        timeoutMs: this.config.timeout || 30000,
        retryAttempts: this.config.retryAttempts || 3,
        circuitBreakerThreshold: 5
      },
      intelligence: {
        learningEnabled: true,
        adaptiveRouting: true,
        qualityFeedbackWeight: 0.3,
        costFeedbackWeight: 0.2
      }
    };
  }
  
  private setupVoiceSystem(): void {
    if (this.dependencies?.voiceSystem) {
      this.voiceSystem = this.dependencies.voiceSystem;
      logger.info('Voice system provided via dependencies');
    } else {
      // Create a default voice system if not provided
      try {
        // Import the createLogger function for voice system
        const voiceLogger = this.dependencies?.logger || logger;
        
        // Initialize voice system with this client (spiral coordinator will be connected later)
        this.voiceSystem = new VoiceArchetypeSystem(
          voiceLogger, 
          undefined, // spiralCoordinator will be set up in setupLivingSpiralCoordinator
          this, // Pass this model client to the voice system
          {
            voices: {
              default: ['explorer', 'maintainer'],
              available: [
                'explorer', 'maintainer', 'analyzer', 'developer', 
                'implementor', 'security', 'architect', 'designer', 'optimizer'
              ],
              parallel: true,
              maxConcurrent: 3
            }
          }
        );
        logger.info('Voice archetype system initialized with default configuration');
      } catch (error) {
        logger.warn('Failed to initialize voice system:', error);
        this.voiceSystem = undefined;
      }
    }
  }
  
  private setupLivingSpiralCoordinator(): void {
    if (this.dependencies?.livingSpiralCoordinator) {
      this.livingSpiralCoordinator = this.dependencies.livingSpiralCoordinator;
      logger.info('Living Spiral Coordinator provided via dependencies');
    } else if (this.voiceSystem) {
      // Create a default Living Spiral Coordinator if not provided
      try {
        const spiralConfig: SpiralConfig = {
          maxIterations: 5,
          qualityThreshold: 0.8,
          convergenceTarget: 0.9,
          enableReflection: true,
          parallelVoices: true,
          councilSize: 3
        };
        
        // Note: For now, we'll create a basic implementation
        // The full Living Spiral Coordinator requires voice orchestration service interface
        logger.info('Living Spiral Coordinator integration setup (requires voice orchestration service)');
        
        // For now, we'll create a simplified integration point
        this.livingSpiralCoordinator = {
          executeSpiralProcess: async (prompt: string) => {
            if (this.voiceSystem) {
              return await this.voiceSystem.processPrompt(prompt, {
                voices: ['explorer', 'maintainer', 'analyzer'],
                councilMode: 'consensus'
              });
            }
            return { error: 'No voice system available' };
          },
          executeSpiralIteration: async (input: string, iteration: number) => {
            return await this.processWithVoices(input, { 
              voices: ['explorer', 'maintainer'], 
              context: { iteration } 
            });
          },
          checkConvergence: async (results: any[]) => {
            // Simple convergence check based on result consistency
            return results.length >= 3;
          },
          analyzeCode: async (filePath: string, context: any) => {
            return await this.processWithVoices(`Analyze code in ${filePath}`, { 
              voices: ['analyzer', 'security', 'maintainer'],
              context 
            });
          },
          initialize: async (dependencies: any) => {
            logger.info('Living Spiral Coordinator initialized');
          },
          shutdown: async () => {
            logger.info('Living Spiral Coordinator shutdown');
          }
        };
        
        logger.info('Living Spiral Coordinator integrated with voice system');
        
        // Update voice system with spiral coordinator if it supports it
        if (this.voiceSystem && (this.voiceSystem as any).setLivingSpiralCoordinator) {
          (this.voiceSystem as any).setLivingSpiralCoordinator(this.livingSpiralCoordinator);
        }
        
      } catch (error) {
        logger.warn('Failed to initialize Living Spiral Coordinator:', error);
        this.livingSpiralCoordinator = undefined;
      }
    } else {
      logger.warn('Living Spiral Coordinator requires voice system - skipping initialization');
    }
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    logger.info('Initializing Unified Model Client...');
    
    // Initialize all providers
    const initPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        if ('initialize' in provider && typeof provider.initialize === 'function') {
          await provider.initialize();
        }
      } catch (error) {
        logger.error(`Failed to initialize provider:`, error);
      }
    });
    
    await Promise.allSettled(initPromises);
    
    // Verify at least one provider is available
    const availableProviders = await this.getAvailableProviders();
    if (availableProviders.length === 0) {
      throw new Error('No model providers are available');
    }
    
    this.initialized = true;
    this.emit('initialized', { availableProviders: availableProviders.length });
    logger.info(`Unified Model Client initialized with ${availableProviders.length} providers`);
  }
  
  async request(request: ModelRequest): Promise<ModelResponse> {
    if (!this.initialized) {
      throw new Error('Model client not initialized');
    }
    
    const requestId = request.id || `req-${Date.now()}-${++this.requestCount}`;
    const startTime = Date.now();
    
    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minute cache
        logger.debug(`Cache hit for request: ${requestId}`);
        return { ...cached.response, id: requestId };
      }
    }
    
    try {
      logger.debug(`Processing request: ${requestId}`);
      
      // Use intelligent routing for better provider selection
      let provider: IModelProvider;
      let model: string;
      
      try {
        const routingRequest: RoutingRequest = {
          query: request.prompt,
          context: typeof request.context === 'string' ? request.context : JSON.stringify(request.context),
          taskType: this.analyzeTaskType(request),
          priority: 'medium', // Default priority since ModelRequest doesn't have this property
          constraints: {
            maxCost: 1.0,
            maxLatency: this.config.timeout || 30000,
            requireLocal: false,
            requireStreaming: request.stream || false
          }
        };
        
        const routingDecision = await this.intelligentRouter.route(routingRequest);
        const selectedProvider = this.providers.get(routingDecision.provider.name);
        
        if (selectedProvider && await selectedProvider.isAvailable()) {
          provider = selectedProvider;
          model = routingDecision.model.name;
          logger.debug(`Intelligent router selected: ${routingDecision.provider.name}/${model}`);
        } else {
          // Fallback to simple router
          const fallback = await this.router.route(request);
          provider = fallback.provider;
          model = fallback.model;
          logger.debug(`Fallback to simple router: ${provider.type}/${model}`);
        }
      } catch (routingError) {
        logger.warn(`Intelligent routing failed, using simple router:`, routingError);
        // Fallback to simple router
        const fallback = await this.router.route(request);
        provider = fallback.provider;
        model = fallback.model;
      }
      
      // Execute request with the selected provider
      const requestWithId = { ...request, id: requestId, model };
      const response = await provider.request(requestWithId);
      
      // Cache successful responses
      if (this.config.enableCaching && response) {
        const cacheKey = this.getCacheKey(request);
        this.cache.set(cacheKey, { response, timestamp: Date.now() });
      }
      
      const duration = Date.now() - startTime;
      this.emit('request-completed', { requestId, duration, provider: provider.type });
      logger.debug(`Request completed: ${requestId} (${duration}ms)`);
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('request-failed', { requestId, duration, error });
      logger.error(`Request failed: ${requestId}`, error);
      throw error;
    }
  }
  
  async *stream(request: ModelRequest): AsyncIterableIterator<StreamToken> {
    if (!this.initialized) {
      throw new Error('Model client not initialized');
    }
    
    const requestId = request.id || `stream-${Date.now()}-${++this.requestCount}`;
    
    try {
      logger.debug(`Processing stream request: ${requestId}`);
      
      // Route to appropriate provider
      const { provider, model } = await this.router.route(request);
      
      // Execute streaming request
      const requestWithId = { ...request, id: requestId, model, stream: true };
      
      if ('stream' in provider && typeof provider.stream === 'function') {
        yield* provider.stream(requestWithId);
      } else {
        // Fallback to regular request for non-streaming providers
        const response = await provider.request(requestWithId);
        yield {
          content: response.content,
          isComplete: true,
          index: 0,
          timestamp: Date.now(),
          metadata: response.metadata
        };
      }
      
      this.emit('stream-completed', { requestId });
      
    } catch (error) {
      this.emit('stream-failed', { requestId, error });
      logger.error(`Stream request failed: ${requestId}`, error);
      throw error;
    }
  }
  
  async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    
    for (const provider of this.providers.values()) {
      try {
        if (await provider.isAvailable()) {
          const providerModels = await provider.getSupportedModels();
          models.push(...providerModels);
        }
      } catch (error) {
        logger.warn(`Failed to get models from provider:`, error);
      }
    }
    
    return models;
  }
  
  async isHealthy(): Promise<boolean> {
    const availableProviders = await this.getAvailableProviders();
    return availableProviders.length > 0;
  }
  
  async shutdown(): Promise<void> {
    logger.info('Shutting down Unified Model Client...');
    
    // Shutdown all providers
    const shutdownPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        if ('shutdown' in provider && typeof provider.shutdown === 'function') {
          await provider.shutdown();
        }
      } catch (error) {
        logger.error('Error shutting down provider:', error);
      }
    });
    
    await Promise.allSettled(shutdownPromises);
    
    // Shutdown intelligent router
    if (this.intelligentRouter) {
      this.intelligentRouter.shutdown();
    }
    
    // Shutdown Living Spiral Coordinator
    if (this.livingSpiralCoordinator) {
      await this.livingSpiralCoordinator.shutdown();
    }
    
    this.providers.clear();
    this.cache.clear();
    this.initialized = false;
    this.removeAllListeners();
    
    logger.info('Unified Model Client shut down');
  }
  
  // Utility methods
  private getCacheKey(request: ModelRequest): string {
    return `${request.model || 'default'}:${request.prompt}:${JSON.stringify(request.tools || [])}`;
  }
  
  private analyzeTaskType(request: ModelRequest): TaskType {
    const prompt = request.prompt.toLowerCase();
    let category: TaskType['category'] = 'general';
    let complexity: TaskType['complexity'] = 'simple';
    
    // Analyze category based on prompt content
    if (prompt.includes('code') || prompt.includes('function') || prompt.includes('class')) {
      category = 'code-generation';
    } else if (prompt.includes('analyze') || prompt.includes('explain') || prompt.includes('review')) {
      category = 'analysis';
    } else if (prompt.includes('fix') || prompt.includes('debug') || prompt.includes('error')) {
      category = 'debugging';
    } else if (prompt.includes('refactor') || prompt.includes('optimize')) {
      category = 'refactoring';
    } else if (prompt.includes('edit') || prompt.includes('change') || prompt.includes('modify')) {
      category = 'editing';
    } else if (prompt.includes('document') || prompt.includes('explain') || prompt.includes('describe')) {
      category = 'documentation';
    }
    
    // Analyze complexity based on prompt length and content
    const promptLength = request.prompt.length;
    if (promptLength > 1000 || prompt.includes('complex') || prompt.includes('architecture')) {
      complexity = 'complex';
    } else if (promptLength > 500 || prompt.includes('analysis') || prompt.includes('detailed')) {
      complexity = 'moderate';
    } else if (prompt.includes('expert') || prompt.includes('advanced') || prompt.includes('sophisticated')) {
      complexity = 'expert';
    }
    
    return {
      category,
      complexity,
      estimatedTokens: Math.min(request.maxTokens || 2000, promptLength * 2),
      timeConstraint: this.config.timeout || 30000, // Use config timeout since ModelRequest doesn't have timeout
      qualityRequirement: complexity === 'expert' ? 'critical' : complexity === 'complex' ? 'production' : 'draft'
    };
  }
  
  // Voice Archetype System Integration Methods
  
  /**
   * Process a prompt with multiple voices for comprehensive analysis
   */
  async processWithVoices(prompt: string, options?: { voices?: string[]; context?: any }): Promise<any> {
    if (!this.voiceSystem) {
      logger.warn('Voice system not available, falling back to single voice response');
      return await this.generateText(prompt);
    }
    
    try {
      return await this.voiceSystem.processPrompt(prompt, options);
    } catch (error) {
      logger.error('Multi-voice processing failed, using fallback:', error);
      return await this.generateText(prompt);
    }
  }
  
  /**
   * Generate multi-voice solutions for a given problem
   */
  async generateMultiVoiceResponses(voices: string[], prompt: string, options?: any): Promise<any> {
    if (!this.voiceSystem) {
      logger.warn('Voice system not available, generating single response');
      return {
        responses: [{ voice: 'default', content: await this.generateText(prompt) }],
        synthesis: await this.generateText(prompt),
        voicesUsed: ['default'],
        consensusScore: 1.0
      };
    }
    
    try {
      return await this.voiceSystem.generateMultiVoiceSolutions(voices, prompt);
    } catch (error) {
      logger.error('Multi-voice generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific voice perspective on a prompt
   */
  async getVoicePerspective(voiceId: string, prompt: string): Promise<any> {
    if (!this.voiceSystem) {
      logger.warn('Voice system not available, generating default response');
      return {
        voice: 'default',
        content: await this.generateText(prompt),
        confidence: 0.5
      };
    }
    
    try {
      return await this.voiceSystem.getVoicePerspective(voiceId, prompt);
    } catch (error) {
      logger.error(`Failed to get ${voiceId} perspective:`, error);
      throw error;
    }
  }
  
  /**
   * Get available voice archetypes
   */
  getAvailableVoices(): string[] {
    if (!this.voiceSystem) {
      return ['default'];
    }
    
    try {
      return this.voiceSystem.getAvailableVoices();
    } catch (error) {
      logger.error('Failed to get available voices:', error);
      return ['default'];
    }
  }
  
  /**
   * Get the voice archetype system instance
   */
  getVoiceSystem(): VoiceArchetypeSystemInterface | undefined {
    return this.voiceSystem;
  }
  
  // Living Spiral Coordinator Integration Methods
  
  /**
   * Execute the complete Living Spiral process for iterative development
   */
  async executeLivingSpiralProcess(prompt: string): Promise<any> {
    if (!this.livingSpiralCoordinator) {
      logger.warn('Living Spiral Coordinator not available, falling back to voice processing');
      return await this.processWithVoices(prompt, { 
        voices: ['explorer', 'maintainer', 'analyzer'] 
      });
    }
    
    try {
      return await this.livingSpiralCoordinator.executeSpiralProcess(prompt);
    } catch (error) {
      logger.error('Living Spiral process failed:', error);
      throw error;
    }
  }
  
  /**
   * Execute a single Living Spiral iteration
   */
  async executeSpiralIteration(input: string, iteration: number): Promise<any> {
    if (!this.livingSpiralCoordinator) {
      logger.warn('Living Spiral Coordinator not available, using voice processing');
      return await this.processWithVoices(input, { 
        voices: ['explorer', 'maintainer'], 
        context: { iteration } 
      });
    }
    
    try {
      return await this.livingSpiralCoordinator.executeSpiralIteration(input, iteration);
    } catch (error) {
      logger.error('Spiral iteration failed:', error);
      throw error;
    }
  }
  
  /**
   * Analyze code using the Living Spiral methodology
   */
  async analyzeLivingSpiralCode(filePath: string, context?: any): Promise<any> {
    if (!this.livingSpiralCoordinator) {
      logger.warn('Living Spiral Coordinator not available, using voice analysis');
      return await this.processWithVoices(`Analyze code in ${filePath}`, {
        voices: ['analyzer', 'security', 'maintainer'],
        context
      });
    }
    
    try {
      return await this.livingSpiralCoordinator.analyzeCode(filePath, context);
    } catch (error) {
      logger.error('Living Spiral code analysis failed:', error);
      throw error;
    }
  }
  
  /**
   * Get the Living Spiral Coordinator instance
   */
  getLivingSpiralCoordinator(): LivingSpiralCoordinatorInterface | undefined {
    return this.livingSpiralCoordinator;
  }
  
  private async getAvailableProviders(): Promise<IModelProvider[]> {
    const available: IModelProvider[] = [];
    
    for (const provider of this.providers.values()) {
      try {
        if (await provider.isAvailable()) {
          available.push(provider);
        }
      } catch (error) {
        // Provider not available
      }
    }
    
    return available;
  }
  
  // Public utility methods for backward compatibility
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }
  
  getConfiguration(): UnifiedModelClientConfig {
    return { ...this.config };
  }
  
  async testConnection(): Promise<{ provider: string; available: boolean; latency?: number }[]> {
    const results = [];
    
    for (const [name, provider] of this.providers.entries()) {
      const startTime = Date.now();
      try {
        const available = await provider.isAvailable();
        const latency = Date.now() - startTime;
        results.push({ provider: name, available, latency });
      } catch (error) {
        results.push({ provider: name, available: false });
      }
    }
    
    return results;
  }

  // IModelClient interface methods
  async processRequest(request: ModelRequest): Promise<ModelResponse> {
    return this.request(request);
  }

  async streamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void
  ): Promise<ModelResponse> {
    // For now, simulate streaming by calling request and emitting tokens
    const response = await this.request(request);
    
    // Simulate token streaming
    const words = response.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      onToken({
        content: words[i] + (i < words.length - 1 ? ' ' : ''),
        isComplete: i === words.length - 1,
        index: i,
        timestamp: Date.now()
      });
    }
    
    return response;
  }

  /**
   * Generate text from a prompt - legacy compatibility method
   */
  async generate(prompt: string, options?: any): Promise<string> {
    return this.generateText(prompt, options);
  }

  async generateText(prompt: string, options?: any): Promise<string> {
    const request: ModelRequest = {
      id: `gen_${Date.now()}`,
      prompt,
      model: options?.model || this.config.defaultProvider,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens
    };
    
    const response = await this.request(request);
    return response.content;
  }

  async synthesize(request: ModelRequest): Promise<ModelResponse> {
    return this.request(request);
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const status = await this.getStatus();
    const result: Record<string, boolean> = {};
    
    for (const providerStatus of status) {
      result[providerStatus.provider] = providerStatus.available;
    }
    
    return result;
  }

  getProviders(): Map<string, any> {
    return new Map([...this.providers.entries()]);
  }

  async destroy(): Promise<void> {
    return this.shutdown();
  }

  /**
   * Get status of all providers
   */
  async getStatus(): Promise<Array<{ provider: string; available: boolean; latency?: number }>> {
    const results: Array<{ provider: string; available: boolean; latency?: number }> = [];
    
    for (const [name, provider] of this.providers) {
      try {
        const startTime = Date.now();
        const available = await provider.isAvailable();
        const latency = Date.now() - startTime;
        results.push({ provider: name, available, latency });
      } catch (error) {
        results.push({ provider: name, available: false });
      }
    }
    
    return results;
  }
}

// Provider Implementations
class OllamaProvider implements IModelProvider {
  readonly type = 'ollama';
  readonly endpoint: string;
  private client: OllamaClient;
  
  constructor(private config: ProviderConfig) {
    this.endpoint = config.endpoint;
    this.client = new OllamaClient({
      endpoint: config.endpoint,
      timeout: config.timeout || 30000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      connectionTimeout: 10000,
      healthCheckInterval: 60000
    });
  }
  
  async initialize(): Promise<void> {
    // OllamaClient initializes in constructor, test connection to ensure it's ready
    await this.client.testConnection();
  }
  
  async request(request: ModelRequest): Promise<ModelResponse> {
    const ollamaResponse = await this.client.generateText({
      model: request.model || 'default',
      prompt: request.prompt,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
        num_ctx: 256000, // Set large context window (256K tokens)
        num_batch: 512,  // Batch size for processing
        num_gqa: 1,      // Grouped query attention
        num_gpu: 999,    // Use all available GPU layers
        top_k: 40,       // Top-k sampling
        top_p: 0.9,      // Top-p sampling
        repeat_penalty: 1.1, // Repetition penalty
        seed: -1         // Random seed
      }
    });
    
    return {
      id: `ollama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: ollamaResponse.response || '',
      model: request.model || 'default',
      provider: 'ollama',
      usage: {
        promptTokens: ollamaResponse.prompt_eval_count || 0,
        completionTokens: ollamaResponse.eval_count || 0,
        totalTokens: (ollamaResponse.prompt_eval_count || 0) + (ollamaResponse.eval_count || 0)
      },
      metadata: {
        finishReason: ollamaResponse.done ? 'stop' : 'length',
        totalDuration: ollamaResponse.total_duration,
        loadDuration: ollamaResponse.load_duration
      }
    } as ModelResponse;
  }
  
  async isAvailable(): Promise<boolean> {
    return await this.client.testConnection();
  }
  
  async getSupportedModels(): Promise<ModelInfo[]> {
    const models = await this.client.listModels();
    return models.map(model => ({
      id: model.name,
      name: model.name,
      provider: 'ollama',
      description: `Ollama model: ${model.name}`,
      capabilities: [
        { type: 'completion', supported: true },
        { type: 'chat', supported: true }
      ] as ModelCapability[]
    }));
  }
  
  async shutdown(): Promise<void> {
    await this.client.close();
  }
}

class LMStudioProvider implements IModelProvider {
  readonly type = 'lm-studio';
  readonly endpoint: string;
  private client: LMStudioClient;
  
  constructor(private config: ProviderConfig) {
    this.endpoint = config.endpoint;
    this.client = new LMStudioClient({
      baseUrl: config.endpoint,
      timeout: config.timeout || 30000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      connectionTimeout: 10000,
      healthCheckInterval: 60000,
      websocketReconnectDelay: 5000
    });
  }
  
  async initialize(): Promise<void> {
    // LMStudioClient initializes in constructor, test connection to ensure it's ready
    await this.client.testConnection();
  }
  
  async request(request: ModelRequest): Promise<ModelResponse> {
    const lmResponse = await this.client.complete({
      modelPath: request.model || 'default',
      prompt: request.prompt,
      options: {
        temperature: request.temperature,
        maxTokens: request.maxTokens
      }
    });
    
    return {
      id: `lm-studio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: lmResponse.content,
      model: request.model || 'default',
      provider: 'lm-studio',
      usage: lmResponse.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      metadata: {
        finishReason: lmResponse.finishReason || 'stop'
      }
    } as ModelResponse;
  }
  
  async isAvailable(): Promise<boolean> {
    return await this.client.testConnection();
  }
  
  async getSupportedModels(): Promise<ModelInfo[]> {
    const models = await this.client.listLoadedModels();
    return models.map(model => ({
      id: model.identifier,
      name: model.path,
      provider: 'lm-studio',
      description: `LM Studio model: ${model.path}`,
      capabilities: [
        { type: 'completion', supported: true },
        { type: 'chat', supported: true }
      ] as ModelCapability[]
    }));
  }
  
  async shutdown(): Promise<void> {
    await this.client.close();
  }
}

// Simple Router Implementation
class SimpleModelRouter implements IModelRouter {
  constructor(
    private providers: Map<string, IModelProvider>,
    private config: UnifiedModelClientConfig
  ) {}
  
  async route(request: ModelRequest): Promise<{ provider: IModelProvider; model: string }> {
    // Try to use the specified provider first
    if (request.provider) {
      const provider = this.providers.get(request.provider);
      if (provider && await provider.isAvailable()) {
        return { provider, model: request.model || 'default' };
      }
    }
    
    // Use default provider
    const defaultProvider = this.providers.get(this.config.defaultProvider);
    if (defaultProvider && await defaultProvider.isAvailable()) {
      return { provider: defaultProvider, model: request.model || 'default' };
    }
    
    // Fallback to any available provider
    for (const provider of this.providers.values()) {
      if (await provider.isAvailable()) {
        return { provider, model: request.model || 'default' };
      }
    }
    
    throw new Error('No available model providers');
  }
  
  getFallbackChain(request: ModelRequest): IModelProvider[] {
    const providers = Array.from(this.providers.values());
    return providers.sort((a, b) => {
      const aConfig = this.config.providers.find(p => p.name === a.type);
      const bConfig = this.config.providers.find(p => p.name === b.type);
      return (bConfig?.priority || 0) - (aConfig?.priority || 0);
    });
  }
}

// Factory function for easy creation
export function createUnifiedModelClient(config: UnifiedConfiguration): UnifiedModelClient {
  return new UnifiedModelClient(config);
}