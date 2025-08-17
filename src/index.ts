import { CLI, CLIContext } from './core/cli.js';
import { ConfigManager } from './config/config-manager.js';
import { UnifiedModelClient, UnifiedClientConfig } from './core/client.js';
import { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
import { MCPServerManager } from './mcp-servers/mcp-server-manager.js';

export async function initializeCLIContext(): Promise<CLI> {
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
    const voiceSystem = new VoiceArchetypeSystem(client);
    const mcpManager = new MCPServerManager();

    const context: CLIContext = {
      modelClient: client,
      voiceSystem,
      mcpManager,
      config
    };

    return new CLI(context);
  } catch (error) {
    console.error('Failed to initialize CLI context:', error);
    throw error;
  }
}

export { CLI } from './core/cli.js';
export { UnifiedModelClient } from './core/client.js';
export { ConfigManager } from './config/config-manager.js';
export default initializeCLIContext;
