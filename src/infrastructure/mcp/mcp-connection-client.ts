/**
 * Pure MCP Connection Infrastructure Client
 * Handles only MCP protocol communication and connection management
 * 
 * Architecture Compliance:
 * - Infrastructure layer: concrete implementation only
 * - No business logic for service discovery or server selection
 * - Pure MCP protocol client with connection pooling and error handling
 * - No module-level mutable state
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';

export interface MCPConnectionConfig {
  serverCommand: string;
  serverArgs: string[];
  environment?: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
  heartbeatIntervalMs: number;
  maxMessageSize: number;
  connectionTimeout: number;
}

export interface MCPServerInfo {
  name: string;
  command: string;
  args: string[];
  version?: string;
  capabilities?: string[];
  status: MCPServerStatus;
  pid?: number;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export enum MCPServerStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
}

export interface MCPConnectionStatus {
  status: MCPServerStatus;
  connected: boolean;
  lastMessage: Date;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  uptime: number;
}

/**
 * Pure MCP Connection Client
 * Handles MCP protocol communication only
 */
export class MCPConnectionClient extends EventEmitter {
  private config: MCPConnectionConfig;
  private serverProcess?: ChildProcess;
  private serverInfo: MCPServerInfo;
  private connectionStatus: MCPConnectionStatus;
  private messageId: number = 1;
  private pendingRequests: Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(serverInfo: MCPServerInfo, config: MCPConnectionConfig) {
    super();
    this.serverInfo = serverInfo;
    this.config = config;
    this.connectionStatus = {
      status: MCPServerStatus.DISCONNECTED,
      connected: false,
      lastMessage: new Date(),
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      uptime: 0,
    };
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.connectionStatus.status === MCPServerStatus.CONNECTED) {
      return;
    }

    this.connectionStatus.status = MCPServerStatus.CONNECTING;
    this.emit('connecting', { server: this.serverInfo.name });

    try {
      // Start server process
      await this.startServerProcess();
      
      // Initialize connection with handshake
      await this.performHandshake();
      
      // Start heartbeat monitoring
      this.startHeartbeat();
      
      this.connectionStatus.status = MCPServerStatus.CONNECTED;
      this.connectionStatus.connected = true;
      this.connectionStatus.uptime = Date.now();
      
      this.emit('connected', {
        server: this.serverInfo.name,
        capabilities: this.serverInfo.capabilities,
      });
    } catch (error) {
      this.connectionStatus.status = MCPServerStatus.ERROR;
      this.connectionStatus.errors++;
      
      this.emit('connectionError', {
        server: this.serverInfo.name,
        error,
      });
      
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    this.connectionStatus.status = MCPServerStatus.SHUTTING_DOWN;
    
    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    // Reject pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    
    // Close server process
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = undefined;
    }
    
    this.connectionStatus.status = MCPServerStatus.DISCONNECTED;
    this.connectionStatus.connected = false;
    
