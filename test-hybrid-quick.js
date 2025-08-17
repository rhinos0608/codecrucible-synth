#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';

async function testHybridQuick() {
  console.log('⚡ Quick Hybrid System Test');
  console.log('==========================\n');

  try {
    console.log('⚙️  Initializing hybrid client...');
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: false
    });

    console.log('✅ Hybrid client initialized\n');

    // Test with simple task that should route to LM Studio
    console.log('🧠 Testing template generation (should route to LM Studio)...');
    
    const startTime = Date.now();
    const result = await hybridClient.generateResponse(
      'Create a simple JavaScript function that adds two numbers', 
      {}, 
      {
        taskType: 'template',
        complexity: 'simple'
      }
    );
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Success!`);
    console.log(`   🎯 LLM Used: ${result.llmUsed || 'unknown'}`);
    console.log(`   ⏱️  Total Time: ${duration}ms`);
    console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   📝 Generated Code:\n${result.code || result.synthesis || 'No code generated'}`);
    
    if (duration < 10000) {
      console.log(`\n🎉 Performance target met! (${duration}ms < 10s)`);
    } else {
      console.log(`\n⚠️  Performance slower than expected (${duration}ms)`);
    }

  } catch (error) {
    console.error('\n💥 Quick test failed:', error.message);
  }
}

testHybridQuick().catch(console.error);