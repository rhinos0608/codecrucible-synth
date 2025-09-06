/**
 * Models Command - Interactive Model Management
 *
 * Provides CLI commands for listing, selecting, and managing AI models
 */

import { ModelInfo, ModelSelector } from '../../infrastructure/user-interaction/model-selector.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { createCliTimeout } from '../../utils/timeout-utils.js';
import { enterpriseErrorHandler } from '../../infrastructure/error-handling/enterprise-error-handler.js';

export interface ModelsCommandOptions {
  list?: boolean;
  select?: boolean;
  interactive?: boolean;
}

/**
 * Handle models-related CLI commands
 */
export class ModelsCommand {
  private readonly modelSelector: ModelSelector;

  public constructor() {
    this.modelSelector = new ModelSelector();
  }

  /**
   * Execute models command based on options
   */
  public async execute(options: Readonly<ModelsCommandOptions> = {}): Promise<void> {
    if (options.list) {
      await this.listModels();
    } else if (options.select ?? options.interactive) {
      await this.selectModel();
    } else {
      this.showModelsHelp();
    }
  }

  /**
   * List all available models
   */
  private async listModels(): Promise<void> {
    console.log('🤖 Available AI Models');
    console.log('═'.repeat(50));

    try {
      // Apply timeout to prevent CLI hanging on model discovery
      const modelsResult = await createCliTimeout(
        this.modelSelector.discoverModels(),
        'model discovery',
        8000, // 8 second timeout
        []
      );

      if (modelsResult.timedOut) {
        console.log('⚠️  Model discovery timed out after 8 seconds');
        console.log('💡 This may indicate:');
        console.log('  • MCP servers are still initializing');
        console.log('  • AI providers are not responding');
        console.log('  • Network connectivity issues');
        console.log('\n🔄 Try running the command again in a few moments.');
        return;
      } else if (!modelsResult.success) {
        throw new Error(modelsResult.error || 'Model discovery failed');
      }

      const models = modelsResult.result || [];

      if (models.length === 0) {
        console.log('❌ No AI models found.');
        console.log('\n💡 To add models:');
        console.log('  • Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh');
        console.log('  • Pull models: ollama pull codellama:7b');
        console.log('  • Or set API keys: OPENAI_API_KEY, ANTHROPIC_API_KEY');
        return;
      }

      // Group by provider
      const groupedModels = models.reduce<Record<string, ReadonlyArray<(typeof models)[number]>>>(
        (groups: Readonly<Record<string, ReadonlyArray<(typeof models)[number]>>>, model) => {
          const { provider } = model;
          // Create a new object to maintain immutability
          const updatedGroups = { ...groups };
          if (!updatedGroups[provider]) {
            updatedGroups[provider] = [];
          }
          updatedGroups[provider] = [...updatedGroups[provider], model];
          return updatedGroups;
        },
        {}
      );

      Object.entries(groupedModels).forEach(([provider, providerModels]) => {
        console.log(`\n📦 ${provider.toUpperCase()}`);
        console.log('─'.repeat(20));

        providerModels.forEach(model => {
          const status = model.available ? '🟢' : '🔴';
          const size = model.size ? ` (${model.size})` : '';
          const description = model.description ? ` • ${model.description}` : '';

          console.log(`  ${status} ${model.id}${size}${description}`);
        });
      });

      console.log(
        `\n✅ Found ${models.length} models across ${Object.keys(groupedModels).length} providers`
      );
      console.log('\n💡 Use "cc models --select" to interactively choose a model');
    } catch (error) {
      // Use enterprise error handler for graceful model discovery failure
      const structuredError = await enterpriseErrorHandler.handleEnterpriseError(error as Error, {
        operation: 'model_discovery',
        resource: 'ai_providers',
        context: { command: 'models --list' },
      });

      console.log(`❌ ${structuredError.userMessage}`);

      if (structuredError.suggestedActions && structuredError.suggestedActions.length > 0) {
        console.log('💡 Suggested actions:');
        structuredError.suggestedActions.forEach(action => {
          console.log(`  • ${action}`);
        });
      }

      // Show specific guidance for model setup
      console.log('\n🛠️  Setup Guide:');
      console.log('  • Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh');
      console.log('  • Pull models: ollama pull codellama:7b');
      console.log('  • Or set API keys: OPENAI_API_KEY, ANTHROPIC_API_KEY');
    }
  }

