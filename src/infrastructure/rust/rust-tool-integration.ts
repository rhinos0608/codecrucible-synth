/**
 * Rust Tool Integration - Phase 4 Implementation
 *
 * Integrates Rust-backed tools with the existing tool system,
 * providing seamless registration, execution, and lifecycle management.
 */

import { logger } from '../../infrastructure/logging/logger.js';
import { RustProviderClient } from './rust-provider-client.js';

import type {
  ITool,
  ToolDefinition,
  ToolExecutionContext,
} from '../../domain/interfaces/tool-system.js';

export interface RustToolDefinition extends ToolDefinition {
  rustImplementation: string;
  nativeOptimizations: string[];
  fallbackAvailable: boolean;
}

export interface RustToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  executionTimeMs: number;
  executor: 'rust' | 'typescript-fallback';
  performance?: {
    cpuUsage: number;
    memoryUsage: number;
    operationCount: number;
  };
}

/**
 * Base class for Rust-backed tools
 */
export abstract class RustTool<Args extends Record<string, unknown>> implements ITool {
  public readonly definition: RustToolDefinition;
  protected providerClient: RustProviderClient;

  constructor(definition: RustToolDefinition) {
    this.definition = definition;
    this.providerClient = new RustProviderClient({
      name: `rust-tool-${definition.id}`,
      capabilities: definition.nativeOptimizations,
    });
  }

  /**
   * Initialize the Rust tool
   */
  async initialize(): Promise<void> {
    try {
      await this.providerClient.initialize();
      logger.info(`Rust tool ${this.definition.id} initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize Rust tool ${this.definition.id}:`, error);
      if (!this.definition.fallbackAvailable) {
        throw error;
      }
      logger.info(`Rust tool ${this.definition.id} will use TypeScript fallback`);
    }
  }

  /**
   * Execute the tool with automatic fallback
   */
  public async execute(
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<RustToolExecutionResult> {
    const typedArgs = args as Args;
    const startTime = Date.now();

    try {
      // Try Rust execution first
      if (await this.providerClient.isAvailable()) {
        const result = await this.executeRust(typedArgs, context);
        return {
          ...result,
          executionTimeMs: Date.now() - startTime,
          executor: 'rust',
        };
      }
    } catch (error) {
      logger.warn(`Rust execution failed for tool ${this.definition.id}, falling back:`, error);
    }

    // Fallback to TypeScript implementation
    if (this.definition.fallbackAvailable) {
      try {
        const result = await this.executeTypescript(typedArgs, context);
        return {
          ...result,
          executionTimeMs: Date.now() - startTime,
          executor: 'typescript-fallback',
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown execution error',
            details: error,
          },
          executionTimeMs: Date.now() - startTime,
          executor: 'typescript-fallback',
        };
      }
    }

    return {
      success: false,
      error: {
        code: 'NO_EXECUTOR_AVAILABLE',
        message: 'Neither Rust nor TypeScript executor available',
      },
      executionTimeMs: Date.now() - startTime,
      executor: 'rust',
    };
  }

