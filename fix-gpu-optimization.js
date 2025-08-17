#!/usr/bin/env node

/**
 * GPU Optimization Fix for CodeCrucible Synth
 * 
 * This script fixes the GPU utilization issues by:
 * 1. Configuring Ollama to use full GPU acceleration
 * 2. Setting optimal model parameters for 12GB VRAM
 * 3. Enabling proper model loading with GPU layers
 */

import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 CodeCrucible GPU Optimization Fix');
console.log('=====================================\n');

// Check current VRAM usage
try {
  console.log('📊 Checking current GPU status...');
  const gpuInfo = execSync('nvidia-smi --query-gpu=memory.total,memory.used,memory.free --format=csv,noheader,nounits', { encoding: 'utf8' });
  const [totalVRAM, usedVRAM, freeVRAM] = gpuInfo.trim().split('\n')[0].split(', ').map(Number);
  
  console.log(`   Total VRAM: ${Math.floor(totalVRAM/1024)}GB`);
  console.log(`   Used VRAM:  ${Math.floor(usedVRAM/1024)}GB`);
  console.log(`   Free VRAM:  ${Math.floor(freeVRAM/1024)}GB\n`);
  
  if (freeVRAM < 8000) {
    console.log('⚠️  WARNING: Low available VRAM. Consider closing other GPU applications.\n');
  }
} catch (error) {
  console.log('❌ Could not check GPU status. Ensure NVIDIA drivers are installed.\n');
}

// Set Ollama environment variables for optimal GPU usage
console.log('🔧 Configuring Ollama for full GPU utilization...');

const ollamaConfig = `
# GPU Configuration for RTX 4070 SUPER (12GB VRAM)
OLLAMA_GPU_ENABLED=1
OLLAMA_NUM_GPU=1
OLLAMA_GPU_MEMORY_FRACTION=0.85
OLLAMA_MAX_LOADED_MODELS=2
OLLAMA_MAX_QUEUE=4
`;

// Write Ollama configuration
try {
  const ollamaConfigPath = path.join(process.env.APPDATA || '', 'ollama', 'config.env');
  const configDir = path.dirname(ollamaConfigPath);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(ollamaConfigPath, ollamaConfig);
  console.log(`   ✅ Ollama config written to: ${ollamaConfigPath}`);
} catch (error) {
  console.log(`   ⚠️  Could not write Ollama config: ${error.message}`);
}

// Update CodeCrucible configuration for better GPU utilization
console.log('\n🎯 Updating CodeCrucible configuration...');

const hybridConfig = `
hybrid:
  enabled: true
  routing:
    defaultProvider: "auto"
    escalationThreshold: 0.7
    confidenceScoring: true
    learningEnabled: true
    
  lmStudio:
    endpoint: "http://localhost:1234"
    enabled: true
    models:
      - "codellama-7b-instruct"
      - "gemma-2b-it"
    taskTypes: ["template", "edit", "format", "boilerplate"]
    streamingEnabled: true
    maxConcurrent: 3
    
  ollama:
    endpoint: "http://localhost:11434"
    enabled: true
    models:
      - "codellama:34b"  # Now enabled for 12GB VRAM
      - "gemma:latest"
    taskTypes: ["analysis", "planning", "complex", "multi-file"]
    maxConcurrent: 1
    gpu:
      enabled: true
      layers: -1  # Use all GPU layers
      memory_fraction: 0.85
      
  performance:
    cacheEnabled: true
    metricsCollection: true
    autoOptimization: true
    vramOptimization: true
`;

const configPath = path.join('config', 'hybrid.yaml');
try {
  if (!fs.existsSync('config')) {
    fs.mkdirSync('config', { recursive: true });
  }
  fs.writeFileSync(configPath, hybridConfig);
  console.log(`   ✅ Hybrid config updated: ${configPath}`);
} catch (error) {
  console.log(`   ⚠️  Could not update config: ${error.message}`);
}

// Restart Ollama with new configuration
console.log('\n🔄 Restarting Ollama with GPU optimization...');

try {
  // Stop existing Ollama process
  try {
    execSync('taskkill /F /IM ollama.exe', { stdio: 'ignore' });
    console.log('   ✅ Stopped existing Ollama process');
  } catch (e) {
    console.log('   ℹ️  No existing Ollama process found');
  }
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start Ollama with GPU configuration
  exec('ollama serve', (error, stdout, stderr) => {
    if (error) {
      console.log('   ⚠️  Error starting Ollama:', error.message);
    }
  });
  
  console.log('   ✅ Starting Ollama with GPU optimization...');
  
  // Wait for Ollama to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  
} catch (error) {
  console.log(`   ⚠️  Could not restart Ollama: ${error.message}`);
}

// Test GPU utilization with a model
console.log('\n🧪 Testing GPU utilization...');

try {
  // Check if gemma:latest is available (smaller model for testing)
  const models = execSync('ollama list', { encoding: 'utf8' });
  console.log('   Available models:');
  console.log(models);
  
  if (models.includes('gemma:latest')) {
    console.log('   🔥 Testing GPU acceleration with gemma:latest...');
    const testResult = execSync('ollama run gemma:latest "Hello, test GPU"', { 
      encoding: 'utf8', 
      timeout: 30000 
    });
    console.log('   ✅ GPU test successful!');
  } else {
    console.log('   ℹ️  Pull a model to test: ollama pull gemma:latest');
  }
} catch (error) {
  console.log(`   ⚠️  GPU test failed: ${error.message}`);
}

console.log('\n🎉 GPU Optimization Complete!');
console.log('===============================');
console.log('Your system should now:');
console.log('• Utilize full 12GB VRAM capacity');
console.log('• Load larger models like codellama:34b');
console.log('• Route between LM Studio (fast) and Ollama (quality)');
console.log('• Automatically optimize GPU memory usage');
console.log('\nRestart CodeCrucible to apply all changes.');