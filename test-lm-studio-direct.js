#!/usr/bin/env node
import { LMStudioClient } from './dist/core/lm-studio-client.js';

async function testLMStudioDirect() {
  console.log('🔧 Direct LM Studio Test (No Streaming)');
  console.log('=====================================\n');

  try {
    const client = new LMStudioClient({
      endpoint: 'http://localhost:1234',
      enabled: true,
      models: ['google/gemma-3-12b'], // Use smaller model that was loaded
      maxConcurrent: 1,
      streamingEnabled: false, // Disable streaming to avoid timeout issues
      taskTypes: ['template']
    });

    console.log('⚙️  Testing with google/gemma-3-12b (non-streaming)...');
    
    const startTime = Date.now();
    const result = await client.generateCode('function add(a, b) { return a + b; }');
    const duration = Date.now() - startTime;
    
    console.log(`✅ Success!`);
    console.log(`   ⏱️  Time: ${duration}ms`);
    console.log(`   🎯 Confidence: ${result.confidence}`);
    console.log(`   📝 Code:\n${result.code}`);
    console.log(`   💬 Explanation: ${result.explanation}`);

  } catch (error) {
    console.error('❌ Direct test failed:', error.message);
  }
}

testLMStudioDirect().catch(console.error);