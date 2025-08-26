// Domain Types Index
// Central export point for all domain types

export * from './core-types.js';

// Re-export from infrastructure layer for backward compatibility
export type {
  UnifiedClientConfig,
  AppConfig,
  AgentConfig,
} from '../../infrastructure/config/config-types.js';

// Re-export from infrastructure security layer
export type {
  SecurityValidation,
} from '../../infrastructure/security/security-types.js';
export { 
  SecurityError,
  CLIError,
  CLIExitCode,
} from '../../infrastructure/security/security-types.js';

// Re-export from application layer
export type {
  REPLInterface,
  ModelClient,
} from '../../application/interfaces/interface-types.js';
export {
  ResponseValidator,
} from '../../application/interfaces/interface-types.js';