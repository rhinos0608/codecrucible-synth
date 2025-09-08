/**
 * Interactive Model Selection Interface
 *
 * Provides a user-friendly interface for selecting AI models at startup
 * with arrow key navigation and dynamic model discovery.
 */

import { createInterface } from 'readline';
import { logger } from '../logging/unified-logger.js';

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
  size?: string;
  description?: string;
  available: boolean;
}

export interface ModelSelectionResult {
  selectedModel: ModelInfo;
  provider: string;
}

/**
 * Interactive model selector with arrow key navigation
 */
export class ModelSelector {
  private models: ModelInfo[] = [];
  private selectedIndex: number = 0;

  public constructor() {
    // Hide cursor and enable raw mode for better UX
    process.stdout.write('\x1B[?25l');
  }

  /**
   * Discover available models from all providers
   */
  public async discoverModels(): Promise<ModelInfo[]> {
    const discoveredModels: ModelInfo[] = [];

    // Discover Ollama models
    try {
      const ollamaModels = await this.discoverOllamaModels();
      discoveredModels.push(...ollamaModels);
    } catch (error) {
      logger.debug('Ollama models discovery failed:', error);
    }

    // Discover LM Studio models (if running)
    try {
      const lmStudioModels = await this.discoverLMStudioModels();
      discoveredModels.push(...lmStudioModels);
    } catch (error) {
      logger.debug('LM Studio models discovery failed:', error);
    }

    // Add cloud providers (if API keys are available)
    if (process.env.OPENAI_API_KEY) {
      discoveredModels.push({
        id: 'gpt-4o',
        name: 'GPT-4o (OpenAI)',
        provider: 'openai',
        description: 'Latest OpenAI model',
        available: true,
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      discoveredModels.push({
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet (Anthropic)',
        provider: 'anthropic',
        description: 'Latest Claude model',
        available: true,
      });
    }

    this.models = discoveredModels;
    return discoveredModels;
  }

  /**
   * Discover models from Ollama
   */
  private async discoverOllamaModels(): Promise<ModelInfo[]> {
    interface OllamaModel {
      name: string;
      size: number;
      details?: {
        parameter_size?: string;
      };
    }

    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      throw new Error('Ollama not available');
    }

    const data = (await response.json()) as { models: OllamaModel[] };
    return data.models.map((model: OllamaModel) => ({
      id: model.name,
      name: `${model.name} (${this.formatSize(model.size)})`,
      provider: 'ollama' as const,
      size: this.formatSize(model.size),
      description: `Ollama • ${model.details?.parameter_size || 'Unknown size'}`,
      available: true,
    }));
  }

  /**
   * Discover models from LM Studio
   */
  private async discoverLMStudioModels(): Promise<ModelInfo[]> {
    // LM Studio API discovery would go here
    // For now, return empty array since LM Studio API varies
    return [];
  }

  /**
   * Present interactive model selection menu
   */
  public async selectModel(): Promise<ModelSelectionResult> {
    console.log('\n🤖 Select AI Model for CodeCrucible Synth');
    console.log('═'.repeat(50));

    // Discover available models
    console.log('🔍 Discovering available models...\n');
    await this.discoverModels();

    if (this.models.length === 0) {
      console.log('❌ No AI models found. Please ensure:');
      console.log('  • Ollama is running with models installed');
      console.log('  • Or set OPENAI_API_KEY/ANTHROPIC_API_KEY environment variables');
      process.exit(1);
    }

    // Show interactive selection
    return new Promise((resolve, _reject) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // Enable raw mode for arrow key detection
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      this.renderModelList();

      const handleKeypress = (data: Readonly<Buffer>): void => {
        const key = data.toString();

        switch (key) {
          case '\u001b[A': { // Up arrow
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.renderModelList();
            
          }
          case '\u001b[B': { // Down arrow
            this.selectedIndex = Math.min(this.models.length - 1, this.selectedIndex + 1);
            this.renderModelList();
            break;
          }
          case '\r': // Enter
          case '\n': {
            const selectedModel = this.models[this.selectedIndex];
            this.cleanup();
            rl.close();

            console.log(`\n✅ Selected: ${selectedModel.name}`);
            console.log('━'.repeat(50));

            resolve({
              selectedModel,
              provider: selectedModel.provider,
            });
            return;
          }
          case '\u0003': { // Ctrl+C
            this.cleanup();
            rl.close();
            console.log('\n\n👋 Goodbye!');
            process.exit(0);
            return;
          }
          case 'q':
          case 'Q': {
            this.cleanup();
            rl.close();
            console.log('\n\n👋 Goodbye!');
            process.exit(0);
          }
          default:
            // Do nothing for other keys
            break;
        }
      };

      process.stdin.on('data', handleKeypress);

      // Cleanup on exit
      rl.on('close', () => {
        process.stdin.removeListener('data', handleKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
      });
    });
  }

  /**
   * Render the model selection list
   */
  private renderModelList(): void {
    // Clear screen and move cursor to top
    process.stdout.write('\x1B[2J\x1B[H');

    console.log('🤖 Select AI Model for CodeCrucible Synth');
    console.log('═'.repeat(50));
    console.log('Use ↑/↓ arrow keys to navigate, Enter to select, Q to quit\n');

    this.models.forEach((model, index) => {
      const isSelected = index === this.selectedIndex;
      const prefix = isSelected ? '▶ ' : '  ';
      const style = isSelected ? '\x1b[36m\x1b[1m' : '\x1b[0m'; // Cyan and bold for selected
      const reset = '\x1b[0m';

      const availability = model.available ? '🟢' : '🔴';
      const modelInfo = `${model.name}`;
      const description = model.description ? ` • ${model.description}` : '';

      console.log(`${style}${prefix}${availability} ${modelInfo}${description}${reset}`);
    });

    console.log('\n💡 Tip: You can change this selection anytime with "cc models" command');
  }

  /**
   * Format file size in human readable format
   */
  private formatSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);

    return `${size} ${sizes[i]}`;
  }

  /**
   * Cleanup terminal state
   */
  private cleanup(): void {
    // Show cursor again
    process.stdout.write('\x1B[?25h');

    // Reset terminal mode
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  /**
   * Get models for programmatic access
   */
  public getDiscoveredModels(): ModelInfo[] {
    return this.models;
  }
}

/**
 * Quick model selection using smart selection logic
 * Uses user preferences and dynamic capability detection
 */
export async function quickSelectModel(): Promise<ModelSelectionResult> {
  // Use the new smart selection logic
  const { smartQuickSelectModel } = await import('./smart-model-selector.js');
  return smartQuickSelectModel();
}
