import { ProviderAdapter, OllamaAdapter, LMStudioAdapter } from './provider-adapters.js';

export type ProviderConfig = {
  type: 'ollama' | 'lm-studio';
  endpoint: string;
  models?: string[];
  defaultModel?: string;
  name?: string;
  enabled?: boolean;
  priority?: number;
  timeout?: number;
};

export function createAdaptersFromProviders(
  providers: Readonly<ProviderConfig[]>
): ProviderAdapter[] {
  const adapters: ProviderAdapter[] = [];
  for (const p of providers) {
    const defaultModel = p.defaultModel || (p.models && p.models[0]) || '';
    if (!defaultModel) continue;
    if (p.type === 'ollama') {
      adapters.push(new OllamaAdapter(p.endpoint, defaultModel));
    } else if (p.type === 'lm-studio') {
      adapters.push(new LMStudioAdapter(p.endpoint, defaultModel));
    }
  }
  return adapters;
}
