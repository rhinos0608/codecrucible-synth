import { CLIContext } from './cli.js';
import { PerformanceOptimizedClient } from './performance-optimized-client.js';
import { StructuredReActLoop, ReActResult, ReActContext } from './structured-react-loop.js';
import { AsyncToolExecutor } from './async-tool-executor.js';
import { logger } from './logger.js';
import { BaseTool } from './tools/base-tool.js';
import { z } from 'zod';

// Import all existing tools
import { ReadFileTool, WriteFileTool, ListFilesTool } from './tools/file-tools.js';
import { ConfirmedWriteTool, ConfirmEditsTool, ViewPendingEditsTool } from './tools/confirmed-write-tool.js';
import { 
  EnhancedReadFileTool, 
  EnhancedWriteFileTool, 
  FileSearchTool, 
  FileOperationsTool 
} from './tools/enhanced-file-tools.js';
import { 
  TerminalExecuteTool, 
  ProcessManagementTool, 
  ShellEnvironmentTool, 
  PackageManagerTool 
} from './tools/terminal-tools.js';
import { 
  GitOperationsTool, 
  GitAnalysisTool 
} from './tools/enhanced-git-tools.js';
import { 
  AdvancedProcessTool, 
  CodeExecutionTool 
} from './tools/process-management-tools.js';
import { 
  CodeAnalysisTool, 
  CodeGenerationTool 
} from './tools/enhanced-code-tools.js';
import { LintCodeTool, GetAstTool } from './tools/code-analysis-tools.js';
import { GitStatusTool, GitDiffTool } from './tools/git-tools.js';
import { ResearchTool, WebSearchTool, DocSearchTool } from './tools/research-tools.js';
import { 
  RefDocumentationTool, 
  ExaWebSearchTool, 
  ExaDeepResearchTool, 
  ExaCompanyResearchTool 
} from './tools/mcp-tools.js';

/**
 * Enhanced ReAct Agent with Performance Optimizations
 * 
 * Key improvements over the original ReActAgent:
 * 1. Persistent model client for faster response times
 * 2. Async tool execution with intelligent batching
 * 3. Structured ReAct loop instead of string parsing
 * 4. Session memory and context caching
 * 5. Proactive suggestions and error recovery
 */
export class EnhancedReActAgent {
  private modelClient: PerformanceOptimizedClient;
  private tools: BaseTool[];
  private toolExecutor: AsyncToolExecutor;
  private context: CLIContext;
  private workingDirectory: string;
  private sessionMemory: Map<string, any> = new Map();

  constructor(context: CLIContext, workingDirectory: string) {
    this.context = context;
    this.workingDirectory = workingDirectory;
    
    // Initialize performance-optimized model client
    this.modelClient = PerformanceOptimizedClient.getInstance({
      endpoint: context.config.model.endpoint,
      model: context.config.model.name,
      timeout: context.config.model.timeout || 60000,
      maxTokens: context.config.model.maxTokens || 4096,
      temperature: context.config.model.temperature || 0.7
    });

    // Initialize async tool executor
    this.toolExecutor = AsyncToolExecutor.getInstance();

    // Initialize all tools
    this.tools = this.initializeToolSuite();

    logger.info(`🚀 Enhanced ReAct Agent initialized with ${this.tools.length} tools`);
  }

  /**
   * Initialize comprehensive tool suite
   */
  private initializeToolSuite(): BaseTool[] {
    const agentContext = { workingDirectory: this.workingDirectory };

    return [
      // Enhanced File Operations (prioritized for performance)
      new EnhancedReadFileTool(agentContext),
      new EnhancedWriteFileTool(agentContext),
      new FileSearchTool(agentContext),
      new FileOperationsTool(agentContext),
      
      // Terminal and Process Management
      new TerminalExecuteTool(agentContext),
      new ProcessManagementTool(agentContext),
      new ShellEnvironmentTool(agentContext),
      new PackageManagerTool(agentContext),
      
      // Comprehensive Git Operations
      new GitOperationsTool(agentContext),
      new GitAnalysisTool(agentContext),
      
      // Process Management and Code Execution
      new AdvancedProcessTool(agentContext),
      new CodeExecutionTool(agentContext),
      
      // Enhanced Code Analysis and Generation
      new CodeAnalysisTool(agentContext),
      new CodeGenerationTool(agentContext),
      
      // Research and External (with MCP integration)
      new ResearchTool(agentContext),
      new WebSearchTool(agentContext),
      new DocSearchTool(agentContext),
      new RefDocumentationTool(agentContext),
      new ExaWebSearchTool(agentContext),
      new ExaDeepResearchTool(agentContext),
      new ExaCompanyResearchTool(agentContext),
      
      // Legacy tools for compatibility
      new ReadFileTool(agentContext),
      new WriteFileTool(agentContext),
      new ListFilesTool(agentContext),
      new GitStatusTool(agentContext),
      new GitDiffTool(agentContext),
      new LintCodeTool(agentContext),
      new GetAstTool(agentContext),
      
      // Edit confirmation tools
      new ConfirmedWriteTool(agentContext),
      new ConfirmEditsTool(agentContext),
      new ViewPendingEditsTool(agentContext),
    ];
  }

