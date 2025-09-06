/**
 * Unified Tool Registry
 * 
 * Resolves tool naming mismatches and provides extensible tool dispatch
 * Replaces rigid switch-based routing with flexible plugin system
 * 
 * Implements the "Registry Pattern" from the Coding Grimoire
 */

import { logger } from '../logging/unified-logger.js';
import { outputConfig } from '../../utils/output-config.js';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'git' | 'terminal' | 'network' | 'package' | 'external' | 'system';
  aliases: string[];
  inputSchema: Record<string, unknown>;
  handler: (args: Readonly<Record<string, unknown>>, context?: ToolExecutionContext) => Promise<unknown>;
  security: {
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    allowedOrigins: string[];
  };
  performance: {
    estimatedDuration: number; // milliseconds
    memoryUsage: 'low' | 'medium' | 'high';
    cpuIntensive: boolean;
  };
}

export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  requestId?: string;
  timeoutMs?: number;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata: {
    executionTime: number;
    toolId: string;
    timestamp: Date;
    memoryUsage?: number;
    truncated?: boolean;
  };
}

/**
 * Unified Tool Registry with intelligent name resolution
 */
export class UnifiedToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private aliases: Map<string, string> = new Map(); // alias -> canonical ID
  private categories: Map<string, Set<string>> = new Map();
  private metrics: Map<string, ToolMetrics> = new Map();
  // Optional runtime-provided execution backend (injected by application layer)
  private rustBackend?: unknown;

  /**
   * Allow application layer to attach a concrete execution backend (e.g. Rust).
   * This keeps domain code decoupled while enabling infra handlers to access the backend via context.
   */
  public setRustBackend(backend: unknown): void {
    this.rustBackend = backend;
  }

  public constructor() {
    this.initializeCategories();
  }

  private initializeCategories(): void {
    const categories = ['filesystem', 'git', 'terminal', 'network', 'package', 'external', 'system'];
    categories.forEach(cat => this.categories.set(cat, new Set()));
  }

  /**
   * Register a tool with intelligent alias generation
   */
  public registerTool(tool: Readonly<ToolDefinition>): void {
    // Store primary tool
    this.tools.set(tool.id, tool);
    this.categories.get(tool.category)?.add(tool.id);
    this.metrics.set(tool.id, new ToolMetrics());

    // Register explicit aliases
    tool.aliases.forEach(alias => {
      this.aliases.set(alias, tool.id);
    });

    // Generate intelligent aliases based on naming conventions
    this.generateIntelligentAliases(tool);

    logger.info(`Registered tool: ${tool.id} (${tool.aliases.length + this.getGeneratedAliases(tool).length} aliases)`);
  }

  /**
   * Generate intelligent aliases for common naming patterns
   */
  private generateIntelligentAliases(tool: ToolDefinition): void {
    const generatedAliases = this.getGeneratedAliases(tool);
    generatedAliases.forEach(alias => {
      if (!this.aliases.has(alias)) {
        this.aliases.set(alias, tool.id);
      }
    });
  }

  private getGeneratedAliases(tool: ToolDefinition): string[] {
    const aliases: string[] = [];
    
    // Generate category-prefixed aliases
    aliases.push(`${tool.category}_${tool.id}`);
    
    // Generate MCP-style aliases
    aliases.push(`mcp_${tool.id}`);
    
    // Generate common variations
    if (tool.id.includes('_')) {
      aliases.push(tool.id.replace(/_/g, '-')); // snake_case -> kebab-case
    }
    
    // Category-specific patterns
    if (tool.category === 'filesystem') {
      aliases.push(`file_${tool.id.replace(/^(file|filesystem)_/, '')}`);
      aliases.push(`fs_${tool.id.replace(/^(file|filesystem)_/, '')}`);
    }
    
    return aliases;
  }

  /**
   * Resolve tool name to canonical ID with intelligent fallback
   */
  public resolveToolId(toolName: string): string | null {
    // Direct lookup
    if (this.tools.has(toolName)) return toolName;
    
    // Alias lookup
    if (this.aliases.has(toolName)) {
      const aliasId = this.aliases.get(toolName);
      return aliasId !== undefined ? aliasId : null;
    }
    
    // Fuzzy matching for common typos
    return this.fuzzyResolve(toolName);
  }

  /**
   * Fuzzy resolution for slight variations and typos
   */
  private fuzzyResolve(toolName: string): string | null {
    const candidates = Array.from(this.tools.keys()).concat(Array.from(this.aliases.keys()));
    
    // Try removing common prefixes
    const withoutPrefix = toolName.replace(/^(mcp_|filesystem_|file_|fs_|git_|terminal_)/, '');
    if (this.aliases.has(withoutPrefix) || this.tools.has(withoutPrefix)) {
      return this.resolveToolId(withoutPrefix);
    }
    
    // Try adding common prefixes
    const commonPrefixes = ['filesystem_', 'mcp_', 'file_'];
    for (const prefix of commonPrefixes) {
      const candidate = prefix + withoutPrefix;
      if (this.aliases.has(candidate) || this.tools.has(candidate)) {
        return this.resolveToolId(candidate);
      }
    }
    
    // Levenshtein distance matching for typos (basic implementation)
    const closeMatches = candidates.filter(candidate => 
      this.levenshteinDistance(toolName.toLowerCase(), candidate.toLowerCase()) <= 2
    );
    
    if (closeMatches.length === 1) {
      return this.resolveToolId(closeMatches[0]);
    }
    
    return null;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array.from({ length: str2.length + 1 }, () => Array(str1.length + 1).fill(0) as number[]);
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Execute tool with unified error handling and metrics
   */
  public async executeTool(
    toolName: string, 
    args: Readonly<Record<string, unknown>>, 
    context: Readonly<ToolExecutionContext> = {}
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const toolId = this.resolveToolId(toolName);
    
    if (!toolId) {
      const availableTools = this.getAvailableToolNames();
      logger.warn(`Unknown tool requested: ${toolName}. Available: ${availableTools.slice(0, 10).join(', ')}...`);
      return {
        success: false,
        error: `Unknown tool: ${toolName}. Did you mean one of: ${this.getSuggestedTools(toolName).join(', ')}?`,
        metadata: {
          executionTime: Date.now() - startTime,
          toolId: toolName,
          timestamp: new Date()
        }
      };
    }

    const tool = this.tools.get(toolId);
    const metrics = this.metrics.get(toolId);

    if (!tool || !metrics) {
      logger.error(`Tool or metrics not found for toolId: ${toolId}`);
      return {
        success: false,
        error: `Tool or metrics not found for toolId: ${toolId}`,
        metadata: {
          executionTime: Date.now() - startTime,
          toolId,
          timestamp: new Date()
        }
      };
    }

    try {
      // Pre-execution hooks
      this.preExecutionHook(tool, args, context);
      
      // Execute with timeout
      const timeoutMs = context.timeoutMs || this.getDefaultTimeout(tool);
      // If application attached a rust backend, expose it to the handler via context
  const contextWithBackend = { ...context, rustBackend: this.rustBackend };

      const result: unknown = await Promise.race([
        tool.handler(args, contextWithBackend),
        this.createTimeoutPromise(timeoutMs, toolId)
      ]);

      // Post-execution processing
      const processedResult = await this.postProcessResult(result, tool, context);
      
      // Update metrics
      const executionTime = Date.now() - startTime;
      metrics.recordSuccess(executionTime);
      
      logger.info(`Tool executed successfully: ${toolId} (${executionTime}ms)`);
      
      return {
        success: true,
        data: processedResult,
        metadata: {
          executionTime,
          toolId,
          timestamp: new Date()
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      metrics.recordFailure(executionTime, error);
      
      logger.error(`Tool execution failed: ${toolId}`, { error, args, executionTime });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTime,
          toolId,
          timestamp: new Date()
        }
      };
    }
  }

  private preExecutionHook(
    tool: Readonly<ToolDefinition>, 
    args: Readonly<Record<string, unknown>>, 
    context: Readonly<ToolExecutionContext>
  ): void {
    // Validate arguments against schema
    this.validateArguments(args, tool.inputSchema);

    // Security checks
    if (tool.security.requiresApproval) {
      // Integration point for approval system
      this.requestApproval(tool, args, context);
    }
  }

  private validateArguments(
    args: Record<string, unknown>,
    schema: { required?: string[] }
  ): void {
    // Basic validation - could integrate with AJV or similar
    if (Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in args)) {
          throw new Error(`Missing required argument: ${requiredField}`);
        }
      }
    }
  }

  private requestApproval(
    tool: Readonly<ToolDefinition>, 
    args: Readonly<Record<string, unknown>>, 
    context: Readonly<ToolExecutionContext>
  ): void {
    // Integration point with existing approval system
    // For now, allow all but log for audit
    logger.info(`Approval requested for ${tool.id}`, { args, context, riskLevel: tool.security.riskLevel });
  }

  private getDefaultTimeout(tool: ToolDefinition): number {
    const baseTimeout = outputConfig.getConfig().maxBufferSize > 50 * 1024 * 1024 ? 120000 : 60000;
    
    switch (tool.performance.memoryUsage) {
      case 'high': return baseTimeout * 2;
      case 'medium': return baseTimeout * 1.5;
      default: return baseTimeout;
    }
  }

  private async createTimeoutPromise(timeoutMs: number, toolId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool ${toolId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private postProcessResult(
    result: unknown,
    tool: Readonly<ToolDefinition>,
    _context: Readonly<ToolExecutionContext>
  ): unknown {
    // Apply output truncation if needed
    if (typeof result === 'string' && result.length > 100000) {
      const truncated = outputConfig.truncateForContext(result, tool.category);
      return {
        content: truncated,
        truncated: true,
        originalSize: result.length
      };
    }

    return result;
  }

  private getSuggestedTools(toolName: string): string[] {
    const all = this.getAvailableToolNames();
    return all
      .map(name => ({ name, distance: this.levenshteinDistance(toolName.toLowerCase(), name.toLowerCase()) }))
      .filter(item => item.distance <= 3)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(item => item.name);
  }

  /**
   * Get all available tool names (including aliases)
   */
  public getAvailableToolNames(): string[] {
    return Array.from(new Set([
      ...Array.from(this.tools.keys()),
      ...Array.from(this.aliases.keys())
    ])).sort();
  }

  /**
   * Get tools by category
   */
  public getToolsByCategory(category: string): ToolDefinition[] {
    const toolIds = this.categories.get(category) ?? new Set();
    return Array.from(toolIds)
      .map((id: string) => {
        const tool = this.tools.get(id);
        return tool ? tool : undefined;
      })
      .filter((tool): tool is ToolDefinition => Boolean(tool));
  }

  /**
   * Get tool metrics
   */
  public getToolMetrics(toolName: string): ToolMetrics | null {
    const toolId = this.resolveToolId(toolName);
    return toolId ? this.metrics.get(toolId) ?? null : null;
  }

  /**
   * Health check - get registry status
   */
  public getRegistryStatus(): {
    totalTools: number;
    totalAliases: number;
    categories: Record<string, number>;
    topTools: Array<{ id: string; successRate: number; avgDuration: number }>;
  } {
    const topTools = Array.from(this.metrics.entries())
      .map(([id, metrics]: readonly [string, ToolMetrics]) => ({
        id,
        successRate: metrics.getSuccessRate(),
        avgDuration: metrics.getAverageDuration()
      }))
      .sort((a: Readonly<{ id: string; successRate: number; avgDuration: number }>, b: Readonly<{ id: string; successRate: number; avgDuration: number }>) =>
        (b.successRate * 10000 - b.avgDuration) - (a.successRate * 10000 - a.avgDuration)
      )
      .slice(0, 10);

    const categories = Object.fromEntries(
      Array.from(this.categories.entries()).map(
        ([cat, tools]: readonly [string, Set<string>]) => [cat, tools.size]
      )
    );

    return {
      totalTools: this.tools.size,
      totalAliases: this.aliases.size,
      categories,
      topTools
    };
  }
}

/**
 * Tool execution metrics
 */
class ToolMetrics {
  private executions: number = 0;
  private successes: number = 0;
  private failures: number = 0;
  private totalDuration: number = 0;
  private readonly recentErrors: Array<{ error: unknown; timestamp: Date }> = [];

  public recordSuccess(duration: number): void {
    this.executions++;
    this.successes++;
    this.totalDuration += duration;
  }

  public recordFailure(duration: number, error: unknown): void {
    this.executions++;
    this.failures++;
    this.totalDuration += duration;

    this.recentErrors.push({ error, timestamp: new Date() });
    if (this.recentErrors.length > 10) {
      this.recentErrors.shift();
    }
  }

  public getSuccessRate(): number {
    return this.executions > 0 ? this.successes / this.executions : 0;
  }

  public getAverageDuration(): number {
    return this.executions > 0 ? this.totalDuration / this.executions : 0;
  }

  public getStats(): {
    executions: number;
    successes: number;
    failures: number;
    successRate: number;
    avgDuration: number;
    recentErrors: Array<{ error: unknown; timestamp: Date }>;
  } {
    return {
      executions: this.executions,
      successes: this.successes,
      failures: this.failures,
      successRate: this.getSuccessRate(),
      avgDuration: this.getAverageDuration(),
      recentErrors: this.recentErrors
    };
  }
}

// Export singleton instance
export const unifiedToolRegistry = new UnifiedToolRegistry();

// Types already exported with their definitions above