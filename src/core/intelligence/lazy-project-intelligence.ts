/**
 * Lazy Project Intelligence System - Performance Optimized
 * Iteration 4: Optimize memory usage and performance
 */

import { EventEmitter } from 'events';
import { basename } from 'path';
import { logger } from '../logger.js';
import { unifiedCache } from '../../infrastructure/cache/unified-cache-system.js';
import {
  ProjectIntelligenceSystem,
  ProjectIntelligence,
  AnalysisOptions,
} from './project-intelligence-system.js';

export interface LazyProjectIntelligence {
  basic: BasicProjectInfo;
  full?: ProjectIntelligence;
  loaded: boolean;
  loading: boolean;
}

export interface BasicProjectInfo {
  name: string;
  type: 'library' | 'application' | 'service' | 'unknown';
  language: string;
  hasPackageJson: boolean;
  hasTestDir: boolean;
  estimatedSize: 'small' | 'medium' | 'large' | 'huge';
  fileCount: number;
}

export interface PerformanceMetrics {
  initTime: number;
  analysisTime: number;
  memoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
}

export class LazyProjectIntelligenceSystem extends EventEmitter {
  private logger: typeof logger;
  private fullSystem: ProjectIntelligenceSystem;
  private loadingPromises: Map<string, Promise<ProjectIntelligence>> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: PerformanceMetrics = {
    initTime: 0,
    analysisTime: 0,
    memoryUsage: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor() {
    super();
    this.logger = logger;
    this.fullSystem = new ProjectIntelligenceSystem();

    // Cleanup timer to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanupCache(), 300000); // 5 minutes
    // TODO: Store interval ID and call clearInterval in cleanup
  }

  /**
   * Quick initialization with basic project info only
   */
  async quickAnalysis(rootPath: string): Promise<BasicProjectInfo> {
    const startTime = Date.now();

    try {
      const basic = await this.extractBasicInfo(rootPath);

      // Cache the basic info
      const cacheKey = `lazy-intel-basic:${rootPath}`;
      await unifiedCache.set(
        cacheKey,
        {
          basic,
          loaded: false,
          loading: false,
        },
        { ttl: 3600000, tags: ['lazy-project-intelligence', 'basic-info'] }
      );

      this.metrics.initTime = Date.now() - startTime;
      this.logger.info(`Quick analysis completed in ${this.metrics.initTime}ms`);

      return basic;
    } catch (error) {
      this.logger.warn(`Quick analysis failed: ${error}`);
      return this.getDefaultBasicInfo(rootPath);
    }
  }

  /**
   * Get full project intelligence (lazy loaded)
   */
  async getFullIntelligence(rootPath: string, force = false): Promise<ProjectIntelligence | null> {
    const cacheKey = `lazy-intel-basic:${rootPath}`;
    const cached = await unifiedCache.get<LazyProjectIntelligence>(cacheKey);

    // Return cached full intelligence if available
    if (cached?.value?.full && !force) {
      this.metrics.cacheHits++;
      return cached.value.full;
    }

    // Check if already loading
    if (this.loadingPromises.has(rootPath)) {
      return await this.loadingPromises.get(rootPath)!;
    }

    this.metrics.cacheMisses++;

    // Start loading
    const loadingPromise = this.loadFullIntelligence(rootPath);
    this.loadingPromises.set(rootPath, loadingPromise);

    try {
      const intelligence = await loadingPromise;

      // Update cache
      const existingCached = await unifiedCache.get<LazyProjectIntelligence>(cacheKey);
      if (existingCached?.value) {
        const updated = {
          ...existingCached.value,
          full: intelligence,
          loaded: true,
          loading: false,
        };
        await unifiedCache.set(cacheKey, updated, {
          ttl: 3600000,
          tags: ['lazy-project-intelligence', 'full-intel'],
        });
      }

      this.emit('intelligence:loaded', { rootPath, intelligence });
      return intelligence;
    } finally {
      this.loadingPromises.delete(rootPath);
    }
  }

  /**
   * Load full intelligence in background without blocking
   */
  async preloadIntelligence(rootPath: string): Promise<void> {
    const cacheKey = `lazy-intel-basic:${rootPath}`;
    const cached = await unifiedCache.get<LazyProjectIntelligence>(cacheKey);

    if (!cached?.value || this.loadingPromises.has(rootPath)) {
      return;
    }

    if (cached.value.loaded || cached.value.loading) {
      return;
    }

    const updated = { ...cached.value, loading: true };
    await unifiedCache.set(cacheKey, updated, {
      ttl: 3600000,
      tags: ['lazy-project-intelligence'],
    });

    // Load in background
    setImmediate(async () => {
      try {
        await this.getFullIntelligence(rootPath);
      } catch (error) {
        this.logger.warn(`Background preload failed: ${error}`);
        const cachedData = await unifiedCache.get<LazyProjectIntelligence>(cacheKey);
        if (cachedData?.value) {
          const updated = { ...cachedData.value, loading: false };
          await unifiedCache.set(cacheKey, updated, {
            ttl: 3600000,
            tags: ['lazy-project-intelligence'],
          });
        }
      }
    });
  }

  /**
   * Extract basic project information quickly
   */
  private async extractBasicInfo(rootPath: string): Promise<BasicProjectInfo> {
    const { readdir, stat, readFile } = await import('fs/promises');
    const { join, basename } = await import('path');

    let name = basename(rootPath);
    let type: BasicProjectInfo['type'] = 'unknown';
    let language = 'Unknown';
    let hasPackageJson = false;
    let hasTestDir = false;
    let fileCount = 0;

    try {
      // Quick directory scan (non-recursive)
      const entries = await readdir(rootPath, { withFileTypes: true });
      fileCount = entries.length;

      // Look for key indicators
      for (const entry of entries) {
        const entryName = entry.name.toLowerCase();

        if (entry.isFile()) {
          // Package files
          if (entryName === 'package.json') {
            hasPackageJson = true;
            try {
              const packageContent = await readFile(join(rootPath, entry.name), 'utf8');
              const packageJson = JSON.parse(packageContent);
              name = packageJson.name || name;

              // Determine type from package.json
              if (packageJson.main || packageJson.bin) {
                type = packageJson.bin ? 'application' : 'library';
              }
            } catch (error) {
              // Ignore parsing errors
            }
          }

          // Language detection
          if (entryName.endsWith('.ts') || entryName.endsWith('.tsx')) {
            language = 'TypeScript';
          } else if (entryName.endsWith('.js') || entryName.endsWith('.jsx')) {
            language = language === 'Unknown' ? 'JavaScript' : language;
          } else if (entryName.endsWith('.py')) {
            language = language === 'Unknown' ? 'Python' : language;
          } else if (entryName.endsWith('.rs')) {
            language = 'Rust';
          } else if (entryName.endsWith('.go')) {
            language = 'Go';
          }
        } else if (entry.isDirectory()) {
          // Test directories
          if (entryName === 'test' || entryName === 'tests' || entryName === '__tests__') {
            hasTestDir = true;
          }

          // Service indicators
          if (entryName === 'api' || entryName === 'server' || entryName === 'service') {
            type = type === 'unknown' ? 'service' : type;
          }
        }
      }

      // Estimate project size
      const estimatedSize = this.estimateProjectSize(fileCount);

      return {
        name,
        type,
        language,
        hasPackageJson,
        hasTestDir,
        estimatedSize,
        fileCount,
      };
    } catch (error) {
      this.logger.warn(`Basic info extraction failed: ${error}`);
      return this.getDefaultBasicInfo(rootPath);
    }
  }

  /**
   * Load full intelligence using the main system
   */
  private async loadFullIntelligence(rootPath: string): Promise<ProjectIntelligence> {
    const startTime = Date.now();

    const options: AnalysisOptions = {
      force: false,
      maxDepth: 4, // Reduced depth for performance
      skipLargeFiles: true,
      maxFileSize: 512 * 1024, // 512KB limit
    };

    const intelligence = await this.fullSystem.analyzeProject(rootPath, options);

    this.metrics.analysisTime = Date.now() - startTime;
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;

    return intelligence;
  }

  /**
   * Estimate project size based on file count
   */
  private estimateProjectSize(fileCount: number): BasicProjectInfo['estimatedSize'] {
    if (fileCount < 20) return 'small';
    if (fileCount < 100) return 'medium';
    if (fileCount < 500) return 'large';
    return 'huge';
  }

  /**
   * Get default basic info when analysis fails
   */
  private getDefaultBasicInfo(rootPath: string): BasicProjectInfo {
    return {
      name: basename(rootPath),
      type: 'unknown',
      language: 'Unknown',
      hasPackageJson: false,
      hasTestDir: false,
      estimatedSize: 'medium',
      fileCount: 0,
    };
  }

  /**
   * Cleanup old cache entries - now handled by unified cache TTL
   */
  private cleanupCache(): void {
    // Cache cleanup is now handled automatically by unified cache TTL
    // This method is kept for compatibility but no longer needed
  }

  /**
   * Get cached basic info
   */
  async getBasicInfo(rootPath: string): Promise<BasicProjectInfo | null> {
    const cacheKey = `lazy-intel-basic:${rootPath}`;
    const cached = await unifiedCache.get<LazyProjectIntelligence>(cacheKey);
    return cached?.value?.basic || null;
  }

  /**
   * Check if full intelligence is loaded
   */
  async isFullyLoaded(rootPath: string): Promise<boolean> {
    const cacheKey = `lazy-intel-basic:${rootPath}`;
    const cached = await unifiedCache.get<LazyProjectIntelligence>(cacheKey);
    return cached?.value?.loaded || false;
  }

  /**
   * Check if currently loading
   */
  async isLoading(rootPath: string): Promise<boolean> {
    const cacheKey = `lazy-intel-basic:${rootPath}`;
    const cached = await unifiedCache.get<LazyProjectIntelligence>(cacheKey);
    return cached?.value?.loading || this.loadingPromises.has(rootPath);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await unifiedCache.clearByTags(['lazy-project-intelligence']);
    this.loadingPromises.clear();
    await this.fullSystem.clearCache();
    this.metrics = {
      initTime: 0,
      analysisTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    await this.clearCache();
    this.removeAllListeners();
  }
}

export default LazyProjectIntelligenceSystem;
