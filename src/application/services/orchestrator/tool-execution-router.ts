import type { WorkflowRequest } from '../../../domain/interfaces/workflow-orchestrator.js';
import type { ModelRequest, ModelResponse } from '../../../domain/interfaces/model-client.js';
import type { IMcpManager } from '../../../domain/interfaces/mcp-manager.js';
import type { IToolExecutionRouter } from '../../../domain/interfaces/tool-execution-router.js';
import { createLogger } from '../../../infrastructure/logging/logger-adapter.js';
import { getErrorMessage } from '../../../utils/error-utils.js';
import { toErrorOrUndefined } from '../../../utils/type-guards.js';
import { getGlobalEnhancedToolIntegration } from '../../../infrastructure/tools/enhanced-tool-integration.js';

const logger = createLogger('ToolExecutionRouter');

interface ToolExecutionError {
  type: 'parse_error' | 'execution_error' | 'timeout_error' | 'validation_error';
  toolName: string;
  toolCallId: string;
  message: string;
  originalError?: Error;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ToolExecutionMetrics {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  lastFailureTime?: number;
  consecutiveFailures: number;
}

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeMs: number = 60000
  ) {}
  
  public canExecute(): boolean {
    if (this.state === 'closed') return true;
    
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    
    return this.state === 'half-open';
  }
  
  public recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  public recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  public getState(): string {
    return this.state;
  }
}

/**
 * Routes tool execution requests and handles follow-up model synthesis.
 * Includes comprehensive error handling, circuit breaker pattern, and retry logic.
 */
export class ToolExecutionRouter implements IToolExecutionRouter {
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly toolMetrics = new Map<string, ToolExecutionMetrics>();
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 1000;
  private readonly maxDelayMs = 10000;
  
  public constructor(private readonly mcpManager: IMcpManager) {}

  public async handleToolCalls(
    response: Readonly<ModelResponse>,
    request: Readonly<WorkflowRequest>,
    modelRequest: Readonly<ModelRequest>,
    processModelRequest: (req: Readonly<ModelRequest>) => Promise<ModelResponse>
  ): Promise<ModelResponse> {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response;
    }

    logger.info(`Processing ${response.toolCalls.length} tool calls`, {
      requestId: request.id,
      toolNames: response.toolCalls.map(tc => tc.function.name)
    });
    
    const toolResults: Array<{ id: string; result: unknown; error?: string }> = [];
    const errors: ToolExecutionError[] = [];

    // Process tool calls with proper error handling and metrics
    for (const toolCall of response.toolCalls) {
      const toolName = toolCall.function.name;
      const toolCallId = toolCall.id || `${toolName}_${Date.now()}`;
      const startTime = Date.now();
      
      try {
        // Parse and validate arguments
        const parsedArgs = this.parseToolArguments(toolCall.function.arguments, toolName, toolCallId);
        
        // Execute tool with retry logic and circuit breaker
        const toolResult = await this.executeToolWithResilience(
          toolName,
          toolCallId,
          parsedArgs,
          request,
          startTime
        );
        
        toolResults.push({ id: toolCallId, result: toolResult });
        this.updateMetrics(toolName, true, Date.now() - startTime);
        
      } catch (error) {
        const toolError = this.createToolExecutionError(error, toolName, toolCallId);
        errors.push(toolError);
        
        toolResults.push({
          id: toolCallId,
          result: null,
          error: toolError.message,
        });
        
        this.updateMetrics(toolName, false, Date.now() - startTime);
        this.logToolError(toolError);
      }
    }
    
    // Log aggregated error summary if there were failures
    if (errors.length > 0) {
      this.logErrorSummary(errors, request.id);
    }

    // Always proceed with synthesis even if some tools failed
    if (toolResults.length === 0) {
      logger.warn('No tool results to synthesize', { requestId: request.id });
      return response;
    }

