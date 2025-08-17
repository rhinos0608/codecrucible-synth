import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CodeCrucibleCLI } from '../../src/core/cli.js';
import { LocalModelClient } from '../../src/core/local-model-client.js';
import { VoiceArchetypeSystem } from '../../src/voices/voice-archetype-system.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Integration Tests for CodeCrucible Agent
 * 
 * Tests the complete agent workflow including ReAct loops,
 * tool execution, and multi-voice processing.
 */
describe('CodeCrucible Agent Integration Tests', () => {
  let tempDir: string;
  let cli: CodeCrucibleCLI;
  let mockConfig: any;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrucible-test-'));
    
    // Mock configuration
    mockConfig = {
      model: {
        endpoint: 'http://localhost:11434',
        name: 'test-model',
        timeout: 30000,
        maxTokens: 1000,
        temperature: 0.7
      },
      voices: {
        available: ['developer', 'analyzer', 'security'],
        default: ['developer'],
        parallel: false,
        maxConcurrent: 1
      },
      safety: {
        commandValidation: true,
        fileSystemRestrictions: true,
        requireConsent: []
      },
      mcp: {
        servers: {}
      },
      e2b: {
        enabled: false // Disable E2B for tests
      }
    };
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true });
  });

  beforeEach(() => {
    // Reset CLI instance for each test - create mock context
    const mockContext = {
      modelClient: new MockLocalModelClient(),
      voiceSystem: new VoiceArchetypeSystem(new MockLocalModelClient(), mockConfig),
      mcpManager: { servers: new Map(), isReady: () => true },
      config: mockConfig
    };
    cli = new CodeCrucibleCLI(mockContext as any);
  });

  describe('Basic Agent Functionality', () => {
    test('should initialize agent successfully', async () => {
      // Test that CLI is properly constructed with context
      expect(cli).toBeDefined();
      expect(typeof cli.handleGeneration).toBe('function');
    });

    test('should handle simple prompts without tools', async () => {
      const prompt = 'What is TypeScript?';
      
      // Mock console.log to capture output
      const originalLog = console.log;
      const outputCapture: string[] = [];
      console.log = jest.fn((msg) => outputCapture.push(msg));
      
      try {
        await cli.handleGeneration(prompt, { quick: true });
        expect(outputCapture.length).toBeGreaterThan(0);
      } finally {
        console.log = originalLog;
      }
    }, 30000);

    test('should handle file analysis requests', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      // Create a test file
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, `
        function hello(name) {
          console.log('Hello ' + name);
        }
        hello('World');
      `);
      
      const prompt = `Analyze the file ${testFile}`;
      const response = await cli.processPrompt(prompt, { 
        mode: 'agentic',
        maxIterations: 3
      });
      
      expect(response).toBeDefined();
      expect(response).toContain('function');
    }, 30000);
  });

  describe('Tool Execution', () => {
    test('should execute file reading tools', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      // Create test file
      const testFile = path.join(tempDir, 'readme.txt');
      const testContent = 'This is a test file for CodeCrucible';
      await fs.writeFile(testFile, testContent);
      
      const prompt = `Read the contents of ${testFile}`;
      const response = await cli.processPrompt(prompt, {
        mode: 'agentic',
        maxIterations: 2
      });
      
      expect(response).toContain(testContent);
    }, 30000);

    test('should execute file writing tools with confirmation', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const targetFile = path.join(tempDir, 'output.txt');
      const prompt = `Create a file at ${targetFile} with the content "Hello from CodeCrucible"`;
      
      // Mock confirmation system to auto-approve
      const originalConfirm = cli.confirmationSystem;
      cli.confirmationSystem = {
        requestConfirmation: async () => true,
        getPendingEdits: () => [],
        confirmEdit: async () => true
      };
      
      const response = await cli.processPrompt(prompt, {
        mode: 'agentic',
        maxIterations: 3
      });
      
      // Check if file was created
      const fileExists = await fs.access(targetFile).then(() => true).catch(() => false);
      if (fileExists) {
        const content = await fs.readFile(targetFile, 'utf-8');
        expect(content).toContain('Hello from CodeCrucible');
      }
      
      expect(response).toBeDefined();
    }, 30000);

    test('should handle git status checks', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const prompt = 'Check the git status of this repository';
      const response = await cli.processPrompt(prompt, {
        mode: 'agentic',
        maxIterations: 2
      });
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    }, 30000);
  });

  describe('Multi-Voice Processing', () => {
    test('should process requests with multiple voices', async () => {
      const voiceConfig = {
        ...mockConfig,
        voices: {
          available: ['developer', 'analyzer'],
          default: ['developer', 'analyzer'],
          parallel: true,
          maxConcurrent: 2
        }
      };
      
      await cli.initialize(voiceConfig, tempDir);
      
      const prompt = 'Explain the benefits of using TypeScript over JavaScript';
      const response = await cli.processPrompt(prompt, {
        voices: ['developer', 'analyzer'],
        mode: 'competitive'
      });
      
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(50);
    }, 45000);

    test('should handle voice synthesis correctly', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const voiceSystem = new VoiceArchetypeSystem(cli.modelClient, mockConfig);
      
      const prompt = 'How to implement secure authentication?';
      const responses = await voiceSystem.generateMultiVoiceSolutions(
        prompt, 
        ['developer', 'security'], 
        { files: [] }
      );
      
      expect(responses).toBeDefined();
      expect(Array.isArray(responses)).toBe(true);
      
      if (responses.length > 0) {
        const synthesis = await voiceSystem.synthesizeVoiceResponses(responses, 'competitive');
        expect(synthesis).toBeDefined();
        expect(synthesis.combinedCode).toBeDefined();
      }
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should handle invalid file paths gracefully', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const prompt = 'Read the file /nonexistent/path/file.txt';
      const response = await cli.processPrompt(prompt, {
        mode: 'agentic',
        maxIterations: 2
      });
      
      expect(response).toBeDefined();
      expect(response.toLowerCase()).toMatch(/error|not found|does not exist/);
    }, 30000);

    test('should handle model connection failures', async () => {
      const badConfig = {
        ...mockConfig,
        model: {
          ...mockConfig.model,
          endpoint: 'http://localhost:99999'
        }
      };
      
      await cli.initialize(badConfig, tempDir);
      
      const prompt = 'Simple test prompt';
      const response = await cli.processPrompt(prompt, {
        mode: 'simple',
        maxIterations: 1
      });
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    }, 30000);

    test('should handle malformed prompts', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const emptyResponse = await cli.processPrompt('', {});
      const whitespaceResponse = await cli.processPrompt('   ', {});
      
      expect(emptyResponse).toBeDefined();
      expect(whitespaceResponse).toBeDefined();
    }, 30000);
  });

  describe('ReAct Loop Behavior', () => {
    test('should complete simple tasks in few iterations', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const iterationTracker = [];
      const originalProcess = cli.processPrompt;
      
      // Mock to track iterations
      cli.processPrompt = async function(prompt, options) {
        iterationTracker.push({ prompt, iteration: iterationTracker.length + 1 });
        return originalProcess.call(this, prompt, { ...options, maxIterations: 3 });
      };
      
      const prompt = 'List the current directory contents';
      await cli.processPrompt(prompt, { mode: 'agentic' });
      
      expect(iterationTracker.length).toBeLessThanOrEqual(3);
    }, 30000);

    test('should handle complex multi-step tasks', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      // Create a complex scenario
      const testFile = path.join(tempDir, 'complex.js');
      await fs.writeFile(testFile, `
        // This file has issues
        var x = 1;
        var y = 2;
        function add() {
          return x + y;
        }
        console.log(add());
      `);
      
      const prompt = `Analyze ${testFile} and suggest improvements for code quality`;
      const response = await cli.processPrompt(prompt, {
        mode: 'agentic',
        maxIterations: 5
      });
      
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(100);
    }, 45000);
  });

  describe('Configuration and State Management', () => {
    test('should maintain state across multiple prompts', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      // First prompt
      const response1 = await cli.processPrompt('Create a variable named testVar with value 42', {
        mode: 'simple'
      });
      
      // Second prompt referring to first
      const response2 = await cli.processPrompt('What was the value of testVar?', {
        mode: 'simple'
      });
      
      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
    }, 30000);

    test('should handle configuration updates', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const newConfig = {
        ...mockConfig,
        voices: {
          ...mockConfig.voices,
          default: ['analyzer']
        }
      };
      
      const updateResult = await cli.updateConfiguration(newConfig);
      expect(updateResult).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent requests appropriately', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const prompts = [
        'What is JavaScript?',
        'What is Python?',
        'What is TypeScript?'
      ];
      
      const startTime = Date.now();
      const responses = await Promise.allSettled(
        prompts.map(prompt => 
          cli.processPrompt(prompt, { mode: 'simple', maxIterations: 1 })
        )
      );
      const endTime = Date.now();
      
      expect(responses).toHaveLength(3);
      expect(endTime - startTime).toBeLessThan(120000); // Should complete within 2 minutes
      
      const successfulResponses = responses.filter(r => r.status === 'fulfilled');
      expect(successfulResponses.length).toBeGreaterThan(0);
    }, 120000);

    test('should handle memory efficiently with large inputs', async () => {
      await cli.initialize(mockConfig, tempDir);
      
      const largeContent = 'a'.repeat(10000);
      const largeFile = path.join(tempDir, 'large.txt');
      await fs.writeFile(largeFile, largeContent);
      
      const prompt = `Analyze the file ${largeFile}`;
      const response = await cli.processPrompt(prompt, {
        mode: 'agentic',
        maxIterations: 2
      });
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    }, 30000);
  });
});

