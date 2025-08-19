#!/usr/bin/env node

/**
 * Simple CLI test with timeout fixes
 */

import { CLI } from './dist/core/cli.js';
import { UnifiedModelClient } from './dist/core/client.js';
import { VoiceArchetypeSystem } from './dist/voices/voice-archetype-system.js';

console.log('🧪 Testing simplified CLI...');

try {
  // Create minimal context with shorter timeouts
  const modelClient = new UnifiedModelClient({
    providers: [
      { 
        type: 'ollama', 
        endpoint: 'http://localhost:11434',
        model: 'gemma:latest',
        timeout: 10000  // Reduced timeout
      }
    ],
    executionMode: 'auto',
    fallbackChain: ['ollama'],
    performanceThresholds: {
      fastModeMaxTokens: 1024,  // Reduced tokens
      timeoutMs: 10000,         // Reduced timeout
      maxConcurrentRequests: 1  // Reduced concurrency
    },
    security: {
      enableSandbox: false,     // Disable for simplicity
      maxInputLength: 1000,     // Reduced input length
      allowedCommands: ['npm', 'node', 'git']
    }
  });
  
  console.log('Initializing model client...');
  await modelClient.initialize();
  
  console.log('Creating voice system...');
  const voiceSystem = new VoiceArchetypeSystem();
  
  const context = {
    modelClient,
    voiceSystem,
    mcpManager: null,
    config: { 
      model: { name: 'gemma:latest' },
      features: {
        enableIntelligence: false,     // Disable complex features
        enableDualAgent: false,
        enableRealTimeAudit: false,
        enableContextAware: false
      }
    }
  };
  
  console.log('Creating CLI...');
  const cli = new CLI(context);
  
  console.log('Testing simple greeting...');
  await cli.run(['--help']);
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}