import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logging/logger.js';
import { validateCommand } from '../../utils/command-security.js';

const execAsync = promisify(exec);

type ProcessManagerArgs = z.infer<
  ReturnType<typeof AdvancedProcessTool.prototype['getParameterSchema']>
>;
type ProcessManagerResult =
  | { error: string }
  | { success: boolean; sessionId?: string | null; command?: string; pid?: number; initialOutput?: string; isRunning?: boolean; interactive?: boolean; message?: string }
  | { sessionId: string; command: string; isRunning: boolean; output: string; totalLines: number; lastActivity: string; uptime: number }
  | { totalSessions: number; runningSessions: number; sessions: any[] }
  | { sessionId: string; command: string; pid: number; isRunning: boolean; startTime: string; lastActivity: string; uptime: number; outputLines: number; recentOutput: string; isInteractive: boolean }
  | { success: boolean; sessionId: string; input: string; output: string; newLines: number; totalLines: number };

interface ProcessSession {
  id: string;
  process: ChildProcess;
  command: string;
  startTime: number;
  lastActivity: number;
  outputBuffer: string[];
  isInteractive: boolean;
}

/**
 * Advanced Process Management Tool with session support
 */
export class AdvancedProcessTool extends BaseTool {
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
      parameters: z.object({
        action: z.enum(['start', 'interact', 'read', 'list', 'kill', 'status']),
        sessionId: z.string().optional().describe('Session ID for existing processes'),
        command: z.string().optional().describe('Command to execute'),
        input: z.string().optional().describe('Input to send to process'),
        timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
        interactive: z.boolean().optional().default(false).describe('Start interactive session'),
        environment: z.record(z.string()).optional().describe('Environment variables'),
      }),
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
          return await this.readProcessOutput(args);

        case 'list':
          return this.listSessions();

        case 'kill':
          return this.killProcess(args);

        case 'status':
          return this.getProcessStatus(args);

