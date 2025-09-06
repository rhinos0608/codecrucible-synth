/**
 * Core client module - Unified Model Client
 * Application layer service that coordinates multiple AI model providers
 */

export {
  ModelClient,
  ModelClient as UnifiedModelClient,
  type ModelClientOptions as UnifiedModelClientConfig,
} from './model-client.js';

// Use the local UnifiedClientConfig from types.ts
import type { UnifiedClientConfig } from '../../domain/types/index.js';
import { defaultProviderRegistry } from '../../providers/provider-registry.js';
export type { UnifiedClientConfig } from '../../domain/types/index.js';

// Export a default config creator function
export function createDefaultUnifiedClientConfig(): UnifiedClientConfig {
  const fallbackChain = defaultProviderRegistry.getFallbackChain();
  const providers = fallbackChain
    .map(p => defaultProviderRegistry.getProvider(p))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map(p => ({ type: p.name, endpoint: p.endpoint }));

  return {
    providers,
    executionMode: 'auto' as const,
    fallbackChain,
    performanceThresholds: {
      fastModeMaxTokens: 1000,
      timeoutMs: 30000,
      maxConcurrentRequests: 3,
    },
    security: {
      enableSandbox: true,
      maxInputLength: 10000,
      allowedCommands: ['npm', 'node', 'git'],
    },
  };
}

// Re-export common types for backward compatibility
export type {
  ProjectContext,
  ModelRequest,
  ModelResponse,
  MetricsData,
  ComplexityAnalysis,
  TaskType,
} from '../../domain/types/index.js';
