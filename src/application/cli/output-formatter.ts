import { logger } from '../../infrastructure/logging/unified-logger.js';

export function formatOutput(result: unknown): string {
  // Handle string results directly
  if (typeof result === 'string') {
    return result;
  }
  
  // Handle null/undefined
  if (!result) {
    return '';
  }
  
  // Handle object results - try multiple extraction strategies
  if (typeof result === 'object') {
    const record = result as Record<string, unknown>;
    
    // Strategy 1: Look for common response properties (prioritize MCP patterns)
    const commonProperties = ['content', 'text', 'data', 'output', 'message', 'response'];
    for (const prop of commonProperties) {
      const value = record[prop];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    // Strategy 1a: Look for MCP-specific nested content patterns
    if (record.content && typeof record.content === 'object') {
      const content = record.content as Record<string, unknown>;
      if (typeof content.text === 'string') {
        return content.text;
      }
      if (typeof content.content === 'string') {
        return content.content;
      }
    }
    
    // Strategy 2: Look for nested result properties
    if (record.result && typeof record.result === 'object') {
      const nestedResult = record.result as Record<string, unknown>;
      for (const prop of commonProperties) {
        const value = nestedResult[prop];
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
      
      // If nested result is a string
      if (typeof record.result === 'string') {
        return record.result;
      }
    }
    
    // Strategy 3: Look for streaming response patterns
    if (record.streamingResponse && typeof record.streamingResponse === 'string') {
      return record.streamingResponse;
    }
    
    // Strategy 4: Look for AI model response patterns
    if (record.choices && Array.isArray(record.choices) && record.choices.length > 0) {
      const choice = record.choices[0] as Record<string, unknown>;
      if (choice.message && typeof choice.message === 'object') {
        const message = choice.message as Record<string, unknown>;
        if (typeof message.content === 'string') {
          return message.content;
        }
      }
      if (typeof choice.text === 'string') {
        return choice.text;
      }
    }
    
    // Strategy 5: Handle error objects from failed MCP calls
    if (record.error) {
      const errorMsg = typeof record.error === 'string' ? record.error : 
                      typeof record.error === 'object' && (record.error as any).message ? 
                      (record.error as any).message : 'Tool execution failed';
      return `❌ Error: ${errorMsg}`;
    }

    // Strategy 6: Handle array responses (common in MCP list operations)
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return '(empty result)';
      }
      // Try to format array elements as strings
      const stringElements = result.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item) {
          // Try to extract content from array objects
          const obj = item as Record<string, unknown>;
          for (const prop of commonProperties) {
            const value = obj[prop];
            if (typeof value === 'string' && value.trim()) {
              return value;
            }
          }
          return JSON.stringify(item);
        }
        return String(item);
      });
      return stringElements.join('\n');
    }

    // Strategy 7: Try JSON.stringify for debugging (fallback)
    try {
      const jsonString = JSON.stringify(result, null, 2);
      // Only return JSON if it's a simple object, not a huge complex one
      if (jsonString.length < 1000) {
        return jsonString;
      }
    } catch {
      // JSON.stringify failed, continue to final fallback
    }
  }
  
  // Final fallback - but provide more informative output
  logger.warn('Unable to extract readable content from result', { 
    type: typeof result,
    resultKeys: result && typeof result === 'object' ? Object.keys(result as Record<string, unknown>) : undefined
  });
  
  return `[Unable to display result: ${typeof result}]`;
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
