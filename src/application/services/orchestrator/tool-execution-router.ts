import type { WorkflowRequest } from '../../../domain/interfaces/workflow-orchestrator.js';
import type { ModelRequest, ModelResponse } from '../../../domain/interfaces/model-client.js';
import type { IMcpManager } from '../../../domain/interfaces/mcp-manager.js';
import type { IToolExecutionRouter } from '../../../domain/interfaces/tool-execution-router.js';
import { createLogger } from '../../../infrastructure/logging/logger-adapter.js';
import { getErrorMessage } from '../../../utils/error-utils.js';
import { toErrorOrUndefined } from '../../../utils/type-guards.js';
import { getGlobalEnhancedToolIntegration } from '../../../infrastructure/tools/enhanced-tool-integration.js';
import { AgentStateManager, ProjectPaths } from '../../../utils/project-paths.js';
import { ToolIntrospector } from '../../../utils/tool-introspector.js';

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

  /**
   * Generate or extract session ID for agent state tracking
   */
  private getSessionId(request: Readonly<WorkflowRequest>): string {
    // Use request ID as session ID, or generate one
    return request.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Resolve path placeholders and inject proper working directory
   */
  private resolvePathsInArgs(
    args: Record<string, unknown>, 
    executionContext: { workingDirectory: string; projectRoot: string }
  ): Record<string, unknown> {
    const resolvedArgs = { ...args };
    
    // Handle execute_command tool specifically - inject workingDirectory if missing
    if (!resolvedArgs.workingDirectory && (resolvedArgs.command || resolvedArgs.args)) {
      resolvedArgs.workingDirectory = executionContext.workingDirectory;
      logger.debug('[ToolExecutionRouter] Injected workingDirectory for execute_command', {
        workingDirectory: resolvedArgs.workingDirectory
      });
    }
    
    // Resolve PROJECT_ROOT_DIRECTORY placeholders throughout the args
    const resolveValue = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value.replace(/PROJECT_ROOT_DIRECTORY/g, executionContext.projectRoot);
      }
      if (Array.isArray(value)) {
        return value.map(resolveValue);
      }
      if (value && typeof value === 'object') {
        const resolved: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          resolved[key] = resolveValue(val);
        }
        return resolved;
      }
      return value;
    };
    
    // Apply recursive path resolution
    for (const [key, value] of Object.entries(resolvedArgs)) {
      resolvedArgs[key] = resolveValue(value);
    }
    
    return resolvedArgs;
  }

  public async handleToolCalls(
    response: Readonly<ModelResponse>,
    request: Readonly<WorkflowRequest>,
    modelRequest: Readonly<ModelRequest>,
    processModelRequest: (req: Readonly<ModelRequest>) => Promise<ModelResponse>
  ): Promise<ModelResponse> {
    // Initialize agent state for this session
    const sessionId = this.getSessionId(request);
    const agentState = AgentStateManager.getOrCreateState(sessionId);
    const executionContext = AgentStateManager.getExecutionContext(sessionId);

    logger.debug('[ToolExecutionRouter] Session context', {
      sessionId,
      projectRoot: executionContext.projectRoot,
      workingDirectory: executionContext.workingDirectory,
      recentCommands: executionContext.recentCommands
    });

    // Prefer provider-declared tool calls; otherwise attempt to extract from content heuristically
    const candidateToolCalls: ReadonlyArray<import('../../../domain/interfaces/model-client.js').ToolCall> =
      (response.toolCalls && response.toolCalls.length > 0)
        ? response.toolCalls
        : this.extractToolCallsFromContent(response.content);

    if (!candidateToolCalls || candidateToolCalls.length === 0) {
      return response;
    }

    logger.info(`[ToolExecutionRouter] Processing ${candidateToolCalls.length} tool calls`, {
      requestId: request.id,
      toolNames: candidateToolCalls.map(tc => tc.function.name),
    });
    
    // Debug log the actual tool calls
    candidateToolCalls.forEach((tc, index) => {
      logger.debug(`[ToolExecutionRouter] Tool call ${index + 1}: ${tc.function.name}`, {
        id: tc.id,
        function: tc.function.name,
        arguments: tc.function.arguments
      });
    });

    const toolResults: Array<{ id: string; result: unknown; error?: string }> = [];
    const errors: ToolExecutionError[] = [];

    // Process tool calls with proper error handling and metrics
    for (const toolCall of candidateToolCalls) {
      const toolName = toolCall.function.name;
      const toolCallId = toolCall.id || `${toolName}_${Date.now()}`;
      const startTime = Date.now();

      try {
        // Parse and validate arguments
        const parsedArgs = this.parseToolArguments(
          toolCall.function.arguments,
          toolName,
          toolCallId
        );

        // Introspector validation - explicit schema compliance check
        const validationResult = ToolIntrospector.validateToolCall(toolName, parsedArgs);
        
        if (!validationResult.isValid) {
          const feedback = ToolIntrospector.generateFeedback(validationResult, toolName);
          logger.warn('[ToolExecutionRouter] Tool validation failed', {
            toolName,
            toolCallId,
            errors: validationResult.errors,
            warnings: validationResult.warnings
          });
          
          // Return explicit validation failure instead of allowing AI to guess
          toolResults.push({
            id: toolCallId,
            result: null,
            error: feedback
          });
          
          this.updateMetrics(toolName, false, Date.now() - startTime);
          continue; // Skip execution, move to next tool
        }

        // Use normalized/validated arguments for execution
        const normalizedArgs = validationResult.normalizedArgs || parsedArgs;

        // Execute tool with retry logic and circuit breaker
        const toolResult = await this.executeToolWithResilience(
          toolName,
          toolCallId,
          normalizedArgs,
          request,
          startTime
        );

        // Normalize diagnostics for known external tools (eslint, flake8, mypy, pylint)
        let diagnostics: Array<{
          tool: string;
          type: 'diagnostic';
          file: string;
          line: number;
          message: string;
          column?: number;
          code?: string;
          severity?: 'error' | 'warning' | 'info';
        }> | undefined;
        try {
          const { normalizeToolOutput } = await import('../../../infrastructure/tools/tool-output-normalizer.js');
          // If executing execute_command, try to infer tool from args.command
          const inferred = ((): string => {
            const cmd = (normalizedArgs as any)?.command as string | undefined;
            if (typeof cmd === 'string' && cmd.length) return cmd;
            return toolName;
          })();
          diagnostics = normalizeToolOutput(inferred, (toolResult as any)?.data ?? toolResult);
        } catch {
          // ignore normalization errors, keep original result only
        }

        toolResults.push({ id: toolCallId, result: toolResult, ...(diagnostics && diagnostics.length ? { diagnostics } : {}) });
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

      // Strict failure mode: abort when any tool fails (default on)
      const strict = (process.env.STRICT_TOOL_FAILURES ?? 'true').toLowerCase() !== 'false';
      if (strict) {
        const summary = errors.map(e => `${e.toolName}: ${e.message}`).join('; ');
        throw new Error(`Tool execution failed: ${summary}`);
      }
    }

    // Proceed with synthesis only if we have results and no strict abort above
    if (toolResults.length === 0) {
      logger.warn('No tool results to synthesize', { requestId: request.id });
      return response;
    }

    const structuredMessages = [
      { role: 'user' as const, content: request.payload.input || request.payload.prompt },
      {
        role: 'assistant' as const,
        content: response.content || 'I need to use tools to help with this request.',
        tool_calls: response.toolCalls?.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            // Parse arguments back to object for Ollama - it expects objects, not strings
            arguments:
              typeof tc.function.arguments === 'string'
                ? (() => {
                    try {
                      return JSON.parse(tc.function.arguments);
                    } catch {
                      // If parsing fails, create a simple object
                      return { raw_arguments: tc.function.arguments };
                    }
                  })()
                : tc.function.arguments,
          },
        })),
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
      errorCount: toolResults.filter(r => r.error).length,
    });

    return processModelRequest(followUpRequest);
  }

  // Heuristic fallback: extract tool calls from assistant content when provider didn't emit tool_calls
  private extractToolCallsFromContent(
    content?: string
  ): import('../../../domain/interfaces/model-client.js').ToolCall[] {
    if (!content || typeof content !== 'string') return [];

    const calls: import('../../../domain/interfaces/model-client.js').ToolCall[] = [];
    
    // Strategy 1: Extract from code blocks first (most reliable)
    const codeBlockMatches = this.extractFromCodeBlocks(content);
    calls.push(...codeBlockMatches);
    
    if (calls.length > 0) {
      logger.debug('[ToolExecutionRouter] Extracted tool calls from code blocks', { count: calls.length });
      return calls;
    }
    
    // Strategy 2: Robust nested JSON extraction using brace counting
    const nestedJsonMatches = this.extractNestedJsonToolCalls(content);
    calls.push(...nestedJsonMatches);
    
    if (calls.length > 0) {
      logger.debug('[ToolExecutionRouter] Extracted tool calls from nested JSON', { count: calls.length });
      return calls;
    }
    
    // Strategy 3: Full content fallback for small responses
    if (content.length < 2000 && content.includes('{') && content.includes('}')) {
      const fullContentMatches = this.tryParseFullContent(content);
      calls.push(...fullContentMatches);
      
      if (calls.length > 0) {
        logger.debug('[ToolExecutionRouter] Extracted tool calls from full content', { count: calls.length });
      }
    }
    
    return calls;
  }

  /**
   * Extract tool calls from code blocks (```json ... ```)
   */
  private extractFromCodeBlocks(content: string): import('../../../domain/interfaces/model-client.js').ToolCall[] {
    const calls: import('../../../domain/interfaces/model-client.js').ToolCall[] = [];
    const codeBlockRegex = /```(?:json)?\n([\s\S]*?)```/gim;
    let match: RegExpExecArray | null;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const block = match[1].trim();
      const parsedCalls = this.parseJsonBlock(block);
      calls.push(...parsedCalls);
    }
    
    return calls;
  }

  /**
   * Robust nested JSON extraction using brace counting to handle nested objects
   */
  private extractNestedJsonToolCalls(content: string): import('../../../domain/interfaces/model-client.js').ToolCall[] {
    const calls: import('../../../domain/interfaces/model-client.js').ToolCall[] = [];
    
    // Find all potential JSON objects that contain "name" field
    let index = 0;
    while (index < content.length) {
      const startIndex = content.indexOf('{', index);
      if (startIndex === -1) break;
      
      // Use brace counting to find the complete JSON object
      const jsonStr = this.extractCompleteJsonObject(content, startIndex);
      if (jsonStr && jsonStr.includes('"name"')) {
        const parsedCalls = this.parseJsonBlock(jsonStr);
        calls.push(...parsedCalls);
        
        // If we found valid tool calls, we're done
        if (parsedCalls.length > 0) {
          break;
        }
      }
      
      index = startIndex + 1;
    }
    
    return calls;
  }

  /**
   * Extract a complete JSON object using brace counting
   */
  private extractCompleteJsonObject(text: string, startIndex: number): string | null {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return text.substring(startIndex, i + 1);
          }
        }
      }
    }
    
    return null; // Incomplete JSON
  }

  /**
   * Try to parse full content as JSON
   */
  private tryParseFullContent(content: string): import('../../../domain/interfaces/model-client.js').ToolCall[] {
    // Clean up common AI text artifacts
    const cleaned = content
      .replace(/^[^{]*/, '') // Remove text before first brace
      .replace(/[^}]*$/, '') // Remove text after last brace
      .trim();
    
    return this.parseJsonBlock(cleaned);
  }

  /**
   * Parse a JSON block and extract tool calls
   */
  private parseJsonBlock(jsonStr: string): import('../../../domain/interfaces/model-client.js').ToolCall[] {
    const calls: import('../../../domain/interfaces/model-client.js').ToolCall[] = [];
    
    try {
      const obj = JSON.parse(jsonStr) as Record<string, unknown>;
      
      // Single tool call format: { name, arguments|parameters }
      if (obj && typeof obj === 'object' && typeof obj.name === 'string') {
        const toolCall = this.createToolCallFromObject(obj);
        if (toolCall) {
          calls.push(toolCall);
        }
      }
      
      // Array format: [{ name, arguments|parameters }, ...]
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item && typeof item === 'object' && typeof (item as any).name === 'string') {
            const toolCall = this.createToolCallFromObject(item as Record<string, unknown>);
            if (toolCall) {
              calls.push(toolCall);
            }
          }
        }
      }
    } catch (error) {
      // Silently ignore parse errors for fallback extraction
      logger.debug('[ToolExecutionRouter] JSON parse error during extraction', { 
        error: error instanceof Error ? error.message : String(error),
        jsonStr: jsonStr.length > 200 ? jsonStr.substring(0, 200) + '...' : jsonStr
      });
    }
    
    return calls;
  }

  /**
   * Create a tool call object from parsed JSON
   */
  private createToolCallFromObject(obj: Record<string, unknown>): import('../../../domain/interfaces/model-client.js').ToolCall | null {
    if (!obj.name || typeof obj.name !== 'string') {
      return null;
    }
    
    const args = (obj.arguments ?? obj.parameters) as unknown;
    const argStr = typeof args === 'string' ? args : JSON.stringify(args ?? {});
    
    return {
      id: `extracted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function',
      function: { 
        name: obj.name as string, 
        arguments: argStr 
      },
    };
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
          ),
        ]);

        circuitBreaker.recordSuccess();

        logger.debug('Tool executed successfully', {
          toolName,
          toolCallId,
          attempt,
          executionTime: Date.now() - startTime,
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
          error: getErrorMessage(error),
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
    // Get session context and resolve paths dynamically
    const sessionId = this.getSessionId(request);
    const executionContext = AgentStateManager.getExecutionContext(sessionId);
    
    // Resolve PROJECT_ROOT_DIRECTORY placeholder and inject proper workingDirectory
    const enhancedArgs = this.resolvePathsInArgs(args, executionContext);
    
    // Track tool call start
    AgentStateManager.updateAfterToolCall(sessionId, toolName, enhancedArgs, 'pending');
    
    logger.debug('[ToolExecutionRouter] Executing tool with resolved paths', {
      toolName,
      sessionId,
      originalArgs: args,
      enhancedArgs,
      workingDirectory: executionContext.workingDirectory
    });

    // Try enhanced integration first
    const enhancedIntegration = getGlobalEnhancedToolIntegration();

    if (enhancedIntegration) {
      const toolCallObj = {
        id: `${toolName}_${Date.now()}`,
        function: {
          name: toolName,
          arguments: JSON.stringify(enhancedArgs),
        },
      };

      const context = {
        sessionId: sessionId,
        priority: 'medium' as const,
        metadata: {
          workflowRequestId: request.id,
          originalContext: request.context,
          resolvedPaths: true,
        },
      };

      try {
        const result = await enhancedIntegration.executeToolCall(toolCallObj, context);
        AgentStateManager.updateAfterToolCall(sessionId, toolName, enhancedArgs, 'success', JSON.stringify(result));
        return result;
      } catch (error) {
        AgentStateManager.updateAfterToolCall(sessionId, toolName, enhancedArgs, 'error', error instanceof Error ? error.message : String(error));
        throw error;
      }
    }

    // Fallback to MCP manager
    try {
      const mcpResult = await this.mcpManager.executeTool(toolName, enhancedArgs, request.context);
      
      // Check success flag and propagate errors properly
      if (!mcpResult.success) {
        const errorMessage =
          typeof mcpResult.error === 'string'
            ? mcpResult.error
            : (mcpResult.error as any)?.message || `Tool execution failed: ${toolName}`;
        
        AgentStateManager.updateAfterToolCall(sessionId, toolName, enhancedArgs, 'error', errorMessage);
        throw new Error(errorMessage);
      }

      AgentStateManager.updateAfterToolCall(sessionId, toolName, enhancedArgs, 'success', JSON.stringify(mcpResult.data));
      return mcpResult.data;
    } catch (error) {
      AgentStateManager.updateAfterToolCall(sessionId, toolName, enhancedArgs, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
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
      severity: this.getErrorSeverity(error, type),
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
      'too many requests',
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  private getErrorSeverity(
    error: unknown,
    type: ToolExecutionError['type']
  ): ToolExecutionError['severity'] {
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
      consecutiveFailures: 0,
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
      stack: error.originalError?.stack,
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
      retryableErrors: errors.filter(e => e.retryable).length,
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
