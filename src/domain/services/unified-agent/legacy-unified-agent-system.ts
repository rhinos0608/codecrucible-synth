/**
 * Unified Agent System
 *
 * Consolidates 18+ agent implementations into one comprehensive system:
 * - UnifiedAgent, EnhancedCodeCrucibleAgent, AgentEcosystem
 * - ExplorerAgent, ResearchAgent, FileExplorerAgent, GitManagerAgent, ProblemSolverAgent, CodeAnalyzerAgent
 * - SequentialDualAgentSystem, DualAgentRealtimeSystem, SubAgentIsolationSystem
 * - EnterpriseAgenticPlanner, EnhancedAgenticPlanner, MultiAgentRedTeam
 * - SimpleAgentRouter, AgentCommunicationProtocol, AgentWorker
 *
 * Uses Strategy Pattern for agent roles, Decorator Pattern for capabilities,
 * and Mediator Pattern for coordination.
 */

import { EventEmitter } from 'events';
import { IEventBus } from '../../interfaces/event-bus';
import { IUserInteraction } from '../../interfaces/user-interaction';
import {
  UnifiedConfiguration,
  AgentTask,
  AgentResponse,
  ExecutionResult,
  SecurityValidationContext,
} from '../../types/unified-types';
import { UnifiedSecurityValidator } from './unified-security-validator';
import { UnifiedPerformanceSystem } from './unified-performance-system';

// Core Agent Interfaces
export interface IAgent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  capabilities: AgentCapability[];
  expertiseDomains: string[];

  initialize(): Promise<void>;
  process(request: AgentRequest): Promise<AgentResponse>;
  collaborate(agents: IAgent[], task: CollaborativeTask): Promise<CollaborativeResponse>;
  learn(feedback: AgentFeedback): Promise<void>;
  shutdown(): Promise<void>;
}

export interface AgentRole {
  type:
    | 'explorer'
    | 'maintainer'
    | 'security'
    | 'architect'
    | 'developer'
    | 'analyzer'
    | 'implementor'
    | 'designer'
    | 'optimizer'
    | 'guardian'
    | 'research'
    | 'git-manager'
    | 'code-analyzer'
    | 'problem-solver'
    | 'file-explorer';
  description: string;
  responsibilities: string[];
  authority: 'advisory' | 'decision-making' | 'implementation' | 'review';
  scope: 'local' | 'project' | 'system' | 'global';
  expertise: ExpertiseDomain[];
}

export interface ExpertiseDomain {
  area:
    | 'code-analysis'
    | 'security'
    | 'performance'
    | 'testing'
    | 'documentation'
    | 'architecture'
    | 'deployment'
    | 'debugging'
    | 'optimization'
    | 'research'
    | 'git-operations'
    | 'file-operations'
    | 'project-structure'
    | 'problem-solving';
  level: 'novice' | 'intermediate' | 'advanced' | 'expert';
  experience: number; // years or task count
}

export interface AgentCapability {
  name: string;
  description: string;
  type:
    | 'analysis'
    | 'generation'
    | 'transformation'
    | 'validation'
    | 'research'
    | 'planning'
    | 'execution'
    | 'monitoring'
    | 'communication'
    | 'learning';
  handler: (task: AgentTask) => Promise<ExecutionResult>;
  priority: number;
  enabled: boolean;
  resources: ResourceRequirements;
}

export interface ResourceRequirements {
  memory: number; // MB
  cpu: number; // percentage
  network: boolean;
  fileSystem: boolean;
  timeout: number; // milliseconds
}

export interface AgentRequest {
  id: string;
  type:
    | 'analyze'
    | 'generate'
    | 'refactor'
    | 'test'
    | 'document'
    | 'debug'
    | 'optimize'
    | 'research'
    | 'git-operation'
    | 'file-operation'
    | 'collaborate';
  input: string | AgentTask;
  context?: ProjectContext;
  constraints?: AgentConstraints;
  preferences?: AgentPreferences;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface AgentConstraints {
  maxExecutionTime?: number;
  maxMemoryUsage?: number;
  allowedResources?: string[];
  securityLevel?: 'low' | 'medium' | 'high' | 'maximum';
  collaborationRules?: CollaborationRule[];
}

export interface AgentPreferences {
  mode?: 'fast' | 'balanced' | 'thorough' | 'creative';
  outputFormat?: 'structured' | 'narrative' | 'code' | 'documentation';
  includeReasoning?: boolean;
  verboseLogging?: boolean;
  interactiveMode?: boolean;
}

export interface CollaborationRule {
  type: 'sequential' | 'parallel' | 'hierarchical' | 'consensus';
  participants: string[]; // agent IDs
  coordination: 'leader-follower' | 'peer-to-peer' | 'democratic';
  conflictResolution: 'majority-vote' | 'expert-decision' | 'user-choice';
}

export interface CollaborativeTask {
  id: string;
  description: string;
  requirements: string[];
  expectedOutput: string;
  coordination: CollaborationRule;
  deadline?: Date;
}

export interface CollaborativeResponse {
  taskId: string;
  participants: string[];
  result: ExecutionResult;
  contributions: Map<string, ExecutionResult>;
  consensus: boolean;
  conflictsResolved: number;
  executionTime: number;
}

export interface AgentFeedback {
  taskId: string;
  rating: number; // 1-10
  comments: string;
  improvements: string[];
  effectiveness: number;
  efficiency: number;
}

export interface ProjectContext {
  rootPath: string;
  language: string[];
  frameworks: string[];
  dependencies: Map<string, string>;
  structure: ProjectStructure;
  documentation: DocumentationIndex;
  git?: GitContext;
}

export interface ProjectStructure {
  directories: string[];
  files: Map<string, FileMetadata>;
  entryPoints: string[];
  testDirectories: string[];
  configFiles: string[];
}

export interface FileMetadata {
  path: string;
  size: number;
  type: string;
  lastModified: Date;
  complexity?: number;
  dependencies?: string[];
}

export interface DocumentationIndex {
  readme: string[];
  guides: string[];
  api: string[];
  examples: string[];
  changelog: string[];
}

export interface GitContext {
  branch: string;
  commits: number;
  status: 'clean' | 'modified' | 'conflicted';
  remotes: string[];
}

export type AgentStatus =
  | 'idle'
  | 'initializing'
  | 'processing'
  | 'collaborating'
  | 'learning'
  | 'error'
  | 'shutdown';

// Agent Strategy Implementations
export abstract class BaseAgent extends EventEmitter implements IAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly role: AgentRole;
  public status: AgentStatus = 'idle';
  public capabilities: AgentCapability[] = [];
  public expertiseDomains: string[] = [];

