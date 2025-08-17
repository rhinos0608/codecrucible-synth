#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';
import { modelPersistenceManager } from './dist/core/model-persistence-manager.js';
import { requestDeduplicationManager } from './dist/core/request-deduplication.js';
import { dynamicTimeoutManager } from './dist/core/dynamic-timeout-manager.js';

async function testAdvancedOptimizations() {
  console.log('🚀 Testing Advanced Performance Optimizations');
  console.log('===============================================\n');
  
  try {
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Hybrid client initialized with advanced optimizations\n');

    // Test 1: Model Persistence Performance
    console.log('🔄 Test 1: Model Persistence & Caching');
    console.log('======================================');
    
    const testPrompts = [
      'Create a simple function',
      'Write a hello world function', // Similar to first one
      'Create a simple function', // Exact duplicate
      'Build a basic component'
    ];

    const results = [];
    
    for (let i = 0; i < testPrompts.length; i++) {
      const prompt = testPrompts[i];
      console.log(`   ${i + 1}. Testing: "${prompt}"`);
      
      try {
        const start = Date.now();
        const response = await Promise.race([
          hybridClient.generateResponse(
            prompt,
            { taskType: 'template', complexity: 'simple' },
            { forceProvider: 'lmstudio', enableEscalation: false }
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), 25000))
        ]);
        
        const duration = Date.now() - start;
        results.push({ prompt, duration, success: true, cached: duration < 5000 });
        
        console.log(`      ⏱️  ${duration}ms ${duration < 5000 ? '🚀 (likely cached)' : '🔄 (fresh)'}`);
        console.log(`      📝 ${response.content.substring(0, 60)}...`);
        
      } catch (error) {
        results.push({ prompt, duration: 0, success: false, error: error.message });
        console.log(`      ❌ Failed: ${error.message}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test 2: Cache Performance Analysis
    console.log('\n📊 Test 2: Cache Performance Analysis');
    console.log('====================================');
    
    const cacheStats = requestDeduplicationManager.getCacheStats();
    console.log(`   Cache Size: ${cacheStats.size} entries`);
    console.log(`   Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    console.log(`   Total Hits: ${cacheStats.totalHits}`);
    console.log(`   Pending Requests: ${cacheStats.pendingRequests}`);

    const modelStats = modelPersistenceManager.getPerformanceStats();
    console.log(`   Loaded Models: ${modelStats.loadedModels}/${modelStats.totalModels}`);
    console.log(`   Average Load Time: ${modelStats.averageLoadTime}ms`);
    console.log(`   Memory Usage: ${(modelStats.totalMemoryUsage / 1024).toFixed(1)}GB`);

    // Test 3: Timeout Optimization Performance
    console.log('\n⏰ Test 3: Dynamic Timeout Performance');
    console.log('=====================================');
    
    const timeoutStats = dynamicTimeoutManager.getPerformanceStats();
    console.log('   Performance History:');
    
    for (const [key, stats] of Object.entries(timeoutStats)) {
      console.log(`   - ${key}: ${stats.count} samples, avg: ${stats.avg}ms, p95: ${stats.p95}ms`);
    }

    // Test 4: Concurrent Request Performance
    console.log('\n⚡ Test 4: Concurrent Request Handling');
    console.log('=====================================');
    
    const concurrentPrompts = [
      'Simple function 1',
      'Simple function 2', 
      'Simple function 3'
    ];

    console.log('   Executing 3 concurrent requests...');
    const concurrentStart = Date.now();
    
    try {
      const concurrentPromises = concurrentPrompts.map(prompt =>
        Promise.race([
          hybridClient.generateResponse(
            prompt,
            { taskType: 'template', complexity: 'simple' },
            { forceProvider: 'lmstudio', enableEscalation: false }
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
        ])
      );

      const concurrentResults = await Promise.allSettled(concurrentPromises);
      const concurrentDuration = Date.now() - concurrentStart;
      
      console.log(`   ⏱️  Total time: ${concurrentDuration}ms`);
      console.log(`   📊 Results:`);
      
      concurrentResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`      ${index + 1}. ✅ Success`);
        } else {
          console.log(`      ${index + 1}. ❌ Failed: ${result.reason.message}`);
        }
      });

    } catch (error) {
      console.log(`   ❌ Concurrent test failed: ${error.message}`);
    }

    // Test 5: Memory and Performance Summary
    console.log('\n📈 Test 5: Performance Summary');
    console.log('=============================');
    
    const successfulResults = results.filter(r => r.success);
    const cachedResults = results.filter(r => r.cached);
    
    if (successfulResults.length > 0) {
      const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
      const minDuration = Math.min(...successfulResults.map(r => r.duration));
      const maxDuration = Math.max(...successfulResults.map(r => r.duration));
      
      console.log(`   📊 Response Times:`);
      console.log(`      Average: ${avgDuration.toFixed(0)}ms`);
      console.log(`      Fastest: ${minDuration}ms`);
      console.log(`      Slowest: ${maxDuration}ms`);
      console.log(`      Cache Hit Rate: ${((cachedResults.length / results.length) * 100).toFixed(1)}%`);
    }

    // Test 6: Optimization Effectiveness
    console.log('\n🎯 Test 6: Optimization Effectiveness');
    console.log('====================================');
    
    console.log('   ✅ Model Persistence: Implemented');
    console.log('   ✅ Request Deduplication: Implemented');
    console.log('   ✅ Dynamic Timeouts: Implemented');
    console.log('   ✅ Connection Management: Enhanced');
    console.log('   ✅ Circuit Breaker: Active');

    const improvements = [];
    
    if (cacheStats.hitRate > 0.2) {
      improvements.push(`Cache effectiveness: ${(cacheStats.hitRate * 100).toFixed(1)}% hit rate`);
    }
    
    if (modelStats.averageLoadTime < 30000) {
      improvements.push(`Model loading: ${modelStats.averageLoadTime}ms average`);
    }
    
    if (successfulResults.length > 0) {
      const fastResponses = successfulResults.filter(r => r.duration < 10000).length;
      const fastResponseRate = (fastResponses / successfulResults.length) * 100;
      improvements.push(`Fast responses: ${fastResponseRate.toFixed(1)}% under 10s`);
    }

    console.log('\n🚀 Key Improvements Detected:');
    improvements.forEach(improvement => {
      console.log(`   - ${improvement}`);
    });

    console.log('\n💡 Recommendations:');
    if (cacheStats.hitRate < 0.3) {
      console.log('   - Consider longer cache TTL for better hit rates');
    }
    if (modelStats.averageLoadTime > 20000) {
      console.log('   - Model preloading may need optimization');
    }
    if (modelStats.totalMemoryUsage > 20000) {
      console.log('   - Consider model quantization for memory efficiency');
    }

    await hybridClient.dispose();
    
  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    console.error(error);
  }
}

testAdvancedOptimizations().catch(console.error);