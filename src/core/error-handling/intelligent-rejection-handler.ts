/**
 * Intelligent Promise Rejection Handler
 * Provides sophisticated categorization and recovery for unhandled promise rejections
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { getConfig } from '../config/env-config.js';

export enum RejectionCategory {
  NETWORK_ERROR = 'network',
  FILE_SYSTEM_ERROR = 'filesystem', 
  EXTERNAL_SERVICE_ERROR = 'external_service',
  TOOL_EXECUTION_ERROR = 'tool_execution',
  VALIDATION_ERROR = 'validation',
  RESOURCE_ERROR = 'resource',
  LOGIC_ERROR = 'logic',
  UNKNOWN_ERROR = 'unknown'
}

export enum RecoveryAction {
  CONTINUE = 'continue',           // Log and continue operation
  RETRY = 'retry',                // Attempt automatic retry
  GRACEFUL_DEGRADATION = 'degrade', // Disable affected component
  CONTROLLED_SHUTDOWN = 'shutdown', // Clean shutdown and restart
  IMMEDIATE_EXIT = 'exit'          // Critical failure - exit immediately
}

export interface RejectionContext {
  category: RejectionCategory;
  action: RecoveryAction;
  reason: any;
  promise: Promise<any>;
  stack?: string;
  timestamp: number;
  component?: string;
  recoveryAttempts?: number;
  metadata?: Record<string, any>;
}

export interface RejectionPattern {
  category: RejectionCategory;
  pattern: RegExp | string;
  action: RecoveryAction;
  maxRetries?: number;
  cooldownMs?: number;
  description: string;
}

/**
 * Intelligent Promise Rejection Handler with categorization and recovery
 */
export class IntelligentRejectionHandler extends EventEmitter {
  private rejectionCount = 0;
  private rejectionHistory: RejectionContext[] = [];
  private componentHealth = new Map<string, boolean>();
  private retryAttempts = new Map<string, number>();
  private lastRejectionTime = new Map<string, number>();
  private isShuttingDown = false;

  private readonly REJECTION_PATTERNS: RejectionPattern[] = [
    // Network/Connection Errors
    {
      category: RejectionCategory.NETWORK_ERROR,
      pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch failed/i,
      action: RecoveryAction.RETRY,
      maxRetries: 3,
      cooldownMs: 5000,
      description: 'Network connectivity issues'
    },
    {
      category: RejectionCategory.EXTERNAL_SERVICE_ERROR,
      pattern: /localhost:11434|localhost:1234|Ollama|LM Studio|MCP.*server/i,
      action: RecoveryAction.GRACEFUL_DEGRADATION,
      maxRetries: 2,
      cooldownMs: 10000,
      description: 'External AI/MCP service unavailable'
    },

    // File System Errors
    {
      category: RejectionCategory.FILE_SYSTEM_ERROR,
      pattern: /ENOENT|EACCES|EPERM|EMFILE|ENFILE|file system|permission denied/i,
      action: RecoveryAction.CONTINUE,
      description: 'File system access issues'
    },

    // Tool Execution Errors
    {
      category: RejectionCategory.TOOL_EXECUTION_ERROR,
      pattern: /spawn.*ENOENT|execSync|Command failed|Process exited/i,
      action: RecoveryAction.CONTINUE,
      description: 'Tool execution failures'
    },

    // Resource Exhaustion
    {
      category: RejectionCategory.RESOURCE_ERROR,
      pattern: /ENOMEM|out of memory|Maximum call stack|heap.*limit/i,
      action: RecoveryAction.CONTROLLED_SHUTDOWN,
      description: 'Resource exhaustion detected'
    },

    // Critical Logic Errors
    {
      category: RejectionCategory.LOGIC_ERROR,
      pattern: /TypeError.*undefined|Cannot read prop.*undefined|ReferenceError/i,
      action: RecoveryAction.IMMEDIATE_EXIT,
      description: 'Critical logic errors that indicate code bugs'
    },

    // Validation Errors
    {
      category: RejectionCategory.VALIDATION_ERROR,
      pattern: /validation failed|invalid.*parameter|schema.*error/i,
      action: RecoveryAction.CONTINUE,
      description: 'Input validation failures'
    }
  ];

