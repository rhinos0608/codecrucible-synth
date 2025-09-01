/**
 * Tool Metadata Cache with Lazy Loading
 * 
 * Implements Phase 2 caching requirements:
 * - Cache tool descriptions and schemas
 * - Reduce repeated JSON parsing
 * - Implement lazy loading for tool discovery
 * - Cache validation results and execution context
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { UnifiedCacheService } from './unified-cache-service.js';
import { PerformanceProfiler } from '../performance/profiler.js';

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  schema: any; // JSON schema for parameters
  parsedSchema?: any; // Pre-parsed schema object
  permissions: Array<{
    type: string;
    resource: string;
    level: 'read' | 'write' | 'execute';
  }>;
  securityLevel: 'safe' | 'restricted' | 'dangerous';
  examples?: string[];
  tags: string[];
  providerInfo: {
    providerId: string;
    serverType: 'mcp' | 'builtin' | 'plugin';
    connectionInfo?: any;
  };
  executionInfo: {
    averageLatency: number;
    successRate: number;
    lastExecuted?: number;
    executionCount: number;
    errorRate: number;
  };
  validationCache: Map<string, { valid: boolean; errors?: string[]; timestamp: number }>;
}

export interface LazyLoadConfig {
  batchSize: number;
  loadTimeout: number;
  retryAttempts: number;
  preloadCategories: string[];
  backgroundLoading: boolean;
  discoveryInterval: number;
}

export interface ToolDiscoveryProvider {
  id: string;
  name: string;
  discoverTools(): Promise<ToolMetadata[]>;
  isAvailable(): Promise<boolean>;
  priority: number;
}

export interface ToolCacheStats {
  totalTools: number;
  loadedTools: number;
  cachedTools: number;
  lazyLoadHits: number;
  lazyLoadMisses: number;
  validationCacheHits: number;
  schemaParseCacheHits: number;
  averageLoadTime: number;
  backgroundDiscoveryRuns: number;
}

/**
 * Tool Metadata Cache with comprehensive lazy loading and performance optimization
 */
export class ToolMetadataCache extends EventEmitter {
  private cacheService: UnifiedCacheService;
  private performanceProfiler?: PerformanceProfiler;
  private config: LazyLoadConfig;
  
  private toolMetadataCache = new Map<string, ToolMetadata>();
  private lazyLoadPromises = new Map<string, Promise<ToolMetadata | null>>();
  private discoveryProviders = new Map<string, ToolDiscoveryProvider>();
  private stats: ToolCacheStats;
  private discoveryInterval?: NodeJS.Timeout;
  private loadingQueue = new Set<string>();
  
  // Cache constants
  private readonly METADATA_TTL = 3600000; // 1 hour
  private readonly VALIDATION_CACHE_TTL = 300000; // 5 minutes
  private readonly SCHEMA_PARSE_TTL = 7200000; // 2 hours
  private readonly DISCOVERY_INTERVAL = 1800000; // 30 minutes

  constructor(
    cacheService: UnifiedCacheService,
    performanceProfiler?: PerformanceProfiler,
    config?: Partial<LazyLoadConfig>
  ) {
    super();
    
    this.cacheService = cacheService;
    this.performanceProfiler = performanceProfiler;
    
    this.config = {
      batchSize: 10,
      loadTimeout: 5000,
      retryAttempts: 3,
      preloadCategories: ['filesystem', 'text', 'analysis'],
      backgroundLoading: true,
      discoveryInterval: this.DISCOVERY_INTERVAL,
      ...config,
    };
    
    this.stats = {
      totalTools: 0,
      loadedTools: 0,
      cachedTools: 0,
      lazyLoadHits: 0,
      lazyLoadMisses: 0,
      validationCacheHits: 0,
      schemaParseCacheHits: 0,
      averageLoadTime: 0,
      backgroundDiscoveryRuns: 0,
    };
    
    this.setupBackgroundDiscovery();
  }

  /**
   * Register a tool discovery provider
   */
  registerDiscoveryProvider(provider: ToolDiscoveryProvider): void {
    this.discoveryProviders.set(provider.id, provider);
    logger.debug('Tool discovery provider registered', { 
      providerId: provider.id, 
      providerName: provider.name 
    });
    
    this.emit('provider-registered', { providerId: provider.id, provider });
  }

