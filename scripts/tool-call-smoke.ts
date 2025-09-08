/*
 Manual smoke test to verify that tools are forwarded to provider and toolCalls are surfaced.
 This does NOT call a real Ollama server. It monkey-patches the provider's http.post to return
 a canned response that includes tool_calls in the expected shape.
 Run with: npx tsx scripts/tool-call-smoke.ts
*/

import { OllamaAdapter } from '../src/application/services/provider-adapters/ollama-adapter.js';
import type { ModelRequest } from '../src/domain/interfaces/model-client.js';

async function main() {
  const adapter = new OllamaAdapter('http://localhost:11434', 'llama3.1');

  // monkey patch provider.http.post
  const provider: any = (adapter as any).provider;
  const originalPost = provider.http?.post;
  provider.http = {
    ...provider.http,
    post: async (_path: string, body: any) => {
      // Assert that tools and tool_choice are present in the body
      if (!Array.isArray(body.tools) || body.tools.length === 0) {
        throw new Error('tools not forwarded to provider');
      }
      if (body.tool_choice !== 'auto') {
        throw new Error('tool_choice not set to auto');
      }

      // Return a fake non-streamed response containing a tool call
      return new Response(
        JSON.stringify({
          model: body.model,
          created_at: new Date().toISOString(),
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'filesystem_read_file', arguments: { path: 'package.json' } },
              },
            ],
          },
          done: true,
          prompt_eval_count: 10,
          eval_count: 20,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
  };

  const req: ModelRequest = {
    prompt: 'Please read package.json',
    model: 'llama3.1',
    tools: [
      {
        type: 'function',
        function: {
          name: 'filesystem_read_file',
          description: 'Read a file',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
        },
      },
    ],
    stream: false,
  } as any;

  const res = await adapter.request(req);
  console.log('OK toolCalls length:', res.toolCalls?.length || 0);
  if (!res.toolCalls || res.toolCalls.length === 0) {
    throw new Error('No toolCalls surfaced in ModelResponse');
  }
  console.log('OK toolCalls[0]:', res.toolCalls[0]);
}

main().catch(err => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});

