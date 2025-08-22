/**
 * CLI Command Handlers
 * Handles the execution of specific CLI commands
 */

import chalk from 'chalk';
import ora from 'ora';
<<<<<<< HEAD
import { readFile, stat, writeFile } from 'fs/promises';
=======
import { readFile, stat } from 'fs/promises';
>>>>>>> 312cb1b60a67735101a751485e0debd903886729
import { join, extname, isAbsolute } from 'path';
import { glob } from 'glob';

import { CLIOptions, CLIContext } from './cli-types.js';
import { CLIDisplay } from './cli-display.js';
import { ProjectContext } from '../client.js';
import { startServerMode, ServerOptions } from '../../server/server-mode.js';
import { analysisWorkerPool, AnalysisTask } from '../workers/analysis-worker.js';
import { randomUUID } from 'crypto';
<<<<<<< HEAD
import { SequentialDualAgentSystem } from '../collaboration/sequential-dual-agent-system.js';
=======
>>>>>>> 312cb1b60a67735101a751485e0debd903886729

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

    // Model Client Status
    console.log(chalk.cyan('🤖 Model Client:'));
    try {
      if (this.context.modelClient) {
        console.log('DEBUG: About to call healthCheck...');
        const healthCheck = await this.context.modelClient.healthCheck();
        console.log('DEBUG: HealthCheck completed:', healthCheck);
        console.log(chalk.green(`  ✅ Status: ${healthCheck ? 'Connected' : 'Disconnected'}`));

        if (typeof (this.context.modelClient as any).getCurrentModel === 'function') {
          const currentModel = (this.context.modelClient as any).getCurrentModel();
          console.log(chalk.cyan(`  🎯 Current Model: ${currentModel || 'Auto-detect'}`));
        }
      } else {
        console.log(chalk.red('  ❌ Model client not initialized'));
      }
    } catch (error) {
      console.log(
        chalk.red(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }

    // Voice System Status
    console.log(chalk.cyan('\n🎭 Voice System:'));
    try {
      if (this.context.voiceSystem) {
        const voices = this.context.voiceSystem.getAvailableVoices();
        console.log(chalk.green(`  ✅ Available Voices: ${voices.length}`));
        console.log(chalk.cyan(`  🎯 Voice Names: ${voices.map(v => v.name).join(', ')}`));
      } else {
        console.log(chalk.red('  ❌ Voice system not initialized'));
      }
    } catch (error) {
      console.log(
        chalk.red(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }

    // MCP Server Status
    console.log(chalk.cyan('\n🔧 MCP Servers:'));
    try {
      if (this.context.mcpManager) {
        const serverCount = (this.context.mcpManager as any).servers?.size || 0;
        console.log(chalk.green(`  ✅ Active Servers: ${serverCount}`));

        if (typeof (this.context.mcpManager as any).isReady === 'function') {
          const ready = (this.context.mcpManager as any).isReady();
          console.log(chalk.cyan(`  🚀 Ready: ${ready ? 'Yes' : 'No'}`));
        }
      } else {
        console.log(chalk.red('  ❌ MCP manager not initialized'));
      }
    } catch (error) {
      console.log(
        chalk.red(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }

    // Configuration Status
    console.log(chalk.cyan('\n⚙️  Configuration:'));
    try {
      if (this.context.config) {
        console.log(chalk.green('  ✅ Configuration loaded'));

        if (this.context.config.model) {
          console.log(
            chalk.cyan(`  🔗 Endpoint: ${this.context.config.model.endpoint || 'Default'}`)
          );
          console.log(
            chalk.cyan(`  ⏱️  Timeout: ${this.context.config.model.timeout || 'Default'}ms`)
          );
        }
      } else {
        console.log(chalk.red('  ❌ Configuration not loaded'));
      }
    } catch (error) {
      console.log(
        chalk.red(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }

    console.log(chalk.green('\n✨ System check complete!\n'));
  }

  /**
   * List available AI models
   */
  async listModels(): Promise<void> {
    console.log(chalk.bold('\n🧠 Available AI Models\n'));

    const spinner = ora('Fetching available models...').start();

    try {
      if (!this.context.modelClient) {
        spinner.fail('Model client not available');
        console.log(chalk.red('❌ Model client is not initialized'));
        return;
      }

      // Check if getAllAvailableModels method exists
      if (typeof this.context.modelClient.getAllAvailableModels === 'function') {
        const models = await this.context.modelClient.getAllAvailableModels();

        spinner.succeed(`Found ${models.length} models`);

        if (models.length > 0) {
          console.log(chalk.cyan('📋 Available Models:'));
          models.forEach((model, index) => {
            console.log(chalk.white(`  ${index + 1}. ${model.name || model.id || model}`));
            if (model.size) {
              console.log(chalk.gray(`     Size: ${model.size}`));
            }
            if (model.modified_at) {
              console.log(
                chalk.gray(`     Modified: ${new Date(model.modified_at).toLocaleDateString()}`)
              );
            }
          });
        } else {
          console.log(chalk.yellow('No models found. Make sure your AI service is running.'));
        }
      } else {
        spinner.warn('Model listing not supported');
        console.log(chalk.yellow('ℹ️  Model listing is not supported by the current client'));
      }
    } catch (error) {
      spinner.fail('Failed to fetch models');
      console.error(chalk.red('❌ Error fetching models:'), error);
    }

    console.log('');
  }

  /**
   * Handle code generation requests
   */
  async handleGeneration(prompt: string, options: CLIOptions = {}): Promise<void> {
    console.log(chalk.bold(`\n🎨 Generating Code\n`));
    console.log(chalk.cyan(`Prompt: ${prompt}`));

    const spinner = ora('Generating code...').start();

    try {
      if (!this.context.modelClient || !this.context.voiceSystem) {
        spinner.fail('Required services not available');
        console.log(chalk.red('❌ Model client or voice system not initialized'));
        return;
      }

      // Get voices for code generation
      const voices = options.voices || this.context.voiceSystem.getDefaultVoices() || ['developer'];

      // Generate multi-voice solutions
      const results = await this.context.voiceSystem.generateMultiVoiceSolutions(
        Array.isArray(voices) ? voices : [voices],
        prompt,
        { files: [] }
      );

      spinner.succeed('Code generation complete');

      if (results && results.length > 0) {
        console.log(chalk.green('\n✨ Generated Solutions:\n'));

        results.forEach((result, index) => {
          console.log(chalk.cyan(`\n${index + 1}. ${result.voice || 'Voice'} Solution:`));
          console.log(chalk.white(result.content || 'No content generated'));

          if (result.confidence) {
            console.log(chalk.gray(`   Confidence: ${Math.round(result.confidence * 100)}%`));
          }
        });
      } else {
        console.log(chalk.yellow('No solutions generated'));
      }
    } catch (error) {
      spinner.fail('Code generation failed');
      console.error(chalk.red('❌ Error during generation:'), error);
    }

    console.log('');
  }

  /**
   * Handle file and directory analysis
   */
  async handleAnalyze(files: string[] = [], options: CLIOptions = {}): Promise<void> {
    if (files.length === 0) {
      // Use our real codebase analysis for directory analysis
      console.log(chalk.cyan('🔍 Performing comprehensive codebase analysis...'));
      
      try {
        console.log('DEBUG: About to import CodebaseAnalyzer');
        const { CodebaseAnalyzer } = await import('../analysis/codebase-analyzer.js');
        console.log('DEBUG: CodebaseAnalyzer imported successfully');
        const analyzer = new CodebaseAnalyzer(this.workingDirectory);
        console.log('DEBUG: Analyzer created, starting analysis');
        const analysis = await analyzer.performAnalysis();
        console.log('DEBUG: Analysis completed');
        console.log(analysis);
      } catch (error) {
        console.error(chalk.red('❌ Analysis failed:'), error);
        console.log('DEBUG: Falling back to original analysis');
        // For now, just show a message instead of hanging
        console.log(chalk.yellow('🔧 Real-time analysis temporarily unavailable. Using fallback method.'));
        console.log(chalk.cyan('ℹ️  The comprehensive analysis feature is being refined.'));
      }
    } else {
      // Analyze specified files using original logic
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
      cors: true,
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
   * Analyze a directory structure with worker pool
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
        '**/README.md',
      ];

      const allFiles: string[] = [];
      for (const pattern of patterns) {
        const files = await glob(pattern, {
          cwd: dirPath,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
        });
        allFiles.push(...files.map(f => join(dirPath, f)));
      }

      spinner.text = `Found ${allFiles.length} files, analyzing...`;

      // PERFORMANCE FIX: Use worker pool for non-blocking analysis
      if (this.context.voiceSystem && this.context.modelClient) {
        const voices = options.voices || ['analyzer', 'architect'];

        // Create analysis task for worker pool
        const analysisTask: AnalysisTask = {
          id: randomUUID(),
          files: allFiles,
          prompt:
            (options.prompt as string) ||
            'Analyze this codebase for architecture, quality, and potential improvements.',
          options: {
            voices,
            maxFiles: 50, // Limit files to prevent memory overload
          },
          timeout: options.timeout || 30000, // 30 seconds timeout
        };

        // Execute analysis in worker thread
        try {
          const result = await analysisWorkerPool.executeAnalysis(analysisTask, {
            endpoint: this.context.config.model?.endpoint || 'http://localhost:11434',
            providers: [{ type: 'ollama' as const }],
            executionMode: 'auto' as const,
            fallbackChain: ['ollama' as const],
            performanceThresholds: {
              fastModeMaxTokens: 2048,
              timeoutMs: 30000,
              maxConcurrentRequests: 2,
            },
            security: {
              enableSandbox: true,
              maxInputLength: 100000,
              allowedCommands: ['node', 'npm', 'git'],
            },
          });

          spinner.succeed(`Analysis complete - processed ${result.result?.totalFiles || 0} files`);

          // Display results
          if (result.success && result.result) {
            console.log(chalk.green('\n✅ Analysis Results:'));
            console.log(chalk.cyan(`📊 Files processed: ${result.result.totalFiles}`));
            console.log(chalk.cyan(`⏱️ Duration: ${result.duration}ms`));
            console.log(chalk.cyan(`📈 Success rate: ${result.result.summary?.successRate || 0}%`));

            // Display chunk results
            result.result.chunks.forEach((chunk: any, index: number) => {
              console.log(chalk.yellow(`\n📦 Chunk ${index + 1}:`));
              if (chunk.error) {
                console.log(chalk.red(`❌ Error: ${chunk.error}`));
              } else if (chunk.analysis) {
                console.log(chalk.green(`✅ Successfully analyzed ${chunk.files.length} files`));
                if (chunk.analysis.length > 0) {
                  console.log(chalk.white(chunk.analysis[0].content.substring(0, 200) + '...'));
                }
              }
            });
          } else {
            console.log(chalk.red(`❌ Analysis failed: ${result.error || 'Unknown error'}`));
          }
        } catch (analysisError) {
          spinner.fail('Analysis failed');
          console.error(chalk.red('Error during analysis:'), analysisError);
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
        const voices = options.voices || ['analyzer'];

        const analysis = await this.context.voiceSystem.generateMultiVoiceSolutions(
          Array.isArray(voices) ? voices : [voices],
          `Analyze this file: ${filePath}\n\nContent:\n${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}`,
          { files: [filePath] }
        );

        spinner.succeed('File analysis complete');

        if (analysis && analysis.length > 0) {
          analysis.forEach((result, index) => {
            console.log(chalk.cyan(`\n${index + 1}. ${result.voice || 'Voice'} Analysis:`));
            console.log(result.content || 'No analysis available');
          });
        } else {
          console.log(chalk.yellow('No analysis results available'));
        }
      } else {
        spinner.succeed('Basic file scan complete');
      }
    } catch (error) {
      spinner.fail('File analysis failed');
      console.error(chalk.red('Error:'), error);
    }
  }

  /**
<<<<<<< HEAD
   * Execute sequential dual-agent review workflow
   */
  async handleSequentialReview(prompt: string, options: CLIOptions = {}): Promise<void> {
    console.log(chalk.bold('\n🚀 Sequential Dual-Agent Review System\n'));

    try {
      const spinner = ora('Initializing dual-agent system...').start();

      // Configure system based on options
      const config = {
        writer: {
          provider: options.writerProvider || 'lm-studio',
          temperature: options.writerTemp || 0.7,
          maxTokens: options.writerTokens || 4096,
        },
        auditor: {
          provider: options.auditorProvider || 'ollama',
          temperature: options.auditorTemp || 0.2,
          maxTokens: options.auditorTokens || 2048,
        },
        workflow: {
          autoAudit: options.autoAudit !== false, // Default true
          applyFixes: options.applyFixes || false,
          maxIterations: Number(options.maxIterations) || 3,
          confidenceThreshold: Number(options.confidenceThreshold) || 0.8,
        },
      };

      // Update config if specified
      if (Object.keys(config.writer).some(k => k in options) || 
          Object.keys(config.auditor).some(k => k in options) ||
          Object.keys(config.workflow).some(k => k in options)) {
        console.log(chalk.cyan('📝 Using custom configuration'));
      }

      spinner.text = 'Starting sequential review...';

      // Create properly configured sequential review system
      const reviewSystem = new SequentialDualAgentSystem(config);
      await reviewSystem.initialize();
      
      // Execute the sequential review
      const result = await reviewSystem.executeSequentialReview(prompt);

      spinner.succeed('Sequential review completed');

      // Display results summary
      console.log(chalk.green('\n✅ Review Process Complete!'));
      
      if (options.saveResult || options.output) {
        const outputPath = options.output || `review-result-${Date.now()}.json`;
        await this.saveReviewResult(result, outputPath);
        console.log(chalk.cyan(`📄 Results saved to: ${outputPath}`));
      }

      if (options.showCode !== false) {
        console.log(chalk.blue('\n📋 Generated Code:'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(result.writerOutput.code);
        console.log(chalk.gray('─'.repeat(60)));
        
        if (result.refinedOutput?.code && result.refinedOutput.code !== result.writerOutput.code) {
          console.log(chalk.blue('\n🔧 Refined Code:'));
          console.log(chalk.gray('─'.repeat(60)));
          console.log(result.refinedOutput.code);
          console.log(chalk.gray('─'.repeat(60)));
        }
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Sequential review failed:'));
      console.error(chalk.red(`   ${error instanceof Error ? error.message : 'Unknown error'}`));
      
      // Provide helpful suggestions
      console.log(chalk.yellow('\n💡 Troubleshooting suggestions:'));
      console.log(chalk.yellow('   • Ensure Ollama is running: `ollama list`'));
      console.log(chalk.yellow('   • Ensure LM Studio is running and server is started'));
      console.log(chalk.yellow('   • Check network connectivity to localhost:11434 and localhost:1234'));
      console.log(chalk.yellow('   • Try running with --verbose for detailed logs'));
    }
  }

  /**
   * Save review result to file
   */
  private async saveReviewResult(result: any, outputPath: string): Promise<void> {
    const saveData = {
      timestamp: new Date().toISOString(),
      prompt: result.originalPrompt,
      writer: {
        provider: result.writerOutput.provider,
        model: result.writerOutput.model,
        duration: result.writerOutput.duration,
        code: result.writerOutput.code,
      },
      auditor: {
        provider: result.auditorOutput.provider,
        model: result.auditorOutput.model,
        duration: result.auditorOutput.duration,
        review: result.auditorOutput.review,
      },
      refined: result.refinedOutput,
      summary: {
        totalDuration: result.totalDuration,
        accepted: result.accepted,
      },
    };

    await writeFile(outputPath, JSON.stringify(saveData, null, 2), 'utf-8');
  }

  /**
=======
>>>>>>> 312cb1b60a67735101a751485e0debd903886729
   * Get file type summary
   */
  private getFileTypes(files: string[]): string {
    const types = new Map<string, number>();

    files.forEach(file => {
      const ext = extname(file) || 'no extension';
      types.set(ext, (types.get(ext) || 0) + 1);
    });

    return Array.from(types.entries())
      .map(([ext, count]) => `${ext}(${count})`)
      .join(', ');
  }
}
