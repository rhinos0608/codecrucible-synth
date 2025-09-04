import { EventEmitter } from 'events';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { IEventBus } from '../interfaces/event-bus.js';
import type { ILogger } from '../interfaces/logger.js';
import {
  ConfigurationSource,
  ConfigurationValidation,
  UnifiedConfiguration,
} from '../interfaces/configuration.js';
import {
  getDefaultConfig,
  mergeConfigurations,
  resolveConfig,
} from '../config/config-hierarchy.js';
import { saveConfigFile } from '../config/config-loader.js';
import { validateConfiguration } from '../config/config-validator.js';
import { ConfigWatcher } from '../config/config-watcher.js';

export interface IUnifiedConfigurationManager {
  initialize: () => Promise<void>;
  loadConfiguration: () => Promise<UnifiedConfiguration>;
  getConfiguration: () => UnifiedConfiguration;
  updateConfiguration: (
    updates: Readonly<Partial<UnifiedConfiguration>>,
    source: Readonly<ConfigurationSource>
  ) => Promise<void>;
  validateConfiguration: (config: Readonly<Partial<UnifiedConfiguration>>) => ConfigurationValidation;
  saveConfiguration: (filePath?: string) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  watchForChanges: (enabled: boolean) => void;
}

export class UnifiedConfigurationManager
  extends EventEmitter
  implements IUnifiedConfigurationManager
{
  private currentConfig!: UnifiedConfiguration;
  private watcher?: ConfigWatcher;

  constructor(
    private logger: ILogger,
    private configFilePath: string = join(homedir(), '.codecrucible', 'config.yaml'),
    private eventBus?: IEventBus
  ) {
    super();
  }

  async initialize(): Promise<void> {
    const { mkdir } = await import('fs/promises');
    await mkdir(dirname(this.configFilePath), { recursive: true });
    this.currentConfig = await resolveConfig(this.configFilePath);
    this.emit('initialized', this.currentConfig);
    this.eventBus?.emit('system:initialize', {
      component: 'UnifiedConfigurationManager',
    });
  }

  async loadConfiguration(): Promise<UnifiedConfiguration> {
    this.currentConfig = await resolveConfig(this.configFilePath);
    return this.currentConfig;
  }

  getConfiguration(): UnifiedConfiguration {
    return this.currentConfig;
  }

  async updateConfiguration(
    updates: Partial<UnifiedConfiguration>,
    source: ConfigurationSource
  ): Promise<void> {
    const merged = mergeConfigurations({ ...this.currentConfig }, updates);
    const validation = validateConfiguration(merged);
    if (!validation.isValid) {
      throw new Error(
        `Invalid configuration: ${validation.errors.map((e: any) => e.message).join(', ')}`
      );
    }
    this.currentConfig = merged;
    await saveConfigFile(this.configFilePath, this.currentConfig);
    this.emit('updated', { config: this.currentConfig, source });
  }

  validateConfiguration(config: Partial<UnifiedConfiguration>): ConfigurationValidation {
    return validateConfiguration(config);
  }

  async saveConfiguration(filePath?: string): Promise<void> {
    await saveConfigFile(filePath || this.configFilePath, this.currentConfig);
  }

  async resetToDefaults(): Promise<void> {
    this.currentConfig = getDefaultConfig();
    await this.saveConfiguration();
    this.emit('reset', this.currentConfig);
  }

  watchForChanges(enabled: boolean): void {
    if (enabled) {
      if (!this.watcher) {
        this.watcher = new ConfigWatcher(this.configFilePath, async () => {
          this.logger.info('Configuration file changed, reloading');
          this.currentConfig = await resolveConfig(this.configFilePath);
          this.emit('reloaded', this.currentConfig);
        });
      }
      this.watcher.start();
    } else {
      this.watcher?.stop();
    }
  }
}

let singleton: UnifiedConfigurationManager | null = null;
export async function getUnifiedConfigurationManager(): Promise<UnifiedConfigurationManager> {
  if (!singleton) {
    // Avoid importing infrastructure from the domain layer; use domain console logger by default
    const { createConsoleLogger } = await import('../interfaces/logger.js');
    singleton = new UnifiedConfigurationManager(createConsoleLogger('UnifiedConfigurationManager'));
    await singleton.initialize();
  }
  return singleton;
}

export async function createUnifiedConfigurationManager(options?: {
  logger?: ILogger;
  configFilePath?: string;
  eventBus?: IEventBus;
}): Promise<UnifiedConfigurationManager> {
  const logger = options?.logger || (await import('../interfaces/logger.js')).createConsoleLogger('UnifiedConfigurationManager');
  const manager = new UnifiedConfigurationManager(logger, options?.configFilePath, options?.eventBus);
  await manager.initialize();
  return manager;
}
