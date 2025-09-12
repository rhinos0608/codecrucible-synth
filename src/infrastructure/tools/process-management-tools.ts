import { z } from 'zod';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { BaseTool } from './base-tool.js';
import { logger } from '../logging/logger.js';
import { validateCommand } from '../../utils/command-security.js';
import { rustStreamingClient } from '../streaming/rust-streaming-client.js';
import type { StreamChunk, StreamProcessor } from '../streaming/stream-chunk-protocol.js';

const execAsync = promisify(exec);

// Schema definitions
const AdvancedProcessSchema = z.object({
  action: z.enum(['start', 'interact', 'read', 'list', 'kill', 'status']),
  sessionId: z.string().optional().describe('Session ID for existing processes'),
  command: z.string().optional().describe('Command to execute'),
  input: z.string().optional().describe('Input to send to process'),
  timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
  interactive: z.boolean().optional().default(false).describe('Start interactive session'),
  environment: z.record(z.string()).optional().describe('Environment variables'),
});

type ProcessManagerArgs = z.infer<typeof AdvancedProcessSchema>;
type ProcessManagerResult =
  | { error: string }
  | {
      success: boolean;
      sessionId?: string | null;
      command?: string;
      pid?: number;
      initialOutput?: string;
      isRunning?: boolean;
      interactive?: boolean;
      message?: string;
    }
  | {
      sessionId: string;
      command: string;
      isRunning: boolean;
      output: string;
      totalLines: number;
      lastActivity: string;
      uptime: number;
    }
  | { totalSessions: number; runningSessions: number; sessions: ProcessSessionSummary[] }
  | {
      sessionId: string;
      command: string;
      pid: number;
      isRunning: boolean;
      startTime: string;
      lastActivity: string;
      uptime: number;
      outputLines: number;
      recentOutput: string;
      isInteractive: boolean;
    }
  | {
      success: boolean;
      sessionId: string;
      input: string;
      output: string;
      newLines: number;
      totalLines: number;
    };

interface ProcessSession {
  id: string;
  command: string;
  startTime: number;
  lastActivity: number;
  outputBuffer: string[];
  isInteractive: boolean;
  process: ChildProcess;
}

interface ProcessSessionSummary {
  id: string;
  command: string;
  isRunning: boolean;
  pid: number;
  uptime: number;
  lastActivity: string;
  isInteractive: boolean;
}

/**
 * Advanced Process Management Tool with session support
 */
export class AdvancedProcessTool extends BaseTool<typeof AdvancedProcessSchema.shape> {
  private readonly sessions: Map<string, ProcessSession> = new Map();
  private sessionCounter = 0;

  public getParameterSchema() {
    return z.object({
      action: z.enum(['start', 'interact', 'read', 'list', 'kill', 'status']),
      sessionId: z.string().optional().describe('Session ID for existing processes'),
      command: z.string().optional().describe('Command to execute'),
      input: z.string().optional().describe('Input to send to process'),
      timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
      interactive: z.boolean().optional().default(false).describe('Start interactive session'),
      environment: z.record(z.string()).optional().describe('Environment variables'),
    });
  }

  public constructor(private readonly agentContext: Readonly<{ workingDirectory: string }>) {
    super({
      name: 'advancedProcessTool',
      description: 'Advanced Process Management Tool with session support',
      category: 'Process Management',
      parameters: AdvancedProcessSchema,
    });
  }

