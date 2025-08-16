import { BaseTool } from './tools/base-tool.js';
import { logger } from './logger.js';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  timestamp: number;
}

export interface ToolExecutionBatch {
  id: string;
  tools: Array<{ tool: BaseTool; input: any; toolName: string }>;
  results: ToolExecutionResult[];
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Async Tool Executor for parallel tool execution
 * Implements patterns from modern CLI agents for concurrent operations
 */
export class AsyncToolExecutor {
  private static instance: AsyncToolExecutor | null = null;
  private executionQueue: ToolExecutionBatch[] = [];
  private maxConcurrency: number = 3; // Max parallel tool executions
  private currentExecutions: Set<string> = new Set();
  private executionHistory: Map<string, ToolExecutionResult> = new Map();

  private constructor() {}

  public static getInstance(): AsyncToolExecutor {
    if (!AsyncToolExecutor.instance) {
      AsyncToolExecutor.instance = new AsyncToolExecutor();
    }
    return AsyncToolExecutor.instance;
  }

  /**
   * Execute a single tool asynchronously
   */
  public async executeTool(
    tool: BaseTool,
    input: any,
    toolName?: string
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const name = toolName || tool.definition.name;

    try {
      logger.info(`🔧 Executing tool: ${name}`);
      const result = await tool.execute(input);
      
      const executionResult: ToolExecutionResult = {
        toolName: name,
        success: true,
        result,
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      // Cache result for potential reuse
      const cacheKey = this.getCacheKey(name, input);
      this.executionHistory.set(cacheKey, executionResult);

      logger.info(`✅ Tool ${name} completed in ${executionResult.executionTime}ms`);
      return executionResult;

    } catch (error) {
      const executionResult: ToolExecutionResult = {
        toolName: name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      logger.error(`❌ Tool ${name} failed:`, error);
      return executionResult;
    }
  }

  /**
   * Execute multiple tools in parallel with intelligent batching
   */
  public async executeToolBatch(
    toolsWithInputs: Array<{ tool: BaseTool; input: any; toolName?: string }>
  ): Promise<ToolExecutionBatch> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batch: ToolExecutionBatch = {
      id: batchId,
      tools: toolsWithInputs.map(({ tool, input, toolName }) => ({
        tool,
        input,
        toolName: toolName || tool.definition.name
      })),
      results: [],
      startTime: Date.now(),
      status: 'pending'
    };

    this.executionQueue.push(batch);
    
    try {
      batch.status = 'running';
      logger.info(`🔄 Executing batch ${batchId} with ${batch.tools.length} tools`);

      // Categorize tools for optimal execution order
      const categorizedTools = this.categorizeTools(batch.tools);
      
      // Execute tools with intelligent ordering and concurrency
      const results = await this.executeWithOptimalStrategy(categorizedTools);
      
      batch.results = results;
      batch.endTime = Date.now();
      batch.status = 'completed';

      const totalTime = batch.endTime - batch.startTime;
      const successCount = results.filter(r => r.success).length;
      
      logger.info(`✅ Batch ${batchId} completed: ${successCount}/${results.length} tools succeeded in ${totalTime}ms`);
      
      return batch;

    } catch (error) {
      batch.status = 'failed';
      batch.endTime = Date.now();
      logger.error(`❌ Batch ${batchId} failed:`, error);
      throw error;
    }
  }

  /**
   * Categorize tools for optimal execution strategy
   */
  private categorizeTools(
    tools: Array<{ tool: BaseTool; input: any; toolName: string }>
  ): {
    fastTools: typeof tools;
    slowTools: typeof tools;
    fileTools: typeof tools;
    networkTools: typeof tools;
  } {
    const fastTools: typeof tools = [];
    const slowTools: typeof tools = [];
    const fileTools: typeof tools = [];
    const networkTools: typeof tools = [];

    for (const toolWithInput of tools) {
      const toolName = toolWithInput.toolName.toLowerCase();
      
      if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write')) {
        fileTools.push(toolWithInput);
      } else if (toolName.includes('search') || toolName.includes('web') || toolName.includes('research')) {
        networkTools.push(toolWithInput);
      } else if (toolName.includes('list') || toolName.includes('status') || toolName.includes('analyze')) {
        fastTools.push(toolWithInput);
      } else {
        slowTools.push(toolWithInput);
      }
    }

    return { fastTools, slowTools, fileTools, networkTools };
  }

