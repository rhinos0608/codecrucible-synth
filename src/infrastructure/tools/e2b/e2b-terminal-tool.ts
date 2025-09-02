/**
 * E2B Terminal Tool - Production Implementation
 * Integrates with existing TerminalMCPServer and AdvancedProcessTool for real terminal functionality
 */

import { TerminalMCPServer } from '../../../mcp-servers/terminal-server.js';
import { AdvancedProcessTool } from '../process-management-tools.js';
import { createLogger } from '../../logging/logger-adapter.js';
import { SecurityValidator } from './security-validator.js';

export interface TerminalCommand {
  command: string;
  args?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
  interactive?: boolean;
}

export interface TerminalResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  sessionId?: string;
}

export interface TerminalSession {
  id: string;
  workingDirectory: string;
  environment: Record<string, string>;
  isActive: boolean;
  processSessionId?: string;
  lastActivity: number;
}

export class E2BTerminalTool {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionCounter = 0;
  private readonly logger = createLogger('E2BTerminal');
  private terminalServer: TerminalMCPServer;
  private processManager: AdvancedProcessTool;
  private securityValidator: SecurityValidator;

  constructor(workingDirectory: string = process.cwd()) {
    this.terminalServer = new TerminalMCPServer({
      workingDirectory,
      timeout: 30000,
      maxOutputSize: 1000000,
      environment: process.env as Record<string, string>,
    });

    this.processManager = new AdvancedProcessTool({ workingDirectory });
    this.securityValidator = new SecurityValidator();

    this.logger.info('E2BTerminalTool initialized with real backend integrations');
  }

  async initialize(): Promise<void> {
    try {
      // Initialize the underlying systems if not already initialized
      await this.securityValidator.initialize();
      this.logger.info('E2BTerminalTool initialization complete');
    } catch (error) {
      this.logger.error('Failed to initialize E2BTerminalTool:', error);
      throw error;
    }
  }

  async createSession(workingDirectory?: string): Promise<TerminalSession> {
    const sessionId = `e2b_session_${++this.sessionCounter}`;
    const effectiveWorkingDir = workingDirectory || process.cwd();

    try {
      // Validate the working directory
      const validationResult = await this.securityValidator.validateInput({
        type: 'filesystem_path',
        content: effectiveWorkingDir,
        context: { operation: 'create_session' },
      });

      if (!validationResult.isValid) {
        throw new Error(`Invalid working directory: ${validationResult.reason}`);
      }

      const session: TerminalSession = {
        id: sessionId,
        workingDirectory: effectiveWorkingDir,
        environment: {
          ...process.env,
          PWD: effectiveWorkingDir,
          E2B_SESSION_ID: sessionId,
        } as Record<string, string>,
        isActive: true,
        lastActivity: Date.now(),
      };

      this.sessions.set(sessionId, session);
      this.logger.info(`Created E2B terminal session: ${sessionId}`);

      return session;
    } catch (error) {
      this.logger.error(`Failed to create terminal session: ${error}`);
      throw error;
    }
  }

