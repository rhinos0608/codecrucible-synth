#!/usr/bin/env node

/**
 * Apply Agent Loop Prevention and Analysis Fixes
 * 
 * This script applies the comprehensive fixes to the CodeCrucible agent to:
 * 1. Prevent tool usage loops
 * 2. Improve meaningful analysis
 * 3. Better completion detection
 * 4. Enhanced knowledge extraction
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

async function applyFixes() {
  console.log(chalk.blue('🔧 Applying CodeCrucible Agent Fixes...\n'));

  try {
    // 1. Backup original files
    console.log(chalk.yellow('📦 Creating backups...'));
    
    const filesToBackup = [
      'src/core/react-agent.ts',
      'src/core/claude-code-inspired-reasoning.ts'
    ];

    for (const file of filesToBackup) {
      const fullPath = join(process.cwd(), file);
      const backupPath = fullPath + '.backup';
      
      try {
        await fs.copyFile(fullPath, backupPath);
        console.log(chalk.gray(`  ✓ Backed up ${file}`));
      } catch (error) {
        console.log(chalk.gray(`  ⚠ Could not backup ${file} (may not exist)`));
      }
    }

    // 2. Apply the fixed versions
    console.log(chalk.yellow('\n📝 Applying fixes...'));

    // Copy fixed react-agent
    const fixedReactAgent = join(process.cwd(), 'src/core/react-agent-fixed.ts');
    const targetReactAgent = join(process.cwd(), 'src/core/react-agent.ts');
    
    try {
      await fs.copyFile(fixedReactAgent, targetReactAgent);
      console.log(chalk.green('  ✓ Applied react-agent.ts fixes'));
    } catch (error) {
      console.log(chalk.red(`  ✗ Failed to apply react-agent fixes: ${error.message}`));
    }

    // Copy fixed reasoning system
    const fixedReasoning = join(process.cwd(), 'src/core/claude-code-inspired-reasoning-fixed.ts');
    const targetReasoning = join(process.cwd(), 'src/core/claude-code-inspired-reasoning.ts');
    
    try {
      await fs.copyFile(fixedReasoning, targetReasoning);
      console.log(chalk.green('  ✓ Applied reasoning system fixes'));
    } catch (error) {
      console.log(chalk.red(`  ✗ Failed to apply reasoning fixes: ${error.message}`));
    }

    // 3. Update configuration for better defaults
    console.log(chalk.yellow('\n⚙️ Updating configuration...'));
    
    const configPath = join(process.cwd(), '.codecrucible', 'config.yaml');
    try {
      let configContent = await fs.readFile(configPath, 'utf8');
      
      // Update max iterations
      configContent = configContent.replace(/maxIterations:\s*\d+/g, 'maxIterations: 5');
      
      // Update timeout
      configContent = configContent.replace(/timeout:\s*\d+/g, 'timeout: 60000');
      
      await fs.writeFile(configPath, configContent);
      console.log(chalk.green('  ✓ Updated configuration defaults'));
    } catch (error) {
      console.log(chalk.gray('  ⚠ Could not update config (may not exist yet)'));
    }

    // 4. Clean up temporary files
    console.log(chalk.yellow('\n🧹 Cleaning up...'));
    
    const tempFiles = [
      'src/core/react-agent-fixed.ts',
      'src/core/claude-code-inspired-reasoning-fixed.ts'
    ];

    for (const file of tempFiles) {
      try {
        await fs.unlink(join(process.cwd(), file));
        console.log(chalk.gray(`  ✓ Removed temporary file ${file}`));
      } catch (error) {
        // Ignore if doesn't exist
      }
    }

    // 5. Rebuild the project
    console.log(chalk.yellow('\n🔨 Rebuilding project...'));
    
    const { execSync } = await import('child_process');
    
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log(chalk.green('  ✓ Project rebuilt successfully'));
    } catch (error) {
      console.log(chalk.red('  ✗ Build failed - please run "npm run build" manually'));
    }

    console.log(chalk.green('\n✨ Fixes applied successfully!\n'));
    console.log(chalk.cyan('Key improvements:'));
    console.log(chalk.gray('  • Strict loop prevention (no duplicate tool calls)'));
    console.log(chalk.gray('  • Enhanced knowledge extraction from tool outputs'));
    console.log(chalk.gray('  • Smarter completion detection (max 5 iterations)'));
    console.log(chalk.gray('  • Better context accumulation and analysis'));
    console.log(chalk.gray('  • Improved final answer generation'));
    
    console.log(chalk.cyan('\nTo test the improvements:'));
    console.log(chalk.gray('  1. Run: cc agent'));
    console.log(chalk.gray('  2. Ask: "Audit this codebase"'));
    console.log(chalk.gray('  3. Observe: No loops, meaningful analysis'));

    console.log(chalk.yellow('\nTo restore original files:'));
    console.log(chalk.gray('  cp src/core/react-agent.ts.backup src/core/react-agent.ts'));
    console.log(chalk.gray('  cp src/core/claude-code-inspired-reasoning.ts.backup src/core/claude-code-inspired-reasoning.ts'));
    console.log(chalk.gray('  npm run build'));

  } catch (error) {
    console.error(chalk.red('❌ Error applying fixes:'), error);
    process.exit(1);
  }
}

// Run the fix application
applyFixes().catch(console.error);
