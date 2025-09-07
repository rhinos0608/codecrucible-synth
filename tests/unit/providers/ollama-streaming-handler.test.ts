import { handleStreaming } from '../../../src/providers/hybrid/ollama-streaming-handler.js';
import { OllamaStreamingMetadata } from '../../../src/providers/hybrid/ollama-config.js';

describe('handleStreaming', () => {
  test('preserves chunks split across boundaries', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      '{"model":"m","message":{"content":"hel"',
      'lo"},"done":false}\n{"model":"m","message":{"content":" world"},"done":true}\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    const response = new Response(stream);
    const tokens: string[] = [];
    const result = await handleStreaming(
      response,
      (token: string, _meta?: OllamaStreamingMetadata) => {
        tokens.push(token);
      }
    );
    expect(tokens.join('')).toBe('hello world');
    expect(result.text).toBe('hello world');
  });
});