  /**
   * Get tool metadata with lazy loading
   */
  async getToolMetadata(toolId: string): Promise<ToolMetadata | null> {
    const startTime = Date.now();
    let profilingSessionId: string | undefined;
    let operationId: string | undefined;
    
    try {
      // Start profiling
      if (this.performanceProfiler) {
        profilingSessionId = this.performanceProfiler.startSession(`tool_metadata_${toolId}`);
        operationId = this.performanceProfiler.startOperation(
          profilingSessionId,
          'tool_metadata_lookup',
          'cache_operation',
          {
            toolId,
            source: 'unknown',
            cacheLevel: 'unknown',
          }
        );
      }

      // Check memory cache first
      const cached = this.toolMetadataCache.get(toolId);
      if (cached) {
        this.stats.lazyLoadHits++;
        
        if (this.performanceProfiler && profilingSessionId && operationId) {
          this.performanceProfiler.endOperation(profilingSessionId, operationId);
          this.performanceProfiler.endSession(profilingSessionId);
        }
        
        logger.debug('Tool metadata cache hit (memory)', { toolId });
        return cached;
      }

      // Check persistent cache
      const cacheKey = `tool_metadata:${toolId}`;
      const persistentCached = await this.cacheService.get<ToolMetadata>(cacheKey);
      if (persistentCached) {
        // Restore validation cache map
        persistentCached.validationCache = new Map(Object.entries(persistentCached.validationCache || {}));
        
        this.toolMetadataCache.set(toolId, persistentCached);
        this.stats.lazyLoadHits++;
        this.stats.cachedTools++;
        
        if (this.performanceProfiler && profilingSessionId && operationId) {
          this.performanceProfiler.endOperation(profilingSessionId, operationId);
          this.performanceProfiler.endSession(profilingSessionId);
        }
        
        logger.debug('Tool metadata cache hit (persistent)', { toolId });
        return persistentCached;
      }

      // Lazy load if not in cache
      this.stats.lazyLoadMisses++;
      const lazyLoaded = await this.lazyLoadToolMetadata(toolId);
      
      const loadTime = Date.now() - startTime;
      this.updateAverageLoadTime(loadTime);
      
      if (this.performanceProfiler && profilingSessionId && operationId) {
        this.performanceProfiler.endOperation(profilingSessionId, operationId);
        this.performanceProfiler.endSession(profilingSessionId);
      }
      
      return lazyLoaded;
    } catch (error) {
      if (this.performanceProfiler && profilingSessionId && operationId) {
        this.performanceProfiler.endOperation(profilingSessionId, operationId, error as Error);
        this.performanceProfiler.endSession(profilingSessionId);
      }
      
      logger.error('Failed to get tool metadata', { toolId, error });
      throw error;
    }
  }

  /**
   * Get cached parsed schema with lazy parsing
   */
  async getParsedSchema(toolId: string): Promise<any | null> {
    const metadata = await this.getToolMetadata(toolId);
    if (!metadata) return null;
    
    // Return cached parsed schema if available
    if (metadata.parsedSchema) {
      this.stats.schemaParseCacheHits++;
      return metadata.parsedSchema;
    }
    
    // Parse and cache schema
    try {
      const parsedSchema = this.parseToolSchema(metadata.schema);
      metadata.parsedSchema = parsedSchema;
      
      // Update cache with parsed schema
      await this.cacheToolMetadata(metadata);
      
      logger.debug('Schema parsed and cached', { toolId });
      return parsedSchema;
    } catch (error) {
      logger.error('Failed to parse tool schema', { toolId, error });
      return null;
    }
  }

  /**
   * Get cached validation result with lazy validation
   */
  async getCachedValidation(
    toolId: string,
    args: Record<string, any>
  ): Promise<{ valid: boolean; errors?: string[] } | null> {
    const metadata = await this.getToolMetadata(toolId);
    if (!metadata) return null;
    
    const argsHash = this.hashArguments(args);
    const cached = metadata.validationCache.get(argsHash);
    
    // Check if cached validation is still valid
    if (cached && Date.now() - cached.timestamp < this.VALIDATION_CACHE_TTL) {
      this.stats.validationCacheHits++;
      logger.debug('Validation cache hit', { toolId, argsHash });
      return { valid: cached.valid, errors: cached.errors };
    }
    
    // Validation not cached or expired
    return null;
  }

  /**
   * Cache validation result
   */
  async cacheValidationResult(
    toolId: string,
    args: Record<string, any>,
    result: { valid: boolean; errors?: string[] }
  ): Promise<void> {
    const metadata = await this.getToolMetadata(toolId);
    if (!metadata) return;
    
    const argsHash = this.hashArguments(args);
    metadata.validationCache.set(argsHash, {
      ...result,
      timestamp: Date.now(),
    });
    
    // Update persistent cache
    await this.cacheToolMetadata(metadata);
    
    logger.debug('Validation result cached', { toolId, argsHash, valid: result.valid });
  }

