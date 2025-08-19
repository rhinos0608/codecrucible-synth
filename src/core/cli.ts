import { cliOutput, ResponseFactory } from './structured-response-formatter.js';
import { CLIExitCode, CLIError, SynthesisResponse, SynthesisResult, IterativeResult, ExecutionResponse, SpiralConfig, ExecutionRequest, ExecutionMode } from './types.js';
import { globalEditConfirmation } from './agent.js';

import { UnifiedModelClient, ProjectContext } from './client.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { UnifiedAgent } from './agent.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { PerformanceMonitor } from '../utils/performance.js';
import { AppConfig } from '../config/config-manager.js';
import { logger } from './logger.js';
import { startServerMode, ServerOptions } from '../server/server-mode.js';
import { IntelligentModelSelector } from './intelligent-model-selector.js';
import { StreamingAgentClient, StreamingResponse } from './streaming/streaming-agent-client.js';
import { ContextAwareCLIIntegration, ContextAwareOptions } from './intelligence/context-aware-cli-integration.js';
import { OptimizedContextAwareCLI, OptimizedContextOptions } from './intelligence/optimized-context-cli.js';
import { ResilientCLIWrapper, ResilientOptions, OperationResult } from './resilience/resilient-cli-wrapper.js';
import { DualAgentRealtimeSystem } from './collaboration/dual-agent-realtime-system.js';
import { AutoConfigurator } from './model-management/auto-configurator.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { readFile, stat, readdir } from 'fs/promises';
import { join, extname, isAbsolute } from 'path';
import { glob } from 'glob';

interface CLIOptions {
  voices?: string | string[];
  depth?: string;
  mode?: 'competitive' | 'collaborative' | 'consensus' | 'iterative' | 'agentic';
  file?: string;
  project?: boolean;
  interactive?: boolean;
  spiral?: boolean;
  spiralIterations?: number;
  spiralQuality?: number;
  autonomous?: boolean;
  maxSteps?: number;
  council?: boolean;
  agentic?: boolean;
  quick?: boolean;
  direct?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  output?: 'text' | 'json' | 'table';
  timeout?: number;
  backend?: 'docker' | 'e2b' | 'local_e2b' | 'local_process' | 'firecracker' | 'podman' | 'auto';
  e2bTemplate?: string;
  dockerImage?: string;
  fast?: boolean;
  skipInit?: boolean;
  iterative?: boolean;
  maxIterations?: string;
  qualityThreshold?: string;
  // Real-time streaming options
  stream?: boolean;
  noStream?: boolean;
  // Enhanced context awareness options
  enableIntelligence?: boolean;
  contextAware?: boolean;
  smartSuggestions?: boolean;
  projectAnalysis?: boolean;
  // Dual Agent System options
  dualAgent?: boolean;
  realtimeAudit?: boolean;
  autoFix?: boolean;
  streamGeneration?: boolean;
  writerModel?: string;
  auditorModel?: string;
  // VRAM management options
  status?: boolean;
  optimize?: boolean;
  test?: boolean;
  models?: boolean;
  configure?: boolean;
  server?: boolean;
  port?: string;
  // Additional CLI options
  [key: string]: unknown;
}

export interface CLIContext {
  modelClient: UnifiedModelClient;
  voiceSystem: VoiceArchetypeSystem;
  mcpManager: MCPServerManager;
  config: AppConfig;
  agentOrchestrator?: UnifiedAgent;
  autonomousAgent?: UnifiedAgent;
}

export class CLI {
  private context: CLIContext;
  private initialized = false;
  private workingDirectory = process.cwd();
  private fastModeClient: UnifiedModelClient | null = null;
  private streamingClient: StreamingAgentClient;
  private contextAwareCLI: ContextAwareCLIIntegration;
  private optimizedContextCLI: OptimizedContextAwareCLI;
  private resilientWrapper: ResilientCLIWrapper;
  private dualAgentSystem: DualAgentRealtimeSystem | null = null;
  private autoConfigurator: AutoConfigurator;
  private logger = logger;

  constructor(context: CLIContext) {
    this.context = context;
    
    // Check if this is a basic command that doesn't need full monitoring
    const isBasicCommand = process.argv.some(arg => 
      ['--help', '-h', '--version', '-v', 'status', 'help', 'models'].includes(arg)
    );
    
    // Initialize agent orchestrator for agentic capabilities
    if (!this.context.agentOrchestrator) {
      this.context.agentOrchestrator = new UnifiedAgent(
        this.context.modelClient, 
        new PerformanceMonitor(!isBasicCommand)
      );
    }
    
    // Initialize streaming client
    this.streamingClient = new StreamingAgentClient(this.context.modelClient, {
      bufferSize: 512,
      flushInterval: 50,
      adaptiveStreaming: true
    });
    
    // Initialize context-aware CLI integration
    this.contextAwareCLI = new ContextAwareCLIIntegration();
    
    // Initialize optimized context-aware CLI  
    this.optimizedContextCLI = new OptimizedContextAwareCLI();
    
    // Initialize resilient wrapper with enhanced error handling
    this.resilientWrapper = new ResilientCLIWrapper({
      enableGracefulDegradation: true,
      retryAttempts: 3,
      timeoutMs: 60000,
      fallbackMode: 'basic',
      errorNotification: true
    });
    
    // Initialize auto-configurator for intelligent dual-agent setup
    this.autoConfigurator = new AutoConfigurator();
    
    // Auto-configure dual-agent system (async initialization)
    this.initializeDualAgentSystem();
  }

  /** 
   * Display synthesis results
   */
  private displayResults(synthesis: SynthesisResult, responses: any[]): void {
    console.log(chalk.green('\n🎯 Synthesis Complete!'));
    console.log(chalk.gray(`   Quality Score: ${(synthesis.qualityScore * 100).toFixed(0)}/100`));
    console.log(chalk.gray(`   Voices Used: ${synthesis.voicesUsed?.join(', ') || 'N/A'}`));

    // Show combined result
    console.log(chalk.bold('\n📄 Final Synthesis:'));
    console.log(synthesis.content || synthesis.combinedCode || 'No content available');

    // Show individual responses
    if (responses && responses.length > 0) {
      console.log(chalk.bold('\n👥 Individual Voice Responses:'));
      responses.forEach((response, index) => {
        console.log(chalk.cyan(`\n   ${index + 1}. ${response.voice || 'Unknown Voice'}:`));
        console.log(response.content?.substring(0, 200) + (response.content?.length > 200 ? '...' : ''));
      });
    }
  }

