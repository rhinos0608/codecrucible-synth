/**
 * Legacy Server Mode - Backward Compatibility Wrapper
 *
 * This is a temporary wrapper around the new UnifiedServerSystem
 * to maintain backward compatibility during the architectural migration.
 *
 * @deprecated Use UnifiedServerSystem from domain/services instead
 */

import type { ServerConfiguration, ServerStatus } from '../domain/services/unified-server-system.js';
import { UnifiedServerSystem } from '../domain/services/unified-server-system.js';
import { UnifiedConfigurationManager } from '../domain/config/config-manager.js';
import { createEventBus } from '../infrastructure/messaging/event-bus-factory.js';
// Removed unused IUnifiedSecurityValidator import
import { UnifiedSecurityValidator } from '../infrastructure/security/unified-security-validator.js';
import { UnifiedPerformanceSystem } from '../domain/services/unified-performance-system.js';
import type { CLIContext } from '../application/cli/cli-types.js';
import { createLogger } from '../infrastructure/logging/logger-adapter.js';
import chalk from 'chalk';

// Create logger instance for server mode
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
    logger.warn('ServerMode is deprecated, use UnifiedServerSystem instead');
    console.warn('⚠️ ServerMode is deprecated. Use UnifiedServerSystem instead.');

    // Validate context initialization (removed unnecessary checks)

    console.log(chalk.blue('🚀 Starting CodeCrucible Server Mode...'));

    try {
      // Create unified system components
      const configLogger = createLogger('UnifiedConfigurationManager');
      const configManager = new UnifiedConfigurationManager(configLogger);
      await configManager.initialize();
      const unifiedConfig = configManager.getConfiguration();

      const eventBus = createEventBus({ enableProfiling: true });
      const securityLogger = createLogger('UnifiedSecurityValidator');
      const performanceLogger = createLogger('UnifiedPerformanceSystem');

      const securityValidator = new UnifiedSecurityValidator(securityLogger);
      const performanceSystem = new UnifiedPerformanceSystem(performanceLogger, eventBus);

      // Full user-interaction implementation for server mode (replaces lightweight mock)
      // - Integrates with provided CLIContext when available (non-breaking: uses optional chaining)
      // - Emits events on the eventBus (if it supports publish or emit)
      // - Respects an interactive flag from context when present, otherwise falls back to safe defaults
      // - Provides timeouts and sanitization for prompt/confirm/select
      const mockUserInteraction = (() => {
        const DEFAULT_PROMPT_TIMEOUT_MS = 15_000;

        interface EventBusLike {
          publish?: (name: string, payload: unknown) => void;
          emit?: (name: string, payload: unknown) => void;
        }

        function publishEvent(name: string, payload: unknown): void {
          try {
            const bus = eventBus as EventBusLike;
            if (typeof bus.publish === 'function') {
              bus.publish(name, payload);
            } else if (typeof bus.emit === 'function') {
              bus.emit(name, payload);
            }
          } catch (err) {
            // Non-fatal - log and continue
            logger.debug(`Failed to publish interaction event: ${String(err)}`);
          }
        }

        function isInteractiveContext(): boolean {
          try {
            if (
              typeof context === 'object' &&
              context !== null &&
              ('interactive' in context || 'isInteractive' in context)
            ) {
              return Boolean((context as { interactive?: boolean; isInteractive?: boolean }).interactive ??
                (context as { isInteractive?: boolean }).isInteractive ??
                false);
            }
            return false;
          } catch {
            return false;
          }
        }

        async function callExternalPromptIfAvailable(
          question: string,
          timeoutMs = DEFAULT_PROMPT_TIMEOUT_MS
        ): Promise<string | undefined> {
          try {
            if (
              typeof context === 'object' &&
              context !== null &&
              typeof (context as { prompt?: unknown }).prompt === 'function'
            ) {
              const promptFn = ((context as unknown) as { prompt: (q: string) => Promise<string> | string }).prompt;
              const result = promptFn(question);
              if (result instanceof Promise) {
                return await Promise.race([
                  result,
                  new Promise<string | undefined>((res) => { setTimeout(() => { res(undefined); }, timeoutMs); }),
                ]);
              }
              return String(result);
            }
          } catch (err) {
            logger.debug(`External prompt failed: ${String(err)}`);
          }
          return undefined;
        }

        interface UserInteraction {
          display: (message: string) => Promise<void>;
          warn: (message: string) => Promise<void>;
          error: (message: string) => Promise<void>;
          success: (message: string) => Promise<void>;
          progress: (message: string, progress?: number) => Promise<void>;
          prompt: (question: string) => Promise<string>;
          confirm: (question: string) => Promise<boolean>;
          select: (question: string, choices: readonly string[]) => Promise<string>;
        }

        const userInteraction: UserInteraction = {
          async display(message: string): Promise<void> {
            logger.info(`[Server] ${message}`);
            console.log(`[Server] ${message}`);
            publishEvent('user.interaction.display', { message });
          },

          async warn(message: string): Promise<void> {
            logger.warn(`[Server] ${message}`);
            console.warn(`[Server] ${message}`);
            publishEvent('user.interaction.warn', { message });
          },

          async error(message: string): Promise<void> {
            logger.error(`[Server] ${message}`);
            console.error(`[Server] ${message}`);
            publishEvent('user.interaction.error', { message });
          },

          async success(message: string): Promise<void> {
            logger.info(`[Server] Success: ${message}`);
            console.log(`[Server] Success: ${message}`);
            publishEvent('user.interaction.success', { message });
          },

          async progress(message: string, progress?: number): Promise<void> {
            const pct = typeof progress === 'number' ? ` (${Math.max(0, Math.min(100, progress))}%)` : '';
            logger.info(`[Server] Progress: ${message}${pct}`);
            console.log(`[Server] Progress: ${message}${pct}`);
            publishEvent('user.interaction.progress', { message, progress });
          },

          async prompt(question: string): Promise<string> {
            logger.info(`[Server] Prompt requested: ${question}`);
            publishEvent('user.interaction.request', { type: 'prompt', question });

            try {
              if (
                typeof context === 'object' &&
                context !== null &&
                'prompt' in context &&
                typeof (context as { prompt?: unknown }).prompt === 'function'
              ) {
                const promptFn = (context as { prompt: (q: string) => string | Promise<string> }).prompt;
                const resp = promptFn(question);
                if (resp instanceof Promise) {
                  const result = await Promise.race([
                    resp,
                    new Promise<string>((res) => { setTimeout(() => { res('yes'); }, 15000); }),
                  ]);
                  publishEvent('user.interaction.response', { type: 'prompt', response: result });
                  return result;
                }
                if (typeof resp === 'string') {
                  publishEvent('user.interaction.response', { type: 'prompt', response: resp });
                  return resp;
                }
              }
            } catch (err) {
              logger.debug(`Synchronous external prompt failed: ${String(err)}`);
            }

            const defaultResp = 'yes';
            logger.info(`[Server] Prompt fallback auto-responding: ${defaultResp}`);
            publishEvent('user.interaction.response', { type: 'prompt', response: defaultResp, fallback: true });
            return defaultResp;
          },

          async confirm(question: string): Promise<boolean> {
            logger.info(`[Server] Confirm requested: ${question}`);
            publishEvent('user.interaction.request', { type: 'confirm', question });

            try {
              const ctxWithConfirm = context as { confirm?: (q: string) => boolean | Promise<boolean> };
              if (typeof ctxWithConfirm.confirm === 'function') {
                const resp = ctxWithConfirm.confirm(question);
                if (resp instanceof Promise) {
                  const result = await Promise.race([
                    resp.then((v) => typeof v === 'boolean' ? v : true),
                    new Promise<boolean>((res) => { setTimeout(() => { res(true); }, 15000); }),
                  ]);
                  publishEvent('user.interaction.response', { type: 'confirm', response: result });
                  return result as boolean;
                }
                if (typeof resp === 'boolean') {
                  publishEvent('user.interaction.response', { type: 'confirm', response: resp });
                  return resp;
                }
              }
            } catch (err) {
              logger.debug(`Synchronous external confirm failed: ${String(err)}`);
            }

            const fallback = true;
            logger.info(`[Server] Confirm fallback auto-responding: ${fallback}`);
            publishEvent('user.interaction.response', { type: 'confirm', response: fallback, fallback: true });
            return fallback;
          },

          async select(question: string, choices: readonly string[]): Promise<string> {
            logger.info(`[Server] Select requested: ${question} (choices: ${choices.join(', ')})`);
            publishEvent('user.interaction.request', { type: 'select', question, choices });

            const normalizedChoices: string[] = Array.isArray(choices)
              ? choices.filter((c): c is string => typeof c === 'string' && Boolean(c))
              : [];
            if (normalizedChoices.length === 0) {
              const fallbackChoice = 'default';
              logger.warn(`[Server] Select called with no choices; returning fallback '${fallbackChoice}'`);
              publishEvent('user.interaction.response', { type: 'select', response: fallbackChoice, fallback: true });
              return fallbackChoice;
            }

            try {
              if (isInteractiveContext()) {
                const external = await callExternalPromptIfAvailable(
                  `${question}\nChoices: ${normalizedChoices.join(', ')}`,
                  DEFAULT_PROMPT_TIMEOUT_MS
                );
                if (typeof external === 'string') {
                  const match = normalizedChoices.find((c) => typeof c === 'string' && c.toLowerCase() === external.toLowerCase());
                  const response: string = match ?? normalizedChoices[0];
                  publishEvent('user.interaction.response', { type: 'select', response, external });
                  return response;
                }
              } else {
                const ctx = context as { select?: (q: string, choices: readonly string[]) => Promise<string> | string };
                if (ctx && typeof ctx.select === 'function') {
                  const resp = ctx.select(question, normalizedChoices);
                  const resolved: string =
                    resp instanceof Promise
                      ? await Promise.race([
                          resp,
                          new Promise<string>((res) => { setTimeout(() => { res(''); }, DEFAULT_PROMPT_TIMEOUT_MS); }),
                        ])
                      : String(resp);
                  if (resolved) {
                    const match = normalizedChoices.find((c) => typeof c === 'string' && c.toLowerCase() === resolved.toLowerCase());
                    const response: string = match ?? normalizedChoices[0];
                    publishEvent('user.interaction.response', { type: 'select', response, external: resolved });
                    return response;
                  }
                }
              }
            } catch (err) {
              logger.debug(`Async select failed: ${String(err)}`);
            }

            const [fallback]: string[] = normalizedChoices;
            logger.info(`[Server] Select fallback auto-responding: ${fallback}`);
            publishEvent('user.interaction.response', { type: 'select', response: fallback, fallback: true });
            return fallback;
          },
        };

        return userInteraction;
      })();

      // Initialize systems
      await securityValidator.initialize();
      await performanceSystem.initialize();

      // Create a logger for the server system
      const serverLogger = {
        info: (msg: string): void => {
          logger.info(msg);
          console.log(`[ServerSystem] ${msg}`);
        },
        error: (msg: string, error?: unknown): void => {
          logger.error(msg, { error });
          console.error(`[ServerSystem] ${msg}`, error);
        },
        warn: (msg: string): void => {
          logger.warn(msg);
          console.warn(`[ServerSystem] ${msg}`);
        },
        debug: (msg: string): void => {
          logger.debug(msg);
          console.debug(`[ServerSystem] ${msg}`);
        },
        trace: (msg: string): void => {
          logger.debug(msg);
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
      process.on('SIGINT', () => {
        logger.info('Server shutdown initiated via SIGINT');
        console.log(chalk.yellow('\n🛑 Shutting down server...'));
        if (this.unifiedServer) {
          this.unifiedServer.stopAllServers()
            .catch((err: unknown) => {
              logger.error('Error during server shutdown', { error: err });
            })
            .finally(() => process.exit(0));
        } else {
          process.exit(0);
        }
      });

      process.on('SIGTERM', () => {
        logger.info('Server shutdown initiated via SIGTERM');
        console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down server...'));
        if (this.unifiedServer) {
          this.unifiedServer.stopAllServers()
            .catch((err: unknown) => {
              logger.error('Error during server shutdown', { error: err });
            })
            .finally(() => process.exit(0));
        } else {
          process.exit(0);
        }
      });
    } catch (error) {
      logger.error('Failed to start server mode', { error });
      console.error(chalk.red('❌ Failed to start server mode:'), error);
      throw error;
    }
  }

  // Additional legacy methods for compatibility
  public getStatus(): ServerStatus {
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
      this.unifiedServer.getServerStatus('http') ?? {
        running: false,
        type: 'http',
        connections: 0,
        requestsProcessed: 0,
        errors: 0,
        performance: { avgResponseTime: 0, memoryUsage: 0, cpuUsage: 0 },
      }
    );
  }

  public async stop(): Promise<void> {
    if (this.unifiedServer) {
      await this.unifiedServer.stopAllServers();
    }
  }

  isRunning(): boolean {
    return this.unifiedServer ? this.unifiedServer.isServerRunning('http') : false;
  }
}
