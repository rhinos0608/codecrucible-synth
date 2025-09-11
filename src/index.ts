/**
 * CodeCrucible Synth - Minimal Entrypoint
 * Delegates CLI wiring and bootstrap to modules to avoid a monolithic index.
 */

import { config } from 'dotenv';
config();

import { buildProgram } from './application/cli/program.js';
import { logger } from './infrastructure/logging/logger.js';

// Public re‑exports (preserve package surface)
export { UnifiedCLI as CLI } from './application/interfaces/unified-cli.js';
export { UnifiedCLICoordinator } from './application/services/unified-cli-coordinator.js';
export { ConcreteWorkflowOrchestrator } from './application/services/concrete-workflow-orchestrator.js';
export { ModelClient as UnifiedModelClient } from './application/services/model-client.js';
export { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
export { MCPServerManager } from './mcp-servers/mcp-server-manager.js';

export { UnifiedAgentSystem } from './domain/services/unified-agent/index.js';
export { UnifiedConfigurationManager } from './domain/config/config-manager.js';
export type { UnifiedSecurityValidator } from './domain/services/unified-security-validator.js';
export { UnifiedPerformanceSystem } from './domain/services/unified-performance-system.js';
export { UnifiedServerSystem } from './domain/services/unified-server-system.js';

export { CLIUserInteraction } from './infrastructure/user-interaction/cli-user-interaction.js';
export * from './application/cli/index.js';

export type * from './domain/types/index.js';
export type * from './domain/interfaces/workflow-orchestrator.js';
export type * from './domain/interfaces/user-interaction.js';
export type * from './domain/interfaces/event-bus.js';
export type { CLIOptions, CLIContext } from './application/interfaces/unified-cli.js';

export async function main(): Promise<void> {
  const program = await buildProgram();
  await program.parseAsync(process.argv);
}

// Auto-run when directly executed
if (process.argv[1]?.includes('index.js') || process.argv[1]?.includes('index.ts')) {
  main().catch(error => {
    logger.fatal('Fatal startup error', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : String(error);
    console.error('✖ Fatal error:', message);
    process.exit(1);
  });
}

export default main;