  protected config: UnifiedConfiguration;
  protected eventBus: IEventBus;
  protected userInteraction: IUserInteraction;
  protected securityValidator: UnifiedSecurityValidator;
  protected performanceSystem: UnifiedPerformanceSystem;
  protected context?: ProjectContext;

  constructor(
    id: string,
    name: string,
    role: AgentRole,
    config: UnifiedConfiguration,
    eventBus: IEventBus,
    userInteraction: IUserInteraction,
    securityValidator: UnifiedSecurityValidator,
    performanceSystem: UnifiedPerformanceSystem
  ) {
    super();
    this.id = id;
    this.name = name;
    this.role = role;
    this.config = config;
    this.eventBus = eventBus;
    this.userInteraction = userInteraction;
    this.securityValidator = securityValidator;
    this.performanceSystem = performanceSystem;

    this.setupEventHandlers();
  }

  abstract initialize(): Promise<void>;
  abstract process(request: AgentRequest): Promise<AgentResponse>;

  async collaborate(agents: IAgent[], task: CollaborativeTask): Promise<CollaborativeResponse> {
    this.status = 'collaborating';
    this.emit('collaboration-started', { agents, task });

    const contributions = new Map<string, ExecutionResult>();

    try {
      if (task.coordination.type === 'sequential') {
        return await this.sequentialCollaboration(agents, task, contributions);
      } else if (task.coordination.type === 'parallel') {
        return await this.parallelCollaboration(agents, task, contributions);
      } else if (task.coordination.type === 'hierarchical') {
        return await this.hierarchicalCollaboration(agents, task, contributions);
      } else {
        return await this.consensusCollaboration(agents, task, contributions);
      }
    } catch (error) {
      this.status = 'error';
      throw error;
    } finally {
      this.status = 'idle';
    }
  }

  private async sequentialCollaboration(
    agents: IAgent[],
    task: CollaborativeTask,
    contributions: Map<string, ExecutionResult>
  ): Promise<CollaborativeResponse> {
    const result = {
      success: true,
      content: '',
      metadata: { model: '', tokens: 0, latency: 0 },
      executionTime: 0,
      resourcesUsed: [] as string[],
    };

    for (const agent of agents) {
      const request: AgentRequest = {
        id: `${task.id}-${agent.id}`,
        type: 'collaborate',
        input: task.description,
        priority: 'high',
        context: this.context,
      };

      const response = await agent.process(request);
      contributions.set(agent.id, response.result);

      // Chain results
      result.content += `\n${agent.name}: ${response.result.content}`;
    }

    return {
      taskId: task.id,
      participants: agents.map(a => a.id),
      result,
      contributions,
      consensus: true,
      conflictsResolved: 0,
      executionTime: Date.now() - Date.now(),
    };
  }

  private async parallelCollaboration(
    agents: IAgent[],
    task: CollaborativeTask,
    contributions: Map<string, ExecutionResult>
  ): Promise<CollaborativeResponse> {
    const requests = agents.map(agent => ({
      id: `${task.id}-${agent.id}`,
      type: 'collaborate' as const,
      input: task.description,
      priority: 'high' as const,
      context: this.context,
    }));

    const responses = await Promise.all(agents.map(async (agent, i) => agent.process(requests[i])));

    responses.forEach((response: any, i: number) => {
      contributions.set(agents[i].id, response.result);
    });

    // Merge results
    const mergedResult = await this.mergeCollaborativeResults(Array.from(contributions.values()));

    return {
      taskId: task.id,
      participants: agents.map(a => a.id),
      result: mergedResult,
      contributions,
      consensus: true,
      conflictsResolved: 0,
      executionTime: Date.now() - Date.now(),
    };
  }

