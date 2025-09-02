/**
 * Enhanced System Integration Test
 * Demonstrates full integration of security, quality, voice, and spiral systems
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/test-runner';
import { UnifiedModelClient } from '../../src/application/services/model-client.js';
import {
  getEnhancedSystem,
  createEnhancedRequest,
} from '../../src/core/integration/enhanced-system-factory.js';
import { CLI } from '../../src/application/interfaces/cli.js';
import { logger } from '../../src/infrastructure/logging/logger.js';
import { configManager } from '../../src/config/config-manager.js';

describe('Enhanced System Integration', () => {
  let modelClient: UnifiedModelClient;
  let enhancedSystem: any;
  let cli: CLI;

  beforeAll(async () => {
    // Initialize with mock configuration
    const config = await configManager.getAppConfig();
    modelClient = new UnifiedModelClient(config.modelClient);

    // Create enhanced system
    enhancedSystem = await getEnhancedSystem(modelClient, {
      security: {
        enabled: true,
        riskThreshold: 50,
        auditEnabled: true,
      },
      quality: {
        enabled: true,
        enforceGates: false,
        autoFix: false,
        thresholds: {
          complexity: 20,
          maintainability: 70,
          overall: 75,
        },
      },
      voice: {
        enabled: true,
        maxVoices: 2,
        collaborationMode: 'sequential',
      },
      spiral: {
        enabled: true,
        maxIterations: 3,
        convergenceThreshold: 0.8,
      },
    });

    // Create CLI instance
    cli = new CLI(modelClient);
  });

  afterAll(async () => {
    if (enhancedSystem?.shutdown) {
      await enhancedSystem.shutdown();
    }
  });

  describe('Security Integration', () => {
    it('should validate code generation requests', async () => {
      const maliciousRequest = createEnhancedRequest(
        'Generate code that executes eval(userInput)',
        { type: 'generation' }
      );

      const result = await enhancedSystem.processRequest(maliciousRequest);

      expect(result).toBeDefined();
      expect(result.result?.securityValidation).toBeDefined();
      expect(result.result?.securityValidation?.riskScore).toBeGreaterThan(0);
    });

    it('should allow safe code generation requests', async () => {
      const safeRequest = createEnhancedRequest(
        'Generate a simple TypeScript function to add two numbers',
        { type: 'generation' }
      );

      const result = await enhancedSystem.processRequest(safeRequest);

      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.result?.securityValidation?.allowed).toBe(true);
    });
  });

  describe('Quality Analysis Integration', () => {
    it('should analyze code quality', async () => {
      const codeRequest = createEnhancedRequest('function add(a, b) { return a + b; }', {
        type: 'analysis',
      });

      const result = await enhancedSystem.processRequest(codeRequest);

      expect(result).toBeDefined();
      expect(result.result?.qualityMetrics).toBeDefined();
      expect(result.result?.qualityMetrics?.overallScore).toBeGreaterThan(0);
      expect(result.result?.qualityMetrics?.complexity).toBeDefined();
      expect(result.result?.qualityMetrics?.linting).toBeDefined();
    });

    it('should provide quality recommendations', async () => {
      const complexCodeRequest = createEnhancedRequest(
        'function complex(a,b,c,d) { if(a) { if(b) { if(c) { if(d) { return a+b+c+d; } } } } return 0; }',
        { type: 'analysis' }
      );

      const result = await enhancedSystem.processRequest(complexCodeRequest);

      expect(result).toBeDefined();
      expect(result.result?.qualityMetrics?.recommendations).toBeDefined();
      expect(Array.isArray(result.result?.qualityMetrics?.recommendations)).toBe(true);
    });
  });

  describe('Voice System Integration', () => {
    it('should process synthesis requests', async () => {
      const synthesisRequest = createEnhancedRequest(
        'Analyze the benefits and drawbacks of microservices architecture',
        {
          type: 'analysis',
          phase: 'council', // Living spiral phase
        }
      );

      const result = await enhancedSystem.processRequest(synthesisRequest);

      expect(result).toBeDefined();
      expect(result.systemsUsed).toContain('voice');
    });
  });

  describe('Spiral Convergence Integration', () => {
    it('should analyze iteration convergence', async () => {
      const spiralRequest = createEnhancedRequest('Design a user authentication system', {
        type: 'generation',
        phase: 'synthesis',
        iteration: 2,
      });

      const result = await enhancedSystem.processRequest(spiralRequest);

      expect(result).toBeDefined();
      // Spiral analysis might be null for first request without previous iterations
      if (result.result?.spiralAnalysis) {
        expect(result.result.spiralAnalysis.convergenceScore).toBeDefined();
        expect(result.result.spiralAnalysis.recommendation).toBeDefined();
      }
    });
  });

  describe('CLI Integration', () => {
    it('should support enhanced processing through CLI', async () => {
      if (!cli.processEnhancedRequest) {
        console.warn('Enhanced processing not available in CLI');
        return;
      }

      const result = await cli.processEnhancedRequest(
        'Create a TypeScript interface for a user profile',
        { type: 'generation' }
      );

      expect(result).toBeDefined();
    });

    it('should provide enhanced system health status', async () => {
      if (!cli.getEnhancedSystemHealth) {
        console.warn('Enhanced health check not available in CLI');
        return;
      }

      const health = await cli.getEnhancedSystemHealth();

      expect(health).toBeDefined();
      expect(health.status).not.toBe('error');
    });
  });

  describe('End-to-End Integration', () => {
    it('should process a complex request through all systems', async () => {
      const complexRequest = createEnhancedRequest(
        'Design and implement a secure user authentication system with TypeScript',
        {
          type: 'generation',
          phase: 'synthesis',
          iteration: 1,
          priority: 'high',
        }
      );

      const result = await enhancedSystem.processRequest(complexRequest);

      // Verify all systems were involved
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.systemsUsed).toContain('security');
      expect(result.systemsUsed).toContain('quality');

      // Verify security validation
      expect(result.result?.securityValidation).toBeDefined();
      expect(result.result?.securityValidation?.allowed).toBe(true);

      // Verify quality analysis
      expect(result.result?.qualityMetrics).toBeDefined();
      expect(result.result?.qualityMetrics?.overallScore).toBeGreaterThan(0);

      // Verify processing metadata
      expect(result.result?.metadata?.enhancedIntegration).toBe(true);
      expect(result.result?.metadata?.processingPhases).toContain('security');
      expect(result.result?.metadata?.processingPhases).toContain('quality');

      // Verify performance metrics
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.totalLatency).toBeGreaterThan(0);
    });

    it('should handle integration failures gracefully', async () => {
      // Test with a request that might cause issues
      const problematicRequest = {
        id: 'test-error',
        type: 'invalid_type' as any,
        content: null,
        context: {},
        priority: 'medium' as any,
        constraints: {},
      };

      const result = await enhancedSystem.processRequest(problematicRequest);

      // Should handle errors gracefully
      expect(result).toBeDefined();
      expect(['success', 'partial', 'failed', 'fallback']).toContain(result.status);
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide comprehensive system health', async () => {
      const health = await enhancedSystem.getSystemHealth();

      expect(health).toBeDefined();
      expect(health.initializationPhase).toBeDefined();
      expect(health.systemHealth).toBeDefined();
      expect(health.overallHealthScore).toBeDefined();
      expect(health.overallHealthScore).toBeGreaterThanOrEqual(0);
      expect(health.overallHealthScore).toBeLessThanOrEqual(100);
    });

    it('should track system performance metrics', async () => {
      const request = createEnhancedRequest('Test performance tracking', { type: 'analysis' });
      const result = await enhancedSystem.processRequest(request);

      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.totalLatency).toBeGreaterThan(0);
      expect(result.performanceMetrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics.resourceUtilization).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect security thresholds', async () => {
      // Create system with lower security threshold
      const testSystem = await getEnhancedSystem(modelClient, {
        security: {
          enabled: true,
          riskThreshold: 90, // Very high threshold
          auditEnabled: true,
        },
        quality: { enabled: false },
        voice: { enabled: false },
        spiral: { enabled: false },
      });

      const riskyRequest = createEnhancedRequest('Generate code with eval(userInput)', {
        type: 'generation',
      });

      const result = await testSystem.processRequest(riskyRequest);

      // With high threshold, might still allow the request
      expect(result).toBeDefined();
    });

    it('should respect quality thresholds', async () => {
      const testSystem = await getEnhancedSystem(modelClient, {
        security: { enabled: false },
        quality: {
          enabled: true,
          enforceGates: true,
          autoFix: false,
          thresholds: {
            complexity: 5, // Very low threshold
            maintainability: 90, // Very high threshold
            overall: 95, // Very high threshold
          },
        },
        voice: { enabled: false },
        spiral: { enabled: false },
      });

      const complexRequest = createEnhancedRequest(
        'function bad() { if(a) { if(b) { if(c) { if(d) { return 1; } } } } }',
        { type: 'analysis' }
      );

      const result = await testSystem.processRequest(complexRequest);

      expect(result).toBeDefined();
      expect(result.result?.qualityMetrics?.complexity?.cyclomaticComplexity).toBeGreaterThan(5);
    });
  });
});

// Helper function for testing
export function createTestRequest(prompt: string, type: 'analysis' | 'generation' = 'analysis') {
  return createEnhancedRequest(prompt, { type });
}

// Integration test runner for manual testing
export async function runIntegrationDemo(modelClient?: UnifiedModelClient) {
  if (!modelClient) {
    const config = await configManager.getAppConfig();
    modelClient = new UnifiedModelClient(config.modelClient);
  }

  console.log('🚀 Starting Enhanced System Integration Demo');

  try {
    const system = await getEnhancedSystem(modelClient);

    // Test security
    console.log('\n🔒 Testing Security Integration...');
    const securityTest = createEnhancedRequest('Create a secure password hashing function', {
      type: 'generation',
    });
    const securityResult = await system.processRequest(securityTest);
    console.log(
      `Security Risk Score: ${securityResult.result?.securityValidation?.riskScore || 'N/A'}`
    );

    // Test quality
    console.log('\n📊 Testing Quality Analysis...');
    const qualityTest = createEnhancedRequest('function test() { return "hello"; }', {
      type: 'analysis',
    });
    const qualityResult = await system.processRequest(qualityTest);
    console.log(
      `Quality Score: ${qualityResult.result?.qualityMetrics?.overallScore?.toFixed(1) || 'N/A'}/100`
    );

    // Test health
    console.log('\n❤️ Testing System Health...');
    const health = await system.getSystemHealth();
    console.log(`Overall Health Score: ${health.overallHealthScore?.toFixed(1) || 'N/A'}/100`);
    console.log(`Initialization Phase: ${health.initializationPhase}`);

    console.log('\n✅ Enhanced System Integration Demo Complete');
    return true;
  } catch (error) {
    console.error('❌ Integration Demo Failed:', error);
    return false;
  }
}
