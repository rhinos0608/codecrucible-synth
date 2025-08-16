#!/usr/bin/env node

console.log('🎭 Testing improved CodeCrucible voice execution...\n');

import { initializeCLIContext } from './dist/index.js';
import { CodeCrucibleCLI } from './dist/core/cli.js';

async function testVoicesImproved() {
  try {
    const context = await initializeCLIContext();
    const cli = new CodeCrucibleCLI(context);
    
    console.log('🎭 Testing voice system with focused question...\n');
    
    // Test with specific, answerable question that requires tool usage
    const options = {
      voices: 'developer,analyzer',
      mode: 'competitive'
    };
    
    console.log('📝 Testing prompt: "What dependencies does this project have? List them from package.json"');
    console.log(`🎭 Using voices: ${options.voices} in ${options.mode} mode\n`);
    
    await cli.handleGeneration('What dependencies does this project have? List them from package.json', options);
    
    console.log('\n✅ Improved voice test completed!');
    
  } catch (error) {
    console.error('❌ Voice test failed:', error.message);
    console.error(error.stack);
  }
}

testVoicesImproved();