import { CLI, CLIContext } from './core/cli.js';
import { ConfigManager } from './config/config-manager.js';
import { UnifiedModelClient, UnifiedClientConfig } from './core/client.js';
import { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
import { MCPServerManager } from './mcp-servers/mcp-server-manager.js';
import { getErrorMessage } from './utils/error-utils.js';
import { createSystem } from './core/di/system-bootstrap.js';
import { logger } from './core/logger.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeGlobalToolIntegration, getGlobalToolIntegration } from './core/tools/tool-integration.js';
import { initializeGlobalEnhancedToolIntegration, getGlobalEnhancedToolIntegration } from './core/tools/enhanced-tool-integration.js';

// Proper EventEmitter management instead of band-aid fix
const eventManager = {
  emitters: new Map<string, import('events').EventEmitter>(),
  cleanup(): void {
    for (const [name, emitter] of this.emitters) {
      emitter.removeAllListeners();
    }
    this.emitters.clear();
  },
};

// Cleanup on exit
process.on('exit', () => eventManager.cleanup());
process.on('SIGINT', () => eventManager.cleanup());

// Get package version (async version)
async function getPackageVersion(): Promise<string> {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '..', 'package.json');
    const packageData = await readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(packageData);
    return packageJson.version;
  } catch {
    return '4.0.6'; // Updated fallback version
  }
}

/**
 * Initialize CLI Context using Dependency Injection System
 * This replaces the legacy initialization with proper DI
 */
export async function initializeCLIContextWithDI(): Promise<{ cli: CLI; context: CLIContext }> {
  try {
    console.log('🚀 Initializing with Dependency Injection System...');

    // Bootstrap the entire system with DI
    const bootResult = await createSystem({
      skipValidation: false,
      enablePerformanceMonitoring: true,
      logLevel: 'info',
      environment: 'development',
    });

    console.log(`✅ DI System initialized in ${bootResult.initializationTime}ms`);
    console.log(`📦 Services initialized: ${bootResult.servicesInitialized.length}`);

    if (bootResult.warnings.length > 0) {
      console.log('⚠️ Warnings:', bootResult.warnings);
    }

    // Get the injected client from DI container (cast to concrete type for CLI compatibility)
    const client = bootResult.client as UnifiedModelClient;
    
    // Initialize voice system with DI-enabled client
    const voiceSystem = new VoiceArchetypeSystem(client);

    // Initialize MCP server manager with proper configuration including Smithery
    const mcpConfig = {
      filesystem: { enabled: true, restrictedPaths: [], allowedPaths: [] },
      git: { enabled: true, autoCommitMessages: false, safeModeEnabled: true },
      terminal: { enabled: true, allowedCommands: ['npm', 'node', 'git', 'ls', 'cat'], blockedCommands: [] },
      packageManager: { enabled: true, autoInstall: false, securityScan: true },
      smithery: {
        enabled: !!process.env.SMITHERY_API_KEY,
        apiKey: process.env.SMITHERY_API_KEY,
        autoDiscovery: true,
      },
    };

    const mcpManager = new MCPServerManager(mcpConfig);
    await mcpManager.startServers();
    
    // Initialize global tool integration - CRITICAL for MCP tools to work
    initializeGlobalToolIntegration(mcpManager);
    
    // Initialize enhanced tool integration for advanced features
    initializeGlobalEnhancedToolIntegration(mcpManager);
    const enhancedIntegration = getGlobalEnhancedToolIntegration();
    if (enhancedIntegration) {
      await enhancedIntegration.initialize();
    }
    
    // Verify tool integration is working
    const toolIntegration = getGlobalToolIntegration();
    if (toolIntegration) {
      logger.info('✅ MCP tool integration initialized successfully', {
        availableTools: toolIntegration.getAvailableToolNames(),
        llmFunctions: toolIntegration.getLLMFunctions().length
      });
    } else {
      logger.warn('⚠️ MCP tool integration failed to initialize');
    }

    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.loadConfiguration();

    const context: CLIContext = {
      modelClient: client,
      voiceSystem,
      mcpManager,
      config,
    };

    const cli = new CLI(client, voiceSystem, mcpManager, config);

    return { cli, context };
  } catch (error) {
    console.error('❌ Failed to initialize CLI context with DI:', getErrorMessage(error));
    console.log('🔄 Falling back to legacy initialization...');
    return await initializeCLIContextLegacy();
  }
}

