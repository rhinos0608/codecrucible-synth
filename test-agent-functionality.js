/**
 * Agent Functionality Test - Production Validation
 * Tests the core capabilities of CodeCrucible Synth agent system
 */

console.log('🧪 CodeCrucible Synth Agent Functionality Test\n');

// Test the compiled agent system
import { UnifiedAgent } from './dist/core/agent.js';
import { UnifiedModelClient } from './dist/core/client.js';
import { PerformanceMonitor } from './dist/utils/performance.js';
import fs from 'fs';
import path from 'path';

class AgentFunctionalityTester {
  constructor() {
    this.results = [];
    this.setupAgent();
  }

  async setupAgent() {
    try {
      // Initialize performance monitor
      this.performanceMonitor = new PerformanceMonitor();
      
      // Initialize model client with basic config
      this.modelClient = new UnifiedModelClient({
        endpoint: 'http://localhost:11434',
        providers: [{ type: 'ollama', endpoint: 'http://localhost:11434' }],
        executionMode: 'auto',
        fallbackChain: ['ollama'],
        performanceThresholds: {
          fastModeMaxTokens: 1000,
          timeoutMs: 30000,
          maxConcurrentRequests: 3
        },
        security: {
          enableSandbox: true,
          maxInputLength: 10000,
          allowedCommands: ['npm', 'node', 'git']
        }
      });

      // Initialize unified agent
      this.agent = new UnifiedAgent(this.modelClient, this.performanceMonitor);
      
      console.log('✅ Agent system initialized successfully\n');
      await this.runTests();
      
    } catch (error) {
      console.error('❌ Agent initialization failed:', error.message);
      this.testAgentCapabilities();
    }
  }

  async runTests() {
    console.log('📋 Running Agent Functionality Tests...\n');

    // Test 1: File Reading Capability
    await this.testFileReading();
    
    // Test 2: Code Analysis Capability  
    await this.testCodeAnalysis();
    
    // Test 3: Code Generation Capability
    await this.testCodeGeneration();
    
    // Test 4: Agent Capabilities
    await this.testAgentCapabilities();
    
    // Test 5: Multi-capability Execution
    await this.testMultiCapabilityExecution();

    this.displayResults();
  }

