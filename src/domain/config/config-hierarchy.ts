import { homedir } from 'os';
import { join } from 'path';
import type { UnifiedConfiguration } from '../interfaces/configuration.js';
import { loadConfigFile } from './config-loader.js';

export function getDefaultConfig(): UnifiedConfiguration {
  return {
    system: {
      app: {
        name: 'CodeCrucible Synth',
        version: '0.0.0',
        environment: 'development',
        logLevel: 'info',
        features: [],
      },
      models: {} as Record<string, unknown>,
      voices: {} as Record<string, unknown>,
      tools: {} as Record<string, unknown>,
      security: {} as Record<string, unknown>,
      performance: {} as Record<string, unknown>,
      infrastructure: {} as Record<string, unknown>,
    },
    application: {
      name: 'CodeCrucible Synth',
      version: '0.0.0',
      environment: 'development',
      logLevel: 'info',
      features: [],
    },
    model: {
      defaultProvider: 'ollama',
      defaultModel: process.env.MODEL_DEFAULT_NAME ?? '',
      providers: [],
      routing: {
        strategy: 'round_robin',
        healthCheckInterval: 30000,
        failoverThreshold: 3,
      },
      fallback: { enabled: true, chain: [], maxRetries: 3, backoffMs: 1000 },
      timeout: 30000,
      maxTokens: 4096,
      temperature: 0.7,
    },
    voice: {
      enabled: true,
      defaultVoices: ['explorer'],
      maxConcurrentVoices: 1,
      consensusThreshold: 1,
      voices: {},
    },
    tools: {
      enabled: true,
      discoveryPaths: [],
      maxConcurrentExecutions: 1,
      timeoutMs: 30000,
      sandbox: {
        enabled: true,
        type: 'process',
        resourceLimits: {
          maxMemoryMB: 512,
          maxCpuPercent: 80,
          maxDiskMB: 1024,
          maxExecutionTimeMs: 60000,
          maxFileDescriptors: 256,
        },
        networkIsolation: true,
        fileSystemIsolation: true,
      },
    },
    security: {
      enabled: true,
      level: 'medium',
      policies: [],
      auditing: {
        enabled: true,
        logLevel: 'standard',
        retention: { days: 30, maxSizeMB: 100, compressionEnabled: true },
        destinations: [],
      },
      encryption: {
        enabled: false,
        algorithm: 'AES-256',
        keyRotationIntervalDays: 90,
        encryptAtRest: false,
        encryptInTransit: true,
      },
      enableSandbox: true,
      securityLevel: 'medium',
    },
    performance: {
      caching: {
        enabled: true,
        type: 'memory',
        maxSizeMB: 64,
        ttlSeconds: 60,
        evictionPolicy: 'lru',
      },
      pooling: {
        connections: {
          maxConnections: 10,
          minConnections: 1,
          acquireTimeoutMs: 3000,
          idleTimeoutMs: 30000,
        },
        threads: { coreSize: 1, maxSize: 4, queueSize: 100, keepAliveMs: 60000 },
      },
      optimization: { enabled: false, strategies: [], adaptiveTuning: false },
      monitoring: { enabled: true, metrics: [], alerts: [], dashboards: [] },
      maxConcurrentRequests: 3,
      enableCaching: true,
      defaultTimeout: 30000,
    },
    monitoring: { enabled: true, metrics: [], alerts: [], dashboards: [] },
    infrastructure: {
      database: {
        type: 'sqlite',
        poolSize: 1,
        migrations: true,
        backup: {
          enabled: false,
          schedule: '0 0 * * *',
          retention: 7,
          compression: false,
          destination: join(homedir(), '.codecrucible', 'backups'),
        },
        path: './data.db',
        inMemory: false,
      },
      storage: {
        type: 'local',
        basePath: './',
        encryption: false,
        compression: false,
        configuration: {},
      },
      messaging: { enabled: false, type: 'memory', configuration: {} },
      networking: {
        timeoutMs: 30000,
        retries: 3,
        tls: { enabled: false, version: 'TLS1.3', verifyPeer: true },
      },
    },
  } as unknown as UnifiedConfiguration;
}

export function mergeConfigurations<T extends object>(base: T, override: Partial<T>): T {
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) {
      (base as Record<string, unknown>)[key] = value;
    } else if (value && typeof value === 'object') {
      (base as Record<string, unknown>)[key] = mergeConfigurations((base as Record<string, unknown>)[key] as object || {}, value);
    } else if (value !== undefined) {
      (base as Record<string, unknown>)[key] = value as unknown;
    }
  }
  return base;
}

function loadEnvConfig(): Partial<UnifiedConfiguration> {
  const env: Partial<UnifiedConfiguration> = {};
  if (process.env.NODE_ENV) {
    env.application = env.application ?? { name: '', version: '', environment: 'development', logLevel: 'info', features: [] };
    env.application.environment = process.env.NODE_ENV as 'development' | 'testing' | 'staging' | 'production' || 'development';
  }
  if (process.env.LOG_LEVEL) {
    env.application = env.application ?? { name: '', version: '', environment: 'development', logLevel: 'info', features: [] };
    env.application.logLevel = process.env.LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error' || 'info';
  }
  if (process.env.MODEL_DEFAULT_NAME) {
    env.model = env.model || { defaultProvider: '', defaultModel: '', providers: [], routing: { strategy: 'round_robin', healthCheckInterval: 30000, failoverThreshold: 3 }, fallback: { enabled: true, chain: [], maxRetries: 3, backoffMs: 1000 } };
    if (env.model) {
      env.model.defaultModel = process.env.MODEL_DEFAULT_NAME || '';
    }
  }
  return env;
}

function loadCliConfig(): Partial<UnifiedConfiguration> {
  const cli: Partial<UnifiedConfiguration> = {};
  cli.application = { name: '', version: '', environment: 'development', logLevel: 'info', features: [] };
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split('=');
    if (key === 'logLevel') {
      cli.application.logLevel = value as 'info' | 'debug' | 'warn' | 'error' || 'info';
    }
  }
  return cli;
}

export async function resolveConfig(filePath: string): Promise<UnifiedConfiguration> {
  let config = getDefaultConfig();
  const fileConfig = await loadConfigFile(filePath);
  config = mergeConfigurations(config, fileConfig);
  config = mergeConfigurations(config, loadEnvConfig());
  config = mergeConfigurations(config, loadCliConfig());
  return config;
}