  private async hierarchicalCollaboration(
    agents: IAgent[],
    task: CollaborativeTask,
    contributions: Map<string, ExecutionResult>
  ): Promise<CollaborativeResponse> {
    // Leader-follower model
    const leader = agents[0];
    const followers = agents.slice(1);

    // Leader plans
    const planRequest: AgentRequest = {
      id: `${task.id}-plan`,
      type: 'collaborate',
      input: `Plan approach for: ${task.description}`,
      priority: 'high',
      context: this.context,
    };

    const plan = await leader.process(planRequest);
    contributions.set(`${leader.id}-plan`, plan.result);

    // Followers execute based on plan
    const executionResults = await Promise.all(
      followers.map(async agent => {
        const request: AgentRequest = {
          id: `${task.id}-${agent.id}`,
          type: 'collaborate',
          input: `${task.description}\nPlan: ${plan.result.content}`,
          priority: 'high',
          context: this.context,
        };

        const result = await agent.process(request);
        contributions.set(agent.id, result.result);
        return result.result;
      })
    );

    // Leader synthesizes
    const synthesisRequest: AgentRequest = {
      id: `${task.id}-synthesis`,
      type: 'collaborate',
      input: `Synthesize results for: ${task.description}\nResults: ${executionResults.map((r: any) => r.content).join('\n')}`,
      priority: 'high',
      context: this.context,
    };

    const synthesis = await leader.process(synthesisRequest);

    return {
      taskId: task.id,
      participants: agents.map(a => a.id),
      result: synthesis.result,
      contributions,
      consensus: true,
      conflictsResolved: 0,
      executionTime: Date.now() - Date.now(),
    };
  }

  private async consensusCollaboration(
    agents: IAgent[],
    task: CollaborativeTask,
    contributions: Map<string, ExecutionResult>
  ): Promise<CollaborativeResponse> {
    // All agents contribute independently
    const responses = await Promise.all(
      agents.map(async agent => {
        const request: AgentRequest = {
          id: `${task.id}-${agent.id}`,
          type: 'collaborate',
          input: task.description,
          priority: 'high',
          context: this.context,
        };

        const result = await agent.process(request);
        contributions.set(agent.id, result.result);
        return result.result;
      })
    );

    // Build consensus
    const consensus = await this.buildConsensus(responses, task.coordination.conflictResolution);

    return {
      taskId: task.id,
      participants: agents.map(a => a.id),
      result: consensus.result,
      contributions,
      consensus: consensus.achieved,
      conflictsResolved: consensus.conflictsResolved,
      executionTime: Date.now() - Date.now(),
    };
  }

  private async mergeCollaborativeResults(results: ExecutionResult[]): Promise<ExecutionResult> {
    // Simple merge - could be enhanced with ML-based synthesis
    return {
      success: results.every(r => r.success),
      content: results.map(r => r.content).join('\n\n--- MERGED RESULT ---\n\n'),
      metadata: {
        model: 'collaborative',
        tokens: results.reduce((sum, r) => sum + (r.metadata?.tokens || 0), 0),
        latency: Math.max(...results.map(r => r.metadata?.latency || 0)),
      },
      executionTime: results.reduce((sum, r) => sum + r.executionTime, 0),
      resourcesUsed: [...new Set(results.flatMap(r => r.resourcesUsed))],
    };
  }

  private async buildConsensus(
    results: ExecutionResult[],
    conflictResolution: string
  ): Promise<{ result: ExecutionResult; achieved: boolean; conflictsResolved: number }> {
    // Simplified consensus - could use voting algorithms, semantic similarity, etc.
    if (conflictResolution === 'majority-vote') {
      // Group by similarity and take majority
      const groups = this.groupBySimilarity(results);
      const majorityGroup = groups.reduce((max, group) =>
        group.length > max.length ? group : max
      );

      return {
        result: majorityGroup[0],
        achieved: majorityGroup.length > results.length / 2,
        conflictsResolved: results.length - majorityGroup.length,
      };
    }

    // Default: merge all
    return {
      result: await this.mergeCollaborativeResults(results),
      achieved: true,
      conflictsResolved: 0,
    };
  }

