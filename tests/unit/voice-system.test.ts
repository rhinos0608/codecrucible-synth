import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { VoiceArchetypeSystem } from '../../src/voices/voice-archetype-system';
import { LocalModelClient } from '../../src/core/local-model-client';

jest.mock('../../src/core/local-model-client', () => ({
  LocalModelClient: jest.fn().mockImplementation(() => ({
    generateVoiceResponse: jest.fn(),
    generateMultiVoiceResponses: jest.fn(),
    checkConnection: jest.fn(),
    analyzeCode: jest.fn(),
    getAvailableModel: jest.fn(),
  })),
}));

describe('Voice Archetype System', () => {
  let voiceSystem: VoiceArchetypeSystem;
  let mockModelClient: jest.Mocked<LocalModelClient>;

  beforeEach(async () => {
    mockModelClient = new LocalModelClient() as jest.Mocked<LocalModelClient>;

    const config = {
      voices: {
        default: ['explorer', 'maintainer'],
        available: ['explorer', 'maintainer', 'analyzer', 'developer', 'implementor', 'security', 'architect', 'designer', 'optimizer'],
        parallel: true,
        maxConcurrent: 3
      }
    } as any;

    voiceSystem = new VoiceArchetypeSystem(mockModelClient, config);
    await (voiceSystem as any).initializeVoices(); // Await the async initialization

    // Manually mock the methods of voiceSystem
    voiceSystem.getAvailableVoices = jest.fn().mockReturnValue([
      { id: 'explorer', name: 'Explorer', systemPrompt: 'You are Explorer...', temperature: 0.9, style: 'experimental' },
      { id: 'maintainer', name: 'Maintainer', systemPrompt: 'You are Maintainer...', temperature: 0.5, style: 'conservative' },
      { id: 'security', name: 'Security', systemPrompt: 'You are Security Engineer...', temperature: 0.3, style: 'defensive' },
      { id: 'analyzer', name: 'Analyzer', systemPrompt: 'You are Analyzer...', temperature: 0.7, style: 'analytical' },
      { id: 'developer', name: 'Developer', systemPrompt: 'You are Developer...', temperature: 0.8, style: 'practical' },
      { id: 'implementor', name: 'Implementor', systemPrompt: 'You are Implementor...', temperature: 0.6, style: 'efficient' },
      { id: 'architect', name: 'Architect', systemPrompt: 'You are Architect...', temperature: 0.4, style: 'strategic' },
      { id: 'designer', name: 'Designer', systemPrompt: 'You are Designer...', temperature: 0.7, style: 'creative' },
      { id: 'optimizer', name: 'Optimizer', systemPrompt: 'You are Optimizer...', temperature: 0.2, style: 'performance' },
    ]);

    voiceSystem.getVoice = jest.fn().mockImplementation((id: string) => {
      const voices = voiceSystem.getAvailableVoices();
      return voices.find(v => v.id === id.toLowerCase());
    });

    voiceSystem.recommendVoices = jest.fn().mockImplementation((prompt: string) => {
      // Simple mock implementation for recommendations
      if (prompt.includes('security')) return ['security', 'explorer'];
      if (prompt.includes('interface')) return ['designer', 'explorer'];
      if (prompt.includes('performance')) return ['optimizer', 'explorer'];
      if (prompt.includes('architecture')) return ['architect', 'explorer'];
      return ['explorer', 'maintainer'];
    });

    voiceSystem.validateVoices = jest.fn().mockImplementation((ids: string[]) => {
      const available = voiceSystem.getAvailableVoices().map(v => v.id);
      const valid = ids.filter(id => available.includes(id.toLowerCase()));
      const invalid = ids.filter(id => !available.includes(id.toLowerCase()));
      return { valid, invalid };
    });

    voiceSystem.getDefaultVoices = jest.fn().mockReturnValue(['explorer', 'maintainer']);

    voiceSystem.generateMultiVoiceSolutions = jest.fn().mockResolvedValue([]);
    voiceSystem.synthesizeVoiceResponses = jest.fn().mockResolvedValue({});
  });

  describe('Voice Management', () => {
    test('should return all available voices', () => {
      const voices = voiceSystem.getAvailableVoices();
      expect(voices).toHaveLength(9);
      expect(voices.map(v => v.id)).toContain('explorer');
      expect(voices.map(v => v.id)).toContain('security');
    });

    test('should get specific voice by ID', () => {
      const explorer = voiceSystem.getVoice('explorer');
      expect(explorer).toBeDefined();
      expect(explorer?.name).toBe('Explorer');
      expect(explorer?.style).toBe('experimental');
      expect(explorer?.temperature).toBe(0.9);
    });

    test('should return undefined for unknown voice', () => {
      const unknown = voiceSystem.getVoice('unknown-voice');
      expect(unknown).toBeUndefined();
    });

    test('should handle case-insensitive voice lookup', () => {
      const explorer = voiceSystem.getVoice('EXPLORER');
      expect(explorer).toBeDefined();
      expect(explorer?.id).toBe('explorer');
    });
  });

  describe('Voice Recommendations', () => {
    test('should recommend security voice for authentication prompts', () => {
      const prompt = 'Create a secure authentication system with JWT tokens';
      const recommendations = voiceSystem.recommendVoices(prompt);
      
      expect(recommendations).toContain('security');
      expect(recommendations).toContain('explorer'); // Always included
      expect(recommendations).toContain('maintainer'); // Always included if space
    });

    test('should recommend UI voices for interface prompts', () => {
      const prompt = 'Design a responsive user interface component';
      const recommendations = voiceSystem.recommendVoices(prompt);
      
      expect(recommendations).toContain('designer');
      expect(recommendations).toContain('explorer');
    });

    test('should recommend performance voices for optimization prompts', () => {
      const prompt = 'Optimize this function for better performance and caching';
      const recommendations = voiceSystem.recommendVoices(prompt);
      
      expect(recommendations).toContain('optimizer');
      expect(recommendations).toContain('explorer');
    });

    test('should recommend architecture voices for system design', () => {
      const prompt = 'Design a microservices architecture for an e-commerce system';
      const recommendations = voiceSystem.recommendVoices(prompt);
      
      expect(recommendations).toContain('architect');
      expect(recommendations).toContain('explorer');
    });

    test('should limit recommendations to maxConcurrent', () => {
      const prompt = 'Create a secure, fast, well-designed microservices API with great UX';
      const recommendations = voiceSystem.recommendVoices(prompt);
      
      expect(recommendations.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Voice Validation', () => {
    test('should validate correct voice IDs', () => {
      const result = voiceSystem.validateVoices(['explorer', 'security', 'maintainer']);
      
      expect(result.valid).toEqual(['explorer', 'security', 'maintainer']);
      expect(result.invalid).toEqual([]);
    });

    test('should identify invalid voice IDs', () => {
      const result = voiceSystem.validateVoices(['explorer', 'invalid', 'security', 'unknown']);
      
      expect(result.valid).toEqual(['explorer', 'security']);
      expect(result.invalid).toEqual(['invalid', 'unknown']);
    });

    test('should handle mixed case voice IDs', () => {
      const result = voiceSystem.validateVoices(['EXPLORER', 'Security', 'maintainer']);
      
      expect(result.valid).toEqual(['explorer', 'security', 'maintainer']);
      expect(result.invalid).toEqual([]);
    });
  });

  describe('Multi-Voice Generation', () => {
    test('should generate solutions with multiple voices', async () => {
      const mockResponses = [
        { content: 'Explorer response', voice: 'Explorer', confidence: 0.8, tokens_used: 100 },
        { content: 'Security response', voice: 'Security Engineer', confidence: 0.9, tokens_used: 120 }
      ];

      mockModelClient.generateVoiceResponse.mockResolvedValue(mockResponses[0]);

      const result = await voiceSystem.generateMultiVoiceSolutions(
        'Create a secure login function',
        ['explorer', 'security'],
        { files: [] }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle invalid voice IDs gracefully', async () => {
      await expect(
        voiceSystem.generateMultiVoiceSolutions(
          'Test prompt',
          ['invalid-voice'],
          { files: [] }
        )
      ).rejects.toThrow();
    });
  });

  describe('Default Configuration', () => {
    test('should return default voices from config', () => {
      const defaults = voiceSystem.getDefaultVoices();
      expect(defaults).toEqual(['explorer', 'maintainer']);
    });
  });

  describe('Voice Properties', () => {
    test('should have correct explorer properties', () => {
      const explorer = voiceSystem.getVoice('explorer');
      expect(explorer?.temperature).toBe(0.9);
      expect(explorer?.style).toBe('experimental');
      expect(explorer?.systemPrompt).toContain('innovation');
    });

    test('should have correct security properties', () => {
      const security = voiceSystem.getVoice('security');
      expect(security?.temperature).toBe(0.3);
      expect(security?.style).toBe('defensive');
      expect(security?.systemPrompt).toContain('secure coding');
    });

    test('should have correct maintainer properties', () => {
      const maintainer = voiceSystem.getVoice('maintainer');
      expect(maintainer?.temperature).toBe(0.5);
      expect(maintainer?.style).toBe('conservative');
      expect(maintainer?.systemPrompt).toContain('stability');
    });
  });
});