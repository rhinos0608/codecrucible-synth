import { MCPServerConfig } from './enhanced-mcp-client-manager.js';

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