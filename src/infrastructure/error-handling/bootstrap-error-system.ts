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
import {
  ErrorCategory,
  ErrorFactory,
  ErrorSeverity,
  StructuredError,
} from './structured-error-system.js';
import chalk from 'chalk';

export enum BootstrapPhase {
  VALIDATION = 'validation',
  DEPENDENCY_CHECK = 'dependency_check',
  CONFIGURATION = 'configuration',
  SERVICE_INITIALIZATION = 'service_initialization',
  SECURITY_SETUP = 'security_setup',
  PROVIDER_CONNECTION = 'provider_connection',
  TOOL_REGISTRATION = 'tool_registration',
  READY_CHECK = 'ready_check',
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
  VERSION_MISMATCH = 'version_mismatch',
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
  environment?: Record<string, unknown>;
}

export class BootstrapErrorSystem {
  private static instance: BootstrapErrorSystem;
  private readonly errorHistory: Map<string, BootstrapError[]> = new Map();

  public static getInstance(): BootstrapErrorSystem {
    BootstrapErrorSystem.instance = new BootstrapErrorSystem();
    return BootstrapErrorSystem.instance;
  }

  /**
   * Create a bootstrap-specific error with enhanced context
   */
  public createBootstrapError(
    message: string,
    phase: BootstrapPhase,
    errorType: BootstrapErrorType,
    component: string,
    options: Readonly<{
      originalError?: Error;
      context?: Readonly<BootstrapContext>;
      requirements?: string[];
      actionPlan?: string[];
      fallbackOptions?: string[];
      estimatedRecoveryTime?: number;
    }> = {}
  ): BootstrapError {
    const baseError = ErrorFactory.createError(
      message,
      ErrorCategory.SYSTEM,
      this.getErrorSeverity(errorType, phase),
      {
        context: options.context ? { ...options.context } : undefined,
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
      requirements: options.requirements ?? this.getDefaultRequirements(errorType, phase),
      actionPlan: options.actionPlan ?? this.generateActionPlan(errorType, phase, component),
      fallbackOptions: options.fallbackOptions ?? this.getFallbackOptions(errorType, phase),
      estimatedRecoveryTime: options.estimatedRecoveryTime ?? this.estimateRecoveryTime(errorType),
    };

    this.recordError(bootstrapError);
    return bootstrapError;
  }

  /**
   * Record a bootstrap error in the error history.
   */
  private recordError(error: BootstrapError): void {
    const key = `${error.phase}:${error.component}`;
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }
    const errors = this.errorHistory.get(key);
    if (errors) {
      errors.push(error);
    }
    logger.error(`Bootstrap Error in ${error.phase}:${error.component}: ${error.message}`);
  }

  /**
   * Handle bootstrap error with appropriate response strategy
   */
  public async handleBootstrapError(
    error: Readonly<BootstrapError>,
    context?: Readonly<BootstrapContext>
  ): Promise<{ canContinue: boolean; degraded: boolean; retryAfter?: number }> {
    logger.error(
      `Bootstrap Error in ${error.phase}:${error.component} [${error.severity}]: ${error.message}`
    );

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
        retryAfter: error.estimatedRecoveryTime,
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
      error.requirements.forEach(req => {
        console.log(chalk.yellow(`  • ${req}`));
      });
    }

    if (error.actionPlan && error.actionPlan.length > 0) {
      console.log('');
      console.log(chalk.cyan.bold('🔧 Action Plan:'));
      error.actionPlan.forEach((action, index) => {
        console.log(chalk.cyan(`  ${index + 1}. ${action}`));
      });
    }

