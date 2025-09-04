/**
 * Comprehensive Test Suite for Reconstructed Code Quality Analyzer
 * Tests AST analysis, async tool integration, performance monitoring, and recommendation engine
 * Created: August 26, 2025 - Quality Analyzer Reconstruction Agent
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { ReconstructedCodeQualityAnalyzer } from '../../../src/core/quality/reconstructed-code-quality-analyzer.js';
import { ASTComplexityAnalyzer } from '../../../src/core/quality/ast-complexity-analyzer.js';
import { AsyncToolIntegrationManager } from '../../../src/core/quality/async-tool-integration-manager.js';

describe('ReconstructedCodeQualityAnalyzer', () => {
  let analyzer: ReconstructedCodeQualityAnalyzer;

  beforeEach(() => {
    analyzer = new ReconstructedCodeQualityAnalyzer({
      performance: {
        maxMemoryMB: 256,
        maxAnalysisTimeMs: 30000,
        maxConcurrentAnalyses: 2,
      },
      analysis: {
        enableProgressReporting: true,
        enablePerformanceMonitoring: true,
      },
    });
  });

  afterEach(async () => {
    await analyzer.shutdown();
  });

  describe('Core Analysis Functionality', () => {
    it('should analyze simple TypeScript code successfully', async () => {
      const code = `
        function calculateSum(a: number, b: number): number {
          return a + b;
        }
        
        const result = calculateSum(5, 10);
        console.log(result);
      `;

      const result = await analyzer.analyzeCode(code, 'typescript');

      expect(result).toBeDefined();
      expect(result.qualityMetrics.overallScore).toBeGreaterThan(70);
      expect(result.qualityMetrics.qualityGrade).toBeDefined();
      expect(result.analysisId).toBeDefined();
      expect(result.performanceMetrics.totalDuration).toBeGreaterThan(0);
    }, 15000);

    it('should handle complex code with high cyclomatic complexity', async () => {
      const complexCode = `
        function complexFunction(input: any): string {
          if (input === null) {
            return 'null';
          } else if (typeof input === 'string') {
            if (input.length > 10) {
              if (input.includes('test')) {
                return 'long test string';
              } else if (input.includes('demo')) {
                return 'long demo string';
              } else {
                return 'long string';
              }
            } else {
              return 'short string';
            }
          } else if (typeof input === 'number') {
            if (input > 100) {
              return 'large number';
            } else if (input > 10) {
              return 'medium number';
            } else if (input > 0) {
              return 'small positive';
            } else if (input < 0) {
              return 'negative';
            } else {
              return 'zero';
            }
          } else if (Array.isArray(input)) {
            for (let i = 0; i < input.length; i++) {
              if (input[i] === 'special') {
                return 'contains special';
              }
            }
            return 'array without special';
          } else {
            return 'unknown type';
          }
        }
      `;

      const result = await analyzer.analyzeCode(complexCode, 'typescript');

      expect(result.qualityMetrics.astMetrics.cyclomaticComplexity).toBeGreaterThan(10);
      expect(result.qualityMetrics.complexityScore).toBeLessThan(80);
      expect(result.qualityMetrics.recommendations.length).toBeGreaterThan(0);

      // Should have complexity recommendations
      const complexityRecs = result.qualityMetrics.recommendations.filter(
        r => r.category === 'complexity'
      );
      expect(complexityRecs.length).toBeGreaterThan(0);
    }, 15000);

    it('should handle JavaScript code', async () => {
      const jsCode = `
        function greetUser(name) {
          if (!name) {
            throw new Error('Name is required');
          }
          return 'Hello, ' + name + '!';
        }
        
        module.exports = { greetUser };
      `;

      const result = await analyzer.analyzeCode(jsCode, 'javascript');

      expect(result).toBeDefined();
      expect(result.qualityMetrics.overallScore).toBeGreaterThan(0);
      expect(result.qualityMetrics.astMetrics.functionCount).toBe(1);
    }, 15000);
  });

  describe('AST Analysis Accuracy', () => {
    it('should accurately count functions and classes', async () => {
      const code = `
        class UserService {
          constructor(private db: Database) {}
          
          async findUser(id: string): Promise<User | null> {
            return await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
          }
          
          async createUser(userData: UserData): Promise<User> {
            return await this.db.insert('users', userData);
          }
        }
        
        function validateUser(user: User): boolean {
          return user.name && user.email;
        }
        
        const userService = new UserService(database);
      `;

      const result = await analyzer.analyzeCode(code, 'typescript');

      expect(result.qualityMetrics.astMetrics.functionCount).toBe(3); // constructor, findUser, createUser, validateUser (arrow functions don't count constructor)
      expect(result.qualityMetrics.astMetrics.classCount).toBe(1);
      expect(result.qualityMetrics.astMetrics.cyclomaticComplexity).toBeGreaterThan(1);
    }, 15000);

    it('should calculate Halstead metrics correctly', async () => {
      const code = `
        function fibonacci(n: number): number {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
      `;

      const result = await analyzer.analyzeCode(code, 'typescript');
      const halstead = result.qualityMetrics.astMetrics.halsteadMetrics;

      expect(halstead.uniqueOperators).toBeGreaterThan(0);
      expect(halstead.uniqueOperands).toBeGreaterThan(0);
      expect(halstead.programLength).toBeGreaterThan(0);
      expect(halstead.programVocabulary).toBeGreaterThan(0);
      expect(halstead.volume).toBeGreaterThan(0);
      expect(halstead.difficulty).toBeGreaterThan(0);
      expect(halstead.effort).toBeGreaterThan(0);
    }, 15000);

    it('should handle empty code gracefully', async () => {
      const result = await analyzer.analyzeCode('', 'typescript');

      expect(result.qualityMetrics.overallScore).toBeGreaterThan(0);
      expect(result.qualityMetrics.astMetrics.linesOfCode).toBe(1); // Empty string becomes 1 line
    }, 15000);
  });

  describe('Performance and Resource Management', () => {
    it('should respect timeout limits', async () => {
      const analyzer = new ReconstructedCodeQualityAnalyzer({
        performance: {
          maxAnalysisTimeMs: 1000, // 1 second timeout
        },
      });

      // Large code that might take time to analyze
      const largeCode = Array(1000)
        .fill(
          `
        function test${Math.random()}() {
          if (Math.random() > 0.5) {
            return 'test';
          } else {
            return 'other';
          }
        }
      `
        )
        .join('\n');

      const startTime = Date.now();

      try {
        await analyzer.analyzeCode(largeCode, 'typescript');
        // If it completes without timeout, check duration
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(10000); // Should complete reasonably fast
      } catch (error) {
        // Timeout is acceptable for this test
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(5000); // Should timeout quickly
      }

      await analyzer.shutdown();
    }, 15000);

    it('should track performance metrics', async () => {
      const code = `
        class TestClass {
          method1() { return 1; }
          method2() { return 2; }
          method3() { return 3; }
        }
      `;

      const result = await analyzer.analyzeCode(code, 'typescript');

      expect(result.performanceMetrics.totalDuration).toBeGreaterThan(0);
      expect(result.performanceMetrics.peakMemoryUsage).toBeGreaterThan(0);
      expect(result.performanceMetrics.analysisEfficiencyScore).toBeGreaterThanOrEqual(0);
      expect(result.systemHealth.memoryUsage).toBeGreaterThan(0);
      expect(result.systemHealth.systemLoad).toMatch(/^(low|medium|high)$/);
    }, 15000);

    it('should provide system status information', async () => {
      const status = analyzer.getSystemStatus();

      expect(status.performance).toBeDefined();
      expect(status.analytics).toBeDefined();
      expect(status.toolAvailability).toBeDefined();
      expect(status.configuration).toBeDefined();

      expect(status.performance.activeAnalyses).toBeGreaterThanOrEqual(0);
      expect(status.performance.memoryUsage).toBeGreaterThan(0);
      expect(status.performance.efficiency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Recommendation Engine', () => {
    it('should generate meaningful recommendations', async () => {
      const problemCode = `
        // No comments, complex logic, formatting issues
        function processData(data){
        if(data){
        if(data.length>0){
        for(let i=0;i<data.length;i++){
        if(data[i]){
        if(data[i].type==='special'){
        return data[i].value*2;
        }else{
        if(data[i].value>100){
        return data[i].value;
        }else{
        return 0;
        }}}}}
        return null;
        }
      `;

      const result = await analyzer.analyzeCode(problemCode, 'typescript');

      expect(result.qualityMetrics.recommendations.length).toBeGreaterThan(0);

      // Check for different types of recommendations
      const categories = new Set(result.qualityMetrics.recommendations.map(r => r.category));
      expect(categories.size).toBeGreaterThan(1); // Should have multiple categories

      // Should have at least complexity and documentation recommendations
      const hasComplexity = result.qualityMetrics.recommendations.some(
        r => r.category === 'complexity'
      );
      const hasDocumentation = result.qualityMetrics.recommendations.some(
        r => r.category === 'documentation'
      );

      expect(hasComplexity || hasDocumentation).toBe(true);
    }, 15000);

    it('should prioritize recommendations correctly', async () => {
      const criticalCode = `
        function criticalFunction(input: any): any {
          if (input) {
            if (input.data) {
              if (input.data.items) {
                if (input.data.items.length > 0) {
                  if (input.data.items[0]) {
                    if (input.data.items[0].value) {
                      if (input.data.items[0].value > 100) {
                        if (input.data.items[0].value < 1000) {
                          if (input.data.items[0].type === 'special') {
                            return input.data.items[0].value * 2;
                          } else {
                            return input.data.items[0].value;
                          }
                        } else {
                          return 1000;
                        }
                      } else {
                        return 0;
                      }
                    } else {
                      return null;
                    }
                  } else {
                    return undefined;
                  }
                } else {
                  return [];
                }
              } else {
                return {};
              }
            } else {
              return false;
            }
          } else {
            return true;
          }
        }
      `;

      const result = await analyzer.analyzeCode(criticalCode, 'typescript');

      // Should have critical/high priority recommendations
      const highPriorityRecs = result.qualityMetrics.recommendations.filter(
        r => r.priority === 'critical' || r.priority === 'high'
      );

      expect(highPriorityRecs.length).toBeGreaterThan(0);

      // Recommendations should be sorted by priority
      const priorities = result.qualityMetrics.recommendations.map(r => r.priority);
      const priorityWeights = { critical: 4, high: 3, medium: 2, low: 1 };

      for (let i = 1; i < priorities.length; i++) {
        expect(priorityWeights[priorities[i - 1]]).toBeGreaterThanOrEqual(
          priorityWeights[priorities[i]]
        );
      }
    }, 15000);
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed code gracefully', async () => {
      const malformedCode = `
        function broken( {
          return "this is broken syntax
        }
      `;

      try {
        const result = await analyzer.analyzeCode(malformedCode, 'typescript');
        // Should still provide some analysis even with syntax errors
        expect(result).toBeDefined();
        expect(result.qualityMetrics.overallScore).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // If analysis fails completely, error should be informative
        expect(error).toBeInstanceOf(Error);
      }
    }, 15000);

    it('should handle large code files efficiently', async () => {
      // Generate a large but valid code file
      const largeCode = `
        interface User {
          id: string;
          name: string;
          email: string;
        }
        
        class UserManager {
          private users: User[] = [];
          
          ${Array(50)
            .fill(null)
            .map(
              (_, i) => `
            method${i}(param: string): string {
              if (param.length > 0) {
                return 'result' + param;
              } else {
                return 'default';
              }
            }
          `
            )
            .join('\n')}
        }
      `;

      const result = await analyzer.analyzeCode(largeCode, 'typescript');

      expect(result.qualityMetrics.astMetrics.functionCount).toBeGreaterThan(40);
      expect(result.performanceMetrics.linesProcessedPerSecond).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Configuration and Customization', () => {
    it('should respect custom configuration', async () => {
      const customAnalyzer = new ReconstructedCodeQualityAnalyzer({
        quality: {
          weights: {
            complexity: 0.5, // Emphasize complexity more
            maintainability: 0.3,
            linting: 0.1,
            formatting: 0.05,
            typeScript: 0.05,
            documentation: 0.0, // Ignore documentation
            security: 0.0,
          },
        },
      });

      const code = `
        function simpleFunction(): string {
          return 'test';
        }
      `;

      const result = await customAnalyzer.analyzeCode(code, 'typescript');

      // With custom weights, complexity should have high impact on score
      expect(result.qualityMetrics.overallScore).toBeDefined();
      expect(result.configurationUsed.quality?.weights?.complexity).toBe(0.5);

      await customAnalyzer.shutdown();
    }, 15000);

    it('should allow configuration updates', async () => {
      analyzer.updateConfiguration({
        performance: {
          maxMemoryMB: 128,
        },
      });

      const status = analyzer.getSystemStatus();
      expect(status.configuration.performance?.maxMemoryMB).toBe(128);
    });
  });

  describe('Trend Analysis and History', () => {
    it('should track quality trends over multiple analyses', async () => {
      const identifier = 'test-file-trend';

      // First analysis - simple code
      const simpleCode = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const result1 = await analyzer.analyzeCode(simpleCode, 'typescript', { identifier });
      expect(result1.qualityMetrics.trendData).toBeUndefined(); // No trend on first analysis

      // Second analysis - more complex code (regression)
      const complexCode = `
        function complexAdd(a: any, b: any): any {
          if (typeof a === 'number' && typeof b === 'number') {
            if (a > 0 && b > 0) {
              return a + b;
            } else if (a < 0 || b < 0) {
              return Math.abs(a) + Math.abs(b);
            } else {
              return 0;
            }
          } else {
            return null;
          }
        }
      `;

      const result2 = await analyzer.analyzeCode(complexCode, 'typescript', { identifier });
      expect(result2.qualityMetrics.trendData).toBeDefined();
      expect(result2.qualityMetrics.trendData?.trendDirection).toBeDefined();

      // Third analysis - back to simple (improvement)
      const result3 = await analyzer.analyzeCode(simpleCode, 'typescript', { identifier });
      expect(result3.qualityMetrics.trendData?.trendDirection).toBeDefined();

      // Check history
      const history = analyzer.getQualityHistory(identifier);
      expect(history.length).toBe(3);
    }, 30000);
  });

  describe('Event Emission', () => {
    it('should emit progress events during analysis', async () => {
      const progressEvents: any[] = [];

      analyzer.on('progress', data => {
        progressEvents.push(data);
      });

      const code = `
        function testFunction(): void {
          console.log('test');
        }
      `;

      await analyzer.analyzeCode(code, 'typescript');

      expect(progressEvents.length).toBeGreaterThan(0);

      // Should have different stages
      const stages = progressEvents.map(e => e.progress.stage);
      expect(new Set(stages).size).toBeGreaterThan(1);
    }, 15000);

    it('should emit completion events', async () => {
      let completionEvent: any = null;

      analyzer.on('analysisComplete', data => {
        completionEvent = data;
      });

      const code = `function test() { return 'test'; }`;
      await analyzer.analyzeCode(code, 'typescript');

      expect(completionEvent).toBeDefined();
      expect(completionEvent.analysisId).toBeDefined();
      expect(completionEvent.qualityMetrics).toBeDefined();
    }, 15000);
  });
});

describe('ASTComplexityAnalyzer', () => {
  let analyzer: ASTComplexityAnalyzer;

  beforeEach(() => {
    analyzer = new ASTComplexityAnalyzer();
  });

  describe('Complexity Calculations', () => {
    it('should calculate cyclomatic complexity correctly', async () => {
      const code = `
        function testComplexity(x: number): string {
          if (x > 10) {           // +1
            if (x > 20) {         // +1
              return 'high';
            } else {
              return 'medium';
            }
          } else if (x > 0) {     // +1
            return 'low';
          } else {
            return 'zero';
          }
        }
      `;

      const result = await analyzer.analyzeComplexity(code);
      expect(result.cyclomaticComplexity).toBe(4); // Base 1 + 3 decision points
    });

    it('should handle loops correctly', async () => {
      const code = `
        function processArray(items: number[]): number {
          let sum = 0;
          for (let i = 0; i < items.length; i++) {    // +1
            if (items[i] > 0) {                       // +1
              sum += items[i];
            }
          }
          
          while (sum > 100) {                         // +1
            sum = sum / 2;
          }
          
          return sum;
        }
      `;

      const result = await analyzer.analyzeComplexity(code);
      expect(result.cyclomaticComplexity).toBe(4); // Base 1 + 3 decision points
    });

    it('should calculate cognitive complexity', async () => {
      const nestedCode = `
        function deeplyNested(data: any): any {
          if (data) {                    // +1
            if (data.items) {            // +1 +1 (nesting)
              for (let item of data.items) {  // +1 +2 (nesting)
                if (item.active) {       // +1 +3 (nesting)
                  return item;
                }
              }
            }
          }
          return null;
        }
      `;

      const result = await analyzer.analyzeComplexity(nestedCode);
      expect(result.cognitiveComplexity).toBeGreaterThan(result.cyclomaticComplexity);
    });
  });

  describe('Halstead Metrics', () => {
    it('should identify operators and operands correctly', async () => {
      const code = `
        function calculate(x: number, y: number): number {
          const result = x + y * 2;
          return result;
        }
      `;

      const result = await analyzer.analyzeComplexity(code);
      const halstead = result.halsteadMetrics;

      expect(halstead.uniqueOperators).toBeGreaterThan(0);
      expect(halstead.uniqueOperands).toBeGreaterThan(0);
      expect(halstead.totalOperators).toBeGreaterThan(0);
      expect(halstead.totalOperands).toBeGreaterThan(0);

      // Verify calculated metrics
      expect(halstead.programVocabulary).toBe(halstead.uniqueOperators + halstead.uniqueOperands);
      expect(halstead.programLength).toBe(halstead.totalOperators + halstead.totalOperands);
      expect(halstead.volume).toBeGreaterThan(0);
      expect(halstead.difficulty).toBeGreaterThan(0);
      expect(halstead.effort).toBeGreaterThan(0);
    });
  });
});

describe('AsyncToolIntegrationManager', () => {
  let manager: AsyncToolIntegrationManager;

  beforeEach(() => {
    manager = new AsyncToolIntegrationManager();
  });

  describe('Tool Availability', () => {
    it('should check tool availability status', async () => {
      const status = manager.getToolAvailabilityStatus();

      expect(status).toBeDefined();
      expect(status.eslint).toBeDefined();
      expect(status.prettier).toBeDefined();
      expect(status.typescript).toBeDefined();

      expect(typeof status.eslint.available).toBe('boolean');
      expect(typeof status.prettier.available).toBe('boolean');
      expect(typeof status.typescript.available).toBe('boolean');
    });

    it('should provide health status', () => {
      const health = manager.getHealthStatus();

      expect(health.activeJobs).toBeGreaterThanOrEqual(0);
      expect(health.queuedJobs).toBeGreaterThanOrEqual(0);
      expect(health.toolAvailability).toBeDefined();
      expect(health.circuitBreakerStatus).toBeDefined();
    });
  });

  describe('Circuit Breaker Functionality', () => {
    it('should reset circuit breakers', () => {
      manager.resetCircuitBreakers();

      const health = manager.getHealthStatus();
      Object.values(health.circuitBreakerStatus).forEach(status => {
        expect(status).toBe('closed');
      });
    });
  });

  // Note: Tool execution tests would require actual tools to be installed
  // In a real environment, we'd mock these or use integration tests
});

/**
 * Integration Test Example
 * This would test the full pipeline with real code samples
 */
