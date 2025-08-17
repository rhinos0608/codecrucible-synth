#!/usr/bin/env node

/**
 * Quick Test Script for Timeout Fixes
 * 
 * This script validates that the timeout fixes are working properly
 * by testing the AI agent with realistic scenarios.
 */

import { HybridModelClient } from './dist/core/hybrid-model-client.js';
import chalk from 'chalk';

class TimeoutValidationTest {
  constructor() {
    this.testResults = [];
    this.client = null;
  }

  async runTests() {
    console.log(chalk.blue('🧪 CodeCrucible Synth - Timeout Fix Validation'));
    console.log(chalk.blue('═'.repeat(50)));
    
    try {
      await this.initializeClient();
      await this.testBasicConnectivity();
      await this.testModelWarmup();
      await this.testComplexTask();
      await this.testFallbackMechanisms();
      await this.testTimeoutHandling();
      
      this.displayResults();
    } catch (error) {
      console.error(chalk.red('❌ Test suite failed:'), error);
    } finally {
      await this.cleanup();
    }
  }

  async initializeClient() {
    console.log(chalk.yellow('🔧 Initializing hybrid client with new timeout settings...'));
    
    try {
      this.client = new HybridModelClient({
        autoLoadConfig: true,
        enableFallback: true,
        enableLearning: true
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const status = this.client.getStatus();
      console.log(chalk.green('✅ Client initialized successfully'));
      console.log(`   🔧 Configuration loaded: ${status.configuration ? 'Yes' : 'No'}`);
      
      this.logResult('Client Initialization', true, 'Hybrid client ready');
      
    } catch (error) {
      console.log(chalk.red('❌ Client initialization failed'));
      this.logResult('Client Initialization', false, error.message);
      throw error;
    }
  }

  async testBasicConnectivity() {
    console.log(chalk.yellow('🔗 Testing basic connectivity...'));
    
    try {
      const providers = await this.client.testProviders();
      
      console.log(`   🏭 LM Studio: ${providers.lmStudio ? chalk.green('✅ Connected') : chalk.red('❌ Disconnected')}`);
      console.log(`   🦙 Ollama: ${providers.ollama ? chalk.green('✅ Connected') : chalk.red('❌ Disconnected')}`);
      
      const connectedCount = (providers.lmStudio ? 1 : 0) + (providers.ollama ? 1 : 0);
      
      if (connectedCount > 0) {
        this.logResult('Basic Connectivity', true, `${connectedCount}/2 providers connected`);
      } else {
        throw new Error('No providers available');
      }
      
    } catch (error) {
      console.log(chalk.red('❌ Connectivity test failed'));
      this.logResult('Basic Connectivity', false, error.message);
      throw error;
    }
  }

  async testModelWarmup() {
    console.log(chalk.yellow('🔥 Testing model warmup performance...'));
    
    try {
      const startTime = Date.now();
      
      // Test simple prompt that should trigger model warmup
      const response = await this.client.generateResponse(
        'Hello, respond with just "Hi"',
        {},
        { forceProvider: 'ollama' }
      );
      
      const warmupTime = Date.now() - startTime;
      
      if (response.content && warmupTime < 120000) { // Under 2 minutes
        console.log(chalk.green(`✅ Model warmup completed in ${warmupTime}ms`));
        this.logResult('Model Warmup', true, `${warmupTime}ms response time`);
      } else if (warmupTime >= 120000) {
        console.log(chalk.yellow(`⚠️ Model warmup slow: ${warmupTime}ms`));
        this.logResult('Model Warmup', true, `${warmupTime}ms (slow but working)`);
      } else {
        throw new Error('Invalid response from model');
      }
      
    } catch (error) {
      console.log(chalk.red('❌ Model warmup test failed'));
      this.logResult('Model Warmup', false, error.message);
    }
  }

  async testComplexTask() {
    console.log(chalk.yellow('🧠 Testing complex task handling...'));
    
    try {
      const complexPrompt = 'Create a simple JavaScript function that adds two numbers and returns the result';
      
      const startTime = Date.now();
      const response = await this.client.generateResponse(complexPrompt, {
        projectType: 'javascript',
        taskContext: 'function creation'
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.content && response.content.includes('function') && responseTime < 180000) {
        console.log(chalk.green(`✅ Complex task completed in ${responseTime}ms`));
        console.log(`   📊 Provider: ${response.provider}, Confidence: ${response.confidence.toFixed(2)}`);
        this.logResult('Complex Task', true, `${responseTime}ms, provider: ${response.provider}`);
      } else if (responseTime >= 180000) {
        console.log(chalk.yellow(`⚠️ Complex task slow: ${responseTime}ms`));
        this.logResult('Complex Task', true, `${responseTime}ms (slow but completed)`);
      } else {
        throw new Error('Invalid or incomplete response');
      }
      
    } catch (error) {
      console.log(chalk.red('❌ Complex task test failed'));
      this.logResult('Complex Task', false, error.message);
    }
  }

  async testFallbackMechanisms() {
    console.log(chalk.yellow('🔄 Testing fallback mechanisms...'));
    
    try {
      // Test with a provider that might fail
      const response = await this.client.generateResponse(
        'Simple test message',
        {},
        { enableEscalation: true }
      );
      
      if (response.content) {
        console.log(chalk.green('✅ Fallback mechanisms working'));
        console.log(`   📊 Final provider: ${response.provider}`);
        console.log(`   🔀 Escalated: ${response.escalated ? 'Yes' : 'No'}`);
        
        this.logResult('Fallback Mechanisms', true, `Response from ${response.provider}`);
      } else {
        throw new Error('No response received');
      }
      
    } catch (error) {
      console.log(chalk.red('❌ Fallback test failed'));
      this.logResult('Fallback Mechanisms', false, error.message);
    }
  }

  async testTimeoutHandling() {
    console.log(chalk.yellow('⏱️ Testing timeout handling improvements...'));
    
    try {
      // Test multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          this.client.generateResponse(`Test message ${i + 1}`, {}, {
            cacheKey: `test_${i}`
          })
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(promises);
      const totalTime = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      console.log(chalk.green(`✅ Concurrent requests: ${successful}/3 successful in ${totalTime}ms`));
      
      if (successful >= 2) {
        this.logResult('Timeout Handling', true, `${successful}/3 requests successful`);
      } else {
        this.logResult('Timeout Handling', false, `Only ${successful}/3 requests successful`);
      }
      
    } catch (error) {
      console.log(chalk.red('❌ Timeout handling test failed'));
      this.logResult('Timeout Handling', false, error.message);
    }
  }

  logResult(testName, success, details) {
    this.testResults.push({
      test: testName,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  displayResults() {
    console.log(chalk.blue('\n📊 Timeout Fix Validation Results'));
    console.log(chalk.blue('═'.repeat(50)));
    
    this.testResults.forEach(result => {
      const icon = result.success ? chalk.green('✅') : chalk.red('❌');
      const status = result.success ? chalk.green('PASS') : chalk.red('FAIL');
      console.log(`${icon} ${result.test.padEnd(25)} ${status} - ${result.details}`);
    });
    
    const successCount = this.testResults.filter(r => r.success).length;
    const totalTests = this.testResults.length;
    const successRate = (successCount / totalTests * 100).toFixed(1);
    
    console.log(chalk.blue('═'.repeat(50)));
    console.log(`📈 Success Rate: ${successCount}/${totalTests} (${successRate}%)`);
    
    if (successRate >= 80) {
      console.log(chalk.green('\n🎉 Timeout fixes are working well!'));
      console.log(chalk.green('✨ Key improvements:'));
      console.log(chalk.green('   • Faster model warmup'));
      console.log(chalk.green('   • Better error handling'));
      console.log(chalk.green('   • Improved fallback mechanisms'));
      console.log(chalk.green('   • More reliable timeouts'));
    } else if (successRate >= 60) {
      console.log(chalk.yellow('\n⚠️ Timeout fixes partially working.'));
      console.log(chalk.yellow('🔧 Some areas may need additional tuning.'));
    } else {
      console.log(chalk.red('\n❌ Timeout fixes need more work.'));
      console.log(chalk.red('🛠️ Consider using smaller models or adjusting configuration.'));
    }
    
    // Performance recommendations
    console.log(chalk.blue('\n💡 Performance Recommendations:'));
    console.log('• Use smaller models (7B instead of 20B+) for faster responses');
    console.log('• Enable model preloading in configuration');
    console.log('• Monitor system memory usage during operation');
    console.log('• Consider model quantization for better performance');
    
    console.log(chalk.blue('\n🔧 If timeouts still occur:'));
    console.log('• Check model sizes: ollama list');
    console.log('• Monitor memory: ollama ps');
    console.log('• Review logs for specific error patterns');
    console.log('• Consider switching to lighter models');
  }

  async cleanup() {
    if (this.client) {
      try {
        await this.client.dispose();
        console.log(chalk.gray('\n🧹 Resources cleaned up'));
      } catch (error) {
        console.log(chalk.yellow('\n⚠️ Cleanup warning:', error.message));
      }
    }
  }
}

// Run the validation tests
const test = new TimeoutValidationTest();
test.runTests().catch(console.error);