    const structuredMessages = [
      { role: 'user' as const, content: request.payload.input || request.payload.prompt },
      {
        role: 'assistant' as const,
        content: response.content || 'I need to use tools to help with this request.',
        tool_calls: response.toolCalls,
      },
      // Create individual tool messages with matching IDs
      ...toolResults.map(toolResult => ({
        role: 'tool' as const,
        content: toolResult.error 
          ? JSON.stringify({ error: toolResult.error }, null, 2)
          : JSON.stringify(toolResult.result, null, 2),
        tool_call_id: toolResult.id,
      })),
    ];

    const followUpRequest: ModelRequest = {
      id: `${request.id}-structured-followup`,
      prompt: `User request: ${request.payload.input || request.payload.prompt}\n\nTool execution results are provided in the conversation history. Please provide a comprehensive, well-formatted response based on these results. Do not make any additional tool calls - just synthesize the information provided.`,
      model: modelRequest.model,
      temperature: modelRequest.temperature,
      maxTokens: modelRequest.maxTokens,
      tools: [],
      messages: structuredMessages,
      context: request.context,
    } as ModelRequest;

    logger.info('Synthesizing tool results', {
      requestId: request.id,
      toolResultCount: toolResults.length,
      successCount: toolResults.filter(r => !r.error).length,
      errorCount: toolResults.filter(r => r.error).length
    });
    