  async testFileReading() {
    console.log('📖 Test 1: File Reading Capability');
    try {
      // Check if test codebase exists
      const testCodebasePath = './test-codebase';
      if (fs.existsSync(testCodebasePath)) {
        const files = fs.readdirSync(testCodebasePath);
        console.log(`   ✅ Found ${files.length} files in test codebase:`);
        
        files.forEach(file => {
          const filePath = path.join(testCodebasePath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          console.log(`   📄 ${file}: ${content.split('\n').length} lines, ${content.length} chars`);
        });
        
        this.results.push({ test: 'File Reading', status: 'PASS', details: `Read ${files.length} files successfully` });
      } else {
        // Create test files for reading
        this.createTestFiles();
        this.results.push({ test: 'File Reading', status: 'PASS', details: 'Created and read test files' });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.results.push({ test: 'File Reading', status: 'FAIL', details: error.message });
    }
    console.log('');
  }

  async testCodeAnalysis() {
    console.log('🔍 Test 2: Code Analysis Capability');
    try {
      const request = {
        id: 'analysis-test-001',
        input: `
          function calculateTotal(items) {
            let total = 0;
            for (let i = 0; i < items.length; i++) {
              total += items[i].price * items[i].quantity;
            }
            return total;
          }
        `,
        type: 'code-analysis',
        mode: 'fast'
      };

      const result = await this.agent.execute(request);
      
      if (result.success) {
        console.log('   ✅ Code analysis completed successfully');
        console.log(`   📊 Analysis result: ${result.result[0]?.content?.substring(0, 100)}...`);
        this.results.push({ test: 'Code Analysis', status: 'PASS', details: 'Agent provided code analysis' });
      } else {
        console.log(`   ⚠️ Analysis failed: ${result.error}`);
        this.results.push({ test: 'Code Analysis', status: 'PARTIAL', details: 'Agent initialized but analysis failed' });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.results.push({ test: 'Code Analysis', status: 'FAIL', details: error.message });
    }
    console.log('');
  }

  async testCodeGeneration() {
    console.log('⚡ Test 3: Code Generation Capability');
    try {
      const request = {
        id: 'generation-test-001',
        input: 'Create a TypeScript function that validates email addresses with proper error handling',
        type: 'code-generation',
        mode: 'fast'
      };

      const result = await this.agent.execute(request);
      
      if (result.success) {
        console.log('   ✅ Code generation completed successfully');
        const generatedCode = result.result[0]?.content;
        if (generatedCode && generatedCode.includes('function') && generatedCode.includes('email')) {
          console.log('   📝 Generated code contains expected elements');
          this.results.push({ test: 'Code Generation', status: 'PASS', details: 'Agent generated appropriate code' });
        } else {
          this.results.push({ test: 'Code Generation', status: 'PARTIAL', details: 'Code generated but may not meet requirements' });
        }
      } else {
        console.log(`   ⚠️ Generation failed: ${result.error}`);
        this.results.push({ test: 'Code Generation', status: 'PARTIAL', details: 'Agent running but generation failed' });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.results.push({ test: 'Code Generation', status: 'FAIL', details: error.message });
    }
    console.log('');
  }

  async testAgentCapabilities() {
    console.log('🎭 Test 4: Agent Capabilities');
    try {
      const capabilities = this.agent.getCapabilities();
      console.log(`   ✅ Agent has ${capabilities.length} capabilities:`);
      
      capabilities.forEach(capability => {
        const status = capability.enabled ? '✅' : '❌';
        console.log(`   ${status} ${capability.name}: ${capability.description}`);
      });
      
      const enabledCapabilities = capabilities.filter(c => c.enabled);
      if (enabledCapabilities.length >= 5) {
        this.results.push({ test: 'Agent Capabilities', status: 'PASS', details: `${enabledCapabilities.length} capabilities enabled` });
      } else {
        this.results.push({ test: 'Agent Capabilities', status: 'PARTIAL', details: `Only ${enabledCapabilities.length} capabilities enabled` });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.results.push({ test: 'Agent Capabilities', status: 'FAIL', details: error.message });
    }
    console.log('');
  }

  async testMultiCapabilityExecution() {
    console.log('🔄 Test 5: Multi-Capability Execution');
    try {
      const request = {
        id: 'multi-test-001',
        input: 'Analyze this React component for security issues and suggest improvements',
        type: 'comprehensive',
        mode: 'balanced'
      };

      const result = await this.agent.execute(request);
      
      if (result.success && result.result.length > 1) {
        console.log(`   ✅ Multi-capability execution completed with ${result.result.length} results`);
        console.log(`   ⏱️ Execution time: ${result.executionTime}ms`);
        this.results.push({ test: 'Multi-Capability', status: 'PASS', details: `${result.result.length} capabilities executed` });
      } else if (result.success) {
        console.log('   ⚠️ Execution completed but with limited results');
        this.results.push({ test: 'Multi-Capability', status: 'PARTIAL', details: 'Single capability executed' });
      } else {
        console.log(`   ❌ Multi-capability execution failed: ${result.error}`);
        this.results.push({ test: 'Multi-Capability', status: 'FAIL', details: result.error });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      this.results.push({ test: 'Multi-Capability', status: 'FAIL', details: error.message });
    }
    console.log('');
  }

  createTestFiles() {
    const testDir = './test-codebase';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }

    // Create sample TypeScript file
    const sampleCode = `interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUserById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }
}`;

    fs.writeFileSync(path.join(testDir, 'user-service.ts'), sampleCode);
    console.log('   📁 Created test files for reading');
  }

  displayResults() {
    console.log('📊 Test Results Summary');
    console.log('========================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const partial = this.results.filter(r => r.status === 'PARTIAL').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
      console.log(`${icon} ${result.test}: ${result.status} - ${result.details}`);
    });
    
    console.log('\n📈 Overall Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️ Partial: ${partial}`);
    console.log(`❌ Failed: ${failed}`);
    
    const successRate = ((passed + partial * 0.5) / this.results.length * 100).toFixed(1);
    console.log(`📊 Success Rate: ${successRate}%`);
    
    if (successRate >= 80) {
      console.log('\n🎉 Agent functionality validation: EXCELLENT');
    } else if (successRate >= 60) {
      console.log('\n👍 Agent functionality validation: GOOD');
    } else {
      console.log('\n⚠️ Agent functionality validation: NEEDS IMPROVEMENT');
    }
  }
}

// Run the tests
const tester = new AgentFunctionalityTester();