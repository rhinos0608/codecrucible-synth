import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import type { IPlugin, PluginContext } from '../../domain/interfaces/plugin.js';

export class PluginManager {
  private readonly logger = createLogger('PluginManager');
  private readonly plugins = new Map<string, IPlugin>();
  private initialized = false;

  public constructor(private readonly context: Readonly<PluginContext> = {}) {}

  public register(plugin: Readonly<IPlugin>): void {
    const key = `${plugin.meta.name}@${plugin.meta.version}`;
    if (this.plugins.has(key)) {
      this.logger.warn(`Plugin already registered: ${key}`);
      return;
    }
    this.plugins.set(key, plugin);
    this.logger.info(`Registered plugin: ${key}`);
  }

  public async initializeAll(): Promise<void> {
    if (this.initialized) return;
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.initialize) await plugin.initialize(this.context);
        this.logger.info(`Initialized plugin: ${plugin.meta.name}`);
      } catch (err) {
        this.logger.error(`Failed to initialize plugin ${plugin.meta.name}`, err);
      }
    }
    this.initialized = true;
  }

  public async startAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.start) await plugin.start();
        this.logger.info(`Started plugin: ${plugin.meta.name}`);
      } catch (err) {
        this.logger.error(`Failed to start plugin ${plugin.meta.name}`, err);
      }
    }
  }

  public async stopAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.stop) await plugin.stop();
        this.logger.info(`Stopped plugin: ${plugin.meta.name}`);
      } catch (err) {
        this.logger.error(`Failed to stop plugin ${plugin.meta.name}`, err);
      }
    }
  }

  // Simple loader for pre-imported modules/factories to avoid direct FS coupling here
  public async loadFromFactories(factories: ReadonlyArray<() => Promise<IPlugin> | IPlugin>): Promise<void> {
    for (const factory of factories) {
      const plugin = await Promise.resolve(factory());
      this.register(plugin);
    }
  }
}
