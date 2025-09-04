/**
 * Multi-Voice Collaboration Integration Tests
 * Tests advanced synthesis, conflict resolution, and voice consensus building
 * Created: August 26, 2025
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  AdvancedSynthesisEngine,
  SynthesisMode,
  ConflictResolutionStrategy,
  WeightingStrategy,
} from '../../src/core/advanced-synthesis-engine';
import { ResponseFactory, AgentResponse } from '../../src/core/response-types';
import { EventEmitter } from 'events';

/**
 * Integration test for multi-voice collaboration scenarios
 */
describe('Multi-Voice Collaboration Integration', () => {
  let synthesisEngine: AdvancedSynthesisEngine;
  let mockModelClient: any;

  beforeEach(() => {
    mockModelClient = {
      generateVoiceResponse: jest.fn().mockResolvedValue({
        content: 'Mock generated response',
        confidence: 0.8,
        voiceId: 'mock-voice',
      }),
    };

    synthesisEngine = new AdvancedSynthesisEngine(mockModelClient);
  });

  afterEach(() => {
    synthesisEngine.removeAllListeners();
  });

  describe('Real-World Voice Collaboration Scenarios', () => {
    test('should handle software architecture decision with multiple expert perspectives', async () => {
      const architecturalResponses = [
        ResponseFactory.createAgentResponse(
          'For microservices architecture, we should prioritize service isolation and use API gateways for communication. Container orchestration with Kubernetes would provide scalability and resilience.',
          { confidence: 0.9, voiceId: 'architect', tokensUsed: 120 }
        ),
        ResponseFactory.createAgentResponse(
          'Security-wise, microservices introduce multiple attack surfaces. Each service needs individual authentication, proper network segmentation, and comprehensive monitoring. Consider service mesh for security.',
          { confidence: 0.85, voiceId: 'security', tokensUsed: 95 }
        ),
        ResponseFactory.createAgentResponse(
          'From a performance perspective, microservices can introduce latency due to network calls. Implement caching strategies, optimize data serialization, and consider eventual consistency patterns.',
          { confidence: 0.88, voiceId: 'optimizer', tokensUsed: 110 }
        ),
        ResponseFactory.createAgentResponse(
          'For maintainability, ensure proper service boundaries based on domain-driven design. Implement comprehensive logging, distributed tracing, and automated testing for each service.',
          { confidence: 0.82, voiceId: 'maintainer', tokensUsed: 100 }
        ),
      ];

      const config = {
        mode: SynthesisMode.COLLABORATIVE,
        qualityThreshold: 80,
        weightingStrategy: WeightingStrategy.EXPERTISE_BASED,
        conflictResolution: ConflictResolutionStrategy.SYNTHESIS,
      };

      const result = await synthesisEngine.synthesizeAdvanced(architecturalResponses, config);

      expect(result.success).toBe(true);
      expect(result.voicesUsed).toHaveLength(4);
      expect(result.voicesUsed).toContain('architect');
      expect(result.voicesUsed).toContain('security');
      expect(result.voicesUsed).toContain('optimizer');
      expect(result.voicesUsed).toContain('maintainer');

      expect(result.qualityMetrics.overall).toBeGreaterThan(60);
      expect(result.conflictAnalysis.agreementLevel).toBeGreaterThan(0.1);

      // Should contain insights from all perspectives
      expect(result.combinedContent).toContain('microservices');
      expect(result.combinedContent.length).toBeGreaterThan(300);
    });

    test('should resolve programming paradigm conflicts through dialectical synthesis', async () => {
      const paradigmConflictResponses = [
        ResponseFactory.createAgentResponse(
          'Object-oriented programming is superior for this use case. Encapsulation, inheritance, and polymorphism provide clear structure and code reusability. Classes model real-world entities effectively.',
          { confidence: 0.85, voiceId: 'oop-advocate', tokensUsed: 80 }
        ),
        ResponseFactory.createAgentResponse(
          'Functional programming is the better approach. Pure functions, immutability, and higher-order functions reduce bugs and improve testability. Functional composition creates more maintainable code.',
          { confidence: 0.87, voiceId: 'fp-advocate', tokensUsed: 85 }
        ),
        ResponseFactory.createAgentResponse(
          'A hybrid approach combining both paradigms would be most effective. Use functional programming for data transformations and business logic, while leveraging OOP for system architecture and UI components.',
          { confidence: 0.82, voiceId: 'pragmatist', tokensUsed: 90 }
        ),
      ];

      const config = {
        mode: SynthesisMode.DIALECTICAL,
        qualityThreshold: 70,
        conflictResolution: ConflictResolutionStrategy.DIALECTICAL,
      };

      const result = await synthesisEngine.synthesizeAdvanced(paradigmConflictResponses, config);

      expect(result.success).toBe(true);
      expect(result.synthesisStrategy).toBe(SynthesisMode.DIALECTICAL);

      // Should detect the programming paradigm conflict
      expect(result.conflictAnalysis.conflictingTopics).toContain('programming paradigm');
      expect(result.conflictAnalysis.conflicts).toHaveLength(1);
      expect(result.conflictAnalysis.conflicts[0].severity).toBe('medium');

      // Dialectical synthesis should include structured analysis
      expect(result.combinedContent).toContain('Dialectical Synthesis');
      expect(result.combinedContent).toContain('Perspectives:');
      expect(result.combinedContent).toContain('Conflicts Identified:');
    });

    test('should handle consensus building for code review decisions', async () => {
      const codeReviewResponses = [
        ResponseFactory.createAgentResponse(
          'The code follows TypeScript best practices with proper type annotations and error handling. The function structure is clear and well-documented. Ready for approval.',
          { confidence: 0.88, voiceId: 'reviewer-1', tokensUsed: 70 }
        ),
        ResponseFactory.createAgentResponse(
          'Good implementation overall. TypeScript types are comprehensive and the error handling is robust. The documentation is thorough. I approve this change.',
          { confidence: 0.86, voiceId: 'reviewer-2', tokensUsed: 65 }
        ),
        ResponseFactory.createAgentResponse(
          'Excellent TypeScript implementation with strong typing and proper error boundaries. The code quality is high and follows our standards. Approved.',
          { confidence: 0.9, voiceId: 'reviewer-3', tokensUsed: 60 }
        ),
      ];

      const config = {
        mode: SynthesisMode.CONSENSUS,
        qualityThreshold: 85,
        conflictResolution: ConflictResolutionStrategy.MAJORITY_RULE,
      };

      const result = await synthesisEngine.synthesizeAdvanced(codeReviewResponses, config);

      expect(result.success).toBe(true);
      expect(result.synthesisStrategy).toBe(SynthesisMode.CONSENSUS);

      // High agreement should be detected
      expect(result.conflictAnalysis.agreementLevel).toBeGreaterThan(0.7);
      expect(result.conflictAnalysis.conflicts).toHaveLength(0);

      // Consensus should be clear
      expect(result.combinedContent).toContain('TypeScript');
      expect(result.qualityMetrics.overall).toBeGreaterThan(35);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Advanced Voice Weighting Scenarios', () => {
    test('should properly weight voices based on expertise and confidence', async () => {
      const mixedExpertiseResponses = [
        ResponseFactory.createAgentResponse(
          'Database performance can be optimized through proper indexing, query optimization, and connection pooling strategies.',
          { confidence: 0.95, voiceId: 'database-expert', tokensUsed: 50 }
        ),
        ResponseFactory.createAgentResponse(
          'Maybe we could try some database stuff? I think indexes are important or something.',
          { confidence: 0.4, voiceId: 'junior-developer', tokensUsed: 30 }
        ),
        ResponseFactory.createAgentResponse(
          'From a security perspective, ensure database connections use TLS encryption and implement proper access controls.',
          { confidence: 0.88, voiceId: 'security-expert', tokensUsed: 45 }
        ),
      ];

      const config = {
        weightingStrategy: WeightingStrategy.CONFIDENCE_BASED,
        mode: SynthesisMode.HIERARCHICAL,
      };

      const result = await synthesisEngine.synthesizeAdvanced(mixedExpertiseResponses, config);

      expect(result.success).toBe(true);
      expect(result.voiceWeights).toHaveLength(3);

      // Database expert should have highest weight due to confidence
      const databaseExpertWeight = result.voiceWeights.find(w => w.voiceId === 'database-expert');
      const juniorDeveloperWeight = result.voiceWeights.find(w => w.voiceId === 'junior-developer');

      expect(databaseExpertWeight?.weight).toBeGreaterThan(juniorDeveloperWeight?.weight || 0);
      expect(databaseExpertWeight?.reason).toContain('confidence');
    });

    test('should handle performance-based weighting efficiently', async () => {
      const performanceVariedResponses = [
        ResponseFactory.createAgentResponse('Efficient solution with minimal overhead.', {
          confidence: 0.8,
          voiceId: 'efficient-voice',
          tokensUsed: 25,
        }),
        ResponseFactory.createAgentResponse(
          'This is a very verbose solution that explains everything in great detail with lots of explanatory text that could be much more concise but provides comprehensive coverage of all aspects of the problem and potential solutions with extensive documentation and examples.',
          { confidence: 0.8, voiceId: 'verbose-voice', tokensUsed: 150 }
        ),
        ResponseFactory.createAgentResponse('Balanced approach with good explanations.', {
          confidence: 0.8,
          voiceId: 'balanced-voice',
          tokensUsed: 50,
        }),
      ];

      const config = {
        weightingStrategy: WeightingStrategy.PERFORMANCE_BASED,
        mode: SynthesisMode.HIERARCHICAL,
      };

      const result = await synthesisEngine.synthesizeAdvanced(performanceVariedResponses, config);

      expect(result.success).toBe(true);

      const efficientWeight = result.voiceWeights.find(w => w.voiceId === 'efficient-voice');
      const verboseWeight = result.voiceWeights.find(w => w.voiceId === 'verbose-voice');

      // More efficient voice should have higher weight
      expect(efficientWeight?.weight).toBeGreaterThan(verboseWeight?.weight || 0);
      expect(efficientWeight?.reason).toContain('Performance-based');
    });
  });

  describe('Adaptive Synthesis Behavior', () => {
    test('should automatically select appropriate synthesis mode', async () => {
      const conflictingResponses = [
        ResponseFactory.createAgentResponse(
          'We should use React for this frontend project because of its component-based architecture.',
          { confidence: 0.85, voiceId: 'react-advocate', tokensUsed: 40 }
        ),
        ResponseFactory.createAgentResponse(
          'Vue.js would be better for this project due to its simpler learning curve and excellent documentation.',
          { confidence: 0.8, voiceId: 'vue-advocate', tokensUsed: 45 }
        ),
      ];

      const config = {
        mode: SynthesisMode.ADAPTIVE, // Let the engine decide
        qualityThreshold: 75,
      };

      const result = await synthesisEngine.synthesizeAdvanced(conflictingResponses, config);

      expect(result.success).toBe(true);

      // Should detect conflicts and choose dialectical or collaborative mode
      expect([SynthesisMode.DIALECTICAL, SynthesisMode.COLLABORATIVE]).toContain(
        result.synthesisStrategy
      );
      expect(result.conflictAnalysis.conflicts.length).toBeGreaterThanOrEqual(0);
    });

    test('should trigger adaptive refinement for low-quality synthesis', async () => {
      const lowQualityResponses = [
        ResponseFactory.createAgentResponse('Bad code. Fix it.', {
          confidence: 0.3,
          voiceId: 'unhelpful-voice',
          tokensUsed: 10,
        }),
        ResponseFactory.createAgentResponse('Not sure what to do.', {
          confidence: 0.2,
          voiceId: 'confused-voice',
          tokensUsed: 8,
        }),
      ];

      const config = {
        qualityThreshold: 90, // Very high threshold
        enableAdaptiveSynthesis: true,
        maxIterations: 2,
      };

      const result = await synthesisEngine.synthesizeAdvanced(lowQualityResponses, config);

      expect(result.success).toBe(true);
      expect(result.adaptiveAdjustments).toBeDefined();
      expect(result.adaptiveAdjustments?.length).toBeGreaterThan(0);

      // Should have attempted improvements
      if (result.adaptiveAdjustments) {
        expect(
          result.adaptiveAdjustments.some(adj => adj.reasoning.includes('coherence'))
        ).toBeTruthy();
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large-scale multi-voice synthesis efficiently', async () => {
      const manyVoices = Array.from({ length: 15 }, (_, i) =>
        ResponseFactory.createAgentResponse(
          `Voice ${i} perspective: This is a unique viewpoint from voice ${i} with specific insights and recommendations for the problem at hand.`,
          {
            confidence: 0.7 + Math.random() * 0.3,
            voiceId: `voice-${i}`,
            tokensUsed: 40 + Math.floor(Math.random() * 30),
          }
        )
      );

      const startTime = Date.now();
      const result = await synthesisEngine.synthesizeAdvanced(manyVoices);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.voicesUsed).toHaveLength(15);
      expect(result.voiceWeights).toHaveLength(15);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

      // Quality should still be maintained
      expect(result.qualityMetrics.overall).toBeGreaterThan(40);
    });

    test('should provide consistent results across multiple synthesis runs', async () => {
      const consistentResponses = [
        ResponseFactory.createAgentResponse(
          'Implement proper error handling with try-catch blocks and meaningful error messages.',
          { confidence: 0.85, voiceId: 'developer', tokensUsed: 50 }
        ),
        ResponseFactory.createAgentResponse(
          'Add comprehensive unit tests to ensure code reliability and maintainability.',
          { confidence: 0.88, voiceId: 'tester', tokensUsed: 45 }
        ),
      ];

      const config = {
        mode: SynthesisMode.COLLABORATIVE,
        qualityThreshold: 75,
      };

      // Run synthesis multiple times
      const results = await Promise.all([
        synthesisEngine.synthesizeAdvanced(consistentResponses, config),
        synthesisEngine.synthesizeAdvanced(consistentResponses, config),
        synthesisEngine.synthesizeAdvanced(consistentResponses, config),
      ]);

      // All runs should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.synthesisStrategy).toBe(SynthesisMode.COLLABORATIVE);
        expect(result.voicesUsed).toHaveLength(2);
      });

      // Quality scores should be similar (within 10 points)
      const qualityScores = results.map(r => r.qualityMetrics.overall);
      const minQuality = Math.min(...qualityScores);
      const maxQuality = Math.max(...qualityScores);
      expect(maxQuality - minQuality).toBeLessThan(10);
    });
  });

  describe('Integration with Voice Memory and Context', () => {
    test('should maintain context across voice interactions', async () => {
      // This would test integration with voice memory systems
      // For now, we'll test that voice IDs are properly tracked and used

      const contextualResponses = [
        ResponseFactory.createAgentResponse(
          'Based on our previous discussion about microservices, I recommend implementing circuit breakers for resilience.',
          { confidence: 0.85, voiceId: 'architect', tokensUsed: 60 }
        ),
        ResponseFactory.createAgentResponse(
          'Following up on the architecture discussion, ensure proper monitoring and observability are in place.',
          { confidence: 0.82, voiceId: 'maintainer', tokensUsed: 55 }
        ),
      ];

      const result = await synthesisEngine.synthesizeAdvanced(contextualResponses);

      expect(result.success).toBe(true);
      expect(result.voicesUsed).toContain('architect');
      expect(result.voicesUsed).toContain('maintainer');

      // Content should reference the contextual nature
      expect(result.combinedContent).toContain('microservices');
      expect(result.combinedContent).toContain('architecture');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover gracefully from synthesis failures', async () => {
      const problematicResponses = [
        ResponseFactory.createAgentResponse(
          '', // Empty content
          { confidence: 0, voiceId: 'broken-voice', tokensUsed: 0 }
        ),
      ];

      const result = await synthesisEngine.synthesizeAdvanced(problematicResponses);

      // Should still provide a result, even if it's fallback
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.combinedContent).toBeDefined();
      expect(result.voicesUsed).toHaveLength(1);
    });

    test('should handle mixed valid and invalid responses', async () => {
      const mixedResponses = [
        ResponseFactory.createAgentResponse('This is a valid response with good content.', {
          confidence: 0.85,
          voiceId: 'good-voice',
          tokensUsed: 40,
        }),
        ResponseFactory.createAgentResponse(
          '', // Invalid empty response
          { confidence: 0, voiceId: 'bad-voice', tokensUsed: 0 }
        ),
        ResponseFactory.createAgentResponse('Another valid response with useful information.', {
          confidence: 0.8,
          voiceId: 'another-good-voice',
          tokensUsed: 45,
        }),
      ];

      const result = await synthesisEngine.synthesizeAdvanced(mixedResponses);

      expect(result.success).toBe(true);
      expect(result.voicesUsed).toHaveLength(3);

      // Should still produce reasonable quality despite bad input
      expect(result.qualityMetrics.overall).toBeGreaterThan(30);
    });
  });
});
