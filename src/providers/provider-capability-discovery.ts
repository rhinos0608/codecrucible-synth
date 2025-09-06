import type { ProviderType } from './provider-selection-strategy.js';
import { ProviderRegistry } from './provider-registry.js';

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
}

export interface IProviderCapabilityDiscovery {
  getCapabilities: (provider: ProviderType, model?: string) => ProviderCapabilities;
}

export class StaticProviderCapabilityDiscovery implements IProviderCapabilityDiscovery {
  constructor(private readonly registry: ProviderRegistry) {}

  getCapabilities(provider: ProviderType, model?: string): ProviderCapabilities {
    const config = this.registry.getProvider(provider);
    if (!config) {
      return { supportsStreaming: false, supportsToolCalling: false };
    }
    if (provider === 'ollama') {
      const toolModels = [
        'llama3',
        'llama3.1',
        'llama3.2',
        'qwen2.5',
        'qwq',
        'mistral',
        'codellama',
      ];
      const lower = model?.toLowerCase() || '';
      const supportsTools = toolModels.some(m => lower.includes(m));
      return { supportsStreaming: true, supportsToolCalling: supportsTools };
    }
    return {
      supportsStreaming: config.capabilities.streaming,
      supportsToolCalling: config.capabilities.toolCalling,
    };
  }
}
