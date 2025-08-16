#!/usr/bin/env node

console.log('🔍 Debug: Testing ReAct Agent tool execution...\n');

import { initializeCLIContext } from './dist/index.js';
import { ReActAgent } from './dist/core/react-agent.js';

async function debugAgent() {
  try {
    // Initialize CLI with proper context
    const context = await initializeCLIContext();
    
    // Create agent with current directory
    const agent = new ReActAgent(context, process.cwd());
    
    console.log('🤖 Agent created, testing simple prompt...\n');
    
    // Test with simple prompt that should read package.json
    const result = await agent.processRequest('What is the name of this project? Read package.json to find out.');
    
    console.log('\n✅ Agent result:', result);
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    console.error(error.stack);
  }
}

debugAgent();