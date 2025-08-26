/**
 * Application Layer Index
 * Clean exports following ARCHITECTURE.md principles
 * 
 * Exports: Use cases, services, and facade only
 * No infrastructure dependencies exposed
 */

// Main facade
export { ApplicationServiceFacade } from './application-service-facade.js';

// Use cases
export { ProcessAIRequestUseCase } from './use-cases/process-ai-request-use-case.js';
export { MultiVoiceSynthesisUseCase } from './use-cases/multi-voice-synthesis-use-case.js';
export { LivingSpiralProcessUseCase } from './use-cases/living-spiral-process-use-case.js';
export { AnalyzeCodebaseUseCase } from './use-cases/analyze-codebase-use-case.js';

// Application services
export { SimpleCouncilCoordinator } from './services/simple-council-coordinator.js';
export { SpiralPhaseExecutor } from './services/spiral-phase-executor.js';
export { SpiralConvergenceAnalyzer } from './services/spiral-convergence-analyzer.js';

// Coordinators
export { SimplifiedLivingSpiralCoordinator } from './coordinators/simplified-living-spiral-coordinator.js';

// Types (input/output interfaces)
export type {
  AIRequestInput,
  AIRequestOutput,
  MultiVoiceSynthesisInput,
  MultiVoiceSynthesisOutput,
  LivingSpiralInput,
  LivingSpiralOutput,
  SimplifiedSpiralInput,
  SimplifiedSpiralOutput,
  CodebaseAnalysisInput,
  CodebaseAnalysisOutput,
} from './application-service-facade.js';

export type { CouncilRequest, CouncilResponse } from './services/simple-council-coordinator.js';
export type { PhaseInput, PhaseOutput } from './services/spiral-phase-executor.js';
export type { IterationResult, ConvergenceAnalysis } from './services/spiral-convergence-analyzer.js';