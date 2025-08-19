#!/usr/bin/env node

/**
 * Optimized CodeCrucible Synth CLI
 * Implements single-model strategy with performance optimizations
 */

console.log('⚡ CodeCrucible Synth - Optimized CLI\n');

import axios from 'axios';

class OptimizedOllamaClient {
  constructor(endpoint = 'http://localhost:11434', targetModel = 'gemma:latest') {
    this.endpoint = endpoint;
    this.targetModel = targetModel;
    this.healthCheckCache = new Map();
    this.performanceMetrics = []; // Reduced from 1000 to 50 max
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;
    
    console.log('🔧 Initializing optimized client...');
    
    // Ensure our target model is loaded and ready
    const isReady = await this.ensureModelReady();
    if (isReady) {
      this.initialized = true;
      console.log('✅ Client initialized with preloaded model\n');
      return true;
    } else {
      console.log('❌ Failed to initialize - model loading failed\n');
      return false;
    }
  }

  async ensureModelReady() {
    try {
      console.log(`   🔄 Ensuring ${this.targetModel} is loaded...`);
      
      // Check if model is already loaded
      const loadedModels = await this.getLoadedModels();
      const isLoaded = loadedModels.some(model => 
        model.name === this.targetModel && model.size_vram > 0
      );
      
      if (isLoaded) {
        console.log(`   ✅ Model ${this.targetModel} already loaded in VRAM`);
        return true;
      }
      
      // Preload the model with a simple request
      console.log(`   🔄 Preloading ${this.targetModel} into VRAM...`);
      const warmupResponse = await this.warmupModel();
      
      if (warmupResponse.success) {
        console.log(`   ✅ Model preloaded successfully (${warmupResponse.latency}ms)`);
        return true;
      } else {
        console.log(`   ❌ Model preload failed: ${warmupResponse.error}`);
        return false;
      }
      
    } catch (error) {
      console.log(`   ❌ Model ready check failed: ${error.message}`);
      return false;
    }
  }

  async getLoadedModels() {
    try {
      const response = await axios.get(`${this.endpoint}/api/ps`, { timeout: 5000 });
      return response.data.models || [];
    } catch (error) {
      return [];
    }
  }

