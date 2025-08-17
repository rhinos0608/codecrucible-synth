#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';

async function testHybridFinal() {
  console.log('🎯 Final Hybrid System Test');
  console.log('===========================\n');

  try {
    console.log('⚙️  Initializing hybrid client with updated config...');
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: false
    });

    console.log('✅ Hybrid client initialized\n');

    // Test 1: Simple template (should use LM Studio)
    console.log('🧠 Test 1: Template generation (targeting LM Studio)...');
    const startTime1 = Date.now();
    try {
      const result1 = await hybridClient.generateResponse(
        'Create a simple hello world function', 
        {}, 
        { taskType: 'template', complexity: 'simple' }
      );
      
      const duration1 = Date.now() - startTime1;
      console.log(`✅ Template Test Success!`);
      console.log(`   🎯 LLM Used: ${result1.llmUsed || 'unknown'}`);
      console.log(`   ⏱️  Time: ${duration1}ms`);
      console.log(`   📊 Confidence: ${(result1.confidence * 100).toFixed(1)}%`);
      console.log(`   📝 Code: ${result1.code?.substring(0, 100) || 'No code'}...`);
    } catch (error) {
      console.log(`❌ Template test failed: ${error.message}`);
    }

    // Wait a moment between tests
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 2: Only test Ollama if LM Studio test was successful
    console.log('\n🧠 Test 2: Analysis task (targeting Ollama)...');
    const startTime2 = Date.now();
    try {
      const result2 = await hybridClient.generateResponse(
        'Analyze the pros and cons of using TypeScript vs JavaScript', 
        {}, 
        { taskType: 'analysis', complexity: 'complex' }
      );
      
      const duration2 = Date.now() - startTime2;
      console.log(`✅ Analysis Test Success!`);
      console.log(`   🎯 LLM Used: ${result2.llmUsed || 'unknown'}`);
      console.log(`   ⏱️  Time: ${duration2}ms`);
      console.log(`   📊 Confidence: ${(result2.confidence * 100).toFixed(1)}%`);
      console.log(`   📝 Analysis: ${result2.synthesis?.substring(0, 100) || 'No analysis'}...`);
    } catch (error) {
      console.log(`❌ Analysis test failed: ${error.message}`);
    }

    console.log('\n🎉 Hybrid system testing completed!');

  } catch (error) {
    console.error('\n💥 Hybrid system test failed:', error.message);
  }
}

testHybridFinal().catch(console.error);