  /**
   * Categorize and handle an unhandled promise rejection
   */
  async handleRejection(reason: any, promise: Promise<any>): Promise<void> {
    if (this.isShuttingDown) {
      console.error('🔄 Rejection during shutdown, ignoring:', reason);
      return;
    }

    const context = this.categorizeRejection(reason, promise);
    this.rejectionCount++;
    this.rejectionHistory.push(context);

    // Trim history to last 50 rejections
    if (this.rejectionHistory.length > 50) {
      this.rejectionHistory = this.rejectionHistory.slice(-50);
    }

    // Log the rejection with rich context
    this.logRejection(context);

    // Emit event for monitoring
    this.emit('rejection', context);

    // Execute recovery action
    await this.executeRecoveryAction(context);

    // Check for rejection patterns that indicate systemic issues
    await this.checkSystemHealth();
  }

  /**
   * Categorize rejection based on error patterns
   */
  private categorizeRejection(reason: any, promise: Promise<any>): RejectionContext {
    const errorMessage = this.extractErrorMessage(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    
    // Find matching pattern
    const matchedPattern = this.REJECTION_PATTERNS.find(pattern => {
      if (pattern.pattern instanceof RegExp) {
        return pattern.pattern.test(errorMessage);
      }
      return errorMessage.toLowerCase().includes(pattern.pattern.toLowerCase());
    });

    const category = matchedPattern?.category || RejectionCategory.UNKNOWN_ERROR;
    const action = matchedPattern?.action || RecoveryAction.CONTINUE;

    // Extract component information from stack trace
    const component = this.extractComponent(stack);

    return {
      category,
      action,
      reason,
      promise,
      stack,
      timestamp: Date.now(),
      component,
      recoveryAttempts: 0,
      metadata: {
        errorMessage,
        matchedPattern: matchedPattern?.description,
        rejectionCount: this.rejectionCount
      }
    };
  }

  /**
   * Execute appropriate recovery action
   */
  private async executeRecoveryAction(context: RejectionContext): Promise<void> {
    const actionKey = `${context.category}:${context.component || 'unknown'}`;

    switch (context.action) {
      case RecoveryAction.CONTINUE:
        logger.warn(`🔄 Continuing after ${context.category} rejection in ${context.component}`);
        break;

      case RecoveryAction.RETRY:
        const retryCount = this.retryAttempts.get(actionKey) || 0;
        const pattern = this.REJECTION_PATTERNS.find(p => p.category === context.category);
        
        if (retryCount < (pattern?.maxRetries || 3)) {
          this.retryAttempts.set(actionKey, retryCount + 1);
          logger.info(`🔄 Scheduling retry ${retryCount + 1} for ${context.category} in ${pattern?.cooldownMs || 5000}ms`);
          
          // Implement exponential backoff
          const delay = (pattern?.cooldownMs || 5000) * Math.pow(2, retryCount);
          setTimeout(() => {
            this.emit('retry', context);
          }, delay);
        } else {
          logger.error(`❌ Max retries exceeded for ${context.category}, degrading service`);
          await this.executeRecoveryAction({ ...context, action: RecoveryAction.GRACEFUL_DEGRADATION });
        }
        break;

      case RecoveryAction.GRACEFUL_DEGRADATION:
        if (context.component) {
          this.componentHealth.set(context.component, false);
          logger.warn(`⚠️ Component ${context.component} marked as degraded due to ${context.category}`);
          this.emit('component:degraded', { component: context.component, reason: context.category });
        }
        break;

      case RecoveryAction.CONTROLLED_SHUTDOWN:
        logger.error(`🛑 Initiating controlled shutdown due to ${context.category}`);
        await this.initiateControlledShutdown(context);
        break;

      case RecoveryAction.IMMEDIATE_EXIT:
        logger.error(`💀 Critical error detected: ${context.category} - Immediate exit required`);
        await this.emergencyExit(context);
        break;
    }
  }

  /**
   * Check overall system health based on rejection patterns
   */
  private async checkSystemHealth(): Promise<void> {
    const recentRejections = this.rejectionHistory.filter(
      r => Date.now() - r.timestamp < 60000 // Last minute
    );

    if (recentRejections.length > 10) {
      logger.error(`🚨 System health critical: ${recentRejections.length} rejections in last minute`);
      this.emit('system:critical', { recentRejections: recentRejections.length });
      
      // If too many critical errors, force shutdown
      const criticalErrors = recentRejections.filter(
        r => r.action === RecoveryAction.IMMEDIATE_EXIT || r.action === RecoveryAction.CONTROLLED_SHUTDOWN
      );
      
      if (criticalErrors.length > 3) {
        await this.initiateControlledShutdown({
          category: RejectionCategory.UNKNOWN_ERROR,
          action: RecoveryAction.CONTROLLED_SHUTDOWN,
          reason: 'Multiple critical rejections detected',
          promise: Promise.resolve(),
          timestamp: Date.now(),
          metadata: { criticalErrorCount: criticalErrors.length }
        });
      }
    }
  }

  /**
   * Initiate controlled shutdown with cleanup
   */
  private async initiateControlledShutdown(context: RejectionContext): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.error('🛑 Initiating controlled shutdown...');

    try {
      // Emit shutdown event for cleanup
      this.emit('system:shutdown', context);

      // Give components 5 seconds to clean up
      await new Promise(resolve => setTimeout(resolve, 5000));

      logger.info('✅ Controlled shutdown completed');
      process.exit(1);
    } catch (shutdownError) {
      logger.error('💀 Error during controlled shutdown:', shutdownError);
      process.exit(1);
    }
  }

