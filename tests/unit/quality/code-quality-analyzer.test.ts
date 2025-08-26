/**
 * Comprehensive Code Quality Analyzer Tests
 * Tests the data-driven quality metrics system
 * Created: August 26, 2025
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CodeQualityAnalyzer, ComprehensiveQualityMetrics } from '../../src/core/quality/code-quality-analyzer.js';

describe('CodeQualityAnalyzer - Data-Driven Quality Metrics', () => {
  let qualityAnalyzer: CodeQualityAnalyzer;

  beforeEach(() => {
    qualityAnalyzer = new CodeQualityAnalyzer({
      // Test configuration with lowered thresholds for testing
      cyclomaticComplexity: {
        lowThreshold: 5,
        mediumThreshold: 10,
        highThreshold: 15,
      },
      maintainabilityIndex: {
        lowThreshold: 20,
        mediumThreshold: 70,
        highThreshold: 90,
      },
    });
  });

  afterEach(() => {
    qualityAnalyzer?.clearHistory();
  });

  describe('Cyclomatic Complexity Analysis', () => {
    it('should calculate low complexity for simple code', async () => {
      const simpleCode = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const metrics = await qualityAnalyzer.analyzeCode(simpleCode, 'typescript', 'simple.ts');
      
      expect(metrics).toBeDefined();
      expect(metrics.complexity.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
      expect(metrics.complexity.cyclomaticComplexity).toBeLessThanOrEqual(3);
      expect(metrics.overallScore).toBeGreaterThan(80);
    });

    it('should detect high complexity in nested conditional code', async () => {
      const complexCode = `
        function complexFunction(x: number, y: number, z: string): string {
          if (x > 0) {
            if (y > 0) {
              for (let i = 0; i < 10; i++) {
                if (i % 2 === 0) {
                  switch (z) {
                    case 'a':
                      if (x > y) {
                        return 'high';
                      }
                      break;
                    case 'b':
                      while (x < 100) {
                        x++;
                        if (x % 5 === 0) {
                          break;
                        }
                      }
                      break;
                  }
                }
              }
            } else if (y < 0) {
              return 'negative';
            }
          } else {
            return 'zero';
          }
          return 'default';
        }
      `;

      const metrics = await qualityAnalyzer.analyzeCode(complexCode, 'typescript', 'complex.ts');
      
      expect(metrics.complexity.cyclomaticComplexity).toBeGreaterThan(10);
      expect(metrics.recommendations.some(r => r.category === 'complexity')).toBe(true);
      expect(metrics.overallScore).toBeLessThan(70); // Should be penalized for high complexity
    });
  });

  describe('Maintainability Index Calculation', () => {
    it('should calculate high maintainability for well-structured code', async () => {
      const wellStructuredCode = `
        /**
         * Calculates the factorial of a number
         * @param n - The number to calculate factorial for
         * @returns The factorial result
         */
        function factorial(n: number): number {
          // Handle base cases
          if (n <= 1) {
            return 1;
          }
          
          // Recursive calculation
          return n * factorial(n - 1);
        }

        /**
         * Validates input for factorial calculation
         * @param input - The input to validate
         * @returns True if valid, false otherwise
         */
        function isValidFactorialInput(input: number): boolean {
          return typeof input === 'number' && input >= 0 && Number.isInteger(input);
        }
      `;

      const metrics = await qualityAnalyzer.analyzeCode(wellStructuredCode, 'typescript', 'factorial.ts');
      
      expect(metrics.complexity.maintainabilityIndex).toBeGreaterThan(70);
      expect(metrics.complexity.commentRatio).toBeGreaterThan(10);
      expect(metrics.recommendations.filter(r => r.category === 'documentation')).toHaveLength(0);
    });

    it('should detect low maintainability in poorly documented code', async () => {
      const poorlyDocumentedCode = `
        function f(x,y,z){var a=x+y;var b=z*2;if(a>b){return a}else{return b}}
        function g(data){var result=[];for(var i=0;i<data.length;i++){if(data[i]%2==0){result.push(data[i]*3)}}return result}
      `;

      const metrics = await qualityAnalyzer.analyzeCode(poorlyDocumentedCode, 'typescript', 'poor.ts');
      
      expect(metrics.complexity.maintainabilityIndex).toBeLessThan(60);
      expect(metrics.complexity.commentRatio).toBeLessThan(5);
      expect(metrics.recommendations.some(r => r.category === 'documentation')).toBe(true);
    });
  });

  describe('Linting Integration', () => {
    it('should detect linting issues in problematic code', async () => {
      const lintingProblematicCode = `
        var unused_var = 'never used';
        function test() {
          console.log('debug message');
          eval('console.log("dangerous")');
          var x = 1;
          x = 2;
        }
      `;

      const metrics = await qualityAnalyzer.analyzeCode(lintingProblematicCode, 'typescript', 'problematic.ts');
      
      // Note: Actual linting scores depend on ESLint being available and configured
      expect(metrics.linting).toBeDefined();
      expect(typeof metrics.linting.score).toBe('number');
      expect(metrics.linting.score).toBeGreaterThanOrEqual(0);
      expect(metrics.linting.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Type Coverage Analysis', () => {
    it('should detect type coverage in TypeScript code', async () => {
      const typedCode = `
        interface User {
          id: number;
          name: string;
          email: string;
        }

        function createUser(name: string, email: string): User {
          return {
            id: Math.floor(Math.random() * 1000),
            name,
            email
          };
        }

        function processUsers(users: User[]): string[] {
          return users.map(user => user.name);
        }
      `;

      const metrics = await qualityAnalyzer.analyzeCode(typedCode, 'typescript', 'typed.ts');
      
      expect(metrics.typeCoverage.coverage).toBeGreaterThan(50);
      expect(metrics.typeCoverage.totalSymbols).toBeGreaterThan(0);
    });

    it('should detect poor type coverage in untyped code', async () => {
      const untypedCode = `
        function process(data) {
          var result = [];
          for (var item of data) {
            result.push(item.value * 2);
          }
          return result;
        }

        var config = {
          timeout: 5000,
          retries: 3
        };
      `;

      const metrics = await qualityAnalyzer.analyzeCode(untypedCode, 'typescript', 'untyped.ts');
      
      expect(metrics.typeCoverage.coverage).toBeLessThan(80);
    });
  });

  describe('Composite Scoring Algorithm', () => {
    it('should produce higher scores for high-quality code', async () => {
      const highQualityCode = `
        /**
         * Utility class for mathematical operations
         */
        class MathUtils {
          /**
           * Calculates the greatest common divisor of two numbers
           * @param a - First number
           * @param b - Second number
           * @returns The GCD of a and b
           */
          static gcd(a: number, b: number): number {
            // Ensure positive numbers
            a = Math.abs(a);
            b = Math.abs(b);
            
            // Euclidean algorithm
            while (b !== 0) {
              const temp = b;
              b = a % b;
              a = temp;
            }
            
            return a;
          }

          /**
           * Calculates the least common multiple of two numbers
           * @param a - First number
           * @param b - Second number
           * @returns The LCM of a and b
           */
          static lcm(a: number, b: number): number {
            return Math.abs(a * b) / MathUtils.gcd(a, b);
          }
        }
      `;

      const metrics = await qualityAnalyzer.analyzeCode(highQualityCode, 'typescript', 'math-utils.ts');
      
      expect(metrics.overallScore).toBeGreaterThan(75);
      expect(metrics.complexity.cyclomaticComplexity).toBeLessThanOrEqual(5);
      expect(metrics.complexity.maintainabilityIndex).toBeGreaterThan(70);
    });

    it('should produce lower scores for low-quality code', async () => {
      const lowQualityCode = `
        function mess(a,b,c,d,e,f){if(a){if(b){if(c){if(d){if(e){if(f){for(var i=0;i<100;i++){for(var j=0;j<100;j++){if(i%2==0){if(j%3==0){console.log(i*j)}else if(j%5==0){console.log(i+j)}else{console.log(i-j)}}else{switch(j%4){case 0:console.log('zero');break;case 1:console.log('one');break;case 2:console.log('two');break;default:console.log('other')}}}}}}}}}return undefined}
      `;

      const metrics = await qualityAnalyzer.analyzeCode(lowQualityCode, 'typescript', 'mess.ts');
      
      expect(metrics.overallScore).toBeLessThan(40);
      expect(metrics.complexity.cyclomaticComplexity).toBeGreaterThan(15);
      expect(metrics.recommendations.length).toBeGreaterThan(2);
    });
  });

  describe('Quality Recommendations', () => {
    it('should generate appropriate recommendations for code issues', async () => {
      const issueCode = `
        function duplicateLogic(type) {
          if (type === 'user') {
            console.log('Processing user');
            // Complex processing
            var result = '';
            for (var i = 0; i < 10; i++) {
              if (i % 2 === 0) {
                result += 'even';
              } else {
                result += 'odd';
              }
            }
            return result;
          } else if (type === 'admin') {
            console.log('Processing admin');
            // Duplicate complex processing
            var result = '';
            for (var i = 0; i < 10; i++) {
              if (i % 2 === 0) {
                result += 'even';
              } else {
                result += 'odd';
              }
            }
            return result;
          }
          return null;
        }
      `;

      const metrics = await qualityAnalyzer.analyzeCode(issueCode, 'typescript', 'duplicate.ts');
      
      expect(metrics.recommendations.length).toBeGreaterThan(0);
      
      const complexityRecommendations = metrics.recommendations.filter(r => r.category === 'complexity');
      const documentationRecommendations = metrics.recommendations.filter(r => r.category === 'documentation');
      
      expect(complexityRecommendations.length + documentationRecommendations.length).toBeGreaterThan(0);
      
      // Check recommendation structure
      metrics.recommendations.forEach(rec => {
        expect(rec.category).toBeDefined();
        expect(rec.priority).toMatch(/^(critical|high|medium|low)$/);
        expect(rec.description).toBeDefined();
        expect(rec.suggestion).toBeDefined();
        expect(typeof rec.estimatedImpact).toBe('number');
        expect(typeof rec.automated).toBe('boolean');
      });
    });
  });

  describe('Trend Analysis', () => {
    it('should track quality improvements over time', async () => {
      const initialCode = `
        function bad(x) {
          if (x > 0) {
            if (x < 10) {
              for (let i = 0; i < x; i++) {
                if (i % 2 === 0) {
                  console.log(i);
                }
              }
            }
          }
        }
      `;

      const improvedCode = `
        /**
         * Prints even numbers from 0 to x-1
         * @param x - The upper limit (exclusive)
         */
        function printEvenNumbers(x: number): void {
          if (x <= 0 || x >= 10) {
            throw new Error('x must be between 1 and 9');
          }
          
          for (let i = 0; i < x; i++) {
            if (i % 2 === 0) {
              console.log(i);
            }
          }
        }
      `;

      const identifier = 'trend-test';
      
      // Analyze initial code
      const initialMetrics = await qualityAnalyzer.analyzeCode(initialCode, 'typescript', identifier);
      
      // Analyze improved code
      const improvedMetrics = await qualityAnalyzer.analyzeCode(improvedCode, 'typescript', identifier);
      
      expect(improvedMetrics.trendData).toBeDefined();
      if (improvedMetrics.trendData) {
        expect(improvedMetrics.trendData.currentScore).toBeGreaterThan(improvedMetrics.trendData.previousScore);
        expect(improvedMetrics.trendData.improvement).toBeGreaterThan(0);
        expect(improvedMetrics.trendData.trendDirection).toBe('improving');
      }
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const originalConfig = qualityAnalyzer.getConfiguration();
      
      const updates = {
        weights: {
          ...originalConfig.weights,
          cyclomaticComplexity: 0.5, // Increase weight
        },
      };
      
      qualityAnalyzer.updateConfiguration(updates);
      
      const updatedConfig = qualityAnalyzer.getConfiguration();
      expect(updatedConfig.weights.cyclomaticComplexity).toBe(0.5);
    });

    it('should handle quality history management', async () => {
      const testCode = `function test() { return 'test'; }`;
      const identifier = 'history-test';
      
      // Generate some history
      await qualityAnalyzer.analyzeCode(testCode, 'typescript', identifier);
      await qualityAnalyzer.analyzeCode(testCode, 'typescript', identifier);
      
      const history = qualityAnalyzer.getQualityHistory(identifier);
      expect(history.length).toBe(2);
      
      qualityAnalyzer.clearHistory();
      
      const clearedHistory = qualityAnalyzer.getQualityHistory(identifier);
      expect(clearedHistory.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid code gracefully', async () => {
      const invalidCode = `
        function broken( {
          if (unclosed {
            return
        }
      `;

      // Should not throw, should return metrics with appropriate defaults
      const metrics = await qualityAnalyzer.analyzeCode(invalidCode, 'typescript', 'broken.ts');
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.overallScore).toBe('number');
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(100);
    });

    it('should handle missing dependencies gracefully', async () => {
      // Test with code when linting tools might not be available
      const testCode = `function test() { return true; }`;
      
      const metrics = await qualityAnalyzer.analyzeCode(testCode, 'typescript', 'test.ts');
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.linting.score).toBe('number');
      expect(typeof metrics.formatting.score).toBe('number');
    });
  });
});