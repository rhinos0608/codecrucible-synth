/**
 * Timeout Manager - Production Implementation
 * Provides comprehensive timeout management for operations and promises
 */

export enum TimeoutLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
  OPERATION = 'operation'
}

export enum TimeoutStrategy {
  AGGRESSIVE = 'aggressive',
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative',
  GRACEFUL = 'graceful'
}

export interface TimeoutOptions {
  level?: TimeoutLevel;
  duration?: number;
  strategy?: TimeoutStrategy;
  onTimeout?: (context: string) => void;
  retryCount?: number;
  gracefulShutdown?: boolean;
}

export interface TimeoutStats {
  totalTimeouts: number;
  activeTimeouts: number;
  timeoutsByLevel: Record<TimeoutLevel, number>;
  averageTimeout: number;
}

export class TimeoutError extends Error {
  constructor(
    message: string, 
    public readonly context: string,
    public readonly level: TimeoutLevel,
    public readonly duration: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class TimeoutManager {
  private static instance: TimeoutManager;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private timeoutStats: Map<string, { startTime: number; level: TimeoutLevel; duration: number }> = new Map();
  
  // Default timeout configurations by level
  private defaultTimeouts: Record<TimeoutLevel, number> = {
    [TimeoutLevel.LOW]: 5000,
    [TimeoutLevel.MEDIUM]: 15000,
    [TimeoutLevel.HIGH]: 30000,
    [TimeoutLevel.CRITICAL]: 60000,
    [TimeoutLevel.OPERATION]: 120000
  };

  private constructor() {}

  static getInstance(): TimeoutManager {
    if (!TimeoutManager.instance) {
      TimeoutManager.instance = new TimeoutManager();
    }
    return TimeoutManager.instance;
  }

  withTimeout<T>(
    promiseOrOperation: Promise<T> | (() => Promise<T>), 
    contextIdOrTimeout: string | number, 
    options: TimeoutOptions = {}
  ): Promise<T> {
    let promise: Promise<T>;
    let contextId: string;
    let timeoutMs: number;
    
    // Determine parameters
    if (typeof promiseOrOperation === 'function') {
      promise = promiseOrOperation();
    } else {
      promise = promiseOrOperation;
    }
    
    if (typeof contextIdOrTimeout === 'string') {
      contextId = contextIdOrTimeout;
      timeoutMs = options.duration || this.defaultTimeouts[options.level || TimeoutLevel.MEDIUM];
    } else {
      contextId = `timeout_${Date.now()}`;
      timeoutMs = contextIdOrTimeout;
    }
    
    const level = options.level || TimeoutLevel.MEDIUM;
    const startTime = Date.now();
    
    // Track timeout statistics
    this.timeoutStats.set(contextId, { startTime, level, duration: timeoutMs });
    
    return new Promise<T>((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | null = null;
      let isSettled = false;
      
      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        this.timeouts.delete(contextId);
        this.timeoutStats.delete(contextId);
      };
      
      const settlePromise = (settler: () => void) => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          settler();
        }
      };
      
      // Handle timeout
      timeoutHandle = setTimeout(() => {
        settlePromise(() => {
          const error = new TimeoutError(
            `Operation '${contextId}' timed out after ${timeoutMs}ms`,
            contextId,
            level,
            timeoutMs
          );
          
          if (options.onTimeout) {
            options.onTimeout(contextId);
          }
          
          reject(error);
        });
      }, timeoutMs);
      
      this.timeouts.set(contextId, timeoutHandle);
      
      // Handle promise resolution/rejection
      promise
        .then((result) => {
          settlePromise(() => resolve(result));
        })
        .catch((error) => {
          settlePromise(() => reject(error));
        });
    });
  }

  setTimeout(id: string, callback: () => void, delay: number): void {
    if (this.timeouts.has(id)) {
      clearTimeout(this.timeouts.get(id)!);
    }
    
    const timeout = setTimeout(callback, delay);
    this.timeouts.set(id, timeout);
  }

  clearTimeout(id: string): void {
    const timeout = this.timeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(id);
    }
  }

  clearAllTimeouts(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    this.timeoutStats.clear();
  }

  /**
   * Get timeout statistics
   */
  getStats(): TimeoutStats {
    const stats = Array.from(this.timeoutStats.values());
    const currentTime = Date.now();
    
    const timeoutsByLevel = {
      [TimeoutLevel.LOW]: 0,
      [TimeoutLevel.MEDIUM]: 0,
      [TimeoutLevel.HIGH]: 0,
      [TimeoutLevel.CRITICAL]: 0,
      [TimeoutLevel.OPERATION]: 0
    };
    
    let totalDuration = 0;
    
    for (const stat of stats) {
      timeoutsByLevel[stat.level]++;
      totalDuration += (currentTime - stat.startTime);
    }
    
    return {
      totalTimeouts: stats.length,
      activeTimeouts: this.timeouts.size,
      timeoutsByLevel,
      averageTimeout: stats.length > 0 ? totalDuration / stats.length : 0
    };
  }

  /**
   * Configure default timeout for a specific level
   */
  setDefaultTimeout(level: TimeoutLevel, duration: number): void {
    this.defaultTimeouts[level] = duration;
  }

  /**
   * Get default timeout for a level
   */
  getDefaultTimeout(level: TimeoutLevel): number {
    return this.defaultTimeouts[level];
  }

  /**
   * Check if a timeout is currently active
   */
  hasActiveTimeout(id: string): boolean {
    return this.timeouts.has(id);
  }

  /**
   * Get list of active timeout IDs
   */
  getActiveTimeouts(): string[] {
    return Array.from(this.timeouts.keys());
  }
}

export const timeoutManager = TimeoutManager.getInstance();