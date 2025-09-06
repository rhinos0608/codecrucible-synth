#!/usr/bin/env node
/**
 * Full MCP Integration Test - All Servers Enabled
 * Tests complete MCP claim validation
 */

console.log('🔬 COMPREHENSIVE MCP INTEGRATION VALIDATION');
console.log('==========================================\n');

const path = require('path');
const { MCPServerManager } = require('./dist/mcp-servers/mcp-server-manager.js');

// Full configuration with all servers enabled
const fullConfig = {
  filesystem: {
    enabled: true,
    restrictedPaths: ['/etc', '/bin', '/usr/bin'],
    allowedPaths: [],
  },
  git: {
    enabled: true,
    autoCommitMessages: false,
    safeModeEnabled: true,
  },
  terminal: {
    enabled: true,
    allowedCommands: ['git', 'ls', 'pwd', 'echo', 'node', 'npm'],
    blockedCommands: ['rm', 'sudo', 'del'],
  },
  packageManager: {
    enabled: true,
    autoInstall: false,
    securityScan: true,
  },
  smithery: {
    enabled: false, // Keep disabled for now - no API key
  },
};

async function comprehensiveTest() {
  console.log('🚀 Starting Comprehensive MCP Test...\n');

  const results = {
    timestamp: new Date().toISOString(),
    claimsValidation: {},
    actualCapabilities: {},
    performanceMetrics: {},
  };

  try {
    // Create manager with full config
    const manager = new MCPServerManager(fullConfig);

    // Test 1: Server Initialization
    console.log('1️⃣ Testing Full Server Initialization...');
    const startTime = Date.now();

    await manager.initialize();
    await manager.startServers();

    const initTime = Date.now() - startTime;
    results.performanceMetrics.initializationTime = initTime;

    console.log(`   ⏱️ Initialization time: ${initTime}ms`);

    const servers = manager.getServerStatus();
    const runningServers = servers.filter(s => s.status === 'running');

    console.log(`   📊 Total servers: ${servers.length}`);
    console.log(`   ✅ Running servers: ${runningServers.length}`);

    results.actualCapabilities.totalServers = servers.length;
    results.actualCapabilities.runningServers = runningServers.length;

    for (const server of servers) {
      console.log(`      • ${server.name}: ${server.status} (enabled: ${server.enabled})`);
    }

    // Test 2: Tool Discovery for All Servers
    console.log('\n2️⃣ Discovering Tools Across All Servers...');

    let totalTools = 0;
    const serverTools = {};

    for (const server of servers) {
      if (server.status === 'running') {
        console.log(`   🔍 ${server.name} server tools:`);

        const capabilities = await manager.discoverServerCapabilities(server.id);

        if (capabilities) {
          const toolCount = capabilities.tools.length;
          totalTools += toolCount;
          serverTools[server.name] = {
            count: toolCount,
            tools: capabilities.tools.map(t => ({
              name: t.name,
              description: t.description,
            })),
          };

          console.log(`      ✅ Found ${toolCount} tools`);
          capabilities.tools.forEach(tool => {
            console.log(`         • ${tool.name}: ${tool.description}`);
          });
        } else {
          serverTools[server.name] = { count: 0, tools: [] };
          console.log(`      ❌ No capabilities discovered`);
        }
      } else {
        serverTools[server.name] = { count: 0, tools: [], status: server.status };
        console.log(`   ⚠️ ${server.name}: Not running (${server.status})`);
      }
    }

    results.actualCapabilities.totalTools = totalTools;
    results.actualCapabilities.serverTools = serverTools;

    console.log(`\n   📊 TOTAL TOOLS DISCOVERED: ${totalTools}`);

    // Test 3: Health Monitoring
    console.log('\n3️⃣ Health Check Analysis...');

    const healthCheck = await manager.healthCheck();
    results.actualCapabilities.healthStatus = healthCheck;

    Object.entries(healthCheck).forEach(([name, status]) => {
      console.log(`   📋 ${name}:`);
      console.log(`      • Status: ${status.status}`);
      console.log(`      • Enabled: ${status.enabled}`);
      if (status.capabilities) {
        console.log(`      • Tools: ${status.capabilities.toolCount}`);
        console.log(`      • Resources: ${status.capabilities.resourceCount}`);
      }
      if (status.performance) {
        console.log(`      • Avg Response: ${Math.round(status.performance.avgResponseTime)}ms`);
        console.log(`      • Success Rate: ${(status.performance.successRate * 100).toFixed(1)}%`);
      }
    });

    // Test 4: Functional Testing
    console.log('\n4️⃣ Functional Testing...');

    const functionalTests = {};

    // Test filesystem operations
    if (serverTools.filesystem?.count > 0) {
      console.log('   🗂️ Testing filesystem operations...');
      try {
        const stats = await manager.getFileStats('./package.json');
        functionalTests.filesystem = {
          success: true,
          result: `package.json exists: ${stats.exists}, size: ${stats.size} bytes`,
        };
        console.log(`      ✅ File stats retrieved: ${stats.size} bytes`);
      } catch (error) {
        functionalTests.filesystem = { success: false, error: error.message };
        console.log(`      ❌ Filesystem test failed: ${error.message}`);
      }
    }

    // Test terminal operations
    if (serverTools.terminal?.count > 0) {
      console.log('   💻 Testing terminal operations...');
      try {
        const result = await manager.executeCommandSecure('echo', ['MCP Terminal Test']);
        functionalTests.terminal = {
          success: true,
          result: result.trim(),
        };
        console.log(`      ✅ Terminal command executed: "${result.trim()}"`);
      } catch (error) {
        functionalTests.terminal = { success: false, error: error.message };
        console.log(`      ❌ Terminal test failed: ${error.message}`);
      }
    }

    // Test git operations (if in git repo)
    if (serverTools.git?.count > 0) {
      console.log('   📋 Testing git operations...');
      try {
        const status = await manager.gitStatus();
        functionalTests.git = {
          success: true,
          result:
            status.length > 0 ? `${status.split('\n').length} status lines` : 'Clean working tree',
        };
        console.log(`      ✅ Git status retrieved`);
      } catch (error) {
        functionalTests.git = { success: false, error: error.message };
        console.log(`      ❌ Git test failed: ${error.message.slice(0, 50)}...`);
      }
    }

    results.actualCapabilities.functionalTests = functionalTests;

    return results;
  } catch (error) {
    console.log(`\n💥 Comprehensive test failed: ${error.message}`);
    results.error = error.message;
    return results;
  }
}

