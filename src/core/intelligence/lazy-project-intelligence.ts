/**
 * Lazy Project Intelligence System - Performance Optimized
 * Iteration 4: Optimize memory usage and performance
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger.js';
import { ProjectIntelligenceSystem, ProjectIntelligence, AnalysisOptions } from './project-intelligence-system.js';

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
  private logger: Logger;
  private fullSystem: ProjectIntelligenceSystem;
  private cache: Map<string, LazyProjectIntelligence> = new Map();
  private loadingPromises: Map<string, Promise<ProjectIntelligence>> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: PerformanceMetrics = {
    initTime: 0,
    analysisTime: 0,
    memoryUsage: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor() {
    super();
    this.logger = new Logger('LazyProjectIntelligence');
    this.fullSystem = new ProjectIntelligenceSystem();
    
    // Cleanup timer to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanupCache(), 300000); // 5 minutes
  }

  /**
   * Quick initialization with basic project info only
   */
  async quickAnalysis(rootPath: string): Promise<BasicProjectInfo> {
    const startTime = Date.now();
    
    try {
      const basic = await this.extractBasicInfo(rootPath);
      
      // Cache the basic info
      this.cache.set(rootPath, {
        basic,
        loaded: false,
        loading: false
      });
      
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
    const cached = this.cache.get(rootPath);
    
    // Return cached full intelligence if available
    if (cached?.full && !force) {
      this.metrics.cacheHits++;
      return cached.full;
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
      const existing = this.cache.get(rootPath);
      if (existing) {
        existing.full = intelligence;
        existing.loaded = true;
        existing.loading = false;
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
  preloadIntelligence(rootPath: string): void {
    if (!this.cache.has(rootPath) || this.loadingPromises.has(rootPath)) {
      return;
    }
    
    const cached = this.cache.get(rootPath)!;
    if (cached.loaded || cached.loading) {
      return;
    }
    
    cached.loading = true;
    
    // Load in background
    setImmediate(async () => {
      try {
        await this.getFullIntelligence(rootPath);
      } catch (error) {
        this.logger.warn(`Background preload failed: ${error}`);
        cached.loading = false;
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
        fileCount
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
      maxFileSize: 512 * 1024 // 512KB limit
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
    const { basename } = require('path');
    return {
      name: basename(rootPath),
      type: 'unknown',
      language: 'Unknown',
      hasPackageJson: false,
      hasTestDir: false,
      estimatedSize: 'medium',
      fileCount: 0
    };
  }

  /**
   * Cleanup old cache entries to prevent memory leaks
   */
  private cleanupCache(): void {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    
    // This is a simple cleanup - in production, we'd track timestamps
    if (this.cache.size > 10) {
      const entries = Array.from(this.cache.entries());
      const toRemove = entries.slice(0, Math.floor(entries.length / 2));
      
      for (const [path] of toRemove) {
        this.cache.delete(path);
        this.logger.debug(`Cleaned up cache entry for ${path}`);
      }
    }
  }

  /**
   * Get cached basic info
   */
  getBasicInfo(rootPath: string): BasicProjectInfo | null {
    return this.cache.get(rootPath)?.basic || null;
  }

  /**
   * Check if full intelligence is loaded
   */
  isFullyLoaded(rootPath: string): boolean {
    return this.cache.get(rootPath)?.loaded || false;
  }

  /**
   * Check if currently loading
   */
  isLoading(rootPath: string): boolean {
    return this.cache.get(rootPath)?.loading || this.loadingPromises.has(rootPath);
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
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    this.fullSystem.clearCache();
    this.metrics = {
      initTime: 0,
      analysisTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clearCache();
    this.removeAllListeners();
  }
}

export default LazyProjectIntelligenceSystem;