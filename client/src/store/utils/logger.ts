// Store logging utilities
// Following AI_INSTRUCTIONS.md patterns with structured logging

interface LogContext {
  [key: string]: any;
}

interface Logger {
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: Error | LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
}

// Structured logger for store operations
export const storeLogger: Logger = {
  info: (message: string, context?: LogContext) => {
    if (import.meta.env.DEV) {
      console.log(`[Store] ${message}`, context || '');
    }
  },
  
  warn: (message: string, context?: LogContext) => {
    console.warn(`[Store Warning] ${message}`, context || '');
  },
  
  error: (message: string, error?: Error | LogContext) => {
    console.error(`[Store Error] ${message}`, error || '');
  },
  
  debug: (message: string, context?: LogContext) => {
    if (import.meta.env.DEV) {
      console.debug(`[Store Debug] ${message}`, context || '');
    }
  }
};

// Performance monitoring for store operations
export const measureStoreOperation = <T>(
  operationName: string,
  operation: () => T
): T => {
  const startTime = performance.now();
  
  try {
    const result = operation();
    const duration = performance.now() - startTime;
    
    storeLogger.debug('Store operation completed', {
      operation: operationName,
      duration: `${duration.toFixed(2)}ms`
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    storeLogger.error('Store operation failed', {
      operation: operationName,
      duration: `${duration.toFixed(2)}ms`,
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
};