/**
 * Agent Communication Protocol - Semantic Kernel & AutoGen Inspired
 * Implements modern agent-to-agent communication patterns for CodeCrucible Synth
 * 
 * Features:
 * - Agent lifecycle management and discovery
 * - Message passing and subscription patterns
 * - Orchestration strategies (Sequential, Parallel, Democratic, Hierarchical)
 * - Event-driven communication with telemetry integration
 * - Agent conversation management and memory
 * - Capability negotiation and task delegation
 * - Multi-agent coordination and consensus building
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { getTelemetryProvider } from '../observability/telemetry-provider.js';

// Core agent interfaces
export interface Agent {
  id: string;
  name: string;
  type: string;
  capabilities: AgentCapability[];
  metadata: AgentMetadata;
  status: AgentStatus;
  
  // Core methods
  invoke(messages: Message[]): Promise<AgentResponse>;
  canHandle(task: AgentTask): boolean;
  
  // Communication methods
  subscribe(eventType: string, handler: MessageHandler): void;
  unsubscribe(eventType: string, handler: MessageHandler): void;
  publishMessage(targetAgentId: string, message: Message): Promise<void>;
  
  // Lifecycle methods
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface AgentCapability {
  name: string;
  type: 'analysis' | 'generation' | 'execution' | 'validation' | 'coordination';
  confidence: number;
  prerequisites?: string[];
  exclusiveWith?: string[];
}

export interface AgentMetadata {
  version: string;
  description: string;
  expertise: string[];
  languages: string[];
  maxConcurrentTasks: number;
  averageResponseTime: number;
  successRate: number;
  lastActive: Date;
}

export type AgentStatus = 'initializing' | 'active' | 'busy' | 'idle' | 'error' | 'shutdown';

export interface Message {
  id: string;
  type: MessageType;
  sender: string;
  recipient: string;
  content: any;
  metadata: MessageMetadata;
  timestamp: Date;
  correlationId?: string;
  conversationId?: string;
}

export type MessageType = 
  | 'task-request'
  | 'task-response' 
  | 'task-delegation'
  | 'capability-inquiry'
  | 'capability-response'
  | 'coordination-request'
  | 'consensus-vote'
  | 'status-update'
  | 'error-notification'
  | 'system-event';

export interface MessageMetadata {
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  expectsResponse: boolean;
  maxRetries?: number;
  securityContext?: string;
}

export interface AgentResponse {
  success: boolean;
  content: any;
  metadata: ResponseMetadata;
  followUpActions?: FollowUpAction[];
}

export interface ResponseMetadata {
  processingTime: number;
  confidence: number;
  usedCapabilities: string[];
  resourceUsage: ResourceUsage;
  quality: number;
}

export interface ResourceUsage {
  memory: number;
  cpu: number;
  network: number;
  tokens?: number;
}

export interface FollowUpAction {
  type: 'delegate' | 'coordinate' | 'validate' | 'escalate';
  targetAgent?: string;
  task: AgentTask;
  priority: number;
}

export interface AgentTask {
  id: string;
  type: TaskType;
  description: string;
  requirements: TaskRequirement[];
  constraints: TaskConstraint[];
  expectedOutput: string;
  deadline?: Date;
  priority: number;
}

export type TaskType = 
  | 'code-analysis' 
  | 'code-generation' 
  | 'security-audit' 
  | 'performance-optimization'
  | 'testing' 
  | 'documentation' 
  | 'coordination'
  | 'validation';

export interface TaskRequirement {
  type: 'capability' | 'resource' | 'data' | 'permission';
  value: string;
  mandatory: boolean;
}

export interface TaskConstraint {
  type: 'time' | 'memory' | 'security' | 'quality';
  value: any;
  enforced: boolean;
}

export type MessageHandler = (message: Message) => Promise<void>;

// Orchestration patterns
export interface OrchestrationStrategy {
  name: string;
  type: 'sequential' | 'parallel' | 'democratic' | 'hierarchical' | 'consensus';
  orchestrate(agents: Agent[], task: AgentTask): Promise<OrchestrationResult>;
}

export interface OrchestrationResult {
  success: boolean;
  results: AgentResponse[];
  consensus?: ConsensusResult;
  executionPlan: ExecutionStep[];
  totalTime: number;
  errors: string[];
}

export interface ConsensusResult {
  agreement: boolean;
  confidence: number;
  dissenting: string[];
  finalDecision: any;
  votingResults: VoteResult[];
}

export interface VoteResult {
  agentId: string;
  vote: 'yes' | 'no' | 'abstain';
  confidence: number;
  reasoning?: string;
}

export interface ExecutionStep {
  step: number;
  agentId: string;
  task: AgentTask;
  startTime: Date;
  endTime?: Date;
  result?: AgentResponse;
}

// Agent registry and discovery
export interface IAgentRegistry {
  registerAgent(agent: Agent): Promise<void>;
  unregisterAgent(agentId: string): Promise<void>;
  findAgents(criteria: AgentSearchCriteria): Promise<Agent[]>;
  getAgent(agentId: string): Promise<Agent | null>;
  discoverCapabilities(taskType: TaskType): Promise<AgentCapability[]>;
  getAllAgents(): Promise<Agent[]>;
}

export interface AgentSearchCriteria {
  type?: string;
  capabilities?: string[];
  status?: AgentStatus;
  minConfidence?: number;
  maxResponseTime?: number;
  tags?: string[];
}

// Conversation and memory management
export interface ConversationManager {
  startConversation(participants: string[], topic: string): Promise<string>;
  addMessage(conversationId: string, message: Message): Promise<void>;
  getConversationHistory(conversationId: string): Promise<Message[]>;
  endConversation(conversationId: string): Promise<void>;
  
  // Advanced features
  summarizeConversation(conversationId: string): Promise<ConversationSummary>;
  extractKeyDecisions(conversationId: string): Promise<Decision[]>;
  findSimilarConversations(topic: string): Promise<ConversationMatch[]>;
}

export interface ConversationSummary {
  id: string;
  topic: string;
  participants: string[];
  duration: number;
  keyPoints: string[];
  decisions: Decision[];
  actionItems: ActionItem[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface Decision {
  id: string;
  description: string;
  participants: string[];
  consensus: boolean;
  timestamp: Date;
  rationale: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  deadline?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
}

export interface ConversationMatch {
  conversationId: string;
  similarity: number;
  topic: string;
  participants: string[];
}

/**
 * Agent Communication Protocol Implementation
 */
