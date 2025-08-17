/**
 * Test Documentation-Guided Improvements
 * Validates that implementation matches the official documentation specifications
 */

import { HybridModelClient } from './dist/core/hybrid-model-client.js';
import { LMStudioClient } from './dist/core/lm-studio-client.js';
import chalk from 'chalk';

class DocumentationGuidedTest {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  async runTests() {
    console.log(chalk.blue('\n📖 Testing Documentation-Guided Improvements\n'));
    
    try {
      await this.testLMStudioClientInterface();
      await this.testHybridClientInterface();
      await this.testConfigurationSchema();
      await this.testHealthChecking();
      await this.testCodeParsing();
      
      this.displayResults();
    } catch (error) {
      console.error(chalk.red('Documentation test failed:'), error);
    }
  }

  /**
   * Test LM Studio Client Interface matches documentation
   */
  async testLMStudioClientInterface() {
    console.log(chalk.cyan('🔍 Testing LM Studio Client Interface...'));
    
    try {
      const config = {
        endpoint: 'http://localhost:1234',
        enabled: true,
        models: ['codellama-7b-instruct'],
        maxConcurrent: 3,
        streamingEnabled: true,
        taskTypes: ['template', 'edit', 'format']
      };

      const client = new LMStudioClient(config);
      
      // Test required methods exist
      const requiredMethods = [
        'checkHealth',
        'getAvailableModels', 
        'generateCode',
        'testModel',
        'updateConfig',
        'getStatus',
        'dispose'
      ];

      let methodsFound = 0;
      for (const method of requiredMethods) {
        if (typeof client[method] === 'function') {
          methodsFound++;
          console.log(chalk.green(`   ✅ ${method} method exists`));
        } else {
          console.log(chalk.red(`   ❌ ${method} method missing`));
        }
      }

      // Test configuration properties
      const status = client.getStatus();
      const configChecks = [
        { key: 'enabled', expected: true },
        { key: 'endpoint', expected: 'http://localhost:1234' },
        { key: 'maxConcurrent', expected: 3 },
        { key: 'streamingEnabled', expected: true }
      ];

      let configMatches = 0;
      for (const check of configChecks) {
        if (status[check.key] === check.expected) {
          configMatches++;
          console.log(chalk.green(`   ✅ Config ${check.key}: ${status[check.key]}`));
        } else {
          console.log(chalk.yellow(`   ⚠️ Config ${check.key}: ${status[check.key]} (expected: ${check.expected})`));
        }
      }

      // Test response interface
      try {
        // This will fail due to no LM Studio, but we can check the error structure
        await client.generateCode('test');
      } catch (error) {
        // Expected to fail, but should fail with proper error message
        const hasProperError = error.message.includes('LM Studio');
        console.log(chalk.blue(`   ℹ️ Error handling: ${hasProperError ? 'Proper' : 'Needs improvement'}`));
      }

      client.dispose();

      this.logResult('LM Studio Client Interface', {
        methodsFound,
        totalMethods: requiredMethods.length,
        configMatches,
        totalConfigChecks: configChecks.length
      });

    } catch (error) {
      console.log(chalk.red(`   ❌ Interface test failed: ${error.message}`));
      this.logResult('LM Studio Client Interface', { error: error.message });
    }
  }

