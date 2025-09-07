import {
  ClaudeAdapter,
  HuggingFaceAdapter,
  LMStudioAdapter,
  OllamaAdapter,
  ProviderAdapter,
} from './provider-adapters/index.js';

export interface ProviderConfig {
  type: 'ollama' | 'lm-studio' | 'claude' | 'huggingface';
  endpoint: string;
  models?: string[];
  defaultModel?: string;
  name?: string;
  enabled?: boolean;
  priority?: number;
  timeout?: number;
  apiKey?: string; // Required for claude and huggingface
}

export function createAdaptersFromProviders(
  providers: Readonly<ProviderConfig[]>
): ProviderAdapter[] {
  const adapters: ProviderAdapter[] = [];
  for (const p of providers) {
    const defaultModel = p.defaultModel || p.models?.[0] || '';

    if (p.type === 'ollama') {
      // Ollama can work without a default model - it uses the model from each request
      const modelToUse = defaultModel || 'llama3.1:8b'; // Fallback for adapter constructor
      adapters.push(new OllamaAdapter(p.endpoint, modelToUse));
    } else if (p.type === 'lm-studio') {
      if (!defaultModel) continue;
      adapters.push(new LMStudioAdapter(p.endpoint, defaultModel));
    } else if (p.type === 'claude') {
      if (!p.apiKey) {
        console.warn('Claude provider requires apiKey, skipping');
        continue;
      }
      adapters.push(new ClaudeAdapter(p.apiKey, p.endpoint));
    } else if (p.type === 'huggingface') {
      if (!p.apiKey || !defaultModel) {
        console.warn('HuggingFace provider requires apiKey and defaultModel, skipping');
        continue;
      }
      adapters.push(new HuggingFaceAdapter(p.apiKey, defaultModel, p.endpoint));
    }
  }
  return adapters;
}
