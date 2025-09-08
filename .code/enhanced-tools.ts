/**
 * Enhanced Tool Integration System
 * Advanced tool integration with performance monitoring, caching, and intelligent routing
 */

import { LLMFunction, RustExecutionBackend, ToolCall, ToolIntegration } from './tool-integration.js';
import { DomainAwareToolOrchestrator } from './domain-aware-tool-orchestrator.js';
import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { EventEmitter } from 'events';

export interface EnhancedToolConfig {
  enableCaching: boolean;
  cacheSize: number;
  cacheTTL: number;
  enablePerformanceMonitoring: boolean;
  maxConcurrentTools: number;
  timeout: number;
  retryAttempts: number;
  enableIntelligentRouting: boolean;
}

export interface ToolExecutionMetrics {
  executionTime: number;
  success: boolean;
  toolName: string;
  timestamp: number;
  cacheHit?: boolean;
  retryCount?: number;
}

export interface ToolExecutionContext {
  sessionId?: string;
  userId?: string;
  priority: 'low' | 'medium' | 'high';
  domain?: string;
  metadata?: Record<string, unknown>;
}

export class EnhancedToolIntegration extends EventEmitter {
  private readonly baseToolIntegration: ToolIntegration;
  private readonly orchestrator: DomainAwareToolOrchestrator;
  private config: EnhancedToolConfig;
  private readonly executionCache: Map<string, { result: unknown; timestamp: number; ttl: number }> = new Map();
  private readonly metrics: ToolExecutionMetrics[] = [];
  private readonly activeExecutions: Set<string> = new Set();
  private cacheCleanupInterval?: NodeJS.Timeout;

  public constructor(config?: Readonly<Partial<EnhancedToolConfig>>, rustBackend?: unknown) {
    super();

    this.config = {
      enableCaching: true,
      cacheSize: 1000,
      cacheTTL: 300000, // 5 minutes
      enablePerformanceMonitoring: true,
      maxConcurrentTools: 10,
      timeout: 30000, // 30 seconds
      retryAttempts: 2,
      enableIntelligentRouting: true,
      ...config,
    };

    // Create a basic MCP manager for tool integration
    const mcpConfig = {
      filesystem: {
        enabled: true,
        restrictedPaths: [] as string[],
        allowedPaths: [process.cwd()],
      },
      git: {
        enabled: false,
        autoCommitMessages: false,
        safeModeEnabled: true,
      },
      terminal: {
        enabled: false,
        allowedCommands: [] as string[],
        blockedCommands: ['rm', 'del', 'rmdir'],
      },
      packageManager: {
        enabled: false,
        autoInstall: false,
        securityScan: true,
      },
      smithery: {
        enabled: !!process.env.SMITHERY_API_KEY,
        apiKey: process.env.SMITHERY_API_KEY,
        enabledServers: [] as string[],
        autoDiscovery: true,
      },
    };
  const mcpManager = new MCPServerManager(mcpConfig);
  this.baseToolIntegration = new ToolIntegration(
    mcpManager,
    rustBackend as Readonly<RustExecutionBackend> | undefined
  );
  this.orchestrator = new DomainAwareToolOrchestrator();

  this.setupCacheCleanup();
  }

  public async executeToolCall(
    toolCall: Readonly<ToolCall>,
    context: Readonly<ToolExecutionContext> = { priority: 'medium' }
  ): Promise<unknown> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId(toolCall, context);

