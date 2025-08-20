#!/usr/bin/env node

/**
 * Direct Analysis Test - Bypass all the complex systems
 * Test if basic codebase analysis works without agent conflicts
 */

import { OllamaProvider } from './dist/providers/ollama.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

async function getProjectStructure() {
  const structure = [];
  const rootPath = process.cwd();
  
  try {
    const items = await fs.readdir(rootPath);
    const importantFiles = items.filter(item => 
      item.includes('package.json') || 
      item.includes('README') ||
      item.includes('CLAUDE.md') ||
      item === 'src' ||
      item === 'dist'
    ).slice(0, 10); // Limit to prevent huge output
    
    for (const item of importantFiles) {
      const itemPath = join(rootPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        structure.push(`📁 ${item}/`);
        if (item === 'src') {
          // Show some src contents
          const srcItems = await fs.readdir(itemPath);
          srcItems.slice(0, 5).forEach(srcItem => {
            structure.push(`  📄 ${srcItem}`);
          });
        }
      } else {
        structure.push(`📄 ${item}`);
      }
    }
  } catch (error) {
    structure.push(`❌ Error reading project: ${error.message}`);
  }
  
  return structure.join('\n');
}

async function testDirectAnalysis() {
  console.log(chalk.blue('🔍 Direct CodeCrucible Analysis Test'));
  console.log(chalk.gray('Testing core functionality without agent interference'));
  console.log('━'.repeat(60));

  try {
    // Create simple Ollama provider
    console.log(chalk.cyan('📡 Connecting to Ollama...'));
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      model: 'qwen2.5-coder:7b',
      timeout: 60000  // 1 minute timeout
    });

    // Check if Ollama is available
    const available = await provider.checkStatus();
    if (!available) {
      console.log(chalk.red('❌ Ollama is not available'));
      return;
    }
    console.log(chalk.green('✅ Ollama connected'));

    // Get minimal project structure
    console.log(chalk.cyan('📁 Reading project structure...'));
    const projectStructure = await getProjectStructure();
    console.log(chalk.gray(`Structure length: ${projectStructure.length} characters`));

    // Create focused analysis prompt
    const analysisPrompt = `Analyze this CodeCrucible Synth project:

Project Structure:
${projectStructure}

Please provide:
1. What type of project this is
2. Main technology stack
3. Key architectural components
4. Current status assessment

Keep response under 200 words.`;

    console.log(chalk.cyan('🤖 Sending analysis request to Ollama...'));
    console.log(chalk.gray(`Prompt length: ${analysisPrompt.length} characters`));
    
    const startTime = Date.now();
    
    // Make direct request to Ollama
    const response = await provider.processRequest({
      prompt: analysisPrompt,
      model: 'qwen2.5-coder:7b',
      temperature: 0.3,
      maxTokens: 500
    });
    
    const duration = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Response received in ${duration}ms`));
    console.log('━'.repeat(60));
    console.log(chalk.white('📋 Analysis Result:'));
    console.log(chalk.cyan(response.content));
    console.log('━'.repeat(60));
    
    // Check if this is a proper analysis
    const isGenericResponse = response.content.toLowerCase().includes('need to see') || 
                            response.content.toLowerCase().includes('please provide') ||
                            response.content.toLowerCase().includes('share the code');
    
    if (isGenericResponse) {
      console.log(chalk.red('❌ FAILED: Got generic response instead of actual analysis'));
      return false;
    } else {
      console.log(chalk.green('✅ SUCCESS: Got actual project analysis!'));
      return true;
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Direct analysis failed:'), error.message);
    return false;
  }
}

// Run the test
console.log(chalk.blue('🚀 Testing Direct Codebase Analysis'));
testDirectAnalysis().then(success => {
  if (success) {
    console.log(chalk.green('\n🎉 CORE FUNCTIONALITY WORKS!'));
    console.log(chalk.gray('The issue is in the complex agent coordination, not the basic analysis.'));
  } else {
    console.log(chalk.red('\n💥 CORE FUNCTIONALITY BROKEN!'));
    console.log(chalk.gray('Need to fix the fundamental analysis before proceeding.'));
  }
}).catch(console.error);