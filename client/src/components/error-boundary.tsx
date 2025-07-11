import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Track error for monitoring
    try {
      const errorEvent = {
        errorType: 'component_error' as const,
        errorMessage: error.message,
        errorStack: error.stack,
        severity: 'high' as const,
        metadata: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true
        }
      };
      
      // Store locally since we can't use hooks in class components
      const localErrors = JSON.parse(localStorage.getItem('error_log') || '[]');
      localErrors.push({
        ...errorEvent,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      localStorage.setItem('error_log', JSON.stringify(localErrors.slice(-50)));
    } catch (trackingError) {
      console.warn('Failed to track error:', trackingError);
    }
    
    this.setState({
      error,
      errorInfo
    });
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.retry} />;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Something went wrong
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    An unexpected error occurred
                  </p>
                </div>
              </div>

              {this.state.error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-300 font-mono">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={this.retry}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  size="sm"
                >
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = () => setError(null);
  
  const captureError = (error: Error) => {
    console.error('useErrorBoundary caught an error:', error);
    setError(error);
  };

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}

export default ErrorBoundary;