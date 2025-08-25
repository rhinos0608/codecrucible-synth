/**
 * Enterprise MCP Orchestrator - Advanced tool coordination with security
 * Implements dynamic capability discovery and secure tool execution
 */

import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import {
  EnterpriseSecurityFramework,
  SecurityContext,
} from '../security/enterprise-security-framework.js';
import { logger } from '../logger.js';

export interface ToolCoordination {
  sequence: ToolSequence;
  expectedDuration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  fallbackStrategy: FallbackStrategy;
}

export interface ToolSequence {
  id: string;
  steps: ToolExecutionStep[];
  initialContext: ExecutionContext;
  parallelExecution: boolean;
  timeoutMs: number;
}

export interface ToolExecutionStep {
  id: string;
  name: string;
  toolName: string;
  serverId: string;
  args: any;
  dependencies: string[];
  qualityGate?: QualityGate;
  timeout: number;
  retries: number;
  securityLevel: 'safe' | 'restricted' | 'dangerous';
}

export interface ExecutionContext {
  sessionId: string;
  workingDirectory: string;
  environment: string;
  permissions: string[];
  constraints: any[];
  securityContext: SecurityContext;
}

export interface ToolCapability {
  serverId: string;
  name: string;
  description: string;
  schema: any;
  reliability: number;
  securityLevel: 'safe' | 'restricted' | 'dangerous';
  dependencies: string[];
  averageExecutionTime: number;
  successRate: number;
}

export interface QualityGate {
  id: string;
  name: string;
  criteria: QualityCriteria[];
  threshold: number;
  automated: boolean;
  blocking: boolean;
}

export interface QualityCriteria {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number | string;
  weight: number;
}

export interface FallbackStrategy {
  enabled: boolean;
  alternatives: AlternativeTool[];
  degradationLevels: DegradationLevel[];
}

export interface AlternativeTool {
  toolName: string;
  serverId: string;
  confidence: number;
  tradeoffs: string[];
}

export interface DegradationLevel {
  level: number;
  description: string;
  availableTools: string[];
  limitations: string[];
}

export interface SequenceResult {
  success: boolean;
  results: ToolResult[];
  finalContext: ExecutionContext;
  duration: number;
  qualityScore: number;
  errors?: ExecutionError[];
}

export interface ToolResult {
  stepId: string;
  toolName: string;
  success: boolean;
  output: any;
  duration: number;
  qualityScore?: number;
  securityValidation: SecurityValidation;
}

export interface ExecutionError {
  stepId: string;
  type: string;
  message: string;
  recoverable: boolean;
  suggestedActions: string[];
}

export interface SecurityValidation {
  validated: boolean;
  riskScore: number;
  violations: string[];
  mitigations: string[];
}

export class EnterpriseMCPOrchestrator {
  private mcpManager: MCPServerManager;
  private securityFramework: EnterpriseSecurityFramework;
  private capabilityCache: Map<string, ToolCapability[]> = new Map();
  private performanceMetrics: Map<string, PerformanceMetric[]> = new Map();
  private cacheExpirationMs = 300000; // 5 minutes

  constructor(mcpManager: MCPServerManager) {
    this.mcpManager = mcpManager;
    this.securityFramework = new EnterpriseSecurityFramework();
  }

  async discoverAndCoordinateTools(context: ExecutionContext): Promise<ToolCoordination> {
    logger.info('Starting tool discovery and coordination', { sessionId: context.sessionId });

    // Dynamic capability discovery
    const capabilities = await this.discoverCapabilities();

    // Security validation of tools
    const validatedTools = await this.validateToolSecurity(capabilities, context);

    // Tool selection and sequencing
    const coordination = await this.createToolCoordination(validatedTools, context);

    logger.info('Tool coordination complete', {
      sessionId: context.sessionId,
      sequenceLength: coordination.sequence.steps.length,
      riskLevel: coordination.riskLevel,
    });

    return coordination;
  }

