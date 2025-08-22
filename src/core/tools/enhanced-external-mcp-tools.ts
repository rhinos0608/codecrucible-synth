import { EnhancedMCPClientManager } from '../../mcp-servers/enhanced-mcp-client-manager.js';
import { MCPSecurityValidator } from '../../mcp-servers/mcp-security-validator.js';
import { logger } from '../logger.js';

export class EnhancedExternalMCPTools {
  private mcpManager: EnhancedMCPClientManager;

  constructor(mcpManager: EnhancedMCPClientManager) {
    this.mcpManager = mcpManager;
  }

  /**
   * Terminal Controller Tools
   */
  async executeCommand(command: string, timeout?: number): Promise<any> {
    const isValid = await MCPSecurityValidator.validateToolCall(
      'terminal-controller', 
      'execute_command', 
      { command }
    );

    if (!isValid) {
      throw new Error('Command blocked by security validation');
    }

    return await this.mcpManager.executeToolCall('terminal-controller', 'execute_command', {
      command,
      timeout: timeout || 30000
    });
  }

  async readFile(filePath: string): Promise<any> {
    const isValid = await MCPSecurityValidator.validateToolCall(
      'terminal-controller',
      'read_file',
      { file_path: filePath }
    );

    if (!isValid) {
      throw new Error('File path blocked by security validation');
    }

    return await this.mcpManager.executeToolCall('terminal-controller', 'read_file', {
      file_path: filePath
    });
  }

  async writeFile(filePath: string, content: string): Promise<any> {
    const isValid = await MCPSecurityValidator.validateToolCall(
      'terminal-controller',
      'write_file',
      { file_path: filePath, content }
    );

    if (!isValid) {
      throw new Error('Write operation blocked by security validation');
    }

    return await this.mcpManager.executeToolCall('terminal-controller', 'write_file', {
      file_path: filePath,
      content
    });
  }

  async getCurrentDirectory(): Promise<any> {
    return await this.mcpManager.executeToolCall('terminal-controller', 'get_current_directory', {});
  }

  async listDirectory(path?: string): Promise<any> {
    const args = path ? { path } : {};
    return await this.mcpManager.executeToolCall('terminal-controller', 'list_directory', args);
  }

  async getCommandHistory(): Promise<any> {
    return await this.mcpManager.executeToolCall('terminal-controller', 'get_command_history', {});
  }

  /**
   * Task Manager Tools
   */
  async planRequest(request: string, tasks?: string[]): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'request_planning', {
      request,
      tasks: tasks || []
    });
  }

  async getNextTask(): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'get_next_task', {});
  }

  async markTaskDone(taskId: string): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'mark_task_done', {
      task_id: taskId
    });
  }

  async approveTaskCompletion(taskId: string): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'approve_task_completion', {
      task_id: taskId
    });
  }

  async approveRequestCompletion(requestId: string): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'approve_request_completion', {
      request_id: requestId
    });
  }

  /**
   * Remote Shell Tools
   */
  async executeRemoteCommand(command: string, workingDir?: string, timeout?: number): Promise<any> {
    const isValid = await MCPSecurityValidator.validateToolCall(
      'remote-shell',
      'shell-exec',
      { command }
    );

    if (!isValid) {
      throw new Error('Remote command blocked by security validation');
    }

    logger.info(`Executing remote command: ${command}`);

    return await this.mcpManager.executeToolCall('remote-shell', 'shell-exec', {
      command,
      working_directory: workingDir,
      timeout: timeout || 30000
    });
  }

  /**
   * Get all available tools across all MCP servers
   */
  getAvailableTools(): any[] {
    return this.mcpManager.getAvailableTools();
  }

  /**
   * Health check for all MCP servers
   */
  async healthCheck(): Promise<any> {
    return await this.mcpManager.healthCheck();
  }
}