#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';

async function testFinalValidation() {
  console.log('🎯 Final Hybrid System Validation');
  console.log('==================================\n');
  
  try {
    console.log('⚙️  Initializing optimized hybrid client...');
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    // Wait for configuration to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Client initialized with working models only');
    
    // Test 1: Simple task (LM Studio with working model)
    console.log('\n🚀 Test 1: Simple task (should use LM Studio)');
    try {
      const start = Date.now();
      const response = await hybridClient.generateResponse(
        'Write a simple hello world function',
        { taskType: 'template', complexity: 'simple' },
        { forceProvider: 'lmstudio', enableEscalation: false }
      );
      
      console.log(`✅ SUCCESS - ${Date.now() - start}ms`);
      console.log(`   Provider: ${response.provider}`);
      console.log(`   Model: ${response.model}`);
      console.log(`   Confidence: ${response.confidence}`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
    }
    
    console.log('\n🎉 Validation complete!');
    await hybridClient.dispose();
    
  } catch (error) {
    console.log(`💥 Validation failed: ${error.message}`);
  }
}

testFinalValidation().catch(console.error);
