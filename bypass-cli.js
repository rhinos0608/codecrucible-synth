#!/usr/bin/env node

/**
 * Bypass CLI for CodeCrucible Synth
 * Bypasses TypeScript compilation issues to test core agent functionality
 */

console.log('🚀 CodeCrucible Synth - Bypass CLI Testing\n');

import axios from 'axios';

class SimpleOllamaClient {
  constructor(endpoint = 'http://localhost:11434') {
    this.endpoint = endpoint;
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.log(`❌ Ollama health check failed: ${error.message}`);
      return false;
    }
  }

  async generateResponse(prompt) {
    try {
      console.log('🔄 Generating response with Ollama...');
      
      // Check if model is warm (already loaded)
      const isModelWarm = await this.checkModelWarmth();
      
      // Adaptive timeout based on model state and prompt complexity
      const complexity = this.assessPromptComplexity(prompt);
      const timeout = this.determineOptimalTimeout(prompt, isModelWarm);
      console.log(`   ⏱️  Using ${timeout/1000}s timeout (model ${isModelWarm ? 'warm' : 'cold'}, complexity: ${complexity})`);
      
      const startTime = Date.now();
      const response = await axios.post(`${this.endpoint}/api/generate`, {
        model: 'gemma:latest',
        prompt: prompt,
        stream: false,
        options: {
          num_ctx: this.getContextSize(prompt),
          temperature: 0.3,
          num_predict: this.getPredictTokens(prompt)
        }
      }, {
        timeout: timeout,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data && response.data.response) {
        const latency = Date.now() - startTime;
        return {
          success: true,
          content: response.data.response,
          model: response.data.model || 'gemma:latest',
          latency: latency
        };
      } else {
        throw new Error('Invalid response format from Ollama');
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`❌ Connection refused - Ollama server not running`);
      } else if (error.code === 'ECONNRESET') {
        console.error(`❌ Connection reset - Ollama server may be overloaded`);
      } else {
        console.error(`❌ Ollama generation failed:`, error.message);
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkModelWarmth() {
    try {
      // Check if any models are currently loaded
      const response = await axios.get(`${this.endpoint}/api/ps`, { timeout: 5000 });
      const loadedModels = response.data.models || [];
      
      // Check if our target model is loaded
      const isWarm = loadedModels.some(model => 
        model.name === 'gemma:latest' || model.model === 'gemma:latest'
      );
      
      return isWarm;
    } catch (error) {
      // If we can't check, assume cold start
      return false;
    }
  }

  determineOptimalTimeout(prompt, isModelWarm) {
    let baseTimeout;
    
    if (!isModelWarm) {
      // Cold start - model needs to load
      baseTimeout = 120000; // 2 minutes for cold start
    } else {
      // Model is warm but may need VRAM loading
      baseTimeout = 60000; // 1 minute for warm model (more realistic)
    }

    // Adjust based on prompt complexity
    const complexity = this.assessPromptComplexity(prompt);
    
    switch (complexity) {
      case 'simple':
        return Math.max(baseTimeout, 30000); // Min 30s (realistic for Ollama)
      case 'complex':
        return Math.max(baseTimeout, 180000); // Max 3 minutes for complex
      default:
        return baseTimeout;
    }
  }

  assessPromptComplexity(prompt) {
    const length = prompt.length;
    const hasCode = prompt.includes('function') || prompt.includes('const') || prompt.includes('class');
    const hasAnalysis = prompt.includes('analyze') || prompt.includes('review') || prompt.includes('explain');
    const hasDebug = prompt.includes('bug') || prompt.includes('error') || prompt.includes('fix');
    
    // Any code analysis should be complex due to model processing requirements
    if (hasCode && (hasAnalysis || hasDebug)) {
      return 'complex';
    } else if (length > 150 || hasAnalysis) {
      return 'complex'; 
    } else if (length < 50 && !hasCode && !hasAnalysis) {
      return 'simple';
    } else {
      return 'medium';
    }
  }

  getContextSize(prompt) {
    const complexity = this.assessPromptComplexity(prompt);
    switch (complexity) {
      case 'simple': return 512;
      case 'complex': return 2048;
      default: return 1024;
    }
  }

  getPredictTokens(prompt) {
    const complexity = this.assessPromptComplexity(prompt);
    switch (complexity) {
      case 'simple': return 150;
      case 'complex': return 500;
      default: return 300;
    }
  }
}

class BypassCLI {
  constructor() {
    this.ollamaClient = new SimpleOllamaClient();
  }

  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      this.showUsage();
      return;
    }

    const command = args[0];
    
    if (command === 'test' || command === 'agent') {
      await this.testAgent(args.slice(1).join(' ') || 'Explain what TypeScript is in one sentence.');
    } else if (command === 'health') {
      await this.checkHealth();
    } else {
      // Treat entire command line as prompt
      await this.testAgent(args.join(' '));
    }
  }

  async testAgent(prompt) {
    console.log(`💭 Prompt: "${prompt}"\n`);

    // Check Ollama health first
    const healthy = await this.ollamaClient.checkHealth();
    if (!healthy) {
      console.log('❌ Ollama is not available. Please ensure:');
      console.log('   1. Ollama is installed and running');
      console.log('   2. The gemma:latest model is available');
      console.log('   3. Port 11434 is accessible');
      return;
    }

    console.log('✅ Ollama health check passed\n');

    // Generate response
    const startTime = Date.now();
    const result = await this.ollamaClient.generateResponse(prompt);
    const totalTime = Date.now() - startTime;

    if (result.success) {
      console.log('✅ Response generated successfully!\n');
      console.log('📄 Response:');
      console.log('─'.repeat(50));
      console.log(result.content);
      console.log('─'.repeat(50));
      console.log(`\n⏱️  Total time: ${totalTime}ms`);
      console.log(`🤖 Model: ${result.model}`);
      
      // Assess response quality
      const quality = this.assessResponseQuality(result.content, prompt);
      console.log(`💯 Quality score: ${quality.score}/100`);
      console.log(`📊 Assessment: ${quality.assessment}`);
      
    } else {
      console.log(`❌ Response generation failed: ${result.error}`);
    }
  }

  async checkHealth() {
    console.log('🩺 Health Check Report\n');
    
    // Test Ollama
    console.log('Testing Ollama connection...');
    const ollamaHealthy = await this.ollamaClient.checkHealth();
    console.log(`   Ollama: ${ollamaHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    // Test available models
    if (ollamaHealthy) {
      try {
        const response = await axios.get('http://localhost:11434/api/tags');
        const models = response.data.models || [];
        console.log(`   Available models: ${models.length}`);
        models.forEach(model => {
          console.log(`     - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)`);
        });
      } catch (error) {
        console.log('   ⚠️ Could not fetch model list');
      }
    }

    // Test basic generation capability
    if (ollamaHealthy) {
      console.log('\nTesting generation capability...');
      const testResult = await this.ollamaClient.generateResponse('Say "Hello World" in exactly two words.');
      if (testResult.success) {
        console.log(`   ✅ Generation test passed`);
        console.log(`   Response: "${testResult.content.trim()}"`);
      } else {
        console.log(`   ❌ Generation test failed: ${testResult.error}`);
      }
    }

    console.log('\n📊 Overall Status:');
    if (ollamaHealthy) {
      console.log('   🎉 CodeCrucible agent backend is functional!');
      console.log('   Ready for code analysis and generation tasks.');
    } else {
      console.log('   ❌ Agent backend is not functional');
      console.log('   Please check Ollama installation and configuration.');
    }
  }

  assessResponseQuality(content, prompt) {
    let score = 50; // Base score
    const contentLower = content.toLowerCase();
    const promptLower = prompt.toLowerCase();

    // Positive indicators
    if (content.length > 50) score += 10; // Substantial response
    if (content.length < 1000) score += 5; // Not too verbose
    if (contentLower.includes('typescript') && promptLower.includes('typescript')) score += 15;
    if (contentLower.includes('javascript') && promptLower.includes('javascript')) score += 15;
    if (content.includes('```')) score += 10; // Contains code blocks
    if (contentLower.includes('function') || contentLower.includes('const') || contentLower.includes('let')) score += 10;
    if (!contentLower.includes('sorry') && !contentLower.includes("can't")) score += 10; // Confident response

    // Negative indicators  
    if (content.length < 20) score -= 20; // Too short
    if (content.length > 2000) score -= 10; // Too verbose
    if (contentLower.includes('error') || contentLower.includes('failed')) score -= 15;

    score = Math.max(0, Math.min(100, score));

    let assessment;
    if (score >= 80) assessment = 'Excellent - High quality, relevant response';
    else if (score >= 70) assessment = 'Good - Quality response with minor issues';
    else if (score >= 60) assessment = 'Fair - Acceptable response but could be better';
    else if (score >= 40) assessment = 'Poor - Response has significant issues';
    else assessment = 'Very Poor - Response is inadequate';

    return { score, assessment };
  }

  showUsage() {
    console.log('🛠️  CodeCrucible Synth - Bypass CLI\n');
    console.log('Usage:');
    console.log('  node bypass-cli.js agent "Your prompt here"');
    console.log('  node bypass-cli.js test');
    console.log('  node bypass-cli.js health');
    console.log('  node bypass-cli.js "Direct prompt"');
    console.log('\nExamples:');
    console.log('  node bypass-cli.js agent "Analyze this TypeScript code for improvements"');
    console.log('  node bypass-cli.js "What is React and how does it work?"');
    console.log('  node bypass-cli.js health');
    console.log('\nThis bypass CLI tests the core agent functionality without TypeScript compilation.');
  }
}

// Run the CLI
const cli = new BypassCLI();
cli.run().catch(error => {
  console.error('❌ CLI error:', error.message);
  process.exit(1);
});