// Simple test to verify the agent can actually execute tasks
import { initializeCLIContext } from './dist/index.js';
import { ReActAgent } from './dist/core/react-agent.js';

async function testAgent() {
  console.log('🔧 Testing CodeCrucible Agent...');
  
  try {
    const context = await initializeCLIContext();
    const agent = new ReActAgent(context, process.cwd());
    
    console.log('📋 Available tools:', agent.getAvailableTools().map(t => t.definition.name));
    
    // Test simple file creation
    const response = await agent.processRequest('Create a simple test file named hello.txt with "Hello CodeCrucible" inside');
    
    console.log('🤖 Agent response:', response);
    
    // Check if file was created
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile('hello.txt', 'utf8');
      console.log('✅ File created successfully:', content);
    } catch (error) {
      console.log('❌ File was not created');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAgent();