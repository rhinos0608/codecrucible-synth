/**
 * 2025 CLI Performance Optimization Patterns
 * Implements modern Node.js performance patterns for sub-200ms startup times
 */

import { performance } from 'perf_hooks';
import { logger } from '../logger.js';

export interface StartupMetrics {
  phase: string;
  duration: number;
  timestamp: number;
  cumulativeTime: number;
}

export interface LazyLoadableModule {
  name: string;
  importPath: string;
  condition: () => boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export class FastStartupOptimizer {
  private static instance: FastStartupOptimizer;
  private startupTime: number = performance.now();
  private metrics: StartupMetrics[] = [];
  private moduleCache = new Map<string, any>();
  private initializationPromises = new Map<string, Promise<any>>();

  // 2025 Pattern: Critical Path Detection
  private criticalModules = new Set([
    'logger',
    'error-utils',
    'cli-parser',
    'process-management'
  ]);

  // 2025 Pattern: Lazy Loading Registry
  private lazyModules: LazyLoadableModule[] = [
    {
      name: 'UnifiedModelClient',
      importPath: '../../refactor/unified-model-client.js',
      condition: () => this.isAIOperationRequested(),
      priority: 'high'
    },
    {
      name: 'VoiceArchetypeSystem', 
      importPath: '../../voices/voice-archetype-system.js',
      condition: () => this.isMultiVoiceRequested(),
      priority: 'medium'
    },
    {
      name: 'MCPServerManager',
      importPath: '../../mcp-servers/mcp-server-manager.js',
      condition: () => this.isMCPOperationRequested(),
      priority: 'medium'
    },
    {
      name: 'SecurityValidator',
      importPath: '../security/security-validator.js',
      condition: () => this.isSecurityValidationRequired(),
      priority: 'high'
    },
    {
      name: 'PerformanceMonitor',
      importPath: '../../utils/performance.js',
      condition: () => this.isPerformanceMonitoringEnabled(),
      priority: 'low'
    }
  ];

  private constructor() {
    this.recordPhase('startup-optimizer-init');
  }

  static getInstance(): FastStartupOptimizer {
    if (!FastStartupOptimizer.instance) {
      FastStartupOptimizer.instance = new FastStartupOptimizer();
    }
    return FastStartupOptimizer.instance;
  }

  /**
   * 2025 Pattern: Dynamic Import with Caching
   */
  async loadModule<T>(modulePath: string, cacheName?: string): Promise<T> {
    const cacheKey = cacheName || modulePath;
    
    if (this.moduleCache.has(cacheKey)) {
      return this.moduleCache.get(cacheKey);
    }

    // 2025 Pattern: Promise Deduplication
    if (this.initializationPromises.has(cacheKey)) {
      return this.initializationPromises.get(cacheKey);
    }

    const startTime = performance.now();
    const importPromise = import(modulePath).then(module => {
      const endTime = performance.now();
      logger.debug(`Module loaded: ${cacheKey} (${Math.round(endTime - startTime)}ms)`);
      
      this.moduleCache.set(cacheKey, module);
      this.initializationPromises.delete(cacheKey);
      
      return module;
    });

    this.initializationPromises.set(cacheKey, importPromise);
    return importPromise;
  }

  /**
   * 2025 Pattern: Conditional Module Loading
   */
  async loadConditionalModules(args: string[]): Promise<Map<string, any>> {
    const loadedModules = new Map<string, any>();
    const loadPromises: Promise<void>[] = [];

    // Set context for condition evaluation
    this.setExecutionContext(args);

    for (const moduleConfig of this.lazyModules) {
      if (moduleConfig.condition()) {
        const promise = this.loadModule(moduleConfig.importPath, moduleConfig.name)
          .then(module => {
            loadedModules.set(moduleConfig.name, module);
          })
          .catch(error => {
            logger.warn(`Failed to load module ${moduleConfig.name}:`, error);
          });
        
        // 2025 Pattern: Priority-based Loading
        if (moduleConfig.priority === 'critical' || moduleConfig.priority === 'high') {
          await promise; // Block for high priority modules
        } else {
          loadPromises.push(promise); // Parallel load for lower priority
        }
      }
    }

    // Wait for all parallel loads to complete
    await Promise.allSettled(loadPromises);
    
    this.recordPhase('conditional-modules-loaded');
    return loadedModules;
  }

  /**
   * 2025 Pattern: Fast Path Detection
   */
  shouldUseFastPath(args: string[]): boolean {
    const fastPathCommands = new Set([
      '--help', '-h',
      '--version', '-v', 
      'status',
      'models'
    ]);

    // Check if any argument matches fast path
    return args.some(arg => fastPathCommands.has(arg) || fastPathCommands.has(arg.toLowerCase()));
  }

  /**
   * 2025 Pattern: Warm Cache Strategy
   */
  async warmCriticalModules(): Promise<void> {
    const warmPromises = Array.from(this.criticalModules).map(async (moduleName) => {
      try {
        // Map module names to actual import paths
        const importPath = this.getImportPathForModule(moduleName);
        if (importPath) {
          await this.loadModule(importPath, moduleName);
        }
      } catch (error) {
        logger.debug(`Failed to warm cache for ${moduleName}:`, error);
      }
    });

    await Promise.allSettled(warmPromises);
    this.recordPhase('critical-modules-warmed');
  }

  /**
   * 2025 Pattern: Memory-Efficient Connection Pooling
   */
  createConnectionPool(maxConnections: number = 3) {
    const pool = {
      active: new Set<any>(),
      idle: new Set<any>(),
      waiting: [] as Array<(connection: any) => void>,
      
      acquire: async () => {
        if (pool.idle.size > 0) {
          const connection = pool.idle.values().next().value;
          pool.idle.delete(connection);
          pool.active.add(connection);
          return connection;
        }
        
        if (pool.active.size < maxConnections) {
          const connection = await pool.createConnection();
          pool.active.add(connection);
          return connection;
        }
        
        return new Promise<any>((resolve) => {
          pool.waiting.push(resolve);
        });
      },

      release: (connection: any) => {
        pool.active.delete(connection);
        
        if (pool.waiting.length > 0) {
          const waiter = pool.waiting.shift();
          if (waiter) {
            pool.active.add(connection);
            waiter(connection);
          }
        } else {
          pool.idle.add(connection);
        }
      },

      createConnection: async () => {
        // Placeholder for actual connection creation
        return { id: Date.now(), created: performance.now() };
      }
    };
    return pool;
  }

  /**
   * Context evaluation methods for lazy loading conditions
   */
  private executionContext = {
    args: [] as string[],
    hasAIFlag: false,
    hasVoiceFlag: false,
    hasMCPFlag: false,
    hasSecurityFlag: false,
    hasMonitoringFlag: false
  };

  private setExecutionContext(args: string[]): void {
    this.executionContext.args = args;
    this.executionContext.hasAIFlag = args.some(arg => 
      arg.includes('generate') || arg.includes('analyze') || arg.includes('--voices')
    );
    this.executionContext.hasVoiceFlag = args.some(arg => 
      arg.includes('--voices') || arg.includes('multi-voice')
    );
    this.executionContext.hasMCPFlag = args.some(arg =>
      arg.includes('mcp') || arg.includes('tools') || arg.includes('execute')
    );
    this.executionContext.hasSecurityFlag = args.some(arg =>
      arg.includes('--secure') || arg.includes('validate')
    );
    this.executionContext.hasMonitoringFlag = args.some(arg =>
      arg.includes('--monitor') || arg.includes('--performance')
    );
  }

  private isAIOperationRequested(): boolean {
    return this.executionContext.hasAIFlag || 
           this.executionContext.args.length > 0 && 
           !this.shouldUseFastPath(this.executionContext.args);
  }

  private isMultiVoiceRequested(): boolean {
    return this.executionContext.hasVoiceFlag;
  }

  private isMCPOperationRequested(): boolean {
    return this.executionContext.hasMCPFlag || this.isAIOperationRequested();
  }

  private isSecurityValidationRequired(): boolean {
    return this.executionContext.hasSecurityFlag || this.isAIOperationRequested();
  }

  private isPerformanceMonitoringEnabled(): boolean {
    return this.executionContext.hasMonitoringFlag || process.env.NODE_ENV !== 'production';
  }

  /**
   * Module path mapping
   */
  private getImportPathForModule(moduleName: string): string | null {
    const pathMap: Record<string, string> = {
      'logger': '../logger.js',
      'error-utils': '../../utils/error-utils.js',
      'cli-parser': '../cli/cli-parser.js',
      'process-management': './active-process-manager.js'
    };
    
    return pathMap[moduleName] || null;
  }

  /**
   * Performance tracking
   */
  private recordPhase(phase: string): void {
    const now = performance.now();
    const duration = this.metrics.length > 0 
      ? now - this.metrics[this.metrics.length - 1].timestamp
      : now - this.startupTime;
    
    this.metrics.push({
      phase,
      duration: Math.round(duration * 100) / 100, // 2 decimal precision
      timestamp: now,
      cumulativeTime: Math.round((now - this.startupTime) * 100) / 100
    });
  }

  /**
   * Get startup performance metrics
   */
  getStartupMetrics(): {
    totalTime: number;
    phases: StartupMetrics[];
    recommendations: string[];
  } {
    const totalTime = performance.now() - this.startupTime;
    
    const recommendations = [];
    if (totalTime > 500) {
      recommendations.push('Consider reducing module imports for better startup time');
    }
    if (totalTime > 200) {
      recommendations.push('Apply more aggressive lazy loading patterns');
    }
    
    return {
      totalTime: Math.round(totalTime * 100) / 100,
      phases: this.metrics,
      recommendations
    };
  }

  /**
   * 2025 Pattern: Intelligent Preloading
   */
  async intelligentPreload(): Promise<void> {
    // Only preload if we detect patterns suggesting heavy usage
    const shouldPreload = this.executionContext.args.some(arg => 
      arg.includes('interactive') || 
      arg.includes('server') ||
      arg.length > 50 // Long prompts suggest complex operations
    );

    if (shouldPreload) {
      logger.debug('Intelligent preloading enabled - loading additional modules');
      await this.loadConditionalModules(this.executionContext.args);
    }
  }

  /**
   * Reset for testing
   */
  reset(): void {
    this.startupTime = performance.now();
    this.metrics = [];
    this.moduleCache.clear();
    this.initializationPromises.clear();
  }
}

/**
 * 2025 Pattern: Export singleton for global access
 */
export const fastStartupOptimizer = FastStartupOptimizer.getInstance();

/**
 * 2025 Pattern: CLI-specific fast initialization
 */
export async function initializeWithFastStartup(args: string[]): Promise<{
  modules: Map<string, any>;
  metrics: ReturnType<FastStartupOptimizer['getStartupMetrics']>;
  usedFastPath: boolean;
}> {
  const optimizer = FastStartupOptimizer.getInstance();
  
  const usedFastPath = optimizer.shouldUseFastPath(args);
  
  if (usedFastPath) {
    // Fast path: minimal initialization
    logger.debug('Fast path detected - minimal initialization');
    await optimizer.warmCriticalModules();
  } else {
    // Full path: conditional loading based on requirements
    await optimizer.warmCriticalModules();
    await optimizer.intelligentPreload();
  }
  
  const modules = await optimizer.loadConditionalModules(args);
  const metrics = optimizer.getStartupMetrics();
  
  return {
    modules,
    metrics,
    usedFastPath
  };
}