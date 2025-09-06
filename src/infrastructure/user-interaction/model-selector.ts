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

  constructor() {
    // Hide cursor and enable raw mode for better UX
    process.stdout.write('\x1B[?25l');
  }

  /**
   * Discover available models from all providers
   */
  async discoverModels(): Promise<ModelInfo[]> {
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
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      throw new Error('Ollama not available');
    }

    const data = (await response.json()) as { models: any[] };
    return data.models.map(model => ({
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
  async selectModel(): Promise<ModelSelectionResult> {
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
    return new Promise((resolve, reject) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // Enable raw mode for arrow key detection
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      this.renderModelList();

      const handleKeypress = (data: Buffer) => {
        const key = data.toString();

        switch (key) {
          case '\u001b[A': // Up arrow
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.renderModelList();
            break;

          case '\u001b[B': // Down arrow
            this.selectedIndex = Math.min(this.models.length - 1, this.selectedIndex + 1);
            this.renderModelList();
            break;

          case '\r': // Enter
          case '\n':
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

          case '\u0003': // Ctrl+C
            this.cleanup();
            rl.close();
            console.log('\n\n👋 Goodbye!');
            process.exit(0);

          case 'q':
          case 'Q':
            this.cleanup();
            rl.close();
            console.log('\n\n👋 Goodbye!');
            process.exit(0);
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
  getDiscoveredModels(): ModelInfo[] {
    return this.models;
  }
}

/**
 * Quick model selection for non-interactive environments
 * FIXED: Prioritize working Ollama models over potentially broken LM Studio
 */
export async function quickSelectModel(): Promise<ModelSelectionResult> {
  const selector = new ModelSelector();
  const models = await selector.discoverModels();

  logger.info('🔍 DEBUG: quickSelectModel discovered models:', {
    totalModels: models.length,
    modelsByProvider: models.reduce((acc, m) => {
      acc[m.provider] = (acc[m.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    availableModels: models.filter(m => m.available).length,
    ollamaModels: models.filter(m => m.provider === 'ollama').length,
    availableOllamaModels: models.filter(m => m.provider === 'ollama' && m.available).length
  });

  if (models.length === 0) {
    throw new Error('No AI models available');
  }

  // Dynamic model selection - no hardcoded preferences
  const ollamaModels = models.filter(m => m.provider === 'ollama' && m.available);
  
  if (ollamaModels.length > 0) {
    // Select the largest model available (generally better for function calling)
    // Parse model size from the size field (e.g., "4.6 GB" -> 4.6)
    const modelsWithParsedSize = ollamaModels.map(m => {
      let sizeInGB = 0;
      if (m.size) {
        const match = m.size.match(/(\d+\.?\d*)\s*(GB|MB)/i);
        if (match) {
          sizeInGB = parseFloat(match[1]);
          if (match[2].toUpperCase() === 'MB') {
            sizeInGB = sizeInGB / 1024;
          }
        }
      }
      return { ...m, sizeInGB };
    });
    
    // Sort by size descending (larger models generally have better capabilities)
    modelsWithParsedSize.sort((a, b) => b.sizeInGB - a.sizeInGB);
    
    const selectedModel = modelsWithParsedSize[0];
    
    logger.info('✅ Selected Ollama model:', selectedModel.name);
    logger.info(`📊 Model size: ${selectedModel.size || 'unknown'} - larger models typically have better function calling`);
    return {
      selectedModel: selectedModel,
      provider: selectedModel.provider,
    };
  }
  
  // Fallback to any Ollama model
  const ollamaModel = models.find(m => m.provider === 'ollama' && m.available);
  if (ollamaModel) {
    logger.info('⚠️ Selected Ollama model (tool support unknown):', ollamaModel.name);
    return {
      selectedModel: ollamaModel,
      provider: ollamaModel.provider,
    };
  }
  
  // Fallback to any other available model
  const firstModel = models.find(m => m.available) || models[0];
  logger.info('⚠️ Using fallback model (Ollama not available):', firstModel.name);
  logger.info('🔍 DEBUG: Available models for fallback:', models.filter(m => m.available).map(m => ({ name: m.name, provider: m.provider, available: m.available })));
  return {
    selectedModel: firstModel,
    provider: firstModel.provider,
  };
}