  /**
   * Validate arguments against the tool's parameter schema
   */
  public validateArguments(args: Record<string, unknown>): {
    valid: boolean;
    errors?: string[];
  } {
    const typedArgs = args as Args;
    const errors: string[] = [];
    const { properties, required } = this.definition.parameters;

    // Check required parameters
    for (const requiredParam of required) {
      if (!(requiredParam in typedArgs)) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Validate parameter types and constraints
    for (const [key, value] of Object.entries(typedArgs)) {
      const paramDef = properties[key];
      if (!paramDef) {
        errors.push(`Unknown parameter: ${key}`);
        continue;
      }

      // Type validation
      const actualType = typeof value;
      if (paramDef.type === 'array' && !Array.isArray(value)) {
        errors.push(`Parameter ${key} must be an array`);
      } else if (paramDef.type !== 'array' && actualType !== paramDef.type) {
        errors.push(`Parameter ${key} must be of type ${paramDef.type}, got ${actualType}`);
      }

      // Enum validation
      if (paramDef.enum && !paramDef.enum.includes(value)) {
        errors.push(`Parameter ${key} must be one of: ${paramDef.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  /**
   * Check if the tool can be executed in the given context
   */
  public canExecute(context: Readonly<ToolExecutionContext>): boolean {
    // Check security level compatibility
    if (this.definition.securityLevel === 'dangerous' && context.securityLevel === 'low') {
      return false;
    }

    // Check required permissions
    for (const requiredPermission of this.definition.permissions) {
      const hasPermission = context.permissions.some(
        (p: Readonly<any>) =>
          p.type === requiredPermission.type &&
          p.scope === requiredPermission.scope &&
          (p.resource === requiredPermission.resource || p.resource === '*')
      );

      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      await this.providerClient.shutdown();
      logger.info(`Rust tool ${this.definition.id} cleaned up successfully`);
    } catch (error) {
      logger.error(`Error cleaning up Rust tool ${this.definition.id}:`, error);
    }
  }

  // Abstract methods to be implemented by concrete tools

  protected abstract executeRust(
    args: Readonly<Args>,
    context: Readonly<ToolExecutionContext>
  ): Promise<RustToolExecutionResult>;
  protected abstract executeTypescript(
    args: Readonly<Args>,
    context: Readonly<ToolExecutionContext>
  ): Promise<RustToolExecutionResult>;
}

/**
 * Example concrete Rust tool implementation - File Analysis Tool
 */
export interface FileAnalyzerArgs extends Record<string, unknown> {
  filePath: string;
  analysisDepth?: number;
}

export class RustFileAnalyzer extends RustTool<FileAnalyzerArgs> {
  public constructor() {
    super({
      id: 'rust-file-analyzer',
      name: 'High-Performance File Analyzer',
      description: 'Analyzes files using native Rust for optimal performance',
      category: 'analysis',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to analyze',
          },
          analysisDepth: {
            type: 'number',
            description: 'Depth of analysis (1-5)',
            minimum: 1,
            maximum: 5,
            default: 3,
          },
        },
        required: ['filePath'],
      },
      securityLevel: 'safe',
      permissions: [
        {
          type: 'read',
          resource: '{filePath}',
          scope: 'file',
        },
      ],
      rustImplementation: 'file-analyzer',
      nativeOptimizations: ['parallel-processing', 'memory-mapping', 'simd-operations'],
      fallbackAvailable: true,
    });
  }

  protected async executeRust(
    args: Readonly<FileAnalyzerArgs>,
    context: Readonly<ToolExecutionContext>
  ): Promise<RustToolExecutionResult> {
    const request = {
      type: 'code-analysis',
      operation: 'analyze-file',
      filePath: args.filePath,
      depth: args.analysisDepth || 3,
      context,
    };

    interface ProviderExecutionResult {
      result: unknown;
      performance?: {
        cpuUsage: number;
        memoryUsage: number;
        operationCount: number;
      };
    }

    const result = (await this.providerClient.execute(request)) as ProviderExecutionResult;

    return {
      success: true,
      result: {
        filePath: args.filePath,
        analysis: result.result,
        optimizations: this.definition.nativeOptimizations,
      },
      executionTimeMs: 0, // Will be set by parent execute method
      executor: 'rust',
      performance: result.performance,
    };
  }

  protected async executeTypescript(
    args: Readonly<FileAnalyzerArgs>,
    context: Readonly<ToolExecutionContext>
  ): Promise<RustToolExecutionResult> {
    // TypeScript fallback implementation
    const fs = await import('fs/promises');

    try {
      const content = await fs.readFile(args.filePath, 'utf-8');
      const analysis = {
        size: content.length,
        lines: content.split('\n').length,
        words: content.split(/\s+/).length,
        characters: content.length,
        type: this.detectFileType(args.filePath),
      };

      return {
        success: true,
        result: {
          filePath: args.filePath,
          analysis,
          fallback: true,
        },
        executionTimeMs: 0, // Will be set by parent execute method
        executor: 'typescript-fallback',
      };
    } catch (error) {
      throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : error}`);
    }
  }

  private detectFileType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
    };
    return typeMap[extension || ''] || 'unknown';
  }
}

/**
 * Tool registry for managing Rust-backed tools
 */
export class RustToolRegistry {
  private tools = new Map<string, RustTool<Record<string, unknown>>>();
  private initialized = false;

  constructor() {
    this.registerBuiltinTools();
  }

  /**
   * Register built-in Rust tools
   */
  private registerBuiltinTools(): void {
    const builtinTools = [
      new RustFileAnalyzer(),
      // Add more built-in Rust tools here
    ];

    builtinTools.forEach(tool => {
      this.tools.set(tool.definition.id, tool as unknown as RustTool<Record<string, unknown>>);
    });
  }

  /**
   * Initialize all registered tools
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing Rust tool registry...');

    const initPromises = Array.from(this.tools.values()).map(async tool => {
      try {
        await tool.initialize();
        return { success: true, toolId: tool.definition.id };
      } catch (error) {
        logger.error(`Failed to initialize tool ${tool.definition.id}:`, error);
        return { success: false, toolId: tool.definition.id, error };
      }
    });

    const results = await Promise.all(initPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info(`Rust tool registry initialized: ${successful} successful, ${failed} failed`);
    this.initialized = true;
  }

  /**
   * Get a tool by ID
   */
  getTool(toolId: string): RustTool<Record<string, unknown>> | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all available tool definitions
   */
  getAvailableTools(): RustToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  /**
   * Register a custom Rust tool
   */
  registerTool(tool: RustTool<Record<string, unknown>>): void {
    this.tools.set(tool.definition.id, tool);
    if (this.initialized) {
      tool.initialize().catch(error => {
        logger.error(`Failed to initialize newly registered tool ${tool.definition.id}:`, error);
      });
    }
  }

  /**
   * Cleanup all tools
   */
  async destroy(): Promise<void> {
    const destroyPromises = Array.from(this.tools.values()).map(tool =>
      tool.destroy().catch(error => {
        logger.error(`Error destroying tool ${tool.definition.id}:`, error);
      })
    );

    await Promise.all(destroyPromises);
    this.tools.clear();
    this.initialized = false;

    logger.info('Rust tool registry cleaned up');
  }
}
