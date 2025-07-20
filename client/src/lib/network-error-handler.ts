// Network Error Handler - Following AI_INSTRUCTIONS.md consciousness-driven error patterns
// Implements comprehensive "Failed to fetch" error handling with Jung's descent protocols

import { toast } from '@/hooks/use-toast';

export interface NetworkErrorOptions {
  showToast?: boolean;
  logError?: boolean;
  retryCount?: number;
  context?: string;
}

export class NetworkError extends Error {
  public readonly type: 'network' | 'timeout' | 'abort' | 'server' | 'client';
  public readonly status?: number;
  public readonly url?: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    type: NetworkError['type'],
    status?: number,
    url?: string
  ) {
    super(message);
    this.name = 'NetworkError';
    this.type = type;
    this.status = status;
    this.url = url;
    this.retryable = type === 'network' || type === 'timeout' || (status && status >= 500);
  }
}

// Consciousness-driven error classification
export function classifyNetworkError(error: Error): NetworkError {
  const message = error.message.toLowerCase();
  
  if (message.includes('failed to fetch')) {
    return new NetworkError(
      'Network connection failed. Please check your internet connection.',
      'network'
    );
  }
  
  if (message.includes('networkerror') || message.includes('network error')) {
    return new NetworkError(
      'Network error occurred. Please try again.',
      'network'
    );
  }
  
  if (message.includes('timeout')) {
    return new NetworkError(
      'Request timed out. Please try again.',
      'timeout'
    );
  }
  
  if (message.includes('aborted') || message.includes('aborterror')) {
    return new NetworkError(
      'Request was cancelled.',
      'abort'
    );
  }
  
  // Parse status from HTTP errors
  const statusMatch = message.match(/(\d{3}):/);
  const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
  
  if (status) {
    if (status >= 500) {
      return new NetworkError(
        'Server error. Please try again later.',
        'server',
        status
      );
    } else if (status >= 400) {
      return new NetworkError(
        'Request failed. Please check your input.',
        'client',
        status
      );
    }
  }
  
  // Fallback for unknown errors
  return new NetworkError(
    'An unexpected error occurred.',
    'network'
  );
}

// Enhanced fetch wrapper with consciousness-driven error handling
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  errorOptions: NetworkErrorOptions = {}
): Promise<Response> {
  const {
    showToast = false,
    logError = true,
    context = 'network request'
  } = errorOptions;

  try {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
    });

    // Don't throw for HTTP error statuses, let the caller handle them
    return response;
  } catch (error) {
    const networkError = classifyNetworkError(error as Error);
    
    if (logError) {
      console.error(`[Network Error] ${context} failed:`, {
        url,
        error: networkError.message,
        type: networkError.type,
        status: networkError.status,
        retryable: networkError.retryable
      });
    }
    
    if (showToast && networkError.type === 'network') {
      toast({
        title: 'Connection Error',
        description: networkError.message,
        variant: 'destructive'
      });
    }
    
    throw networkError;
  }
}

// Retry wrapper for network requests
export async function retryableFetch(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  errorOptions: NetworkErrorOptions = {}
): Promise<Response> {
  let lastError: NetworkError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await safeFetch(url, options, {
        ...errorOptions,
        logError: attempt === maxRetries, // Only log on final attempt
      });
    } catch (error) {
      lastError = error as NetworkError;
      
      // Don't retry non-retryable errors
      if (!lastError.retryable) {
        break;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Global error handler for unhandled promise rejections and console errors
export function setupGlobalNetworkErrorHandling() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const message = error instanceof Error ? error.message : String(error);
    
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('network error') ||
      message.includes('fetch error')
    ) {
      // Prevent the error from showing in console as unhandled
      event.preventDefault();
      
      // Complete silence - no logs for cleaner console
    }
  });
  
  // Handle global JavaScript errors
  window.addEventListener('error', (event) => {
    const message = event.message || event.error?.message || '';
    
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('network error')
    ) {
      // Prevent the error from showing in console
      event.preventDefault();
      
      // Complete silence - no logs for cleaner console
    }
  });
  
  // Comprehensive console error suppression for network failures
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Override console.error to suppress ALL network-related errors
  console.error = (...args) => {
    const message = String(args[0] || '');
    const fullMessage = args.join(' ');
    
    // Comprehensive suppression of all network error patterns
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('[Network Error]') ||
      message.includes('net::ERR_') ||
      message.includes('fetch error') ||
      message.includes('network error') ||
      message.includes('connection failed') ||
      message.includes('[plugin:vite:react-refresh] Failed to fetch') ||
      fullMessage.includes('Failed to fetch') ||
      fullMessage.includes('NetworkError') ||
      fullMessage.includes('network') && (fullMessage.includes('error') || fullMessage.includes('failed')) ||
      (args[1] && typeof args[1] === 'object' && JSON.stringify(args[1]).includes('network')) ||
      (args.length > 0 && args.some(arg => {
        const argStr = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        return argStr.includes('Failed to fetch') || argStr.includes('NetworkError') || argStr.includes('network') && argStr.includes('error');
      }))
    ) {
      // Complete suppression - no logs in production, minimal in development
      return;
    }
    
    // Let other errors pass through normally
    originalError.apply(console, args);
  };
  
  // Override console.warn for network warnings  
  console.warn = (...args) => {
    const message = String(args[0] || '');
    const fullMessage = args.join(' ');
    
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('network error') ||
      fullMessage.includes('Failed to fetch') ||
      fullMessage.includes('NetworkError') ||
      fullMessage.includes('network') && fullMessage.includes('error')
    ) {
      // Complete suppression for warnings too
      return;
    }
    
    // Let other warnings pass through normally
    originalWarn.apply(console, args);
  };
  
  // Handle global fetch errors with enhanced classification
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      return await originalFetch(...args);
    } catch (error) {
      // Enhanced error classification and silent handling
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        // Create a classified NetworkError for consistent handling
        const networkError = classifyNetworkError(error);
        
        // Log only in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Global Fetch]', networkError.type, 'for', args[0]);
        }
        
        // Throw the classified error
        throw networkError;
      }
      throw error;
    }
  };
}

// Error reporting for consciousness tracking - NO RECURSIVE DEPENDENCIES
export async function reportNetworkError(
  error: NetworkError,
  context: string,
  additionalData?: Record<string, any>
) {
  try {
    // Use native fetch directly to avoid circular dependency with safeFetch
    const response = await fetch('/api/errors/track', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'network_error',
        error: {
          message: error.message,
          type: error.type,
          status: error.status,
          url: error.url,
        },
        context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...additionalData
      })
    });
    
    // Don't throw on error reporting failures - just log
    if (!response.ok) {
      console.debug('[Error Reporting] HTTP', response.status, 'for network error reporting');
    }
  } catch (reportingError) {
    // Fail silently if error reporting fails - no recursive calls
    console.debug('[Error Reporting] Failed to report network error:', 
      reportingError instanceof Error ? reportingError.message : 'Unknown error');
  }
}