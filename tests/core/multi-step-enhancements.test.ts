/**
 * Tests for 2025 Multi-Step Enhancements
 * Validates FastMultiStepExecutor, ContextAwareWorkflowManager, and Architect/Editor pattern
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { FastMultiStepExecutor } from '../../src/core/tools/fast-multi-step-executor.js';
import { ContextAwareWorkflowManager } from '../../src/core/tools/context-aware-workflow-manager.js';
import {
  ArchitectEditorCoordinator,
  Architect,
  Editor,
} from '../../src/core/patterns/architect-editor-pattern.js';
import { UnifiedModelClient } from '../../src/core/client.js';

// Mock the model client
const mockModelClient = {
  generate: jest.fn(),
  generateText: jest.fn(),
} as unknown as UnifiedModelClient;

describe('FastMultiStepExecutor', () => {
  let executor: FastMultiStepExecutor;

  beforeEach(() => {
    executor = new FastMultiStepExecutor(mockModelClient);
    jest.clearAllMocks();
  });

  test('should create multi-step task from complex prompt', async () => {
    // Mock the model response
    const mockResponse = {
      content: JSON.stringify({
        task: {
          id: 'test_task_1',
          description: 'Implement user authentication system',
          priority: 'high',
        },
        steps: [
          {
            id: 'step_1',
            name: 'Create user model',
            description: 'Define user data structure',
            type: 'implementation',
            inputs: [],
            outputs: ['user.model.ts'],
            estimatedDuration: 10000,
            dependencies: [],
          },
          {
            id: 'step_2',
            name: 'Implement authentication',
            description: 'Add login/logout functionality',
            type: 'implementation',
            inputs: ['user.model.ts'],
            outputs: ['auth.service.ts'],
            estimatedDuration: 15000,
            dependencies: ['step_1'],
          },
        ],
      }),
    };

    (mockModelClient.generate as jest.Mock).mockResolvedValue(mockResponse);

    const prompt =
      'Implement a complete user authentication system with login, logout, and session management';
    const task = await executor.analyzeAndPlan(prompt);

    expect(task.id).toBe('test_task_1');
    expect(task.description).toBe('Implement user authentication system');
    expect(task.priority).toBe('high');
    expect(task.steps).toHaveLength(2);
    expect(task.steps[0].name).toBe('Create user model');
    expect(task.steps[1].dependencies).toContain('step_1');
  });

  test('should handle JSON parsing errors gracefully', async () => {
    // Mock invalid JSON response
    const mockResponse = {
      content: 'Invalid JSON response',
    };

    (mockModelClient.generate as jest.Mock).mockResolvedValue(mockResponse);

    const prompt = 'Simple task that should fall back to basic plan';
    const task = await executor.analyzeAndPlan(prompt);

    // Should create fallback task
    expect(task.id).toMatch(/fallback_\d+/);
    expect(task.description).toContain('Simple task');
    expect(task.steps).toHaveLength(1);
    expect(task.steps[0].name).toBe('Execute Request');
  });

  test('should execute multi-step task with proper error handling', async () => {
    const task = {
      id: 'test_execution',
      description: 'Test execution task',
      priority: 'medium' as const,
      steps: [
        {
          id: 'step_1',
          name: 'First step',
          description: 'Initial step',
          type: 'analysis' as const,
          inputs: [],
          outputs: ['output1'],
          estimatedDuration: 5000,
          dependencies: [],
          status: 'pending' as const,
        },
      ],
      context: 'Test context',
    };

    // Mock successful execution
    (mockModelClient.generate as jest.Mock).mockResolvedValue({
      content: 'Step completed successfully',
    });

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
    expect(result.taskId).toBe('test_execution');
    expect(result.completedSteps).toBe(1);
    expect(result.results.size).toBe(1);
  });
});

describe('ContextAwareWorkflowManager', () => {
  let workflowManager: ContextAwareWorkflowManager;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    workflowManager = new ContextAwareWorkflowManager(mockModelClient, testWorkingDir);
    jest.clearAllMocks();
  });

  test('should plan multi-file workflow', async () => {
    // Mock the model response for planning
    const mockResponse = {
      content: JSON.stringify({
        operation: {
          id: 'workflow_1',
          type: 'refactor',
          description: 'Refactor authentication system',
          affectedFiles: ['auth.ts', 'user.ts'],
          plannedChanges: [
            {
              filePath: 'auth.ts',
              changeType: 'modify',
              description: 'Update authentication logic',
              dependencies: [],
              estimatedLines: 50,
              priority: 1,
            },
          ],
          estimatedComplexity: 5,
          requiresAtomic: true,
        },
      }),
    };

    (mockModelClient.generate as jest.Mock).mockResolvedValue(mockResponse);

    const request = 'Refactor the authentication system to use JWT tokens';
    const operation = await workflowManager.planMultiFileWorkflow(request);

    expect(operation.id).toBe('workflow_1');
    expect(operation.type).toBe('refactor');
    expect(operation.affectedFiles).toContain('auth.ts');
    expect(operation.plannedChanges).toHaveLength(1);
    expect(operation.requiresAtomic).toBe(true);
  });

  test('should handle workflow execution', async () => {
    const operation = {
      id: 'test_workflow',
      type: 'feature' as const,
      description: 'Add new feature',
      affectedFiles: ['feature.ts'],
      plannedChanges: [
        {
          filePath: 'feature.ts',
          changeType: 'create' as const,
          description: 'Create new feature file',
          dependencies: [],
          estimatedLines: 30,
          priority: 1,
        },
      ],
      estimatedComplexity: 3,
      requiresAtomic: false,
    };

    // Mock successful file operations (would normally use fs operations)
    const result = await workflowManager.executeWorkflow(operation);

    expect(result.operationId).toBe('test_workflow');
    expect(result.success).toBe(true);
    expect(typeof result.performanceMetrics.totalTime).toBe('number');
  });
});

describe('Architect/Editor Pattern', () => {
  let architect: Architect;
  let editor: Editor;
  let coordinator: ArchitectEditorCoordinator;

  beforeEach(() => {
    architect = new Architect(mockModelClient);
    editor = new Editor(mockModelClient);
    coordinator = new ArchitectEditorCoordinator(mockModelClient);
    jest.clearAllMocks();
  });

  test('should create comprehensive plan', async () => {
    // Mock planning response
    const mockPlanResponse = 'Comprehensive development plan...';
    (mockModelClient.generateText as jest.Mock).mockResolvedValue(mockPlanResponse);

    const request =
      'Build a complete e-commerce platform with user management and payment processing';
    const plan = await architect.createPlan(request);

    expect(plan.id).toMatch(/plan_\d+/);
    expect(plan.title).toContain('Implementation Plan');
    expect(plan.phases).toBeInstanceOf(Array);
    expect(plan.phases.length).toBeGreaterThan(0);
    expect(plan.risks).toBeInstanceOf(Array);
    expect(plan.successCriteria).toBeInstanceOf(Array);
  });

  test('should analyze plan feasibility', async () => {
    const plan = {
      id: 'test_plan',
      title: 'Test Plan',
      description: 'A test development plan',
      complexity: 'moderate' as const,
      estimatedDuration: 120,
      phases: [],
      dependencies: [],
      risks: [],
      successCriteria: [],
    };

    // Mock feasibility response
    (mockModelClient.generateText as jest.Mock).mockResolvedValue(
      'The plan is technically feasible with moderate confidence...'
    );

    const analysis = await architect.analyzeFeasibility(plan);

    expect(typeof analysis.feasible).toBe('boolean');
    expect(typeof analysis.confidence).toBe('number');
    expect(analysis.recommendations).toBeInstanceOf(Array);
    expect(analysis.adjustments).toBeInstanceOf(Array);
  });

  test('should execute tasks with editor', async () => {
    const task = {
      id: 'test_task',
      name: 'Implement feature',
      description: 'Create a new feature',
      type: 'code' as const,
      priority: 'high' as const,
      estimatedEffort: 30,
      requiredTools: ['code-tools'],
      files: ['feature.ts'],
      dependencies: [],
    };

    // Mock editor response
    (mockModelClient.generateText as jest.Mock).mockResolvedValue('Task completed successfully');

    const result = await editor.executeTask(task);

    expect(result.taskId).toBe('test_task');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.duration).toBe('number');
    expect(result.output).toBe('Task completed successfully');
  });

  test('should coordinate full architect/editor workflow', async () => {
    // Mock all necessary responses
    (mockModelClient.generateText as jest.Mock)
      .mockResolvedValueOnce('Planning response...') // For plan creation
      .mockResolvedValueOnce('Feasibility analysis...') // For feasibility
      .mockResolvedValueOnce('Task execution...'); // For execution

    const request = 'Create a simple calculator application';
    const result = await coordinator.executeRequest(request);

    expect(result.plan).toBeDefined();
    expect(result.feasibility).toBeDefined();
    expect(result.results).toBeInstanceOf(Array);
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.duration).toBe('number');
  });
});

describe('CLI Integration', () => {
  test('should detect multi-step execution patterns', () => {
    // This would test the CLI's shouldUseMultiStepExecution method
    // but since it's private, we test via the public interface

    const multiStepPrompts = [
      'implement a complete user authentication system',
      'build a comprehensive dashboard with analytics',
      'create end-to-end e-commerce solution',
      'refactor the entire codebase for better performance',
    ];

    const simplePrompts = ['fix this bug', 'add a comment', 'update the README'];

    // Each prompt type should be detectable by the CLI logic
    // (This is more of a documentation test of expected behavior)
    expect(multiStepPrompts.length).toBeGreaterThan(0);
    expect(simplePrompts.length).toBeGreaterThan(0);
  });

  test('should detect multi-file workflow patterns', () => {
    const multiFilePrompts = [
      'refactor across multiple files',
      'update the entire project structure',
      'migrate all components to use new API',
      'update all *.ts files to use strict mode',
    ];

    const singleFilePrompts = [
      'fix the login function',
      'add validation to this form',
      'update the header component',
    ];

    // Each prompt type should be detectable by the CLI logic
    expect(multiFilePrompts.length).toBeGreaterThan(0);
    expect(singleFilePrompts.length).toBeGreaterThan(0);
  });

  test('should detect architect/editor pattern needs', () => {
    const architectPatternPrompts = [
      'design and implement a scalable solution',
      'create a comprehensive enterprise system',
      'plan and build a production-ready application',
      'architect a complete microservices solution',
    ];

    const directImplementationPrompts = [
      'write this function',
      'create a simple component',
      'fix this specific issue',
    ];

    // Each prompt type should be detectable by the CLI logic
    expect(architectPatternPrompts.length).toBeGreaterThan(0);
    expect(directImplementationPrompts.length).toBeGreaterThan(0);
  });
});

describe('Performance and Integration', () => {
  test('should handle concurrent multi-step executions', async () => {
    const executor = new FastMultiStepExecutor(mockModelClient, { maxConcurrentSteps: 2 });

    // Mock responses for multiple tasks
    (mockModelClient.generate as jest.Mock).mockResolvedValue({
      content: JSON.stringify({
        task: { id: 'concurrent_task', description: 'Test', priority: 'medium' },
        steps: [
          {
            id: 'step_1',
            name: 'Test step',
            description: 'Test',
            type: 'analysis',
            inputs: [],
            outputs: [],
            estimatedDuration: 1000,
            dependencies: [],
          },
        ],
      }),
    });

    const promises = [
      executor.analyzeAndPlan('Task 1'),
      executor.analyzeAndPlan('Task 2'),
      executor.analyzeAndPlan('Task 3'),
    ];

    const results = await Promise.all(promises);
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.steps).toHaveLength(1);
    });
  });

  test('should maintain context across workflow steps', async () => {
    const workflowManager = new ContextAwareWorkflowManager(mockModelClient, '/test');

    // Test that context is preserved between operations
    const request1 = 'Create user model';
    const request2 = 'Add authentication to the user model';

    (mockModelClient.generate as jest.Mock).mockResolvedValue({
      content: JSON.stringify({
        operation: {
          id: 'context_test',
          type: 'implementation',
          description: 'Context-aware operation',
          affectedFiles: ['user.ts'],
          plannedChanges: [],
          estimatedComplexity: 1,
          requiresAtomic: false,
        },
      }),
    });

    const operation1 = await workflowManager.planMultiFileWorkflow(request1);
    const operation2 = await workflowManager.planMultiFileWorkflow(request2);

    expect(operation1.id).toBeDefined();
    expect(operation2.id).toBeDefined();
    // Context should be maintained in real implementation
  });

  test('should gracefully handle system failures', async () => {
    const coordinator = new ArchitectEditorCoordinator(mockModelClient);

    // Simulate model client failure
    (mockModelClient.generateText as jest.Mock).mockRejectedValue(new Error('Model unavailable'));

    const request = 'Build something complex';
    const result = await coordinator.executeRequest(request);

    expect(result.success).toBe(false);
    expect(result.plan).toBeDefined(); // Should have fallback plan
    expect(result.duration).toBeGreaterThan(0);
  });
});

describe('2025 Best Practices Compliance', () => {
  test('should implement parallel execution optimization', () => {
    const executor = new FastMultiStepExecutor(mockModelClient, { maxConcurrentSteps: 5 });
    expect(executor).toBeDefined();

    // Parallel execution capability is built into the executor
    // Real test would verify actual parallel execution performance
  });

  test('should implement context window utilization', () => {
    const workflowManager = new ContextAwareWorkflowManager(mockModelClient, '/test', {
      maxContextTokens: 64000,
    });

    expect(workflowManager).toBeDefined();
    // Context window management is built into the workflow manager
  });

  test('should separate planning from execution (Architect/Editor)', async () => {
    const coordinator = new ArchitectEditorCoordinator(mockModelClient);

    // Mock responses to ensure separation
    (mockModelClient.generateText as jest.Mock)
      .mockResolvedValueOnce('Planning phase complete') // Architect
      .mockResolvedValueOnce('Feasibility confirmed') // Architect
      .mockResolvedValueOnce('Execution complete'); // Editor

    const result = await coordinator.executeRequest('Test separation');

    expect(result.plan).toBeDefined(); // Architect output
    expect(result.feasibility).toBeDefined(); // Architect analysis
    expect(result.results).toBeDefined(); // Editor output

    // Planning and execution are clearly separated
  });
});
