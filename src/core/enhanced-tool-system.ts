/**
 * Enhanced Tool System inspired by Archon's robust tool architecture
 * Provides advanced validation, error recovery, and tool orchestration
 */

import { z } from 'zod';
import { logger } from './logger.js';
import { BaseTool } from './tools/base-tool.js';
import { EnhancedError, ErrorCategory, ErrorSeverity, withErrorHandling } from './enhanced-error-handler.js';

export interface ToolExecutionContext {
  sessionId?: string;
  userId?: string;
  workingDirectory: string;
  environment?: Record<string, string>;
  previousResults?: any[];
  metadata?: Record<string, any>;
}

export interface ToolValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedInput?: any;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata: {
    toolName: string;
    executionTime: number;
    retryCount: number;
    memoryUsage?: number;
  };
}

export interface ToolRegistry {
  tools: Map<string, BaseTool>;
  categories: Map<string, string[]>;
  aliases: Map<string, string>;
}

export class ToolValidator {
  /**
   * Comprehensive tool input validation with sanitization
   */
  static validateToolInput(tool: BaseTool, input: any): ToolValidationResult {
    const result: ToolValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizedInput: input
    };

    try {
      // Basic null/undefined check
      if (input === null || input === undefined) {
        result.isValid = false;
        result.errors.push('Tool input cannot be null or undefined');
        return result;
      }

      // Ensure input is an object
      if (typeof input !== 'object' || Array.isArray(input)) {
        result.isValid = false;
        result.errors.push('Tool input must be an object');
        return result;
      }

      // Validate against tool schema if available
      if (tool.definition.parameters) {
        try {
          const validated = tool.definition.parameters.parse(input);
          result.sanitizedInput = validated;
        } catch (error) {
          if (error instanceof z.ZodError) {
            result.isValid = false;
            result.errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
          } else {
            result.isValid = false;
            result.errors.push('Schema validation failed');
          }
          return result;
        }
      }

      // Tool-specific validation
      const specificValidation = this.validateSpecificTool(tool.definition.name, result.sanitizedInput);
      result.errors.push(...specificValidation.errors);
      result.warnings.push(...specificValidation.warnings);
      
      if (specificValidation.errors.length > 0) {
        result.isValid = false;
      }

      // Security validation
      const securityValidation = this.validateSecurity(result.sanitizedInput);
      result.errors.push(...securityValidation.errors);
      result.warnings.push(...securityValidation.warnings);
      
      if (securityValidation.errors.length > 0) {
        result.isValid = false;
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private static validateSpecificTool(toolName: string, input: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (toolName) {
      case 'readFile':
      case 'readFiles':
        if (!input.path || typeof input.path !== 'string') {
          errors.push('path parameter is required and must be a string');
        } else if (input.path.trim() === '') {
          errors.push('path parameter cannot be empty');
        } else if (input.path.includes('..')) {
          warnings.push('path contains parent directory references (..)');
        }
        break;

      case 'writeFile':
      case 'writeFiles':
        if (!input.path || typeof input.path !== 'string') {
          errors.push('path parameter is required and must be a string');
        }
        if (!input.content && input.content !== '') {
          errors.push('content parameter is required');
        }
        if (typeof input.content !== 'string') {
          warnings.push('content should be a string');
        }
        break;

      case 'executeCommand':
        if (!input.command || typeof input.command !== 'string') {
          errors.push('command parameter is required and must be a string');
        } else if (input.command.trim() === '') {
          errors.push('command parameter cannot be empty');
        }
        // Check for dangerous commands
        const dangerousCommands = ['rm -rf', 'del /f', 'format', 'shutdown', 'reboot'];
        if (dangerousCommands.some(cmd => input.command.toLowerCase().includes(cmd))) {
          errors.push('potentially dangerous command detected');
        }
        break;

      case 'searchFiles':
        if (!input.pattern || typeof input.pattern !== 'string') {
          errors.push('pattern parameter is required and must be a string');
        }
        if (input.path && typeof input.path !== 'string') {
          errors.push('path parameter must be a string if provided');
        }
        break;

      case 'listFiles':
        if (input.path && typeof input.path !== 'string') {
          errors.push('path parameter must be a string if provided');
        }
        break;
    }

    return { errors, warnings };
  }

  private static validateSecurity(input: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for potential path traversal attacks
    const stringValues = this.extractStringValues(input);
    for (const value of stringValues) {
      if (value.includes('../') || value.includes('..\\')) {
        warnings.push('potential path traversal detected');
      }
      
      // Check for script injection attempts
      if (value.includes('<script') || value.includes('javascript:') || value.includes('eval(')) {
        errors.push('potential script injection detected');
      }

      // Check for command injection attempts
      if (value.includes('&&') || value.includes('||') || value.includes('|') || value.includes(';')) {
        warnings.push('potential command injection characters detected');
      }
    }

    return { errors, warnings };
  }

  private static extractStringValues(obj: any): string[] {
    const strings: string[] = [];
    
    if (typeof obj === 'string') {
      strings.push(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        strings.push(...this.extractStringValues(value));
      }
    }
    
    return strings;
  }
}

export class ToolRecovery {
  /**
   * Attempt to recover from tool execution failures
   */
  static async recoverFromFailure(
    tool: BaseTool,
    input: any,
    error: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    logger.warn(`Attempting recovery for failed tool execution: ${tool.definition.name}`, {
      error: error.message,
      input
    });

    // Try input sanitization
    const sanitizedInput = this.sanitizeInput(tool.definition.name, input);
    if (sanitizedInput && JSON.stringify(sanitizedInput) !== JSON.stringify(input)) {
      try {
        logger.info(`Retrying with sanitized input for tool: ${tool.definition.name}`);
        const result = await tool.execute(sanitizedInput);
        return {
          success: true,
          result,
          metadata: {
            toolName: tool.definition.name,
            executionTime: 0,
            retryCount: 1
          }
        };
      } catch (retryError) {
        logger.warn('Recovery with sanitized input failed', retryError);
      }
    }

    // Try fallback strategies
    const fallbackResult = await this.tryFallbackStrategies(tool, input, error, context);
    if (fallbackResult) {
      return fallbackResult;
    }

    // Return failure if all recovery attempts failed
    return {
      success: false,
      error: `Tool recovery failed: ${error.message}`,
      metadata: {
        toolName: tool.definition.name,
        executionTime: 0,
        retryCount: 1
      }
    };
  }

  private static sanitizeInput(toolName: string, input: any): any | null {
    if (!input || typeof input !== 'object') {
      return null;
    }

    const sanitized = { ...input };

    switch (toolName) {
      case 'readFile':
      case 'readFiles':
        if (sanitized.path) {
          // Normalize path separators and remove dangerous sequences
          sanitized.path = sanitized.path.replace(/\\/g, '/').replace(/\/+/g, '/');
          sanitized.path = sanitized.path.replace(/\.\./g, ''); // Remove path traversal
          if (!sanitized.path || sanitized.path === '/') {
            sanitized.path = '.';
          }
        }
        break;

      case 'writeFile':
      case 'writeFiles':
        if (sanitized.path) {
          sanitized.path = sanitized.path.replace(/\\/g, '/').replace(/\/+/g, '/');
          sanitized.path = sanitized.path.replace(/\.\./g, '');
        }
        if (sanitized.content && typeof sanitized.content !== 'string') {
          sanitized.content = String(sanitized.content);
        }
        break;

      case 'executeCommand':
        if (sanitized.command) {
          // Remove potentially dangerous characters
          sanitized.command = sanitized.command.replace(/[;&|]/g, '');
          sanitized.command = sanitized.command.trim();
        }
        break;

      case 'searchFiles':
        if (sanitized.pattern) {
          // Ensure pattern is safe
          sanitized.pattern = sanitized.pattern.replace(/[;&|]/g, '');
        }
        if (sanitized.path) {
          sanitized.path = sanitized.path.replace(/\.\./g, '');
        }
        break;
    }

    return sanitized;
  }

  private static async tryFallbackStrategies(
    tool: BaseTool,
    input: any,
    error: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult | null> {
    const toolName = tool.definition.name;

    switch (toolName) {
      case 'readFile':
        // Try reading with default encoding or different approach
        if (input.path) {
          try {
            // Attempt to read with different parameters
            const fallbackInput = { ...input, encoding: 'utf8' };
            const result = await tool.execute(fallbackInput);
            return {
              success: true,
              result,
              metadata: {
                toolName,
                executionTime: 0,
                retryCount: 1
              }
            };
          } catch (fallbackError) {
            logger.debug('Fallback read attempt failed', fallbackError);
          }
        }
        break;

      case 'executeCommand':
        // Try simpler version of command
        if (input.command && input.command.includes(' ')) {
          try {
            const simpleCommand = input.command.split(' ')[0];
            const fallbackInput = { ...input, command: simpleCommand };
            const result = await tool.execute(fallbackInput);
            return {
              success: true,
              result,
              metadata: {
                toolName,
                executionTime: 0,
                retryCount: 1
              }
            };
          } catch (fallbackError) {
            logger.debug('Fallback command execution failed', fallbackError);
          }
        }
        break;

      case 'listFiles':
        // Try listing current directory if path fails
        if (input.path && input.path !== '.') {
          try {
            const fallbackInput = { path: '.' };
            const result = await tool.execute(fallbackInput);
            return {
              success: true,
              result,
              metadata: {
                toolName,
                executionTime: 0,
                retryCount: 1
              }
            };
          } catch (fallbackError) {
            logger.debug('Fallback list files attempt failed', fallbackError);
          }
        }
        break;
    }

    return null;
  }
}

export class EnhancedToolSystem {
  private registry: ToolRegistry;
  private executionMetrics: Map<string, { calls: number; failures: number; totalTime: number }>;

  constructor() {
    this.registry = {
      tools: new Map(),
      categories: new Map(),
      aliases: new Map()
    };
    this.executionMetrics = new Map();
  }

  /**
   * Register a tool with the system
   */
  registerTool(tool: BaseTool, category?: string, aliases?: string[]): void {
    const name = tool.definition.name;
    
    this.registry.tools.set(name, tool);
    
    if (category) {
      if (!this.registry.categories.has(category)) {
        this.registry.categories.set(category, []);
      }
      this.registry.categories.get(category)!.push(name);
    }
    
    if (aliases) {
      for (const alias of aliases) {
        this.registry.aliases.set(alias, name);
      }
    }

    // Initialize metrics
    this.executionMetrics.set(name, { calls: 0, failures: 0, totalTime: 0 });
    
    logger.info(`Registered tool: ${name}`, { category, aliases });
  }

  /**
   * Execute a tool with comprehensive error handling and recovery
   */
  async executeTool(
    toolName: string,
    input: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    // Resolve tool name (handle aliases)
    const resolvedName = this.registry.aliases.get(toolName) || toolName;
    const tool = this.registry.tools.get(resolvedName);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        metadata: {
          toolName,
          executionTime: 0,
          retryCount: 0
        }
      };
    }

    // Update metrics
    const metrics = this.executionMetrics.get(resolvedName)!;
    metrics.calls++;

    try {
      // Validate input
      const validation = ToolValidator.validateToolInput(tool, input);
      if (!validation.isValid) {
        metrics.failures++;
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          metadata: {
            toolName: resolvedName,
            executionTime: Date.now() - startTime,
            retryCount: 0
          }
        };
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        logger.warn(`Tool execution warnings for ${resolvedName}:`, validation.warnings);
      }

      // Execute tool with error handling
      const result = await withErrorHandling(
        () => tool.execute(validation.sanitizedInput),
        {
          operation: `execute-tool-${resolvedName}`,
          metadata: { toolName: resolvedName, input: validation.sanitizedInput }
        }
      );

      const executionTime = Date.now() - startTime;
      metrics.totalTime += executionTime;

      return {
        success: true,
        result,
        metadata: {
          toolName: resolvedName,
          executionTime,
          retryCount: 0
        }
      };

    } catch (error) {
      metrics.failures++;
      
      // Attempt recovery
      try {
        const recoveryResult = await ToolRecovery.recoverFromFailure(tool, input, error, context);
        const executionTime = Date.now() - startTime;
        metrics.totalTime += executionTime;
        
        recoveryResult.metadata.executionTime = executionTime;
        return recoveryResult;
      } catch (recoveryError) {
        logger.error(`Tool execution and recovery failed for ${resolvedName}:`, recoveryError);
        
        return {
          success: false,
          error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: {
            toolName: resolvedName,
            executionTime: Date.now() - startTime,
            retryCount: 1
          }
        };
      }
    }
  }