  async warmupModel() {
    try {
      const startTime = Date.now();
      const response = await axios.post(`${this.endpoint}/api/generate`, {
        model: this.targetModel,
        prompt: 'Hello',
        stream: false,
        options: {
          num_ctx: 512,
          temperature: 0.1,
          num_predict: 5
        }
      }, {
        timeout: 90000, // Allow time for initial model loading
        headers: { 'Content-Type': 'application/json' }
      });

      const latency = Date.now() - startTime;
      
      if (response.data && response.data.response) {
        return { success: true, latency };
      } else {
        return { success: false, error: 'No response from warmup' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkHealthCached() {
    const cacheKey = 'health';
    const cached = this.healthCheckCache.get(cacheKey);
    const now = Date.now();
    
    // Use cached result if less than 30 seconds old
    if (cached && (now - cached.timestamp) < 30000) {
      return cached.available;
    }
    
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`, { timeout: 5000 });
      const available = response.status === 200;
      
      // Cache the result
      this.healthCheckCache.set(cacheKey, { available, timestamp: now });
      return available;
    } catch (error) {
      this.healthCheckCache.set(cacheKey, { available: false, timestamp: now });
      return false;
    }
  }

  async generateResponse(prompt) {
    if (!this.initialized) {
      const ready = await this.initialize();
      if (!ready) {
        return { success: false, error: 'Client initialization failed' };
      }
    }

    try {
      console.log('⚡ Generating with optimized client...');
      
      // Optimized settings for single-model performance
      const complexity = this.assessComplexityFast(prompt);
      const options = this.getOptimizedOptions(complexity);
      
      console.log(`   📊 Complexity: ${complexity}, Context: ${options.num_ctx}, Predict: ${options.num_predict}`);
      
      const startTime = Date.now();
      const response = await axios.post(`${this.endpoint}/api/generate`, {
        model: this.targetModel,
        prompt: prompt,
        stream: false,
        options
      }, {
        timeout: this.getOptimizedTimeout(complexity),
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data && response.data.response) {
        const latency = Date.now() - startTime;
        
        // Lightweight metrics (max 50 entries, not 1000)
        this.recordMetricsOptimized(latency, complexity);
        
        return {
          success: true,
          content: response.data.response,
          model: response.data.model || this.targetModel,
          latency: latency,
          evalCount: response.data.eval_count,
          evalDuration: response.data.eval_duration
        };
      } else {
        throw new Error('Invalid response format from Ollama');
      }
    } catch (error) {
      console.error(`❌ Optimized generation failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Fast complexity assessment (O(1) instead of O(n))
  assessComplexityFast(prompt) {
    const length = prompt.length;
    
    // Quick heuristics for fast classification
    if (length > 200 || prompt.includes('analyze') || prompt.includes('review')) {
      return 'complex';
    } else if (length < 50 && !prompt.includes('function') && !prompt.includes('code')) {
      return 'simple';
    } else {
      return 'medium';
    }
  }

  getOptimizedOptions(complexity) {
    // Optimized settings based on single-model performance profiling
    switch (complexity) {
      case 'simple':
        return {
          num_ctx: 512,        // Minimal context for speed
          temperature: 0.1,    // Low variance for consistency
          num_predict: 100     // Limit tokens for speed
        };
      case 'complex':
        return {
          num_ctx: 1024,       // Sufficient context for analysis
          temperature: 0.3,    // Moderate creativity
          num_predict: 400     // Allow detailed responses
        };
      default: // medium
        return {
          num_ctx: 768,        // Balanced context
          temperature: 0.2,    // Slight creativity
          num_predict: 250     // Balanced response length
        };
    }
  }

  getOptimizedTimeout(complexity) {
    // Realistic timeouts based on single-model performance
    // Even warm models need sufficient time for VRAM operations
    switch (complexity) {
      case 'simple': return 45000;    // 45s for simple (allow for VRAM settling)
      case 'complex': return 90000;   // 90s for complex analysis
      default: return 60000;          // 60s for medium tasks
    }
  }

  recordMetricsOptimized(latency, complexity) {
    // Lightweight metrics tracking (max 50 entries to prevent memory leaks)
    this.performanceMetrics.push({
      timestamp: Date.now(),
      latency,
      complexity
    });
    
    // Keep only last 50 metrics (not 1000!)
    if (this.performanceMetrics.length > 50) {
      this.performanceMetrics = this.performanceMetrics.slice(-25);
    }
  }

  getPerformanceStats() {
    if (this.performanceMetrics.length === 0) return null;
    
    const latencies = this.performanceMetrics.map(m => m.latency);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    
    return {
      totalRequests: this.performanceMetrics.length,
      avgLatency: Math.round(avgLatency),
      maxLatency,
      minLatency,
      modelUsed: this.targetModel
    };
  }
}

class OptimizedCLI {
  constructor() {
    this.client = new OptimizedOllamaClient();
  }

  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      this.showUsage();
      return;
    }

    const command = args[0];
    
    if (command === 'init') {
      await this.initializeSystem();
    } else if (command === 'test' || command === 'agent') {
      await this.testAgent(args.slice(1).join(' ') || 'Explain TypeScript in one sentence.');
    } else if (command === 'health') {
      await this.checkHealth();
    } else if (command === 'stats') {
      await this.showStats();
    } else {
      // Treat entire command line as prompt
      await this.testAgent(args.join(' '));
    }
  }

  async initializeSystem() {
    console.log('🚀 Initializing Optimized CodeCrucible Synth System...\n');
    
    const success = await this.client.initialize();
    if (success) {
      console.log('🎉 System ready for high-performance operation!');
      console.log('💡 The model is now preloaded and ready for instant responses.\n');
      console.log('Try: node optimized-cli.js "What is TypeScript?"');
    } else {
      console.log('❌ System initialization failed. Please check Ollama setup.');
    }
  }

  async testAgent(prompt) {
    console.log(`💭 Prompt: "${prompt}"\n`);

    // Check health with caching
    const healthy = await this.client.checkHealthCached();
    if (!healthy) {
      console.log('❌ Ollama is not available. Please ensure Ollama is running.');
      return;
    }

    console.log('✅ Health check passed (cached)\n');

    // Generate response with optimized client
    const startTime = Date.now();
    const result = await this.client.generateResponse(prompt);
    const totalTime = Date.now() - startTime;

    if (result.success) {
      console.log('🎯 Response generated successfully!\n');
      console.log('📄 Response:');
      console.log('─'.repeat(60));
      console.log(result.content);
      console.log('─'.repeat(60));
      console.log(`\n⚡ Total time: ${totalTime}ms (Model: ${result.latency}ms)`);
      console.log(`🤖 Model: ${result.model}`);
      if (result.evalCount) {
        console.log(`📊 Tokens: ${result.evalCount} (${(result.evalDuration / 1000000).toFixed(0)}ms eval)`);
      }
      
      // Quick quality assessment
      const quality = this.assessResponseQuality(result.content, prompt);
      console.log(`💯 Quality: ${quality.score}/100 - ${quality.assessment}`);
      
    } else {
      console.log(`❌ Response generation failed: ${result.error}`);
    }
  }

  async checkHealth() {
    console.log('🩺 Optimized Health Check\n');
    
    const healthy = await this.client.checkHealthCached();
    console.log(`   Ollama Status: ${healthy ? '✅ Healthy (cached)' : '❌ Unhealthy'}`);
    
    if (healthy) {
      const models = await this.client.getLoadedModels();
      console.log(`   Loaded Models: ${models.length}`);
      models.forEach(model => {
        const vramMB = (model.size_vram / 1024 / 1024).toFixed(0);
        const totalMB = (model.size / 1024 / 1024).toFixed(0);
        console.log(`     - ${model.name}: ${vramMB}MB VRAM / ${totalMB}MB total`);
      });
    }
    
    console.log('\n📊 Performance Status:');
    const stats = this.client.getPerformanceStats();
    if (stats) {
      console.log(`   Average Latency: ${stats.avgLatency}ms`);
      console.log(`   Total Requests: ${stats.totalRequests}`);
      console.log(`   Range: ${stats.minLatency}ms - ${stats.maxLatency}ms`);
    } else {
      console.log('   No performance data available yet');
    }
  }

  async showStats() {
    console.log('📈 Performance Statistics\n');
    
    const stats = this.client.getPerformanceStats();
    if (stats) {
      console.log(`Model: ${stats.modelUsed}`);
      console.log(`Total Requests: ${stats.totalRequests}`);
      console.log(`Average Latency: ${stats.avgLatency}ms`);
      console.log(`Best Performance: ${stats.minLatency}ms`);
      console.log(`Worst Performance: ${stats.maxLatency}ms`);
      
      if (stats.avgLatency < 15000) {
        console.log('\n🚀 Performance: EXCELLENT - Model is optimally configured');
      } else if (stats.avgLatency < 30000) {
        console.log('\n⚡ Performance: GOOD - Consistent response times');
      } else {
        console.log('\n⚠️ Performance: NEEDS OPTIMIZATION - Consider model tuning');
      }
    } else {
      console.log('No performance data available. Run some test commands first.');
    }
  }

  assessResponseQuality(content, prompt) {
    let score = 60; // Base score
    
    // Positive indicators (lightweight checks)
    if (content.length > 50) score += 10;
    if (content.length < 1000) score += 5;
    if (content.includes('```')) score += 15;
    if (prompt.toLowerCase().includes('typescript') && content.toLowerCase().includes('typescript')) score += 15;
    
    // Negative indicators
    if (content.length < 20) score -= 25;
    if (content.includes('sorry') || content.includes("can't")) score -= 20;
    
    score = Math.max(0, Math.min(100, score));
    
    let assessment;
    if (score >= 85) assessment = 'Excellent';
    else if (score >= 70) assessment = 'Good';
    else if (score >= 55) assessment = 'Fair';
    else assessment = 'Poor';
    
    return { score, assessment };
  }

  showUsage() {
    console.log('⚡ CodeCrucible Synth - Optimized CLI\n');
    console.log('Commands:');
    console.log('  init                     Initialize and preload model');
    console.log('  agent "prompt"           Generate response with optimization');
    console.log('  health                   Check system health and status');
    console.log('  stats                    Show performance statistics');
    console.log('  "direct prompt"          Direct prompt processing');
    console.log('\nOptimizations:');
    console.log('  ✅ Single-model strategy (no VRAM thrashing)');
    console.log('  ✅ Cached health checks (reduce API calls)');
    console.log('  ✅ Lightweight metrics (prevent memory leaks)');
    console.log('  ✅ Adaptive timeouts (realistic for local models)');
    console.log('  ✅ Model preloading (eliminate cold start delays)');
    console.log('\nExamples:');
    console.log('  node optimized-cli.js init');
    console.log('  node optimized-cli.js "What is React?"');
    console.log('  node optimized-cli.js agent "Create a TypeScript function"');
  }
}

// Run the optimized CLI
const cli = new OptimizedCLI();
cli.run().catch(error => {
  console.error('❌ CLI error:', error.message);
  process.exit(1);
});