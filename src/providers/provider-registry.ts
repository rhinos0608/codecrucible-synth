import type { ProviderType } from './provider-selection-strategy.js';

export interface ProviderConfig {
  name: ProviderType;
  endpoint?: string;
  models?: string[];
  capabilities: {
    streaming: boolean;
    toolCalling: boolean;
  };
}

export class ProviderRegistry {
  constructor(
    private readonly providers: Record<ProviderType, ProviderConfig>,
    private fallbackChain: ProviderType[]
  ) {}

  getProvider(name: ProviderType): ProviderConfig | undefined {
    return this.providers[name];
  }

  getFallbackChain(): ProviderType[] {
    return [...this.fallbackChain];
  }

  setFallbackChain(chain: ProviderType[]): void {
    this.fallbackChain = [...chain];
  }
}

export const defaultProviderRegistry = new ProviderRegistry(
  {
    'lm-studio': {
      name: 'lm-studio',
      endpoint: 'ws://localhost:8080',
      capabilities: { streaming: true, toolCalling: true },
    },
    ollama: {
      name: 'ollama',
      endpoint: 'http://localhost:11434',
      capabilities: { streaming: true, toolCalling: true },
    },
    claude: {
      name: 'claude',
      endpoint: 'https://api.anthropic.com/v1/messages',
      capabilities: { streaming: false, toolCalling: true },
    },
    huggingface: {
      name: 'huggingface',
      endpoint: 'https://api-inference.huggingface.co',
      capabilities: { streaming: false, toolCalling: false },
    },
    auto: {
      name: 'auto',
      capabilities: { streaming: true, toolCalling: true },
    },
  },
  ['ollama', 'lm-studio', 'claude', 'huggingface']
);
