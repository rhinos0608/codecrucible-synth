# MCP Server Implementation Guide

**Target:** CodeCrucible Synth v3.9.1  
**Objective:** Integrate three Smithery.ai MCP servers for enhanced terminal control, task management, and remote shell capabilities  
**Date:** August 22, 2025  

## Overview

This guide provides detailed implementation instructions for integrating three Model Context Protocol (MCP) servers into CodeCrucible Synth:

1. **Terminal Controller MCP** - Enhanced terminal and file operations
2. **Task Manager MCP** - Structured workflow and task management  
3. **Remote Shell MCP** - Remote command execution capabilities

## Prerequisites

### Dependencies Required
```json
{
  "@modelcontextprotocol/sdk": "^1.0.0"
}
```

### API Configuration
- **API Key:** `1f2853f9-af6e-4e69-814b-5f7e8cb65058`
- **Base URL:** `https://server.smithery.ai`
- **Authentication:** Query parameter `api_key`

## Implementation Architecture

### 1. Enhanced MCP Client Manager

**File:** `src/mcp-servers/enhanced-mcp-client-manager.ts`

```typescript
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  capabilities?: string[];
}

export interface MCPClientInstance {
  id: string;
  client: Client;
  transport: StreamableHTTPClientTransport;
  tools: any[];
  status: 'connected' | 'disconnected' | 'error';
  lastError?: string;
}

export class EnhancedMCPClientManager {
  private clients: Map<string, MCPClientInstance> = new Map();
  private config: MCPServerConfig[];

  constructor(config: MCPServerConfig[]) {
    this.config = config;
  }

  async initializeServers(): Promise<void> {
    const initPromises = this.config
      .filter(server => server.enabled)
      .map(server => this.connectToServer(server));
    
    await Promise.allSettled(initPromises);
  }

  private async connectToServer(config: MCPServerConfig): Promise<void> {
    try {
      // Construct server URL with authentication
      const url = new URL(config.url);
      url.searchParams.set("api_key", config.apiKey);
      const serverUrl = url.toString();

      // Create transport
      const transport = new StreamableHTTPClientTransport(serverUrl);

      // Create MCP client
      const client = new Client({
        name: "CodeCrucible Synth",
        version: "3.9.1"
      });

      await client.connect(transport);

      // List available tools
      const tools = await client.listTools();
      
      // Store client instance
      this.clients.set(config.id, {
        id: config.id,
        client,
        transport,
        tools: tools || [],
        status: 'connected'
      });

      console.log(`✅ Connected to ${config.name}: ${tools?.map(t => t.name).join(", ") || 'No tools'}`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${config.name}:`, error);
      this.clients.set(config.id, {
        id: config.id,
        client: null as any,
        transport: null as any,
        tools: [],
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async executeToolCall(serverId: string, toolName: string, args: any): Promise<any> {
    const clientInstance = this.clients.get(serverId);
    if (!clientInstance || clientInstance.status !== 'connected') {
      throw new Error(`MCP server ${serverId} not available`);
    }

    try {
      const result = await clientInstance.client.callTool({
        name: toolName,
        arguments: args
      });
      
      return result;
    } catch (error) {
      console.error(`Tool execution failed on ${serverId}.${toolName}:`, error);
      throw error;
    }
  }

  getAvailableTools(serverId?: string): any[] {
    if (serverId) {
      const client = this.clients.get(serverId);
      return client?.tools || [];
    }
    
    // Return all tools from all servers
    const allTools: any[] = [];
    for (const client of this.clients.values()) {
      allTools.push(...client.tools.map(tool => ({
        ...tool,
        serverId: client.id
      })));
    }
    return allTools;
  }

  async healthCheck(): Promise<{[serverId: string]: any}> {
    const health: {[serverId: string]: any} = {};
    
    for (const [id, instance] of this.clients) {
      health[id] = {
        status: instance.status,
        toolCount: instance.tools.length,
        lastError: instance.lastError,
        tools: instance.tools.map(t => t.name)
      };
    }
    
    return health;
  }

  async disconnect(): Promise<void> {
    for (const instance of this.clients.values()) {
      try {
        if (instance.client) {
          await instance.client.close();
        }
      } catch (error) {
        console.error(`Error disconnecting ${instance.id}:`, error);
      }
    }
    this.clients.clear();
  }
}
```

### 2. MCP Server Configurations

**File:** `src/mcp-servers/mcp-server-configs.ts`

```typescript
export const MCP_SERVER_CONFIGS: MCPServerConfig[] = [
  {
    id: 'terminal-controller',
    name: 'Terminal Controller',
    url: 'https://server.smithery.ai/@GongRzhe/terminal-controller-mcp/mcp',
    apiKey: '1f2853f9-af6e-4e69-814b-5f7e8cb65058',
    enabled: true,
    capabilities: [
      'execute_command',
      'get_command_history', 
      'get_current_directory',
      'change_directory',
      'list_directory',
      'write_file',
      'read_file',
      'insert_file_content',
      'delete_file_content',
      'update_file_content'
    ]
  },
  {
    id: 'task-manager',
    name: 'Task Manager',
    url: 'https://server.smithery.ai/@kazuph/mcp-taskmanager/mcp',
    apiKey: '1f2853f9-af6e-4e69-814b-5f7e8cb65058',
    enabled: true,
    capabilities: [
      'request_planning',
      'get_next_task',
      'mark_task_done',
      'approve_task_completion',
      'approve_request_completion'
    ]
  },
  {
    id: 'remote-shell',
    name: 'Remote Shell',
    url: 'https://server.smithery.ai/@samihalawa/remote-shell-terminal-mcp/mcp',
    apiKey: '1f2853f9-af6e-4e69-814b-5f7e8cb65058',
    enabled: true,
    capabilities: [
      'shell-exec'
    ]
  }
];
```

### 3. Security Layer Integration

**File:** `src/mcp-servers/mcp-security-validator.ts`

```typescript
import { SecurityUtils } from '../core/security.js';
import { logger } from '../core/logger.js';

export class MCPSecurityValidator {
  private static SENSITIVE_COMMANDS = [
    'rm -rf', 'sudo', 'su ', 'chmod +x', 'passwd', 'useradd', 'userdel',
    'curl.*|.*sh', 'wget.*|.*sh', 'nc.*-e', 'python.*-c.*exec'
  ];

  private static ALLOWED_REMOTE_COMMANDS = [
    'ls', 'pwd', 'cd', 'cat', 'echo', 'grep', 'find', 'git',
    'npm', 'node', 'tsc', 'jest', 'eslint', 'prettier'
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
        return this.validateTerminalControllerCall(toolName, args);
      case 'task-manager':
        return this.validateTaskManagerCall(toolName, args);
      case 'remote-shell':
        return this.validateRemoteShellCall(toolName, args);
      default:
        logger.warn(`Unknown MCP server: ${serverId}`);
        return false;
    }
  }

  private static validateTerminalControllerCall(toolName: string, args: any): boolean {
    switch (toolName) {
      case 'execute_command':
        return this.validateCommand(args.command);
      case 'write_file':
      case 'read_file':
        return this.validateFilePath(args.path || args.file_path);
      case 'change_directory':
        return this.validateDirectoryPath(args.path);
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
    const isAllowed = this.ALLOWED_REMOTE_COMMANDS.some(allowed => 
      baseCommand === allowed || baseCommand.startsWith(allowed)
    );

    if (!isAllowed) {
      logger.warn(`Remote command not in allowed list: ${baseCommand}`);
      return false;
    }

    return true;
  }

  private static validateFilePath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    // Use existing security validation
    return SecurityUtils.isPathSafe(filePath);
  }

  private static validateDirectoryPath(dirPath: string): boolean {
    return this.validateFilePath(dirPath);
  }

  private static containsSensitiveContent(content: string): boolean {
    const sensitivePatterns = [
      /password\s*[=:]\s*['"]/i,
      /api[_-]?key\s*[=:]\s*['"]/i,
      /secret\s*[=:]\s*['"]/i,
      /token\s*[=:]\s*['"]/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }
}
```

### 4. Tool Integration Layer

**File:** `src/core/tools/mcp-tools.ts`

```typescript
import { EnhancedMCPClientManager } from '../../mcp-servers/enhanced-mcp-client-manager.js';
import { MCPSecurityValidator } from '../../mcp-servers/mcp-security-validator.js';
import { logger } from '../logger.js';

export class MCPTools {
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
```

### 5. Integration with Existing Tool System

**File:** `src/core/tools/enhanced-tool-integration.ts`

```typescript
import { ToolIntegration } from './tool-integration.js';
import { EnhancedMCPClientManager } from '../../mcp-servers/enhanced-mcp-client-manager.js';
import { MCPTools } from './mcp-tools.js';
import { MCP_SERVER_CONFIGS } from '../../mcp-servers/mcp-server-configs.js';

export class EnhancedToolIntegration extends ToolIntegration {
  private mcpManager: EnhancedMCPClientManager;
  private mcpTools: MCPTools;

  constructor(mcpManager: any) {
    super(mcpManager);
    this.mcpManager = new EnhancedMCPClientManager(MCP_SERVER_CONFIGS);
    this.mcpTools = new MCPTools(this.mcpManager);
  }

  async initialize(): Promise<void> {
    // Initialize existing tools
    super.initializeTools();
    
    // Initialize MCP servers
    await this.mcpManager.initializeServers();
    
    // Register MCP tools as LLM functions
    this.registerMCPTools();
  }

  private registerMCPTools(): void {
    // Register Terminal Controller tools
    this.availableTools.set('mcp_execute_command', {
      id: 'mcp_execute_command',
      name: 'Execute Terminal Command',
      description: 'Execute a terminal command using MCP Terminal Controller',
      execute: async (args: any) => this.mcpTools.executeCommand(args.command, args.timeout),
      schema: {
        command: { type: 'string', required: true },
        timeout: { type: 'number', required: false }
      }
    });

    this.availableTools.set('mcp_read_file', {
      id: 'mcp_read_file',
      name: 'Read File (MCP)',
      description: 'Read file contents using MCP Terminal Controller',
      execute: async (args: any) => this.mcpTools.readFile(args.filePath),
      schema: {
        filePath: { type: 'string', required: true }
      }
    });

    // Register Task Manager tools
    this.availableTools.set('mcp_plan_request', {
      id: 'mcp_plan_request',
      name: 'Plan Request Tasks',
      description: 'Plan and organize tasks for a request using MCP Task Manager',
      execute: async (args: any) => this.mcpTools.planRequest(args.request, args.tasks),
      schema: {
        request: { type: 'string', required: true },
        tasks: { type: 'array', required: false }
      }
    });

    this.availableTools.set('mcp_get_next_task', {
      id: 'mcp_get_next_task',
      name: 'Get Next Task',
      description: 'Get the next task from the task queue',
      execute: async () => this.mcpTools.getNextTask(),
      schema: {}
    });

    // Register Remote Shell tools
    this.availableTools.set('mcp_remote_execute', {
      id: 'mcp_remote_execute',
      name: 'Execute Remote Command',
      description: 'Execute command on remote system using MCP Remote Shell',
      execute: async (args: any) => this.mcpTools.executeRemoteCommand(
        args.command, 
        args.workingDir, 
        args.timeout
      ),
      schema: {
        command: { type: 'string', required: true },
        workingDir: { type: 'string', required: false },
        timeout: { type: 'number', required: false }
      }
    });
  }

  /**
   * Enhanced getLLMFunctions to include MCP tools
   */
  getLLMFunctions(): any[] {
    const baseFunctions = super.getLLMFunctions();
    const mcpFunctions = Array.from(this.availableTools.values())
      .filter(tool => tool.id.startsWith('mcp_'))
      .map(tool => ({
        type: 'function',
        function: {
          name: tool.id,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: this.convertSchemaToProperties(tool.schema),
            required: this.getRequiredFields(tool.schema)
          }
        }
      }));

    return [...baseFunctions, ...mcpFunctions];
  }

  private convertSchemaToProperties(schema: any): any {
    const properties: any = {};
    for (const [key, value] of Object.entries(schema)) {
      const field = value as any;
      properties[key] = {
        type: field.type,
        description: field.description || `${key} parameter`
      };
    }
    return properties;
  }

  private getRequiredFields(schema: any): string[] {
    return Object.entries(schema)
      .filter(([_, value]) => (value as any).required)
      .map(([key, _]) => key);
  }

  /**
   * Health check for all systems
   */
  async healthCheck(): Promise<any> {
    const baseHealth = await super.healthCheck?.() || {};
    const mcpHealth = await this.mcpTools.healthCheck();
    
    return {
      ...baseHealth,
      mcp: mcpHealth
    };
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    await this.mcpManager.disconnect();
  }
}
```

## Implementation Steps

### Step 1: Update Dependencies

Add MCP SDK to package.json:
```bash
npm install @modelcontextprotocol/sdk
```

### Step 2: Create MCP Infrastructure

1. Create `src/mcp-servers/enhanced-mcp-client-manager.ts`
2. Create `src/mcp-servers/mcp-server-configs.ts`
3. Create `src/mcp-servers/mcp-security-validator.ts`

### Step 3: Integrate with Tool System

1. Create `src/core/tools/mcp-tools.ts`
2. Create `src/core/tools/enhanced-tool-integration.ts`
3. Update `src/core/tools/tool-integration.ts` to use enhanced version

### Step 4: Update Main Client

Modify `src/core/client.ts` to use EnhancedToolIntegration:

```typescript
// In client.ts constructor
import { EnhancedToolIntegration } from './tools/enhanced-tool-integration.js';

// Replace existing tool integration
this.toolIntegration = new EnhancedToolIntegration(this.mcpManager);
await this.toolIntegration.initialize();
```

### Step 5: Configuration Updates

Update `config/default.yaml`:

```yaml
mcp:
  enabled: true
  servers:
    terminalController:
      enabled: true
      apiKey: "${MCP_API_KEY}"
    taskManager:
      enabled: true
      apiKey: "${MCP_API_KEY}"
    remoteShell:
      enabled: false  # Disabled by default for security
      apiKey: "${MCP_API_KEY}"
  
  security:
    validateCommands: true
    allowRemoteExecution: false
    requireUserApproval: true
```

### Step 6: Environment Configuration

Add to `.env`:
```
MCP_API_KEY=1f2853f9-af6e-4e69-814b-5f7e8cb65058
```

### Step 7: Testing

Create comprehensive tests:
- `tests/integration/mcp-integration.test.ts`
- `tests/unit/mcp-tools.test.ts`
- `tests/security/mcp-security.test.ts`

## Usage Examples

### Terminal Operations
```javascript
// Execute command
await mcpTools.executeCommand('npm test');

// Read file
const content = await mcpTools.readFile('package.json');

// Write file
await mcpTools.writeFile('output.txt', 'Hello World');
```

### Task Management
```javascript
// Plan a request
await mcpTools.planRequest('Implement user authentication', [
  'Create user model',
  'Implement JWT authentication',
  'Add login/logout endpoints',
  'Create tests'
]);

// Process tasks
const task = await mcpTools.getNextTask();
// ... execute task ...
await mcpTools.markTaskDone(task.id);
```

### Remote Execution
```javascript
// Execute on remote system
const result = await mcpTools.executeRemoteCommand(
  'git status',
  '/path/to/project',
  30000
);
```

## Security Considerations

1. **Input Validation:** All commands validated before execution
2. **User Consent:** Remote operations require explicit user approval
3. **Command Restrictions:** Sensitive commands blocked by default
4. **Audit Logging:** All MCP operations logged for review
5. **Rate Limiting:** Prevent abuse of external services
6. **API Key Security:** Secure storage and rotation of credentials

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check internet connectivity
   - Verify API key validity
   - Check Smithery.ai server status

2. **Tool Execution Errors**
   - Review security validation logs
   - Check command permissions
   - Verify argument formats

3. **Authentication Issues**
   - Regenerate API key
   - Check environment variables
   - Verify URL construction

### Debug Mode

Enable debug logging:
```typescript
process.env.DEBUG = 'codecrucible:mcp*';
```

## Future Enhancements

1. **Additional MCP Servers** - Integrate more specialized servers
2. **Custom MCP Server** - Build CodeCrucible-specific MCP server
3. **Advanced Task Orchestration** - Complex workflow management
4. **Multi-Environment Support** - Different environments per project
5. **Performance Optimization** - Connection pooling and caching

## Conclusion

This implementation provides CodeCrucible with professional-grade MCP integration, significantly expanding its capabilities while maintaining security and reliability. The modular architecture allows for easy addition of new MCP servers and tools in the future.