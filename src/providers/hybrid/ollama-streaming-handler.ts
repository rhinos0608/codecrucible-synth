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

  let done = false;
  while (!done) {
    const { value, done: readDone } = await reader.read();
    done = readDone;
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const json = JSON.parse(line) as OllamaResponse;
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
        // ignore malformed lines
      }
    }
  }

  return { text: accumulated, metadata, toolCalls };
}
