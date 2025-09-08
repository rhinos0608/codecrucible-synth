import { MCPServerManager } from './mcp-server-manager.js';
import { logger } from '../infrastructure/logging/logger.js';
import { toErrorOrUndefined, toReadonlyRecord } from '../utils/type-guards.js';

export function createMcpServerManager(): MCPServerManager {
  const mcpConfig = {
    filesystem: {
      enabled: true,
      restrictedPaths: [] as string[],
      allowedPaths: [process.cwd()],
    },
    git: {
      enabled: true,
      autoCommitMessages: true,
      safeModeEnabled: true,
    },
    terminal: {
      enabled: true,
      allowedCommands: [
        'ls',
        'cat',
        'pwd',
        'echo',
        'grep',
        'find',
        'git',
        'npm',
        'node',
      ] as string[],
      blockedCommands: ['rm', 'del', 'rmdir', 'sudo', 'su'],
    },
    packageManager: {
      enabled: true,
      autoInstall: false,
      securityScan: true,
    },
    smithery: {
      enabled: !!process.env.SMITHERY_API_KEY,
      apiKey: process.env.SMITHERY_API_KEY,
      enabledServers: [] as string[],
      autoDiscovery: true,
    },
  };
  return new MCPServerManager(mcpConfig);
}

export async function bootstrapMcpServers(): Promise<MCPServerManager | null> {
  const manager = createMcpServerManager();
  await manager.initialize();
  try {
    await manager.startServers();
    logger.info('✅ MCP servers are ready for tool execution');
    return manager;
  } catch (error) {
    logger.warn(
      '⚠️ MCP servers initialization had issues, continuing with degraded capabilities:',
      toReadonlyRecord(error)
    );
    return null;
  }
}
