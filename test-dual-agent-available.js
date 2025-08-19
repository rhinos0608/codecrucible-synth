#!/usr/bin/env node

/**
 * Test Dual-Agent System with Available Models
 */

import { DualAgentRealtimeSystem } from './dist/core/collaboration/dual-agent-realtime-system.js';
import chalk from 'chalk';
import ora from 'ora';

console.log(chalk.blue('╔══════════════════════════════════════════════════════════════╗'));
console.log(chalk.blue('║         Testing Dual-Agent with Available Models            ║'));
console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝'));
console.log();

async function testWithAvailableModels() {
  // Use available models from ollama list
  const dualAgent = new DualAgentRealtimeSystem({
    writer: {
      platform: 'ollama',
      model: 'llama3.2:latest',  // Available fast model
      endpoint: 'http://localhost:11434',
      temperature: 0.7,
      maxTokens: 2048,
      keepAlive: '24h'
    },
    auditor: {
      platform: 'lmstudio',
      model: 'gpt-oss:20b',  // Use larger model for auditing (could fallback to ollama)
      endpoint: 'http://localhost:1234/v1',
      temperature: 0.2,
      maxTokens: 1024,
      contextLength: 8192
    },
    enableRealTimeAudit: true,
    auditInBackground: true,
    autoApplyFixes: false
  });

  // Listen to events
  dualAgent.on('ready', () => {
    console.log(chalk.green('✅ Dual-agent system ready'));
  });

  dualAgent.on('code:generated', (event) => {
    console.log(chalk.cyan(`⚡ Code generated in ${event.time}ms`));
  });

  dualAgent.on('audit:complete', (audit) => {
    console.log(chalk.yellow('\n🔍 Audit Results:'));
    console.log(chalk.gray(`   Score: ${audit.score}/100`));
    console.log(chalk.gray(`   Issues: ${audit.issues.length}`));
    console.log(chalk.gray(`   Confidence: ${(audit.confidence * 100).toFixed(1)}%`));
  });

  dualAgent.on('health:checked', (health) => {
    console.log(chalk.gray('Platform Health:'));
    console.log(chalk.gray(`   Writer (Ollama): ${health.ollama ? '✅' : '❌'}`));
    console.log(chalk.gray(`   Auditor: ${health.lmStudio ? '✅ LM Studio' : '⚠️ Fallback to Ollama'}`));
  });

  console.log(chalk.bold('🧪 Test 1: Simple Function Generation'));
  const spinner1 = ora('Generating function...').start();
  
  try {
    const result1 = await dualAgent.generateWithAudit(
      'Create a TypeScript function that validates email addresses using regex',
      {
        language: 'typescript',
        requirements: 'Include proper error handling and return type'
      }
    );
    
    spinner1.succeed('Function generated');
    
    console.log(chalk.green('\n📝 Generated Code:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(result1.code);
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.cyan('\n⏱️ Performance:'));
    console.log(chalk.gray(`   Generation: ${result1.performance.generationTime}ms`));
    console.log(chalk.gray(`   Total: ${result1.performance.totalTime}ms`));
    
    if (result1.audit) {
      console.log(chalk.yellow('\n🔍 Audit Summary:'));
      console.log(chalk.gray(`   Quality Score: ${result1.audit.score}/100`));
      console.log(chalk.gray(`   Issues Found: ${result1.audit.issues.length}`));
    }
    
  } catch (error) {
    spinner1.fail(`Test 1 failed: ${error.message}`);
  }

  console.log(chalk.bold('\n🧪 Test 2: Streaming Generation'));
  
  try {
    console.log(chalk.cyan('\n🌊 Streaming output:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    let charCount = 0;
    for await (const chunk of dualAgent.streamGenerateWithAudit(
      'Create a React component with useState for a counter'
    )) {
      if (chunk.type === 'code_chunk') {
        process.stdout.write(chunk.content);
        charCount += chunk.content.length;
      } else if (chunk.type === 'complete') {
        console.log();
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.green(`✅ Streaming complete (${charCount} characters in ${chunk.time}ms)`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Streaming test failed: ${error.message}`));
  }

  // Test system metrics
  console.log(chalk.bold('\n📊 System Status:'));
  const metrics = dualAgent.getMetrics();
  console.log(chalk.gray(`Writer Status: ${metrics.writerStatus}`));
  console.log(chalk.gray(`Auditor Status: ${metrics.auditorStatus}`));
  console.log(chalk.gray(`Platform: ${metrics.platforms.ollama.model}`));

  await dualAgent.shutdown();
  console.log(chalk.green('\n✅ Test completed'));
}

async function main() {
  try {
    await testWithAvailableModels();
    console.log(chalk.blue('\n🎉 Dual-agent functionality test complete!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    process.exit(1);
  }
}

main().catch(console.error);