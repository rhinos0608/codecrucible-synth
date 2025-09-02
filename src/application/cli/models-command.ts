/**
 * Models Command - Interactive Model Management
 *
 * Provides CLI commands for listing, selecting, and managing AI models
 */

import { ModelSelector } from '../../infrastructure/user-interaction/model-selector.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface ModelsCommandOptions {
  list?: boolean;
  select?: boolean;
  interactive?: boolean;
}

/**
 * Handle models-related CLI commands
 */
export class ModelsCommand {
  private modelSelector: ModelSelector;

  constructor() {
    this.modelSelector = new ModelSelector();
  }

  /**
   * Execute models command based on options
   */
  async execute(options: ModelsCommandOptions = {}): Promise<void> {
    if (options.list) {
      await this.listModels();
    } else if (options.select || options.interactive) {
      await this.selectModel();
    } else {
      await this.showModelsHelp();
    }
  }

  /**
   * List all available models
   */
  private async listModels(): Promise<void> {
    console.log('🤖 Available AI Models');
    console.log('═'.repeat(50));

    try {
      const models = await this.modelSelector.discoverModels();

      if (models.length === 0) {
        console.log('❌ No AI models found.');
        console.log('\n💡 To add models:');
        console.log('  • Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh');
        console.log('  • Pull models: ollama pull codellama:7b');
        console.log('  • Or set API keys: OPENAI_API_KEY, ANTHROPIC_API_KEY');
        return;
      }

      // Group by provider
      const groupedModels = models.reduce(
        (groups, model) => {
          const provider = model.provider;
          if (!groups[provider]) {
            groups[provider] = [];
          }
          groups[provider].push(model);
          return groups;
        },
        {} as Record<string, typeof models>
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
      logger.error('Failed to discover models:', error);
      console.log('❌ Failed to discover models. Check your AI provider connections.');
    }
  }

  /**
   * Interactive model selection
   */
  private async selectModel(): Promise<void> {
    try {
      const selection = await this.modelSelector.selectModel();
      console.log(`\n🎯 Model selected: ${selection.selectedModel.name}`);
      console.log('💾 This selection will be used for the current session.');
      console.log('\n💡 Restart CodeCrucible to select a different model.');
    } catch (error) {
      logger.error('Model selection failed:', error);
      console.log('❌ Model selection failed. Please try again.');
    }
  }

  /**
   * Show models command help
   */
  private async showModelsHelp(): Promise<void> {
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
  async getModels() {
    return await this.modelSelector.discoverModels();
  }
}

/**
 * Parse models command arguments
 */
export function parseModelsArgs(args: string[]): ModelsCommandOptions {
  const options: ModelsCommandOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

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
    }
  }

  return options;
}
