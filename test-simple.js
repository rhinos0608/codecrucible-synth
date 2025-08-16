#!/usr/bin/env node

console.log('🔍 Testing simple agent reasoning...\n');

import { initializeCLIContext } from './dist/index.js';
import { ReActAgent } from './dist/core/react-agent.js';

async function testSimple() {
  try {
    const context = await initializeCLIContext();
    const agent = new ReActAgent(context, process.cwd());
    
    console.log('🤖 Testing VERY simple request...\n');
    
    // Test with extremely simple prompt that should complete in 2-3 steps
    const result = await agent.processRequest('What is the name of this project? (It should be in package.json)');
    
    console.log('✅ Result:', result);
    
  } catch (error) {
    console.error('❌ Simple test failed:', error.message);
    console.error(error.stack);
  }
}

testSimple();