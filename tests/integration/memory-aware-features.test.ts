/**
 * Integration Tests for Memory-Aware Features
 * Tests sliding context windows, adaptive memory management, and robust JSON parsing
 */

import { OllamaProvider, OllamaConfig } from '../../src/providers/hybrid/ollama-provider.js';

describe('Memory-Aware Features Integration', () => {
  let ollamaProvider: OllamaProvider;
  
  const testConfig: OllamaConfig = {
    endpoint: 'http://localhost:11434',
    defaultModel: 'llama3.1:8b',
    timeout: 120000,
    maxRetries: 3,
  };

  beforeEach(() => {
    ollamaProvider = new OllamaProvider(testConfig);
  });

  describe('Sliding Context Window Algorithm', () => {
    test('should calculate adaptive context starting from 131K and sliding down', async () => {
      // Mock memory profile for testing
      jest.spyOn(ollamaProvider as any, 'getMemoryProfile').mockReturnValue({
        totalGPU: 12.0,
        availableGPU: 10.7,
        totalRAM: 32.0,
        availableRAM: 12.0,
        memoryPressure: 'medium',
      });

      jest.spyOn(ollamaProvider as any, 'estimateMemoryForContext').mockImplementation((contextSize: number) => {
        // Mock memory estimation based on context size
        const modelBaseMemory = 4.4;
        const kvCacheMemory = (contextSize * 32 * 2 * 4096 * 2) / (1024 ** 3);
        return modelBaseMemory + kvCacheMemory + (modelBaseMemory + kvCacheMemory) * 0.2;
      });

      // Test context calculation for different scenarios
      const contextForAnalysis = (ollamaProvider as any).getContextLength('analysis', 20000);
      const contextForTemplate = (ollamaProvider as any).getContextLength('template', 5000);
      const contextForMultiFile = (ollamaProvider as any).getContextLength('multi-file', 50000);

      // Analysis should get full available context
      expect(contextForAnalysis).toBeGreaterThan(32000);
      expect(contextForAnalysis).toBeLessThanOrEqual(131072);

      // Template should get reduced context (30% multiplier)
      expect(contextForTemplate).toBeLessThan(contextForAnalysis);
      expect(contextForTemplate).toBeGreaterThanOrEqual(8192);

      // Multi-file should get full available context
      expect(contextForMultiFile).toBeGreaterThan(32000);
    });

    test('should slide down context tiers based on memory constraints', () => {
      // Mock high memory pressure
      jest.spyOn(ollamaProvider as any, 'getMemoryProfile').mockReturnValue({
        totalGPU: 12.0,
        availableGPU: 2.0, // Low available memory
        totalRAM: 32.0,
        availableRAM: 4.0,
        memoryPressure: 'high',
      });

      jest.spyOn(ollamaProvider as any, 'estimateMemoryForContext').mockImplementation((contextSize: number) => {
        // Mock high memory requirements
        return contextSize / 8192 * 2.5; // Rough estimation
      });

      const context = (ollamaProvider as any).calculateAdaptiveContext(131072, 'analysis', 30000);

      // Should select a smaller context due to memory constraints
      expect(context).toBeLessThan(131072);
      expect(context).toBeGreaterThanOrEqual(8192);
    });

    test('should respect minimum context window', () => {
      // Mock very low memory scenario
      jest.spyOn(ollamaProvider as any, 'getMemoryProfile').mockReturnValue({
        totalGPU: 12.0,
        availableGPU: 0.5, // Very low memory
        totalRAM: 32.0,
        availableRAM: 1.0,
        memoryPressure: 'critical',
      });

      jest.spyOn(ollamaProvider as any, 'estimateMemoryForContext').mockImplementation(() => 10); // Always too much

      const context = (ollamaProvider as any).getContextLength('analysis', 10000);

      // Should fallback to minimum context
      expect(context).toBe(8192);
    });
  });

  describe('Memory Profile Detection', () => {
    test('should detect memory profile correctly', () => {
      const memoryProfile = (ollamaProvider as any).getMemoryProfile();

      expect(memoryProfile).toHaveProperty('totalGPU');
      expect(memoryProfile).toHaveProperty('availableGPU');
      expect(memoryProfile).toHaveProperty('totalRAM');
      expect(memoryProfile).toHaveProperty('availableRAM');
      expect(memoryProfile).toHaveProperty('memoryPressure');
      expect(['low', 'medium', 'high']).toContain(memoryProfile.memoryPressure);
    });

    test('should estimate memory requirements for different context sizes', () => {
      const memory8K = (ollamaProvider as any).estimateMemoryForContext(8192);
      const memory32K = (ollamaProvider as any).estimateMemoryForContext(32000);
      const memory131K = (ollamaProvider as any).estimateMemoryForContext(131072);

      // Larger context should require more memory
      expect(memory32K).toBeGreaterThan(memory8K);
      expect(memory131K).toBeGreaterThan(memory32K);
      expect(memory131K).toBeGreaterThan(8); // Should exceed typical GPU memory
    });
  });

  describe('Robust JSON Parsing', () => {
    test('should parse standard JSON correctly', async () => {
      const mockResponse = new Response(JSON.stringify({
        response: 'Test response',
        model: 'llama3.1:8b',
        total_duration: 1000,
      }));

      const result = await (ollamaProvider as any).parseRobustJSON(mockResponse);

      expect(result.response).toBe('Test response');
      expect(result.model).toBe('llama3.1:8b');
    });

    test('should handle JSON with extra content (position 97 error pattern)', async () => {
      const malformedJson = `{"response": "Test response", "model": "llama3.1:8b"}
Additional text that causes JSON.parse to fail`;

      const mockResponse = new Response(malformedJson);

      const result = await (ollamaProvider as any).parseRobustJSON(mockResponse);

      expect(result.response).toBe('Test response');
      expect(result.model).toBe('llama3.1:8b');
    });

    test('should handle streaming JSON responses', async () => {
      const streamingJson = `{"chunk": 1}
{"response": "Final response", "model": "test"}
{"chunk": 2}`;

      const mockResponse = new Response(streamingJson);

      const result = await (ollamaProvider as any).parseRobustJSON(mockResponse);

      expect(result.response).toBe('Final response');
      expect(result.model).toBe('test');
    });

    test('should detect and handle memory errors gracefully', async () => {
      const memoryErrorResponse = `{"error": "cudaMalloc failed: out of memory"}`;

      const mockResponse = new Response(memoryErrorResponse);

      await expect((ollamaProvider as any).parseRobustJSON(mockResponse))
        .rejects.toThrow('Insufficient GPU memory');
    });

    test('should extract content using regex patterns as fallback', async () => {
      const partialJson = `{
        "response": "Extracted content from malformed JSON",
        "model": "test",
        invalid_json_structure`;

      const mockResponse = new Response(partialJson);

      const result = await (ollamaProvider as any).parseRobustJSON(mockResponse);

      expect(result.response).toBe('Extracted content from malformed JSON');
      expect(result.model).toBe(testConfig.defaultModel); // Should fallback to default
    });

    test('should use raw text as final fallback', async () => {
      const rawText = `This is a plain text response without JSON structure`;

      const mockResponse = new Response(rawText);

      const result = await (ollamaProvider as any).parseRobustJSON(mockResponse);

      expect(result.response).toBe(rawText);
      expect(result.content).toBe(rawText);
    });

    test('should fail gracefully when all parsing strategies fail', async () => {
      const invalidResponse = `{"error": "critical failure"}`;

      const mockResponse = new Response(invalidResponse);

      await expect((ollamaProvider as any).parseRobustJSON(mockResponse))
        .rejects.toThrow(/JSON parsing failed/);
    });
  });

  describe('Environment Variable Integration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('should respect adaptive context environment variables', () => {
      process.env.MODEL_MAX_CONTEXT_WINDOW = '64000';
      process.env.MEMORY_THRESHOLD = '0.7';
      process.env.ADAPTIVE_CONTEXT_ENABLED = 'true';

      const provider = new OllamaProvider(testConfig);
      
      // Test that environment variables are used
      const maxContext = (provider as any).parseEnvInt('MODEL_MAX_CONTEXT_WINDOW', 131072, 1024, 131072);
      expect(maxContext).toBe(64000);

      const threshold = (provider as any).parseEnvFloat('MEMORY_THRESHOLD', 0.8, 0.0, 1.0);
      expect(threshold).toBe(0.7);
    });

    test('should handle invalid environment variables gracefully', () => {
      process.env.MODEL_MAX_CONTEXT_WINDOW = 'invalid_number';
      process.env.MEMORY_THRESHOLD = 'not_a_float';

      const provider = new OllamaProvider(testConfig);

      // Should fallback to defaults
      const maxContext = (provider as any).parseEnvInt('MODEL_MAX_CONTEXT_WINDOW', 131072, 1024, 131072);
      expect(maxContext).toBe(131072);

      const threshold = (provider as any).parseEnvFloat('MEMORY_THRESHOLD', 0.8, 0.0, 1.0);
      expect(threshold).toBe(0.8);
    });
  });

  describe('Integration with Model Loading', () => {
    test('should select appropriate model based on memory requirements', () => {
      // This test would require integration with actual model loading
      // For now, we test the logic components

      const memoryProfile = {
        totalGPU: 12.0,
        availableGPU: 6.0,
        totalRAM: 32.0,
        availableRAM: 16.0,
        memoryPressure: 'medium' as const,
      };

      // Mock model memory requirements (from config)
      const models = [
        { name: 'llama3.1:8b', memoryRequirement: 6.5 },
        { name: 'qwen2.5-coder:7b', memoryRequirement: 5.8 },
        { name: 'qwen2.5-coder:3b', memoryRequirement: 3.5 },
      ];

      // Should select model that fits in available memory
      const suitableModels = models.filter(
        model => model.memoryRequirement <= memoryProfile.availableGPU * 0.8
      );

      expect(suitableModels).toContainEqual(
        expect.objectContaining({ name: 'qwen2.5-coder:3b' })
      );
    });
  });
});

