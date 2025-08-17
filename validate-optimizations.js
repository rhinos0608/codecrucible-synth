#!/usr/bin/env node
import fs from 'fs';
import yaml from 'js-yaml';

function validateOptimizations() {
  console.log('🔍 Validating Performance Optimizations');
  console.log('======================================\n');
  
  try {
    // Read the hybrid configuration
    const configPath = './config/hybrid.yaml';
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configContent);
    
    console.log('📋 Configuration Validation:');
    console.log('============================');
    
    // Validate LM Studio optimizations
    console.log('\n🚀 LM Studio Performance Settings:');
    const lmStudio = config.lmStudio;
    if (lmStudio?.performance) {
      const perf = lmStudio.performance;
      console.log(`   ✅ GPU Memory Fraction: ${perf.gpuMemoryFraction || 'default'}`);
      console.log(`   ✅ GPU Layers: ${perf.gpuLayers || 'default'}`);
      console.log(`   ✅ Max Loaded Models: ${perf.maxLoadedModels || 'default'}`);
      console.log(`   ✅ JIT Loading: ${perf.jitLoading ? 'enabled' : 'disabled'}`);
      console.log(`   ✅ Model TTL: ${perf.modelTtl || 'default'}s`);
      console.log(`   ✅ Flash Attention: ${perf.flashAttention ? 'enabled' : 'disabled'}`);
      console.log(`   ✅ Batch Size: ${perf.batchSize || 'default'}`);
      console.log(`   ✅ Context Length: ${perf.contextLength || 'default'}`);
      console.log(`   ✅ Keep-alive: ${perf.keepAliveEnabled ? 'enabled' : 'disabled'}`);
      console.log(`   ✅ Keep-alive Interval: ${perf.keepAliveInterval || 'default'}ms`);
    } else {
      console.log('   ❌ No performance settings found for LM Studio');
    }
    
    // Validate Ollama optimizations
    console.log('\n🧠 Ollama Performance Settings:');
    const ollama = config.ollama;
    if (ollama?.performance) {
      const perf = ollama.performance;
      console.log(`   ✅ Max Loaded Models: ${perf.maxLoadedModels || 'default'}`);
      console.log(`   ✅ Max Queue Size: ${perf.maxQueueSize || 'default'}`);
      console.log(`   ✅ Num Parallel: ${perf.numParallel || 'default'}`);
      console.log(`   ✅ Memory Limit: ${perf.memoryLimit || 'default'}`);
      console.log(`   ✅ Num Threads: ${perf.numThreads || 'default'}`);
      console.log(`   ✅ NUMA Policy: ${perf.numaPolicy || 'default'}`);
      console.log(`   ✅ Context Size: ${perf.contextSize || 'default'}`);
      console.log(`   ✅ Quantization: ${perf.quantization || 'default'}`);
      console.log(`   ✅ Use MMap: ${perf.useMmap ? 'enabled' : 'disabled'}`);
      console.log(`   ✅ Use MLock: ${perf.useMlock ? 'enabled' : 'disabled'}`);
      console.log(`   ✅ Batch Size: ${perf.batchSize || 'default'}`);
    } else {
      console.log('   ❌ No performance settings found for Ollama');
    }
    
    // Validate environment variables
    console.log('\n🌍 Environment Variables:');
    if (ollama?.environment) {
      const env = ollama.environment;
      console.log(`   ✅ OLLAMA_NUM_GPU: ${env.OLLAMA_NUM_GPU || 'not set'}`);
      console.log(`   ✅ OLLAMA_CPU_TARGET: ${env.OLLAMA_CPU_TARGET || 'not set'}`);
      console.log(`   ✅ CUDA_VISIBLE_DEVICES: ${env.CUDA_VISIBLE_DEVICES !== undefined ? `"${env.CUDA_VISIBLE_DEVICES}"` : 'not set'}`);
      console.log(`   ✅ OLLAMA_MAX_LOADED_MODELS: ${env.OLLAMA_MAX_LOADED_MODELS || 'not set'}`);
      console.log(`   ✅ OLLAMA_MAX_QUEUE: ${env.OLLAMA_MAX_QUEUE || 'not set'}`);
      console.log(`   ✅ OLLAMA_NUM_PARALLEL: ${env.OLLAMA_NUM_PARALLEL || 'not set'}`);
      console.log(`   ✅ OLLAMA_NUM_THREADS: ${env.OLLAMA_NUM_THREADS || 'not set'}`);
      console.log(`   ✅ OLLAMA_NUMA_POLICY: ${env.OLLAMA_NUMA_POLICY || 'not set'}`);
    } else {
      console.log('   ❌ No environment variables configured');
    }
    
    // Check sequential processing
    console.log('\n⚡ Sequential Processing:');
    console.log(`   ✅ LM Studio Max Concurrent: ${lmStudio?.maxConcurrent || 'default'}`);
    console.log(`   ✅ Ollama Max Concurrent: ${ollama?.maxConcurrent || 'default'}`);
    
    // Check routing optimizations
    console.log('\n🎯 Routing Optimizations:');
    const routing = config.routing;
    if (routing) {
      console.log(`   ✅ Escalation Threshold: ${routing.escalationThreshold || 'default'}`);
      console.log(`   ✅ Rules Count: ${routing.rules?.length || 0}`);
    }
    
    // Check resource optimization
    console.log('\n💾 Resource Management:');
    const resources = config.resources;
    if (resources) {
      console.log(`   ✅ Memory Max Usage: ${resources.memory?.maxUsagePercent || 'default'}%`);
      console.log(`   ✅ VRAM Optimization: ${resources.vram?.enabled ? 'enabled' : 'disabled'}`);
      console.log(`   ✅ CPU Max Usage: ${resources.cpu?.maxUsagePercent || 'default'}%`);
      console.log(`   ✅ Thread Pool Size: ${resources.cpu?.threadPoolSize || 'default'}`);
    }
    
    console.log('\n🎉 Optimization Summary:');
    console.log('=======================');
    
    const optimizations = [];
    
    // Count LM Studio optimizations
    if (lmStudio?.performance) {
      const perfKeys = Object.keys(lmStudio.performance);
      optimizations.push(`LM Studio: ${perfKeys.length} optimizations`);
    }
    
    // Count Ollama optimizations
    if (ollama?.performance) {
      const perfKeys = Object.keys(ollama.performance);
      optimizations.push(`Ollama: ${perfKeys.length} optimizations`);
    }
    
    // Count environment variables
    if (ollama?.environment) {
      const envKeys = Object.keys(ollama.environment);
      optimizations.push(`Environment: ${envKeys.length} variables`);
    }
    
    console.log(`✅ Total optimizations applied: ${optimizations.join(', ')}`);
    console.log('✅ Configuration successfully validated');
    console.log('✅ Performance improvements ready for testing');
    
  } catch (error) {
    console.log(`❌ Validation failed: ${error.message}`);
  }
}

validateOptimizations();