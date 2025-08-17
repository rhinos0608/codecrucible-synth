#!/usr/bin/env node

const { default: axios } = await import('axios');
const { exec } = await import('child_process');
const { promisify } = await import('util');

/**
 * VRAM Optimization Script
 * Intelligently manages model loading across LM Studio and Ollama
 * to maximize available VRAM and prevent timeout issues
 */

const VRAM_CONFIG = {
  totalVRAM: 12282, // MB from nvidia-smi
  reserveForSystem: 1024, // Reserve 1GB for system
  maxConcurrentModels: 2, // Maximum models to keep loaded
  targetUtilization: 0.85 // Target 85% VRAM utilization
};

const LM_STUDIO_ENDPOINT = 'http://localhost:1234';
const OLLAMA_ENDPOINT = 'http://localhost:11434';

/**
 * Get current VRAM usage from nvidia-smi
 */
async function getCurrentVRAMUsage() {
  try {
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits');
    const [used, total] = stdout.trim().split(',').map(s => parseInt(s.trim()));
    
    return {
      used,
      total,
      available: total - used,
      utilizationPercent: (used / total) * 100
    };
  } catch (error) {
    console.error('Failed to get VRAM usage:', error.message);
    return { used: 11705, total: 12282, available: 577, utilizationPercent: 95.3 };
  }
}

/**
 * Get currently loaded models from LM Studio
 */
async function getLMStudioModels() {
  try {
    const response = await axios.get(`${LM_STUDIO_ENDPOINT}/v1/models`, { timeout: 5000 });
    return response.data?.data || [];
  } catch (error) {
    console.warn('Failed to get LM Studio models:', error.message);
    return [];
  }
}

/**
 * Get available Ollama models
 */
async function getOllamaModels() {
  try {
    const response = await axios.get(`${OLLAMA_ENDPOINT}/api/tags`, { timeout: 5000 });
    return response.data?.models || [];
  } catch (error) {
    console.warn('Failed to get Ollama models:', error.message);
    return [];
  }
}

/**
 * Estimate model VRAM usage based on size
 */
function estimateModelVRAM(modelId, size) {
  // Rough estimates based on model types
  const sizeEstimates = {
    '8b': 8000,   // 8B models ~8GB
    '12b': 12000, // 12B models ~12GB 
    '20b': 20000, // 20B models ~20GB
    '30b': 30000, // 30B models ~30GB
    '34b': 34000  // 34B models ~34GB
  };
  
  for (const [pattern, vram] of Object.entries(sizeEstimates)) {
    if (modelId.includes(pattern) || (size && size.includes(pattern))) {
      return vram;
    }
  }
  
  // Parse size from string like "19 GB"
  if (size) {
    const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*GB/i);
    if (sizeMatch) {
      return parseFloat(sizeMatch[1]) * 1024; // Convert GB to MB
    }
  }
  
  // Default estimate for unknown models
  return 8000;
}

/**
 * Optimize model loading strategy
 */
