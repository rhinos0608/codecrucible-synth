#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';

async function testHybridFixed() {
  console.log('🔧 Testing Fixed Hybrid System');
  console.log('==============================\n');
  
  try {
    console.log('⚙️  Initializing hybrid client with JSON parsing fix...');
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    // Wait for configuration to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Hybrid client initialized');
    
    // Test simple task (should route to LM Studio)
    console.log('\n📝 Testing simple task routing...');
    try {
      const simpleResponse = await hybridClient.generateResponse(
        'Create a simple Hello World function in JavaScript',
        { taskType: 'template', complexity: 'simple' },
        { enableEscalation: false }
      );
      
      console.log('✅ Simple task completed:');
      console.log(`   Provider: ${simpleResponse.provider}`);
      console.log(`   Confidence: ${simpleResponse.confidence}`);
      console.log(`   Response time: ${simpleResponse.responseTime}ms`);
      console.log(`   Content preview: ${simpleResponse.content.substring(0, 100)}...`);
      
    } catch (error) {
      console.log(`❌ Simple task failed: ${error.message}`);
    }

    // Test system status
    console.log('\n📊 Testing system status...');
    try {
      const status = hybridClient.getStatus();
      console.log('✅ System status retrieved:');
      console.log(`   Configuration loaded: ${status.configuration ? 'Yes' : 'No'}`);
      console.log(`   LM Studio status: ${JSON.stringify(status.lmStudio)}`);
      console.log(`   Cache size: ${status.cache.size}`);
      
    } catch (error) {
      console.log(`❌ Status check failed: ${error.message}`);
    }

    // Test provider availability
    console.log('\n🔍 Testing provider availability...');
    try {
      const providerTests = await hybridClient.testProviders();
      console.log('✅ Provider tests completed:');
      console.log(`   LM Studio: ${providerTests.lmStudio ? '✅' : '❌'}`);
      console.log(`   Ollama: ${providerTests.ollama ? '✅' : '❌'}`);
      
    } catch (error) {
      console.log(`❌ Provider tests failed: ${error.message}`);
    }

    console.log('\n🎉 Hybrid system test completed!');
    
    // Cleanup
    await hybridClient.dispose();
    
  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    console.error(error);
  }
}

testHybridFixed().catch(console.error);