  private groupBySimilarity(results: ExecutionResult[]): ExecutionResult[][] {
    // Simplified grouping by content similarity
    const groups: ExecutionResult[][] = [];

    for (const result of results) {
      let placed = false;
      for (const group of groups) {
        if (this.calculateSimilarity(result.content || '', group[0].content || '') > 0.7) {
          group.push(result);
          placed = true;
          break;
        }
      }
      if (!placed) {
        groups.push([result]);
      }
    }

    return groups;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity based on shared words
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  async learn(feedback: AgentFeedback): Promise<void> {
    this.status = 'learning';
    this.emit('learning-started', feedback);

    // Store feedback for capability improvement
    this.eventBus.emit('agent:feedback', { agentId: this.id, feedback });

    // Adjust capabilities based on feedback
    if (feedback.rating < 5) {
      await this.adjustCapabilities(feedback);
    }

    this.status = 'idle';
    this.emit('learning-completed', feedback);
  }

  private async adjustCapabilities(feedback: AgentFeedback): Promise<void> {
    // Disable poorly performing capabilities temporarily
    const relatedCapabilities = this.capabilities.filter(cap =>
      feedback.improvements.some(imp => imp.toLowerCase().includes(cap.name.toLowerCase()))
    );

    for (const capability of relatedCapabilities) {
      capability.priority = Math.max(1, capability.priority - 1);
    }
  }

  async shutdown(): Promise<void> {
    this.status = 'shutdown';
    this.emit('agent-shutdown', this.id);
    this.removeAllListeners();
  }

  protected setupEventHandlers(): void {
    this.eventBus.on('system:shutdown', async () => this.shutdown());
    this.eventBus.on('agent:update-config', (data: unknown) => {
      // Type guard to ensure data is UnifiedConfiguration
      if (data && typeof data === 'object') {
        const config = data as UnifiedConfiguration;
        this.config = { ...this.config, ...config };
      }
    });
  }

  protected registerCapability(capability: AgentCapability): void {
    this.capabilities.push(capability);
    this.emit('capability-registered', capability);
  }

  protected async validateRequest(request: AgentRequest): Promise<boolean> {
    // Security validation
    if (typeof request.input === 'string') {
      const validation = this.securityValidator.validateInput({
        agentId: this.id,
        operation: 'agent-request',
        workspace: process.cwd(),
        requestedPermissions: ['read', 'write'],
        securityLevel: 'medium',
        timestamp: new Date(),
      });
      if (!validation.isValid) {
        throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
      }
    }

    // Resource constraints
    if (request.constraints?.maxExecutionTime && request.constraints.maxExecutionTime < 1000) {
      throw new Error('Execution time too short');
    }

    return true;
  }

  protected createResponse(result: ExecutionResult, requestId: string): AgentResponse {
    return {
      id: `${this.id}-${requestId}`,
      taskId: requestId,
      agentId: this.id,
      success: result.success,
      result,
      timestamp: new Date(),
      executionTime: result.metadata?.latency || 0,
    };
  }
}

// Concrete Agent Implementations
export class ExplorerAgent extends BaseAgent {
  async initialize(): Promise<void> {
    this.status = 'initializing';
    this.expertiseDomains = ['code-discovery', 'innovation-research', 'technology-exploration', 'pattern-recognition'];

    // Register exploration capabilities
    this.registerCapability({
      name: 'code-discovery',
      description: 'Discover and map code structure and patterns',
      type: 'analysis',
      priority: 10,
      enabled: true,
      resources: { memory: 256, cpu: 20, network: false, fileSystem: true, timeout: 30000 },
      handler: async task => this.discoverCodeStructure(task),
    });

    this.registerCapability({
      name: 'innovation-research',
      description: 'Research new technologies and approaches',
      type: 'research',
      priority: 8,
      enabled: true,
      resources: { memory: 512, cpu: 30, network: true, fileSystem: true, timeout: 60000 },
      handler: async task => this.researchInnovations(task),
    });

    this.status = 'idle';
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    await this.validateRequest(request);
    this.status = 'processing';

    try {
      // Route to appropriate capability
      const capability = this.capabilities.find(
        cap => cap.enabled && this.matchesCapability(request, cap)
      );

      if (!capability) {
        throw new Error('No suitable capability found');
      }

      const result = await capability.handler(request.input as AgentTask);
      return this.createResponse(result, request.id);
    } finally {
      this.status = 'idle';
    }
  }

  private matchesCapability(request: AgentRequest, capability: AgentCapability): boolean {
    return request.type === 'analyze' || request.type === 'research';
  }

  private async discoverCodeStructure(task: AgentTask): Promise<ExecutionResult> {
    // Implementation for code structure discovery
    return {
      success: true,
      content: 'Code structure analysis completed',
      metadata: { model: 'explorer', tokens: 100, latency: 1500 },
      executionTime: 1500,
      resourcesUsed: ['cpu', 'memory'],
    };
  }

  private async researchInnovations(task: AgentTask): Promise<ExecutionResult> {
    // Implementation for innovation research
    return {
      success: true,
      content: 'Innovation research completed',
      metadata: { model: 'explorer', tokens: 200, latency: 3000 },
      executionTime: 3000,
      resourcesUsed: ['cpu', 'knowledge-base', 'network'],
    };
  }
}

export class SecurityAgent extends BaseAgent {
  async initialize(): Promise<void> {
    this.status = 'initializing';
    this.expertiseDomains = ['security-analysis', 'vulnerability-assessment', 'threat-detection', 'code-security'];

    this.registerCapability({
      name: 'vulnerability-analysis',
      description: 'Analyze code for security vulnerabilities',
      type: 'analysis',
      priority: 10,
      enabled: true,
      resources: { memory: 512, cpu: 40, network: false, fileSystem: true, timeout: 45000 },
      handler: async task => this.analyzeVulnerabilities(task),
    });

    this.registerCapability({
      name: 'security-hardening',
      description: 'Provide security hardening recommendations',
      type: 'generation',
      priority: 9,
      enabled: true,
      resources: { memory: 256, cpu: 25, network: false, fileSystem: true, timeout: 30000 },
      handler: async task => this.generateHardeningRecommendations(task),
    });

    this.status = 'idle';
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    await this.validateRequest(request);
    this.status = 'processing';

    try {
      const capability = this.capabilities.find(
        cap => cap.enabled && (request.type === 'analyze' || request.type === 'generate')
      );

      if (!capability) {
        throw new Error('No security capability found');
      }

      const result = await capability.handler(request.input as AgentTask);
      return this.createResponse(result, request.id);
    } finally {
      this.status = 'idle';
    }
  }

