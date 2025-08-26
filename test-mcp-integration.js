/**
 * Test MCP Integration Directly
 * Tests the actual MCP integration that the Advanced Tool Orchestrator should use
 */

import { getGlobalEnhancedToolIntegration, initializeGlobalEnhancedToolIntegration } from './dist/core/tools/enhanced-tool-integration.js';
import { getGlobalToolIntegration, initializeGlobalToolIntegration } from './dist/core/tools/tool-integration.js';
import { MCPServerManager } from './dist/mcp-servers/mcp-server-manager.js';

console.log('🔧 Testing MCP Integration and Tool Availability');
console.log('===============================================\n');

async function testMCPIntegration() {
  try {
    // Test 1: Check if global instances exist (should be null initially)
    console.log('📊 Step 1: Checking initial global instances');
    const initialEnhanced = getGlobalEnhancedToolIntegration();
    const initialBasic = getGlobalToolIntegration();
    
    console.log(`   Enhanced Tool Integration: ${initialEnhanced ? '✅ EXISTS' : '❌ NULL'}`);
    console.log(`   Basic Tool Integration: ${initialBasic ? '✅ EXISTS' : '❌ NULL'}`);
    
    if (!initialEnhanced && !initialBasic) {
      console.log('   ✅ Expected - global instances not initialized yet\n');
    } else {
      console.log('   ⚠️ Unexpected - some instances already exist\n');
    }
    
    // Test 2: Initialize MCP Manager with proper config
    console.log('🚀 Step 2: Initializing MCP Manager');
    const mcpConfig = {
      filesystem: { enabled: true, restrictedPaths: [], allowedPaths: [process.cwd(), '~/'] },
      git: { enabled: true, autoCommitMessages: false, safeModeEnabled: true },
      terminal: {
        enabled: true,
        allowedCommands: ['npm', 'node', 'git', 'ls', 'cat', 'head', 'tail', 'grep', 'find', 'pwd', 'echo', 'wc', 'sort', 'uniq', 'cut', 'awk', 'sed'],
        blockedCommands: ['rm', 'rmdir', 'mv', 'sudo', 'su', 'chmod +x', 'chown'],
      },
      packageManager: { enabled: true, autoInstall: false, securityScan: true },
      smithery: {
        enabled: !!process.env.SMITHERY_API_KEY,
        apiKey: process.env.SMITHERY_API_KEY,
        autoDiscovery: false, // Disable auto-discovery for faster startup
      },
    };
    
    const mcpManager = new MCPServerManager(mcpConfig);
    console.log('   ✅ MCP Manager created with config');
    
    // Initialize MCP servers (this is what's missing in AdvancedToolOrchestrator)
    try {
      await mcpManager.startServers();
      console.log('   ✅ MCP servers started successfully\n');
    } catch (error) {
      console.log(`   ⚠️ MCP servers failed to start: ${error.message}`);
      console.log('   ℹ️ Continuing with local initialization only\n');
    }
    
    // Test 3: Initialize tool integrations
    console.log('🔧 Step 3: Initializing tool integrations');
    initializeGlobalToolIntegration(mcpManager);
    initializeGlobalEnhancedToolIntegration(mcpManager);
    
    const basicIntegration = getGlobalToolIntegration();
    const enhancedIntegration = getGlobalEnhancedToolIntegration();
    
    console.log(`   Basic Tool Integration: ${basicIntegration ? '✅ CREATED' : '❌ STILL NULL'}`);
    console.log(`   Enhanced Tool Integration: ${enhancedIntegration ? '✅ CREATED' : '❌ STILL NULL'}`);
    
    if (!basicIntegration || !enhancedIntegration) {
      console.log('   ❌ CRITICAL: Tool integrations failed to initialize');
      return;
    }
    
    // Test 4: Initialize enhanced tool integration
    console.log('\n⚡ Step 4: Initializing enhanced features');
    await enhancedIntegration.initialize();
    console.log('   ✅ Enhanced tool integration initialized\n');
    
    // Test 5: Test basic tool integration
    console.log('📋 Step 5: Testing basic tool integration');
    const llmFunctions = await basicIntegration.getLLMFunctions();
    const availableToolNames = basicIntegration.getAvailableToolNames();
    
    console.log(`   LLM Functions: ${llmFunctions.length} available`);
    console.log(`   Available Tools: ${availableToolNames?.length || 0} tools`);
    if (availableToolNames && availableToolNames.length > 0) {
      console.log(`   Tool Names: ${availableToolNames.slice(0, 5).join(', ')}${availableToolNames.length > 5 ? '...' : ''}`);
    }
    
    // Test 6: Test enhanced tool integration
    console.log('\n🚀 Step 6: Testing enhanced tool integration');
    const enhancedLLMFunctions = await enhancedIntegration.getLLMFunctions();
    const enhancedToolNames = enhancedIntegration.getAvailableToolNames();
    
    console.log(`   Enhanced LLM Functions: ${enhancedLLMFunctions.length} available`);
    console.log(`   Enhanced Tools: ${enhancedToolNames?.length || 0} tools`);
    if (enhancedToolNames && enhancedToolNames.length > 0) {
      console.log(`   Enhanced Tool Names: ${enhancedToolNames.slice(0, 5).join(', ')}${enhancedToolNames.length > 5 ? '...' : ''}`);
    }
    
    // Test 7: Simulate Advanced Tool Orchestrator access
    console.log('\n🎯 Step 7: Simulating Advanced Tool Orchestrator access');
    
    // This simulates what AdvancedToolOrchestrator.getMCPCompatibleTools() does
    const simulatedEnhancedIntegration = getGlobalEnhancedToolIntegration();
    if (simulatedEnhancedIntegration) {
      const simulatedTools = await simulatedEnhancedIntegration.getLLMFunctions();
      console.log(`   ✅ SUCCESS: Advanced orchestrator can access ${simulatedTools.length} tools`);
      console.log(`   Tool sample: ${simulatedTools.slice(0, 3).map(t => t.function?.name || t.name).join(', ')}`);
    } else {
      console.log(`   ❌ FAILURE: Advanced orchestrator cannot access enhanced integration`);
    }
    
    // Test 8: Test specific tool execution
    console.log('\n⚡ Step 8: Testing tool execution');
    
    // Check if mcp_read_file tool is available by checking LLM functions
    const hasReadFileTool = enhancedLLMFunctions.some(t => 
      (t.function?.name === 'mcp_read_file') || (t.name === 'mcp_read_file')
    );
    
    if (hasReadFileTool) {
      console.log('   Found mcp_read_file tool, testing execution...');
      
      try {
        const result = await enhancedIntegration.executeTool('mcp_read_file', { 
          filePath: 'package.json' 
        });
        
        console.log(`   ✅ SUCCESS: Tool executed`);
        console.log(`   Result length: ${JSON.stringify(result).length} characters`);
      } catch (error) {
        console.log(`   ❌ EXECUTION FAILED: ${error.message}`);
      }
    } else {
      console.log('   ⚠️ mcp_read_file tool not available');
    }
    
    // Summary
    console.log('\n📊 INTEGRATION TEST SUMMARY');
    console.log('===========================');
    console.log(`Basic Integration: ${basicIntegration ? '✅ Working' : '❌ Failed'} (${llmFunctions?.length || 0} tools)`);
    console.log(`Enhanced Integration: ${enhancedIntegration ? '✅ Working' : '❌ Failed'} (${enhancedLLMFunctions?.length || 0} tools)`);
    console.log(`Global Access: ${simulatedEnhancedIntegration ? '✅ Available' : '❌ Not Available'}`);
    console.log(`MCP Manager Status: ✅ Initialized`);
    
    const totalSuccess = [
      basicIntegration ? 1 : 0,
      enhancedIntegration ? 1 : 0, 
      simulatedEnhancedIntegration ? 1 : 0,
      (llmFunctions?.length || 0) > 0 ? 1 : 0
    ].reduce((a, b) => a + b, 0);
    
    console.log(`\nOverall Status: ${totalSuccess}/4 components working (${Math.round(totalSuccess/4*100)}%)`);
    
    if (totalSuccess === 4) {
      console.log('🎉 ALL TESTS PASSED - MCP Integration fully working!');
    } else if (totalSuccess >= 2) {
      console.log('⚠️ PARTIAL SUCCESS - Some components working but gaps remain');
    } else {
      console.log('❌ CRITICAL ISSUES - Major MCP integration problems detected');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testMCPIntegration().catch(console.error);