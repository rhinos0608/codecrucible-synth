import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../logging/logger.js';
import type { ProductionHardeningConfig, ProductionStats } from './hardening-types.js';
import { SecurityEnforcer } from './security-enforcer.js';

const defaultConfig: ProductionHardeningConfig = {
  security: {
    rateLimiting: { enabled: true, requestsPerMinute: 60, burstLimit: 10, banDuration: 60 },
    inputValidation: {
      enabled: true,
      maxInputSize: 1024,
      sanitizeInputs: true,
      blockSuspiciousPatterns: true,
    },
    auditLogging: {
      enabled: true,
      auditAllOperations: true,
      sensitiveDataRedaction: true,
      logRetentionDays: 30,
    },
  },
};

export interface ExecuteOptions {
  securityContext?: { userId: string; action: string; input?: unknown };
  timeout?: number;
  priority?: string;
  resourceRequirements?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class ProductionHardeningSystem extends EventEmitter {
  private static instance: ProductionHardeningSystem | null = null;
  private readonly security: SecurityEnforcer;
  private readonly stats: ProductionStats = {
    uptime: 0,
    totalOperations: 0,
    successRate: 0,
    averageResponseTime: 0,
    resourceUsage: {
      memory: { current: 0, peak: 0, utilizationPercent: 0 },
    },
  };
  private readonly start = Date.now();
  private alerts: string[] = [];

  private constructor(private readonly config: ProductionHardeningConfig) {
    super();
    this.security = new SecurityEnforcer(config.security);
  }

  public static getInstance(
    config: Partial<ProductionHardeningConfig> = {}
  ): ProductionHardeningSystem {
    if (!this.instance) {
      this.instance = new ProductionHardeningSystem({ ...defaultConfig, ...config });
    }
    return this.instance;
  }

  public async initialize(): Promise<void> {
    await this.security.initialize();
    logger.info('🔒 Production hardening system initialized');
  }

  public async executeWithHardening<T>(
    operationId: string,
    operation: () => Promise<T>,
    options: ExecuteOptions = {}
  ): Promise<T> {
    const start = performance.now();
    try {
      await this.security.enforce({
        userId: options.securityContext?.userId,
        action: options.securityContext?.action || operationId,
        metadata: { input: options.securityContext?.input },
      });
      const result = await operation();
      this.recordSuccess(performance.now() - start);
      return result;
    } catch (error) {
      await this.security.handleFailure(operationId, error as Error);
      this.recordFailure(performance.now() - start);
      throw error;
    }
  }

  private recordSuccess(duration: number): void {
    this.stats.totalOperations++;
    const n = this.stats.totalOperations;
    this.stats.averageResponseTime = (this.stats.averageResponseTime * (n - 1) + duration) / n;
    this.stats.successRate = (this.stats.successRate * (n - 1) + 1) / n;
  }

  private recordFailure(duration: number): void {
    this.stats.totalOperations++;
    const n = this.stats.totalOperations;
    this.stats.averageResponseTime = (this.stats.averageResponseTime * (n - 1) + duration) / n;
    this.stats.successRate = (this.stats.successRate * (n - 1)) / n;
  }

  public async triggerEmergencyMode(reason: string): Promise<void> {
    this.alerts.push(reason);
    await this.security.emergencyLockdown();
    this.emit('emergency:activated', { reason });
  }

  public getProductionStats(): ProductionStats {
    this.stats.uptime = Date.now() - this.start;
    const mem = process.memoryUsage();
    this.stats.resourceUsage.memory = {
      current: mem.heapUsed,
      peak: mem.heapTotal,
      utilizationPercent: (mem.heapUsed / mem.heapTotal) * 100,
    };
    return { ...this.stats };
  }

  public getActiveAlerts(): string[] {
    return [...this.alerts];
  }

  public async shutdown(): Promise<void> {
    await this.security.shutdown();
    logger.info('🛑 Production hardening system shut down');
  }
}

export const productionHardeningSystem = ProductionHardeningSystem.getInstance();
