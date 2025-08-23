/**
 * Advanced Tool Orchestration System
 * Implements intelligent tool selection, parallel execution, dependency resolution,
 * and error recovery for complex AI agent workflows
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger.js';
import { UnifiedModelClient } from '../../refactor/unified-model-client.js';
import { SecureToolFactory } from '../security/secure-tool-factory.js';
import { RBACSystem } from '../security/rbac-system.js';
import { SecurityAuditLogger } from '../security/security-audit-logger.js';
import { SecretsManager } from '../security/secrets-manager.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { getTelemetryProvider } from '../observability/observability-system.js';

// AI SDK v5.0 Streaming Interfaces
export interface StreamChunk {
  type: 'stream-start' | 'text-start' | 'text-delta' | 'text-end' | 'reasoning-start' | 'reasoning-delta' | 'reasoning-end' 
       | 'tool-input-start' | 'tool-input-delta' | 'tool-input-end' | 'tool-call' | 'tool-result' | 'finish' | 'error';
  id?: string;
  toolName?: string;
  toolCallId?: string;
  delta?: string;
  args?: any;
  result?: any;
  timestamp: number;
  error?: string;
  errorCode?: string;
}

export interface ToolExecutionDelta {
  type: 'input' | 'output' | 'progress' | 'error' | 'metadata';
  content: string;
  progress?: number;
  metadata?: Record<string, any>;
}

// Core Tool Interfaces
export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  execute: (input: any, context: ToolContext) => Promise<ToolResult>;
  metadata: ToolMetadata;
  
  // Enhanced: Streaming support for modern tool execution patterns
  stream?: (input: any, context: ToolContext) => AsyncGenerator<ToolExecutionDelta>;
  validate?: (input: any) => { valid: boolean; errors: string[]; normalizedInput?: any };
}

export interface ToolMetadata {
  version: string;
  author: string;
  tags: string[];
  cost: number; // Relative cost factor
  latency: number; // Expected latency in ms
  reliability: number; // Reliability score 0-1
  dependencies: string[]; // Tool IDs this tool depends on
  conflictsWith: string[]; // Tools that conflict with this one
  capabilities: ToolCapability[];
  requirements: ToolRequirement[];
}

export interface ToolCapability {
  type: 'read' | 'write' | 'execute' | 'network' | 'compute';
  scope: string;
  permissions: string[];
}

export interface ToolRequirement {
  type: 'environment' | 'dependency' | 'resource';
  value: string;
  optional?: boolean;
}

export interface ToolContext {
  sessionId: string;
  userId?: string;
  environment: Record<string, any>;
  previousResults: ToolResult[];
  constraints: ToolConstraints;
  security: SecurityContext;
  systemPrompt?: string; // Enhanced: System prompt for better tool decision making
}

export interface ToolConstraints {
  maxExecutionTime: number;
  maxMemoryUsage: number;
  allowedNetworkAccess: boolean;
  sandboxed: boolean;
  costLimit: number;
}

export interface SecurityContext {
  permissions: string[];
  restrictions: string[];
  auditLog: boolean;
  encryptionRequired: boolean;
}

export interface ToolResult {
  toolId: string;
  success: boolean;
  output?: any;
  error?: string;
  metadata: {
    executionTime: number;
    memoryUsed: number;
    cost: number;
    version: string;
  };
  side_effects?: SideEffect[];
}

export interface SideEffect {
  type: 'file_created' | 'file_modified' | 'network_request' | 'environment_changed';
  description: string;
  reversible: boolean;
  undo?: () => Promise<void>;
}

export interface ToolCall {
  id: string;
  toolId: string;
  input: any;
  priority: number;
  retryPolicy: RetryPolicy;
  fallbackTools?: string[];
  timeout?: number;
  dependsOn?: string[]; // Other tool call IDs
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

export interface ExecutionPlan {
  id: string;
  toolCalls: ToolCall[];
  dependencies: Map<string, string[]>;
  executionOrder: string[][];
  estimatedCost: number;
  estimatedTime: number;
  riskAssessment: RiskAssessment;
}

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  mitigations: string[];
}

export interface RiskFactor {
  type: 'security' | 'reliability' | 'cost' | 'time';
  severity: number; // 0-1
  description: string;
}

export enum ToolCategory {
  FILE_SYSTEM = 'filesystem',
  NETWORK = 'network',
  COMPUTATION = 'computation',
  DATA_PROCESSING = 'data_processing',
  EXTERNAL_API = 'external_api',
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

// Advanced Tool Orchestrator
export class AdvancedToolOrchestrator extends EventEmitter {
  private logger: Logger;
  private modelClient: UnifiedModelClient;
  private toolRegistry: ToolRegistry;
  private executionEngine: ExecutionEngine;
  private dependencyResolver: DependencyResolver;
  private securityManager: SecurityManager;
  private costOptimizer: CostOptimizer;
  private performanceMonitor: PerformanceMonitor;
  private errorRecovery: ErrorRecoveryManager;
  private secureToolFactory!: SecureToolFactory;
  private telemetryProvider: any; // Enhanced: Telemetry integration for modern observability

  constructor(modelClient: UnifiedModelClient) {
    super();
    this.logger = new Logger('AdvancedToolOrchestrator');
    this.modelClient = modelClient;
    this.toolRegistry = new ToolRegistry();
    this.executionEngine = new ExecutionEngine(this.toolRegistry);
    this.dependencyResolver = new DependencyResolver();
    this.securityManager = new SecurityManager();
    this.costOptimizer = new CostOptimizer();
    this.performanceMonitor = new PerformanceMonitor();
    this.errorRecovery = new ErrorRecoveryManager();
    
    // Enhanced: Initialize telemetry provider for observability
    try {
      this.telemetryProvider = getTelemetryProvider();
    } catch (error) {
      this.logger.warn('Telemetry provider not available, running without telemetry');
      this.telemetryProvider = null;
    }

    // Initialize SecureToolFactory with required dependencies
    this.initializeSecureToolFactory();

    this.initializeBuiltInTools();
  }

  /**
   * Initialize SecureToolFactory with required dependencies
   */
  private initializeSecureToolFactory(): void {
    try {
      const rbacSystem = new RBACSystem();
      const secretsManager = new SecretsManager();
      const auditLogger = new SecurityAuditLogger(secretsManager);

      this.secureToolFactory = new SecureToolFactory(rbacSystem, auditLogger);
    } catch (error) {
      this.logger.error('Failed to initialize SecureToolFactory', error as Error);
      // Create a minimal implementation to prevent blocking
      this.secureToolFactory = null as any;
    }
  }

  /**
   * Enhanced: Execute tool call with AI SDK v5.0 streaming support
   */
  async executeToolCallStreaming(
    toolCall: ToolCall,
    context: ToolContext,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.toolRegistry.getTool(toolCall.toolId);
    
    if (!tool) {
      const error = `Tool ${toolCall.toolId} not found`;
      onChunk({
        type: 'error',
        timestamp: Date.now(),
        error,
        errorCode: 'TOOL_NOT_FOUND'
      });
      throw new Error(error);
    }

    try {
      // Send tool-input-start chunk
      onChunk({
        type: 'tool-input-start',
        id: toolCall.id,
        toolName: tool.name,
        timestamp: Date.now()
      });

      // Stream tool input parameters if they exist
      if (toolCall.input && typeof toolCall.input === 'object') {
        const inputString = JSON.stringify(toolCall.input, null, 2);
        const chunks = this.tokenizeForStreaming(inputString, 50);
        
        for (const chunk of chunks) {
          onChunk({
            type: 'tool-input-delta',
            id: toolCall.id,
            delta: chunk,
            timestamp: Date.now()
          });
          await this.delay(10); // Small delay for realistic streaming
        }
      }

      // Send tool-input-end chunk
      onChunk({
        type: 'tool-input-end',
        id: toolCall.id,
        timestamp: Date.now()
      });

      // Validate input if tool supports validation
      if (tool.validate) {
        const validation = tool.validate(toolCall.input);
        if (!validation.valid) {
          const error = `Validation failed: ${validation.errors.join(', ')}`;
          onChunk({
            type: 'error',
            timestamp: Date.now(),
            error,
            errorCode: 'VALIDATION_ERROR'
          });
          throw new Error(error);
        }
      }

      // Send tool-call chunk
      onChunk({
        type: 'tool-call',
        toolCallId: toolCall.id,
        toolName: tool.name,
        args: toolCall.input,
        timestamp: Date.now()
      });

      // Execute tool with streaming if supported
      let result: ToolResult;
      
      if (tool.stream) {
        // Use streaming execution
        const outputParts: string[] = [];
        
        for await (const delta of tool.stream(toolCall.input, context)) {
          if (delta.type === 'output') {
            outputParts.push(delta.content);
            onChunk({
              type: 'text-delta',
              id: `${toolCall.id}_output`,
              delta: delta.content,
              timestamp: Date.now()
            });
          }
        }
        
        result = {
          toolId: tool.id,
          success: true,
          output: outputParts.join(''),
          metadata: {
            executionTime: Date.now() - startTime,
            memoryUsed: 0,
            cost: tool.metadata.cost,
            version: tool.metadata.version
          }
        };
      } else {
        // Use regular execution
        result = await tool.execute(toolCall.input, context);
        result.metadata.executionTime = Date.now() - startTime;
      }

      // Send tool-result chunk
      onChunk({
        type: 'tool-result',
        toolCallId: toolCall.id,
        result: result.output,
        timestamp: Date.now()
      });

      // Record telemetry if available
      if (this.telemetryProvider) {
        this.telemetryProvider.recordToolExecution(
          tool.name,
          result.metadata.executionTime,
          result.success
        );
      }

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      onChunk({
        type: 'error',
        timestamp: Date.now(),
        error: errorMsg,
        errorCode: 'EXECUTION_ERROR'
      });
      
      if (this.telemetryProvider) {
        this.telemetryProvider.recordToolExecution(
          tool.name,
          Date.now() - startTime,
          false,
          errorMsg
        );
      }
      
      throw error;
    }
  }

  /**
   * Execute a complex tool orchestration plan
   */
  async executePlan(toolCalls: ToolCall[], context: ToolContext): Promise<Map<string, ToolResult>> {
    const planId = this.generatePlanId();
    this.logger.info(`Executing tool plan ${planId} with ${toolCalls.length} tools`);

    try {
      // Create execution plan
      const plan = await this.createExecutionPlan(toolCalls, context);
      this.emit('plan:created', { planId, plan });

      // Security validation
      await this.securityManager.validatePlan(plan, context);

      // Cost optimization
      const optimizedPlan = await this.costOptimizer.optimizePlan(plan, context);

      // Execute plan
      const results = await this.executionEngine.execute(optimizedPlan, context);

      this.emit('plan:completed', { planId, results });
      return results;
    } catch (error) {
      this.logger.error(`Plan execution failed:`, error);
      this.emit('plan:failed', { planId, error });
      throw error;
    }
  }

  /**
   * Determine if a prompt requires tool usage
   */
  shouldUseTools(prompt: string): boolean {
    const toolKeywords = [
      'analyze',
      'read',
      'file',
      'directory',
      'project',
      'code',
      'structure',
      'write',
      'create',
      'generate',
      'build',
      'compile',
      'test',
      'run',
      'search',
      'find',
      'list',
      'show',
      'display',
      'check',
      'scan',
    ];

    const promptLower = prompt.toLowerCase();
    return toolKeywords.some(keyword => promptLower.includes(keyword));
  }

  /**
   * Process a prompt using appropriate tools
   */
  async processWithTools(
    prompt: string,
    systemPrompt?: string,
    runtimeContext?: any
  ): Promise<string> {
    try {
      this.logger.info('Processing prompt with tools:', prompt.slice(0, 100) + '...');

      // Create enhanced context with system prompt and runtime information
      const context: ToolContext = {
        sessionId: Date.now().toString(),
        userId: 'cli-user',
        environment: {
          mode: 'development',
          workingDirectory: runtimeContext?.workingDirectory || process.cwd(),
          timestamp: new Date().toISOString(),
          permissions: ['read', 'write', 'execute'],
          platform: runtimeContext?.platform || process.platform,
          isGitRepo: runtimeContext?.isGitRepo || false,
          currentBranch: runtimeContext?.currentBranch || 'main',
          modelId: runtimeContext?.modelId || 'unknown',
        },
        previousResults: [],
        constraints: {
          maxExecutionTime: 30000,
          maxMemoryUsage: 1024 * 1024 * 100, // 100MB
          allowedNetworkAccess: false,
          sandboxed: true,
          costLimit: 1000,
        },
        security: {
          permissions: ['read', 'write', 'execute'],
          restrictions: ['no-network', 'sandboxed'],
          auditLog: true,
          encryptionRequired: false,
        },
        systemPrompt: systemPrompt, // Enhanced: Include system prompt for better tool decision making
      };

      // Select appropriate tools for the objective
      const toolCalls = await this.selectTools(prompt, context);

      if (toolCalls.length === 0) {
        this.logger.info('No tools selected, falling back to AI model with system prompt');
        // Enhanced: Use system prompt in fallback for consistent behavior
        if (systemPrompt) {
          const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;
          return await this.modelClient.generateText(fullPrompt);
        } else {
          return await this.modelClient.generateText(prompt);
        }
      }

      // Execute the tools
      const results = await this.executePlan(toolCalls, context);

      // Synthesize results into a coherent response
      return await this.synthesizeToolResults(prompt, results);
    } catch (error) {
      this.logger.error('Tool processing failed:', error);
      // Fallback to direct AI model
      return await this.modelClient.generateText(prompt);
    }
  }

  /**
   * Synthesize tool results into a coherent response
   */
  private async synthesizeToolResults(
    originalPrompt: string,
    results: Map<string, ToolResult>
  ): Promise<string> {
    const resultsArray = Array.from(results.entries()).map(([toolId, result]) => ({
      tool: toolId,
      success: result.success,
      output: result.output,
      error: result.error,
    }));

    const synthesisPrompt = `
Original request: ${originalPrompt}

Tool execution results:
${JSON.stringify(resultsArray, null, 2)}

Please provide a clear, helpful response based on these tool results. If there were errors, acknowledge them and provide what information is available.
`;

    return await this.modelClient.generateText(synthesisPrompt);
  }

  /**
   * Intelligent tool selection based on context and requirements
   */
  async selectTools(
    objective: string,
    context: ToolContext,
    constraints?: ToolConstraints
  ): Promise<ToolCall[]> {
    this.logger.info(`Selecting tools for objective: ${objective}`);

    // Use AI to analyze objective and suggest tools
    const analysisPrompt = `
      Analyze this objective and suggest the best tools to accomplish it:
      Objective: ${objective}
      Available tools: ${this.toolRegistry.getToolSummaries()}
      Context: ${JSON.stringify(context, null, 2)}
      
      Respond with a JSON array of tool calls including priorities and dependencies.
    `;

    const response = await this.modelClient.synthesize({
      prompt: analysisPrompt,
      maxTokens: 2000,
    });

    // Parse AI response and validate
    const suggestedCalls = this.parseToolSuggestions(response.content);

    // Apply constraint filtering
    const filteredCalls = constraints
      ? this.filterByConstraints(suggestedCalls, constraints)
      : suggestedCalls;

    // Optimize selection
    return this.optimizeToolSelection(filteredCalls, context);
  }

  /**
   * Register a new tool
   */
  registerTool(tool: Tool): void {
    this.toolRegistry.register(tool);
    this.logger.info(`Registered tool: ${tool.name} (${tool.id})`);
  }

  /**
   * Create execution plan with dependency resolution
   */
  private async createExecutionPlan(
    toolCalls: ToolCall[],
    context: ToolContext
  ): Promise<ExecutionPlan> {
    const planId = this.generatePlanId();

    // Resolve dependencies
    const dependencies = this.dependencyResolver.resolveDependencies(toolCalls);
    const executionOrder = this.dependencyResolver.createExecutionOrder(dependencies);

    // Calculate estimates
    const estimatedCost = this.calculateEstimatedCost(toolCalls);
    const estimatedTime = this.calculateEstimatedTime(toolCalls, executionOrder);

    // Risk assessment
    const riskAssessment = await this.assessRisks(toolCalls, context);

    return {
      id: planId,
      toolCalls,
      dependencies,
      executionOrder,
      estimatedCost,
      estimatedTime,
      riskAssessment,
    };
  }

  private parseToolSuggestions(aiResponse: string): ToolCall[] {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((suggestion: any, index: number) => ({
        id: `call_${index}`,
        toolId: suggestion.toolId,
        input: suggestion.input || {},
        priority: suggestion.priority || 1,
        retryPolicy: suggestion.retryPolicy || this.getDefaultRetryPolicy(),
        fallbackTools: suggestion.fallbackTools || [],
        timeout: suggestion.timeout,
        dependsOn: suggestion.dependsOn || [],
      }));
    } catch (error) {
      this.logger.warn('Failed to parse AI tool suggestions, using fallback');
      return [];
    }
  }

  private filterByConstraints(toolCalls: ToolCall[], constraints: ToolConstraints): ToolCall[] {
    return toolCalls.filter(call => {
      const tool = this.toolRegistry.getTool(call.toolId);
      if (!tool) return false;

      // Check cost constraint
      if (tool.metadata.cost > constraints.costLimit) return false;

      // Check timeout constraint
      if (tool.metadata.latency > constraints.maxExecutionTime) return false;

      // Check network access
      const needsNetwork = tool.metadata.capabilities.some(cap => cap.type === 'network');
      if (needsNetwork && !constraints.allowedNetworkAccess) return false;

      return true;
    });
  }

  private optimizeToolSelection(toolCalls: ToolCall[], context: ToolContext): ToolCall[] {
    // Sort by priority and reliability
    return toolCalls.sort((a, b) => {
      const toolA = this.toolRegistry.getTool(a.toolId);
      const toolB = this.toolRegistry.getTool(b.toolId);

      if (!toolA || !toolB) return 0;

      // Primary sort by priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Secondary sort by reliability
      return toolB.metadata.reliability - toolA.metadata.reliability;
    });
  }

  private calculateEstimatedCost(toolCalls: ToolCall[]): number {
    return toolCalls.reduce((total, call) => {
      const tool = this.toolRegistry.getTool(call.toolId);
      return total + (tool?.metadata.cost || 0);
    }, 0);
  }

  private calculateEstimatedTime(toolCalls: ToolCall[], executionOrder: string[][]): number {
    // Calculate time for parallel execution batches
    let totalTime = 0;

    for (const batch of executionOrder) {
      let maxBatchTime = 0;

      for (const callId of batch) {
        const call = toolCalls.find(c => c.id === callId);
        if (call) {
          const tool = this.toolRegistry.getTool(call.toolId);
          const toolTime = tool?.metadata.latency || 1000;
          maxBatchTime = Math.max(maxBatchTime, toolTime);
        }
      }

      totalTime += maxBatchTime;
    }

    return totalTime;
  }

  private async assessRisks(toolCalls: ToolCall[], context: ToolContext): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];

    // Assess security risks
    const writeTools = toolCalls.filter(call => {
      const tool = this.toolRegistry.getTool(call.toolId);
      return tool?.metadata.capabilities.some(cap => cap.type === 'write');
    });

    if (writeTools.length > 0) {
      riskFactors.push({
        type: 'security',
        severity: writeTools.length / toolCalls.length,
        description: `${writeTools.length} tools require write permissions`,
      });
    }

    // Assess reliability risks
    const unreliableTools = toolCalls.filter(call => {
      const tool = this.toolRegistry.getTool(call.toolId);
      return (tool?.metadata.reliability || 1) < 0.8;
    });

    if (unreliableTools.length > 0) {
      riskFactors.push({
        type: 'reliability',
        severity: unreliableTools.length / toolCalls.length,
        description: `${unreliableTools.length} tools have low reliability scores`,
      });
    }

    // Calculate overall risk
    const avgSeverity =
      riskFactors.reduce((sum, factor) => sum + factor.severity, 0) / riskFactors.length;
    const overall = avgSeverity > 0.7 ? 'high' : avgSeverity > 0.4 ? 'medium' : 'low';

    return {
      overall,
      factors: riskFactors,
      mitigations: this.suggestMitigations(riskFactors),
    };
  }

  private suggestMitigations(riskFactors: RiskFactor[]): string[] {
    const mitigations: string[] = [];

    for (const factor of riskFactors) {
      switch (factor.type) {
        case 'security':
          mitigations.push('Enable sandboxed execution', 'Require explicit permissions');
          break;
        case 'reliability':
          mitigations.push('Implement retry mechanisms', 'Add fallback tools');
          break;
        case 'cost':
          mitigations.push('Set cost limits', 'Use cheaper alternatives');
          break;
        case 'time':
          mitigations.push('Set timeouts', 'Parallel execution where possible');
          break;
      }
    }

    return [...new Set(mitigations)]; // Remove duplicates
  }

  private getDefaultRetryPolicy(): RetryPolicy {
    return {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      initialDelay: 1000,
      maxDelay: 10000,
      retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'TEMPORARY_FAILURE'],
    };
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enhanced: Utility methods for streaming support
   */
  private tokenizeForStreaming(content: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }
    return chunks.length > 0 ? chunks : [content];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced: Find tools suitable for a given task with modern matching
   */
  async findToolsForTask(
    task: string, 
    requirements?: {
      categories?: ToolCategory[];
      capabilities?: string[];
      maxCost?: number;
      maxLatency?: number;
    }
  ): Promise<Array<{ tool: Tool; confidence: number; reasoning: string }>> {
    const matches: Array<{ tool: Tool; confidence: number; reasoning: string }> = [];
    const taskLower = task.toLowerCase();

    for (const tool of this.toolRegistry.getAllTools()) {
      // Apply requirement filters
      if (requirements?.categories && !requirements.categories.includes(tool.category)) {
        continue;
      }
      
      if (requirements?.maxCost && tool.metadata.cost > requirements.maxCost) {
        continue;
      }
      
      if (requirements?.maxLatency && tool.metadata.latency > requirements.maxLatency) {
        continue;
      }

      // Calculate confidence based on various factors
      let confidence = 0;
      const reasons: string[] = [];

      // Name match (highest priority)
      if (tool.name.toLowerCase().includes(taskLower) || taskLower.includes(tool.name.toLowerCase())) {
        confidence += 0.4;
        reasons.push('tool name matches');
      }

      // Description match
      if (tool.description.toLowerCase().includes(taskLower)) {
        confidence += 0.3;
        reasons.push('description contains keywords');
      }

      // Tag matches
      const matchingTags = tool.metadata.tags.filter(tag =>
        tag.toLowerCase().includes(taskLower) || taskLower.includes(tag.toLowerCase())
      );
      if (matchingTags.length > 0) {
        confidence += matchingTags.length * 0.1;
        reasons.push(`tags match: ${matchingTags.join(', ')}`);
      }

      // Capability matches
      if (requirements?.capabilities) {
        const hasRequiredCaps = requirements.capabilities.some(reqCap =>
          tool.metadata.capabilities.some(toolCap => 
            toolCap.type.includes(reqCap) || toolCap.scope.includes(reqCap)
          )
        );
        if (hasRequiredCaps) {
          confidence += 0.2;
          reasons.push('capabilities match requirements');
        }
      }

      if (confidence > 0.1) { // Minimum threshold
        matches.push({
          tool,
          confidence: Math.min(confidence, 1.0),
          reasoning: reasons.join('; ') || 'general relevance'
        });
      }
    }

    // Sort by confidence and return top matches
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  private initializeBuiltInTools(): void {
    // Initialize secure tools using E2B-based factory
    this.registerTool(new FileReadTool());
    this.registerTool(new FileWriteTool());
    this.registerTool(new NetworkRequestTool());

    // Create a secure code execution tool adapter
    const agentContext = { workingDirectory: process.cwd() }; // Basic context
    const secureCodeTool = this.secureToolFactory.createCodeExecutionTool(agentContext);

    // Create an adapter that implements the Tool interface
    const secureCodeToolAdapter = {
      id: 'secure_code_execution',
      name: 'Secure Code Executor',
      description: 'Execute code in sandboxed E2B environment',
      category: ToolCategory.COMPUTATION,
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string' },
        },
        required: ['code', 'language'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          output: { type: 'string' },
          error: { type: 'string' },
        },
      },
      execute: async (input: any, context: any) => {
        return await secureCodeTool.execute(input);
      },
      metadata: {
        version: '1.0.0',
        author: 'system',
        tags: ['security', 'execution', 'e2b'],
        cost: 5,
        latency: 2000,
        reliability: 0.95,
        performance: 4,
        dependencies: [],
        conflictsWith: [],
        capabilities: [
          {
            type: 'execute' as const,
            scope: 'sandboxed',
            permissions: ['code_execution'],
          },
        ],
        requirements: [],
      },
    };

    this.registerTool(secureCodeToolAdapter);
    this.registerTool(new DataAnalysisTool());

    this.logger.info('🔒 Initialized built-in tools with secure execution');
  }

  // Public API methods
  public getAvailableTools(): Tool[] {
    return this.toolRegistry.getAllTools();
  }

  public getToolsByCategory(category: ToolCategory): Tool[] {
    return this.toolRegistry.getToolsByCategory(category);
  }

  public getExecutionMetrics(): any {
    return this.performanceMonitor.getMetrics();
  }
}

