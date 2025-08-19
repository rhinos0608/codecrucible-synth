import { CLI } from './core/cli.js';
import { ConfigManager } from './config/config-manager.js';
import { UnifiedModelClient } from './core/client.js';
import { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
import { MCPServerManager } from './mcp-servers/mcp-server-manager.js';
export async function initializeCLIContext() {
    try {
        const configManager = new ConfigManager();
        const config = await configManager.loadConfiguration();
        // Create unified client configuration
        const clientConfig = {
            providers: [
                {
                    type: 'ollama',
                    endpoint: config.model?.endpoint || 'http://localhost:11434',
                    model: config.model?.name || 'llama2',
                    timeout: config.model?.timeout || 30000
                }
            ],
            executionMode: 'auto',
            fallbackChain: ['ollama'],
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
        }
        catch (error) {
            console.warn('⚠️ Provider initialization failed, continuing in degraded mode:', error.message);
        }
        const voiceSystem = new VoiceArchetypeSystem();
        // Make MCP manager optional to prevent hanging
        let mcpManager;
        try {
            mcpManager = new MCPServerManager({
                filesystem: {
                    enabled: false,
                    restrictedPaths: [],
                    allowedPaths: []
                },
                git: {
                    enabled: false,
                    autoCommitMessages: false,
                    safeModeEnabled: true
                },
                terminal: {
                    enabled: false,
                    allowedCommands: [],
                    blockedCommands: []
                },
                packageManager: {
                    enabled: false,
                    autoInstall: false,
                    securityScan: false
                }
            });
        }
        catch (error) {
            console.warn('⚠️ MCP Manager initialization failed, using minimal setup:', error.message);
            // Create a minimal mock MCP manager
            mcpManager = {
                startServers: async () => { },
                stopServers: async () => { },
                getServerStatus: () => ({ filesystem: { status: 'disabled' } })
            };
        }
        const context = {
            modelClient: client,
            voiceSystem,
            mcpManager,
            config
        };
        const cli = new CLI(context);
        return { cli, context };
    }
    catch (error) {
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
        // Check for basic commands that don't need AI models
        if (args.includes('--help') || args.includes('-h')) {
            showBasicHelp();
            return;
        }
        if (args.includes('--version') || args.includes('-v')) {
            console.log('CodeCrucible Synth v3.8.1');
            return;
        }
        // For other commands, do full initialization
        const { cli } = await initializeCLIContext();
        await cli.run(args);
    }
    catch (error) {
        console.error('Fatal error:', error);
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
    console.log('  recommend            Show intelligent model recommendations');
    console.log('  analyze <file>       Analyze a code file');
    console.log('  analyze-dir [dir]    Analyze a directory/project');
    console.log('  intelligence         Show comprehensive project intelligence');
    console.log('  suggestions [ctx]    Get smart suggestions for current context');
    console.log();
    console.log('Examples:');
    console.log('  crucible "Create a React component for a todo list"');
    console.log('  cc --fast "Format this code"');
    console.log('  cc --voices explorer,developer "Analyze this codebase"');
}
export default initializeCLIContext;
// Auto-run main when executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map