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
  let buffer = '';
  let accumulated = '';
  let metadata: OllamaStreamingMetadata = {};
  let toolCalls: OllamaToolCall[] = [];
  let buffer = '';

  const processLine = (line: string) => {
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
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {

      if (!line) continue;
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

      if (line) processLine(line);

    }
  }

  if (buffer) {

    try {
      const json = JSON.parse(buffer) as OllamaResponse;
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
      // ignore malformed final buffer
    }

    processLine(buffer);

  }

  return { text: accumulated, metadata, toolCalls };
}
