/**
 * Concrete Workflow Orchestrator Implementation - Application Layer
 * 
 * Implementation of IWorkflowOrchestrator that coordinates between
 * CLI, UnifiedModelClient, MCP-Manager, and Tools without circular dependencies.
 * Uses dependency injection and mediator pattern for clean separation.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { 
  IWorkflowOrchestrator, 
  WorkflowRequest, 
  WorkflowResponse, 
  WorkflowContext, 
  OrchestratorDependencies 
} from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { IModelClient } from '../../domain/interfaces/model-client.js';
import { UnifiedConfigurationManager } from '../../domain/services/unified-configuration-manager.js';
import { UnifiedSecurityValidator } from '../../domain/services/unified-security-validator.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { randomUUID } from 'crypto';

export interface WorkflowMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  activeRequests: number;
}

/**
 * Concrete Workflow Orchestrator implementation
 */
export class ConcreteWorkflowOrchestrator extends EventEmitter implements IWorkflowOrchestrator {
  private userInteraction!: IUserInteraction;
  private eventBus!: IEventBus;
  private modelClient?: IModelClient;
  private mcpManager?: any;
  private securityValidator?: UnifiedSecurityValidator;
  private configManager?: UnifiedConfigurationManager;
  private isInitialized = false;
  
  // Request tracking
  private activeRequests: Map<string, { 
    request: WorkflowRequest; 
    startTime: number; 
    context: WorkflowContext;
  }> = new Map();
  
