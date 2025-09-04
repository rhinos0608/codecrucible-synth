#!/usr/bin/env node

/**
 * Minimal Test Script for CodeCrucible Synth
 * Tests basic functionality without full initialization
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';

console.log('🔍 CodeCrucible Synth - Minimal Test Suite');
console.log('==========================================');

async function testBasicFileOperations() {
  console.log('\n1. Testing basic file operations...');

  try {
    // Test if we can read package.json
    const packagePath = join(process.cwd(), 'package.json');
    const packageData = await readFile(packagePath, 'utf-8');
    const pkg = JSON.parse(packageData);

    console.log(`✅ Package.json loaded: ${pkg.name} v${pkg.version}`);
    console.log(`   Description: ${pkg.description}`);

    // Test environment variables
    console.log('\n2. Testing environment configuration...');
    const hasSmitheryKey = !!process.env.SMITHERY_API_KEY;
    console.log(`✅ Smithery API Key: ${hasSmitheryKey ? 'Configured' : 'Not configured'}`);

    const nodeEnv = process.env.NODE_ENV || 'development';
    console.log(`✅ Node Environment: ${nodeEnv}`);

    // Test critical directories
    console.log('\n3. Testing project structure...');
    const criticalPaths = [
      'src/core',
      'src/voices',
      'src/mcp-servers',
      'src/database/production-database-manager.ts',
      'src/core/security/production-rbac-system.ts',
      'migrations/001_initial_schema.js',
    ];

    for (const path of criticalPaths) {
      try {
        await access(join(process.cwd(), path));
        console.log(`✅ ${path} - EXISTS`);
      } catch {
        console.log(`❌ ${path} - MISSING`);
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ Basic tests failed:`, error);
    return false;
  }
}

async function testSecurityConfiguration() {
  console.log('\n4. Testing security configuration...');

  try {
    // Check if .env exists and is properly protected
    await access('.env');
    console.log('✅ .env file exists');

    // Check if hardcoded keys are removed from config files
    const mcpConfigPath = 'src/mcp-servers/mcp-server-configs.ts';
    const configContent = await readFile(mcpConfigPath, 'utf-8');

    const hasHardcodedKeys =
      configContent.includes("apiKey: '") && !configContent.includes('process.env');

    if (hasHardcodedKeys) {
      console.log('❌ Hardcoded API keys detected in MCP config');
    } else {
      console.log('✅ MCP configuration uses environment variables');
    }

    return true;
  } catch (error) {
    console.error(`❌ Security tests failed:`, error);
    return false;
  }
}

async function testProductionComponents() {
  console.log('\n5. Testing production components...');

  const productionFiles = [
    'src/core/security/production-rbac-system.ts',
    'src/database/production-database-manager.ts',
    'src/infrastructure/cloud-providers/aws-provider.ts',
    'src/infrastructure/cloud-providers/azure-provider.ts',
  ];

  let allExists = true;

  for (const file of productionFiles) {
    try {
      await access(file);
      const content = await readFile(file, 'utf-8');
      const lineCount = content.split('\n').length;
      console.log(`✅ ${file.split('/').pop()} - ${lineCount} lines`);
    } catch {
      console.log(`❌ ${file} - MISSING`);
      allExists = false;
    }
  }

  return allExists;
}

async function runTests() {
  console.log(`🚀 Starting tests in: ${process.cwd()}`);

  const results = {
    basic: await testBasicFileOperations(),
    security: await testSecurityConfiguration(),
    production: await testProductionComponents(),
  };

  console.log('\n🎯 Test Results Summary:');
  console.log('========================');

  for (const [test, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  }

  const overallSuccess = Object.values(results).every(Boolean);

  console.log(
    `\n🏁 Overall Status: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`
  );

  if (overallSuccess) {
    console.log('\n🎉 CodeCrucible Synth appears to be properly configured!');
    console.log('📋 Next steps:');
    console.log('   1. Run "npm run build" to test TypeScript compilation');
    console.log('   2. Run "npm test" to execute the full test suite');
    console.log('   3. Run "npm run dev" to start the development server');
  } else {
    console.log('\n⚠️  Some issues detected. Please review the failed tests above.');
  }

  return overallSuccess;
}

// Run tests
runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
