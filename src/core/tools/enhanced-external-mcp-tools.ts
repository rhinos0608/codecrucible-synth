import { EnhancedMCPClientManager } from '../../mcp-servers/enhanced-mcp-client-manager.js';
import { MCPSecurityValidator } from '../../mcp-servers/mcp-security-validator.js';
import { logger } from '../logger.js';

export class EnhancedExternalMCPTools {
  private mcpManager: EnhancedMCPClientManager;

  constructor(mcpManager: EnhancedMCPClientManager) {
    this.mcpManager = mcpManager;
  }

  /**
   * Terminal Controller Tools with Fallback
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

    try {
      // Try external MCP terminal-controller first
      return await this.mcpManager.executeToolCall('terminal-controller', 'execute_command', {
        command,
        timeout: timeout || 30000,
      });
    } catch (error) {
      logger.warn(`External MCP terminal-controller failed, falling back to built-in terminal: ${error}`);
      
      // Fallback to built-in terminal server
      try {
        return await this.mcpManager.executeToolCall('terminal', 'terminal_exec', {
          command,
          timeout: timeout || 30000,
        });
      } catch (fallbackError) {
        logger.warn(`Built-in terminal also failed, using Node.js child_process fallback: ${fallbackError}`);
        
        // Final fallback - use Node.js child_process directly
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        try {
          const result = await execAsync(command, { 
            timeout: timeout || 30000,
            maxBuffer: 1024 * 1024 // 1MB buffer
          });
          return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: 0
          };
        } catch (nodeError: any) {
          return {
            stdout: nodeError.stdout || '',
            stderr: nodeError.stderr || nodeError.message,
            exitCode: nodeError.code || 1
          };
        }
      }
    }
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

    try {
      // Try external MCP terminal-controller first
      return await this.mcpManager.executeToolCall('terminal-controller', 'read_file', {
        file_path: filePath,
      });
    } catch (error) {
      logger.warn(`External MCP terminal-controller read failed, falling back to built-in filesystem: ${error}`);
      
      // Fallback to built-in filesystem server
      try {
        return await this.mcpManager.executeToolCall('filesystem', 'read_file', {
          filePath,
        });
      } catch (fallbackError) {
        logger.warn(`Built-in filesystem also failed, using Node.js fs fallback: ${fallbackError}`);
        
        // Final fallback - use Node.js fs directly
        const fs = await import('fs/promises');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return { content };
        } catch (nodeError: any) {
          throw new Error(`Failed to read file: ${nodeError.message}`);
        }
      }
    }
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

    try {
      // Try external MCP terminal-controller first
      return await this.mcpManager.executeToolCall('terminal-controller', 'write_file', {
        file_path: filePath,
        content,
      });
    } catch (error) {
      logger.warn(`External MCP terminal-controller write failed, falling back to built-in filesystem: ${error}`);
      
      // Fallback to built-in filesystem server
      try {
        return await this.mcpManager.executeToolCall('filesystem', 'write_file', {
          filePath,
          content,
        });
      } catch (fallbackError) {
        logger.warn(`Built-in filesystem also failed, using Node.js fs fallback: ${fallbackError}`);
        
        // Final fallback - use Node.js fs directly
        const fs = await import('fs/promises');
        const path = await import('path');
        
        try {
          // Ensure directory exists
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true });
          
          await fs.writeFile(filePath, content, 'utf-8');
          return { success: true, path: filePath };
        } catch (nodeError: any) {
          throw new Error(`Failed to write file: ${nodeError.message}`);
        }
      }
    }
  }

  async getCurrentDirectory(): Promise<any> {
    return await this.mcpManager.executeToolCall(
      'terminal-controller',
      'get_current_directory',
      {}
    );
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
      tasks: tasks || [],
    });
  }

  async getNextTask(): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'get_next_task', {});
  }

  async markTaskDone(taskId: string): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'mark_task_done', {
      task_id: taskId,
    });
  }

  async approveTaskCompletion(taskId: string): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'approve_task_completion', {
      task_id: taskId,
    });
  }

  async approveRequestCompletion(requestId: string): Promise<any> {
    return await this.mcpManager.executeToolCall('task-manager', 'approve_request_completion', {
      request_id: requestId,
    });
  }

  /**
   * Remote Shell Tools
   */
  async executeRemoteCommand(command: string, workingDir?: string, timeout?: number): Promise<any> {
    const isValid = await MCPSecurityValidator.validateToolCall('remote-shell', 'shell-exec', {
      command,
    });

    if (!isValid) {
      throw new Error('Remote command blocked by security validation');
    }

    logger.info(`Executing remote command: ${command}`);

    return await this.mcpManager.executeToolCall('remote-shell', 'shell-exec', {
      command,
      working_directory: workingDir,
      timeout: timeout || 30000,
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
