import { ProductionIntegrationConfig } from './production-types.js';

export class EnvironmentManager {
  constructor(private readonly config: ProductionIntegrationConfig) {}

  getEnvironment(): string {
    return process.env.NODE_ENV ?? 'development';
  }

  getConfig(): ProductionIntegrationConfig {
    return this.config;
  }
}
