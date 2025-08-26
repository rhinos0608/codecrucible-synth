/**
 * 2025 Provider Connection Pool - Modern AI Provider Management
 * Implements connection pooling, circuit breaker, and intelligent failover patterns
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../logger.js';
import { memoryOptimizer } from './memory-optimization-2025.js';

export interface ProviderConnection {
  id: string;
  providerId: string;
  endpoint: string;
  status: 'idle' | 'active' | 'failed' | 'reconnecting';
  created: number;
  lastUsed: number;
  requestCount: number;
  failureCount: number;
  avgResponseTime: number;
  cleanup: () => Promise<void>;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  minIdleConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export interface ProviderConfig {
  id: string;
  type: 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
  endpoint: string;
  apiKey?: string;
  model?: string;
  maxConcurrency: number;
  priority: number; // Lower = higher priority
  capabilities: string[];
}

export interface CircuitBreakerState {
  providerId: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class ProviderConnectionPool2025 extends EventEmitter {
  private config: ConnectionPoolConfig;
  private connections = new Map<string, ProviderConnection>();
  private providers = new Map<string, ProviderConfig>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private requestQueue: Array<{
    resolve: (connection: ProviderConnection) => void;
    reject: (error: Error) => void;
    providerId?: string;
    timeout: NodeJS.Timeout;
  }> = [];
  
  private healthCheckInterval?: string;
  private connectionCleanupInterval?: string;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super();
    this.setMaxListeners(50);

    this.config = {
      maxConnections: 6, // Optimized for AI providers (2 per provider type)
      minIdleConnections: 2,
      connectionTimeout: 10000, // 10 seconds
      idleTimeout: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      healthCheckInterval: 30000, // 30 seconds
      circuitBreakerThreshold: 5, // failures
      circuitBreakerTimeout: 60000, // 1 minute
      ...config,
    };

    this.initializeHealthChecking();
    this.initializeConnectionCleanup();
    
    // Register for memory optimization
    memoryOptimizer.registerEventEmitter(this, 'ProviderConnectionPool', 2);
  }

  /**
   * 2025 Pattern: Dynamic Provider Registration
   */
  registerProvider(provider: ProviderConfig): void {
    this.providers.set(provider.id, provider);
    
    // Initialize circuit breaker
    this.circuitBreakers.set(provider.id, {
      providerId: provider.id,
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    });

    logger.info(`Provider registered: ${provider.id} (${provider.type})`);
    this.emit('providerRegistered', provider);
  }

  /**
   * 2025 Pattern: Intelligent Connection Acquisition
   */
  async acquireConnection(providerId?: string, timeout: number = this.config.connectionTimeout): Promise<ProviderConnection> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.requestQueue.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
        }
        reject(new Error(`Connection acquisition timeout after ${timeout}ms`));
      }, timeout);

      const request = {
        resolve,
        reject,
        providerId,
        timeout: timeoutId,
      };

      this.requestQueue.push(request);
      this.processConnectionQueue();
    });
  }

  /**
   * 2025 Pattern: Graceful Connection Release
   */
  releaseConnection(connection: ProviderConnection): void {
    if (!this.connections.has(connection.id)) {
      logger.warn(`Attempted to release unknown connection: ${connection.id}`);
      return;
    }

    connection.status = 'idle';
    connection.lastUsed = performance.now();
    
    logger.debug(`Connection released: ${connection.id} (${connection.providerId})`);
    this.processConnectionQueue();
    this.emit('connectionReleased', connection);
  }

  /**
   * 2025 Pattern: Provider Health-Based Routing
   */
  private async processConnectionQueue(): Promise<void> {
    if (this.requestQueue.length === 0) return;

    const request = this.requestQueue[0];
    let connection: ProviderConnection | null = null;

    if (request.providerId) {
      // Specific provider requested
      connection = await this.getConnectionForProvider(request.providerId);
    } else {
      // Find best available provider
      connection = await this.getBestAvailableConnection();
    }

    if (connection) {
      const request = this.requestQueue.shift()!;
      clearTimeout(request.timeout);
      
      connection.status = 'active';
      connection.requestCount++;
      connection.lastUsed = performance.now();
      
      request.resolve(connection);
      logger.debug(`Connection acquired: ${connection.id} (${connection.providerId})`);
    }
  }

  /**
   * 2025 Pattern: Circuit Breaker Implementation
   */
  private async getConnectionForProvider(providerId: string): Promise<ProviderConnection | null> {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    const provider = this.providers.get(providerId);
    
    if (!provider || !circuitBreaker) {
      return null;
    }

    // Check circuit breaker state
    if (circuitBreaker.state === 'open') {
      if (performance.now() < circuitBreaker.nextAttemptTime) {
        logger.debug(`Circuit breaker open for ${providerId}, skipping`);
        return null;
      } else {
        // Try to transition to half-open
        circuitBreaker.state = 'half-open';
        logger.info(`Circuit breaker transitioning to half-open for ${providerId}`);
      }
    }

    // Find idle connection or create new one
    let connection = this.findIdleConnection(providerId);
    
    if (!connection && this.canCreateNewConnection(providerId)) {
      connection = await this.createConnection(provider);
    }

    return connection;
  }

  /**
   * 2025 Pattern: Intelligent Provider Selection
   */
  private async getBestAvailableConnection(): Promise<ProviderConnection | null> {
    const availableProviders = Array.from(this.providers.values())
      .filter(provider => {
        const circuitBreaker = this.circuitBreakers.get(provider.id);
        return circuitBreaker?.state !== 'open' || 
               performance.now() >= circuitBreaker.nextAttemptTime;
      })
      .sort((a, b) => {
        // Sort by priority (lower = better) and then by avg response time
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        
        const avgA = this.getAverageResponseTime(a.id);
        const avgB = this.getAverageResponseTime(b.id);
        return avgA - avgB;
      });

    for (const provider of availableProviders) {
      const connection = await this.getConnectionForProvider(provider.id);
      if (connection) {
        return connection;
      }
    }

    return null;
  }

  /**
   * 2025 Pattern: Smart Connection Creation
   */
  private async createConnection(provider: ProviderConfig): Promise<ProviderConnection | null> {
    if (this.connections.size >= this.config.maxConnections) {
      logger.debug('Max connections reached, cannot create new connection');
      return null;
    }

    const connectionId = `${provider.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const connection: ProviderConnection = {
        id: connectionId,
        providerId: provider.id,
        endpoint: provider.endpoint,
        status: 'idle',
        created: performance.now(),
        lastUsed: performance.now(),
        requestCount: 0,
        failureCount: 0,
        avgResponseTime: 0,
        cleanup: async () => {
          // Provider-specific cleanup logic would go here
          logger.debug(`Cleaning up connection: ${connectionId}`);
        },
      };

      // Simulate connection creation (replace with actual implementation)
      await this.establishProviderConnection(provider, connection);
      
      this.connections.set(connectionId, connection);
      logger.info(`Connection created: ${connectionId} (${provider.id})`);
      
      this.emit('connectionCreated', connection);
      return connection;

    } catch (error) {
      logger.error(`Failed to create connection for ${provider.id}:`, error);
      await this.handleConnectionFailure(provider.id);
      return null;
    }
  }

  /**
   * 2025 Pattern: Provider Connection Establishment
   */
  private async establishProviderConnection(
    provider: ProviderConfig, 
    connection: ProviderConnection
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Provider-specific connection logic
      switch (provider.type) {
        case 'ollama':
          await this.establishOllamaConnection(provider, connection);
          break;
        case 'lm-studio':
          await this.establishLMStudioConnection(provider, connection);
          break;
        case 'openai':
        case 'anthropic':
          await this.establishAPIConnection(provider, connection);
          break;
        default:
          throw new Error(`Unsupported provider type: ${provider.type}`);
      }
      
      const duration = performance.now() - startTime;
      this.updateConnectionMetrics(connection, duration, true);
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.updateConnectionMetrics(connection, duration, false);
      throw error;
    }
  }

  private async establishOllamaConnection(provider: ProviderConfig, connection: ProviderConnection): Promise<void> {
    // 2025 Pattern: Modern HTTP/2 Connection with Keep-Alive
    const response = await fetch(`${provider.endpoint}/api/tags`, {
      method: 'GET',
      headers: {
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=60, max=10',
      },
      signal: AbortSignal.timeout(this.config.connectionTimeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama connection failed: ${response.status} ${response.statusText}`);
    }

    logger.debug(`Ollama connection established: ${connection.id}`);
  }

  private async establishLMStudioConnection(provider: ProviderConfig, connection: ProviderConnection): Promise<void> {
    // 2025 Pattern: WebSocket for LM Studio SDK
    try {
      const response = await fetch(`${provider.endpoint}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.connectionTimeout),
      });

      if (!response.ok) {
        throw new Error(`LM Studio connection failed: ${response.status} ${response.statusText}`);
      }

      logger.debug(`LM Studio connection established: ${connection.id}`);
    } catch (error) {
      throw new Error(`LM Studio connection failed: ${error}`);
    }
  }

  private async establishAPIConnection(provider: ProviderConfig, connection: ProviderConnection): Promise<void> {
    if (!provider.apiKey) {
      throw new Error(`API key required for ${provider.type}`);
    }

    const endpoint = provider.type === 'openai' 
      ? 'https://api.openai.com/v1/models'
      : 'https://api.anthropic.com/v1/models';

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.connectionTimeout),
    });

    if (!response.ok) {
      throw new Error(`${provider.type} connection failed: ${response.status} ${response.statusText}`);
    }

    logger.debug(`${provider.type} connection established: ${connection.id}`);
  }

  /**
   * 2025 Pattern: Failure Handling and Circuit Breaker Logic
   */
  private async handleConnectionFailure(providerId: string): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (!circuitBreaker) return;

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = performance.now();

    if (circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = performance.now() + this.config.circuitBreakerTimeout;
      
      logger.warn(`Circuit breaker opened for provider ${providerId} after ${circuitBreaker.failureCount} failures`);
      this.emit('circuitBreakerOpened', providerId);
    }
  }

  private async handleConnectionSuccess(providerId: string): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (!circuitBreaker) return;

    if (circuitBreaker.state === 'half-open') {
      circuitBreaker.state = 'closed';
      circuitBreaker.failureCount = 0;
      logger.info(`Circuit breaker closed for provider ${providerId}`);
      this.emit('circuitBreakerClosed', providerId);
    }
  }

  /**
   * 2025 Pattern: Connection Lifecycle Management
   */
  private initializeHealthChecking(): void {
    this.healthCheckInterval = memoryOptimizer.registerInterval(
      () => this.performHealthChecks(),
      this.config.healthCheckInterval,
      3 // Medium priority
    );
  }

  private initializeConnectionCleanup(): void {
    this.connectionCleanupInterval = memoryOptimizer.registerInterval(
      () => this.cleanupIdleConnections(),
      this.config.idleTimeout / 2, // Check every half idle timeout
      3 // Medium priority
    );
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.connections.values()).map(async (connection) => {
      if (connection.status === 'idle') {
        try {
          await this.pingConnection(connection);
          await this.handleConnectionSuccess(connection.providerId);
        } catch (error) {
          logger.warn(`Health check failed for connection ${connection.id}:`, error);
          connection.status = 'failed';
          await this.handleConnectionFailure(connection.providerId);
        }
      }
    });

    await Promise.allSettled(healthPromises);
  }

  private async pingConnection(connection: ProviderConnection): Promise<void> {
    const provider = this.providers.get(connection.providerId);
    if (!provider) return;

    // Simple ping based on provider type
    const pingEndpoint = provider.type === 'ollama' 
      ? `${connection.endpoint}/api/tags`
      : `${connection.endpoint}/v1/models`;

    const response = await fetch(pingEndpoint, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second ping timeout
    });

    if (!response.ok) {
      throw new Error(`Ping failed: ${response.status}`);
    }
  }

  private cleanupIdleConnections(): void {
    const now = performance.now();
    const connectionsToCleanup: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      const idleTime = now - connection.lastUsed;
      
      if (connection.status === 'idle' && idleTime > this.config.idleTimeout) {
        connectionsToCleanup.push(id);
      } else if (connection.status === 'failed') {
        connectionsToCleanup.push(id);
      }
    }

    for (const id of connectionsToCleanup) {
      this.closeConnection(id);
    }

    if (connectionsToCleanup.length > 0) {
      logger.debug(`Cleaned up ${connectionsToCleanup.length} idle/failed connections`);
    }
  }

  /**
   * Utility Methods
   */
  private findIdleConnection(providerId: string): ProviderConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.providerId === providerId && connection.status === 'idle') {
        return connection;
      }
    }
    return null;
  }

  private canCreateNewConnection(providerId: string): boolean {
    const providerConnections = Array.from(this.connections.values())
      .filter(conn => conn.providerId === providerId);
    
    const provider = this.providers.get(providerId);
    if (!provider) return false;

    return providerConnections.length < provider.maxConcurrency;
  }

  private updateConnectionMetrics(connection: ProviderConnection, duration: number, success: boolean): void {
    if (success) {
      // Update average response time using exponential moving average
      if (connection.avgResponseTime === 0) {
        connection.avgResponseTime = duration;
      } else {
        connection.avgResponseTime = (connection.avgResponseTime * 0.7) + (duration * 0.3);
      }
    } else {
      connection.failureCount++;
    }
  }

  private getAverageResponseTime(providerId: string): number {
    const providerConnections = Array.from(this.connections.values())
      .filter(conn => conn.providerId === providerId);
    
    if (providerConnections.length === 0) return 0;
    
    const totalTime = providerConnections.reduce((sum, conn) => sum + conn.avgResponseTime, 0);
    return totalTime / providerConnections.length;
  }

  private async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      await connection.cleanup();
    } catch (error) {
      logger.warn(`Error during connection cleanup for ${connectionId}:`, error);
    }

    this.connections.delete(connectionId);
    this.emit('connectionClosed', connection);
  }

  /**
   * Public API
   */
  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    failedConnections: number;
    providerStats: Array<{
      providerId: string;
      connections: number;
      avgResponseTime: number;
      circuitBreakerState: string;
    }>;
  } {
    const connections = Array.from(this.connections.values());
    
    const providerStats = Array.from(this.providers.keys()).map(providerId => {
      const providerConnections = connections.filter(conn => conn.providerId === providerId);
      const circuitBreaker = this.circuitBreakers.get(providerId);
      
      return {
        providerId,
        connections: providerConnections.length,
        avgResponseTime: this.getAverageResponseTime(providerId),
        circuitBreakerState: circuitBreaker?.state || 'unknown',
      };
    });

    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(conn => conn.status === 'active').length,
      idleConnections: connections.filter(conn => conn.status === 'idle').length,
      failedConnections: connections.filter(conn => conn.status === 'failed').length,
      providerStats,
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down provider connection pool');
    
    // Clean up intervals
    if (this.healthCheckInterval) {
      memoryOptimizer.unregisterResource(this.healthCheckInterval);
    }
    if (this.connectionCleanupInterval) {
      memoryOptimizer.unregisterResource(this.connectionCleanupInterval);
    }

    // Reject pending requests
    for (const request of this.requestQueue) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection pool shutting down'));
    }
    this.requestQueue.length = 0;

    // Close all connections
    const closePromises = Array.from(this.connections.keys()).map(id => this.closeConnection(id));
    await Promise.allSettled(closePromises);
    
    this.connections.clear();
    this.circuitBreakers.clear();
    this.providers.clear();
    
    this.emit('shutdown');
  }
}