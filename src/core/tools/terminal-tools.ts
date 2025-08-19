import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { SecureToolFactory } from '../security/secure-tool-factory.js';
import { logger } from '../logger.js';

const execAsync = promisify(exec);

/**
 * Terminal Command Execution Tool
 */
export class TerminalExecuteTool extends BaseTool {
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      command: z.string().describe('Command to execute'),
      args: z.array(z.string()).optional().describe('Command arguments'),
      workingDirectory: z.string().optional().describe('Working directory (defaults to agent working directory)'),
      timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
      environment: z.record(z.string()).optional().describe('Environment variables'),
      shell: z.boolean().optional().default(true).describe('Execute in shell'),
      background: z.boolean().optional().default(false).describe('Run in background'),
      processId: z.string().optional().describe('Unique ID for background processes'),
    });

    super({
      name: 'executeCommand',
      description: 'Execute terminal commands with full control over execution environment',
      category: 'Terminal',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      const cwd = args.workingDirectory || this.agentContext.workingDirectory;
      
      // Validate working directory
      if (!existsSync(cwd)) {
        return { error: `Working directory does not exist: ${cwd}` };
      }

      // Build full command
      const fullCommand = args.args ? 
        `${args.command} ${args.args.join(' ')}` : 
        args.command;

      // Check if command is safe
      if (!this.isCommandSafe(args.command)) {
        return { 
          error: `Command blocked for security: ${args.command}`,
          suggestion: 'Use system administration tools or request explicit permission for system commands'
        };
      }

      if (args.background) {
        return await this.executeInBackground(fullCommand, args, cwd);
      } else {
        return await this.executeSync(fullCommand, args, cwd);
      }

    } catch (error) {
      return { 
        error: `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async executeSync(command: string, args: any, cwd: string): Promise<any> {
    try {
      const execOptions = {
        cwd,
        timeout: args.timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        env: { ...process.env, ...args.environment },
        shell: args.shell
      };

      const result = await execAsync(command, execOptions);

      return {
        success: true,
        command,
        exitCode: 0,
        stdout: result.stdout,
        stderr: result.stderr,
        workingDirectory: cwd,
        executionTime: Date.now()
      };

    } catch (error: any) {
      return {
        success: false,
        command,
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        workingDirectory: cwd,
        error: error.message
      };
    }
  }

  private async executeInBackground(command: string, args: any, cwd: string): Promise<any> {
    try {
      const processId = args.processId || `bg_${Date.now()}`;
      
      const childProcess = spawn(args.command, args.args || [], {
        cwd,
        env: { ...process.env, ...args.environment },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: args.shell
      });

      this.runningProcesses.set(processId, childProcess);

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (args.timeout) {
        timeoutId = setTimeout(() => {
          childProcess.kill('SIGTERM');
        }, args.timeout);
      }

      return new Promise((resolve) => {
        childProcess.on('exit', (code) => {
          if (timeoutId) clearTimeout(timeoutId);
          this.runningProcesses.delete(processId);
          
          resolve({
            success: code === 0,
            command,
            processId,
            exitCode: code,
            stdout,
            stderr,
            workingDirectory: cwd,
            completed: true
          });
        });

        childProcess.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          this.runningProcesses.delete(processId);
          
          resolve({
            success: false,
            command,
            processId,
            error: error.message,
            stdout,
            stderr,
            workingDirectory: cwd,
            completed: true
          });
        });

        // Return immediately for background processes
        resolve({
          success: true,
          command,
          processId,
          status: 'running',
          background: true,
          workingDirectory: cwd,
          message: `Process started with ID: ${processId}`
        });
      });

    } catch (error) {
      return {
        success: false,
        command,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private isCommandSafe(command: string): boolean {
    const dangerousCommands = [
      'rm -rf /',
      'format',
      'del /f /s /q',
      'sudo rm',
      'chmod 777',
      'dd if=',
      'mkfs',
      'fdisk',
      ':(){ :|:& };:',
      'shutdown',
      'reboot',
      'halt',
      'init 0',
      'init 6'
    ];

    const cmd = command.toLowerCase().trim();
    
    // Check against dangerous patterns
    for (const dangerous of dangerousCommands) {
      if (cmd.includes(dangerous.toLowerCase())) {
        return false;
      }
    }

    // Allow common development commands
    const safeCommands = [
      'npm', 'yarn', 'pnpm', 'node', 'python', 'pip',
      'git', 'gcc', 'make', 'cmake', 'cargo', 'go',
      'tsc', 'webpack', 'rollup', 'vite', 'parcel',
      'jest', 'mocha', 'cypress', 'playwright',
      'ls', 'dir', 'cat', 'type', 'head', 'tail',
      'grep', 'find', 'locate', 'which', 'where',
      'echo', 'printf', 'curl', 'wget', 'ping',
      'ps', 'top', 'htop', 'whoami', 'pwd',
      'mkdir', 'touch', 'cp', 'mv', 'ln'
    ];

    const firstWord = cmd.split(' ')[0];
    return safeCommands.some(safe => firstWord.startsWith(safe));
  }
}

/**
 * Process Management Tool
 */
export class ProcessManagementTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      action: z.enum(['list', 'kill', 'status', 'killAll']),
      processId: z.string().optional().describe('Process ID for specific operations'),
      signal: z.string().optional().default('SIGTERM').describe('Signal to send when killing process'),
    });

    super({
      name: 'manageProcesses',
      description: 'Manage background processes: list, kill, check status',
      category: 'Terminal',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      // Use secure tool factory instead of direct TerminalExecuteTool
      const secureToolFactory = new SecureToolFactory();
      const terminalTool = secureToolFactory.createTerminalTool(this.agentContext);
      
      switch (args.action) {
        case 'list':
          return await this.listProcesses();
        
        case 'status':
          return await this.getProcessStatus(args.processId!);
        
        case 'kill':
          return await this.killProcess(args.processId!, args.signal);
        
        case 'killAll':
          return await this.killAllProcesses();
        
        default:
          return { error: `Unknown action: ${args.action}` };
      }

    } catch (error) {
      return { 
        error: `Process management failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async listProcesses(): Promise<any> {
    try {
      // Get system processes
      const result = await execAsync('ps aux || tasklist', {
        cwd: this.agentContext.workingDirectory
      });

      return {
        success: true,
        processes: result.stdout,
        count: result.stdout.split('\n').length - 1
      };

    } catch (error) {
      return {
        error: `Failed to list processes: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async getProcessStatus(processId: string): Promise<any> {
    try {
      // Check if process is running
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 
        `tasklist /FI "PID eq ${processId}"` :
        `ps -p ${processId}`;

      const result = await execAsync(command);

      return {
        success: true,
        processId,
        running: result.stdout.includes(processId),
        details: result.stdout
      };

    } catch (error) {
      return {
        success: false,
        processId,
        running: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async killProcess(processId: string, signal: string): Promise<any> {
    try {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 
        `taskkill /PID ${processId} /F` :
        `kill -${signal} ${processId}`;

      const result = await execAsync(command);

      return {
        success: true,
        processId,
        signal,
        message: `Process ${processId} killed`,
        output: result.stdout
      };

    } catch (error) {
      return {
        success: false,
        processId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async killAllProcesses(): Promise<any> {
    // This is a dangerous operation, so we'll be very restrictive
    return {
      error: 'killAll operation not allowed for security reasons',
      suggestion: 'Use individual process management instead'
    };
  }
}

/**
 * Shell Environment Tool
 */
export class ShellEnvironmentTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      action: z.enum(['getEnv', 'setEnv', 'getPath', 'which', 'whereis', 'pwd', 'whoami']),
      variable: z.string().optional().describe('Environment variable name'),
      value: z.string().optional().describe('Environment variable value'),
      command: z.string().optional().describe('Command to locate'),
    });

    super({
      name: 'shellEnvironment',
      description: 'Manage shell environment: get/set variables, locate commands, get system info',
      category: 'Terminal',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      switch (args.action) {
        case 'getEnv':
          return this.getEnvironmentVariable(args.variable);
        
        case 'setEnv':
          return this.setEnvironmentVariable(args.variable!, args.value!);
        
        case 'getPath':
          return this.getPathVariable();
        
        case 'which':
          return await this.locateCommand(args.command!, 'which');
        
        case 'whereis':
          return await this.locateCommand(args.command!, 'whereis');
        
        case 'pwd':
          return this.getCurrentDirectory();
        
        case 'whoami':
          return await this.getCurrentUser();
        
        default:
          return { error: `Unknown action: ${args.action}` };
      }

    } catch (error) {
      return { 
        error: `Shell environment operation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private getEnvironmentVariable(variable?: string): any {
    if (variable) {
      return {
        variable,
        value: process.env[variable] || null,
        exists: variable in process.env
      };
    } else {
      return {
        environment: process.env,
        count: Object.keys(process.env).length
      };
    }
  }

  private setEnvironmentVariable(variable: string, value: string): any {
    try {
      process.env[variable] = value;
      return {
        success: true,
        variable,
        value,
        message: `Environment variable ${variable} set`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getPathVariable(): any {
    const pathVar = process.env.PATH || process.env.Path;
    const paths = pathVar ? pathVar.split(process.platform === 'win32' ? ';' : ':') : [];
    
    return {
      path: pathVar,
      paths,
      count: paths.length
    };
  }

  private async locateCommand(command: string, method: 'which' | 'whereis'): Promise<any> {
    try {
      const cmd = process.platform === 'win32' ? 
        `where ${command}` : 
        `${method} ${command}`;

      const result = await execAsync(cmd);

      return {
        success: true,
        command,
        method,
        location: result.stdout.trim(),
        found: result.stdout.trim().length > 0
      };

    } catch (error) {
      return {
        success: false,
        command,
        method,
        found: false,
        error: error instanceof Error ? error.message : 'Command not found'
      };
    }
  }

  private getCurrentDirectory(): any {
    return {
      workingDirectory: this.agentContext.workingDirectory,
      currentDirectory: process.cwd(),
      platform: process.platform
    };
  }

  private async getCurrentUser(): Promise<any> {
    try {
      const command = process.platform === 'win32' ? 'whoami' : 'whoami';
      const result = await execAsync(command);

      return {
        success: true,
        user: result.stdout.trim(),
        platform: process.platform,
        nodeVersion: process.version
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Package Manager Tool
 */
export class PackageManagerTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      manager: z.enum(['npm', 'yarn', 'pnpm', 'pip', 'cargo', 'go']).optional().describe('Package manager to use (auto-detect if not specified)'),
      action: z.enum(['install', 'uninstall', 'update', 'list', 'info', 'search', 'init', 'run', 'test', 'build']),
      packages: z.array(z.string()).optional().describe('Package names'),
      script: z.string().optional().describe('Script name to run'),
      flags: z.array(z.string()).optional().describe('Additional flags'),
      global: z.boolean().optional().default(false).describe('Global installation'),
      dev: z.boolean().optional().default(false).describe('Development dependency'),
    });

    super({
      name: 'packageManager',
      description: 'Manage packages and dependencies using various package managers',
      category: 'Package Management',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      const manager = args.manager || await this.detectPackageManager();
      const command = this.buildPackageCommand(manager, args);
      
      if (!command) {
        return { error: `Unable to build command for manager: ${manager}` };
      }

      // Execute command using terminal tool
      // Use secure tool factory for terminal execution
      const secureToolFactory = new SecureToolFactory();
      const terminalTool = secureToolFactory.createTerminalTool(this.agentContext);
      const result = await terminalTool.execute({
        command: command,
        timeout: 120000, // 2 minutes for package operations
        workingDirectory: this.agentContext.workingDirectory
      });

      return {
        ...result,
        manager,
        action: args.action,
        packages: args.packages
      };

    } catch (error) {
      return { 
        error: `Package management failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async detectPackageManager(): Promise<string> {
    const cwd = this.agentContext.workingDirectory;
    
    // Check for lock files to determine package manager
    if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
    if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(cwd, 'package-lock.json'))) return 'npm';
    if (existsSync(join(cwd, 'Cargo.toml'))) return 'cargo';
    if (existsSync(join(cwd, 'go.mod'))) return 'go';
    if (existsSync(join(cwd, 'requirements.txt')) || existsSync(join(cwd, 'pyproject.toml'))) return 'pip';
    
    // Default to npm for Node.js projects
    if (existsSync(join(cwd, 'package.json'))) return 'npm';
    
    return 'npm';
  }

  private buildPackageCommand(manager: string, args: any): string | null {
    const flags = args.flags || [];
    const globalFlag = args.global;
    const devFlag = args.dev;

    switch (manager) {
      case 'npm':
        return this.buildNpmCommand(args.action, args.packages, args.script, flags, globalFlag, devFlag);
      
      case 'yarn':
        return this.buildYarnCommand(args.action, args.packages, args.script, flags, globalFlag, devFlag);
      
      case 'pnpm':
        return this.buildPnpmCommand(args.action, args.packages, args.script, flags, globalFlag, devFlag);
      
      case 'pip':
        return this.buildPipCommand(args.action, args.packages, flags, globalFlag);
      
      case 'cargo':
        return this.buildCargoCommand(args.action, args.packages, flags);
      
      case 'go':
        return this.buildGoCommand(args.action, args.packages, flags);
      
      default:
        return null;
    }
  }

  private buildNpmCommand(action: string, packages?: string[], script?: string, flags: string[] = [], global = false, dev = false): string {
    let cmd = 'npm';
    
    switch (action) {
      case 'install':
        cmd += ' install';
        if (packages) cmd += ` ${packages.join(' ')}`;
        if (global) cmd += ' -g';
        if (dev) cmd += ' --save-dev';
        break;
      
      case 'uninstall':
        cmd += ' uninstall';
        if (packages) cmd += ` ${packages.join(' ')}`;
        if (global) cmd += ' -g';
        break;
      
      case 'update':
        cmd += ' update';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'list':
        cmd += ' list';
        if (global) cmd += ' -g';
        break;
      
      case 'info':
        cmd += ' info';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'search':
        cmd += ' search';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'init':
        cmd += ' init';
        if (!flags.includes('-y')) cmd += ' -y';
        break;
      
      case 'run':
        cmd += ' run';
        if (script) cmd += ` ${script}`;
        break;
      
      case 'test':
        cmd += ' test';
        break;
      
      case 'build':
        cmd += ' run build';
        break;
    }
    
    if (flags.length > 0) {
      cmd += ` ${flags.join(' ')}`;
    }
    
    return cmd;
  }

  private buildYarnCommand(action: string, packages?: string[], script?: string, flags: string[] = [], global = false, dev = false): string {
    let cmd = 'yarn';
    
    switch (action) {
      case 'install':
        if (packages) {
          cmd += ' add';
          cmd += ` ${packages.join(' ')}`;
          if (dev) cmd += ' --dev';
        } else {
          cmd += ' install';
        }
        if (global) cmd += ' global';
        break;
      
      case 'uninstall':
        cmd += ' remove';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'update':
        cmd += ' upgrade';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'list':
        cmd += ' list';
        break;
      
      case 'info':
        cmd += ' info';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'init':
        cmd += ' init';
        if (!flags.includes('-y')) cmd += ' -y';
        break;
      
      case 'run':
        if (script) cmd += ` ${script}`;
        break;
      
      case 'test':
        cmd += ' test';
        break;
      
      case 'build':
        cmd += ' build';
        break;
    }
    
    if (flags.length > 0) {
      cmd += ` ${flags.join(' ')}`;
    }
    
    return cmd;
  }

  private buildPnpmCommand(action: string, packages?: string[], script?: string, flags: string[] = [], global = false, dev = false): string {
    let cmd = 'pnpm';
    
    switch (action) {
      case 'install':
        if (packages) {
          cmd += ' add';
          cmd += ` ${packages.join(' ')}`;
          if (dev) cmd += ' --save-dev';
        } else {
          cmd += ' install';
        }
        if (global) cmd += ' -g';
        break;
      
      case 'uninstall':
        cmd += ' remove';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'update':
        cmd += ' update';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'list':
        cmd += ' list';
        if (global) cmd += ' -g';
        break;
      
      case 'run':
        if (script) cmd += ` ${script}`;
        break;
      
      case 'test':
        cmd += ' test';
        break;
      
      case 'build':
        cmd += ' build';
        break;
    }
    
    if (flags.length > 0) {
      cmd += ` ${flags.join(' ')}`;
    }
    
    return cmd;
  }

  private buildPipCommand(action: string, packages?: string[], flags: string[] = [], global = false): string {
    let cmd = 'pip';
    
    switch (action) {
      case 'install':
        cmd += ' install';
        if (packages) cmd += ` ${packages.join(' ')}`;
        if (!global) cmd += ' --user';
        break;
      
      case 'uninstall':
        cmd += ' uninstall';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'update':
        cmd += ' install --upgrade';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'list':
        cmd += ' list';
        break;
      
      case 'info':
        cmd += ' show';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'search':
        cmd += ' search';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
    }
    
    if (flags.length > 0) {
      cmd += ` ${flags.join(' ')}`;
    }
    
    return cmd;
  }

  private buildCargoCommand(action: string, packages?: string[], flags: string[] = []): string {
    let cmd = 'cargo';
    
    switch (action) {
      case 'install':
        cmd += ' install';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'uninstall':
        cmd += ' uninstall';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'update':
        cmd += ' update';
        break;
      
      case 'build':
        cmd += ' build';
        break;
      
      case 'test':
        cmd += ' test';
        break;
      
      case 'run':
        cmd += ' run';
        break;
    }
    
    if (flags.length > 0) {
      cmd += ` ${flags.join(' ')}`;
    }
    
    return cmd;
  }

  private buildGoCommand(action: string, packages?: string[], flags: string[] = []): string {
    let cmd = 'go';
    
    switch (action) {
      case 'install':
        cmd += ' install';
        if (packages) cmd += ` ${packages.join(' ')}`;
        break;
      
      case 'build':
        cmd += ' build';
        break;
      
      case 'test':
        cmd += ' test';
        break;
      
      case 'run':
        cmd += ' run';
        break;
    }
    
    if (flags.length > 0) {
      cmd += ` ${flags.join(' ')}`;
    }
    
    return cmd;
  }
}