    return processModelRequest(followUpRequest);
  }

  private parseToolArguments(
    argumentsStr: string,
    toolName: string,
    toolCallId: string
  ): Record<string, unknown> {
    try {
      const parsed = JSON.parse(argumentsStr) as Record<string, unknown>;
      
      // Basic validation
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Tool arguments must be a valid object');
      }
      
      return parsed;
    } catch (error) {
      throw this.createToolExecutionError(
        error,
        toolName,
        toolCallId,
        'parse_error',
        'Invalid JSON in tool arguments'
      );
    }
  }

  private async executeToolWithResilience(
    toolName: string,
    toolCallId: string,
    args: Record<string, unknown>,
    request: WorkflowRequest,
    startTime: number
  ): Promise<unknown> {
    // Check circuit breaker
    const circuitBreaker = this.getCircuitBreaker(toolName);
    if (!circuitBreaker.canExecute()) {
      throw new Error(`Circuit breaker open for tool ${toolName} due to repeated failures`);
    }

    let lastError: unknown;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Add timeout protection
        const timeoutMs = 30000; // 30 second timeout
        const executionPromise = this.executeTool(toolName, args, request);
        
        const result = await Promise.race([
          executionPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool execution timeout')), timeoutMs)
          )
        ]);
        
        circuitBreaker.recordSuccess();
        
        logger.debug('Tool executed successfully', {
          toolName,
          toolCallId,
          attempt,
          executionTime: Date.now() - startTime
        });
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable || attempt === this.maxRetries) {
          circuitBreaker.recordFailure();
          throw error;
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(
          this.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
          this.maxDelayMs
        );
        
        logger.warn('Tool execution failed, retrying', {
          toolName,
          toolCallId,
          attempt,
          maxRetries: this.maxRetries,
          delayMs: delay,
          error: getErrorMessage(error)
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    circuitBreaker.recordFailure();
    throw lastError;
  }

  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    request: WorkflowRequest
  ): Promise<unknown> {
    // Try enhanced integration first
    const enhancedIntegration = getGlobalEnhancedToolIntegration();
    
    if (enhancedIntegration) {
      const toolCallObj = {
        id: `${toolName}_${Date.now()}`,
        function: {
          name: toolName,
          arguments: JSON.stringify(args),
        },
      };

      const context = {
        sessionId: request.context?.sessionId || request.id,
        priority: 'medium' as const,
        metadata: {
          workflowRequestId: request.id,
          originalContext: request.context,
        },
      };

      return await enhancedIntegration.executeToolCall(toolCallObj, context);
    }
    
    // Fallback to MCP manager
    const mcpResult = await this.mcpManager.executeTool(toolName, args, request.context);
    
    // Check success flag and propagate errors properly
    if (!mcpResult.success) {
      const errorMessage = typeof mcpResult.error === 'string' 
        ? mcpResult.error 
        : (mcpResult.error as any)?.message || `Tool execution failed: ${toolName}`;
      throw new Error(errorMessage);
    }
    
    return mcpResult.data;
  }

  private createToolExecutionError(
    error: unknown,
    toolName: string,
    toolCallId: string,
    type: ToolExecutionError['type'] = 'execution_error',
    customMessage?: string
  ): ToolExecutionError {
    const message = customMessage || getErrorMessage(error);
    const originalError = error instanceof Error ? error : undefined;
    
    return {
      type,
      toolName,
      toolCallId,
      message,
      originalError,
      retryable: this.isRetryableError(error),
      severity: this.getErrorSeverity(error, type)
    };
  }

  private isRetryableError(error: unknown): boolean {
    const message = getErrorMessage(error).toLowerCase();
    
    // Network and temporary failures are retryable
    const retryablePatterns = [
      'timeout',
      'connection',
      'network',
      'temporary',
      'unavailable',
      'rate limit',
      'too many requests'
    ];
    
    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  private getErrorSeverity(error: unknown, type: ToolExecutionError['type']): ToolExecutionError['severity'] {
    if (type === 'parse_error' || type === 'validation_error') {
      return 'medium';
    }
    
    if (type === 'timeout_error') {
      return 'high';
    }
    
    // Check error patterns for severity
    const message = getErrorMessage(error).toLowerCase();
    
    if (message.includes('security') || message.includes('unauthorized')) {
      return 'critical';
    }
    
    if (message.includes('not found') || message.includes('permission')) {
      return 'medium';
    }
    
    return 'low';
  }

  private getCircuitBreaker(toolName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(toolName)) {
      this.circuitBreakers.set(toolName, new CircuitBreaker());
    }
    return this.circuitBreakers.get(toolName)!;
  }

  private updateMetrics(toolName: string, success: boolean, executionTime: number): void {
    const metrics = this.toolMetrics.get(toolName) || {
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
      consecutiveFailures: 0
    };

    metrics.totalCalls++;
    
    if (success) {
      metrics.successCount++;
      metrics.consecutiveFailures = 0;
    } else {
      metrics.failureCount++;
      metrics.consecutiveFailures++;
      metrics.lastFailureTime = Date.now();
    }
    
    // Update rolling average
    const totalTime = metrics.averageExecutionTime * (metrics.totalCalls - 1) + executionTime;
    metrics.averageExecutionTime = totalTime / metrics.totalCalls;
    
    this.toolMetrics.set(toolName, metrics);
  }

  private logToolError(error: ToolExecutionError): void {
    logger.error('Tool execution failed', {
      type: error.type,
      toolName: error.toolName,
      toolCallId: error.toolCallId,
      message: error.message,
      retryable: error.retryable,
      severity: error.severity,
      stack: error.originalError?.stack
    });
  }

  private logErrorSummary(errors: ToolExecutionError[], requestId: string): void {
    const errorsByTool = new Map<string, number>();
    const errorsByType = new Map<string, number>();
    
    for (const error of errors) {
      errorsByTool.set(error.toolName, (errorsByTool.get(error.toolName) || 0) + 1);
      errorsByType.set(error.type, (errorsByType.get(error.type) || 0) + 1);
    }
    
    logger.warn('Tool execution summary', {
      requestId,
      totalErrors: errors.length,
      errorsByTool: Object.fromEntries(errorsByTool),
      errorsByType: Object.fromEntries(errorsByType),
      criticalErrors: errors.filter(e => e.severity === 'critical').length,
      retryableErrors: errors.filter(e => e.retryable).length
    });
  }

  // Public method to get tool metrics for monitoring
  public getToolMetrics(): Map<string, ToolExecutionMetrics> {
    return new Map(this.toolMetrics);
  }

  // Public method to reset circuit breakers if needed
  public resetCircuitBreaker(toolName: string): void {
    this.circuitBreakers.delete(toolName);
    logger.info('Circuit breaker reset', { toolName });
  }
}