  async executeCommand(sessionId: string, command: TerminalCommand): Promise<TerminalResult> {
    const startTime = Date.now();
    const session = this.sessions.get(sessionId);

    if (!session || !session.isActive) {
      return {
        success: false,
        stdout: '',
        stderr: 'Invalid or inactive session',
        exitCode: 1,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Security validation of the command
      const fullCommand = command.args
        ? `${command.command} ${command.args.join(' ')}`
        : command.command;

      const validationResult = await this.securityValidator.validateInput({
        type: 'shell_command',
        content: fullCommand,
        context: {
          sessionId,
          workingDirectory: command.workingDirectory || session.workingDirectory,
        },
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          stdout: '',
          stderr: `Security validation failed: ${validationResult.reason}`,
          exitCode: 1,
          executionTime: Date.now() - startTime,
        };
      }

      // Execute via the process manager for interactive commands
      if (command.interactive) {
        const processResult = await this.processManager.execute({
          action: 'start',
          command: fullCommand,
          interactive: true,
          workingDirectory: command.workingDirectory || session.workingDirectory,
          environment: { ...session.environment, ...command.environment },
          timeout: command.timeout || 30000,
        });

        // Store process session ID for later interaction
        if (processResult.success && processResult.sessionId) {
          session.processSessionId = processResult.sessionId;
        }

        return {
          success: processResult.success,
          stdout: processResult.output || '',
          stderr: processResult.error || '',
          exitCode: processResult.exitCode || 0,
          executionTime: Date.now() - startTime,
          sessionId: processResult.sessionId,
        };
      }

      // For non-interactive commands, use the terminal server directly
      const result = await this.executeViaTerminalServer(sessionId, command);

      // Update session activity
      session.lastActivity = Date.now();

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTime: result.duration,
        sessionId,
      };
    } catch (error) {
      logger.error(`Command execution failed in session ${sessionId}:`, error);
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown execution error',
        exitCode: 1,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async executeViaTerminalServer(
    sessionId: string,
    command: TerminalCommand
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
  }> {
    const session = this.sessions.get(sessionId)!;
    const fullCommand = command.args
      ? `${command.command} ${command.args.join(' ')}`
      : command.command;

    // Use the terminal server's tool execution capabilities
    const toolResult = await this.terminalServer.callTool('run_command', {
      command: fullCommand,
      workingDirectory: command.workingDirectory || session.workingDirectory,
      timeout: command.timeout || 30000,
      captureOutput: true,
      environment: { ...session.environment, ...command.environment },
    });

    if (toolResult.isError) {
      throw new Error(toolResult.content[0]?.text || 'Terminal execution failed');
    }

    const result = JSON.parse(toolResult.content[0]?.text || '{}');
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode || 0,
      duration: result.duration || 0,
    };
  }

  async changeDirectory(sessionId: string, directory: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    try {
      // Validate the directory path
      const validationResult = await this.securityValidator.validateInput({
        type: 'filesystem_path',
        content: directory,
        context: { operation: 'change_directory', sessionId },
      });

      if (!validationResult.isValid) {
        this.logger.warn(
          `Directory change rejected for session ${sessionId}: ${validationResult.reason}`
        );
        return false;
      }

      // Execute cd command to verify directory exists and is accessible
      const result = await this.executeCommand(sessionId, {
        command: 'cd',
        args: [directory, '&&', 'pwd'],
        timeout: 5000,
      });

      if (result.success) {
        session.workingDirectory = directory;
        session.environment.PWD = directory;
        session.lastActivity = Date.now();
        this.logger.info(`Changed directory for session ${sessionId} to: ${directory}`);
        return true;
      } else {
        this.logger.warn(`Failed to change directory for session ${sessionId}: ${result.stderr}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error changing directory for session ${sessionId}:`, error);
      return false;
    }
  }

  async setEnvironmentVariable(sessionId: string, key: string, value: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    try {
      // Validate environment variable key and value
      const keyValidation = await this.securityValidator.validateInput({
        type: 'environment_variable',
        content: key,
        context: { operation: 'set_env', sessionId },
      });

      const valueValidation = await this.securityValidator.validateInput({
        type: 'environment_variable',
        content: value,
        context: { operation: 'set_env', sessionId },
      });

      if (!keyValidation.isValid || !valueValidation.isValid) {
        this.logger.warn(
          `Environment variable rejected for session ${sessionId}: ${keyValidation.reason || valueValidation.reason}`
        );
        return false;
      }

      session.environment[key] = value;
      session.lastActivity = Date.now();
      this.logger.info(`Set environment variable ${key} for session ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error setting environment variable for session ${sessionId}:`, error);
      return false;
    }
  }

  async interactWithProcess(sessionId: string, input: string): Promise<TerminalResult> {
    const startTime = Date.now();
    const session = this.sessions.get(sessionId);

    if (!session || !session.isActive || !session.processSessionId) {
      return {
        success: false,
        stdout: '',
        stderr: 'No interactive process available in session',
        exitCode: 1,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Validate input
      const validationResult = await this.securityValidator.validateInput({
        type: 'process_input',
        content: input,
        context: { sessionId, processSessionId: session.processSessionId },
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          stdout: '',
          stderr: `Input validation failed: ${validationResult.reason}`,
          exitCode: 1,
          executionTime: Date.now() - startTime,
        };
      }

      // Send input to the interactive process
      const result = await this.processManager.execute({
        action: 'interact',
        sessionId: session.processSessionId,
        input,
        timeout: 30000,
      });

      session.lastActivity = Date.now();

      return {
        success: result.success,
        stdout: result.output || '',
        stderr: result.error || '',
        exitCode: result.exitCode || 0,
        executionTime: Date.now() - startTime,
        sessionId,
      };
    } catch (error) {
      this.logger.error(`Process interaction failed for session ${sessionId}:`, error);
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Process interaction failed',
        exitCode: 1,
        executionTime: Date.now() - startTime,
      };
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // Kill any active processes
      if (session.processSessionId) {
        await this.processManager.execute({
          action: 'kill',
          sessionId: session.processSessionId,
        });
      }

      session.isActive = false;
      this.sessions.delete(sessionId);
      this.logger.info(`Closed terminal session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error closing session ${sessionId}:`, error);
    }
  }

  async getSessionStatus(sessionId: string): Promise<{
    session?: TerminalSession;
    processStatus?: any;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {};
    }

    let processStatus;
    if (session.processSessionId) {
      try {
        processStatus = await this.processManager.execute({
          action: 'status',
          sessionId: session.processSessionId,
        });
      } catch (error) {
        this.logger.warn(`Failed to get process status for session ${sessionId}:`, error);
      }
    }

    return {
      session,
      processStatus,
    };
  }

  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up E2B terminal sessions...');

    const activeSessions = this.getActiveSessions();
    const cleanupPromises = activeSessions.map(session => this.closeSession(session.id));

    await Promise.allSettled(cleanupPromises);

    this.sessions.clear();
    this.logger.info('E2B terminal cleanup complete');
  }

  // Health check method for monitoring
  async healthCheck(): Promise<{
    isHealthy: boolean;
    activeSessions: number;
    details: Record<string, any>;
  }> {
    const activeSessions = this.getActiveSessions();
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes

    // Check for stale sessions
    const staleSessions = activeSessions.filter(
      session => now - session.lastActivity > staleThreshold
    );

    // Clean up stale sessions
    if (staleSessions.length > 0) {
      this.logger.info(`Cleaning up ${staleSessions.length} stale sessions`);
      await Promise.allSettled(staleSessions.map(session => this.closeSession(session.id)));
    }

    return {
      isHealthy: true,
      activeSessions: this.getActiveSessions().length,
      details: {
        totalSessions: this.sessions.size,
        staleSessions: staleSessions.length,
        lastCleanup: now,
      },
    };
  }
}
