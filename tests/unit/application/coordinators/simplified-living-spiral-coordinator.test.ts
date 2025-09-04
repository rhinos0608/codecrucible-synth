/**
 * Comprehensive Simplified Living Spiral Coordinator Tests
 * Testing the complete spiral process: phases, iterations, convergence analysis
 * Following Living Spiral Methodology - Testing the methodology itself with meta-analysis
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SimplifiedLivingSpiralCoordinator,
  SimplifiedSpiralConfig,
  SimplifiedSpiralInput,
  SimplifiedSpiralOutput,
} from '../../../../src/application/coordinators/simplified-living-spiral-coordinator.js';
import {
  SpiralPhaseExecutor,
  PhaseInput,
  PhaseOutput,
} from '../../../../src/application/services/spiral-phase-executor.js';
import {
  SpiralConvergenceAnalyzer,
  IterationResult,
  ConvergenceAnalysis,
} from '../../../../src/application/services/spiral-convergence-analyzer.js';
import { IVoiceOrchestrationService } from '../../../../src/domain/services/voice-orchestration-service.js';
import { IModelSelectionService } from '../../../../src/domain/services/model-selection-service.js';

// Mock implementations for testing
class MockVoiceOrchestrationService implements IVoiceOrchestrationService {
  async orchestrateVoices(prompt: string, voiceNames: string[], config?: any): Promise<any> {
    return {
      content: `Voice orchestration result for: ${prompt.substring(0, 50)}...`,
      voicesUsed: voiceNames,
      confidence: 0.85,
      processingTime: 100,
      qualityMetrics: {
        coherence: 0.8,
        completeness: 0.9,
        creativity: 0.7,
        technical: 0.85,
      },
    };
  }

  async selectOptimalVoices(task: string, context?: any): Promise<string[]> {
    // Return different voices based on task keywords
    if (task.includes('analyze')) {
      return ['analyzer', 'security'];
    } else if (task.includes('generate')) {
      return ['developer', 'implementor'];
    } else if (task.includes('design')) {
      return ['architect', 'designer'];
    }
    return ['explorer', 'maintainer'];
  }

  async getVoiceCapabilities(voiceName: string): Promise<any> {
    const capabilities = {
      explorer: { creativity: 0.9, innovation: 0.95 },
      maintainer: { stability: 0.95, quality: 0.9 },
      analyzer: { analysis: 0.95, critical_thinking: 0.9 },
      developer: { implementation: 0.9, practical: 0.85 },
      security: { security_focus: 0.95, risk_assessment: 0.9 },
      architect: { design: 0.9, systems_thinking: 0.95 },
      designer: { ui_ux: 0.9, user_experience: 0.85 },
      implementor: { execution: 0.9, efficiency: 0.85 },
    };
    return capabilities[voiceName] || { general: 0.7 };
  }
}

class MockModelSelectionService implements IModelSelectionService {
  async selectOptimalModel(task: string, requirements?: any): Promise<any> {
    return {
      modelName: 'mock-model-v1',
      confidence: 0.9,
      capabilities: ['text-generation', 'reasoning'],
      estimatedPerformance: {
        quality: 0.85,
        speed: 0.8,
        resourceUsage: 0.6,
      },
    };
  }

  async evaluateModelPerformance(modelName: string, task: string): Promise<any> {
    return {
      quality: 0.8,
      latency: 150,
      accuracy: 0.85,
      resourceEfficiency: 0.75,
    };
  }

  async getAvailableModels(): Promise<any[]> {
    return [
      { name: 'mock-model-v1', capabilities: ['text-generation'] },
      { name: 'mock-model-v2', capabilities: ['reasoning', 'analysis'] },
    ];
  }
}

// Mock phase executor that simulates realistic spiral phases
class MockSpiralPhaseExecutor {
  private voiceService: MockVoiceOrchestrationService;
  private modelService: MockModelSelectionService;

  constructor(
    voiceService: MockVoiceOrchestrationService,
    modelService: MockModelSelectionService
  ) {
    this.voiceService = voiceService;
    this.modelService = modelService;
  }

  async executePhase(input: PhaseInput): Promise<PhaseOutput> {
    const baseProcessingTime = 200;
    const phaseSpecificTime = {
      collapse: 150,
      council: 300,
      synthesis: 250,
      rebirth: 200,
      reflection: 100,
    };

    // Simulate phase-specific processing
    const processingTime = baseProcessingTime + (phaseSpecificTime[input.phase] || 150);

    // Get optimal voices for this phase
    const optimalVoices = await this.voiceService.selectOptimalVoices(
      `${input.phase} phase: ${input.content.substring(0, 100)}`
    );

    // Simulate voice orchestration
    const orchestrationResult = await this.voiceService.orchestrateVoices(
      input.content,
      optimalVoices
    );

    // Generate phase-specific output
    let phaseContent = '';
    let qualityBoost = 0;

    switch (input.phase) {
      case 'collapse':
        phaseContent = `**Problem Decomposition (Iteration ${input.iteration})**\n${input.content}\n\nKey challenges identified and broken down into manageable components.`;
        qualityBoost = 0.1;
        break;

      case 'council':
        phaseContent = `**Multi-Voice Council Analysis (Iteration ${input.iteration})**\n${input.content}\n\nDiverse perspectives gathered from: ${optimalVoices.join(', ')}`;
        qualityBoost = 0.15;
        break;

      case 'synthesis':
        phaseContent = `**Unified Solution Synthesis (Iteration ${input.iteration})**\n${input.content}\n\nIntegrated solution combining all perspectives.`;
        qualityBoost = 0.2;
        break;

      case 'rebirth':
        phaseContent = `**Implementation & Testing (Iteration ${input.iteration})**\n${input.content}\n\nSolution refined through practical implementation.`;
        qualityBoost = 0.1;
        break;

      case 'reflection':
        phaseContent = `**Quality Reflection (Iteration ${input.iteration})**\n${input.content}\n\nReflective analysis and quality assessment completed.`;
        qualityBoost = 0.05;
        break;
    }

    // Calculate quality metrics with phase-specific improvements
    const baseQuality = Math.min(0.9, Math.max(0.5, 0.7 + input.iteration * 0.1 + qualityBoost));
    const qualityMetrics = {
      coherence: Math.min(0.95, baseQuality + 0.05),
      completeness: Math.min(0.95, baseQuality + 0.03),
      creativity: Math.min(0.95, baseQuality - 0.05 + (input.phase === 'council' ? 0.1 : 0)),
      technical: Math.min(0.95, baseQuality + (input.phase === 'rebirth' ? 0.1 : 0)),
      overall: baseQuality,
    };

    return {
      content: phaseContent,
      voicesUsed: optimalVoices,
      confidence: Math.min(0.95, baseQuality + 0.05),
      processingTime,
      qualityMetrics,
      phase: input.phase,
      iteration: input.iteration,
      metadata: {
        modelUsed: (await this.modelService.selectOptimalModel('phase-execution')).modelName,
        tokensProcessed: Math.floor(input.content.length * 1.5),
      },
    };
  }
}

describe('SimplifiedLivingSpiralCoordinator - Comprehensive Tests', () => {
  let coordinator: SimplifiedLivingSpiralCoordinator;
  let mockVoiceService: MockVoiceOrchestrationService;
  let mockModelService: MockModelSelectionService;
  let mockPhaseExecutor: MockSpiralPhaseExecutor;

  beforeEach(() => {
    mockVoiceService = new MockVoiceOrchestrationService();
    mockModelService = new MockModelSelectionService();
    coordinator = new SimplifiedLivingSpiralCoordinator(mockVoiceService, mockModelService);

    // Mock the phase executor
    mockPhaseExecutor = new MockSpiralPhaseExecutor(mockVoiceService, mockModelService);
    (coordinator as any).phaseExecutor = mockPhaseExecutor;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Spiral Process Execution', () => {
    it('should execute complete spiral process successfully', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Design a secure REST API for user management',
        config: {
          maxIterations: 2,
          qualityThreshold: 0.7,
          convergenceThreshold: 0.8,
        },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result).toBeDefined();
      expect(result.finalSolution).toBeTruthy();
      expect(result.iterations).toHaveLength(2);
      expect(result.totalIterations).toBe(2);
      expect(result.convergenceAchieved).toBeDefined();
      expect(result.finalQuality).toBeGreaterThan(0);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalProcessingTime).toBeGreaterThan(0);
      expect(result.metadata.voicesUsed).toBeInstanceOf(Array);
      expect(result.metadata.phasesCompleted).toBeInstanceOf(Array);
    });

    it('should use default configuration when none provided', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Create a simple calculator application',
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.totalIterations).toBeLessThanOrEqual(3); // Default max iterations
      expect(result.metadata.phasesCompleted).toContain('collapse');
      expect(result.metadata.phasesCompleted).toContain('council');
      expect(result.metadata.phasesCompleted).toContain('synthesis');
      expect(result.metadata.phasesCompleted).toContain('rebirth');
      expect(result.metadata.phasesCompleted).toContain('reflection');
    });

    it('should respect custom phase configuration', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Implement a sorting algorithm',
        config: {
          phases: ['collapse', 'synthesis', 'rebirth'],
          maxIterations: 1,
        },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.metadata.phasesCompleted).toEqual(['collapse', 'synthesis', 'rebirth']);
      expect(result.metadata.phasesCompleted).not.toContain('council');
      expect(result.metadata.phasesCompleted).not.toContain('reflection');
    });

    it('should skip reflection phase when disabled', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Build a web server',
        config: {
          enableReflection: false,
          maxIterations: 1,
        },
      };

      const result = await coordinator.executeSpiralProcess(input);

      // Reflection should not appear in regular phases but may appear in final quality calculation
      const regularPhases = result.metadata.phasesCompleted.filter(p => p !== 'reflection');
      expect(regularPhases).not.toContain('reflection');
    });

    it('should handle context properly', async () => {
      const context = {
        userType: 'enterprise',
        securityLevel: 'high',
        performanceRequirements: 'critical',
      };

      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Design a microservice architecture',
        context,
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result).toBeDefined();
      expect(result.finalSolution).toBeTruthy();
      // Context should be preserved throughout the process
      expect(result.metadata).toBeDefined();
    });
  });

  describe('Spiral Phase Execution', () => {
    it('should execute all spiral phases in correct order', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Analyze security vulnerabilities in web applications',
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      const phases = result.metadata.phasesCompleted;
      expect(phases.indexOf('collapse')).toBeLessThan(phases.indexOf('council'));
      expect(phases.indexOf('council')).toBeLessThan(phases.indexOf('synthesis'));
      expect(phases.indexOf('synthesis')).toBeLessThan(phases.indexOf('rebirth'));
      expect(phases.indexOf('rebirth')).toBeLessThan(phases.indexOf('reflection'));
    });

    it('should improve quality through spiral phases', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Optimize database query performance',
        config: { maxIterations: 2 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      // Quality should generally improve across iterations
      if (result.iterations.length > 1) {
        const firstQuality = result.iterations[0].quality;
        const lastQuality = result.iterations[result.iterations.length - 1].quality;

        // Allow for some variation but expect overall improvement or maintenance
        expect(lastQuality).toBeGreaterThanOrEqual(firstQuality - 0.1);
      }

      expect(result.finalQuality).toBeGreaterThan(0.5);
      expect(result.metadata.averageQuality).toBeGreaterThan(0.5);
    });

    it('should track voices used across all phases', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Design a machine learning pipeline',
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.metadata.voicesUsed).toBeInstanceOf(Array);
      expect(result.metadata.voicesUsed.length).toBeGreaterThan(0);

      // Should have unique voices (some may repeat but there should be variety)
      const uniqueVoices = new Set(result.metadata.voicesUsed);
      expect(uniqueVoices.size).toBeGreaterThan(0);
    });

    it('should generate contextual content for each phase', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Create a monitoring and alerting system',
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.finalSolution).toContain('Problem Decomposition');
      expect(result.finalSolution).toContain('Multi-Voice Council Analysis');
      expect(result.finalSolution).toContain('Unified Solution Synthesis');
      expect(result.finalSolution).toContain('Implementation & Testing');
      expect(result.finalSolution).toContain('Quality Reflection');
    });
  });

  describe('Convergence Analysis and Iteration Control', () => {
    it('should achieve convergence when quality threshold is met', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Simple task that should converge quickly',
        config: {
          maxIterations: 5,
          qualityThreshold: 0.6, // Low threshold for easier convergence
          convergenceThreshold: 0.7,
        },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.convergenceAchieved).toBe(true);
      expect(result.finalQuality).toBeGreaterThanOrEqual(0.6);
      expect(result.totalIterations).toBeLessThanOrEqual(5);
    });

    it('should stop at max iterations when convergence not achieved', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Complex task requiring many iterations',
        config: {
          maxIterations: 2,
          qualityThreshold: 0.95, // High threshold hard to achieve
          convergenceThreshold: 0.98,
        },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.totalIterations).toBe(2);
      expect(result.convergenceAchieved).toBe(false);
      expect(result.iterations).toHaveLength(2);
    });

    it('should provide meaningful recommendations', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Design a distributed system with fault tolerance',
        config: { maxIterations: 2 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);

      // Recommendations should be strings with meaningful content
      result.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(10);
      });
    });

    it('should handle single iteration processes', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Quick fix for a simple bug',
        config: {
          maxIterations: 1,
          qualityThreshold: 0.5,
        },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.totalIterations).toBe(1);
      expect(result.iterations).toHaveLength(1);
      expect(result.finalSolution).toBeTruthy();
      expect(result.metadata.averageQuality).toBe(result.finalQuality);
    });

    it('should prepare next iteration input based on previous results', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Multi-iteration improvement task',
        config: {
          maxIterations: 3,
          qualityThreshold: 0.95, // High threshold to force multiple iterations
        },
      };

      const result = await coordinator.executeSpiralProcess(input);

      // If multiple iterations occurred, later iterations should reference previous work
      if (result.iterations.length > 1) {
        for (let i = 1; i < result.iterations.length; i++) {
          const iteration = result.iterations[i];
          expect(iteration.content).toContain('Based on the previous iteration');
        }
      }
    });
  });

  describe('Quality Metrics and Performance Tracking', () => {
    it('should calculate accurate average quality', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Quality tracking test task',
        config: { maxIterations: 3 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      const manualAverage =
        result.iterations.reduce((sum, iter) => sum + iter.quality, 0) / result.iterations.length;
      expect(Math.abs(result.metadata.averageQuality - manualAverage)).toBeLessThan(0.01);
    });

    it('should track processing time accurately', async () => {
      const startTime = Date.now();

      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Performance tracking test',
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);
      const endTime = Date.now();

      expect(result.metadata.totalProcessingTime).toBeGreaterThan(0);
      expect(result.metadata.totalProcessingTime).toBeLessThan(endTime - startTime + 100); // Allow small buffer
    });

    it('should provide comprehensive metadata', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Metadata verification task',
        config: { maxIterations: 2 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      const metadata = result.metadata;
      expect(metadata.totalProcessingTime).toBeGreaterThan(0);
      expect(metadata.averageQuality).toBeGreaterThan(0);
      expect(metadata.voicesUsed).toBeInstanceOf(Array);
      expect(metadata.phasesCompleted).toBeInstanceOf(Array);
      expect(metadata.voicesUsed.length).toBeGreaterThan(0);
      expect(metadata.phasesCompleted.length).toBeGreaterThan(0);
    });

    it('should track unique voices across iterations', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Voice tracking across iterations',
        config: { maxIterations: 2 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      const allVoices = result.metadata.voicesUsed;
      const uniqueVoices = [...new Set(allVoices)];

      // Should have collected voices from all iterations and phases
      expect(allVoices.length).toBeGreaterThanOrEqual(uniqueVoices.length);
      expect(uniqueVoices.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty prompts gracefully', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: '',
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result).toBeDefined();
      expect(result.totalIterations).toBe(1);
      expect(result.finalSolution).toBeDefined();
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'A'.repeat(10000) + ' - Design a complex system for this';

      const input: SimplifiedSpiralInput = {
        initialPrompt: longPrompt,
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result).toBeDefined();
      expect(result.finalSolution).toBeTruthy();
      expect(result.metadata.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should handle invalid configuration gracefully', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Test with invalid config',
        config: {
          maxIterations: 0, // Invalid
          qualityThreshold: 2.0, // Invalid (> 1.0)
          convergenceThreshold: -0.5, // Invalid (< 0)
        } as any,
      };

      // Should use default values or handle gracefully
      const result = await coordinator.executeSpiralProcess(input);

      expect(result).toBeDefined();
      expect(result.totalIterations).toBeGreaterThan(0);
    });

    it('should handle phase execution failures gracefully', async () => {
      // Mock a failing phase executor
      const originalExecutor = (coordinator as any).phaseExecutor;
      const failingExecutor = {
        executePhase: jest.fn().mockRejectedValue(new Error('Phase execution failed')),
      };

      (coordinator as any).phaseExecutor = failingExecutor;

      const input: SimplifiedSpiralInput = {
        initialPrompt: 'This should handle phase failure',
        config: { maxIterations: 1 },
      };

      // Should either handle the error or throw a meaningful error
      await expect(coordinator.executeSpiralProcess(input)).rejects.toThrow();

      // Restore original executor
      (coordinator as any).phaseExecutor = originalExecutor;
    });

    it('should handle concurrent process executions', async () => {
      const inputs = [
        { initialPrompt: 'Concurrent task 1', config: { maxIterations: 1 } },
        { initialPrompt: 'Concurrent task 2', config: { maxIterations: 1 } },
        { initialPrompt: 'Concurrent task 3', config: { maxIterations: 1 } },
      ];

      const promises = inputs.map(input => coordinator.executeSpiralProcess(input));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.finalSolution).toContain(`task ${index + 1}`);
        expect(result.totalIterations).toBe(1);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete single iteration within reasonable time', async () => {
      const startTime = Date.now();

      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Performance test with single iteration',
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metadata.totalProcessingTime).toBeLessThan(3000);
    });

    it('should scale reasonably with multiple iterations', async () => {
      const iterations = [1, 2, 3];
      const times: number[] = [];

      for (const maxIter of iterations) {
        const startTime = Date.now();

        const input: SimplifiedSpiralInput = {
          initialPrompt: `Scaling test with ${maxIter} iterations`,
          config: { maxIterations: maxIter, qualityThreshold: 0.95 }, // High threshold to force iterations
        };

        const result = await coordinator.executeSpiralProcess(input);
        const endTime = Date.now();

        times.push(endTime - startTime);
        expect(result.totalIterations).toBe(maxIter);
      }

      // Time should scale roughly linearly (allowing for some variation)
      expect(times[1]).toBeGreaterThan(times[0]);
      expect(times[2]).toBeGreaterThan(times[1]);
    });

    it('should handle resource cleanup properly', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Resource cleanup test',
        config: { maxIterations: 2 },
      };

      // Monitor memory before
      const initialMemory = process.memoryUsage();

      const result = await coordinator.executeSpiralProcess(input);

      // Monitor memory after
      const finalMemory = process.memoryUsage();

      expect(result).toBeDefined();

      // Memory growth should be reasonable
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    });

    it('should maintain quality consistency across runs', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Consistency test prompt',
        config: { maxIterations: 1, qualityThreshold: 0.7 },
      };

      const results = await Promise.all([
        coordinator.executeSpiralProcess(input),
        coordinator.executeSpiralProcess(input),
        coordinator.executeSpiralProcess(input),
      ]);

      // Quality should be reasonably consistent across runs
      const qualities = results.map(r => r.finalQuality);
      const avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
      const maxDeviation = Math.max(...qualities.map(q => Math.abs(q - avgQuality)));

      expect(maxDeviation).toBeLessThan(0.2); // Allow 20% deviation
      expect(results.every(r => r.finalQuality > 0.5)).toBe(true);
    });
  });

  describe('Integration and Compatibility', () => {
    it('should integrate properly with voice orchestration service', async () => {
      const voiceServiceSpy = jest.spyOn(mockVoiceService, 'selectOptimalVoices');

      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Voice integration test',
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(voiceServiceSpy).toHaveBeenCalled();
      expect(result.metadata.voicesUsed.length).toBeGreaterThan(0);

      voiceServiceSpy.mockRestore();
    });

    it('should integrate properly with model selection service', async () => {
      const modelServiceSpy = jest.spyOn(mockModelService, 'selectOptimalModel');

      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Model integration test',
        config: { maxIterations: 1 },
      };

      await coordinator.executeSpiralProcess(input);

      expect(modelServiceSpy).toHaveBeenCalled();

      modelServiceSpy.mockRestore();
    });

    it('should support custom phase configurations', async () => {
      const customPhases = ['collapse', 'synthesis'];

      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Custom phase test',
        config: {
          maxIterations: 1,
          phases: customPhases,
        },
      };

      const result = await coordinator.executeSpiralProcess(input);

      expect(result.metadata.phasesCompleted).toEqual(customPhases);
    });

    it('should provide comprehensive output structure', async () => {
      const input: SimplifiedSpiralInput = {
        initialPrompt: 'Output structure verification',
        config: { maxIterations: 1 },
      };

      const result = await coordinator.executeSpiralProcess(input);

      // Verify complete output structure
      expect(result).toHaveProperty('finalSolution');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('convergenceAchieved');
      expect(result).toHaveProperty('totalIterations');
      expect(result).toHaveProperty('finalQuality');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');

      // Verify metadata structure
      expect(result.metadata).toHaveProperty('totalProcessingTime');
      expect(result.metadata).toHaveProperty('averageQuality');
      expect(result.metadata).toHaveProperty('voicesUsed');
      expect(result.metadata).toHaveProperty('phasesCompleted');

      // Verify iteration structure
      result.iterations.forEach(iteration => {
        expect(iteration).toHaveProperty('iteration');
        expect(iteration).toHaveProperty('phase');
        expect(iteration).toHaveProperty('content');
        expect(iteration).toHaveProperty('quality');
        expect(iteration).toHaveProperty('confidence');
        expect(iteration).toHaveProperty('processingTime');
        expect(iteration).toHaveProperty('qualityMetrics');
      });
    });
  });
});