  /**
   * Get available tools by category
   */
  getToolsByCategory(category: string): BaseTool[] {
    const toolNames = this.registry.categories.get(category) || [];
    return toolNames.map(name => this.registry.tools.get(name)!).filter(Boolean);
  }

  /**
   * Get all available tool names
   */
  getToolNames(): string[] {
    return Array.from(this.registry.tools.keys());
  }

  /**
   * Get tool information
   */
  getToolInfo(toolName: string): any {
    const resolvedName = this.registry.aliases.get(toolName) || toolName;
    const tool = this.registry.tools.get(resolvedName);
    const metrics = this.executionMetrics.get(resolvedName);

    if (!tool) {
      return null;
    }

    return {
      definition: tool.definition,
      metrics: metrics || { calls: 0, failures: 0, totalTime: 0 },
      aliases: Array.from(this.registry.aliases.entries())
        .filter(([_, name]) => name === resolvedName)
        .map(([alias]) => alias)
    };
  }

  /**
   * Get system statistics
   */
  getStats() {
    const stats = {
      totalTools: this.registry.tools.size,
      totalCategories: this.registry.categories.size,
      totalAliases: this.registry.aliases.size,
      toolMetrics: Object.fromEntries(this.executionMetrics)
    };

    return stats;
  }
}

/**
 * Global enhanced tool system instance
 */
export const globalToolSystem = new EnhancedToolSystem();