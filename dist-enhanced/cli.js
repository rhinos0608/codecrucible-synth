#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CodeCrucibleClient } from './index.js';

const execAsync = promisify(exec);

class AutonomousCodeCrucibleCLI {
  constructor() {
    this.client = new CodeCrucibleClient();
  }

  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      await this.showWelcome();
      return;
    }

    const command = args[0];

    try {
      switch (command) {
        case 'startup':
        case 'init':
          await this.executeStartup();
          break;
        
        case 'analyze':
        case 'audit':
          await this.executeAnalysis();
          break;
        
        case 'generate':
        case 'gen':
          await this.executeGeneration(args.slice(1).join(' '));
          break;
        
        case 'status':
          await this.showStatus();
          break;
        
        default:
          await this.executeGeneration(args.join(' '));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  }

  async showWelcome() {
    console.log(chalk.cyan(`
🔥 CodeCrucible Synth v3.4.0
================================
AI-Powered Code Generation & Analysis

Commands:
  startup      - Autonomous environment setup
  analyze      - Comprehensive codebase analysis  
  generate     - Generate code from prompt
  status       - System status check

Example: codecrucible generate "React login component"
`));
  }

  async executeStartup() {
    console.log(chalk.blue('🚀 Autonomous Startup Sequence'));
    console.log(chalk.cyan('==============================='));
    
    const report = await this.analyzeEnvironment();
    
    console.log('\n📊 Environment Analysis:');
    console.log(`   Node.js: ${report.node ? '✅' : '❌'} ${report.nodeVersion || 'Not found'}`);
    console.log(`   Git: ${report.git ? '✅' : '❌'} ${report.gitVersion || 'Not found'}`);
    console.log(`   NPM: ${report.npm ? '✅' : '❌'} ${report.npmVersion || 'Not found'}`);
    
    console.log('\n🤖 AI Models:');
    console.log(`   Ollama: ${report.ollama ? '✅ Available' : '❌ Not Available'}`);
    console.log(`   Models: ${report.models.join(', ') || 'None detected'}`);
    
    console.log('\n📁 Project Context:');
    console.log(`   Type: ${report.projectType}`);
    console.log(`   Files: ${report.fileCount}`);
    console.log(`   Languages: ${Object.keys(report.languages).join(', ')}`);
    
    console.log(`\n🎯 Readiness Score: ${report.readinessScore}/100`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }
  }

  async executeAnalysis() {
    console.log(chalk.blue('🔍 Comprehensive Codebase Analysis'));
    console.log(chalk.cyan('==================================='));
    
    const analysis = await this.performDeepAnalysis();
    
    console.log('\n📈 Overview:');
    console.log(`   Total Files: ${analysis.totalFiles.toLocaleString()}`);
    console.log(`   Total Lines: ${analysis.totalLines.toLocaleString()}`);
    console.log(`   Languages: ${Object.entries(analysis.languages).map(([l,c]) => `${l}(${c})`).join(', ')}`);
    
    console.log('\n📦 Dependencies:');
    console.log(`   Production: ${analysis.prodDeps}`);
    console.log(`   Development: ${analysis.devDeps}`);
    if (analysis.vulnerabilities > 0) {
      console.log(chalk.yellow(`   ⚠️  Vulnerabilities: ${analysis.vulnerabilities}`));
    }
    
    console.log('\n⭐ Quality Metrics:');
    console.log(`   Complexity Score: ${analysis.complexity}/10`);
    console.log(`   Maintainability: ${analysis.maintainability}`);
    console.log(`   Test Coverage: ${analysis.testCoverage}`);
    
    if (analysis.patterns.length > 0) {
      console.log('\n🏗️  Architecture Patterns:');
      analysis.patterns.forEach(pattern => {
        console.log(`   • ${pattern}`);
      });
    }
    
    if (analysis.issues.length > 0) {
      console.log('\n⚠️  Issues Found:');
      analysis.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }
    
    console.log('\n🤖 AI Insights:');
    const insights = await this.generateInsights(analysis);
    console.log(insights);
  }

  async executeGeneration(prompt) {
    if (!prompt.trim()) {
      console.error(chalk.red('Please provide a prompt'));
      return;
    }

    console.log(chalk.blue(`🔥 Generating: "${prompt}"`));
    
    const result = await this.client.generate(prompt);
    
    console.log('\n📝 Generated Code:');
    console.log(chalk.green('=================='));
    console.log(result.code);
    console.log('\n' + chalk.dim(`Generated with ${result.model} at ${result.timestamp}`));
  }

  async showStatus() {
    console.log(chalk.blue('🔍 System Status'));
    console.log(chalk.cyan('================'));
    
    const hasPackageJson = fs.existsSync('package.json');
    const hasGit = fs.existsSync('.git');
    
    console.log(`📁 Project: ${hasPackageJson ? '✅ Node.js' : '❌ Unknown'}`);
    console.log(`🔄 Git: ${hasGit ? '✅ Repository' : '❌ Not initialized'}`);
    
    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const deps = Object.keys(pkg.dependencies || {}).length;
        console.log(`📦 Dependencies: ${deps}`);
      } catch (e) {
        console.log('📦 Dependencies: Error reading package.json');
      }
    }
  }

  async analyzeEnvironment() {
    const report = {
      node: false, nodeVersion: '',
      git: false, gitVersion: '',
      npm: false, npmVersion: '',
      ollama: false, models: [],
      projectType: 'Unknown',
      fileCount: 0,
      languages: {},
      readinessScore: 0,
      recommendations: []
    };

    // Check Node.js
    try {
      const { stdout } = await execAsync('node --version', { timeout: 3000 });
      report.node = true;
      report.nodeVersion = stdout.trim();
    } catch (e) { /* ignore */ }

    // Check Git
    try {
      const { stdout } = await execAsync('git --version', { timeout: 3000 });
      report.git = true;
      report.gitVersion = stdout.trim();
    } catch (e) { /* ignore */ }

    // Check NPM
    try {
      const { stdout } = await execAsync('npm --version', { timeout: 3000 });
      report.npm = true;
      report.npmVersion = stdout.trim();
    } catch (e) { /* ignore */ }

    // Check Ollama
    try {
      const { stdout } = await execAsync('ollama list', { timeout: 5000 });
      report.ollama = true;
      report.models = stdout.split('\n').slice(1).map(line => line.split('\t')[0]).filter(Boolean).slice(0, 5);
    } catch (e) { /* ignore */ }

    // Analyze project
    const projectAnalysis = this.quickProjectAnalysis();
    Object.assign(report, projectAnalysis);

    // Calculate readiness score
    let score = 0;
    if (report.node) score += 25;
    if (report.git) score += 15;
    if (report.npm) score += 15;
    if (report.ollama) score += 20;
    if (report.models.length > 0) score += 15;
    if (fs.existsSync('package.json')) score += 10;
    report.readinessScore = score;

    // Generate recommendations
    if (!report.node) report.recommendations.push('Install Node.js');
    if (!report.git) report.recommendations.push('Install Git');
    if (!report.ollama) report.recommendations.push('Install Ollama for local AI');
    if (report.models.length === 0) report.recommendations.push('Download AI models (e.g., ollama pull codellama:7b)');

    return report;
  }

  quickProjectAnalysis() {
    const languages = {};
    let fileCount = 0;
    let projectType = 'Unknown';

    try {
      if (fs.existsSync('package.json')) {
        projectType = 'Node.js';
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        if (pkg.dependencies?.react) projectType = 'React';
        else if (pkg.dependencies?.vue) projectType = 'Vue';
        else if (pkg.dependencies?.next) projectType = 'Next.js';
      }

      // Quick file scan
      const scanDir = (dir, depth = 0) => {
        if (depth > 2) return;
        try {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            if (item.startsWith('.') || item === 'node_modules') continue;
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isFile()) {
              fileCount++;
              const ext = path.extname(item).toLowerCase();
              if (ext === '.js') languages.JavaScript = (languages.JavaScript || 0) + 1;
              else if (ext === '.ts') languages.TypeScript = (languages.TypeScript || 0) + 1;
              else if (ext === '.py') languages.Python = (languages.Python || 0) + 1;
              else if (ext === '.java') languages.Java = (languages.Java || 0) + 1;
              else if (ext === '.cpp' || ext === '.cc') languages.CPlusPlus = (languages.CPlusPlus || 0) + 1;
            } else if (stat.isDirectory()) {
              scanDir(fullPath, depth + 1);
            }
          }
        } catch (e) { /* ignore errors */ }
      };

      scanDir('.');
    } catch (e) { /* ignore errors */ }

    return { projectType, fileCount, languages };
  }

  async performDeepAnalysis() {
    const analysis = {
      totalFiles: 0,
      totalLines: 0,
      languages: {},
      prodDeps: 0,
      devDeps: 0,
      vulnerabilities: 0,
      complexity: 1,
      maintainability: 'Good',
      testCoverage: 'Unknown',
      patterns: [],
      issues: []
    };

    // File analysis
    const fileAnalysis = this.quickProjectAnalysis();
    analysis.totalFiles = fileAnalysis.fileCount;
    analysis.languages = fileAnalysis.languages;

    // Dependencies analysis
    if (fs.existsSync('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        analysis.prodDeps = Object.keys(pkg.dependencies || {}).length;
        analysis.devDeps = Object.keys(pkg.devDependencies || {}).length;

        // Detect patterns
        if (pkg.dependencies?.react) analysis.patterns.push('React Component Architecture');
        if (pkg.dependencies?.express) analysis.patterns.push('Express.js API Server');
        if (pkg.devDependencies?.jest) analysis.patterns.push('Jest Testing Framework');
        if (pkg.scripts?.test) analysis.patterns.push('Automated Testing');
        if (pkg.scripts?.build) analysis.patterns.push('Build Pipeline');

        // Detect issues
        if (analysis.prodDeps > 50) analysis.issues.push('High dependency count - consider optimization');
        if (!pkg.scripts?.test) analysis.issues.push('No test script configured');
        if (!pkg.description) analysis.issues.push('Missing package description');
      } catch (e) {
        analysis.issues.push('Invalid package.json file');
      }
    }

    // Quick vulnerability check
    try {
      await execAsync('npm audit --json', { timeout: 10000, cwd: process.cwd() });
    } catch (error) {
      if (error.stdout) {
        try {
          const auditResult = JSON.parse(error.stdout);
          analysis.vulnerabilities = auditResult.metadata?.vulnerabilities?.total || 0;
        } catch (e) { /* ignore */ }
      }
    }

    // Estimate complexity based on file count and patterns
    if (analysis.totalFiles > 100) analysis.complexity = Math.min(8, 3 + Math.floor(analysis.totalFiles / 50));
    if (analysis.patterns.length > 3) analysis.complexity = Math.max(2, analysis.complexity - 1);
    
    analysis.maintainability = analysis.complexity < 4 ? 'Excellent' : 
                              analysis.complexity < 7 ? 'Good' : 'Needs Improvement';

    return analysis;
  }

  async generateInsights(analysis) {
    const insights = [];
    
    if (analysis.maintainability === 'Excellent') {
      insights.push('✅ Code structure appears well-organized and maintainable');
    } else if (analysis.maintainability === 'Needs Improvement') {
      insights.push('⚠️ Consider refactoring to improve maintainability');
    }
    
    if (analysis.prodDeps > 30) {
      insights.push('📦 Large number of dependencies - audit for unused packages');
    }
    
    if (analysis.vulnerabilities > 0) {
      insights.push(`🔒 ${analysis.vulnerabilities} security vulnerabilities detected - run 'npm audit fix'`);
    }
    
    if (analysis.patterns.includes('React Component Architecture')) {
      insights.push('⚛️ React project detected - consider component composition patterns');
    }
    
    if (!analysis.patterns.includes('Automated Testing')) {
      insights.push('🧪 No testing framework detected - consider adding Jest or similar');
    }
    
    return insights.length > 0 ? insights.join('\n   ') : 'No specific insights generated for this codebase.';
  }
}

// CLI Entry Point
const cli = new AutonomousCodeCrucibleCLI();
cli.run().catch(error => {
  console.error(chalk.red('❌ Fatal Error:'), error.message);
  process.exit(1);
});