  /**
   * Batch load tools by category
   */
  async batchLoadByCategory(category: string): Promise<ToolMetadata[]> {
    const categoryTools: ToolMetadata[] = [];
    
    // Get all tools from discovery providers
    const allTools = await this.discoverAllTools();
    const categoryMatches = allTools.filter(tool => 
      tool.category === category || tool.tags.includes(category)
    );
    
    // Load in batches
    for (let i = 0; i < categoryMatches.length; i += this.config.batchSize) {
      const batch = categoryMatches.slice(i, i + this.config.batchSize);
      const loadPromises = batch.map(tool => this.cacheToolMetadata(tool));
      
      await Promise.allSettled(loadPromises);
      categoryTools.push(...batch);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + this.config.batchSize < categoryMatches.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    logger.info('Batch loaded tools by category', { 
      category, 
      toolCount: categoryTools.length 
    });
    
    return categoryTools;
  }

  /**
   * Preload tools in specified categories
   */
  async preloadTools(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting tool metadata preload', { 
        categories: this.config.preloadCategories 
      });
      
      const preloadPromises = this.config.preloadCategories.map(category =>
        this.batchLoadByCategory(category)
      );
      
      const results = await Promise.allSettled(preloadPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      const preloadTime = Date.now() - startTime;
      logger.info('Tool metadata preload completed', {
        successful,
        total: this.config.preloadCategories.length,
        preloadTime,
        loadedTools: this.stats.loadedTools,
      });
      
      this.emit('preload-complete', { 
        successful, 
        total: this.config.preloadCategories.length,
        preloadTime,
      });
    } catch (error) {
      logger.error('Tool metadata preload failed', { error });
      throw error;
    }
  }

  /**
   * Update tool execution statistics
   */
  async updateExecutionStats(toolId: string, success: boolean, latency: number): Promise<void> {
    const metadata = await this.getToolMetadata(toolId);
    if (!metadata) return;
    
    const stats = metadata.executionInfo;
    stats.executionCount++;
    stats.lastExecuted = Date.now();
    
    // Update success rate (exponential moving average)
    const alpha = 0.1; // Smoothing factor
    stats.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * stats.successRate;
    stats.errorRate = 1 - stats.successRate;
    
    // Update average latency (exponential moving average)
    stats.averageLatency = alpha * latency + (1 - alpha) * stats.averageLatency;
    
    // Update cache
    await this.cacheToolMetadata(metadata);
    
    logger.debug('Tool execution stats updated', {
      toolId,
      success,
      latency,
      successRate: stats.successRate.toFixed(3),
      averageLatency: stats.averageLatency.toFixed(2),
    });
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): ToolCacheStats & {
    memoryUsage: number;
    discoveryProviders: number;
    queuedLoads: number;
  } {
    return {
      ...this.stats,
      memoryUsage: this.toolMetadataCache.size,
      discoveryProviders: this.discoveryProviders.size,
      queuedLoads: this.loadingQueue.size,
    };
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    this.toolMetadataCache.clear();
    this.lazyLoadPromises.clear();
    this.loadingQueue.clear();
    
    // Clear tool metadata from persistent cache
    const cacheKeys = await this.cacheService.getKeys('*');
    const toolKeys = cacheKeys.filter((key: string) => key.startsWith('tool_metadata:'));
    
    for (const key of toolKeys as string[]) {
      await this.cacheService.delete(key);
    }
    
    // Reset stats
    this.stats = {
      totalTools: 0,
      loadedTools: 0,
      cachedTools: 0,
      lazyLoadHits: 0,
      lazyLoadMisses: 0,
      validationCacheHits: 0,
      schemaParseCacheHits: 0,
      averageLoadTime: 0,
      backgroundDiscoveryRuns: 0,
    };
    
    logger.info('Tool metadata cache cleared');
    this.emit('cache-cleared');
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private async lazyLoadToolMetadata(toolId: string): Promise<ToolMetadata | null> {
    // Check if already loading
    if (this.lazyLoadPromises.has(toolId)) {
      return this.lazyLoadPromises.get(toolId)!;
    }
    
    // Start lazy loading
    const loadPromise = this.performLazyLoad(toolId);
    this.lazyLoadPromises.set(toolId, loadPromise);
    this.loadingQueue.add(toolId);
    
    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.lazyLoadPromises.delete(toolId);
      this.loadingQueue.delete(toolId);
    }
  }

  private async performLazyLoad(toolId: string): Promise<ToolMetadata | null> {
    const startTime = Date.now();
    
    try {
      logger.debug('Starting lazy load for tool', { toolId });
      
      // Try each discovery provider in priority order
      const providers = Array.from(this.discoveryProviders.values())
        .sort((a, b) => b.priority - a.priority);
      
      for (const provider of providers) {
        if (!(await provider.isAvailable())) {
          continue;
        }
        
        try {
          const tools = await provider.discoverTools();
          const tool = tools.find(t => t.id === toolId || t.name === toolId);
          
          if (tool) {
            await this.cacheToolMetadata(tool);
            this.stats.loadedTools++;
            
            const loadTime = Date.now() - startTime;
            logger.debug('Tool lazy loaded successfully', { 
              toolId, 
              providerId: provider.id,
              loadTime,
            });
            
            this.emit('tool-lazy-loaded', { 
              toolId, 
              providerId: provider.id,
              loadTime,
            });
            
            return tool;
          }
        } catch (error) {
          logger.warn('Discovery provider failed during lazy load', { 
            providerId: provider.id, 
            toolId, 
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      logger.warn('Tool not found during lazy load', { toolId });
      return null;
    } catch (error) {
      logger.error('Lazy load failed', { toolId, error });
      return null;
    }
  }

  private async cacheToolMetadata(metadata: ToolMetadata): Promise<void> {
    // Cache in memory
    this.toolMetadataCache.set(metadata.id, metadata);
    
    // Cache persistently (convert Map to Object for serialization)
    const cacheableMetadata = {
      ...metadata,
      validationCache: Object.fromEntries(metadata.validationCache),
    };
    
    const cacheKey = `tool_metadata:${metadata.id}`;
    await this.cacheService.set(cacheKey, cacheableMetadata, {
      ttl: this.METADATA_TTL,
      tags: ['tool_metadata', metadata.category, ...metadata.tags],
      priority: metadata.securityLevel === 'safe' ? 'high' : 'normal',
      metadata: {
        toolName: metadata.name,
        category: metadata.category,
        provider: metadata.providerInfo.providerId,
      },
    });
    
    this.stats.cachedTools++;
  }

  private async discoverAllTools(): Promise<ToolMetadata[]> {
    const allTools: ToolMetadata[] = [];
    
    const providers = Array.from(this.discoveryProviders.values())
      .sort((a, b) => b.priority - a.priority);
    
    for (const provider of providers) {
      try {
        if (await provider.isAvailable()) {
          const tools = await provider.discoverTools();
          allTools.push(...tools);
        }
      } catch (error) {
        logger.error('Tool discovery failed', { 
          providerId: provider.id, 
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    this.stats.totalTools = allTools.length;
    return allTools;
  }

  private parseToolSchema(schema: any): any {
    // Simple JSON schema parsing - in real implementation,
    // you might use a more sophisticated schema parser
    if (typeof schema === 'string') {
      return JSON.parse(schema);
    }
    return schema;
  }

  private hashArguments(args: Record<string, any>): string {
    // Simple hash of arguments - in production, use a proper hash function
    return Buffer.from(JSON.stringify(args)).toString('base64');
  }

  private updateAverageLoadTime(loadTime: number): void {
    const alpha = 0.1;
    this.stats.averageLoadTime = alpha * loadTime + (1 - alpha) * this.stats.averageLoadTime;
  }

  private setupBackgroundDiscovery(): void {
    if (!this.config.backgroundLoading) return;
    
    this.discoveryInterval = setInterval(async () => {
      try {
        logger.debug('Starting background tool discovery');
        const startTime = Date.now();
        
        await this.discoverAllTools();
        this.stats.backgroundDiscoveryRuns++;
        
        const discoveryTime = Date.now() - startTime;
        logger.debug('Background tool discovery completed', { 
          discoveryTime,
          totalTools: this.stats.totalTools,
        });
        
        this.emit('background-discovery-complete', { 
          discoveryTime,
          totalTools: this.stats.totalTools,
        });
      } catch (error) {
        logger.error('Background tool discovery failed', { error });
      }
    }, this.config.discoveryInterval);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    
    this.toolMetadataCache.clear();
    this.lazyLoadPromises.clear();
    this.discoveryProviders.clear();
    this.loadingQueue.clear();
    
    logger.info('Tool metadata cache destroyed');
  }
}
