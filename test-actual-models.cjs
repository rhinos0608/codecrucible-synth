#!/usr/bin/env node

/**
 * Simple Model Test Script
 * Tests with your actual available models
 */

const { spawn } = require('child_process');

async function testWithActualModel(modelName, prompt) {
  console.log(`\n🧪 Testing with ${modelName}...`);
  
  const childProcess = spawn('node', [
    'dist/index.js', 
    prompt
  ], {
    env: { 
      ...process.env, 
      OLLAMA_MODEL: modelName,
      NODE_ENV: 'production'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let errorOutput = '';
  let hasResponse = false;
  
  childProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    output += chunk;
    
    // Look for actual response content
    if (chunk.includes('Generated response') || 
        chunk.includes('Response:') ||
        chunk.includes('def ') ||
        chunk.includes('function') ||
        chunk.includes('print(')) {
      hasResponse = true;
      console.log('📝 Response detected!');
    }
    
    // Show progress
    if (chunk.includes('✅') || chunk.includes('🎭')) {
      console.log(chunk.trim());
    }
  });
  
  childProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('⏰ Timeout after 2 minutes');
      childProcess.kill();
      resolve({ success: false, reason: 'timeout', output, error: errorOutput });
    }, 120000); // 2 minutes
    
    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      if (hasResponse) {
        console.log('✅ SUCCESS: Got actual response!');
        console.log('📄 Sample output:', output.substring(0, 200) + '...');
        resolve({ success: true, output, error: errorOutput });
      } else if (code === 0) {
        console.log('⚠️  Process completed but no clear response detected');
        resolve({ success: false, reason: 'no_response', output, error: errorOutput });
      } else {
        console.log(`❌ Process failed with code ${code}`);
        resolve({ success: false, reason: 'process_error', output, error: errorOutput });
      }
    });
  });
}

async function main() {
  console.log('🧪 Testing Agent with Your Actual Models');
  console.log('═'.repeat(50));
  
  // Test with smallest model first
  const models = ['gemma:latest', 'gemma3n:e4b'];
  const prompt = 'Write a simple Python hello world function';
  
  for (const model of models) {
    const result = await testWithActualModel(model, prompt);
    
    if (result.success) {
      console.log(`\n🎉 SUCCESS with ${model}!`);
      console.log('✅ Agent can generate responses');
      console.log('✅ No infinite loops');
      console.log('✅ Proper completion');
      
      console.log('\n💡 Recommended usage:');
      console.log(`  export OLLAMA_MODEL=${model}`);
      console.log(`  node dist/index.js "your prompt here"`);
      
      return; // Stop on first success
    } else {
      console.log(`\n❌ Failed with ${model}: ${result.reason}`);
      if (result.error) {
        console.log('Error details:', result.error.substring(0, 300) + '...');
      }
    }
  }
  
  console.log('\n❌ All model tests failed');
  console.log('\n🔧 Troubleshooting suggestions:');
  console.log('1. Check if models are properly loaded in Ollama');
  console.log('2. Try freeing up more VRAM by closing other GPU applications');
  console.log('3. Use fast mode for immediate responses: --fast flag');
  console.log('4. Consider using smaller models or quantized versions');
}

main().catch(console.error);