  // Metrics
  private metrics: WorkflowMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageProcessingTime: 0,
    activeRequests: 0
  };

  constructor() {
    super();
  }

  /**
   * Initialize the orchestrator with dependencies
   */
  async initialize(dependencies: OrchestratorDependencies): Promise<void> {
    try {
      this.userInteraction = dependencies.userInteraction;
      this.eventBus = dependencies.eventBus;
      this.modelClient = dependencies.modelClient;
      this.mcpManager = dependencies.mcpManager;
      this.securityValidator = dependencies.securityValidator;
      this.configManager = dependencies.configManager;

      // DEBUG: Verify critical dependencies
      logger.info('🔧 ConcreteWorkflowOrchestrator dependency injection:');
      logger.info(`  - modelClient: ${this.modelClient ? '✅ Available' : '❌ NULL/UNDEFINED'}`);
      logger.info(`  - userInteraction: ${this.userInteraction ? '✅ Available' : '❌ NULL/UNDEFINED'}`);
      logger.info(`  - eventBus: ${this.eventBus ? '✅ Available' : '❌ NULL/UNDEFINED'}`);
      
      if (!this.modelClient) {
        throw new Error('CRITICAL: ModelClient dependency is null/undefined - AI functionality will not work');
      }

      this.isInitialized = true;
      
      logger.info('ConcreteWorkflowOrchestrator initialized successfully');
      this.eventBus.emit('orchestrator:initialized', { timestamp: Date.now() });

    } catch (error) {
      logger.error('Failed to initialize ConcreteWorkflowOrchestrator:', error);
      throw error;
    }
  }

  /**
   * Process a workflow request
   */
  async processRequest(request: WorkflowRequest): Promise<WorkflowResponse> {
    if (!this.isInitialized) {
      throw new Error('WorkflowOrchestrator not initialized');
    }

    const startTime = performance.now();
    this.metrics.totalRequests++;
    this.metrics.activeRequests++;
    
    this.activeRequests.set(request.id, {
      request,
      startTime,
      context: request.context || this.createDefaultContext()
    });

    try {
      this.eventBus.emit('workflow:started', { id: request.id, type: request.type });

      let result: any;
      switch (request.type) {
        case 'prompt':
          result = await this.handlePromptRequest(request);
          break;
        case 'tool-execution':
          result = await this.handleToolExecution(request);
          break;
        case 'model-request':
          result = await this.handleModelRequest(request);
          break;
        case 'analysis':
          result = await this.handleAnalysisRequest(request);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime, true);

      const response: WorkflowResponse = {
        id: request.id,
        success: true,
        result,
        metadata: { processingTime, timestamp: Date.now() }
      };

      this.eventBus.emit('workflow:completed', { id: request.id, result });
      return response;

    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime, false);

      this.eventBus.emit('workflow:failed', { id: request.id, error });

      return {
        id: request.id,
        success: false,
        error: error as Error,
        metadata: { processingTime, timestamp: Date.now() }
      };

    } finally {
      this.activeRequests.delete(request.id);
      this.metrics.activeRequests--;
    }
  }

  /**
   * Execute a tool with proper context and security
   */
  async executeTool(toolName: string, args: any, context: WorkflowContext): Promise<any> {
    const request: WorkflowRequest = {
      id: randomUUID(),
      type: 'tool-execution',
      payload: { toolName, args },
      context
    };

    const response = await this.processRequest(request);
    
    if (response.success) {
      return response.result;
    } else {
      throw response.error || new Error(`Tool execution failed: ${toolName}`);
    }
  }

  /**
   * Process a model request with routing and fallbacks
   */
  async processModelRequest(request: any, context: WorkflowContext): Promise<any> {
    const workflowRequest: WorkflowRequest = {
      id: randomUUID(),
      type: 'model-request',
      payload: request,
      context
    };

    const response = await this.processRequest(workflowRequest);
    
    if (response.success) {
      return response.result;
    } else {
      throw response.error || new Error('Model request failed');
    }
  }

  /**
   * Analyze code or files
   */
  async analyzeCode(filePath: string, context: WorkflowContext): Promise<any> {
    const request: WorkflowRequest = {
      id: randomUUID(),
      type: 'analysis',
      payload: { filePath, analysisType: 'code' },
      context
    };

    const response = await this.processRequest(request);
    
    if (response.success) {
      return response.result;
    } else {
      throw response.error || new Error(`Code analysis failed: ${filePath}`);
    }
  }

  private async handlePromptRequest(request: WorkflowRequest): Promise<any> {
    const { payload } = request;
    
    if (this.modelClient) {
      const modelRequest = {
        id: request.id,
        prompt: payload.input || payload.prompt,
        model: payload.options?.model,
        temperature: payload.options?.temperature,
        maxTokens: payload.options?.maxTokens,
        stream: payload.options?.stream || false,
        context: request.context
      };
      
      return await this.modelClient.request(modelRequest);
    } else {
      return {
        response: "Model client not available. Please ensure the system is properly configured.",
        fallback: true
      };
    }
  }

  private async handleToolExecution(request: WorkflowRequest): Promise<any> {
    const { payload } = request;
    const { toolName, args } = payload;
    
    if (this.mcpManager) {
      return await this.mcpManager.executeTool(toolName, args, request.context);
    } else {
      logger.warn(`Tool execution requested but no MCP manager available: ${toolName}`);
      return {
        result: `Tool ${toolName} would execute with args: ${JSON.stringify(args)}`,
        simulated: true
      };
    }
  }

  private async handleModelRequest(request: WorkflowRequest): Promise<any> {
    const { payload } = request;
    
    if (this.modelClient) {
      return await this.modelClient.request(payload);
    } else {
      throw new Error('Model client not available');
    }
  }

  private async handleAnalysisRequest(request: WorkflowRequest): Promise<any> {
    const { payload } = request;
    
    // DEBUG: Check if modelClient is available
    if (!this.modelClient) {
      logger.error('🚨 CRITICAL: ModelClient is null/undefined in ConcreteWorkflowOrchestrator.handleAnalysisRequest');
      logger.error('🚨 This breaks all AI-powered analysis capabilities');
      throw new Error('ModelClient not available in orchestrator - dependency injection failed');
    }

    // Construct analysis prompt
    let analysisPrompt: string;
    if (payload.filePath) {
      analysisPrompt = payload.prompt || `Analyze the following file: ${payload.filePath}`;
    } else if (payload.content) {
      analysisPrompt = payload.prompt || `Analyze the following content: ${payload.content}`;
    } else if (payload.input) {
      analysisPrompt = payload.prompt || payload.input;
    } else {
      analysisPrompt = payload.prompt || 'Please provide analysis.';
    }

    logger.info(`🔍 Making AI analysis request with prompt: "${analysisPrompt.substring(0, 100)}..."`);
    
    const modelRequest = {
      id: request.id,
      prompt: analysisPrompt,
      model: payload.options?.model,
      temperature: payload.options?.temperature || 0.3, // Lower temperature for analysis
      maxTokens: payload.options?.maxTokens || 2000,
      context: request.context
    };
    
    const result = await this.modelClient.request(modelRequest);
    logger.info(`✅ AI analysis completed: ${result.usage?.totalTokens || 'unknown'} tokens`);
    return result;
  }

  private createDefaultContext(): WorkflowContext {
    return {
      sessionId: randomUUID(),
      workingDirectory: process.cwd(),
      permissions: ['read'],
      securityLevel: 'medium'
    };
  }

  private updateMetrics(processingTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    const totalProcessingTime = this.metrics.averageProcessingTime * (this.metrics.totalRequests - 1);
    this.metrics.averageProcessingTime = (totalProcessingTime + processingTime) / this.metrics.totalRequests;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down ConcreteWorkflowOrchestrator');
    
    const shutdownTimeout = 10000;
    const startTime = performance.now();
    
    while (this.metrics.activeRequests > 0 && (performance.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.activeRequests.clear();
    this.isInitialized = false;
    this.removeAllListeners();
    
    this.eventBus.emit('orchestrator:shutdown', { timestamp: Date.now() });
  }
}

export default ConcreteWorkflowOrchestrator;