export class AgentCommunicationProtocol extends EventEmitter {
  private registry: IAgentRegistry;
  private conversationManager: ConversationManager;
  private orchestrationStrategies: Map<string, OrchestrationStrategy>;
  private activeConversations: Map<string, ConversationContext>;
  private messageQueue: Message[];
  private telemetry = getTelemetryProvider();

  constructor(
    registry: IAgentRegistry,
    conversationManager: ConversationManager
  ) {
    super();
    this.registry = registry;
    this.conversationManager = conversationManager;
    this.orchestrationStrategies = new Map();
    this.activeConversations = new Map();
    this.messageQueue = [];
    
    this.initializeOrchestrationStrategies();
    this.setupEventHandlers();
  }

  /**
   * Initialize built-in orchestration strategies
   */
  private initializeOrchestrationStrategies(): void {
    // Sequential strategy
    this.orchestrationStrategies.set('sequential', new SequentialOrchestrationStrategy());
    
    // Parallel strategy  
    this.orchestrationStrategies.set('parallel', new ParallelOrchestrationStrategy());
    
    // Democratic strategy
    this.orchestrationStrategies.set('democratic', new DemocraticOrchestrationStrategy());
    
    // Hierarchical strategy
    this.orchestrationStrategies.set('hierarchical', new HierarchicalOrchestrationStrategy());
    
    // Consensus strategy
    this.orchestrationStrategies.set('consensus', new ConsensusOrchestrationStrategy());
    
    logger.info('🤝 Orchestration strategies initialized', {
      strategies: Array.from(this.orchestrationStrategies.keys())
    });
  }

  /**
   * Setup event handlers for telemetry and monitoring
   */
  private setupEventHandlers(): void {
    this.on('message-sent', (message: Message) => {
      logger.debug('Agent message sent', {
        messageId: message.id,
        sender: message.sender,
        recipient: message.recipient,
        type: message.type
      });
    });

    this.on('orchestration-started', (strategy: string, agents: number) => {
      logger.info('Orchestration started', { strategy, agentCount: agents });
    });

    this.on('orchestration-completed', (result: OrchestrationResult) => {
      logger.info('Orchestration completed', {
        success: result.success,
        agentCount: result.results.length,
        totalTime: result.totalTime
      });
    });
  }

