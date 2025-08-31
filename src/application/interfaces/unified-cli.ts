/**
 * Unified CLI - Backward Compatible Interface
 * 
 * This replaces the complex 25k+ token main CLI with a clean interface
 * that leverages the UnifiedCLICoordinator. Preserves all existing functionality
 * while eliminating complexity and circular dependencies.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import { CLIExitCode, CLIError, ModelRequest, REPLInterface } from '../../domain/types/index.js';
import { UnifiedCLICoordinator, CLIOperationRequest, CLIOperationResponse, CLISession, UnifiedCLIOptions } from '../services/unified-cli-coordinator.js';
import { IWorkflowOrchestrator } from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus, getGlobalEventBus } from '../../domain/interfaces/event-bus.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { CLIUserInteraction } from '../../infrastructure/user-interaction/cli-user-interaction.js';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

export interface CLIOptions {
  verbose?: boolean;
  stream?: boolean;
  contextAware?: boolean;
  autonomousMode?: boolean;
  performance?: boolean;
  resilience?: boolean;
}

export interface CLIContext {
  workingDirectory: string;
  sessionId?: string;
  options: CLIOptions;
  startTime: number;
}

/**
 * Unified CLI - Clean interface using UnifiedCLICoordinator
 */
export class UnifiedCLI extends EventEmitter implements REPLInterface {
  private coordinator: UnifiedCLICoordinator;
  private orchestrator!: IWorkflowOrchestrator;
  private userInteraction: IUserInteraction;
  private eventBus: IEventBus;
  private logger: ILogger;
  
  private context: CLIContext;
  private currentSession: CLISession | null = null;
  private initialized = false;

  constructor(options: CLIOptions = {}) {
    super();
    
    // Create context
    this.context = {
      workingDirectory: process.cwd(),
      options: {
        verbose: false,
        stream: false,
        contextAware: true,
        autonomousMode: false,
        performance: true,
        resilience: true,
        ...options
      },
      startTime: performance.now()
    };

    // Initialize user interaction, event bus, and logger
    this.userInteraction = new CLIUserInteraction({ verbose: this.context.options.verbose });
    this.eventBus = getGlobalEventBus();
    this.logger = createLogger('UnifiedCLI');

    // Create simplified coordinator with proper options
    const coordinatorOptions: UnifiedCLIOptions = {
      enableGracefulDegradation: true,
      retryAttempts: 3,
      timeoutMs: 30000,
      fallbackMode: 'basic',
      errorNotification: this.context.options.verbose || false,
      enableContextIntelligence: this.context.options.contextAware,
      enablePerformanceOptimization: this.context.options.performance,
      enableErrorResilience: this.context.options.resilience
    };

    this.coordinator = new UnifiedCLICoordinator(coordinatorOptions);
    this.setupEventHandlers();
  }

  /**
   * Initialize the CLI with workflow orchestrator
   */
  async initialize(orchestrator: IWorkflowOrchestrator): Promise<void> {
    try {
      this.orchestrator = orchestrator;
      
      // Initialize the coordinator
      await this.coordinator.initialize({
        orchestrator,
        userInteraction: this.userInteraction,
        eventBus: this.eventBus
      });

      // Create initial session
      this.currentSession = await this.coordinator.createSession(this.context.workingDirectory);
      this.context.sessionId = this.currentSession.id;

      this.initialized = true;
      
      if (this.context.options.verbose) {
        await this.userInteraction.display('Unified CLI initialized successfully', { type: 'success' });
      }
      
      this.emit('initialized');
      this.logger.info('UnifiedCLI initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize UnifiedCLI:', error);
      throw error;
    }
  }