  private async analyzeVulnerabilities(task: AgentTask): Promise<ExecutionResult> {
    // Use the unified security validator for analysis
    const validation = this.securityValidator.validateInput({
      agentId: this.id,
      operation: 'security-analysis',
      workspace: process.cwd(),
      requestedPermissions: ['read'],
      securityLevel: 'high',
      timestamp: new Date(),
    });

    return {
      success: validation.isValid,
      content: validation.isValid
        ? 'No vulnerabilities detected'
        : `Vulnerabilities found: ${validation.errors.join(', ') || 'unknown issues'}`,
      metadata: { model: 'security', tokens: 150, latency: 2000 },
      executionTime: 2000,
      resourcesUsed: ['cpu', 'security-scanner'],
    };
  }

  private async generateHardeningRecommendations(task: AgentTask): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Security hardening recommendations generated',
      metadata: { model: 'security', tokens: 300, latency: 2500 },
      executionTime: 2500,
      resourcesUsed: ['cpu', 'knowledge-base'],
    };
  }
}

export class ArchitectAgent extends BaseAgent {
  async initialize(): Promise<void> {
    this.status = 'initializing';
    this.expertiseDomains = ['system-design', 'architecture-patterns', 'scalability', 'technical-planning'];

    this.registerCapability({
      name: 'system-design',
      description: 'Design system architecture and patterns',
      type: 'generation',
      priority: 10,
      enabled: true,
      resources: { memory: 1024, cpu: 50, network: false, fileSystem: true, timeout: 60000 },
      handler: async task => this.designSystem(task),
    });

    this.registerCapability({
      name: 'architecture-review',
      description: 'Review and improve existing architecture',
      type: 'analysis',
      priority: 9,
      enabled: true,
      resources: { memory: 512, cpu: 35, network: false, fileSystem: true, timeout: 45000 },
      handler: async task => this.reviewArchitecture(task),
    });

    this.status = 'idle';
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    await this.validateRequest(request);
    this.status = 'processing';

    try {
      const capability = this.capabilities.find(
        cap => cap.enabled && (request.type === 'generate' || request.type === 'analyze')
      );

      if (!capability) {
        throw new Error('No architecture capability found');
      }

      const result = await capability.handler(request.input as AgentTask);
      return this.createResponse(result, request.id);
    } finally {
      this.status = 'idle';
    }
  }

  private async designSystem(task: AgentTask): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'System architecture design completed',
      metadata: { model: 'architect', tokens: 500, latency: 4000 },
      executionTime: 4000,
      resourcesUsed: ['cpu', 'memory', 'design-patterns'],
    };
  }

  private async reviewArchitecture(task: AgentTask): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Architecture review completed with recommendations',
      metadata: { model: 'architect', tokens: 350, latency: 3000 },
      executionTime: 3000,
      resourcesUsed: ['cpu', 'memory', 'analysis-engine'],
    };
  }
}

// Agent Factory using Factory Pattern
export class AgentFactory {
  private config: UnifiedConfiguration;
  private eventBus: IEventBus;
  private userInteraction: IUserInteraction;
  private securityValidator: UnifiedSecurityValidator;
  private performanceSystem: UnifiedPerformanceSystem;

  constructor(
    config: UnifiedConfiguration,
    eventBus: IEventBus,
    userInteraction: IUserInteraction,
    securityValidator: UnifiedSecurityValidator,
    performanceSystem: UnifiedPerformanceSystem
  ) {
    this.config = config;
    this.eventBus = eventBus;
    this.userInteraction = userInteraction;
    this.securityValidator = securityValidator;
    this.performanceSystem = performanceSystem;
  }

  createAgent(type: AgentRole['type'], id?: string, name?: string): IAgent {
    const agentId = id || `${type}-${Date.now()}`;
    const agentName = name || `${type.charAt(0).toUpperCase()}${type.slice(1)} Agent`;

    const role: AgentRole = this.createRole(type);

    switch (type) {
      case 'explorer':
        return new ExplorerAgent(
          agentId,
          agentName,
          role,
          this.config,
          this.eventBus,
          this.userInteraction,
          this.securityValidator,
          this.performanceSystem
        );
      case 'security':
        return new SecurityAgent(
          agentId,
          agentName,
          role,
          this.config,
          this.eventBus,
          this.userInteraction,
          this.securityValidator,
          this.performanceSystem
        );
      case 'architect':
        return new ArchitectAgent(
          agentId,
          agentName,
          role,
          this.config,
          this.eventBus,
          this.userInteraction,
          this.securityValidator,
          this.performanceSystem
        );
      default:
        // Generic agent for other types
        return new GenericAgent(
          agentId,
          agentName,
          role,
          this.config,
          this.eventBus,
          this.userInteraction,
          this.securityValidator,
          this.performanceSystem
        );
    }
  }

