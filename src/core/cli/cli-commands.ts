/**
 * CLI Command Handlers
 * Handles the execution of specific CLI commands
 */

import chalk from 'chalk';
import ora from 'ora';
import { readFile, stat } from 'fs/promises';
import { join, extname, isAbsolute } from 'path';
import { glob } from 'glob';

import { CLIOptions, CLIContext } from './cli-types.js';
import { CLIDisplay } from './cli-display.js';
import { ProjectContext } from '../client.js';
import { startServerMode, ServerOptions } from '../../server/server-mode.js';

export class CLICommands {
  private context: CLIContext;
  private workingDirectory: string;

  constructor(context: CLIContext, workingDirectory: string = process.cwd()) {
    this.context = context;
    this.workingDirectory = workingDirectory;
  }

  /**
   * Show system status including model connections and health
   */
  async showStatus(): Promise<void> {
    console.log(chalk.bold('\n📊 CodeCrucible Synth - System Status\n'));
    
    const spinner = ora('Checking system status...').start();
    
    try {
      // Check model client status
      const modelStatus = await this.context.modelClient.healthCheck().then(() => true).catch(() => false);
      spinner.text = 'Checking voice system...';
      
      // Check voice system
      const voiceStatus = this.context.voiceSystem ? 'Active' : 'Inactive';
      spinner.text = 'Checking MCP servers...';
      
      // Check MCP manager
      const mcpStatus = this.context.mcpManager ? 'Active' : 'Inactive';
      
      spinner.succeed('System status check complete');
      
      console.log(chalk.cyan('🤖 Model Client:'), modelStatus ? chalk.green('Connected') : chalk.red('Disconnected'));
      console.log(chalk.cyan('🎭 Voice System:'), voiceStatus === 'Active' ? chalk.green(voiceStatus) : chalk.yellow(voiceStatus));
      console.log(chalk.cyan('🔧 MCP Manager:'), mcpStatus === 'Active' ? chalk.green(mcpStatus) : chalk.yellow(mcpStatus));
      
      // Show available models
      try {
        const models = await this.context.modelClient.getAllAvailableModels?.() || [];
        console.log(chalk.cyan(`\n📋 Available Models (${models.length}):`));
        models.slice(0, 5).forEach((model: any) => {
          const perf = CLIDisplay.getModelPerformance(model.name || model);
          console.log(`  ${perf} ${model.name || model}`);
        });
        if (models.length > 5) {
          console.log(chalk.gray(`  ... and ${models.length - 5} more`));
        }
      } catch (error) {
        console.log(chalk.yellow('\n⚠️  Could not fetch models:'), error);
      }
      
      // System health recommendations
      console.log(chalk.cyan('\n💡 Recommendations:'));
      if (!modelStatus) {
        console.log(chalk.yellow('  • Install and start Ollama or LM Studio'));
      }
      if (voiceStatus === 'Inactive') {
        console.log(chalk.yellow('  • Voice system needs initialization'));
      }
      
    } catch (error) {
      spinner.fail('Status check failed');
      console.error(chalk.red('Error:'), error);
    }
  }

  /**
   * List available models with details
   */
  async listModels(): Promise<void> {
    console.log(chalk.bold('\n🤖 Available Models\n'));
    
    const spinner = ora('Fetching models...').start();
    
    try {
      const models = await this.context.modelClient.getAllAvailableModels?.() || [];
      spinner.succeed(`Found ${models.length} models`);
      
      if (models.length === 0) {
        console.log(chalk.yellow('No models found. Install models with:'));
        console.log(chalk.gray('  ollama pull qwen2.5-coder:7b'));
        console.log(chalk.gray('  ollama pull deepseek-coder:8b'));
        return;
      }
      
      console.log(chalk.cyan('📋 Installed Models:'));
      models.forEach((model: any) => {
        const name = model.name || model;
        const size = model.size ? ` (${model.size})` : '';
        const perf = CLIDisplay.getModelPerformance(name);
        console.log(`  ${perf} ${chalk.bold(name)}${chalk.gray(size)}`);
      });
      
      console.log(chalk.cyan('\n💡 Performance Legend:'));
      console.log(`  ${chalk.green('●')} High Performance`);
      console.log(`  ${chalk.yellow('●')} Medium Performance`);
      console.log(`  ${chalk.gray('●')} Basic Performance`);
      
      // Show recommendations
      await CLIDisplay.showModelRecommendations();
      
    } catch (error) {
      spinner.fail('Failed to fetch models');
      console.error(chalk.red('Error:'), error);
    }
  }