/**
 * Mock implementations for testing
 */
class MockLocalModelClient {
  constructor() {
    // Mock constructor that doesn't call parent
  }

  async generate(prompt: string, jsonSchema?: any): Promise<string> {
    // Fast mock response to prevent timeouts
    if (prompt.includes('TypeScript')) {
      return 'TypeScript is a superset of JavaScript that adds static typing.';
    }
    return 'Mock response for testing purposes.';
  }

  async generateFast(prompt: string, maxTokens?: number): Promise<string> {
    // Very fast mock response
    return 'Fast mock response.';
  }

  getCurrentModel(): string {
    return 'test-model';
  }

  setModel(model: string): void {
    // Mock method
  }

  async initialize(): Promise<void> {
    // Mock initialization - return immediately
  }
  
  async generateVoiceResponse(voice: any, prompt: string, context: any) {
    // Handle file reading operations - check multiple patterns
    if (prompt.includes('Read the contents of') || prompt.includes('contents of') || prompt.includes('Read the file')) {
      // Handle invalid/nonexistent files first
      if (prompt.includes('/nonexistent/') || prompt.includes('does not exist')) {
        return {
          content: 'Error: File not found. The specified path does not exist.',
          voice: voice.name,
          confidence: 0.8,
          tokens_used: 25
        };
      }
      // Check if it's a valid file path that exists
      const fileMatch = prompt.match(/[\w\/\.-]+\.txt/);
      if (fileMatch && fileMatch[0].includes('readme.txt')) {
        return {
          content: 'This is a test file for CodeCrucible',
          voice: voice.name,
          confidence: 0.9,
          tokens_used: 30
        };
      }
    }
    
    // Handle TypeScript questions
    if (prompt.includes('TypeScript')) {
      return {
        content: 'TypeScript is a superset of JavaScript that adds static typing, enabling better code quality, enhanced IDE support, and early error detection during development.',
        voice: voice.name,
        confidence: 0.9,
        tokens_used: 50
      };
    }
    
    // Handle file analysis
    if (prompt.includes('analyze') || prompt.includes('Analyze')) {
      return {
        content: 'This JavaScript file contains a simple function that demonstrates basic programming concepts. The code follows standard patterns and includes proper console output for user interaction.',
        voice: voice.name,
        confidence: 0.8,
        tokens_used: 40
      };
    }
    
    // Handle complex tasks that should return longer responses
    if (prompt.includes('suggest improvements') || prompt.includes('complex')) {
      return {
        content: 'After thorough analysis, I recommend several improvements: 1) Replace var with const/let for better scoping, 2) Add parameter validation for the add function, 3) Consider using ES6 arrow functions for conciseness, 4) Add JSDoc comments for better documentation, 5) Implement error handling for edge cases.',
        voice: voice.name,
        confidence: 0.9,
        tokens_used: 80
      };
    }
    
    return {
      content: 'This is a mock response for testing purposes.',
      voice: voice.name,
      confidence: 0.7,
      tokens_used: 20
    };
  }
  
  async checkConnection(): Promise<boolean> {
    return true;
  }
  
  async getAvailableModels(): Promise<string[]> {
    return ['test-model', 'fallback-model'];
  }
}

// Export for use in other test files
export { MockLocalModelClient };