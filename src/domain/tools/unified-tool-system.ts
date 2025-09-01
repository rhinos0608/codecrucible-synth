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
  IToolRegistry,
  IToolExecutor,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolExecutionRequest,
} from '../interfaces/tool-system.js';
import { IUnifiedSecurityValidator } from '../services/unified-security-validator.js';
import { IEventBus } from '../interfaces/event-bus.js';
import { ILogger } from '../interfaces/logger.js';
import { RustExecutionBackend } from '../../core/execution/rust-executor/rust-execution-backend.js';

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

  constructor(definition: Omit<ToolDefinition, 'id'> & { name: string }) {
    this.definition = {
      ...definition,
      id: this.generateToolId(definition.name),
    };
  }

  abstract execute(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult>;

  validateArguments(args: Record<string, any>): { valid: boolean; errors?: string[] } {
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

  canExecute(context: ToolExecutionContext): boolean {
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
    return this.definition.permissions.every(permission =>
      context.permissions.some(
        contextPerm =>
          contextPerm.type === permission.type && contextPerm.resource === permission.resource
      )
    );
  }

  /**
   * Add a decorator to modify tool behavior
   */
  addDecorator(decorator: ToolDecorator): this {
    this.decorators.push(decorator);
    return this;
  }

  /**
   * Execute with decorators applied
   */
  protected async executeWithDecorators(
    args: Record<string, any>,
    context: ToolExecutionContext
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

  private validateParameter(name: string, value: any, definition: any): string | null {
    // Type validation
    const expectedType = definition.type;
    const actualType = typeof value;

    if (expectedType === 'string' && actualType !== 'string') {
      return `Parameter ${name} must be a string, got ${actualType}`;
    }

    if (expectedType === 'number' && actualType !== 'number') {
      return `Parameter ${name} must be a number, got ${actualType}`;
    }

    if (expectedType === 'boolean' && actualType !== 'boolean') {
      return `Parameter ${name} must be a boolean, got ${actualType}`;
    }

    if (expectedType === 'array' && !Array.isArray(value)) {
      return `Parameter ${name} must be an array`;
    }

    // Enum validation
    if (definition.enum && !definition.enum.includes(value)) {
      return `Parameter ${name} must be one of: ${definition.enum.join(', ')}`;
    }

    // String length validation
    if (expectedType === 'string' && typeof value === 'string') {
      if (definition.minLength && value.length < definition.minLength) {
        return `Parameter ${name} must be at least ${definition.minLength} characters`;
      }
      if (definition.maxLength && value.length > definition.maxLength) {
        return `Parameter ${name} must be at most ${definition.maxLength} characters`;
      }
    }

    // Regex validation
    if (definition.validation && typeof value === 'string') {
      const regex = new RegExp(definition.validation);
      if (!regex.test(value)) {
        return `Parameter ${name} does not match required pattern`;
      }
    }

    return null;
  }
}

/**
 * Tool decorator interface for behavior composition
 */
export interface ToolDecorator {
  name: string;
  preProcess?(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Record<string, any>>;
  postProcess(
    result: ToolExecutionResult,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult>;
}

/**
 * Security decorator that validates tool execution
 */
export class SecurityDecorator implements ToolDecorator {
  name = 'security';

  constructor(private securityValidator: IUnifiedSecurityValidator) {}

  async preProcess(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Record<string, any>> {
    // Validate arguments for security threats
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        const validation = await this.securityValidator.validateInput(value, {
          sessionId: context.sessionId,
          operationType: 'input',
          environment: 'sandbox',
          permissions: context.permissions.map(p => p.type),
        });

        if (!validation.isValid) {
          throw new Error(
            `Security violation in parameter ${key}: ${validation.violations.map(v => v.message).join(', ')}`
          );
        }
      }
    }

    return args;
  }

  async postProcess(
    result: ToolExecutionResult,
    args: Record<string, any>,
    context: ToolExecutionContext
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
  name = 'caching';
  private cache = new Map<
    string,
    { result: ToolExecutionResult; timestamp: number; ttl: number }
  >();

  constructor(private defaultTTL: number = 300000) {} // 5 minutes

  async postProcess(
    result: ToolExecutionResult,
    args: Record<string, any>,
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

  async preProcess(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Record<string, any>> {
    const cacheKey = this.generateCacheKey(args, context);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      // Return cached result by throwing a special exception that the executor can catch
      throw new CacheHitException(cached.result);
    }

    return args;
  }

  private generateCacheKey(args: Record<string, any>, context: ToolExecutionContext): string {
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
  name = 'logging';

  constructor(private eventBus?: IEventBus) {}

  constructor(
    private logger: ILogger,
    private eventBus?: IEventBus
  ) {}

  async preProcess(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Record<string, any>> {
    this.logger.debug('Tool execution started', {
      sessionId: context.sessionId,
      userId: context.userId,
      workingDirectory: context.workingDirectory,
      args: this.sanitizeArgsForLogging(args),
    });

    if (this.eventBus) {
      this.eventBus.emit('tool:execution-started', {
        sessionId: context.sessionId,
        args,
        timestamp: new Date(),
      });
    }

    return args;
  }

  async postProcess(
    result: ToolExecutionResult,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
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

    if (this.eventBus) {
      this.eventBus.emit('tool:execution-completed', {
        sessionId: context.sessionId,
        result,
        timestamp: new Date(),
      });
    }

    return result;
  }

  private sanitizeArgsForLogging(args: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
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
  name = 'retry';

  constructor(
    private maxRetries: number = 3,
    private backoffMs: number = 1000,
    private backoffMultiplier: number = 2
  ) {}

  async postProcess(
    result: ToolExecutionResult,
    args: Record<string, any>,
    context: ToolExecutionContext
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
  name = 'performance';
  private metrics = new Map<string, { count: number; totalTime: number; errors: number }>();

  async preProcess(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Record<string, any>> {
    // Record start time
    context.metadata = context.metadata || {};
    context.metadata.startTime = Date.now();
    return args;
  }

  async postProcess(
    result: ToolExecutionResult,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const executionTime = Date.now() - (context.metadata?.startTime || 0);
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

  getMetrics(): Map<string, { count: number; totalTime: number; errors: number }> {
    return new Map(this.metrics);
  }
}

// ============================================================================
// TOOL REGISTRY - Manages all available tools
// ============================================================================

export class UnifiedToolRegistry extends EventEmitter implements IToolRegistry {
  private tools = new Map<string, ITool>();
  private categories = new Map<string, Set<string>>();

  constructor(private logger: ILogger) {
    super();
    this.logger.info('UnifiedToolRegistry initialized');
  }

  register(tool: ITool): void {
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

  getTool(id: string): ITool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: string): ITool[] {
    const toolIds = this.categories.get(category);
    if (!toolIds) {
      return [];
    }

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is ITool => tool !== undefined);
  }

  searchTools(query: string): ITool[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTools().filter(
      tool =>
        tool.definition.name.toLowerCase().includes(lowerQuery) ||
        tool.definition.description.toLowerCase().includes(lowerQuery)
    );
  }

  unregister(id: string): boolean {
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

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  getToolCount(): number {
    return this.tools.size;
  }
}

// ============================================================================
// TOOL EXECUTOR - Executes tools with decorators
// ============================================================================

export class UnifiedToolExecutor extends EventEmitter implements IToolExecutor {
  private rustBackend?: RustExecutionBackend;

  constructor(
    private logger: ILogger,
    private registry: IToolRegistry,
    private securityValidator?: IUnifiedSecurityValidator,
    private eventBus?: IEventBus,
    rustBackend?: RustExecutionBackend
  ) {
    super();
    this.rustBackend = rustBackend;
    this.logger.info('UnifiedToolExecutor initialized', {
      rustBackendEnabled: !!this.rustBackend,
      rustAvailable: this.rustBackend?.isAvailable() || false,
    });
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
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
          this.logger.warn('Rust backend execution failed, falling back to TypeScript:', rustResult.error);
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

  async executeSequence(requests: ToolExecutionRequest[]): Promise<ToolExecutionResult[]> {
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

  async executeParallel(requests: ToolExecutionRequest[]): Promise<ToolExecutionResult[]> {
    const promises = requests.map(async request => this.execute(request));
    return await Promise.all(promises);
  }

  private applyDecorators(tool: ITool, request: ToolExecutionRequest): ITool {
    // Create a copy of the tool with decorators applied
    const decoratedTool = Object.create(tool);

    // Apply standard decorators based on context
    const decorators: ToolDecorator[] = [];

    // Always apply logging
    decorators.push(new LoggingDecorator(this.eventBus));

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

    // Add decorators to tool
    decorators.forEach(decorator => decoratedTool.addDecorator(decorator));

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
