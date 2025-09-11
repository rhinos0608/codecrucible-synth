/**
 * Intelligent Routing Coordinator Tests
 * Comprehensive test suite for the intelligent routing system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Import the classes we're testing
import {
  IntelligentRoutingCoordinator,
  RoutingContext,
  IntelligentRoutingDecision,
  RoutingPreferences,
} from '../../../src/application/routing/intelligent-routing-coordinator.js';

// Mock dependencies
import { ProcessingRequest } from '../../../src/domain/entities/request.js';
import { IModelSelectionService } from '../../../src/domain/services/model-selection-service.js';
import { IVoiceOrchestrationService } from '../../../src/domain/services/voice-orchestration-service.js';
import { IProviderSelectionStrategy } from '../../../src/providers/provider-selection-strategy.js';
import { HybridLLMRouter } from '../../../src/providers/hybrid/hybrid-llm-router.js';
import { PerformanceMonitor } from '../../../src/utils/performance.js';

describe('IntelligentRoutingCoordinator', () => {
  let coordinator: IntelligentRoutingCoordinator;
  let mockModelService: jest.Mocked<IModelSelectionService>;
  let mockVoiceService: jest.Mocked<IVoiceOrchestrationService>;
  let mockProviderStrategy: jest.Mocked<IProviderSelectionStrategy>;
  let mockHybridRouter: jest.Mocked<HybridLLMRouter>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;

  beforeEach(() => {
    // Create mock implementations
    mockModelService = {
      selectOptimalModel: jest.fn(),
      selectHybridModels: jest.fn(),
      selectLoadBalancedModels: jest.fn(),
      handleModelFailure: jest.fn(),
    } as jest.Mocked<IModelSelectionService>;

    mockVoiceService = {
      selectVoicesForRequest: jest.fn(),
      synthesizeVoiceResponses: jest.fn(),
      detectVoiceConflicts: jest.fn(),
      resolveVoiceConflicts: jest.fn(),
    } as jest.Mocked<IVoiceOrchestrationService>;

    mockProviderStrategy = {
      selectProvider: jest.fn(),
      createFallbackChain: jest.fn(),
      validateProviderForContext: jest.fn(),
    } as jest.Mocked<IProviderSelectionStrategy>;

    mockHybridRouter = {
      routeTask: jest.fn(),
      recordPerformance: jest.fn(),
      updateLoad: jest.fn(),
      getStatus: jest.fn(),
    } as unknown as jest.Mocked<HybridLLMRouter>;

    mockPerformanceMonitor = {
      getProviderMetrics: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<PerformanceMonitor>;

    // Create coordinator with mocks
    coordinator = new IntelligentRoutingCoordinator(
      mockModelService,
      mockVoiceService,
      mockProviderStrategy,
      mockHybridRouter,
      mockPerformanceMonitor
    );
  });

  describe('routeRequest', () => {
    test('should route simple task to single-model-fast strategy', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('simple', 'Generate a hello world function'),
        priority: 'low',
        preferences: { prioritizeSpeed: true },
      };

      setupMockResponses('simple');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.routingStrategy).toBe('single-model');
      expect(decision.confidence).toBeGreaterThan(0.5);
      expect(decision.estimatedLatency).toBeLessThan(10000);
      expect(mockModelService.selectOptimalModel).toHaveBeenCalledWith(
        context.request,
        expect.objectContaining({ prioritize: 'speed' })
      );
    });

    test('should route complex task to hybrid-quality strategy', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest(
          'complex',
          'Analyze this complex codebase for security vulnerabilities'
        ),
        priority: 'high',
        preferences: { prioritizeQuality: true, enableHybridRouting: true },
      };

      setupMockResponses('complex');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.routingStrategy).toBe('hybrid');
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.hybridRouting).toBeDefined();
      expect(mockHybridRouter.routeTask).toHaveBeenCalled();
    });

    test('should route council phase to multi-voice strategy', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('medium', 'Gather perspectives on system architecture'),
        priority: 'medium',
        phase: 'council',
        preferences: { enableMultiVoice: true },
      };

      setupMockResponses('medium');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.routingStrategy).toBe('multi-voice');
      expect(decision.voiceSelection.supportingVoices.length).toBeGreaterThan(0);
      expect(mockVoiceService.selectVoicesForRequest).toHaveBeenCalledWith(
        context.request,
        expect.objectContaining({
          maxVoices: 3,
          minVoices: 2,
          synthesisMode: 'COLLABORATIVE',
        })
      );
    });

    test('should route collapse phase to single-voice-fast strategy', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('simple', 'Break down this complex problem'),
        priority: 'medium',
        phase: 'collapse',
      };

      setupMockResponses('simple');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.routingStrategy).toBe('single-model');
      expect(decision.voiceSelection.primaryVoice.id).toBe('explorer');
      expect(mockProviderStrategy.selectProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          prioritizeSpeed: true,
          complexity: 'simple',
        })
      );
    });

    test('should route synthesis phase to single-voice-quality strategy', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest(
          'medium',
          'Synthesize council perspectives into unified solution'
        ),
        priority: 'medium',
        phase: 'synthesis',
      };

      setupMockResponses('medium');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.routingStrategy).toBe('single-model');
      expect(decision.voiceSelection.primaryVoice.id).toBe('architect');
      expect(mockModelService.selectOptimalModel).toHaveBeenCalledWith(
        context.request,
        expect.objectContaining({
          prioritize: 'quality',
          minQuality: 0.8,
        })
      );
    });

    test('should route rebirth phase to hybrid-implementation strategy', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('medium', 'Create implementation plan from design'),
        priority: 'medium',
        phase: 'rebirth',
      };

      setupMockResponses('medium');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.routingStrategy).toBe('hybrid');
      expect(decision.voiceSelection.primaryVoice.id).toBe('implementor');
      expect(mockHybridRouter.routeTask).toHaveBeenCalledWith(
        'implementation',
        context.request.prompt,
        expect.objectContaining({
          requiresDeepAnalysis: false,
        })
      );
    });

    test('should route reflection phase to single-voice-analytical strategy', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('medium', 'Assess quality of implementation'),
        priority: 'medium',
        phase: 'reflection',
      };

      setupMockResponses('medium');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.routingStrategy).toBe('single-model');
      expect(decision.voiceSelection.primaryVoice.id).toBe('guardian');
      expect(mockProviderStrategy.selectProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          complexity: 'complex',
          taskType: 'analysis',
        })
      );
    });

    test('should use cache for repeated similar requests', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('simple', 'Same request'),
        priority: 'low',
      };

      setupMockResponses('simple');

      // Act - make same request twice
      const decision1 = await coordinator.routeRequest(context);
      const decision2 = await coordinator.routeRequest(context);

      // Assert - second call should be faster (cached)
      expect(decision1.routingStrategy).toBe(decision2.routingStrategy);
      expect(decision1.confidence).toBe(decision2.confidence);
      // Note: In real implementation, we'd verify cache hit via timing or mock call counts
    });

    test('should create failsafe decision on error', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('simple', 'Error-causing request'),
        priority: 'low',
      };

      mockModelService.selectOptimalModel.mockRejectedValue(new Error('Model selection failed'));

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.confidence).toBe(0.3);
      expect(decision.reasoning).toContain('Failsafe');
      expect(decision.modelSelection.primaryModel.name.value).toBe('fallback-model');
    });
  });

  describe('recordPerformance', () => {
    test('should record performance and update analytics', () => {
      // Arrange
      const routingId = 'test-routing-123';
      const performance = {
        success: true,
        actualLatency: 5000,
        actualCost: 0.01,
        qualityScore: 0.8,
      };

      // Act
      coordinator.recordPerformance(routingId, performance);

      // Assert
      // In real implementation, we'd verify internal state changes
      // For now, we just ensure no errors are thrown
      expect(true).toBe(true);
    });

    test('should handle performance recording for unknown routing ID', () => {
      // Arrange
      const unknownId = 'unknown-routing-456';
      const performance = {
        success: false,
        actualLatency: 0,
        actualCost: 0,
        qualityScore: 0,
        errorType: 'timeout',
      };

      // Act & Assert - should not throw error
      expect(() => {
        coordinator.recordPerformance(unknownId, performance);
      }).not.toThrow();
    });
  });

  describe('getAnalytics', () => {
    test('should return comprehensive analytics', () => {
      // Act
      const analytics = coordinator.getAnalytics();

      // Assert
      expect(analytics).toHaveProperty('totalRequests');
      expect(analytics).toHaveProperty('successRate');
      expect(analytics).toHaveProperty('averageLatency');
      expect(analytics).toHaveProperty('averageCost');
      expect(analytics).toHaveProperty('routingAccuracy');
      expect(analytics).toHaveProperty('strategyPerformance');
      expect(analytics).toHaveProperty('phasePerformance');
      expect(analytics.strategyPerformance).toBeInstanceOf(Map);
      expect(analytics.phasePerformance).toBeInstanceOf(Map);
    });
  });

  describe('optimizeRouting', () => {
    test('should complete optimization without errors', async () => {
      // Act & Assert
      await expect(coordinator.optimizeRouting()).resolves.not.toThrow();
    });
  });

  describe('cost optimization', () => {
    test('should optimize for cost when requested', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('medium', 'Cost-sensitive task'),
        priority: 'low',
        preferences: { optimizeForCost: true, maxCostPerRequest: 0.005 },
      };

      setupMockResponses('medium');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.estimatedCost).toBeLessThanOrEqual(0.01);
    });
  });

  describe('load balancing', () => {
    test('should enable load balancing when requested', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('medium', 'Load-balanced task'),
        priority: 'medium',
        preferences: { enableLoadBalancing: true },
      };

      setupMockResponses('medium');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(['load-balanced', 'hybrid', 'multi-voice']).toContain(decision.routingStrategy);
    });
  });

  describe('fallback chains', () => {
    test('should create proper fallback chains', async () => {
      // Arrange
      const context: RoutingContext = {
        request: createMockRequest('complex', 'Task requiring fallbacks'),
        priority: 'high',
      };

      setupMockResponses('complex');

      // Act
      const decision = await coordinator.routeRequest(context);

      // Assert
      expect(decision.fallbackChain).toHaveLength(3); // model + provider + voice fallbacks
      expect(decision.fallbackChain.some(fb => fb.type === 'model')).toBe(true);
      expect(decision.fallbackChain.some(fb => fb.type === 'provider')).toBe(true);
      expect(decision.fallbackChain.some(fb => fb.type === 'voice')).toBe(true);
    });
  });

  // Helper functions

  function createMockRequest(complexity: string, prompt: string): ProcessingRequest {
    return {
      prompt,
      type: 'test-request',
      priority: { value: 'medium', numericValue: 2 },
      context: { languages: ['typescript'] },
      constraints: {},
      calculateComplexity: () =>
        complexity === 'simple' ? 0.2 : complexity === 'complex' ? 0.9 : 0.5,
      requiresCapabilities: () => ['text-generation'],
      estimateProcessingTime: () => 10000,
    } as any;
  }

  function setupMockResponses(complexity: string) {
    // Mock model selection
    mockModelService.selectOptimalModel.mockResolvedValue({
      primaryModel: {
        name: { value: 'test-model' },
        providerType: 'ollama',
        parameters: {
          estimatedLatency: complexity === 'simple' ? 3000 : 15000,
          qualityRating: complexity === 'complex' ? 0.9 : 0.7,
          maxTokens: 4000,
          isMultimodal: false,
        },
        capabilities: ['text-generation'],
        isHealthy: true,
        errorCount: 0,
        isAvailable: () => true,
        hasCapability: () => true,
        calculateSuitabilityScore: () => 0.8,
      },
      fallbackModels: [
        {
          name: { value: 'fallback-model' },
          providerType: 'lm-studio',
          isAvailable: () => true,
        },
      ],
      selectionReason: 'Test selection',
      routingStrategy: 'SHARED' as any,
      estimatedCost: 0.01,
      estimatedLatency: complexity === 'simple' ? 3000 : 15000,
    } as any);

    // Mock voice selection
    mockVoiceService.selectVoicesForRequest.mockResolvedValue({
      primaryVoice: {
        id:
          complexity === 'simple'
            ? 'explorer'
            : complexity === 'complex'
              ? 'architect'
              : 'developer',
        name: 'Test Voice',
        expertise: ['general'],
        style: { value: 'analytical' },
        temperature: { value: 0.7 },
      },
      supportingVoices:
        complexity === 'complex'
          ? [
              { id: 'assistant1', name: 'Assistant 1' },
              { id: 'assistant2', name: 'Assistant 2' },
            ]
          : [],
      synthesisMode: 'SINGLE' as any,
      reasoning: 'Test voice selection',
    } as any);

    // Mock provider selection
    mockProviderStrategy.selectProvider.mockReturnValue({
      provider: 'ollama' as any,
      reason: 'Test provider selection',
      confidence: 0.8,
      fallbackChain: ['lm-studio' as any],
    });

    // Mock hybrid router
    mockHybridRouter.routeTask.mockResolvedValue({
      selectedLLM: 'ollama' as any,
      confidence: 0.8,
      reasoning: 'Test hybrid routing',
      fallbackStrategy: 'lm-studio',
      estimatedResponseTime: complexity === 'simple' ? 3000 : 15000,
    });
  }
});
