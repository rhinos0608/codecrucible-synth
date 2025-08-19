import { BaseTool } from '../base-tool.js';
import { E2BService, ExecutionResult } from '../../e2b/e2b-service.js';
import { SecurityValidator, ValidationResult } from '../../e2b/security-validator.js';
import { logger } from '../../logger.js';
import { z } from 'zod';

/**
 * Secure E2B Terminal Tool
 * 
 * Replaces the unsafe TerminalExecuteTool with sandboxed command execution
 * using E2B infrastructure for complete isolation and security.
 */
export class E2BTerminalTool extends BaseTool {
  private e2bService: E2BService;
  private securityValidator: SecurityValidator;

  constructor(
    e2bService: E2BService,
    agentContext: any,
    securityValidator?: SecurityValidator
  ) {
    super({
      name: 'executeTerminalCommand',
      description: 'Execute terminal commands safely in an isolated E2B sandbox environment',
      category: 'Terminal Operations',
      parameters: z.object({
        command: z.string().min(1).describe('The terminal command to execute'),
        workingDirectory: z.string().optional().describe('Working directory for command execution'),
        sessionId: z.string().optional().describe('Session ID for persistent terminal context'),
        timeout: z.number().optional().default(30000).describe('Command timeout in milliseconds'),
        environment: z.record(z.string()).optional().describe('Environment variables for command'),
        expectInteractive: z.boolean().optional().default(false).describe('Whether command expects interactive input'),
        description: z.string().optional().describe('Description of what the command does')
      })
    });

    this.e2bService = e2bService;
    this.securityValidator = securityValidator || new SecurityValidator();
  }

