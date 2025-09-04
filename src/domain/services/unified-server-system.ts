/**
 * Unified Server System
 *
 * Consolidates server mode duplicates:
 * - /src/server/server-mode.ts (Express/HTTP server)
 * - /src/application/server/server-mode.ts (EventEmitter-based server)
 * - Various MCP server managers and implementations
 *
 * Provides a comprehensive server system with HTTP, WebSocket, MCP, and event-driven capabilities.
 * Uses Strategy Pattern for different server types and Adapter Pattern for protocol translation.
 */

import { EventEmitter } from 'events';
import * as express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { IEventBus } from '../interfaces/event-bus.js';
import { IUserInteraction } from '../interfaces/user-interaction.js';
import {
  UnifiedConfiguration,
  ServerRequest,
  ServerResponse,
  SecurityValidationContext,
} from '../types/unified-types.js';
import { UnifiedSecurityValidator } from './unified-security-validator.js';
import { UnifiedPerformanceSystem } from './unified-performance-system.js';
import { ILogger } from '../interfaces/logger.js';

// Server Interfaces
export interface IServerStrategy {
  name: string;
  type: ServerType;
  start(config: ServerConfiguration): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getStatus(): ServerStatus;
  handleRequest(request: ServerRequest): Promise<ServerResponse>;

  // EventEmitter capabilities
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  removeListener(event: string, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string): this;
}

export interface ServerConfiguration {
  port: number;
  host?: string;
  cors?: {
    enabled: boolean;
    origins?: string[];
    credentials?: boolean;
  };
  authentication?: {
    enabled: boolean;
    strategy: 'jwt' | 'bearer' | 'api-key' | 'oauth';
    tokens?: string[];
    secret?: string;
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
  };
  ssl?: {
    enabled: boolean;
    keyPath?: string;
    certPath?: string;
  };
  websocket?: {
    enabled: boolean;
    path?: string;
  };
  mcp?: {
    enabled: boolean;
    discoveryPath?: string;
    toolsPath?: string;
  };
  maxConnections?: number;
  timeout?: number;
  bodyLimit?: string;
  compression?: boolean;
  logging?: boolean;
}

export interface ServerStatus {
  running: boolean;
  type: ServerType;
  port?: number;
  host?: string;
  uptime?: number;
  connections: number;
  requestsProcessed: number;
  errors: number;
  lastError?: string;
  performance: {
    avgResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface ServerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  peakResponseTime: number;
  currentConnections: number;
  totalConnections: number;
  bytesTransferred: number;
  uptime: number;
  errorRate: number;
}

export interface WebSocketConnection {
  id: string;
  socket: Socket;
  authenticated: boolean;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export interface MCPServerInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'error';
  endpoint?: string;
  lastPing?: Date;
}

export type ServerType = 'http' | 'websocket' | 'mcp' | 'hybrid';

// HTTP Server Strategy
export class HTTPServerStrategy extends EventEmitter implements IServerStrategy {
  public readonly name = 'HTTP Server';
  public readonly type: ServerType = 'http';

  private app: Express;
  private server?: HTTPServer;
  private config?: ServerConfiguration;
  private status: ServerStatus;
  private startTime?: Date;
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private connections: Set<string> = new Set();

