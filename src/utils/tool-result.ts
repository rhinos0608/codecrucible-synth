import { ToolExecutionResult } from '../domain/interfaces/tool-execution.js';

/**
 * Create a standardized, serializable ToolExecutionResult.
 * Ensures objects are plain and JSON friendly.
 */
export function createToolResult<T>(result: ToolExecutionResult<T>): ToolExecutionResult<T> {
  return {
    success: result.success,
    data: result.data,
    output: result.output ? { ...result.output } : undefined,
    error: result.error ? { ...result.error } : undefined,
    metadata: result.metadata ? { ...result.metadata } : undefined,
    warnings: result.warnings ? [...result.warnings] : undefined,
  };
}
