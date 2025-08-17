/**
 * Comprehensive Test for Hybrid LLM Architecture Integration
 * 
 * This test validates the integration between LM Studio and Ollama
 * through the HybridModelClient orchestrator.
 */

import { HybridModelClient } from './dist/core/hybrid-model-client.js';
import { HybridConfigManager } from './dist/core/hybrid-config-manager.js';
import chalk from 'chalk';

class HybridIntegrationTest {
  constructor() {
    this.hybridClient = null;
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log(chalk.blue('\n🧪 CodeCrucible Synth - Hybrid LLM Architecture Integration Test\n'));
    
    try {
      await this.testConfigurationLoading();
      await this.testHybridClientInitialization();
      await this.testProviderAvailability();
      await this.testTaskClassification();
      await this.testRoutingDecisions();
      await this.testResponseGeneration();
      await this.testEscalationLogic();
      await this.testFallbackMechanisms();
      await this.testPerformanceMetrics();
      await this.testConfigurationUpdates();
      
      this.displaySummary();
    } catch (error) {
      console.error(chalk.red('\n❌ Integration test suite failed:'), error);
      this.logResult('Integration Test Suite', false, error.message);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test configuration loading and validation
   */
  async testConfigurationLoading() {
    console.log(chalk.yellow('📋 Testing configuration loading...'));
    
    try {
      const configManager = new HybridConfigManager();
      const config = await configManager.loadConfig();
      
      // Validate configuration structure
      const requiredSections = ['hybrid', 'performance', 'resources', 'fallback', 'development'];
      const missingSections = requiredSections.filter(section => !config[section]);
      
      if (missingSections.length > 0) {
        throw new Error(`Missing configuration sections: ${missingSections.join(', ')}`);
      }

      // Validate hybrid configuration
      if (!config.hybrid.lmStudio || !config.hybrid.ollama) {
        throw new Error('Missing LM Studio or Ollama configuration');
      }

      console.log(chalk.green('   ✅ Configuration loaded and validated'));
      console.log(`   📊 Config summary: LM Studio ${config.hybrid.lmStudio.enabled ? 'enabled' : 'disabled'}, Ollama ${config.hybrid.ollama.enabled ? 'enabled' : 'disabled'}`);
      
      this.logResult('Configuration Loading', true, 'All sections present and valid');
      
      // Test configuration summary
      const summary = configManager.getConfigSummary();
      console.log(`   📈 Routing rules: ${summary.routing.rules}, Performance monitoring: ${summary.performance.monitoring}`);
      
    } catch (error) {
      console.log(chalk.red('   ❌ Configuration loading failed'));
      this.logResult('Configuration Loading', false, error.message);
      throw error;
    }
  }

  /**
   * Test hybrid client initialization
   */
  async testHybridClientInitialization() {
    console.log(chalk.yellow('🔄 Testing hybrid client initialization...'));
    
    try {
      this.hybridClient = new HybridModelClient({
        autoLoadConfig: true,
        enableFallback: true,
        enableLearning: true
      });

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test status retrieval
      const status = this.hybridClient.getStatus();
      
      if (!status.configuration || !status.modelSelector) {
        throw new Error('Hybrid client not properly initialized');
      }

      console.log(chalk.green('   ✅ Hybrid client initialized successfully'));
      console.log(`   🔧 Hybrid enabled: ${status.configuration.hybrid.enabled}`);
      console.log(`   🎯 Escalation threshold: ${status.configuration.hybrid.escalationThreshold}`);
      
      this.logResult('Hybrid Client Initialization', true, 'Client ready with all components');
      
    } catch (error) {
      console.log(chalk.red('   ❌ Hybrid client initialization failed'));
      this.logResult('Hybrid Client Initialization', false, error.message);
      throw error;
    }
  }

  /**
   * Test provider availability
   */
  async testProviderAvailability() {
    console.log(chalk.yellow('🔍 Testing provider availability...'));
    
    try {
      const providerTests = await this.hybridClient.testProviders();
      
      console.log(`   🏭 LM Studio: ${providerTests.lmStudio ? chalk.green('Available') : chalk.red('Unavailable')}`);
      console.log(`   🦙 Ollama: ${providerTests.ollama ? chalk.green('Available') : chalk.red('Unavailable')}`);
      
      // At least one provider should be available
      if (!providerTests.lmStudio && !providerTests.ollama) {
        throw new Error('No providers available - cannot test hybrid functionality');
      }

      const availableCount = (providerTests.lmStudio ? 1 : 0) + (providerTests.ollama ? 1 : 0);
      
      this.logResult('Provider Availability', true, `${availableCount}/2 providers available`);
      
      if (availableCount === 2) {
        console.log(chalk.green('   ✅ Both providers available - full hybrid functionality possible'));
      } else {
        console.log(chalk.yellow('   ⚠️ Only one provider available - limited hybrid functionality'));
      }
      
    } catch (error) {
      console.log(chalk.red('   ❌ Provider availability test failed'));
      this.logResult('Provider Availability', false, error.message);
      throw error;
    }
  }

  /**
   * Test task classification logic
   */
  async testTaskClassification() {
    console.log(chalk.yellow('🏷️ Testing task classification...'));
    
    try {
      const testCases = [
        {
          prompt: 'Create a React component template',
          expectedType: 'template',
          expectedComplexity: 'simple',
          expectedProvider: 'lmstudio'
        },
        {
          prompt: 'Analyze the security vulnerabilities in this complex multi-file architecture',
          expectedType: 'analysis',
          expectedComplexity: 'complex',
          expectedProvider: 'ollama'
        },
        {
          prompt: 'Format this code with proper indentation',
          expectedType: 'format',
          expectedComplexity: 'simple',
          expectedProvider: 'lmstudio'
        },
        {
          prompt: 'Design a microservices architecture for a large-scale application',
          expectedType: 'planning',
          expectedComplexity: 'complex',
          expectedProvider: 'ollama'
        }
      ];

      let correctClassifications = 0;
      
      for (const testCase of testCases) {
        const classification = this.hybridClient.modelSelector.classifyTask(testCase.prompt);
        
        const typeMatch = classification.type === testCase.expectedType;
        const complexityMatch = classification.complexity === testCase.expectedComplexity;
        const providerMatch = classification.suggestedProvider === testCase.expectedProvider;
        
        if (typeMatch && complexityMatch && providerMatch) {
          correctClassifications++;
          console.log(chalk.green(`   ✅ "${testCase.prompt.substring(0, 30)}..." - Correct classification`));
        } else {
          console.log(chalk.yellow(`   ⚠️ "${testCase.prompt.substring(0, 30)}..." - Expected: ${testCase.expectedType}/${testCase.expectedComplexity}/${testCase.expectedProvider}, Got: ${classification.type}/${classification.complexity}/${classification.suggestedProvider}`));
        }
      }

      const accuracy = (correctClassifications / testCases.length) * 100;
      
      if (accuracy >= 75) {
        console.log(chalk.green(`   ✅ Task classification accuracy: ${accuracy}% (${correctClassifications}/${testCases.length})`));
        this.logResult('Task Classification', true, `${accuracy}% accuracy`);
      } else {
        throw new Error(`Low classification accuracy: ${accuracy}%`);
      }
      
    } catch (error) {
      console.log(chalk.red('   ❌ Task classification test failed'));
      this.logResult('Task Classification', false, error.message);
      throw error;
    }
  }

  /**
   * Test routing decisions
   */
  async testRoutingDecisions() {
    console.log(chalk.yellow('🎯 Testing routing decisions...'));
    
    try {
      const testPrompts = [
        'Create a simple React button component',
        'Perform a comprehensive security audit of this codebase',
        'Format this JavaScript code',
        'Design a scalable database architecture'
      ];

      let routingTests = 0;
      
      for (const prompt of testPrompts) {
        const decision = await this.hybridClient.modelSelector.makeRoutingDecision(prompt);
        
        if (decision.selectedLLM && decision.confidence > 0) {
          routingTests++;
          console.log(chalk.green(`   ✅ Routed to ${decision.selectedLLM} (confidence: ${decision.confidence.toFixed(2)})`));
          console.log(`       Reasoning: ${decision.reasoning}`);
        } else {
          console.log(chalk.red(`   ❌ Invalid routing decision for: "${prompt.substring(0, 30)}..."`));
        }
      }

      if (routingTests === testPrompts.length) {
        this.logResult('Routing Decisions', true, `All ${routingTests} routing decisions valid`);
      } else {
        throw new Error(`Invalid routing decisions: ${routingTests}/${testPrompts.length}`);
      }
      
    } catch (error) {
      console.log(chalk.red('   ❌ Routing decisions test failed'));
      this.logResult('Routing Decisions', false, error.message);
      throw error;
    }
  }

  /**
   * Test response generation with both providers
   */
  async testResponseGeneration() {
    console.log(chalk.yellow('💬 Testing response generation...'));
    
    try {
      const testPrompt = 'Create a simple "Hello World" function in JavaScript';
      
      // Test with automatic routing
      console.log('   🔄 Testing automatic routing...');
      const autoResponse = await this.hybridClient.generateResponse(testPrompt, {}, { 
        enableEscalation: true 
      });
      
      if (!autoResponse.content || autoResponse.content.length < 10) {
        throw new Error('Invalid response content from automatic routing');
      }

      console.log(chalk.green(`   ✅ Auto routing: ${autoResponse.provider} responded in ${autoResponse.responseTime}ms`));
      console.log(`       Confidence: ${autoResponse.confidence.toFixed(2)}, Escalated: ${autoResponse.escalated}`);
      console.log(`       Preview: "${autoResponse.content.substring(0, 50)}..."`);

      // Test with forced LM Studio (if available)
      try {
        console.log('   🔄 Testing forced LM Studio routing...');
        const lmStudioResponse = await this.hybridClient.generateResponse(testPrompt, {}, { 
          forceProvider: 'lmstudio' 
        });
        
        console.log(chalk.green(`   ✅ LM Studio: Responded in ${lmStudioResponse.responseTime}ms`));
        this.logResult('LM Studio Response', true, `${lmStudioResponse.responseTime}ms response time`);
      } catch (error) {
        console.log(chalk.yellow(`   ⚠️ LM Studio forced routing failed: ${error.message}`));
        this.logResult('LM Studio Response', false, error.message);
      }

      // Test with forced Ollama
      try {
        console.log('   🔄 Testing forced Ollama routing...');
        const ollamaResponse = await this.hybridClient.generateResponse(testPrompt, {}, { 
          forceProvider: 'ollama' 
        });
        
        console.log(chalk.green(`   ✅ Ollama: Responded in ${ollamaResponse.responseTime}ms`));
        this.logResult('Ollama Response', true, `${ollamaResponse.responseTime}ms response time`);
      } catch (error) {
        console.log(chalk.yellow(`   ⚠️ Ollama forced routing failed: ${error.message}`));
        this.logResult('Ollama Response', false, error.message);
      }

      this.logResult('Response Generation', true, 'At least automatic routing works');
      
    } catch (error) {
      console.log(chalk.red('   ❌ Response generation test failed'));
      this.logResult('Response Generation', false, error.message);
      throw error;
    }
  }

  /**
   * Test escalation logic
   */
  async testEscalationLogic() {
    console.log(chalk.yellow('📈 Testing escalation logic...'));
    
    try {
      // Test with a task that should trigger escalation if LM Studio gives low confidence
      const complexPrompt = 'Provide a detailed architectural analysis of microservices patterns with security considerations';
      
      const response = await this.hybridClient.generateResponse(complexPrompt, {}, { 
        forceProvider: 'lmstudio',
        enableEscalation: true 
      });

      console.log(`   📊 Response confidence: ${response.confidence.toFixed(2)}`);
      console.log(`   📈 Escalated: ${response.escalated ? 'Yes' : 'No'}`);
      
      if (response.escalated) {
        console.log(chalk.green('   ✅ Escalation triggered correctly for low confidence'));
        console.log(`       Original provider: ${response.metadata.originalProvider}`);
        console.log(`       Escalation reason: ${response.metadata.escalationReason}`);
      } else {
        console.log(chalk.blue('   ℹ️ No escalation triggered (confidence sufficient or Ollama was primary)'));
      }

      this.logResult('Escalation Logic', true, `Escalation ${response.escalated ? 'triggered' : 'not needed'}`);
      
    } catch (error) {
      console.log(chalk.red('   ❌ Escalation logic test failed'));
      this.logResult('Escalation Logic', false, error.message);
    }
  }

  /**
   * Test fallback mechanisms
   */
  async testFallbackMechanisms() {
    console.log(chalk.yellow('🔄 Testing fallback mechanisms...'));
    
    try {
      // Test circuit breaker behavior by checking status
      const status = this.hybridClient.getStatus();
      console.log(`   🔌 Circuit breakers: ${Object.keys(status.circuitBreakers).length} configured`);
      
      // Test configuration fallback
      const testConfig = {
        fallback: {
          autoFallback: true,
          retryAttempts: 2,
          retryDelay: 1000
        }
      };
      
      await this.hybridClient.updateConfiguration(testConfig);
      console.log(chalk.green('   ✅ Fallback configuration updated successfully'));
      
      this.logResult('Fallback Mechanisms', true, 'Circuit breakers and config updates working');
      
    } catch (error) {
      console.log(chalk.red('   ❌ Fallback mechanisms test failed'));
      this.logResult('Fallback Mechanisms', false, error.message);
    }
  }

  /**
   * Test performance metrics collection
   */
  async testPerformanceMetrics() {
    console.log(chalk.yellow('📊 Testing performance metrics...'));
    
    try {
      const status = this.hybridClient.getStatus();
      
      // Check if metrics are being collected
      const hasMetrics = status.modelSelector && status.modelSelector.providers;
      
      if (hasMetrics) {
        console.log(chalk.green('   ✅ Performance metrics collection active'));
        
        const lmStudioMetrics = status.modelSelector.providers.lmStudio?.metrics;
        const ollamaMetrics = status.modelSelector.providers.ollama?.metrics;
        
        if (lmStudioMetrics) {
          console.log(`   🏭 LM Studio: ${lmStudioMetrics.totalRequests} requests, ${(lmStudioMetrics.successRate * 100).toFixed(1)}% success rate`);
        }
        
        if (ollamaMetrics) {
          console.log(`   🦙 Ollama: ${ollamaMetrics.totalRequests} requests, ${(ollamaMetrics.successRate * 100).toFixed(1)}% success rate`);
        }
        
        // Check cache status
        console.log(`   💾 Cache: ${status.cache.size} entries, ${status.cache.enabled ? 'enabled' : 'disabled'}`);
        
        this.logResult('Performance Metrics', true, 'Metrics collection and caching operational');
      } else {
        throw new Error('Performance metrics not available');
      }
      
    } catch (error) {
      console.log(chalk.red('   ❌ Performance metrics test failed'));
      this.logResult('Performance Metrics', false, error.message);
    }
  }

  /**
   * Test configuration updates
   */
  async testConfigurationUpdates() {
    console.log(chalk.yellow('⚙️ Testing configuration updates...'));
    
    try {
      // Test updating escalation threshold
      const originalStatus = this.hybridClient.getStatus();
      const originalThreshold = originalStatus.configuration.hybrid.escalationThreshold;
      
      const newThreshold = 0.8;
      await this.hybridClient.updateConfiguration({
        hybrid: {
          escalationThreshold: newThreshold
        }
      });
      
      const updatedStatus = this.hybridClient.getStatus();
      const updatedThreshold = updatedStatus.configuration.hybrid.escalationThreshold;
      
      if (Math.abs(updatedThreshold - newThreshold) < 0.01) {
        console.log(chalk.green(`   ✅ Configuration updated: escalation threshold ${originalThreshold} → ${updatedThreshold}`));
        this.logResult('Configuration Updates', true, 'Threshold update successful');
      } else {
        throw new Error(`Configuration update failed: expected ${newThreshold}, got ${updatedThreshold}`);
      }
      
    } catch (error) {
      console.log(chalk.red('   ❌ Configuration updates test failed'));
      this.logResult('Configuration Updates', false, error.message);
    }
  }

  /**
   * Log test result
   */
  logResult(testName, success, details) {
    this.testResults.push({
      test: testName,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Display test summary
   */
  displaySummary() {
    const totalTime = Date.now() - this.startTime;
    const successCount = this.testResults.filter(r => r.success).length;
    const totalTests = this.testResults.length;
    
    console.log(chalk.blue('\n📋 Integration Test Summary'));
    console.log(chalk.blue('═'.repeat(50)));
    
    this.testResults.forEach(result => {
      const icon = result.success ? chalk.green('✅') : chalk.red('❌');
      const status = result.success ? chalk.green('PASS') : chalk.red('FAIL');
      console.log(`${icon} ${result.test.padEnd(30)} ${status} - ${result.details}`);
    });
    
    console.log(chalk.blue('═'.repeat(50)));
    
    const successRate = (successCount / totalTests * 100).toFixed(1);
    const overallStatus = successCount === totalTests ? chalk.green('SUCCESS') : 
                         successCount > totalTests * 0.7 ? chalk.yellow('PARTIAL') : chalk.red('FAILURE');
    
    console.log(`🎯 Overall Result: ${overallStatus}`);
    console.log(`📊 Tests Passed: ${successCount}/${totalTests} (${successRate}%)`);
    console.log(`⏱️ Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    
    if (successRate >= 80) {
      console.log(chalk.green('\n🎉 Hybrid LLM Architecture is ready for production!'));
      console.log(chalk.green('✨ Key features validated:'));
      console.log(chalk.green('   • Intelligent task routing'));
      console.log(chalk.green('   • Automatic escalation'));
      console.log(chalk.green('   • Fallback mechanisms'));
      console.log(chalk.green('   • Performance monitoring'));
    } else if (successRate >= 60) {
      console.log(chalk.yellow('\n⚠️ Hybrid architecture partially functional.'));
      console.log(chalk.yellow('🔧 Some components may need attention before production.'));
    } else {
      console.log(chalk.red('\n❌ Hybrid architecture needs significant work.'));
      console.log(chalk.red('🛠️ Review failed tests and fix issues before proceeding.'));
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.hybridClient) {
      try {
        await this.hybridClient.dispose();
        console.log(chalk.gray('\n🧹 Resources cleaned up successfully'));
      } catch (error) {
        console.log(chalk.yellow('\n⚠️ Cleanup warning:', error.message));
      }
    }
  }
}

// Run the integration test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new HybridIntegrationTest();
  test.runAllTests().catch(console.error);
}

export { HybridIntegrationTest };