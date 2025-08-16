#!/usr/bin/env node

import { Command } from 'commander';
import { LocalModelClient } from './core/local-model-client.js';
import { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
import { MCPServerManager } from './mcp-servers/mcp-server-manager.js';
import { ConfigManager } from './config/config-manager.js';
import { CodeCrucibleCLI, CLIContext } from './core/cli.js';
import { logger } from './core/logger.js';
import { createMultiLLMProvider } from './core/multi-llm-provider.js';
import { globalRAGSystem } from './core/rag-system.js';
import { EnhancedAgenticClient } from './core/enhanced-agentic-client.js';
import { ClaudeCodeClient } from './core/claude-code-client.js';
import { AutonomousClaudeClient } from './core/autonomous-claude-client.js';
import { initializeEditConfirmation } from './core/edit-confirmation-system.js';
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
    
    // Initialize LocalModelClient directly with configured model
    const modelClient = new LocalModelClient({
      endpoint: config.model.endpoint,
      model: config.model.name, // Use configured model
      timeout: config.model.timeout,
      maxTokens: config.model.maxTokens,
      temperature: config.model.temperature
    });

    // Initialize voice system
    const voiceSystem = new VoiceArchetypeSystem(modelClient, config);

    // Initialize MCP server manager
    const mcpManager = new MCPServerManager(config.mcp.servers);

    // Initialize Multi-LLM Provider (only if configuration exists)
    let multiLLMProvider;
    if (config.llmProviders && config.llmProviders.providers) {
      const llmConfigs = Object.entries(config.llmProviders.providers)
        .filter(([_, providerConfig]) => providerConfig.enabled)
        .map(([name, providerConfig]) => ({ name, config: providerConfig }));
      
      if (llmConfigs.length > 0) {
        multiLLMProvider = createMultiLLMProvider(llmConfigs);
        if (config.llmProviders.default) {
          multiLLMProvider.setDefaultProvider(config.llmProviders.default);
        }
        logger.info(`Initialized multi-LLM provider with ${llmConfigs.length} providers`);
      }
    }

    // Initialize RAG system and index project files
    try {
      await globalRAGSystem.indexPath(process.cwd(), {
        recursive: true,
        includePatterns: ['**/*.ts', '**/*.js', '**/*.md', '**/*.json'],
        excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
      });
      logger.info('RAG system initialized and project files indexed');
    } catch (error) {
      logger.warn('Failed to initialize RAG system:', error);
    }

    // Initialize edit confirmation system
    const editConfirmation = initializeEditConfirmation(process.cwd(), {
      requireConfirmation: true,
      showDiff: true,
      autoApproveSmallChanges: false,
      smallChangeThreshold: 5,
      interactive: true,
      batchMode: false
    });
    logger.info('Edit confirmation system initialized');

    const context: CLIContext = {
      modelClient,
      voiceSystem,
      mcpManager,
      config,
      multiLLMProvider,
      ragSystem: globalRAGSystem
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
  .description('CodeCrucible Synth - Enhanced AI coding agent (runs agent mode by default)')
  .version('2.0.0');

program
  .argument('[prompt]', 'Code generation prompt (if not provided, starts enhanced agent mode)')
  .option('-v, --voices <voices>', 'Comma-separated list of voices to use')
  .option('-d, --depth <level>', 'Analysis depth level (1-5)', '2')
  .option('-m, --mode <mode>', 'Synthesis mode: consensus, competitive, collaborative, iterative', 'competitive')
  .option('-f, --file <path>', 'Focus on specific file')
  .option('-p, --project', 'Include project context')
  .option('-i, --interactive', 'Start interactive mode')
  .option('-c, --council', 'Use full council of voices')
  .option('--iterative', 'Use iterative Writer/Auditor improvement loop')
  .option('--max-iterations <num>', 'Maximum iterations for iterative mode', '5')
  .option('--quality-threshold <num>', 'Quality threshold for iterative mode (0-100)', '85')
  .option('--agentic', 'Use autonomous agentic mode with multi-agent orchestration')
  .option('--autonomous', 'Same as --agentic (alias for autonomous processing)')
  .action(async (prompt, options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    
    if (options.agentic || options.autonomous) {
      await cli.handleAgenticMode(prompt, options);
    } else if (options.council) {
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
      // Default to enhanced ReAct agent for better tool usage and analysis
      console.log(chalk.blue('🤖 Starting CodeCrucible ReAct Agent with Tools...'));
      const context = await initializeApplication();
      const enhancedClient = new EnhancedAgenticClient(context);
      await enhancedClient.start();
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
  .description('Manage local AI models and API models')
  .option('--status', 'Check system and model status')
  .option('--setup', 'Auto-setup Ollama and install a model')
  .option('--install', 'Same as --setup (for backwards compatibility)')
  .option('--list', 'List available models')
  .option('--pull <model>', 'Pull/install a specific model')
  .option('--test [model]', 'Test a model (uses best available if not specified)')
  .option('--remove <model>', 'Remove a model')
  .option('--add-api', 'Add API model configuration (Claude, GPT, Gemini)')
  .option('--list-api', 'List configured API models')
  .option('--test-api <model>', 'Test an API model connection')
  .option('--remove-api <model>', 'Remove an API model configuration')
  .option('--select', 'Select active model (local or API)')
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

// Edit confirmation management
program
  .command('edits')
  .description('Manage pending file edits and confirmations')
  .option('--pending', 'Show pending edits')
  .option('--confirm', 'Confirm all pending edits')
  .option('--clear', 'Clear all pending edits')
  .option('--batch', 'Use batch confirmation mode')
  .option('--individual', 'Use individual confirmation mode')
  .action(async (options) => {
    const context = await initializeApplication();
    const cli = new CodeCrucibleCLI(context);
    await cli.handleEditManagement(options);
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

// Main function for bin entry point
export async function main() {
  // Parse arguments and run
  program.parse();

  // If no command provided, start enhanced agent mode by default
  if (!process.argv.slice(2).length) {
    try {
      console.log(chalk.cyan('🧠 Starting Enhanced CodeCrucible ReAct Agent...'));
      const context = await initializeApplication();
      const enhancedClient = new EnhancedAgenticClient(context);
      await enhancedClient.start();
    } catch (error) {
      console.error('Failed to start:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
}

// Auto-run when called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main();
}