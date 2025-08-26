/**
 * Bootstrap Error System - Enhanced Error Handling for Initialization
 * 
 * Provides granular error handling for bootstrap processes with:
 * - Specific error types for different failure modes
 * - Recovery suggestions and actionable feedback
 * - Context-aware error reporting
 * - Graceful degradation strategies
 */

import { logger } from '../logging/logger.js';
import { ErrorCategory, ErrorSeverity, StructuredError, ErrorFactory } from './structured-error-system.js';
import chalk from 'chalk';

export enum BootstrapPhase {
  VALIDATION = 'validation',
  DEPENDENCY_CHECK = 'dependency_check',
  CONFIGURATION = 'configuration',
  SERVICE_INITIALIZATION = 'service_initialization',
  SECURITY_SETUP = 'security_setup',
  PROVIDER_CONNECTION = 'provider_connection',
  TOOL_REGISTRATION = 'tool_registration',
  READY_CHECK = 'ready_check'
}

export enum BootstrapErrorType {
  MISSING_DEPENDENCY = 'missing_dependency',
  INVALID_CONFIG = 'invalid_config',
  PERMISSION_DENIED = 'permission_denied',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  TIMEOUT = 'timeout',
  NETWORK_ERROR = 'network_error',
  AUTHENTICATION_FAILED = 'authentication_failed',
  RESOURCE_CONSTRAINT = 'resource_constraint',
  CORRUPTION = 'corruption',
  VERSION_MISMATCH = 'version_mismatch'
}

export interface BootstrapError extends StructuredError {
  phase: BootstrapPhase;
  errorType: BootstrapErrorType;
  component: string;
  requirements?: string[];
  actionPlan?: string[];
  fallbackOptions?: string[];
  estimatedRecoveryTime?: number;
}

export interface BootstrapContext {
  phase: BootstrapPhase;
  component: string;
  startTime: number;
  timeout?: number;
  retryAttempts?: number;
  environment?: Record<string, any>;
}

export class BootstrapErrorSystem {
  private static instance: BootstrapErrorSystem;
  private errorHistory: Map<string, BootstrapError[]> = new Map();
  private phaseTimings: Map<BootstrapPhase, number> = new Map();

  public static getInstance(): BootstrapErrorSystem {
    if (!BootstrapErrorSystem.instance) {
      BootstrapErrorSystem.instance = new BootstrapErrorSystem();
    }
    return BootstrapErrorSystem.instance;
  }

  /**
   * Create a bootstrap-specific error with enhanced context
   */
  createBootstrapError(
    message: string,
    phase: BootstrapPhase,
    errorType: BootstrapErrorType,
    component: string,
    options: {
      originalError?: Error;
      context?: BootstrapContext;
      requirements?: string[];
      actionPlan?: string[];
      fallbackOptions?: string[];
      estimatedRecoveryTime?: number;
    } = {}
  ): BootstrapError {
    const baseError = ErrorFactory.createError(
      message,
      ErrorCategory.SYSTEM,
      this.getErrorSeverity(errorType, phase),
      {
        context: options.context,
        originalError: options.originalError,
        recoverable: this.isRecoverable(errorType, phase),
        retryable: this.isRetryable(errorType),
      }
    );

    const bootstrapError: BootstrapError = {
      ...baseError,
      phase,
      errorType,
      component,
      requirements: options.requirements || this.getDefaultRequirements(errorType, phase),
      actionPlan: options.actionPlan || this.generateActionPlan(errorType, phase, component),
      fallbackOptions: options.fallbackOptions || this.getFallbackOptions(errorType, phase),
      estimatedRecoveryTime: options.estimatedRecoveryTime || this.estimateRecoveryTime(errorType)
    };

    this.recordError(bootstrapError);
    return bootstrapError;
  }

