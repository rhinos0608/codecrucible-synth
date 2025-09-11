/**
 * Execution backend interface for domain layer only.
 * This abstraction prevents the domain layer from importing concrete
 * infrastructure implementations (e.g. Rust execution backend).
 */

import type {
  IToolExecutor,
  ToolExecutionRequest,
  ToolExecutionResult,
} from '../interfaces/tool-system.js';

// Use the domain tool system request/result shapes so backends can accept and
// return the exact types used by the domain executor. This keeps types consistent
// without importing infrastructure into domain modules.
export type ExecutionRequest = ToolExecutionRequest;
export type ExecutionResult = ToolExecutionResult;
export type TypescriptOrchestrator = IToolExecutor;

export interface IExecutionBackend {
  isAvailable: () => boolean;
  execute: (request: Readonly<ExecutionRequest>) => Promise<ExecutionResult>;
  setTypescriptOrchestrator: (orchestrator: Readonly<TypescriptOrchestrator>) => void;
}