  /**
   * Process request using structured ReAct loop
   */
  public async processRequest(input: string): Promise<string> {
    try {
      logger.info(`🎯 Processing request: ${input.substring(0, 100)}...`);

      // Check session memory for similar requests
      const cachedResponse = this.checkSessionMemory(input);
      if (cachedResponse) {
        logger.info('📋 Using cached response from session memory');
        return cachedResponse;
      }

      // Create structured ReAct loop
      const reactLoop = new StructuredReActLoop(
        input,
        this.tools,
        this.workingDirectory,
        12 // Slightly higher iteration limit for complex tasks
      );

      // Execute ReAct loop with enhanced thought generation
      const result = await reactLoop.execute((context) => this.generateStructuredThought(context));

      // Cache successful results
      if (result.success) {
        this.updateSessionMemory(input, result.result);
      }

      // Log performance metrics
      this.logPerformanceMetrics(result);

      return result.result;

    } catch (error) {
      logger.error('❌ Enhanced ReAct agent request failed:', error);
      return `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Generate structured thought for ReAct loop
   */
  private async generateStructuredThought(context: ReActContext): Promise<any> {
    try {
      // Build enhanced prompt with context
      const prompt = this.buildStructuredPrompt(context);

      // Generate response using optimized client
      const response = await this.modelClient.generateDirectResponse(prompt, {
        maxTokens: 2048,
        temperature: 0.3, // Lower temperature for more structured responses
        taskType: 'reasoning'
      });

      // Parse structured response
      return this.parseStructuredResponse(response, context);

    } catch (error) {
      logger.error('❌ Failed to generate structured thought:', error);
      
      // Fallback to simpler thought structure
      return this.generateFallbackThought(context);
    }
  }

  /**
   * Build structured prompt for ReAct loop
   */
  private buildStructuredPrompt(context: ReActContext): string {
    const availableTools = context.availableTools.map(tool => ({
      name: tool.definition.name,
      description: tool.definition.description,
      category: tool.definition.category || 'General'
    }));

    const recentHistory = context.conversationHistory.slice(-3);
    const progressSummary = this.buildProgressSummary(context);

    return `You are an intelligent coding assistant using a structured ReAct (Reasoning-Acting-Observing) approach.

**Current Goal**: ${context.goal}

**Working Directory**: ${context.workingDirectory}

**Iteration**: ${context.currentIteration}/${context.maxIterations}

**Available Tools** (${availableTools.length} total):
${availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

**Recent History**:
${recentHistory.map(h => `${h.type}: ${h.content.substring(0, 200)}`).join('\n')}

**Current Progress**:
${progressSummary}

**Instructions**:
Respond with a JSON object containing your structured thought:

{
  "reasoning": "Your analysis of the current situation and what needs to be done next",
  "action": {
    "type": "tool_call" | "tool_sequence" | "tool_parallel" | "complete" | "clarify",
    "tools": [
      {
        "name": "tool_name",
        "input": { "parameter": "value" },
        "priority": 1,
        "dependencies": []
      }
    ],
    "reasoning": "Why you chose this action",
    "expectedOutcome": "What you expect this action to achieve"
  },
  "observation": "Analysis of previous results (if any)",
  "nextSteps": ["planned follow-up actions"],
  "confidence": 0.8
}

Choose action types wisely:
- "tool_call": Single tool execution
- "tool_sequence": Execute tools one after another (when order matters)
- "tool_parallel": Execute tools simultaneously (when independent)
- "complete": Goal is achieved
- "clarify": Need more information from user

Think step by step and be strategic about tool selection and execution order.`;
  }

  /**
   * Parse structured response from model
   */
  private parseStructuredResponse(response: string, context: ReActContext): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.reasoning || !parsed.action || !parsed.confidence) {
        throw new Error('Missing required fields in structured response');
      }

      // Ensure confidence is between 0 and 1
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

      // Validate tools exist
      if (parsed.action.tools) {
        parsed.action.tools = parsed.action.tools.filter((toolSpec: any) => {
          const toolExists = context.availableTools.some(tool => tool.definition.name === toolSpec.name);
          if (!toolExists) {
            logger.warn(`⚠️ Tool ${toolSpec.name} not found, filtering out`);
          }
          return toolExists;
        });
      }

      return parsed;

    } catch (error) {
      logger.warn('⚠️ Failed to parse structured response, using fallback:', error);
      return this.generateFallbackThought(context);
    }
  }

  /**
   * Generate fallback thought when structured parsing fails
   */
  private generateFallbackThought(context: ReActContext): any {
    const toolsUsed = context.progressMetrics.toolsUsed;
    
    // Choose appropriate action based on context
    let action;
    
    if (toolsUsed.size === 0) {
      // Start with file exploration
      action = {
        type: 'tool_call',
        tools: [{ name: 'listFiles', input: { path: '.' } }],
        reasoning: 'Starting with basic file exploration',
        expectedOutcome: 'Get overview of project structure'
      };
    } else if (!toolsUsed.has('readFiles') && context.progressMetrics.filesAccessed.size < 3) {
      // Read some key files
      action = {
        type: 'tool_call',
        tools: [{ name: 'readFiles', input: { paths: ['package.json'] } }],
        reasoning: 'Need to understand project configuration',
        expectedOutcome: 'Learn about project dependencies and structure'
      };
    } else {
      // Complete with current progress
      action = {
        type: 'complete',
        tools: [],
        reasoning: 'Have gathered sufficient information',
        expectedOutcome: 'Provide summary of findings'
      };
    }

    return {
      reasoning: `Fallback reasoning for iteration ${context.currentIteration}`,
      action,
      confidence: 0.6
    };
  }

  /**
   * Build progress summary for context
   */
  private buildProgressSummary(context: ReActContext): string {
    const metrics = context.progressMetrics;
    
    let summary = `- Tools used: ${Array.from(metrics.toolsUsed).join(', ') || 'None'}\n`;
    summary += `- Files accessed: ${metrics.filesAccessed.size}\n`;
    summary += `- Task completion: ${Math.round(metrics.taskCompletion * 100)}%\n`;
    summary += `- Steps completed: ${metrics.stepsCompleted.length}\n`;
    
    if (context.executionResults.length > 0) {
      const lastResult = context.executionResults[context.executionResults.length - 1];
      summary += `- Last action: ${lastResult.toolName} (${lastResult.success ? 'Success' : 'Failed'})\n`;
    }

    return summary;
  }

  /**
   * Check session memory for similar requests
   */
  private checkSessionMemory(input: string): string | null {
    const inputKey = input.toLowerCase().substring(0, 50);
    
    for (const [key, response] of this.sessionMemory.entries()) {
      if (key.includes(inputKey) || inputKey.includes(key)) {
        return response;
      }
    }
    
    return null;
  }

  /**
   * Update session memory with successful results
   */
  private updateSessionMemory(input: string, result: string): void {
    const key = input.toLowerCase().substring(0, 50);
    this.sessionMemory.set(key, result);
    
    // Limit memory size
    if (this.sessionMemory.size > 10) {
      const firstKey = this.sessionMemory.keys().next().value;
      if (firstKey !== undefined) {
        this.sessionMemory.delete(firstKey);
      }
    }
  }

  /**
   * Log performance metrics
   */
  private logPerformanceMetrics(result: ReActResult): void {
    const clientStats = this.modelClient.getPerformanceStats();
    const toolStats = this.toolExecutor.getExecutionStats();
    
    logger.info('📊 Performance Metrics:', {
      reactResult: {
        success: result.success,
        iterations: result.iterations,
        toolsUsed: result.toolsUsed.length,
        executionTime: result.executionTime
      },
      modelClient: {
        sessionDuration: clientStats.sessionDuration,
        connectionHealthy: clientStats.connectionHealthy,
        cacheHitRate: clientStats.cacheHitRate
      },
      toolExecution: {
        totalExecutions: toolStats.totalExecutions,
        averageExecutionTime: toolStats.averageExecutionTime,
        successRate: toolStats.successRate
      }
    });
  }

  /**
   * Get available tools
   */
  public getAvailableTools(): BaseTool[] {
    return this.tools;
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    modelClient: any;
    toolExecution: any;
    sessionMemory: number;
    toolCount: number;
  } {
    return {
      modelClient: this.modelClient.getPerformanceStats(),
      toolExecution: this.toolExecutor.getExecutionStats(),
      sessionMemory: this.sessionMemory.size,
      toolCount: this.tools.length
    };
  }

  /**
   * Reset agent state
   */
  public reset(): void {
    this.sessionMemory.clear();
    this.toolExecutor.clearHistory();
    logger.info('🔄 Enhanced ReAct agent state reset');
  }

  /**
   * Refresh model client connection
   */
  public async refresh(): Promise<void> {
    await this.modelClient.refresh();
    logger.info('🔄 Model client connection refreshed');
  }
}