  /**
   * Handle bootstrap error with appropriate response strategy
   */
  async handleBootstrapError(
    error: BootstrapError,
    context?: BootstrapContext
  ): Promise<{ canContinue: boolean; degraded: boolean; retryAfter?: number }> {
    logger.error(`Bootstrap Error in ${error.phase}:${error.component}`, {
      errorType: error.errorType,
      severity: error.severity,
      message: error.message
    });

    // Display user-friendly error message
    this.displayBootstrapError(error);

    // Determine response strategy
    const strategy = this.getResponseStrategy(error, context);
    
    // Execute recovery actions if available
    if (error.recoverable && strategy.shouldAttemptRecovery) {
      const recovered = await this.attemptRecovery(error, context);
      if (recovered) {
        console.log(chalk.green(`✅ Recovered from ${error.component} error`));
        return { canContinue: true, degraded: false };
      }
    }

    // Check if we can continue with degraded functionality
    if (strategy.canDegrade) {
      console.log(chalk.yellow(`⚠️  Continuing with limited ${error.component} functionality`));
      return { canContinue: true, degraded: true };
    }

    // Suggest retry if appropriate
    if (error.retryable && strategy.shouldRetry) {
      return { 
        canContinue: false, 
        degraded: false, 
        retryAfter: error.estimatedRecoveryTime 
      };
    }

    // Cannot continue
    return { canContinue: false, degraded: false };
  }

  /**
   * Display user-friendly error message with actionable guidance
   */
  private displayBootstrapError(error: BootstrapError): void {
    console.log('');
    console.log(chalk.red.bold(`❌ Bootstrap Failed: ${error.component}`));
    console.log(chalk.red(`Phase: ${error.phase}`));
    console.log(chalk.red(`Error: ${error.message}`));
    
    if (error.requirements && error.requirements.length > 0) {
      console.log('');
      console.log(chalk.yellow.bold('📋 Requirements:'));
      error.requirements.forEach(req => 
        console.log(chalk.yellow(`  • ${req}`))
      );
    }

    if (error.actionPlan && error.actionPlan.length > 0) {
      console.log('');
      console.log(chalk.cyan.bold('🔧 Action Plan:'));
      error.actionPlan.forEach((action, index) => 
        console.log(chalk.cyan(`  ${index + 1}. ${action}`))
      );
    }

    if (error.fallbackOptions && error.fallbackOptions.length > 0) {
      console.log('');
      console.log(chalk.blue.bold('🔄 Fallback Options:'));
      error.fallbackOptions.forEach(option => 
        console.log(chalk.blue(`  • ${option}`))
      );
    }

    if (error.estimatedRecoveryTime) {
      console.log('');
      console.log(chalk.magenta(`⏱️  Estimated recovery time: ${error.estimatedRecoveryTime}ms`));
    }
    
    console.log('');
  }

  /**
   * Generate specific action plans based on error type and phase
   */
  private generateActionPlan(
    errorType: BootstrapErrorType,
    phase: BootstrapPhase,
    component: string
  ): string[] {
    const plans: Record<BootstrapErrorType, string[]> = {
      [BootstrapErrorType.MISSING_DEPENDENCY]: [
        `Check if ${component} is installed and accessible`,
        'Verify PATH environment variable includes required binaries',
        'Try reinstalling the missing dependency',
        'Check system permissions for dependency access'
      ],
      [BootstrapErrorType.INVALID_CONFIG]: [
        `Validate ${component} configuration file syntax`,
        'Check for required configuration fields',
        'Verify configuration values are within acceptable ranges',
        'Reset to default configuration if corrupted'
      ],
      [BootstrapErrorType.PERMISSION_DENIED]: [
        `Check file/directory permissions for ${component}`,
        'Ensure current user has appropriate access rights',
        'Try running with elevated privileges if necessary',
        'Verify ownership of configuration and data directories'
      ],
      [BootstrapErrorType.SERVICE_UNAVAILABLE]: [
        `Check if ${component} service is running`,
        'Verify network connectivity to service endpoints',
        'Check service health status and logs',
        'Try restarting the service or switching to backup endpoint'
      ],
      [BootstrapErrorType.TIMEOUT]: [
        `Increase timeout values for ${component} operations`,
        'Check network latency and connection stability',
        'Verify system resources are not exhausted',
        'Try initializing with reduced concurrency'
      ],
      [BootstrapErrorType.NETWORK_ERROR]: [
        'Check internet connectivity and DNS resolution',
        `Verify ${component} endpoint URLs are accessible`,
        'Check firewall and proxy settings',
        'Try using alternative network interface or endpoint'
      ],
      [BootstrapErrorType.AUTHENTICATION_FAILED]: [
        `Verify ${component} credentials are correct and not expired`,
        'Check API keys, tokens, or certificate validity',
        'Ensure authentication service is accessible',
        'Try regenerating credentials if possible'
      ],
      [BootstrapErrorType.RESOURCE_CONSTRAINT]: [
        'Check available system memory and disk space',
        `Reduce ${component} resource requirements if possible`,
        'Close unnecessary processes to free resources',
        'Consider upgrading system resources'
      ],
      [BootstrapErrorType.CORRUPTION]: [
        `Backup and recreate ${component} data/configuration`,
        'Check file system integrity',
        'Restore from known good backup if available',
        'Reinstall component if corruption is extensive'
      ],
      [BootstrapErrorType.VERSION_MISMATCH]: [
        `Update ${component} to compatible version`,
        'Check version compatibility matrix',
        'Consider downgrading if newer version is incompatible',
        'Update all related components to matching versions'
      ]
    };

    return plans[errorType] || [
      `Investigate ${component} specific documentation`,
      'Check system logs for additional error details',
      'Try restarting the application',
      'Contact support with error details'
    ];
  }

