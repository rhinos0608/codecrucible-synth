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
        await client.initialize(); // Initialize providers
        const voiceSystem = new VoiceArchetypeSystem();
        const mcpManager = new MCPServerManager({
            filesystem: {
                enabled: true,
                restrictedPaths: [],
                allowedPaths: ['src', 'test', 'docs']
            },
            git: {
                enabled: true,
                autoCommitMessages: true,
                safeModeEnabled: true
            },
            terminal: {
                enabled: true,
                allowedCommands: ['npm', 'node', 'git'],
                blockedCommands: ['rm', 'sudo']
            },
            packageManager: {
                enabled: true,
                autoInstall: true,
                securityScan: true
            }
        });
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
        const { cli } = await initializeCLIContext();
        await cli.run(process.argv.slice(2));
    }
    catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}
export default initializeCLIContext;
//# sourceMappingURL=index.js.map