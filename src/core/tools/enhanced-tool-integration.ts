import { ToolIntegration } from './tool-integration.js';
import { EnhancedMCPClientManager } from '../../mcp-servers/enhanced-mcp-client-manager.js';
import { EnhancedExternalMCPTools } from './enhanced-external-mcp-tools.js';
import { MCP_SERVER_CONFIGS } from '../../mcp-servers/mcp-server-configs.js';
import { logger } from '../logger.js';

export class EnhancedToolIntegration extends ToolIntegration {
  private externalMcpManager: EnhancedMCPClientManager;
  private externalMcpTools: EnhancedExternalMCPTools;

  constructor(mcpManager: any) {
    super(mcpManager);
    this.externalMcpManager = new EnhancedMCPClientManager(MCP_SERVER_CONFIGS);
    this.externalMcpTools = new EnhancedExternalMCPTools(this.externalMcpManager);
  }

  async initialize(): Promise<void> {
    try {
      // Initialize existing local tools
      logger.info('Initializing local MCP tools...');
      
      // Initialize external MCP servers
      logger.info('Initializing external MCP servers...');
      await this.externalMcpManager.initializeServers();
      
      // Register external MCP tools as LLM functions
      this.registerExternalMCPTools();
      
      logger.info('Enhanced tool integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize enhanced tool integration:', error);
      // Continue with local tools only if external MCP fails
      logger.warn('Continuing with local tools only due to external MCP initialization failure');
    }
  }

  private registerExternalMCPTools(): void {
    // Register Terminal Controller tools
    this.availableTools.set('mcp_execute_command', {
      id: 'mcp_execute_command',
      name: 'Execute Terminal Command',
      description: 'Execute a terminal command using external MCP Terminal Controller',
      execute: async (args: any) => this.externalMcpTools.executeCommand(args.command, args.timeout),
      inputSchema: {
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' }
        },
        required: ['command']
      }
    });

    this.availableTools.set('mcp_read_file', {
      id: 'mcp_read_file',
      name: 'Read File (External MCP)',
      description: 'Read file contents using external MCP Terminal Controller',
      execute: async (args: any) => this.externalMcpTools.readFile(args.filePath),
      inputSchema: {
        properties: {
          filePath: { type: 'string', description: 'Path to file to read' }
        },
        required: ['filePath']
      }
    });

    this.availableTools.set('mcp_write_file', {
      id: 'mcp_write_file',
      name: 'Write File (External MCP)',
      description: 'Write content to file using external MCP Terminal Controller',
      execute: async (args: any) => this.externalMcpTools.writeFile(args.filePath, args.content),
      inputSchema: {
        properties: {
          filePath: { type: 'string', description: 'Path to file to write' },
          content: { type: 'string', description: 'Content to write to file' }
        },
        required: ['filePath', 'content']
      }
    });

    this.availableTools.set('mcp_list_directory', {
      id: 'mcp_list_directory',
      name: 'List Directory (External MCP)',
      description: 'List directory contents using external MCP Terminal Controller',
      execute: async (args: any) => this.externalMcpTools.listDirectory(args.path),
      inputSchema: {
        properties: {
          path: { type: 'string', description: 'Directory path to list' }
        },
        required: []
      }
    });

    // Register Task Manager tools
    this.availableTools.set('mcp_plan_request', {
      id: 'mcp_plan_request',
      name: 'Plan Request Tasks',
      description: 'Plan and organize tasks for a request using external MCP Task Manager',
      execute: async (args: any) => this.externalMcpTools.planRequest(args.request, args.tasks),
      inputSchema: {
        properties: {
          request: { type: 'string', description: 'Request description to plan' },
          tasks: { type: 'array', description: 'Optional initial task list' }
        },
        required: ['request']
      }
    });

    this.availableTools.set('mcp_get_next_task', {
      id: 'mcp_get_next_task',
      name: 'Get Next Task',
      description: 'Get the next task from the task queue using external MCP Task Manager',
      execute: async () => this.externalMcpTools.getNextTask(),
      inputSchema: {
        properties: {},
        required: []
      }
    });

    this.availableTools.set('mcp_mark_task_done', {
      id: 'mcp_mark_task_done',
      name: 'Mark Task Done',
      description: 'Mark a task as completed using external MCP Task Manager',
      execute: async (args: any) => this.externalMcpTools.markTaskDone(args.taskId),
      inputSchema: {
        properties: {
          taskId: { type: 'string', description: 'ID of task to mark as done' }
        },
        required: ['taskId']
      }
    });

    // Register Remote Shell tools (disabled by default for security)
    this.availableTools.set('mcp_remote_execute', {
      id: 'mcp_remote_execute',
      name: 'Execute Remote Command',
      description: 'Execute command on remote system using external MCP Remote Shell (RESTRICTED)',
      execute: async (args: any) => this.externalMcpTools.executeRemoteCommand(
        args.command, 
        args.workingDir, 
        args.timeout
      ),
      inputSchema: {
        properties: {
          command: { type: 'string', description: 'Command to execute remotely' },
          workingDir: { type: 'string', description: 'Working directory for command' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' }
        },
        required: ['command']
      }
    });
  }

  /**
   * Enhanced getLLMFunctions to include external MCP tools
   */
  override getLLMFunctions(): any[] {
    const baseFunctions = super.getLLMFunctions();
    const externalMcpFunctions = Array.from(this.availableTools.values())
      .filter(tool => tool.id.startsWith('mcp_'))
      .map(tool => ({
        type: 'function',
        function: {
          name: tool.id,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: tool.inputSchema.properties || {},
            required: tool.inputSchema.required || []
          }
        }
      }));

    logger.info(`Enhanced tool integration providing ${baseFunctions.length} local + ${externalMcpFunctions.length} external MCP tools`);
    
    return [...baseFunctions, ...externalMcpFunctions];
  }

  /**
   * Health check for all systems
   */
  async healthCheck(): Promise<any> {
    const baseHealth = { local: { status: 'running', tools: this.getAvailableToolNames().length } };
    
    try {
      const externalMcpHealth = await this.externalMcpTools.healthCheck();
      
      return {
        ...baseHealth,
        external_mcp: externalMcpHealth
      };
    } catch (error) {
      logger.warn('External MCP health check failed:', error);
      return {
        ...baseHealth,
        external_mcp: { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    try {
      await this.externalMcpManager.disconnect();
      logger.info('External MCP connections closed');
    } catch (error) {
      logger.error('Error shutting down external MCP connections:', error);
    }
  }
}

// Global instance for external MCP tool integration
let globalEnhancedToolIntegration: EnhancedToolIntegration | null = null;

export function initializeGlobalEnhancedToolIntegration(mcpManager: any): void {
  globalEnhancedToolIntegration = new EnhancedToolIntegration(mcpManager);
}

export function getGlobalEnhancedToolIntegration(): EnhancedToolIntegration | null {
  return globalEnhancedToolIntegration;
}