  /**
   * Orchestrate a task across multiple agents
   */
  async orchestrateTask(
    task: AgentTask,
    strategyName: string = 'sequential',
    agentCriteria?: AgentSearchCriteria
  ): Promise<OrchestrationResult> {
    return await this.telemetry.traceAgentCommunication(
      {
        'codecrucible.agent.source_id': 'orchestrator',
        'codecrucible.agent.target_id': 'multiple',
        'codecrucible.agent.message_type': 'orchestration',
        'codecrucible.agent.orchestration_strategy': strategyName
      },
      async () => {
        logger.info('Starting task orchestration', {
          taskId: task.id,
          taskType: task.type,
          strategy: strategyName
        });

        // Find suitable agents
        const agents = agentCriteria 
          ? await this.registry.findAgents(agentCriteria)
          : await this.registry.findAgents({ capabilities: [task.type] });

        if (agents.length === 0) {
          throw new Error(`No agents found capable of handling task type: ${task.type}`);
        }

        // Get orchestration strategy
        const strategy = this.orchestrationStrategies.get(strategyName);
        if (!strategy) {
          throw new Error(`Unknown orchestration strategy: ${strategyName}`);
        }

        this.emit('orchestration-started', strategyName, agents.length);

        // Execute orchestration
        const result = await strategy.orchestrate(agents, task);
        
        this.emit('orchestration-completed', result);
        
        return result;
      }
    );
  }

  /**
   * Send message between agents
   */
  async sendMessage(
    senderId: string,
    recipientId: string,
    content: any,
    type: MessageType = 'task-request',
    metadata: Partial<MessageMetadata> = {}
  ): Promise<Message> {
    const message: Message = {
      id: this.generateMessageId(),
      type,
      sender: senderId,
      recipient: recipientId,
      content,
      metadata: {
        priority: 'medium',
        expectsResponse: true,
        ...metadata
      },
      timestamp: new Date()
    };

    // Add to message queue for processing
    this.messageQueue.push(message);
    
    // Process message immediately (could be async queue in production)
    await this.processMessage(message);
    
    this.emit('message-sent', message);
    
    return message;
  }

  /**
   * Start a multi-agent conversation
   */
  async startConversation(
    participants: string[],
    topic: string,
    orchestrationStrategy: string = 'democratic'
  ): Promise<string> {
    const conversationId = await this.conversationManager.startConversation(participants, topic);
    
    const context: ConversationContext = {
      id: conversationId,
      participants,
      topic,
      strategy: orchestrationStrategy,
      startTime: new Date(),
      active: true,
      messageCount: 0
    };
    
    this.activeConversations.set(conversationId, context);
    
    logger.info('Multi-agent conversation started', {
      conversationId,
      participants: participants.length,
      topic,
      strategy: orchestrationStrategy
    });
    
    return conversationId;
  }

  /**
   * Facilitate agent capability negotiation
   */
  async negotiateCapabilities(
    task: AgentTask,
    candidateAgents: string[]
  ): Promise<CapabilityNegotiationResult> {
    const negotiations: CapabilityNegotiation[] = [];
    
    for (const agentId of candidateAgents) {
      const agent = await this.registry.getAgent(agentId);
      if (!agent) continue;
      
      const canHandle = agent.canHandle(task);
      const relevantCapabilities = agent.capabilities.filter(cap => 
        task.requirements.some(req => req.value === cap.name)
      );
      
      negotiations.push({
        agentId,
        canHandle,
        capabilities: relevantCapabilities,
        confidence: this.calculateCapabilityConfidence(relevantCapabilities, task),
        estimatedTime: agent.metadata.averageResponseTime,
        resourceRequirements: this.estimateResourceRequirements(task, agent)
      });
    }
    
    // Sort by capability match and confidence
    negotiations.sort((a, b) => {
      if (a.canHandle && !b.canHandle) return -1;
      if (!a.canHandle && b.canHandle) return 1;
      return b.confidence - a.confidence;
    });
    
    return {
      task,
      negotiations,
      bestMatch: negotiations[0] || null,
      alternatives: negotiations.slice(1),
      totalCandidates: candidateAgents.length
    };
  }

  /**
   * Get orchestration strategies
   */
  getOrchestrationStrategies(): string[] {
    return Array.from(this.orchestrationStrategies.keys());
  }

  /**
   * Get active conversations
   */
  getActiveConversations(): ConversationContext[] {
    return Array.from(this.activeConversations.values());
  }

