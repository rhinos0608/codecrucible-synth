#!/usr/bin/env node

/**
 * Simple CLI - Direct codebase analysis without complex systems
 * This bypasses all the timeout monitoring and agent conflicts
 */

import { simpleCodebaseAnalyzer } from './dist/core/simple-codebase-analyzer.js';
import chalk from 'chalk';

async function main() {
  const args = process.argv.slice(2);
  const prompt = args.join(' ').toLowerCase();

  console.log(chalk.blue('🚀 CodeCrucible Synth - Simple CLI'));
  console.log(chalk.gray('Direct analysis mode (no complex systems)'));
  console.log('━'.repeat(60));

  if (!prompt) {
    console.log(chalk.yellow('Usage: node simple-cli.js "your prompt"'));
    console.log('Examples:');
    console.log('  node simple-cli.js "analyze this codebase"');
    console.log('  node simple-cli.js "audit this project"');
    return;
  }

  // Check if this is a codebase analysis request
  if (prompt.includes('analyze') || prompt.includes('audit') || prompt.includes('codebase') || prompt.includes('project')) {
    console.log(chalk.cyan('🔍 Starting codebase analysis...'));
    console.log(chalk.gray('This may take 1-2 minutes for comprehensive analysis'));

    try {
      const result = await simpleCodebaseAnalyzer.analyzeCurrentProject();

      if (result.success) {
        console.log(chalk.green('\\n✅ Analysis Complete!'));
        console.log(chalk.blue('═'.repeat(80)));
        console.log(result.content);
        console.log(chalk.blue('═'.repeat(80)));
        
        console.log(chalk.gray(`\\n📊 Analysis Statistics:`));
        console.log(chalk.gray(`   Duration: ${(result.metadata.duration / 1000).toFixed(1)}s`));
        console.log(chalk.gray(`   Response length: ${result.metadata.responseLength} characters`));
        console.log(chalk.gray(`   Project items analyzed: ${result.metadata.projectStructure.split('\\n').length}`));
      } else {
        console.error(chalk.red('❌ Analysis failed:'), result.error);
      }
    } catch (error) {
      console.error(chalk.red('❌ Unexpected error:'), error.message);
    }
  } else {
    console.log(chalk.yellow('🤖 For other queries, use the full CLI:'));
    console.log(chalk.gray('  node dist/bin/crucible.js "your prompt"'));
    console.log('\\nThis simple CLI only handles codebase analysis requests.');
  }
}

main().catch(console.error);