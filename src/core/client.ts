/**
 * Core client module - Re-exports from refactored unified model client
 * This file bridges the old import structure with the new refactored system
 */

export { UnifiedModelClient } from '../refactor/unified-model-client.js';

// Use the local UnifiedClientConfig from types.ts
import type { UnifiedClientConfig } from './types.js';
export type { UnifiedClientConfig } from './types.js';

// Export a default config creator function
export function createDefaultUnifiedClientConfig(): UnifiedClientConfig {
  return {
    providers: [
      {
        type: 'auto',
        endpoint: 'http://localhost:11434',
      },
    ],
    executionMode: 'auto' as const,
    fallbackChain: ['ollama', 'lm-studio', 'auto'] as const,
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
} from './types.js';
