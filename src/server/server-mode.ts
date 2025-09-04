/**
 * Legacy Server Mode - Backward Compatibility Wrapper
 *
 * This is a temporary wrapper around the new UnifiedServerSystem
 * to maintain backward compatibility during the architectural migration.
 *
 * @deprecated Use UnifiedServerSystem from domain/services instead
 */

import {
  ServerConfiguration,
  ServerStatus,
  UnifiedServerSystem,
} from '../domain/services/unified-server-system.js';
import { UnifiedConfigurationManager } from '../domain/config/config-manager.js';
import { EventBus } from '../infrastructure/messaging/event-bus.js';
import { UnifiedSecurityValidator } from '../domain/services/unified-security-validator.js';
import { UnifiedPerformanceSystem } from '../domain/services/unified-performance-system.js';
import { CLIContext } from '../application/cli/cli-types.js';
import { createLogger } from '../infrastructure/logging/logger-adapter.js';
import chalk from 'chalk';

const logger = createLogger('ServerMode');

export interface ServerOptions {
  port: number;
  host: string;
  cors?: boolean;
  auth?: {
    enabled: boolean;
    token?: string;
  };
}

export interface ServerModeInterface {
  startServerMode: (
    context: Readonly<CLIContext>,
    options: Readonly<ServerOptions>
  ) => Promise<void>;
}

/**
 * Server Mode for IDE Integration
 *
 * Provides HTTP and WebSocket APIs for IDE extensions and external tools
 * Compatible with VS Code, JetBrains IDEs, and other development environments
 *
 * @deprecated Use UnifiedServerSystem directly
 */
export class ServerMode implements ServerModeInterface {
  private unifiedServer?: UnifiedServerSystem;

  public async startServerMode(
    context: Readonly<CLIContext>,
    options: Readonly<ServerOptions>
  ): Promise<void> {
    console.warn('⚠️ ServerMode is deprecated. Use UnifiedServerSystem instead.');

    // Validate context initialization (removed unnecessary checks)

    console.log(chalk.blue('🚀 Starting CodeCrucible Server Mode...'));

    try {
      // Create unified system components
      const configLogger = createLogger('UnifiedConfigurationManager');
      const configManager = new UnifiedConfigurationManager(configLogger);
      await configManager.initialize();
      const unifiedConfig = configManager.getConfiguration();

      const eventBus = new EventBus();
      const securityLogger = createLogger('UnifiedSecurityValidator');
      const performanceLogger = createLogger('UnifiedPerformanceSystem');

      const securityValidator = new UnifiedSecurityValidator(securityLogger);
      const performanceSystem = new UnifiedPerformanceSystem(performanceLogger, eventBus);

      // Create mock user interaction for server mode
      const mockUserInteraction = {
        display(message: string): Promise<void> {
          logger.info(`[Server] ${message}`);
          return Promise.resolve();
        },
        warn(message: string): Promise<void> {
          logger.warn(`[Server] ${message}`);
          return Promise.resolve();
        },
        error(message: string): Promise<void> {
          logger.error(`[Server] ${message}`);
          return Promise.resolve();
        },
        success(message: string): Promise<void> {
          logger.info(`[Server] Success: ${message}`);
          return Promise.resolve();
        },
        progress(message: string, progress?: number): Promise<void> {
          logger.info(`[Server] Progress: ${message}${progress ? ` (${progress}%)` : ''}`);
          return Promise.resolve();
        },
        prompt(question: string): Promise<string> {
          logger.info(`[Server] Prompt: ${question} (auto-responding: yes)`);
          return Promise.resolve('yes'); // Default response for server mode
        },
        confirm(question: string): Promise<boolean> {
          logger.info(`[Server] Confirm: ${question} (auto-responding: true)`);
          return Promise.resolve(true); // Default response for server mode
        },
        select(question: string, choices: readonly string[]): Promise<string> {
          logger.info(`[Server] Select: ${question} (auto-responding: ${choices[0]})`);
          return Promise.resolve(choices[0] || 'default'); // Default to first choice
        },
      };

      // Initialize systems
      await securityValidator.initialize();
      await performanceSystem.initialize();

      // Create a logger for the server system
      const serverLogger = {
        info: (msg: string): void => {
          console.log(`[ServerSystem] ${msg}`);
        },
        error: (msg: string, error?: unknown): void => {
          console.error(`[ServerSystem] ${msg}`, error);
        },
        warn: (msg: string): void => {
          console.warn(`[ServerSystem] ${msg}`);
        },
        debug: (msg: string): void => {
          console.debug(`[ServerSystem] ${msg}`);
        },
        trace: (msg: string): void => {
          console.trace(`[ServerSystem] ${msg}`);
        },
      };

      // Create unified server system
      this.unifiedServer = new UnifiedServerSystem(
        serverLogger,
        unifiedConfig,
        eventBus,
        mockUserInteraction,
        securityValidator,
        performanceSystem
      );

      // Convert legacy options to server configuration
      const serverConfig: ServerConfiguration = {
        port: options.port,
        host: options.host,
        cors: {
          enabled: options.cors ?? false,
          origins: ['*'],
          credentials: false,
        },
        authentication: {
          enabled: options.auth?.enabled ?? false,
          strategy: 'bearer',
          tokens: options.auth?.token ? [options.auth.token] : undefined,
        },
        websocket: {
          enabled: true,
          path: '/socket.io',
        },
        mcp: {
          enabled: true,
          discoveryPath: '/mcp',
          toolsPath: '/mcp/tools',
        },
        maxConnections: 100,
        timeout: 30000,
        bodyLimit: '10mb',
        compression: true,
        logging: true,
      };

      // Start hybrid server (HTTP + WebSocket + MCP)
      await this.unifiedServer.startServer('hybrid', serverConfig);

      console.log(chalk.green('✅ CodeCrucible Server Mode started successfully'));
      console.log(chalk.cyan(`🌐 HTTP Server: http://${options.host}:${options.port}`));
      console.log(chalk.cyan(`🔌 WebSocket Server: ws://${options.host}:${options.port + 1}`));
      console.log(chalk.cyan('🔧 MCP Protocol: enabled'));

      // Setup graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n🛑 Shutting down server...'));
        if (this.unifiedServer) {
          await this.unifiedServer.stopAllServers();
        }
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down server...'));
        if (this.unifiedServer) {
          await this.unifiedServer.stopAllServers();
        }
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to start server mode:'), error);
      throw error;
    }
  }

  // Additional legacy methods for compatibility
  async getStatus(): Promise<ServerStatus> {
    if (!this.unifiedServer) {
      return {
        running: false,
        type: 'http',
        connections: 0,
        requestsProcessed: 0,
        errors: 0,
        performance: { avgResponseTime: 0, memoryUsage: 0, cpuUsage: 0 },
      };
    }

    return (
      this.unifiedServer.getServerStatus('http') || {
        running: false,
        type: 'http',
        connections: 0,
        requestsProcessed: 0,
        errors: 0,
        performance: { avgResponseTime: 0, memoryUsage: 0, cpuUsage: 0 },
      }
    );
  }

  async stop(): Promise<void> {
    if (this.unifiedServer) {
      await this.unifiedServer.stopAllServers();
    }
  }

  isRunning(): boolean {
    return this.unifiedServer ? this.unifiedServer.isServerRunning('http') : false;
  }
}
