import { ProductionIntegrationConfig, IntegratedSystemHealth } from './production-types.js';
import { DeploymentOrchestrator } from './deployment-orchestrator.js';
import { EnvironmentManager } from './environment-manager.js';
import { HealthMonitoring } from './health-monitoring.js';
import { ScalingCoordinator } from './scaling-coordinator.js';
import { SecurityIntegration } from './security-integration.js';
import { BackupCoordinator } from './backup-coordinator.js';
import { MetricsCollector } from './metrics-collector.js';
import { RollbackManager } from './rollback-manager.js';

export class ProductionIntegrationManager {
  private readonly orchestrator: DeploymentOrchestrator;

  constructor(private readonly config: ProductionIntegrationConfig) {
    const env = new EnvironmentManager(config);
    const health = new HealthMonitoring();
    const scaling = new ScalingCoordinator();
    const security = new SecurityIntegration();
    const backup = new BackupCoordinator();
    const metrics = new MetricsCollector();
    const rollback = new RollbackManager();
    this.orchestrator = new DeploymentOrchestrator(
      env,
      health,
      scaling,
      security,
      backup,
      metrics,
      rollback,
    );
  }

  async deploy(): Promise<IntegratedSystemHealth> {
    return this.orchestrator.deploy(this.config);
  }
}
