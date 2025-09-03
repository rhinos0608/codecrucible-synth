/**
 * Production Database Manager with PostgreSQL, Connection Pooling, and Migrations
 * Replaces the SQLite-based DatabaseManager with enterprise-grade database support
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import knex, { Knex } from 'knex';
import Redis from 'redis';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../infrastructure/logging/logger.js';
import { performance } from 'perf_hooks';

export interface ProductionDatabaseConfig {
  type: 'postgresql' | 'mysql' | 'sqlite';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean | object;
  pool?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  readReplicas?: Array<{
    host: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
  }>;
  migrations?: {
    directory: string;
    tableName: string;
    schemaName?: string;
  };
}

export interface DatabaseTransaction {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface QueryOptions {
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
  readReplica?: boolean;
}

export class ProductionDatabaseManager {
  private config: ProductionDatabaseConfig;
  private masterPool?: Pool;
  private replicaPools: Pool[] = [];
  private knexInstance?: Knex;
  private redisClient?: Redis.RedisClientType;
  private queryMetrics: Map<string, { count: number; totalTime: number }> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: ProductionDatabaseConfig) {
    this.config = {
      pool: {
        min: 2,
        max: 20,
        idleTimeoutMillis: 60000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      },
      migrations: {
        directory: './migrations',
        tableName: 'knex_migrations',
      },
      ...config,
    };
  }

  /**
   * Initialize database connections
   */
  async initialize(): Promise<void> {
    try {
      await this.initializePrimaryConnection();
      await this.initializeReadReplicas();
      await this.initializeRedisCache();
      await this.runMigrations();
      this.startHealthChecks();

      logger.info('Production database manager initialized', {
        type: this.config.type,
        replicas: this.replicaPools.length,
        poolMax: this.config.pool?.max,
        redis: !!this.redisClient,
      });
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Initialize primary database connection
   */
  private async initializePrimaryConnection(): Promise<void> {
    if (this.config.type === 'postgresql') {
      this.masterPool = new Pool({
        host: this.config.host || 'localhost',
        port: this.config.port || 5432,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        min: this.config.pool?.min || 2,
        max: this.config.pool?.max || 20,
        idleTimeoutMillis: this.config.pool?.idleTimeoutMillis || 60000,
      });

      // Test connection
      const client = await this.masterPool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      logger.info('PostgreSQL primary connection established', {
        serverTime: result.rows[0].now,
      });
    }

    // Initialize Knex for query building and migrations
    this.knexInstance = knex({
      client: this.config.type === 'postgresql' ? 'pg' : 'mysql2',
      connection: {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
      },
      pool: this.config.pool,
      migrations: this.config.migrations,
      acquireConnectionTimeout: this.config.pool?.idleTimeoutMillis || 60000,
    });
  }

  /**
   * Initialize read replica connections
   */
  private async initializeReadReplicas(): Promise<void> {
    if (!this.config.readReplicas) return;

    for (const replica of this.config.readReplicas) {
      try {
        const replicaPool = new Pool({
          host: replica.host,
          port: replica.port || this.config.port || 5432,
          database: replica.database,
          user: replica.username || this.config.username,
          password: replica.password || this.config.password,
          ssl: this.config.ssl,
          ...this.config.pool,
        });

        // Test replica connection
        const client = await replicaPool.connect();
        await client.query('SELECT 1');
        client.release();

        this.replicaPools.push(replicaPool);
        logger.info(`Read replica connected: ${replica.host}`);
      } catch (error) {
        logger.error(`Failed to connect to read replica ${replica.host}:`, error);
      }
    }
  }

  /**
   * Initialize Redis cache
   */
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

      logger.info('Redis cache connected');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      this.redisClient = undefined;
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.knexInstance) return;

    try {
      const [batchNo, migrations] = await this.knexInstance.migrate.latest();
      if (migrations.length > 0) {
        logger.info(`Ran ${migrations.length} migrations in batch ${batchNo}`, {
          migrations: migrations,
        });
      } else {
        logger.info('Database is up to date');
      }
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Execute query with performance tracking and caching
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();
    const queryId = this.generateQueryId(sql);

    try {
      // Check cache first
      if (options.cache && this.redisClient) {
        const cached = await this.getCachedResult(queryId, params);
        if (cached) {
          this.trackQueryMetrics(queryId, performance.now() - startTime, true);
          return cached;
        }
      }

      // Choose connection pool
      const pool =
        options.readReplica && this.replicaPools.length > 0
          ? this.getRandomReplica()
          : this.masterPool;

      if (!pool) {
        throw new Error('No database connection available');
      }

      // Execute query
      const client = await pool.connect();

      try {
        if (options.timeout) {
          // Set statement timeout
          await client.query(`SET statement_timeout = ${options.timeout}`);
        }

        const result = await client.query<T>(sql, params);

        // Cache result if caching is enabled
        if (options.cache && this.redisClient) {
          await this.setCachedResult(queryId, params, result, options.cacheTTL || 300);
        }

        this.trackQueryMetrics(queryId, performance.now() - startTime, false);
        return result;
      } finally {
        client.release();
      }
    } catch (error: any) {
      this.trackQueryMetrics(queryId, performance.now() - startTime, false, true);
      logger.error('Query execution failed:', {
        sql: sql.substring(0, 100),
        error: error.message,
        duration: performance.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Begin database transaction
   */
  async beginTransaction(): Promise<DatabaseTransaction> {
    if (!this.masterPool) {
      throw new Error('Master pool not initialized');
    }

    const client = await this.masterPool.connect();
    await client.query('BEGIN');

    return {
      query: async <T extends QueryResultRow = QueryResultRow>(sql: string, params: any[] = []) => {
        return client.query<T>(sql, params);
      },
      commit: async () => {
        try {
          await client.query('COMMIT');
        } finally {
          client.release();
        }
      },
      rollback: async () => {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      },
    };
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (trx: DatabaseTransaction) => Promise<T>): Promise<T> {
    const trx = await this.beginTransaction();

    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Knex query builder access
   */
  get knex(): Knex {
    if (!this.knexInstance) {
      throw new Error('Knex not initialized');
    }
    return this.knexInstance;
  }

  /**
   * Store voice interaction with optimized query
   */
  async storeVoiceInteraction(interaction: {
    sessionId: string;
    voiceName: string;
    prompt: string;
    response: string;
    confidence: number;
    tokensUsed: number;
  }): Promise<number> {
    const query = `
      INSERT INTO voice_interactions 
      (session_id, voice_name, prompt, response, confidence, tokens_used, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `;

    const result = await this.query(query, [
      interaction.sessionId,
      interaction.voiceName,
      interaction.prompt,
      interaction.response,
      interaction.confidence,
      interaction.tokensUsed,
    ]);

    return result.rows[0].id;
  }

  /**
   * Store code analysis with JSONB support
   */
  async storeCodeAnalysis(analysis: {
    projectId: number;
    filePath: string;
    analysisType: string;
    results: any;
    qualityScore?: number;
  }): Promise<number> {
    const query = `
      INSERT INTO code_analysis 
      (project_id, file_path, analysis_type, results, quality_score, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `;

    const result = await this.query(query, [
      analysis.projectId,
      analysis.filePath,
      analysis.analysisType,
      JSON.stringify(analysis.results),
      analysis.qualityScore || null,
    ]);

    return result.rows[0].id;
  }

  /**
   * Get session history with pagination
   */
  async getSessionHistory(
    sessionId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const query = `
      SELECT * FROM voice_interactions 
      WHERE session_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    const result = await this.query(query, [sessionId, limit, offset], {
      cache: true,
      cacheTTL: 60, // 1 minute cache
      readReplica: true,
    });

    return result.rows;
  }

  /**
   * Get aggregated statistics with caching
   */
  async getStats(): Promise<any> {
    const query = `
      WITH stats AS (
        SELECT 
          (SELECT COUNT(*) FROM voice_interactions) as total_interactions,
          (SELECT COUNT(*) FROM projects) as total_projects,
          (SELECT COUNT(*) FROM code_analysis) as total_analysis,
          (SELECT AVG(confidence) FROM voice_interactions) as avg_confidence,
          (SELECT COUNT(*) FROM voice_interactions WHERE created_at >= NOW() - INTERVAL '24 hours') as interactions_24h
      )
      SELECT * FROM stats
    `;

    const result = await this.query(query, [], {
      cache: true,
      cacheTTL: 300, // 5 minute cache
      readReplica: true,
    });

    return result.rows[0];
  }

  /**
   * Bulk insert with batch processing
   */
  async bulkInsert(table: string, data: any[], batchSize: number = 1000): Promise<void> {
    if (!data.length) return;

    const columns = Object.keys(data[0]);
    const batches = this.createBatches(data, batchSize);

    for (const batch of batches) {
      const placeholders = batch
        .map((_, i) => {
          const start = i * columns.length + 1;
          const end = start + columns.length - 1;
          return `(${Array.from({ length: columns.length }, (_, j) => `$${start + j}`).join(', ')})`;
        })
        .join(', ');

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${placeholders}
      `;

      const params = batch.flatMap(row => columns.map(col => row[col]));
      await this.query(query, params);
    }
  }

  /**
   * Health check for all connections
   */
  async healthCheck(): Promise<{
    master: boolean;
    replicas: boolean[];
    redis: boolean;
    metrics: any;
  }> {
    const health = {
      master: false,
      replicas: [] as boolean[],
      redis: false,
      metrics: this.getQueryMetrics(),
    };

    // Check master connection
    try {
      if (this.masterPool) {
        const client = await this.masterPool.connect();
        await client.query('SELECT 1');
        client.release();
        health.master = true;
      }
    } catch (error) {
      logger.error('Master database health check failed:', error);
    }

    // Check replica connections
    for (const pool of this.replicaPools) {
      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        health.replicas.push(true);
      } catch (error) {
        health.replicas.push(false);
        logger.error('Replica health check failed:', error);
      }
    }

    // Check Redis connection
    try {
      if (this.redisClient) {
        await this.redisClient.ping();
        health.redis = true;
      }
    } catch (error) {
      logger.error('Redis health check failed:', error);
    }

    return health;
  }

  /**
   * Get connection pool status
   */
  getPoolStatus(): any {
    return {
      master: this.masterPool
        ? {
            totalCount: this.masterPool.totalCount,
            idleCount: this.masterPool.idleCount,
            waitingCount: this.masterPool.waitingCount,
          }
        : null,
      replicas: this.replicaPools.map(pool => ({
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      })),
    };
  }

  /**
   * Private helper methods
   */
  private getRandomReplica(): Pool {
    const randomIndex = Math.floor(Math.random() * this.replicaPools.length);
    return this.replicaPools[randomIndex];
  }

  private generateQueryId(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim().substring(0, 100);
  }

  private async getCachedResult(queryId: string, params: any[]): Promise<any | null> {
    if (!this.redisClient) return null;

    try {
      const key = `query:${queryId}:${JSON.stringify(params)}`;
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached as string) : null;
    } catch (error) {
      logger.warn('Cache get failed:', error);
      return null;
    }
  }

  private async setCachedResult(
    queryId: string,
    params: any[],
    result: any,
    ttl: number
  ): Promise<void> {
    if (!this.redisClient) return;

    try {
      const key = `query:${queryId}:${JSON.stringify(params)}`;
      await this.redisClient.setEx(key, ttl, JSON.stringify(result));
    } catch (error) {
      logger.warn('Cache set failed:', error);
    }
  }

  private trackQueryMetrics(
    queryId: string,
    duration: number,
    fromCache: boolean = false,
    error: boolean = false
  ): void {
    if (!this.queryMetrics.has(queryId)) {
      this.queryMetrics.set(queryId, { count: 0, totalTime: 0 });
    }

    const metrics = this.queryMetrics.get(queryId)!;
    metrics.count++;
    if (!fromCache && !error) {
      metrics.totalTime += duration;
    }
  }

  private getQueryMetrics(): any {
    const metrics: any = {};
    for (const [queryId, stats] of this.queryMetrics.entries()) {
      metrics[queryId] = {
        count: stats.count,
        averageTime: stats.totalTime / stats.count,
        totalTime: stats.totalTime,
      };
    }
    return metrics;
  }

  private createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.healthCheck();
      if (!health.master || health.replicas.includes(false)) {
        logger.warn('Database health check detected issues', health);
      }
    }, 60000); // Check every minute
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await Promise.all([
      this.masterPool?.end(),
      ...this.replicaPools.map(async pool => pool.end()),
      this.knexInstance?.destroy(),
      this.redisClient?.disconnect(),
    ]);

    logger.info('All database connections closed');
  }

  /**
   * Check if database manager is initialized
   */
  isInitialized(): boolean {
    return this.masterPool !== null;
  }

  /**
   * Get raw database instance for migrations
   * Returns knex instance for raw SQL operations
   */
  getRawDb(): any {
    if (!this.knexInstance) {
      throw new Error('Database not initialized');
    }
    return this.knexInstance;
  }

  /**
   * Backup database (stub for backup manager)
   */
  // Overload: legacy signature accepts a single destination file path
  async backup(destFilePath: string): Promise<string>;
  async backup(options?: {
    outputDir?: string;
    format?: 'json';
    includeSchemas?: string[];
    includeTables?: string[];
    excludeTables?: string[];
    chunkSize?: number; // reserved for future streaming implementation
  }): Promise<string>;
  async backup(optionsOrPath?:
    | string
    | {
        outputDir?: string;
        format?: 'json';
        includeSchemas?: string[];
        includeTables?: string[];
        excludeTables?: string[];
        chunkSize?: number;
      }
  ): Promise<string> {
    const start = Date.now();
    if (!this.knexInstance) {
      throw new Error('Database not initialized');
    }

    const dbType = this.config.type;
    if (dbType !== 'postgresql' && dbType !== 'mysql') {
      throw new Error(`Backup not supported for database type: ${dbType}`);
    }

    // Support legacy string path overload
    if (typeof optionsOrPath === 'string') {
      const destFile = optionsOrPath as string;
      logger.info('Starting database backup (single file JSON)', { dbType, destFile });

      const tables = await this.listTablesForBackup();
      const dump: Record<string, any[]> = {};

      for (const t of tables) {
        try {
          const rows = await (async () => {
            if (dbType === 'postgresql') {
              if (t.schema) {
                return await this.knex.withSchema(t.schema).select('*').from(t.name);
              }
              return await this.knex.select('*').from(t.name);
            }
            return await this.knex.select('*').from(t.name);
          })();

          const key = t.schema ? `${t.schema}.${t.name}` : t.name;
          dump[key] = rows;
        } catch (error: any) {
          logger.warn('Failed to back up table', { table: t.name, schema: t.schema, error: error?.message });
        }
      }

      const json = JSON.stringify(
        {
          database: this.config.database,
          dbType,
          dumpedAt: new Date().toISOString(),
          tables: dump,
        },
        (_key, value) => {
          if (typeof value === 'bigint') return value.toString();
          if (Buffer.isBuffer(value)) return value.toString('base64');
          return value;
        }
      );

      // Ensure directory exists
      const dir = destFile.substring(0, destFile.lastIndexOf('/')) || process.cwd();
      await mkdir(dir, { recursive: true });
      await writeFile(destFile, json, 'utf8');

      logger.info('Database backup (single file JSON) completed', {
        path: destFile,
        durationMs: Date.now() - start,
      });
      return destFile;
    }

    const opts = optionsOrPath as {
      outputDir?: string;
      format?: 'json';
      includeSchemas?: string[];
      includeTables?: string[];
      excludeTables?: string[];
      chunkSize?: number;
    } | undefined;

    const outRoot = opts?.outputDir || 'backups';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbName = this.config.database;
    const outDir = join(outRoot, `${dbName}-${stamp}`);

    await mkdir(outDir, { recursive: true });

    logger.info('Starting database backup', { dbType, dbName, outDir });

    // Discover tables
    const tables = await this.listTablesForBackup({
      includeSchemas: opts?.includeSchemas,
      includeTables: opts?.includeTables,
      excludeTables: opts?.excludeTables,
    });

    const manifest: {
      database: string;
      dbType: string;
      startedAt: string;
      completedAt?: string;
      durationMs?: number;
      tables: Array<{ schema?: string; name: string; rows: number; file: string }>;
    } = {
      database: dbName,
      dbType,
      startedAt: new Date(start).toISOString(),
      tables: [],
    };

    // Serialize each table to JSON
    for (const t of tables) {
      try {
        const rows = await (async () => {
          if (dbType === 'postgresql') {
            if (t.schema) {
              return await this.knex.withSchema(t.schema).select('*').from(t.name);
            }
            return await this.knex.select('*').from(t.name);
          }
        
          // mysql
          return await this.knex.select('*').from(t.name);
        })();

        const filename = t.schema ? `${t.schema}.${t.name}.json` : `${t.name}.json`;
        const filePath = join(outDir, filename);

        const json = JSON.stringify(
          rows,
          (_key, value) => {
            if (typeof value === 'bigint') return value.toString();
            if (Buffer.isBuffer(value)) return value.toString('base64');
            return value;
          },
          2
        );
        await writeFile(filePath, json, 'utf8');

        manifest.tables.push({ schema: t.schema, name: t.name, rows: rows.length, file: filename });
        logger.debug('Backed up table', { table: t.name, schema: t.schema, rows: rows.length });
      } catch (error: any) {
        logger.warn('Failed to back up table', { table: t.name, schema: t.schema, error: error?.message });
      }
    }

    manifest.completedAt = new Date().toISOString();
    manifest.durationMs = Date.now() - start;
    await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    logger.info('Database backup completed', {
      outDir,
      tables: manifest.tables.length,
      durationMs: manifest.durationMs,
    });

    return outDir;
  }

  private async listTablesForBackup(options?: {
    includeSchemas?: string[];
    includeTables?: string[];
    excludeTables?: string[];
  }): Promise<Array<{ schema?: string; name: string }>> {
    const includeSchemas = options?.includeSchemas?.map(s => s.toLowerCase());
    const includeTables = options?.includeTables?.map(t => t.toLowerCase());
    const excludeTables = new Set((options?.excludeTables || []).map(t => t.toLowerCase()));

    if (!this.knexInstance) return [];

    const type = this.config.type;
    let rawTables: Array<{ table_schema?: string; table_name: string }> = [];

    if (type === 'postgresql') {
      const res = await this.knex.raw<{
        rows: Array<{ table_schema: string; table_name: string }>;
      }>(
        `select table_schema, table_name
         from information_schema.tables
         where table_type = 'BASE TABLE'
           and table_schema not in ('pg_catalog','information_schema')`
      );
      // Knex pg returns { rows }
      rawTables = (res as any).rows || [];
    } else if (type === 'mysql') {
      const res = await this.knex.raw(
        `select table_schema, table_name
           from information_schema.tables
          where table_type = 'BASE TABLE'
            and table_schema = database()`
      );
      // knex mysql2 returns [rows, fields]
      rawTables = Array.isArray(res) ? (res[0] as any[]) : ((res as any)[0] as any[]);
    }

    let tables = rawTables.map(r => ({ schema: r.table_schema, name: r.table_name }));

    if (includeSchemas && includeSchemas.length) {
      tables = tables.filter(t => (t.schema || '').toLowerCase() && includeSchemas.includes((t.schema || '').toLowerCase()));
    }
    if (includeTables && includeTables.length) {
      tables = tables.filter(t => includeTables.includes(t.name.toLowerCase()));
    }
    if (excludeTables.size) {
      tables = tables.filter(t => !excludeTables.has(t.name.toLowerCase()));
    }

    return tables;
  }
}

export default ProductionDatabaseManager;