  /**
   * Interactive model selection
   */
  private async selectModel(): Promise<void> {
    try {
      // Apply timeout to model selection process
      const selectionResult = await createCliTimeout(
        this.modelSelector.selectModel(),
        'model selection',
        10000, // 10 second timeout for interactive selection
        null
      );

      if (selectionResult.timedOut) {
        console.log('⚠️  Model selection timed out after 10 seconds');
        console.log('💡 Consider running "cc models --list" first to check model availability.');
        return;
      } else if (!selectionResult.success) {
        throw new Error(selectionResult.error || 'Model selection failed');
      }

      const selection = selectionResult.result;
      if (selection?.selectedModel) {
        console.log(`\n🎯 Model selected: ${selection.selectedModel.name}`);
        console.log('💾 This selection will be used for the current session.');
        console.log('\n💡 Restart CodeCrucible to select a different model.');
      } else {
        console.log('❌ No model was selected.');
      }
    } catch (error) {
      // Use enterprise error handler for graceful model selection failure
      const structuredError = await enterpriseErrorHandler.handleEnterpriseError(error as Error, {
        operation: 'model_selection',
        resource: 'user_interaction',
        context: { command: 'models --select' },
      });

      console.log(`❌ ${structuredError.userMessage}`);

      if (structuredError.retryable) {
        console.log('🔄 This operation can be retried. Please try again.');
      }

      if (structuredError.suggestedActions && structuredError.suggestedActions.length > 0) {
        console.log('💡 Suggested actions:');
        structuredError.suggestedActions.forEach(action => {
          console.log(`  • ${action}`);
        });
      }
    }
  }

  /**
   * Show models command help
   */
  private showModelsHelp(): void {
    console.log('🤖 Models Command Help');
    console.log('═'.repeat(30));
    console.log('');
    console.log('Usage:');
    console.log('  cc models [options]');
    console.log('  crucible models [options]');
    console.log('');
    console.log('Options:');
    console.log('  --list, -l          List all available models');
    console.log('  --select, -s        Interactive model selection');
    console.log('  --interactive, -i   Same as --select');
    console.log('  --help, -h          Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  cc models --list               # List available models');
    console.log('  cc models --select             # Select model interactively');
    console.log('  crucible models -l             # Short form');
    console.log('');
    console.log('💡 Models are automatically discovered from:');
    console.log('  • Ollama (http://localhost:11434)');
    console.log('  • LM Studio (if running)');
    console.log('  • OpenAI (if OPENAI_API_KEY is set)');
    console.log('  • Anthropic (if ANTHROPIC_API_KEY is set)');
  }

  /**
   * Get discovered models for programmatic use
   */
  public async getModels(): Promise<ModelInfo[]> {
    const modelsResult = await createCliTimeout(
      this.modelSelector.discoverModels(),
      'model discovery (programmatic)',
      5000, // 5 second timeout for programmatic use
      []
    );

    if (modelsResult.success) {
      return modelsResult.result || [];
    } else {
      logger.warn('Model discovery timed out or failed:', modelsResult.error);
      return [];
    }
  }
}

/**
 * Parse models command arguments
 */
export function parseModelsArgs(args: string[]): ModelsCommandOptions {
  const options: ModelsCommandOptions = {};

  for (const arg of args) {
    switch (arg) {
      case '--list':
      case '-l':
        options.list = true;
        break;

      case '--select':
      case '-s':
      case '--interactive':
      case '-i':
        options.select = true;
        options.interactive = true;
        break;

      case '--help':
      case '-h':
        // Will show help by default when no other options
        break;

      default:
        // Unknown argument, ignore or handle as needed
        break;
    }
  }

  return options;
}
