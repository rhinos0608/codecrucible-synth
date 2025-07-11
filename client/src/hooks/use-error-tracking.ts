import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ErrorEvent {
  errorType: 'api_error' | 'component_error' | 'network_error' | 'validation_error' | '404_error';
  errorMessage: string;
  errorStack?: string;
  userAgent?: string;
  url?: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export function useErrorTracking() {
  const queryClient = useQueryClient();

  const trackError = useMutation({
    mutationFn: async (errorData: Omit<ErrorEvent, 'timestamp' | 'userAgent'>) => {
      const errorEvent: ErrorEvent = {
        ...errorData,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.error(`[Error Tracking] ${errorData.errorType}:`, errorData.errorMessage, {
        severity: errorData.severity,
        metadata: errorData.metadata
      });

      // Try to send to server, but don't fail if server is unavailable
      try {
        const response = await apiRequest('POST', '/api/errors/track', errorEvent);
        return response.json();
      } catch (serverError) {
        console.warn('[Error Tracking] Failed to send error to server:', serverError);
        // Store locally as fallback
        const localErrors = JSON.parse(localStorage.getItem('error_log') || '[]');
        localErrors.push(errorEvent);
        // Keep only last 50 errors
        localStorage.setItem('error_log', JSON.stringify(localErrors.slice(-50)));
        return { stored_locally: true };
      }
    },
    onError: (error) => {
      console.warn('[Error Tracking] Failed to track error:', error);
    }
  });

  const trackApiError = useCallback((error: any, endpoint: string, method: string = 'GET') => {
    let errorType: ErrorEvent['errorType'] = 'api_error';
    let severity: ErrorEvent['severity'] = 'medium';

    if (error?.message?.includes('404')) {
      errorType = '404_error';
      severity = 'high';
    } else if (error?.message?.includes('401') || error?.message?.includes('403')) {
      errorType = 'api_error';
      severity = 'high';
    } else if (error?.message?.includes('500')) {
      errorType = 'api_error';
      severity = 'critical';
    }

    trackError.mutate({
      errorType,
      errorMessage: error?.message || 'Unknown API error',
      errorStack: error?.stack,
      severity,
      metadata: {
        endpoint,
        method,
        status: error?.status,
        response: error?.response
      }
    });
  }, [trackError]);

  const trackComponentError = useCallback((error: Error, componentName: string, props?: any) => {
    trackError.mutate({
      errorType: 'component_error',
      errorMessage: error.message,
      errorStack: error.stack,
      severity: 'medium',
      metadata: {
        componentName,
        props: props ? JSON.stringify(props).substring(0, 500) : undefined
      }
    });
  }, [trackError]);

  const track404Error = useCallback((path: string, referrer?: string) => {
    trackError.mutate({
      errorType: '404_error',
      errorMessage: `Page not found: ${path}`,
      severity: 'high',
      metadata: {
        path,
        referrer,
        isClientSideRoute: true
      }
    });
  }, [trackError]);

  const trackValidationError = useCallback((field: string, value: any, rule: string) => {
    trackError.mutate({
      errorType: 'validation_error',
      errorMessage: `Validation failed for ${field}: ${rule}`,
      severity: 'low',
      metadata: {
        field,
        value: typeof value === 'string' ? value.substring(0, 100) : JSON.stringify(value).substring(0, 100),
        rule
      }
    });
  }, [trackError]);

  const getLocalErrors = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('error_log') || '[]');
    } catch {
      return [];
    }
  }, []);

  const clearLocalErrors = useCallback(() => {
    localStorage.removeItem('error_log');
  }, []);

  return {
    trackError: trackError.mutate,
    trackApiError,
    trackComponentError,
    track404Error,
    trackValidationError,
    getLocalErrors,
    clearLocalErrors,
    isTracking: trackError.isPending
  };
}