/**
 * SynthesisCoordinator - Application Layer Implementation
 * Replaces integrated-system.ts with proper DI-based architecture
 * 
 * Living Spiral Applied:
 * - COLLAPSE: Centralized request coordination without tight coupling
 * - COUNCIL: Multiple service orchestration through interfaces
 * - SYNTHESIS: Unified response formation from multiple sources
 * - REBIRTH: Clean execution with proper error handling
 * - REFLECTION: Performance monitoring and quality assessment
 * 
 * Council Perspectives:
 * - Architect: Clean separation between application and infrastructure layers
 * - Maintainer: Testable, mockable dependencies through DI
 * - Security Guardian: All requests pass through security validation
 * - Performance Engineer: Efficient resource utilization and caching
 * - Explorer: Extensible architecture for new features
 */

import { EventEmitter } from 'events';
import { DependencyContainer } from '../di/dependency-container.js';
import {
  CLIENT_TOKEN,
  HYBRID_ROUTER_TOKEN,
  CACHE_COORDINATOR_TOKEN,
  SECURITY_VALIDATOR_TOKEN,
  STREAMING_MANAGER_TOKEN,
  PERFORMANCE_MONITOR_TOKEN,
} from '../di/service-tokens.js';
import { logger } from '../logger.js';
import { ModelRequest, ModelResponse } from '../types.js';

export interface ApplicationRequest {
  id?: string;
  prompt: string;
  voice?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  useTools?: boolean;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ApplicationResponse {
  id: string;
  requestId?: string;
  content: string;
  synthesis: {
    mode: 'single' | 'multi-voice' | 'collaborative';
    voices: string[];
    conflicts: any[];
    consensus: {
      agreement: number;
      convergence: number;
      stability: number;
      diversity: number;
    };
    finalDecision: {
      method: string;
      reasoning: string;
      confidence: number;
      alternatives: number;
      time: number;
    };
  };
  metadata: {
    processingTime: number;
    voicesConsulted: number;
    modelsUsed: string[];
    totalTokens: number;
    cachingUsed: boolean;
    ragUsed: boolean;
    workflowUsed: boolean;
    costEstimate: number;
  };
  quality: {
    overall: number;
    accuracy: number;
    completeness: number;
    relevance: number;
    creativity: number;
  };
  performance: {
    responseTime: number;
    tokenRate: number;
    cacheHitRate: number;
    resourceUsage: {
      memory: number;
      cpu: number;
    };
  };
}

export class SynthesisCoordinator extends EventEmitter {
  private container: DependencyContainer;
  private initialized = false;
  private startTime: number;

  constructor(container: DependencyContainer) {
    super();
    this.container = container;
    this.startTime = Date.now();
    
    // Increase max listeners for complex synthesis operations
    this.setMaxListeners(100);
    
    logger.info('SynthesisCoordinator initialized with DI container');
  }

  /**
   * Initialize the synthesis coordinator
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing SynthesisCoordinator...');
      
      // Verify all required services are available
      await this.verifyDependencies();
      
      this.initialized = true;
      this.emit('initialized');
      
      logger.info('SynthesisCoordinator initialization complete');
    } catch (error) {
      logger.error('SynthesisCoordinator initialization failed', error);
      throw error;
    }
  }

  /**
   * Process application request through synthesis pipeline
   */
  async processRequest(request: ApplicationRequest): Promise<ApplicationResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const requestId = request.id || this.generateRequestId();
    const startTime = Date.now();

    logger.info('Processing synthesis request', { requestId, prompt: request.prompt.substring(0, 100) });

    try {
      // Phase 1: Security validation
      const securityValidator = this.container.resolve(SECURITY_VALIDATOR_TOKEN);
      const modelRequest: ModelRequest = {
        prompt: request.prompt,
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stream: request.stream,
        context: request.context,
      };

      const validation = await securityValidator.validateRequest(modelRequest);
      if (!validation.isValid) {
        throw new Error(`Security validation failed: ${validation.reason}`);
      }

      // Phase 2: Request processing through client
      const client = this.container.resolve(CLIENT_TOKEN);
      const response = await (client as any).synthesize(modelRequest);

      // Phase 3: Response synthesis and enhancement
      const synthesisResponse = await this.synthesizeResponse(request, response, startTime);

      // Phase 4: Performance recording
      await this.recordPerformance(requestId, synthesisResponse);

      logger.info('Synthesis request completed', { 
        requestId, 
        processingTime: Date.now() - startTime 
      });

      return synthesisResponse;

    } catch (error) {
      logger.error('Synthesis request failed', error, { requestId });
      
      // Return error response in expected format
      return this.createErrorResponse(requestId, error, startTime);
    }
  }

