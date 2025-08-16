#!/usr/bin/env node

console.log('🤖 Testing CodeCrucible agentic mode...\n');

import { initializeCLIContext } from './dist/index.js';
import { CodeCrucibleCLI } from './dist/core/cli.js';

async function testAgentic() {
  try {
    // Initialize CLI with proper context
    const context = await initializeCLIContext();
    const cli = new CodeCrucibleCLI(context);
    
    console.log('🤖 CLI created, testing agentic mode...\n');
    
    // Test with agentic mode
    const options = {
      agentic: true,
      maxIterations: 5
    };
    
    console.log('📝 Testing prompt: "Find and analyze any TODO comments in the codebase"');
    console.log(`🤖 Using agentic mode with max ${options.maxIterations} iterations\n`);
    
    await cli.handleGeneration('Find and analyze any TODO comments in the codebase', options);
    
    console.log('\n✅ Agentic mode test completed!');
    
  } catch (error) {
    console.error('❌ Agentic test failed:', error.message);
    console.error(error.stack);
  }
}

testAgentic();