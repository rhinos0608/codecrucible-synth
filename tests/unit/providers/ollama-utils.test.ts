import { parseEnvInt, OllamaToolCall } from '../../../src/providers/hybrid/ollama-config.js';
import { extractToolCalls } from '../../../src/providers/hybrid/ollama-tool-processor.js';

describe('ollama utils', () => {
  test('parseEnvInt respects bounds', () => {
    process.env.TEST_INT = '50';
    expect(parseEnvInt('TEST_INT', 1, 10, 40)).toBe(40);
    delete process.env.TEST_INT;
  });

  test('extractToolCalls handles arguments', () => {
    const calls: OllamaToolCall[] = [{ function: { name: 'f', arguments: { a: 1 } } }];
    const parsed = extractToolCalls(calls);
    expect(parsed[0].function.arguments).toBe(JSON.stringify({ a: 1 }));
  });
});
