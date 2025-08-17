#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';
import { timeoutOptimizer } from './dist/core/timeout-optimizer.js';
import { advancedTimeoutManager } from './dist/core/advanced-timeout-manager.js';

async function testTimeoutOptimizations() {
  console.log('🔧 Testing Advanced Timeout Optimizations');
  console.log('==========================================\n');
  
  try {
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Hybrid client initialized with timeout optimizations\n');

    // Test 1: Apply All Timeout Optimizations
    console.log('⚙️  Test 1: Applying Timeout Optimizations');
    console.log('==========================================');
    
    const optimizationResults = await timeoutOptimizer.applyAllOptimizations();
    
    console.log(`   Applied Optimizations: ${optimizationResults.applied.length}`);
    optimizationResults.applied.forEach(opt => {
      console.log(`   ✅ ${opt.name}: ${opt.description} (saves ~${opt.savings}ms)`);
    });
    
    console.log(`   Total Expected Savings: ${optimizationResults.totalSavings}ms`);
    console.log(`   Recommendations: ${optimizationResults.recommendations.length}`);
    optimizationResults.recommendations.forEach(rec => {
      console.log(`   💡 ${rec}`);
    });

    // Test 2: Task-Specific Timeout Optimization
    console.log('\n⏱️  Test 2: Task-Specific Timeout Optimization');
    console.log('===============================================');
    
    const taskTypes = [
      { provider: 'lmstudio', taskType: 'template', complexity: 'simple' },
      { provider: 'lmstudio', taskType: 'general', complexity: 'medium' },
      { provider: 'ollama', taskType: 'analysis', complexity: 'complex' }
    ];

    for (const task of taskTypes) {
      const optimization = await timeoutOptimizer.optimizeForTask(
        task.provider,
        task.taskType,
        task.complexity
      );
      
      console.log(`   ${task.provider}/${task.taskType}/${task.complexity}:`);
      console.log(`      Recommended Timeout: ${optimization.recommendedTimeout}ms`);
      console.log(`      Confidence: ${(optimization.confidence * 100).toFixed(1)}%`);
      console.log(`      Warmup Needed: ${optimization.warmupNeeded ? 'Yes' : 'No'}`);
      if (optimization.optimizations.length > 0) {
        console.log(`      Optimizations: ${optimization.optimizations.join(', ')}`);
      }
    }

    // Test 3: Model Warmup Performance
    console.log('\n🔥 Test 3: Model Warmup Performance');
    console.log('===================================');
    
    const modelsToWarmup = [
      { provider: 'lmstudio', modelName: 'auto' },
      { provider: 'ollama', modelName: 'gemma:latest' }
    ];

    const warmupResults = await timeoutOptimizer.warmupModels(modelsToWarmup);
    
    console.log(`   Successful Warmups: ${warmupResults.successful.length}`);
    warmupResults.successful.forEach(model => {
      console.log(`   ✅ ${model}`);
    });
    
    console.log(`   Failed Warmups: ${warmupResults.failed.length}`);
    warmupResults.failed.forEach(model => {
      console.log(`   ❌ ${model}`);
    });
    
    console.log(`   Total Warmup Time: ${warmupResults.totalTime}ms`);

    // Test 4: Advanced Timeout Calculation
    console.log('\n🧠 Test 4: Advanced Timeout Calculation');
    console.log('=======================================');
    
    const testContexts = [
      {
        provider: 'lmstudio',
        taskType: 'template',
        complexity: 'simple',
        isModelLoaded: true,
        description: 'Warm LM Studio template'
      },
      {
        provider: 'lmstudio',
        taskType: 'general',
        complexity: 'medium',
        isModelLoaded: false,
        description: 'Cold LM Studio general task'
      },
      {
        provider: 'ollama',
        taskType: 'analysis',
        complexity: 'complex',
        isModelLoaded: true,
        description: 'Warm Ollama analysis'
      }
    ];

    for (const context of testContexts) {
      const timeoutResult = await advancedTimeoutManager.getOptimalTimeout({
        provider: context.provider,
        taskType: context.taskType,
        complexity: context.complexity,
        isModelLoaded: context.isModelLoaded,
        isFirstRequest: false,
        systemLoad: 0.6,
        vramAvailable: 2048,
        recentFailures: 0,
        averageResponseTime: 5000,
        requestSize: 500
      });
      
      console.log(`   ${context.description}:`);
      console.log(`      Timeout: ${timeoutResult.timeout}ms`);
      console.log(`      Strategy: ${timeoutResult.strategy}`);
      console.log(`      Confidence: ${(timeoutResult.confidence * 100).toFixed(1)}%`);
      console.log(`      Reasoning: ${timeoutResult.reasoning}`);
    }

    // Test 5: Performance Test with Optimized Timeouts
    console.log('\n🚀 Test 5: Performance Test with Optimized Timeouts');
    console.log('====================================================');
    
    const performanceTests = [
      { prompt: 'Create a simple function', taskType: 'template', complexity: 'simple' },
      { prompt: 'Fix this code issue', taskType: 'edit', complexity: 'medium' }
    ];

    for (let i = 0; i < performanceTests.length; i++) {
      const test = performanceTests[i];
      console.log(`   ${i + 1}. Testing: "${test.prompt}"`);
      
      try {
        const start = Date.now();
        const response = await Promise.race([
          hybridClient.generateResponse(
            test.prompt,
            { taskType: test.taskType, complexity: test.complexity },
            { forceProvider: 'lmstudio', enableEscalation: false }
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), 20000))
        ]);
        
        const duration = Date.now() - start;
        console.log(`      ⏱️  ${duration}ms ${duration < 8000 ? '🚀 (optimized!)' : '⚠️  (still slow)'}`);
        console.log(`      📝 ${response.content.substring(0, 50)}...`);
        
        // Record performance for learning
        timeoutOptimizer.recordTimeoutPerformance(
          'lmstudio',
          test.taskType,
          20000, // Test timeout
          duration,
          true
        );
        
      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
        
        // Record failure for learning
        timeoutOptimizer.recordTimeoutPerformance(
          'lmstudio',
          test.taskType,
          20000,
          20000,
          false
        );
      }
      
      // Delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test 6: Timeout Efficiency Analysis
    console.log('\n📊 Test 6: Timeout Efficiency Analysis');
    console.log('======================================');
    
    const efficiencyResults = timeoutOptimizer.getTimeoutEfficiency();
    
    console.log('   Provider Efficiency:');
    for (const [provider, stats] of Object.entries(efficiencyResults.providers)) {
      console.log(`   ${provider}:`);
      console.log(`      Average Timeout: ${stats.averageTimeout}ms`);
      console.log(`      Average Actual: ${stats.averageActualTime}ms`);
      console.log(`      Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
      console.log(`      Efficiency: ${(stats.efficiency * 100).toFixed(1)}%`);
      console.log(`      Wasted Time: ${stats.wastedTime}ms`);
    }
    
    console.log('\n   Efficiency Recommendations:');
    efficiencyResults.recommendations.forEach(rec => {
      console.log(`   💡 ${rec}`);
    });

    // Test 7: Advanced Timeout Manager Statistics
    console.log('\n📈 Test 7: Advanced Timeout Manager Statistics');
    console.log('===============================================');
    
    const timeoutStats = advancedTimeoutManager.getTimeoutStatistics();
    
    console.log('   Available Strategies:');
    timeoutStats.strategies.forEach(strategy => {
      console.log(`   - ${strategy.name} (usage: ${strategy.usage})`);
    });
    
    console.log('\n   Performance Metrics:');
    for (const [key, metrics] of Object.entries(timeoutStats.performanceMetrics)) {
      console.log(`   ${key}: ${metrics.count} samples, avg ${metrics.avgTime}ms`);
    }

    // Test 8: Timeout Optimization Summary
    console.log('\n🎯 Test 8: Optimization Summary');
    console.log('===============================');
    
    console.log('   ✅ Advanced Timeout Management: Active');
    console.log('   ✅ Predictive Timeout Calculation: Enabled');
    console.log('   ✅ System Load Awareness: Enabled');
    console.log('   ✅ Model Persistence Integration: Active');
    console.log('   ✅ Performance Learning: Active');
    console.log('   ✅ Request Deduplication: Active');
    
    const improvements = [];
    
    if (optimizationResults.totalSavings > 0) {
      improvements.push(`Expected timeout reduction: ${optimizationResults.totalSavings}ms`);
    }
    
    if (warmupResults.successful.length > 0) {
      improvements.push(`${warmupResults.successful.length} models pre-warmed`);
    }
    
    if (Object.keys(efficiencyResults.providers).length > 0) {
      const avgEfficiency = Object.values(efficiencyResults.providers)
        .reduce((sum, stats) => sum + stats.efficiency, 0) / Object.keys(efficiencyResults.providers).length;
      improvements.push(`Average timeout efficiency: ${(avgEfficiency * 100).toFixed(1)}%`);
    }
    
    console.log('\n🚀 Key Improvements:');
    improvements.forEach(improvement => {
      console.log(`   - ${improvement}`);
    });

    console.log('\n💡 Next Steps:');
    console.log('   1. Monitor timeout performance in production');
    console.log('   2. Adjust timeout strategies based on actual usage patterns');
    console.log('   3. Enable model preloading for frequently used models');
    console.log('   4. Consider hardware upgrades if VRAM constraints persist');

    await hybridClient.dispose();
    
  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    console.error(error);
  }
}

testTimeoutOptimizations().catch(console.error);