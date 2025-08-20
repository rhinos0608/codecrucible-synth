import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { VoiceArchetypeSystem } from '../../src/voices/voice-archetype-system.js';

describe('Simple Integration Tests', () => {
  let voiceSystem: VoiceArchetypeSystem;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      generateVoiceResponse: jest.fn().mockResolvedValue({
        content: 'Mock response',
        confidence: 0.8,
        tokens_used: 50
      }),
      checkConnection: jest.fn().mockResolvedValue(true),
      analyzeCode: jest.fn().mockResolvedValue('Mock analysis'),
      getAvailableModel: jest.fn().mockResolvedValue('test-model')
    };

    const mockConfig = {
      voices: {
        default: ['explorer', 'maintainer'],
        available: ['explorer', 'maintainer', 'security'],
        parallel: false,
        maxConcurrent: 3
      }
    };

    voiceSystem = new VoiceArchetypeSystem(mockClient, mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should integrate voice system with mock client', async () => {
    const voices = voiceSystem.getAvailableVoices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0].id).toBe('explorer');
  });

  test('should validate voice recommendations', async () => {
    const recommendations = voiceSystem.recommendVoices('Create a secure authentication system');
    expect(recommendations).toContain('security');
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(5);
  });

  test('should handle voice validation correctly', () => {
    const result = voiceSystem.validateVoices(['explorer', 'invalid', 'security']);
    expect(result.valid).toContain('explorer');
    expect(result.valid).toContain('security');
    expect(result.invalid).toContain('invalid');
  });

  test('should generate multi-voice solutions', async () => {
    const prompt = 'Test prompt';
    const voices = ['explorer', 'maintainer'];
    const context = { files: [] };

    const result = await voiceSystem.generateMultiVoiceSolutions(prompt, voices, context);
    
    expect(result).toBeDefined();
    expect(result.length).toBe(2);
    expect(mockClient.generateVoiceResponse).toHaveBeenCalledTimes(2);
  });

  test('should synthesize responses with different modes', async () => {
    const prompt = 'Create a new feature';
    const voices = ['explorer', 'developer'];
    
    const result = await voiceSystem.synthesize(prompt, voices, 'collaborative', mockClient);
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.voicesUsed).toEqual(voices);
    expect(result.qualityScore).toBeGreaterThan(0);
  });
}, 10000); // 10 second timeout for the whole suite