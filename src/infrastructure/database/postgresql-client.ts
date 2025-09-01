/**
 * Pure PostgreSQL Infrastructure Client
 * Handles only database connections and query execution
 *
 * Architecture Compliance:
 * - Infrastructure layer: concrete implementation only
 * - No business logic for query optimization or data processing
 * - Pure database client with connection pooling and error handling
 * - No module-level mutable state
 */

import { Pool, PoolClient, QueryResult, QueryResultRow, PoolConfig } from 'pg';
import { EventEmitter } from 'events';
import Redis from 'redis';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | object;
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
  readReplicas?: Array<{
    host: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
  }>;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  healthCheckInterval: number;
}

export interface QueryOptions {
  timeout?: number;
  readReplica?: boolean;
}

export interface TransactionContext {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface ConnectionStatus {
  master: boolean;
  replicas: boolean[];
  redis: boolean;
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  lastHealthCheck: Date;
}

export interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageLatency: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Pure PostgreSQL Database Client
 * Handles connection management and query execution only
 */
export class PostgreSQLClient extends EventEmitter {
  private config: DatabaseConnectionConfig;
  private masterPool?: Pool;
  private replicaPools: Pool[] = [];
  private redisClient?: Redis.RedisClientType;
  private healthCheckTimer?: NodeJS.Timeout;
  private metrics: QueryMetrics;

