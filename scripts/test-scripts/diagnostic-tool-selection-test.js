/**
 * Tool Selection Intelligence Diagnostic Test
 * Tests CodeCrucible's ability to intelligently select and use tools
 */

import { DomainAwareToolOrchestrator } from './dist/core/tools/domain-aware-tool-orchestrator.js';
import { AdvancedToolOrchestrator } from './dist/core/tools/advanced-tool-orchestrator.js';
import { UnifiedModelClient } from './dist/application/services/model-client.js';

const testPrompts = [
  // File analysis tasks
  {
    prompt: 'Read the README.md file and tell me what this project is about',
    expectedDomain: 'coding',
    expectedTools: ['filesystem_read_file', 'mcp_read_file'],
    description: 'File reading task - should select file system tools',
  },

  // Research tasks
  {
    prompt:
      'Research the latest trends in AI CLI tools and find documentation about best practices',
    expectedDomain: 'research',
    expectedTools: ['filesystem_find_files', 'mcp_read_file'],
    description: 'Research task - should select research and file finding tools',
  },

  // System administration tasks
  {
    prompt: 'Show me the current system status and running processes',
    expectedDomain: 'system',
    expectedTools: ['mcp_execute_command'],
    description: 'System task - should select command execution tools',
  },

  // Mixed complexity tasks
  {
    prompt: 'Analyze the codebase structure, read the main files, and create a project summary',
    expectedDomain: 'mixed',
    expectedTools: ['filesystem_read_file', 'filesystem_list_directory', 'filesystem_find_files'],
    description: 'Complex multi-step task - should select multiple tool categories',
  },
];

console.log('🧪 CODECRUCIBLE TOOL SELECTION INTELLIGENCE DIAGNOSTIC');
console.log('====================================================');

