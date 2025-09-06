#!/usr/bin/env node

/**
 * Quick Multi-Step Problem Solving Test
 * Agent 2: Focused test for multi-step capabilities
 */

import { spawn } from 'child_process';

console.log('🧪 AGENT 2: Quick Multi-Step Problem Solving Test');
console.log('='.repeat(50));

const testCommand =
  'node dist/index.js "Break down this task into 3 clear steps: Analyze the package.json file, identify the main dependencies, and suggest one improvement. For each step, provide specific actions and expected outcomes."';

console.log('Command:', testCommand);
console.log('⏱️ Starting test with 2-minute timeout...');

const startTime = Date.now();

const child = spawn('node', testCommand.split(' ').slice(1), {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  cwd: process.cwd(),
});

let stdout = '';
let stderr = '';

child.stdout?.on('data', data => {
  stdout += data.toString();
  process.stdout.write(data);
});

child.stderr?.on('data', data => {
  stderr += data.toString();
  process.stderr.write(data);
});

child.on('close', code => {
  const duration = Date.now() - startTime;

  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS:');
  console.log('='.repeat(50));

  console.log(`⏱️ Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`✅ Exit Code: ${code}`);
  console.log(`📝 Output Length: ${stdout.length} characters`);

  // Analyze multi-step capabilities
  const hasSteps = /step \d+|1\.|2\.|3\./gi.test(stdout);
  const hasImplementation = /analyze|identify|suggest/gi.test(stdout);
  const hasStructure = /#{1,3}|\*\*|\d+\./.test(stdout);
  const hasSpecifics = /package\.json|dependencies|improvement/gi.test(stdout);

  console.log('\n🔍 MULTI-STEP ANALYSIS:');
  console.log(`📋 Has Sequential Steps: ${hasSteps ? '✅' : '❌'}`);
  console.log(`🛠️ Has Implementation Details: ${hasImplementation ? '✅' : '❌'}`);
  console.log(`📚 Has Clear Structure: ${hasStructure ? '✅' : '❌'}`);
  console.log(`🎯 Has Specific Actions: ${hasSpecifics ? '✅' : '❌'}`);

  const successCount = [hasSteps, hasImplementation, hasStructure, hasSpecifics].filter(
    Boolean
  ).length;
  const successRate = (successCount / 4) * 100;

  console.log(`\n🏆 Multi-Step Capability Score: ${successCount}/4 (${successRate.toFixed(1)}%)`);

  if (successRate >= 75) {
    console.log('🎉 EXCELLENT: Strong multi-step problem solving capabilities');
  } else if (successRate >= 50) {
    console.log('👍 GOOD: Decent multi-step capabilities with room for improvement');
  } else {
    console.log('⚠️ NEEDS WORK: Multi-step problem solving needs enhancement');
  }

  process.exit(code);
});

// 2-minute timeout
setTimeout(() => {
  child.kill();
  console.log('\n⏰ Test timed out after 2 minutes');
  console.log('📊 This indicates performance optimization is needed for multi-step workflows');
  process.exit(1);
}, 120000);