  /**
   * Handle code generation requests
   */
  async handleGeneration(prompt: string, options: CLIOptions = {}): Promise<void> {
    if (!prompt || prompt.trim().length === 0) {
      console.error(chalk.red('❌ Generation requires a prompt'));
      return;
    }

    console.log(chalk.cyan('\n🎯 Starting Code Generation'));
    console.log(chalk.gray(`Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`));
    
    const spinner = ora('Generating code...').start();
    
    try {
      const result = await this.context.modelClient.generateText(prompt);
      
      spinner.succeed('Code generation complete');
      
      console.log(chalk.green('\n📝 Generated Code:'));
      console.log(result || 'No code generated');
      
    } catch (error) {
      spinner.fail('Code generation failed');
      console.error(chalk.red('Error:'), error);
    }
  }

  /**
   * Handle file and directory analysis
   */
  async handleAnalyze(files: string[] = [], options: CLIOptions = {}): Promise<void> {
    if (files.length === 0) {
      // Analyze current directory
      await this.analyzeDirectory(this.workingDirectory, options);
    } else {
      // Analyze specified files
      for (const file of files) {
        const fullPath = isAbsolute(file) ? file : join(this.workingDirectory, file);
        
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            await this.analyzeDirectory(fullPath, options);
          } else {
            await this.analyzeFile(fullPath, options);
          }
        } catch (error) {
          console.error(chalk.red(`❌ Cannot access ${file}:`), error);
        }
      }
    }
  }

  /**
   * Start server mode
   */
  async startServer(options: CLIOptions): Promise<void> {
    const port = parseInt(options.port || '3002', 10);
    
    console.log(chalk.cyan(`\n🚀 Starting CodeCrucible Server on port ${port}...`));
    
    const serverOptions: ServerOptions = {
      port,
      host: 'localhost',
      cors: true
    };
    
    try {
      await startServerMode(this.context, serverOptions);
      console.log(chalk.green(`✅ Server running at http://localhost:${port}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to start server:'), error);
      process.exit(1);
    }
  }

  /**
   * Analyze a directory structure
   */
  private async analyzeDirectory(dirPath: string, options: CLIOptions): Promise<void> {
    console.log(chalk.bold(`\n📁 Analyzing Directory: ${dirPath}`));
    
    const spinner = ora('Scanning directory...').start();
    
    try {
      // Get file patterns for analysis
      const patterns = [
        '**/*.{ts,js,tsx,jsx,py,java,cpp,hpp,c,h,rs,go,php,rb,swift,kt}',
        '**/package.json',
        '**/tsconfig.json',
        '**/README.md'
      ];
      
      const allFiles: string[] = [];
      for (const pattern of patterns) {
        const files = await glob(pattern, { 
          cwd: dirPath,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
        });
        allFiles.push(...files.map(f => join(dirPath, f)));
      }
      
      spinner.text = `Found ${allFiles.length} files, analyzing...`;
      
      // Create project context
      const projectContext: ProjectContext = {
        workingDirectory: dirPath,
        config: {},
        files: allFiles.slice(0, 50).map(f => ({
          path: f,
          content: '',
          type: 'file'
        })),
        structure: {
          directories: [],
          fileTypes: {}
        }
      };
      
      // Analyze with voice system if available
      if (this.context.voiceSystem && this.context.modelClient) {
        const voices = options.voices || ['analyzer', 'architect']; // Use lowercase voice names
        
        // Add timeout to prevent hanging
        const timeoutMs = options.timeout || 60000; // 60 seconds default
        const analysisPromise = this.context.voiceSystem.generateMultiVoiceSolutions(
          Array.isArray(voices) ? voices : [voices],
          `Analyze this codebase structure and provide insights`,
          this.context.modelClient, // Pass the model client as the 3rd parameter
          projectContext // Pass context as 4th parameter
        );
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Analysis timeout - operation took too long')), timeoutMs);
        });
        
        try {
          const analysis = await Promise.race([analysisPromise, timeoutPromise]);
          
          spinner.succeed('Directory analysis complete');
          
          if (analysis && typeof analysis === 'object' && 'content' in analysis) {
            CLIDisplay.displayResults(analysis as any, []);
          } else if (Array.isArray(analysis)) {
            // Handle array of voice responses
            console.log(chalk.green('\n📊 Analysis Results:'));
            analysis.forEach((result, index) => {
              console.log(chalk.cyan(`\n${index + 1}. ${result.voice || 'Voice'} Analysis:`));
              console.log(result.content || 'No content available');
            });
          } else {
            console.log(chalk.yellow('Analysis completed but no structured results available'));
          }
        } catch (analysisError) {
          spinner.fail('Analysis failed');
          if (analysisError instanceof Error && analysisError.message.includes('timeout')) {
            console.log(chalk.yellow(`⏱️ Analysis timed out after ${timeoutMs/1000} seconds`));
            console.log(chalk.cyan('Tip: Use --timeout <seconds> to increase timeout or try analyzing fewer files'));
          } else {
            console.error(chalk.red('Error during analysis:'), analysisError);
          }
        }
      } else {
        spinner.succeed('Basic directory scan complete');
        console.log(chalk.cyan(`\n📊 Summary:`));
        console.log(`  Files found: ${allFiles.length}`);
        console.log(`  Types: ${this.getFileTypes(allFiles)}`);
      }
      
    } catch (error) {
      spinner.fail('Directory analysis failed');
      console.error(chalk.red('Error:'), error);
    }
  }

  /**
   * Analyze a specific file
   */
  private async analyzeFile(filePath: string, options: CLIOptions): Promise<void> {
    console.log(chalk.bold(`\n📄 Analyzing File: ${filePath}`));
    
    const spinner = ora('Reading file...').start();
    
    try {
      const content = await readFile(filePath, 'utf-8');
      const stats = await stat(filePath);
      
      spinner.text = 'Analyzing content...';
      
      console.log(chalk.cyan('\n📊 File Analysis:'));
      console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`  Lines: ${content.split('\n').length}`);
      console.log(`  Type: ${extname(filePath)}`);
      
      if (this.context.voiceSystem && this.context.modelClient) {
        const voices = options.voices || ['maintainer', 'security']; // Use lowercase voice names
        
        // Add timeout to prevent hanging
        const timeoutMs = options.timeout || 60000; // 60 seconds default
        const analysisPromise = this.context.voiceSystem.generateMultiVoiceSolutions(
          Array.isArray(voices) ? voices : [voices],
          `Analyze this ${extname(filePath)} file for quality, security, and maintainability`,
          this.context.modelClient, // Pass the model client as the 3rd parameter
          { files: [filePath], structure: {}, metadata: { content: content.substring(0, 5000) } } // Pass context as 4th parameter
        );
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Analysis timeout - operation took too long')), timeoutMs);
        });
        
        try {
          const analysis = await Promise.race([analysisPromise, timeoutPromise]);
          
          spinner.succeed('File analysis complete');
          if (analysis && typeof analysis === 'object' && 'content' in analysis) {
            CLIDisplay.displayResults(analysis as any, []);
          } else if (Array.isArray(analysis)) {
            // Handle array of voice responses
            console.log(chalk.green('\n📊 File Analysis Results:'));
            analysis.forEach((result, index) => {
              console.log(chalk.cyan(`\n${index + 1}. ${result.voice || 'Voice'} Analysis:`));
              console.log(result.content || 'No content available');
            });
          } else {
            console.log(chalk.yellow('Analysis completed but no structured results available'));
          }
        } catch (analysisError) {
          spinner.fail('File analysis failed');
          if (analysisError instanceof Error && analysisError.message.includes('timeout')) {
            console.log(chalk.yellow(`⏱️ File analysis timed out after ${timeoutMs/1000} seconds`));
            console.log(chalk.cyan('Tip: Use --timeout <seconds> to increase timeout'));
          } else {
            console.error(chalk.red('Error during file analysis:'), analysisError);
          }
        }
      } else {
        spinner.succeed('Basic file analysis complete');
      }
      
    } catch (error) {
      spinner.fail('File analysis failed');
      console.error(chalk.red('Error:'), error);
    }
  }

  /**
   * Get summary of file types in a file list
   */
  private getFileTypes(files: string[]): string {
    const types = new Map<string, number>();
    
    files.forEach(file => {
      const ext = extname(file);
      types.set(ext, (types.get(ext) || 0) + 1);
    });
    
    return Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ext, count]) => `${ext}(${count})`)
      .join(', ');
  }
}