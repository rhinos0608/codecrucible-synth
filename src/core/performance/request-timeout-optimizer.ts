// Request Timeout Optimizer
// Core layer request timeout optimization

export interface TimeoutConfig {
  defaultTimeout: number;
  minTimeout: number;
  maxTimeout: number;
  adaptiveEnabled: boolean;
}

export interface RequestProfile {
  requestType: string;
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface RequestTimeoutOptimizerInterface {
  calculateOptimalTimeout(profile: RequestProfile): number;
  updateProfile(requestType: string, responseTime: number, success: boolean): void;
  getTimeoutRecommendation(requestType: string): number;
  
  // Additional methods expected by request-execution-manager
  createOptimizedTimeout(
    requestId: string,
    requestType?: string,
    complexityHint?: 'low' | 'medium' | 'high'
  ): {
    abortController: AbortController;
    timeout: number;
  };
  completeRequest(requestId: string): void;
}

export class RequestTimeoutOptimizer implements RequestTimeoutOptimizerInterface {
  private config: TimeoutConfig;
  private profiles = new Map<string, RequestProfile>();
  private requestHistory = new Map<string, { times: number[]; successes: boolean[] }>();
  private activeRequests = new Map<string, { 
    startTime: number; 
    abortController: AbortController;
    requestType: string;
  }>();

  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = {
      defaultTimeout: 5000,
      minTimeout: 1000,
      maxTimeout: 30000,
      adaptiveEnabled: true,
      ...config
    };
  }

  calculateOptimalTimeout(profile: RequestProfile): number {
    if (!this.config.adaptiveEnabled) {
      return this.config.defaultTimeout;
    }

    let timeout = profile.p95ResponseTime * 1.5; // 50% buffer above p95

    // Adjust based on complexity
    const complexityMultipliers = {
      low: 1.0,
      medium: 1.3,
      high: 1.8
    };
    timeout *= complexityMultipliers[profile.complexity];

    // Adjust based on error rate
    if (profile.errorRate > 0.1) {
      timeout *= 1.2; // 20% increase for high error rates
    }

    // Clamp to configured bounds
    return Math.max(
      this.config.minTimeout,
      Math.min(this.config.maxTimeout, Math.round(timeout))
    );
  }

  updateProfile(requestType: string, responseTime: number, success: boolean): void {
    if (!this.requestHistory.has(requestType)) {
      this.requestHistory.set(requestType, { times: [], successes: [] });
    }

    const history = this.requestHistory.get(requestType)!;
    history.times.push(responseTime);
    history.successes.push(success);

    // Keep only last 100 requests
    if (history.times.length > 100) {
      history.times.shift();
      history.successes.shift();
    }

    // Update profile
    this.recalculateProfile(requestType);
  }

  getTimeoutRecommendation(requestType: string): number {
    const profile = this.profiles.get(requestType);
    
    if (!profile) {
      return this.config.defaultTimeout;
    }

    return this.calculateOptimalTimeout(profile);
  }

  private recalculateProfile(requestType: string): void {
    const history = this.requestHistory.get(requestType);
    if (!history || history.times.length === 0) return;

    const times = [...history.times].sort((a, b) => a - b);
    const successes = history.successes;

    const averageResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
    const p95Index = Math.floor(times.length * 0.95);
    const p95ResponseTime = times[p95Index] || times[times.length - 1];
    const errorRate = 1 - (successes.filter(s => s).length / successes.length);

    // Determine complexity based on response time patterns
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    if (averageResponseTime < 100) complexity = 'low';
    else if (averageResponseTime > 1000) complexity = 'high';

    this.profiles.set(requestType, {
      requestType,
      averageResponseTime,
      p95ResponseTime,
      errorRate,
      complexity
    });
  }

  // Utility methods
  getAllProfiles(): Map<string, RequestProfile> {
    return new Map(this.profiles);
  }

  resetProfile(requestType: string): void {
    this.profiles.delete(requestType);
    this.requestHistory.delete(requestType);
  }

  getOptimizationSummary(): {
    profileCount: number;
    averageTimeout: number;
    timeoutRange: { min: number; max: number };
  } {
    if (this.profiles.size === 0) {
      return {
        profileCount: 0,
        averageTimeout: this.config.defaultTimeout,
        timeoutRange: { min: this.config.defaultTimeout, max: this.config.defaultTimeout }
      };
    }

    const timeouts = Array.from(this.profiles.values()).map(p => this.calculateOptimalTimeout(p));
    const averageTimeout = timeouts.reduce((a, b) => a + b, 0) / timeouts.length;

    return {
      profileCount: this.profiles.size,
      averageTimeout: Math.round(averageTimeout),
      timeoutRange: {
        min: Math.min(...timeouts),
        max: Math.max(...timeouts)
      }
    };
  }

  /**
   * Create an optimized timeout with abort controller for a request
   */
  createOptimizedTimeout(
    requestId: string,
    requestType: string = 'default',
    complexityHint: 'low' | 'medium' | 'high' = 'medium'
  ): {
    abortController: AbortController;
    timeout: number;
  } {
    const abortController = new AbortController();
    
    // Get optimal timeout based on request profile
    let timeout = this.getTimeoutRecommendation(requestType);
    
    // Adjust based on complexity hint if no profile exists
    if (!this.profiles.has(requestType)) {
      const complexityMultipliers = { low: 0.7, medium: 1.0, high: 1.5 };
      timeout = Math.round(this.config.defaultTimeout * complexityMultipliers[complexityHint]);
    }
    
    // Ensure timeout is within bounds
    timeout = Math.max(this.config.minTimeout, Math.min(timeout, this.config.maxTimeout));
    
    // Track this active request
    this.activeRequests.set(requestId, {
      startTime: Date.now(),
      abortController,
      requestType
    });
    
    // Set up timeout to abort the request
    setTimeout(() => {
      if (this.activeRequests.has(requestId)) {
        abortController.abort();
        this.updateProfile(requestType, timeout, false); // Mark as failed due to timeout
      }
    }, timeout);
    
    return { abortController, timeout };
  }

  /**
   * Mark a request as completed and update performance metrics
   */
  completeRequest(requestId: string): void {
    const activeRequest = this.activeRequests.get(requestId);
    if (activeRequest) {
      const responseTime = Date.now() - activeRequest.startTime;
      this.updateProfile(activeRequest.requestType, responseTime, true);
      this.activeRequests.delete(requestId);
    }
  }
}

export const requestTimeoutOptimizer = new RequestTimeoutOptimizer();