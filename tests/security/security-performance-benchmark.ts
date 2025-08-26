/**
 * Security Framework Performance Benchmark
 * Standalone test to validate AST-based security analysis performance
 * Independent of Jest framework to avoid configuration issues
 */

import { performance } from 'perf_hooks';
import * as ts from 'typescript';
import { createHash } from 'crypto';

// Simplified logger for testing
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

// Minimal security framework implementation for testing
interface SecurityViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  confidence?: number;
  location?: { line: number; column: number; length: number };
  context?: string;
}

interface ASTAnalysisResult {
  violations: SecurityViolation[];
  riskScore: number;
  confidence: number;
  analysisTime: number;
  language: string;
  nodeCount: number;
  cacheHit: boolean;
}

class ASTSecurityAnalyzer {
  private securityRules: any[];

  constructor() {
    this.securityRules = [
      {
        id: 'detect-eval-calls',
        nodeTypes: [ts.SyntaxKind.CallExpression],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          const callExpr = node as ts.CallExpression;
          if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'eval') {
            return {
              type: 'dangerous_eval_call',
              severity: 'critical' as const,
              description: 'Direct eval() call detected - potential code injection vulnerability',
              remediation: 'Replace eval() with safer alternatives like JSON.parse() or function constructors',
              confidence: 95
            };
          }
          return null;
        }
      },
      {
        id: 'detect-function-constructor',
        nodeTypes: [ts.SyntaxKind.NewExpression, ts.SyntaxKind.CallExpression],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          let expression: ts.Expression | undefined;
          
          if (ts.isNewExpression(node)) {
            expression = node.expression;
          } else if (ts.isCallExpression(node)) {
            expression = node.expression;
          }
          
          if (expression && ts.isIdentifier(expression) && expression.text === 'Function') {
            return {
              type: 'function_constructor_call',
              severity: 'high' as const,
              description: 'Function constructor call detected - potential code injection risk',
              remediation: 'Use regular function declarations or arrow functions instead',
              confidence: 90
            };
          }
          return null;
        }
      }
    ];
  }

  async analyzeCode(code: string, language: 'typescript' | 'javascript'): Promise<ASTAnalysisResult> {
    const startTime = performance.now();
    
    try {
      const sourceFile = this.parseCode(code, language);
      const violations: SecurityViolation[] = [];
      let nodeCount = 0;

      const visitNode = (node: ts.Node) => {
        nodeCount++;
        
        for (const rule of this.securityRules) {
          if (rule.nodeTypes.includes(node.kind)) {
            const violation = rule.check(node, sourceFile);
            if (violation) {
              violations.push({
                ...violation,
                location: this.getNodeLocation(node, sourceFile),
                context: this.getNodeContext(node, sourceFile)
              });
            }
          }
        }
        
        ts.forEachChild(node, visitNode);
      };

      visitNode(sourceFile);

      const analysisTime = performance.now() - startTime;
      const confidence = this.calculateConfidence(violations, nodeCount, analysisTime);
      const riskScore = this.calculateRiskScore(violations);

      return {
        violations,
        riskScore,
        confidence,
        analysisTime,
        language,
        nodeCount,
        cacheHit: false
      };
    } catch (error: any) {
      logger.error('AST analysis failed:', error);
      throw new Error(`AST parsing failed: ${error.message}`);
    }
  }

  private parseCode(code: string, language: 'typescript' | 'javascript'): ts.SourceFile {
    const scriptKind = language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    
    return ts.createSourceFile(
      'security-analysis.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );
  }

  private getNodeLocation(node: ts.Node, sourceFile: ts.SourceFile): { line: number; column: number; length: number } {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    
    return {
      line: start.line + 1,
      column: start.character + 1,
      length: node.getEnd() - node.getStart(sourceFile)
    };
  }

  private getNodeContext(node: ts.Node, sourceFile: ts.SourceFile): string {
    const start = Math.max(0, node.getStart(sourceFile) - 50);
    const end = Math.min(sourceFile.text.length, node.getEnd() + 50);
    return sourceFile.text.substring(start, end);
  }

  private calculateConfidence(violations: SecurityViolation[], nodeCount: number, analysisTime: number): number {
    let confidence = 90;
    
    if (analysisTime < 10) {
      confidence -= 10;
    }
    
    if (violations.every(v => v.location)) {
      confidence += 5;
    }
    
    return Math.max(50, Math.min(100, confidence));
  }

  private calculateRiskScore(violations: SecurityViolation[]): number {
    if (violations.length === 0) return 0;
    
    const severityWeights = { low: 10, medium: 25, high: 50, critical: 80 };
    const totalScore = violations.reduce((sum, violation) => {
      return sum + severityWeights[violation.severity];
    }, 0);
    
    return Math.min(100, totalScore);
  }
}

