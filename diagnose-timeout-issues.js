#!/usr/bin/env node

/**
 * CodeCrucible Synth - Comprehensive Timeout Diagnostic Script
 * 
 * This script diagnoses all timeout-related issues in the AI agent system
 * and provides actionable recommendations for fixes.
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TimeoutDiagnostic {
  constructor() {
    this.results = {
      lmStudio: { status: 'unknown', issues: [], recommendations: [] },
      ollama: { status: 'unknown', issues: [], recommendations: [] },
      configuration: { status: 'unknown', issues: [], recommendations: [] },
      network: { status: 'unknown', issues: [], recommendations: [] },
      system: { status: 'unknown', issues: [], recommendations: [] }
    };
  }

  async runDiagnostics() {
    console.log('🔍 CodeCrucible Synth - Comprehensive Timeout Diagnostics');
    console.log('═'.repeat(60));
    console.log('This script will diagnose timeout issues and provide specific fixes.\n');

    await this.checkSystemResources();
    await this.diagnoseLMStudio();
    await this.diagnoseOllama();
    await this.analyzeConfiguration();
    await this.testNetworkConnectivity();
    await this.analyzeCodebaseIssues();
    
    this.generateReport();
  }

  /**
   * Check system resources that affect timeout performance
   */
  async checkSystemResources() {
    console.log('💻 Checking System Resources...');
    
    try {
      const os = await import('os');
      const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024));
      const freeMemory = Math.round(os.freemem() / (1024 * 1024 * 1024));
      const cpuCount = os.cpus().length;
      
      console.log(`  📊 Total Memory: ${totalMemory}GB`);
      console.log(`  📊 Free Memory: ${freeMemory}GB`);
      console.log(`  📊 CPU Cores: ${cpuCount}`);
      
      // Memory analysis
      if (totalMemory < 16) {
        this.results.system.issues.push('Low system memory (< 16GB) may cause model loading timeouts');
        this.results.system.recommendations.push('Consider using smaller models or increasing virtual memory');
      }
      
      if (freeMemory < 4) {
        this.results.system.issues.push('Low free memory may cause performance issues');
        this.results.system.recommendations.push('Close unnecessary applications to free memory');
      }
      
      // CPU analysis
      if (cpuCount < 4) {
        this.results.system.issues.push('Low CPU count may affect concurrent model processing');
        this.results.system.recommendations.push('Reduce maxConcurrent settings in configuration');
      }
      
      this.results.system.status = 'checked';
      console.log('  ✅ System resource check completed\n');
      
    } catch (error) {
      console.log('  ❌ System resource check failed\n');
      this.results.system.issues.push(`System check failed: ${error.message}`);
    }
  }

  /**
   * Diagnose LM Studio connectivity and configuration
   */
  async diagnoseLMStudio() {
    console.log('🏭 Diagnosing LM Studio...');
    
    const endpoints = [
      'http://localhost:1234',
      'http://127.0.0.1:1234',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

    let connectionFound = false;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`  🔍 Testing endpoint: ${endpoint}`);
        
        // Test basic connectivity with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${endpoint}/v1/models`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ LM Studio responding at ${endpoint}`);
          console.log(`  📦 Available models: ${data.data?.length || 0}`);
          
          if (data.data?.length > 0) {
            console.log(`  🎯 Models: ${data.data.map(m => m.id).join(', ')}`);
            this.results.lmStudio.status = 'healthy';
          } else {
            this.results.lmStudio.status = 'no-models';
            this.results.lmStudio.issues.push('LM Studio is running but no models are loaded');
            this.results.lmStudio.recommendations.push('Load a model in LM Studio before using the AI agent');
          }
          
          connectionFound = true;
          break;
        }
        
      } catch (error) {
        console.log(`  ❌ ${endpoint} - ${error.message}`);
        
        if (error.name === 'AbortError') {
          this.results.lmStudio.issues.push(`Timeout connecting to ${endpoint}`);
        } else if (error.code === 'ECONNREFUSED') {
          this.results.lmStudio.issues.push(`Connection refused to ${endpoint} - LM Studio may not be running`);
        } else {
          this.results.lmStudio.issues.push(`Error connecting to ${endpoint}: ${error.message}`);
        }
      }
    }
    
    if (!connectionFound) {
      this.results.lmStudio.status = 'unreachable';
      this.results.lmStudio.recommendations.push(
        'Start LM Studio and enable "Local Server" in settings',
        'Ensure no firewall is blocking port 1234',
        'Try running LM Studio as administrator',
        'Check if another application is using port 1234'
      );
    }
    
    console.log('');
  }

  /**
   * Diagnose Ollama connectivity and model status
   */
  async diagnoseOllama() {
    console.log('🦙 Diagnosing Ollama...');
    
    const endpoints = [
      'http://localhost:11434',
      'http://127.0.0.1:11434'
    ];

    let connectionFound = false;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`  🔍 Testing endpoint: ${endpoint}`);
        
        // Test basic connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${endpoint}/api/tags`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ Ollama responding at ${endpoint}`);
          console.log(`  📦 Available models: ${data.models?.length || 0}`);
          
          if (data.models?.length > 0) {
            const models = data.models.map(m => `${m.name} (${this.formatBytes(m.size)})`);
            console.log(`  🎯 Models: ${models.join(', ')}`);
            
            // Check for large models that might cause timeouts
            const largeModels = data.models.filter(m => m.size > 7 * 1024 * 1024 * 1024); // > 7GB
            if (largeModels.length > 0) {
              this.results.ollama.issues.push(`Large models detected: ${largeModels.map(m => m.name).join(', ')}`);
              this.results.ollama.recommendations.push('Consider using smaller models for faster response times');
            }
            
            this.results.ollama.status = 'healthy';
          } else {
            this.results.ollama.status = 'no-models';
            this.results.ollama.issues.push('Ollama is running but no models are installed');
            this.results.ollama.recommendations.push('Install models using: ollama pull gemma:7b');
          }
          
          connectionFound = true;
          
          // Test model warmup time
          await this.testOllamaWarmup(endpoint, data.models?.[0]?.name);
          break;
        }
        
      } catch (error) {
        console.log(`  ❌ ${endpoint} - ${error.message}`);
        
        if (error.name === 'AbortError') {
          this.results.ollama.issues.push(`Timeout connecting to ${endpoint}`);
        } else if (error.code === 'ECONNREFUSED') {
          this.results.ollama.issues.push(`Connection refused to ${endpoint} - Ollama may not be running`);
        } else {
          this.results.ollama.issues.push(`Error connecting to ${endpoint}: ${error.message}`);
        }
      }
    }
    
    if (!connectionFound) {
      this.results.ollama.status = 'unreachable';
      this.results.ollama.recommendations.push(
        'Start Ollama service: ollama serve',
        'Check if Ollama is installed: ollama --version',
        'Ensure no firewall is blocking port 11434',
        'Try restarting Ollama service'
      );
    }
    
    console.log('');
  }

  /**
   * Test Ollama model warmup time
   */
  async testOllamaWarmup(endpoint, modelName) {
    if (!modelName) return;
    
    try {
      console.log(`  ⏱️ Testing warmup time for ${modelName}...`);
      
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout
      
      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          prompt: 'Hello',
          stream: false,
          options: { num_predict: 1 }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const warmupTime = Date.now() - startTime;
      
      if (response.ok) {
        console.log(`  ✅ Model warmup completed in ${warmupTime}ms`);
        
        if (warmupTime > 30000) {
          this.results.ollama.issues.push(`Slow model warmup time: ${warmupTime}ms for ${modelName}`);
          this.results.ollama.recommendations.push('Consider using model preloading or smaller models');
        }
      } else {
        console.log(`  ❌ Model warmup failed: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Model warmup test failed: ${error.message}`);
      if (error.name === 'AbortError') {
        this.results.ollama.issues.push(`Model warmup timeout (> 60s) for ${modelName}`);
        this.results.ollama.recommendations.push('Increase timeout settings or use smaller models');
      }
    }
  }

  /**
   * Analyze configuration files for timeout issues
   */
  async analyzeConfiguration() {
    console.log('⚙️ Analyzing Configuration Files...');
    
    const configFiles = [
      'config/hybrid-config.json',
      'src/core/model-preloader.ts',
      'src/core/lm-studio-client.ts',
      'src/core/hybrid-model-client.ts',
      'src/core/timeout-manager.ts'
    ];

    for (const configFile of configFiles) {
      try {
        const filePath = path.join(__dirname, configFile);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        
        if (!exists) {
          console.log(`  ❌ Missing: ${configFile}`);
          this.results.configuration.issues.push(`Missing configuration file: ${configFile}`);
          continue;
        }
        
        const content = await fs.readFile(filePath, 'utf-8');
        console.log(`  ✅ Found: ${configFile}`);
        
        // Analyze timeout configurations
        await this.analyzeTimeoutSettings(configFile, content);
        
      } catch (error) {
        console.log(`  ❌ Error reading ${configFile}: ${error.message}`);
        this.results.configuration.issues.push(`Error reading ${configFile}: ${error.message}`);
      }
    }
    
    this.results.configuration.status = 'analyzed';
    console.log('');
  }

  /**
   * Analyze timeout settings in configuration content
   */
  async analyzeTimeoutSettings(filename, content) {
    const timeoutPatterns = [
      { pattern: /timeout:\s*(\d+)/, name: 'timeout', minValue: 60000 },
      { pattern: /loadTimeout:\s*(\d+)/, name: 'loadTimeout', minValue: 120000 },
      { pattern: /keepAliveTime:\s*['"](\d+[ms])['"]/, name: 'keepAliveTime', minValue: '10m' },
      { pattern: /retryAttempts:\s*(\d+)/, name: 'retryAttempts', minValue: 3 },
      { pattern: /maxConcurrentLoads:\s*(\d+)/, name: 'maxConcurrentLoads', minValue: 1 }
    ];

    for (const { pattern, name, minValue } of timeoutPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        const value = matches[1];
        console.log(`    📊 ${name}: ${value}`);
        
        // Check if timeout values are too low
        if (typeof minValue === 'number' && parseInt(value) < minValue) {
          this.results.configuration.issues.push(
            `Low ${name} in ${filename}: ${value}ms (recommended: >${minValue}ms)`
          );
          this.results.configuration.recommendations.push(
            `Increase ${name} to at least ${minValue}ms in ${filename}`
          );
        }
      }
    }
  }

  /**
   * Test network connectivity and latency
   */
  async testNetworkConnectivity() {
    console.log('🌐 Testing Network Connectivity...');
    
    const testEndpoints = [
      { name: 'LM Studio', url: 'http://localhost:1234/v1/models' },
      { name: 'Ollama', url: 'http://localhost:11434/api/tags' },
      { name: 'Loopback', url: 'http://127.0.0.1:1234/v1/models' }
    ];

    for (const endpoint of testEndpoints) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        await fetch(endpoint.url, {
          signal: controller.signal,
          method: 'HEAD' // Faster than GET
        });
        
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        
        console.log(`  ✅ ${endpoint.name}: ${latency}ms`);
        
        if (latency > 1000) {
          this.results.network.issues.push(`High latency to ${endpoint.name}: ${latency}ms`);
          this.results.network.recommendations.push('Check for network issues or firewall blocking');
        }
        
      } catch (error) {
        console.log(`  ❌ ${endpoint.name}: ${error.message}`);
        this.results.network.issues.push(`Connection failed to ${endpoint.name}: ${error.message}`);
      }
    }
    
    this.results.network.status = 'tested';
    console.log('');
  }

  /**
   * Analyze codebase for specific timeout issues
   */
  async analyzeCodebaseIssues() {
    console.log('🔍 Analyzing Codebase for Timeout Issues...');
    
    try {
      // Check for specific problematic patterns
      const files = [
        'src/core/model-preloader.ts',
        'src/core/lm-studio-client.ts',
        'src/core/local-model-client.ts'
      ];

      for (const file of files) {
        const filePath = path.join(__dirname, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Check for problematic patterns
          if (content.includes('timeout: 30000') && file.includes('lm-studio')) {
            this.results.configuration.issues.push(`Short timeout (30s) in LM Studio client may cause failures`);
          }
          
          if (content.includes('retryAttempts: 2') && file.includes('preloader')) {
            this.results.configuration.issues.push(`Low retry attempts (2) in model preloader`);
          }
          
          if (content.includes('maxConcurrentLoads: 1')) {
            this.results.configuration.issues.push(`Low concurrency setting may cause bottlenecks`);
          }
          
          console.log(`  ✅ Analyzed: ${file}`);
          
        } catch (error) {
          console.log(`  ❌ Cannot read: ${file}`);
        }
      }
      
    } catch (error) {
      console.log('  ❌ Codebase analysis failed');
    }
    
    console.log('');
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate comprehensive diagnostic report
   */
  generateReport() {
    console.log('📋 COMPREHENSIVE TIMEOUT DIAGNOSTIC REPORT');
    console.log('═'.repeat(60));
    
    // System Overview
    console.log('\n🎯 EXECUTIVE SUMMARY');
    console.log('─'.repeat(30));
    
    const totalIssues = Object.values(this.results).reduce((sum, component) => sum + component.issues.length, 0);
    const healthyComponents = Object.values(this.results).filter(component => component.status === 'healthy').length;
    
    if (totalIssues === 0) {
      console.log('✅ No critical timeout issues detected');
    } else if (totalIssues < 5) {
      console.log(`⚠️  ${totalIssues} issues detected - minor optimization needed`);
    } else {
      console.log(`🚨 ${totalIssues} issues detected - significant problems found`);
    }
    
    console.log(`📊 Healthy Components: ${healthyComponents}/${Object.keys(this.results).length}`);
    
    // Component Details
    for (const [component, result] of Object.entries(this.results)) {
      if (result.issues.length > 0 || result.recommendations.length > 0) {
        console.log(`\n🔧 ${component.toUpperCase()} ISSUES`);
        console.log('─'.repeat(30));
        
        if (result.issues.length > 0) {
          console.log('❌ Problems Found:');
          result.issues.forEach(issue => console.log(`  • ${issue}`));
        }
        
        if (result.recommendations.length > 0) {
          console.log('💡 Recommendations:');
          result.recommendations.forEach(rec => console.log(`  • ${rec}`));
        }
      }
    }
    
    // Priority Actions
    console.log('\n🚀 PRIORITY ACTIONS (Do These First)');
    console.log('─'.repeat(30));
    
    if (this.results.lmStudio.status === 'unreachable') {
      console.log('1. 🏭 START LM STUDIO: Download and run LM Studio, enable API server');
    }
    
    if (this.results.ollama.status === 'unreachable') {
      console.log('2. 🦙 START OLLAMA: Install and start Ollama service');
    }
    
    if (this.results.ollama.status === 'no-models' || this.results.lmStudio.status === 'no-models') {
      console.log('3. 📦 LOAD MODELS: Install/load at least one model in each service');
    }
    
    console.log('4. ⚙️  RUN TIMEOUT FIX: node fix-timeout-issues.js');
    console.log('5. 🧪 TEST SYSTEM: node test-hybrid-integration.js');
    
    // Quick Fix Commands
    console.log('\n⚡ QUICK FIX COMMANDS');
    console.log('─'.repeat(30));
    console.log('# Start services:');
    console.log('ollama serve');
    console.log('# Install recommended models:');
    console.log('ollama pull gemma:7b');
    console.log('ollama pull qwen2.5:7b');
    console.log('# Apply timeout fixes:');
    console.log('node fix-timeout-issues.js');
    console.log('# Test the fixes:');
    console.log('node test-hybrid-integration.js');
    
    // Configuration Recommendations
    console.log('\n📝 OPTIMAL CONFIGURATION');
    console.log('─'.repeat(30));
    console.log('LM Studio Settings:');
    console.log('  • API Server: Enabled');
    console.log('  • Port: 1234');
    console.log('  • Models: CodeLlama-7B or Gemma-12B');
    console.log('  • GPU Acceleration: Enabled if available');
    
    console.log('\nOllama Settings:');
    console.log('  • Service: Running (ollama serve)');
    console.log('  • Models: gemma:7b, qwen2.5:7b');
    console.log('  • Keep-alive: 15m');
    
    console.log('\nTimeout Settings:');
    console.log('  • Base timeout: 300s (5 minutes)');
    console.log('  • Model warmup: 180s (3 minutes)');
    console.log('  • Keep-alive interval: 120s (2 minutes)');
    console.log('  • Retry attempts: 5');
    
    console.log('\n🎯 Expected Results After Fixes:');
    console.log('  • LM Studio responses: < 30 seconds');
    console.log('  • Ollama responses: < 15 seconds');
    console.log('  • Model warmup: < 60 seconds');
    console.log('  • Connection reliability: > 95%');
    
    console.log('\n📞 If Issues Persist:');
    console.log('  • Check firewall settings');
    console.log('  • Verify sufficient RAM (16GB+ recommended)');
    console.log('  • Consider using smaller models');
    console.log('  • Enable debug logging for detailed analysis');
    
    console.log('\n✨ Diagnostic completed! Run the fix script to resolve issues.');
  }
}

// Run diagnostics
const diagnostic = new TimeoutDiagnostic();
diagnostic.runDiagnostics().catch(console.error);