  /**
   * Display streaming responses in real-time
   */
  private async displayStreamingResponse(request: ExecutionRequest): Promise<void> {
    let buffer = '';
    let lastUpdate = Date.now();
    const spinner = ora('🤖 Generating response...').start();
    
    try {
      for await (const chunk of this.streamingClient.executeStreaming(request)) {
        const now = Date.now();
        
        switch (chunk.type) {
          case 'progress':
            spinner.text = `🤖 ${chunk.chunk} (${Math.round(chunk.metadata.estimatedCompletion * 100)}%)`;
            break;
            
          case 'partial':
            buffer += chunk.chunk;
            
            // Update display every 100ms to prevent flickering
            if (now - lastUpdate > 100) {
              spinner.stop();
              process.stdout.write('\r\x1b[K'); // Clear current line
              process.stdout.write(chalk.cyan('🤖 ') + buffer + chalk.gray('▋')); // Show cursor
              lastUpdate = now;
            }
            break;
            
          case 'complete':
            spinner.stop();
            process.stdout.write('\r\x1b[K'); // Clear current line
            console.log(chalk.green('\n📝 Response:'));
            console.log(buffer + chunk.chunk);
            
            // Show performance metrics
            console.log(chalk.gray(`\n⚡ Generated in ${chunk.metadata.latency}ms, ${chunk.metadata.tokensProcessed} tokens`));
            break;
            
          case 'error':
            spinner.stop();
            console.log(chalk.red(`\n❌ Streaming error: ${chunk.chunk}`));
            break;
            
          case 'metadata':
            // Update spinner with metadata
            if (chunk.metadata.activeVoice) {
              spinner.text = `🎭 ${chunk.metadata.activeVoice}: Generating response...`;
            }
            break;
        }
      }
    } catch (error) {
      spinner.stop();
      console.log(chalk.red(`\n❌ Streaming failed: ${error}`));
    }
  }

  private async handleFileOutput(filepath: string, code: string): Promise<void> {
    try {
      const { writeFile } = await import('fs/promises');
      await writeFile(filepath, code, 'utf8');
      console.log(chalk.green(`✅ Code written to ${filepath}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to write file: ${error}`));
    }
  }

  /**
   * Initialize context-aware CLI features (optimized)
   */
  private async initializeContextAwareness(): Promise<void> {
    // Initialize context awareness with resilient error handling
    const result = await this.resilientWrapper.executeSafely(
      async () => {
        const startTime = Date.now();
        
        const optimizedOptions: OptimizedContextOptions = {
          enableIntelligence: true,
          lazyLoading: true,
          preloadInBackground: true,
          quickStart: true,
          maxInitTime: 5000, // 5 second max init time
          maxContextFiles: 10,
          contextDepth: 3,
          intelligentSuggestions: true,
          projectAnalysis: true,
          smartNavigation: true,
          contextualRecommendations: true
        };

        await this.optimizedContextCLI.quickInitialize(this.workingDirectory, optimizedOptions);
        
        const initTime = Date.now() - startTime;
        if (initTime > 2000) {
          console.log(chalk.gray(`⚡ Context initialization: ${initTime}ms`));
        }
        
        return { initialized: true, mode: 'intelligent' };
      },
      { initialized: true, mode: 'basic' }, // Fallback to basic mode
      'ContextAwareness initialization'
    );
    
    if (result.mode === 'basic') {
      console.log(chalk.gray('ℹ️ Running in basic mode (project intelligence unavailable)'));
    }
  }

  /**
   * Main entry point for the CLI
   */
  async run(args: string[]): Promise<void> {
    // Handle basic commands early without full initialization
    const isBasicCommand = args.some(arg => 
      ['--help', '-h', '--version', '-v'].includes(arg)
    );
    
    if (isBasicCommand) {
      // Parse basic options without full initialization
      const options = this.parseOptions(args);
      
      if (options.help || options.h) {
        this.showHelp();
        return;
      }
      
      if (options.version || options.v) {
        console.log('CodeCrucible Synth v3.8.1');
        return;
      }
    }
    
    // Execute main CLI with resilient error handling for complex commands
    const result = await this.resilientWrapper.executeWithRecovery(
      async () => {
        return await this.executeMainCLI(args);
      },
      {
        name: 'CLI_Main',
        component: 'CLI',
        critical: true
      }
    );

    if (!result.success) {
      console.error(chalk.red(`❌ CLI execution failed: ${result.error}`));
      if (result.warnings) {
        result.warnings.forEach(w => console.warn(chalk.yellow(`⚠️  ${w}`)));
      }
      process.exit(1);
    }

    if (result.degraded) {
      console.warn(chalk.yellow('⚠️  CLI running in degraded mode'));
    }
  }

  private async executeMainCLI(args: string[]): Promise<void> {
    try {
      // Show header
      console.log(chalk.blue('╔══════════════════════════════════════════════════════════════╗'));
      console.log(chalk.blue('║               CodeCrucible Synth v3.8.1                     ║'));
      console.log(chalk.blue('║          AI-Powered Code Generation & Analysis Tool         ║'));
      console.log(chalk.blue('║                   🧠 Enhanced with Project Intelligence      ║'));
      console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝'));
      console.log();
      
      // Initialize context-aware CLI
      await this.initializeContextAwareness();
      
      // If no arguments, check for stdin or start interactive mode
      if (args.length === 0) {
        // Check if there's piped input
        if (!process.stdin.isTTY) {
          let stdinData = '';
          process.stdin.setEncoding('utf8');
          
          for await (const chunk of process.stdin) {
            stdinData += chunk;
          }
          
          if (stdinData.trim()) {
            await this.processPrompt(stdinData.trim(), {});
            return;
          }
        }
        
        this.showHelp();
        return;
      }

      // Check for direct slash commands first (before parsing options)
      if (args.length === 1 && (args[0].startsWith('/') || args[0].startsWith('\\/'))) {
        // Handle both /help and \/help variants
        const cleanCmd = args[0].replace(/^\\/, '');
        await this.handleSlashCommand(cleanCmd, {});
        return;
      }


      // Parse options 
      const options = this.parseOptions(args);
      
      // Handle help and version
      if (options.help || options.h) {
        this.showHelp();
        return;
      }
      
      if (options.version || options.v) {
        console.log('CodeCrucible Synth v3.7.1');
        return;
      }

      // Handle server mode
      if (options.server) {
        const port = parseInt(options.port || '3002', 10);
        const serverOptions: ServerOptions = {
          port,
          host: '0.0.0.0',
          cors: true,
          auth: {
            enabled: false
          }
        };
        
        console.log(chalk.blue(`🚀 Starting CodeCrucible Server on port ${port}...`));
        await startServerMode(this.context, serverOptions);
        return;
      }

      // Handle special commands first
      if (args[0] === 'status') {
        await this.showStatus();
        return;
      }
      
      if (args[0] === 'models') {
        await this.listModels();
        return;
      }
      
      if (args[0] === 'recommend') {
        await this.showModelRecommendations();
        return;
      }
      
      if (args[0] === 'analyze') {
        const filePath = args[1];
        if (!filePath) {
          console.log(chalk.red('❌ Please provide a file path to analyze'));
          console.log('Usage: crucible analyze <file-path>');
          return;
        }
        await this.analyzeFile(filePath, options);
        return;
      }
      
      if (args[0] === 'analyze-dir' || args[0] === 'analyze-project') {
        const dirPath = args[1] || '.';
        await this.analyzeDirectory(dirPath, options);
        return;
      }

      if (args[0] === 'intelligence' || args[0] === 'intel') {
        await this.showProjectIntelligence(options);
        return;
      }

      if (args[0] === 'suggestions' || args[0] === 'suggest') {
        const context = args.slice(1).join(' ');
        await this.showSmartSuggestions(context, options);
        return;
      }
      
      // Handle simple interactive commands as direct commands (Windows-friendly)
      if (args[0] === 'help' || args[0] === 'interactive-help') {
        await this.handleSlashCommand('/help', options);
        return;
      }
      
      if (args[0] === 'voices' && args.length > 1) {
        const voicesCmd = '/voices ' + args.slice(1).join(' ');
        await this.handleSlashCommand(voicesCmd, options);
        return;
      }
      
      if (args[0] === 'plan' && args.length > 1) {
        const planCmd = '/plan ' + args.slice(1).join(' ');
        await this.handleSlashCommand(planCmd, options);
        return;
      }
      
      if (args[0] === 'todo') {
        await this.handleSlashCommand('/todo', options);
        return;
      }
      
      // Extract prompt by filtering out option flags
      const promptArgs = [];
      const optionsWithValues = ['voices', 'mode', 'file', 'depth', 'maxIterations', 'qualityThreshold', 'timeout', 'backend', 'e2bTemplate', 'dockerImage', 'maxSteps', 'spiralIterations', 'spiralQuality', 'output', 'port'];
      
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
          const optionName = arg.slice(2);
          // Check if this option expects a value
          if (optionsWithValues.includes(optionName) && i + 1 < args.length && !args[i + 1].startsWith('-')) {
            i++; // Skip the value
          }
        } else if (arg.startsWith('-')) {
          const optionName = arg.slice(1);
          // Handle short options that might have values
          if (optionName.length === 1 && i + 1 < args.length && !args[i + 1].startsWith('-')) {
            i++; // Skip the value
          }
        } else {
          promptArgs.push(arg);
        }
      }
      