  async discoverCapabilities(): Promise<ToolCapability[]> {
    const cacheKey = 'all_capabilities';

    // Check cache first
    if (this.capabilityCache.has(cacheKey)) {
      const cached = this.capabilityCache.get(cacheKey)!;
      if (Date.now() - (cached as any).timestamp < this.cacheExpirationMs) {
        logger.debug('Using cached capabilities');
        return cached;
      }
    }

    logger.info('Discovering MCP server capabilities');
    const servers = await this.mcpManager.listServers();
    const allCapabilities: ToolCapability[] = [];

    for (const server of servers) {
      try {
        const tools = server.capabilities?.tools || [];
        const resources = server.capabilities?.resources || [];
        const prompts = server.capabilities?.prompts || [];

        const serverCapabilities = tools.map((tool: any) => ({
          serverId: server.id,
          name: tool.name,
          description: tool.description,
          schema: tool.inputSchema,
          reliability: this.getToolReliability(server.id, tool.name),
          securityLevel: this.assessToolSecurity(tool) as 'safe' | 'restricted' | 'dangerous',
          dependencies: this.identifyToolDependencies(tool),
          averageExecutionTime: this.getAverageExecutionTime(server.id, tool.name),
          successRate: this.getSuccessRate(server.id, tool.name),
        }));

        allCapabilities.push(...serverCapabilities);

        logger.debug('Discovered capabilities for server', {
          serverId: server.id,
          toolCount: tools.length,
          resourceCount: resources.length,
          promptCount: prompts.length,
        });
      } catch (error) {
        logger.warn(`Failed to discover capabilities for server ${server.id}:`, error);
      }
    }

    // Cache the results
    (allCapabilities as any).timestamp = Date.now();
    this.capabilityCache.set(cacheKey, allCapabilities);

    logger.info('Capability discovery complete', { totalTools: allCapabilities.length });
    return allCapabilities;
  }