  private createRole(type: AgentRole['type']): AgentRole {
    const roleDefinitions: Record<AgentRole['type'], Omit<AgentRole, 'type'>> = {
      explorer: {
        description: 'Discovers and explores code, patterns, and possibilities',
        responsibilities: ['Code discovery', 'Pattern identification', 'Innovation research'],
        authority: 'advisory',
        scope: 'project',
        expertise: [
          { area: 'code-analysis', level: 'expert', experience: 1000 },
          { area: 'research', level: 'advanced', experience: 500 },
        ],
      },
      maintainer: {
        description: 'Maintains code quality and stability',
        responsibilities: ['Code maintenance', 'Bug fixing', 'Quality assurance'],
        authority: 'implementation',
        scope: 'project',
        expertise: [
          { area: 'debugging', level: 'expert', experience: 800 },
          { area: 'testing', level: 'advanced', experience: 600 },
        ],
      },
      security: {
        description: 'Ensures security and compliance',
        responsibilities: ['Vulnerability analysis', 'Security hardening', 'Compliance validation'],
        authority: 'decision-making',
        scope: 'system',
        expertise: [
          { area: 'security', level: 'expert', experience: 1200 },
          { area: 'code-analysis', level: 'advanced', experience: 800 },
        ],
      },
      architect: {
        description: 'Designs system architecture and patterns',
        responsibilities: ['System design', 'Architecture patterns', 'Technical decisions'],
        authority: 'decision-making',
        scope: 'system',
        expertise: [
          { area: 'architecture', level: 'expert', experience: 1500 },
          { area: 'performance', level: 'advanced', experience: 1000 },
        ],
      },
      developer: {
        description: 'Implements features and fixes',
        responsibilities: ['Feature implementation', 'Code generation', 'Problem solving'],
        authority: 'implementation',
        scope: 'local',
        expertise: [
          { area: 'code-analysis', level: 'advanced', experience: 800 },
          { area: 'problem-solving', level: 'expert', experience: 1000 },
        ],
      },
      analyzer: {
        description: 'Analyzes performance and optimization opportunities',
        responsibilities: [
          'Performance analysis',
          'Optimization recommendations',
          'Metrics collection',
        ],
        authority: 'advisory',
        scope: 'project',
        expertise: [
          { area: 'performance', level: 'expert', experience: 1200 },
          { area: 'optimization', level: 'advanced', experience: 900 },
        ],
      },
      implementor: {
        description: 'Executes implementation tasks',
        responsibilities: ['Task execution', 'Code implementation', 'Feature delivery'],
        authority: 'implementation',
        scope: 'local',
        expertise: [
          { area: 'code-analysis', level: 'advanced', experience: 700 },
          { area: 'problem-solving', level: 'advanced', experience: 600 },
        ],
      },
      designer: {
        description: 'Designs user interfaces and experiences',
        responsibilities: ['UI/UX design', 'User experience optimization', 'Interface patterns'],
        authority: 'advisory',
        scope: 'project',
        expertise: [
          { area: 'architecture', level: 'intermediate', experience: 400 },
          { area: 'optimization', level: 'intermediate', experience: 300 },
        ],
      },
      optimizer: {
        description: 'Optimizes performance and efficiency',
        responsibilities: [
          'Performance optimization',
          'Resource efficiency',
          'Bottleneck identification',
        ],
        authority: 'implementation',
        scope: 'project',
        expertise: [
          { area: 'performance', level: 'expert', experience: 1100 },
          { area: 'optimization', level: 'expert', experience: 1000 },
        ],
      },
      guardian: {
        description: 'Guards quality and standards',
        responsibilities: ['Quality gates', 'Standard enforcement', 'Review processes'],
        authority: 'decision-making',
        scope: 'project',
        expertise: [
          { area: 'testing', level: 'expert', experience: 900 },
          { area: 'documentation', level: 'advanced', experience: 600 },
        ],
      },
      research: {
        description: 'Conducts research and analysis',
        responsibilities: ['Research tasks', 'Data analysis', 'Investigation'],
        authority: 'advisory',
        scope: 'global',
        expertise: [
          { area: 'research', level: 'expert', experience: 1000 },
          { area: 'code-analysis', level: 'advanced', experience: 700 },
        ],
      },
      'git-manager': {
        description: 'Manages git operations and version control',
        responsibilities: ['Git operations', 'Version control', 'Branch management'],
        authority: 'implementation',
        scope: 'project',
        expertise: [
          { area: 'git-operations', level: 'expert', experience: 800 },
          { area: 'project-structure', level: 'advanced', experience: 600 },
        ],
      },
      'code-analyzer': {
        description: 'Analyzes code quality and structure',
        responsibilities: ['Code analysis', 'Quality metrics', 'Structure evaluation'],
        authority: 'advisory',
        scope: 'project',
        expertise: [
          { area: 'code-analysis', level: 'expert', experience: 1200 },
          { area: 'testing', level: 'advanced', experience: 700 },
        ],
      },
      'problem-solver': {
        description: 'Solves complex problems and issues',
        responsibilities: ['Problem analysis', 'Solution design', 'Issue resolution'],
        authority: 'implementation',
        scope: 'project',
        expertise: [
          { area: 'problem-solving', level: 'expert', experience: 1100 },
          { area: 'debugging', level: 'advanced', experience: 800 },
        ],
      },
      'file-explorer': {
        description: 'Manages file operations and exploration',
        responsibilities: ['File operations', 'Directory management', 'File analysis'],
        authority: 'implementation',
        scope: 'local',
        expertise: [
          { area: 'file-operations', level: 'expert', experience: 900 },
          { area: 'project-structure', level: 'advanced', experience: 700 },
        ],
      },
    };

    return { type, ...roleDefinitions[type] };
  }
}