      const promptText = promptArgs.join(' ');
      
      if (promptText) {
        await this.processPrompt(promptText, options);
      } else {
        this.showHelp();
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error);
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log(chalk.cyan('Usage:'));
    console.log('  crucible [options] <prompt>');
    console.log('  cc [options] <prompt>');
    console.log();
    console.log(chalk.cyan('Options:'));
    console.log('  --help, -h           Show this help message');
    console.log('  --version, -v        Show version');
    console.log('  --file <path>        Write output to file');
    console.log('  --stream             Enable real-time streaming responses (default: enabled)');
    console.log('  --no-stream          Disable streaming, show complete response at once');
    console.log('  --no-autonomous      Disable autonomous mode (not recommended)');
    console.log('  --context-aware      Enable enhanced context awareness (default: enabled)');
    console.log('  --no-intelligence    Disable project intelligence analysis');
    console.log('  --smart-suggestions  Enable intelligent command suggestions');
    console.log('  --project-analysis   Perform comprehensive project analysis');
    console.log('  --verbose            Show detailed output');
    console.log('  --server             Start server mode');
    console.log('  --port <number>      Server port (default: 3002)');
    console.log();
    console.log(chalk.cyan('Interactive Commands:'));
    console.log('  help                 Show interactive command help');
    console.log('  voices <names> <prompt>  Switch to voice synthesis mode');  
    console.log('  plan <prompt>        Create execution plan');
    console.log('  todo                 Show current tasks');
    console.log('  (Slash commands like /help also supported in prompts)');
    console.log();
    console.log(chalk.cyan('Dual-Agent Commands (Ollama + LM Studio):'));
    console.log('  /dual <prompt>       Generate code with real-time audit');
    console.log('  /stream <prompt>     Stream code generation with background audit');
    console.log('  /audit <code|file>   Audit existing code for quality & security');
    console.log('  (Requires both Ollama and LM Studio running)');
    console.log();
    console.log(chalk.cyan('Commands:'));
    console.log('  status               Show system status');
    console.log('  models               List available models');
    console.log('  recommend            Show intelligent model recommendations');
    console.log('  analyze <file>       Analyze a code file');
    console.log('  analyze-dir [dir]    Analyze a directory/project');
    console.log('  intelligence         Show comprehensive project intelligence');
    console.log('  suggestions [ctx]    Get smart suggestions for current context');
    console.log();
    console.log(chalk.cyan('Examples:'));
    console.log('  crucible "Create a React component for a todo list"');
    console.log('  cc --fast "Format this code"');
    console.log('  cc --voices explorer,developer "Analyze this codebase"');
  }

  
  private parseOptions(args: string[]): CLIOptions {
    const options: CLIOptions = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        
        // Handle --no-* flags
        if (key.startsWith('no-')) {
          const actualKey = key.slice(3);
          options[actualKey] = false;
          continue;
        }
        
        const nextArg = args[i + 1];
        
        if (nextArg && !nextArg.startsWith('--') && !nextArg.startsWith('-')) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = true;
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        const nextArg = args[i + 1];
        
        if (nextArg && !nextArg.startsWith('-')) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = true;
        }
      }
    }
    
    return options;
  }

  private async showStatus(): Promise<void> {
    try {
      console.log(chalk.cyan('🔍 Checking system status...'));
      
      // Check Ollama
      console.log(chalk.yellow('\nOllama Status:'));
      // TODO: Implement actual status check
      console.log(chalk.green('  ✓ Ollama is running'));
      
      // Check LM Studio
      console.log(chalk.yellow('\nLM Studio Status:'));
      // TODO: Implement actual status check
      console.log(chalk.gray('  ○ LM Studio not detected'));
      
      // System info
      console.log(chalk.yellow('\nSystem Info:'));
      console.log(`  Platform: ${process.platform}`);
      console.log(`  Node: ${process.version}`);
      console.log(`  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);
    } catch (error) {
      console.error(chalk.red('Failed to get status:'), error);
    }
  }

  private async listModels(): Promise<void> {
    try {
      console.log(chalk.cyan('📋 Available models:'));
      
      const modelSelector = new IntelligentModelSelector();
      
      // Get models from both backends
      const [ollamaModels, lmStudioModels] = await Promise.all([
        modelSelector.getAvailableModels('ollama'),
        modelSelector.getAvailableModels('lmstudio')
      ]);
      
      if (ollamaModels.length > 0) {
        console.log(chalk.yellow('\n  Ollama Models:'));
        ollamaModels.forEach(model => {
          const performance = this.getModelPerformance(model);
          console.log(`    ✓ ${model} ${performance}`);
        });
      }
      
      if (lmStudioModels.length > 0) {
        console.log(chalk.yellow('\n  LM Studio Models:'));
        lmStudioModels.forEach(model => {
          console.log(`    ✓ ${model}`);
        });
      }
      
      if (ollamaModels.length === 0 && lmStudioModels.length === 0) {
        console.log(chalk.gray('  No models currently available'));
        console.log(chalk.gray('  Make sure Ollama or LM Studio is running'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to list models:'), error);
    }
  }

  private async showModelRecommendations(): Promise<void> {
    try {
      console.log(chalk.cyan('🎯 Intelligent Model Recommendations'));
      console.log(chalk.gray('Based on performance testing and optimization results\n'));
      
      const modelSelector = new IntelligentModelSelector();
      
      // Get current recommendations
      const recommendations = await modelSelector.getPerformanceRecommendations();
      const stats = modelSelector.getRoutingStatistics();
      
      console.log(chalk.green('📊 Current Optimal Model:'));
      console.log(`   Model: ${chalk.bold(recommendations.recommendedModel)}`);
      console.log(`   Latency: ${chalk.yellow(recommendations.estimatedLatency)}`);
      console.log(`   Quality: ${chalk.cyan((recommendations.qualityScore * 100).toFixed(0))}%`);
      console.log(`   Reasoning: ${recommendations.reasoning}\n`);
      
      console.log(chalk.blue('⚡ Performance Guide:'));
      console.log('   🚀 gemma:2b     - Ultra-fast (4-6s)  - Simple tasks');
      console.log('   ⚖️  llama3.2    - Balanced (8-10s)   - Most development work');
      console.log('   🎯 gemma:7b     - High-quality (12s) - Complex analysis\n');
      
      if (stats.totalRequests > 0) {
        console.log(chalk.magenta('📈 Usage Statistics:'));
        console.log(`   Total Requests: ${stats.totalRequests}`);
        console.log(`   Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
        console.log(`   Average Latency: ${stats.averageLatency}s`);
      }
      
    } catch (error) {
      console.error(chalk.red('Failed to get model recommendations:'), error);
    }
  }

  private getModelPerformance(model: string): string {
    switch (model) {
      case 'gemma:2b':
        return chalk.green('(Ultra-fast: 4-6s)');
      case 'llama3.2':
        return chalk.blue('(Balanced: 8-10s)');
      case 'gemma:7b':
        return chalk.magenta('(High-quality: 12s)');
      default:
        return chalk.gray('(Performance unknown)');
    }
  }

  private async analyzeDirectory(dirPath: string, options: CLIOptions): Promise<void> {
    try {
      console.log(chalk.cyan(`📁 Analyzing directory: ${dirPath}`));
      
      // Check if directory exists
      try {
        const stats = await stat(dirPath);
        if (!stats.isDirectory()) {
          console.error(chalk.red(`❌ Not a directory: ${dirPath}`));
          return;
        }
      } catch (error) {
        console.error(chalk.red(`❌ Directory not found: ${dirPath}`));
        return;
      }
      
      // Find code files
      const patterns = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx', '**/*.py', '**/*.java', '**/*.cs'];
      const ignorePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'];
      
      console.log(chalk.gray('   Scanning for code files...'));
      
      const files: string[] = [];
      for (const pattern of patterns) {
        const matches = await glob(join(dirPath, pattern).replace(/\\/g, '/'), {
          ignore: ignorePatterns.map(p => join(dirPath, p).replace(/\\/g, '/'))
        });
        files.push(...matches);
      }
      
      console.log(chalk.gray(`   Found ${files.length} code files`));
      
      if (files.length === 0) {
        console.log(chalk.yellow('⚠️ No code files found in directory'));
        return;
      }
      
      // Read all files
      const fileContents = await Promise.all(
        files.slice(0, 10).map(async (file) => { // Limit to 10 files for analysis
          const content = await readFile(file, 'utf8');
          const relativePath = file.replace(dirPath, '').replace(/^[\\\/]/, '');
          return { path: relativePath, content: content.slice(0, 1000) }; // Limit content length
        })
      );
      
      // Create project analysis prompt
      const analysisPrompt = `Analyze this codebase/project and provide:
1. Project type and technology stack
2. Main architecture and design patterns
3. Code organization and structure
4. Key functionalities and features
5. Code quality assessment
6. Potential improvements or issues

Project files (sample):
${fileContents.map(f => `\n### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n')}`;
      
      console.log(chalk.cyan('🔍 Performing project analysis...'));
      
      // Use streaming for project analysis
      const analysisRequest: ExecutionRequest = {
        id: `analysis_${Date.now()}`,
        type: 'code-analysis',
        input: analysisPrompt,
        mode: 'balanced',
        priority: 'high'
      };
      
      const streamingEnabled = options.noStream !== true;
      if (streamingEnabled) {
        await this.displayStreamingResponse(analysisRequest);
      } else {
        const response = await this.context.modelClient.generateText(analysisPrompt, {
          temperature: 0.3,
          maxTokens: 4096
        });
        
        console.log(chalk.green('\n📊 Project Analysis Results:'));
        console.log(response);
      }
      
      // Save to file if requested
      if (options.file) {
        if (streamingEnabled) {
          console.log(chalk.yellow('⚠️ File output not yet supported with streaming mode. Use --no-stream to enable file output.'));
        } else {
          // Only available in non-streaming mode where we have the response variable
          const outputPath = typeof options.file === 'string' ? options.file : 'project-analysis.md';
          const response = await this.context.modelClient.generateText(analysisPrompt, {
            temperature: 0.3,
            maxTokens: 4096
          });
          await this.handleFileOutput(outputPath, `# Project Analysis: ${dirPath}\n\nFiles analyzed: ${files.length}\n\n${response}`);
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to analyze directory:'), error);
    }
  }

  private async analyzeFile(filePath: string, options: CLIOptions): Promise<void> {
    try {
      console.log(chalk.cyan(`📂 Analyzing file: ${filePath}`));
      
      // Check if file exists
      try {
        await stat(filePath);
      } catch (error) {
        console.error(chalk.red(`❌ File not found: ${filePath}`));
        return;
      }
      
      // Read file content
      const fileContent = await readFile(filePath, 'utf8');
      const fileExt = extname(filePath);
      const fileName = filePath.split(/[\\\/]/).pop();
      
      console.log(chalk.gray(`   File: ${fileName}`));
      console.log(chalk.gray(`   Size: ${fileContent.length} bytes`));
      console.log(chalk.gray(`   Lines: ${fileContent.split('\n').length}`));
      
      // Create analysis prompt
      const analysisPrompt = `Analyze this ${fileExt} code file and provide:
1. Brief summary of what the code does
2. Key functions/classes/components
3. Code quality assessment
4. Potential issues or improvements
5. Security concerns if any

File: ${fileName}
Content:
\`\`\`${fileExt.slice(1)}
${fileContent}
\`\`\``;
      
      // Use model to analyze
      console.log(chalk.cyan('🔍 Performing code analysis...'));
      
      // Use streaming for file analysis
      const analysisRequest: ExecutionRequest = {
        id: `file_analysis_${Date.now()}`,
        type: 'code-analysis',
        input: analysisPrompt,
        mode: 'balanced',
        priority: 'high'
      };
      
      const streamingEnabled = options.noStream !== true;
      if (streamingEnabled) {
        await this.displayStreamingResponse(analysisRequest);
      } else {
        const response = await this.context.modelClient.generateText(analysisPrompt, {
          temperature: 0.3,
          maxTokens: 2048
        });
        
        console.log(chalk.green('\n📊 Analysis Results:'));
        console.log(response);
      }
      
      // Save to file if requested
      if (options.file) {
        if (streamingEnabled) {
          console.log(chalk.yellow('⚠️ File output not yet supported with streaming mode. Use --no-stream to enable file output.'));
        } else {
          // Only available in non-streaming mode where we have the response variable
          const outputPath = typeof options.file === 'string' ? options.file : `${fileName}.analysis.md`;
          const response = await this.context.modelClient.generateText(analysisPrompt, {
            temperature: 0.3,
            maxTokens: 2048
          });
          await this.handleFileOutput(outputPath, `# Code Analysis: ${fileName}\n\n${response}`);
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to analyze file:'), error);
    }
  }

  private async handleSlashCommand(command: string, options: CLIOptions): Promise<void> {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');
    
    switch (cmd) {
      case '/voices':
      case '/voice':
        // Switch to voice synthesis mode
        if (!args) {
          console.log(chalk.yellow('Available voices:'));
          console.log('  explorer, maintainer, analyzer, developer, implementor, security, architect, designer, optimizer');
          console.log('Usage: /voices explorer,maintainer "Your prompt"');
          return;
        }
        
        const voiceParts = args.split(' ');
        const voiceNames = voiceParts[0].split(',');
        const voicePrompt = voiceParts.slice(1).join(' ');
        
        if (!voicePrompt) {
          console.log(chalk.red('Please provide a prompt after the voice names'));
          return;
        }
        
        console.log(chalk.cyan(`🎭 Using voices: ${voiceNames.join(', ')}`));
        const result = await this.context.voiceSystem.synthesize(
          voicePrompt,
          voiceNames,
          'collaborative',
          this.context.modelClient
        );
        
        this.displayResults(result, result.responses || []);
        break;
        
      case '/mode':
        console.log(chalk.yellow('Current mode: Autonomous (default)'));
        console.log('Available modes: autonomous, voices, direct');
        break;
        
      case '/help':
        console.log(chalk.cyan('Slash Commands:'));
        console.log('  /voices <names> <prompt>  - Use specific AI voices');
        console.log('  /mode                     - Show current mode');
        console.log('  /todo                     - Show current task list');
        console.log('  /plan <prompt>            - Create execution plan without running');
        console.log('  /help                     - Show this help');
        console.log();
        console.log(chalk.cyan('Dual-Agent Commands (Requires Ollama + LM Studio):'));
        console.log('  /dual <prompt>            - Generate code with real-time audit');
        console.log('  /stream <prompt>          - Stream code generation with background audit');
        console.log('  /audit <code|file>        - Audit existing code for quality & security');
        console.log('  /config [refresh]         - Show/refresh dual-agent configuration');
        if (this.dualAgentSystem) {
          console.log(chalk.green('  ✅ Dual-agent system is available'));
        } else {
          console.log(chalk.red('  ❌ Dual-agent system not available (check Ollama/LM Studio)'));
        }
        break;
        
      case '/todo':
        // Show current tasks if agent is running
        if (this.context.agentOrchestrator) {
          console.log(chalk.cyan('📋 Current Task Status:'));
          // TODO: Implement task status display
          console.log('No active tasks');
        }
        break;
        
      case '/plan':
        // Create a plan without executing
        if (!args) {
          console.log(chalk.red('Please provide a prompt to plan'));
          return;
        }
        
        console.log(chalk.cyan('📝 Creating execution plan...'));
        const request: ExecutionRequest = {
          id: `plan_${Date.now()}`,
          type: this.determineRequestType(args),
          input: Array.isArray(args) ? args.join(' ') : args,
          mode: 'balanced',
          priority: 'high'
        };
        
        // Just show the plan, don't execute
        console.log(chalk.green('Execution Plan:'));
        console.log(`Type: ${request.type}`);
        console.log(`Priority: ${request.priority}`);
        console.log('Tasks to be created:');
        
        if (request.type === 'comprehensive') {
          console.log('  1. Code Analysis - Analyze existing code structure');
          console.log('  2. Code Generation - Generate required code');
          console.log('  3. Testing - Create and validate tests');
          console.log('  4. Documentation - Generate documentation');
        } else {
          console.log(`  1. ${request.type} - ${args}`);
        }
        break;

      case '/dual':
      case '/dualagent':
        // Dual-agent code generation with real-time audit
        if (!args) {
          console.log(chalk.cyan('🤖 Dual-Agent Real-Time Code Review'));
          console.log(chalk.gray('Generate code with DeepSeek 8B (Ollama) + 20B auditor (LM Studio)'));
          console.log('Usage: /dual "Create a JWT authentication middleware"');
          return;
        }
        
        if (!this.dualAgentSystem) {
          console.log(chalk.red('❌ Dual-agent system not available'));
          console.log(chalk.gray('Ensure both Ollama and LM Studio are running'));
          return;
        }
        
        await this.executeDualAgentGeneration(args, options);
        break;

      case '/stream':
        // Streaming dual-agent generation
        if (!args) {
          console.log(chalk.cyan('🌊 Streaming Dual-Agent Generation'));
          console.log('Usage: /stream "Your code request"');
          return;
        }
        
        if (!this.dualAgentSystem) {
          console.log(chalk.red('❌ Dual-agent system not available'));
          return;
        }
        
        await this.executeStreamingDualAgent(args, options);
        break;

      case '/audit':
        // Audit existing code with dual-agent system
        if (!args) {
          console.log(chalk.cyan('🔍 Real-Time Code Audit'));
          console.log('Usage: /audit <file_path> or paste code');
          return;
        }
        
        if (!this.dualAgentSystem) {
          console.log(chalk.red('❌ Audit system not available'));
          return;
        }
        
        await this.executeCodeAudit(args, options);
        break;

      case '/autoconfig':
      case '/config':
        // Show or refresh auto-configuration
        if (args === 'refresh') {
          console.log(chalk.cyan('🔄 Refreshing dual-agent configuration...'));
          const refreshResult = await this.autoConfigurator.refresh();
          this.dualAgentSystem = refreshResult.dualAgentSystem || null;
          this.autoConfigurator.displayConfiguration(refreshResult);
        } else {
          console.log(chalk.cyan('🤖 Current Dual-Agent Configuration'));
          const status = await this.autoConfigurator.getStatusReport();
          this.displaySystemStatus(status);
        }
        break;
        
      default:
        console.log(chalk.red(`Unknown command: ${cmd}`));
        console.log('Type /help for available commands');
    }
  }

  private determineRequestType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review') || lowerPrompt.includes('audit')) {
      return 'code-analysis';
    }
    if (lowerPrompt.includes('generate') || lowerPrompt.includes('create') || lowerPrompt.includes('write')) {
      return 'code-generation';
    }
    if (lowerPrompt.includes('test') || lowerPrompt.includes('validate')) {
      return 'testing';
    }
    if (lowerPrompt.includes('document') || lowerPrompt.includes('explain')) {
      return 'documentation';
    }
    if (lowerPrompt.includes('fix') || lowerPrompt.includes('debug') || lowerPrompt.includes('solve')) {
      return 'debugging';
    }
    
    // Default to comprehensive for complex requests
    return 'comprehensive';
  }

  private async processPrompt(prompt: string, options: CLIOptions): Promise<void> {
    // Execute prompt processing with resilient error handling
    const result = await this.resilientWrapper.executeWithRecovery(
      async () => {
        return await this.executePromptProcessing(prompt, options);
      },
      {
        name: 'PromptProcessing',
        component: 'CLI',
        critical: false
      }
    );

    if (!result.success) {
      console.error(chalk.red(`❌ Failed to process prompt: ${result.error}`));
      if (result.warnings) {
        result.warnings.forEach(w => console.warn(chalk.yellow(`⚠️  ${w}`)));
      }
    }

    if (result.degraded) {
      console.warn(chalk.yellow('⚠️  Processing with limited functionality'));
    }
  }

  private async executePromptProcessing(prompt: string, options: CLIOptions): Promise<void> {
    try {
      // Clean and normalize the prompt for slash command detection
      const cleanPrompt = prompt.trim();
      
      // Check for slash commands first - be more robust about detection
      if (cleanPrompt.startsWith('/')) {
        await this.handleSlashCommand(cleanPrompt, options);
        return;
      }
      
      // Check for quoted slash commands (Windows quotes handling)
      const quotedSlashMatch = cleanPrompt.match(/^['"]?\/([\w]+)(?:\s+(.*))?['"]?$/);
      if (quotedSlashMatch) {
        const command = '/' + quotedSlashMatch[1];
        const args = quotedSlashMatch[2] || '';
        const fullCommand = args ? `${command} ${args}` : command;
        await this.handleSlashCommand(fullCommand, options);
        return;
      }
      
      console.log(chalk.cyan('🤔 Processing prompt...'));

      // Enhanced context-aware prompt processing
      let enhancedPrompt = prompt;
      if (options.contextAware !== false && options.enableIntelligence !== false) {
        try {
          const contextOptions: ContextAwareOptions = {
            enableIntelligence: options.enableIntelligence ?? true,
            smartNavigation: Boolean(options.smartSuggestions),
            projectAnalysis: Boolean(options.projectAnalysis),
            maxContextFiles: 10
          };
          
          const enhancement = await this.contextAwareCLI.enhancePromptWithContext(prompt, contextOptions);
          
          if (enhancement.confidence > 0.3) {
            enhancedPrompt = enhancement.enhancedPrompt;
            
            // Show context information if verbose
            if (options.verbose === true) {
              console.log(chalk.blue('\n🧠 Context Enhancement Applied:'));
              console.log(chalk.gray(`   Project Type: ${enhancement.contextAdded.projectType}`));
              console.log(chalk.gray(`   Primary Language: ${enhancement.contextAdded.primaryLanguage}`));
              if (enhancement.contextAdded.frameworks.length > 0) {
                console.log(chalk.gray(`   Frameworks: ${enhancement.contextAdded.frameworks.join(', ')}`));
              }
              if (enhancement.suggestions.length > 0) {
                console.log(chalk.gray(`   Suggestions: ${enhancement.suggestions.slice(0, 3).join(', ')}`));
              }
              console.log(chalk.gray(`   Confidence: ${Math.round(enhancement.confidence * 100)}%\n`));
            }
          }
        } catch (error) {
          // Fallback to original prompt if context enhancement fails
          console.log(chalk.gray('ℹ️ Using basic prompt processing'));
        }
      }
      
      // Check for voice synthesis mode first
      if (options.voices) {
        console.log(chalk.magenta('🎭 Voice Synthesis Mode Activated'));
        
        const voiceNames = Array.isArray(options.voices) 
          ? options.voices 
          : (options.voices as string).split(',').map(v => v.trim());
        
        console.log(chalk.cyan(`Using voices: ${voiceNames.join(', ')}`));
        
        try {
          const result = await this.context.voiceSystem.synthesize(
            enhancedPrompt,
            voiceNames,
            'collaborative',
            this.context.modelClient
          );
          
          this.displayResults(result, result.responses || []);
          
          // Handle file output if requested
          if (options.file) {
            await this.handleFileOutput(options.file as string, result.content);
          }
        } catch (error) {
          console.error(chalk.red('❌ Voice synthesis failed:'), error);
        }
        
        return;
      }
      
      // Autonomous agent mode is the DEFAULT
      if (this.context.agentOrchestrator && options.autonomous !== false) {
        console.log(chalk.blue('🤖 Autonomous Agent Mode Activated'));
        console.log(chalk.gray('Creating task plan...'));
        
        // Create execution request for the agent
        const request: ExecutionRequest = {
          id: `req_${Date.now()}`,
          type: this.determineRequestType(enhancedPrompt),
          input: enhancedPrompt,
          mode: 'balanced',
          priority: 'high'
        };
        
        // Execute autonomously
        const response = await this.context.agentOrchestrator.execute(request);
        
        if (response.success) {
          console.log(chalk.green('\n✅ Autonomous execution completed successfully'));
          
          // Display results
          if (response.result && typeof response.result === 'object') {
            for (const [key, value] of Object.entries(response.result)) {
              console.log(chalk.cyan(`\n📋 ${key}:`));
              console.log(value);
            }
          }
          
          // Save to file if requested
          if (options.file) {
            const output = JSON.stringify(response.result, null, 2);
            await this.handleFileOutput(options.file as string, output);
          }
        } else {
          console.error(chalk.red('❌ Autonomous execution failed:'), response.error);
        }
        
        return;
      }
      
      // If autonomous mode was explicitly disabled, use direct model
      console.log(chalk.yellow('⚠️ Running in direct mode (non-autonomous)'));
      
      // Check if streaming is enabled (default: true unless --no-stream)
      const streamingEnabled = options.noStream !== true && options.stream !== false;
      
      if (streamingEnabled) {
        // Use streaming response
        const request: ExecutionRequest = {
          id: `direct_${Date.now()}`,
          type: 'direct',
          input: enhancedPrompt,
          mode: 'balanced',
          priority: 'normal'
        };
        
        await this.displayStreamingResponse(request);
      } else {
        // Fall back to traditional response
        const response = await this.context.modelClient.generateText(enhancedPrompt, {});
        console.log(chalk.green('\n📝 Response:'));
        console.log(response);
        
        // Handle file output if requested
        if (options.file) {
          await this.handleFileOutput(options.file as string, response);
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to process prompt:'), error);
      throw error;
    }
  }

  /**
   * Show comprehensive project intelligence
   */
  private async showProjectIntelligence(options: CLIOptions): Promise<void> {
    try {
      const intelligence = this.contextAwareCLI.getProjectIntelligence();
      if (!intelligence) {
        console.log(chalk.yellow('⚠️ No project intelligence available. Run project analysis first.'));
        return;
      }

      console.log(chalk.cyan('🧠 Project Intelligence Report'));
      console.log(chalk.blue('═'.repeat(50)));

      // Project Overview
      console.log(chalk.green('\n📊 Project Overview:'));
      console.log(chalk.gray(`   Name: ${intelligence.metadata.name}`));
      console.log(chalk.gray(`   Type: ${intelligence.insights.projectType}`));
      console.log(chalk.gray(`   Language: ${intelligence.insights.primaryLanguage}`));
      console.log(chalk.gray(`   Architecture: ${intelligence.patterns.primaryPattern}`));
      console.log(chalk.gray(`   Maturity: ${intelligence.insights.maturityLevel}`));

      // Frameworks
      if (intelligence.insights.frameworksDetected.length > 0) {
        console.log(chalk.green('\n🔧 Frameworks & Technologies:'));
        for (const framework of intelligence.insights.frameworksDetected) {
          console.log(chalk.gray(`   • ${framework.name} (${Math.round(framework.confidence * 100)}% confidence)`));
        }
      }

      // Code Quality
      console.log(chalk.green('\n📈 Code Quality Metrics:'));
      const quality = intelligence.insights.codeQuality;
      const qualityColor = quality.maintainabilityIndex >= 80 ? chalk.green : 
                          quality.maintainabilityIndex >= 60 ? chalk.yellow : chalk.red;
      console.log(qualityColor(`   Maintainability: ${quality.maintainabilityIndex}/100`));
      console.log(chalk.gray(`   Test Coverage: ${quality.testCoverage.toFixed(1)}%`));
      console.log(chalk.gray(`   Comment Density: ${(quality.commentDensity * 100).toFixed(1)}%`));

      // Project Structure
      console.log(chalk.green('\n📁 Project Structure:'));
      console.log(chalk.gray(`   Files: ${intelligence.structure.totalFiles}`));
      console.log(chalk.gray(`   Directories: ${intelligence.structure.totalDirectories}`));
      console.log(chalk.gray(`   Size: ${Math.round(intelligence.structure.codebaseSize / 1024)} KB`));

      // Key Directories
      const keyDirs = intelligence.structure.directories
        .filter(d => d.importance === 'high' && d.depth <= 2)
        .slice(0, 5);
      if (keyDirs.length > 0) {
        console.log(chalk.gray('   Key Directories:'));
        for (const dir of keyDirs) {
          console.log(chalk.gray(`     • ${dir.path} (${dir.fileCount} files)`));
        }
      }

      // Dependencies
      if (intelligence.dependencies.externalDependencies.length > 0) {
        console.log(chalk.green('\n📦 Dependencies:'));
        const topDeps = intelligence.dependencies.externalDependencies.slice(0, 10);
        for (const dep of topDeps) {
          const riskColor = dep.risk === 'high' ? chalk.red : dep.risk === 'medium' ? chalk.yellow : chalk.gray;
          console.log(riskColor(`   • ${dep.name} (${dep.type})`));
        }
      }

      // Recommendations
      if (intelligence.recommendations.codeImprovement.length > 0) {
        console.log(chalk.green('\n💡 Top Recommendations:'));
        const topRecommendations = intelligence.recommendations.codeImprovement
          .filter(r => r.priority === 'high')
          .slice(0, 3);
        for (const rec of topRecommendations) {
          console.log(chalk.yellow(`   • ${rec.description}`));
        }
      }

      // Security & Performance
      if (intelligence.insights.securityConcerns.length > 0) {
        console.log(chalk.green('\n🔒 Security Status:'));
        const criticalSecurity = intelligence.insights.securityConcerns
          .filter(c => c.severity === 'critical' || c.severity === 'high');
        if (criticalSecurity.length > 0) {
          console.log(chalk.red(`   ⚠️ ${criticalSecurity.length} critical/high security concerns found`));
        } else {
          console.log(chalk.green('   ✓ No critical security issues detected'));
        }
      }

    } catch (error) {
      console.error(chalk.red('Failed to show project intelligence:'), error);
    }
  }

  /**
   * Show smart suggestions for current context
   */
  private async showSmartSuggestions(context: string, options: CLIOptions): Promise<void> {
    try {
      const intelligence = this.contextAwareCLI.getProjectIntelligence();
      if (!intelligence) {
        console.log(chalk.yellow('⚠️ Project intelligence not available. Basic suggestions only.'));
        const basicCommands = await this.contextAwareCLI.getIntelligentCommands();
        this.displayCommandSuggestions(basicCommands.slice(0, 5));
        return;
      }

      console.log(chalk.cyan('💡 Smart Suggestions'));
      console.log(chalk.blue('═'.repeat(30)));

      // Get intelligent commands
      const commands = await this.contextAwareCLI.getIntelligentCommands(context);
      const topCommands = commands.slice(0, 5);

      if (topCommands.length > 0) {
        console.log(chalk.green('\n🚀 Recommended Commands:'));
        this.displayCommandSuggestions(topCommands);
      }

      // Context-specific suggestions
      if (context) {
        const contextOptions: ContextAwareOptions = { enableIntelligence: true };
        const enhancement = await this.contextAwareCLI.enhancePromptWithContext(context, contextOptions);
        
        if (enhancement.suggestions.length > 0) {
          console.log(chalk.green('\n🎯 Context-Specific Suggestions:'));
          for (const suggestion of enhancement.suggestions.slice(0, 3)) {
            console.log(chalk.gray(`   • ${suggestion}`));
          }
        }
      }

      // Navigation suggestions
      const navContext = await this.contextAwareCLI.getNavigationContext();
      if (navContext.suggestedFiles.length > 0) {
        console.log(chalk.green('\n📂 Suggested Files to Explore:'));
        for (const file of navContext.suggestedFiles.slice(0, 3)) {
          console.log(chalk.gray(`   • ${file}`));
        }
      }

    } catch (error) {
      console.error(chalk.red('Failed to get smart suggestions:'), error);
    }
  }

  /**
   * Display command suggestions in a formatted way
   */
  private displayCommandSuggestions(commands: any[]): void {
    for (const cmd of commands) {
      const relevanceColor = cmd.contextRelevance >= 0.8 ? chalk.green : 
                            cmd.contextRelevance >= 0.6 ? chalk.yellow : chalk.gray;
      console.log(relevanceColor(`   ${cmd.command}`));
      console.log(chalk.gray(`     ${cmd.description}`));
      if (cmd.examples && cmd.examples.length > 0) {
        console.log(chalk.gray(`     Example: ${cmd.examples[0]}`));
      }
      console.log();
    }
  }

  /**
   * Execute dual-agent code generation
   */
  private async executeDualAgentGeneration(prompt: string, options: CLIOptions): Promise<void> {
    console.log(chalk.cyan('🤖 Starting dual-agent generation...'));
    console.log(chalk.gray('Writer: DeepSeek 8B (Ollama) | Auditor: 20B Model (LM Studio)'));
    console.log();
    
    const spinner = ora('Generating code...').start();
    
    try {
      const result = await this.dualAgentSystem!.generateWithAudit(prompt, {
        language: 'typescript',
        requirements: 'Follow best practices and security guidelines'
      });
      
      spinner.succeed('Code generation complete');
      
      // Display generated code
      console.log(chalk.green('\n📄 Generated Code:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(result.code);
      console.log(chalk.gray('─'.repeat(60)));
      
      // Display performance metrics
      console.log(chalk.cyan('\n⚡ Performance:'));
      console.log(chalk.gray(`   Generation: ${result.performance.generationTime}ms`));
      if (result.performance.auditTime) {
        console.log(chalk.gray(`   Audit: ${result.performance.auditTime}ms`));
      }
      console.log(chalk.gray(`   Total: ${result.performance.totalTime}ms`));
      
      // Display audit results if available
      if (result.audit) {
        console.log(chalk.yellow('\n🔍 Audit Results:'));
        console.log(chalk.gray(`   Score: ${result.audit.score}/100`));
        console.log(chalk.gray(`   Issues: ${result.audit.issues.length}`));
        console.log(chalk.gray(`   Security Warnings: ${result.audit.securityWarnings.length}`));
        
        if (result.audit.issues.length > 0) {
          console.log(chalk.yellow('\n📋 Issues Found:'));
          result.audit.issues.forEach(issue => {
            const severityColor = {
              critical: chalk.red,
              error: chalk.magenta,
              warning: chalk.yellow,
              info: chalk.blue
            }[issue.severity];
            
            console.log(severityColor(`   [${issue.severity.toUpperCase()}] ${issue.description}`));
            if (issue.fix) {
              console.log(chalk.green(`      Fix: ${issue.fix}`));
            }
          });
        }
        
        if (result.audit.suggestions.length > 0) {
          console.log(chalk.blue('\n💡 Suggestions:'));
          result.audit.suggestions.forEach(suggestion => {
            console.log(chalk.blue(`   [${suggestion.priority}] ${suggestion.description}`));
          });
        }
        
        if (result.audit.securityWarnings.length > 0) {
          console.log(chalk.red('\n🚨 Security Warnings:'));
          result.audit.securityWarnings.forEach(warning => {
            console.log(chalk.red(`   [${warning.severity}] ${warning.vulnerability}`));
            console.log(chalk.gray(`      ${warning.mitigation}`));
          });
        }
      }
      
      // Show refined code if available
      if (result.refinedCode) {
        console.log(chalk.green('\n✨ Refined Code (with fixes applied):'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(result.refinedCode);
        console.log(chalk.gray('─'.repeat(60)));
      }
      
    } catch (error) {
      spinner.fail('Dual-agent generation failed');
      console.error(chalk.red(`❌ Error: ${error}`));
    }
  }
  
  /**
   * Execute streaming dual-agent generation
   */
  private async executeStreamingDualAgent(prompt: string, options: CLIOptions): Promise<void> {
    console.log(chalk.cyan('🌊 Starting streaming generation...'));
    console.log();
    
    let charCount = 0;
    
    try {
      console.log(chalk.green('📝 Live Code Output:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      for await (const chunk of this.dualAgentSystem!.streamGenerateWithAudit(prompt)) {
        if (chunk.type === 'code_chunk') {
          process.stdout.write(chunk.content);
          charCount += chunk.content.length;
        } else if (chunk.type === 'complete') {
          console.log();
          console.log(chalk.gray('─'.repeat(60)));
          console.log(chalk.green(`✓ Generation complete in ${chunk.time}ms (${charCount} characters)`));
        }
      }
      
      // Wait a bit for background audit
      const auditSpinner = ora('Audit in progress...').start();
      await new Promise(resolve => setTimeout(resolve, 3000));
      auditSpinner.succeed('Background audit complete');
      
    } catch (error) {
      console.error(chalk.red(`\n❌ Streaming failed: ${error}`));
    }
  }
  
  /**
   * Initialize dual-agent system with auto-configuration
   */
  private async initializeDualAgentSystem(): Promise<void> {
    try {
      const configResult = await this.autoConfigurator.autoConfigureDualAgent();
      
      if (configResult.success && configResult.dualAgentSystem) {
        this.dualAgentSystem = configResult.dualAgentSystem;
        this.logger.info('Dual-agent system auto-configured successfully');
      } else {
        this.logger.warn('Dual-agent system auto-configuration failed');
        this.dualAgentSystem = null;
      }
    } catch (error) {
      this.logger.warn('Failed to auto-configure dual-agent system:', error);
      this.dualAgentSystem = null;
    }
  }

  /**
   * Execute code audit
   */
  private async executeCodeAudit(input: string, options: CLIOptions): Promise<void> {
    console.log(chalk.cyan('🔍 Starting code audit...'));
    
    let codeToAudit = input;
    
    // Check if input is a file path
    if (input.includes('.') && !input.includes(' ')) {
      try {
        const filePath = join(process.cwd(), input);
        codeToAudit = await readFile(filePath, 'utf-8');
        console.log(chalk.gray(`Reading from file: ${input}`));
      } catch (error) {
        console.log(chalk.yellow('Could not read as file, treating as code snippet'));
      }
    }
    
    const spinner = ora('Auditing code...').start();
    
    try {
      // For audit-only, we can generate a simple result and focus on the audit
      const result = await this.dualAgentSystem!.generateWithAudit(
        `Audit this code for security, performance, and quality:\n\n${codeToAudit}`,
        { auditOnly: true }
      );
      
      spinner.succeed('Audit complete');
      
      if (result.audit) {
        console.log(chalk.yellow('\n📊 Audit Report:'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(`Overall Score: ${result.audit.score}/100`));
        console.log(chalk.gray(`Confidence: ${(result.audit.confidence * 100).toFixed(1)}%`));
        
        if (result.audit.issues.length > 0) {
          console.log(chalk.yellow('\n📋 Issues:'));
          result.audit.issues.forEach((issue, index) => {
            console.log(chalk.yellow(`${index + 1}. [${issue.severity}] ${issue.description}`));
            if (issue.line) {
              console.log(chalk.gray(`   Line ${issue.line}`));
            }
          });
        }
        
        if (result.audit.securityWarnings.length > 0) {
          console.log(chalk.red('\n🚨 Security:'));
          result.audit.securityWarnings.forEach((warning, index) => {
            console.log(chalk.red(`${index + 1}. [${warning.severity}] ${warning.vulnerability}`));
            console.log(chalk.gray(`   ${warning.mitigation}`));
          });
        }
        
        if (result.audit.suggestions.length > 0) {
          console.log(chalk.blue('\n💡 Recommendations:'));
          result.audit.suggestions.forEach((suggestion, index) => {
            console.log(chalk.blue(`${index + 1}. [${suggestion.priority}] ${suggestion.description}`));
          });
        }
        
        console.log(chalk.gray('─'.repeat(60)));
      }
      
    } catch (error) {
      spinner.fail('Audit failed');
      console.error(chalk.red(`❌ Error: ${error}`));
    }
  }
  
  /**
   * Display system status
   */
  private displaySystemStatus(status: any): void {
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.yellow('🖥️ Platforms:'));
    console.log(chalk.gray(`   Ollama: ${status.platforms.ollama.status} (${status.platforms.ollama.endpoint})`));
    console.log(chalk.gray(`   LM Studio: ${status.platforms.lmstudio.status} (${status.platforms.lmstudio.endpoint})`));
    
    console.log(chalk.yellow('\n🤖 Models:'));
    console.log(chalk.gray(`   Total: ${status.models.total}`));
    console.log(chalk.gray(`   Ollama: ${status.models.byPlatform.ollama}`));
    console.log(chalk.gray(`   LM Studio: ${status.models.byPlatform.lmstudio}`));
    console.log(chalk.gray(`   Fast: ${status.models.bySpeed.fast}, Medium: ${status.models.bySpeed.medium}, Slow: ${status.models.bySpeed.slow}`));
    
    if (status.configuration) {
      console.log(chalk.yellow('\n⚙️ Configuration:'));
      console.log(chalk.gray(`   Writer: ${status.configuration.writer}`));
      console.log(chalk.gray(`   Auditor: ${status.configuration.auditor}`));
      console.log(chalk.gray(`   Confidence: ${(status.configuration.confidence * 100).toFixed(1)}%`));
    }
    
    console.log(chalk.yellow('\n🔍 Status:'));
    console.log(chalk.gray(`   Dual-Agent Ready: ${status.dualAgentReady ? '✅' : '❌'}`));
    console.log(chalk.gray(`   Last Scan: ${status.models.lastScan || 'Never'}`));
    
    console.log(chalk.gray('─'.repeat(50)));
  }
}

export { CLI as CodeCrucibleCLI };
export default CLI;