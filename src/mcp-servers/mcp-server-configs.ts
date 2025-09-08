import type { MCPServerConfig } from './enhanced-mcp-client-manager.js';

export const MCP_SERVER_CONFIGS: MCPServerConfig[] = [
  {
    id: 'terminal-controller',
    name: 'Terminal Controller',
    url: 'https://server.smithery.ai/@GongRzhe/terminal-controller-mcp/mcp',
    apiKey: (process.env.MCP_TERMINAL_API_KEY ?? process.env.SMITHERY_API_KEY) ?? '',
    enabled: !!((process.env.MCP_TERMINAL_API_KEY ?? process.env.SMITHERY_API_KEY)),
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
      'update_file_content',
    ],
  },
  {
    id: 'task-manager',
    name: 'Task Manager',
    url: 'https://server.smithery.ai/@kazuph/mcp-taskmanager/mcp',
    apiKey: (process.env.MCP_TASK_MANAGER_API_KEY ?? process.env.SMITHERY_API_KEY) ?? '',
    enabled: !!((process.env.MCP_TASK_MANAGER_API_KEY ?? process.env.SMITHERY_API_KEY)),
    capabilities: [
      'request_planning',
      'get_next_task',
      'mark_task_done',
      'approve_task_completion',
      'approve_request_completion',
    ],
  },
  {
    id: 'remote-shell',
    name: 'Remote Shell',
    url: 'https://server.smithery.ai/@samihalawa/remote-shell-terminal-mcp/mcp',
    apiKey: (process.env.MCP_REMOTE_SHELL_API_KEY ?? process.env.SMITHERY_API_KEY) ?? '',
    enabled: !!((process.env.MCP_REMOTE_SHELL_API_KEY ?? process.env.SMITHERY_API_KEY)),
    capabilities: ['shell-exec'],
  },
];