    this.emit('disconnected', { server: this.serverInfo.name });
  }

  /**
   * Send MCP request and wait for response
   */
  async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('MCP server not connected');
    }

    const id = this.generateMessageId();
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for method: ${method}`));
      }, this.config.timeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send message
      this.sendMessage(message);
    });
  }

  /**
   * Send MCP notification (no response expected)
   */
  async sendNotification(method: string, params?: any): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('MCP server not connected');
    }

    const message: MCPMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.sendMessage(message);
  }

  // MCP Protocol Methods

  /**
   * Initialize MCP connection
   */
  async initialize(clientInfo: { name: string; version: string }): Promise<any> {
    return this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
      },
      clientInfo,
    });
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest('tools/list');
    return response.tools || [];
  }

  /**
   * Call a tool
   */
  async callTool(name: string, arguments_: any): Promise<any> {
    return this.sendRequest('tools/call', {
      name,
      arguments: arguments_,
    });
  }

  /**
   * List available resources
   */
  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest('resources/list');
    return response.resources || [];
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<any> {
    return this.sendRequest('resources/read', { uri });
  }

  /**
   * List available prompts
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const response = await this.sendRequest('prompts/list');
    return response.prompts || [];
  }

  /**
   * Get a prompt
   */
  async getPrompt(name: string, arguments_?: any): Promise<any> {
    return this.sendRequest('prompts/get', {
      name,
      arguments: arguments_,
    });
  }

  /**
   * Set logging level
   */
  async setLoggingLevel(level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'): Promise<void> {
    await this.sendRequest('logging/setLevel', { level });
  }

  // Connection Management

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.connectionStatus.status === MCPServerStatus.CONNECTED;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): MCPConnectionStatus {
    return {
      ...this.connectionStatus,
      uptime: this.connectionStatus.uptime > 0 ? Date.now() - this.connectionStatus.uptime : 0,
    };
  }

  /**
   * Get server information
   */
  getServerInfo(): MCPServerInfo {
    return { ...this.serverInfo };
  }

  /**
   * Get connection configuration
   */
  getConfig(): MCPConnectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MCPConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  // Private helper methods

  private async startServerProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ...this.config.environment,
      };

      this.serverProcess = spawn(this.config.serverCommand, this.config.serverArgs, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.serverProcess.stdout || !this.serverProcess.stdin) {
        reject(new Error('Failed to create server process streams'));
        return;
      }

      this.serverInfo.pid = this.serverProcess.pid;

      // Handle process events
      this.serverProcess.on('error', (error) => {
        this.handleProcessError(error);
        reject(error);
      });

      this.serverProcess.on('exit', (code, signal) => {
        this.handleProcessExit(code, signal);
      });

      // Set up message handling
      this.setupMessageHandling();

      // Wait for process to be ready
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          resolve();
        } else {
          reject(new Error('Server process failed to start'));
        }
      }, 1000);
    });
  }

  private setupMessageHandling(): void {
    if (!this.serverProcess?.stdout) return;

    let buffer = '';

    this.serverProcess.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();
      
      // Process complete JSON-RPC messages
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        
        if (line.trim()) {
          this.handleIncomingMessage(line.trim());
        }
      }
    });

    this.serverProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      this.emit('serverLog', {
        level: 'error',
        message,
        server: this.serverInfo.name,
      });
    });
  }

  private handleIncomingMessage(messageStr: string): void {
    try {
      const message: MCPMessage = JSON.parse(messageStr);
      this.connectionStatus.messagesReceived++;
      this.connectionStatus.lastMessage = new Date();

      if (message.id !== undefined) {
        // Response to a request
        const pendingRequest = this.pendingRequests.get(message.id);
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          this.pendingRequests.delete(message.id);

          if (message.error) {
            pendingRequest.reject(new Error(`MCP Error: ${message.error.message}`));
          } else {
            pendingRequest.resolve(message.result);
          }
        }
      } else if (message.method) {
        // Notification or request from server
        this.emit('notification', {
          method: message.method,
          params: message.params,
          server: this.serverInfo.name,
        });
      }

      this.emit('messageReceived', {
        message,
        server: this.serverInfo.name,
      });
    } catch (error) {
      this.emit('messageParseError', {
        error,
        messageStr,
        server: this.serverInfo.name,
      });
    }
  }

  private sendMessage(message: MCPMessage): void {
    if (!this.serverProcess?.stdin) {
      throw new Error('Server process not available');
    }

    const messageStr = JSON.stringify(message) + '\n';
    
    if (Buffer.byteLength(messageStr) > this.config.maxMessageSize) {
      throw new Error(`Message too large: ${Buffer.byteLength(messageStr)} bytes`);
    }

    this.serverProcess.stdin.write(messageStr);
    this.connectionStatus.messagesSent++;

    this.emit('messageSent', {
      message,
      server: this.serverInfo.name,
    });
  }

  private async performHandshake(): Promise<void> {
    try {
      const initResult = await this.initialize({
        name: 'CodeCrucible',
        version: '1.0.0',
      });

      // Extract server capabilities
      this.serverInfo.capabilities = initResult.capabilities ? Object.keys(initResult.capabilities) : [];
      this.serverInfo.version = initResult.serverInfo?.version;

      // Send initialized notification
      await this.sendNotification('notifications/initialized');
    } catch (error) {
      throw new Error(`Handshake failed: ${error}`);
    }
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatIntervalMs <= 0) return;

    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.sendRequest('ping');
      } catch (error) {
        this.emit('heartbeatFailed', {
          server: this.serverInfo.name,
          error,
        });
      }
    }, this.config.heartbeatIntervalMs);
  }

  private handleProcessError(error: Error): void {
    this.connectionStatus.status = MCPServerStatus.ERROR;
    this.connectionStatus.errors++;
    
    this.emit('processError', {
      server: this.serverInfo.name,
      error,
    });

    // Schedule reconnection attempt
    this.scheduleReconnect();
  }

  private handleProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.connectionStatus.status = MCPServerStatus.DISCONNECTED;
    this.connectionStatus.connected = false;
    
    this.emit('processExit', {
      server: this.serverInfo.name,
      code,
      signal,
    });

    // Schedule reconnection attempt if not intentionally shut down
    if (code !== 0 && !signal) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      try {
        await this.connect();
      } catch (error) {
        this.emit('reconnectFailed', {
          server: this.serverInfo.name,
          error,
        });
      }
    }, this.config.retryDelayMs);
  }

  private generateMessageId(): number {
    return this.messageId++;
  }
}

// Factory function for creating configured MCP clients
export function createMCPConnectionClient(
  serverInfo: MCPServerInfo,
  config: Partial<MCPConnectionConfig> = {}
): MCPConnectionClient {
  const defaultConfig: MCPConnectionConfig = {
    serverCommand: serverInfo.command,
    serverArgs: serverInfo.args,
    timeout: 30000,
    retryAttempts: 3,
    retryDelayMs: 5000,
    heartbeatIntervalMs: 30000,
    maxMessageSize: 10 * 1024 * 1024, // 10MB
    connectionTimeout: 10000,
  };

  return new MCPConnectionClient(serverInfo, { ...defaultConfig, ...config });
}