  /**
   * Emergency exit for critical errors
   */
  private async emergencyExit(context: RejectionContext): Promise<void> {
    console.error('💀 EMERGENCY EXIT - CRITICAL SYSTEM ERROR');
    console.error('Context:', {
      category: context.category,
      reason: context.reason,
      component: context.component,
      timestamp: new Date(context.timestamp).toISOString()
    });
    
    // Minimal cleanup attempt
    try {
      this.emit('system:emergency', context);
      // Give 1 second for emergency cleanup
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, 1000)),
        this.performEmergencyCleanup()
      ]);
    } finally {
      process.exit(1);
    }
  }

  /**
   * Perform minimal emergency cleanup
   */
  private async performEmergencyCleanup(): Promise<void> {
    // Close any open file descriptors, database connections, etc.
    // This should be implemented based on specific system resources
    logger.info('🧹 Emergency cleanup initiated');
  }

  /**
   * Extract meaningful error message from various error types
   */
  private extractErrorMessage(reason: any): string {
    if (reason instanceof Error) {
      return reason.message;
    }
    if (typeof reason === 'string') {
      return reason;
    }
    if (reason && typeof reason === 'object') {
      return reason.message || reason.error || JSON.stringify(reason);
    }
    return String(reason);
  }

  /**
   * Extract component name from stack trace
   */
  private extractComponent(stack?: string): string | undefined {
    if (!stack) return undefined;

    // Look for file patterns to identify components
    const patterns = [
      /\/mcp-servers\/([^\/]+)\//,
      /\/providers\/([^\/]+)\//,
      /\/tools\/([^\/]+)\//,
      /\/core\/([^\/]+)\//,
      /\/infrastructure\/([^\/]+)\//,
      /\/application\/([^\/]+)\//
    ];

    for (const pattern of patterns) {
      const match = stack.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Log rejection with appropriate severity and context
   */
  private logRejection(context: RejectionContext): void {
    const logData = {
      category: context.category,
      action: context.action,
      component: context.component,
      rejectionCount: this.rejectionCount,
      totalRejections: this.rejectionHistory.length,
      timestamp: new Date(context.timestamp).toISOString(),
      errorMessage: this.extractErrorMessage(context.reason)
    };

    switch (context.action) {
      case RecoveryAction.IMMEDIATE_EXIT:
      case RecoveryAction.CONTROLLED_SHUTDOWN:
        logger.error('🚨 CRITICAL UNHANDLED REJECTION:', logData);
        break;
      case RecoveryAction.GRACEFUL_DEGRADATION:
        logger.error('⚠️ DEGRADING SERVICE DUE TO REJECTION:', logData);
        break;
      case RecoveryAction.RETRY:
        logger.warn('🔄 RETRYABLE REJECTION DETECTED:', logData);
        break;
      default:
        logger.info('ℹ️ HANDLED REJECTION:', logData);
    }

    // Also log stack trace for debugging if available
    if (context.stack && getConfig().debugMode) {
      logger.debug('Stack trace:', context.stack);
    }
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): object {
    const recentRejections = this.rejectionHistory.filter(
      r => Date.now() - r.timestamp < 300000 // Last 5 minutes
    );

    const categoryCounts = recentRejections.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const degradedComponents = Array.from(this.componentHealth.entries())
      .filter(([, healthy]) => !healthy)
      .map(([component]) => component);

    return {
      totalRejections: this.rejectionCount,
      recentRejections: recentRejections.length,
      categoryBreakdown: categoryCounts,
      degradedComponents,
      systemHealth: degradedComponents.length === 0 ? 'healthy' : 'degraded',
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Reset component health (for testing or manual recovery)
   */
  resetComponentHealth(component?: string): void {
    if (component) {
      this.componentHealth.set(component, true);
      this.retryAttempts.delete(component);
      logger.info(`🔄 Component ${component} health reset`);
    } else {
      this.componentHealth.clear();
      this.retryAttempts.clear();
      logger.info('🔄 All component health reset');
    }
  }
}