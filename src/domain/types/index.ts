/**
 * Domain Types Index
 *
 * Single source of truth for all type definitions in CodeCrucible Synth.
 * Exports the unified type system following domain-driven design principles.
 */

// Export the unified type system
export * from './unified-types.js';

// Re-export types from interfaces for convenience (avoiding conflicts)
export type {
  UnifiedConfiguration,
  ConfigurationValidation,
  ConfigurationError,
} from '../interfaces/configuration.js';

export type { IEventBus, SystemEvents } from '../interfaces/event-bus.js';

export type { IModelClient, ModelInfo } from '../interfaces/model-client.js';

export type {
  ITool,
  IToolRegistry,
  IToolExecutor,
  ToolDefinition,
} from '../interfaces/tool-system.js';

export type { IUserInteraction, IUserInput, IUserOutput } from '../interfaces/user-interaction.js';

export type {
  IWorkflowOrchestrator,
  WorkflowRequest,
  WorkflowResponse,
} from '../interfaces/workflow-orchestrator.js';

// Legacy compatibility - warn about deprecated imports
const warnDeprecated = (importPath: string) => {
  console.warn(
    `⚠️  Importing from ${importPath} is deprecated. ` +
      `Use 'src/domain/types/index.js' for all type definitions.`
  );
};

// Export legacy compatibility if needed
export const LEGACY_IMPORT_WARNING = {
  'core/types': (): void => {
    warnDeprecated('src/core/types.ts');
  },
  types: (): void => {
    warnDeprecated('src/types.ts');
  },
  'infrastructure/config/config-types': (): void => {
    warnDeprecated('src/infrastructure/config/config-types.ts');
  },
};

export const isValidId = (id: unknown): id is string => {
  return typeof id === 'string' && id.length > 0;
};

export const isValidEmail = (email: unknown): email is string => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
};

export const isValidUrl = (url: unknown): url is string => {
  if (typeof url !== 'string') return false;
  try {
    const _ = new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidSemver = (version: unknown): version is string => {
  const semverRegex =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  return typeof version === 'string' && semverRegex.test(version);
};
