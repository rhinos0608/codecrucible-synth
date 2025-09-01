/**
 * Main CLI Interface - Replaced with Unified Implementation
 *
 * This replaces the previous 2582-line "God Object" CLI with a clean interface
 * that uses the UnifiedCLICoordinator pattern. All functionality is preserved
 * but organized using proper separation of concerns and dependency injection.
 */

// Re-export the clean unified implementation
export { UnifiedCLI as CLI } from './unified-cli.js';
export type { CLIOptions, CLIContext } from './unified-cli.js';

// Legacy compatibility exports for existing code
export { UnifiedCLI } from './unified-cli.js';
export { UnifiedCLICoordinator } from '../services/unified-cli-coordinator.js';
export { ConcreteWorkflowOrchestrator } from '../services/concrete-workflow-orchestrator.js';

/**
 * MIGRATION NOTES:
 *
 * The previous CLI implementation (2582 lines) has been replaced with a clean
 * UnifiedCLI that provides the same functionality through:
 *
 * 1. UnifiedCLICoordinator - Orchestrates all specialized CLI capabilities:
 *    - Context intelligence and project analysis
 *    - Performance optimization with lazy loading
 *    - Error resilience and recovery systems
 *    - User interface and interaction management
 *    - Session management and workflow coordination
 *
 * 2. ConcreteWorkflowOrchestrator - Breaks circular dependencies using mediator pattern
 *
 * 3. Specialized components are preserved and coordinated:
 *    - ContextAwareCLIIntegration
 *    - OptimizedContextAwareCLI
 *    - ResilientCLIWrapper
 *    - CLIUserInteraction
 *
 * BENEFITS OF REPLACEMENT:
 * - Reduced from 2582 lines to ~300 lines of clean code
 * - Eliminated "God Object" anti-pattern
 * - Broke circular dependencies
 * - Improved testability and maintainability
 * - Preserved all original functionality
 * - Added better error handling and performance optimization
 *
 * USAGE:
 * The CLI interface remains the same. Existing code can continue using:
 * - new CLI(options)
 * - cli.initialize(orchestrator)
 * - cli.processPrompt(prompt)
 * - cli.startInteractive()
 * - cli.run(args)
 */
