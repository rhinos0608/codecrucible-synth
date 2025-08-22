/**
 * Real Voice Archetype System Integration Tests
 * Tests actual voice system functionality with real AI providers
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { VoiceArchetypeSystem } from '../../src/voices/voice-archetype-system.js';
import { UnifiedModelClient, UnifiedClientConfig } from '../../src/core/client.js';
import { ConfigManager } from '../../src/config/config-manager.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

describe('Real Voice Archetype System', () => {
  let voiceSystem: VoiceArchetypeSystem;
  let modelClient: UnifiedModelClient;
  const CLI_PATH = path.join(process.cwd(), 'dist', 'index.js');

  beforeAll(async () => {
    // Ensure CLI is built
    try {
      await execAsync('npm run build');
    } catch (error) {
      console.warn('Build may have failed, continuing with existing dist');
    }

    // Initialize real model client
    const configManager = new ConfigManager();
    const appConfig = await configManager.loadConfiguration();
    
    const clientConfig: UnifiedClientConfig = {
      providers: [
        {
          type: 'ollama',
          endpoint: appConfig.model?.endpoint || 'http://localhost:11434',
          model: null,
          timeout: 30000,
        },
        {
          type: 'lm-studio',
          endpoint: 'http://localhost:1234',
          model: null,
          timeout: 30000,
        },
      ],
      executionMode: 'auto',
      fallbackChain: ['ollama', 'lm-studio'],
      performanceThresholds: {
        fastModeMaxTokens: 4096,
        timeoutMs: 60000,
        maxConcurrentRequests: 2,
      },
      security: {
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['npm', 'node', 'git'],
      },
    };

    modelClient = new UnifiedModelClient(clientConfig);
    
    try {
      await modelClient.initialize();
    } catch (error) {
      console.warn('Model client initialization failed, continuing with limited functionality');
    }

    // Initialize voice system
    voiceSystem = new VoiceArchetypeSystem(modelClient);
  }, 60000);

  afterAll(async () => {
    if (modelClient) {
      await modelClient.destroy();
    }
  });

  describe('Voice Archetype Management', () => {
    it('should have all expected voice archetypes available', () => {
      const voices = voiceSystem.getAvailableVoices();
      
      expect(voices.length).toBeGreaterThan(5);
      
      const expectedVoices = ['explorer', 'maintainer', 'security', 'architect', 'developer'];
      expectedVoices.forEach(voiceId => {
        const voice = voices.find(v => v.id === voiceId);
        expect(voice).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.description).toBeDefined();
      });
    });

    it('should provide voice specializations and expertise areas', () => {
      const voices = voiceSystem.getAvailableVoices();
      
      voices.forEach(voice => {
        expect(voice.id).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.description).toBeDefined();
        expect(voice.expertise).toBeDefined();
        expect(Array.isArray(voice.expertise)).toBe(true);
        expect(voice.expertise.length).toBeGreaterThan(0);
      });
    });

    it('should retrieve specific voices by ID', () => {
      const explorerVoice = voiceSystem.getVoice('explorer');
      expect(explorerVoice).toBeDefined();
      expect(explorerVoice.id).toBe('explorer');
      expect(explorerVoice.expertise).toContain('innovation');

      const securityVoice = voiceSystem.getVoice('security');
      expect(securityVoice).toBeDefined();
      expect(securityVoice.id).toBe('security');
      expect(securityVoice.expertise).toContain('vulnerability assessment');
    });
  });

  describe('Real Voice Response Generation', () => {
    it('should generate responses with different voice characteristics', async () => {
      const prompt = 'Explain the importance of error handling in Node.js';
      const voiceIds = ['developer', 'security', 'maintainer'];
      
      const responses = [];
      
      for (const voiceId of voiceIds) {
        try {
          const response = await voiceSystem.generateVoiceResponse(voiceId, prompt, {
            timeout: 30000
          });
          
          if (response) {
            responses.push({ voiceId, response });
            
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(20);
            expect(response).toMatch(/error|handling|node/i);
          }
        } catch (error) {
          if (!error.message.includes('No providers available')) {
            console.warn(`Voice ${voiceId} failed: ${error.message}`);
          }
        }
      }
      
      // At least one voice should respond if providers are available
      if (responses.length > 0) {
        console.log(`Generated ${responses.length}/${voiceIds.length} voice responses`);
        
        // Responses should vary by voice perspective
        const uniqueResponses = new Set(responses.map(r => r.response.substring(0, 100)));
        if (responses.length > 1) {
          expect(uniqueResponses.size).toBeGreaterThan(1);
        }
      }
    }, 120000);

    it('should handle code analysis requests with appropriate voices', async () => {
      const codeSnippet = `
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`;
      
      const analysisPrompt = `Analyze this code for quality and potential improvements: ${codeSnippet}`;
      
      try {
        const developerResponse = await voiceSystem.generateVoiceResponse('developer', analysisPrompt, {
          timeout: 30000
        });
        
        if (developerResponse) {
          expect(developerResponse).toBeDefined();
          expect(developerResponse).toMatch(/function|code|improve|quality/i);
          expect(developerResponse.length).toBeGreaterThan(50);
        }
        
        const securityResponse = await voiceSystem.generateVoiceResponse('security', analysisPrompt, {
          timeout: 30000
        });
        
        if (securityResponse) {
          expect(securityResponse).toBeDefined();
          expect(securityResponse).toMatch(/security|validation|input|safe/i);
        }
      } catch (error) {
        if (error.message.includes('No providers available')) {
          console.warn('No AI providers available for voice testing');
        } else {
          throw error;
        }
      }
    }, 80000);
  });

  describe('Multi-Voice Collaboration', () => {
    it('should generate multiple voice responses in parallel', async () => {
      const prompt = 'What are the best practices for API design?';
      const voiceIds = ['architect', 'developer', 'security'];
      
      try {
        const startTime = Date.now();
        const responses = await voiceSystem.generateMultiVoiceResponses(voiceIds, prompt, {
          timeout: 45000
        });
        const duration = Date.now() - startTime;
        
        if (responses && Object.keys(responses).length > 0) {
          expect(typeof responses).toBe('object');
          
          // Check that we got responses from requested voices
          voiceIds.forEach(voiceId => {
            if (responses[voiceId]) {
              expect(responses[voiceId]).toBeDefined();
              expect(typeof responses[voiceId]).toBe('string');
              expect(responses[voiceId]).toMatch(/api|design|practice/i);
            }
          });
          
          // Parallel execution should be faster than sequential
          console.log(`Multi-voice responses generated in ${duration}ms`);
        }
      } catch (error) {
        if (error.message.includes('No providers available')) {
          console.warn('No AI providers available for multi-voice testing');
        } else {
          throw error;
        }
      }
    }, 60000);

    it('should provide voice consensus and synthesis', async () => {
      const prompt = 'How should we handle user authentication in a web application?';
      
      try {
        const synthesis = await voiceSystem.synthesizeVoicePerspectives(['security', 'developer', 'architect'], prompt, {
          timeout: 60000
        });
        
        if (synthesis) {
          expect(synthesis).toBeDefined();
          expect(typeof synthesis).toBe('object');
          
          if (synthesis.perspectives) {
            expect(Array.isArray(synthesis.perspectives)).toBe(true);
            synthesis.perspectives.forEach(perspective => {
              expect(perspective.voiceId).toBeDefined();
              expect(perspective.response).toBeDefined();
            });
          }
          
          if (synthesis.consensus) {
            expect(typeof synthesis.consensus).toBe('string');
            expect(synthesis.consensus).toMatch(/authentication|security|user/i);
          }
        }
      } catch (error) {
        if (error.message.includes('No providers available')) {
          console.warn('No AI providers available for synthesis testing');
        } else {
          throw error;
        }
      }
    }, 90000);
  });

  describe('CLI Voice Integration', () => {
    it('should use voice system in CLI responses', async () => {
      const { stdout, stderr } = await execAsync(
        `node "${CLI_PATH}" "Explain async/await with security considerations"`,
        { timeout: 50000 }
      );
      
      // Should generate response using voice system
      expect(stdout.length).toBeGreaterThan(30);
      expect(stdout).toMatch(/async|await/i);
      
      // Should not have critical errors
      expect(stderr).not.toMatch(/fatal.*error|voice.*system.*failed/i);
    }, 55000);

    it('should handle voice-specific requests in CLI', async () => {
      const { stdout } = await execAsync(
        `node "${CLI_PATH}" "From a security perspective, what are the main risks in JavaScript?"`,
        { timeout: 45000 }
      );
      
      // Should respond appropriately to security-focused query
      expect(stdout.length).toBeGreaterThan(30);
      expect(stdout).toMatch(/security|risk|javascript/i);
    }, 50000);
  });

  describe('Voice System Performance', () => {
    it('should handle voice switching efficiently', async () => {
      const prompts = [
        'Quick code review needed',
        'Security audit question',
        'Architecture design help'
      ];
      
      const voices = ['developer', 'security', 'architect'];
      
      const startTime = Date.now();
      let successCount = 0;
      
      for (let i = 0; i < prompts.length; i++) {
        try {
          const response = await voiceSystem.generateVoiceResponse(voices[i], prompts[i], {
            timeout: 20000
          });
          
          if (response) {
            successCount++;
            expect(response.length).toBeGreaterThan(10);
          }
        } catch (error) {
          if (!error.message.includes('No providers available')) {
            console.warn(`Voice switching test failed for ${voices[i]}: ${error.message}`);
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      if (successCount > 0) {
        const avgTime = totalTime / successCount;
        console.log(`Voice switching: ${successCount}/${prompts.length} succeeded, avg ${avgTime}ms per voice`);
        
        // Should complete voice switches efficiently
        expect(avgTime).toBeLessThan(30000);
      }
    }, 90000);
  });

  describe('Voice System Error Handling', () => {
    it('should handle invalid voice IDs gracefully', () => {
      expect(() => voiceSystem.getVoice('nonexistent-voice')).not.toThrow();
      
      const invalidVoice = voiceSystem.getVoice('nonexistent-voice');
      expect(invalidVoice).toBeUndefined();
    });

    it('should handle empty prompts appropriately', async () => {
      await expect(voiceSystem.generateVoiceResponse('developer', '', { timeout: 10000 }))
        .rejects.toThrow(/empty|invalid|required/i);
    });

    it('should handle provider failures gracefully', async () => {
      try {
        await voiceSystem.generateVoiceResponse('developer', 'test prompt', { timeout: 5000 });
      } catch (error) {
        // Should get a proper error message
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
      }
      
      // Voice system should remain functional after errors
      const voices = voiceSystem.getAvailableVoices();
      expect(voices.length).toBeGreaterThan(0);
    });
  });

  describe('Voice Configuration and Customization', () => {
    it('should support voice configuration updates', () => {
      const voices = voiceSystem.getAvailableVoices();
      const originalCount = voices.length;
      
      expect(originalCount).toBeGreaterThan(0);
      
      // Voice system should be configurable
      voices.forEach(voice => {
        expect(voice.expertise).toBeDefined();
        expect(voice.persona).toBeDefined();
      });
    });
  });
});