  /**
   * Private: Process individual message
   */
  private async processMessage(message: Message): Promise<void> {
    try {
      const recipient = await this.registry.getAgent(message.recipient);
      if (!recipient) {
        logger.warn('Recipient agent not found', { 
          messageId: message.id, 
          recipient: message.recipient 
        });
        return;
      }

      // Handle different message types
      switch (message.type) {
        case 'task-request':
          await this.handleTaskRequest(message, recipient);
          break;
        case 'capability-inquiry':
          await this.handleCapabilityInquiry(message, recipient);
          break;
        case 'coordination-request':
          await this.handleCoordinationRequest(message, recipient);
          break;
        default:
          logger.debug('Unhandled message type', { type: message.type });
      }
      
    } catch (error) {
      logger.error('Error processing message', {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle task request messages
   */
  private async handleTaskRequest(message: Message, recipient: Agent): Promise<void> {
    if (recipient.status !== 'active' && recipient.status !== 'idle') {
      logger.warn('Agent not available for task', {
        agentId: recipient.id,
        status: recipient.status
      });
      return;
    }

    try {
      const response = await recipient.invoke([message]);
      
      // Send response back to sender if expected
      if (message.metadata.expectsResponse) {
        await this.sendMessage(
          recipient.id,
          message.sender,
          response,
          'task-response',
          { expectsResponse: false }
        );
      }
      
    } catch (error) {
      logger.error('Task execution failed', {
        agentId: recipient.id,
        taskId: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle capability inquiry messages
   */
  private async handleCapabilityInquiry(message: Message, recipient: Agent): Promise<void> {
    const capabilities = {
      capabilities: recipient.capabilities,
      status: recipient.status,
      metadata: recipient.metadata
    };
    
    await this.sendMessage(
      recipient.id,
      message.sender,
      capabilities,
      'capability-response',
      { expectsResponse: false }
    );
  }

  /**
   * Handle coordination request messages
   */
  private async handleCoordinationRequest(message: Message, recipient: Agent): Promise<void> {
    // Implementation would coordinate with other agents based on request
    logger.debug('Coordination request received', {
      from: message.sender,
      to: recipient.id,
      content: message.content
    });
  }

  /**
   * Calculate capability confidence for a task
   */
  private calculateCapabilityConfidence(
    capabilities: AgentCapability[], 
    task: AgentTask
  ): number {
    if (capabilities.length === 0) return 0;
    
    const relevantCaps = capabilities.filter(cap =>
      task.requirements.some(req => req.value === cap.name)
    );
    
    if (relevantCaps.length === 0) return 0;
    
    const avgConfidence = relevantCaps.reduce((sum, cap) => sum + cap.confidence, 0) / relevantCaps.length;
    const coverageRatio = relevantCaps.length / task.requirements.length;
    
    return avgConfidence * coverageRatio;
  }

  /**
   * Estimate resource requirements
   */
  private estimateResourceRequirements(task: AgentTask, agent: Agent): ResourceUsage {
    // Simplified estimation - would be more sophisticated in production
    const baseMemory = 50;
    const baseCpu = 30;
    
    const complexity = task.constraints.length + task.requirements.length;
    const multiplier = Math.min(complexity / 5, 3);
    
    return {
      memory: baseMemory * multiplier,
      cpu: baseCpu * multiplier,
      network: 10,
      tokens: task.description.length * 4 // Rough token estimate
    };
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting interfaces
interface ConversationContext {
  id: string;
  participants: string[];
  topic: string;
  strategy: string;
  startTime: Date;
  active: boolean;
  messageCount: number;
}

interface CapabilityNegotiation {
  agentId: string;
  canHandle: boolean;
  capabilities: AgentCapability[];
  confidence: number;
  estimatedTime: number;
  resourceRequirements: ResourceUsage;
}

interface CapabilityNegotiationResult {
  task: AgentTask;
  negotiations: CapabilityNegotiation[];
  bestMatch: CapabilityNegotiation | null;
  alternatives: CapabilityNegotiation[];
  totalCandidates: number;
}

// Orchestration strategy implementations
class SequentialOrchestrationStrategy implements OrchestrationStrategy {
  name = 'sequential';
  type = 'sequential' as const;

  async orchestrate(agents: Agent[], task: AgentTask): Promise<OrchestrationResult> {
    const results: AgentResponse[] = [];
    const executionPlan: ExecutionStep[] = [];
    const errors: string[] = [];
    const startTime = Date.now();

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const step: ExecutionStep = {
        step: i + 1,
        agentId: agent.id,
        task,
        startTime: new Date()
      };

      try {
        const response = await agent.invoke([{
          id: `task_${Date.now()}`,
          type: 'task-request',
          sender: 'orchestrator',
          recipient: agent.id,
          content: task,
          metadata: { priority: 'medium', expectsResponse: true },
          timestamp: new Date()
        }]);

        step.endTime = new Date();
        step.result = response;
        results.push(response);
        
      } catch (error) {
        errors.push(`Agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`);
        step.endTime = new Date();
      }

      executionPlan.push(step);
    }

    return {
      success: errors.length === 0,
      results,
      executionPlan,
      totalTime: Date.now() - startTime,
      errors
    };
  }
}

class ParallelOrchestrationStrategy implements OrchestrationStrategy {
  name = 'parallel';
  type = 'parallel' as const;

  async orchestrate(agents: Agent[], task: AgentTask): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const executionPlan: ExecutionStep[] = [];
    const errors: string[] = [];

    // Execute all agents in parallel
    const promises = agents.map(async (agent, index) => {
      const step: ExecutionStep = {
        step: index + 1,
        agentId: agent.id,
        task,
        startTime: new Date()
      };

      try {
        const response = await agent.invoke([{
          id: `task_${Date.now()}_${index}`,
          type: 'task-request',
          sender: 'orchestrator',
          recipient: agent.id,
          content: task,
          metadata: { priority: 'medium', expectsResponse: true },
          timestamp: new Date()
        }]);

        step.endTime = new Date();
        step.result = response;
        return { step, response, error: null };
        
      } catch (error) {
        const errorMsg = `Agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`;
        step.endTime = new Date();
        return { step, response: null, error: errorMsg };
      }
    });

    const settledResults = await Promise.allSettled(promises);
    const results: AgentResponse[] = [];

    settledResults.forEach((settled, index) => {
      if (settled.status === 'fulfilled') {
        const { step, response, error } = settled.value;
        executionPlan.push(step);
        if (response) {
          results.push(response);
        }
        if (error) {
          errors.push(error);
        }
      } else {
        errors.push(`Agent ${agents[index].id}: Promise rejected`);
      }
    });

    return {
      success: errors.length === 0,
      results,
      executionPlan,
      totalTime: Date.now() - startTime,
      errors
    };
  }
}

class DemocraticOrchestrationStrategy implements OrchestrationStrategy {
  name = 'democratic';
  type = 'democratic' as const;

  async orchestrate(agents: Agent[], task: AgentTask): Promise<OrchestrationResult> {
    // Execute in parallel then combine results democratically
    const parallelStrategy = new ParallelOrchestrationStrategy();
    const parallelResult = await parallelStrategy.orchestrate(agents, task);

    // Simple democratic consensus - average confidence scores
    if (parallelResult.results.length > 0) {
      const averageConfidence = parallelResult.results.reduce(
        (sum, result) => sum + result.metadata.confidence, 0
      ) / parallelResult.results.length;

      const consensus: ConsensusResult = {
        agreement: averageConfidence > 0.7,
        confidence: averageConfidence,
        dissenting: parallelResult.results
          .filter(r => r.metadata.confidence < 0.5)
          .map((_, i) => agents[i].id),
        finalDecision: parallelResult.results[0].content,
        votingResults: parallelResult.results.map((result, i) => ({
          agentId: agents[i].id,
          vote: result.metadata.confidence > 0.5 ? 'yes' as const : 'no' as const,
          confidence: result.metadata.confidence
        }))
      };

      return {
        ...parallelResult,
        consensus
      };
    }

    return parallelResult;
  }
}

class HierarchicalOrchestrationStrategy implements OrchestrationStrategy {
  name = 'hierarchical';
  type = 'hierarchical' as const;

  async orchestrate(agents: Agent[], task: AgentTask): Promise<OrchestrationResult> {
    // Sort agents by capability confidence for the task
    const sortedAgents = [...agents].sort((a, b) => {
      const aConf = this.getAgentConfidenceForTask(a, task);
      const bConf = this.getAgentConfidenceForTask(b, task);
      return bConf - aConf;
    });

    // Execute sequentially in order of capability
    const sequentialStrategy = new SequentialOrchestrationStrategy();
    return await sequentialStrategy.orchestrate(sortedAgents, task);
  }

  private getAgentConfidenceForTask(agent: Agent, task: AgentTask): number {
    const relevantCaps = agent.capabilities.filter(cap =>
      task.requirements.some(req => req.value === cap.name)
    );
    
    return relevantCaps.length > 0 
      ? relevantCaps.reduce((sum, cap) => sum + cap.confidence, 0) / relevantCaps.length
      : 0;
  }
}

class ConsensusOrchestrationStrategy implements OrchestrationStrategy {
  name = 'consensus';
  type = 'consensus' as const;

  async orchestrate(agents: Agent[], task: AgentTask): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const maxRounds = 3;
    let round = 0;
    
    const results: AgentResponse[] = [];
    const executionPlan: ExecutionStep[] = [];
    const errors: string[] = [];
    
    // Multi-round consensus building
    while (round < maxRounds) {
      round++;
      
      // Get responses from all agents
      const roundResults = await this.executeRound(agents, task, round, executionPlan);
      results.push(...roundResults.responses);
      errors.push(...roundResults.errors);
      
      // Check for consensus
      const consensus = this.evaluateConsensus(roundResults.responses);
      if (consensus.agreement) {
        return {
          success: true,
          results,
          consensus,
          executionPlan,
          totalTime: Date.now() - startTime,
          errors
        };
      }
      
      // If not final round, adjust task based on feedback
      if (round < maxRounds) {
        task = this.refineTaskBasedOnFeedback(task, roundResults.responses);
      }
    }
    
    // Final consensus attempt
    const finalConsensus = this.evaluateConsensus(results);
    
    return {
      success: finalConsensus.agreement,
      results,
      consensus: finalConsensus,
      executionPlan,
      totalTime: Date.now() - startTime,
      errors
    };
  }

  private async executeRound(
    agents: Agent[], 
    task: AgentTask, 
    round: number,
    executionPlan: ExecutionStep[]
  ): Promise<{ responses: AgentResponse[], errors: string[] }> {
    const responses: AgentResponse[] = [];
    const errors: string[] = [];

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const step: ExecutionStep = {
        step: executionPlan.length + 1,
        agentId: agent.id,
        task: { ...task, description: `${task.description} (Consensus Round ${round})` },
        startTime: new Date()
      };

      try {
        const response = await agent.invoke([{
          id: `consensus_${round}_${Date.now()}_${i}`,
          type: 'task-request',
          sender: 'consensus-orchestrator',
          recipient: agent.id,
          content: step.task,
          metadata: { priority: 'high', expectsResponse: true },
          timestamp: new Date()
        }]);

        step.endTime = new Date();
        step.result = response;
        responses.push(response);
        
      } catch (error) {
        errors.push(`Round ${round} Agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`);
        step.endTime = new Date();
      }

      executionPlan.push(step);
    }

    return { responses, errors };
  }

  private evaluateConsensus(responses: AgentResponse[]): ConsensusResult {
    if (responses.length === 0) {
      return {
        agreement: false,
        confidence: 0,
        dissenting: [],
        finalDecision: null,
        votingResults: []
      };
    }

    const avgConfidence = responses.reduce((sum, r) => sum + r.metadata.confidence, 0) / responses.length;
    const highConfidenceResponses = responses.filter(r => r.metadata.confidence > 0.7);
    const agreement = highConfidenceResponses.length / responses.length > 0.6;

    return {
      agreement,
      confidence: avgConfidence,
      dissenting: responses
        .map((r, i) => ({ response: r, index: i }))
        .filter(({ response }) => response.metadata.confidence < 0.5)
        .map(({ index }) => `agent_${index}`),
      finalDecision: agreement ? highConfidenceResponses[0].content : null,
      votingResults: responses.map((response, i) => ({
        agentId: `agent_${i}`,
        vote: response.metadata.confidence > 0.5 ? 'yes' as const : 'no' as const,
        confidence: response.metadata.confidence
      }))
    };
  }

  private refineTaskBasedOnFeedback(task: AgentTask, responses: AgentResponse[]): AgentTask {
    // Simple refinement - in practice would be more sophisticated
    const lowConfidenceCount = responses.filter(r => r.metadata.confidence < 0.5).length;
    
    if (lowConfidenceCount > responses.length / 2) {
      return {
        ...task,
        description: `${task.description} (Please provide more specific guidance)`,
        priority: Math.min(task.priority + 1, 10)
      };
    }
    
    return task;
  }
}

// Factory functions
export function createAgentCommunicationProtocol(
  registry: IAgentRegistry,
  conversationManager: ConversationManager
): AgentCommunicationProtocol {
  return new AgentCommunicationProtocol(registry, conversationManager);
}

// Default export
export default AgentCommunicationProtocol;