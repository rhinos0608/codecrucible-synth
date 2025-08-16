#!/usr/bin/env node

import { initializeCLIContext } from './dist/index.js';
import { CodeCrucibleCLI } from './dist/core/cli.js';
import { ReActAgent } from './dist/core/react-agent.js';
import { logger } from './dist/core/logger.js';

async function testAgent() {
  console.log('🧪 Testing CodeCrucible Agent...\n');
  
  try {
    // Initialize CLI with proper context
    const context = await initializeCLIContext();
    const cli = new CodeCrucibleCLI(context);
    
    // Create agent
    const agent = new ReActAgent(context);
    
    // Test 1: List files
    console.log('📁 Test 1: Listing files in src/core directory');
    const result1 = await agent.processRequest('List the TypeScript files in the src/core directory');
    console.log('Result:', result1);
    console.log('✅ Test 1 completed\n');
    
    // Test 2: Read file
    console.log('📖 Test 2: Reading package.json');
    const result2 = await agent.processRequest('Show me the name and version from package.json');
    console.log('Result:', result2);
    console.log('✅ Test 2 completed\n');
    
    // Test 3: Code analysis
    console.log('🔍 Test 3: Analyzing code');
    const result3 = await agent.processRequest('What is the main purpose of src/index.ts?');
    console.log('Result:', result3);
    console.log('✅ Test 3 completed\n');
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAgent().catch(console.error);