async function runDiagnostic() {
  // Initialize domain orchestrator
  const domainOrchestrator = new DomainAwareToolOrchestrator();

  // Mock available tools (simulating MCP tools)
  const mockTools = [
    {
      function: { name: 'filesystem_read_file' },
      name: 'filesystem_read_file',
      description: 'Read file contents',
    },
    {
      function: { name: 'filesystem_write_file' },
      name: 'filesystem_write_file',
      description: 'Write file contents',
    },
    {
      function: { name: 'filesystem_list_directory' },
      name: 'filesystem_list_directory',
      description: 'List directory contents',
    },
    {
      function: { name: 'filesystem_find_files' },
      name: 'filesystem_find_files',
      description: 'Find files by pattern',
    },
    {
      function: { name: 'mcp_execute_command' },
      name: 'mcp_execute_command',
      description: 'Execute system commands',
    },
    {
      function: { name: 'mcp_read_file' },
      name: 'mcp_read_file',
      description: 'Read files via MCP',
    },
    {
      function: { name: 'mcp_list_directory' },
      name: 'mcp_list_directory',
      description: 'List directories via MCP',
    },
    {
      function: { name: 'mcp_plan_request' },
      name: 'mcp_plan_request',
      description: 'Create task plans',
    },
    {
      function: { name: 'mcp_get_next_task' },
      name: 'mcp_get_next_task',
      description: 'Get next task from plan',
    },
  ];

  console.log(`📊 Testing with ${mockTools.length} available tools\n`);

  let passCount = 0;
  let totalTests = 0;

  for (const test of testPrompts) {
    totalTests++;
    console.log(`🔍 Test ${totalTests}: ${test.description}`);
    console.log(`   Prompt: "${test.prompt}"`);
    console.log(`   Expected domain: ${test.expectedDomain}`);
    console.log(`   Expected tools: ${test.expectedTools.join(', ')}`);

    try {
      // Test domain analysis
      const analysis = domainOrchestrator.analyzeDomain(test.prompt);
      console.log(
        `   ✓ Detected domain: ${analysis.primaryDomain} (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`
      );

      // Test tool selection
      const toolResult = domainOrchestrator.getToolsForPrompt(test.prompt, mockTools);
      const selectedToolNames = toolResult.tools.map(t => t.function?.name || t.name);

      console.log(
        `   ✓ Selected ${selectedToolNames.length} tools: ${selectedToolNames.join(', ')}`
      );
      console.log(`   ✓ Reasoning: ${toolResult.reasoning}`);

      // Evaluate results
      let domainMatch =
        analysis.primaryDomain === test.expectedDomain || test.expectedDomain === 'mixed';
      let toolMatch = test.expectedTools.some(expectedTool =>
        selectedToolNames.includes(expectedTool)
      );

      if (domainMatch && toolMatch && selectedToolNames.length > 0) {
        console.log(`   ✅ PASS - Intelligent tool selection working correctly`);
        passCount++;
      } else {
        console.log(`   ❌ FAIL - Tool selection issues detected`);
        if (!domainMatch)
          console.log(
            `      - Domain mismatch: expected ${test.expectedDomain}, got ${analysis.primaryDomain}`
          );
        if (!toolMatch) console.log(`      - No expected tools selected`);
        if (selectedToolNames.length === 0) console.log(`      - No tools selected at all`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR - ${error.message}`);
    }

    console.log('');
  }

  // Test Advanced Tool Orchestrator integration
  console.log('🚀 Testing Advanced Tool Orchestrator Integration');
  try {
    // Mock UnifiedModelClient for testing
    const mockModelClient = {
      generateText: async prompt => `Mock response for: ${prompt.substring(0, 50)}...`,
      synthesize: async options => ({
        content: `Mock synthesis for: ${options.prompt.substring(0, 50)}...`,
      }),
    };

    const advancedOrchestrator = new AdvancedToolOrchestrator(mockModelClient);

    // Test MCP tool integration
    const mcpTools = (await advancedOrchestrator.getMCPCompatibleTools?.()) || [];
    console.log(`   ✓ MCP Integration: ${mcpTools.length} tools available`);

    // Test tool selection for a complex prompt
    const complexPrompt = 'Analyze the project structure and create a detailed technical report';
    const toolCalls = await advancedOrchestrator.selectTools(complexPrompt, {
      sessionId: 'test',
      environment: { workingDirectory: process.cwd() },
      previousResults: [],
      constraints: {
        maxExecutionTime: 30000,
        maxMemoryUsage: 1000000,
        allowedNetworkAccess: false,
        sandboxed: true,
        costLimit: 100,
      },
      security: {
        permissions: ['read'],
        restrictions: [],
        auditLog: false,
        encryptionRequired: false,
      },
    });

    console.log(`   ✓ Advanced Selection: ${toolCalls.length} tool calls generated`);
    toolCalls.forEach((call, i) => {
      console.log(`      ${i + 1}. ${call.toolId} with priority ${call.priority}`);
    });

    if (toolCalls.length > 0) {
      passCount++;
      console.log(`   ✅ PASS - Advanced tool orchestrator working correctly`);
    } else {
      console.log(`   ❌ FAIL - Advanced orchestrator not generating tool calls`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR - Advanced orchestrator failed: ${error.message}`);
  }

  totalTests++; // Include advanced orchestrator test

  // Summary
  console.log('\n📊 DIAGNOSTIC SUMMARY');
  console.log('====================');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Tests passed: ${passCount}`);
  console.log(`Tests failed: ${totalTests - passCount}`);
  console.log(`Success rate: ${((passCount / totalTests) * 100).toFixed(1)}%`);

  if (passCount === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED - Tool selection intelligence is working correctly!');
  } else if (passCount / totalTests >= 0.8) {
    console.log(
      '\n✅ MOSTLY PASSING - Tool selection has minor issues but core functionality works'
    );
  } else if (passCount / totalTests >= 0.5) {
    console.log(
      '\n⚠️ PARTIAL FUNCTIONALITY - Tool selection has significant issues requiring fixes'
    );
  } else {
    console.log('\n❌ CRITICAL ISSUES - Tool selection intelligence needs major repairs');
  }
}

// Run the diagnostic
runDiagnostic().catch(error => {
  console.error('Diagnostic failed:', error);
  process.exit(1);
});
