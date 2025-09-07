import { ProviderCapabilityRegistry } from '../../../../src/application/services/provider-capability-registry.js';

describe('ProviderCapabilityRegistry', () => {
  it('registers and checks capabilities', () => {
    const registry = new ProviderCapabilityRegistry();
    registry.register('test', { streaming: true, toolCalling: false });
    expect(registry.supports('test', 'streaming')).toBe(true);
    expect(registry.supports('test', 'toolCalling')).toBe(false);
  });
});
