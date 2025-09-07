import { IntegratedSystemHealth, ProductionIntegrationConfig } from './production-types.js';
import { EnvironmentManager } from './environment-manager.js';
import { HealthMonitoring } from './health-monitoring.js';
import { ScalingCoordinator } from './scaling-coordinator.js';
import { SecurityIntegration } from './security-integration.js';
import { BackupCoordinator } from './backup-coordinator.js';
import { MetricsCollector } from './metrics-collector.js';
import { RollbackManager } from './rollback-manager.js';

interface RetryConfig {
  attempts: number;
  delayMs: number;
}

interface CircuitBreakerConfig {
  threshold: number;
  delayMs: number;
}

export interface DeploymentOrchestratorOptions {
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
}

export class DeploymentOrchestrator {
  private failureCount = 0;
  private circuitOpen = false;
  private readonly breakerThreshold: number;
  private readonly breakerDelay: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;

  constructor(
    private readonly env: EnvironmentManager,
    private readonly health: HealthMonitoring,
    private readonly scaling: ScalingCoordinator,
    private readonly security: SecurityIntegration,
    private readonly backup: BackupCoordinator,
    private readonly metrics: MetricsCollector,
    private readonly rollback: RollbackManager,
    options: DeploymentOrchestratorOptions = {}
  ) {
    this.retryAttempts = options.retry?.attempts ?? 3;
    this.retryDelay = options.retry?.delayMs ?? 500;
    this.breakerThreshold = options.circuitBreaker?.threshold ?? 5;
    this.breakerDelay = options.circuitBreaker?.delayMs ?? 30_000;
  }

  async deploy(config: ProductionIntegrationConfig): Promise<IntegratedSystemHealth> {
    return this.circuitBreaker(async () =>
      this.executeWithRetry(async () => {
        await this.security.enforce();
        await this.scaling.scale();
        await this.backup.backup();
        await this.metrics.collect();
        return this.health.checkHealth();
      })
    );
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries = this.retryAttempts,
    delay = this.retryDelay
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (retries <= 0) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.executeWithRetry(fn, retries - 1, delay * 2);
    }
  }

  private async circuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    if (this.circuitOpen) {
      throw new Error('Circuit breaker open');
    }
    try {
      const result = await fn();
      this.failureCount = 0;
      return result;
    } catch (err) {
      this.failureCount += 1;
      if (this.failureCount >= this.breakerThreshold) {
        this.circuitOpen = true;
        setTimeout(() => {
          this.circuitOpen = false;
          this.failureCount = 0;
        }, this.breakerDelay);
      }
      throw err;
    }
  }
}
