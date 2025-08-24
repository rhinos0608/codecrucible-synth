/**
 * Minimal CodeCrucible Synth Entry Point
 * Core functionality without enterprise features
 */

// Core exports
export { CLI } from './core/cli.js';
export { UnifiedModelClient } from './core/client.js';
export { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
export { MCPServerManager } from './mcp-servers/mcp-server-manager.js';

// Security exports (working ones)
export { SecurityUtils } from './core/security-utils.js';
export { InputSanitizer } from './core/security/input-sanitizer.js';
export { RBACSystem } from './core/security/production-rbac-system.js';
export { SecretsManager } from './core/security/secrets-manager.js';
export { EnterpriseAuthManager } from './core/security/enterprise-auth-manager.js';

// Types
export type * from './core/types.js';

// Config
export type { AppConfig } from './config/config-manager.js';

// Main CLI entry point
import { program } from 'commander';
import { UnifiedModelClient } from './core/client.js';
import { CLI } from './core/cli.js';
import { VoiceArchetypeSystem } from './voices/voice-archetype-system.js';
import { MCPServerManager } from './mcp-servers/mcp-server-manager.js';
import { ConfigManager } from './config/config-manager.js';
import { logger } from './core/logger.js';

async function main() {
  try {
    const config = await ConfigManager.load();

    // Create a simplified client config for now
    const clientConfig = {
      executionMode: 'auto' as const,
      fallbackChain: ['ollama' as const],
      performanceThresholds: {
        fastModeMaxTokens: 1000,
        timeoutMs: 30000,
        maxConcurrentRequests: 3,
      },
      security: {
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['ls', 'cat', 'echo'],
      },
      providers: [], // Simplified for now
    };

    const modelClient = new UnifiedModelClient(clientConfig);

    // Fix voice system config structure
    const voiceConfig = {
      voices: config.voices,
    };

    const voiceSystem = new VoiceArchetypeSystem(modelClient, voiceConfig);

    // Create MCP server config
    const mcpConfig = {
      filesystem: { enabled: true, restrictedPaths: [], allowedPaths: [process.cwd()] },
      git: { enabled: true, autoCommitMessages: false, safeModeEnabled: true },
      terminal: {
        enabled: true,
        allowedCommands: ['ls', 'cat', 'echo'],
        blockedCommands: ['rm', 'sudo'],
      },
      packageManager: { enabled: false, autoInstall: false, securityScan: true },
    };

    const mcpManager = new MCPServerManager(mcpConfig);

    const cli = new CLI(modelClient, voiceSystem, mcpManager, config);
    await cli.initialize();

    // Set up CLI commands
    program
      .name('codecrucible')
      .description('AI-powered code generation and analysis CLI')
      .version('3.8.10');

    program
      .command('status')
      .description('Show system status')
      .action(async () => {
        await cli.showStatus();
      });

    program
      .argument('[prompt]', 'The prompt to process')
      .option('-v, --voices <voices>', 'Voice archetypes to use')
      .option('-f, --file <file>', 'File to analyze')
      .option('--interactive', 'Interactive mode')
      .action(async (prompt, options) => {
        if (!prompt && !options.interactive) {
          program.outputHelp();
          return;
        }

        if (options.interactive) {
          // Interactive mode - use CLI run method with empty args
          await cli.run(['--interactive']);
        } else {
          const result = await cli.processPrompt(prompt, options);
          console.log(result);
        }
      });

    await program.parseAsync();
  } catch (error) {
    logger.error('CLI error:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main().catch(console.error);
}
