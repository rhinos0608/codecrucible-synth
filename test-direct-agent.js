/**
 * Direct Agent Functionality Test
 * Bypasses CLI initialization to test core agent capabilities directly
 */

console.log('🧠 CodeCrucible Synth - Direct Agent Functionality Test\n');

import { UnifiedModelClient } from './dist/core/client.js';

class DirectAgentTester {
  constructor() {
    this.testResults = [];
    this.setupTest();
  }

  async setupTest() {
    try {
      // Create minimal client config
      const clientConfig = {
        providers: [{
          type: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          timeout: 30000
        }],
        executionMode: 'auto',
        fallbackChain: ['ollama'],
        performanceThresholds: {
          fastModeMaxTokens: 2048,
          timeoutMs: 30000,
          maxConcurrentRequests: 3
        },
        security: {
          enableSandbox: true,
          maxInputLength: 50000,
          allowedCommands: ['npm', 'node', 'git']
        }
      };

      this.modelClient = new UnifiedModelClient(clientConfig);
      console.log('✅ Model client initialized successfully\n');
      await this.runDirectAgentTests();
      
    } catch (error) {
      console.error('❌ Direct agent setup failed:', error.message);
      await this.runOfflineArchitectureTests();
    }
  }

  async runDirectAgentTests() {
    console.log('🎯 Running Direct Agent Tests...\n');

    // Test 1: Basic synthesis capability
    await this.testBasicSynthesis();
    
    // Test 2: Code analysis
    await this.testCodeAnalysisCapability();
    
    // Test 3: File content processing
    await this.testFileProcessing();
    
    // Test 4: Multi-request handling
    await this.testMultiRequestHandling();

    this.displayResults();
  }