  public async execute(args: Readonly<ProcessManagerArgs>): Promise<ProcessManagerResult> {
    try {
      switch (args.action) {
        case 'start':
          return await this.startProcess(args);

        case 'interact':
          return await this.interactWithProcess(args);

        case 'read':
          return this.readProcessOutput(args);

        case 'list':
          return this.listSessions();

        case 'kill':
          return this.killProcess(args);

        case 'status':
          return this.getProcessStatus(args);

        default:
          return { error: `Unknown action: ${String(args.action)}` };
      }
    } catch (error) {
      return {
        error: `Process management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async startProcess(args: Readonly<ProcessManagerArgs>): Promise<ProcessManagerResult> {
    try {
      // Ensure command is provided and is a string
      if (!args.command || typeof args.command !== 'string') {
        return {
          error: 'Command is required and must be a string.',
          success: false,
        };
      }

      // Use agentContext.workingDirectory only, as args.workingDirectory may not exist
      const cwd: string = this.agentContext.workingDirectory;

      // SECURITY: Validate command before execution
      const validation = validateCommand(args.command);
      if (!validation.isValid) {
        logger.error(`🚨 SECURITY: Blocked dangerous command: ${args.command}`);
        logger.error(`🚨 Reason: ${validation.reason}`);
        return {
          success: false,
          sessionId: '',
          error: `SECURITY BLOCKED: ${validation.reason}`,
          output: '',
        };
      }

      // Parse command and arguments
      const [command, ...cmdArgs] = args.command.split(' ');

      logger.info(`✅ SECURITY: Executing validated command: ${command}`);
      const childProcess = spawn(command, cmdArgs, {
        cwd,
        env: { ...process.env, ...(args.environment ?? {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const session: ProcessSession = {
        id: `session_${++this.sessionCounter}_${Date.now()}`,
        process: childProcess,
        command: args.command,
        startTime: Date.now(),
        lastActivity: Date.now(),
        outputBuffer: [],
        isInteractive: !!args.interactive,
      };

      // Set up output handlers
      this.setupOutputHandlers(session);

      // Store session
      this.sessions.set(session.id, session);

      // Handle process exit
      childProcess.on('exit', (code: number | null) => {
        session.outputBuffer.push(`Process exited with code: ${code}`);
        if (!args.interactive) {
          this.sessions.delete(session.id);
        }
      });

      // Wait for initial output or process to be ready
      await this.waitForProcessReady(session, args.timeout ?? 30000);

      return {
        success: true,
        sessionId: session.id,
        command: args.command,
        pid: childProcess.pid,
        initialOutput: session.outputBuffer.slice(0, 10).join('\n'),
        isRunning: !childProcess.killed,
        interactive: !!args.interactive,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private setupOutputHandlers(session: ProcessSession): void {
    const maxBufferSize = 1000; // Keep last 1000 lines

    session.process.stdout?.on('data', (data: unknown) => {
      const str = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString() : '';
      const lines: string[] = str
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      session.outputBuffer.push(...lines);
      session.lastActivity = Date.now();

      // Keep buffer size manageable
      if (session.outputBuffer.length > maxBufferSize) {
        session.outputBuffer = session.outputBuffer.slice(-maxBufferSize);
      }
    });

    session.process.stderr?.on('data', (data: unknown) => {
      const str = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString() : '';
      const lines: string[] = str
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      const errorLines: string[] = lines.map(line => `[ERROR] ${line}`);
      session.outputBuffer.push(...errorLines);
      session.lastActivity = Date.now();

      if (session.outputBuffer.length > maxBufferSize) {
        session.outputBuffer = session.outputBuffer.slice(-maxBufferSize);
      }
    });

    session.process.on('error', (error: Error) => {
      session.outputBuffer.push(`[PROCESS ERROR] ${error.message}`);
      session.lastActivity = Date.now();
    });
  }

  private async waitForProcessReady(session: ProcessSession, timeout: number): Promise<void> {
    return new Promise(resolve => {
      const startTime = Date.now();

      const checkReady = () => {
        const elapsed = Date.now() - startTime;

        if (elapsed >= timeout) {
          resolve(); // Timeout reached
          return;
        }

        if (session.outputBuffer.length > 0) {
          resolve(); // Got some output
          return;
        }

        if (session.process.killed) {
          resolve(); // Process ended
          return;
        }

        // Check again in 100ms
        setTimeout(checkReady, 100);
      };

      checkReady();
    });
  }

  public async interactWithProcess(
    args: Readonly<ProcessManagerArgs>
  ): Promise<ProcessManagerResult> {
    if (!args.sessionId) {
      return { error: 'Session ID is required.' };
    }
    const session = this.sessions.get(args.sessionId);

    if (!session) {
      return { error: `Session not found: ${args.sessionId}` };
    }

    if (session.process.killed) {
      return { error: 'Process has already exited' };
    }

    if (!args.input) {
      return { error: 'Input is required for interaction' };
    }

    try {
      // Send input to process
      session.process.stdin?.write(`${args.input}\n`);
      session.lastActivity = Date.now();

      // Wait for response
      const initialOutputLength = session.outputBuffer.length;
      await this.waitForNewOutput(session, args.timeout || 5000, initialOutputLength);

      // Get new output since interaction
      const newOutput = session.outputBuffer.slice(initialOutputLength);

      return {
        success: true,
        sessionId: args.sessionId,
        input: args.input,
        output: newOutput.join('\n'),
        newLines: newOutput.length,
        totalLines: session.outputBuffer.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async waitForNewOutput(
    session: ProcessSession,
    timeout: number,
    initialLength: number
  ): Promise<void> {
    return new Promise(resolve => {
      const startTime = Date.now();

      const checkForOutput = () => {
        const elapsed = Date.now() - startTime;

        if (elapsed >= timeout) {
          resolve(); // Timeout
          return;
        }

        if (session.outputBuffer.length > initialLength) {
          resolve(); // Got new output
          return;
        }

        if (session.process.killed) {
          return;
        }

        setTimeout(checkForOutput, 100);
      };

      checkForOutput();
    });
  }

  public readProcessOutput(args: Readonly<ProcessManagerArgs>): ProcessManagerResult {
    const { sessionId } = args;
    if (!sessionId) {
      return { error: 'Session ID is required.' };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return { error: `Session not found: ${sessionId}` };
    }

    const outputLines = session.outputBuffer.length;
    const recentOutput = session.outputBuffer.slice(-50).join('\n');

    return {
      sessionId: session.id,
      command: session.command,
      pid: session.process.pid ?? -1,
      isRunning: !session.process.killed,
      startTime: new Date(session.startTime).toISOString(),
      lastActivity: new Date(session.lastActivity).toISOString(),
      uptime: Date.now() - session.startTime,
      outputLines,
      recentOutput,
      isInteractive: session.isInteractive,
    };
  }

  public listSessions(): ProcessManagerResult {
    const sessions: ProcessSessionSummary[] = Array.from(this.sessions.values()).map(
      (session: ProcessSession) => ({
        id: session.id,
        command: session.command,
        isRunning: !session.process.killed,
        pid: session.process.pid ?? -1,
        uptime: Date.now() - session.startTime,
        lastActivity: new Date(session.lastActivity).toISOString(),
        isInteractive: session.isInteractive,
      })
    );

    return {
      totalSessions: sessions.length,
      runningSessions: sessions.filter(s => s.isRunning).length,
      sessions,
    };
  }

  public killProcess(args: Readonly<ProcessManagerArgs>): ProcessManagerResult {
    const { sessionId } = args;
    if (!sessionId) {
      return { error: 'Session ID is required.' };
    }
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { error: `Session not found: ${args.sessionId}` };
    }

    try {
      if (!session.process.killed) {
        session.process.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!session.process.killed) {
            session.process.kill('SIGKILL');
          }
        }, 5000);
      }

      // Remove from sessions
      if (args.sessionId) {
        this.sessions.delete(args.sessionId);
      }

      return {
        success: true,
        message: 'Process terminated',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  public getProcessStatus(args: Readonly<ProcessManagerArgs>): ProcessManagerResult {
    const sessionId = args.sessionId ?? '';
    if (!sessionId) {
      return { error: 'Session ID is required.' };
    }
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { error: `Session not found: ${sessionId}` };
    }

    return {
      sessionId,
      command: session.command,
      pid: session.process.pid ?? -1,
      isRunning: !session.process.killed,
      startTime: new Date(session.startTime).toISOString(),
      lastActivity: new Date(session.lastActivity).toISOString(),
      uptime: Date.now() - session.startTime,
      outputLines: session.outputBuffer.length,
      recentOutput: session.outputBuffer.slice(-5).join('\n'),
      isInteractive: session.isInteractive,
    };
  }
}

/**
 * Memory Code Execution Tool (like in Desktop Commander)
 */

// Define a type for code execution results
export interface CodeExecutionResult {
  success: boolean;
  language: string;
  code: string;
  output?: string;
  stderr?: string;
  executionTime?: number;
  error?: string;
  exitCode?: number;
}

const codeExecutionParameters = z.object({
  language: z.enum(['python', 'javascript', 'nodejs', 'bash', 'powershell']),
  code: z.string().describe('Code to execute'),
  timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
  captureOutput: z.boolean().optional().default(true).describe('Capture and return output'),
  environment: z.record(z.string()).optional().describe('Environment variables'),
});

export type CodeExecutionArgs = z.infer<typeof codeExecutionParameters>;

export class CodeExecutionTool extends BaseTool<typeof codeExecutionParameters.shape> {
  public constructor(private readonly agentContext: Readonly<{ workingDirectory: string }>) {
    const parameters = codeExecutionParameters;

    super({
      name: 'executeCode',
      description: 'Execute code in memory without saving files (Python, Node.js, Bash)',
      category: 'Code Execution',
      parameters,
    });
  }

  public async execute(
    args: Readonly<CodeExecutionArgs>
  ): Promise<CodeExecutionResult | { error: string }> {
    try {
      switch (args.language) {
        case 'python':
          return await this.executePython(args);

        case 'javascript':
        case 'nodejs':
          return await this.executeNodeJS(args);

        case 'bash':
          return await this.executeBash(args);

        case 'powershell':
          return await this.executePowerShell(args);

        default:
          return { error: `Unsupported language: ${args.language}` };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async executePython(args: Readonly<CodeExecutionArgs>): Promise<CodeExecutionResult> {
    try {
      const escaped = args.code.replace(/"/g, '\\"');
      const result = await execAsync(`python -c "${escaped}"`, {
        cwd: this.agentContext.workingDirectory,
        timeout: args.timeout,
        env: { ...process.env, ...(args.environment ?? {}) },
      });

      return {
        success: true,
        language: 'python',
        code: args.code,
        output: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now(),
      };
    } catch (error: unknown) {
      const err = error as { message?: string; stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        language: 'python',
        code: args.code,
        error: err.message ?? String(error),
        output: err.stdout ?? '',
        stderr: err.stderr ?? '',
        exitCode: err.code,
      };
    }
  }

  private async executeNodeJS(args: Readonly<CodeExecutionArgs>): Promise<CodeExecutionResult> {
    try {
      const escaped = args.code.replace(/"/g, '\\"');
      const result = await execAsync(`node -e "${escaped}"`, {
        cwd: this.agentContext.workingDirectory,
        timeout: args.timeout,
        env: { ...process.env, ...(args.environment ?? {}) },
      });

      return {
        success: true,
        language: 'nodejs',
        code: args.code,
        output: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now(),
      };
    } catch (error: unknown) {
      const err = error as { message?: string; stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        language: 'nodejs',
        code: args.code,
        error: err.message ?? String(error),
        output: err.stdout ?? '',
        stderr: err.stderr ?? '',
        exitCode: err.code,
      };
    }
  }

  private async executeBash(args: Readonly<CodeExecutionArgs>): Promise<CodeExecutionResult> {
    try {
      const result = await execAsync(args.code, {
        cwd: this.agentContext.workingDirectory,
        timeout: args.timeout,
        env: { ...process.env, ...(args.environment ?? {}) },
        shell: '/bin/bash',
      });

      return {
        success: true,
        language: 'bash',
        code: args.code,
        output: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now(),
      };
    } catch (error: unknown) {
      const err = error as { message?: string; stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        language: 'bash',
        code: args.code,
        error: err.message ?? String(error),
        output: err.stdout ?? '',
        stderr: err.stderr ?? '',
        exitCode: err.code,
      };
    }
  }

  private async executePowerShell(args: Readonly<CodeExecutionArgs>): Promise<CodeExecutionResult> {
    try {
      const escaped = args.code.replace(/"/g, '\\"');
      const result = await execAsync(`powershell -Command "${escaped}"`, {
        cwd: this.agentContext.workingDirectory,
        timeout: args.timeout,
        env: { ...process.env, ...(args.environment ?? {}) },
      });

      return {
        success: true,
        language: 'powershell',
        code: args.code,
        output: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now(),
      };
    } catch (error: unknown) {
      const err = error as { message?: string; stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        language: 'powershell',
        code: args.code,
        error: err.message ?? String(error),
        output: err.stdout ?? '',
        stderr: err.stderr ?? '',
        exitCode: err.code,
      };
    }
  }
}
