export type PluginLifecycle = 'development' | 'production' | 'both';

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  lifecycle?: PluginLifecycle;
  tags?: string[];
  dependsOn?: string[];
}

export interface PluginContext {
  // Narrow context to interfaces to avoid infra coupling
  registerCommand?: (name: string, handler: (...args: readonly unknown[]) => unknown) => void;
  registerQuery?: (name: string, handler: (...args: readonly unknown[]) => unknown) => void;
}

export interface IPlugin {
  readonly meta: PluginMetadata;

  initialize?: (context: Readonly<PluginContext>) => Promise<void> | void;
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
}
