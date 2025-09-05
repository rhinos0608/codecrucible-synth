/**
 * Timeout utilities for non-blocking CLI operations
 */

export interface TimeoutOptions {
  timeoutMs: number;
  operation: string;
  defaultValue?: any;
}

/**
 * Wraps a promise with a timeout to prevent CLI hanging
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
): Promise<{ success: boolean; result?: T; error?: string; timedOut?: boolean }> {
  const { timeoutMs, operation, defaultValue } = options;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Clear timeout if the main promise resolves first
      promise.finally(() => clearTimeout(timeoutId));
    });

    const result = await Promise.race([promise, timeoutPromise]);
    
    return {
      success: true,
      result
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes('timed out');
    
    return {
      success: false,
      error: errorMessage,
      timedOut: isTimeout,
      result: defaultValue
    };
  }
}

/**
 * Creates a timeout wrapper with default CLI settings
 */
export function createCliTimeout<T>(
  promise: Promise<T>,
  operation: string,
  timeoutMs: number = 5000,
  defaultValue?: T
) {
  return withTimeout(promise, {
    timeoutMs,
    operation,
    defaultValue
  });
}

/**
 * Specific timeout wrapper for MCP operations
 */
export function withMcpTimeout<T>(
  promise: Promise<T>,
  operation: string,
  defaultValue?: T
) {
  return createCliTimeout(promise, `MCP ${operation}`, 3000, defaultValue);
}