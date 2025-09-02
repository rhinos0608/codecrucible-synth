import { createLogger } from '../logging/logger.js';
import { ILogger } from '../../domain/interfaces/logger.js';

export interface ComponentMetrics {
  cpu: number;
  memory: number;
  diskUsage: number;
  networkLatency: number;
  errorCount: number;
  requestCount: number;
  customMetrics: Record<string, number>;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  metrics: ComponentMetrics;
  dependencies: string[];
  lastChecked: Date;
  errorRate: number;
  responseTime: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  components: ComponentHealth[];
  overallScore: number;
  lastChecked: Date;
  uptime: number;
  version: string;
}

export interface HealthStats {
  totalComponents: number;
  healthyComponents: number;
  degradedComponents: number;
  criticalComponents: number;
  lastHealthCheck: Date;
}

export interface HealthConfig {
  checkInterval: number;
  timeoutMs: number;
  retryAttempts: number;
}

export class HealthMonitor {
  private components: Map<string, ComponentHealth> = new Map();
  private logger: ILogger = createLogger('HealthMonitor');

  constructor(private config: HealthConfig) {}

  async initialize(): Promise<void> {
    this.registerDefaultComponents();
  }

  registerComponent(name: string, component: ComponentHealth): void {
    this.components.set(name, component);
  }

  async performHealthCheck(): Promise<SystemHealth> {
    const results: ComponentHealth[] = [];
    let total = 0;

    for (const [name, component] of this.components.entries()) {
      const health = await this.checkComponent(name, component);
      results.push(health);
      total += this.score(health.status);
    }

    const overall = results.length > 0 ? total / results.length : 0;
    return {
      status: this.overallStatus(results, overall),
      components: results,
      overallScore: overall,
      lastChecked: new Date(),
      uptime: Date.now(),
      version: '3.5.0',
    };
  }

  getStats(): HealthStats {
    const components = Array.from(this.components.values());
    return {
      totalComponents: components.length,
      healthyComponents: components.filter(c => c.status === 'healthy').length,
      degradedComponents: components.filter(c => c.status === 'degraded').length,
      criticalComponents: components.filter(c => c.status === 'critical').length,
      lastHealthCheck: new Date(),
    };
  }

  async shutdown(): Promise<void> {}

  private registerDefaultComponents(): void {
    this.registerComponent('event-loop', {
      name: 'event-loop',
      status: 'unknown',
      metrics: {
        cpu: 0,
        memory: 0,
        diskUsage: 0,
        networkLatency: 0,
        errorCount: 0,
        requestCount: 0,
        customMetrics: {},
      },
      dependencies: [],
      lastChecked: new Date(),
      errorRate: 0,
      responseTime: 0,
    });
  }

  private async checkComponent(name: string, component: ComponentHealth): Promise<ComponentHealth> {
    switch (name) {
      case 'event-loop':
        return this.checkEventLoop(component);
      default:
        return { ...component, lastChecked: new Date(), status: 'healthy' };
    }
  }

  private checkEventLoop(component: ComponentHealth): Promise<ComponentHealth> {
    const start = Date.now();
    return new Promise(resolve => {
      setImmediate(() => {
        const lag = Date.now() - start;
        let status: ComponentHealth['status'] = 'healthy';
        if (lag > 100) status = 'critical';
        else if (lag > 50) status = 'degraded';
        resolve({ ...component, status, responseTime: lag, lastChecked: new Date() });
      });
    });
  }

  private score(status: ComponentHealth['status']): number {
    switch (status) {
      case 'healthy':
        return 1;
      case 'degraded':
        return 0.5;
      case 'unknown':
        return 0.25;
      default:
        return 0;
    }
  }

  private overallStatus(components: ComponentHealth[], score: number): SystemHealth['status'] {
    const critical = components.some(c => c.status === 'critical');
    const degraded = components.some(c => c.status === 'degraded');
    if (critical) return 'critical';
    if (degraded || score < 0.8) return 'degraded';
    if (score < 0.5) return 'critical';
    return 'healthy';
  }
}