  constructor(config: DatabaseConnectionConfig) {
    super();
    this.config = config;
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Initialize database connections
   */
  async initialize(): Promise<void> {
    try {
      await this.initializeMasterConnection();
      await this.initializeReadReplicas();
      await this.initializeRedisCache();
      this.startHealthMonitoring();

      this.emit('initialized', {
        masterConnected: !!this.masterPool,
        replicaCount: this.replicaPools.length,
        redisConnected: !!this.redisClient,
      });
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Execute a query against the database
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      // Choose connection pool
      const pool = this.selectPool(options.readReplica);
      if (!pool) {
        throw new Error('No database connection available');
      }

      // Get client from pool
      const client = await pool.connect();

      try {
        // Set statement timeout if specified
        if (options.timeout) {
          await client.query(`SET statement_timeout = ${options.timeout}`);
        }

        // Execute query
        const result = await client.query<T>(sql, params);

        // Update metrics
        const latency = Date.now() - startTime;
        this.updateLatencyMetrics(latency);
        this.metrics.successfulQueries++;

        this.emit('queryExecuted', {
          sql: sql.substring(0, 100),
          paramCount: params.length,
          latency,
          rowCount: result.rowCount,
        });

        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      this.metrics.failedQueries++;
      const latency = Date.now() - startTime;

      this.emit('queryError', {
        sql: sql.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
        latency,
      });

      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    if (!this.masterPool) {
      throw new Error('Master connection not available');
    }

    const client = await this.masterPool.connect();
    let hasCommitted = false;
    let hasRolledBack = false;

    try {
      await client.query('BEGIN');

      const transactionContext: TransactionContext = {
        query: async <R extends QueryResultRow = QueryResultRow>(
          sql: string,
          params: any[] = []
        ) => {
          if (hasCommitted || hasRolledBack) {
            throw new Error('Transaction has already been committed or rolled back');
          }
          return client.query<R>(sql, params);
        },
        commit: async () => {
          if (hasCommitted || hasRolledBack) {
            throw new Error('Transaction has already been committed or rolled back');
          }
          await client.query('COMMIT');
          hasCommitted = true;
        },
        rollback: async () => {
          if (hasCommitted || hasRolledBack) {
            throw new Error('Transaction has already been committed or rolled back');
          }
          await client.query('ROLLBACK');
          hasRolledBack = true;
        },
      };

      const result = await callback(transactionContext);

      // Auto-commit if not explicitly handled
      if (!hasCommitted && !hasRolledBack) {
        await client.query('COMMIT');
        hasCommitted = true;
      }

      this.emit('transactionCompleted', { success: true });
      return result;
    } catch (error) {
      // Auto-rollback on error if not explicitly handled
      if (!hasCommitted && !hasRolledBack) {
        try {
          await client.query('ROLLBACK');
          hasRolledBack = true;
        } catch (rollbackError) {
          this.emit('rollbackError', rollbackError);
        }
      }

      this.emit('transactionCompleted', { success: false, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a batch of queries efficiently
   */
  async batchQuery(queries: Array<{ sql: string; params?: any[] }>): Promise<QueryResult[]> {
    if (!this.masterPool) {
      throw new Error('Master connection not available');
    }

    const client = await this.masterPool.connect();
    const results: QueryResult[] = [];

    try {
      for (const query of queries) {
        const result = await client.query(query.sql, query.params || []);
        results.push(result);
      }

      this.emit('batchQueryCompleted', {
        queryCount: queries.length,
        totalRows: results.reduce((sum, result) => sum + (result.rowCount || 0), 0),
      });

      return results;
    } catch (error) {
      this.emit('batchQueryError', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get cached query result from Redis
   */
  async getCachedResult(key: string): Promise<any | null> {
    if (!this.redisClient) {
      return null;
    }

    try {
      const cached = await this.redisClient.get(key);
      if (cached) {
        this.metrics.cacheHits++;
        this.emit('cacheHit', { key });
        return JSON.parse(cached as string);
      } else {
        this.metrics.cacheMisses++;
        this.emit('cacheMiss', { key });
        return null;
      }
    } catch (error) {
      this.emit('cacheError', { operation: 'get', key, error });
      return null;
    }
  }

  /**
   * Set cached query result in Redis
   */
  async setCachedResult(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      this.emit('cacheSet', { key, ttl: ttlSeconds });
    } catch (error) {
      this.emit('cacheError', { operation: 'set', key, error });
    }
  }

  /**
   * Clear cached results matching pattern
   */
  async clearCache(pattern: string): Promise<number> {
    if (!this.redisClient) {
      return 0;
    }

    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const deletedCount = await this.redisClient.del(keys);
      this.emit('cacheCleared', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      this.emit('cacheError', { operation: 'clear', pattern, error });
      return 0;
    }
  }

  /**
   * Perform health check on all connections
   */
  async healthCheck(): Promise<ConnectionStatus> {
    const status: ConnectionStatus = {
      master: false,
      replicas: [],
      redis: false,
      totalConnections: 0,
      idleConnections: 0,
      activeConnections: 0,
      lastHealthCheck: new Date(),
    };

    // Check master connection
    try {
      if (this.masterPool) {
        const client = await this.masterPool.connect();
        await client.query('SELECT 1');
        client.release();
        status.master = true;
        status.totalConnections += this.masterPool.totalCount;
        status.idleConnections += this.masterPool.idleCount;
        status.activeConnections += this.masterPool.totalCount - this.masterPool.idleCount;
      }
    } catch (error) {
      this.emit('healthCheckError', { type: 'master', error });
    }

    // Check replica connections
    for (let i = 0; i < this.replicaPools.length; i++) {
      try {
        const pool = this.replicaPools[i];
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        status.replicas.push(true);
        status.totalConnections += pool.totalCount;
        status.idleConnections += pool.idleCount;
        status.activeConnections += pool.totalCount - pool.idleCount;
      } catch (error) {
        status.replicas.push(false);
        this.emit('healthCheckError', { type: 'replica', index: i, error });
      }
    }

    // Check Redis connection
    try {
      if (this.redisClient) {
        await this.redisClient.ping();
        status.redis = true;
      }
    } catch (error) {
      this.emit('healthCheckError', { type: 'redis', error });
    }

    this.emit('healthCheckCompleted', status);
    return status;
  }

  /**
   * Get current query metrics
   */
  getMetrics(): QueryMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset query metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.emit('metricsReset');
  }

  /**
   * Get connection configuration
   */
  getConfig(): DatabaseConnectionConfig {
    return { ...this.config };
  }

  /**
   * Close all connections and cleanup resources
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    const closePromises = [];

    if (this.masterPool) {
      closePromises.push(this.masterPool.end());
    }

    for (const pool of this.replicaPools) {
      closePromises.push(pool.end());
    }

    if (this.redisClient) {
      closePromises.push(this.redisClient.disconnect());
    }

    await Promise.all(closePromises);
    this.emit('closed');
  }

  // Private helper methods

  private async initializeMasterConnection(): Promise<void> {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      min: this.config.pool.min,
      max: this.config.pool.max,
      idleTimeoutMillis: this.config.pool.idleTimeoutMillis,
    };

    this.masterPool = new Pool(poolConfig);

    // Test the connection
    const client = await this.masterPool.connect();
    try {
      await client.query('SELECT NOW()');
    } finally {
      client.release();
    }

    this.emit('masterConnected', {
      host: this.config.host,
      database: this.config.database,
    });
  }

  private async initializeReadReplicas(): Promise<void> {
    if (!this.config.readReplicas) return;

    for (const replica of this.config.readReplicas) {
      try {
        const poolConfig: PoolConfig = {
          host: replica.host,
          port: replica.port || this.config.port,
          database: replica.database,
          user: replica.username || this.config.username,
          password: replica.password || this.config.password,
          ssl: this.config.ssl,
          ...this.config.pool,
        };

        const replicaPool = new Pool(poolConfig);

        // Test the connection
        const client = await replicaPool.connect();
        try {
          await client.query('SELECT 1');
        } finally {
          client.release();
        }

        this.replicaPools.push(replicaPool);
        this.emit('replicaConnected', { host: replica.host });
      } catch (error) {
        this.emit('replicaConnectionError', { host: replica.host, error });
      }
    }
  }

  private async initializeRedisCache(): Promise<void> {
    if (!this.config.redis) return;

    try {
      this.redisClient = Redis.createClient({
        socket: {
          host: this.config.redis.host,
          port: this.config.redis.port,
        },
        password: this.config.redis.password,
        database: this.config.redis.db,
      });

      await this.redisClient.connect();
      await this.redisClient.ping();

      this.emit('redisConnected', {
        host: this.config.redis.host,
        database: this.config.redis.db,
      });
    } catch (error) {
      this.redisClient = undefined;
      this.emit('redisConnectionError', error);
    }
  }

  private selectPool(useReadReplica: boolean = false): Pool | undefined {
    if (useReadReplica && this.replicaPools.length > 0) {
      // Simple round-robin selection for read replicas
      const randomIndex = Math.floor(Math.random() * this.replicaPools.length);
      return this.replicaPools[randomIndex];
    }
    return this.masterPool;
  }

  private updateLatencyMetrics(latency: number): void {
    const totalQueries = this.metrics.totalQueries;
    const currentAverage = this.metrics.averageLatency;

    // Calculate new running average
    this.metrics.averageLatency = (currentAverage * (totalQueries - 1) + latency) / totalQueries;
  }

  private startHealthMonitoring(): void {
    if (this.config.healthCheckInterval <= 0) return;

    this.healthCheckTimer = setInterval(async () => {
      await this.healthCheck();
    }, this.config.healthCheckInterval);
  }
}

// Factory function for creating configured PostgreSQL clients
export function createPostgreSQLClient(config: DatabaseConnectionConfig): PostgreSQLClient {
  return new PostgreSQLClient(config);
}
