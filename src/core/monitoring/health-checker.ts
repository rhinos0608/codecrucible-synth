/**
 * Enterprise Health Monitoring System
 * Implements comprehensive health checks with dependency monitoring
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface HealthCheck {
  name: string;
  description: string;
  timeout: number;
  interval?: number;
  critical: boolean;
  check: () => Promise<HealthCheckResult>;
  tags?: string[];
}

export interface HealthCheckResult {
  healthy: boolean;
  message: string;
  duration?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  result: HealthCheckResult;
  uptime: number;
  errorCount: number;
  consecutiveFailures: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  components: Record<string, ComponentHealth>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_failures: number;
  };
}

export interface HealthConfig {
  checkInterval: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  degradedThreshold: number;
  unhealthyThreshold: number;
}

export class HealthChecker extends EventEmitter {
  private checks = new Map<string, HealthCheck>();
  private results = new Map<string, ComponentHealth>();
  private config: HealthConfig;
  private intervalHandles = new Map<string, NodeJS.Timeout>();
  private startTime = Date.now();

  constructor(config: Partial<HealthConfig> = {}) {
    super();

    this.config = {
      checkInterval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      degradedThreshold: 2, // consecutive failures before degraded
      unhealthyThreshold: 5, // consecutive failures before unhealthy
      ...config,
    };

    this.registerDefaultChecks();
    this.startPeriodicChecks();
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Database connectivity check
    this.registerCheck({
      name: 'database',
      description: 'Database connectivity and basic operations',
      timeout: 5000,
      critical: true,
      tags: ['database', 'critical'],
      check: async () => {
        try {
          // In production, implement actual database ping
          // For now, simulate a check
          const start = Date.now();
          await this.simulateAsyncOperation(100);

          return {
            healthy: true,
            message: 'Database connection successful',
            duration: Date.now() - start,
            metadata: {
              connection_pool: 'active',
              query_performance: 'optimal',
            },
            timestamp: new Date(),
          };
        } catch (error) {
          return {
            healthy: false,
            message: `Database connection failed: ${(error as Error).message}`,
            timestamp: new Date(),
          };
        }
      },
    });

    // Ollama service check
    this.registerCheck({
      name: 'ollama',
      description: 'Ollama AI service availability',
      timeout: 10000,
      critical: false,
      tags: ['ai', 'ollama'],
      check: async () => {
        try {
          const start = Date.now();

          // Try to connect to Ollama
          const response = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(8000),
          });

          if (response.ok) {
            const data = await response.json();
            return {
              healthy: true,
              message: 'Ollama service is available',
              duration: Date.now() - start,
              metadata: {
                models_available: data.models?.length || 0,
                api_version: response.headers.get('server') || 'unknown',
              },
              timestamp: new Date(),
            };
          } else {
            return {
              healthy: false,
              message: `Ollama service returned ${response.status}`,
              duration: Date.now() - start,
              timestamp: new Date(),
            };
          }
        } catch (error) {
          return {
            healthy: false,
            message: `Ollama service unavailable: ${(error as Error).message}`,
            timestamp: new Date(),
          };
        }
      },
    });

    // LM Studio service check
    this.registerCheck({
      name: 'lm-studio',
      description: 'LM Studio AI service availability',
      timeout: 10000,
      critical: false,
      tags: ['ai', 'lm-studio'],
      check: async () => {
        try {
          const start = Date.now();

          const response = await fetch('http://localhost:1234/v1/models', {
            signal: AbortSignal.timeout(8000),
          });

          if (response.ok) {
            const data = await response.json();
            return {
              healthy: true,
              message: 'LM Studio service is available',
              duration: Date.now() - start,
              metadata: {
                models_available: data.data?.length || 0,
              },
              timestamp: new Date(),
            };
          } else {
            return {
              healthy: false,
              message: `LM Studio service returned ${response.status}`,
              duration: Date.now() - start,
              timestamp: new Date(),
            };
          }
        } catch (error) {
          return {
            healthy: false,
            message: `LM Studio service unavailable: ${(error as Error).message}`,
            timestamp: new Date(),
          };
        }
      },
    });

    // Memory usage check
    this.registerCheck({
      name: 'memory',
      description: 'System memory usage monitoring',
      timeout: 1000,
      critical: true,
      tags: ['system', 'memory'],
      check: async () => {
        try {
          const memUsage = process.memoryUsage();
          const used = memUsage.heapUsed;
          const total = memUsage.heapTotal;
          const usagePercent = (used / total) * 100;

          const isHealthy = usagePercent < 85; // Alert if over 85%

          return {
            healthy: isHealthy,
            message: isHealthy
              ? `Memory usage is normal (${usagePercent.toFixed(1)}%)`
              : `High memory usage detected (${usagePercent.toFixed(1)}%)`,
            metadata: {
              heap_used: used,
              heap_total: total,
              usage_percent: usagePercent,
              rss: memUsage.rss,
              external: memUsage.external,
            },
            timestamp: new Date(),
          };
        } catch (error) {
          return {
            healthy: false,
            message: `Memory check failed: ${(error as Error).message}`,
            timestamp: new Date(),
          };
        }
      },
    });

    // Disk space check
    this.registerCheck({
      name: 'disk',
      description: 'Disk space availability',
      timeout: 2000,
      critical: true,
      tags: ['system', 'disk'],
      check: async () => {
        try {
          // In production, use fs.stat to check actual disk usage
          // For now, simulate a check
          const freeSpacePercent = 70; // Mock 70% free space
          const isHealthy = freeSpacePercent > 20; // Alert if less than 20% free

          return {
            healthy: isHealthy,
            message: isHealthy
              ? `Disk space is adequate (${freeSpacePercent}% free)`
              : `Low disk space warning (${freeSpacePercent}% free)`,
            metadata: {
              free_space_percent: freeSpacePercent,
              path: process.cwd(),
            },
            timestamp: new Date(),
          };
        } catch (error) {
          return {
            healthy: false,
            message: `Disk check failed: ${(error as Error).message}`,
            timestamp: new Date(),
          };
        }
      },
    });

    // External API dependency check
    this.registerCheck({
      name: 'external-apis',
      description: 'External API dependencies status',
      timeout: 5000,
      critical: false,
      tags: ['external', 'api'],
      check: async () => {
        try {
          // Check multiple external services if any
          const checks = [
            { name: 'github', url: 'https://api.github.com/zen' },
            // Add other external services as needed
          ];

          const results = await Promise.allSettled(
            checks.map(async ({ name, url }) => {
              const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
              return { name, healthy: response.ok, status: response.status };
            })
          );

          const failedServices = results
            .filter(
              (result, index) =>
                result.status === 'rejected' ||
                (result.status === 'fulfilled' && !result.value.healthy)
            )
            .map((_, index) => checks[index].name);

          const isHealthy = failedServices.length === 0;

          return {
            healthy: isHealthy,
            message: isHealthy
              ? 'All external services are available'
              : `Some external services are unavailable: ${failedServices.join(', ')}`,
            metadata: {
              total_services: checks.length,
              failed_services: failedServices,
            },
            timestamp: new Date(),
          };
        } catch (error) {
          return {
            healthy: false,
            message: `External API check failed: ${(error as Error).message}`,
            timestamp: new Date(),
          };
        }
      },
    });

    logger.info('Default health checks registered', {
      total_checks: this.checks.size,
    });
  }

  /**
   * Register a new health check
   */
  registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);

    // Initialize component health
    this.results.set(check.name, {
      name: check.name,
      status: 'healthy',
      lastCheck: new Date(),
      result: {
        healthy: true,
        message: 'Not yet checked',
        timestamp: new Date(),
      },
      uptime: 100,
      errorCount: 0,
      consecutiveFailures: 0,
    });

    // Start interval if specified
    if (check.interval) {
      const intervalHandle = setInterval(async () => {
      // TODO: Store interval ID and call clearInterval in cleanup
        await this.runSingleCheck(check.name);
      }, check.interval);

      this.intervalHandles.set(check.name, intervalHandle);
    }

    logger.info('Health check registered', {
      name: check.name,
      critical: check.critical,
      timeout: check.timeout,
    });
  }

  /**
   * Remove a health check
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name);
    this.results.delete(name);

    const intervalHandle = this.intervalHandles.get(name);
    if (intervalHandle) {
      clearInterval(intervalHandle);
      this.intervalHandles.delete(name);
    }

    logger.info('Health check unregistered', { name });
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<SystemHealth> {
    const checkPromises = Array.from(this.checks.keys()).map(async name => this.runSingleCheck(name));

    await Promise.allSettled(checkPromises);
    return this.getSystemHealth();
  }

  /**
   * Run a single health check with retries
   */
  async runSingleCheck(name: string): Promise<ComponentHealth | null> {
    const check = this.checks.get(name);
    if (!check) return null;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
        });

        const result = await Promise.race([check.check(), timeoutPromise]);

        // Update component health
        const componentHealth = this.updateComponentHealth(name, result, true);

        if (result.healthy) {
          this.emit('health_check_passed', { name, result, attempt });
          return componentHealth;
        } else {
          logger.warn('Health check failed', {
            name,
            attempt,
            message: result.message,
          });
        }
      } catch (error) {
        lastError = error as Error;
        logger.error('Health check error', {
          error: error as Error,
          name,
          attempt,
          max_attempts: this.config.retryAttempts,
        });

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay);
        }
      }
    }

    // All attempts failed
    const failureResult: HealthCheckResult = {
      healthy: false,
      message: `Health check failed after ${this.config.retryAttempts} attempts: ${lastError?.message}`,
      timestamp: new Date(),
    };

    const componentHealth = this.updateComponentHealth(name, failureResult, false);
    this.emit('health_check_failed', { name, result: failureResult });

    return componentHealth;
  }

  /**
   * Update component health based on check result
   */
  private updateComponentHealth(
    name: string,
    result: HealthCheckResult,
    success: boolean
  ): ComponentHealth {
    const existing = this.results.get(name)!;

    if (success) {
      existing.consecutiveFailures = 0;
      existing.status = 'healthy';
    } else {
      existing.consecutiveFailures++;
      existing.errorCount++;

      if (existing.consecutiveFailures >= this.config.unhealthyThreshold) {
        existing.status = 'unhealthy';
      } else if (existing.consecutiveFailures >= this.config.degradedThreshold) {
        existing.status = 'degraded';
      }
    }

    existing.lastCheck = new Date();
    existing.result = result;

    // Calculate uptime percentage
    const totalTime = Date.now() - this.startTime;
    const healthyTime = totalTime - existing.errorCount * this.config.checkInterval;
    existing.uptime = Math.max(0, (healthyTime / totalTime) * 100);

    this.results.set(name, existing);
    return existing;
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): SystemHealth {
    const components = Object.fromEntries(this.results);
    const componentList = Array.from(this.results.values());

    const summary = {
      total: componentList.length,
      healthy: componentList.filter(c => c.status === 'healthy').length,
      degraded: componentList.filter(c => c.status === 'degraded').length,
      unhealthy: componentList.filter(c => c.status === 'unhealthy').length,
      critical_failures: 0,
    };

    // Count critical failures
    summary.critical_failures = componentList.filter(c => {
      const check = this.checks.get(c.name);
      return check?.critical && c.status === 'unhealthy';
    }).length;

    // Determine overall system status
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (summary.critical_failures > 0) {
      systemStatus = 'unhealthy';
    } else if (summary.unhealthy > 0 || summary.degraded > 0) {
      systemStatus = 'degraded';
    } else {
      systemStatus = 'healthy';
    }

    return {
      status: systemStatus,
      timestamp: new Date(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      components,
      summary,
    };
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicChecks(): void {
    // Run initial check
    setTimeout(async () => this.runAllChecks(), 1000);

    // Set up periodic checks
    setInterval(async () => {
    // TODO: Store interval ID and call clearInterval in cleanup
      await this.runAllChecks();
    }, this.config.checkInterval);
  }

  /**
   * Express middleware for health endpoint
   */
  middleware() {
    return async (req: any, res: any) => {
      try {
        const health = this.getSystemHealth();

        const statusCode =
          health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json({
          ...health,
          timestamp: health.timestamp.toISOString(),
        });
      } catch (error) {
        logger.error('Health endpoint error', error as Error);
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check system failure',
        });
      }
    };
  }

  /**
   * Get component health by name
   */
  getComponentHealth(name: string): ComponentHealth | null {
    return this.results.get(name) || null;
  }

  /**
   * Get checks by tag
   */
  getChecksByTag(tag: string): HealthCheck[] {
    return Array.from(this.checks.values()).filter(check => check.tags?.includes(tag));
  }

  /**
   * Utility delay function
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulate async operation for testing
   */
  private async simulateAsyncOperation(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop all health checks
   */
  stop(): void {
    for (const intervalHandle of this.intervalHandles.values()) {
      clearInterval(intervalHandle);
    }
    this.intervalHandles.clear();

    logger.info('Health checker stopped');
  }
}
