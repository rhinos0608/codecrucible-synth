/**
 * Health & Status Manager - Centralizes system health monitoring and metrics collection
 * Extracted from UnifiedModelClient to provide focused health management with caching and timeout protection
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { IProviderRepository } from '../providers/provider-repository.js';
import { ICacheCoordinator } from '../caching/cache-coordinator.js';
import { PerformanceMonitor } from '../../utils/performance.js';
import { MetricsData } from '../../domain/types/unified-types.js';

export interface HealthStatus {
  [providerType: string]: boolean;
}

export interface SystemHealthSummary {
  status: 'healthy' | 'degraded' | 'initializing' | 'unhealthy';
  details: {
    initialized: boolean;
    providersAvailable: number;
    totalProviders: number;
    providers: HealthStatus;
    error?: string;
  };
}

export interface HealthCheckConfig {
  healthCheckTimeoutMs: number;
  overallTimeoutMs: number;
  cacheTtlMs: number;
}

export interface IHealthStatusManager {
  /**
   * Perform health check on all available providers with caching and timeout protection
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Get comprehensive system metrics including performance data
   */
  getMetrics(activeRequests: number, queuedRequests: number): MetricsData;

  /**
   * Check overall system health with summary status
   */
  checkHealth(initialized: boolean): Promise<SystemHealthSummary>;

  /**
   * Get cached health status without performing new checks
   */
  getCachedHealthStatus(): HealthStatus | null;

  /**
   * Force refresh of health status (bypass cache)
   */
  forceHealthRefresh(): Promise<HealthStatus>;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

export class HealthStatusManager extends EventEmitter implements IHealthStatusManager {
  private readonly config: HealthCheckConfig;
  private readonly providerRepository: IProviderRepository;
  private readonly cacheCoordinator: ICacheCoordinator;
  private readonly performanceMonitor: PerformanceMonitor;
  private cachedHealthStatus: HealthStatus | null = null;
  private lastHealthCheckTime = 0;

  constructor(
    providerRepository: IProviderRepository,
    cacheCoordinator: ICacheCoordinator,
    performanceMonitor: PerformanceMonitor,
    config?: Partial<HealthCheckConfig>
  ) {
    super();

    this.providerRepository = providerRepository;
    this.cacheCoordinator = cacheCoordinator;
    this.performanceMonitor = performanceMonitor;

    this.config = {
      healthCheckTimeoutMs: 5000, // 5 seconds per provider
      overallTimeoutMs: 15000, // 15 seconds total
      cacheTtlMs: 30000, // 30 seconds cache TTL
      ...config,
    };

    logger.debug('HealthStatusManager initialized', { config: this.config });
  }

  /**
   * Perform health check on all available providers with caching and timeout protection
   */
  async healthCheck(): Promise<HealthStatus> {
    const health: HealthStatus = {};

    // Check if we have cached results that are still valid
    if (this.shouldUseCachedHealth()) {
      logger.debug('Using cached health status');
      return this.cachedHealthStatus!;
    }

    // Overall timeout for entire health check (prevent CLI hanging)
    const timeoutPromise = new Promise<HealthStatus>((_, reject) => {
      setTimeout(
        () => reject(new Error('Health check overall timeout')),
        this.config.overallTimeoutMs
      );
    });

    const healthCheckPromise = this.performHealthChecks();

    try {
      const result = await Promise.race([healthCheckPromise, timeoutPromise]);
      this.updateHealthCache(result);
      this.emit('health-check-complete', { status: result, success: true });
      return result;
    } catch (error) {
      logger.warn('Health check failed:', error instanceof Error ? error.message : error);
      this.emit('health-check-complete', { status: {}, success: false, error });
      // Return cached status if available, otherwise empty
      return this.cachedHealthStatus || {};
    }
  }