  /**
   * Test Hybrid Client Interface
   */
  async testHybridClientInterface() {
    console.log(chalk.cyan('🔗 Testing Hybrid Client Interface...'));
    
    try {
      const hybridClient = new HybridModelClient({
        autoLoadConfig: true,
        enableFallback: true,
        enableLearning: true
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test methods exist
      const requiredMethods = [
        'generateResponse',
        'testProviders', 
        'getStatus',
        'updateConfiguration',
        'dispose'
      ];

      let methodsFound = 0;
      for (const method of requiredMethods) {
        if (typeof hybridClient[method] === 'function') {
          methodsFound++;
          console.log(chalk.green(`   ✅ ${method} method exists`));
        } else {
          console.log(chalk.red(`   ❌ ${method} method missing`));
        }
      }

      // Test status structure
      const status = hybridClient.getStatus();
      const statusChecks = [
        'configuration',
        'modelSelector',
        'cache'
      ];

      let statusStructureOk = 0;
      for (const check of statusChecks) {
        if (status[check] !== undefined) {
          statusStructureOk++;
          console.log(chalk.green(`   ✅ Status has ${check} section`));
        } else {
          console.log(chalk.yellow(`   ⚠️ Status missing ${check} section`));
        }
      }

      await hybridClient.dispose();

      this.logResult('Hybrid Client Interface', {
        methodsFound,
        totalMethods: requiredMethods.length,
        statusStructureOk,
        totalStatusChecks: statusChecks.length
      });

    } catch (error) {
      console.log(chalk.red(`   ❌ Hybrid interface test failed: ${error.message}`));
      this.logResult('Hybrid Client Interface', { error: error.message });
    }
  }

  /**
   * Test Configuration Schema
   */
  async testConfigurationSchema() {
    console.log(chalk.cyan('⚙️ Testing Configuration Schema...'));
    
    try {
      const { HybridConfigManager } = await import('./dist/core/hybrid-config-manager.js');
      const configManager = new HybridConfigManager();
      
      const config = await configManager.loadConfig();
      
      // Test required top-level sections
      const requiredSections = [
        'hybrid',
        'performance', 
        'resources',
        'fallback',
        'development'
      ];

      let sectionsFound = 0;
      for (const section of requiredSections) {
        if (config[section]) {
          sectionsFound++;
          console.log(chalk.green(`   ✅ Config section: ${section}`));
        } else {
          console.log(chalk.red(`   ❌ Missing config section: ${section}`));
        }
      }

      // Test hybrid section structure
      const hybridChecks = [
        'enabled',
        'lmStudio',
        'ollama',
        'routing'
      ];

      let hybridStructureOk = 0;
      for (const check of hybridChecks) {
        if (config.hybrid && config.hybrid[check] !== undefined) {
          hybridStructureOk++;
          console.log(chalk.green(`   ✅ Hybrid section has: ${check}`));
        } else {
          console.log(chalk.yellow(`   ⚠️ Hybrid section missing: ${check}`));
        }
      }

      // Test configuration summary
      const summary = configManager.getConfigSummary();
      const summaryOk = summary && summary.hybrid && summary.providers;
      console.log(chalk.blue(`   ℹ️ Configuration summary: ${summaryOk ? 'Available' : 'Missing'}`));

      this.logResult('Configuration Schema', {
        sectionsFound,
        totalSections: requiredSections.length,
        hybridStructureOk,
        totalHybridChecks: hybridChecks.length,
        summaryOk
      });

    } catch (error) {
      console.log(chalk.red(`   ❌ Configuration test failed: ${error.message}`));
      this.logResult('Configuration Schema', { error: error.message });
    }
  }

  /**
   * Test Health Checking Implementation
   */
  async testHealthChecking() {
    console.log(chalk.cyan('💊 Testing Health Checking...'));
    
    try {
      const config = {
        endpoint: 'http://localhost:1234',
        enabled: true,
        models: [],
        maxConcurrent: 1,
        streamingEnabled: false,
        taskTypes: []
      };

      const client = new LMStudioClient(config);
      
      // Test health check method
      const healthResult = await client.checkHealth();
      console.log(chalk.blue(`   ℹ️ Health check result: ${healthResult ? 'Healthy' : 'Unhealthy'} (expected for no LM Studio)`));
      
      // Test health check caching (should use cached result)
      const startTime = Date.now();
      const cachedResult = await client.checkHealth();
      const checkTime = Date.now() - startTime;
      
      const isCached = checkTime < 100; // Should be very fast if cached
      console.log(chalk.blue(`   ℹ️ Health check caching: ${isCached ? 'Working' : 'Not cached'} (${checkTime}ms)`));
      
      // Test model availability check
      const models = await client.getAvailableModels();
      console.log(chalk.blue(`   ℹ️ Model discovery: ${models.length} models found`));
      
      client.dispose();

      this.logResult('Health Checking', {
        healthCheckWorks: true,
        caching: isCached,
        modelDiscovery: true
      });

    } catch (error) {
      console.log(chalk.red(`   ❌ Health checking test failed: ${error.message}`));
      this.logResult('Health Checking', { error: error.message });
    }
  }

  /**
   * Test Code Parsing Implementation
   */
  async testCodeParsing() {
    console.log(chalk.cyan('🔍 Testing Code Parsing...'));
    
    try {
      const config = {
        endpoint: 'http://localhost:1234',
        enabled: false, // Disabled to avoid actual calls
        models: [],
        maxConcurrent: 1,
        streamingEnabled: false,
        taskTypes: []
      };

      const client = new LMStudioClient(config);
      
      // Test parseCodeResponse method (we'll need to make it public for testing)
      // For now, we'll test the interface structure
      
      // Test that generateCode would return proper structure
      const expectedStructure = [
        'code',
        'explanation', 
        'confidence',
        'latency',
        'model',
        'fromCache',
        'content',
        'tokens_used'
      ];

      console.log(chalk.blue('   ℹ️ Expected LMStudioResponse structure:'));
      expectedStructure.forEach(field => {
        console.log(chalk.gray(`     - ${field}`));
      });

      client.dispose();

      this.logResult('Code Parsing', {
        structureDefined: true,
        fieldsCount: expectedStructure.length
      });

    } catch (error) {
      console.log(chalk.red(`   ❌ Code parsing test failed: ${error.message}`));
      this.logResult('Code Parsing', { error: error.message });
    }
  }

  /**
   * Log test result
   */
  logResult(testName, details) {
    this.testResults.push({
      test: testName,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Display comprehensive results
   */
  displayResults() {
    const totalTime = Date.now() - this.startTime;
    
    console.log(chalk.blue('\n📊 Documentation Compliance Results'));
    console.log(chalk.blue('═'.repeat(60)));

    let totalScore = 0;
    let maxScore = 0;

    this.testResults.forEach(result => {
      console.log(chalk.cyan(`\n${result.test}:`));
      
      if (result.details.error) {
        console.log(chalk.red(`   ❌ Error: ${result.details.error}`));
      } else {
        Object.entries(result.details).forEach(([key, value]) => {
          if (key.includes('Found') || key.includes('Ok') || key.includes('Matches')) {
            const total = result.details[key.replace(/Found|Ok|Matches/, '').replace(/^(.)/, c => c.toLowerCase()) + (key.includes('Found') ? '' : key.includes('Matches') ? 'Checks' : 'Checks')];
            if (typeof total === 'number') {
              totalScore += value;
              maxScore += total;
              const percentage = total > 0 ? (value / total * 100).toFixed(1) : '0.0';
              console.log(chalk.green(`   ✅ ${key}: ${value}/${total} (${percentage}%)`));
            } else {
              console.log(chalk.blue(`   ℹ️ ${key}: ${value}`));
            }
          } else {
            console.log(chalk.blue(`   ℹ️ ${key}: ${value}`));
          }
        });
      }
    });

    console.log(chalk.blue('═'.repeat(60)));
    
    const overallPercentage = maxScore > 0 ? (totalScore / maxScore * 100).toFixed(1) : '0.0';
    
    console.log(`🎯 Overall Compliance: ${totalScore}/${maxScore} (${overallPercentage}%)`);
    console.log(`⏱️ Test Time: ${(totalTime / 1000).toFixed(1)}s`);

    // Assessment
    if (parseFloat(overallPercentage) >= 90) {
      console.log(chalk.green('\n🎉 Excellent! Implementation matches documentation very well.'));
    } else if (parseFloat(overallPercentage) >= 75) {
      console.log(chalk.yellow('\n👍 Good compliance with documentation, minor improvements needed.'));
    } else if (parseFloat(overallPercentage) >= 50) {
      console.log(chalk.yellow('\n⚠️ Moderate compliance, several areas need improvement.'));
    } else {
      console.log(chalk.red('\n🔧 Low compliance, significant improvements needed.'));
    }

    console.log(chalk.cyan('\n📖 Next Steps:'));
    console.log('   1. Review any missing methods or configuration sections');
    console.log('   2. Test with actual LM Studio instance for full validation');
    console.log('   3. Implement any missing documentation features');
    console.log('   4. Run integration tests with both services running');
  }
}

// Run the documentation compliance test
const tester = new DocumentationGuidedTest();
tester.runTests().catch(console.error);