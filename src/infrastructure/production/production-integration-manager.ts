import { EventEmitter } from 'events';
import { ProductionIntegrationConfig, IntegratedSystemHealth } from './production-types.js';
import { DeploymentOrchestrator } from './deployment-orchestrator.js';
import { EnvironmentManager } from './environment-manager.js';
import { HealthMonitoring } from './health-monitoring.js';
import { ScalingCoordinator } from './scaling-coordinator.js';
import { SecurityIntegration } from './security-integration.js';
import { BackupCoordinator } from './backup-coordinator.js';
import { MetricsCollector } from './metrics-collector.js';
import { RollbackManager } from './rollback-manager.js';

export class ProductionIntegrationManager extends EventEmitter {
  private static instance?: ProductionIntegrationManager;
  private readonly orchestrator: DeploymentOrchestrator;
  private readonly env: EnvironmentManager;
  private readonly health: HealthMonitoring;

  private constructor(private readonly config: ProductionIntegrationConfig) {
    super();
    this.env = new EnvironmentManager(config);
    this.health = new HealthMonitoring();
    const scaling = new ScalingCoordinator();
    const security = new SecurityIntegration();
    const backup = new BackupCoordinator();
    const metrics = new MetricsCollector();
    const rollback = new RollbackManager();
    this.orchestrator = new DeploymentOrchestrator(
      this.env,
      this.health,
      scaling,
      security,
      backup,
      metrics,
      rollback
    );
  }

  static getInstance(config: ProductionIntegrationConfig): ProductionIntegrationManager {
    if (!this.instance) {
      this.instance = new ProductionIntegrationManager(config);
    }
    return this.instance;
  }

  async initializeProductionSystem(): Promise<void> {
    this.emit('initialize:start');
    await this.getIntegratedSystemHealth();
    this.emit('initialize:completed');
  }

  async getIntegratedSystemHealth(): Promise<IntegratedSystemHealth> {
    const health = await this.health.checkHealth();
    this.emit('health-check-completed', health);
    if (health.overallStatus === 'emergency') {
      this.emit('emergency:activated', health);
    }
    return health;
  }

  async shutdownProductionSystem(): Promise<void> {
    this.emit('shutdown:start');
    this.emit('shutdown:completed');
  }

  async executeWithProductionHardening(): Promise<IntegratedSystemHealth> {
    try {
      return await this.orchestrator.deploy(this.config);
    } catch (error) {
      this.emit('operation-failed', { context: { operationId: 'deploy' }, error });
      throw error;
    }
  }
}
