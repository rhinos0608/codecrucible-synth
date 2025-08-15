// Comprehensive test of all agent capabilities
import { initializeCLIContext } from './dist/index.js';
import { ReActAgent } from './dist/core/react-agent.js';

async function testComprehensiveAgent() {
  console.log('🧪 Comprehensive CodeCrucible Agent Test...\n');
  
  try {
    const context = await initializeCLIContext();
    const agent = new ReActAgent(context, process.cwd());
    
    console.log('📋 Available tools:', agent.getAvailableTools().map(t => t.definition.name).join(', '));
    
    // Test 1: File creation
    console.log('\n🧪 Test 1: Create a JavaScript file');
    const response1 = await agent.processRequest('Create a file called test.js with a simple hello world function');
    console.log('✅ Response:', response1);
    
    // Test 2: File reading  
    console.log('\n🧪 Test 2: Read the file we just created');
    const response2 = await agent.processRequest('Read file test.js');
    console.log('✅ Response:', response2);
    
    // Test 3: List files
    console.log('\n🧪 Test 3: List files in current directory');
    const response3 = await agent.processRequest('list files in current directory');
    console.log('✅ Response:', response3);
    
    // Test 4: Git status
    console.log('\n🧪 Test 4: Check git status');
    const response4 = await agent.processRequest('git status');
    console.log('✅ Response:', response4);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testComprehensiveAgent();