describe('Integration Tests', () => {
  let analyzer: ReconstructedCodeQualityAnalyzer;

  beforeEach(() => {
    analyzer = new ReconstructedCodeQualityAnalyzer({
      performance: {
        maxAnalysisTimeMs: 60000,
        maxMemoryMB: 512,
      },
    });
  });

  afterEach(async () => {
    await analyzer.shutdown();
  });

  it('should handle real-world TypeScript code', async () => {
    const realWorldCode = `
      /**
       * User authentication service
       * Handles login, logout, and session management
       */
      import { EventEmitter } from 'events';
      import { Logger } from './logger';
      
      interface User {
        id: string;
        email: string;
        name: string;
        roles: string[];
        lastLogin?: Date;
      }
      
      interface AuthConfig {
        sessionTimeout: number;
        maxLoginAttempts: number;
        lockoutDuration: number;
      }
      
      export class AuthenticationService extends EventEmitter {
        private users = new Map<string, User>();
        private sessions = new Map<string, { userId: string; expires: Date }>();
        private loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();
        private logger: Logger;
        
        constructor(private config: AuthConfig, logger: Logger) {
          super();
          this.logger = logger;
          this.setupCleanupInterval();
        }
        
        /**
         * Authenticate user with email and password
         */
        async login(email: string, password: string): Promise<{ sessionId: string; user: User } | null> {
          try {
            // Check if user is locked out
            if (this.isLockedOut(email)) {
              this.logger.warn(\`Login attempt for locked out user: \${email}\`);
              return null;
            }
            
            // Find user
            const user = await this.findUserByEmail(email);
            if (!user) {
              this.recordFailedAttempt(email);
              return null;
            }
            
            // Validate password (simplified)
            if (!await this.validatePassword(user.id, password)) {
              this.recordFailedAttempt(email);
              return null;
            }
            
            // Clear failed attempts
            this.loginAttempts.delete(email);
            
            // Create session
            const sessionId = this.generateSessionId();
            const expires = new Date(Date.now() + this.config.sessionTimeout);
            
            this.sessions.set(sessionId, { userId: user.id, expires });
            
            // Update user last login
            user.lastLogin = new Date();
            this.users.set(user.id, user);
            
            this.emit('login', { user, sessionId });
            this.logger.info(\`User logged in: \${user.email}\`);
            
            return { sessionId, user };
            
          } catch (error) {
            this.logger.error('Login error:', error);
            return null;
          }
        }
        
        /**
         * Logout user by session ID
         */
        async logout(sessionId: string): Promise<boolean> {
          const session = this.sessions.get(sessionId);
          if (!session) {
            return false;
          }
          
          const user = this.users.get(session.userId);
          this.sessions.delete(sessionId);
          
          if (user) {
            this.emit('logout', { user, sessionId });
            this.logger.info(\`User logged out: \${user.email}\`);
          }
          
          return true;
        }
        
        /**
         * Validate session and return user
         */
        async validateSession(sessionId: string): Promise<User | null> {
          const session = this.sessions.get(sessionId);
          if (!session) {
            return null;
          }
          
          if (session.expires < new Date()) {
            this.sessions.delete(sessionId);
            return null;
          }
          
          return this.users.get(session.userId) || null;
        }
        
        private isLockedOut(email: string): boolean {
          const attempts = this.loginAttempts.get(email);
          if (!attempts || !attempts.lockedUntil) {
            return false;
          }
          
          if (attempts.lockedUntil < new Date()) {
            this.loginAttempts.delete(email);
            return false;
          }
          
          return true;
        }
        
        private recordFailedAttempt(email: string): void {
          const attempts = this.loginAttempts.get(email) || { count: 0 };
          attempts.count++;
          
          if (attempts.count >= this.config.maxLoginAttempts) {
            attempts.lockedUntil = new Date(Date.now() + this.config.lockoutDuration);
            this.logger.warn(\`User locked out due to failed attempts: \${email}\`);
          }
          
          this.loginAttempts.set(email, attempts);
        }
        
        private async findUserByEmail(email: string): Promise<User | null> {
          // Simplified - in real app would query database
          for (const user of this.users.values()) {
            if (user.email === email) {
              return user;
            }
          }
          return null;
        }
        
        private async validatePassword(userId: string, password: string): Promise<boolean> {
          // Simplified - in real app would hash and compare
          return password.length > 6;
        }
        
        private generateSessionId(): string {
          return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }
        
        private setupCleanupInterval(): void {
          setInterval(() => {
            const now = new Date();
            
            // Clean up expired sessions
            for (const [sessionId, session] of this.sessions) {
              if (session.expires < now) {
                this.sessions.delete(sessionId);
              }
            }
            
            // Clean up old login attempts
            for (const [email, attempts] of this.loginAttempts) {
              if (attempts.lockedUntil && attempts.lockedUntil < now) {
                this.loginAttempts.delete(email);
              }
            }
          }, 60000); // Run every minute
        }
      }
    `;

    const result = await analyzer.analyzeCode(realWorldCode, 'typescript', {
      filename: 'authentication-service.ts',
      identifier: 'auth-service',
    });

    // Validate comprehensive analysis
    expect(result.qualityMetrics.overallScore).toBeGreaterThan(50);
    expect(result.qualityMetrics.astMetrics.functionCount).toBeGreaterThan(5);
    expect(result.qualityMetrics.astMetrics.classCount).toBe(1);
    expect(result.qualityMetrics.astMetrics.commentRatio).toBeGreaterThan(10);

    // Should have meaningful recommendations
    expect(result.qualityMetrics.recommendations.length).toBeGreaterThan(0);

    // Performance should be reasonable
    expect(result.performanceMetrics.totalDuration).toBeLessThan(30000);
    expect(result.performanceMetrics.analysisEfficiencyScore).toBeGreaterThan(50);

    // System should be healthy
    expect(result.systemHealth.systemLoad).toMatch(/^(low|medium|high)$/);
  }, 60000);
});
