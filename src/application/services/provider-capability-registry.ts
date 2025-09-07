import {
  IProviderCapabilityRegistry,
  ProviderCapability,
} from '../../domain/interfaces/provider-capability-registry.js';

export class ProviderCapabilityRegistry implements IProviderCapabilityRegistry {
  private readonly registry = new Map<string, ProviderCapability>();

  public register(provider: string, capability: Readonly<ProviderCapability>): void {
    this.registry.set(provider, capability);
  }

  public supports(provider: string, capability: keyof ProviderCapability): boolean {
    return !!this.registry.get(provider)?.[capability];
  }
}

export const providerCapabilityRegistry = new ProviderCapabilityRegistry();
