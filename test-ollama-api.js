#!/usr/bin/env node

/**
 * Direct Ollama API Test
 * Tests the Ollama API with different models and configurations
 */

import axios from 'axios';

async function testOllamaAPI() {
  console.log('🧪 Testing Ollama API Directly\n');

  const endpoint = 'http://localhost:11434';
  
  // Test 1: Check server status
  console.log('1. Testing server status...');
  try {
    const response = await axios.get(`${endpoint}/api/tags`);
    console.log('   ✅ Server is responding');
    console.log(`   📊 Available models: ${response.data.models.length}`);
    response.data.models.forEach(model => {
      const sizeMB = (model.size / 1024 / 1024).toFixed(0);
      console.log(`      - ${model.name} (${sizeMB}MB)`);
    });
  } catch (error) {
    console.log('   ❌ Server check failed:', error.message);
    return;
  }

  // Test 2: Simple generation test with different models
  const models = ['gemma:latest'];
  
  for (const model of models) {
    console.log(`\n2. Testing generation with ${model}...`);
    
    try {
      console.log('   🔄 Sending simple request...');
      
      const startTime = Date.now();
      const response = await axios.post(`${endpoint}/api/generate`, {
        model: model,
        prompt: 'Say hello in exactly two words.',
        stream: false,
        options: {
          num_ctx: 512,      // Small context
          temperature: 0.1,  // Low temperature for consistency
          num_predict: 10    // Limit output tokens
        }
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const latency = Date.now() - startTime;
      
      if (response.data && response.data.response) {
        console.log(`   ✅ Generation successful (${latency}ms)`);
        console.log(`   📝 Response: "${response.data.response.trim()}"`);
        console.log(`   📊 Eval count: ${response.data.eval_count || 'unknown'}`);
        console.log(`   ⏱️  Eval duration: ${response.data.eval_duration ? (response.data.eval_duration / 1000000).toFixed(0) + 'ms' : 'unknown'}`);
        
        // If this works, try a coding task
        await testCodingTask(endpoint, model);
        
      } else {
        console.log('   ⚠️ Generation completed but no response content');
        console.log('   📄 Raw response:', JSON.stringify(response.data, null, 2));
      }
      
    } catch (error) {
      console.log(`   ❌ Generation failed: ${error.message}`);
      
      if (error.code === 'ECONNABORTED') {
        console.log('   💡 Suggestion: Model might be loading or system is overloaded');
      } else if (error.response) {
        console.log(`   📄 Server response: ${error.response.status} - ${error.response.data}`);
      }
    }
  }
}

async function testCodingTask(endpoint, model) {
  console.log(`\n3. Testing coding task with ${model}...`);
  
  const codingPrompt = `Fix this code: function add(a, b) { return a + b; }`;

  try {
    console.log('   🔄 Sending coding request...');
    
    const startTime = Date.now();
    const response = await axios.post(`${endpoint}/api/generate`, {
      model: model,
      prompt: codingPrompt,
      stream: false,
      options: {
        num_ctx: 512,      // Smaller context
        temperature: 0.1,  // Low temperature for consistency
        num_predict: 50    // Limit output tokens
      }
    }, {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const latency = Date.now() - startTime;
    
    if (response.data && response.data.response) {
      console.log(`   ✅ Coding task successful (${latency}ms)`);
      console.log(`   📝 Response length: ${response.data.response.length} characters`);
      console.log(`   📊 Eval count: ${response.data.eval_count || 'unknown'}`);
      console.log('   📄 Generated code preview:');
      console.log('   ' + '─'.repeat(50));
      console.log('   ' + response.data.response.split('\n').slice(0, 10).join('\n   '));
      if (response.data.response.split('\n').length > 10) {
        console.log('   [...truncated...]');
      }
      console.log('   ' + '─'.repeat(50));
      
      // Assess code quality
      const hasTypeScript = response.data.response.includes('interface') || response.data.response.includes(': ');
      const hasErrorHandling = response.data.response.includes('try') || response.data.response.includes('throw') || response.data.response.includes('Error');
      const hasCodeBlocks = response.data.response.includes('```');
      
      console.log('   🔍 Quality assessment:');
      console.log(`      TypeScript features: ${hasTypeScript ? '✅' : '❌'}`);
      console.log(`      Error handling: ${hasErrorHandling ? '✅' : '❌'}`);
      console.log(`      Code formatting: ${hasCodeBlocks ? '✅' : '❌'}`);
      
    } else {
      console.log('   ⚠️ Coding task completed but no response content');
    }
    
  } catch (error) {
    console.log(`   ❌ Coding task failed: ${error.message}`);
  }
}

// Run the test
testOllamaAPI().catch(error => {
  console.error('💥 Test suite failed:', error.message);
  process.exit(1);
});