import { OllamaToolCall, ParsedToolCall } from './ollama-config.js';

export function extractToolCalls(calls?: OllamaToolCall[]): ParsedToolCall[] {
  if (!calls) return [];
  const parsed: ParsedToolCall[] = [];
  for (const call of calls) {
    try {
      const args =
        typeof call.function.arguments === 'string'
          ? call.function.arguments
          : JSON.stringify(call.function.arguments);
      parsed.push({
        id: call.id,
        function: { name: call.function.name, arguments: args },
      });
    } catch {
      // ignore malformed tool call
    }
  }
  return parsed;
}