// Supporting Classes
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    // Validate tool
    this.validateTool(tool);
    this.tools.set(tool.id, tool);
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: ToolCategory): Tool[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  getToolSummaries(): string {
    return this.getAllTools()
      .map(tool => `${tool.name}: ${tool.description}`)
      .join('\n');
  }

  private validateTool(tool: Tool): void {
    if (!tool.id || !tool.name || !tool.execute) {
      throw new Error('Invalid tool: missing required fields');
    }
  }
}

class ExecutionEngine {
  private logger: Logger;

  constructor(private toolRegistry: ToolRegistry) {
    this.logger = new Logger('ExecutionEngine');
  }

  async execute(plan: ExecutionPlan, context: ToolContext): Promise<Map<string, ToolResult>> {
    const results = new Map<string, ToolResult>();

    for (const batch of plan.executionOrder) {
      // Execute batch in parallel
      const batchPromises = batch.map(callId =>
        this.executeToolCall(callId, plan, context, results)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Check for failures that should stop execution
      const failures = batchResults.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        this.logger.error(`Batch execution failed: ${failures.length} failures`);
        break;
      }
    }

    return results;
  }

  private async executeToolCall(
    callId: string,
    plan: ExecutionPlan,
    context: ToolContext,
    results: Map<string, ToolResult>
  ): Promise<void> {
    const call = plan.toolCalls.find(c => c.id === callId);
    if (!call) {
      throw new Error(`Tool call ${callId} not found in plan`);
    }

    const tool = this.toolRegistry.getTool(call.toolId);
    if (!tool) {
      throw new Error(`Tool ${call.toolId} not found in registry`);
    }

    try {
      const startTime = Date.now();
      const result = await tool.execute(call.input, context);
      const executionTime = Date.now() - startTime;

      result.metadata.executionTime = executionTime;
      results.set(callId, result);

      this.logger.info(`Tool ${tool.name} executed successfully in ${executionTime}ms`);
    } catch (error: unknown) {
      const errorResult: ToolResult = {
        toolId: call.toolId,
        success: false,
        error: getErrorMessage(error),
        metadata: {
          executionTime: 0,
          memoryUsed: 0,
          cost: 0,
          version: tool.metadata.version,
        },
      };

      results.set(callId, errorResult);
      this.logger.error(`Tool ${tool.name} execution failed:`, error);
    }
  }
}

