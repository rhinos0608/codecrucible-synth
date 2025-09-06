/**
 * Enhanced Tool Integration System
 * Advanced tool integration with performance monitoring, caching, and intelligent routing
 */

import { ToolIntegration, LLMFunction, ToolCall } from './tool-integration.js';
import { DomainAwareToolOrchestrator } from './domain-aware-tool-orchestrator.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { EventEmitter } from 'events';
import { ExecutionCache, shouldCacheResult } from './execution-cache.js';
import { PerformanceMonitor, ToolExecutionMetrics } from './performance-monitor.js';
import { createMcpServerManager } from '../../mcp-servers/mcp-bootstrap.js';

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

export interface ToolExecutionContext {
  sessionId?: string;
  userId?: string;
  priority: 'low' | 'medium' | 'high';
  domain?: string;
  metadata?: Record<string, any>;
}

export class EnhancedToolIntegration extends EventEmitter {
  private baseToolIntegration: ToolIntegration;
  private orchestrator: DomainAwareToolOrchestrator;
  private config: EnhancedToolConfig;
  private executionCache: ExecutionCache = new ExecutionCache();
  private performanceMonitor: PerformanceMonitor = new PerformanceMonitor();
  private activeExecutions: Set<string> = new Set();
  private cacheCleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<EnhancedToolConfig>, baseToolIntegration?: ToolIntegration, rustBackend?: any) {
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

    // CRITICAL FIX: Always require baseToolIntegration to prevent MCP server duplication
    if (baseToolIntegration) {
      this.baseToolIntegration = baseToolIntegration;
    } else {
      const mcpManager = createMcpServerManager();
      this.baseToolIntegration = new ToolIntegration(mcpManager, rustBackend);
      logger.warn('⚠️ Created fallback MCP manager in EnhancedToolIntegration - prefer passing baseToolIntegration');
    }
    this.orchestrator = new DomainAwareToolOrchestrator();

    this.cacheCleanupInterval = this.executionCache.startCleanup();
  }

  async executeToolCall(
    toolCall: ToolCall,
    context: ToolExecutionContext = { priority: 'medium' }
  ): Promise<any> {
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
        const cacheKey = this.generateCacheKey(toolCall);
        const cached = this.executionCache.getValid(cacheKey);
        if (cached) {
          this.performanceMonitor.record(toolCall.function.name, startTime, true, true);
          return cached;
        }
      }

      // Use intelligent routing if enabled
      let result;
      if (this.config.enableIntelligentRouting && context.domain) {
        // Use the orchestrator to analyze the domain and then execute with base integration
        const toolPrompt = `${toolCall.function.name}: ${toolCall.function.arguments}`;
        const availableTools: any[] = [];
        const domainAnalysis = this.orchestrator.getToolsForPrompt(toolPrompt, availableTools);
        // FIXED: Use structured logging instead of console.log
        logger.debug('Domain analysis for intelligent routing:', { 
          toolName: toolCall.function.name,
          analysis: domainAnalysis,
          availableToolsCount: availableTools.length
        });
        result = await this.executeWithRetry(toolCall, context);
      } else {
        result = await this.executeWithRetry(toolCall, context);
      }

      // Cache result if caching is enabled
      if (this.config.enableCaching && shouldCacheResult(result)) {
        const cacheKey = this.generateCacheKey(toolCall);
        this.executionCache.setResult(cacheKey, result, this.config.cacheTTL);
      }

      this.performanceMonitor.record(toolCall.function.name, startTime, true, false);
      return result;
    } catch (error) {
      this.performanceMonitor.record(toolCall.function.name, startTime, false);
      logger.error(`Enhanced tool execution failed for ${toolCall.function.name}:`, error);
      throw error;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  async getAvailableTools(domain?: string): Promise<LLMFunction[]> {
    const baseFunctions = await this.baseToolIntegration.getLLMFunctions();

    if (domain && this.config.enableIntelligentRouting) {
      // Use getToolsForPrompt instead since getToolsForDomain is private
      const domainPrompt = `Tools needed for ${domain} domain`;
      const domainTools = this.orchestrator.getToolsForPrompt(domainPrompt, baseFunctions);
      return domainTools.tools || baseFunctions;
    }

    return baseFunctions;
  }

  async batchExecuteTools(
    toolCalls: ToolCall[],
    context: ToolExecutionContext = { priority: 'medium' }
  ): Promise<any[]> {
    // Execute tools in batches respecting concurrency limits
    const results: any[] = [];
    const batchSize = Math.min(toolCalls.length, this.config.maxConcurrentTools);

    for (let i = 0; i < toolCalls.length; i += batchSize) {
      const batch = toolCalls.slice(i, i + batchSize);
      const batchPromises = batch.map(async toolCall => this.executeToolCall(toolCall, context));

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(
        ...batchResults.map(result =>
          result.status === 'fulfilled' ? result.value : { error: result.reason }
        )
      );
    }

    return results;
  }

  getExecutionMetrics(): ToolExecutionMetrics[] {
    return this.performanceMonitor.getMetrics();
  }

  getPerformanceStats(): any {
    if (!this.config.enablePerformanceMonitoring) {
      return { enabled: false };
    }

    const allMetrics = this.performanceMonitor.getMetrics();
    const recentMetrics = allMetrics.filter(
      m => Date.now() - m.timestamp < 3600000 // Last hour
    );

    const successRate =
      recentMetrics.length > 0
        ? recentMetrics.filter(m => m.success).length / recentMetrics.length
        : 0;

    const avgExecutionTime =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length
        : 0;

    const cacheHitRate =
      recentMetrics.length > 0
        ? recentMetrics.filter(m => m.cacheHit).length / recentMetrics.length
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

  clearCache(): void {
    this.executionCache.clear();
    logger.info('Tool execution cache cleared');
  }

  updateConfig(newConfig: Partial<EnhancedToolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Enhanced tool integration config updated');
  }

  // Private methods
  private async executeWithRetry(toolCall: ToolCall, context: ToolExecutionContext): Promise<any> {
    let lastError: any;

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

  private generateExecutionId(toolCall: ToolCall, context: ToolExecutionContext): string {
    return `${toolCall.function.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(toolCall: ToolCall): string {
    return `${toolCall.function.name}_${this.hashString(toolCall.function.arguments)}`;
  }

  dispose(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = undefined;
    }
    this.removeAllListeners();
  }

  /**
   * Get LLM functions for tool integration
   */
  async getLLMFunctions(): Promise<any[]> {
    try {
      // Delegate to base tool integration
      if (
        this.baseToolIntegration &&
        typeof this.baseToolIntegration.getLLMFunctions === 'function'
      ) {
        return await this.baseToolIntegration.getLLMFunctions();
      }

      // Fallback: return empty array if no base implementation
      return [];
    } catch (error) {
      // FIXED: Use structured logging instead of console.warn
      logger.warn('Failed to get LLM functions from base tool integration:', error);
      return [];
    }
  }

  private async createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tool execution timeout')), this.config.timeout);
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