  constructor(
    private _eventBus: IEventBus,
    private _securityValidator: UnifiedSecurityValidator,
    private _performanceSystem: UnifiedPerformanceSystem,
    private logger: ILogger
  ) {
    super();

    this.app = express.default();
    this.status = {
      running: false,
      type: 'http',
      connections: 0,
      requestsProcessed: 0,
      errors: 0,
      performance: {
        avgResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
    };

    this.setupMiddleware();
    this.setupRoutes();
  }

  async start(config: ServerConfiguration): Promise<void> {
    this.config = config;

    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);

        this.server.listen(config.port, config.host || '0.0.0.0', () => {
          this.status.running = true;
          this.status.port = config.port;
          this.status.host = config.host || '0.0.0.0';
          this.startTime = new Date();

          this.logger.info(`HTTP Server started on ${this.status.host}:${this.status.port}`);
          this.emit('server-started', { type: 'http', port: config.port });
          resolve();
        });

        this.server.on('error', error => {
          this.status.running = false;
          this.errorCount++;
          this.status.lastError = error.message;
          this.emit('server-error', error);
          reject(error);
        });

        this.server.on('connection', socket => {
          const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          this.connections.add(connectionId);
          this.status.connections = this.connections.size;

          socket.on('close', () => {
            this.connections.delete(connectionId);
            this.status.connections = this.connections.size;
          });
        });
      } catch (error) {
        this.status.running = false;
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          this.status.running = false;
          this.logger.info('HTTP Server stopped');
          this.emit('server-stopped', { type: 'http' });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  isRunning(): boolean {
    return this.status.running;
  }

  getStatus(): ServerStatus {
    if (this.startTime) {
      this.status.uptime = Date.now() - this.startTime.getTime();
    }

    this.status.performance.avgResponseTime =
      this.requestCount > 0 ? this.responseTimeSum / this.requestCount : 0;

    // Get memory usage
    const memUsage = process.memoryUsage();
    this.status.performance.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

    return { ...this.status };
  }

  async handleRequest(request: ServerRequest): Promise<ServerResponse> {
    const startTime = Date.now();

    try {
      // Validate request
      await this._securityValidator.validateInput(JSON.stringify(request), {
        userId: 'system',
        sessionId: `server-${Date.now()}`,
        requestId: request.id,
        userAgent: 'CodeCrucible-Server',
        ipAddress: '127.0.0.1',
        timestamp: new Date(),
        operationType: 'server-request',
      } as SecurityValidationContext);

      // Process request (simplified - would route to appropriate handlers)
      const response: ServerResponse = {
        id: request.id,
        requestId: request.id,
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { message: 'Request processed successfully', requestId: request.id },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };

      // Update metrics
      this.requestCount++;
      this.responseTimeSum += response.executionTime;
      this.status.requestsProcessed = this.requestCount;

      return response;
    } catch (error) {
      this.errorCount++;
      this.status.errors = this.errorCount;

      return {
        id: request.id,
        requestId: request.id,
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Internal server error', requestId: request.id },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private setupMiddleware(): void {
    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.responseTimeSum += responseTime;
        this.requestCount++;
        this.status.requestsProcessed = this.requestCount;

        if (this.config?.logging) {
          this.logger.info(`${req.method} ${req.path} - ${res.statusCode} (${responseTime}ms)`);
        }
      });

      next();
    });

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Security headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    // Error handling
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.errorCount++;
      this.status.errors = this.errorCount;
      this.status.lastError = error.message;

      this.logger.error('Server error:', error);