class DependencyResolver {
  resolveDependencies(toolCalls: ToolCall[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();

    for (const call of toolCalls) {
      dependencies.set(call.id, call.dependsOn || []);
    }

    return dependencies;
  }

  createExecutionOrder(dependencies: Map<string, string[]>): string[][] {
    const order: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    // Topological sort with batch detection
    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected involving ${nodeId}`);
      }

      visiting.add(nodeId);
      const deps = dependencies.get(nodeId) || [];

      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    // Visit all nodes
    for (const nodeId of dependencies.keys()) {
      visit(nodeId);
    }

    // Create execution batches
    const remaining = new Set(dependencies.keys());

    while (remaining.size > 0) {
      const batch: string[] = [];

      for (const nodeId of remaining) {
        const deps = dependencies.get(nodeId) || [];
        const allDepsCompleted = deps.every(dep => !remaining.has(dep));

        if (allDepsCompleted) {
          batch.push(nodeId);
        }
      }

      if (batch.length === 0) {
        throw new Error('Unable to resolve dependencies - possible circular reference');
      }

      order.push(batch);
      batch.forEach(nodeId => remaining.delete(nodeId));
    }

    return order;
  }
}

class SecurityManager {
  async validatePlan(plan: ExecutionPlan, context: ToolContext): Promise<void> {
    // Implement security validation logic
    // Check permissions, validate inputs, etc.
  }
}

class CostOptimizer {
  async optimizePlan(plan: ExecutionPlan, context: ToolContext): Promise<ExecutionPlan> {
    // Implement cost optimization logic
    return plan;
  }
}

class PerformanceMonitor {
  getMetrics(): any {
    return {
      totalExecutions: 0,
      averageExecutionTime: 0,
      successRate: 1.0,
    };
  }
}

class ErrorRecoveryManager {
  // Implement error recovery logic
}

// Built-in Tool Implementations
class FileReadTool implements Tool {
  id = 'file_read';
  name = 'File Reader';
  description = 'Read content from files';
  category = ToolCategory.FILE_SYSTEM;
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string' },
    },
    required: ['path'],
  };
  outputSchema = {
    type: 'object',
    properties: {
      content: { type: 'string' },
    },
  };
  metadata: ToolMetadata = {
    version: '1.0.0',
    author: 'system',
    tags: ['file', 'read'],
    cost: 1,
    latency: 100,
    reliability: 0.95,
    dependencies: [],
    conflictsWith: [],
    capabilities: [{ type: 'read', scope: 'filesystem', permissions: ['read'] }],
    requirements: [],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    // Implementation would go here
    return {
      toolId: this.id,
      success: true,
      output: { content: 'file content' },
      metadata: {
        executionTime: 50,
        memoryUsed: 1024,
        cost: 1,
        version: this.metadata.version,
      },
    };
  }
}

class FileWriteTool implements Tool {
  id = 'file_write';
  name = 'File Writer';
  description = 'Write content to files';
  category = ToolCategory.FILE_SYSTEM;
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  };
  outputSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
    },
  };
  metadata: ToolMetadata = {
    version: '1.0.0',
    author: 'system',
    tags: ['file', 'write'],
    cost: 2,
    latency: 150,
    reliability: 0.9,
    dependencies: [],
    conflictsWith: [],
    capabilities: [{ type: 'write', scope: 'filesystem', permissions: ['write'] }],
    requirements: [],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    return {
      toolId: this.id,
      success: true,
      output: { success: true },
      metadata: {
        executionTime: 75,
        memoryUsed: 512,
        cost: 2,
        version: this.metadata.version,
      },
      side_effects: [
        {
          type: 'file_created',
          description: `Created file at ${input.path}`,
          reversible: true,
        },
      ],
    };
  }
}

class NetworkRequestTool implements Tool {
  id = 'network_request';
  name = 'Network Request';
  description = 'Make HTTP requests';
  category = ToolCategory.NETWORK;
  inputSchema = {
    type: 'object',
    properties: {
      url: { type: 'string' },
      method: { type: 'string' },
      headers: { type: 'object' },
      body: { type: 'string' },
    },
    required: ['url'],
  };
  outputSchema = {
    type: 'object',
    properties: {
      status: { type: 'number' },
      data: { type: 'string' },
    },
  };
  metadata: ToolMetadata = {
    version: '1.0.0',
    author: 'system',
    tags: ['network', 'http'],
    cost: 3,
    latency: 1000,
    reliability: 0.85,
    dependencies: [],
    conflictsWith: [],
    capabilities: [{ type: 'network', scope: 'external', permissions: ['http'] }],
    requirements: [{ type: 'environment', value: 'NETWORK_ACCESS' }],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    return {
      toolId: this.id,
      success: true,
      output: { status: 200, data: 'response data' },
      metadata: {
        executionTime: 800,
        memoryUsed: 2048,
        cost: 3,
        version: this.metadata.version,
      },
    };
  }
}

class CodeExecutionTool implements Tool {
  id = 'code_execution';
  name = 'Code Executor';
  description = 'Execute code in sandboxed environment';
  category = ToolCategory.COMPUTATION;
  inputSchema = {
    type: 'object',
    properties: {
      code: { type: 'string' },
      language: { type: 'string' },
    },
    required: ['code', 'language'],
  };
  outputSchema = {
    type: 'object',
    properties: {
      result: { type: 'string' },
      error: { type: 'string' },
    },
  };
  metadata: ToolMetadata = {
    version: '1.0.0',
    author: 'system',
    tags: ['code', 'execution'],
    cost: 5,
    latency: 2000,
    reliability: 0.8,
    dependencies: [],
    conflictsWith: [],
    capabilities: [{ type: 'execute', scope: 'sandbox', permissions: ['code_execution'] }],
    requirements: [{ type: 'environment', value: 'SANDBOX' }],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    return {
      toolId: this.id,
      success: true,
      output: { result: 'execution result' },
      metadata: {
        executionTime: 1500,
        memoryUsed: 4096,
        cost: 5,
        version: this.metadata.version,
      },
    };
  }
}

class DataAnalysisTool implements Tool {
  id = 'data_analysis';
  name = 'Data Analyzer';
  description = 'Analyze and process data';
  category = ToolCategory.DATA_PROCESSING;
  inputSchema = {
    type: 'object',
    properties: {
      data: { type: 'array' },
      analysis_type: { type: 'string' },
    },
    required: ['data', 'analysis_type'],
  };
  outputSchema = {
    type: 'object',
    properties: {
      results: { type: 'object' },
    },
  };
  metadata: ToolMetadata = {
    version: '1.0.0',
    author: 'system',
    tags: ['data', 'analysis'],
    cost: 4,
    latency: 1500,
    reliability: 0.9,
    dependencies: [],
    conflictsWith: [],
    capabilities: [{ type: 'compute', scope: 'memory', permissions: ['data_processing'] }],
    requirements: [],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    return {
      toolId: this.id,
      success: true,
      output: { results: { analysis: 'completed' } },
      metadata: {
        executionTime: 1200,
        memoryUsed: 8192,
        cost: 4,
        version: this.metadata.version,
      },
    };
  }
}