  /**
   * Process a user prompt
   */
  async processPrompt(prompt: string, options: any = {}): Promise<string> {
    if (!this.initialized) {
      throw new Error('CLI not initialized. Call initialize() first.');
    }

    try {
      const request: CLIOperationRequest = {
        id: randomUUID(),
        type: 'prompt',
        input: prompt,
        options: { ...this.context.options, ...options },
        session: this.currentSession || undefined
      };

      const response = await this.coordinator.processOperation(request);
      
      if (response.success) {
        if (this.context.options.verbose && response.enhancements) {
          const enhancements = [];
          if (response.enhancements.contextAdded) enhancements.push('context-enhanced');
          if (response.enhancements.performanceOptimized) enhancements.push('performance-optimized');
          if (response.enhancements.errorsRecovered && response.enhancements.errorsRecovered > 0) {
            enhancements.push(`${response.enhancements.errorsRecovered} errors recovered`);
          }
          
          if (enhancements.length > 0) {
            await this.userInteraction.display(
              `✨ Enhanced: ${enhancements.join(', ')}`,
              { type: 'info' }
            );
          }
        }

        return this.formatResponse(response.result);
      } else {
        throw new Error(response.error || 'Processing failed');
      }

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await this.userInteraction.error(`Error processing prompt: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Analyze a file
   */
  async analyzeFile(filePath: string, options: any = {}): Promise<any> {
    if (!this.initialized) {
      throw new Error('CLI not initialized. Call initialize() first.');
    }

    try {
      const request: CLIOperationRequest = {
        id: randomUUID(),
        type: 'analyze',
        input: filePath,
        options: { ...this.context.options, ...options },
        session: this.currentSession || undefined
      };

      const response = await this.coordinator.processOperation(request);
      
      if (response.success) {
        return response.result;
      } else {
        throw new Error(response.error || 'Analysis failed');
      }

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await this.userInteraction.error(`File analysis failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName: string, args: any = {}, options: any = {}): Promise<any> {
    if (!this.initialized) {
      throw new Error('CLI not initialized. Call initialize() first.');
    }

    try {
      const request: CLIOperationRequest = {
        id: randomUUID(),
        type: 'execute',
        input: { toolName, args },
        options: { ...this.context.options, ...options },
        session: this.currentSession || undefined
      };

      const response = await this.coordinator.processOperation(request);
      
      if (response.success) {
        return response.result;
      } else {
        throw new Error(response.error || 'Tool execution failed');
      }

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await this.userInteraction.error(`Tool execution failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get intelligent command suggestions
   */
  async getSuggestions(context?: string): Promise<any[]> {
    if (!this.initialized) {
      return [];
    }

    try {
      const commands = await this.coordinator.getIntelligentCommands(context);
      return commands.map(cmd => ({
        command: cmd.command,
        description: cmd.description,
        examples: cmd.examples,
        relevance: cmd.contextRelevance
      }));
    } catch (error) {
      this.logger.warn('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Start interactive REPL mode
   */
  async startInteractive(): Promise<void> {
    if (!this.currentSession) {
      this.currentSession = await this.coordinator.createSession(this.context.workingDirectory);
      this.context.sessionId = this.currentSession.id;
    }

    await this.userInteraction.display('🚀 Starting interactive mode...', { type: 'info' });
    await this.userInteraction.display('Type "exit", "quit", or press Ctrl+C to quit.', { type: 'info' });

    // Show quick context status if available
    try {
      const contextStatus = await this.coordinator.getQuickContextStatus();
      if (contextStatus.available && contextStatus.basic) {
        await this.userInteraction.display(
          `📊 Project: ${contextStatus.basic.type} (${contextStatus.basic.language}) - Confidence: ${(contextStatus.confidence * 100).toFixed(0)}%`,
          { type: 'info' }
        );
      }
    } catch (error) {
      // Silent fail for context status
    }

    let running = true;
    while (running) {
      try {
        const input = await this.userInteraction.prompt('🤖 > ');
        
        if (['exit', 'quit', '.exit', '.quit'].includes(input.trim().toLowerCase())) {
          running = false;
          continue;
        }

        if (input.trim() === '') {
          continue;
        }

        // Special commands
        if (input.trim() === 'help' || input.trim() === '.help') {
          await this.showHelp();
          continue;
        }

        if (input.trim() === 'status' || input.trim() === '.status') {
          await this.showStatus();
          continue;
        }

        if (input.trim() === 'suggestions' || input.trim() === '.suggestions') {
          await this.showSuggestions();
          continue;
        }

        const response = await this.processPrompt(input.trim());
        await this.userInteraction.display(response);
        
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        await this.userInteraction.error(`Error: ${errorMessage}`);
        
        // Ask if user wants to continue
        const continueSession = await this.userInteraction.confirm('Continue session?');
        if (!continueSession) {
          running = false;
        }
      }
    }

    await this.userInteraction.display('👋 Interactive session ended.', { type: 'success' });
  }

  /**
   * Run CLI with command line arguments
   */
  async run(args: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('CLI not initialized. Call initialize() first.');
    }

    try {
      if (args.length === 0) {
        // No arguments - start interactive mode
        await this.startInteractive();
        return;
      }

      // Parse command line arguments
      const command = args[0];
      const remainingArgs = args.slice(1);

      switch (command) {
        case 'interactive':
        case '-i':
        case '--interactive':
          await this.startInteractive();
          break;
          
        case 'analyze':
        case '--analyze':
          if (remainingArgs.length === 0) {
            await this.userInteraction.error('analyze command requires a file path');
            return;
          }
          const result = await this.analyzeFile(remainingArgs[0]);
          await this.userInteraction.display(JSON.stringify(result, null, 2));
          break;

        case 'status':
        case '--status':
          await this.showStatus();
          break;

        case 'help':
        case '--help':
        case '-h':
          await this.showHelp();
          break;
          
        default:
          // Treat as a prompt
          const prompt = args.join(' ');
          const response = await this.processPrompt(prompt);
          await this.userInteraction.display(response);
          break;
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await this.userInteraction.error(`CLI error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Show help information
   */
  private async showHelp(): Promise<void> {
    const help = `
${chalk.cyan('🤖 Unified CLI - AI-Powered Development Assistant')}

${chalk.yellow('Usage:')}
  Interactive mode: Start without arguments or use -i, --interactive
  Single command:   Provide your request as arguments
  File analysis:    analyze <filepath>
  Status check:     status

${chalk.yellow('Interactive Commands:')}
  help, .help         - Show this help
  status, .status     - Show system status
  suggestions, .suggestions - Show intelligent suggestions
  exit, quit, .exit   - Exit interactive mode

${chalk.yellow('Features:')}
  ✨ Context-aware responses based on your project
  🚀 Performance-optimized with lazy loading
  🛡️  Error resilience with automatic recovery
  🧠 Multi-voice AI collaboration
  📊 Project intelligence and analysis

${chalk.yellow('Examples:')}
  crucible "Analyze this function for performance issues"
  crucible analyze src/main.ts
  crucible "Create a new React component for user login"
  crucible interactive
`;
    await this.userInteraction.display(help);
  }

  /**
   * Show system status
   */
  public async showStatus(): Promise<void> {
    try {
      const metrics = this.coordinator.getSystemMetrics();
      const contextStatus = await this.coordinator.getQuickContextStatus();

      const status = `
${chalk.cyan('📊 System Status')}

${chalk.yellow('Sessions:')}
  Active Sessions: ${metrics.coordinator.activeSessions}
  Operations Processed: ${metrics.coordinator.operationCount}
  
${chalk.yellow('Context Intelligence:')}
  Available: ${contextStatus.available ? '✅' : '❌'}
  Confidence: ${(contextStatus.confidence * 100).toFixed(0)}%
  Full Analysis: ${contextStatus.fullLoaded ? '✅' : '⏳'}
  
${chalk.yellow('System Health:')}
  Overall: ${(metrics.systemHealth.isHealthy ? '✅' : '⚠️')} ${(metrics.systemHealth.healthScore * 100).toFixed(0)}%
  Error Recovery: ${metrics.coordinator.globalMetrics.errorsRecovered} recovered
  
${chalk.yellow('Capabilities:')}
  Context Intelligence: ${metrics.capabilities.contextIntelligence ? '✅' : '❌'}
  Performance Optimization: ${metrics.capabilities.performanceOptimization ? '✅' : '❌'}
  Error Resilience: ${metrics.capabilities.errorResilience ? '✅' : '❌'}
`;
      await this.userInteraction.display(status);
    } catch (error) {
      await this.userInteraction.error(`Failed to get status: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Show intelligent suggestions
   */
  private async showSuggestions(): Promise<void> {
    try {
      const suggestions = await this.getSuggestions();
      
      if (suggestions.length === 0) {
        await this.userInteraction.display('No suggestions available at this time.', { type: 'info' });
        return;
      }

      let output = `\n${chalk.cyan('💡 Intelligent Suggestions:')}\n`;
      
      suggestions.slice(0, 8).forEach((suggestion, index) => {
        const relevanceBar = '█'.repeat(Math.ceil(suggestion.relevance * 10));
        output += `\n${chalk.green(`${index + 1}.`)} ${suggestion.command}`;
        output += `\n   ${suggestion.description}`;
        output += `\n   ${chalk.gray(`Relevance: ${relevanceBar} ${(suggestion.relevance * 100).toFixed(0)}%`)}`;
        if (suggestion.examples && suggestion.examples.length > 0) {
          output += `\n   ${chalk.dim(`Example: ${suggestion.examples[0]}`)}`;
        }
        output += '\n';
      });
      
      await this.userInteraction.display(output);
    } catch (error) {
      await this.userInteraction.error(`Failed to get suggestions: ${getErrorMessage(error)}`);
    }
  }

  /**
   * List available models
   */
  public async listModels(): Promise<void> {
    try {
      // Mock model list until coordinator method is implemented
      const models = [
        { name: 'qwen2.5-coder:7b', description: 'Fast coding model', provider: 'Ollama' },
        { name: 'deepseek-coder:8b', description: 'Advanced reasoning model', provider: 'Ollama' },
        { name: 'llama3.2:3b', description: 'General purpose model', provider: 'Ollama' }
      ];
      
      if (models.length === 0) {
        await this.userInteraction.display('No models available.', { type: 'warn' });
        return;
      }

      let output = `\n${chalk.cyan('🤖 Available Models:')}\n`;
      models.forEach((model: any, index: number) => {
        output += `\n${chalk.green(`${index + 1}.`)} ${model.name}`;
        if (model.description) {
          output += `\n   ${model.description}`;
        }
        if (model.provider) {
          output += `\n   ${chalk.gray(`Provider: ${model.provider}`)}`;
        }
      });
      
      await this.userInteraction.display(output);
    } catch (error) {
      await this.userInteraction.error(`Failed to list models: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Execute prompt processing (alias for processPrompt for backward compatibility)
   */
  public async executePromptProcessing(prompt: string, options: any = {}): Promise<string> {
    return await this.processPrompt(prompt, options);
  }

  /**
   * Get current session
   */
  getCurrentSession(): CLISession | null {
    return this.currentSession;
  }

  /**
   * Get system metrics
   */
  getMetrics(): any {
    return this.coordinator.getSystemMetrics();
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.currentSession) {
      await this.coordinator.closeSession(this.currentSession.id);
      this.currentSession = null;
    }

    await this.coordinator.shutdown();
    
    const sessionDuration = performance.now() - this.context.startTime;
    this.logger.info(`UnifiedCLI session ended after ${sessionDuration.toFixed(2)}ms`);
    
    this.initialized = false;
    this.removeAllListeners();
  }

  /**
   * Format response for display
   */
  private formatResponse(result: any): string {
    
    if (typeof result === 'string') {
      return result;
    }
    
    if (result && typeof result === 'object') {
      // Handle structured analysis results
      if (result.analysis && typeof result.analysis === 'object') {
        let output = '';
        
        if (result.analysis.summary) {
          output += result.analysis.summary + '\n\n';
        }
        
        if (result.analysis.insights && Array.isArray(result.analysis.insights) && result.analysis.insights.length > 0) {
          output += '💡 Key Insights:\n';
          result.analysis.insights.forEach((insight: string) => {
            output += `• ${insight}\n`;
          });
          output += '\n';
        }
        
        if (result.analysis.recommendations && Array.isArray(result.analysis.recommendations) && result.analysis.recommendations.length > 0) {
          output += '🔧 Recommendations:\n';
          result.analysis.recommendations.forEach((rec: string) => {
            output += `• ${rec}\n`;
          });
          output += '\n';
        }
        

        return output.trim();
      }
      
      if (result.response) {
        return result.response;
      }
      
      if (result.content) {
        return result.content;
      }

      if (result.suggestions && Array.isArray(result.suggestions)) {
        let output = result.message || result.result || '';
        if (result.suggestions.length > 0) {
          output += '\n\n💡 Suggestions:\n';
          result.suggestions.forEach((suggestion: any, index: number) => {
            output += `${index + 1}. ${suggestion.title || suggestion.description || suggestion}\n`;
          });
        }
        return output;
      }
      
      return JSON.stringify(result, null, 2);
    }
    
    return String(result);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Forward coordinator events
    this.coordinator.on('initialized', () => {
      this.emit('coordinator:initialized');
    });

    this.coordinator.on('error:critical', (data) => {
      this.emit('error:critical', data);
      this.logger.error('Critical error in CLI coordinator:', data);
    });

    this.coordinator.on('error:overload', (data) => {
      this.emit('error:overload', data);
      this.logger.warn('System overload in CLI coordinator:', data);
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await this.userInteraction.display('\n👋 Shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  // REPLInterface implementation
  async start(): Promise<void> {
    await this.startInteractive();
  }

  async stop(): Promise<void> {
    await this.shutdown();
  }

  async processCommand(command: string): Promise<string> {
    return await this.processPrompt(command);
  }

  async read(): Promise<string> {
    return await this.userInteraction.prompt('🤖 > ');
  }

  async eval(input: string): Promise<string> {
    return await this.processPrompt(input);
  }

  async print(output: string): Promise<void> {
    await this.userInteraction.display(output);
  }

  async loop(): Promise<void> {
    await this.startInteractive();
  }
}

export default UnifiedCLI;