  /**
   * Execute tools with optimal strategy based on type and dependencies
   */
  private async executeWithOptimalStrategy(
    categorizedTools: {
      fastTools: Array<{ tool: BaseTool; input: any; toolName: string }>;
      slowTools: Array<{ tool: BaseTool; input: any; toolName: string }>;
      fileTools: Array<{ tool: BaseTool; input: any; toolName: string }>;
      networkTools: Array<{ tool: BaseTool; input: any; toolName: string }>;
    }
  ): Promise<ToolExecutionResult[]> {
    const allResults: ToolExecutionResult[] = [];

    // Execute fast tools first (parallel)
    if (categorizedTools.fastTools.length > 0) {
      logger.info(`⚡ Executing ${categorizedTools.fastTools.length} fast tools in parallel`);
      const fastResults = await Promise.all(
        categorizedTools.fastTools.map(({ tool, input, toolName }) =>
          this.executeTool(tool, input, toolName)
        )
      );
      allResults.push(...fastResults);
    }

    // Execute file tools with limited concurrency (to avoid file system contention)
    if (categorizedTools.fileTools.length > 0) {
      logger.info(`📁 Executing ${categorizedTools.fileTools.length} file tools with limited concurrency`);
      const fileResults = await this.executeWithConcurrencyLimit(
        categorizedTools.fileTools,
        2 // Max 2 concurrent file operations
      );
      allResults.push(...fileResults);
    }

    // Execute network tools in parallel (they can handle high concurrency)
    if (categorizedTools.networkTools.length > 0) {
      logger.info(`🌐 Executing ${categorizedTools.networkTools.length} network tools in parallel`);
      const networkResults = await Promise.all(
        categorizedTools.networkTools.map(({ tool, input, toolName }) =>
          this.executeTool(tool, input, toolName)
        )
      );
      allResults.push(...networkResults);
    }

    // Execute slow/complex tools last with careful concurrency
    if (categorizedTools.slowTools.length > 0) {
      logger.info(`🐌 Executing ${categorizedTools.slowTools.length} complex tools with controlled concurrency`);
      const slowResults = await this.executeWithConcurrencyLimit(
        categorizedTools.slowTools,
        1 // Serialize complex tools to avoid resource conflicts
      );
      allResults.push(...slowResults);
    }

    return allResults;
  }

  /**
   * Execute tools with concurrency limit
   */
  private async executeWithConcurrencyLimit(
    tools: Array<{ tool: BaseTool; input: any; toolName: string }>,
    limit: number
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    
    for (let i = 0; i < tools.length; i += limit) {
      const batch = tools.slice(i, i + limit);
      const batchResults = await Promise.all(
        batch.map(({ tool, input, toolName }) =>
          this.executeTool(tool, input, toolName)
        )
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Check if a tool result is cached and still valid
   */
  public getCachedResult(toolName: string, input: any): ToolExecutionResult | null {
    const cacheKey = this.getCacheKey(toolName, input);
    const cached = this.executionHistory.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      logger.info(`📋 Using cached result for ${toolName}`);
      return cached;
    }
    
    return null;
  }

  /**
   * Generate cache key for tool execution
   */
  private getCacheKey(toolName: string, input: any): string {
    const inputStr = typeof input === 'object' ? JSON.stringify(input) : String(input);
    return `${toolName}:${inputStr.substring(0, 100)}`;
  }

  /**
   * Get execution statistics
   */
  public getExecutionStats(): {
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
    cacheHitRate: number;
    activeBatches: number;
  } {
    const executions = Array.from(this.executionHistory.values());
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.success).length;
    const averageExecutionTime = totalExecutions > 0 
      ? executions.reduce((sum, e) => sum + e.executionTime, 0) / totalExecutions 
      : 0;

    return {
      totalExecutions,
      averageExecutionTime,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      cacheHitRate: 0.1, // Placeholder - would need more tracking
      activeBatches: this.executionQueue.filter(b => b.status === 'running').length
    };
  }

  /**
   * Clear execution history and reset caches
   */
  public clearHistory(): void {
    this.executionHistory.clear();
    this.executionQueue = [];
    this.currentExecutions.clear();
    logger.info('🧹 Cleared tool execution history and caches');
  }

  /**
   * Set maximum concurrency level
   */
  public setMaxConcurrency(level: number): void {
    this.maxConcurrency = Math.max(1, Math.min(level, 10)); // Between 1 and 10
    logger.info(`⚙️ Set maximum concurrency to ${this.maxConcurrency}`);
  }
}