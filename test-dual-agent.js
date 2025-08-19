#!/usr/bin/env node

/**
 * Test Dual-Agent Real-Time Code Review System
 * DeepSeek 8B (Ollama) + 20B Model (LM Studio)
 */

import { DualAgentRealtimeSystem } from './dist/core/collaboration/dual-agent-realtime-system.js';
import chalk from 'chalk';
import ora from 'ora';

console.log(chalk.blue('╔══════════════════════════════════════════════════════════════╗'));
console.log(chalk.blue('║      Dual-Agent Real-Time Code Review System Test           ║'));
console.log(chalk.blue('║    DeepSeek 8B (Ollama) + 20B Auditor (LM Studio)          ║'));
console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝'));
console.log();

async function testDualAgentSystem() {
  const dualAgent = new DualAgentRealtimeSystem({
    writer: {
      platform: 'ollama',
      model: 'deepseek-coder:8b',  // Or use llama2 for testing
      endpoint: 'http://localhost:11434',
      temperature: 0.7,
      maxTokens: 2048,
      keepAlive: '24h'
    },
    auditor: {
      platform: 'lmstudio',
      model: 'openai-20b-instruct',  // Configure based on your LM Studio model
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
    console.log(chalk.green('✅ Dual-agent system initialized'));
  });

  dualAgent.on('code:generated', (event) => {
    console.log(chalk.cyan(`\n⚡ Code generated in ${event.time}ms`));
  });

  dualAgent.on('audit:complete', (audit) => {
    console.log(chalk.yellow('\n🔍 Audit Complete:'));
    console.log(chalk.gray(`   Score: ${audit.score}/100`));
    console.log(chalk.gray(`   Issues: ${audit.issues.length}`));
    console.log(chalk.gray(`   Security Warnings: ${audit.securityWarnings.length}`));
    
    if (audit.issues.length > 0) {
      console.log(chalk.yellow('\n📋 Issues Found:'));
      audit.issues.forEach(issue => {
        const color = issue.severity === 'critical' ? chalk.red :
                      issue.severity === 'error' ? chalk.magenta :
                      issue.severity === 'warning' ? chalk.yellow :
                      chalk.gray;
        console.log(color(`   [${issue.severity.toUpperCase()}] ${issue.description}`));
        if (issue.fix) {
          console.log(chalk.green(`      Fix: ${issue.fix}`));
        }
      });
    }
    
    if (audit.suggestions.length > 0) {
      console.log(chalk.blue('\n💡 Suggestions:'));
      audit.suggestions.forEach(suggestion => {
        console.log(chalk.blue(`   [${suggestion.priority}] ${suggestion.description}`));
      });
    }
  });

  dualAgent.on('code:refined', (refinedCode) => {
    console.log(chalk.green('\n✨ Code refined with audit fixes applied'));
  });

  dualAgent.on('health:checked', (health) => {
    console.log(chalk.gray('\nPlatform Status:'));
    console.log(chalk.gray(`   Ollama (Writer): ${health.ollama ? '✅' : '❌'}`));
    console.log(chalk.gray(`   LM Studio (Auditor): ${health.lmStudio ? '✅' : '❌'}`));
  });

  // Test Case 1: JWT Authentication Middleware
  console.log(chalk.bold('\n📝 Test 1: JWT Authentication Middleware'));
  console.log(chalk.gray('Request: Create secure JWT authentication middleware'));
  
  const spinner1 = ora('Generating code...').start();
  
  try {
    const result1 = await dualAgent.generateWithAudit(
      'Create a secure JWT authentication middleware for Express.js with refresh token support',
      {
        language: 'typescript',
        framework: 'express',
        requirements: 'Include rate limiting, token rotation, and secure cookie handling'
      }
    );
    
    spinner1.succeed('Code generated successfully');
    
    console.log(chalk.green('\n📄 Generated Code:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(result1.code.substring(0, 500) + '...');  // Show first 500 chars
    console.log(chalk.gray('─'.repeat(60)));
    
    console.log(chalk.cyan('\n⏱️  Performance:'));
    console.log(chalk.gray(`   Generation: ${result1.performance.generationTime}ms`));
    console.log(chalk.gray(`   Audit: ${result1.performance.auditTime || 'in progress'}ms`));
    console.log(chalk.gray(`   Total: ${result1.performance.totalTime}ms`));
    
  } catch (error) {
    spinner1.fail(`Test 1 failed: ${error.message}`);
  }

  // Wait for background audit to complete
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test Case 2: Database Connection Pool
  console.log(chalk.bold('\n📝 Test 2: Database Connection Pool'));
  console.log(chalk.gray('Request: Create optimized PostgreSQL connection pool'));
  
  const spinner2 = ora('Generating code...').start();
  
  try {
    const result2 = await dualAgent.generateWithAudit(
      'Create a PostgreSQL connection pool with automatic retry, connection health checks, and query timeout handling',
      {
        language: 'javascript',
        framework: 'node.js',
        requirements: 'Use pg library, implement connection pooling best practices'
      }
    );
    
    spinner2.succeed('Code generated successfully');
    
    console.log(chalk.green('\n📄 Generated Code:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(result2.code.substring(0, 500) + '...');
    console.log(chalk.gray('─'.repeat(60)));
    
  } catch (error) {
    spinner2.fail(`Test 2 failed: ${error.message}`);
  }

  // Test Case 3: Streaming Response
  console.log(chalk.bold('\n📝 Test 3: Streaming Code Generation'));
  console.log(chalk.gray('Request: React component with real-time streaming'));
  
  const spinner3 = ora('Streaming code generation...').start();
  
  try {
    console.log(chalk.cyan('\n🔄 Streaming Output:'));
    let charCount = 0;
    
    for await (const chunk of dualAgent.streamGenerateWithAudit(
      'Create a React component for real-time chat with WebSocket support',
      { language: 'typescript', framework: 'react' }
    )) {
      if (chunk.type === 'code_chunk') {
        process.stdout.write(chunk.content);
        charCount += chunk.content.length;
        
        // Update spinner with character count
        spinner.text = `Streaming... (${charCount} characters)`;
      } else if (chunk.type === 'complete') {
        spinner.succeed(`Streaming complete in ${chunk.time}ms`);
        console.log(chalk.gray(`\n\nTotal characters: ${charCount}`));
      }
    }
    
  } catch (error) {
    spinner3.fail(`Test 3 failed: ${error.message}`);
  }

  // Show final metrics
  console.log(chalk.bold('\n📊 System Metrics:'));
  const metrics = dualAgent.getMetrics();
  console.log(chalk.gray(JSON.stringify(metrics, null, 2)));

  // Shutdown
  await dualAgent.shutdown();
  console.log(chalk.green('\n✅ All tests completed'));
}

async function main() {
  try {
    await testDualAgentSystem();
    
    console.log(chalk.blue('\n🎉 Dual-Agent System Test Complete!'));
    console.log(chalk.gray('The system demonstrates:'));
    console.log(chalk.gray('  • Fast code generation with DeepSeek 8B (Ollama)'));
    console.log(chalk.gray('  • Thorough background auditing with 20B model (LM Studio)'));
    console.log(chalk.gray('  • Real-time streaming with parallel audit'));
    console.log(chalk.gray('  • Automatic security and quality analysis'));
    
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test suite failed:'), error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);