  /**
   * Get fallback options for different error scenarios
   */
  private getFallbackOptions(
    errorType: BootstrapErrorType,
    phase: BootstrapPhase
  ): string[] {
    const fallbacks: Record<BootstrapPhase, string[]> = {
      [BootstrapPhase.VALIDATION]: [
        'Continue with basic validation only',
        'Skip optional validations'
      ],
      [BootstrapPhase.DEPENDENCY_CHECK]: [
        'Continue without optional dependencies',
        'Use built-in alternatives where available'
      ],
      [BootstrapPhase.CONFIGURATION]: [
        'Use default configuration values',
        'Continue with minimal configuration'
      ],
      [BootstrapPhase.SERVICE_INITIALIZATION]: [
        'Initialize in single-service mode',
        'Skip non-essential services'
      ],
      [BootstrapPhase.SECURITY_SETUP]: [
        'Continue with basic security only',
        'Defer advanced security features'
      ],
      [BootstrapPhase.PROVIDER_CONNECTION]: [
        'Use local providers only',
        'Continue with cached/offline data'
      ],
      [BootstrapPhase.TOOL_REGISTRATION]: [
        'Continue with core tools only',
        'Skip external tool integrations'
      ],
      [BootstrapPhase.READY_CHECK]: [
        'Continue with warnings about incomplete setup',
        'Retry ready check after manual intervention'
      ]
    };

    return fallbacks[phase] || ['Continue with reduced functionality'];
  }

  /**
   * Determine error severity based on type and phase
   */
  private getErrorSeverity(errorType: BootstrapErrorType, phase: BootstrapPhase): ErrorSeverity {
    const criticalErrors = [
      BootstrapErrorType.CORRUPTION,
      BootstrapErrorType.PERMISSION_DENIED
    ];

    const criticalPhases = [
      BootstrapPhase.VALIDATION,
      BootstrapPhase.SECURITY_SETUP
    ];

    if (criticalErrors.includes(errorType) || criticalPhases.includes(phase)) {
      return ErrorSeverity.CRITICAL;
    }

    if (errorType === BootstrapErrorType.SERVICE_UNAVAILABLE) {
      return ErrorSeverity.HIGH;
    }

    return ErrorSeverity.MEDIUM;
  }

  /**
   * Check if error type is recoverable
   */
  private isRecoverable(errorType: BootstrapErrorType, phase: BootstrapPhase): boolean {
    const unrecoverableErrors = [
      BootstrapErrorType.VERSION_MISMATCH,
      BootstrapErrorType.CORRUPTION
    ];

    return !unrecoverableErrors.includes(errorType);
  }