        default:
          return { error: `Unknown action: ${args.action}` };
      }
    } catch (error) {
      return {
        error: `Process management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async startProcess(args: any): Promise<any> {
    try {
      const sessionId = `session_${++this.sessionCounter}_${Date.now()}`;
      const cwd = args.workingDirectory || this.agentContext.workingDirectory;

      // SECURITY: Validate command before execution
      const validation = validateCommand(args.command);
      if (!validation.isValid) {
        logger.error(`🚨 SECURITY: Blocked dangerous command: ${args.command}`);
        logger.error(`🚨 Reason: ${validation.reason}`);
        return {
          success: false,
          sessionId: null,
          error: `SECURITY BLOCKED: ${validation.reason}`,
          output: '',
          stderr: `Command blocked for security: ${validation.reason}`,
        };
      }

      // Parse command and arguments
      const [command, ...cmdArgs] = args.command.split(' ');

      logger.info(`✅ SECURITY: Executing validated command: ${command}`);
      const childProcess = spawn(command, cmdArgs, {
        cwd,
        env: { ...process.env, ...args.environment },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const session: ProcessSession = {
        id: sessionId,
        process: childProcess,
        command: args.command,
        startTime: Date.now(),
        lastActivity: Date.now(),
        outputBuffer: [],
        isInteractive: args.interactive,
      };

      // Set up output handlers
      this.setupOutputHandlers(session);

      // Store session
      this.sessions.set(sessionId, session);

      // Handle process exit
      childProcess.on('exit', code => {
        session.outputBuffer.push(`Process exited with code: ${code}`);
        if (!args.interactive) {
          this.sessions.delete(sessionId);
        }
      });

      // Wait for initial output or process to be ready
      await this.waitForProcessReady(session, args.timeout);

      return {
        success: true,
        sessionId,
        command: args.command,
        pid: childProcess.pid,
        initialOutput: session.outputBuffer.slice(0, 10).join('\n'),
        isRunning: !childProcess.killed,
        interactive: args.interactive,
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

    session.process.stdout?.on('data', data => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line: string) => line.trim());
      session.outputBuffer.push(...lines);
      session.lastActivity = Date.now();

      // Keep buffer size manageable
      if (session.outputBuffer.length > maxBufferSize) {
        session.outputBuffer = session.outputBuffer.slice(-maxBufferSize);
      }
    });

    session.process.stderr?.on('data', data => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line: string) => line.trim());
      const errorLines = lines.map((line: string) => `[ERROR] ${line}`);
      session.outputBuffer.push(...errorLines);
      session.lastActivity = Date.now();

      if (session.outputBuffer.length > maxBufferSize) {
        session.outputBuffer = session.outputBuffer.slice(-maxBufferSize);
      }
    });

    session.process.on('error', error => {
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

  public async interactWithProcess(args: any): Promise<any> {
    const session = this.sessions.get(args.sessionId!);

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

  public async readProcessOutput(args: any): Promise<any> {
    const session = this.sessions.get(args.sessionId!);

    if (!session) {
      return { error: `Session not found: ${args.sessionId}` };
    }

    return {
      sessionId: args.sessionId,
      command: session.command,
      isRunning: !session.process.killed,
      output: session.outputBuffer.join('\n'),
      totalLines: session.outputBuffer.length,
      lastActivity: new Date(session.lastActivity).toISOString(),
      uptime: Date.now() - session.startTime,
    };
  }

  public listSessions(): any {
    const sessions = Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      command: session.command,
      isRunning: !session.process.killed,
      pid: session.process.pid,
      uptime: Date.now() - session.startTime,
      lastActivity: new Date(session.lastActivity).toISOString(),
      isInteractive: session.isInteractive,
    }));

    return {
      totalSessions: sessions.length,
      runningSessions: sessions.filter(s => s.isRunning).length,
      sessions,
    };
  }

  public killProcess(args: any): any {
    const session = this.sessions.get(args.sessionId!);

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
      this.sessions.delete(args.sessionId!);

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
  public getProcessStatus(args: any): any {
    const session = this.sessions.get(args.sessionId!);

    if (!session) {
      return { error: `Session not found: ${args.sessionId}` };
    }

    return {
      sessionId: args.sessionId,
      command: session.command,
      pid: session.process.pid,
      isRunning: !session.process.killed,
      startTime: new Date(session.startTime).toISOString(),
      lastActivity: new Date(session.lastActivity).toISOString(),
      uptime: Date.now() - session.startTime,
      outputLines: session.outputBuffer.length,
      recentOutput: session.outputBuffer.slice(-5).join('\n'),
      isInteractive: session.isInteractive,
    };
  }
/**
 * Memory Code Execution Tool (like in Desktop Commander)
 */
export class CodeExecutionTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      language: z.enum(['python', 'javascript', 'nodejs', 'bash', 'powershell']),
      code: z.string().describe('Code to execute'),
      timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
      captureOutput: z.boolean().optional().default(true).describe('Capture and return output'),
      environment: z.record(z.string()).optional().describe('Environment variables'),
    });

    super({
      name: 'executeCode',
      description: 'Execute code in memory without saving files (Python, Node.js, Bash)',
      category: 'Code Execution',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
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
      return {
        error: `Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async executePython(args: any): Promise<any> {
    try {
      const result = await execAsync(`python -c "${args.code.replace(/"/g, '\\"')}"`, {
        cwd: this.agentContext.workingDirectory,
        timeout: args.timeout,
        env: { ...process.env, ...args.environment },
      });

      return {
        success: true,
        language: 'python',
        code: args.code,
        output: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now(),
      };
    } catch (error: any) {
      return {
        success: false,
        language: 'python',
        code: args.code,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code,
      };
    }
  }

  private async executeNodeJS(args: any): Promise<any> {
    try {
      const result = await execAsync(`node -e "${args.code.replace(/"/g, '\\"')}"`, {
        cwd: this.agentContext.workingDirectory,
        timeout: args.timeout,
        env: { ...process.env, ...args.environment },
      });

      return {
        success: true,
        language: 'nodejs',
        code: args.code,
        output: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now(),
      };
    } catch (error: any) {
      return {
        success: false,
        language: 'nodejs',
        code: args.code,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code,
      };
    }
  }

  private async executeBash(args: any): Promise<any> {
    try {
      const result = await execAsync(args.code, {
        cwd: this.agentContext.workingDirectory,
        timeout: args.timeout,
        env: { ...process.env, ...args.environment },
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
    } catch (error: any) {
      return {
        success: false,
        language: 'bash',
        code: args.code,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code,
      };
    }
  }

  private async executePowerShell(args: any): Promise<any> {
    try {
      const result = await execAsync(`powershell -Command "${args.code.replace(/"/g, '\\"')}"`, {
        cwd: this.agentContext.workingDirectory,
        timeout: args.timeout,
        env: { ...process.env, ...args.environment },
      });

      return {
        success: true,
        language: 'powershell',
        code: args.code,
        output: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now(),
      };
    } catch (error: any) {
      return {
        success: false,
        language: 'powershell',
        code: args.code,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code,
      };
    }
  }
}