/**
 * Default CLI Context initialization - uses DI system by default
 */
export async function initializeCLIContext(): Promise<{ cli: CLI; context: CLIContext }> {
  return await initializeCLIContextWithDI();
}

/**
 * Legacy CLI Context initialization (kept for backward compatibility)
 */
export async function initializeCLIContextLegacy(): Promise<{ cli: CLI; context: CLIContext }> {
  try {
    // Fast initialization with lazy loading
    const configManager = new ConfigManager();
    const config = await configManager.loadConfiguration();

    // Simplified client configuration for faster startup
    const clientConfig: UnifiedClientConfig = {
      providers: [
        {
          type: 'ollama',
          endpoint: config.model?.endpoint || 'http://localhost:11434',
          model: undefined, // Lazy model detection
          timeout: 15000, // Reduced timeout for faster failure
        },
      ],
      executionMode: 'auto',
      fallbackChain: ['ollama'], // Simplified fallback
      performanceThresholds: {
        fastModeMaxTokens: 4096, // Reduced for faster startup
        timeoutMs: 15000, // Reduced timeout
        maxConcurrentRequests: 1, // Single request for startup
      },
      security: {
        enableSandbox: false, // Disabled for faster startup
        maxInputLength: 10000,
        allowedCommands: ['npm', 'node', 'git'],
      },
    };

    // Lazy client initialization - don't block startup
    const client = new UnifiedModelClient(clientConfig);

    // Don't await initialization to prevent hanging
    client.initialize().catch(() => {
      console.log('ℹ️ AI models will be initialized when needed');
    });

    // Lazy voice system initialization
    const voiceSystem = new VoiceArchetypeSystem(client);

    // Minimal MCP manager setup for fast startup
    const mcpManager = {
      startServers: async () => {
        console.log('ℹ️ MCP servers will be started when needed');
      },
      stopServers: async () => {},
      getServerStatus: () => ({ filesystem: { status: 'lazy-loaded' } }),
    } as any;

    // Skip complex tool integration for faster startup
    console.log('ℹ️ Tools will be loaded on demand');

    const context: CLIContext = {
      modelClient: client,
      voiceSystem,
      mcpManager,
      config,
    };

    const cli = new CLI(
      context.modelClient,
      context.voiceSystem,
      context.mcpManager,
      context.config
    );
    return { cli, context };
  } catch (error) {
    console.error('Failed to initialize CLI context:', error);
    throw error;
  }
}

export { CLI } from './core/cli.js';
export { UnifiedModelClient } from './core/client.js';
export { ConfigManager } from './config/config-manager.js';

