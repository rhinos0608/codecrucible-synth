// Consciousness-driven error boundary following AI_INSTRUCTIONS.md patterns
// Alexander's timeless building patterns for resilient error handling

import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
  retryCount: number;
}

// Following CodingPhilosophy.md: Living spiral methodology for error recovery
export class ConsciousnessErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: '',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Following AI_INSTRUCTIONS.md: Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Following AI_INSTRUCTIONS.md: Comprehensive error logging
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      errorInfo: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Consciousness Error Boundary caught an error:', errorDetails);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Send error to tracking service (following consciousness patterns)
    this.trackConsciousnessError(errorDetails);
  }

  private trackConsciousnessError = async (errorDetails: any) => {
    try {
      await fetch('/api/errors/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...errorDetails,
          source: 'consciousness-error-boundary',
          consciousnessLevel: 'error-recovery',
          recoveryAttempt: this.state.retryCount
        })
      });
    } catch (trackingError) {
      console.error('Failed to track consciousness error:', trackingError);
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorId: '',
        retryCount: prevState.retryCount + 1
      }));
    } else {
      // Maximum retries reached - suggest page refresh
      window.location.reload();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI following AI_INSTRUCTIONS.md design patterns
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-gray-800 border-red-500/20">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-300">
                  Consciousness Disruption Detected
                </h3>
                <p className="text-sm text-gray-400">
                  Error ID: {this.state.errorId}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-gray-300">
                The application encountered an unexpected error. Following Jung's descent 
                protocols, we're attempting to restore consciousness stability.
              </p>

              {this.state.error && (
                <details className="text-xs text-gray-400 bg-gray-900/50 p-3 rounded">
                  <summary className="cursor-pointer">Technical Details</summary>
                  <pre className="mt-2 whitespace-pre-wrap">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              <div className="flex space-x-2">
                {this.state.retryCount < this.maxRetries ? (
                  <Button
                    onClick={this.handleRetry}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry ({this.maxRetries - this.state.retryCount} attempts left)
                  </Button>
                ) : (
                  <Button
                    onClick={this.handleReload}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Application
                  </Button>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center">
                Following Alexander's pattern language for graceful degradation
              </p>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to access error boundary state
export const useConsciousnessErrorBoundary = () => {
  return {
    // This would need to be implemented with a context provider
    // For now, it's a placeholder for the consciousness error tracking system
    reportError: (error: Error, context?: string) => {
      console.error('Consciousness error reported:', { error, context });
    }
  };
};