async function validateClaims(results) {
  console.log('\n🎯 VALIDATING DOCUMENTED CLAIMS');
  console.log('===============================\n');

  const claims = {
    '21 LLM functions available': false,
    '8 external MCP tools connected successfully': false,
    'Terminal Controller: Connected with 10 tools': false,
    'Remote Shell: Connected with 1 tool': false,
    'Enhanced Tool Integration: Working perfectly': false,
    'External Smithery registry connections': false,
  };

  const evidence = {};

  // Validate tool counts
  const totalTools = results.actualCapabilities?.totalTools || 0;
  console.log(`📊 ACTUAL TOOL COUNT: ${totalTools}`);

  if (totalTools >= 21) {
    claims['21 LLM functions available'] = true;
    evidence['21 LLM functions available'] = `✅ Found ${totalTools} tools (exceeds claim)`;
  } else {
    evidence['21 LLM functions available'] = `❌ Found only ${totalTools} tools (claimed 21)`;
  }

  // Check terminal controller
  const terminalTools = results.actualCapabilities?.serverTools?.terminal?.count || 0;
  console.log(`💻 TERMINAL TOOLS: ${terminalTools}`);

  if (terminalTools >= 10) {
    claims['Terminal Controller: Connected with 10 tools'] = true;
    evidence['Terminal Controller: Connected with 10 tools'] =
      `✅ Found ${terminalTools} terminal tools`;
  } else {
    evidence['Terminal Controller: Connected with 10 tools'] =
      `❌ Found only ${terminalTools} terminal tools (claimed 10)`;
  }

  // Check external MCP connections
  const smitheryTools = results.actualCapabilities?.serverTools?.smithery?.count || 0;
  console.log(`🌐 EXTERNAL MCP TOOLS: ${smitheryTools}`);

  if (smitheryTools >= 8) {
    claims['8 external MCP tools connected successfully'] = true;
    evidence['8 external MCP tools connected successfully'] =
      `✅ Found ${smitheryTools} external tools`;
  } else {
    evidence['8 external MCP tools connected successfully'] =
      `❌ Found only ${smitheryTools} external tools (claimed 8)`;
  }

  // Check functional tests
  const functionalTests = results.actualCapabilities?.functionalTests || {};
  const successfulTests = Object.values(functionalTests).filter(t => t.success).length;
  const totalFunctionalTests = Object.keys(functionalTests).length;

  console.log(`🧪 FUNCTIONAL TESTS: ${successfulTests}/${totalFunctionalTests} passed`);

  if (successfulTests === totalFunctionalTests && totalFunctionalTests > 0) {
    claims['Enhanced Tool Integration: Working perfectly'] = true;
    evidence['Enhanced Tool Integration: Working perfectly'] =
      `✅ All ${totalFunctionalTests} functional tests passed`;
  } else {
    evidence['Enhanced Tool Integration: Working perfectly'] =
      `❌ Only ${successfulTests}/${totalFunctionalTests} functional tests passed`;
  }

  console.log('\n📋 CLAIM VALIDATION RESULTS:');
  console.log('============================');

  Object.entries(claims).forEach(([claim, validated]) => {
    const status = validated ? '✅ VALIDATED' : '❌ NOT VALIDATED';
    console.log(`${status}: ${claim}`);
    console.log(`   Evidence: ${evidence[claim]}`);
  });

  const validatedClaims = Object.values(claims).filter(v => v).length;
  const totalClaims = Object.keys(claims).length;

  console.log(`\n📊 VALIDATION SUMMARY: ${validatedClaims}/${totalClaims} claims validated`);

  return { claims, evidence, validatedClaims, totalClaims };
}

