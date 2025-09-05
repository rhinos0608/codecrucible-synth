/**
 * Living Spiral Integration Test (2025 Pattern)
 * Agent 3: Voice System Optimization Specialist
 *
 * Tests integration between optimized voice system and Living Spiral methodology
 */

import { VoiceSystemIntegration2025 } from './voice-system-integration-2025.js';
import { logger } from '../infrastructure/logging/logger.js';

interface LivingSpiralPhase {
  name: string;
  description: string;
  recommendedVoices: string[];
  expectedDuration: number;
  qualityThreshold: number;
}

interface SpiralTestResult {
  phase: string;
  success: boolean;
  duration: number;
  quality: number;
  voicesUsed: string[];
  costSavings: number;
  recommendations: string[];
}

/**
 * Test Living Spiral integration with optimized voice system
 */
export class LivingSpiralIntegrationTest {
  private voiceSystem: VoiceSystemIntegration2025;
  private testResults: SpiralTestResult[] = [];

  constructor() {
    // Initialize with Living Spiral optimized configuration
    this.voiceSystem = new VoiceSystemIntegration2025(null, {
      useOptimizedSystem: true,
      maxConcurrentVoices: 5,
      enablePerformanceMonitoring: true,
      voiceSelectionStrategy: 'adaptive',
    });
  }

  /**
   * Run comprehensive Living Spiral integration tests
   */
  async runIntegrationTests(): Promise<{
    overallSuccess: boolean;
    phaseResults: SpiralTestResult[];
    totalCostSavings: number;
    qualityImprovement: number;
    recommendations: string[];
  }> {
    logger.info('🌀 Starting Living Spiral Integration Tests');

    const phases: LivingSpiralPhase[] = [
      {
        name: 'Collapse',
        description: 'Problem decomposition and analysis',
        recommendedVoices: ['analyzer', 'explorer'],
        expectedDuration: 3000,
        qualityThreshold: 0.75,
      },
      {
        name: 'Council',
        description: 'Multi-voice perspective gathering',
        recommendedVoices: ['developer', 'security', 'architect'],
        expectedDuration: 5000,
        qualityThreshold: 0.8,
      },
      {
        name: 'Synthesis',
        description: 'Unified design creation',
        recommendedVoices: ['architect', 'designer'],
        expectedDuration: 4000,
        qualityThreshold: 0.85,
      },
      {
        name: 'Rebirth',
        description: 'Implementation with testing',
        recommendedVoices: ['developer', 'implementor', 'maintainer'],
        expectedDuration: 6000,
        qualityThreshold: 0.8,
      },
      {
        name: 'Reflection',
        description: 'Learning and quality assessment',
        recommendedVoices: ['guardian', 'maintainer'],
        expectedDuration: 2000,
        qualityThreshold: 0.9,
      },
    ];

    // Test each phase
    for (const phase of phases) {
      const result = await this.testSpiralPhase(phase);
      this.testResults.push(result);
    }

    // Calculate overall results
    const overallSuccess = this.testResults.every(r => r.success);
    const totalCostSavings = this.testResults.reduce((sum, r) => sum + r.costSavings, 0);
    const avgQuality =
      this.testResults.reduce((sum, r) => sum + r.quality, 0) / this.testResults.length;
    const qualityImprovement = Math.max(0, avgQuality - 0.7); // Baseline quality

    const recommendations = await this.voiceSystem.generateOptimizationRecommendations();

    logger.info('🌀 Living Spiral Integration Tests Complete', {
      overallSuccess,
      phasesCompleted: this.testResults.length,
      totalCostSavings: totalCostSavings.toFixed(3),
      qualityImprovement: qualityImprovement.toFixed(3),
    });

    return {
      overallSuccess,
      phaseResults: this.testResults,
      totalCostSavings,
      qualityImprovement,
      recommendations,
    };
  }

