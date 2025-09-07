export interface ProviderCapability {
  streaming?: boolean;
  toolCalling?: boolean;
  [key: string]: boolean | undefined;
}

export interface IProviderCapabilityRegistry {
  register: (provider: string, capability: Readonly<ProviderCapability>) => void;
  supports: (provider: string, capability: keyof ProviderCapability) => boolean;
}
