/**
 * AST-Based Security Analysis Tests
 * Validates enhanced security framework's ability to detect obfuscated attacks
 * and semantic security threats that string matching would miss
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  EnterpriseSecurityFramework,
  AgentAction,
  SecurityContext
} from '../../src/core/security/enterprise-security-framework.js';

describe('AST-Based Security Analysis - Anti-Obfuscation Tests', () => {
  let securityFramework: EnterpriseSecurityFramework;
  let testSecurityContext: SecurityContext;
  let performanceMetrics: Array<{ operation: string; duration: number; confidence: number }>;

  beforeEach(() => {
    securityFramework = new EnterpriseSecurityFramework();
    testSecurityContext = {
      userId: 'test-security-analyst',
      sessionId: `ast-analysis-${Date.now()}`,
      permissions: ['code_generation', 'file_access'],
      environment: 'testing',
      riskProfile: 'high' // High risk profile for thorough testing
    };
    performanceMetrics = [];
  });

  afterEach(() => {
    // Analyze performance metrics
    if (performanceMetrics.length > 0) {
      const avgDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length;
      const avgConfidence = performanceMetrics.reduce((sum, m) => sum + m.confidence, 0) / performanceMetrics.length;
      console.log(`Average analysis time: ${avgDuration.toFixed(2)}ms, Average confidence: ${avgConfidence.toFixed(1)}%`);
    }
  });

  describe('Direct Malicious Pattern Detection', () => {
    it('should detect direct eval() calls with high confidence', async () => {
      const startTime = Date.now();
      
      const maliciousCode = `
        function executeUserCode(userInput) {
          return eval(userInput); // Direct security threat
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'test-agent',
        payload: { 
          code: maliciousCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);
      const duration = Date.now() - startTime;

      // Should be blocked with high confidence
      expect(validation.allowed).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
      expect(validation.violations[0].confidence).toBeGreaterThanOrEqual(90);
      expect(validation.violations[0].type).toContain('malicious');
      expect(validation.violations[0].severity).toBe('critical');
      expect(duration).toBeLessThan(500); // Performance requirement

      performanceMetrics.push({
        operation: 'direct_eval_detection',
        duration,
        confidence: validation.violations[0].confidence || 0
      });
    });

    it('should detect Function constructor calls', async () => {
      const startTime = Date.now();
      
      const maliciousCode = `
        const dynamicFunction = new Function('return process.env');
        const result = dynamicFunction();
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'test-agent',
        payload: { 
          code: maliciousCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);
      const duration = Date.now() - startTime;

      expect(validation.allowed).toBe(false);
      expect(validation.violations.some(v => v.type === 'function_constructor_call')).toBe(true);
      expect(validation.violations[0].severity).toBe('high');

      performanceMetrics.push({
        operation: 'function_constructor_detection',
        duration,
        confidence: validation.violations[0].confidence || 0
      });
    });
  });

  describe('Obfuscation Resistance', () => {
    it('should detect eval() even with variable indirection', async () => {
      const obfuscatedCode = `
        const dangerousFunction = eval;
        const userCode = "process.exit(1)";
        dangerousFunction(userCode);
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'obfuscation-test',
        payload: { 
          code: obfuscatedCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      // AST analysis should still detect this despite variable indirection
      expect(validation.allowed).toBe(false);
      expect(validation.violations.some(v => v.type === 'dangerous_eval_call')).toBe(true);
    });

    it('should detect setTimeout with string arguments (code injection vector)', async () => {
      const maliciousCode = `
        function scheduleExecution(userCode) {
          setTimeout(userCode, 1000); // String execution vulnerability
        }
        scheduleExecution("console.log('injected code')");
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'timer-test',
        payload: { 
          code: maliciousCode,
          language: 'typescript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.allowed).toBe(false);
      expect(validation.violations.some(v => v.type === 'timer_string_argument')).toBe(true);
      expect(validation.violations.find(v => v.type === 'timer_string_argument')?.severity).toBe('medium');
    });

    it('should detect innerHTML assignments (XSS vectors)', async () => {
      const xssCode = `
        function updateContent(userInput) {
          document.getElementById('output').innerHTML = userInput; // XSS vulnerability
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'xss-test',
        payload: { 
          code: xssCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.allowed).toBe(false);
      expect(validation.violations.some(v => v.type === 'innerHTML_assignment')).toBe(true);
    });
  });

  describe('Context-Aware Analysis', () => {
    it('should NOT flag eval in comments or strings', async () => {
      const safeCode = `
        // This code discusses eval() but doesn't use it
        const warningMessage = "Never use eval() in production code";
        console.log(warningMessage);
        
        /* 
         * eval() is dangerous and should be avoided
         * This is just documentation
         */
        function safeFunction() {
          return "legitimate code";
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'context-test',
        payload: { 
          code: safeCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      // Should be allowed since eval is only in comments/strings
      expect(validation.allowed).toBe(true);
      expect(validation.violations.length).toBe(0);
    });

    it('should provide detailed location information for violations', async () => {
      const maliciousCodeWithLineBreaks = `
        function normalFunction() {
          return "safe";
        }
        
        function dangerousFunction() {
          eval("malicious code"); // This should be flagged on line 6
        }
        
        function anotherNormalFunction() {
          return "also safe";
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'location-test',
        payload: { 
          code: maliciousCodeWithLineBreaks,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.allowed).toBe(false);
      const evalViolation = validation.violations.find(v => v.type === 'dangerous_eval_call');
      expect(evalViolation).toBeDefined();
      expect(evalViolation?.location).toBeDefined();
      expect(evalViolation?.location?.line).toBeGreaterThan(5); // Should be around line 6
      expect(evalViolation?.context).toContain('eval'); // Should include surrounding context
    });
  });

  describe('Performance and Caching', () => {
    it('should cache analysis results for identical code', async () => {
      const testCode = `
        function testFunction() {
          return "test";
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'cache-test',
        payload: { 
          code: testCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      // First analysis
      const start1 = Date.now();
      const validation1 = await securityFramework.validateAgentAction('test', action, testSecurityContext);
      const duration1 = Date.now() - start1;

      // Second analysis (should be faster due to caching)
      const start2 = Date.now();
      const validation2 = await securityFramework.validateAgentAction('test', action, testSecurityContext);
      const duration2 = Date.now() - start2;

      // Results should be identical
      expect(validation1.allowed).toBe(validation2.allowed);
      expect(validation1.violations.length).toBe(validation2.violations.length);
      
      // Second analysis should be faster (cache hit)
      expect(duration2).toBeLessThanOrEqual(duration1);
      
      console.log(`Cache performance: First: ${duration1}ms, Second: ${duration2}ms (${((1 - duration2/duration1) * 100).toFixed(1)}% faster)`);
    });

    it('should complete analysis within 500ms for typical code', async () => {
      const complexCode = `
        class SecurityAnalyzer {
          private patterns: string[];
          
          constructor() {
            this.patterns = ['eval', 'exec', 'system'];
          }
          
          analyze(code: string): boolean {
            for (const pattern of this.patterns) {
              if (code.includes(pattern)) {
                return false;
              }
            }
            return true;
          }
          
          deepAnalysis(code: string): any {
            const ast = this.parseCode(code);
            return this.traverseAST(ast);
          }
          
          private parseCode(code: string) {
            return { type: 'Program', body: [] };
          }
          
          private traverseAST(node: any): any {
            return { safe: true, violations: [] };
          }
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'performance-test',
        payload: { 
          code: complexCode,
          language: 'typescript'
        },
        timestamp: new Date()
      };

      const startTime = Date.now();
      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Performance requirement
      expect(validation).toBeDefined();
      
      performanceMetrics.push({
        operation: 'complex_code_analysis',
        duration,
        confidence: validation.violations[0]?.confidence || 100
      });
    });
  });

  describe('Language Detection and Multi-Language Support', () => {
    it('should correctly detect TypeScript and apply appropriate rules', async () => {
      const typescriptCode = `
        interface UserData {
          id: string;
          name: string;
        }
        
        function processUser(data: UserData): void {
          eval(data.name); // Should be detected in TypeScript
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'typescript-test',
        payload: { 
          code: typescriptCode,
          language: 'typescript' // Explicitly specified
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.allowed).toBe(false);
      expect(validation.violations.some(v => v.type === 'dangerous_eval_call')).toBe(true);
    });

    it('should handle JavaScript code without TypeScript features', async () => {
      const javascriptCode = `
        function oldStyleFunction(userInput) {
          var result = eval(userInput);
          return result;
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'javascript-test',
        payload: { 
          code: javascriptCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.allowed).toBe(false);
      expect(validation.violations.some(v => v.type === 'dangerous_eval_call')).toBe(true);
    });

    it('should fallback to string matching for unsupported languages', async () => {
      const pythonCode = `
        import os
        
        def dangerous_function():
            eval("malicious code")  # Should still be detected via string matching
            return "done"
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'python-test',
        payload: { 
          code: pythonCode,
          language: 'python'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.allowed).toBe(false);
      // Should fall back to string matching
      expect(validation.violations.some(v => v.type.includes('malicious_pattern'))).toBe(true);
    });
  });

  describe('Confidence Scoring and Risk Assessment', () => {
    it('should provide higher confidence for AST analysis vs string matching', async () => {
      const jsCode = `eval("test")`;
      const pythonCode = `eval("test")`;

      const jsAction: AgentAction = {
        type: 'code_generation',
        agentId: 'confidence-js',
        payload: { code: jsCode, language: 'javascript' },
        timestamp: new Date()
      };

      const pythonAction: AgentAction = {
        type: 'code_generation',
        agentId: 'confidence-python',
        payload: { code: pythonCode, language: 'python' },
        timestamp: new Date()
      };

      const jsValidation = await securityFramework.validateAgentAction('test', jsAction, testSecurityContext);
      const pythonValidation = await securityFramework.validateAgentAction('test', pythonAction, testSecurityContext);

      // Both should be blocked
      expect(jsValidation.allowed).toBe(false);
      expect(pythonValidation.allowed).toBe(false);

      // JavaScript (AST) should have higher confidence than Python (string matching)
      const jsConfidence = jsValidation.violations.find(v => v.confidence)?.confidence || 0;
      const pythonConfidence = pythonValidation.violations.find(v => v.confidence)?.confidence || 0;
      
      expect(jsConfidence).toBeGreaterThan(pythonConfidence);
      expect(jsConfidence).toBeGreaterThanOrEqual(90); // AST analysis confidence
      expect(pythonConfidence).toBeLessThan(80); // String matching confidence
    });

    it('should correctly calculate risk scores based on violation severity', async () => {
      const criticalCode = `eval("dangerous")`;
      const mediumCode = `document.getElementById('test').innerHTML = userInput`;
      const safeCode = `console.log("safe code")`;

      const criticalAction: AgentAction = {
        type: 'code_generation',
        agentId: 'risk-critical',
        payload: { code: criticalCode, language: 'javascript' },
        timestamp: new Date()
      };

      const mediumAction: AgentAction = {
        type: 'code_generation',
        agentId: 'risk-medium',
        payload: { code: mediumCode, language: 'javascript' },
        timestamp: new Date()
      };

      const safeAction: AgentAction = {
        type: 'code_generation',
        agentId: 'risk-safe',
        payload: { code: safeCode, language: 'javascript' },
        timestamp: new Date()
      };

      const criticalValidation = await securityFramework.validateAgentAction('test', criticalAction, testSecurityContext);
      const mediumValidation = await securityFramework.validateAgentAction('test', mediumAction, testSecurityContext);
      const safeValidation = await securityFramework.validateAgentAction('test', safeAction, testSecurityContext);

      // Risk scores should be ordered: critical > medium > safe
      expect(criticalValidation.riskScore).toBeGreaterThan(mediumValidation.riskScore);
      expect(mediumValidation.riskScore).toBeGreaterThan(safeValidation.riskScore);
      expect(safeValidation.riskScore).toBeLessThan(20); // Safe code should have low risk
    });
  });

  describe('Advanced Attack Pattern Detection', () => {
    it('should detect require() calls with dynamic arguments', async () => {
      const dynamicRequireCode = `
        function loadModule(moduleName) {
          return require(moduleName); // Dynamic require - security risk
        }
        loadModule(userInput);
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'dynamic-require-test',
        payload: { 
          code: dynamicRequireCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.allowed).toBe(false);
      expect(validation.violations.some(v => v.type === 'dynamic_require_call')).toBe(true);
      expect(validation.violations.find(v => v.type === 'dynamic_require_call')?.severity).toBe('high');
    });

    it('should allow static require calls', async () => {
      const staticRequireCode = `
        const fs = require('fs');
        const path = require('path');
        
        function readFile() {
          return fs.readFileSync('./config.json', 'utf8');
        }
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'static-require-test',
        payload: { 
          code: staticRequireCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      // Static requires should be allowed
      expect(validation.allowed).toBe(true);
      expect(validation.violations.some(v => v.type === 'dynamic_require_call')).toBe(false);
    });
  });

  describe('Integration with Existing Security Framework', () => {
    it('should integrate with existing threat detection systems', async () => {
      const suspiciousCode = `
        const base64Data = "dGVzdCBkYXRh";
        const decoded = atob(base64Data);
        eval(decoded); // Both obfuscation and eval
      `;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'integration-test',
        payload: { 
          code: suspiciousCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.allowed).toBe(false);
      
      // Should detect both AST-based violations and threat assessment issues
      expect(validation.violations.some(v => v.type === 'dangerous_eval_call')).toBe(true);
      expect(validation.riskScore).toBeGreaterThan(80); // High risk due to multiple issues
    });

    it('should maintain audit trail with enhanced information', async () => {
      const maliciousCode = `eval("process.exit(1)")`;

      const action: AgentAction = {
        type: 'code_generation',
        agentId: 'audit-test',
        payload: { 
          code: maliciousCode,
          language: 'javascript'
        },
        timestamp: new Date()
      };

      const validation = await securityFramework.validateAgentAction('test', action, testSecurityContext);

      expect(validation.auditTrail).toBeDefined();
      expect(validation.auditTrail.agentId).toBe('test');
      expect(validation.auditTrail.allowed).toBe(false);
      expect(validation.auditTrail.violations.length).toBeGreaterThan(0);
      expect(validation.auditTrail.riskScore).toBeGreaterThan(0);
    });
  });
});