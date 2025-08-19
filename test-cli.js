#!/usr/bin/env node

/**
 * Simple CLI test runner to debug initialization issues
 */

import { CLI } from './dist/core/cli.js';
import { UnifiedModelClient } from './dist/core/client.js';
import { VoiceArchetypeSystem } from './dist/voices/voice-archetype-system.js';

console.log('🧪 Testing CLI initialization...');

try {
  // Create minimal context
  console.log('Creating minimal model client...');
  const modelClient = new UnifiedModelClient({
    providers: [
      { 
        type: 'ollama', 
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        timeout: 30000
      }
    ],
    executionMode: 'auto',
    fallbackChain: ['ollama'],
    performanceThresholds: {
      fastModeMaxTokens: 2048,
      timeoutMs: 30000,
      maxConcurrentRequests: 3
    },
    security: {
      enableSandbox: true,
      maxInputLength: 50000,
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
    config: { model: { name: 'llama2' } }
  };
  
  console.log('Creating CLI...');
  const cli = new CLI(context);
  
  console.log('Running CLI with args:', process.argv.slice(2));
  await cli.run(process.argv.slice(2));
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}