  /**
   * Synthesize enhanced response from basic model response
   */
  private async synthesizeResponse(
    request: ApplicationRequest, 
    modelResponse: ModelResponse,
    startTime: number
  ): Promise<ApplicationResponse> {
    const processingTime = Date.now() - startTime;

    // Enhanced synthesis response
    return {
      id: `response_${Date.now()}`,
      requestId: request.id,
      content: modelResponse.content,
      synthesis: {
        mode: 'single', // TODO: Implement multi-voice when voice system is integrated
        voices: [],
        conflicts: [],
        consensus: { 
          agreement: 1, 
          convergence: 1, 
          stability: 1, 
          diversity: 0 
        },
        finalDecision: {
          method: 'direct',
          reasoning: 'Single voice response through DI container',
          confidence: 0.8,
          alternatives: 0,
          time: processingTime,
        },
      },
      metadata: {
        processingTime,
        voicesConsulted: 1,
        modelsUsed: [modelResponse.model || 'unknown'],
        totalTokens: modelResponse.tokens_used || modelResponse.metadata?.tokens || 0,
        cachingUsed: modelResponse.cached || false,
        ragUsed: false, // TODO: Implement when RAG is integrated
        workflowUsed: false, // TODO: Implement when workflows are integrated
        costEstimate: 0, // TODO: Implement cost calculation
      },
      quality: {
        overall: 0.8,
        accuracy: 0.8,
        completeness: 0.8,
        relevance: 0.8,
        creativity: 0.7,
      },
      performance: {
        responseTime: processingTime,
        tokenRate: this.calculateTokenRate(modelResponse, processingTime),
        cacheHitRate: 0.0, // TODO: Get from cache coordinator
        resourceUsage: {
          memory: this.getMemoryUsage(),
          cpu: 0.0, // TODO: Implement CPU monitoring
        },
      },
    };
  }

  /**
   * Create error response in standard format
   */
  private createErrorResponse(
    requestId: string, 
    error: any, 
    startTime: number
  ): ApplicationResponse {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      id: `error_${Date.now()}`,
      requestId,
      content: `Error processing request: ${errorMessage}`,
      synthesis: {
        mode: 'single',
        voices: [],
        conflicts: [{ type: 'error', description: errorMessage }],
        consensus: { agreement: 0, convergence: 0, stability: 0, diversity: 0 },
        finalDecision: {
          method: 'error',
          reasoning: 'Request failed during processing',
          confidence: 0.0,
          alternatives: 0,
          time: processingTime,
        },
      },
      metadata: {
        processingTime,
        voicesConsulted: 0,
        modelsUsed: [],
        totalTokens: 0,
        cachingUsed: false,
        ragUsed: false,
        workflowUsed: false,
        costEstimate: 0,
      },
      quality: {
        overall: 0.0,
        accuracy: 0.0,
        completeness: 0.0,
        relevance: 0.0,
        creativity: 0.0,
      },
      performance: {
        responseTime: processingTime,
        tokenRate: 0.0,
        cacheHitRate: 0.0,
        resourceUsage: {
          memory: this.getMemoryUsage(),
          cpu: 0.0,
        },
      },
    };
  }

  /**
   * Verify all required dependencies are available
   */
  private async verifyDependencies(): Promise<void> {
    const requiredServices = [
      CLIENT_TOKEN,
      SECURITY_VALIDATOR_TOKEN,
      // Optional services that gracefully degrade
      HYBRID_ROUTER_TOKEN,
      CACHE_COORDINATOR_TOKEN,
      STREAMING_MANAGER_TOKEN,
      PERFORMANCE_MONITOR_TOKEN,
    ];

    for (const token of requiredServices) {
      try {
        const service = this.container.resolve(token);
        if (!service) {
          logger.warn(`Service ${token.name} not available, continuing with degraded functionality`);
        }
      } catch (error) {
        if (token === CLIENT_TOKEN || token === SECURITY_VALIDATOR_TOKEN) {
          throw new Error(`Critical service ${token.name} not available: ${error}`);
        }
        logger.warn(`Optional service ${token.name} not available: ${error}`);
      }
    }
  }

  /**
   * Record performance metrics
   */
  private async recordPerformance(requestId: string, response: ApplicationResponse): Promise<void> {
    try {
      const performanceMonitor = this.container.resolve(PERFORMANCE_MONITOR_TOKEN);
      if (performanceMonitor && typeof performanceMonitor.recordRequest === 'function') {
        await performanceMonitor.recordRequest(requestId, {
          responseTime: response.performance.responseTime,
          tokenRate: response.performance.tokenRate,
          success: !response.synthesis.conflicts.length,
          modelUsed: response.metadata.modelsUsed[0] || 'unknown',
        });
      }
    } catch (error) {
      logger.warn('Performance recording failed', error);
    }
  }

  /**
   * Calculate token processing rate
   */
  private calculateTokenRate(response: ModelResponse, processingTime: number): number {
    const tokens = response.tokens_used || response.metadata?.tokens || 0;
    if (tokens === 0 || processingTime === 0) {
      return 0;
    }
    return Math.round((tokens / processingTime) * 1000 * 100) / 100; // tokens per second
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    try {
      const memUsage = process.memoryUsage();
      return Math.round(memUsage.heapUsed / (1024 * 1024)); // MB
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    uptime: number;
    dependencies: Record<string, boolean>;
  }> {
    const dependencies: Record<string, boolean> = {};
    
    const services = [
      CLIENT_TOKEN,
      SECURITY_VALIDATOR_TOKEN,
      HYBRID_ROUTER_TOKEN,
      CACHE_COORDINATOR_TOKEN,
      STREAMING_MANAGER_TOKEN,
      PERFORMANCE_MONITOR_TOKEN,
    ];

    for (const token of services) {
      try {
        const service = this.container.resolve(token);
        dependencies[token.name] = !!service;
      } catch (error) {
        dependencies[token.name] = false;
      }
    }

    return {
      initialized: this.initialized,
      uptime: Date.now() - this.startTime,
      dependencies,
    };
  }
}