export async function main() {
  try {
    // Handle basic commands immediately without full initialization
    const args = process.argv.slice(2);

    // Fast commands that don't need AI models or full initialization
    if (args.includes('--help') || args.includes('-h')) {
      showBasicHelp();
      return;
    }

    if (args.includes('--version') || args.includes('-v')) {
      console.log(`CodeCrucible Synth v${await getPackageVersion()}`);
      return;
    }

    // Status command with minimal initialization
    if (args[0] === 'status') {
      await showQuickStatus();
      return;
    }

    // Models command with minimal initialization
    if (args[0] === 'models') {
      await showAvailableModels();
      return;
    }

    // For other commands, do full initialization
    console.log('🚀 Initializing CodeCrucible Synth...');
    const startTime = Date.now();
    const { cli, context } = await initializeCLIContext();
    const initTime = Date.now() - startTime;
    console.log(`✅ Initialized in ${initTime}ms`);

    // Check if we have piped input
    const isInteractive = process.stdin.isTTY;
    logger.debug('CLI invocation details', { isInteractive, argsLength: args.length });

    // If we have arguments or piped input, process them
    if (args.length > 0) {
      logger.debug('Taking args.length > 0 branch', { args });
      await cli.run(args);
    } else if (!isInteractive) {
      logger.debug('Processing piped input directly, bypassing CLI race condition');
      // Handle piped input directly without CLI.run() to avoid race condition
      let inputData = '';
      process.stdin.setEncoding('utf8');

      for await (const chunk of process.stdin) {
        inputData += chunk;
      }

      if (inputData.trim()) {
        logger.debug('Processing piped input', {
          inputPreview: inputData.trim().substring(0, 50) + '...',
        });
        // Process through CLI to get system prompt injection and tool orchestration
        try {
          const response = await cli.processPrompt(inputData.trim(), {});
          console.log('\n🤖 Response:');
          console.log(response);
        } catch (error: unknown) {
          console.error('❌ Error processing input:', getErrorMessage(error));
        }
      } else {
        logger.debug('No piped input received');
      }
    } else {
      console.log(
        '🔧 DEBUG: Taking interactive mode branch with args:',
        args,
        'isInteractive:',
        isInteractive
      );
      // No args and interactive terminal - start interactive mode
      await cli.run(args);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

function showBasicHelp() {
  console.log('Usage:');
  console.log('  crucible [options] <prompt>');
  console.log('  cc [options] <prompt>');
  console.log();
  console.log('Options:');
  console.log('  --help, -h           Show this help message');
  console.log('  --version, -v        Show version');
  console.log('  --file <path>        Write output to file');
  console.log('  --stream             Enable real-time streaming responses (default: enabled)');
  console.log('  --no-stream          Disable streaming, show complete response at once');
  console.log('  --no-autonomous      Disable autonomous mode (not recommended)');
  console.log('  --context-aware      Enable enhanced context awareness (default: enabled)');
  console.log('  --no-intelligence    Disable project intelligence analysis');
  console.log('  --smart-suggestions  Enable intelligent command suggestions');
  console.log('  --project-analysis   Perform comprehensive project analysis');
  console.log('  --verbose            Show detailed output');
  console.log('  --server             Start server mode');
  console.log('  --port <number>      Server port (default: 3002)');
  console.log();
  console.log('Commands:');
  console.log('  status               Show system status');
  console.log('  models               List available models');
  console.log('  interactive, -i      Start interactive chat mode (default with no args)');
  console.log('  recommend            Show intelligent model recommendations');
  console.log('  analyze <file>       Analyze a code file');
  console.log('  analyze-dir [dir]    Analyze a directory/project');
  console.log('  intelligence         Show comprehensive project intelligence');
  console.log('  suggestions [ctx]    Get smart suggestions for current context');
  console.log();
  console.log('Examples:');
  console.log('  cc                   Start interactive mode');
  console.log('  crucible "Create a React component for a todo list"');
  console.log('  cc --interactive     Explicitly start interactive chat');
  console.log('  cc --voices explorer,developer "Analyze this codebase"');
}

async function showQuickStatus() {
  console.log('📊 CodeCrucible Synth Status');
  console.log('━'.repeat(40));

  console.log(`Version: ${await getPackageVersion()}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}`);

  const healthChecks = [
    { name: 'Ollama', url: 'http://localhost:11434/api/tags' },
    { name: 'LM Studio', url: 'http://localhost:1234/v1/models' },
  ];

  for (const check of healthChecks) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(check.url, {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeoutId);
      console.log(`✅ ${check.name}: Available`);
    } catch (error) {
      console.log(`❌ ${check.name}: Not available`);
    }
  }

  console.log('━'.repeat(40));
}

async function showAvailableModels() {
  console.log('🤖 Available Models');
  console.log('━'.repeat(40));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('');
      console.log('📦 Ollama Models:');
      if (data.models && data.models.length > 0) {
        data.models.forEach((model: any) => {
          console.log(`  • ${model.name}`);
        });
      } else {
        console.log('  No models installed');
      }
    }
  } catch (error) {
    console.log('');
    console.log('❌ Ollama: Not available');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('http://localhost:1234/v1/models', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('');
      console.log('🏛️ LM Studio Models:');
      if (data.data && data.data.length > 0) {
        data.data.forEach((model: any) => {
          console.log(`  • ${model.id}`);
        });
      } else {
        console.log('  No models loaded');
      }
    }
  } catch (error) {
    console.log('');
    console.log('❌ LM Studio: Not available');
  }

  console.log('');
  console.log('━'.repeat(40));
  console.log('💡 Use "crucible status" for full system status');
}

export default initializeCLIContext;

// Auto-run main when executed directly
// Fix: More robust check for direct execution
if (
  process.argv[1] &&
  (process.argv[1].includes('index.js') || process.argv[1].endsWith('index.ts'))
) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
