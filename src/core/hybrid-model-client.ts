import { LMStudioClient, LMStudioResponse } from './lm-studio-client.js';
import { LocalModelClient, VoiceResponse, ProjectContext, VoiceArchetype } from './local-model-client.js';
import { IntelligentModelSelector, TaskRoutingDecision, TaskClassification, HybridRoutingConfig } from './intelligent-model-selector.js';
import { HybridConfigManager, HybridFullConfig } from './hybrid-config-manager.js';
import { logger } from './logger.js';
import { timeoutManager } from './timeout-manager.js';

export interface HybridResponse {
  content: string;
  confidence: number;
  provider: 'lmstudio' | 'ollama' | 'hybrid';
  model: string;
  responseTime: number;
  tokensUsed: number;
  escalated: boolean;
  reasoning: string;
  metadata: {
    taskClassification: TaskClassification;
    routingDecision: TaskRoutingDecision;
    originalProvider?: 'lmstudio' | 'ollama' | 'hybrid';
    escalationReason?: string;
  };
}

export interface HybridClientConfig {
  configPath?: string;
  autoLoadConfig?: boolean;
  enableFallback?: boolean;
  enableLearning?: boolean;
}

/**
 * Hybrid Model Client Orchestrator
 * 
 * Intelligently routes requests between LM Studio and Ollama based on:
 * - Task complexity and type
 * - System resources and availability
 * - Historical performance data
 * - Confidence scoring and escalation logic
 */
export class HybridModelClient {
  private lmStudioClient: LMStudioClient;
  private ollamaClient: LocalModelClient;
  private modelSelector: IntelligentModelSelector;
  private configManager: HybridConfigManager;
  private config: HybridFullConfig | null = null;
  private responseCache = new Map<string, HybridResponse>();
  private circuitBreaker = new Map<string, { failures: number; lastFailure: number; isOpen: boolean }>();

  constructor(config: HybridClientConfig = {}) {
    // Initialize configuration manager
    this.configManager = new HybridConfigManager(config.configPath);
    
    // Initialize with default LM Studio configuration
    this.lmStudioClient = new LMStudioClient({
      endpoint: 'http://localhost:1234',
      enabled: true,
      models: [],
      maxConcurrent: 3,
      streamingEnabled: true,
      taskTypes: ['template', 'edit', 'format', 'boilerplate']
    });

    // Initialize with default Ollama configuration
    this.ollamaClient = new LocalModelClient({
      endpoint: 'http://localhost:11434',
      model: 'auto',
      timeout: 120000,
      maxTokens: 4096,
      temperature: 0.7
    });

    // Initialize model selector
    this.modelSelector = new IntelligentModelSelector();

    // Auto-load configuration if enabled
    if (config.autoLoadConfig !== false) {
      this.initializeAsync();
    }
  }

  /**
   * Initialize the hybrid client asynchronously
   */
  private async initializeAsync(): Promise<void> {
    try {
      await this.loadConfiguration();
      logger.info('Hybrid model client initialized successfully');
    } catch (error) {
      logger.warn('Failed to initialize hybrid client configuration:', error);
    }
  }

  /**
   * Load configuration and update clients
   */
  async loadConfiguration(): Promise<void> {
    try {
      this.config = await this.configManager.loadConfig();
      await this.updateClientsFromConfig();
      
      // Update model selector with hybrid configuration
      this.modelSelector.updateHybridConfig(this.config.hybrid);
      
      logger.info('Hybrid configuration loaded and applied');
    } catch (error) {
      logger.error('Failed to load hybrid configuration:', error);
      throw error;
    }
  }

  /**
   * Update client configurations from loaded config
   */
  private async updateClientsFromConfig(): Promise<void> {
    if (!this.config) return;

    // Update LM Studio client
    this.lmStudioClient.updateConfig({
      endpoint: this.config.hybrid.lmStudio.endpoint,
      enabled: this.config.hybrid.lmStudio.enabled,
      models: this.config.hybrid.lmStudio.models,
      maxConcurrent: this.config.hybrid.lmStudio.maxConcurrent,
      streamingEnabled: this.config.hybrid.lmStudio.streamingEnabled,
      taskTypes: this.config.hybrid.lmStudio.taskTypes
    });

    // Update Ollama client configuration
    this.ollamaClient = new LocalModelClient({
      endpoint: this.config.hybrid.ollama.endpoint,
      model: 'auto',
      timeout: 120000,
      maxTokens: 4096,
      temperature: 0.7
    });
  }

