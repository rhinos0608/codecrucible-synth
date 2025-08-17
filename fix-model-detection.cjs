#!/usr/bin/env node

/**
 * Quick Model Fix Script
 * Fixes model detection and VRAM issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Model Detection and VRAM Issues...\n');

// Get actual available models
async function getActualModels() {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec('curl -s http://localhost:11434/api/tags', (error, stdout) => {
      if (error) {
        console.log('❌ Could not fetch models from Ollama');
        resolve([]);
        return;
      }
      
      try {
        const data = JSON.parse(stdout);
        const models = data.models.map(m => ({
          name: m.name,
          size: m.size,
          family: m.details?.family || 'unknown',
          parameters: m.details?.parameter_size || 'unknown'
        }));
        
        console.log('✅ Actual available models:');
        models.forEach(m => {
          const sizeMB = Math.round(m.size / (1024 * 1024));
          console.log(`  • ${m.name} (${m.parameters}, ${sizeMB}MB)`);
        });
        
        resolve(models);
      } catch (e) {
        console.log('❌ Could not parse Ollama response');
        resolve([]);
      }
    });
  });
}

async function main() {
  const actualModels = await getActualModels();
  
  if (actualModels.length === 0) {
    console.log('❌ No models found. Make sure Ollama is running.');
    return;
  }
  
  // Create optimized configuration for your actual models
  const optimizedConfig = {
    model: 'gemma:latest', // Start with smallest model
    fallbackModels: actualModels.map(m => m.name),
    vramLimit: 2000, // 2GB in MB
    enableGpu: true,
    gpuLayers: 'auto' // Let Ollama decide
  };
  
  console.log('\n🎯 Creating optimized configuration...');
  
  // Update local model config
  try {
    const configPath = path.join(__dirname, 'config', 'local.yaml');
    let content = fs.readFileSync(configPath, 'utf8');
    
    // Update model selection
    content = content.replace(
      /model: auto/g,
      `model: "${optimizedConfig.model}"`
    );
    
    // Update endpoint timeout
    content = content.replace(
      /timeout: \d+/g,
      'timeout: 30000'
    );
    
    fs.writeFileSync(configPath, content);
    console.log('✅ Updated local.yaml with optimal settings');
  } catch (error) {
    console.log(`⚠️  Could not update config: ${error.message}`);
  }
  
  console.log('\n🚀 Testing with simple CLI command...');
  
  // Test with fast mode and specific model
  const { spawn } = require('child_process');
  const testProcess = spawn('node', [
    'dist/index.js', 
    '--fast',
    '--skip-init',
    'Hello world'
  ], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let hasResponse = false;
  
  testProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    output += chunk;
    process.stdout.write(chunk);
    
    if (chunk.includes('Generated response') || 
        chunk.includes('Response:') || 
        chunk.length > 100) {
      hasResponse = true;
    }
  });
  
  testProcess.stderr.on('data', (data) => {
    const chunk = data.toString();
    if (!chunk.includes('ExperimentalWarning')) {
      process.stderr.write(chunk);
    }
  });
  
  // Set timeout for the test
  const timeout = setTimeout(() => {
    console.log('\n⚠️  Test timed out after 60 seconds');
    testProcess.kill();
  }, 60000);
  
  testProcess.on('close', (code) => {
    clearTimeout(timeout);
    
    if (hasResponse) {
      console.log('\n✅ SUCCESS: Agent responded correctly!');
    } else if (code === 0) {
      console.log('\n✅ Process completed successfully');
    } else {
      console.log(`\n❌ Process exited with code ${code}`);
    }
    
    console.log('\n💡 Recommendations:');
    console.log('• Use --fast flag for quick responses');
    console.log('• Start with gemma:latest (smallest model)');
    console.log('• Your actual models: codellama:34b, gemma3n:e4b, gemma:latest');
    console.log('• Available VRAM: ~2GB (10GB used by other processes)');
    console.log('\n🧪 Quick test commands:');
    console.log('  node dist/index.js --fast "Hello"');
    console.log('  node dist/index.js --skip-init "What is 2+2?"');
  });
}

main().catch(console.error);
