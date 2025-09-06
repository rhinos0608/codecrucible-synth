#!/usr/bin/env node

/**
 * Diagnostic Test for Tool Loading Issues
 * This script tests the tool orchestrator and MCP integration to identify why tools aren't loading
 */

import { UnifiedModelClient } from './dist/application/services/model-client.js';
import { AdvancedToolOrchestrator } from './dist/core/tools/advanced-tool-orchestrator.js';
import { MCPServerManager } from './dist/mcp-servers/mcp-server-manager.js';

console.log('🔍 Starting Tool Loading Diagnostic...\n');

async function testToolLoading() {
  try {
    // Test 1: AdvancedToolOrchestrator
    console.log('1️⃣ Testing AdvancedToolOrchestrator...');
    const mockModelClient = new UnifiedModelClient({});
    const toolOrchestrator = new AdvancedToolOrchestrator(mockModelClient);
    const availableTools = toolOrchestrator.getAvailableTools();
    console.log(`   ✅ Local tools count: ${availableTools.length}`);
    if (availableTools.length > 0) {
      console.log(`   📋 Tool names: ${availableTools.map(t => t.name || 'unnamed').join(', ')}`);
    } else {
      console.log('   ❌ No local tools found');
    }

    // Test 2: MCP Tool Integration
    console.log('\n2️⃣ Testing MCP Tool Integration...');
    try {
      const { getGlobalEnhancedToolIntegration } = await import(
        './dist/core/tools/enhanced-tool-integration.js'
      );
      const enhancedToolIntegration = getGlobalEnhancedToolIntegration();

      if (enhancedToolIntegration) {
        const mcpTools = await enhancedToolIntegration.getLLMFunctions();
        console.log(`   ✅ Enhanced MCP tools count: ${mcpTools.length}`);
        if (mcpTools.length > 0) {
          console.log(
            `   📋 MCP tool names: ${mcpTools
              .map(t => t.name || 'unnamed')
              .slice(0, 5)
              .join(', ')}${mcpTools.length > 5 ? '...' : ''}`
          );
        }
      } else {
        console.log('   ❌ Enhanced tool integration not initialized');
      }
    } catch (error) {
      console.log(`   ❌ Enhanced tool integration import failed: ${error.message}`);
    }

    // Test 3: Fallback Tool Integration
    console.log('\n3️⃣ Testing Fallback Tool Integration...');
    try {
      const { getGlobalToolIntegration } = await import('./dist/core/tools/tool-integration.js');
      const toolIntegration = getGlobalToolIntegration();

      if (toolIntegration && typeof toolIntegration.getLLMFunctions === 'function') {
        const fallbackTools = toolIntegration.getLLMFunctions();
        console.log(`   ✅ Fallback tools count: ${fallbackTools.length}`);
        if (fallbackTools.length > 0) {
          console.log(
            `   📋 Fallback tool names: ${fallbackTools
              .map(t => t.name || 'unnamed')
              .slice(0, 5)
              .join(', ')}${fallbackTools.length > 5 ? '...' : ''}`
          );
        }
      } else {
        console.log('   ❌ Fallback tool integration not properly initialized');
      }
    } catch (error) {
      console.log(`   ❌ Fallback tool integration import failed: ${error.message}`);
    }

    // Test 4: MCP Server Manager
    console.log('\n4️⃣ Testing MCP Server Manager...');
    try {
      const mcpManager = new MCPServerManager();
      const serverStatus = await mcpManager.getStatus();
      console.log(`   📊 MCP Server Status:`, serverStatus);

      // Check if servers are actually connected
      const servers = mcpManager.getConnectedServers();
      console.log(`   🔗 Connected MCP servers: ${servers ? servers.length : 0}`);
    } catch (error) {
      console.log(`   ❌ MCP Server Manager failed: ${error.message}`);
    }
  } catch (error) {
    console.error('❌ Diagnostic test failed:', error);
  }
}

// Summary function to determine the issue
function provideDiagnosticSummary() {
  console.log('\n📋 DIAGNOSTIC SUMMARY:');
  console.log('   Based on the results above, the issue is likely:');
  console.log('   1. Tool orchestrator not properly initializing tools');
  console.log('   2. MCP integration modules failing to import');
  console.log('   3. MCP servers not connecting or not providing tools');
  console.log('   4. Tool integration singletons not being initialized');
  console.log('\n🔧 RECOMMENDED FIX:');
  console.log('   - Check tool orchestrator initialization in CLI constructor');
  console.log('   - Verify MCP server manager is started during CLI initialization');
  console.log('   - Check for import/module resolution issues');
  console.log('   - Ensure tool integration singletons are properly initialized');
}

// Run the test
testToolLoading()
  .then(() => {
    provideDiagnosticSummary();
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    provideDiagnosticSummary();
  });