    if (error.fallbackOptions && error.fallbackOptions.length > 0) {
      console.log('');
      console.log(chalk.blue.bold('🔄 Fallback Options:'));
      error.fallbackOptions.forEach(option => {
        console.log(chalk.blue(`  • ${option}`));
      });
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
        'Check system permissions for dependency access',
      ],
      [BootstrapErrorType.INVALID_CONFIG]: [
        `Validate ${component} configuration file syntax`,
        'Check for required configuration fields',
        'Verify configuration values are within acceptable ranges',
        'Reset to default configuration if corrupted',
      ],
      [BootstrapErrorType.PERMISSION_DENIED]: [
        `Check file/directory permissions for ${component}`,
        'Ensure current user has appropriate access rights',
        'Try running with elevated privileges if necessary',
        'Verify ownership of configuration and data directories',
      ],
      [BootstrapErrorType.SERVICE_UNAVAILABLE]: [
        `Check if ${component} service is running`,
        'Verify network connectivity to service endpoints',
        'Check service health status and logs',
        'Try restarting the service or switching to backup endpoint',
      ],
      [BootstrapErrorType.TIMEOUT]: [
        `Increase timeout values for ${component} operations`,
        'Check network latency and connection stability',
        'Verify system resources are not exhausted',
        'Try initializing with reduced concurrency',
      ],
      [BootstrapErrorType.NETWORK_ERROR]: [
        'Check internet connectivity and DNS resolution',
        `Verify ${component} endpoint URLs are accessible`,
        'Check firewall and proxy settings',
        'Try using alternative network interface or endpoint',
      ],
      [BootstrapErrorType.AUTHENTICATION_FAILED]: [
        `Verify ${component} credentials are correct and not expired`,
        'Check API keys, tokens, or certificate validity',
        'Ensure authentication service is accessible',
        'Try regenerating credentials if possible',
      ],
      [BootstrapErrorType.RESOURCE_CONSTRAINT]: [
        'Check available system memory and disk space',
        `Reduce ${component} resource requirements if possible`,
        'Close unnecessary processes to free resources',
        'Consider upgrading system resources',
      ],
      [BootstrapErrorType.CORRUPTION]: [
        `Backup and recreate ${component} data/configuration`,
        'Check file system integrity',
        'Restore from known good backup if available',
        'Reinstall component if corruption is extensive',
      ],
      [BootstrapErrorType.VERSION_MISMATCH]: [
        `Update ${component} to compatible version`,
        'Check version compatibility matrix',
        'Consider downgrading if newer version is incompatible',
        'Update all related components to matching versions',
      ],
    };

    return (
      plans[errorType] || [
        `Investigate ${component} specific documentation`,
        'Check system logs for additional error details',
        'Try restarting the application',
        'Contact support with error details',
      ]
    );
  }

  /**
   * Get fallback options for different error scenarios
   */
  private getFallbackOptions(errorType: BootstrapErrorType, phase: BootstrapPhase): string[] {
    const fallbacks: Record<BootstrapPhase, string[]> = {
      [BootstrapPhase.VALIDATION]: [
        'Continue with basic validation only',
        'Skip optional validations',
      ],
      [BootstrapPhase.DEPENDENCY_CHECK]: [
        'Continue without optional dependencies',
        'Use built-in alternatives where available',
      ],
      [BootstrapPhase.CONFIGURATION]: [
        'Use default configuration values',
        'Continue with minimal configuration',
      ],
      [BootstrapPhase.SERVICE_INITIALIZATION]: [
        'Initialize in single-service mode',
        'Skip non-essential services',
      ],
      [BootstrapPhase.SECURITY_SETUP]: [
        'Continue with basic security only',
        'Defer advanced security features',
      ],
      [BootstrapPhase.PROVIDER_CONNECTION]: [
        'Use local providers only',
        'Continue with cached/offline data',
      ],
      [BootstrapPhase.TOOL_REGISTRATION]: [
        'Continue with core tools only',
        'Skip external tool integrations',
      ],
      [BootstrapPhase.READY_CHECK]: [
        'Continue with warnings about incomplete setup',
        'Retry ready check after manual intervention',
      ],
    };

    return fallbacks[phase] || ['Continue with reduced functionality'];
  }

  /**
   * Determine error severity based on type and phase
   */
  private getErrorSeverity(errorType: BootstrapErrorType, phase: BootstrapPhase): ErrorSeverity {
    const criticalErrors = [BootstrapErrorType.CORRUPTION, BootstrapErrorType.PERMISSION_DENIED];

    const criticalPhases = [BootstrapPhase.VALIDATION, BootstrapPhase.SECURITY_SETUP];

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
  private isRecoverable(errorType: BootstrapErrorType, _phase: BootstrapPhase): boolean {
    const unrecoverableErrors = [
      BootstrapErrorType.VERSION_MISMATCH,
      BootstrapErrorType.CORRUPTION,
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
      BootstrapErrorType.RESOURCE_CONSTRAINT,
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
      [BootstrapErrorType.VERSION_MISMATCH]: 120000,
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
      canDegrade:
        error.phase !== BootstrapPhase.VALIDATION && error.phase !== BootstrapPhase.SECURITY_SETUP,
      shouldRetry: error.retryable && retryAttempts < maxRetries,
    };
  }

  /**
   * Attempt automatic recovery from error
   */
  private async attemptRecovery(
    error: Readonly<BootstrapError>,
    _context?: Readonly<BootstrapContext>
  ): Promise<boolean> {
    logger.info(`Attempting recovery for ${error.component} error`);

    // Real recovery implementation using environment/context hints and system checks
    // Uses dynamic imports of Node built-ins to avoid adding new top-level imports
    const os = await import('os');
    const fs = await import('fs/promises');
    const childProcess = await import('child_process');
    const util = await import('util');
    const http = await import('http');
    const https = await import('https');

    const exec = util.promisify(childProcess.exec);

    const platform = os.platform();
    const env = (_context as BootstrapContext | undefined)?.environment ?? {};
    const endpoint = env.endpoint as string | undefined;
    const configPath = env.configPath as string | undefined;
    const dependencyCommand = env.dependencyCommand as string | undefined;
    const credentials = env.credentials as Record<string, unknown> | undefined;
    const refreshUrl = env.refreshUrl as string | undefined;

    logger.info(`Recovery strategy for ${error.errorType} on ${error.component}`);

    // Helper: simple HTTP GET with timeout
    const httpGet = async (
      url: string,
      timeoutMs = 5000
    ): Promise<{ status: number; body: string }> =>
      new Promise((resolve, reject) => {
        try {
          const lib = url.startsWith('https') ? https : http;
          const req = lib.get(
            url,
            { timeout: timeoutMs },
            (res: Readonly<import('http').IncomingMessage>) => {
              const chunks: Buffer[] = [];
              res.on('data', (c: Readonly<Buffer>) => chunks.push(Buffer.from(c)));
              res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                resolve({ status: res.statusCode ?? 0, body });
              });
            }
          );
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('timeout'));
          });
        } catch (err) {
          reject(err);
        }
      });

    // Helper: exponential backoff loop
    const withRetries = async <T>(
      attempts: number,
      fn: (attempt: number) => Promise<T>,
      baseDelay = 500
    ): Promise<T> => {
      let lastError: unknown;
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn(i + 1);
        } catch (err) {
          lastError = err;
          const delay = baseDelay * Math.pow(2, i);
          logger.warn(
            `Attempt ${i + 1} failed, retrying after ${delay}ms: ${(err as Error).message}`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      throw lastError;
    };

    try {
      switch (error.errorType) {
        case BootstrapErrorType.MISSING_DEPENDENCY: {
          // Try to locate the binary using which/where or explicit command from context
          const cmd = dependencyCommand ?? error.component;
          const probe = platform.startsWith('win') ? `where ${cmd}` : `which ${cmd}`;
          try {
            const { stdout } = await exec(probe);
            if (stdout && stdout.trim().length > 0) {
              logger.info(`Dependency ${cmd} found: ${stdout.trim()}`);
              return true;
            }
          } catch (e) {
            logger.warn(`Dependency probe failed: ${(e as Error).message}`);
            // As a fallback, scan PATH entries for an executable
            const PATH = (process.env.PATH ?? '').split(platform.startsWith('win') ? ';' : ':');
            for (const p of PATH) {
              try {
                const candidate = `${p}${platform.startsWith('win') ? '\\' : '/'}${cmd}`;
                await fs.access(candidate);
                logger.info(`Found dependency at ${candidate}`);
                return true;
              } catch {
                // continue
              }
            }
          }
          logger.error(`Missing dependency ${cmd} could not be found`);
          return false;
        }

        case BootstrapErrorType.INVALID_CONFIG: {
          if (!configPath) {
            logger.warn('No configPath provided in context; cannot auto-validate configuration');
            return false;
          }
          try {
            const file = await fs.readFile(configPath, 'utf8');
            try {
              // Try JSON parse first
              JSON.parse(file);
              logger.info(`Configuration at ${configPath} validated as JSON`);
              return true;
            } catch {
              // If not JSON, attempt to detect common formats (very basic YAML check)
              if (file.includes(':') && file.includes('\n')) {
                logger.info(
                  `Configuration at ${configPath} appears to be YAML/plain and was read successfully`
                );
                return true;
              }
              throw new Error('Unknown configuration format');
            }
          } catch (err) {
            logger.error(`Failed to validate configuration: ${(err as Error).message}`);
            return false;
          }
        }

        case BootstrapErrorType.PERMISSION_DENIED: {
          // Attempt to check access and adjust permissions for the provided path in environment
          const targetPath = env.path as string | undefined;
          if (!targetPath) {
            logger.warn('No path provided in environment to fix permissions');
            return false;
          }
          try {
            await fs.access(targetPath);
            logger.info(`Path ${targetPath} is accessible after initial check`);
            return true;
          } catch {
            // Try to chmod to a permissive mode if current user owns the file
            try {
              // Conservative permission change: owner read/write/execute
              await fs.chmod(targetPath, 0o700);
              // re-check
              await fs.access(targetPath);
              logger.info(`Adjusted permissions on ${targetPath} and access succeeded`);
              return true;
            } catch (err) {
              logger.error(
                `Failed to adjust permissions on ${targetPath}: ${(err as Error).message}`
              );
              return false;
            }
          }
        }

        case BootstrapErrorType.SERVICE_UNAVAILABLE:
        case BootstrapErrorType.NETWORK_ERROR:
        case BootstrapErrorType.TIMEOUT: {
          if (!endpoint) {
            logger.warn('No endpoint provided in context to check network/service health');
            return false;
          }

          // Try HTTP GET with retries
          try {
            const resp = await withRetries(
              3,
              async () => {
                const r = await httpGet(
                  endpoint,
                  Math.max(5000, error.estimatedRecoveryTime ?? 5000)
                );
                if (r.status >= 500) throw new Error(`Server error ${r.status}`);
                return r;
              },
              1000
            );
            logger.info(`Endpoint ${endpoint} responded with status ${resp.status}`);
            return resp.status >= 200 && resp.status < 500;
          } catch (err) {
            logger.error(`Endpoint ${endpoint} check failed: ${(err as Error).message}`);
            // Try DNS resolution as a lower-level check
            try {
              const dns = await import('dns');
              const resolve = util.promisify(dns.resolve);
              const host = new URL(endpoint).hostname;
              await resolve(host);
              logger.info(`DNS resolution for ${host} succeeded but HTTP checks failed`);
            } catch {
              logger.warn('DNS resolution failed or not available');
            }
            return false;
          }
        }

        case BootstrapErrorType.AUTHENTICATION_FAILED: {
          // If a refresh endpoint is provided, attempt to refresh credentials
          if (refreshUrl && credentials && typeof credentials.refreshToken === 'string') {
            try {
              const payload = JSON.stringify({ refreshToken: credentials.refreshToken });
              const parsed = new URL(refreshUrl);
              const lib = parsed.protocol === 'https:' ? https : http;

              const result = await new Promise<{ status: number; body: string }>(
                (resolve, reject) => {
                  const req = lib.request(
                    parsed,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                      },
                      timeout: 5000,
                    },
                    (res: import('http').IncomingMessage) => {
                      const parts: Buffer[] = [];
                      res.on('data', (d: Buffer) => {
                        parts.push(Buffer.from(d));
                      });
                      res.on('end', () => {
                        resolve({
                          status: res.statusCode ?? 0,
                          body: Buffer.concat(parts).toString('utf8'),
                        });
                      });
                    }
                  );
                  req.on('error', reject);
                  req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('timeout'));
                  });
                  req.write(payload);
                  req.end();
                }
              );

              const body = JSON.parse(result.body) as { token?: string };
              if (typeof body.token === 'string') {
                env.credentials = { ...(env.credentials as object), token: body.token };
                logger.info('Updated in-memory credentials from refresh response');
                return true;
              }
              logger.error(`Credential refresh failed: HTTP ${result.status}`);
              return false;
            } catch (err) {
              logger.error(`Credential refresh error: ${(err as Error).message}`);
              return false;
            }
          }

          logger.warn(
            'No refresh mechanism available in context; cannot recover authentication automatically'
          );
          return false;
        }

        case BootstrapErrorType.RESOURCE_CONSTRAINT: {
          // Check memory and attempt to trigger GC if available, then re-evaluate
          const freeMem = os.freemem();
          const totalMem = os.totalmem();
          logger.info(`System memory: free=${freeMem}, total=${totalMem}`);
          const threshold = Math.min(200 * 1024 * 1024, Math.floor(totalMem * 0.05)); // 200MB or 5% of total
          if (freeMem > threshold) {
            const globalWithGC = global as typeof global & { gc?: () => void };
            if (typeof globalWithGC.gc === 'function') {
              try {
                logger.info('Triggering V8 garbage collection to free memory');
                globalWithGC.gc();
                await new Promise(res => setTimeout(res, 500));
                const newFree = os.freemem();
                logger.info(`Free memory after GC: ${newFree}`);
                if (newFree > threshold) return true;
              } catch (err) {
                logger.warn(`GC invocation failed: ${(err as Error).message}`);
              }
            }
          }

          // As last resort, attempt to clean temp directory if provided
          const tmpDir = env.tmpDir as string | undefined;
          if (tmpDir) {
            try {
              const entries = await fs.readdir(tmpDir);
              // remove files older than 1 hour (best-effort)
              const cutoff = Date.now() - 1000 * 60 * 60;
              for (const name of entries) {
                try {
                  const p = `${tmpDir}${platform.startsWith('win') ? '\\' : '/'}${name}`;
                  const stat = await fs.stat(p);
                  if (stat.mtimeMs < cutoff && stat.isFile()) {
                    await fs.unlink(p);
                    logger.info(`Removed stale temp file ${p}`);
                  }
                } catch {
                  // continue best-effort
                }
              }
              // re-check memory
              if (os.freemem() > threshold) return true;
            } catch {
              // ignore
            }
          }

          logger.error('Resource constraint recovery attempts failed');
          return false;
        }

        case BootstrapErrorType.CORRUPTION:
        case BootstrapErrorType.VERSION_MISMATCH: {
          // Treated as non-recoverable by default
          logger.error(`${error.errorType} is considered non-recoverable automatically`);
          return false;
        }

        default: {
          // Generic recovery: attempt sequential actionPlan items where possible
          const plan = error.actionPlan ?? [];
          for (const step of plan) {
            // Perform a few heuristic actions based on step text
            const s = step.toLowerCase();
            try {
              if (s.includes('restart') && env.serviceName) {
                // Try to restart a service using systemctl (POSIX) or sc (Windows) as a best-effort
                const svc = env.serviceName as string;
                if (!platform.startsWith('win')) {
                  await exec(`systemctl restart ${svc}`);
                  logger.info(`Issued systemctl restart ${svc}`);
                } else {
                  await exec(`sc stop ${svc} && sc start ${svc}`);
                  logger.info(`Issued windows service restart for ${svc}`);
                }
                // wait briefly for service to come up
                await new Promise(res => setTimeout(res, 1500));
                // If endpoint exists, probe it
                if (endpoint) {
                  try {
                    const r = await httpGet(endpoint, 3000);
                    if (r.status >= 200 && r.status < 500) return true;
                  } catch {
                    // continue
                  }
                }
              } else if (s.includes('reinstall') && dependencyCommand) {
                // Try reinstall via package manager hints (best-effort, only if command looks like a package)
                if (platform.startsWith('win')) {
                  // No-op: cannot safely guess reinstall command
                  logger.warn('Skipping automatic reinstall on Windows without explicit command');
                } else {
                  // try apt/yum/brew heuristics
                  try {
                    if (
                      await exec('command -v apt-get')
                        .then(() => true)
                        .catch(() => false)
                    ) {
                      await exec(`sudo apt-get install --reinstall -y ${dependencyCommand}`);
                      logger.info(`Reinstalled ${dependencyCommand} via apt-get`);
                    } else if (
                      await exec('command -v yum')
                        .then(() => true)
                        .catch(() => false)
                    ) {
                      await exec(`sudo yum reinstall -y ${dependencyCommand}`);
                      logger.info(`Reinstalled ${dependencyCommand} via yum`);
                    } else if (
                      await exec('command -v brew')
                        .then(() => true)
                        .catch(() => false)
                    ) {
                      await exec(`brew reinstall ${dependencyCommand}`);
                      logger.info(`Reinstalled ${dependencyCommand} via brew`);
                    } else {
                      logger.warn('No known package manager found to attempt reinstall');
                    }
                  } catch (err) {
                    logger.warn(`Reinstall attempt failed: ${(err as Error).message}`);
                  }
                }
              } else if (s.includes('validate') && configPath) {
                // Re-validate config
                try {
                  const file = await fs.readFile(configPath, 'utf8');
                  JSON.parse(file);
                  logger.info('Re-validation of configuration succeeded');
                  return true;
                } catch {
                  // continue
                }
              }
            } catch (err) {
              logger.warn(`Action plan step failed: ${(err as Error).message}`);
            }
          }

          logger.warn('No generic recovery succeeded for unknown error type');
          return false;
        }
      }
    } catch (err) {
      logger.error(`Recovery flow encountered an error: ${(err as Error).message}`);
      return false;
    }
  }
}