  /**
   * Generate response using hybrid routing
   */
  async generateResponse(
    prompt: string, 
    context: ProjectContext = {},
    options: { 
      forceProvider?: 'lmstudio' | 'ollama';
      enableEscalation?: boolean;
      cacheKey?: string;
    } = {}
  ): Promise<HybridResponse> {
    const startTime = Date.now();
    
    try {
      // Check cache if enabled
      if (options.cacheKey && this.isCacheEnabled()) {
        const cached = this.responseCache.get(options.cacheKey);
        if (cached && this.isCacheValid(cached)) {
          logger.debug('Returning cached response');
          return cached;
        }
      }

      // Classify the task
      const classification = this.modelSelector.classifyTask(prompt, context);
      logger.info(`Task classified: ${classification.type} (${classification.complexity})`);

      // Make routing decision
      let routingDecision: TaskRoutingDecision;
      
      if (options.forceProvider) {
        routingDecision = {
          selectedLLM: options.forceProvider,
          confidence: 1.0,
          reasoning: `Forced to use ${options.forceProvider}`,
          fallbackStrategy: options.forceProvider === 'lmstudio' ? 'ollama' : 'lmstudio'
        };
      } else {
        routingDecision = await this.modelSelector.makeRoutingDecision(prompt, context);
      }

      logger.info(`Routing decision: ${routingDecision.selectedLLM} (confidence: ${routingDecision.confidence})`);

      // Execute primary request
      let response: HybridResponse;
      try {
        response = await this.executeRequest(prompt, context, routingDecision, classification, startTime);
      } catch (error) {
        // Handle primary request failure - always attempt fallback for better reliability
        logger.warn(`Primary provider ${routingDecision.selectedLLM} failed, attempting fallback`);
        try {
          response = await this.executeFallback(prompt, context, routingDecision, classification, startTime, error);
        } catch (fallbackError) {
          logger.error(`Both primary and fallback providers failed`, { primary: error, fallback: fallbackError });
          throw new Error(`All providers failed: Primary (${routingDecision.selectedLLM}): ${error instanceof Error ? error.message : String(error)}, Fallback: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }

      // Check for escalation
      if (options.enableEscalation !== false && this.shouldEscalate(response, routingDecision)) {
        logger.info(`Escalating from ${response.provider} due to low confidence`);
        response = await this.executeEscalation(prompt, context, response, classification, startTime);
      }

      // Record outcome for learning
      this.recordOutcome(response, classification, routingDecision);

      // Cache response if enabled
      if (options.cacheKey && this.isCacheEnabled()) {
        this.responseCache.set(options.cacheKey, response);
      }

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`Hybrid response generation failed (${responseTime}ms):`, error);
      throw error;
    }
  }

  /**
   * Execute request with the selected provider
   */
  private async executeRequest(
    prompt: string,
    context: ProjectContext,
    routingDecision: TaskRoutingDecision,
    classification: TaskClassification,
    startTime: number
  ): Promise<HybridResponse> {
    const provider = routingDecision.selectedLLM;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(provider)) {
      throw new Error(`Circuit breaker is open for ${provider}`);
    }

    try {
      let result: { content: string; confidence?: number; tokens_used?: number; model?: string };
      
      if (provider === 'lmstudio') {
        const contextStr = this.serializeContextSafely(context);
        const taskMetadata = {
          taskType: classification.type,
          complexity: classification.complexity
        };
        const lmResult = await this.lmStudioClient.generateCode(
          prompt, 
          contextStr ? [contextStr] : [], 
          taskMetadata
        );
        result = {
          content: lmResult.content,
          confidence: lmResult.confidence,
          tokens_used: lmResult.tokens_used,
          model: lmResult.model
        };
      } else {
        const ollamaResult = await this.ollamaClient.generate(prompt);
        result = {
          content: ollamaResult,
          confidence: 0.8, // Default confidence for Ollama
          tokens_used: 0,
          model: this.ollamaClient.getCurrentModel()
        };
      }

      const responseTime = Date.now() - startTime;
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker(provider);

      return {
        content: result.content,
        confidence: result.confidence || 0.8,
        provider,
        model: result.model || 'unknown',
        responseTime,
        tokensUsed: result.tokens_used || 0,
        escalated: false,
        reasoning: routingDecision.reasoning,
        metadata: {
          taskClassification: classification,
          routingDecision
        }
      };

    } catch (error) {
      // Record circuit breaker failure
      this.recordCircuitBreakerFailure(provider);
      throw error;
    }
  }

  /**
   * Execute fallback to alternative provider
   */
  private async executeFallback(
    prompt: string,
    context: ProjectContext,
    originalDecision: TaskRoutingDecision,
    classification: TaskClassification,
    startTime: number,
    originalError: any
  ): Promise<HybridResponse> {
    const fallbackProvider = originalDecision.fallbackStrategy as 'lmstudio' | 'ollama';
    
    const fallbackDecision: TaskRoutingDecision = {
      selectedLLM: fallbackProvider,
      confidence: 0.7, // Lower confidence for fallback
      reasoning: `Fallback to ${fallbackProvider} due to ${originalDecision.selectedLLM} failure`,
      fallbackStrategy: 'none'
    };

    try {
      const response = await this.executeRequest(prompt, context, fallbackDecision, classification, startTime);
      response.reasoning = `Fallback: ${response.reasoning}`;
      response.metadata.originalProvider = originalDecision.selectedLLM;
      response.metadata.escalationReason = `Primary provider failed: ${originalError.message}`;
      
      return response;
    } catch (fallbackError) {
      logger.error('Fallback also failed:', fallbackError);
      throw new Error(`Both primary (${originalDecision.selectedLLM}) and fallback (${fallbackProvider}) providers failed`);
    }
  }

  /**
   * Execute escalation to higher-quality provider
   */
  private async executeEscalation(
    prompt: string,
    context: ProjectContext,
    originalResponse: HybridResponse,
    classification: TaskClassification,
    startTime: number
  ): Promise<HybridResponse> {
    // Escalate to Ollama if original was LM Studio
    if (originalResponse.provider === 'lmstudio') {
      const escalationDecision: TaskRoutingDecision = {
        selectedLLM: 'ollama',
        confidence: 0.9,
        reasoning: 'Escalated to Ollama for higher quality',
        fallbackStrategy: 'none'
      };

      try {
        const escalatedResponse = await this.executeRequest(prompt, context, escalationDecision, classification, startTime);
        escalatedResponse.escalated = true;
        escalatedResponse.reasoning = `Escalated: ${escalatedResponse.reasoning}`;
        escalatedResponse.metadata.originalProvider = originalResponse.provider;
        escalatedResponse.metadata.escalationReason = `Low confidence (${originalResponse.confidence})`;
        
        return escalatedResponse;
      } catch (error) {
        logger.warn('Escalation failed, returning original response:', error);
        return originalResponse;
      }
    }

    // If original was Ollama, no escalation available
    return originalResponse;
  }

  /**
   * Safely serialize context to prevent JSON parsing errors
   */
  private serializeContextSafely(context: ProjectContext): string | null {
    try {
      // Remove any potential problematic characters and limit size
      const sanitizedContext = this.sanitizeContext(context);
      const contextStr = JSON.stringify(sanitizedContext);
      
      // Limit context size to prevent overly large requests (max 10KB)
      if (contextStr.length > 10240) {
        logger.warn('Context too large, truncating...');
        const truncatedContext = {
          ...sanitizedContext,
          _truncated: true,
          _originalSize: contextStr.length
        };
        return JSON.stringify(truncatedContext).substring(0, 10240);
      }
      
      return contextStr;
    } catch (error) {
      logger.warn('Failed to serialize context safely:', error);
      return null;
    }
  }

  /**
   * Sanitize context object to remove problematic characters
   */
  private sanitizeContext(context: ProjectContext): ProjectContext {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        // Remove control characters and fix encoding issues
        sanitized[key] = value
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control chars
          .replace(/[\uD800-\uDFFF]/g, '?') // Replace surrogates with placeholder
          .substring(0, 2048); // Limit individual string length
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize objects (limited depth)
        try {
          sanitized[key] = JSON.parse(JSON.stringify(value).substring(0, 2048));
        } catch {
          sanitized[key] = '[object]';
        }
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized as ProjectContext;
  }

  /**
   * Check if response should be escalated
   */
  private shouldEscalate(response: HybridResponse, decision: TaskRoutingDecision): boolean {
    if (!this.config?.hybrid.escalationThreshold) return false;
    if (response.provider === 'ollama') return false; // Can't escalate from Ollama
    
    return response.confidence < (decision.escalationThreshold || this.config.hybrid.escalationThreshold);
  }

  /**
   * Check if should fallback to alternative provider
   */
  private shouldFallback(provider: string, error: any): boolean {
    // Always fallback if fallback is enabled in config, or fallback by default for better reliability
    if (this.config?.fallback.autoFallback === false) return false;
    
    // Check if error is retryable - expanded list for better coverage
    const retryableErrors = ['timeout', 'connection', 'unavailable', 'circuit breaker', 'econnreset', 'socket hang up', '404', '502', '503', '504'];
    const errorMessage = error?.message?.toLowerCase() || '';
    
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Circuit breaker management
   */
  private isCircuitBreakerOpen(provider: string): boolean {
    if (!this.config?.fallback.circuitBreaker.enabled) return false;
    
    const breaker = this.circuitBreaker.get(provider);
    if (!breaker) return false;
    
    if (breaker.isOpen) {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      if (timeSinceLastFailure > this.config.fallback.circuitBreaker.recoveryTimeout) {
        breaker.isOpen = false;
        breaker.failures = 0;
        logger.info(`Circuit breaker for ${provider} reset after recovery timeout`);
      }
    }
    
    return breaker.isOpen;
  }

  private recordCircuitBreakerFailure(provider: string): void {
    if (!this.config?.fallback.circuitBreaker.enabled) return;
    
    const breaker = this.circuitBreaker.get(provider) || { failures: 0, lastFailure: 0, isOpen: false };
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= this.config.fallback.circuitBreaker.failureThreshold) {
      breaker.isOpen = true;
      logger.warn(`Circuit breaker opened for ${provider} after ${breaker.failures} failures`);
    }
    
    this.circuitBreaker.set(provider, breaker);
  }

  private resetCircuitBreaker(provider: string): void {
    const breaker = this.circuitBreaker.get(provider);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
    }
  }

  /**
   * Cache management
   */
  private isCacheEnabled(): boolean {
    return this.config?.performance.cacheEnabled || false;
  }

  private isCacheValid(cached: HybridResponse): boolean {
    if (!this.config?.performance.cacheDuration) return false;
    
    const age = Date.now() - (cached.metadata as any)?.cacheTime;
    return age < this.config.performance.cacheDuration;
  }

  /**
   * Record outcome for learning and metrics
   */
  private recordOutcome(
    response: HybridResponse,
    classification: TaskClassification,
    decision: TaskRoutingDecision
  ): void {
    // Record routing outcome
    const provider = response.provider === 'hybrid' ? 'ollama' : response.provider; // Treat hybrid as ollama for metrics
    this.modelSelector.recordRoutingOutcome(
      provider,
      response.confidence > 0.7, // Consider success if confidence > 0.7
      response.responseTime,
      response.escalated
    );

    // Save metrics if enabled
    if (this.config?.development.saveMetrics) {
      this.saveMetrics(response, classification, decision);
    }
  }

  /**
   * Save metrics to file
   */
  private async saveMetrics(
    response: HybridResponse,
    classification: TaskClassification,
    decision: TaskRoutingDecision
  ): Promise<void> {
    if (!this.config?.development.metricsFile) return;

    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        classification,
        decision,
        response: {
          provider: response.provider,
          confidence: response.confidence,
          responseTime: response.responseTime,
          escalated: response.escalated
        }
      };

      // This would append to the metrics file (implementation depends on requirements)
      logger.debug('Metrics recorded:', metrics);
    } catch (error) {
      logger.warn('Failed to save metrics:', error);
    }
  }

  /**
   * Generate voice response using hybrid routing
   */
  async generateVoiceResponse(
    voice: VoiceArchetype,
    prompt: string,
    context: ProjectContext
  ): Promise<VoiceResponse> {
    try {
      const hybridResponse = await this.generateResponse(prompt, context);
      
      // Convert to voice response format
      return {
        content: hybridResponse.content,
        voice: voice.name,
        confidence: hybridResponse.confidence,
        tokens_used: hybridResponse.tokensUsed,
        reasoning: hybridResponse.reasoning
      };
    } catch (error) {
      logger.error('Hybrid voice response failed:', error);
      
      // Fallback to direct Ollama generation
      return await this.ollamaClient.generateVoiceResponse(voice, prompt, context);
    }
  }

  /**
   * Get hybrid system status
   */
  getStatus(): any {
    return {
      configuration: this.configManager.getConfigSummary(),
      modelSelector: this.modelSelector.getHybridStatus(),
      lmStudio: this.lmStudioClient.getStatus(),
      ollama: {
        currentModel: this.ollamaClient.getCurrentModel(),
        // Add more Ollama status info as needed
      },
      circuitBreakers: Object.fromEntries(this.circuitBreaker),
      cache: {
        size: this.responseCache.size,
        enabled: this.isCacheEnabled()
      }
    };
  }

  /**
   * Update configuration
   */
  async updateConfiguration(updates: Partial<HybridFullConfig>): Promise<void> {
    if (!this.config) {
      await this.loadConfiguration();
    }

    if (this.config) {
      Object.assign(this.config, updates);
      await this.configManager.saveConfig(this.config);
      await this.updateClientsFromConfig();
    }
  }

  /**
   * Test both providers
   */
  async testProviders(): Promise<{ lmStudio: boolean; ollama: boolean }> {
    const results = {
      lmStudio: false,
      ollama: false
    };

    try {
      results.lmStudio = await this.lmStudioClient.testModel();
    } catch (error) {
      logger.debug('LM Studio test failed:', error);
    }

    try {
      const testResponse = await this.ollamaClient.generate('Test message: respond with "Ollama working"');
      results.ollama = testResponse.toLowerCase().includes('working');
    } catch (error) {
      logger.debug('Ollama test failed:', error);
    }

    return results;
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    // Clear cache
    this.responseCache.clear();
    
    // Dispose LM Studio client
    this.lmStudioClient.dispose();
    
    // Stop configuration watching
    await this.configManager.dispose();
    
    logger.info('Hybrid model client disposed');
  }
}