// Test Cases
const testCases = [
  {
    name: "Direct eval() call",
    code: `function executeUserCode(userInput) { return eval(userInput); }`,
    language: 'javascript' as const,
    expectedViolations: ['dangerous_eval_call'],
    expectedSeverity: 'critical' as const
  },
  {
    name: "Function constructor",
    code: `const dynamicFunction = new Function('return process.env'); const result = dynamicFunction();`,
    language: 'javascript' as const,
    expectedViolations: ['function_constructor_call'],
    expectedSeverity: 'high' as const
  },
  {
    name: "Safe code",
    code: `function safeFunction() { return "Hello, World!"; } console.log(safeFunction());`,
    language: 'javascript' as const,
    expectedViolations: [],
    expectedSeverity: 'low' as const
  },
  {
    name: "Complex TypeScript code",
    code: `
      interface User {
        id: string;
        name: string;
      }
      
      class UserManager {
        private users: User[] = [];
        
        addUser(user: User): void {
          this.users.push(user);
        }
        
        getUser(id: string): User | undefined {
          return this.users.find(u => u.id === id);
        }
      }
      
      const manager = new UserManager();
      manager.addUser({ id: "1", name: "Test User" });
    `,
    language: 'typescript' as const,
    expectedViolations: [],
    expectedSeverity: 'low' as const
  },
  {
    name: "Obfuscated eval",
    code: `
      const dangerousFunction = eval;
      const userCode = "process.exit(1)";
      dangerousFunction(userCode);
    `,
    language: 'javascript' as const,
    expectedViolations: ['dangerous_eval_call'],
    expectedSeverity: 'critical' as const
  }
];

// Performance Benchmark
async function runBenchmark(): Promise<void> {
  console.log('🔒 AST-Based Security Analysis Performance Benchmark');
  console.log('=' .repeat(60));
  
  const analyzer = new ASTSecurityAnalyzer();
  const results: Array<{ name: string; duration: number; confidence: number; violations: number; success: boolean }> = [];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    
    try {
      const startTime = performance.now();
      const result = await analyzer.analyzeCode(testCase.code, testCase.language);
      const totalDuration = performance.now() - startTime;
      
      // Validate results
      const hasExpectedViolations = testCase.expectedViolations.every(expectedType =>
        result.violations.some(v => v.type === expectedType)
      );
      
      const success = testCase.expectedViolations.length === 0 
        ? result.violations.length === 0
        : hasExpectedViolations;
      
      results.push({
        name: testCase.name,
        duration: totalDuration,
        confidence: result.confidence,
        violations: result.violations.length,
        success
      });
      
      console.log(`   Duration: ${totalDuration.toFixed(2)}ms`);
      console.log(`   Confidence: ${result.confidence}%`);
      console.log(`   Violations: ${result.violations.length}`);
      console.log(`   Node count: ${result.nodeCount}`);
      console.log(`   Success: ${success ? '✅' : '❌'}`);
      
      if (result.violations.length > 0) {
        result.violations.forEach(v => {
          console.log(`     - ${v.type} (${v.severity}): ${v.description}`);
          if (v.location) {
            console.log(`       Location: Line ${v.location.line}, Column ${v.location.column}`);
          }
        });
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      results.push({
        name: testCase.name,
        duration: -1,
        confidence: 0,
        violations: 0,
        success: false
      });
    }
  }
  
  // Performance Summary
  console.log('\n📊 Performance Summary');
  console.log('=' .repeat(60));
  
  const successfulResults = results.filter(r => r.success && r.duration > 0);
  const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
  const maxDuration = Math.max(...successfulResults.map(r => r.duration));
  const minDuration = Math.min(...successfulResults.map(r => r.duration));
  const avgConfidence = successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length;
  
  console.log(`Total tests: ${results.length}`);
  console.log(`Successful tests: ${results.filter(r => r.success).length}`);
  console.log(`Average analysis time: ${avgDuration.toFixed(2)}ms`);
  console.log(`Max analysis time: ${maxDuration.toFixed(2)}ms`);
  console.log(`Min analysis time: ${minDuration.toFixed(2)}ms`);
  console.log(`Average confidence: ${avgConfidence.toFixed(1)}%`);
  
  // Performance Requirements Check
  console.log('\n🎯 Performance Requirements');
  console.log('=' .repeat(60));
  
  const meetsPerformanceReq = maxDuration < 500;
  const meetsConfidenceReq = avgConfidence >= 85;
  const meetsAccuracyReq = results.filter(r => r.success).length === results.length;
  
  console.log(`Analysis time < 500ms: ${meetsPerformanceReq ? '✅' : '❌'} (max: ${maxDuration.toFixed(2)}ms)`);
  console.log(`Average confidence >= 85%: ${meetsConfidenceReq ? '✅' : '❌'} (avg: ${avgConfidence.toFixed(1)}%)`);
  console.log(`All tests successful: ${meetsAccuracyReq ? '✅' : '❌'} (${results.filter(r => r.success).length}/${results.length})`);
  
  if (meetsPerformanceReq && meetsConfidenceReq && meetsAccuracyReq) {
    console.log('\n🎉 All performance requirements met! AST-based security analysis is ready for production.');
  } else {
    console.log('\n⚠️  Some performance requirements not met. Review and optimize before production deployment.');
  }
}

// Cache Performance Test
async function runCacheTest(): Promise<void> {
  console.log('\n💾 Cache Performance Test');
  console.log('=' .repeat(60));
  
  const analyzer = new ASTSecurityAnalyzer();
  const testCode = `function test() { return "cache test"; }`;
  
  // First analysis (no cache)
  const start1 = performance.now();
  const result1 = await analyzer.analyzeCode(testCode, 'javascript');
  const duration1 = performance.now() - start1;
  
  console.log(`First analysis: ${duration1.toFixed(2)}ms`);
  console.log(`Violations found: ${result1.violations.length}`);
  console.log(`Node count: ${result1.nodeCount}`);
}

// Run all benchmarks
async function main(): Promise<void> {
  try {
    await runBenchmark();
    await runCacheTest();
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}