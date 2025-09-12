import { IntegratedSystemHealth, ProductionIntegrationConfig } from './production-types.js';
import { EnvironmentManager } from './environment-manager.js';
import { HealthMonitoring } from './health-monitoring.js';
import { ScalingCoordinator } from './scaling-coordinator.js';
import { SecurityIntegration } from './security-integration.js';
import { BackupCoordinator } from './backup-coordinator.js';
import { MetricsCollector } from './metrics-collector.js';
import { RollbackManager } from './rollback-manager.js';
import type { IMcpManager } from '../../domain/interfaces/mcp-manager.js';
import { SecurityAuditLogger, AuditEventType, AuditOutcome, AuditSeverity } from '../security/security-audit-logger.js';

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
  private mcpManager: IMcpManager | null = null;

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

  public setMcpManager(mcp: IMcpManager | null | undefined): void {
    this.mcpManager = mcp ?? null;
  }

  async deploy(config: ProductionIntegrationConfig): Promise<IntegratedSystemHealth> {
    return this.circuitBreaker(async () =>
      this.executeWithRetry(async () => {
        // Security enforcement with deployment context
        const initiator = (() => { try { return (require('os').userInfo?.().username) || 'unknown'; } catch { return 'unknown'; } })();
        const decision = await this.security.enforce({
          phase: 'deploy',
          environment: this.env.getEnvironment(),
          config,
          initiator,
        }, async (policy, input) => {
          // Audit callback
          const auditor = SecurityAuditLogger.getInstance();
          auditor.logAuditEvent({
            eventType: AuditEventType.SECURITY_VALIDATION,
            severity: AuditSeverity.LOW,
            outcome: AuditOutcome.SUCCESS,
            details: { policy: policy.id, inputSummary: { phase: (input as any)?.phase, environment: (input as any)?.environment } },
          });
        });
        if (decision === 'deny') {
          throw new Error('Security policy denied deployment');
        }

        // Scaling: evaluate current load and enact via no-op executor by default
        let cpuLoad1 = 0;
        try { cpuLoad1 = require('os').loadavg?.()[0] ?? 0; } catch { cpuLoad1 = 0; }
        const scaleDecision = this.scaling.evaluate({ cpuLoad1, queueDepth: 0 });
        await this.scaling.enact(scaleDecision, async (action, target) => this.executeScaling(action, target));

        await this.backup.backup();
        await this.metrics.collect();
        return this.health.checkHealth();
      })
    );
  }

  private async executeScaling(action: import('./scaling-coordinator.js').ScaleAction, target?: number): Promise<boolean> {
    if (action === 'none') return true;

    // Decide executor based on environment variables
    const provider = (process.env.SCALER_TARGET || '').toLowerCase();
    const replicas = typeof target === 'number' ? Math.max(1, Math.floor(target)) : undefined;
    const auditor = SecurityAuditLogger.getInstance();

    const run = async (command: string, args: string[]): Promise<boolean> => {
      try {
        if (!this.mcpManager) return false;
        const res = await this.mcpManager.executeTool('execute_command', { command, args });
        const ok = !!res && res.success !== false;
        auditor.logToolExecutionEvent(ok ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE, 'execute_command', undefined, {
          action: 'scaling', provider, command, args, output: res?.data,
        });
        return ok;
      } catch (e) {
        auditor.logToolExecutionEvent(AuditOutcome.FAILURE, 'execute_command', undefined, {
          action: 'scaling', provider, error: e instanceof Error ? e.message : String(e),
        });
        return false;
      }
    };

    if (provider === 'kubernetes' || provider === 'k8s') {
      const deployment = process.env.DEPLOYMENT_NAME || process.env.APP_NAME || 'app';
      const ns = process.env.NAMESPACE || 'default';
      if (!replicas) return true;
      return run('kubectl', ['scale', 'deployment', deployment, `--replicas=${replicas}`, '-n', ns]);
    }
    if (provider === 'docker') {
      const service = process.env.SERVICE_NAME || process.env.APP_NAME || 'app';
      if (!replicas) return true;
      return run('docker', ['service', 'scale', `${service}=${replicas}`]);
    }
    if (provider === 'pm2') {
      const app = process.env.APP_NAME || 'app';
      if (!replicas) return true;
      return run('pm2', ['scale', app, String(replicas)]);
    }
    // Unknown provider; no-op
    auditor.logAuditEvent({
      eventType: AuditEventType.SYSTEM_EVENT,
      severity: AuditSeverity.LOW,
      outcome: AuditOutcome.WARNING,
      details: { message: 'Scaling provider not configured; skipping', action, target },
    });
    return true;
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
