#!/usr/bin/env node

/**
 * Test Script for Agent Loop Prevention Fixes
 * 
 * This script validates that the agent fixes are working correctly
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

// Test cases to validate fixes
const testCases = [
  {
    name: 'Loop Prevention Test',
    prompt: 'List files in the src directory',
    expectedBehavior: 'Should execute listFiles once and provide answer',
    maxIterations: 3
  },
  {
    name: 'Knowledge Extraction Test',
    prompt: 'What is the name and version of this project?',
    expectedBehavior: 'Should read package.json and extract project info',
    expectedKeywords: ['codecrucible', 'version']
  },
  {
    name: 'Completion Detection Test',
    prompt: 'Give me a quick overview of this codebase',
    expectedBehavior: 'Should complete within 5 iterations with meaningful summary',
    maxIterations: 5
  },
  {
    name: 'Tool Availability Test',
    prompt: 'Analyze the code structure',
    expectedBehavior: 'Should use available tools without "Unknown tool" errors',
    forbiddenPhrases: ['Unknown tool', 'Tool not found']
  }
];

async function runTest(testCase) {
  console.log(chalk.blue(`\n📝 Running: ${testCase.name}`));
  console.log(chalk.gray(`   Prompt: "${testCase.prompt}"`));
  console.log(chalk.gray(`   Expected: ${testCase.expectedBehavior}`));
  
  try {
    // Create a test file with the prompt
    const testScript = `
      const { initializeCLIContext } = require('./dist/index.js');
      const { ReActAgent } = require('./dist/core/react-agent.js');
      
      async function test() {
        const context = await initializeCLIContext();
        const agent = new ReActAgent(context, process.cwd());
        
        const startTime = Date.now();
        const result = await agent.processRequest("${testCase.prompt}");
        const duration = Date.now() - startTime;
        
        console.log('RESULT_START');
        console.log(JSON.stringify({
          result: result.slice(0, 500),
          duration,
          iterations: agent.getAgentContext().currentIteration
        }));
        console.log('RESULT_END');
      }
      
      test().catch(console.error);
    `;
    
    // Write and execute test
    await require('fs').promises.writeFile('test-agent-temp.js', testScript);
    const { stdout, stderr } = await execAsync('node test-agent-temp.js', { 
      timeout: 30000 
    });
    
    // Parse results
    const resultMatch = stdout.match(/RESULT_START\n(.*)\nRESULT_END/s);
    if (resultMatch) {
      const resultData = JSON.parse(resultMatch[1]);
      
      // Validate test expectations
      let passed = true;
      const issues = [];
      
      if (testCase.maxIterations && resultData.iterations > testCase.maxIterations) {
        passed = false;
        issues.push(`Too many iterations: ${resultData.iterations} > ${testCase.maxIterations}`);
      }
      
      if (testCase.expectedKeywords) {
        for (const keyword of testCase.expectedKeywords) {
          if (!resultData.result.toLowerCase().includes(keyword.toLowerCase())) {
            passed = false;
            issues.push(`Missing expected keyword: "${keyword}"`);
          }
        }
      }
      
      if (testCase.forbiddenPhrases) {
        for (const phrase of testCase.forbiddenPhrases) {
          if (resultData.result.includes(phrase)) {
            passed = false;
            issues.push(`Contains forbidden phrase: "${phrase}"`);
          }
        }
      }
      
      // Report results
      if (passed) {
        console.log(chalk.green(`   ✅ PASSED`));
        console.log(chalk.gray(`      Iterations: ${resultData.iterations}`));
        console.log(chalk.gray(`      Duration: ${resultData.duration}ms`));
      } else {
        console.log(chalk.red(`   ❌ FAILED`));
        issues.forEach(issue => console.log(chalk.red(`      - ${issue}`)));
      }
      
      return passed;
    } else {
      console.log(chalk.red(`   ❌ FAILED - Could not parse output`));
      return false;
    }
    
  } catch (error) {
    console.log(chalk.red(`   ❌ ERROR: ${error.message}`));
    return false;
  } finally {
    // Cleanup
    try {
      await require('fs').promises.unlink('test-agent-temp.js');
    } catch {}
  }
}

async function runAllTests() {
  console.log(chalk.cyan('🧪 CodeCrucible Agent Fix Validation\n'));
  console.log(chalk.gray('This will test that the agent fixes are working correctly.\n'));
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (const testCase of testCases) {
    const passed = await runTest(testCase);
    if (passed) passedCount++;
    else failedCount++;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log(chalk.cyan('\n📊 Test Summary'));
  console.log(chalk.green(`   ✅ Passed: ${passedCount}`));
  console.log(chalk.red(`   ❌ Failed: ${failedCount}`));
  
  if (failedCount === 0) {
    console.log(chalk.green('\n🎉 All tests passed! The agent fixes are working correctly.'));
  } else {
    console.log(chalk.yellow('\n⚠️ Some tests failed. Please review the fixes and try again.'));
    console.log(chalk.gray('   You may need to rebuild: npm run build'));
  }
}

// Check if project is built
async function checkBuild() {
  try {
    await require('fs').promises.access('./dist/index.js');
    return true;
  } catch {
    console.log(chalk.yellow('⚠️ Project not built. Building now...'));
    await execAsync('npm run build');
    return true;
  }
}

// Main execution
async function main() {
  try {
    // Ensure project is built
    await checkBuild();
    
    // Run tests
    await runAllTests();
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

main();