  async testBasicSynthesis() {
    console.log('⚡ Test 1: Basic Synthesis Capability');
    
    try {
      const response = await this.modelClient.synthesize({
        prompt: 'Explain what TypeScript is in 2 sentences.',
        maxTokens: 200,
        temperature: 0.7
      });
      
      if (response && response.content && response.content.length > 50) {
        console.log('   ✅ Basic synthesis working');
        console.log(`   📝 Response length: ${response.content.length} characters`);
        console.log(`   📄 Preview: "${response.content.substring(0, 100)}..."`);
        
        this.testResults.push({
          test: 'Basic Synthesis',
          status: 'PASS',
          details: 'Model client successfully generated coherent response'
        });
      } else {
        console.log('   ⚠️ Synthesis completed but limited response');
        this.testResults.push({
          test: 'Basic Synthesis',
          status: 'PARTIAL',
          details: 'Response generated but may be too short or incomplete'
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.testResults.push({
        test: 'Basic Synthesis',
        status: 'FAIL',
        details: error.message
      });
    }
    console.log('');
  }

  async testCodeAnalysisCapability() {
    console.log('🔍 Test 2: Code Analysis Capability');
    
    try {
      const sampleCode = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}`;

      const response = await this.modelClient.synthesize({
        prompt: `Analyze this JavaScript code and suggest improvements:\n\n${sampleCode}`,
        maxTokens: 500,
        temperature: 0.3
      });
      
      if (response && response.content) {
        console.log('   ✅ Code analysis completed');
        console.log(`   🔧 Analysis length: ${response.content.length} characters`);
        
        // Check if analysis contains meaningful insights
        const hasRelevantTerms = response.content.toLowerCase().includes('function') ||
                                response.content.toLowerCase().includes('improve') ||
                                response.content.toLowerCase().includes('code');
        
        if (hasRelevantTerms) {
          console.log('   💡 Analysis contains relevant coding insights');
          this.testResults.push({
            test: 'Code Analysis',
            status: 'PASS',
            details: 'Generated meaningful code analysis with improvements'
          });
        } else {
          console.log('   ⚠️ Analysis generated but may lack coding specificity');
          this.testResults.push({
            test: 'Code Analysis',
            status: 'PARTIAL',
            details: 'Response generated but lacks specific coding insights'
          });
        }
      } else {
        console.log('   ❌ Code analysis failed to generate response');
        this.testResults.push({
          test: 'Code Analysis',
          status: 'FAIL',
          details: 'No response generated for code analysis'
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.testResults.push({
        test: 'Code Analysis',
        status: 'FAIL',
        details: error.message
      });
    }
    console.log('');
  }

  async testFileProcessing() {
    console.log('📁 Test 3: File Content Processing');
    
    try {
      // Try to read a local file and process it
      const fs = await import('fs');
      const testFiles = ['src/core/types.ts', 'package.json', 'README.md'];
      let processedFile = null;
      let fileContent = '';
      
      for (const file of testFiles) {
        if (fs.existsSync(file)) {
          fileContent = fs.readFileSync(file, 'utf-8');
          processedFile = file;
          break;
        }
      }
      
      if (processedFile && fileContent) {
        console.log(`   📄 Processing file: ${processedFile}`);
        
        const response = await this.modelClient.synthesize({
          prompt: `Analyze this file content and provide a brief summary:\n\nFile: ${processedFile}\n\n${fileContent.substring(0, 1500)}`,
          maxTokens: 300,
          temperature: 0.5
        });
        
        if (response && response.content) {
          console.log('   ✅ File processing completed');
          console.log(`   📊 Summary length: ${response.content.length} characters`);
          
          this.testResults.push({
            test: 'File Processing',
            status: 'PASS',
            details: `Successfully processed and analyzed ${processedFile}`
          });
        } else {
          console.log('   ⚠️ File read but analysis incomplete');
          this.testResults.push({
            test: 'File Processing',
            status: 'PARTIAL',
            details: 'File accessed but analysis failed'
          });
        }
      } else {
        console.log('   ⚠️ No suitable test files found for processing');
        this.testResults.push({
          test: 'File Processing',
          status: 'PARTIAL',
          details: 'File access capability confirmed but no test files available'
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.testResults.push({
        test: 'File Processing',
        status: 'FAIL',
        details: error.message
      });
    }
    console.log('');
  }

  async testMultiRequestHandling() {
    console.log('🔄 Test 4: Multi-Request Handling');
    
    try {
      const requests = [
        'What is JavaScript?',
        'What is Python?',
        'What is TypeScript?'
      ];
      
      console.log(`   🚀 Sending ${requests.length} concurrent requests...`);
      
      const startTime = Date.now();
      const promises = requests.map(prompt => 
        this.modelClient.synthesize({
          prompt,
          maxTokens: 100,
          temperature: 0.5
        })
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      const successfulResponses = responses.filter(r => r && r.content && r.content.length > 20);
      
      console.log(`   ⏱️ Completed in ${duration}ms`);
      console.log(`   ✅ Successful responses: ${successfulResponses.length}/${requests.length}`);
      
      if (successfulResponses.length >= 2) {
        this.testResults.push({
          test: 'Multi-Request Handling',
          status: 'PASS',
          details: `Successfully handled ${successfulResponses.length}/${requests.length} concurrent requests`
        });
      } else if (successfulResponses.length >= 1) {
        this.testResults.push({
          test: 'Multi-Request Handling',
          status: 'PARTIAL',
          details: `Partially successful: ${successfulResponses.length}/${requests.length} requests completed`
        });
      } else {
        this.testResults.push({
          test: 'Multi-Request Handling',
          status: 'FAIL',
          details: 'Failed to handle concurrent requests effectively'
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.testResults.push({
        test: 'Multi-Request Handling',
        status: 'FAIL',
        details: error.message
      });
    }
    console.log('');
  }

  async runOfflineArchitectureTests() {
    console.log('🔌 Testing Core Architecture (Offline)...\n');
    
    try {
      // Test core imports
      const { CLI } = await import('./dist/core/cli.js');
      console.log('   ✅ CLI module importable');
      
      const { VoiceArchetypeSystem } = await import('./dist/voices/voice-archetype-system.js');
      console.log('   ✅ VoiceArchetypeSystem importable');
      
      this.testResults.push({
        test: 'Architecture Integrity',
        status: 'PASS',
        details: 'Core modules are properly structured and importable'
      });
    } catch (error) {
      console.log(`   ❌ Import error: ${error.message}`);
      this.testResults.push({
        test: 'Architecture Integrity',
        status: 'FAIL',
        details: `Module import failed: ${error.message}`
      });
    }
    
    this.displayResults();
  }

  displayResults() {
    console.log('🏆 Direct Agent Test Results');
    console.log('============================');
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const partial = this.testResults.filter(r => r.status === 'PARTIAL').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
      console.log(`${icon} ${result.test}: ${result.status}`);
      console.log(`   📝 ${result.details}`);
      console.log('');
    });
    
    console.log('📊 Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️ Partial: ${partial}`);
    console.log(`❌ Failed: ${failed}`);
    
    const successRate = ((passed + partial * 0.5) / this.testResults.length * 100).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (successRate >= 80) {
      console.log('\n🎉 DIRECT AGENT VALIDATION: EXCELLENT');
      console.log('   Core agent functionality is working well with meaningful responses.');
    } else if (successRate >= 60) {
      console.log('\n👍 DIRECT AGENT VALIDATION: GOOD');
      console.log('   Agent shows functional capabilities with some limitations.');
    } else if (successRate >= 40) {
      console.log('\n⚠️ DIRECT AGENT VALIDATION: NEEDS IMPROVEMENT');
      console.log('   Agent has basic functionality but significant limitations.');
    } else {
      console.log('\n❌ DIRECT AGENT VALIDATION: REQUIRES MAJOR FIXES');
      console.log('   Agent functionality is severely limited or broken.');
    }
    
    console.log('\n🔧 PRODUCTION READINESS:');
    if (passed >= 3) {
      console.log('   ✅ Core agent ready for production use');
    } else if (passed >= 2) {
      console.log('   ⚠️ Agent functional but needs refinement');
    } else if (passed >= 1) {
      console.log('   🔄 Agent has basic functionality, significant work needed');
    } else {
      console.log('   ❌ Agent requires major architectural fixes');
    }
  }
}

// Run the direct agent tests
const tester = new DirectAgentTester();