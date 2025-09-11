/**
 * Bootstrap initializer extracted from index.ts to keep entrypoint slim.
 */
import { CLIOptions, UnifiedCLI } from '../interfaces/unified-cli.js';
import { CLIUserInteraction } from '../../infrastructure/user-interaction/cli-user-interaction.js';
import { createAdaptersFromProviders } from '../services/adapter-factory.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { toReadonlyRecord } from '../../utils/type-guards.js';
import { enterpriseErrorHandler } from '../../infrastructure/error-handling/enterprise-error-handler.js';
import { ErrorSeverity } from '../../infrastructure/error-handling/structured-error-system.js';
import type { ServiceFactory } from '../services/service-factory.js';

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

    // Initialize MCP servers
    const { bootstrapMcpServers } = await import('../../mcp-servers/mcp-bootstrap.js');
    const mcpServerManager = await bootstrapMcpServers();
    if (mcpServerManager) {
      const { initializeGlobalToolIntegration } = await import(
        '../../infrastructure/tools/tool-integration.js'
      );
      initializeGlobalToolIntegration(mcpServerManager);

      const { EnhancedToolIntegration, setGlobalEnhancedToolIntegration } = await import(
        '../../infrastructure/tools/enhanced-tool-integration.js'
      );
      const enhancedIntegration = new EnhancedToolIntegration({});
      if (
        'setMcpServerManager' in enhancedIntegration &&
        typeof enhancedIntegration.setMcpServerManager === 'function'
      ) {
        enhancedIntegration.setMcpServerManager(mcpServerManager);
      }
      setGlobalEnhancedToolIntegration(enhancedIntegration);
    }

    // Model client
    const { UnifiedModelClient } = await import('../services/model-client.js');
    const { ModelSelector, quickSelectModel } = await import(
      '../../infrastructure/user-interaction/model-selector.js'
    );

    let selectedModelInfo;
    const interactive = isInteractive && process.stdin.isTTY;
    if (interactive) {
      try {
        const modelSelector = new ModelSelector();
        selectedModelInfo = await modelSelector.selectModel();
      } catch (error) {
        logger.warn(
          'Interactive model selection failed, using quick select:',
          toReadonlyRecord(error)
        );
        selectedModelInfo = await quickSelectModel();
      }
    } else {
      selectedModelInfo = await quickSelectModel();
    }

    const providersConfig = [
      {
        type: 'ollama' as const,
        name: 'ollama',
        endpoint: process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434',
        enabled: true,
        priority: 1,
        defaultModel: undefined,
        timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '110000', 10),
      },
      {
        type: 'lm-studio' as const,
        name: 'lm-studio',
        endpoint: process.env.LM_STUDIO_ENDPOINT ?? 'ws://localhost:8080',
        enabled: true,
        priority: 2,
        defaultModel: 'local-model',
        timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '110000', 10),
      },
      {
        type: 'claude' as const,
        name: 'claude',
        endpoint: process.env.CLAUDE_ENDPOINT ?? 'https://api.anthropic.com/v1/messages',
        enabled: !!process.env.ANTHROPIC_API_KEY,
        priority: 3,
        apiKey: process.env.ANTHROPIC_API_KEY,
        timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '110000', 10),
      },
      {
        type: 'huggingface' as const,
        name: 'huggingface',
        endpoint: process.env.HUGGINGFACE_ENDPOINT ?? 'https://api-inference.huggingface.co',
        enabled: !!process.env.HUGGINGFACE_API_KEY,
        priority: 4,
        apiKey: process.env.HUGGINGFACE_API_KEY,
        defaultModel: 'microsoft/DialoGPT-medium',
        timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '110000', 10),
      },
    ].filter(p => p.enabled);
    const adapters = createAdaptersFromProviders(providersConfig);

    const modelClientConfig = {
      adapters,
      defaultProvider: selectedModelInfo.provider,
      fallbackStrategy: 'priority',
      timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '30000', 10),
      retryAttempts: 3,
      enableCaching: true,
      enableMetrics: true,
    };
    const modelClient = new UnifiedModelClient(modelClientConfig);
    await modelClient.initialize();

    if (isInteractive) {
      logger.info(`Using model: ${selectedModelInfo.selectedModel.name}`);
    }

    // Expose the selected model for downstream components that need a concrete model string
    try {
      // Use the model id (provider-recognized) instead of the display name
      process.env.DEFAULT_MODEL = selectedModelInfo.selectedModel.id;
      logger.info(`Set DEFAULT_MODEL to ${process.env.DEFAULT_MODEL}`);
    } catch {
      // noop
    }

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
      const { setSubAgentDependencies } = await import('../services/orchestrator/sub-agent-runtime.js');
      setSubAgentDependencies(
        (modelClient as unknown) as import('../../domain/interfaces/model-client.js').IModelClient,
        (mcpServerManager as unknown) as import('../../domain/interfaces/mcp-manager.js').IMcpManager
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
      const content = `# CodeCrucible Synth Overview\n\n`
        + `This file is generated at startup to summarize the architecture.\n\n`
        + `## Layers\n- Domain: Core interfaces and types under \`src/domain\`.\n- Application: Orchestrators, services, CLI under \`src/application\`.\n- Infrastructure: Providers, tools, logging, MCP, Rust backend under \`src/infrastructure\`.\n- Providers: Local and hybrid model providers under \`src/providers\`.\n\n`
        + `## Orchestration\n- Main orchestrator: ConcreteWorkflowOrchestrator.\n- Sub-agent: SubAgentOrchestrator (own context window) via \`agent_spawn\`.\n- Request execution: RequestExecutionManager with Rust backend.\n\n`
        + `## Tools\n- Built-in suite: bash_run, file_read, file_write, glob_search, grep_search, agent_spawn.\n- Tool calls prefer MCP (JSON-RPC 2.0) via MCPServerManager.\n- Domain-aware selection narrows tools for accuracy/performance.\n\n`
        + `## Rust Execution\n- High-performance ops via \`RustExecutionBackend\` (N-API).\n- Integrated through RequestExecutionManager and FilesystemTools.\n\n`
        + `For details, see ARCHITECTURE.md and docs/TOOL_SUITE.md.\n`;
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
