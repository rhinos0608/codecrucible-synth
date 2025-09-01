/**
 * Cycle Detection Tests for Orchestration Components
 * Tests the architectural improvements made to prevent deadlocks and cycles
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EnhancedAgenticPlanner, Task, PlanningContext } from '../../../src/core/planning/enhanced-agentic-planner.js';
import { EnterpriseMCPOrchestrator, ToolExecutionStep, ExecutionContext } from '../../../src/core/mcp/enterprise-mcp-orchestrator.js';
import { MCPServerManager } from '../../../src/mcp-servers/mcp-server-manager.js';

describe('Cycle Detection in Orchestration Components', () => {
  let planner: EnhancedAgenticPlanner;
  let mcpOrchestrator: EnterpriseMCPOrchestrator;

  beforeEach(() => {
    planner = new EnhancedAgenticPlanner();
    
    // Mock MCPServerManager for testing
    const mockMCPManager = {
      listServers: jest.fn().mockResolvedValue([]),
      getServerStatus: jest.fn().mockReturnValue(null)
    } as any;
    
    mcpOrchestrator = new EnterpriseMCPOrchestrator(mockMCPManager);
  });

  describe('EnhancedAgenticPlanner Cycle Detection', () => {
    it('should detect simple cycles in task dependencies', async () => {
      const cycleDetectedEvents: any[] = [];
      
      // Listen for cycle detection events
      planner.on('cycle-detected', (event) => {
        cycleDetectedEvents.push(event);
      });

      // Create tasks with a simple cycle: A -> B -> C -> A
      const tasks: Task[] = [
        {
          id: 'taskA',
          description: 'Task A',
          priority: 'medium',
          status: 'pending',
          dependencies: ['taskC'], // Creates cycle: A depends on C
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'taskB',
          description: 'Task B',
          priority: 'medium',
          status: 'pending',
          dependencies: ['taskA'], // B depends on A
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'taskC',
          description: 'Task C',
          priority: 'medium',
          status: 'pending',
          dependencies: ['taskB'], // C depends on B, completing the cycle
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const dependencies = new Map([
        ['taskA', ['taskC']],
        ['taskB', ['taskA']],
        ['taskC', ['taskB']]
      ]);

      // Access the private method to test cycle detection directly
      const plannerAny = planner as any;
      const order = plannerAny.calculateExecutionOrder(tasks, dependencies);

      // Verify cycle was detected
      expect(cycleDetectedEvents).toHaveLength(1);
      expect(cycleDetectedEvents[0].cycles).toBeDefined();
      expect(cycleDetectedEvents[0].cycles.length).toBeGreaterThan(0);
      expect(cycleDetectedEvents[0].affectedTasks).toContain('taskA');
      expect(cycleDetectedEvents[0].affectedTasks).toContain('taskB');
      expect(cycleDetectedEvents[0].affectedTasks).toContain('taskC');

      // Should return fallback order when cycles detected (graceful degradation)
      expect(order).toHaveLength(3);
    });

    it('should handle self-referencing dependencies', async () => {
      const cycleDetectedEvents: any[] = [];
      
      planner.on('cycle-detected', (event) => {
        cycleDetectedEvents.push(event);
      });

      // Create a task that depends on itself
      const tasks: Task[] = [
        {
          id: 'selfRef',
          description: 'Self-referencing task',
          priority: 'medium',
          status: 'pending',
          dependencies: ['selfRef'], // Self-reference creates immediate cycle
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const dependencies = new Map([
        ['selfRef', ['selfRef']]
      ]);

      const plannerAny = planner as any;
      plannerAny.calculateExecutionOrder(tasks, dependencies);

      expect(cycleDetectedEvents).toHaveLength(1);
      expect(cycleDetectedEvents[0].affectedTasks).toContain('selfRef');
    });

    it('should not report cycles when there are none', async () => {
      const cycleDetectedEvents: any[] = [];
      
      planner.on('cycle-detected', (event) => {
        cycleDetectedEvents.push(event);
      });

      // Create a normal plan that should execute cycle detection on generated tasks
      const context: PlanningContext = {
        objective: 'create implement test review',
        constraints: [],
        availableResources: [],
      };

      // This should trigger the planner's normal flow without cycles
      const plan = await planner.createPlan(context);

      // Should not detect any cycles in the generated plan
      expect(cycleDetectedEvents).toHaveLength(0);
      expect(plan.executionOrder.length).toBeGreaterThan(0);
      // The execution order should contain all task IDs from the generated tasks
      const allTaskIds = plan.tasks.map(t => t.id);
      expect(plan.executionOrder.every(id => allTaskIds.includes(id))).toBe(true);
    });
  });

  describe('EnterpriseMCPOrchestrator Cycle Detection', () => {
    it('should detect cycles in MCP tool execution steps', async () => {
      const cycleEvents: any[] = [];
      
      mcpOrchestrator.on('dependency-cycle-detected', (event) => {
        cycleEvents.push(event);
      });

      // Create steps that form a cycle
      const steps: ToolExecutionStep[] = [
        {
          id: 'step1',
          toolName: 'tool-a',
          parameters: {},
          dependencies: ['step3'] // Creates cycle
        },
        {
          id: 'step2',
          toolName: 'tool-b',
          parameters: {},
          dependencies: ['step1']
        },
        {
          id: 'step3',
          toolName: 'tool-c',
          parameters: {},
          dependencies: ['step2'] // Completes the cycle
        }
      ];

      const context: ExecutionContext = {
        correlationId: 'test-cycle',
        userId: 'test-user',
        requestId: 'test-request',
        maxDuration: 30000,
        securityContext: {
          permissions: [],
          userRole: 'user'
        }
      };

      // Access the private method to test cycle detection
      const orchestratorAny = mcpOrchestrator as any;
      const groups = orchestratorAny.groupStepsByDependencies(steps, context);

      expect(cycleEvents).toHaveLength(1);
      expect(cycleEvents[0].cycles).toBeDefined();
      expect(groups).toBeDefined(); // Should return groups even with cycles (graceful degradation)
    });

    it('should handle missing dependencies gracefully', async () => {
      const cycleEvents: any[] = [];
      
      mcpOrchestrator.on('dependency-cycle-detected', (event) => {
        cycleEvents.push(event);
      });

      const steps: ToolExecutionStep[] = [
        {
          id: 'step1',
          toolName: 'tool-a',
          parameters: {},
          dependencies: ['nonexistent'] // Missing dependency
        },
        {
          id: 'step2',
          toolName: 'tool-b',
          parameters: {},
          dependencies: ['step1']
        }
      ];

      const context: ExecutionContext = {
        correlationId: 'test-missing-deps',
        userId: 'test-user',
        requestId: 'test-request',
        maxDuration: 30000,
        securityContext: {
          permissions: [],
          userRole: 'user'
        }
      };

      const orchestratorAny = mcpOrchestrator as any;
      const groups = orchestratorAny.groupStepsByDependencies(steps, context);

      // Should not detect cycles for missing dependencies
      expect(cycleEvents).toHaveLength(0);
      expect(groups).toBeDefined();
    });

    it('should process steps with no dependencies correctly', async () => {
      const cycleEvents: any[] = [];
      
      mcpOrchestrator.on('dependency-cycle-detected', (event) => {
        cycleEvents.push(event);
      });

      const steps: ToolExecutionStep[] = [
        {
          id: 'step1',
          toolName: 'tool-a',
          parameters: {},
          dependencies: []
        },
        {
          id: 'step2',
          toolName: 'tool-b',
          parameters: {},
          dependencies: []
        }
      ];

      const context: ExecutionContext = {
        correlationId: 'test-no-deps',
        userId: 'test-user',
        requestId: 'test-request',
        maxDuration: 30000,
        securityContext: {
          permissions: []
        }
      };

      expect(cycleEvents).toHaveLength(0);
      expect(groups).toBeDefined();
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Safety', () => {
    it('should handle large dependency graphs efficiently', async () => {
      const start = Date.now();
      
      // Test the planner with a normal workflow (no artificial cycles)
      const context: PlanningContext = {
        objective: 'create test implement analyze review',
        constraints: [],
        availableResources: [],
      };

      const plan = await planner.createPlan(context);
      const duration = Date.now() - start;

      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.executionOrder.length).toBeGreaterThan(0);
    it('should prevent infinite loops with complex cycles', async () => {
      const cycleEvents: any[] = [];
      
      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.executionOrder.length).toBeGreaterThan(0);
      // Test should complete quickly (under reasonable time limit)
      expect(duration).toBeLessThan(5000);
    });

    it('should prevent infinite loops with complex cycles', async () => {

      // Create a complex multi-cycle graph
      const steps: ToolExecutionStep[] = [
        { id: 'A', toolName: 'tool1', parameters: {}, dependencies: ['D'] },
        { id: 'B', toolName: 'tool2', parameters: {}, dependencies: ['A'] },
        { id: 'C', toolName: 'tool3', parameters: {}, dependencies: ['B'] },
        { id: 'D', toolName: 'tool4', parameters: {}, dependencies: ['C'] }, // Cycle 1: A->D->C->B->A
        { id: 'E', toolName: 'tool5', parameters: {}, dependencies: ['F'] },
        { id: 'F', toolName: 'tool6', parameters: {}, dependencies: ['E'] }, // Cycle 2: E->F->E
      ];

      const context: ExecutionContext = {
        correlationId: 'test-complex-cycle',
        userId: 'test-user',
        requestId: 'test-request',
        maxDuration: 30000,
        securityContext: {
          permissions: [],
          userRole: 'user'
        }
      };

      const orchestratorAny = mcpOrchestrator as any;
      const groups = orchestratorAny.groupStepsByDependencies(steps, context);

      // Should complete quickly even with complex cycles
      expect(cycleEvents.length).toBeGreaterThan(0); // Should detect cycles
      expect(groups).toBeDefined(); // Should still return results
    });
  });
});