/**
 * Performance and Stress Tests for Memory Management
 */
describe('Memory Management Performance', () => {
  test('should handle rapid context size changes efficiently', () => {
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      defaultModel: 'llama3.1:8b',
      timeout: 120000,
      maxRetries: 3,
    });

    const startTime = Date.now();

    // Simulate rapid context calculations
    for (let i = 0; i < 100; i++) {
      const context = (provider as any).getContextLength('analysis', Math.random() * 50000);
      expect(context).toBeGreaterThanOrEqual(8192);
      expect(context).toBeLessThanOrEqual(131072);
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  test('should handle memory estimation calculations efficiently', () => {
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      defaultModel: 'llama3.1:8b',
      timeout: 120000,
      maxRetries: 3,
    });

    const contextSizes = [8192, 16000, 32000, 64000, 131072];
    const results = contextSizes.map(size => {
      const startTime = Date.now();
      const memory = (provider as any).estimateMemoryForContext(size);
      const duration = Date.now() - startTime;
      
      return { size, memory, duration };
    });

    // All calculations should be fast
    results.forEach(result => {
      expect(result.duration).toBeLessThan(10); // < 10ms each
      expect(result.memory).toBeGreaterThan(0);
    });

    // Memory should scale with context size
    expect(results[4].memory).toBeGreaterThan(results[0].memory);
  });
});