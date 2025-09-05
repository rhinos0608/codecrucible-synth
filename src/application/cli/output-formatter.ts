import { logger } from '../../infrastructure/logging/unified-logger.js';

export function formatOutput(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    const content = (record.response ?? record.content) as unknown;
    if (typeof content === 'string') {
      return content;
    }
  }
  logger.warn('Unknown result format', { type: typeof result });
  return String(result ?? '');
}

// CLI coordinator expects an OutputFormatter class
export class OutputFormatter {
  print(message: string): void {
    console.log(message);
  }

  showHelp(): void {
    console.log('CodeCrucible Synth - Help');
    console.log('Commands:');
    console.log('  help    - Show this help message');
    console.log('  models  - List available models');
    console.log('  exit    - Exit the application');
  }

  async showModels(): Promise<void> {
    console.log('Available models:');
    console.log('  - qwen2.5-coder:7b');
    console.log('  - deepseek-coder:8b');
    // TODO: Get actual available models from Ollama
  }
}
