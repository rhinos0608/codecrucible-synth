import { CLI, CLIContext } from './core/cli.js';
import { ConfigManager } from './config/config-manager.js';
import { UnifiedModelClient, UnifiedClientConfig } from './core/client.js';
import { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
import { MCPServerManager } from './mcp-servers/mcp-server-manager.js';

// Fix EventEmitter memory leak warning
process.setMaxListeners(50);

export async function initializeCLIContext(): Promise<{cli: CLI, context: CLIContext}> {
  try {
    const configManager = new ConfigManager();
    const config = await configManager.loadConfiguration();
    
    // Create unified client configuration
    const clientConfig: UnifiedClientConfig = {
      providers: [
        { 
          type: 'ollama', 
          endpoint: config.model?.endpoint || 'http://localhost:11434',
          model: config.model?.name || 'llama2',
          timeout: config.model?.timeout || 30000
        },
        {
          type: 'lm-studio',
          endpoint: 'http://localhost:1234',
          model: 'auto',
          timeout: 30000
        }
      ],
      executionMode: 'auto',
      fallbackChain: ['ollama', 'lm-studio'],
      performanceThresholds: {
        fastModeMaxTokens: config.model?.maxTokens || 2048,
        timeoutMs: config.model?.timeout || 30000,
        maxConcurrentRequests: 3
      },
      security: {
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['npm', 'node', 'git', 'code']
      }
    };

    const client = new UnifiedModelClient(clientConfig);
    
    // Initialize providers but don't fail if they're not available
    try {
      await client.initialize();
    } catch (error) {
      console.warn('⚠️ Provider initialization failed, continuing in degraded mode:', error.message);
    }
    
    const voiceSystem = new VoiceArchetypeSystem();
    
    // Make MCP manager optional to prevent hanging
    let mcpManager;
    try {
      mcpManager = new MCPServerManager({
        filesystem: { 
          enabled: true,
          restrictedPaths: ['/etc', '/var', '/usr', '/sys', '/proc', 'C:\\Windows', 'C:\\Program Files'],
          allowedPaths: [process.cwd(), 'src', 'tests', 'docs', 'config']
        },
        git: { 
          enabled: true,
          autoCommitMessages: false,
          safeModeEnabled: true
        },
        terminal: { 
          enabled: true,
          allowedCommands: ['ls', 'dir', 'find', 'grep', 'cat', 'head', 'tail', 'wc', 'tree'],
          blockedCommands: ['rm', 'del', 'format', 'fdisk', 'shutdown', 'reboot']
        },
        packageManager: {
          enabled: true,
          autoInstall: false,
          securityScan: true
        }
      });
    } catch (error) {
      console.warn('⚠️ MCP Manager initialization failed, using minimal setup:', error.message);
      // Create a minimal mock MCP manager
      mcpManager = {
        startServers: async () => {},
        stopServers: async () => {},
        getServerStatus: () => ({ filesystem: { status: 'disabled' } })
      } as any;
    }

    // Initialize tool integration system for AI function calling
    try {
      const { initializeGlobalToolIntegration } = await import('./core/tools/tool-integration.js');
      initializeGlobalToolIntegration(mcpManager);
      console.log('✅ Tool integration initialized with filesystem tools');
    } catch (error) {
      console.warn('⚠️ Tool integration failed:', error.message);
    }

    const context: CLIContext = {
      modelClient: client,
      voiceSystem,
      mcpManager,
      config
    };

    const cli = new CLI(context);
    return {cli, context};
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
      console.log('CodeCrucible Synth v3.8.9');
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
    const { cli } = await initializeCLIContext();
    const initTime = Date.now() - startTime;
    console.log(`✅ Initialized in ${initTime}ms`);
    
    await cli.run(args);
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
  
  console.log(`Version: 3.8.9`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  
  const healthChecks = [
    { name: 'Ollama', url: 'http://localhost:11434/api/tags' },
    { name: 'LM Studio', url: 'http://localhost:1234/v1/models' }
  ];
  
  for (const check of healthChecks) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(check.url, {
        signal: controller.signal,
        method: 'GET'
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
      signal: controller.signal
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
      signal: controller.signal
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
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
