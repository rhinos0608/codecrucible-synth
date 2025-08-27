/**
 * Minimal CodeCrucible Synth Entry Point - Updated for Unified Architecture
 * Core functionality using new unified systems
 */

// Unified Core exports
export { UnifiedCLI as CLI } from './application/interfaces/unified-cli.js';
export { UnifiedModelClient } from './application/services/unified-model-client.js';
export { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
export { MCPServerManager } from './mcp-servers/mcp-server-manager.js';

// Unified System exports
export { UnifiedCLICoordinator } from './application/services/unified-cli-coordinator.js';
export { ConcreteWorkflowOrchestrator } from './application/services/concrete-workflow-orchestrator.js';
export { UnifiedAgentSystem } from './domain/services/unified-agent-system.js';
export { UnifiedConfigurationManager } from './domain/services/unified-configuration-manager.js';

// Security exports (production-ready)
export { InputSanitizer } from './infrastructure/security/input-sanitizer.js';
export { RBACSystem } from './infrastructure/security/production-rbac-system.js';
export { SecretsManager } from './infrastructure/security/secrets-manager.js';
export { EnterpriseAuthManager } from './infrastructure/security/enterprise-auth-manager.js';

// User Interaction
export { CLIUserInteraction } from './infrastructure/user-interaction/cli-user-interaction.js';

// Types - Legacy Core Types (backward compatibility)
export type { 
  ExecutionRequest, 
  ExecutionResponse, 
  Task, 
  Workflow, 
  ProjectContext as LegacyProjectContext 
} from './core/types.js';

// Types - Domain Types (primary)
export type { 
  ProjectContext, 
  UnifiedConfiguration 
} from './domain/types/index.js';
export type * from './domain/types/index.js';

// Interfaces
export type * from './domain/interfaces/workflow-orchestrator.js';
export type * from './domain/interfaces/user-interaction.js';
export type * from './domain/interfaces/event-bus.js';

// Config
export type { AppConfig } from './config/config-manager.js';

// Main CLI entry point using unified architecture
import { program } from 'commander';
import { UnifiedCLI } from './application/interfaces/unified-cli.js';
import { ConcreteWorkflowOrchestrator } from './application/services/concrete-workflow-orchestrator.js';
import { CLIUserInteraction } from './infrastructure/user-interaction/cli-user-interaction.js';
import { getGlobalEventBus } from './domain/interfaces/event-bus.js';
import { getErrorMessage } from './utils/error-utils.js';

/**
 * Minimal initialization function
 */
export async function initializeMinimal(): Promise<UnifiedCLI> {
  try {
    // Create event bus and user interaction
    const eventBus = getGlobalEventBus();
    const userInteraction = new CLIUserInteraction({ verbose: false });

    // Create workflow orchestrator
    const orchestrator = new ConcreteWorkflowOrchestrator();
    await orchestrator.initialize({
      userInteraction,
      eventBus,
      // Minimal dependencies - can be extended as needed
    });

    // Create unified CLI
    const cli = new UnifiedCLI({
      verbose: false,
      contextAware: true,
      performance: true,
      resilience: true
    });
    
    await cli.initialize(orchestrator);
    return cli;

  } catch (error) {
    console.error('❌ Failed to initialize minimal system:', getErrorMessage(error));
    throw error;
  }
}

/**
 * Minimal CLI runner
 */
export async function runMinimal(args: string[]): Promise<void> {
  const cli = await initializeMinimal();
  
  // Setup graceful shutdown
  const cleanup = async () => {
    await cli.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await cli.run(args);
  } catch (error) {
    console.error('❌ CLI error:', getErrorMessage(error));
    process.exit(1);
  }
}

// CLI setup for minimal version
if (typeof process !== 'undefined') {
  program
    .name('codecrucible-minimal')
    .description('CodeCrucible Synth - Minimal Version with Unified Architecture')
    .version('4.0.7-minimal')
    .argument('[prompt...]', 'AI prompt to process')
    .option('-i, --interactive', 'Start interactive mode')
    .option('-v, --verbose', 'Verbose output')
    .option('--no-context', 'Disable context awareness')
    .option('--no-performance', 'Disable performance optimization')
    .option('--no-resilience', 'Disable error resilience')
    .action(async (prompt, options) => {
      const args = [];
      
      if (options.interactive) {
        args.push('interactive');
      } else if (prompt && prompt.length > 0) {
        args.push(...prompt);
      }

      if (options.verbose) args.push('--verbose');
      if (options.noContext) args.push('--no-intelligence');
      if (options.noPerformance) args.push('--no-performance');
      if (options.noResilience) args.push('--no-resilience');

      await runMinimal(args);
    });

  // Auto-run if this is the main module
  if (process.argv[1]?.includes('index.minimal')) {
    program.parse();
  }
}