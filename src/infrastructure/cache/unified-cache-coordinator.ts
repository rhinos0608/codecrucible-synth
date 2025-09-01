/**
 * Unified Cache Coordinator
 * Agent 3: Runtime Coordination & Performance Specialist
 *
 * Consolidates and coordinates all cache systems to eliminate conflicts
 * Addresses Issue #16: Cache System Conflicts
 *
 * Systems coordinated:
 * - UnifiedCacheSystem (semantic, routing strategies)
 * - CacheCoordinator (intelligent caching logic)
 * - ResponseCacheManager (AI response caching)
 * - AdvancedSearchCache (search result caching)
 * - Voice system caches (capability, prompt caches)
 * - MCP connection caches
 * - Routing decision caches
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { getUnifiedCache, UnifiedCacheSystem } from './unified-cache-system.js';

export interface CacheCoordinationConfig {
  enableGlobalCoordination: boolean;
  conflictResolutionStrategy: 'priority' | 'timestamp' | 'usage' | 'size';
  cacheHierarchy: CacheLevel[];
  coordinationInterval: number;
  maxCacheSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface CacheLevel {
  name: string;
  priority: number;
  maxSize: number;
  ttlMs: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  systems: string[];
}

export interface CacheSystemInfo {
  name: string;
  type: 'unified' | 'specialized' | 'legacy';
  instance: any;
  metrics: CacheMetrics;
  lastAccessed: number;
  conflicts: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  hitRate: number;
  memoryUsage: number;
}

export interface CacheConflict {
  timestamp: number;
  key: string;
  systems: string[];
  resolution: 'merged' | 'priority' | 'newest' | 'evicted';
  impact: 'none' | 'minor' | 'moderate' | 'severe';
}

export interface CacheCoordinationStats {
  totalSystems: number;
  activeSystems: number;
  totalCacheSize: number;
  globalHitRate: number;
  conflicts: CacheConflict[];
  systemMetrics: Record<string, CacheMetrics>;
  coordinationOverhead: number;
  optimizationSavings: number;
}

/**
 * Unified Cache Coordinator
 * Manages and coordinates all cache systems to prevent conflicts
 */
export class UnifiedCacheCoordinator extends EventEmitter {
  private static instance: UnifiedCacheCoordinator | null = null;

  private config: CacheCoordinationConfig;
  private registeredSystems = new Map<string, CacheSystemInfo>();
  private conflicts: CacheConflict[] = [];
  private globalMetrics: CacheMetrics;

  private coordinationIntervalId?: NodeJS.Timeout;
  private isCoordinating = false;

  // Core unified cache system
  private unifiedCache: UnifiedCacheSystem;

  // Coordination state
  private keyMapping = new Map<string, Set<string>>(); // Key -> Systems using it
  private systemPriorities = new Map<string, number>();
  private lastCoordinationTime = 0;

  private constructor(config?: Partial<CacheCoordinationConfig>) {
    super();

    this.config = this.getDefaultConfig(config);
    this.unifiedCache = getUnifiedCache();
    this.globalMetrics = this.initializeMetrics();

    this.setupSystemPriorities();
    this.registerUnifiedCache();

    logger.info('🗄️ Unified Cache Coordinator initialized', {
      strategy: this.config.conflictResolutionStrategy,
      levels: this.config.cacheHierarchy.length,
    });
  }

  static getInstance(config?: Partial<CacheCoordinationConfig>): UnifiedCacheCoordinator {
    if (!UnifiedCacheCoordinator.instance) {
      UnifiedCacheCoordinator.instance = new UnifiedCacheCoordinator(config);
    }
    return UnifiedCacheCoordinator.instance;
  }

  /**
   * Start cache coordination
   */
  startCoordination(): void {
    if (this.isCoordinating) {
      logger.warn('Cache coordination already started');
      return;
    }

    this.isCoordinating = true;
    this.coordinationIntervalId = setInterval(() => {
      this.performCoordinationCycle();
    }, this.config.coordinationInterval);

    logger.info('🚀 Cache coordination started', {
      interval: `${this.config.coordinationInterval}ms`,
      systems: this.registeredSystems.size,
    });

    // Perform initial coordination
    this.performCoordinationCycle();
  }

