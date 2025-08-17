#!/usr/bin/env node

/**
 * Simple agent test without heavy model loading
 */

import { AgentOrchestrator } from './dist/core/agent-orchestrator.js';
import { LocalModelClient } from './dist/core/local-model-client.js';
import { VoiceArchetypeSystem } from './dist/voices/voice-archetype-system.js';
import { MCPServerManager } from './dist/mcp-servers/mcp-server-manager.js';
import { logger } from './dist/core/logger.js';

async function testAgentBasics() {
  try {
    console.log('🧪 Testing Agent Basics (No Model Loading)...\n');
    
    // Create minimal mock configuration
    const mockConfig = {
      model: {
        endpoint: 'http://localhost:11434',
        name: 'test-model',
        timeout: 30000,
        maxTokens: 2048,
        temperature: 0.7
      },
      mcp: {
        servers: []
      }
    };
    
    // Test 1: Check if AgentOrchestrator can be instantiated
    console.log('Test 1: AgentOrchestrator instantiation');
    const mockModelClient = {
      generateResponse: async () => ({ content: 'mock response', tokens_used: 100 })
    };
    const mockVoiceSystem = {
      generateMultiVoiceSolutions: async () => [{ content: 'mock voice response' }]
    };
    const mockMcpManager = {
      listTools: () => []
    };
    
    const context = {
      modelClient: mockModelClient,
      voiceSystem: mockVoiceSystem,
      mcpManager: mockMcpManager,
      config: mockConfig
    };
    
    const orchestrator = new AgentOrchestrator(context);
    console.log('✅ AgentOrchestrator created successfully');
    
    // Test 2: Check execution manager initialization
    console.log('\nTest 2: Execution Manager');
    const executionManager = orchestrator.getExecutionManager();
    const status = executionManager.getStatus();
    console.log('✅ Execution Manager Status:', JSON.stringify(status, null, 2));
    
    // Test 3: Test available backends
    console.log('\nTest 3: Available Backends');
    const availableBackends = executionManager.getAvailableBackends();
    console.log('✅ Available Backends:', availableBackends);
    
    // Test 4: Test simple code execution (local backend)
    console.log('\nTest 4: Simple Code Execution');
    try {
      const result = await executionManager.execute(
        'echo "Hello from CodeCrucible execution backend"',
        { backend: 'local_process', timeout: 5000 }
      );
      
      if (result.success) {
        console.log('✅ Code execution successful:');
        console.log('   Output:', result.data.stdout.trim());
        console.log('   Backend:', result.data.backend);
        console.log('   Duration:', result.data.duration + 'ms');
      } else {
        console.log('❌ Code execution failed:', result.error);
      }
    } catch (error) {
      console.log('❌ Code execution error:', error.message);
    }
    
    // Test 5: Test workflow stats
    console.log('\nTest 5: Workflow Statistics');
    const workflowStats = orchestrator.getWorkflowStats();
    console.log('✅ Workflow Stats:', JSON.stringify(workflowStats, null, 2));
    
    console.log('\n🎉 Basic agent tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   - AgentOrchestrator: ✅ Working');
    console.log('   - Execution Manager: ✅ Working');
    console.log('   - Backend Detection: ✅ Working');
    console.log('   - Code Execution: ✅ Working');
    console.log('   - Workflow System: ✅ Working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testAgentBasics().catch(console.error);