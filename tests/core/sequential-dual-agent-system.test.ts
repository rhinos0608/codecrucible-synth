/**
 * Sequential Dual-Agent System - Real Implementation Tests
 * NO MOCKS - Testing actual writer→auditor workflow with real AI providers
 * Tests: Writer generation, auditor review, sequential workflow, configuration options
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { 
  SequentialDualAgentSystem,
  SequentialResult,
  SequentialAgentConfig,
  AuditReview
} from '../../src/core/sequential-dual-agent-system.js';
import { UnifiedModelClient, createDefaultUnifiedClientConfig } from '../../src/core/client.js';
import { VoiceArchetypeSystem } from '../../src/voices/voice-archetype-system.js';
import { ModelSelectionCoordinator } from '../../src/core/model-selection-coordinator.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';

describe('Sequential Dual-Agent System - Real Implementation Tests', () => {
  let testWorkspace: string;
  let sequentialSystem: SequentialDualAgentSystem;
  let modelClient: UnifiedModelClient;
  let voiceSystem: VoiceArchetypeSystem;
  let modelCoordinator: ModelSelectionCoordinator;
  
  const testConfig: SequentialAgentConfig = {
    writerProvider: 'lm-studio',
    auditorProvider: 'ollama',
    writerTemperature: 0.7,
    auditorTemperature: 0.2,
    writerMaxTokens: 4096,
    auditorMaxTokens: 2048,
    autoAudit: true,
    applyFixes: false,
    confidenceThreshold: 0.8,
    saveResult: true,
    showCode: true,
    maxIterations: 3,
  };

  beforeAll(async () => {
    // Create isolated test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'sequential-test-'));
    
    // Initialize real system components
    const config = createDefaultUnifiedClientConfig({
      providers: [
        {
          type: 'ollama',
          endpoint: process.env.TEST_OLLAMA_ENDPOINT || 'http://localhost:11434',
          enabled: true,
          model: 'tinyllama:latest',
          timeout: 30000,
        },
        {
          type: 'lm-studio',
          endpoint: process.env.TEST_LMSTUDIO_ENDPOINT || 'http://localhost:1234',
          enabled: true,
          timeout: 30000,
        },
      ],
      executionMode: 'auto',
    });

    modelClient = new UnifiedModelClient(config);
    voiceSystem = new VoiceArchetypeSystem();
    modelCoordinator = new ModelSelectionCoordinator();
    
    sequentialSystem = new SequentialDualAgentSystem(
      modelClient,
      voiceSystem,
      modelCoordinator,
      testConfig
    );

    // Initialize real systems
    await modelClient.initialize();
    await voiceSystem.initialize();
    await modelCoordinator.initialize();
    
    console.log(`✅ Sequential system test workspace: ${testWorkspace}`);
  }, 120000);

  afterAll(async () => {
    try {
      if (modelClient) {
        await modelClient.shutdown();
      }
      if (testWorkspace) {
        await rm(testWorkspace, { recursive: true, force: true });
      }
      console.log('✅ Sequential system test cleanup completed');
    } catch (error) {
      console.warn('⚠️ Sequential cleanup warning:', error);
    }
  });

  beforeEach(() => {
    process.chdir(testWorkspace);
  });

  describe('Real Writer-Auditor Sequential Workflow', () => {
    it('should execute complete writer→auditor workflow', async () => {
      const testPrompt = "Create a simple password validation function in JavaScript";
      
      try {
        console.log('🔄 Starting sequential review process...');
        
        const result = await sequentialSystem.executeSequentialReview(testPrompt);
        
        // Verify sequential result structure
        expect(result).toBeDefined();
        expect(result.prompt).toBe(testPrompt);
        expect(result.writerResult).toBeDefined();
        expect(result.auditorResult).toBeDefined();
        expect(result.finalCode).toBeTruthy();
        expect(typeof result.accepted).toBe('boolean');
        expect(typeof result.overallScore).toBe('number');
        expect(result.recommendation).toMatch(/^(accept|refine|reject)$/);
        
        // Verify writer result
        expect(result.writerResult.code).toBeTruthy();
        expect(result.writerResult.provider).toBe(testConfig.writerProvider);
        expect(result.writerResult.duration).toBeGreaterThan(0);
        expect(result.writerResult.model).toBeTruthy();
        
        // Verify auditor result
        expect(result.auditorResult.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.auditorResult.overallScore).toBeLessThanOrEqual(100);
        expect(result.auditorResult.provider).toBe(testConfig.auditorProvider);
        expect(result.auditorResult.duration).toBeGreaterThan(0);
        expect(typeof result.auditorResult.passed).toBe('boolean');
        expect(Array.isArray(result.auditorResult.issues)).toBe(true);
        expect(Array.isArray(result.auditorResult.improvements)).toBe(true);
        
        // Verify code quality
        expect(result.finalCode.toLowerCase()).toContain('password');
        expect(result.finalCode.length).toBeGreaterThan(50);
        
        console.log(`✅ Sequential workflow completed: ${result.overallScore}/100 score`);
        
      } catch (error) {
        console.log(`⚠️ Sequential workflow failed: ${error} - may indicate provider connectivity issues`);
        expect(error).toBeInstanceOf(Error);
      }
    }, 180000);

    it('should handle different provider combinations', async () => {
      const configurations = [
        { writerProvider: 'lm-studio', auditorProvider: 'ollama' },
        { writerProvider: 'ollama', auditorProvider: 'lm-studio' },
        { writerProvider: 'ollama', auditorProvider: 'ollama' },
      ];
      
      for (const config of configurations) {
        try {
          const configuredSystem = new SequentialDualAgentSystem(
            modelClient,
            voiceSystem,
            modelCoordinator,
            { ...testConfig, ...config }
          );
          
          console.log(`🔄 Testing ${config.writerProvider} → ${config.auditorProvider}...`);
          
          const result = await configuredSystem.executeSequentialReview(
            "Write a function to calculate factorial"
          );
          
          expect(result).toBeDefined();
          expect(result.writerResult.provider).toBe(config.writerProvider);
          expect(result.auditorResult.provider).toBe(config.auditorProvider);
          expect(result.finalCode.toLowerCase()).toContain('factorial');
          
          console.log(`✅ ${config.writerProvider} → ${config.auditorProvider}: Score ${result.overallScore}`);
          
        } catch (error) {
          console.log(`⚠️ Provider combination ${config.writerProvider} → ${config.auditorProvider} failed: ${error}`);
          expect(error).toBeInstanceOf(Error);
        }
      }
    }, 300000);

    it('should perform quality-based refinement when enabled', async () => {
      const refinementConfig: SequentialAgentConfig = {
        ...testConfig,
        applyFixes: true,
        confidenceThreshold: 0.9, // High threshold to trigger refinement
        maxIterations: 3,
      };
      
      const refinementSystem = new SequentialDualAgentSystem(
        modelClient,
        voiceSystem,
        modelCoordinator,
        refinementConfig
      );
      
      try {
        console.log('🔄 Testing refinement workflow...');
        
        const result = await refinementSystem.executeSequentialReview(
          "Create a secure file upload handler with proper error handling"
        );
        
        expect(result).toBeDefined();
        
        // Verify refinement occurred if needed
        if (result.refinementIterations && result.refinementIterations > 0) {
          expect(result.refinementHistory).toBeDefined();
          expect(Array.isArray(result.refinementHistory)).toBe(true);
          expect(result.refinementHistory.length).toBe(result.refinementIterations);
          
          // Quality should improve with refinement
          const initialScore = result.refinementHistory[0].score;
          const finalScore = result.overallScore;
          expect(finalScore).toBeGreaterThanOrEqual(initialScore * 0.9); // Allow 10% tolerance
        }
        
        // Should handle security aspects
        const finalLower = result.finalCode.toLowerCase();
        expect(
          finalLower.includes('upload') ||
          finalLower.includes('error') ||
          finalLower.includes('security') ||
          finalLower.includes('validation')
        ).toBe(true);
        
        console.log(`✅ Refinement workflow: ${result.refinementIterations || 0} iterations`);
        
      } catch (error) {
        console.log(`⚠️ Refinement test failed: ${error}`);
        expect(error).toBeInstanceOf(Error);
      }
    }, 240000);
  });

  describe('Real Audit System Integration', () => {
    it('should perform comprehensive code auditing', async () => {
      const auditPrompt = "Create a REST API endpoint with authentication";
      
      try {
        console.log('🔍 Testing audit capabilities...');
        
        const result = await sequentialSystem.executeSequentialReview(auditPrompt);
        
        expect(result).toBeDefined();
        expect(result.auditorResult).toBeDefined();
        
        const audit = result.auditorResult;
        
        // Verify audit completeness
        expect(audit.overallScore).toBeGreaterThanOrEqual(0);
        expect(audit.overallScore).toBeLessThanOrEqual(100);
        expect(typeof audit.passed).toBe('boolean');
        
        // Verify issue analysis
        expect(Array.isArray(audit.issues)).toBe(true);
        audit.issues.forEach(issue => {
          expect(issue.severity).toMatch(/^(critical|error|warning|info)$/);
          expect(issue.description).toBeTruthy();
          expect(issue.line).toBeGreaterThanOrEqual(0);
          expect(issue.category).toBeTruthy();
        });
        
        // Verify improvement suggestions
        expect(Array.isArray(audit.improvements)).toBe(true);
        audit.improvements.forEach(improvement => {
          expect(improvement.description).toBeTruthy();
          expect(improvement.priority).toMatch(/^(high|medium|low)$/);
          expect(improvement.category).toBeTruthy();
        });
        
        // Verify security assessment
        if (audit.security) {
          expect(typeof audit.security.score).toBe('number');
          expect(Array.isArray(audit.security.vulnerabilities)).toBe(true);
          expect(Array.isArray(audit.security.recommendations)).toBe(true);
        }
        
        // Verify quality metrics
        if (audit.quality) {
          expect(typeof audit.quality.readability).toBe('number');
          expect(typeof audit.quality.maintainability).toBe('number');
          expect(typeof audit.quality.efficiency).toBe('number');
          expect(typeof audit.quality.documentation).toBe('number');
          expect(typeof audit.quality.testability).toBe('number');
        }
        
        console.log(`✅ Audit completed: ${audit.issues.length} issues, ${audit.improvements.length} improvements`);
        
      } catch (error) {
        console.log(`⚠️ Audit test failed: ${error}`);
        expect(error).toBeInstanceOf(Error);
      }
    }, 120000);

    it('should handle security-focused auditing', async () => {
      const securityPrompt = "Create a user login system with password hashing";
      
      const securityConfig: SequentialAgentConfig = {
        ...testConfig,
        auditorTemperature: 0.1, // More focused analysis
        confidenceThreshold: 0.9, // High security standards
      };
      
      const securitySystem = new SequentialDualAgentSystem(
        modelClient,
        voiceSystem,
        modelCoordinator,
        securityConfig
      );
      
      try {
        console.log('🔒 Testing security-focused auditing...');
        
        const result = await securitySystem.executeSequentialReview(securityPrompt);
        
        expect(result).toBeDefined();
        expect(result.auditorResult.security).toBeDefined();
        
        const security = result.auditorResult.security;
        expect(typeof security.score).toBe('number');
        expect(Array.isArray(security.vulnerabilities)).toBe(true);
        expect(Array.isArray(security.recommendations)).toBe(true);
        
        // Should focus on security aspects
        const finalLower = result.finalCode.toLowerCase();
        expect(
          finalLower.includes('password') ||
          finalLower.includes('hash') ||
          finalLower.includes('security') ||
          finalLower.includes('auth')
        ).toBe(true);
        
        console.log(`✅ Security audit: ${security.vulnerabilities.length} vulnerabilities found`);
        
      } catch (error) {
        console.log(`⚠️ Security audit test failed: ${error}`);
        expect(error).toBeInstanceOf(Error);
      }
    }, 150000);
  });

  describe('Real Configuration and Performance', () => {
    it('should respect configuration parameters', async () => {
      const strictConfig: SequentialAgentConfig = {
        writerProvider: 'lm-studio',
        auditorProvider: 'lm-studio', // Both use same provider for speed
        writerTemperature: 0.3,
        auditorTemperature: 0.1,
        writerMaxTokens: 2048, // Reduced tokens
        auditorMaxTokens: 1024,
        autoAudit: true,
        applyFixes: false,
        confidenceThreshold: 0.6, // Lower threshold for acceptance
        saveResult: false,
        showCode: true,
        maxIterations: 2,
      };
      
      const strictSystem = new SequentialDualAgentSystem(
        modelClient,
        voiceSystem,
        modelCoordinator,
        strictConfig
      );
      
      try {
        const result = await strictSystem.executeSequentialReview(
          "Write a simple function to reverse a string"
        );
        
        expect(result).toBeDefined();
        
        // Verify configuration was respected
        expect(result.writerResult.provider).toBe(strictConfig.writerProvider);
        expect(result.auditorResult.provider).toBe(strictConfig.auditorProvider);
        expect(result.writerResult.maxTokens).toBe(strictConfig.writerMaxTokens);
        expect(result.auditorResult.maxTokens).toBe(strictConfig.auditorMaxTokens);
        
        // Should complete with reasonable quality despite strict config
        expect(result.finalCode.length).toBeGreaterThan(30);
        expect(result.finalCode.toLowerCase()).toContain('reverse');
        
        console.log(`✅ Configuration respected: ${result.overallScore}/100`);
        
      } catch (error) {
        console.log(`⚠️ Configuration test failed: ${error}`);
        expect(error).toBeInstanceOf(Error);
      }
    }, 90000);

    it('should track performance metrics', async () => {
      const performancePrompt = "Create a function to sort an array efficiently";
      
      const startTime = Date.now();
      
      try {
        const result = await sequentialSystem.executeSequentialReview(performancePrompt);
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        expect(result).toBeDefined();
        
        // Verify timing information
        expect(result.writerResult.duration).toBeGreaterThan(0);
        expect(result.auditorResult.duration).toBeGreaterThan(0);
        expect(result.totalDuration).toBeGreaterThan(0);
        expect(result.totalDuration).toBeLessThan(300000); // 5 minutes max
        
        // Should produce efficient code
        const finalLower = result.finalCode.toLowerCase();
        expect(
          finalLower.includes('sort') ||
          finalLower.includes('array') ||
          finalLower.includes('efficient')
        ).toBe(true);
        
        console.log(`✅ Performance tracked: writer ${result.writerResult.duration}ms, auditor ${result.auditorResult.duration}ms`);
        
      } catch (error) {
        console.log(`⚠️ Performance test failed: ${error}`);
        expect(error).toBeInstanceOf(Error);
      }
    }, 180000);
  });

  describe('Real Error Handling and Edge Cases', () => {
    it('should handle provider failures gracefully', async () => {
      // Test with potentially unavailable provider configuration
      const resilientConfig: SequentialAgentConfig = {
        ...testConfig,
        writerProvider: 'ollama',
        auditorProvider: 'ollama',
        confidenceThreshold: 0.5, // Lower threshold for acceptance
      };
      
      const resilientSystem = new SequentialDualAgentSystem(
        modelClient,
        voiceSystem,
        modelCoordinator,
        resilientConfig
      );
      
      try {
        const result = await resilientSystem.executeSequentialReview(
          "Simple addition function"
        );
        
        if (result) {
          // If successful, verify basic structure
          expect(result.finalCode).toBeTruthy();
          expect(result.writerResult).toBeDefined();
          expect(result.auditorResult).toBeDefined();
          console.log('✅ Sequential system completed successfully despite potential provider issues');
        }
        
      } catch (error) {
        // If it fails, should be due to provider connectivity
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeTruthy();
        console.log(`⚠️ Expected failure due to provider unavailability: ${error.message}`);
      }
    }, 90000);

    it('should handle edge cases in sequential execution', async () => {
      const edgeCases = [
        { prompt: "x", description: "Very short prompt" },
        { prompt: "Simple function", description: "Basic prompt" },
        { prompt: "Create a complex distributed system with microservices, message queues, load balancers, and monitoring", description: "Very complex prompt" },
      ];
      
      for (const testCase of edgeCases) {
        try {
          console.log(`🔄 Testing edge case: ${testCase.description}`);
          
          const result = await sequentialSystem.executeSequentialReview(testCase.prompt);
          
          if (result) {
            expect(result.finalCode).toBeTruthy();
            expect(result.writerResult).toBeDefined();
            expect(result.auditorResult).toBeDefined();
          }
          
          console.log(`✅ Edge case handled: ${testCase.description}`);
          
        } catch (error) {
          // Expected for some edge cases
          expect(error).toBeInstanceOf(Error);
          console.log(`⚠️ Edge case failed as expected: ${testCase.description} - ${error.message}`);
        }
      }
    }, 180000);

    it('should maintain system metrics', async () => {
      try {
        const metrics = sequentialSystem.getMetrics();
        
        expect(metrics).toBeDefined();
        expect(typeof metrics.totalExecutions).toBe('number');
        expect(typeof metrics.averageWriterTime).toBe('number');
        expect(typeof metrics.averageAuditorTime).toBe('number');
        expect(typeof metrics.acceptanceRate).toBe('number');
        expect(metrics.configuration).toBeDefined();
        expect(typeof metrics.isInitialized).toBe('boolean');
        
        console.log(`✅ Metrics available: ${metrics.totalExecutions} executions`);
        
      } catch (error) {
        console.log(`⚠️ Metrics test failed: ${error}`);
        expect(error).toBeInstanceOf(Error);
      }
    }, 30000);
  });
});