  async execute(args: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      logger.info(`🖥️ E2B Terminal Command: ${args.command}`);
      
      // Security validation
      const validationResult = this.securityValidator.validateCommand(args.command);
      if (!validationResult.isValid) {
        logger.warn(`🚨 Terminal command blocked: ${validationResult.reason}`);
        
        this.securityValidator.logSecurityViolation(
          args.sessionId || 'unknown',
          'terminal_command',
          args.command,
          validationResult.severity
        );

        return {
          success: false,
          stderr: `Security validation failed: ${validationResult.reason}`,
          exitCode: 1,
          executionTime: Date.now() - startTime,
          sessionId: args.sessionId || 'none',
          securityWarnings: [validationResult.reason]
        };
      }

      // Generate session ID if not provided
      const sessionId = args.sessionId || this.generateSessionId();

      // Prepare command for safe execution
      const preparedCommand = await this.prepareCommandForExecution(args);

      // Execute command in E2B sandbox using Python subprocess
      const executionResult = await this.e2bService.executeCode(
        sessionId,
        preparedCommand,
        'python'
      );

      // Parse command execution result
      const commandResult = this.parseCommandResult(executionResult);

      logger.info(`✅ Terminal command completed - Success: ${commandResult.success}, Exit: ${commandResult.exitCode}, Time: ${commandResult.executionTime}ms`);

      return {
        success: commandResult.success,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
        exitCode: commandResult.exitCode,
        executionTime: commandResult.executionTime,
        sessionId,
        workingDirectory: args.workingDirectory,
        securityWarnings: validationResult.severity !== 'low' ? [validationResult.reason] : undefined
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('❌ E2B Terminal execution failed:', error);

      return {
        success: false,
        stderr: `Terminal execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exitCode: 1,
        executionTime,
        sessionId: args.sessionId || 'none'
      };
    }
  }

  /**
   * Prepare command for safe execution with proper isolation
   */
  private async prepareCommandForExecution(args: any): Promise<string> {
    const command = args.command.trim();
    const workingDir = args.workingDirectory || '/tmp';
    const timeout = args.timeout / 1000; // Convert to seconds
    
    // Build environment variables
    const envVars = args.environment || {};
    const envSetup = Object.entries(envVars)
      .map(([key, value]) => `"${key}": "${value}"`)
      .join(', ');

    // Create secure command execution wrapper in Python
    const commandWrapper = `
import subprocess
import sys
import os
import json
import time
import signal

# Command configuration
command = ${JSON.stringify(command)}
working_dir = ${JSON.stringify(workingDir)}
timeout_seconds = ${timeout}
env_vars = {${envSetup}}

# Merge with current environment (safely)
execution_env = os.environ.copy()
for key, value in env_vars.items():
    if not key.startswith('_') and key not in ['PATH', 'HOME', 'USER']:
        execution_env[key] = value

# Result structure
result = {
    "success": False,
    "stdout": "",
    "stderr": "",
    "exitCode": 1,
    "executionTime": 0,
    "command": command
}

start_time = time.time()

try:
    # Ensure working directory exists
    if not os.path.exists(working_dir):
        os.makedirs(working_dir, exist_ok=True)
    
    # Change to working directory
    original_cwd = os.getcwd()
    os.chdir(working_dir)
    
    # Execute command with security constraints
    process = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        env=execution_env,
        cwd=working_dir
    )
    
    # Restore original directory
    os.chdir(original_cwd)
    
    result["success"] = process.returncode == 0
    result["stdout"] = process.stdout
    result["stderr"] = process.stderr
    result["exitCode"] = process.returncode
    result["executionTime"] = int((time.time() - start_time) * 1000)
    
    # Output result as JSON for easy parsing
    print("COMMAND_RESULT_START")
    print(json.dumps(result, indent=2))
    print("COMMAND_RESULT_END")
    
except subprocess.TimeoutExpired:
    result["stderr"] = f"Command timed out after {timeout_seconds} seconds"
    result["exitCode"] = 124  # Standard timeout exit code
    result["executionTime"] = int(timeout_seconds * 1000)
    print("COMMAND_RESULT_START")
    print(json.dumps(result, indent=2))
    print("COMMAND_RESULT_END")
    
except FileNotFoundError:
    result["stderr"] = f"Command not found: {command.split()[0] if command.split() else command}"
    result["exitCode"] = 127  # Standard "command not found" exit code
    result["executionTime"] = int((time.time() - start_time) * 1000)
    print("COMMAND_RESULT_START")
    print(json.dumps(result, indent=2))
    print("COMMAND_RESULT_END")
    
except PermissionError:
    result["stderr"] = f"Permission denied: {command}"
    result["exitCode"] = 126  # Standard "permission denied" exit code
    result["executionTime"] = int((time.time() - start_time) * 1000)
    print("COMMAND_RESULT_START")
    print(json.dumps(result, indent=2))
    print("COMMAND_RESULT_END")
    
except Exception as e:
    result["stderr"] = f"Execution error: {str(e)}"
    result["exitCode"] = 1
    result["executionTime"] = int((time.time() - start_time) * 1000)
    print("COMMAND_RESULT_START")
    print(json.dumps(result, indent=2))
    print("COMMAND_RESULT_END")
`;

    return commandWrapper;
  }

  /**
   * Parse command execution result from Python wrapper output
   */
  private parseCommandResult(executionResult: ExecutionResult): any {
    try {
      if (!executionResult.output) {
        return {
          success: false,
          stdout: '',
          stderr: 'No output received from command execution',
          exitCode: 1,
          executionTime: executionResult.executionTime
        };
      }

      // Extract JSON result from wrapper output
      const startMarker = 'COMMAND_RESULT_START';
      const endMarker = 'COMMAND_RESULT_END';
      
      const startIndex = executionResult.output.indexOf(startMarker);
      const endIndex = executionResult.output.indexOf(endMarker);
      
      if (startIndex === -1 || endIndex === -1) {
        // Fallback: treat entire output as stdout
        return {
          success: !executionResult.error,
          stdout: executionResult.output,
          stderr: executionResult.error || '',
          exitCode: executionResult.error ? 1 : 0,
          executionTime: executionResult.executionTime
        };
      }
      
      const jsonStr = executionResult.output.substring(
        startIndex + startMarker.length,
        endIndex
      ).trim();
      
      const result = JSON.parse(jsonStr);
      
      return {
        success: result.success,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || (result.success ? 0 : 1),
        executionTime: result.executionTime || executionResult.executionTime
      };
      
    } catch (error) {
      logger.warn('Failed to parse command result, using fallback:', error);
      
      return {
        success: !executionResult.error,
        stdout: executionResult.output || '',
        stderr: executionResult.error || 'Failed to parse command result',
        exitCode: executionResult.error ? 1 : 0,
        executionTime: executionResult.executionTime
      };
    }
  }

  /**
   * Get list of common safe commands for auto-completion
   */
  getSafeCommands(): string[] {
    return [
      'ls', 'dir', 'pwd', 'whoami', 'date', 'echo', 'cat', 'head', 'tail',
      'grep', 'find', 'sort', 'uniq', 'wc', 'cut', 'awk', 'sed', 'diff',
      'file', 'which', 'type', 'help', 'man', 'info', 'history', 'alias',
      'ps', 'top', 'df', 'du', 'free', 'uptime', 'uname', 'env', 'printenv'
    ];
  }

  /**
   * Get list of dangerous commands that are blocked
   */
  getDangerousCommands(): string[] {
    return this.securityValidator.getPolicy().blockedCommands;
  }

  /**
   * Validate command without executing it
   */
  validateCommand(command: string): ValidationResult {
    return this.securityValidator.validateCommand(command);
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeCommandSequence(commands: string[], sessionId?: string): Promise<any[]> {
    const results: any[] = [];
    const actualSessionId = sessionId || this.generateSessionId();
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      logger.info(`🔄 Executing command ${i + 1}/${commands.length}: ${command}`);
      
      const result = await this.execute({
        command,
        sessionId: actualSessionId,
        description: `Command ${i + 1} of sequence`
      });
      
      results.push(result);
      
      // Stop sequence if a command fails
      if (!result.success) {
        logger.warn(`🛑 Command sequence stopped at step ${i + 1} due to failure`);
        break;
      }
    }
    
    return results;
  }

  /**
   * Execute command with interactive mode simulation
   */
  async executeInteractiveCommand(
    command: string, 
    inputs: string[], 
    sessionId?: string
  ): Promise<any> {
    // For interactive commands, we'll prepare inputs and execute as a batch
    const interactiveCommand = this.prepareInteractiveCommand(command, inputs);
    
    return await this.execute({
      command: interactiveCommand,
      sessionId,
      expectInteractive: true,
      description: 'Interactive command execution'
    });
  }

  /**
   * Prepare interactive command with predefined inputs
   */
  private prepareInteractiveCommand(command: string, inputs: string[]): string {
    // Create a command that provides inputs via echo and pipe
    const inputString = inputs.join('\\n');
    return `echo -e "${inputString}" | ${command}`;
  }

  /**
   * Generate unique session ID for terminal sessions
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `terminal_${timestamp}_${random}`;
  }

  /**
   * Get terminal execution statistics
   */
  getExecutionStats(): any {
    return {
      toolName: this.definition.name,
      securityPolicy: this.securityValidator.getPolicy(),
      safeCommands: this.getSafeCommands().length,
      blockedCommands: this.getDangerousCommands().length,
      e2bServiceStats: this.e2bService.getStats()
    };
  }

  /**
   * Update security policy for terminal execution
   */
  updateSecurityPolicy(newPolicy: any): void {
    this.securityValidator.updatePolicy(newPolicy);
    logger.info('🔒 E2B Terminal Tool security policy updated');
  }
}