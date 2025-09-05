/**
 * Direct test of MCP timeout fix
 */

import { ModelsCommand } from './dist/application/cli/models-command.js';

async function testMcpTimeout() {
  console.log('🧪 Testing MCP timeout fix...');
  console.log('Expected: Should timeout after 8 seconds, not 30+ seconds\n');
  
  const startTime = Date.now();
  
  try {
    const modelsCommand = new ModelsCommand();
    
    // This should timeout after 8 seconds instead of hanging for 30+ seconds
    await modelsCommand.execute({ list: true });
    
    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Command completed in ${elapsed}ms`);
    
    if (elapsed < 12000) { // Within 12 seconds (8s timeout + buffer)
      console.log('✅ TIMEOUT FIX WORKING: Command responded within expected timeout window');
    } else {
      console.log('❌ TIMEOUT FIX FAILED: Command took longer than expected');
    }
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`\n❌ Command failed after ${elapsed}ms: ${error.message}`);
  }
}

testMcpTimeout().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});