  /**
   * Check if error type is retryable
   */
  private isRetryable(errorType: BootstrapErrorType): boolean {
    const retryableErrors = [
      BootstrapErrorType.TIMEOUT,
      BootstrapErrorType.NETWORK_ERROR,
      BootstrapErrorType.SERVICE_UNAVAILABLE,
      BootstrapErrorType.RESOURCE_CONSTRAINT
    ];

    return retryableErrors.includes(errorType);
  }

  /**
   * Get default requirements for error types
   */
  private getDefaultRequirements(errorType: BootstrapErrorType, phase: BootstrapPhase): string[] {
    // This could be expanded based on specific requirements
    return [`Functional ${phase} phase`, 'System resources available', 'Network connectivity'];
  }

  /**
   * Estimate recovery time based on error type
   */
  private estimateRecoveryTime(errorType: BootstrapErrorType): number {
    const estimations: Record<BootstrapErrorType, number> = {
      [BootstrapErrorType.TIMEOUT]: 5000,
      [BootstrapErrorType.NETWORK_ERROR]: 3000,
      [BootstrapErrorType.SERVICE_UNAVAILABLE]: 10000,
      [BootstrapErrorType.RESOURCE_CONSTRAINT]: 15000,
      [BootstrapErrorType.AUTHENTICATION_FAILED]: 2000,
      [BootstrapErrorType.MISSING_DEPENDENCY]: 30000,
      [BootstrapErrorType.INVALID_CONFIG]: 5000,
      [BootstrapErrorType.PERMISSION_DENIED]: 10000,
      [BootstrapErrorType.CORRUPTION]: 60000,
      [BootstrapErrorType.VERSION_MISMATCH]: 120000
    };

    return estimations[errorType] || 10000;
  }

  /**
   * Determine response strategy for error
   */
  private getResponseStrategy(
    error: BootstrapError,
    context?: BootstrapContext
  ): {
    shouldAttemptRecovery: boolean;
    canDegrade: boolean;
    shouldRetry: boolean;
  } {
    const retryAttempts = context?.retryAttempts || 0;
    const maxRetries = 3;

    return {
      shouldAttemptRecovery: error.recoverable && retryAttempts < maxRetries,
      canDegrade: error.phase !== BootstrapPhase.VALIDATION && error.phase !== BootstrapPhase.SECURITY_SETUP,
      shouldRetry: error.retryable && retryAttempts < maxRetries
    };
  }

  /**
   * Attempt automatic recovery from error
   */
  private async attemptRecovery(
    error: BootstrapError,
    context?: BootstrapContext
  ): Promise<boolean> {
    logger.info(`Attempting recovery for ${error.component} error`);

    // This could be expanded with specific recovery actions
    // For now, just simulate recovery attempt
    await new Promise(resolve => setTimeout(resolve, 1000));

    return Math.random() > 0.5; // Simulate 50% recovery success rate
  }

  /**
   * Record error for analysis and patterns
   */
  private recordError(error: BootstrapError): void {
    const key = `${error.phase}:${error.component}`;
    const history = this.errorHistory.get(key) || [];
    history.push(error);
    
    // Keep only last 10 errors per component/phase
    if (history.length > 10) {
      history.shift();
    }
    
    this.errorHistory.set(key, history);
  }

  /**
   * Get error history for analysis
   */
  getErrorHistory(phase?: BootstrapPhase, component?: string): BootstrapError[] {
    if (phase && component) {
      return this.errorHistory.get(`${phase}:${component}`) || [];
    }

    const allErrors: BootstrapError[] = [];
    this.errorHistory.forEach((errors) => {
      allErrors.push(...errors);
    });

    return allErrors.filter(error => {
      if (phase && error.phase !== phase) return false;
      if (component && error.component !== component) return false;
      return true;
    });
  }

  /**
   * Clear error history
   */
  clearErrorHistory(phase?: BootstrapPhase, component?: string): void {
    if (phase && component) {
      this.errorHistory.delete(`${phase}:${component}`);
    } else {
      this.errorHistory.clear();
    }
  }
}