// Run comprehensive test
async function main() {
  try {
    const results = await comprehensiveTest();
    const validation = await validateClaims(results);

    console.log('\n🎯 FINAL ASSESSMENT');
    console.log('==================');
    console.log(`Timestamp: ${results.timestamp}`);
    console.log(
      `Initialization Time: ${results.performanceMetrics?.initializationTime || 'N/A'}ms`
    );
    console.log(`Total MCP Tools: ${results.actualCapabilities?.totalTools || 0}`);
    console.log(
      `Running Servers: ${results.actualCapabilities?.runningServers || 0}/${results.actualCapabilities?.totalServers || 0}`
    );
    console.log(`Claims Validated: ${validation.validatedClaims}/${validation.totalClaims}`);

    const validationPercentage = (
      (validation.validatedClaims / validation.totalClaims) *
      100
    ).toFixed(1);
    console.log(`Validation Rate: ${validationPercentage}%`);

    if (validation.validatedClaims === validation.totalClaims) {
      console.log('\n🎉 ALL CLAIMS VALIDATED - MCP integration is as documented');
    } else if (validation.validatedClaims > validation.totalClaims / 2) {
      console.log('\n⚠️ PARTIAL VALIDATION - MCP integration partially matches claims');
    } else {
      console.log('\n❌ CLAIMS NOT VALIDATED - MCP integration does not match documentation');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n💥 CRITICAL TEST FAILURE:', error.message);
    process.exit(1);
  }
}

main();
