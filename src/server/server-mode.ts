/**
 * Legacy Server Mode - Backward Compatibility Wrapper
 * 
 * This is a temporary wrapper around the new UnifiedServerSystem
 * to maintain backward compatibility during the architectural migration.
 * 
 * @deprecated Use UnifiedServerSystem from domain/services instead
 */

import { UnifiedServerSystem, ServerConfiguration, ServerStatus } from '../domain/services/unified-server-system.js';
import { UnifiedConfigurationManager } from '../domain/services/unified-configuration-manager.js';
import { EventBus } from '../domain/interfaces/event-bus.js';
import { UnifiedSecurityValidator } from '../domain/services/unified-security-validator.js';
import { UnifiedPerformanceSystem } from '../domain/services/unified-performance-system.js';
import { CLIContext } from '../application/interfaces/cli.js';
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
  startServerMode(context: CLIContext, options: ServerOptions): Promise<void>;
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

  async startServerMode(context: CLIContext, options: ServerOptions): Promise<void> {
    console.warn('⚠️ ServerMode is deprecated. Use UnifiedServerSystem instead.');
    
    // Validate context initialization
    if (!context) {
      throw new Error('CLI context is required for server mode');
    }

    if (!context.modelClient) {
      throw new Error('Model client not initialized');
    }

    if (!context.voiceSystem) {
      throw new Error('Voice system not initialized');
    }

    if (!context.config) {
      throw new Error('Configuration not loaded');
    }

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
        async promptUser(question: string): Promise<string> {
          return 'yes'; // Default response for server mode
        },
        displayMessage(message: string): void {
          logger.info(`[Server] ${message}`);
        },
        displayError(error: string): void {
          logger.error(`[Server] ${error}`);
        },
        displayWarning(warning: string): void {
          logger.warn(`[Server] ${warning}`);
        }
      };
      
      // Initialize systems
      await securityValidator.initialize();
      await performanceSystem.initialize();
      
      // Create unified server system
      this.unifiedServer = new UnifiedServerSystem(
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
          enabled: options.cors || false,
          origins: ['*'],
          credentials: false
        },
        authentication: {
          enabled: options.auth?.enabled || false,
          strategy: 'bearer',
          tokens: options.auth?.token ? [options.auth.token] : undefined
        },
        websocket: {
          enabled: true,
          path: '/socket.io'
        },
        mcp: {
          enabled: true,
          discoveryPath: '/mcp',
          toolsPath: '/mcp/tools'
        },
        maxConnections: 100,
        timeout: 30000,
        bodyLimit: '10mb',
        compression: true,
        logging: true
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
        performance: { avgResponseTime: 0, memoryUsage: 0, cpuUsage: 0 }
      };
    }
    
    return this.unifiedServer.getServerStatus('http') || {
      running: false,
      type: 'http',
      connections: 0,
      requestsProcessed: 0,
      errors: 0,
      performance: { avgResponseTime: 0, memoryUsage: 0, cpuUsage: 0 }
    };
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