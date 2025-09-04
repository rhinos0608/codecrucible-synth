import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  AdvancedSynthesisEngine,
  SynthesisMode,
  WeightingStrategy,
  ConflictResolutionStrategy,
} from '../../src/core/advanced-synthesis-engine';
import { ResponseFactory, AgentResponse } from '../../src/core/response-types';

/**
 * Test suite for Advanced Synthesis Engine
 */
describe('Advanced Synthesis Engine', () => {
  let engine: AdvancedSynthesisEngine;
  let mockModelClient: any;
  let sampleResponses: AgentResponse[];

  beforeEach(() => {
    mockModelClient = {
      generateVoiceResponse: jest.fn(),
    };

    engine = new AdvancedSynthesisEngine(mockModelClient);

    sampleResponses = [
      ResponseFactory.createAgentResponse(
        'This is a TypeScript solution using interfaces and strong typing.',
        { confidence: 0.9, voiceId: 'developer', tokensUsed: 50 }
      ),
      ResponseFactory.createAgentResponse(
        'Performance optimization requires careful memory management and efficient algorithms.',
        { confidence: 0.8, voiceId: 'optimizer', tokensUsed: 45 }
      ),
      ResponseFactory.createAgentResponse(
        'Security considerations include input validation and authentication.',
        { confidence: 0.85, voiceId: 'security', tokensUsed: 40 }
      ),
    ];
  });

  describe('Synthesis Configuration', () => {
    test('should use default configuration when none provided', async () => {
      const result = await engine.synthesizeAdvanced(sampleResponses);

      expect(result).toBeDefined();
      expect(result.synthesisStrategy).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
      expect(result.conflictAnalysis).toBeDefined();
    });

    test('should apply custom configuration', async () => {
      const customConfig = {
        mode: SynthesisMode.CONSENSUS,
        qualityThreshold: 90,
        maxIterations: 5,
      };

      const result = await engine.synthesizeAdvanced(sampleResponses, customConfig);

      expect(result.synthesisStrategy).toBe(SynthesisMode.CONSENSUS);
    });
  });

  describe('Synthesis Modes', () => {
    test('should handle competitive synthesis', async () => {
      const config = { mode: SynthesisMode.COMPETITIVE };
      const result = await engine.synthesizeAdvanced(sampleResponses, config);

      expect(result.synthesisStrategy).toBe(SynthesisMode.COMPETITIVE);
      expect(result.combinedContent).toBeDefined();
      expect(result.combinedContent.length).toBeGreaterThan(0);
    });

    test('should handle collaborative synthesis', async () => {
      const config = { mode: SynthesisMode.COLLABORATIVE };
      const result = await engine.synthesizeAdvanced(sampleResponses, config);

      expect(result.synthesisStrategy).toBe(SynthesisMode.COLLABORATIVE);
      expect(result.voicesUsed).toHaveLength(3);
    });

    test('should handle consensus synthesis', async () => {
      const config = { mode: SynthesisMode.CONSENSUS };
      const result = await engine.synthesizeAdvanced(sampleResponses, config);

      expect(result.synthesisStrategy).toBe(SynthesisMode.CONSENSUS);
      expect(result.qualityMetrics.overall).toBeGreaterThan(0);
    });

    test('should handle hierarchical synthesis', async () => {
      const config = { mode: SynthesisMode.HIERARCHICAL };
      const result = await engine.synthesizeAdvanced(sampleResponses, config);

      expect(result.synthesisStrategy).toBe(SynthesisMode.HIERARCHICAL);
      expect(result.voiceWeights).toBeDefined();
    });

    test('should handle dialectical synthesis', async () => {
      // Create conflicting responses
      const conflictingResponses = [
        ResponseFactory.createAgentResponse(
          'We should use object-oriented programming for this solution.',
          { confidence: 0.8, voiceId: 'oop-advocate', tokensUsed: 30 }
        ),
        ResponseFactory.createAgentResponse(
          'Functional programming is the better approach for this problem.',
          { confidence: 0.8, voiceId: 'fp-advocate', tokensUsed: 30 }
        ),
      ];

      const config = { mode: SynthesisMode.DIALECTICAL };
      const result = await engine.synthesizeAdvanced(conflictingResponses, config);

      expect(result.synthesisStrategy).toBe(SynthesisMode.DIALECTICAL);
      // Should detect programming paradigm conflict
      expect(result.conflictAnalysis.conflictingTopics).toContain('programming paradigm');
    });

    test('should handle adaptive synthesis mode selection', async () => {
      const config = { mode: SynthesisMode.ADAPTIVE };
      const result = await engine.synthesizeAdvanced(sampleResponses, config);

      expect(result.synthesisStrategy).toBeDefined();
      expect([
        SynthesisMode.COMPETITIVE,
        SynthesisMode.COLLABORATIVE,
        SynthesisMode.CONSENSUS,
        SynthesisMode.DIALECTICAL,
      ]).toContain(result.synthesisStrategy as SynthesisMode);
    });
  });

  describe('Quality Assessment', () => {
    test('should provide comprehensive quality metrics', async () => {
      const result = await engine.synthesizeAdvanced(sampleResponses);

      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics.coherence).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.coherence).toBeLessThanOrEqual(100);
      expect(result.qualityMetrics.completeness).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.innovation).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.practicality).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.overall).toBeGreaterThanOrEqual(0);
    });

    test('should trigger adaptive refinement for low quality', async () => {
      const config = {
        qualityThreshold: 95, // Set very high threshold
        enableAdaptiveSynthesis: true,
      };

      const result = await engine.synthesizeAdvanced(sampleResponses, config);

      // Should have attempted adaptive adjustments
      expect(result.adaptiveAdjustments).toBeDefined();
    });
  });

  describe('Conflict Analysis', () => {
    test('should analyze conflicts between responses', async () => {
      const result = await engine.synthesizeAdvanced(sampleResponses);

      expect(result.conflictAnalysis).toBeDefined();
      expect(result.conflictAnalysis.agreementLevel).toBeGreaterThanOrEqual(0);
      expect(result.conflictAnalysis.agreementLevel).toBeLessThanOrEqual(1);
      expect(result.conflictAnalysis.resolutionStrategy).toBeDefined();
    });

    test('should identify high agreement when responses are similar', async () => {
      const similarResponses = [
        ResponseFactory.createAgentResponse('Use TypeScript for better type safety.', {
          confidence: 0.9,
          voiceId: 'dev1',
          tokensUsed: 20,
        }),
        ResponseFactory.createAgentResponse('TypeScript provides excellent type safety features.', {
          confidence: 0.8,
          voiceId: 'dev2',
          tokensUsed: 25,
        }),
      ];

      const result = await engine.synthesizeAdvanced(similarResponses);

      expect(result.conflictAnalysis.agreementLevel).toBeGreaterThan(0.5);
    });
  });

  describe('Voice Weighting', () => {
    test('should calculate appropriate voice weights', async () => {
      const result = await engine.synthesizeAdvanced(sampleResponses);

      expect(result.voiceWeights).toBeDefined();
      expect(result.voiceWeights).toHaveLength(sampleResponses.length);

      result.voiceWeights.forEach(weight => {
        expect(weight.voiceId).toBeDefined();
        expect(weight.weight).toBeGreaterThanOrEqual(0);
        expect(weight.reason).toBeDefined();
      });
    });

    test('should prioritize higher confidence responses in weighting', async () => {
      const result = await engine.synthesizeAdvanced(sampleResponses);

      // Find the weight for the developer voice (highest confidence: 0.9)
      const developerWeight = result.voiceWeights.find(w => w.voiceId === 'developer');
      const optimizerWeight = result.voiceWeights.find(w => w.voiceId === 'optimizer');

      expect(developerWeight).toBeDefined();
      expect(optimizerWeight).toBeDefined();

      // Developer should have higher weight due to higher confidence
      if (developerWeight && optimizerWeight) {
        expect(developerWeight.weight).toBeGreaterThanOrEqual(optimizerWeight.weight);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle empty response array', async () => {
      await expect(engine.synthesizeAdvanced([])).rejects.toThrow();
    });

    test('should handle single response gracefully', async () => {
      const singleResponse = [sampleResponses[0]];
      const result = await engine.synthesizeAdvanced(singleResponse);

      expect(result).toBeDefined();
      expect(result.voicesUsed).toHaveLength(1);
      expect(result.conflictAnalysis.agreementLevel).toBe(1.0);
    });

    test('should provide fallback for synthesis failures', async () => {
      // Mock a synthesis failure
      const invalidResponses = [
        ResponseFactory.createAgentResponse('', { confidence: 0, voiceId: 'invalid' }),
      ];

      const result = await engine.synthesizeAdvanced(invalidResponses);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('Performance and Efficiency', () => {
    test('should complete synthesis within reasonable time', async () => {
      const startTime = Date.now();

      await engine.synthesizeAdvanced(sampleResponses);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds for test environment
      expect(duration).toBeLessThan(5000);
    });

    test('should handle large number of responses efficiently', async () => {
      const manyResponses = Array.from({ length: 10 }, (_, i) =>
        ResponseFactory.createAgentResponse(
          `Response ${i} with different content and perspectives.`,
          { confidence: 0.7 + i * 0.02, voiceId: `voice${i}`, tokensUsed: 30 }
        )
      );

      const result = await engine.synthesizeAdvanced(manyResponses);

      expect(result).toBeDefined();
      expect(result.voicesUsed).toHaveLength(10);
      expect(result.voiceWeights).toHaveLength(10);
    });
  });

  describe('Integration with Response Types', () => {
    test('should maintain response type consistency', async () => {
      const result = await engine.synthesizeAdvanced(sampleResponses);

      // Should be a valid SynthesisResponse
      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.combinedContent).toBeDefined();
      expect(result.voicesUsed).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    test('should preserve individual response metadata', async () => {
      const result = await engine.synthesizeAdvanced(sampleResponses);

      // Should reference all original voices
      expect(result.voicesUsed).toContain('developer');
      expect(result.voicesUsed).toContain('optimizer');
      expect(result.voicesUsed).toContain('security');
    });
  });
});
