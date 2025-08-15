#!/usr/bin/env node

import { Command } from 'commander';
import { LocalModelClient } from './core/local-model-client.js';
import { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
import { MCPServerManager } from './mcp-servers/mcp-server-manager.js';
import { ConfigManager } from './config/config-manager.js';
import { CodeCrucibleCLI, CLIContext } from './core/cli.js';
import { logger } from './core/logger.js';
import { EnhancedAgenticClient } from './core/enhanced-agentic-client.js';
import { ClaudeCodeClient } from './core/claude-code-client.js';
import { AutonomousClaudeClient } from './core/autonomous-claude-client.js';
import chalk from 'chalk';

const program = new Command();

/**
 * CodeCrucible Synth - Standalone Desktop CLI Agentic Coding Assistant
 * 
 * A completely self-contained coding assistant that runs locally with no external dependencies.
 * Features multi-voice AI synthesis, MCP server integration, and both CLI and desktop interfaces.
 */

export async function initializeCLIContext(): Promise<CLIContext> {
  return initializeApplication();
}

async function initializeApplication(): Promise<CLIContext> {
  try {
    // Load configuration (creates default if none exists)
    const config = await ConfigManager.load();
    
    // Initialize local model client with auto-discovery
    const modelClient = new LocalModelClient({
      endpoint: config.model.endpoint,
      model: config.model.name,
      timeout: config.model.timeout,
      maxTokens: config.model.maxTokens,
      temperature: config.model.temperature
    });

    // Check model availability on startup
    const isModelReady = await modelClient.checkConnection();
    if (!isModelReady) {
      console.log(chalk.yellow('⚠️  Local AI model not detected'));
      console.log(chalk.gray('   To get started:'));
      console.log(chalk.gray('   1. Install Ollama: https://ollama.ai'));
      console.log(chalk.gray('   2. Run: ollama pull gpt-oss:20b'));
      console.log(chalk.gray('   3. Start: ollama serve'));
      console.log(chalk.gray('   4. Or use: cc model --install'));
      console.log();
    }

    // Initialize voice system
    const voiceSystem = new VoiceArchetypeSystem(modelClient, config);

    // Initialize MCP server manager
    const mcpManager = new MCPServerManager(config.mcp.servers);

    const context: CLIContext = {
      modelClient,
      voiceSystem,
      mcpManager,
      config
    };

    logger.info('CodeCrucible Synth initialized successfully');
    return context;

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    console.error(chalk.red('❌ Initialization failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Define CLI commands
program
  .name('codecrucible')
  .description('CodeCrucible Synth - Local AI-powered coding assistant')
  .version('2.0.0');

program
  .argument('[prompt]', 'Code generation prompt')
  .option('-v, --voices <voices>', 'Comma-separated list of voices to use')
  .option('-d, --depth <level>', 'Analysis depth level (1-5)', '2')
  .option('-m, --mode <mode>', 'Synthesis mode: consensus, competitive, collaborative', 'competitive')
  .option('-f, --file <path>', 'Focus on specific file')
  .option('-p, --project', 'Include project context')
  .option('-i, --interactive', 'Start interactive mode')
  .option('-c, --council', 'Use full council of voices')
  .action(async (prompt, options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    
    if (options.council) {
      await cli.handleCouncilMode(prompt, options);
    } else {
      await cli.handleGeneration(prompt, options);
    }
  });

// File operations
program
  .command('file <operation> <filepath>')
  .description('Perform operations on files (analyze, refactor, explain, test)')
  .option('-v, --voices <voices>', 'Voices to use')
  .action(async (operation, filepath, options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    await cli.handleFileOperation(operation, filepath, options);
  });

// Project operations
program
  .command('project <operation>')
  .description('Perform project-wide operations (analyze, refactor, document, test)')
  .option('-v, --voices <voices>', 'Voices to use')
  .option('--pattern <pattern>', 'File pattern to include')
  .action(async (operation, options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    await cli.handleProjectOperation(operation, options);
  });

// Voice-specific consultation
program
  .command('voice <voice> [prompt]')
  .description('Consult a specific voice archetype')
  .action(async (voice, prompt, options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    
    if (!prompt) {
      const inquirer = (await import('inquirer')).default;
      const { userPrompt } = await inquirer.prompt([
        { type: 'input', name: 'userPrompt', message: `What would you like to ask ${voice}?` }
      ]);
      prompt = userPrompt;
    }
    
    await cli.handleVoiceSpecific(voice, prompt);
  });

// Agentic mode (like cursor/claude code)
program
  .command('agent')
  .description('Start agentic coding mode (like Cursor/Claude Code)')
  .option('-w, --watch', 'Watch for file changes')
  .option('-p, --port <port>', 'Port for agent server', '3000')
  .option('-e, --enhanced', 'Use enhanced ReAct agent with advanced capabilities', false)
  .action(async (options) => {
    if (options.enhanced) {
      console.log(chalk.blue('🧠 Starting Enhanced CodeCrucible ReAct Agent...'));
      const context = await initializeApplication();
      const enhancedClient = new EnhancedAgenticClient(context);
      await enhancedClient.start();
    } else {
      console.log(chalk.blue('🤖 Starting CodeCrucible Claude Code Mode...'));
      const context = await initializeApplication();
      const claudeCodeClient = new ClaudeCodeClient(context);
      await claudeCodeClient.start();
    }
  });

// Desktop mode
program
  .command('desktop')
  .description('Launch desktop GUI application')
  .option('-p, --port <port>', 'Port for desktop server', '3007')
  .action(async (options) => {
    console.log(chalk.blue('🖥️  Starting CodeCrucible Desktop Mode...'));
    
    // Dynamic import to avoid loading Electron unless needed
    const { startDesktopApp } = await import('./desktop/desktop-app.js');
    
    const context = await initializeApplication();
    await startDesktopApp(context, { port: parseInt(options.port) });
  });

// Configuration management
program
  .command('config')
  .description('Manage configuration')
  .option('--set <key=value>', 'Set configuration value')
  .option('--get <key>', 'Get configuration value')
  .option('--list', 'List all configuration')
  .option('--reset', 'Reset to default configuration')
  .action(async (options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    await cli.handleConfig(options);
  });

// Model management
program
  .command('model')
  .description('Manage local AI models')
  .option('--status', 'Check system and model status')
  .option('--setup', 'Auto-setup Ollama and install a model')
  .option('--install', 'Same as --setup (for backwards compatibility)')
  .option('--list', 'List available models')
  .option('--pull <model>', 'Pull/install a specific model')
  .option('--test [model]', 'Test a model (uses best available if not specified)')
  .option('--remove <model>', 'Remove a model')
  .action(async (options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    await cli.handleModelManagement(options);
  });

// Voice management
program
  .command('voices')
  .description('Manage voice archetypes')
  .option('--list', 'List available voices')
  .option('--describe <voice>', 'Describe a specific voice')
  .option('--test <voice>', 'Test a voice with sample prompt')
  .action(async (options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    await cli.handleVoiceManagement(options);
  });

// Examples and help
program
  .command('examples')
  .description('Show usage examples')
  .action(async () => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    cli.showExamples();
  });

// Server mode for IDE integration
program
  .command('serve')
  .description('Start server mode for IDE integration')
  .option('-p, --port <port>', 'Server port', '3002')
  .option('--host <host>', 'Server host', 'localhost')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting CodeCrucible Server Mode...'));
    
    const { startServerMode } = await import('./server/server-mode.js');
    const context = await initializeApplication();
    
    await startServerMode(context, {
      port: parseInt(options.port),
      host: options.host
    });
  });

// Handle global flags and aliases
if (process.argv.includes('-i') || process.argv.includes('--interactive')) {
  // Handle shorthand interactive mode
  program.addCommand(
    program.createCommand('interactive')
      .description('Start interactive mode')
      .action(async () => {
        const context = await initializeApplication();
        const cli = new CodeCrucibleCLI(context);
        await cli.handleInteractiveMode({});
      })
  );
}

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error(chalk.red('❌ Fatal error:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  console.error(chalk.red('❌ Unhandled promise rejection:'), reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Shutting down CodeCrucible Synth...'));
  process.exit(0);
});

// Parse arguments and run
program.parse();

// If no command provided, start autonomous mode
if (!process.argv.slice(2).length) {
  (async () => {
    try {
      const context = await initializeApplication();
      
      // Quick, silent model check
      const isReady = await context.modelClient.checkConnection();
      
      if (!isReady) {
        // Silently try to set up
        const { EnhancedModelManager } = await import('./core/enhanced-model-manager.js');
        const modelManager = new EnhancedModelManager(context.config.model.endpoint);
        
        const result = await modelManager.autoSetup(false); // Silent setup
        
        if (!result.success) {
          console.log('Model not available. Run: cc model --setup');
          process.exit(1);
        }
      }
      
      // Start the clean, autonomous client
      const autonomousClient = new AutonomousClaudeClient(context);
      await autonomousClient.start();
    } catch (error) {
      console.error('Failed to start:', error instanceof Error ? error.message : 'Unknown error');
      console.log('Try: cc model --setup');
      process.exit(1);
    }
  })();
}