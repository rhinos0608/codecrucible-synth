#!/usr/bin/env node

console.log('🎭 Testing CodeCrucible voice switching and synthesis...\n');

import { initializeCLIContext } from './dist/index.js';
import { CodeCrucibleCLI } from './dist/core/cli.js';

async function testVoices() {
  try {
    // Initialize CLI with proper context
    const context = await initializeCLIContext();
    const cli = new CodeCrucibleCLI(context);
    
    console.log('🤖 CLI created, testing voice synthesis...\n');
    
    // Test with multi-voice generation
    const options = {
      voices: 'developer,analyzer',
      mode: 'competitive'
    };
    
    console.log('📝 Testing prompt: "Analyze the package.json file and suggest improvements"');
    console.log(`🎭 Using voices: ${options.voices} in ${options.mode} mode\n`);
    
    await cli.handleGeneration('Analyze the package.json file and suggest improvements', options);
    
    console.log('\n✅ Voice synthesis test completed!');
    
  } catch (error) {
    console.error('❌ Voice test failed:', error.message);
    console.error(error.stack);
  }
}

testVoices();