async function optimizeModelLoading() {
  console.log('🔧 VRAM Optimization Tool');
  console.log('=========================\n');
  
  // Get current state
  const vramUsage = await getCurrentVRAMUsage();
  const lmStudioModels = await getLMStudioModels();
  const ollamaModels = await getOllamaModels();
  
  console.log('📊 Current VRAM Status:');
  console.log(`   Total: ${vramUsage.total}MB`);
  console.log(`   Used: ${vramUsage.used}MB (${vramUsage.utilizationPercent.toFixed(1)}%)`);
  console.log(`   Available: ${vramUsage.available}MB`);
  console.log('');
  
  console.log('🤖 Currently Loaded Models:');
  console.log(`   LM Studio: ${lmStudioModels.length} models`);
  lmStudioModels.forEach(model => {
    const estimatedVRAM = estimateModelVRAM(model.id);
    console.log(`      📱 ${model.id} (~${estimatedVRAM}MB)`);
  });
  
  console.log(`   Ollama: ${ollamaModels.length} available models`);
  ollamaModels.forEach(model => {
    const estimatedVRAM = estimateModelVRAM(model.name, model.size);
    console.log(`      💾 ${model.name} (${model.size}) (~${estimatedVRAM}MB)`);
  });
  console.log('');
  
  // Check if optimization is needed
  const availableForModels = vramUsage.total - VRAM_CONFIG.reserveForSystem;
  const isOverloaded = vramUsage.utilizationPercent > (VRAM_CONFIG.targetUtilization * 100);
  
  console.log('🎯 Optimization Analysis:');
  console.log(`   Target utilization: ${(VRAM_CONFIG.targetUtilization * 100).toFixed(1)}%`);
  console.log(`   Current utilization: ${vramUsage.utilizationPercent.toFixed(1)}%`);
  console.log(`   Available for models: ${availableForModels}MB`);
  console.log(`   Optimization needed: ${isOverloaded ? '✅ YES' : '❌ NO'}`);
  console.log('');
  
  if (isOverloaded) {
    console.log('🔧 Recommended Optimizations:');
    
    // Calculate how much VRAM to free up
    const targetUsed = vramUsage.total * VRAM_CONFIG.targetUtilization;
    const excessVRAM = vramUsage.used - targetUsed;
    
    console.log(`   Need to free: ${Math.round(excessVRAM)}MB`);
    
    // Suggest which models to unload from LM Studio
    if (lmStudioModels.length > VRAM_CONFIG.maxConcurrentModels) {
      const modelsToUnload = lmStudioModels.length - VRAM_CONFIG.maxConcurrentModels;
      console.log(`   🔄 Unload ${modelsToUnload} models from LM Studio`);
      
      // Prioritize unloading larger models
      const sortedModels = lmStudioModels
        .map(model => ({
          ...model,
          estimatedVRAM: estimateModelVRAM(model.id)
        }))
        .sort((a, b) => b.estimatedVRAM - a.estimatedVRAM);
      
      console.log('   Suggested unload order:');
      sortedModels.slice(0, modelsToUnload).forEach((model, i) => {
        console.log(`      ${i + 1}. ${model.id} (~${model.estimatedVRAM}MB)`);
      });
    }
    
    // Suggest using smaller models
    const smallerModels = ollamaModels.filter(model => {
      const vram = estimateModelVRAM(model.name, model.size);
      return vram < 8000; // Models under 8GB
    });
    
    if (smallerModels.length > 0) {
      console.log('   💡 Consider using smaller Ollama models:');
      smallerModels.forEach(model => {
        const vram = estimateModelVRAM(model.name, model.size);
        console.log(`      🎯 ${model.name} (${model.size}) - only ${vram}MB`);
      });
    }
    
    // Provide specific commands
    console.log('\n🛠️  Immediate Actions:');
    console.log('   1. Stop LM Studio or unload models manually');
    console.log('   2. Use single model strategy: Keep only 1 model loaded at a time');
    console.log('   3. For testing, use: ollama run gemma:latest (5GB)');
    console.log('   4. Re-run this optimization after changes');
    
    return false; // Optimization needed
  } else {
    console.log('✅ VRAM allocation is optimal!');
    console.log(`   Current usage (${vramUsage.utilizationPercent.toFixed(1)}%) is within target range`);
    console.log('   🚀 Models should load without timeout issues');
    
    return true; // No optimization needed
  }
}

/**
 * Test model loading with current VRAM allocation
 */
async function testModelLoading() {
  console.log('\n🧪 Testing Model Loading Performance');
  console.log('=====================================\n');
  
  const startTime = Date.now();
  
  // Test LM Studio
  try {
    console.log('🔄 Testing LM Studio model access...');
    const response = await axios.post(`${LM_STUDIO_ENDPOINT}/v1/chat/completions`, {
      model: 'deepseek/deepseek-r1-0528-qwen3-8b',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0
    }, { timeout: 10000 });
    
    const lmStudioTime = Date.now() - startTime;
    console.log(`   ✅ LM Studio response: ${lmStudioTime}ms`);
    
    if (lmStudioTime < 5000) {
      console.log('   🚀 Excellent performance! Model already warm.');
    } else if (lmStudioTime < 15000) {
      console.log('   ⚡ Good performance. Some loading time detected.');
    } else {
      console.log('   ⚠️  Slow performance. VRAM pressure likely causing delays.');
    }
    
  } catch (error) {
    console.log(`   ❌ LM Studio failed: ${error.message}`);
  }
  
  // Test Ollama with smaller model
  try {
    console.log('\n🔄 Testing Ollama model loading...');
    const ollamaStart = Date.now();
    
    const response = await axios.post(`${OLLAMA_ENDPOINT}/api/generate`, {
      model: 'gemma:latest',
      prompt: 'ping',
      stream: false,
      options: { num_predict: 1 }
    }, { timeout: 60000 });
    
    const ollamaTime = Date.now() - ollamaStart;
    console.log(`   ✅ Ollama response: ${ollamaTime}ms`);
    
    if (ollamaTime < 10000) {
      console.log('   🚀 Excellent! Model loaded quickly.');
    } else if (ollamaTime < 30000) {
      console.log('   ⚡ Good loading time.');
    } else {
      console.log('   ⚠️  Slow loading. Consider model optimization.');
    }
    
  } catch (error) {
    console.log(`   ❌ Ollama failed: ${error.message}`);
  }
}

/**
 * Main optimization workflow
 */
async function main() {
  try {
    const isOptimal = await optimizeModelLoading();
    
    if (isOptimal) {
      await testModelLoading();
      console.log('\n🎉 VRAM optimization complete! System ready for optimal timeout performance.');
    } else {
      console.log('\n⚠️  Manual intervention required. Please follow recommendations above.');
      console.log('💡 After making changes, run this script again to verify optimization.');
    }
    
  } catch (error) {
    console.error('🔥 Optimization failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { optimizeModelLoading, testModelLoading, getCurrentVRAMUsage };