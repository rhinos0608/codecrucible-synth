/**
 * Integration Test for Quality Analyzer with SequentialDualAgentSystem
 * Verifies that the reconstructed analyzer works with existing system
 * Created: August 26, 2025 - Quality Analyzer Reconstruction Agent
 */

import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { QualityAnalyzerIntegrationAdapter } from '../../src/core/quality/quality-analyzer-integration-adapter.js';

describe('Quality Analyzer Integration', () => {
  let analyzer: QualityAnalyzerIntegrationAdapter;

  beforeEach(() => {
    analyzer = new QualityAnalyzerIntegrationAdapter({
      weights: {
        cyclomaticComplexity: 0.25,
        maintainabilityIndex: 0.2,
        lintingScore: 0.2,
        formattingScore: 0.1,
        typeCoverage: 0.15,
        documentation: 0.05,
        duplication: 0.03,
        halsteadComplexity: 0.02,
      },
    });
  });

  afterEach(async () => {
    await analyzer.shutdown();
  });

  describe('Legacy API Compatibility', () => {
    it('should provide legacy analyzeCode API', async () => {
      const code = `
        function calculateSum(a: number, b: number): number {
          // Calculate the sum of two numbers
          return a + b;
        }
        
        const result = calculateSum(5, 10);
        console.log(result);
      `;

      const metrics = await analyzer.analyzeCode(code, 'typescript', 'test.ts');

      // Verify legacy format
      expect(metrics).toBeDefined();
      expect(typeof metrics.overallScore).toBe('number');
      expect(metrics.complexity).toBeDefined();
      expect(metrics.linting).toBeDefined();
      expect(metrics.formatting).toBeDefined();
      expect(metrics.typeCoverage).toBeDefined();
      expect(metrics.duplication).toBeDefined();
      expect(typeof metrics.technicalDebtRatio).toBe('number');
      expect(Array.isArray(metrics.recommendations)).toBe(true);

      // Verify complexity structure matches legacy format
      expect(metrics.complexity.cyclomaticComplexity).toBeGreaterThan(0);
      expect(metrics.complexity.halsteadComplexity.programLength).toBeGreaterThan(0);
      expect(metrics.complexity.maintainabilityIndex).toBeGreaterThan(0);
      expect(metrics.complexity.linesOfCode).toBeGreaterThan(0);

      // Verify score is reasonable
      expect(metrics.overallScore).toBeGreaterThan(70);
    }, 30000);

    it('should handle configuration updates', () => {
      const originalConfig = analyzer.getConfiguration();

      analyzer.updateConfiguration({
        weights: {
          ...originalConfig.weights,
          cyclomaticComplexity: 0.5,
        },
      });

      const updatedConfig = analyzer.getConfiguration();
      expect(updatedConfig.weights.cyclomaticComplexity).toBe(0.5);
    });

    it('should provide quality history', async () => {
      const identifier = 'integration-test';

      const code1 = `function simple() { return 1; }`;
      await analyzer.analyzeCode(code1, 'typescript', identifier);

      const code2 = `
        function complex(x: any): any {
          if (x) {
            if (x.data) {
              if (x.data.value) {
                return x.data.value * 2;
              }
            }
          }
          return null;
        }
      `;
      await analyzer.analyzeCode(code2, 'typescript', identifier);

      const history = analyzer.getQualityHistory(identifier);
      expect(history.length).toBe(2);
      expect(history[0].overallScore).toBeDefined();
      expect(history[1].overallScore).toBeDefined();
    }, 30000);
  });

  describe('Enhanced Features', () => {
    it('should provide system status', () => {
      const status = analyzer.getSystemStatus();

      expect(status).toBeDefined();
      expect(status.performance).toBeDefined();
      expect(status.analytics).toBeDefined();
      expect(status.toolAvailability).toBeDefined();
      expect(status.configuration).toBeDefined();
    });

    it('should allow circuit breaker reset', () => {
      // This should not throw
      analyzer.resetCircuitBreakers();
    });
  });

  describe('Event Emission', () => {
    it('should emit analysis complete events in legacy format', async () => {
      let emittedEvent: any = null;

      analyzer.on('analysis_complete', event => {
        emittedEvent = event;
      });

      const code = `function test() { return 'test'; }`;
      await analyzer.analyzeCode(code, 'typescript');

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent.result).toBeDefined();
      expect(emittedEvent.duration).toBeGreaterThan(0);

      // Verify the result has legacy format
      expect(emittedEvent.result.overallScore).toBeDefined();
      expect(emittedEvent.result.complexity).toBeDefined();
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle invalid code gracefully', async () => {
      const invalidCode = `function broken( { return "unclosed`;

      try {
        const result = await analyzer.analyzeCode(invalidCode, 'typescript');
        expect(result).toBeDefined();
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }, 15000);

    it('should handle empty code', async () => {
      const result = await analyzer.analyzeCode('', 'typescript');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('Performance and Metrics', () => {
    it('should complete analysis within reasonable time', async () => {
      const code = `
        class TestService {
          private data: Map<string, any> = new Map();
          
          async process(input: string): Promise<string> {
            if (this.data.has(input)) {
              return this.data.get(input);
            }
            
            const result = await this.computeResult(input);
            this.data.set(input, result);
            return result;
          }
          
          private async computeResult(input: string): Promise<string> {
            return new Promise(resolve => {
              setTimeout(() => resolve(input.toUpperCase()), 100);
            });
          }
        }
      `;

      const startTime = Date.now();
      const result = await analyzer.analyzeCode(code, 'typescript');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(result.overallScore).toBeGreaterThan(50);
      expect(result.complexity.cyclomaticComplexity).toBeGreaterThan(1);
    }, 20000);

    it('should provide meaningful recommendations', async () => {
      const problemCode = `
        function badCode(x){
        if(x){
        if(x.a){
        if(x.a.b){
        if(x.a.b.c){
        return x.a.b.c*2;
        }else{
        return 0;
        }}}}
        return null;
        }
      `;

      const result = await analyzer.analyzeCode(problemCode, 'typescript');

      expect(result.recommendations.length).toBeGreaterThan(0);

      // Should have complexity recommendations
      const hasComplexityRec = result.recommendations.some(r => r.category === 'complexity');
      expect(hasComplexityRec).toBe(true);

      // Recommendations should have required fields
      result.recommendations.forEach(rec => {
        expect(rec.priority).toMatch(/^(critical|high|medium|low)$/);
        expect(rec.description).toBeDefined();
        expect(rec.suggestion).toBeDefined();
        expect(typeof rec.estimatedImpact).toBe('number');
        expect(typeof rec.automated).toBe('boolean');
      });
    }, 15000);
  });
});

/**
 * SequentialDualAgentSystem Integration Test
 */
describe('SequentialDualAgentSystem Integration Compatibility', () => {
  it('should be importable with the same interface', async () => {
    // Test that the import structure works
    const { CodeQualityAnalyzer } = await import(
      '../../src/core/quality/quality-analyzer-integration-adapter.js'
    );

    expect(CodeQualityAnalyzer).toBeDefined();

    const analyzer = new CodeQualityAnalyzer();
    expect(analyzer).toBeDefined();
    expect(typeof analyzer.analyzeCode).toBe('function');
    expect(typeof analyzer.getConfiguration).toBe('function');
    expect(typeof analyzer.updateConfiguration).toBe('function');
    expect(typeof analyzer.getQualityHistory).toBe('function');
    expect(typeof analyzer.clearHistory).toBe('function');

    await analyzer.shutdown();
  });

  it('should provide the same configuration structure expected by SequentialDualAgentSystem', () => {
    const analyzer = new QualityAnalyzerIntegrationAdapter({
      weights: {
        cyclomaticComplexity: 0.25,
        maintainabilityIndex: 0.2,
        lintingScore: 0.2,
        formattingScore: 0.1,
        typeCoverage: 0.15,
        documentation: 0.05,
        duplication: 0.03,
        halsteadComplexity: 0.02,
      },
    });

    const config = analyzer.getConfiguration();

    // Verify the expected structure from SequentialDualAgentSystem
    expect(config.weights).toBeDefined();
    expect(config.weights.cyclomaticComplexity).toBe(0.25);
    expect(config.weights.maintainabilityIndex).toBe(0.2);
    expect(config.weights.lintingScore).toBe(0.2);
    expect(config.cyclomaticComplexity).toBeDefined();
    expect(config.maintainabilityIndex).toBeDefined();

    analyzer.shutdown();
  });
});
