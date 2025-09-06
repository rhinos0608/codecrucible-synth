import { logger } from '../../infrastructure/logging/unified-logger.js';
import { ModelInfo, modelDiscoveryService } from '../../infrastructure/discovery/model-discovery-service.js';
import { unifiedResultFormatter } from '../../infrastructure/formatting/unified-result-formatter.js';

/**
 * Centralized output formatting using UnifiedResultFormatter
 * Replaces scattered formatting logic with consistent, comprehensive formatting
 */
interface OutputLike {
  message?: { content?: unknown };
  content?: string;
  response?: string;
  text?: string;
}

function isOutputLike(obj: unknown): obj is OutputLike {
  return typeof obj === 'object' && obj !== null;
}

export function formatOutput(result: unknown): string {
  // Handle objects that might have response or content properties
  if (isOutputLike(result) && !Array.isArray(result)) {
    // Check for nested message.content pattern
    if (
      typeof result.message === 'object' &&
      'content' in result.message
    ) {
      return formatOutput((result.message as { content?: unknown }).content);
    }

    // Check for direct content/response/text properties
    if (typeof result.content === 'string') {
      return result.content;
    }
    if (typeof result.response === 'string') {
      return result.response;
    }
    if (typeof result.text === 'string') {
      return result.text;
    }
  }
  
  // Use centralized result formatter for consistent output
  const formatted = unifiedResultFormatter.formatResult(result, {
    includeMetadata: false,
    preferMarkdown: false,
    highlightErrors: true,
    format: 'text',
    maxLength: 50000,
    maxDepth: 10
  });

  // CRITICAL FIX: Add fallback for empty/null results to prevent blank responses
  if (!formatted.content || formatted.content.trim().length === 0) {
    // Provide meaningful fallback based on result type
    if (result === null || result === undefined) {
      return '✅ Operation completed successfully (no output generated)';
    }
    
    if (typeof result === 'boolean') {
      return `✅ Result: ${result}`;
    }
    
    if (typeof result === 'number') {
      return `✅ Result: ${result}`;
    }
    
    // If result is an object but content is empty, try to show something meaningful
    if (typeof result === 'object') {
      const str = JSON.stringify(result, null, 2);
      if (str !== '{}') {
        return str;
      }
    }
    
    return '✅ Operation completed successfully';
  }

  return formatted.content;
}

// CLI coordinator expects an OutputFormatter class
export class OutputFormatter {
  public print(message: string): void {
    console.log(message);
  }

  public showHelp(): void {
    console.log('CodeCrucible Synth - Help');
    console.log('Commands:');
    console.log('  help    - Show this help message');
    console.log('  models  - List available models');
    console.log('  exit    - Exit the application');
  }

  public async showModels(): Promise<void> {
    console.log('🤖 Discovering available models...');
    console.log('═'.repeat(40));

    try {
      const models = await modelDiscoveryService.discoverModels({
        includeUnavailable: true,
        timeout: 8000,
        cache: true,
        providers: ['ollama', 'lm-studio', 'claude', 'huggingface']
      });

      if (models.length === 0) {
        console.log('❌ No models found. Make sure your model providers are running:');
        console.log('  • Ollama: http://localhost:11434');
        console.log('  • LM Studio: http://localhost:1234');
        console.log('  • HuggingFace: Configure API token');
        return;
      }

      // Group models by provider for better display
      const modelsByProvider = this.groupModelsByProvider(models);

      for (const [provider, providerModels] of Object.entries(modelsByProvider)) {
        console.log(`\n📦 ${provider.toUpperCase()} Models:`);
        console.log('─'.repeat(30));

        for (const model of providerModels) {
          const status = model.isAvailable ? '✅' : '⚠️';
          const sizeInfo = model.size ? ` (${model.size})` : '';
          const familyInfo = model.family ? ` [${model.family}]` : '';
          
          console.log(`  ${status} ${model.name}${sizeInfo}${familyInfo}`);
          
          if (model.capabilities && model.capabilities.length > 0) {
            console.log(`     → ${model.capabilities.join(', ')}`);
          }
          
          if (!model.isAvailable) {
            console.log(`     → Last checked: ${model.lastChecked?.toLocaleTimeString()}`);
          }
        }
      }

      // Show summary statistics
      const available = models.filter((m: Readonly<ModelInfo>) => m.isAvailable).length;
      const total = models.length;
      
      console.log(`\n📊 Summary: ${available}/${total} models available`);
      
      if (available === 0) {
        console.log('\n💡 Tip: Start your model providers to see available models:');
        console.log('  • ollama serve');
        console.log('  • Open LM Studio and load a model');
      }

    } catch (error) {
      console.error('❌ Error discovering models:', (error as Error).message);
      console.log('\n📋 Fallback models (may not be available):');
      console.log('  ⚠️ llama3.1:8b (Ollama)');
      console.log('  ⚠️ deepseek-coder:6.7b (Ollama)');
      console.log('  ⚠️ local-model (LM Studio)');
      
      logger.error('Model discovery failed:', error);
    }
  }

  private groupModelsByProvider(models: ReadonlyArray<ModelInfo>): Record<string, ModelInfo[]> {
    const grouped: Record<string, ModelInfo[]> = {};
    
    for (const model of models) {
      (grouped[model.provider] ??= []);
      grouped[model.provider].push(model);
    }

    // Sort models within each provider by availability and name
    for (const provider in grouped) {
      if (Object.prototype.hasOwnProperty.call(grouped, provider)) {
        grouped[provider].sort((a: Readonly<ModelInfo>, b: Readonly<ModelInfo>) => {
          if (a.isAvailable !== b.isAvailable) {
            return a.isAvailable ? -1 : 1; // Available models first
          }
          return a.name.localeCompare(b.name);
        });
      }
    }

    return grouped;
  }
}