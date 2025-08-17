#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';

async function testSimpleIntegration() {
  console.log('🚀 Testing Simple Integration');
  console.log('============================\n');

  try {
    // Test basic hybrid client
    console.log('⚙️  Initializing hybrid client...');
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: false
    });

    console.log('✅ Hybrid client initialized\n');

    // Test status
    console.log('🔍 Checking system status...');
    const status = await hybridClient.getStatus();
    console.log('📊 Status:', JSON.stringify(status, null, 2));

    // Test simple generation
    console.log('\n🧠 Testing code generation...');
    const testPrompts = [
      "Create a simple JavaScript function that adds two numbers",
      "Format this code properly: function test(){return x+y;}",
      "Generate a TypeScript interface for a user object"
    ];

    for (let i = 0; i < testPrompts.length; i++) {
      const prompt = testPrompts[i];
      console.log(`\n📝 Test ${i + 1}: ${prompt.substring(0, 50)}...`);
      
      try {
        const result = await hybridClient.generateResponse(prompt, {}, {
          taskType: i === 1 ? 'format' : 'template',
          complexity: 'simple'
        });
        
        console.log(`   ✅ Success: ${result.llmUsed || 'unknown'}`);
        console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   ⏱️  Latency: ${result.latency}ms`);
        console.log(`   📝 Code length: ${result.code?.length || 0} chars`);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('\n✅ Simple integration test completed!');

  } catch (error) {
    console.error('\n💥 Simple integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSimpleIntegration().catch(console.error);