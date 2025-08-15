import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LocalModelClient, LocalModelConfig } from '../../src/core/local-model-client.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = jest.mocked(axios);

describe('LocalModelClient', () => {
  let client: LocalModelClient;
  let config: LocalModelConfig;
  let mockAxiosInstance: any;

  beforeEach(() => {
    config = {
      endpoint: 'http://localhost:11434',
      model: 'gpt-oss:20b',
      timeout: 30000,
      maxTokens: 4096,
      temperature: 0.7
    };

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      create: jest.fn()
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    client = new LocalModelClient(config);
  });

  describe('Connection Check', () => {
    test('should check Ollama connection successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          models: [
            { name: 'gpt-oss:20b' },
            { name: 'llama3.1:70b' }
          ]
        }
      });

      const isConnected = await client.checkConnection();

      expect(isConnected).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tags');
    });

    test('should handle connection failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection refused'));

      const isConnected = await client.checkConnection();

      expect(isConnected).toBe(false);
    });

    test('should check OpenAI-compatible endpoint', async () => {
      config.endpoint = 'http://localhost:8080';
      client = new LocalModelClient(config);

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: [
            { id: 'gpt-oss:20b' }
          ]
        }
      });

      const isConnected = await client.checkConnection();

      expect(isConnected).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/models');
    });
  });

  describe('Model Detection', () => {
    test('should auto-detect available model from Ollama', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          models: [
            { name: 'llama3.1:70b' },
            { name: 'qwen2.5:72b' }
          ]
        }
      });

      const model = await client.getAvailableModel();

      expect(model).toBe('llama3.1:70b'); // First fallback model found
    });

    test('should fallback to configured model when auto-detection fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Failed to fetch'));

      const model = await client.getAvailableModel();

      expect(model).toBe(config.model);
    });

    test('should return configured model when no compatible models found', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          models: [
            { name: 'unknown-model:latest' }
          ]
        }
      });

      const model = await client.getAvailableModel();

      expect(model).toBe(config.model);
    });
  });

  describe('Voice Response Generation', () => {
    test('should generate voice response successfully', async () => {
      const voiceArchetype = {
        id: 'explorer',
        name: 'Explorer',
        systemPrompt: 'You are an innovative explorer...',
        temperature: 0.9,
        style: 'experimental'
      };

      const context = {
        files: [
          {
            path: 'test.js',
            content: 'console.log("Hello");',
            language: 'javascript'
          }
        ]
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { models: [{ name: 'gpt-oss:20b' }] }
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          response: 'This is a test response from the model.',
          done: true
        }
      });

      const response = await client.generateVoiceResponse(
        voiceArchetype,
        'Analyze this code',
        context
      );

      expect(response).toBeDefined();
      expect(response.voice).toBe('Explorer');
      expect(response.content).toContain('test response');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/generate', expect.any(Object));
    });

    test('should handle generation failure with fallback', async () => {
      const voiceArchetype = {
        id: 'explorer',
        name: 'Explorer',
        systemPrompt: 'You are an innovative explorer...',
        temperature: 0.9,
        style: 'experimental'
      };

      const context = { files: [] };

      mockAxiosInstance.get.mockResolvedValue({
        data: { models: [{ name: 'gpt-oss:20b' }, { name: 'llama3.1:70b' }] }
      });

      // First call fails, second succeeds (fallback)
      mockAxiosInstance.post
        .mockRejectedValueOnce(new Error('Model unavailable'))
        .mockResolvedValueOnce({
          data: {
            response: 'Fallback response',
            done: true
          }
        });

      const response = await client.generateVoiceResponse(
        voiceArchetype,
        'Test prompt',
        context
      );

      expect(response).toBeDefined();
      expect(response.content).toContain('Fallback response');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    test('should throw error when all fallbacks fail', async () => {
      const voiceArchetype = {
        id: 'explorer',
        name: 'Explorer',
        systemPrompt: 'You are an innovative explorer...',
        temperature: 0.9,
        style: 'experimental'
      };

      const context = { files: [] };

      mockAxiosInstance.get.mockResolvedValue({
        data: { models: [{ name: 'gpt-oss:20b' }] }
      });

      mockAxiosInstance.post.mockRejectedValue(new Error('All models unavailable'));

      await expect(
        client.generateVoiceResponse(voiceArchetype, 'Test prompt', context)
      ).rejects.toThrow('Failed to generate response from Explorer');
    });
  });

  describe('OpenAI-Compatible Mode', () => {
    test('should work with OpenAI-compatible endpoints', async () => {
      config.endpoint = 'http://localhost:8080';
      client = new LocalModelClient(config);

      const voiceArchetype = {
        id: 'developer',
        name: 'Developer',
        systemPrompt: 'You are a skilled developer...',
        temperature: 0.7,
        style: 'practical'
      };

      const context = { files: [] };

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: [{ id: 'gpt-oss:20b' }] }
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: 'OpenAI-compatible response'
              }
            }
          ],
          usage: {
            total_tokens: 150
          }
        }
      });

      const response = await client.generateVoiceResponse(
        voiceArchetype,
        'Test prompt',
        context
      );

      expect(response).toBeDefined();
      expect(response.content).toContain('OpenAI-compatible response');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/chat/completions', expect.any(Object));
    });
  });

  describe('Request Building', () => {
    test('should build Ollama request correctly', () => {
      const voiceArchetype = {
        id: 'security',
        name: 'Security Engineer',
        systemPrompt: 'Focus on security best practices...',
        temperature: 0.3,
        style: 'defensive'
      };

      // Access private method through any casting for testing
      const request = (client as any).buildOllamaRequest(
        'Test prompt',
        voiceArchetype,
        'gpt-oss:20b'
      );

      expect(request.model).toBe('gpt-oss:20b');
      expect(request.prompt).toContain('Test prompt');
      expect(request.options.temperature).toBe(0.3);
      expect(request.stream).toBe(false);
    });

    test('should build OpenAI request correctly', () => {
      const voiceArchetype = {
        id: 'architect',
        name: 'System Architect',
        systemPrompt: 'Design scalable systems...',
        temperature: 0.6,
        style: 'strategic'
      };

      // Access private method through any casting for testing
      const request = (client as any).buildOpenAIRequest(
        'Test prompt',
        voiceArchetype,
        'gpt-oss:20b'
      );

      expect(request.model).toBe('gpt-oss:20b');
      expect(request.messages).toHaveLength(2);
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[1].role).toBe('user');
      expect(request.temperature).toBe(0.6);
      expect(request.max_tokens).toBe(config.maxTokens);
    });
  });
});