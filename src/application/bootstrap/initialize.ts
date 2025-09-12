/**
 * Bootstrap initializer extracted from index.ts to keep entrypoint slim.
 */
import { CLIOptions, UnifiedCLI } from '../interfaces/unified-cli.js';
import { CLIUserInteraction } from '../../infrastructure/user-interaction/cli-user-interaction.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { toReadonlyRecord } from '../../utils/type-guards.js';
import { enterpriseErrorHandler } from '../../infrastructure/error-handling/enterprise-error-handler.js';
import { ErrorSeverity } from '../../infrastructure/error-handling/structured-error-system.js';
import type { ServiceFactory } from '../services/service-factory.js';
import { bootstrapModelSelection } from '../cli/bootstrap/model-selection.js';
import { bootstrapToolRegistration } from '../cli/bootstrap/tool-registration.js';

export async function initialize(
  cliOptions: CLIOptions,
  isInteractive: boolean
): Promise<{ cli: UnifiedCLI; serviceFactory: ServiceFactory }> {
  try {
    logger.info('Initializing CodeCrucible Synth (bootstrap module)...');
    const startTime = Date.now();

    const { ServiceFactory } = await import('../services/service-factory.js');
    const serviceFactory: import('../services/service-factory.js').ServiceFactory =
      new ServiceFactory({
        correlationId: `cli-${Date.now()}`,
        logLevel: cliOptions.verbose ? 'debug' : 'info',
      });

    // Get runtime context and set global event bus for legacy consumers
    const runtimeContext = serviceFactory.getRuntimeContext();
    const { eventBus } = runtimeContext;
    const { setGlobalEventBus } = await import('../../domain/interfaces/event-bus.js');
    setGlobalEventBus(eventBus);

    const userInteraction = new CLIUserInteraction({ verbose: cliOptions.verbose });

    const { mcpServerManager } = await bootstrapToolRegistration();

    const { modelClient } = await bootstrapModelSelection(isInteractive);

    // Orchestrator
    const { ConcreteWorkflowOrchestrator } = await import(
      '../services/concrete-workflow-orchestrator.js'
    );
    const { StreamingManager } = await import('../services/orchestrator/streaming-manager.js');
    const { ToolExecutionRouter } = await import(
      '../services/orchestrator/tool-execution-router.js'
    );
    const { ProviderCapabilityRegistry } = await import(
      '../services/provider-capability-registry.js'
    );

    const streamingManager = new StreamingManager();
    const capabilityRegistry = new ProviderCapabilityRegistry();
    const toolExecutionRouter = new ToolExecutionRouter(
      mcpServerManager as unknown as import('../../domain/interfaces/mcp-manager.js').IMcpManager
    );
    const orchestrator = new ConcreteWorkflowOrchestrator(
      streamingManager,
      toolExecutionRouter,
      capabilityRegistry
    ) as unknown as import('../../domain/interfaces/workflow-orchestrator.js').IWorkflowOrchestrator;

    await orchestrator.initialize({
      userInteraction:
        userInteraction as unknown as import('../../domain/interfaces/user-interaction.js').IUserInteraction,
      eventBus,
      modelClient,
      mcpManager:
        mcpServerManager as unknown as import('../../domain/interfaces/mcp-manager.js').IMcpManager,
      runtimeContext,
    });

    // Expose SubAgent dependencies for agent_spawn tool
    try {
      const { setSubAgentDependencies } = await import(
        '../services/orchestrator/sub-agent-runtime.js'
      );
      setSubAgentDependencies(
        modelClient as unknown as import('../../domain/interfaces/model-client.js').IModelClient,
        mcpServerManager as unknown as import('../../domain/interfaces/mcp-manager.js').IMcpManager
      );
    } catch (e) {
      logger.warn('Failed to set SubAgent dependencies', toReadonlyRecord(e));
    }

    const cli = new UnifiedCLI(cliOptions);
    await cli.initialize(orchestrator);

    const initTime = Date.now() - startTime;
    logger.info(`Unified system initialized in ${initTime}ms`);

    // Generate codecrucible.md at startup with a high-level overview
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const file = path.resolve(process.cwd(), 'codecrucible.md');
      const content =
        `# CodeCrucible Synth Overview\n\n` +
        `This file is generated at startup to summarize the architecture.\n\n` +
        `## Layers\n- Domain: Core interfaces and types under \`src/domain\`.\n- Application: Orchestrators, services, CLI under \`src/application\`.\n- Infrastructure: Providers, tools, logging, MCP, Rust backend under \`src/infrastructure\`.\n- Providers: Local and hybrid model providers under \`src/providers\`.\n\n` +
        `## Orchestration\n- Main orchestrator: ConcreteWorkflowOrchestrator.\n- Sub-agent: SubAgentOrchestrator (own context window) via \`agent_spawn\`.\n- Request execution: RequestExecutionManager with Rust backend.\n\n` +
        `## Tools\n- Built-in suite: bash_run, file_read, file_write, glob_search, grep_search, agent_spawn.\n- Tool calls prefer MCP (JSON-RPC 2.0) via MCPServerManager.\n- Domain-aware selection narrows tools for accuracy/performance.\n\n` +
        `## Rust Execution\n- High-performance ops via \`RustExecutionBackend\` (N-API).\n- Integrated through RequestExecutionManager and FilesystemTools.\n\n` +
        `For details, see ARCHITECTURE.md and docs/TOOL_SUITE.md.\n`;
      await fs.writeFile(file, content, 'utf-8');
      logger.info('Generated codecrucible.md overview at startup');
    } catch (e) {
      logger.warn('Failed to generate codecrucible.md', toReadonlyRecord(e));
    }
    return { cli, serviceFactory };
  } catch (error) {
    logger.error(
      'Failed to initialize system:',
      error instanceof Error ? error : new Error(String(error))
    );
    // rethrow to outer runCLI handler to keep behavior identical
    throw error;
  }
}

export default initialize;