      if (res.headersSent) {
        return next(error);
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: this.status.uptime,
        version: '1.0.0',
      });
    });

    // Status endpoint
    this.app.get('/status', (req: Request, res: Response) => {
      res.json(this.getStatus());
    });

    // Metrics endpoint
    this.app.get('/metrics', (req: Request, res: Response) => {
      const metrics: ServerMetrics = {
        totalRequests: this.requestCount,
        successfulRequests: this.requestCount - this.errorCount,
        failedRequests: this.errorCount,
        averageResponseTime: this.requestCount > 0 ? this.responseTimeSum / this.requestCount : 0,
        peakResponseTime: 0, // Would need to track this
        currentConnections: this.connections.size,
        totalConnections: this.requestCount,
        bytesTransferred: 0, // Would need to track this
        uptime: this.status.uptime || 0,
        errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      };

      res.json(metrics);
    });

    // API routes
    this.app.post('/api/analyze', async (req: Request, res: Response) => {
      try {
        const { input, type } = req.body;

        // Validate input
        await this._securityValidator.validateInput(input, {
          userId: req.user?.id || 'anonymous',
          sessionId: req.session?.id || `session-${Date.now()}`,
          requestId: (req.headers['x-request-id'] as string) || Date.now().toString(),
          userAgent: req.headers['user-agent'] || 'unknown',
          ipAddress: req.ip || '127.0.0.1',
          timestamp: new Date(),
          operationType: 'api-analyze',
        } as SecurityValidationContext);

        // Process via event bus
        this._eventBus.emit('api:analyze', { input, type, requestId: req.headers['x-request-id'] });

        res.json({
          message: 'Analysis request received',
          requestId: req.headers['x-request-id'],
        });
      } catch (error) {
        res.status(400).json({
          error: 'Invalid request',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    this.app.post('/api/generate', async (req: Request, res: Response) => {
      try {
        const { prompt, options } = req.body;

        // Validate input
        await this._securityValidator.validateInput(prompt, {
          userId: req.user?.id || 'anonymous',
          sessionId: req.session?.id || `session-${Date.now()}`,
          requestId: (req.headers['x-request-id'] as string) || Date.now().toString(),
          userAgent: req.headers['user-agent'] || 'unknown',
          ipAddress: req.ip || '127.0.0.1',
          timestamp: new Date(),
          operationType: 'api-generate',
        } as SecurityValidationContext);

        // Process via event bus
        this._eventBus.emit('api:generate', {
          prompt,
          options,
          requestId: req.headers['x-request-id'],
        });

        res.json({
          message: 'Generation request received',
          requestId: req.headers['x-request-id'],
        });
      } catch (error) {
        res.status(400).json({
          error: 'Invalid request',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Catch-all route
    this.app.all('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
        method: req.method,
      });
    });
  }
}

// WebSocket Server Strategy
export class WebSocketServerStrategy extends EventEmitter implements IServerStrategy {
  public readonly name = 'WebSocket Server';
  public readonly type: ServerType = 'websocket';

  private io?: SocketIOServer;
  private httpServer?: HTTPServer;
  private config?: ServerConfiguration;
  private status: ServerStatus;
  private connections: Map<string, WebSocketConnection> = new Map();
  private startTime?: Date;
  private messageCount = 0;
  private errorCount = 0;

  constructor(
    private _eventBus: IEventBus,
    private _securityValidator: UnifiedSecurityValidator,
    private _performanceSystem: UnifiedPerformanceSystem,
    private logger: ILogger
  ) {
    super();

    this.status = {
      running: false,
      type: 'websocket',
      connections: 0,
      requestsProcessed: 0,
      errors: 0,
      performance: {
        avgResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
    };
  }

  async start(config: ServerConfiguration): Promise<void> {
    this.config = config;

    return new Promise((resolve, reject) => {
      try {
        this.httpServer = createServer();
        const socketOptions: any = {
          path: config.websocket?.path || '/socket.io',
        };

        if (config.cors?.enabled) {
          socketOptions.cors = {
            origin: config.cors.origins || '*',
            credentials: config.cors.credentials || false,
          };
        }

        this.io = new SocketIOServer(this.httpServer, socketOptions);

        this.setupSocketHandlers();

        this.httpServer.listen(config.port, config.host || '0.0.0.0', () => {
          this.status.running = true;
          this.status.port = config.port;
          this.status.host = config.host || '0.0.0.0';
          this.startTime = new Date();

          this.logger.info(`WebSocket Server started on ${this.status.host}:${this.status.port}`);
          this.emit('server-started', { type: 'websocket', port: config.port });
          resolve();
        });

        this.httpServer.on('error', error => {
          this.status.running = false;
          this.errorCount++;
          this.status.lastError = error.message;
          this.emit('server-error', error);
          reject(error);
        });
      } catch (error) {
        this.status.running = false;
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.io) {
        this.io.close(() => {
          if (this.httpServer) {
            this.httpServer.close(() => {
              this.status.running = false;
              this.logger.info('WebSocket Server stopped');
              this.emit('server-stopped', { type: 'websocket' });
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  isRunning(): boolean {
    return this.status.running;
  }

  getStatus(): ServerStatus {
    if (this.startTime) {
      this.status.uptime = Date.now() - this.startTime.getTime();
    }

    this.status.connections = this.connections.size;
    this.status.requestsProcessed = this.messageCount;
    this.status.errors = this.errorCount;

    // Get memory usage
    const memUsage = process.memoryUsage();
    this.status.performance.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

    return { ...this.status };
  }

  async handleRequest(request: ServerRequest): Promise<ServerResponse> {
    // WebSocket requests are handled via socket events
    return {
      id: request.id,
      requestId: request.id,
      statusCode: 200,
      headers: {},
      body: { message: 'WebSocket server handles requests via socket events' },
      executionTime: 0,
      timestamp: new Date(),
    };
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const connectionId = socket.id;

      const connection: WebSocketConnection = {
        id: connectionId,
        socket,
        authenticated: false,
        connectedAt: new Date(),
        lastActivity: new Date(),
        metadata: {},
      };

      this.connections.set(connectionId, connection);
      this.emit('client-connected', connection);

      this.logger.info(`WebSocket client connected: ${connectionId}`);

      // Authentication handler
      socket.on('authenticate', async data => {
        try {
          if (this.config?.authentication?.enabled) {
            // Validate authentication token
            const isValid = await this.validateAuthToken(data.token);
            if (isValid) {
              connection.authenticated = true;
              connection.userId = data.userId;
              socket.emit('authenticated', { success: true });
            } else {
              socket.emit('authenticated', { success: false, error: 'Invalid token' });
              socket.disconnect();
            }
          } else {
            connection.authenticated = true;
            socket.emit('authenticated', { success: true });
          }
        } catch (error) {
          this.errorCount++;
          socket.emit('authenticated', { success: false, error: 'Authentication failed' });
          socket.disconnect();
        }
      });

      // Message handlers
      socket.on('analyze', async data => {
        await this.handleSocketMessage('analyze', data, connection);
      });

      socket.on('generate', async data => {
        await this.handleSocketMessage('generate', data, connection);
      });

      socket.on('status', () => {
        socket.emit('status', this.getStatus());
      });

      // Disconnect handler
      socket.on('disconnect', reason => {
        this.connections.delete(connectionId);
        this.emit('client-disconnected', { connectionId, reason });
        this.logger.info(`WebSocket client disconnected: ${connectionId} (${reason})`);
      });

      // Error handler
      socket.on('error', error => {
        this.errorCount++;
        this.emit('socket-error', { connectionId, error });
        this.logger.error(`WebSocket error for ${connectionId}:`, error);
      });
    });
  }

  private async handleSocketMessage(
    type: string,
    data: any,
    connection: WebSocketConnection
  ): Promise<void> {
    try {
      // Check authentication
      if (this.config?.authentication?.enabled && !connection.authenticated) {
        connection.socket.emit('error', { message: 'Authentication required' });
        return;
      }

      // Validate input
      await this._securityValidator.validateInput(JSON.stringify(data), {
        sessionId: connection.id,
        requestId: `socket-${type}-${Date.now()}`,
        userAgent: 'WebSocket-Client',
        ipAddress: '127.0.0.1',
        timestamp: new Date(),
        operationType: `socket-${type}`,
        userId: connection.id,
        environment: 'development',
        permissions: ['websocket'],
        metadata: { socketType: type },
      });

      // Update activity
      connection.lastActivity = new Date();
      this.messageCount++;

      // Process via event bus
      this._eventBus.emit(`socket:${type}`, {
        ...data,
        connectionId: connection.id,
        userId: connection.userId,
      });

      // Acknowledge receipt
      connection.socket.emit(`${type}-received`, {
        message: `${type} request received`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.errorCount++;
      connection.socket.emit('error', {
        message: 'Invalid request',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async validateAuthToken(token: string): Promise<boolean> {
    if (!this.config?.authentication?.tokens) {
      return true; // No token validation configured
    }

    return this.config.authentication.tokens.includes(token);
  }

  // Public methods for broadcasting
  broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  sendToUser(userId: string, event: string, data: any): void {
    for (const connection of this.connections.values()) {
      if (connection.userId === userId && connection.authenticated) {
        connection.socket.emit(event, data);
      }
    }
  }

  sendToConnection(connectionId: string, event: string, data: any): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.socket.emit(event, data);
    }
  }
}

// MCP Server Strategy (placeholder for MCP protocol support)
export class MCPServerStrategy extends EventEmitter implements IServerStrategy {
  public readonly name = 'MCP Server';
  public readonly type: ServerType = 'mcp';

  private status: ServerStatus;
  private mcpServers: Map<string, MCPServerInfo> = new Map();

  constructor(
    private _eventBus: IEventBus,
    private _securityValidator: UnifiedSecurityValidator,
    private _performanceSystem: UnifiedPerformanceSystem,
    private logger: ILogger
  ) {
    super();

    this.status = {
      running: false,
      type: 'mcp',
      connections: 0,
      requestsProcessed: 0,
      errors: 0,
      performance: {
        avgResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
    };
  }

  async start(config: ServerConfiguration): Promise<void> {
    // Initialize MCP servers and discovery
    this.status.running = true;
    this.emit('server-started', { type: 'mcp' });
    this.logger.info('MCP Server strategy started');
  }

  async stop(): Promise<void> {
    this.status.running = false;
    this.emit('server-stopped', { type: 'mcp' });
    this.logger.info('MCP Server strategy stopped');
  }

  isRunning(): boolean {
    return this.status.running;
  }

  getStatus(): ServerStatus {
    this.status.connections = this.mcpServers.size;
    return { ...this.status };
  }

  async handleRequest(request: ServerRequest): Promise<ServerResponse> {
    return {
      id: request.id,
      requestId: request.id,
      statusCode: 200,
      headers: {},
      body: { message: 'MCP request processed', servers: Array.from(this.mcpServers.values()) },
      executionTime: 10,
      timestamp: new Date(),
    };
  }

  registerMCPServer(serverInfo: MCPServerInfo): void {
    this.mcpServers.set(serverInfo.id, serverInfo);
    this.emit('mcp-server-registered', serverInfo);
  }

  unregisterMCPServer(serverId: string): void {
    this.mcpServers.delete(serverId);
    this.emit('mcp-server-unregistered', serverId);
  }

  getMCPServers(): MCPServerInfo[] {
    return Array.from(this.mcpServers.values());
  }
}

// Main Unified Server System
export class UnifiedServerSystem extends EventEmitter {
  private strategies: Map<ServerType, IServerStrategy> = new Map();
  private activeServers: Set<ServerType> = new Set();
  private _config: UnifiedConfiguration;
  private _eventBus: IEventBus;
  private _performanceSystem: UnifiedPerformanceSystem;

  constructor(
    private logger: ILogger,
    config: UnifiedConfiguration,
    eventBus: IEventBus,
    userInteraction: IUserInteraction,
    securityValidator: UnifiedSecurityValidator,
    performanceSystem: UnifiedPerformanceSystem
  ) {
    super();
    this._config = config;
    this.logger.info('UnifiedServerSystem initialized');
    this._eventBus = eventBus;
    this._performanceSystem = performanceSystem;

    // Initialize strategies
    this.strategies.set(
      'http',
      new HTTPServerStrategy(eventBus, securityValidator, performanceSystem, this.logger)
    );
    this.strategies.set(
      'websocket',
      new WebSocketServerStrategy(eventBus, securityValidator, performanceSystem, this.logger)
    );
    this.strategies.set(
      'mcp',
      new MCPServerStrategy(eventBus, securityValidator, performanceSystem, this.logger)
    );

    this.setupEventHandlers();
  }

  async startServer(type: ServerType | 'hybrid', config: ServerConfiguration): Promise<void> {
    if (type === 'hybrid') {
      // Start HTTP and WebSocket servers
      await this.startServer('http', { ...config, port: config.port });
      await this.startServer('websocket', { ...config, port: config.port + 1 });
      if (config.mcp?.enabled) {
        await this.startServer('mcp', config);
      }
      return;
    }

    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`Unknown server type: ${type}`);
    }

    await strategy.start(config);
    this.activeServers.add(type);

    this.emit('server-started', { type, config });
    this._performanceSystem.trackResourceUsage('server-start', 1);
  }

  async stopServer(type: ServerType): Promise<void> {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`Unknown server type: ${type}`);
    }

    await strategy.stop();
    this.activeServers.delete(type);

    this.emit('server-stopped', { type });
  }

  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.activeServers).map(async type => this.stopServer(type));
    await Promise.all(stopPromises);
  }

  getServerStatus(type: ServerType): ServerStatus | null {
    const strategy = this.strategies.get(type);
    return strategy ? strategy.getStatus() : null;
  }

  getAllServerStatus(): Record<string, ServerStatus> {
    const status: Record<string, ServerStatus> = {};

    for (const [type, strategy] of this.strategies.entries()) {
      if (this.activeServers.has(type)) {
        status[type] = strategy.getStatus();
      }
    }

    return status;
  }

  isServerRunning(type: ServerType): boolean {
    const strategy = this.strategies.get(type);
    return strategy ? strategy.isRunning() : false;
  }

  async handleRequest(type: ServerType, request: ServerRequest): Promise<ServerResponse> {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`Unknown server type: ${type}`);
    }

    return await strategy.handleRequest(request);
  }

  // WebSocket-specific methods
  broadcastToWebSocket(event: string, data: any): void {
    const wsStrategy = this.strategies.get('websocket') as WebSocketServerStrategy;
    if (wsStrategy && this.isServerRunning('websocket')) {
      wsStrategy.broadcast(event, data);
    }
  }

  sendToWebSocketUser(userId: string, event: string, data: any): void {
    const wsStrategy = this.strategies.get('websocket') as WebSocketServerStrategy;
    if (wsStrategy && this.isServerRunning('websocket')) {
      wsStrategy.sendToUser(userId, event, data);
    }
  }

  // MCP-specific methods
  getMCPServers(): MCPServerInfo[] {
    const mcpStrategy = this.strategies.get('mcp') as MCPServerStrategy;
    return mcpStrategy ? mcpStrategy.getMCPServers() : [];
  }

  registerMCPServer(serverInfo: MCPServerInfo): void {
    const mcpStrategy = this.strategies.get('mcp') as MCPServerStrategy;
    if (mcpStrategy) {
      mcpStrategy.registerMCPServer(serverInfo);
    }
  }

  private setupEventHandlers(): void {
    // Forward events from strategies
    for (const strategy of this.strategies.values()) {
      strategy.on('server-started', (data: any) => this.emit('server-started', data));
      strategy.on('server-stopped', (data: any) => this.emit('server-stopped', data));
      strategy.on('server-error', (error: any) => this.emit('server-error', error));
      strategy.on('client-connected', (client: any) => this.emit('client-connected', client));
      strategy.on('client-disconnected', (client: any) => this.emit('client-disconnected', client));
    }

    // System shutdown handler
    this._eventBus.on('system:shutdown', async () => this.stopAllServers());

    // Handle API requests via event bus
    this._eventBus.on('api:analyze', async data => {
      // Process analysis request
      this.emit('analysis-request', data);
    });

    this._eventBus.on('api:generate', async data => {
      // Process generation request
      this.emit('generation-request', data);
    });
  }

  // Statistics and monitoring
  getSystemMetrics(): {
    totalServers: number;
    activeServers: number;
    serverTypes: string[];
    totalConnections: number;
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
  } {
    const metrics = {
      totalServers: this.strategies.size,
      activeServers: this.activeServers.size,
      serverTypes: Array.from(this.activeServers),
      totalConnections: 0,
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const type of this.activeServers) {
      const status = this.getServerStatus(type);
      if (status) {
        metrics.totalConnections += status.connections;
        metrics.totalRequests += status.requestsProcessed;
        metrics.totalErrors += status.errors;

        if (status.performance.avgResponseTime > 0) {
          totalResponseTime += status.performance.avgResponseTime;
          responseTimeCount++;
        }
      }
    }

    metrics.averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    return metrics;
  }
}

// Export factory function
export function createUnifiedServerSystem(
  config: UnifiedConfiguration,
  eventBus: IEventBus,
  userInteraction: IUserInteraction,
  securityValidator: UnifiedSecurityValidator,
  performanceSystem: UnifiedPerformanceSystem,
  logger: ILogger
): UnifiedServerSystem {
  return new UnifiedServerSystem(
    logger,
    config,
    eventBus,
    userInteraction,
    securityValidator,
    performanceSystem
  );
}

// Legacy compatibility exports
export interface ServerModeInterface {
  start(config: ServerConfiguration): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getStatus(): ServerStatus;
  handleRequest(type: ServerType, request: ServerRequest): Promise<ServerResponse>;
}

export class ServerMode extends UnifiedServerSystem implements ServerModeInterface {
  async start(config: ServerConfiguration): Promise<void> {
    await this.startServer('http', config);
  }

  async stop(): Promise<void> {
    await this.stopAllServers();
  }

  isRunning(): boolean {
    return this.isServerRunning('http');
  }

  getStatus(): ServerStatus {
    return (
      this.getServerStatus('http') || {
        running: false,
        type: 'http',
        connections: 0,
        requestsProcessed: 0,
        errors: 0,
        performance: { avgResponseTime: 0, memoryUsage: 0, cpuUsage: 0 },
      }
    );
  }

  override async handleRequest(type: ServerType, request: ServerRequest): Promise<ServerResponse> {
    return await super.handleRequest(type, request);
  }
}