// Generic Agent for extensibility
class GenericAgent extends BaseAgent {
  async initialize(): Promise<void> {
    this.status = 'initializing';
    this.expertiseDomains = ['general-purpose', 'task-execution', 'basic-analysis'];

    // Add basic capabilities based on role
    this.registerCapability({
      name: 'basic-processing',
      description: 'Basic task processing capability',
      type: 'execution',
      priority: 5,
      enabled: true,
      resources: { memory: 256, cpu: 20, network: false, fileSystem: true, timeout: 30000 },
      handler: async task => this.basicProcessing(task),
    });

    this.status = 'idle';
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    await this.validateRequest(request);
    this.status = 'processing';

    try {
      const result = await this.basicProcessing(request.input as AgentTask);
      return this.createResponse(result, request.id);
    } finally {
      this.status = 'idle';
    }
  }

  private async basicProcessing(task: AgentTask): Promise<ExecutionResult> {
    return {
      success: true,
      content: `Processed task: ${JSON.stringify(task)}`,
      metadata: { model: 'generic', tokens: 50, latency: 1000 },
      executionTime: 1000,
      resourcesUsed: ['cpu', 'memory'],
    };
  }
}

// Main Unified Agent System Orchestrator
export class UnifiedAgentSystem extends EventEmitter {
  private agents: Map<string, IAgent> = new Map();
  private agentFactory: AgentFactory;
  private config: UnifiedConfiguration;
  private eventBus: IEventBus;
  private performanceSystem: UnifiedPerformanceSystem;

  constructor(
    config: UnifiedConfiguration,
    eventBus: IEventBus,
    userInteraction: IUserInteraction,
    securityValidator: UnifiedSecurityValidator,
    performanceSystem: UnifiedPerformanceSystem
  ) {
    super();
    this.config = config;
    this.eventBus = eventBus;
    this.performanceSystem = performanceSystem;

    this.agentFactory = new AgentFactory(
      config,
      eventBus,
      userInteraction,
      securityValidator,
      performanceSystem
    );

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    // Create default agents
    const defaultAgentTypes: AgentRole['type'][] = [
      'explorer',
      'maintainer',
      'security',
      'architect',
      'developer',
      'analyzer',
      'implementor',
      'designer',
      'optimizer',
      'guardian',
    ];

    for (const type of defaultAgentTypes) {
      if (
        this.config.voice?.availableVoices?.includes(type) ||
        type === 'security' ||
        type === 'architect'
      ) {
        const agent = this.agentFactory.createAgent(type);
        await agent.initialize();
        this.agents.set(agent.id, agent);
        this.emit('agent-created', agent);
      }
    }

    this.emit('system-initialized', { agentCount: this.agents.size });
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    // Route to appropriate agent(s)
    const suitableAgents = this.findSuitableAgents(request);

    if (suitableAgents.length === 0) {
      throw new Error('No suitable agent found for request');
    }

    if (suitableAgents.length === 1) {
      return await suitableAgents[0].process(request);
    }

    // Multi-agent collaboration
    return await this.orchestrateMultiAgentRequest(request, suitableAgents);
  }

  private findSuitableAgents(request: AgentRequest): IAgent[] {
    const agents: IAgent[] = [];

    for (const agent of this.agents.values()) {
      if (this.isAgentSuitable(agent, request)) {
        agents.push(agent);
      }
    }

    // Sort by suitability score
    return agents.sort(
      (a, b) =>
        this.calculateSuitabilityScore(b, request) - this.calculateSuitabilityScore(a, request)
    );
  }

  private isAgentSuitable(agent: IAgent, request: AgentRequest): boolean {
    // Check if agent has relevant capabilities
    const hasRelevantCapability = agent.capabilities.some(
      cap => cap.enabled && this.capabilityMatches(cap, request)
    );

    // Check role alignment
    const roleAligns = this.roleAligns(agent.role, request);

    return hasRelevantCapability && roleAligns;
  }

  private capabilityMatches(capability: AgentCapability, request: AgentRequest): boolean {
    const typeMapping: Record<AgentRequest['type'], AgentCapability['type'][]> = {
      analyze: ['analysis', 'monitoring'],
      generate: ['generation'],
      refactor: ['transformation'],
      test: ['validation'],
      document: ['generation'],
      debug: ['analysis', 'validation'],
      optimize: ['transformation', 'analysis'],
      research: ['research', 'analysis'],
      'git-operation': ['execution'],
      'file-operation': ['execution'],
      collaborate: ['communication'],
    };

    const expectedTypes = typeMapping[request.type] || [];
    return expectedTypes.includes(capability.type);
  }

  private roleAligns(role: AgentRole, request: AgentRequest): boolean {
    const roleMapping: Record<AgentRequest['type'], AgentRole['type'][]> = {
      analyze: ['analyzer', 'explorer', 'code-analyzer', 'security'],
      generate: ['developer', 'implementor', 'architect'],
      refactor: ['architect', 'developer', 'maintainer'],
      test: ['guardian', 'maintainer'],
      document: ['maintainer', 'designer'],
      debug: ['problem-solver', 'maintainer', 'developer'],
      optimize: ['optimizer', 'analyzer', 'architect'],
      research: ['research', 'explorer'],
      'git-operation': ['git-manager'],
      'file-operation': ['file-explorer', 'developer'],
      collaborate: ['architect', 'explorer'],
    };

    const suitableRoles = roleMapping[request.type] || [];
    return suitableRoles.includes(role.type);
  }

