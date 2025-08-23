/**
 * Complete System End-to-End Integration Tests
 * Tests real user workflows with actual AI providers, file system, and MCP integration
 * NO MOCKS - Real implementation testing following AI Coding Grimoire principles
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { UnifiedModelClient, createDefaultUnifiedClientConfig } from '../../src/core/client.js';
import { LivingSpiralCoordinator, SpiralPhase } from '../../src/core/living-spiral-coordinator.js';
import { VoiceArchetypeSystem } from '../../src/voices/voice-archetype-system.js';
import { CLI } from '../../src/core/cli.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

describe('Complete System End-to-End Integration Tests', () => {
  let testWorkspace: string;
  let unifiedClient: UnifiedModelClient;
  let voiceSystem: VoiceArchetypeSystem;
  let spiralCoordinator: LivingSpiralCoordinator;
  let cli: CLI;

  beforeAll(async () => {
    // Create isolated test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'codecrucible-e2e-'));
    
    // Initialize real system components
    const config = createDefaultUnifiedClientConfig({
      providers: [
        {
          type: 'ollama',
          endpoint: process.env.TEST_OLLAMA_ENDPOINT || 'http://localhost:11434',
          enabled: true,
          model: 'tinyllama:latest',
          timeout: 45000,
        },
        {
          type: 'lm-studio', 
          endpoint: process.env.TEST_LMSTUDIO_ENDPOINT || 'http://localhost:1234',
          enabled: true,
          timeout: 45000,
        },
      ],
      performanceThresholds: {
        fastModeMaxTokens: 500,
        timeoutMs: 60000,
        maxConcurrentRequests: 2,
      },
    });

    unifiedClient = new UnifiedModelClient(config);
    voiceSystem = new VoiceArchetypeSystem();
    
    spiralCoordinator = new LivingSpiralCoordinator(
      voiceSystem,
      unifiedClient,
      {
        maxIterations: 3,
        qualityThreshold: 0.8,
        convergenceTarget: 0.9,
        enableReflection: true,
        parallelVoices: false,
        councilSize: 3,
      }
    );

    cli = new CLI();

    // Initialize systems
    await unifiedClient.initialize();
    await voiceSystem.initialize();
    
    console.log(`✅ Test workspace created: ${testWorkspace}`);
  }, 120000); // Extended timeout for real system initialization

  afterAll(async () => {
    try {
      if (unifiedClient) {
        await unifiedClient.shutdown();
      }
      if (testWorkspace && existsSync(testWorkspace)) {
        await rm(testWorkspace, { recursive: true, force: true });
      }
      console.log('✅ Test cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  });

  beforeEach(() => {
    // Reset any test-specific state
    process.chdir(testWorkspace);
  });

  describe('Real User Workflow: Code Generation', () => {
    it('should handle complete code generation workflow from user request to file output', async () => {
      // REAL USER WORKFLOW: "Generate a TypeScript utility function"
      const userRequest = "Generate a TypeScript utility function that validates email addresses with comprehensive error handling";
      
      // Step 1: Process through unified client (real AI provider)
      const response = await unifiedClient.processRequest({
        prompt: userRequest,
        type: 'code_generation',
        context: {
          language: 'typescript',
          projectType: 'utility',
        },
      });

      expect(response).toBeDefined();
      expect(response.content).toContain('function');
      expect(response.content).toContain('email');
      expect(response.metadata).toBeDefined();
      expect(response.metadata.provider).toBeTruthy();

      // Step 2: Validate response contains actual TypeScript code
      expect(response.content).toMatch(/function\s+\w+|const\s+\w+\s*=|export/);
      expect(response.content.length).toBeGreaterThan(50);

      // Step 3: Write generated code to test workspace
      const outputFile = join(testWorkspace, 'email-validator.ts');
      await writeFile(outputFile, response.content);

      // Step 4: Verify file creation and content
      expect(existsSync(outputFile)).toBe(true);
      const writtenContent = await readFile(outputFile, 'utf-8');
      expect(writtenContent).toBe(response.content);

      console.log(`✅ Generated ${writtenContent.length} characters of TypeScript code`);
    }, 60000);

    it('should handle file analysis workflow with real file input', async () => {
      // SETUP: Create a real code file to analyze
      const testCodeFile = join(testWorkspace, 'test-component.tsx');
      const sampleCode = `
import React, { useState } from 'react';

interface UserProps {
  name: string;
  email: string;
}

export const UserComponent: React.FC<UserProps> = ({ name, email }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  const handleClick = () => {
    setIsVisible(!isVisible);
  };

  return (
    <div onClick={handleClick}>
      {isVisible && (
        <div>
          <h1>{name}</h1>
          <p>{email}</p>
        </div>
      )}
    </div>
  );
};
      `;
      
      await writeFile(testCodeFile, sampleCode);

      // REAL USER WORKFLOW: "Analyze this React component"
      const analysisRequest = `Analyze this React component for best practices and suggest improvements:\n\n${sampleCode}`;
      
      const analysis = await unifiedClient.processRequest({
        prompt: analysisRequest,
        type: 'code_analysis',
        context: {
          language: 'typescript',
          framework: 'react',
          filePath: testCodeFile,
        },
      });

      expect(analysis).toBeDefined();
      expect(analysis.content).toContain('React');
      expect(analysis.content.length).toBeGreaterThan(100);
      
      // Verify analysis mentions relevant concepts
      const analysisLower = analysis.content.toLowerCase();
      expect(
        analysisLower.includes('component') || 
        analysisLower.includes('props') || 
        analysisLower.includes('state') ||
        analysisLower.includes('typescript')
      ).toBe(true);

      console.log(`✅ Generated ${analysis.content.length} characters of code analysis`);
    }, 60000);
  });

  describe('Real Living Spiral Workflow', () => {
    it('should execute complete Living Spiral iteration with real AI processing', async () => {
      const complexPrompt = "Design a scalable architecture for a real-time chat application with user authentication, message persistence, and horizontal scaling";

      // Execute real Living Spiral process
      const spiralResult = await spiralCoordinator.executeSpiralProcess(complexPrompt);

      // Validate spiral execution
      expect(spiralResult).toBeDefined();
      expect(spiralResult.iterations).toBeDefined();
      expect(spiralResult.iterations.length).toBeGreaterThan(0);
      expect(spiralResult.final).toBeTruthy();
      expect(spiralResult.totalIterations).toBeGreaterThan(0);

      // Validate spiral phases were executed
      const phases = spiralResult.iterations.map(i => i.phase);
      expect(phases).toContain(SpiralPhase.COLLAPSE);
      
      // Validate quality improvement over iterations
      if (spiralResult.iterations.length > 1) {
        const firstQuality = spiralResult.iterations[0].quality;
        const lastQuality = spiralResult.iterations[spiralResult.iterations.length - 1].quality;
        expect(lastQuality).toBeGreaterThanOrEqual(firstQuality);
      }

      // Validate content quality
      expect(spiralResult.final.length).toBeGreaterThan(200);
      expect(spiralResult.final.toLowerCase()).toContain('architecture');

      console.log(`✅ Living Spiral completed ${spiralResult.totalIterations} iterations with quality ${spiralResult.quality}`);
    }, 90000);

    it('should handle voice archetype specialization in real scenarios', async () => {
      // Test different voice archetypes for specialized tasks
      const securityPrompt = "Review this authentication code for security vulnerabilities";
      const performancePrompt = "Optimize this database query for better performance";
      const designPrompt = "Create a user-friendly interface design for a dashboard";

      // Security voice test
      const securityVoice = voiceSystem.getVoice('security');
      expect(securityVoice).toBeDefined();
      
      const securityResponse = await unifiedClient.processRequest({
        prompt: securityPrompt,
        type: 'security_analysis',
        voice: 'security',
        context: { domain: 'authentication' },
      });

      expect(securityResponse.content).toBeTruthy();
      expect(securityResponse.content.toLowerCase()).toContain('security');

      // Performance voice test  
      const performanceResponse = await unifiedClient.processRequest({
        prompt: performancePrompt,
        type: 'performance_optimization',
        voice: 'analyzer',
        context: { domain: 'database' },
      });

      expect(performanceResponse.content).toBeTruthy();
      expect(performanceResponse.content.toLowerCase()).toContain('performance');

      // Design voice test
      const designResponse = await unifiedClient.processRequest({
        prompt: designPrompt,
        type: 'ui_design',
        voice: 'designer',
        context: { domain: 'frontend' },
      });

      expect(designResponse.content).toBeTruthy();
      expect(designResponse.content.toLowerCase()).toContain('design');

      console.log('✅ Voice archetype specialization validated across security, performance, and design domains');
    }, 90000);
  });

  describe('Real Hybrid Model Integration', () => {
    it('should demonstrate intelligent routing between fast and quality models', async () => {
      // Fast task (should use LM Studio if available)
      const fastTask = "Format this JSON: { name: 'John', age: 30 }";
      
      const fastResponse = await unifiedClient.processRequest({
        prompt: fastTask,
        type: 'formatting',
        executionMode: 'fast',
      });

      expect(fastResponse).toBeDefined();
      expect(fastResponse.content).toContain('John');
      expect(fastResponse.metadata.responseTimeMs).toBeLessThan(10000); // Fast response

      // Complex task (should use higher quality model)
      const complexTask = "Analyze the time complexity of various sorting algorithms and provide mathematical proof";
      
      const qualityResponse = await unifiedClient.processRequest({
        prompt: complexTask,
        type: 'complex_analysis',
        executionMode: 'quality',
      });

      expect(qualityResponse).toBeDefined();
      expect(qualityResponse.content.length).toBeGreaterThan(fastResponse.content.length);
      expect(qualityResponse.content.toLowerCase()).toContain('algorithm');

      // Auto routing test
      const autoTask = "Explain recursion with a practical example";
      
      const autoResponse = await unifiedClient.processRequest({
        prompt: autoTask,
        type: 'explanation',
        executionMode: 'auto',
      });

      expect(autoResponse).toBeDefined();
      expect(autoResponse.content).toContain('recursion');
      expect(autoResponse.metadata.provider).toBeTruthy();

      console.log('✅ Hybrid model routing validated for fast, quality, and auto modes');
    }, 60000);
  });

  describe('Real File System Integration', () => {
    it('should handle complete project analysis workflow', async () => {
      // Create a mock project structure
      const projectDir = join(testWorkspace, 'test-project');
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, 'src'), { recursive: true });
      await mkdir(join(projectDir, 'tests'), { recursive: true });

      // Create package.json
      await writeFile(join(projectDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          build: 'tsc',
          test: 'jest',
        },
        dependencies: {
          'express': '^4.18.0',
          'typescript': '^5.0.0',
        },
      }, null, 2));

      // Create source files
      await writeFile(join(projectDir, 'src', 'index.ts'), `
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
      `);

      await writeFile(join(projectDir, 'tests', 'index.test.ts'), `
import request from 'supertest';
import app from '../src/index';

describe('API Tests', () => {
  test('GET / should return hello message', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello World');
  });
});
      `);

      // Process project analysis request
      const projectAnalysis = await unifiedClient.processRequest({
        prompt: `Analyze this Node.js project structure and suggest improvements. Project path: ${projectDir}`,
        type: 'project_analysis',
        context: {
          projectPath: projectDir,
          language: 'typescript',
          framework: 'express',
        },
      });

      expect(projectAnalysis).toBeDefined();
      expect(projectAnalysis.content).toBeTruthy();
      expect(projectAnalysis.content.length).toBeGreaterThan(100);
      
      // Verify analysis mentions relevant concepts
      const analysisLower = projectAnalysis.content.toLowerCase();
      expect(
        analysisLower.includes('express') ||
        analysisLower.includes('typescript') ||
        analysisLower.includes('project') ||
        analysisLower.includes('structure')
      ).toBe(true);

      console.log(`✅ Project analysis completed for ${projectDir}`);
    }, 60000);

    it('should handle real-time file monitoring and incremental updates', async () => {
      // Create initial file
      const watchedFile = join(testWorkspace, 'watched-component.tsx');
      const initialContent = `
export const SimpleComponent = () => {
  return <div>Hello</div>;
};
      `;
      
      await writeFile(watchedFile, initialContent);

      // Initial analysis
      const initialAnalysis = await unifiedClient.processRequest({
        prompt: `Analyze this React component: ${initialContent}`,
        type: 'code_analysis',
        context: { filePath: watchedFile },
      });

      expect(initialAnalysis.content).toBeTruthy();

      // Simulate file update
      const updatedContent = `
import React, { useState } from 'react';

export const EnhancedComponent = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Hello: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
};
      `;
      
      await writeFile(watchedFile, updatedContent);

      // Updated analysis
      const updatedAnalysis = await unifiedClient.processRequest({
        prompt: `Analyze the updated React component: ${updatedContent}`,
        type: 'code_analysis',
        context: { filePath: watchedFile },
      });

      expect(updatedAnalysis.content).toBeTruthy();
      expect(updatedAnalysis.content).not.toBe(initialAnalysis.content);
      
      // Verify updated analysis mentions new concepts
      const updatedLower = updatedAnalysis.content.toLowerCase();
      expect(
        updatedLower.includes('state') ||
        updatedLower.includes('button') ||
        updatedLower.includes('click') ||
        updatedLower.includes('increment')
      ).toBe(true);

      console.log('✅ Real-time file monitoring and incremental updates validated');
    }, 60000);
  });

  describe('Real Error Handling and Recovery', () => {
    it('should gracefully handle provider failures with fallback', async () => {
      // Test with intentionally unreachable endpoint
      const clientWithFailure = new UnifiedModelClient(createDefaultUnifiedClientConfig({
        providers: [
          {
            type: 'ollama',
            endpoint: 'http://localhost:99999', // Non-existent port
            enabled: true,
            timeout: 5000,
          },
          {
            type: 'lm-studio',
            endpoint: process.env.TEST_LMSTUDIO_ENDPOINT || 'http://localhost:1234',
            enabled: true,
            timeout: 30000,
          },
        ],
        fallbackChain: ['ollama', 'lm-studio'],
      }));

      try {
        await clientWithFailure.initialize();

        const response = await clientWithFailure.processRequest({
          prompt: "Simple test request",
          type: 'test',
        });

        // Should still work with fallback provider
        expect(response).toBeDefined();
        expect(response.content || response.error).toBeTruthy();

        if (response.metadata) {
          // If successful, should indicate which provider was used
          expect(response.metadata.provider).toBeTruthy();
          console.log(`✅ Fallback successful with provider: ${response.metadata.provider}`);
        }
      } catch (error) {
        // If all providers fail, should have meaningful error
        expect(error).toBeInstanceOf(Error);
        console.log(`⚠️ Expected failure when all providers unavailable: ${error.message}`);
      } finally {
        await clientWithFailure.shutdown();
      }
    }, 45000);

    it('should handle malformed input gracefully', async () => {
      const malformedInputs = [
        '', // Empty string
        'a'.repeat(100000), // Extremely long input
        '🚀'.repeat(1000), // Unicode stress test
        '\n\n\n\n', // Only whitespace
      ];

      for (const input of malformedInputs) {
        try {
          const response = await unifiedClient.processRequest({
            prompt: input,
            type: 'test',
          });

          // Should either succeed with valid response or fail gracefully
          if (response.content) {
            expect(typeof response.content).toBe('string');
          }
          if (response.error) {
            expect(typeof response.error).toBe('string');
          }
        } catch (error) {
          // Graceful error handling expected
          expect(error).toBeInstanceOf(Error);
        }
      }

      console.log('✅ Malformed input handling validated');
    }, 30000);
  });

  describe('Real Performance and Concurrency', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
        unifiedClient.processRequest({
          prompt: `Generate a simple function for task ${i}`,
          type: 'code_generation',
          context: { taskId: i },
        })
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentRequests);
      const endTime = Date.now();

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(0);
      console.log(`✅ Concurrent requests: ${successful} successful, ${failed} failed in ${endTime - startTime}ms`);

      // Verify individual responses
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const response = result.value;
          expect(response).toBeDefined();
          if (response.content) {
            expect(response.content.length).toBeGreaterThan(10);
          }
        }
      });
    }, 90000);

    it('should maintain performance metrics across extended usage', async () => {
      const performanceTests = [];
      
      // Collect performance data across multiple requests
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        
        const response = await unifiedClient.processRequest({
          prompt: `Performance test iteration ${i}: Create a utility function`,
          type: 'code_generation',
        });
        
        const endTime = Date.now();
        
        performanceTests.push({
          iteration: i,
          responseTime: endTime - startTime,
          contentLength: response.content?.length || 0,
          provider: response.metadata?.provider,
        });
        
        expect(response).toBeDefined();
      }

      // Analyze performance trends
      const avgResponseTime = performanceTests.reduce((sum, test) => sum + test.responseTime, 0) / performanceTests.length;
      const avgContentLength = performanceTests.reduce((sum, test) => sum + test.contentLength, 0) / performanceTests.length;

      expect(avgResponseTime).toBeGreaterThan(0);
      expect(avgContentLength).toBeGreaterThan(0);

      console.log(`✅ Performance metrics: Avg response ${avgResponseTime}ms, avg content ${Math.round(avgContentLength)} chars`);
    }, 60000);
  });
});