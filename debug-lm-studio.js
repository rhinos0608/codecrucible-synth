#!/usr/bin/env node
import { LMStudioClient } from './dist/core/lm-studio-client.js';

async function debugLMStudio() {
  console.log('🔍 Debugging LM Studio Connection');
  console.log('=================================\n');

  try {
    // Create client with debug config
    const client = new LMStudioClient({
      endpoint: 'http://localhost:1234',
      enabled: true,
      models: ['qwen/qwen3-30b-a3b'],
      maxConcurrent: 1,
      streamingEnabled: false,
      taskTypes: ['debug']
    });

    // Test health check
    console.log('1. Testing health check...');
    const healthy = await client.checkHealth();
    console.log(`   Health status: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}\n`);

    // Test getting models
    console.log('2. Getting available models...');
    const models = await client.getAvailableModels();
    console.log(`   Available models: ${models.length}`);
    models.forEach(model => console.log(`     - ${model}`));
    console.log();

    // Test capabilities
    console.log('3. Getting capabilities...');
    const capabilities = await client.getCapabilities();
    console.log('   Capabilities:', JSON.stringify(capabilities, null, 2));
    console.log();

    // Test simple generation
    console.log('4. Testing simple code generation...');
    try {
      const result = await client.generateCode('Create a simple hello world function in JavaScript');
      console.log(`   ✅ Success!`);
      console.log(`   Model: ${result.model}`);
      console.log(`   Latency: ${result.latency}ms`);
      console.log(`   Confidence: ${result.confidence}`);
      console.log(`   Tokens used: ${result.tokens_used}`);
      console.log(`   Content length: ${result.content?.length || 0} chars`);
      console.log(`   Code length: ${result.code?.length || 0} chars`);
      if (result.code) {
        console.log(`   Generated code:\n${result.code.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Generation failed: ${error.message}`);
      console.log(`   Error details:`, error);
    }

  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

debugLMStudio().catch(console.error);