  /**
   * Test a single Living Spiral phase
   */
  private async testSpiralPhase(phase: LivingSpiralPhase): Promise<SpiralTestResult> {
    logger.info(`🌀 Testing ${phase.name} phase`, {
      description: phase.description,
      recommendedVoices: phase.recommendedVoices.join(', '),
    });

    const startTime = Date.now();
    const testPrompt = this.generatePhasePrompt(phase);

    try {
      // Test voice selection optimization
      const recommendedVoices = this.voiceSystem.recommendVoices(testPrompt, 3);
      const finalVoices = this.selectOptimalVoicesForPhase(phase, recommendedVoices);

      // Test single voice response (for simple phases)
      let singleVoiceResult;
      if (finalVoices.length === 1) {
        singleVoiceResult = (await this.voiceSystem.generateSingleVoiceResponse(
          finalVoices[0],
          testPrompt
        )) as { confidence?: number; tokens_used?: number };
      } else {
        // Test multi-voice coordination
        await this.voiceSystem.generateMultiVoiceSolutions(finalVoices, testPrompt, {
          strategy: 'consensus',
          maxVoices: finalVoices.length,
        });

        // Use synthesis for final result
        singleVoiceResult = (await this.voiceSystem.synthesize(
          testPrompt,
          finalVoices,
          'consensus'
        )) as { confidence?: number; tokens_used?: number };
      }

      const duration = Date.now() - startTime;
      const quality: number =
        typeof singleVoiceResult?.confidence === 'number' ? singleVoiceResult.confidence : 0;
      const success = duration <= phase.expectedDuration * 1.5 && quality >= phase.qualityThreshold;

      // Calculate cost savings (comparison with baseline)
      const baselineCost = finalVoices.length * 0.08; // Baseline cost per voice
      const actualCost =
        (typeof singleVoiceResult?.tokens_used === 'number'
          ? singleVoiceResult.tokens_used
          : 1000) * 0.00001;
      const costSavings = Math.max(0, baselineCost - actualCost);

      const result: SpiralTestResult = {
        phase: phase.name,
        success,
        duration,
        quality,
        voicesUsed: finalVoices,
        costSavings,
        recommendations: this.generatePhaseRecommendations(phase, duration, quality),
      };

      logger.info(`✅ ${phase.name} phase ${success ? 'PASSED' : 'FAILED'}`, {
        duration: `${duration}ms`,
        quality: quality.toFixed(3),
        costSavings: costSavings.toFixed(3),
        voicesUsed: finalVoices.join(', '),
      });

      return result;
    } catch (error) {
      logger.error(`❌ ${phase.name} phase FAILED`, {
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      return {
        phase: phase.name,
        success: false,
        duration: Date.now() - startTime,
        quality: 0,
        voicesUsed: [],
        costSavings: 0,
        recommendations: [`${phase.name} phase failed: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Generate test prompt for a specific phase
   */
  private generatePhasePrompt(phase: LivingSpiralPhase): string {
    const prompts = {
      Collapse:
        'Analyze this complex system architecture problem: Design a scalable e-commerce platform with microservices, security, and performance requirements. Break down the problem into manageable components.',
      Council:
        'Gather multiple perspectives on implementing the e-commerce platform: What are the key considerations from development, security, and architecture viewpoints?',
      Synthesis:
        'Create a unified design approach for the e-commerce platform that incorporates all perspectives and creates a cohesive solution.',
      Rebirth:
        'Implement the e-commerce platform design with proper testing, deployment, and monitoring strategies.',
      Reflection:
        'Assess the quality and effectiveness of the implemented e-commerce platform solution. What lessons were learned and what improvements can be made?',
    };

    return (
      prompts[phase.name as keyof typeof prompts] ||
      `Execute ${phase.name} phase: ${phase.description}`
    );
  }

  /**
   * Select optimal voices for a phase based on recommendations and phase requirements
   */
  private selectOptimalVoicesForPhase(phase: LivingSpiralPhase, recommended: string[]): string[] {
    // Combine phase recommendations with system recommendations
    const combined = [...new Set([...phase.recommendedVoices, ...recommended])];

    // Prioritize phase-specific voices
    const prioritized = phase.recommendedVoices.concat(
      combined.filter(v => !phase.recommendedVoices.includes(v))
    );

    // Return optimal number based on phase complexity
    const complexPhases = ['Council', 'Rebirth'];
    const maxVoices = complexPhases.includes(phase.name) ? 3 : 2;

    return prioritized.slice(0, maxVoices);
  }

  /**
   * Generate recommendations for phase optimization
   */
  private generatePhaseRecommendations(
    phase: LivingSpiralPhase,
    duration: number,
    quality: number
  ): string[] {
    const recommendations = [];

    if (duration > phase.expectedDuration) {
      recommendations.push(
        `${phase.name} phase exceeded expected duration - consider voice optimization`
      );
    }

    if (quality < phase.qualityThreshold) {
      recommendations.push(
        `${phase.name} phase quality below threshold - consider additional voice expertise`
      );
    }

    // Phase-specific recommendations
    if (phase.name === 'Council' && quality > 0.9) {
      recommendations.push(
        'Council phase showing excellent collaboration - maintain current voice selection'
      );
    }

    if (phase.name === 'Synthesis' && duration < phase.expectedDuration * 0.5) {
      recommendations.push(
        'Synthesis phase completed very quickly - ensure all perspectives were adequately considered'
      );
    }

    return recommendations;
  }

  /**
   * Generate comprehensive test report
   */
  public async generateTestReport(): Promise<{
    testSummary: {
      totalPhases: number;
      successfulPhases: number;
      successRate: number;
      totalDuration: number;
      averageQuality: number;
      totalCostSavings: number;
    };
    phaseResults: ReadonlyArray<SpiralTestResult>;
    systemAnalytics: {
      systemOverview: {
        optimizationsActive: boolean;
        recommendationsGenerated: number;
      };
      [key: string]: unknown;
    };
    integrationStatus: {
      spiralIntegration: boolean;
      optimizationsActive: boolean;
      performanceImprovement: number;
      recommendationsGenerated: number;
    };
    conclusions: string[];
  }> {
    const analytics = (await this.voiceSystem.getSystemAnalytics()) as unknown as {
      systemOverview: {
        optimizationsActive: boolean;
        recommendationsGenerated: number;
      };
      [key: string]: unknown;
    };

    return {
      testSummary: {
        totalPhases: this.testResults.length,
        successfulPhases: this.testResults.filter((r: Readonly<SpiralTestResult>) => r.success)
          .length,
        successRate:
          this.testResults.filter((r: Readonly<SpiralTestResult>) => r.success).length /
          this.testResults.length,
        totalDuration: this.testResults.reduce(
          (sum: number, r: Readonly<SpiralTestResult>) => sum + r.duration,
          0
        ),
        averageQuality:
          this.testResults.reduce(
            (sum: number, r: Readonly<SpiralTestResult>) => sum + r.quality,
            0
          ) / this.testResults.length,
        totalCostSavings: this.testResults.reduce(
          (sum: number, r: Readonly<SpiralTestResult>) => sum + r.costSavings,
          0
        ),
      },
      phaseResults: this.testResults,
      systemAnalytics: analytics,
      integrationStatus: {
        spiralIntegration: true,
        optimizationsActive: analytics.systemOverview.optimizationsActive,
        performanceImprovement: this.calculatePerformanceImprovement(),
        recommendationsGenerated: analytics.systemOverview.recommendationsGenerated,
      },
      conclusions: this.generateConclusions(),
    };
  }

  /**
   * Calculate overall performance improvement
   */
  private calculatePerformanceImprovement(): number {
    const avgDuration =
      this.testResults.reduce((sum, r) => sum + r.duration, 0) / this.testResults.length;
    const avgQuality =
      this.testResults.reduce((sum, r) => sum + r.quality, 0) / this.testResults.length;

    // Performance improvement = (quality improvement - time overhead) * efficiency factor
    const baselineQuality = 0.7;
    const baselineDuration = 4000; // Average baseline duration

    const qualityImprovement = (avgQuality - baselineQuality) / baselineQuality;
    const timeEfficiency = Math.max(0, (baselineDuration - avgDuration) / baselineDuration);

    return (qualityImprovement + timeEfficiency) * 0.5; // Combined score
  }

  /**
   * Generate test conclusions
   */
  private generateConclusions(): string[] {
    const conclusions = [];
    const successRate = this.testResults.filter(r => r.success).length / this.testResults.length;

    if (successRate >= 0.8) {
      conclusions.push(
        'Living Spiral integration with optimized voice system is highly successful'
      );
    } else if (successRate >= 0.6) {
      conclusions.push('Living Spiral integration shows good results with room for improvement');
    } else {
      conclusions.push('Living Spiral integration needs optimization for better performance');
    }

    const totalCostSavings = this.testResults.reduce((sum, r) => sum + r.costSavings, 0);
    if (totalCostSavings > 0.1) {
      conclusions.push(`Significant cost savings achieved: ${totalCostSavings.toFixed(3)}`);
    }

    const avgQuality =
      this.testResults.reduce((sum, r) => sum + r.quality, 0) / this.testResults.length;
    if (avgQuality > 0.85) {
      conclusions.push('Quality improvements demonstrate successful voice optimization');
    }

    // Phase-specific conclusions
    const councilPhase = this.testResults.find(r => r.phase === 'Council');
    if (councilPhase && councilPhase.success) {
      conclusions.push('Multi-voice coordination in Council phase validates advanced voice system');
    }

    return conclusions;
  }
}

/**
 * Run Living Spiral integration test
 */
export async function runLivingSpiralIntegrationTest(): Promise<{
  success: boolean;
  results?: {
    overallSuccess: boolean;
    phaseResults: SpiralTestResult[];
    totalCostSavings: number;
    qualityImprovement: number;
    recommendations: string[];
  };
  report?: Awaited<ReturnType<LivingSpiralIntegrationTest['generateTestReport']>>;
  error?: string;
}> {
  const test = new LivingSpiralIntegrationTest();

  try {
    const results = await test.runIntegrationTests();
    const report = await test.generateTestReport();

    logger.info('🌀 Living Spiral Integration Test Complete', {
      success: results.overallSuccess,
      costSavings: results.totalCostSavings,
      qualityImprovement: results.qualityImprovement,
    });

    return {
      success: results.overallSuccess,
      results,
      report,
    };
  } catch (error) {
    logger.error('Living Spiral integration test failed', {
      error: (error as Error).message,
    });

    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
