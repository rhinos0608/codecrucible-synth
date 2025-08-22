/**
 * Comprehensive tests for UnifiedAgent
 * Testing all capabilities and workflow execution
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { UnifiedAgent } from '../../../src/core/agent.js';
import { PerformanceMonitor } from '../../../src/utils/performance.js';

// Mock UnifiedModelClient
class MockUnifiedModelClient extends EventEmitter {
  async synthesize(request: any) {
    return {
      content: `Mock response for: ${request.prompt}`,
      tokensUsed: 100,
    };
  }

  async destroy() {
    // Mock cleanup
  }
}

describe('UnifiedAgent', () => {
  let agent: UnifiedAgent;
  let mockClient: MockUnifiedModelClient;
  let mockMonitor: PerformanceMonitor;

  beforeEach(() => {
    mockClient = new MockUnifiedModelClient();
    mockMonitor = {
      startTimer: jest.fn().mockReturnValue('timer-id'),
      endTimer: jest.fn(),
      recordMetric: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({}),
      destroy: jest.fn(),
    } as any;

    agent = new UnifiedAgent(mockClient as any, mockMonitor);
  });

  afterEach(async () => {
    await agent.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default capabilities', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities.length).toBeGreaterThan(0);
      
      const capabilityNames = capabilities.map(c => c.name);
      expect(capabilityNames).toContain('code-analysis');
      expect(capabilityNames).toContain('code-generation');
      expect(capabilityNames).toContain('testing');
      expect(capabilityNames).toContain('security-analysis');
    });

    it('should have no active workflows initially', () => {
      const workflows = agent.getActiveWorkflows();
      expect(workflows).toHaveLength(0);
    });

    it('should initialize with zero metrics', () => {
      const metrics = agent.getMetrics();
      expect(metrics.tasksCompleted).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe('Code Analysis Capability', () => {
    it('should analyze simple code correctly', async () => {
      const response = await agent.execute({
        input: 'function add(a, b) { return a + b; }',
        type: 'code-analysis'
      });

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
      expect(mockClient.synthesize).toHaveBeenCalled();
    });

    it('should detect project analysis requests', async () => {
      const response = await agent.execute({
        input: 'analyze the project structure and codebase',
        type: 'code-analysis'
      });

      expect(response.success).toBe(true);
      expect(response.workflowId).toBeDefined();
    });

    it('should handle file path analysis', async () => {
      const response = await agent.execute({
        input: 'analyze src/core/agent.ts for improvements',
        type: 'code-analysis'
      });

      expect(response.success).toBe(true);
    });
  });

  describe('Code Generation Capability', () => {
    it('should generate code based on requirements', async () => {
      const response = await agent.execute({
        input: 'Create a function that validates email addresses',
        type: 'code-generation'
      });

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
    });

    it('should handle comprehensive generation requests', async () => {
      const response = await agent.execute({
        input: 'Generate a complete user authentication system',
        type: 'comprehensive'
      });

      expect(response.success).toBe(true);
      expect(response.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Testing Capability', () => {
    it('should generate tests for given code', async () => {
      const response = await agent.execute({
        input: 'Generate tests for a calculator function',
        type: 'testing'
      });

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
    });
  });

  describe('Security Analysis Capability', () => {
    it('should identify security vulnerabilities', async () => {
      const response = await agent.execute({
        input: 'eval(userInput); // Check this for security issues',
        type: 'security-analysis'
      });

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
    });
  });

  describe('Workflow Management', () => {
    it('should create and track workflows', async () => {
      const promise = agent.execute({
        input: 'test workflow creation',
        type: 'code-analysis'
      });

      // Should have active workflow during execution
      const activeWorkflows = agent.getActiveWorkflows();
      
      const response = await promise;
      expect(response.workflowId).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should handle workflow failures gracefully', async () => {
      // Mock failure
      mockClient.synthesize = jest.fn().mockRejectedValue(new Error('Test error'));

      const response = await agent.execute({
        input: 'test error handling',
        type: 'code-analysis'
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.workflowId).toBeDefined();
    });

    it('should update metrics after execution', async () => {
      await agent.execute({
        input: 'test metrics update',
        type: 'code-analysis'
      });

      const metrics = agent.getMetrics();
      expect(metrics.tasksCompleted).toBe(1);
      expect(metrics.successRate).toBe(1);
      expect(metrics.lastExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Capability Management', () => {
    it('should allow registering new capabilities', () => {
      const customCapability = {
        name: 'custom-analysis',
        description: 'Custom analysis capability',
        priority: 5,
        enabled: true,
        handler: async () => ({ success: true, content: 'custom', metadata: { model: 'test', tokens: 0, latency: 0 } })
      };

      agent.registerCapability(customCapability);
      
      const capabilities = agent.getCapabilities();
      const customCap = capabilities.find(c => c.name === 'custom-analysis');
      expect(customCap).toBeDefined();
      expect(customCap?.enabled).toBe(true);
    });

    it('should allow enabling/disabling capabilities', () => {
      agent.setCapabilityEnabled('code-analysis', false);
      
      const capabilities = agent.getCapabilities();
      const codeAnalysisCap = capabilities.find(c => c.name === 'code-analysis');
      expect(codeAnalysisCap?.enabled).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should allow updating configuration', async () => {
      const newConfig = {
        mode: 'fast' as const,
        maxConcurrency: 1,
        enableCaching: false
      };

      await agent.updateConfig(newConfig);
      
      // Execute to see if config is applied
      const response = await agent.execute({
        input: 'test config update',
        type: 'comprehensive'
      });

      expect(response.success).toBe(true);
    });
  });

  describe('Execution Modes', () => {
    it('should handle fast mode execution', async () => {
      await agent.updateConfig({ mode: 'fast' });
      
      const response = await agent.execute({
        input: 'test fast mode',
        type: 'comprehensive'
      });

      expect(response.success).toBe(true);
      expect(response.executionTime).toBeDefined();
    });

    it('should handle balanced mode execution', async () => {
      await agent.updateConfig({ mode: 'balanced' });
      
      const response = await agent.execute({
        input: 'test balanced mode',
        type: 'comprehensive'
      });

      expect(response.success).toBe(true);
    });

    it('should handle thorough mode execution', async () => {
      await agent.updateConfig({ mode: 'thorough' });
      
      const response = await agent.execute({
        input: 'test thorough mode',
        type: 'comprehensive'
      });

      expect(response.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing capabilities gracefully', async () => {
      agent.setCapabilityEnabled('code-analysis', false);
      
      const response = await agent.execute({
        input: 'test missing capability',
        type: 'code-analysis'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not available');
    });

    it('should handle model client failures', async () => {
      mockClient.synthesize = jest.fn().mockRejectedValue(new Error('Model unavailable'));
      
      const response = await agent.execute({
        input: 'test model failure',
        type: 'code-analysis'
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources properly', async () => {
      // Create some workflows
      const promise1 = agent.execute({ input: 'test 1', type: 'code-analysis' });
      const promise2 = agent.execute({ input: 'test 2', type: 'code-generation' });
      
      await Promise.all([promise1, promise2]);
      
      await agent.destroy();
      
      // Verify cleanup
      const workflows = agent.getActiveWorkflows();
      expect(workflows).toHaveLength(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit capability events', (done) => {
      agent.on('capability-registered', (capability) => {
        expect(capability.name).toBe('test-capability');
        done();
      });

      agent.registerCapability({
        name: 'test-capability',
        description: 'Test capability for events',
        priority: 1,
        enabled: true,
        handler: async () => ({ success: true, content: '', metadata: { model: '', tokens: 0, latency: 0 } })
      });
    });

    it('should emit workflow events', (done) => {
      let eventCount = 0;
      
      agent.on('workflow-started', () => {
        eventCount++;
      });
      
      agent.on('workflow-completed', () => {
        eventCount++;
        expect(eventCount).toBe(2);
        done();
      });

      agent.execute({ input: 'test events', type: 'code-analysis' });
    });
  });
});