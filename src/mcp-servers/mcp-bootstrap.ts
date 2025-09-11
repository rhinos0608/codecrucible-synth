import { MCPServerManager } from './mcp-server-manager.js';
import { logger } from '../infrastructure/logging/logger.js';
import { toReadonlyRecord } from '../utils/type-guards.js';

export function createMcpServerManager(): MCPServerManager {
  const isWin = process.platform === 'win32';
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
      allowedCommands: (isWin
        ? [
            // Windows-friendly commands
            'cmd',
            'powershell',
            'where',
            'dir',
            'type',
            'findstr',
            // common dev tools
            'git',
            'npm',
            'node',
          ]
        : [
            // POSIX-friendly commands
            'ls',
            'cat',
            'pwd',
            'echo',
            'grep',
            'find',
            // common dev tools
            'git',
            'npm',
            'node',
          ]) as string[],
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