  /**
   * Perform individual provider health checks with timeout protection
   */
  private async performHealthChecks(): Promise<HealthStatus> {
    const health: HealthStatus = {};
    const availableProviders = this.providerRepository.getAvailableProviders();

    for (const [type, provider] of availableProviders) {
      const cacheKey = `health_${type}`;

      // Use cached result if available and valid
      if (this.cacheCoordinator.isHealthCheckCached(cacheKey, this.config.cacheTtlMs)) {
        const healthCheckCache = this.cacheCoordinator.getHealthCheckCache();
        const cached = healthCheckCache.get(cacheKey);
        health[type] = cached?.healthy || false;
        logger.debug(`Using cached health for ${type}:`, health[type]);
        continue;
      }

      try {
        // Add timeout protection to prevent infinite hangs
        const healthCheckPromise = provider.healthCheck?.() ?? Promise.resolve();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Health check timeout for ${type}`)),
            this.config.healthCheckTimeoutMs
          );
        });

        await Promise.race([healthCheckPromise, timeoutPromise]);
        health[type] = true;
        this.cacheCoordinator.setHealthCheck(cacheKey, true);
        logger.debug(`Health check passed for ${type}`);
      } catch (error) {
        // Log timeout/connection errors but continue with other providers
        logger.debug(
          `Health check failed for ${type}:`,
          error instanceof Error ? error.message : error
        );
        health[type] = false;
        this.cacheCoordinator.setHealthCheck(cacheKey, false);
      }
    }

    return health;
  }

  /**
   * Get comprehensive system metrics including performance data
   */
  getMetrics(activeRequests: number, queuedRequests: number): MetricsData {
    const metrics: MetricsData = {
      timestamp: Date.now(),
      values: {
        activeRequests,
        queuedRequests,
      },
      metadata: {
        providerMetrics: JSON.parse(JSON.stringify(this.performanceMonitor.getProviderMetrics())),
        performance: JSON.parse(JSON.stringify(this.performanceMonitor.getSummary())),
      },
    };

    // Add health status to metrics if available
    if (this.cachedHealthStatus) {
      const healthyProviders = Object.values(this.cachedHealthStatus).filter(Boolean).length;
      const totalProviders = Object.keys(this.cachedHealthStatus).length;

      // Ensure metadata object exists
      if (!metrics.metadata) {
        metrics.metadata = {};
      }

      metrics.metadata.health = {
        healthyProviders,
        totalProviders,
        healthRatio: totalProviders > 0 ? healthyProviders / totalProviders : 0,
        lastHealthCheck: this.lastHealthCheckTime,
      };
    }

    this.emit('metrics-collected', metrics);
    return metrics;
  }

  /**
   * Check overall system health with summary status
   */
  async checkHealth(initialized: boolean): Promise<SystemHealthSummary> {
    try {
      const providerHealth = await this.healthCheck();
      const availableProviders = Object.values(providerHealth).filter(Boolean).length;
      const totalProviders = Object.keys(providerHealth).length;

      const status =
        initialized && availableProviders > 0
          ? 'healthy'
          : initialized
            ? 'degraded'
            : 'initializing';

      const summary: SystemHealthSummary = {
        status,
        details: {
          initialized,
          providersAvailable: availableProviders,
          totalProviders,
          providers: providerHealth,
        },
      };

      this.emit('system-health-checked', summary);
      return summary;
    } catch (error) {
      const summary: SystemHealthSummary = {
        status: 'unhealthy',
        details: {
          initialized,
          providersAvailable: 0,
          totalProviders: 0,
          providers: {},
          error: error instanceof Error ? error.message : String(error),
        },
      };

      this.emit('system-health-checked', summary);
      return summary;
    }
  }

  /**
   * Get cached health status without performing new checks
   */
  getCachedHealthStatus(): HealthStatus | null {
    return this.cachedHealthStatus;
  }

  /**
   * Force refresh of health status (bypass cache)
   */
  async forceHealthRefresh(): Promise<HealthStatus> {
    logger.info('Forcing health status refresh');
    this.lastHealthCheckTime = 0; // Reset cache timestamp
    this.cachedHealthStatus = null;
    return this.healthCheck();
  }

  /**
   * Check if cached health status is still valid
   */
  private shouldUseCachedHealth(): boolean {
    if (!this.cachedHealthStatus) {
      return false;
    }

    const now = Date.now();
    return now - this.lastHealthCheckTime < this.config.cacheTtlMs;
  }

  /**
   * Update health cache with new results
   */
  private updateHealthCache(health: HealthStatus): void {
    this.cachedHealthStatus = health;
    this.lastHealthCheckTime = Date.now();
    logger.debug('Health cache updated', {
      providers: Object.keys(health),
      healthy: Object.values(health).filter(Boolean).length,
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
    this.cachedHealthStatus = null;
    this.lastHealthCheckTime = 0;
    logger.debug('HealthStatusManager cleaned up');
  }
}
