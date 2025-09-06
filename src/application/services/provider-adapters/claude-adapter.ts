import { ModelRequest, ModelResponse } from '../../../domain/interfaces/model-client.js';
import { ProviderAdapter } from './provider-adapter.js';

export class ClaudeAdapter implements ProviderAdapter {
  readonly name = 'claude';
  constructor(
    private apiKey: string,
    private endpoint = 'https://api.anthropic.com/v1/messages'
  ) {}

  async request(req: ModelRequest): Promise<ModelResponse> {
    const body = {
      model: req.model || 'claude-3-sonnet-20240229',
      max_tokens: req.maxTokens || 1024,
      messages: req.messages ?? [{ role: 'user', content: req.prompt }],
      temperature: req.temperature ?? 0.7,
    };
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Claude request failed: ${response.status}`);
    const data: any = await response.json();
    return {
      id: data.id,
      content: data.content?.map((c: any) => c.text).join('') ?? '',
      model: data.model,
      provider: this.name,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }
}
