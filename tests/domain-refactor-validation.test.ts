/**
 * Domain Refactoring Validation Test
 * Tests to ensure the new domain layer works correctly
 */

import {
  ExecutionPlan,
  Goal,
  Domain,
  StepEstimate,
  SelectedTools,
  ReasoningStep,
  ReasoningStepType,
  ConfidenceScore,
  ToolArguments,
  WorkflowTemplate,
  ToolExecution,
  ToolName,
  ExecutionOrchestrationService,
  ModelRoutingService,
  RoutingRequest,
  TaskComplexity,
  RoutingPriority,
  ModelSelectionCriteria,
  RequestContext
} from '../src/domain/index.js';

describe('Domain Layer Refactoring Validation', () => {
  describe('Domain Entities', () => {
    test('ExecutionPlan can be created and validated', () => {
      const goal = Goal.create('Analyze project structure');
      const domain = Domain.coding();
      const stepEstimate = StepEstimate.create(5);
      const selectedTools = SelectedTools.create(['filesystem_read', 'git_status']);
      const confidence = ConfidenceScore.high();
      
      const plan = new ExecutionPlan(
        goal,
        domain,
        stepEstimate,
        selectedTools,
        'Test reasoning for plan',
        confidence
      );
      
      expect(plan.isViable()).toBe(true);
      expect(plan.calculateRisk()).toBe('low');
      expect(plan.goal.description).toBe('Analyze project structure');
      expect(plan.selectedTools.count).toBe(2);
    });

    test('ReasoningStep can be created with different types', () => {
      const thoughtStep = ReasoningStep.createThoughtStep(
        1,
        'Starting analysis',
        ConfidenceScore.medium()
      );
      
      expect(thoughtStep.isReasoningStep()).toBe(true);
      expect(thoughtStep.isToolStep()).toBe(false);
      expect(thoughtStep.stepNumber).toBe(1);
      
      const actionStep = ReasoningStep.createActionStep(
        2,
        'Reading file',
        'filesystem_read',
        ToolArguments.create({ path: '/test/file.ts' }),
        ConfidenceScore.high()
      );
      
      expect(actionStep.isToolStep()).toBe(true);
      expect(actionStep.isReasoningStep()).toBe(false);
      expect(actionStep.toolName).toBe('filesystem_read');
    });

    test('WorkflowTemplate can be created and used', () => {
      const projectAnalysisTemplate = WorkflowTemplate.createProjectAnalysisTemplate();
      
      expect(projectAnalysisTemplate.name).toBe('project_analysis');
      expect(projectAnalysisTemplate.domain.isCodingDomain()).toBe(true);
      expect(projectAnalysisTemplate.steps.length).toBeGreaterThan(0);
      
      expect(projectAnalysisTemplate.matches('analyze project structure')).toBe(true);
      expect(projectAnalysisTemplate.matches('make coffee')).toBe(false);
      
      const matchScore = projectAnalysisTemplate.calculateMatchScore('analyze project architecture');
      expect(matchScore).toBeGreaterThan(0);
    });

    test('ToolExecution can track execution lifecycle', () => {
      const execution = ToolExecution.createPending('filesystem_read', { path: '/test' });
      
      expect(execution.status.isPending()).toBe(true);
      expect(execution.toolName.value).toBe('filesystem_read');
      
      const runningExecution = execution.start();
      expect(runningExecution.status.isRunning()).toBe(true);
      
      const completedExecution = runningExecution.completeSuccess({ content: 'file content' });
      expect(completedExecution.status.isSuccessful()).toBe(true);
      expect(completedExecution.isSuccessfulWithMeaningfulOutput()).toBe(true);
    });
  });

  describe('Domain Services', () => {
    test('ExecutionOrchestrationService can create execution plans', () => {
      const orchestrationService = new ExecutionOrchestrationService();
      
      const plan = orchestrationService.createExecutionPlan(
        'Analyze the codebase structure and find TypeScript files',
        ['filesystem_list_directory', 'filesystem_read_file', 'git_status']
      );
      
      expect(plan).toBeDefined();
      expect(plan.goal.description).toBe('Analyze the codebase structure and find TypeScript files');
      expect(plan.domain.isCodingDomain()).toBe(true);
      expect(plan.selectedTools.count).toBeGreaterThan(0);
      expect(plan.isViable()).toBe(true);
    });

    test('ModelRoutingService can route requests', () => {
      const routingService = new ModelRoutingService();
      
      const request = RoutingRequest.create(
        'req_123',
        'Generate TypeScript code for user authentication',
        TaskComplexity.complex(),
        RoutingPriority.high(),
        ModelSelectionCriteria.forCoding(),
        RequestContext.default()
      );
      
      // Mock available models for testing
      const mockModels = [
        {
          name: { value: 'test-model' },
          isAvailable: () => true,
          calculateSuitabilityScore: () => 0.8,
          parameters: { qualityRating: 0.9, estimatedLatency: 2000 }
        } as any
      ];
      
      const decision = routingService.routeRequest(request, mockModels);
      
      expect(decision).toBeDefined();
      expect(decision.requestId).toBe('req_123');
      expect(decision.taskComplexity.isComplex()).toBe(true);
      expect(decision.selectedModelId).toBe('test-model');
    });
  });

  describe('Value Objects', () => {
    test('ConfidenceScore has proper business rules', () => {
      const highConfidence = ConfidenceScore.high();
      const mediumConfidence = ConfidenceScore.medium();
      const lowConfidence = ConfidenceScore.low();
      
      expect(highConfidence.isHigh()).toBe(true);
      expect(mediumConfidence.isMedium()).toBe(true);
      expect(lowConfidence.isLow()).toBe(true);
      
      expect(highConfidence.value).toBeGreaterThan(mediumConfidence.value);
      expect(mediumConfidence.value).toBeGreaterThan(lowConfidence.value);
    });

    test('TaskComplexity can be inferred from descriptions', () => {
      const simpleTask = TaskComplexity.fromTaskDescription('list files in directory');
      const complexTask = TaskComplexity.fromTaskDescription('analyze codebase structure');
      const advancedTask = TaskComplexity.fromTaskDescription('implement authentication system');
      
      expect(simpleTask.isSimple()).toBe(true);
      expect(complexTask.isComplex()).toBe(true);
      expect(advancedTask.isAdvanced()).toBe(true);
      
      expect(advancedTask.requiresHighCapabilityModel()).toBe(true);
      expect(simpleTask.canUseSimpleModel()).toBe(true);
    });
  });

  describe('Domain Layer Purity', () => {
    test('Domain entities have no infrastructure dependencies', () => {
      // This test ensures our domain layer is pure by checking that
      // domain entities can be instantiated without any infrastructure
      const goal = Goal.create('Test goal');
      const domain = Domain.general();
      const tools = SelectedTools.create(['tool1', 'tool2']);
      const estimate = StepEstimate.create(3);
      const confidence = ConfidenceScore.medium();
      
      const plan = new ExecutionPlan(
        goal,
        domain,
        estimate,
        tools,
        'Test reasoning',
        confidence
      );
      
      // If this test passes, it means we successfully created domain objects
      // without requiring any infrastructure dependencies
      expect(plan).toBeDefined();
      expect(plan.isViable()).toBe(true);
    });

    test('Domain services work with pure domain logic', () => {
      const orchestrationService = new ExecutionOrchestrationService();
      
      // This should work without any infrastructure dependencies
      const plan = orchestrationService.createExecutionPlan(
        'Test task',
        ['test-tool'],
        undefined
      );
      
      expect(plan).toBeDefined();
      expect(plan.goal.description).toBe('Test task');
      
      // Business rules should work
      expect(plan.estimateTotalExecutionTime()).toBeGreaterThan(0);
      expect(plan.calculateRisk()).toMatch(/^(low|medium|high)$/);
    });
  });

  describe('Error Handling', () => {
    test('Domain validation throws proper errors', () => {
      // Empty goal should throw validation error
      expect(() => Goal.create('')).toThrow('Goal description cannot be empty');
      
      // Invalid confidence score should throw
      expect(() => ConfidenceScore.create(1.5)).toThrow('Confidence score must be between 0 and 1');
      
      // Empty tool name should throw
      expect(() => ToolName.create('')).toThrow('Tool name cannot be empty');
    });

    test('Business rule violations are caught', () => {
      // StepEstimate validation
      expect(() => StepEstimate.create(25)).toThrow('Estimated steps cannot exceed 20 (task too complex)');
      expect(() => StepEstimate.create(0)).toThrow('Estimated steps must be at least 1');
      
      // ExecutionPlan with valid inputs should work
      const goal = Goal.create('Test');
      const domain = Domain.general();
      const estimate = StepEstimate.create(5);
      const tools = SelectedTools.create(['test-tool']);
      const confidence = ConfidenceScore.medium();
      
      const plan = new ExecutionPlan(goal, domain, estimate, tools, 'Test', confidence);
      expect(plan).toBeDefined();
    });
  });
});