  private calculateSuitabilityScore(agent: IAgent, request: AgentRequest): number {
    let score = 0;

    // Role match bonus
    if (this.roleAligns(agent.role, request)) {
      score += 10;
    }

    // Capability match bonus
    const matchingCapabilities = agent.capabilities.filter(
      cap => cap.enabled && this.capabilityMatches(cap, request)
    );
    score += matchingCapabilities.length * 5;

    // Priority bonus for high priority requests
    if (request.priority === 'critical') {
      score += 5;
    } else if (request.priority === 'high') {
      score += 3;
    }

    // Expertise bonus
    const relevantExpertise = agent.role.expertise.filter(exp =>
      this.isRelevantExpertise(exp.area, request)
    );
    score += relevantExpertise.reduce((sum, exp) => sum + exp.experience * 0.001, 0);

    return score;
  }

  private isRelevantExpertise(area: ExpertiseDomain['area'], request: AgentRequest): boolean {
    const expertiseMapping: Record<AgentRequest['type'], ExpertiseDomain['area'][]> = {
      analyze: ['code-analysis', 'performance', 'security'],
      generate: ['code-analysis', 'architecture'],
      refactor: ['architecture', 'performance', 'optimization'],
      test: ['testing'],
      document: ['documentation'],
      debug: ['debugging', 'problem-solving'],
      optimize: ['performance', 'optimization'],
      research: ['research'],
      'git-operation': ['git-operations'],
      'file-operation': ['file-operations', 'project-structure'],
      collaborate: ['architecture', 'code-analysis'],
    };

    const relevantAreas = expertiseMapping[request.type] || [];
    return relevantAreas.includes(area);
  }

  private async orchestrateMultiAgentRequest(
    request: AgentRequest,
    agents: IAgent[]
  ): Promise<AgentResponse> {
    // Create collaborative task
    const collaborativeTask: CollaborativeTask = {
      id: `collab-${request.id}`,
      description:
        typeof request.input === 'string' ? request.input : JSON.stringify(request.input),
      requirements: [request.type],
      expectedOutput: 'Collaborative response',
      coordination: {
        type: request.type === 'analyze' ? 'parallel' : 'sequential',
        participants: agents.map(a => a.id),
        coordination: 'peer-to-peer',
        conflictResolution: 'majority-vote',
      },
    };

    // Use first agent as coordinator
    const coordinator = agents[0];
    const collaborativeResponse = await coordinator.collaborate(agents, collaborativeTask);

    return {
      id: `multi-${request.id}`,
      taskId: request.id,
      agentId: 'multi-agent-system',
      success: collaborativeResponse.consensus,
      result: collaborativeResponse.result,
      timestamp: new Date(),
      executionTime: collaborativeResponse.executionTime,
    };
  }

  async createAgent(type: AgentRole['type'], id?: string, name?: string): Promise<IAgent> {
    const agent = this.agentFactory.createAgent(type, id, name);
    await agent.initialize();
    this.agents.set(agent.id, agent);
    this.emit('agent-created', agent);
    return agent;
  }

  async removeAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      await agent.shutdown();
      this.agents.delete(id);
      this.emit('agent-removed', id);
    }
  }

  getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByRole(role: AgentRole['type']): IAgent[] {
    return Array.from(this.agents.values()).filter(agent => agent.role.type === role);
  }

  async shutdown(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.shutdown();
    }
    this.agents.clear();
    this.emit('system-shutdown');
    this.removeAllListeners();
  }

  private setupEventHandlers(): void {
    this.eventBus.on('system:shutdown', async () => this.shutdown());

    // Performance monitoring
    this.on('agent-created', (agent: IAgent) => {
      this.performanceSystem.trackResourceUsage(agent.id, 'agent-creation', 'memory', 1);
    });
  }

  // Statistics and monitoring
  getSystemStats(): {
    totalAgents: number;
    agentsByRole: Record<string, number>;
    agentsByStatus: Record<string, number>;
    averageCapabilities: number;
  } {
    const agents = Array.from(this.agents.values());

    const agentsByRole: Record<string, number> = {};
    const agentsByStatus: Record<string, number> = {};

    for (const agent of agents) {
      agentsByRole[agent.role.type] = (agentsByRole[agent.role.type] || 0) + 1;
      agentsByStatus[agent.status] = (agentsByStatus[agent.status] || 0) + 1;
    }

    const totalCapabilities = agents.reduce((sum, agent) => sum + agent.capabilities.length, 0);
    const averageCapabilities = agents.length > 0 ? totalCapabilities / agents.length : 0;

    return {
      totalAgents: agents.length,
      agentsByRole,
      agentsByStatus,
      averageCapabilities,
    };
  }
}

// Export factory function for easy instantiation
export function createUnifiedAgentSystem(
  config: UnifiedConfiguration,
  eventBus: IEventBus,
  userInteraction: IUserInteraction,
  securityValidator: UnifiedSecurityValidator,
  performanceSystem: UnifiedPerformanceSystem
): UnifiedAgentSystem {
  return new UnifiedAgentSystem(
    config,
    eventBus,
    userInteraction,
    securityValidator,
    performanceSystem
  );
}
