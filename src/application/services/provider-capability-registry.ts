import {
  ProviderCapability,
  IProviderCapabilityRegistry,
} from '../../domain/interfaces/provider-capability-registry.js';

export class ProviderCapabilityRegistry implements IProviderCapabilityRegistry {
  private registry = new Map<string, ProviderCapability>();

  register(provider: string, capability: ProviderCapability): void {
    this.registry.set(provider, capability);
  }

  supports(provider: string, capability: keyof ProviderCapability): boolean {
    return !!this.registry.get(provider)?.[capability];
  }
}

export const providerCapabilityRegistry = new ProviderCapabilityRegistry();
