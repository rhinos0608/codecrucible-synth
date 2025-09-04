/**
 * Error Recovery System - Stub Implementation
 *
 * Provides error recovery and resilience capabilities for the CLI system.
 */

import { EventEmitter } from 'events';

export interface ErrorContext {
  error: Error;
  operation: string;
  component: string;
  severity: string;
  recoverable: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'abort' | 'continue';
  delay?: number;
  maxAttempts?: number;
  fallbackOperation?: () => Promise<unknown>;
  error?: Error;
}

export interface ErrorStats {
  totalErrors: number;
  recoveredErrors: number;
  failedRecoveries: number;
  averageRecoveryTime: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  errorRate: number;
  recoveryRate: number;
  uptime: number;
}

export class ErrorRecoverySystem extends EventEmitter {
  private history: {
    context: ErrorContext;
    action: RecoveryAction;
    success: boolean;
    attempts: number;
    start: number;
    end?: number;
    duration?: number;
    error?: Error | null;
  }[] = [];

  private readonly locks: Map<string, Promise<boolean>> = new Map();
  private readonly createdAt: number = Date.now();

  // Configuration defaults
  private readonly defaultMaxAttempts: number;
  private readonly defaultBaseDelayMs: number; // exponential backoff base
  private readonly maxDelayMs = 30_000;

  public constructor(
    opts: Readonly<{ defaultMaxAttempts?: number; defaultBaseDelayMs?: number }> = {}
  ) {
    super();
    this.defaultMaxAttempts = opts.defaultMaxAttempts ?? 3;
    this.defaultBaseDelayMs = opts.defaultBaseDelayMs ?? 200;
  }

  /**
   * Main entrypoint for reporting an error. Chooses a recovery action based on context,
   * emits events, attempts the recovery and updates history/stats.
   */
  public async handleError(error: Error, context: ErrorContext): Promise<RecoveryAction> {
    const id = this.lockKeyFor(context);
    // Emit raw error event
    this.emit('error', { error, context });

    // Build a sensible default action
    const action = this.decideAction(error, context);

    // Record start in history
    const entry: {
      context: ErrorContext;
      action: RecoveryAction;
      success: boolean;
      attempts: number;
      start: number;
      end?: number;
      duration?: number;
      error?: Error | null;
    } = {
      context,
      action,
      success: false,
      attempts: 0,
      start: Date.now(),
      end: undefined,
      duration: undefined,
      error: null as Error | null,
    };
    this.history.push(entry);

    // Prevent concurrent recoveries for same operation/component
    let lockPromise = this.locks.get(id);
    if (!lockPromise) {
      // Create a placeholder promise that will be replaced by the actual attempt
      let resolveLock: ((v: boolean) => void) | undefined;
      lockPromise = new Promise<boolean>(res => {
        resolveLock = res;
      });
      this.locks.set(id, lockPromise);

      try {
        this.emit('recovery:attempt', { error, context, action });
        const success = await this.executeRecoveryAction(action, context);
        entry.attempts = action.maxAttempts ?? entry.attempts;
        entry.success = success;
        entry.end = Date.now();
        entry.duration = entry.end - entry.start;
        if (!success) {
          entry.error = action.error ?? error;
          this.emit('recovery:failure', { error: entry.error, context, action, entry });
        } else {
          this.emit('recovery:success', { context, action, entry });
        }
        // Update health event
        this.emit('system:health', this.getSystemHealth());
        // resolve lock
        if (resolveLock) resolveLock(success);
      } catch (e: unknown) {
        entry.end = Date.now();
        entry.duration = entry.end - entry.start;
        const err = e instanceof Error ? e : new Error(String(e));
        entry.error = err;
        entry.success = false;
        this.emit('recovery:failure', { error: entry.error, context, action, entry });
        // resolve lock
        if (resolveLock) resolveLock(false);
      } finally {
        // Clean up lock
        this.locks.delete(id);
      }
      return action;
    } else {
      // If a recovery is already in progress, wait for it and reuse its result.
      try {
        const success = await lockPromise;
        // Update last entry to reflect that we piggybacked on existing attempt
        entry.end = Date.now();
        entry.duration = entry.end - entry.start;
        entry.success = success;
        if (success) this.emit('recovery:success', { context, action, entry, note: 'piggyback' });
        return action;
      } catch (e: unknown) {
        entry.end = Date.now();
        entry.duration = entry.end - entry.start;
        const err = e instanceof Error ? e : new Error(String(e));
        entry.error = err;
        entry.success = false;
        this.emit('recovery:failure', { error: entry.error, context, action, entry });
        return action;
      }
    }
  }

