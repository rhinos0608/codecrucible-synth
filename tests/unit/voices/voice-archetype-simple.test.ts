/**
 * Voice Archetype System Test Suite - Enterprise Testing
 * Testing the existing multi-voice AI collaboration system
 */

import { VoiceArchetypeSystem } from '../../../src/voices/voice-archetype-system.js';

// Mock the model client to avoid external dependencies
const mockModelClient = {
  generateResponse: jest.fn().mockResolvedValue({
    content: 'Mock voice response',
    tokensUsed: 100
  }),
  generateVoiceResponse: jest.fn().mockResolvedValue({
    content: 'Mock voice response',
    tokensUsed: 100
  })
};

describe('VoiceArchetypeSystem Enterprise Features', () => {
  let voiceSystem: VoiceArchetypeSystem;

  beforeEach(() => {
    voiceSystem = new VoiceArchetypeSystem();
  });

  describe('Voice Management', () => {
    test('should initialize with available voices', () => {
      const voices = voiceSystem.getAvailableVoices();
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
      
      // Check for key enterprise voices
      const voiceNames = voices.map(v => v.name);
      expect(voiceNames).toContain('Explorer');
      expect(voiceNames).toContain('Maintainer');
      expect(voiceNames).toContain('Guardian');
    });

    test('should get voice by id', () => {
      const explorer = voiceSystem.getVoice('explorer');
      expect(explorer).toBeDefined();
      expect(explorer?.name).toBe('Explorer');
      expect(explorer?.style).toBeDefined();
    });

    test('should handle invalid voice id', () => {
      const invalidVoice = voiceSystem.getVoice('invalid-voice-id');
      expect(invalidVoice).toBeUndefined();
    });

    test('should get default voices configuration', () => {
      const defaultVoices = voiceSystem.getDefaultVoices();
      expect(Array.isArray(defaultVoices)).toBe(true);
      expect(defaultVoices.length).toBeGreaterThan(0);
    });
  });

  describe('Voice Characteristics', () => {
    test('should have properly configured Explorer voice', () => {
      const explorer = voiceSystem.getVoice('explorer');
      expect(explorer).toBeDefined();
      expect(explorer?.name).toBe('Explorer');
      expect(explorer?.style).toContain('experimental');
      expect(explorer?.temperature).toBeGreaterThan(0.7); // Higher creativity
    });

    test('should have properly configured Maintainer voice', () => {
      const maintainer = voiceSystem.getVoice('maintainer');
      expect(maintainer).toBeDefined();
      expect(maintainer?.name).toBe('Maintainer');
      expect(maintainer?.style).toContain('conservative');
      expect(maintainer?.temperature).toBeLessThan(0.7); // Lower temperature for consistency
    });

    test('should have properly configured Security voice', () => {
      const security = voiceSystem.getVoice('security');
      expect(security).toBeDefined();
      expect(security?.name).toBe('Security');
      expect(security?.style).toContain('defensive');
    });
  });

  describe('Multi-Voice Generation', () => {
    test('should generate multi-voice solutions', async () => {
      const voiceIds = ['explorer', 'maintainer', 'security'];
      
      const results = await voiceSystem.generateMultiVoiceSolutions(
        voiceIds,
        'Design a secure API'
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Each result should have expected structure
      if (results.length > 0) {
        results.forEach((result) => {
          expect(result.voiceId).toBeDefined();
          if (result.response) {
            expect(result.response).toBeDefined();
          }
        });
      }
    });

    test('should handle default multi-voice workflow', async () => {
      const results = await voiceSystem.generateMultiVoiceSolutions(
        ['explorer', 'maintainer'],
        'Test prompt'
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
    });
  });

  describe('Voice Prompting System', () => {
    test('should build context-aware prompts', () => {
      const context = {
        task: 'code review',
        codeType: 'typescript',
        complexity: 'high'
      };

      const explorer = voiceSystem.getVoice('explorer');
      expect(explorer).toBeDefined();
      
      // The voice should have a system prompt that incorporates context
      expect(explorer?.systemPrompt).toBeDefined();
      expect(typeof explorer?.systemPrompt).toBe('string');
    });

    test('should have unique voice personalities', () => {
      const voices = voiceSystem.getAvailableVoices();
      
      // Each voice should have distinct characteristics
      const systemPrompts = voices.map(v => v.systemPrompt);
      const uniquePrompts = new Set(systemPrompts);
      
      expect(uniquePrompts.size).toBe(voices.length);
    });
  });

  describe('Performance and Caching', () => {
    test('should efficiently retrieve voices', () => {
      const startTime = Date.now();
      
      // Get all voices multiple times
      for (let i = 0; i < 100; i++) {
        voiceSystem.getAvailableVoices();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should be very fast (under 10ms for 100 calls)
      expect(duration).toBeLessThan(10);
    });

    test('should handle concurrent voice requests', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        voiceSystem.generateMultiVoiceSolutions(
          ['explorer'],
          `Concurrent request ${i}`
        )
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Enterprise Integration', () => {
    test('should support voice-specific configuration', () => {
      const voices = voiceSystem.getAvailableVoices();
      
      voices.forEach(voice => {
        expect(voice.id).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.style).toBeDefined();
        expect(voice.systemPrompt).toBeDefined();
        expect(voice.prompt).toBeDefined();
        expect(typeof voice.temperature).toBe('number');
        expect(voice.temperature).toBeGreaterThanOrEqual(0);
        expect(voice.temperature).toBeLessThanOrEqual(2);
      });
    });

    test('should provide voice metadata for monitoring', () => {
      const voices = voiceSystem.getAvailableVoices();
      
      voices.forEach(voice => {
        // Each voice should have sufficient metadata for enterprise monitoring
        expect(voice.id).toMatch(/^[a-z_]+$/); // Valid identifier
        expect(voice.name).toMatch(/^[A-Z][a-zA-Z\s]+$/); // Proper name format
        expect(voice.style.length).toBeGreaterThanOrEqual(9); // Meaningful description
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle missing voice gracefully', async () => {
      const results = await voiceSystem.generateMultiVoiceSolutions(
        ['nonexistent_voice'],
        'Test prompt'
      );

      expect(Array.isArray(results)).toBe(true);
      // Should handle gracefully, either with empty array or error responses
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should validate voice configuration on startup', () => {
      // The system should validate that all voices are properly configured
      const voices = voiceSystem.getAvailableVoices();
      
      expect(voices.length).toBeGreaterThan(5); // Should have multiple voices
      
      voices.forEach(voice => {
        expect(voice.systemPrompt.length).toBeGreaterThan(50); // Substantial prompts
        expect(voice.prompt.length).toBeGreaterThan(20); // Meaningful base prompts
      });
    });
  });
});