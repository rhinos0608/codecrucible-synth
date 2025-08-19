/**
 * Hybrid Model Client - Integrates LM Studio and Ollama through intelligent routing
 * Implements the hybrid architecture described in Docs/Hybrid-LLM-Architecture.md
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { HybridLLMRouter, HybridConfig, RoutingDecision, TaskComplexityMetrics } from './hybrid-llm-router.js';

export interface LLMProvider {
  name: string;
  endpoint: string;
  isAvailable(): Promise<boolean>;
  generateCode(prompt: string, options?: any): Promise<LLMResponse>;
  getCapabilities(): LLMCapabilities;
  getStatus(): Promise<LLMStatus>;
}

export interface LLMResponse {
  content: string;
  confidence: number;
  responseTime: number;
  model: string;
  provider: string;
  metadata?: any;
}

export interface LLMCapabilities {
  strengths: string[];
  optimalFor: string[];
  responseTime: string;
  contextWindow: number;
  supportsStreaming?: boolean;
  maxConcurrent?: number;
}

export interface LLMStatus {
  available: boolean;
  currentLoad: number;
  maxLoad: number;
  responseTime: number;
  errorRate: number;
  lastError?: string;
}

export interface HybridRequest {
  prompt: string;
  taskType: string;
  complexity?: TaskComplexityMetrics;
  forceProvider?: 'lm-studio' | 'ollama';
  enableEscalation?: boolean;
  timeout?: number;
}

export interface HybridResponse extends LLMResponse {
  routingDecision: RoutingDecision;
  escalated?: boolean;
  providers: string[];
  totalTime: number;
}

export class HybridModelClient extends EventEmitter {
  private router: HybridLLMRouter;
  private providers: Map<string, LLMProvider> = new Map();
  private config: HybridConfig;
  private activeRequests: Map<string, {
    startTime: number;
    provider: string;
    promise: Promise<any>;
  }> = new Map();

  constructor(config: HybridConfig) {
    super();
    this.config = config;
    this.router = new HybridLLMRouter(config);
    this.setMaxListeners(50);

    // Set up router event listeners
    this.router.on('routing-decision', this.handleRoutingDecision.bind(this));
    this.router.on('performance-recorded', this.handlePerformanceRecord.bind(this));
  }

  /**
   * Register an LLM provider (LM Studio or Ollama)
   */
  registerProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
    logger.info(`Registered LLM provider: ${name}`);
  }

  /**
   * Generate code using hybrid routing
   */
  async generateCode(request: HybridRequest): Promise<HybridResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Get routing decision
      const routingDecision = request.forceProvider 
        ? this.createForcedRoutingDecision(request.forceProvider)
        : await this.router.routeTask(request.taskType, request.prompt, request.complexity);

      // Track load
      this.router.updateLoad(routingDecision.selectedLLM as any, 1);

      let response: HybridResponse;
      let escalated = false;

      try {
        if (routingDecision.selectedLLM === 'hybrid') {
          // Hybrid mode: start with LM Studio, escalate if needed
          response = await this.executeHybridGeneration(request, routingDecision, requestId);
          escalated = response.escalated || false;
        } else {
          // Direct routing to specific provider
          response = await this.executeDirectGeneration(request, routingDecision, requestId);
        }
      } finally {
        // Always decrement load
        this.router.updateLoad(routingDecision.selectedLLM as any, -1);
      }

      // Record performance for learning
      this.recordPerformance(requestId, routingDecision, response, true);

      return response;

    } catch (error) {
      const errorResponse = this.createErrorResponse(request, error as Error, startTime);
      
      // Record failure for learning
      this.recordPerformance(requestId, {
        selectedLLM: 'ollama',
        confidence: 0.1,
        reasoning: 'Error fallback',
        fallbackStrategy: 'none',
        estimatedResponseTime: 0
      }, errorResponse, false);

      throw error;
    }
  }

  /**
   * Execute hybrid generation (LM Studio first, escalate to Ollama if needed)
   */
  private async executeHybridGeneration(
    request: HybridRequest, 
    routingDecision: RoutingDecision, 
    requestId: string
  ): Promise<HybridResponse> {
    // Start with LM Studio
    let response: LLMResponse;
    let escalated = false;
    const providers = ['lm-studio'];

    try {
      response = await this.callProvider('lm-studio', request, requestId);
      
      // Check if escalation is needed
      if (request.enableEscalation !== false && 
          routingDecision.escalationThreshold && 
          response.confidence < routingDecision.escalationThreshold) {
        
        logger.info(`Escalating request ${requestId} from LM Studio to Ollama (confidence: ${response.confidence})`);
        
        // Escalate to Ollama
        try {
          const ollamaResponse = await this.callProvider('ollama', request, requestId);
          response = ollamaResponse;
          escalated = true;
          providers.push('ollama');
        } catch (escalationError) {
          logger.warn('Escalation to Ollama failed, keeping LM Studio response:', escalationError);
          // Keep the original LM Studio response
        }
      }
    } catch (lmStudioError) {
      logger.warn('LM Studio failed, falling back to Ollama:', lmStudioError);
      
      // Fallback to Ollama
      response = await this.callProvider('ollama', request, requestId);
      providers[0] = 'ollama'; // Replace lm-studio with ollama
    }

    return {
      ...response,
      routingDecision,
      escalated,
      providers,
      totalTime: Date.now() - Date.now() // Will be corrected by caller
    };
  }

  /**
   * Execute direct generation using specified provider
   */
  private async executeDirectGeneration(
    request: HybridRequest, 
    routingDecision: RoutingDecision, 
    requestId: string
  ): Promise<HybridResponse> {
    const provider = routingDecision.selectedLLM as 'lm-studio' | 'ollama';
    const response = await this.callProvider(provider, request, requestId);

    return {
      ...response,
      routingDecision,
      escalated: false,
      providers: [provider],
      totalTime: response.responseTime
    };
  }

  /**
   * Call a specific provider with error handling and timeout
   */
  private async callProvider(providerName: string, request: HybridRequest, requestId: string): Promise<LLMResponse> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not available`);
    }

    // Check if provider is available
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new Error(`Provider ${providerName} is not available`);
    }

    const startTime = Date.now();
    
    // Track active request
    let providerPromise: Promise<LLMResponse>;
    try {
      providerPromise = provider.generateCode(request.prompt, {
        taskType: request.taskType,
        complexity: request.complexity,
        timeout: request.timeout
      });

      this.activeRequests.set(requestId, {
        startTime,
        provider: providerName,
        promise: providerPromise
      });

      const response = await providerPromise;
      const responseTime = Date.now() - startTime;

      return {
        ...response,
        responseTime,
        provider: providerName
      };

    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Create a forced routing decision for a specific provider
   */
  private createForcedRoutingDecision(provider: 'lm-studio' | 'ollama'): RoutingDecision {
    return {
      selectedLLM: provider,
      confidence: 1.0,
      reasoning: `Forced to ${provider} by user request`,
      fallbackStrategy: provider === 'lm-studio' ? 'ollama' : 'lm-studio',
      estimatedResponseTime: provider === 'lm-studio' ? 2000 : 15000
    };
  }

  /**
   * Create error response for failed requests
   */
  private createErrorResponse(request: HybridRequest, error: Error, startTime: number): HybridResponse {
    return {
      content: `Error: ${error.message}`,
      confidence: 0,
      responseTime: Date.now() - startTime,
      model: 'error',
      provider: 'error',
      routingDecision: {
        selectedLLM: 'ollama',
        confidence: 0,
        reasoning: 'Error fallback',
        fallbackStrategy: 'none',
        estimatedResponseTime: 0
      },
      escalated: false,
      providers: [],
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Record performance for router learning
   */
  private recordPerformance(
    requestId: string, 
    routingDecision: RoutingDecision, 
    response: HybridResponse, 
    success: boolean
  ): void {
    this.router.recordPerformance(requestId, {
      success,
      responseTime: response.totalTime,
      qualityScore: response.confidence,
      taskType: response.routingDecision.reasoning.includes('template') ? 'template' : 'general',
      errorType: success ? undefined : 'generation-failed'
    });
  }

  /**
   * Handle routing decision events
   */
  private handleRoutingDecision(event: any): void {
    this.emit('routing', event);
    logger.debug('Routing decision made:', {
      taskType: event.taskType,
      selectedLLM: event.decision.selectedLLM,
      confidence: event.decision.confidence
    });
  }

  /**
   * Handle performance record events
   */
  private handlePerformanceRecord(event: any): void {
    this.emit('performance', event);
  }

  /**
   * Get system status including all providers
   */
  async getSystemStatus(): Promise<{
    hybrid: any;
    providers: Record<string, LLMStatus>;
    activeRequests: number;
  }> {
    const hybridStatus = this.router.getStatus();
    const providerStatuses: Record<string, LLMStatus> = {};

    for (const [name, provider] of this.providers) {
      try {
        providerStatuses[name] = await provider.getStatus();
      } catch (error) {
        providerStatuses[name] = {
          available: false,
          currentLoad: 0,
          maxLoad: 0,
          responseTime: 0,
          errorRate: 1.0,
          lastError: (error as Error).message
        };
      }
    }

    return {
      hybrid: hybridStatus,
      providers: providerStatuses,
      activeRequests: this.activeRequests.size
    };
  }

  /**
   * Get aggregated capabilities from all providers
   */
  getCapabilities(): {
    combined: LLMCapabilities;
    providers: Record<string, LLMCapabilities>;
  } {
    const providerCapabilities: Record<string, LLMCapabilities> = {};
    
    for (const [name, provider] of this.providers) {
      providerCapabilities[name] = provider.getCapabilities();
    }

    // Combine capabilities
    const allStrengths = new Set<string>();
    const allOptimalFor = new Set<string>();
    let minResponseTime = Infinity;
    let maxContextWindow = 0;

    Object.values(providerCapabilities).forEach(cap => {
      cap.strengths.forEach(s => allStrengths.add(s));
      cap.optimalFor.forEach(o => allOptimalFor.add(o));
      
      const timeMs = cap.responseTime.includes('s') 
        ? parseFloat(cap.responseTime) * 1000 
        : parseFloat(cap.responseTime);
      minResponseTime = Math.min(minResponseTime, timeMs);
      maxContextWindow = Math.max(maxContextWindow, cap.contextWindow);
    });

    return {
      combined: {
        strengths: Array.from(allStrengths),
        optimalFor: Array.from(allOptimalFor),
        responseTime: `${minResponseTime / 1000}s-30s`,
        contextWindow: maxContextWindow,
        supportsStreaming: true,
        maxConcurrent: this.config.lmStudio.maxConcurrent + this.config.ollama.maxConcurrent
      },
      providers: providerCapabilities
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `hybrid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy client and cleanup resources
   */
  async destroy(): Promise<void> {
    // Cancel all active requests
    for (const [requestId, request] of this.activeRequests) {
      logger.warn(`Cancelling active request: ${requestId}`);
      // Note: We can't actually cancel the promise, but we remove tracking
    }
    this.activeRequests.clear();

    // Cleanup router
    this.router.destroy();

    // Remove all listeners
    this.removeAllListeners();

    logger.info('HybridModelClient destroyed');
  }
}