  /**
   * Execute the provided RecoveryAction.
   * Returns true if recovery succeeded, false otherwise.
   */
  public async executeRecoveryAction(
    action: RecoveryAction,
    context: Readonly<ErrorContext>
  ): Promise<boolean> {
    // Normalize max attempts and delay
    const maxAttempts =
      action.maxAttempts ?? (context.metadata?.maxAttempts as number) ?? this.defaultMaxAttempts;
    const baseDelay =
      action.delay ?? (context.metadata?.delayMs as number) ?? this.defaultBaseDelayMs;

    const runOperationFromContext = async (): Promise<unknown> => {
      // If a concrete retryable function is attached in metadata use it.
      const maybeFn = context.metadata?.operationFn as (() => Promise<unknown>) | undefined;
      if (maybeFn) return maybeFn();

      // If fallbackOperation provided use that as a last resort
      if (action.fallbackOperation) return action.fallbackOperation();

      // Nothing to run
      throw new Error('No operation function available to retry or fallback.');
    };

    const attemptRetry = async (): Promise<boolean> => {
      let attempt = 0;
      while (attempt < maxAttempts) {
        attempt++;
        try {
          await runOperationFromContext();
          return true;
        } catch {
          // exponential backoff
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), this.maxDelayMs);
          await this.sleep(delay);
        }
      }
      return false;
    };

    switch (action.type) {
      case 'retry':
        try {
          const success = await attemptRetry();
          return success;
        } catch (err) {
          action.error = err instanceof Error ? err : new Error(String(err));
          return false;
        }

      case 'fallback':
        if (action.fallbackOperation) {
          try {
            await action.fallbackOperation();
            return true;
          } catch (err) {
            action.error = err instanceof Error ? err : new Error(String(err));
            return false;
          }
        } else {
          action.error = new Error('No fallbackOperation provided');
          return false;
        }

      case 'continue':
        // Non-blocking, treat as success
        return true;

      case 'abort':
      default:
        // Do not attempt recovery
        action.error = action.error ?? new Error('Abort recovery chosen');
        return false;
    }
  }

  getErrorStats(): ErrorStats {
    const totalErrors = this.history.length;
    const recoveredErrors = this.history.filter(h => h.success).length;
    const failedRecoveries = totalErrors - recoveredErrors;
    const durations = this.history
      .filter(h => typeof h.duration === 'number')
      .map(h => h.duration as number);
    const averageRecoveryTime = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    return {
      totalErrors,
      recoveredErrors,
      failedRecoveries,
      averageRecoveryTime,
    };
  }

  getSystemHealth(): SystemHealth {
    const uptimeMs = Date.now() - this.createdAt;
    const uptime = uptimeMs;

    const stats = this.getErrorStats();
    const errorRate =
      uptimeMs > 0
        ? stats.totalErrors / Math.max(1, Math.floor(uptimeMs / 60_000))
        : stats.totalErrors;
    const recoveryRate = stats.totalErrors ? stats.recoveredErrors / stats.totalErrors : 1;

    // Determine status heuristically
    let status: SystemHealth['status'] = 'healthy';
    if (errorRate > 5 || recoveryRate < 0.7) status = 'degraded';
    if (errorRate > 20 || recoveryRate < 0.4) status = 'critical';

    return {
      status,
      errorRate,
      recoveryRate,
      uptime: uptimeMs,
    };
  }

  private decideAction(error: Error, context: Readonly<ErrorContext>): RecoveryAction {
    // If explicitly provided via metadata use it
    const desired = context.metadata?.preferredRecovery as RecoveryAction | undefined;
    if (desired) {
      // Ensure sensible defaults for attempts/delay without mutating the provided object
      return {
        ...desired,
        maxAttempts: desired.maxAttempts ?? this.defaultMaxAttempts,
        delay: desired.delay ?? this.defaultBaseDelayMs,
      };
    }

    // Heuristic decisions
    if (!context.recoverable) {
      return { type: 'abort', error: error };
    }

    const severity = (context.severity || '').toLowerCase();
    if (severity === 'critical') {
      // For critical, try fallback first (fast), then abort
      return {
        type: 'fallback',
        maxAttempts: 1,
        delay: 0,
        fallbackOperation: context.metadata?.fallbackOperation as
          | (() => Promise<unknown>)
          | undefined,
      };
    }

    if (severity === 'warning' || severity === 'info') {
      return {
        type: 'retry',
        maxAttempts: Math.max(
          1,
          (context.metadata?.maxAttempts as number) ?? this.defaultMaxAttempts
        ),
        delay: context.metadata?.delayMs as number | undefined,
      };
    }

    // Default to retry
    return { type: 'retry', maxAttempts: this.defaultMaxAttempts, delay: this.defaultBaseDelayMs };
  }

  private lockKeyFor(context: Readonly<ErrorContext>): string {
    return `${context.component}::${context.operation}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms));
  }

  clearHistory(): void {
    this.history.length = 0;
  }
}