    try {
      // Check active executions limit
      if (this.activeExecutions.size >= this.config.maxConcurrentTools) {
        throw new Error('Maximum concurrent tool executions reached');
      }

      this.activeExecutions.add(executionId);

      // Check cache first
      if (this.config.enableCaching) {
        const cached: unknown = this.getCachedResult(toolCall);
        if (cached !== null && cached !== undefined) {
          this.recordMetrics(toolCall.function.name, startTime, true, true);
          return cached;
        }
      }

      // Use intelligent routing if enabled
      let result: unknown;
      if (this.config.enableIntelligentRouting && context.domain) {
        // Use the orchestrator to analyze the domain and then execute with base integration
        const toolPrompt = `${toolCall.function.name}: ${toolCall.function.arguments}`;
        // Map LLMFunction[] to expected tool shape
        const availableTools = (await this.baseToolIntegration.getLLMFunctions()).map(fn => ({
          name: fn.function.name,
          function: { name: fn.function.name }
        }));
        const domainAnalysis = this.orchestrator.getToolsForPrompt(
          toolPrompt,
          availableTools
        );
        // Log domain analysis for debugging
        console.log('Domain analysis:', domainAnalysis);
        result = await this.executeWithRetry(toolCall, context);
      } else {
        result = await this.executeWithRetry(toolCall, context);
      }

      // Cache result if caching is enabled
      if (this.config.enableCaching && this.shouldCacheResult(result)) {
        this.cacheResult(toolCall, result);
      }

      this.recordMetrics(toolCall.function.name, startTime, true, false);
      return result;
    } catch (error: any) {
      this.recordMetrics(toolCall.function.name, startTime, false, false);
      logger.error(
        `Enhanced tool execution failed for ${toolCall.function.name}:`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  public async getAvailableTools(domain?: string): Promise<LLMFunction[]> {
    const baseFunctions: LLMFunction[] = await this.baseToolIntegration.getLLMFunctions();

    if (domain && this.config.enableIntelligentRouting) {
      // Map LLMFunction[] to expected tool shape
      const availableTools = baseFunctions.map(fn => ({
        name: fn.function.name,
        function: { name: fn.function.name }
      }));
      const domainPrompt = `Tools needed for ${domain} domain`;
      const domainTools = this.orchestrator.getToolsForPrompt(domainPrompt, availableTools);
      // Convert back to LLMFunction[] by matching names
      const selectedNames = new Set(domainTools.tools.map(t => t.function?.name ?? t.name));
      return baseFunctions.filter(fn => selectedNames.has(fn.function.name));
    }

    return baseFunctions;
  }

  public async batchExecuteTools(
    toolCalls: ReadonlyArray<ToolCall>,
    context: Readonly<ToolExecutionContext> = { priority: 'medium' }
  ): Promise<unknown[]> {
    // Execute tools in batches respecting concurrency limits
    const results: unknown[] = [];
    const batchSize = Math.min(toolCalls.length, this.config.maxConcurrentTools);

    for (let i = 0; i < toolCalls.length; i += batchSize) {
      const batch = toolCalls.slice(i, i + batchSize);
      const batchPromises = batch.map(async (toolCall: Readonly<ToolCall>) => this.executeToolCall(toolCall, context));

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(
        ...batchResults.map((result: PromiseSettledResult<unknown>) =>
          result.status === 'fulfilled'
            ? result.value
            : { error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
        )
      );
    }

    return results;
  }

  public getExecutionMetrics(): ToolExecutionMetrics[] {
    return [...this.metrics];
  }

  public getPerformanceStats(): {
    enabled: boolean;
    totalExecutions?: number;
    successRate?: number;
    avgExecutionTime?: number;
    cacheHitRate?: number;
    cacheSize?: number;
    activeExecutions?: number;
  } {
    if (!this.config.enablePerformanceMonitoring) {
      return { enabled: false };
    }

    const recentMetrics = this.metrics.filter(
      (m: Readonly<ToolExecutionMetrics>) => Date.now() - m.timestamp < 3600000 // Last hour
    );

    const successRate =
      recentMetrics.length > 0
        ? recentMetrics.filter((m: Readonly<ToolExecutionMetrics>) => m.success).length / recentMetrics.length
        : 0;

    const avgExecutionTime =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum: number, m: Readonly<ToolExecutionMetrics>) => sum + m.executionTime, 0) / recentMetrics.length
        : 0;

    const cacheHitRate =
      recentMetrics.length > 0
        ? recentMetrics.filter((m: Readonly<ToolExecutionMetrics>) => m.cacheHit).length / recentMetrics.length
        : 0;

    return {
      enabled: true,
      totalExecutions: recentMetrics.length,
      successRate,
      avgExecutionTime,
      cacheHitRate,
      cacheSize: this.executionCache.size,
      activeExecutions: this.activeExecutions.size,
    };
  }

  public clearCache(): void {
    this.executionCache.clear();
    logger.info('Tool execution cache cleared');
  }

  public updateConfig(newConfig: Readonly<Partial<EnhancedToolConfig>>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Enhanced tool integration config updated');
  }

  // Private methods
  private async executeWithRetry(
    toolCall: Readonly<ToolCall>,
    _context: Readonly<ToolExecutionContext>
  ): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await Promise.race([
          this.baseToolIntegration.executeToolCall(toolCall),
          this.createTimeoutPromise(),
        ]);

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < this.config.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await this.delay(delay);
          logger.warn(
            `Tool execution retry ${attempt + 1}/${this.config.retryAttempts} for ${toolCall.function.name}`
          );
        }
      }
    }

    throw lastError;
  }

  private generateExecutionId(toolCall: Readonly<ToolCall>, _context: Readonly<ToolExecutionContext>): string {
    return `${toolCall.function.name}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private getCachedResult(toolCall: Readonly<ToolCall>): unknown {
    const cacheKey = this.generateCacheKey(toolCall);
    const cached = this.executionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }

    if (cached) {
      this.executionCache.delete(cacheKey);
    }

    return null;
  }

  private cacheResult(toolCall: Readonly<ToolCall>, result: unknown): void {
    if (this.executionCache.size >= this.config.cacheSize) {
      // Remove oldest entry
      const oldestKey = this.executionCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.executionCache.delete(oldestKey);
      }
    }

    const cacheKey = this.generateCacheKey(toolCall);
    this.executionCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL,
    });
  }

  private generateCacheKey(toolCall: Readonly<ToolCall>): string {
    return `${toolCall.function.name}_${this.hashString(toolCall.function.arguments)}`;
  }

  private shouldCacheResult(result: unknown): boolean {
    // Don't cache error results or very large results
    if (result instanceof Error || JSON.stringify(result).length > 100000) {
      return false;
    }
    return true;
  }

  private recordMetrics(
    toolName: string,
    startTime: number,
    success: boolean,
    cacheHit: boolean = false
  ): void {
    if (!this.config.enablePerformanceMonitoring) return;

    const metric: ToolExecutionMetrics = {
      toolName,
      executionTime: Date.now() - startTime,
      success,
      timestamp: Date.now(),
      cacheHit,
    };

    this.metrics.push(metric);

    // Keep only last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics.shift();
    }

    this.emit('toolExecuted', metric);
  }

  private setupCacheCleanup(): void {
    // Clean up expired cache entries every 10 minutes
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.executionCache.entries()) {
        if (now - cached.timestamp > cached.ttl) {
          this.executionCache.delete(key);
        }
      }
    }, 600000);
  }

  public dispose(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = undefined;
    }
    this.removeAllListeners();
  }

  /**
   * Get LLM functions for tool integration
   */
  public async getLLMFunctions(): Promise<LLMFunction[]> {
    try {
      // Delegate to base tool integration
      if (typeof this.baseToolIntegration.getLLMFunctions === 'function') {
        return await this.baseToolIntegration.getLLMFunctions();
      }

      // Fallback: return empty array if no base implementation
      return [];
    } catch (error) {
      console.warn('Failed to get LLM functions:', error);
      return [];
    }
  }

  private async createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => { reject(new Error('Tool execution timeout')); }, this.config.timeout);
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }
}

// Global enhanced tool integration instance
let globalEnhancedToolIntegration: EnhancedToolIntegration | null = null;

export function getGlobalEnhancedToolIntegration(): EnhancedToolIntegration | null {
  return globalEnhancedToolIntegration;
}

export function setGlobalEnhancedToolIntegration(integration: EnhancedToolIntegration): void {
  globalEnhancedToolIntegration = integration;
}