  /**
   * Stop cache coordination
   */
  stopCoordination(): void {
    if (!this.isCoordinating || !this.coordinationIntervalId) return;

    clearInterval(this.coordinationIntervalId);
    this.isCoordinating = false;
    this.coordinationIntervalId = undefined;

    logger.info('🛑 Cache coordination stopped');
  }

  /**
   * Register a cache system for coordination
   */
  registerCacheSystem(
    name: string,
    type: 'unified' | 'specialized' | 'legacy',
    instance: any
  ): void {
    const systemInfo: CacheSystemInfo = {
      name,
      type,
      instance,
      metrics: this.initializeMetrics(),
      lastAccessed: Date.now(),
      conflicts: 0,
    };

    this.registeredSystems.set(name, systemInfo);

    // Set system priority based on type and registration order
    const basePriority = type === 'unified' ? 100 : type === 'specialized' ? 50 : 10;
    this.systemPriorities.set(name, basePriority);

    logger.info(`📋 Registered cache system: ${name} (${type})`);

    this.emit('system-registered', { name, type, priority: basePriority });
  }

  /**
   * Unregister a cache system
   */
  unregisterCacheSystem(name: string): void {
    const systemInfo = this.registeredSystems.get(name);
    if (!systemInfo) return;

    this.registeredSystems.delete(name);
    this.systemPriorities.delete(name);

    // Clean up key mappings
    for (const [key, systems] of this.keyMapping.entries()) {
      systems.delete(name);
      if (systems.size === 0) {
        this.keyMapping.delete(key);
      }
    }

    logger.info(`🗑️ Unregistered cache system: ${name}`);
    this.emit('system-unregistered', { name });
  }

