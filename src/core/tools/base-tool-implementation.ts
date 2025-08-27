/**
 * Base Tool Implementation
 * Common base class for all tool implementations
 */

import { getConfig } from '../config/env-config.js';

export interface ToolContext {
  sessionId?: string;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
  executionTime?: number;
}

export interface ToolCapabilities {
  requiresAuth: boolean;
  requiresNetwork: boolean;
  canCache: boolean;
  maxExecutionTime: number;
  supportedFormats: string[];
}

export abstract class BaseToolImplementation {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly version: string;
  
  protected capabilities: ToolCapabilities = {
    requiresAuth: false,
    requiresNetwork: false,
    canCache: true,
    maxExecutionTime: getConfig().toolExecutionTimeout,
    supportedFormats: ['text/plain']
  };

  constructor(capabilities?: Partial<ToolCapabilities>) {
    if (capabilities) {
      this.capabilities = { ...this.capabilities, ...capabilities };
    }
  }

  abstract execute(input: any, context?: ToolContext): Promise<ToolResult>;

  getCapabilities(): ToolCapabilities {
    return { ...this.capabilities };
  }

  protected createResult<T>(success: boolean, data?: T, error?: string, metadata?: Record<string, any>): ToolResult<T> {
    return {
      success,
      data,
      error,
      metadata,
      executionTime: Date.now()
    };
  }

  protected createSuccessResult<T>(data: T, metadata?: Record<string, any>): ToolResult<T> {
    return this.createResult(true, data, undefined, metadata);
  }

  protected createErrorResult(error: string, metadata?: Record<string, any>): ToolResult {
    return this.createResult(false, undefined, error, metadata);
  }

  async validate(input: any, context?: ToolContext): Promise<boolean> {
    // Default validation - can be overridden
    return input !== null && input !== undefined;
  }

  async cleanup(context?: ToolContext): Promise<void> {
    // Default cleanup - can be overridden
    // Override this method if the tool needs cleanup after execution
  }

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info', context?: ToolContext): void {
    const logMessage = `[${this.name}] ${message}`;
    console[level](logMessage, context ? { context } : '');
  }
}

export default BaseToolImplementation;