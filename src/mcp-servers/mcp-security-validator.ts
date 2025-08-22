import { SecurityUtils } from '../core/security.js';
import { logger } from '../core/logger.js';

export class MCPSecurityValidator {
  private static SENSITIVE_COMMANDS = [
    'rm -rf',
    'sudo',
    'su ',
    'chmod +x',
    'passwd',
    'useradd',
    'userdel',
    'curl.*|.*sh',
    'wget.*|.*sh',
    'nc.*-e',
    'python.*-c.*exec',
  ];

  private static ALLOWED_REMOTE_COMMANDS = [
    'ls',
    'pwd',
    'cd',
    'cat',
    'echo',
    'grep',
    'find',
    'git',
    'npm',
    'node',
    'tsc',
    'jest',
    'eslint',
    'prettier',
  ];

  static async validateToolCall(serverId: string, toolName: string, args: any): Promise<boolean> {
    // Basic argument validation
    if (!args || typeof args !== 'object') {
      logger.warn(`Invalid arguments for ${serverId}.${toolName}`);
      return false;
    }

    // Server-specific validation
    switch (serverId) {
      case 'terminal-controller':
        return await this.validateTerminalControllerCall(toolName, args);
      case 'task-manager':
        return this.validateTaskManagerCall(toolName, args);
      case 'remote-shell':
        return this.validateRemoteShellCall(toolName, args);
      default:
        logger.warn(`Unknown MCP server: ${serverId}`);
        return false;
    }
  }

  private static async validateTerminalControllerCall(
    toolName: string,
    args: any
  ): Promise<boolean> {
    switch (toolName) {
      case 'execute_command':
        return this.validateCommand(args.command);
      case 'write_file':
      case 'read_file':
        return await this.validateFilePath(args.path || args.file_path);
      case 'change_directory':
        return await this.validateDirectoryPath(args.path);
      default:
        return true; // Allow other operations
    }
  }

  private static validateTaskManagerCall(toolName: string, args: any): boolean {
    // Task manager operations are generally safe
    // Validate task content for potential code injection
    if (args.task && typeof args.task === 'string') {
      return !this.containsSensitiveContent(args.task);
    }
    return true;
  }

  private static validateRemoteShellCall(toolName: string, args: any): boolean {
    if (toolName === 'shell-exec') {
      // More restrictive validation for remote execution
      return this.validateRemoteCommand(args.command);
    }
    return true;
  }

  private static validateCommand(command: string): boolean {
    if (!command || typeof command !== 'string') {
      return false;
    }

    // Check for sensitive command patterns
    for (const pattern of this.SENSITIVE_COMMANDS) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(command)) {
        logger.warn(`Blocked sensitive command: ${command}`);
        return false;
      }
    }

    return true;
  }

  private static validateRemoteCommand(command: string): boolean {
    if (!this.validateCommand(command)) {
      return false;
    }

    // Additional restrictions for remote execution
    const baseCommand = command.trim().split(' ')[0];
    const isAllowed = this.ALLOWED_REMOTE_COMMANDS.some(
      allowed => baseCommand === allowed || baseCommand.startsWith(allowed)
    );

    if (!isAllowed) {
      logger.warn(`Remote command not in allowed list: ${baseCommand}`);
      return false;
    }

    return true;
  }

  private static async validateFilePath(filePath: string): Promise<boolean> {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    try {
      // Use existing security validation - create instance if needed
      const securityUtils = new SecurityUtils();
      const validation = await securityUtils.validatePath(filePath);
      return validation.isValid;
    } catch (error) {
      logger.warn(`File path validation failed: ${error}`);
      return false;
    }
  }

  private static async validateDirectoryPath(dirPath: string): Promise<boolean> {
    return await this.validateFilePath(dirPath);
  }

  private static containsSensitiveContent(content: string): boolean {
    const sensitivePatterns = [
      /password\s*[=:]\s*['"]/i,
      /api[_-]?key\s*[=:]\s*['"]/i,
      /secret\s*[=:]\s*['"]/i,
      /token\s*[=:]\s*['"]/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }
}
