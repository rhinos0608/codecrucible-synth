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

// Global error handler for unhandled promise rejections
export function setupGlobalNetworkErrorHandling() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      console.warn('[Global] Unhandled network error:', error.message);
      
      // Prevent the error from showing in console as unhandled
      event.preventDefault();
      
      // Show user-friendly notification
      toast({
        title: 'Connection Issue',
        description: 'Lost connection to server. Please refresh if the issue persists.',
        variant: 'destructive'
      });
    }
  });
  
  // Handle global fetch errors
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      return await originalFetch(...args);
    } catch (error) {
      // Log but don't modify the error - let components handle it
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        console.debug('[Global] Fetch error intercepted:', args[0]);
      }
      throw error;
    }
  };
}

// Error reporting for consciousness tracking
export async function reportNetworkError(
  error: NetworkError,
  context: string,
  additionalData?: Record<string, any>
) {
  try {
    await safeFetch('/api/errors/track', {
      method: 'POST',
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
    }, { logError: false }); // Don't log errors for error reporting itself
  } catch (reportingError) {
    // Fail silently if error reporting fails
    console.debug('[Error Reporting] Failed to report network error:', reportingError);
  }
}