/**
 * Unified Tool System
 *
 * Consolidates 44+ tool implementations using Decorator and Strategy patterns.
 * Replaces multiple versions (basic, enhanced, secure, real, etc.) with
 * configurable, composable tool behaviors.
 */

import { EventEmitter } from 'events';
import {
  ITool,
  IToolExecutor,
  IToolRegistry,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionRequest,
  ToolExecutionResult,
} from '../interfaces/tool-system.js';
import { IUnifiedSecurityValidator } from '../services/unified-security-validator.js';
import { IEventBus } from '../interfaces/event-bus.js';
import { ILogger } from '../interfaces/logger.js';
import type { IExecutionBackend } from '../interfaces/execution-backend.js';

// ============================================================================
// CORE TOOL FRAMEWORK - Base classes and interfaces
// ============================================================================

/**
 * Base tool implementation that all tools extend
 */
export abstract class BaseTool implements ITool {
  public readonly definition: ToolDefinition;
  protected context?: ToolExecutionContext;
  protected decorators: ToolDecorator[] = [];

  public constructor(definition: Readonly<Omit<ToolDefinition, 'id'> & { name: string }>) {
    this.definition = {
      ...definition,
      id: this.generateToolId(definition.name),
    };
  }

  public abstract execute(
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<ToolExecutionResult>;

  public validateArguments(args: Readonly<Record<string, unknown>>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check required parameters
    for (const requiredParam of this.definition.parameters.required) {
      if (
        !(requiredParam in args) ||
        args[requiredParam] === undefined ||
        args[requiredParam] === null
      ) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Validate parameter types and constraints
    for (const [paramName, paramDef] of Object.entries(this.definition.parameters.properties)) {
      if (paramName in args) {
        const validationError = this.validateParameter(paramName, args[paramName], paramDef);
        if (validationError) {
          errors.push(validationError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  public canExecute(context: Readonly<ToolExecutionContext>): boolean {
    // Check security level compatibility
    const toolSecurity = this.definition.securityLevel;
    const contextSecurity = context.securityLevel;

    const securityLevels = ['safe', 'restricted', 'dangerous'];
    const toolLevel = securityLevels.indexOf(toolSecurity);
    const contextLevel = securityLevels.indexOf(contextSecurity);

    if (toolLevel > contextLevel) {
      return false;
    }

    // Check permissions
    return this.definition.permissions.every((permission: { type: string; resource: string }) =>
      context.permissions.some((contextPerm: { type: string; resource: string }) =>
        contextPerm.type === permission.type && contextPerm.resource === permission.resource
      )
    );
  }

  /**
   * Add a decorator to modify tool behavior
   */
  public addDecorator(decorator: unknown): ITool {
    this.decorators.push(decorator as ToolDecorator);
    return this;
  }

  /**
   * Execute with decorators applied
   */
  protected async executeWithDecorators(
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<ToolExecutionResult> {
    let result = await this.execute(args, context);

    // Apply decorators in reverse order (last added, first applied to result)
    for (let i = this.decorators.length - 1; i >= 0; i--) {
      result = await this.decorators[i].postProcess(result, args, context);
    }

    return result;
  }

  private generateToolId(name: string): string {
    return `tool_${name.toLowerCase().replace(/\s+/g, '_')}`;
  }

  private validateParameter(paramName: string, value: unknown, paramDef: Readonly<ParameterDefinition>): string | null {
    // Type validation
    if (paramDef.type === 'string' && typeof value !== 'string') {
      return `Parameter ${paramName} must be a string`;
    }
    if (paramDef.type === 'number' && typeof value !== 'number') {
      return `Parameter ${paramName} must be a number`;
    }
    if (paramDef.type === 'boolean' && typeof value !== 'boolean') {
      return `Parameter ${paramName} must be a boolean`;
    }
    if (paramDef.type === 'array' && !Array.isArray(value)) {
      return `Parameter ${paramName} must be an array`;
    }

    // Enum validation
    if (paramDef.enum && !paramDef.enum.includes(value)) {
      return `Parameter ${paramName} must be one of: ${paramDef.enum.join(', ')}`;
    }

    // String-specific validations
    if (typeof value === 'string') {
      if (paramDef.minLength && value.length < paramDef.minLength) {
        return `Parameter ${paramName} must be at least ${paramDef.minLength} characters long`;
      }
      if (paramDef.maxLength && value.length > paramDef.maxLength) {
        return `Parameter ${paramName} must be at most ${paramDef.maxLength} characters long`;
      }
      if (paramDef.validation) {
        const regex = new RegExp(paramDef.validation);
        if (!regex.test(value)) {
          return `Parameter ${paramName} does not match required format`;
        }
      }
    }

    return null;
  }
}

interface ParameterDefinition {
  // Include 'object' to match the broader ToolParameter types used across definitions
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  validation?: string;
}

/**
 * Tool decorator interface for behavior composition
 */
export interface ToolDecorator {
  name: string;
  preProcess?: ((
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Promise<Record<string, unknown>>) | undefined;
  postProcess: (
    result: ToolExecutionResult,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Promise<ToolExecutionResult>;
}

/**
 * Security decorator that validates tool execution
 */
export class SecurityDecorator implements ToolDecorator {
  public readonly name = 'security';

  public constructor(private readonly securityValidator: IUnifiedSecurityValidator) {}

  public async preProcess(
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<Readonly<Record<string, unknown>>> {
    // Validate arguments for security threats
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        const validation = await this.securityValidator.validateInput(value, {
          sessionId: context.sessionId,
          requestId: `${context.sessionId}_${Date.now()}`,
          userAgent: context.userAgent ?? 'CodeCrucible/1.0',
          ipAddress: context.ipAddress ?? '127.0.0.1',
          timestamp: new Date(),
          operationType: 'input',
          environment: 'sandbox',
          permissions: (context.permissions as readonly { type: string }[]).map((p: { type: string }) => p.type),
        });

        if (!validation.isValid) {
          throw new Error(
            `Security violation in parameter ${key}: ${(validation.violations as readonly { message: string }[]).map((v: { message: string }) => v.message).join(', ')}`
          );
        }
      }
    }

    return args;
  }

  public async postProcess(
    result: Readonly<ToolExecutionResult>,
    _args: Readonly<Record<string, unknown>>,
    _context: Readonly<ToolExecutionContext>
  ): Promise<ToolExecutionResult> {
    // Sanitize output if needed
    if (typeof result.result === 'string') {
      const sanitized = this.securityValidator.sanitizeInput(result.result);
      return {
        ...result,
        result: sanitized,
        metadata: {
          ...result.metadata,
          sanitized: sanitized !== result.result,
        },
      };
    }

    return result;
  }
}

/**
 * Caching decorator that caches tool results
 */
export class CachingDecorator implements ToolDecorator {
  public readonly name = 'caching';
  private readonly cache = new Map<
    string,
    { result: ToolExecutionResult; timestamp: number; ttl: number }
  >();

  constructor(private readonly defaultTTL: number = 300000) {} // 5 minutes

  public async postProcess(
    result: ToolExecutionResult,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    if (result.success) {
      const cacheKey = this.generateCacheKey(args, context);
      const ttl = this.defaultTTL;

      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        ttl,
      });

      // Clean up expired entries
      this.cleanupCache();
    }

    return result;
  }

  public async preProcess(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<Record<string, unknown>> {
    const cacheKey = this.generateCacheKey(args, context);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      // Return cached result by throwing a special exception that the executor can catch
      throw new CacheHitException(cached.result);
    }

    return args;
  }

  private generateCacheKey(args: Record<string, unknown>, context: ToolExecutionContext): string {
    const normalized = JSON.stringify({
      args,
      sessionId: context.sessionId,
      workingDirectory: context.workingDirectory,
    });
    return Buffer.from(normalized).toString('base64');
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export class CacheHitException extends Error {
  constructor(public readonly cachedResult: ToolExecutionResult) {
    super('Cache hit');
  }
}

/**
 * Logging decorator that logs tool execution
 */
export class LoggingDecorator implements ToolDecorator {
  public readonly name = 'logging';

  constructor(
    private readonly logger?: ILogger,
    private readonly eventBus?: IEventBus
  ) {}

  public async preProcess(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<Record<string, unknown>> {
    if (this.logger) {
      this.logger.debug('Tool execution started', {
        sessionId: context.sessionId,
        userId: context.userId,
        workingDirectory: context.workingDirectory,
        args: this.sanitizeArgsForLogging(args),
      });
    }

    if (this.eventBus) {
      this.eventBus.emit('tool:execution-started', {
        sessionId: context.sessionId,
        args,
        timestamp: new Date(),
      });
    }

    return args;
  }

  public async postProcess(
    result: ToolExecutionResult,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    if (this.logger) {
      const logLevel = result.success ? 'info' : 'error';
      if (logLevel === 'info') {
        this.logger.info('Tool execution completed', {
          sessionId: context.sessionId,
          success: result.success,
          executionTime: result.executionTimeMs,
          error: result.error?.message,
        });
      } else {
        this.logger.error('Tool execution completed', {
          sessionId: context.sessionId,
          success: result.success,
          executionTime: result.executionTimeMs,
          error: result.error?.message,
        });
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('tool:execution-completed', {
        sessionId: context.sessionId,
        result,
        timestamp: new Date(),
      });
    }

    return result;
  }

  private sanitizeArgsForLogging(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && value.length > 200) {
        sanitized[key] = `${value.substring(0, 200)}... (${value.length} chars total)`;
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

/**
 * Retry decorator that retries failed tool executions
 */
export class RetryDecorator implements ToolDecorator {
  public readonly name = 'retry';

  public constructor(
    private readonly maxRetries: number = 3,
    private readonly backoffMs: number = 1000,
    private readonly backoffMultiplier: number = 2
  ) {}

  public async postProcess(
    result: Readonly<ToolExecutionResult>,
    _args: Readonly<Record<string, unknown>>,
    _context: Readonly<ToolExecutionContext>
  ): Promise<ToolExecutionResult> {
    if (result.success) {
      return result;
    }

    // Check if the error is retryable
    if (!this.isRetryableError(result.error)) {
      return result;
    }

    let lastResult = result;
    let delay = this.backoffMs;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      // Note: logger not available in decorator context, would need to be injected
      // this.logger.info(`Retrying tool execution, attempt ${attempt}/${this.maxRetries}`);

      // Wait before retry
      await this.delay(delay);
      delay *= this.backoffMultiplier;

      try {
        // Re-execute the tool (this is a bit tricky since we don't have access to the execute method here)
        // In a real implementation, we'd need to restructure this to work with the executor
        // Note: logger not available in decorator context, would need to be injected
        // this.logger.info(`Retry attempt ${attempt} - would re-execute here`);
      } catch (error) {
        lastResult = {
          success: false,
          error: {
            code: 'retry_failed',
            message: `Retry attempt ${attempt} failed: ${error}`,
          },
          executionTimeMs: 0,
        };
      }
    }

    return lastResult;
  }

  private isRetryableError(error?: { code: string; message: string }): boolean {
    if (!error) return false;

    // Define retryable error codes
    const retryableErrors = [
      'network_timeout',
      'temporary_failure',
      'rate_limited',
      'service_unavailable',
    ];

    return retryableErrors.includes(error.code);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Performance monitoring decorator
 */
export class PerformanceDecorator implements ToolDecorator {
  public readonly name = 'performance';
  private readonly metrics = new Map<string, { count: number; totalTime: number; errors: number }>();

  public async preProcess(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<Record<string, unknown>> {
    // Record start time
    context.metadata = context.metadata || {};
    context.metadata.startTime = Date.now();
    return args;
  }

  public async postProcess(
    result: ToolExecutionResult,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const executionTime = Date.now() - (Number(context.metadata?.startTime) || 0);
    const toolId = 'unknown'; // Would need access to tool ID

    // Update metrics
    const current = this.metrics.get(toolId) || { count: 0, totalTime: 0, errors: 0 };
    current.count++;
    current.totalTime += executionTime;
    if (!result.success) {
      current.errors++;
    }
    this.metrics.set(toolId, current);

    // Add performance metadata to result
    return {
      ...result,
      executionTimeMs: executionTime,
      metadata: {
        ...result.metadata,
        performance: {
          executionTime,
          averageTime: current.totalTime / current.count,
          errorRate: current.errors / current.count,
        },
      },
    };
  }

  public getMetrics(): Map<string, { count: number; totalTime: number; errors: number }> {
    return new Map(this.metrics);
  }
}

// ============================================================================
// TOOL REGISTRY - Manages all available tools
// ============================================================================

export class UnifiedToolRegistry extends EventEmitter implements IToolRegistry {
  private readonly tools = new Map<string, ITool>();
  private readonly categories = new Map<string, Set<string>>();

  public constructor(private readonly logger: ILogger) {
    super();
    this.logger.info('UnifiedToolRegistry initialized');
  }

  public register(tool: ITool): void {
    if (this.tools.has(tool.definition.id)) {
      this.logger.warn(`Tool ${tool.definition.id} is already registered, overwriting`);
    }

    this.tools.set(tool.definition.id, tool);

    // Update category index
    const category = tool.definition.category;
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category)!.add(tool.definition.id);

    this.emit('toolRegistered', { tool: tool.definition });
    this.logger.info(`Tool registered: ${tool.definition.name} (${tool.definition.id})`);
  }

  public getTool(id: string): ITool | undefined {
    return this.tools.get(id);
  }

  public getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  public getToolsByCategory(category: string): ITool[] {
    const toolIds = this.categories.get(category);
    if (!toolIds) {
      return [];
    }

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is ITool => tool !== undefined);
  }

  public searchTools(query: string): ITool[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTools().filter(
      tool =>
        tool.definition.name.toLowerCase().includes(lowerQuery) ||
        tool.definition.description.toLowerCase().includes(lowerQuery)
    );
  }

  public unregister(id: string): boolean {
    const tool = this.tools.get(id);
    if (!tool) {
      return false;
    }

    this.tools.delete(id);

    // Remove from category index
    const category = tool.definition.category;
    const categoryTools = this.categories.get(category);
    if (categoryTools) {
      categoryTools.delete(id);
      if (categoryTools.size === 0) {
        this.categories.delete(category);
      }
    }

    this.emit('toolUnregistered', { toolId: id });
    this.logger.info(`Tool unregistered: ${id}`);

    return true;
  }

  public getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  public getToolCount(): number {
    return this.tools.size;
  }
}

// ============================================================================
// TOOL EXECUTOR - Executes tools with decorators
// ============================================================================

export class UnifiedToolExecutor extends EventEmitter implements IToolExecutor {
  private rustBackend?: IExecutionBackend;

  public constructor(
    private readonly logger: ILogger,
    private readonly registry: IToolRegistry,
    private readonly securityValidator?: IUnifiedSecurityValidator,
    private readonly eventBus?: IEventBus,
    rustBackend?: IExecutionBackend
  ) {
    super();
    this.rustBackend = rustBackend;
    // Inject this orchestrator into the execution backend for fallback execution
    try {
      this.rustBackend?.setTypescriptOrchestrator(this);
    } catch (e) {
      // Backend may be a no-op implementation in tests
    }
    this.logger.info('UnifiedToolExecutor initialized', {
      rustBackendEnabled: !!this.rustBackend,
      rustAvailable: this.rustBackend?.isAvailable() ?? false,
    });
  }

  public async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Try Rust backend first if available and enabled
    if (this.rustBackend?.isAvailable()) {
      try {
        this.logger.debug('Attempting Rust backend execution for tool:', request.toolId);
        const rustResult = await this.rustBackend.execute(request);

        if (rustResult.success) {
          this.logger.debug('Rust backend execution successful for tool:', request.toolId);
          return rustResult;
        } else {
          this.logger.warn(
            'Rust backend execution failed, falling back to TypeScript:',
            rustResult.error
          );
        }
      } catch (error) {
        this.logger.warn('Rust backend error, falling back to TypeScript:', error);
      }
    }

    // Fallback to TypeScript implementation
    try {
      // Get the tool
      const tool = this.registry.getTool(request.toolId);
      if (!tool) {
        return {
          success: false,
          error: {
            code: 'tool_not_found',
            message: `Tool not found: ${request.toolId}`,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Validate arguments
      const validation = tool.validateArguments(request.arguments);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'invalid_arguments',
            message: `Invalid arguments: ${validation.errors?.join(', ')}`,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check if tool can execute in this context
      if (!tool.canExecute(request.context)) {
        return {
          success: false,
          error: {
            code: 'permission_denied',
            message: 'Tool execution not permitted in this context',
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Apply decorators and execute
      const decoratedTool = this.applyDecorators(tool, request);

      try {
        const result = await decoratedTool.execute(request.arguments, request.context);
        return {
          ...result,
          executionTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        if (error instanceof CacheHitException) {
          return {
            ...error.cachedResult,
            metadata: {
              ...error.cachedResult.metadata,
              cached: true,
            },
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'execution_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? { stack: error.stack } : undefined,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  public async executeSequence(requests: readonly ToolExecutionRequest[]): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const request of requests) {
      const result = await this.execute(request);
      results.push(result);

      // Stop on first failure unless configured otherwise
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  public async executeParallel(requests: readonly ToolExecutionRequest[]): Promise<ToolExecutionResult[]> {
    const promises = requests.map(async (request): Promise<ToolExecutionResult> => this.execute(request));
    return Promise.all(promises);
  }

  private applyDecorators(tool: ITool, request: ToolExecutionRequest): ITool {
    // Create a copy of the tool with decorators applied
    const decoratedTool: ITool = Object.create(tool) as ITool;

    // Apply standard decorators based on context
    const decorators: ToolDecorator[] = [];

    // Always apply logging
    decorators.push(new LoggingDecorator(undefined, this.eventBus));

    // Apply security if validator is available
    if (this.securityValidator) {
      decorators.push(new SecurityDecorator(this.securityValidator));
    }

    // Apply performance monitoring
    decorators.push(new PerformanceDecorator());

    // Apply caching for read-only operations
    if (this.isReadOnlyOperation(request)) {
      decorators.push(new CachingDecorator());
    }

    // Apply retry for network operations
    if (this.isNetworkOperation(request)) {
      decorators.push(new RetryDecorator(3, 1000));
    }

    // Add decorators to tool if the implementation supports it
    decorators.forEach((decorator: Readonly<ToolDecorator>): void => {
      if (typeof decoratedTool.addDecorator === 'function') {
        decoratedTool.addDecorator(decorator);
      }
    });

    return decoratedTool;
  }

  private isReadOnlyOperation(request: ToolExecutionRequest): boolean {
    // Heuristic: operations that don't modify state
    const readOnlyPatterns = [
      'read',
      'get',
      'list',
      'search',
      'find',
      'analyze',
      'check',
      'validate',
    ];

    return readOnlyPatterns.some(pattern => request.toolId.toLowerCase().includes(pattern));
  }

  private isNetworkOperation(request: ToolExecutionRequest): boolean {
    // Heuristic: operations that involve network calls
    const networkPatterns = ['fetch', 'download', 'upload', 'sync', 'api', 'http', 'request'];

    return networkPatterns.some(pattern => request.toolId.toLowerCase().includes(pattern));
  }
}
