#!/usr/bin/env node

// Test just the index.js main function with debugging
console.log('Starting minimal CLI test...');

async function testMinimal() {
  try {
    console.log('Step 1: Import main function...');
    const { main } = await import('./dist/index.js');
    
    console.log('Step 2: Call main with --help...');
    process.argv = ['node', 'test', '--help'];
    
    const timeout = setTimeout(() => {
      console.log('❌ Main function timed out');
      process.exit(1);
    }, 10000);
    
    await main();
    clearTimeout(timeout);
    console.log('✅ Main function completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testMinimal();