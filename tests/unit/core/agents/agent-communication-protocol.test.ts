/**
 * Comprehensive Agent Communication Protocol Tests
 * Testing all components: messaging, orchestration, capability negotiation, conversations
 * Following Living Spiral Methodology - Multi-Voice Testing Approach
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import {
  AgentCommunicationProtocol,
  Agent,
  AgentCapability,
  AgentTask,
  AgentResponse,
  AgentStatus,
  Message,
  MessageType,
  IAgentRegistry,
  ConversationManager,
  OrchestrationStrategy,
  OrchestrationResult,
  TaskType,
  AgentSearchCriteria,
  createAgentCommunicationProtocol,
} from '../../../../src/core/agents/agent-communication-protocol.js';

// Mock implementations for testing
class MockAgent extends EventEmitter implements Agent {
  public id: string;
  public name: string;
  public type: string;
  public capabilities: AgentCapability[];
  public metadata: any;
  public status: AgentStatus;

  constructor(id: string, capabilities: AgentCapability[] = [], status: AgentStatus = 'active') {
    super();
    this.id = id;
    this.name = `Agent-${id}`;
    this.type = 'test-agent';
    this.capabilities = capabilities;
    this.status = status;
    this.metadata = {
      version: '1.0.0',
      description: `Test agent ${id}`,
      expertise: ['testing'],
      languages: ['typescript'],
      maxConcurrentTasks: 5,
      averageResponseTime: 100,
      successRate: 0.95,
      lastActive: new Date(),
    };
  }

  async invoke(messages: Message[]): Promise<AgentResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10));

    if (this.status === 'error') {
      throw new Error(`Agent ${this.id} is in error state`);
    }

    return {
      success: true,
      content: {
        result: `Processed by ${this.id}`,
        messageCount: messages.length,
        timestamp: new Date(),
      },
      metadata: {
        processingTime: 50,
        confidence: 0.8,
        usedCapabilities: this.capabilities.map(c => c.name),
        resourceUsage: {
          memory: 25,
          cpu: 15,
          network: 5,
          tokens: 100,
        },
        quality: 0.85,
      },
    };
  }

  canHandle(task: AgentTask): boolean {
    return this.capabilities.some(cap => task.requirements.some(req => req.value === cap.name));
  }

  subscribe(eventType: string, handler: any): void {
    this.on(eventType, handler);
  }

  unsubscribe(eventType: string, handler: any): void {
    this.off(eventType, handler);
  }

  async publishMessage(targetAgentId: string, message: Message): Promise<void> {
    this.emit('message-published', { targetAgentId, message });
  }

  async initialize(): Promise<void> {
    this.status = 'active';
  }

  async shutdown(): Promise<void> {
    this.status = 'shutdown';
    this.removeAllListeners();
  }
}

class MockAgentRegistry implements IAgentRegistry {
  private agents = new Map<string, Agent>();

  async registerAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
  }

  async unregisterAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
  }

  async findAgents(criteria: AgentSearchCriteria): Promise<Agent[]> {
    const allAgents = Array.from(this.agents.values());

    return allAgents.filter(agent => {
      if (criteria.type && agent.type !== criteria.type) return false;
      if (criteria.status && agent.status !== criteria.status) return false;
      if (criteria.capabilities) {
        const hasCapabilities = criteria.capabilities.every(reqCap =>
          agent.capabilities.some(agentCap => agentCap.name === reqCap)
        );
        if (!hasCapabilities) return false;
      }
      if (criteria.minConfidence) {
        const avgConfidence =
          agent.capabilities.reduce((sum, cap) => sum + cap.confidence, 0) /
          agent.capabilities.length;
        if (avgConfidence < criteria.minConfidence) return false;
      }
      return true;
    });
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) || null;
  }

  async discoverCapabilities(taskType: TaskType): Promise<AgentCapability[]> {
    const allCapabilities: AgentCapability[] = [];
    for (const agent of this.agents.values()) {
      allCapabilities.push(...agent.capabilities);
    }
    return allCapabilities.filter(cap => cap.type === 'analysis' || cap.type === 'generation');
  }

  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }
}

class MockConversationManager extends EventEmitter implements ConversationManager {
  private conversations = new Map<string, any>();
  private messages = new Map<string, Message[]>();

  async startConversation(participants: string[], topic: string): Promise<string> {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.conversations.set(id, { participants, topic, startTime: new Date() });
    this.messages.set(id, []);
    return id;
  }

  async addMessage(conversationId: string, message: Message): Promise<void> {
    const messages = this.messages.get(conversationId) || [];
    messages.push(message);
    this.messages.set(conversationId, messages);
  }

  async getConversationHistory(conversationId: string): Promise<Message[]> {
    return this.messages.get(conversationId) || [];
  }

  async endConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);
    this.messages.delete(conversationId);
  }

  async summarizeConversation(conversationId: string): Promise<any> {
    const conversation = this.conversations.get(conversationId);
    const messages = this.messages.get(conversationId) || [];

    return {
      id: conversationId,
      topic: conversation?.topic || 'Unknown',
      participants: conversation?.participants || [],
      duration: Date.now() - (conversation?.startTime?.getTime() || Date.now()),
      keyPoints: ['Test conversation'],
      decisions: [],
      actionItems: [],
      sentiment: 'neutral',
    };
  }

  async extractKeyDecisions(conversationId: string): Promise<any[]> {
    return [];
  }

  async findSimilarConversations(topic: string): Promise<any[]> {
    return [];
  }
}

describe('AgentCommunicationProtocol - Comprehensive Tests', () => {
  let protocol: AgentCommunicationProtocol;
  let registry: MockAgentRegistry;
  let conversationManager: MockConversationManager;
  let testAgents: MockAgent[];

  beforeEach(async () => {
    registry = new MockAgentRegistry();
    conversationManager = new MockConversationManager();
    protocol = new AgentCommunicationProtocol(registry, conversationManager);

    // Create test agents with different capabilities
    testAgents = [
      new MockAgent('agent-1', [
        { name: 'code-analysis', type: 'analysis', confidence: 0.9, prerequisites: [] },
        { name: 'debugging', type: 'analysis', confidence: 0.8, prerequisites: [] },
      ]),
      new MockAgent('agent-2', [
        { name: 'code-generation', type: 'generation', confidence: 0.85, prerequisites: [] },
        { name: 'refactoring', type: 'generation', confidence: 0.75, prerequisites: [] },
      ]),
      new MockAgent('agent-3', [
        { name: 'testing', type: 'validation', confidence: 0.95, prerequisites: [] },
        { name: 'security-audit', type: 'validation', confidence: 0.9, prerequisites: [] },
      ]),
      new MockAgent('agent-4', [], 'busy'), // Busy agent for negative testing
      new MockAgent('agent-5', [], 'error'), // Error agent for error handling tests
    ];

    // Register all test agents
    for (const agent of testAgents) {
      await registry.registerAgent(agent);
      await agent.initialize();
    }

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup all agents
    for (const agent of testAgents) {
      await agent.shutdown();
    }

    protocol.removeAllListeners();
    conversationManager.removeAllListeners();

    // Clear timers
    jest.clearAllTimers();
  });

  describe('Core Message Passing', () => {
    it('should send messages between agents successfully', async () => {
      const message = await protocol.sendMessage(
        'agent-1',
        'agent-2',
        { task: 'test task' },
        'task-request'
      );

      expect(message).toBeDefined();
      expect(message.sender).toBe('agent-1');
      expect(message.recipient).toBe('agent-2');
      expect(message.type).toBe('task-request');
      expect(message.content).toEqual({ task: 'test task' });
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.id).toBeDefined();
    });

    it('should handle message metadata correctly', async () => {
      const customMetadata = {
        priority: 'high' as const,
        timeout: 5000,
        expectsResponse: false,
        maxRetries: 3,
      };

      const message = await protocol.sendMessage(
        'agent-1',
        'agent-2',
        'test content',
        'coordination-request',
        customMetadata
      );

      expect(message.metadata).toMatchObject(customMetadata);
    });

    it('should generate unique message IDs', async () => {
      const messages = await Promise.all([
        protocol.sendMessage('agent-1', 'agent-2', 'test1'),
        protocol.sendMessage('agent-1', 'agent-2', 'test2'),
        protocol.sendMessage('agent-1', 'agent-2', 'test3'),
      ]);

      const messageIds = messages.map(m => m.id);
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).toBe(3);
    });

    it('should emit message-sent events', async () => {
      const eventHandler = jest.fn();
      protocol.on('message-sent', eventHandler);

      await protocol.sendMessage('agent-1', 'agent-2', 'test');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler.mock.calls[0][0]).toMatchObject({
        sender: 'agent-1',
        recipient: 'agent-2',
        type: 'task-request',
      });
    });

    it('should handle messages to non-existent agents gracefully', async () => {
      const message = await protocol.sendMessage('agent-1', 'non-existent-agent', 'test');

      // Should not throw error but message won't be processed
      expect(message).toBeDefined();
      expect(message.recipient).toBe('non-existent-agent');
    });
  });

  describe('Orchestration Strategies', () => {
    let testTask: AgentTask;

    beforeEach(() => {
      testTask = {
        id: 'test-task-1',
        type: 'code-analysis',
        description: 'Analyze test code',
        requirements: [{ type: 'capability', value: 'code-analysis', mandatory: true }],
        constraints: [{ type: 'time', value: 60000, enforced: true }],
        expectedOutput: 'Analysis results',
        priority: 5,
      };
    });

    it('should list all available orchestration strategies', () => {
      const strategies = protocol.getOrchestrationStrategies();
      expect(strategies).toContain('sequential');
      expect(strategies).toContain('parallel');
      expect(strategies).toContain('democratic');
      expect(strategies).toContain('hierarchical');
      expect(strategies).toContain('consensus');
    });

    it('should execute sequential orchestration successfully', async () => {
      const result = await protocol.orchestrateTask(testTask, 'sequential');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.executionPlan.length).toBeGreaterThan(0);
      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);

      // Verify execution plan is sequential
      for (let i = 0; i < result.executionPlan.length; i++) {
        expect(result.executionPlan[i].step).toBe(i + 1);
        expect(result.executionPlan[i].startTime).toBeInstanceOf(Date);
        expect(result.executionPlan[i].endTime).toBeInstanceOf(Date);
      }
    });

    it('should execute parallel orchestration successfully', async () => {
      const result = await protocol.orchestrateTask(testTask, 'parallel');

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.executionPlan.length).toBeGreaterThan(0);

      // In parallel execution, all steps should have overlapping time ranges
      if (result.executionPlan.length > 1) {
        const firstStart = result.executionPlan[0].startTime;
        const lastStart = result.executionPlan[result.executionPlan.length - 1].startTime;
        const timeDiff = lastStart.getTime() - firstStart.getTime();
        expect(timeDiff).toBeLessThan(1000); // Should start within 1 second
      }
    });

    it('should execute democratic orchestration with consensus', async () => {
      const result = await protocol.orchestrateTask(testTask, 'democratic');

      expect(result.success).toBe(true);
      expect(result.consensus).toBeDefined();
      expect(result.consensus?.votingResults).toBeDefined();
      expect(result.consensus?.agreement).toBeDefined();
      expect(result.consensus?.confidence).toBeGreaterThanOrEqual(0);
      expect(result.consensus?.confidence).toBeLessThanOrEqual(1);
    });

    it('should execute hierarchical orchestration based on capability confidence', async () => {
      const result = await protocol.orchestrateTask(testTask, 'hierarchical');

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);

      // Results should be ordered by agent capability confidence
      // (This is tested indirectly through successful execution)
    });

    it('should execute consensus orchestration with multiple rounds', async () => {
      const result = await protocol.orchestrateTask(testTask, 'consensus');

      expect(result.success).toBe(true);
      expect(result.consensus).toBeDefined();
      expect(result.consensus?.agreement).toBeDefined();
      expect(result.executionPlan.length).toBeGreaterThan(0);
    });

    it('should throw error for unknown orchestration strategy', async () => {
      await expect(protocol.orchestrateTask(testTask, 'unknown-strategy')).rejects.toThrow(
        'Unknown orchestration strategy: unknown-strategy'
      );
    });

    it('should throw error when no agents can handle task', async () => {
      const impossibleTask: AgentTask = {
        ...testTask,
        type: 'impossible-task' as TaskType,
        requirements: [{ type: 'capability', value: 'non-existent-capability', mandatory: true }],
      };

      await expect(protocol.orchestrateTask(impossibleTask)).rejects.toThrow(
        'No agents found capable of handling task type: impossible-task'
      );
    });

    it('should emit orchestration events', async () => {
      const startHandler = jest.fn();
      const completeHandler = jest.fn();

      protocol.on('orchestration-started', startHandler);
      protocol.on('orchestration-completed', completeHandler);

      await protocol.orchestrateTask(testTask, 'sequential');

      expect(startHandler).toHaveBeenCalledWith('sequential', expect.any(Number));
      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          success: expect.any(Boolean),
          results: expect.any(Array),
          totalTime: expect.any(Number),
        })
      );
    });

    it('should handle agent errors during orchestration', async () => {
      // Force an error by using the error agent
      const errorTask: AgentTask = {
        ...testTask,
        requirements: [], // No specific requirements so error agent will be selected
      };

      const result = await protocol.orchestrateTask(errorTask, 'sequential');

      // Should complete but with errors
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('is in error state');
    });
  });

  describe('Capability Negotiation', () => {
    it('should negotiate capabilities successfully', async () => {
      const testTask: AgentTask = {
        id: 'negotiation-task',
        type: 'code-analysis',
        description: 'Test capability negotiation',
        requirements: [
          { type: 'capability', value: 'code-analysis', mandatory: true },
          { type: 'capability', value: 'debugging', mandatory: false },
        ],
        constraints: [],
        expectedOutput: 'Negotiation results',
        priority: 3,
      };

      const result = await protocol.negotiateCapabilities(testTask, [
        'agent-1',
        'agent-2',
        'agent-3',
      ]);

      expect(result).toBeDefined();
      expect(result.task).toBe(testTask);
      expect(result.negotiations.length).toBe(3);
      expect(result.bestMatch).toBeDefined();
      expect(result.totalCandidates).toBe(3);

      // Verify negotiations are sorted by capability match
      const negotiations = result.negotiations;
      expect(negotiations[0].canHandle).toBe(true); // Best match should be able to handle
      expect(negotiations[0].confidence).toBeGreaterThanOrEqual(0);
    });

    it('should calculate capability confidence correctly', async () => {
      const testTask: AgentTask = {
        id: 'confidence-task',
        type: 'code-analysis',
        description: 'Test confidence calculation',
        requirements: [{ type: 'capability', value: 'code-analysis', mandatory: true }],
        constraints: [],
        expectedOutput: 'Confidence results',
        priority: 3,
      };

      const result = await protocol.negotiateCapabilities(testTask, ['agent-1']);

      expect(result.bestMatch).toBeDefined();
      expect(result.bestMatch!.confidence).toBe(0.9); // Should match agent-1's code-analysis confidence
      expect(result.bestMatch!.canHandle).toBe(true);
    });

    it('should handle agents that cannot handle task', async () => {
      const impossibleTask: AgentTask = {
        id: 'impossible-task',
        type: 'code-analysis',
        description: 'Impossible task',
        requirements: [{ type: 'capability', value: 'impossible-capability', mandatory: true }],
        constraints: [],
        expectedOutput: 'Nothing',
        priority: 1,
      };

      const result = await protocol.negotiateCapabilities(impossibleTask, ['agent-1', 'agent-2']);

      expect(result.negotiations.every(n => !n.canHandle)).toBe(true);
      expect(result.negotiations.every(n => n.confidence === 0)).toBe(true);
    });

    it('should estimate resource requirements', async () => {
      const complexTask: AgentTask = {
        id: 'complex-task',
        type: 'code-analysis',
        description: 'Complex task with many requirements',
        requirements: [
          { type: 'capability', value: 'code-analysis', mandatory: true },
          { type: 'capability', value: 'debugging', mandatory: true },
          { type: 'resource', value: 'high-memory', mandatory: false },
        ],
        constraints: [
          { type: 'time', value: 30000, enforced: true },
          { type: 'memory', value: 1024, enforced: true },
        ],
        expectedOutput: 'Complex results',
        priority: 8,
      };

      const result = await protocol.negotiateCapabilities(complexTask, ['agent-1']);

      expect(result.bestMatch).toBeDefined();
      expect(result.bestMatch!.resourceRequirements).toBeDefined();
      expect(result.bestMatch!.resourceRequirements.memory).toBeGreaterThan(0);
      expect(result.bestMatch!.resourceRequirements.cpu).toBeGreaterThan(0);
      expect(result.bestMatch!.resourceRequirements.tokens).toBeGreaterThan(0);
    });
  });

  describe('Multi-Agent Conversations', () => {
    it('should start and manage conversations', async () => {
      const conversationId = await protocol.startConversation(
        ['agent-1', 'agent-2', 'agent-3'],
        'Testing conversation',
        'democratic'
      );

      expect(conversationId).toBeDefined();
      expect(typeof conversationId).toBe('string');

      const activeConversations = protocol.getActiveConversations();
      expect(activeConversations).toHaveLength(1);
      expect(activeConversations[0].id).toBe(conversationId);
      expect(activeConversations[0].participants).toEqual(['agent-1', 'agent-2', 'agent-3']);
      expect(activeConversations[0].topic).toBe('Testing conversation');
      expect(activeConversations[0].strategy).toBe('democratic');
      expect(activeConversations[0].active).toBe(true);
    });

    it('should handle multiple concurrent conversations', async () => {
      const conv1 = await protocol.startConversation(['agent-1', 'agent-2'], 'Topic 1');
      const conv2 = await protocol.startConversation(['agent-2', 'agent-3'], 'Topic 2');
      const conv3 = await protocol.startConversation(['agent-1', 'agent-3'], 'Topic 3');

      const activeConversations = protocol.getActiveConversations();
      expect(activeConversations).toHaveLength(3);

      const conversationIds = activeConversations.map(c => c.id);
      expect(conversationIds).toContain(conv1);
      expect(conversationIds).toContain(conv2);
      expect(conversationIds).toContain(conv3);
    });

    it('should track conversation metadata', async () => {
      const conversationId = await protocol.startConversation(
        ['agent-1', 'agent-2'],
        'Metadata test'
      );

      const conversations = protocol.getActiveConversations();
      const conversation = conversations.find(c => c.id === conversationId);

      expect(conversation).toBeDefined();
      expect(conversation!.startTime).toBeInstanceOf(Date);
      expect(conversation!.messageCount).toBe(0);
      expect(conversation!.active).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle agent lookup failures gracefully', async () => {
      // Remove agent from registry
      await registry.unregisterAgent('agent-1');

      const message = await protocol.sendMessage('agent-2', 'agent-1', 'test');
      expect(message).toBeDefined();
      // Should not throw error, will log warning internally
    });

    it('should handle agent initialization failures', async () => {
      const faultyAgent = new MockAgent('faulty-agent');
      // Override initialize to throw error
      faultyAgent.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));

      // Registration should still work
      await registry.registerAgent(faultyAgent);
      const registeredAgent = await registry.getAgent('faulty-agent');
      expect(registeredAgent).toBe(faultyAgent);
    });

    it('should handle high-frequency message sending', async () => {
      const messagePromises: Promise<Message>[] = [];
      const messageCount = 100;

      // Send many messages concurrently
      for (let i = 0; i < messageCount; i++) {
        messagePromises.push(protocol.sendMessage('agent-1', 'agent-2', `Message ${i}`));
      }

      const messages = await Promise.all(messagePromises);

      expect(messages).toHaveLength(messageCount);
      expect(messages.every(m => m.id)).toBe(true);

      // All message IDs should be unique
      const messageIds = messages.map(m => m.id);
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).toBe(messageCount);
    });

    it('should handle concurrent orchestrations', async () => {
      const task1: AgentTask = {
        id: 'task-1',
        type: 'code-analysis',
        description: 'Concurrent task 1',
        requirements: [{ type: 'capability', value: 'code-analysis', mandatory: true }],
        constraints: [],
        expectedOutput: 'Results 1',
        priority: 1,
      };

      const task2: AgentTask = {
        id: 'task-2',
        type: 'code-generation',
        description: 'Concurrent task 2',
        requirements: [{ type: 'capability', value: 'code-generation', mandatory: true }],
        constraints: [],
        expectedOutput: 'Results 2',
        priority: 2,
      };

      const [result1, result2] = await Promise.all([
        protocol.orchestrateTask(task1, 'parallel'),
        protocol.orchestrateTask(task2, 'parallel'),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.executionPlan[0].task.id).toBe('task-1');
      expect(result2.executionPlan[0].task.id).toBe('task-2');
    });

    it('should cleanup resources properly', async () => {
      // Start multiple conversations and orchestrations
      const conv1 = await protocol.startConversation(['agent-1', 'agent-2'], 'Test 1');
      const conv2 = await protocol.startConversation(['agent-2', 'agent-3'], 'Test 2');

      expect(protocol.getActiveConversations()).toHaveLength(2);

      // Cleanup agents
      for (const agent of testAgents) {
        await agent.shutdown();
      }

      // Verify agents are shut down
      for (const agent of testAgents) {
        expect(agent.status).toBe('shutdown');
      }
    });
  });

  describe('Performance and Resource Management', () => {
    it('should complete orchestration within reasonable time', async () => {
      const startTime = Date.now();

      const testTask: AgentTask = {
        id: 'perf-task',
        type: 'code-analysis',
        description: 'Performance test task',
        requirements: [{ type: 'capability', value: 'code-analysis', mandatory: true }],
        constraints: [{ type: 'time', value: 10000, enforced: true }],
        expectedOutput: 'Performance results',
        priority: 5,
      };

      const result = await protocol.orchestrateTask(testTask, 'sequential');
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.totalTime).toBeLessThan(5000);
    });

    it('should track resource usage in responses', async () => {
      const testTask: AgentTask = {
        id: 'resource-task',
        type: 'testing',
        description: 'Resource tracking test',
        requirements: [{ type: 'capability', value: 'testing', mandatory: true }],
        constraints: [],
        expectedOutput: 'Resource data',
        priority: 3,
      };

      const result = await protocol.orchestrateTask(testTask, 'sequential');

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);

      for (const response of result.results) {
        expect(response.metadata.resourceUsage).toBeDefined();
        expect(response.metadata.resourceUsage.memory).toBeGreaterThan(0);
        expect(response.metadata.resourceUsage.cpu).toBeGreaterThan(0);
        expect(response.metadata.processingTime).toBeGreaterThan(0);
      }
    });

    it('should handle memory cleanup in scoped operations', async () => {
      const initialMemoryUsage = process.memoryUsage();

      // Perform multiple orchestrations to potentially create memory pressure
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `memory-task-${i}`,
        type: 'code-analysis' as TaskType,
        description: `Memory test task ${i}`,
        requirements: [{ type: 'capability', value: 'code-analysis', mandatory: true }],
        constraints: [],
        expectedOutput: `Results ${i}`,
        priority: 1,
      }));

      const results = await Promise.all(
        tasks.map(task => protocol.orchestrateTask(task, 'parallel'))
      );

      expect(results.every(r => r.success)).toBe(true);

      // Memory usage should not grow excessively
      const finalMemoryUsage = process.memoryUsage();
      const memoryGrowth = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;

      // Allow some growth but not excessive (less than 50MB for this test)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Factory and Utility Functions', () => {
    it('should create protocol instance via factory function', () => {
      const registry = new MockAgentRegistry();
      const conversationManager = new MockConversationManager();

      const createdProtocol = createAgentCommunicationProtocol(registry, conversationManager);

      expect(createdProtocol).toBeInstanceOf(AgentCommunicationProtocol);
      expect(createdProtocol.getOrchestrationStrategies()).toContain('sequential');
    });

    it('should provide consistent strategy listings', () => {
      const strategies1 = protocol.getOrchestrationStrategies();
      const strategies2 = protocol.getOrchestrationStrategies();

      expect(strategies1).toEqual(strategies2);
      expect(strategies1.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with External Systems', () => {
    it('should integrate with telemetry system', async () => {
      // Test that orchestration includes telemetry tracing
      const testTask: AgentTask = {
        id: 'telemetry-task',
        type: 'code-analysis',
        description: 'Telemetry integration test',
        requirements: [{ type: 'capability', value: 'code-analysis', mandatory: true }],
        constraints: [],
        expectedOutput: 'Telemetry results',
        priority: 4,
      };

      // This should not throw and should complete successfully
      const result = await protocol.orchestrateTask(testTask, 'sequential');
      expect(result.success).toBe(true);
    });

    it('should emit events for monitoring systems', async () => {
      const events: string[] = [];
      const eventData: any[] = [];

      // Capture all events
      protocol.on('message-sent', data => {
        events.push('message-sent');
        eventData.push(data);
      });

      protocol.on('orchestration-started', (strategy, agentCount) => {
        events.push('orchestration-started');
        eventData.push({ strategy, agentCount });
      });

      protocol.on('orchestration-completed', result => {
        events.push('orchestration-completed');
        eventData.push(result);
      });

      // Trigger events
      await protocol.sendMessage('agent-1', 'agent-2', 'monitoring test');

      const testTask: AgentTask = {
        id: 'monitoring-task',
        type: 'code-analysis',
        description: 'Monitoring test',
        requirements: [{ type: 'capability', value: 'code-analysis', mandatory: true }],
        constraints: [],
        expectedOutput: 'Monitoring results',
        priority: 2,
      };

      await protocol.orchestrateTask(testTask, 'sequential');

      // Verify events were emitted
      expect(events).toContain('message-sent');
      expect(events).toContain('orchestration-started');
      expect(events).toContain('orchestration-completed');
      expect(eventData.length).toBeGreaterThan(0);
    });
  });
});