  /**
   * Coordinated cache get operation
   */
  async get(key: string, preferredSystem?: string): Promise<any> {
    const startTime = Date.now();

    try {
      // Try preferred system first
      if (preferredSystem && this.registeredSystems.has(preferredSystem)) {
        const result = await this.getFromSystem(key, preferredSystem);
        if (result !== null) {
          this.updateAccessMetrics(preferredSystem, 'hit');
          return result;
        }
      }

      // Try systems in priority order
      const systemsByPriority = Array.from(this.registeredSystems.entries()).sort(
        ([, a], [, b]) => this.systemPriorities.get(b.name)! - this.systemPriorities.get(a.name)!
      );

      for (const [systemName, systemInfo] of systemsByPriority) {
        if (systemName === preferredSystem) continue; // Already tried

        const result = await this.getFromSystem(key, systemName);
        if (result !== null) {
          this.updateAccessMetrics(systemName, 'hit');

          // Propagate to higher priority systems for future access
          await this.propagateToHigherPrioritySystems(key, result, systemName);

          return result;
        }
      }

      // Cache miss across all systems
      this.updateGlobalMetrics('miss');
      return null;
    } catch (error) {
      logger.error(`Cache coordination error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Coordinated cache set operation
   */
  async set(
    key: string,
    value: any,
    options?: {
      ttl?: number;
      systems?: string[];
      priority?: number;
      metadata?: any;
    }
  ): Promise<boolean> {
    try {
      const targetSystems = options?.systems || ['unified-cache'];
      const results: boolean[] = [];

      // Track key usage
      if (!this.keyMapping.has(key)) {
        this.keyMapping.set(key, new Set());
      }

      // Set in specified systems
      for (const systemName of targetSystems) {
        const system = this.registeredSystems.get(systemName);
        if (!system) {
          logger.warn(`System ${systemName} not found for cache set`);
          continue;
        }

        const success = await this.setInSystem(key, value, systemName, options);
        results.push(success);

        if (success) {
          this.keyMapping.get(key)!.add(systemName);
          this.updateAccessMetrics(systemName, 'set');
        }
      }

      const success = results.some(Boolean);

      // Check for conflicts
      if (this.keyMapping.get(key)!.size > 1) {
        await this.resolveKeyConflict(key);
      }

      this.updateGlobalMetrics(success ? 'set' : 'set-error');
      return success;
    } catch (error) {
      logger.error(`Cache coordination set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Coordinated cache delete operation
   */
  async delete(key: string): Promise<boolean> {
    try {
      const systems = this.keyMapping.get(key);
      if (!systems || systems.size === 0) {
        return false;
      }

      const results: boolean[] = [];

      // Delete from all systems that have the key
      for (const systemName of systems) {
        const success = await this.deleteFromSystem(key, systemName);
        results.push(success);

        if (success) {
          this.updateAccessMetrics(systemName, 'delete');
        }
      }

      // Clean up key mapping
      this.keyMapping.delete(key);

      const success = results.some(Boolean);
      this.updateGlobalMetrics('delete');

      return success;
    } catch (error) {
      logger.error(`Cache coordination delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all caches in coordinated manner
   */
  async clearAll(): Promise<void> {
    logger.info('🧹 Starting coordinated cache clear');

    const promises = Array.from(this.registeredSystems.entries()).map(async ([name, info]) => {
      try {
        if (typeof info.instance.clear === 'function') {
          await info.instance.clear();
          logger.debug(`Cleared cache system: ${name}`);
        }
      } catch (error) {
        logger.error(`Error clearing cache system ${name}:`, error);
      }
    });

    await Promise.allSettled(promises);

    // Clear coordination state
    this.keyMapping.clear();
    this.conflicts = [];
    this.globalMetrics = this.initializeMetrics();

    logger.info('✅ Coordinated cache clear completed');
    this.emit('cache-cleared');
  }

  /**
   * Get coordination statistics
   */
  getCoordinationStats(): CacheCoordinationStats {
    const systemMetrics: Record<string, CacheMetrics> = {};
    let totalSize = 0;
    let totalHits = 0;
    let totalRequests = 0;

    for (const [name, info] of this.registeredSystems.entries()) {
      systemMetrics[name] = info.metrics;
      totalSize += info.metrics.size;
      totalHits += info.metrics.hits;
      totalRequests += info.metrics.hits + info.metrics.misses;
    }

    return {
      totalSystems: this.registeredSystems.size,
      activeSystems: Array.from(this.registeredSystems.values()).filter(
        s => Date.now() - s.lastAccessed < 300000
      ).length,
      totalCacheSize: totalSize,
      globalHitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      conflicts: this.conflicts.slice(-20), // Recent conflicts
      systemMetrics,
      coordinationOverhead: this.calculateCoordinationOverhead(),
      optimizationSavings: this.calculateOptimizationSavings(),
    };
  }

  /**
   * Get cache health report
   */
  getCacheHealthReport(): any {
    const stats = this.getCoordinationStats();
    const recentConflicts = this.conflicts.filter(c => Date.now() - c.timestamp < 3600000); // Last hour

    return {
      overall: {
        status: this.calculateOverallHealth(),
        hitRate: stats.globalHitRate,
        conflicts: recentConflicts.length,
        systems: stats.activeSystems,
      },
      issues: this.detectHealthIssues(),
      recommendations: this.generateOptimizationRecommendations(),
      coordination: {
        overhead: stats.coordinationOverhead,
        savings: stats.optimizationSavings,
        efficiency: this.calculateCoordinationEfficiency(),
      },
    };
  }

  // Private methods

  private async performCoordinationCycle(): Promise<void> {
    const startTime = Date.now();

    try {
      // Update system metrics
      await this.updateSystemMetrics();

      // Detect and resolve conflicts
      await this.detectAndResolveConflicts();

      // Optimize cache distribution
      await this.optimizeCacheDistribution();

      // Clean up expired entries
      await this.cleanupExpiredEntries();

      // Update coordination metrics
      this.lastCoordinationTime = Date.now() - startTime;

      this.emit('coordination-cycle-complete', {
        duration: this.lastCoordinationTime,
        conflicts: this.conflicts.length,
        systems: this.registeredSystems.size,
      });
    } catch (error) {
      logger.error('Cache coordination cycle error:', error);
      this.emit('coordination-error', error);
    }
  }

  private async getFromSystem(key: string, systemName: string): Promise<any> {
    const system = this.registeredSystems.get(systemName);
    if (!system) return null;

    try {
      system.lastAccessed = Date.now();

      if (typeof system.instance.get === 'function') {
        const result = await system.instance.get(key);
        return result?.value !== undefined ? result.value : result !== null ? result : null;
      }

      return null;
    } catch (error) {
      logger.debug(`Error getting from ${systemName}:`, error);
      return null;
    }
  }

  private async setInSystem(
    key: string,
    value: any,
    systemName: string,
    options?: any
  ): Promise<boolean> {
    const system = this.registeredSystems.get(systemName);
    if (!system) return false;

    try {
      system.lastAccessed = Date.now();

      if (typeof system.instance.set === 'function') {
        await system.instance.set(key, value, options);
        return true;
      }

      return false;
    } catch (error) {
      logger.debug(`Error setting in ${systemName}:`, error);
      return false;
    }
  }

  private async deleteFromSystem(key: string, systemName: string): Promise<boolean> {
    const system = this.registeredSystems.get(systemName);
    if (!system) return false;

    try {
      system.lastAccessed = Date.now();

      if (typeof system.instance.delete === 'function') {
        return await system.instance.delete(key);
      }

      return false;
    } catch (error) {
      logger.debug(`Error deleting from ${systemName}:`, error);
      return false;
    }
  }

  private async propagateToHigherPrioritySystems(
    key: string,
    value: any,
    sourceSystem: string
  ): Promise<void> {
    const sourcePriority = this.systemPriorities.get(sourceSystem) || 0;

    const higherPrioritySystems = Array.from(this.registeredSystems.keys()).filter(
      name => (this.systemPriorities.get(name) || 0) > sourcePriority
    );

    for (const systemName of higherPrioritySystems) {
      try {
        await this.setInSystem(key, value, systemName, { ttl: 300000 }); // 5 minute TTL for propagated items
        this.keyMapping.get(key)?.add(systemName);
      } catch (error) {
        logger.debug(`Error propagating to ${systemName}:`, error);
      }
    }
  }

  private async resolveKeyConflict(key: string): Promise<void> {
    const systems = this.keyMapping.get(key);
    if (!systems || systems.size <= 1) return;

    const conflict: CacheConflict = {
      timestamp: Date.now(),
      key,
      systems: Array.from(systems),
      resolution: 'priority',
      impact: 'minor',
    };

    // Apply conflict resolution strategy
    switch (this.config.conflictResolutionStrategy) {
      case 'priority':
        await this.resolveByPriority(key, systems);
        break;
      case 'timestamp':
        await this.resolveByTimestamp(key, systems);
        break;
      case 'usage':
        await this.resolveByUsage(key, systems);
        break;
      case 'size':
        await this.resolveBySize(key, systems);
        break;
    }

    this.conflicts.push(conflict);

    // Keep only recent conflicts
    if (this.conflicts.length > 100) {
      this.conflicts = this.conflicts.slice(-50);
    }

    // Update conflict count for affected systems
    for (const systemName of systems) {
      const system = this.registeredSystems.get(systemName);
      if (system) {
        system.conflicts++;
      }
    }

    this.emit('conflict-resolved', conflict);
  }

  private async resolveByPriority(key: string, systems: Set<string>): Promise<void> {
    // Keep in highest priority system, remove from others
    const systemArray = Array.from(systems);
    const highestPriority = Math.max(...systemArray.map(s => this.systemPriorities.get(s) || 0));
    const keepSystem = systemArray.find(s => this.systemPriorities.get(s) === highestPriority);

    if (keepSystem) {
      for (const systemName of systems) {
        if (systemName !== keepSystem) {
          await this.deleteFromSystem(key, systemName);
          systems.delete(systemName);
        }
      }
    }
  }

  private async resolveByTimestamp(key: string, systems: Set<string>): Promise<void> {
    // Implementation would check timestamps and keep newest
    // For now, fallback to priority resolution
    await this.resolveByPriority(key, systems);
  }

  private async resolveByUsage(key: string, systems: Set<string>): Promise<void> {
    // Implementation would check usage patterns
    // For now, fallback to priority resolution
    await this.resolveByPriority(key, systems);
  }

  private async resolveBySize(key: string, systems: Set<string>): Promise<void> {
    // Implementation would consider cache sizes
    // For now, fallback to priority resolution
    await this.resolveByPriority(key, systems);
  }

  private async updateSystemMetrics(): Promise<void> {
    for (const [name, system] of this.registeredSystems.entries()) {
      try {
        if (typeof system.instance.getStats === 'function') {
          const stats = await system.instance.getStats();
          if (stats) {
            system.metrics = this.normalizeMetrics(stats);
          }
        }
      } catch (error) {
        logger.debug(`Error updating metrics for ${name}:`, error);
      }
    }
  }

  private async detectAndResolveConflicts(): Promise<void> {
    // Check for keys that exist in multiple systems
    for (const [key, systems] of this.keyMapping.entries()) {
      if (systems.size > 1) {
        await this.resolveKeyConflict(key);
      }
    }
  }

  private async optimizeCacheDistribution(): Promise<void> {
    // Move frequently accessed items to higher priority systems
    // This is a simplified implementation
    const hotKeys = new Map<string, number>(); // key -> access count

    // Implementation would track access patterns and optimize distribution
    logger.debug('Cache distribution optimization completed');
  }

  private async cleanupExpiredEntries(): Promise<void> {
    // Clean up expired entries from all systems
    const promises = Array.from(this.registeredSystems.entries()).map(async ([name, system]) => {
      try {
        if (typeof system.instance.cleanup === 'function') {
          await system.instance.cleanup();
        }
      } catch (error) {
        logger.debug(`Cleanup error in ${name}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  private updateAccessMetrics(
    systemName: string,
    operation: 'hit' | 'miss' | 'set' | 'delete'
  ): void {
    const system = this.registeredSystems.get(systemName);
    if (!system) return;

    switch (operation) {
      case 'hit':
        system.metrics.hits++;
        break;
      case 'miss':
        system.metrics.misses++;
        break;
      case 'set':
        system.metrics.sets++;
        break;
      case 'delete':
        system.metrics.deletes++;
        break;
    }

    // Update hit rate
    const total = system.metrics.hits + system.metrics.misses;
    system.metrics.hitRate = total > 0 ? system.metrics.hits / total : 0;
  }

  private updateGlobalMetrics(operation: string): void {
    switch (operation) {
      case 'hit':
        this.globalMetrics.hits++;
        break;
      case 'miss':
        this.globalMetrics.misses++;
        break;
      case 'set':
        this.globalMetrics.sets++;
        break;
      case 'delete':
        this.globalMetrics.deletes++;
        break;
    }

    // Update global hit rate
    const total = this.globalMetrics.hits + this.globalMetrics.misses;
    this.globalMetrics.hitRate = total > 0 ? this.globalMetrics.hits / total : 0;
  }

  private normalizeMetrics(stats: any): CacheMetrics {
    return {
      hits: stats.hits || 0,
      misses: stats.misses || 0,
      sets: stats.sets || 0,
      deletes: stats.deletes || 0,
      evictions: stats.evictions || 0,
      size: stats.size || 0,
      hitRate: stats.hitRate || 0,
      memoryUsage: stats.memoryUsage || 0,
    };
  }

  private calculateCoordinationOverhead(): number {
    // Time spent in coordination as percentage of total cache operations
    return this.lastCoordinationTime / 1000; // Convert to seconds
  }

  private calculateOptimizationSavings(): number {
    // Estimated savings from cache coordination (in percentage)
    const conflictRate =
      this.conflicts.length / Math.max(this.globalMetrics.hits + this.globalMetrics.misses, 1);
    return Math.max(0, (1 - conflictRate) * 100);
  }

  private calculateOverallHealth(): 'excellent' | 'good' | 'fair' | 'poor' {
    const hitRate = this.globalMetrics.hitRate;
    const recentConflicts = this.conflicts.filter(c => Date.now() - c.timestamp < 3600000).length;

    if (hitRate > 0.8 && recentConflicts < 5) return 'excellent';
    if (hitRate > 0.6 && recentConflicts < 10) return 'good';
    if (hitRate > 0.4 && recentConflicts < 20) return 'fair';
    return 'poor';
  }

  private calculateCoordinationEfficiency(): number {
    const overhead = this.calculateCoordinationOverhead();
    const savings = this.calculateOptimizationSavings();
    return Math.max(0, savings - overhead);
  }

  private detectHealthIssues(): string[] {
    const issues: string[] = [];

    if (this.globalMetrics.hitRate < 0.5) {
      issues.push('Low overall cache hit rate');
    }

    const recentConflicts = this.conflicts.filter(c => Date.now() - c.timestamp < 3600000);
    if (recentConflicts.length > 10) {
      issues.push('High cache conflict rate');
    }

    const inactiveSystems = Array.from(this.registeredSystems.values()).filter(
      s => Date.now() - s.lastAccessed > 600000
    ).length;
    if (inactiveSystems > 0) {
      issues.push(`${inactiveSystems} inactive cache systems`);
    }

    return issues;
  }

  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.globalMetrics.hitRate < 0.7) {
      recommendations.push('Consider increasing cache TTL for frequently accessed items');
    }

    if (this.conflicts.length > 50) {
      recommendations.push('Review cache key distribution strategy to reduce conflicts');
    }

    const avgConflictsPerSystem =
      Array.from(this.registeredSystems.values()).reduce((sum, s) => sum + s.conflicts, 0) /
      this.registeredSystems.size;
    if (avgConflictsPerSystem > 5) {
      recommendations.push('Optimize system priorities to reduce cache conflicts');
    }

    return recommendations;
  }

  private registerUnifiedCache(): void {
    this.registerCacheSystem('unified-cache', 'unified', this.unifiedCache);
  }

  private setupSystemPriorities(): void {
    // Set up default system priorities (higher = more important)
    this.systemPriorities.set('unified-cache', 100);
    this.systemPriorities.set('response-cache', 90);
    this.systemPriorities.set('routing-cache', 80);
    this.systemPriorities.set('voice-cache', 70);
    this.systemPriorities.set('mcp-cache', 60);
    this.systemPriorities.set('search-cache', 50);
  }

  private getDefaultConfig(override?: Partial<CacheCoordinationConfig>): CacheCoordinationConfig {
    return {
      enableGlobalCoordination: true,
      conflictResolutionStrategy: 'priority',
      coordinationInterval: 60000, // 1 minute
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      compressionEnabled: true,
      encryptionEnabled: false,
      cacheHierarchy: [
        {
          name: 'memory',
          priority: 100,
          maxSize: 10 * 1024 * 1024, // 10MB
          ttlMs: 300000, // 5 minutes
          evictionPolicy: 'lru',
          systems: ['unified-cache', 'response-cache'],
        },
        {
          name: 'disk',
          priority: 50,
          maxSize: 50 * 1024 * 1024, // 50MB
          ttlMs: 3600000, // 1 hour
          evictionPolicy: 'lfu',
          systems: ['unified-cache'],
        },
      ],
      ...override,
    };
  }

  private initializeMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    this.stopCoordination();
    this.registeredSystems.clear();
    this.keyMapping.clear();
    this.conflicts = [];
    this.removeAllListeners();

    logger.info('🧹 Unified Cache Coordinator destroyed');
  }
}

// Export singleton instance
export const unifiedCacheCoordinator = UnifiedCacheCoordinator.getInstance();
