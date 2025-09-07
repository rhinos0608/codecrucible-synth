import { OllamaResponse, OllamaStreamingMetadata, OllamaToolCall } from './ollama-config.js';

export async function handleStreaming(
  response: Response,
  onToken: (token: string, metadata?: OllamaStreamingMetadata) => void
): Promise<{ text: string; metadata: OllamaStreamingMetadata; toolCalls: OllamaToolCall[] }> {
  const reader = response.body?.getReader();
  if (!reader) {
    return { text: '', metadata: {}, toolCalls: [] };
  }

  const decoder = new TextDecoder();
  let accumulated = '';
  let metadata: OllamaStreamingMetadata = {};
  let toolCalls: OllamaToolCall[] = [];
  let buffer = '';

  function processChunk(chunk: string): void {
    try {
      const json = JSON.parse(chunk) as OllamaResponse;
      if (json.message?.content) {
        onToken(json.message.content, metadata);
        accumulated += json.message.content;
      }
      if (json.message?.tool_calls) {
        toolCalls = json.message.tool_calls;
      }
      metadata = {
        model: json.model,
        totalDuration: json.total_duration,
        loadDuration: json.load_duration,
        promptEvalCount: json.prompt_eval_count,
        promptEvalDuration: json.prompt_eval_duration,
        evalCount: json.eval_count,
        evalDuration: json.eval_duration,
        context: json.context,
      };
    } catch {
      // ignore malformed chunks
    }
  }

  // eslint-disable-next-line no-constant-condition, @typescript-eslint/no-unnecessary-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line) continue;
      processChunk(line);
    }
  }

  if (buffer.length > 0) {
    processChunk(buffer);
  }

  return { text: accumulated, metadata, toolCalls };
}
