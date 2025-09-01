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
  registerCommand?: (name: string, handler: Function) => void;
  registerQuery?: (name: string, handler: Function) => void;
}

export interface IPlugin {
  readonly meta: PluginMetadata;

  initialize?(context: PluginContext): Promise<void> | void;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}

