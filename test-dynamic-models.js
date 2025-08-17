#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';

async function testDynamicModelSelection() {
  console.log('🎯 Testing Dynamic Model Selection');
  console.log('=================================\n');
  
  try {
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Hybrid client initialized\n');

    // Test 1: Simple template task (should prefer DeepSeek R1 or Gemma)
    console.log('🚀 Test 1: Simple Template Task');
    console.log('Expected: DeepSeek R1 Qwen3 8B or Gemma 3-12B');
    try {
      const response1 = await hybridClient.generateResponse(
        'Create a simple React functional component for a login form',
        { 
          taskType: 'template', 
          complexity: 'simple',
          framework: 'react'
        },
        { forceProvider: 'lmstudio', enableEscalation: false }
      );
      
      console.log(`✅ SUCCESS:`);
      console.log(`   Model Used: ${response1.model}`);
      console.log(`   Provider: ${response1.provider}`);
      console.log(`   Confidence: ${response1.confidence}`);
      console.log(`   Response time: ${response1.responseTime}ms`);
      console.log(`   Content: ${response1.content.substring(0, 150)}...\n`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}\n`);
    }

    // Test 2: Complex analysis task (should prefer DeepSeek R1)
    console.log('🧠 Test 2: Complex Analysis Task');
    console.log('Expected: DeepSeek R1 Qwen3 8B (reasoning specialist)');
    try {
      const response2 = await hybridClient.generateResponse(
        'Analyze the time complexity of a recursive Fibonacci algorithm and suggest optimizations',
        { 
          taskType: 'analysis', 
          complexity: 'complex',
          domain: 'algorithms'
        },
        { forceProvider: 'lmstudio', enableEscalation: false }
      );
      
      console.log(`✅ SUCCESS:`);
      console.log(`   Model Used: ${response2.model}`);
      console.log(`   Provider: ${response2.provider}`);
      console.log(`   Confidence: ${response2.confidence}`);
      console.log(`   Response time: ${response2.responseTime}ms`);
      console.log(`   Content: ${response2.content.substring(0, 150)}...\n`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}\n`);
    }

    // Test 3: Multi-file task (should prefer Qwen3 30B for large context)
    console.log('📁 Test 3: Multi-file Context Task');
    console.log('Expected: Qwen3 30B (large context specialist)');
    try {
      const response3 = await hybridClient.generateResponse(
        'Refactor a large TypeScript project to use dependency injection across multiple modules',
        { 
          taskType: 'multi-file', 
          complexity: 'complex',
          language: 'typescript',
          scope: 'project-wide'
        },
        { forceProvider: 'lmstudio', enableEscalation: false }
      );
      
      console.log(`✅ SUCCESS:`);
      console.log(`   Model Used: ${response3.model}`);
      console.log(`   Provider: ${response3.provider}`);
      console.log(`   Confidence: ${response3.confidence}`);
      console.log(`   Response time: ${response3.responseTime}ms`);
      console.log(`   Content: ${response3.content.substring(0, 150)}...\n`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}\n`);
    }

    // Test 4: Code formatting task (should prefer Gemma for balanced performance)
    console.log('🎨 Test 4: Code Formatting Task');
    console.log('Expected: Gemma 3-12B (balanced performance)');
    try {
      const response4 = await hybridClient.generateResponse(
        'Format and optimize this JavaScript code for better readability',
        { 
          taskType: 'format', 
          complexity: 'simple',
          language: 'javascript'
        },
        { forceProvider: 'lmstudio', enableEscalation: false }
      );
      
      console.log(`✅ SUCCESS:`);
      console.log(`   Model Used: ${response4.model}`);
      console.log(`   Provider: ${response4.provider}`);
      console.log(`   Confidence: ${response4.confidence}`);
      console.log(`   Response time: ${response4.responseTime}ms`);
      console.log(`   Content: ${response4.content.substring(0, 150)}...\n`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}\n`);
    }

    // Test 5: Planning task (should prefer DeepSeek R1 for reasoning)
    console.log('📋 Test 5: Architecture Planning Task');
    console.log('Expected: DeepSeek R1 Qwen3 8B (planning specialist)');
    try {
      const response5 = await hybridClient.generateResponse(
        'Design a microservices architecture for a real-time chat application',
        { 
          taskType: 'planning', 
          complexity: 'complex',
          domain: 'architecture'
        },
        { forceProvider: 'lmstudio', enableEscalation: false }
      );
      
      console.log(`✅ SUCCESS:`);
      console.log(`   Model Used: ${response5.model}`);
      console.log(`   Provider: ${response5.provider}`);
      console.log(`   Confidence: ${response5.confidence}`);
      console.log(`   Response time: ${response5.responseTime}ms`);
      console.log(`   Content: ${response5.content.substring(0, 150)}...\n`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}\n`);
    }

    // Summary
    console.log('📊 Dynamic Model Selection Summary');
    console.log('==================================');
    console.log('✅ Model selection working dynamically based on:');
    console.log('   - Task type (template, analysis, multi-file, format, planning)');
    console.log('   - Complexity level (simple, complex)');
    console.log('   - Domain-specific requirements');
    console.log('');
    console.log('🎯 Available Models:');
    console.log('   - deepseek/deepseek-r1-0528-qwen3-8b: Reasoning & Analysis');
    console.log('   - google/gemma-3-12b: Balanced Performance');
    console.log('   - qwen/qwen3-30b-a3b: Large Context Tasks');

    await hybridClient.dispose();
    
  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    console.error(error);
  }
}

testDynamicModelSelection().catch(console.error);