  async executeToolSequence(sequence: ToolSequence): Promise<SequenceResult> {
    logger.info('Executing tool sequence', {
      sequenceId: sequence.id,
      stepCount: sequence.steps.length,
      parallel: sequence.parallelExecution,
    });

    const results: ToolResult[] = [];
    const errors: ExecutionError[] = [];
    let currentContext = sequence.initialContext;
    const startTime = Date.now();

    if (sequence.parallelExecution) {
      // Execute independent steps in parallel
      const parallelGroups = this.groupStepsByDependencies(sequence.steps);

      for (const group of parallelGroups) {
        const groupResults = await Promise.allSettled(
          group.map(async step => this.executeStep(step, currentContext))
        );

        groupResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value.result);
            currentContext = this.updateContext(currentContext, result.value.result);
          } else {
            errors.push({
              stepId: group[index].id,
              type: 'execution_failure',
              message: result.reason.message,
              recoverable: this.isRecoverableError(result.reason),
              suggestedActions: this.getSuggestedActions(result.reason),
            });
          }
        });
      }
    } else {
      // Execute steps sequentially
      for (const step of sequence.steps) {
        try {
          // Pre-execution validation
          await this.validateStepExecution(step, currentContext);

          // Execute with timeout and retries
          const result = await this.executeWithRetries(step, currentContext);

          // Post-execution validation
          await this.validateStepResult(result);

          results.push(result);
          currentContext = this.updateContext(currentContext, result);

          // Quality gate check
          if (step.qualityGate) {
            const passed = await this.checkQualityGate(step.qualityGate, result);
            if (!passed) {
              throw new Error(`Quality gate failed for step: ${step.name}`);
            }
          }
        } catch (error: any) {
          // Implement recovery strategy
          const recovery = await this.attemptRecovery(step, error, currentContext);
          if (!recovery.success) {
            errors.push({
              stepId: step.id,
              type: 'execution_failure',
              message: error.message,
              recoverable: this.isRecoverableError(error),
              suggestedActions: this.getSuggestedActions(error),
            });

            if (step.qualityGate?.blocking) {
              break; // Stop execution on blocking failure
            }
          } else {
            results.push(recovery.result);
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    const qualityScore = this.calculateSequenceQualityScore(results);

    const sequenceResult: SequenceResult = {
      success: errors.length === 0 || errors.every(e => e.recoverable),
      results,
      finalContext: currentContext,
      duration,
      qualityScore,
      errors: errors.length > 0 ? errors : undefined,
    };

    logger.info('Tool sequence execution complete', {
      sequenceId: sequence.id,
      success: sequenceResult.success,
      duration,
      qualityScore,
      errorCount: errors.length,
    });

    return sequenceResult;
  }

  private async validateToolSecurity(
    capabilities: ToolCapability[],
    context: ExecutionContext
  ): Promise<ToolCapability[]> {
    const validatedTools: ToolCapability[] = [];

    for (const capability of capabilities) {
      try {
        const validation = await this.securityFramework.validateAgentAction(
          'mcp-orchestrator',
          {
            type: 'tool_usage',
            agentId: 'mcp-orchestrator',
            payload: {
              toolName: capability.name,
              serverId: capability.serverId,
              securityLevel: capability.securityLevel,
            },
            timestamp: new Date(),
          },
          context.securityContext
        );

        if (validation.allowed) {
          validatedTools.push(capability);
        } else {
          logger.warn('Tool failed security validation', {
            toolName: capability.name,
            serverId: capability.serverId,
            violations: validation.violations.map(v => v.type),
          });
        }
      } catch (error) {
        logger.error('Security validation error', {
          toolName: capability.name,
          error,
        });
      }
    }

    return validatedTools;
  }

  private async createToolCoordination(
    tools: ToolCapability[],
    context: ExecutionContext
  ): Promise<ToolCoordination> {
    // Analyze available tools and create optimal sequence
    const riskLevel = this.assessOverallRisk(tools, context);
    const fallbackStrategy = this.createFallbackStrategy(tools, context);

    // Create optimized tool sequence
    const sequence: ToolSequence = {
      id: this.generateSequenceId(),
      steps: this.optimizeToolSequence(tools, context),
      initialContext: context,
      parallelExecution: this.shouldUseParallelExecution(tools, context),
      timeoutMs: this.calculateSequenceTimeout(tools),
    };

    return {
      sequence,
      expectedDuration: this.calculateExpectedDuration(sequence.steps),
      riskLevel,
      fallbackStrategy,
    };
  }

  private optimizeToolSequence(
    tools: ToolCapability[],
    context: ExecutionContext
  ): ToolExecutionStep[] {
    // Create execution steps based on available tools and context
    const steps: ToolExecutionStep[] = [];

    // Add essential tools based on context
    if (context.permissions.includes('file_access')) {
      const fileTools = tools.filter(t => t.name.includes('file') || t.name.includes('read'));
      fileTools.forEach((tool, index) => {
        steps.push({
          id: `step_${steps.length + 1}`,
          name: `File operation: ${tool.name}`,
          toolName: tool.name,
          serverId: tool.serverId,
          args: {},
          dependencies: index > 0 ? [`step_${steps.length}`] : [],
          timeout: tool.averageExecutionTime * 2,
          retries: tool.reliability > 0.9 ? 1 : 2,
          securityLevel: tool.securityLevel,
        });
      });
    }

    return steps;
  }

  private groupStepsByDependencies(steps: ToolExecutionStep[]): ToolExecutionStep[][] {
    const groups: ToolExecutionStep[][] = [];
    const processed = new Set<string>();

    while (processed.size < steps.length) {
      const currentGroup: ToolExecutionStep[] = [];

      for (const step of steps) {
        if (processed.has(step.id)) continue;

        // Check if all dependencies are processed
        const dependenciesSatisfied = step.dependencies.every(dep => processed.has(dep));

        if (dependenciesSatisfied) {
          currentGroup.push(step);
          processed.add(step.id);
        }
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      } else {
        // Break infinite loop if no progress
        break;
      }
    }

    return groups;
  }

  private async executeStep(
    step: ToolExecutionStep,
    context: ExecutionContext
  ): Promise<{ result: ToolResult; context: ExecutionContext }> {
    const startTime = Date.now();

    try {
      // Get the appropriate server
      const server = this.mcpManager.getServerStatus(step.serverId) as any;
      if (!server) {
        throw new Error(`Server not found: ${step.serverId}`);
      }

      // Execute the tool
      const output = await server.callTool(step.toolName, step.args);

      // Security validation of output
      const securityValidation = await this.validateToolOutput(output, step, context);

      const result: ToolResult = {
        stepId: step.id,
        toolName: step.toolName,
        success: true,
        output,
        duration: Date.now() - startTime,
        securityValidation,
      };

      return { result, context };
    } catch (error: any) {
      const result: ToolResult = {
        stepId: step.id,
        toolName: step.toolName,
        success: false,
        output: { error: error.message },
        duration: Date.now() - startTime,
        securityValidation: {
          validated: false,
          riskScore: 0,
          violations: [],
          mitigations: [],
        },
      };

      throw { result, error };
    }
  }

  private async validateToolOutput(
    output: any,
    step: ToolExecutionStep,
    context: ExecutionContext
  ): Promise<SecurityValidation> {
    // Basic output validation
    const violations: string[] = [];
    let riskScore = 0;

    // Check for sensitive data in output
    if (typeof output === 'string') {
      const sensitivePatterns = ['password', 'secret', 'api_key', 'private_key'];
      for (const pattern of sensitivePatterns) {
        if (output.toLowerCase().includes(pattern)) {
          violations.push(`Potential sensitive data detected: ${pattern}`);
          riskScore += 25;
        }
      }
    }

    // Check for excessive output size
    const outputSize = JSON.stringify(output).length;
    if (outputSize > 1000000) {
      // 1MB
      violations.push('Output size exceeds safety threshold');
      riskScore += 15;
    }

    return {
      validated: violations.length === 0,
      riskScore,
      violations,
      mitigations: violations.map(v => `Mitigation for: ${v}`),
    };
  }

  private assessOverallRisk(
    tools: ToolCapability[],
    context: ExecutionContext
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Risk based on tool security levels
    const dangerousTools = tools.filter(t => t.securityLevel === 'dangerous');
    const restrictedTools = tools.filter(t => t.securityLevel === 'restricted');

    riskScore += dangerousTools.length * 40;
    riskScore += restrictedTools.length * 20;

    // Risk based on environment
    if (context.environment === 'production') {
      riskScore += 30;
    }

    // Risk based on permissions
    if (context.permissions.includes('admin')) {
      riskScore += 25;
    }

    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }

  // Helper methods for capability assessment
  private getToolReliability(serverId: string, toolName: string): number {
    const metrics = this.performanceMetrics.get(`${serverId}:${toolName}`);
    if (!metrics || metrics.length === 0) return 0.85; // Default reliability

    const successRate = metrics.reduce((sum, m) => sum + (m.success ? 1 : 0), 0) / metrics.length;
    return successRate;
  }

  private assessToolSecurity(tool: any): string {
    // Basic security assessment based on tool name and description
    const dangerousPatterns = ['delete', 'remove', 'destroy', 'format', 'sudo'];
    const restrictedPatterns = ['write', 'modify', 'create', 'execute'];

    const name = tool.name.toLowerCase();
    const description = (tool.description || '').toLowerCase();

    if (dangerousPatterns.some(p => name.includes(p) || description.includes(p))) {
      return 'dangerous';
    }
    if (restrictedPatterns.some(p => name.includes(p) || description.includes(p))) {
      return 'restricted';
    }
    return 'safe';
  }

  private identifyToolDependencies(tool: any): string[] {
    // Analyze tool schema for dependencies
    // This is a simplified implementation
    return [];
  }

  private getAverageExecutionTime(serverId: string, toolName: string): number {
    const metrics = this.performanceMetrics.get(`${serverId}:${toolName}`);
    if (!metrics || metrics.length === 0) return 1000; // Default 1 second

    const avgTime = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    return avgTime;
  }

  private getSuccessRate(serverId: string, toolName: string): number {
    return this.getToolReliability(serverId, toolName);
  }

  // Additional helper methods...
  private shouldUseParallelExecution(tools: ToolCapability[], context: ExecutionContext): boolean {
    // Use parallel execution for low-risk environments with reliable tools
    const reliableTools = tools.filter(t => t.reliability > 0.9);
    return reliableTools.length > 2 && context.environment !== 'production';
  }

  private calculateSequenceTimeout(tools: ToolCapability[]): number {
    const totalEstimatedTime = tools.reduce((sum, tool) => sum + tool.averageExecutionTime, 0);
    return totalEstimatedTime * 2; // 2x buffer
  }

  private calculateExpectedDuration(steps: ToolExecutionStep[]): number {
    return steps.reduce((sum, step) => sum + step.timeout, 0);
  }

  private generateSequenceId(): string {
    return `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createFallbackStrategy(
    tools: ToolCapability[],
    context: ExecutionContext
  ): FallbackStrategy {
    return {
      enabled: true,
      alternatives: [],
      degradationLevels: [
        {
          level: 1,
          description: 'Full functionality with all tools',
          availableTools: tools.map(t => t.name),
          limitations: [],
        },
        {
          level: 2,
          description: 'Safe tools only',
          availableTools: tools.filter(t => t.securityLevel === 'safe').map(t => t.name),
          limitations: ['No file modifications', 'No system commands'],
        },
      ],
    };
  }

  // Placeholder methods that would be implemented based on specific requirements
  private async validateStepExecution(
    step: ToolExecutionStep,
    context: ExecutionContext
  ): Promise<void> {}
  private async executeWithRetries(
    step: ToolExecutionStep,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return {} as ToolResult;
  }
  private async validateStepResult(result: ToolResult): Promise<void> {}
  private updateContext(context: ExecutionContext, result: ToolResult): ExecutionContext {
    return context;
  }
  private async checkQualityGate(gate: QualityGate, result: ToolResult): Promise<boolean> {
    return true;
  }
  private async attemptRecovery(
    step: ToolExecutionStep,
    error: any,
    context: ExecutionContext
  ): Promise<{ success: boolean; result: ToolResult }> {
    return { success: false, result: {} as ToolResult };
  }
  private isRecoverableError(error: any): boolean {
    return false;
  }
  private getSuggestedActions(error: any): string[] {
    return [];
  }
  private calculateSequenceQualityScore(results: ToolResult[]): number {
    return 85;
  }
}

interface PerformanceMetric {
  timestamp: Date;
  duration: number;
  success: boolean;
}
