/**
 * Database Adapter
 * Translates between application layer and database infrastructure
 *
 * Architecture Compliance:
 * - Adapter layer: translates between application and infrastructure
 * - Imports from Application & Domain layers
 * - Provides clean interface for data operations
 * - Handles error translation and result mapping
 */

import { EventEmitter } from 'events';
import { PostgreSQLClient } from '../infrastructure/database/postgresql-client.js';
import { DataAnalyticsService } from '../domain/services/data-analytics-service.js';

// Application layer interfaces for database operations
export interface VoiceInteractionRecord {
  id?: number;
  sessionId: string;
  voiceName: string;
  prompt: string;
  response: string;
  confidence: number;
  tokensUsed: number;
  responseTime?: number;
  createdAt?: Date;
}

export interface CodeAnalysisRecord {
  id?: number;
  projectId: number;
  filePath: string;
  analysisType: string;
  results: unknown;
  qualityScore?: number;
  createdAt?: Date;
}

export interface ProjectRecord {
  id?: number;
  name: string;
  description?: string;
  repositoryUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SessionHistoryQuery {
  sessionId: string;
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
}

export interface AnalyticsQuery {
  fromDate?: Date;
  toDate?: Date;
  projectIds?: number[];
  voiceNames?: string[];
  analysisTypes?: string[];
}

export interface DatabaseHealth {
  connected: boolean;
  responseTime: number;
  activeConnections: number;
  queueSize: number;
  cacheHitRate: number;
}

/**
 * Database Operations Adapter
 * Provides clean interface for all database operations
 */
export class DatabaseAdapter extends EventEmitter {
  private readonly client: PostgreSQLClient;
  private readonly analyticsService: DataAnalyticsService;

  public constructor(client: PostgreSQLClient) {
    super();
    this.client = client;
    this.analyticsService = new DataAnalyticsService();

    // Forward connection events
    this.setupEventForwarding();
  }

  /**
   * Initialize the database adapter
   */
  public async initialize(): Promise<void> {
    await this.client.initialize();
    this.emit('initialized');
  }

  // Voice Interaction Operations

  /**
   * Store a voice interaction with performance tracking
   */
  public async storeVoiceInteraction(
    interaction: Readonly<VoiceInteractionRecord>
  ): Promise<number> {
    const query = `
      INSERT INTO voice_interactions 
      (session_id, voice_name, prompt, response, confidence, tokens_used, response_time, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const params = [
      interaction.sessionId,
      interaction.voiceName,
      interaction.prompt,
      interaction.response,
      interaction.confidence,
      interaction.tokensUsed,
      interaction.responseTime ?? null,
      interaction.createdAt ?? new Date(),
    ];

    try {
      const result = await this.client.query(query, params);
      const id: number = result.rows[0]?.id as number;

      this.emit('voiceInteractionStored', { id, sessionId: interaction.sessionId });
      return id;
    } catch (error) {
      this.emit('voiceInteractionError', { error, interaction });
      throw new Error(`Failed to store voice interaction: ${String(error)}`);
    }
  }

  /**
   * Retrieve session history with pagination
   */
  public async getSessionHistory(
    query: Readonly<SessionHistoryQuery>
  ): Promise<VoiceInteractionRecord[]> {
    const cacheKey = `session_history:${query.sessionId}:${query.limit}:${query.offset}`;

    // Try cache first
    const cached = (await this.client.getCachedResult(cacheKey)) as VoiceInteractionRecord[] | null;
    if (cached) {
      this.emit('sessionHistoryCacheHit', query);
      return cached;
    }

    let sql = `
      SELECT * FROM voice_interactions 
      WHERE session_id = $1
    `;
    const params: unknown[] = [query.sessionId];
    let paramIndex = 2;

    // Add date filters if provided
    if (query.fromDate) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(query.fromDate);
      paramIndex++;
    }

    if (query.toDate) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(query.toDate);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC`;

    if (query.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(query.limit);
      paramIndex++;
    }

    if (query.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(query.offset);
    }

    try {
      const result = await this.client.query(sql, params, { readReplica: true });
      const interactions = this.mapToVoiceInteractionRecords(
        result.rows as Array<{
          id?: number;
          session_id: string;
          voice_name: string;
          prompt: string;
          response: string;
          confidence: number;
          tokens_used: number;
          response_time?: number | null;
          created_at?: Date;
        }>
      );

      // Cache results for 1 minute
      await this.client.setCachedResult(cacheKey, interactions, 60);

      this.emit('sessionHistoryRetrieved', {
        sessionId: query.sessionId,
        count: interactions.length,
      });

      return interactions;
    } catch (error) {
      this.emit('sessionHistoryError', { error, query });
      throw new Error(`Failed to retrieve session history: ${String(error)}`);
    }
  }

  /**
   * Get voice interaction analytics
   */
  public async getVoiceAnalytics(
    query: Readonly<AnalyticsQuery> = {}
  ): Promise<ReturnType<DataAnalyticsService['analyzeVoiceInteractions']>> {
    const cacheKey = `voice_analytics:${JSON.stringify(query)}`;

    // Try cache first
    const cached = (await this.client.getCachedResult(cacheKey)) as ReturnType<
      DataAnalyticsService['analyzeVoiceInteractions']
    > | null;
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT session_id, voice_name, confidence, tokens_used, response_time, created_at
      FROM voice_interactions
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Add filters
    if (query.fromDate) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(query.fromDate);
      paramIndex++;
    }

    if (query.toDate) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(query.toDate);
      paramIndex++;
    }

    if (query.voiceNames && query.voiceNames.length > 0) {
      sql += ` AND voice_name = ANY($${paramIndex})`;
      params.push(query.voiceNames);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC`;

    try {
      const result = await this.client.query(sql, params, { readReplica: true });

      interface VoiceInteractionAnalyticsData {
        sessionId: string;
        voiceName: string;
        confidence: number;
        tokensUsed: number;
        createdAt: Date;
        responseTime?: number;
      }

      const analyticsData: Readonly<VoiceInteractionAnalyticsData>[] = result.rows.map(
        (row: Readonly<Record<string, unknown>>) => ({
          sessionId: row.session_id as string,
          voiceName: row.voice_name as string,
          confidence: row.confidence as number,
          tokensUsed: row.tokens_used as number,
          createdAt: row.created_at as Date,
          responseTime: (row.response_time as number | null) ?? undefined,
        })
      );

      const analytics = this.analyticsService.analyzeVoiceInteractions(analyticsData);

      // Cache for 5 minutes
      await this.client.setCachedResult(cacheKey, analytics, 300);

      this.emit('voiceAnalyticsGenerated', {
        totalInteractions: analytics.totalInteractions,
        voiceCount: analytics.voicePerformance.size,
      });

      return analytics;
    } catch (error) {
      this.emit('voiceAnalyticsError', { error, query });
      throw new Error(`Failed to generate voice analytics: ${String(error)}`);
    }
  }

  // Code Analysis Operations

  /**
   * Store code analysis result
   */
  public async storeCodeAnalysis(analysis: Readonly<CodeAnalysisRecord>): Promise<number> {
    const query = `
      INSERT INTO code_analysis 
      (project_id, file_path, analysis_type, results, quality_score, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const params = [
      analysis.projectId,
      analysis.filePath,
      analysis.analysisType,
      JSON.stringify(analysis.results),
      analysis.qualityScore ?? null,
      analysis.createdAt ?? new Date(),
    ];

    try {
      const result = await this.client.query(query, params);
      const id: number = result.rows[0]?.id as number;

      this.emit('codeAnalysisStored', { id, projectId: analysis.projectId });
      return id;
    } catch (error) {
      this.emit('codeAnalysisError', { error, analysis });
      throw new Error(`Failed to store code analysis: ${String(error)}`);
    }
  }

  /**
   * Get code analysis analytics
   */
  public async getCodeAnalysisAnalytics(
    query: Readonly<AnalyticsQuery> = {}
  ): Promise<ReturnType<DataAnalyticsService['analyzeCodeAnalysisResults']>> {
    const cacheKey = `code_analytics:${JSON.stringify(query)}`;

    const cached = (await this.client.getCachedResult(cacheKey)) as ReturnType<
      DataAnalyticsService['analyzeCodeAnalysisResults']
    > | null;
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT project_id, file_path, analysis_type, quality_score, created_at
      FROM code_analysis
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (query.fromDate) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(query.fromDate);
      paramIndex++;
    }

    if (query.toDate) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(query.toDate);
      paramIndex++;
    }

    if (query.projectIds && query.projectIds.length > 0) {
      sql += ` AND project_id = ANY($${paramIndex})`;
      params.push(query.projectIds);
      paramIndex++;
    }

    if (query.analysisTypes && query.analysisTypes.length > 0) {
      sql += ` AND analysis_type = ANY($${paramIndex})`;
      params.push(query.analysisTypes);
    }

    sql += ` ORDER BY created_at DESC`;

    try {
      const result = await this.client.query(sql, params, { readReplica: true });

      const analytics = this.analyticsService.analyzeCodeAnalysisResults(
        result.rows.map((row: Readonly<Record<string, unknown>>) => ({
          projectId: row.project_id as number,
          filePath: row.file_path as string,
          analysisType: row.analysis_type as string,
          qualityScore: (row.quality_score as number | null) ?? 0,
          createdAt: row.created_at as Date,
          results: {}, // Results not needed for analytics
        }))
      );

      await this.client.setCachedResult(cacheKey, analytics, 300);

      this.emit('codeAnalyticsGenerated', {
        totalAnalyses: analytics.totalAnalyses,
        avgQuality: analytics.averageQualityScore,
      });

      return analytics;
    } catch (error) {
      this.emit('codeAnalyticsError', { error, query });
      throw new Error(`Failed to generate code analytics: ${error}`);
    }
  }

  // Project Operations

  /**
   * Create a new project
   */
  public async createProject(
    project: Readonly<Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<number> {
    const query = `
      INSERT INTO projects (name, description, repository_url, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const now = new Date();
    const params = [
      project.name,
      project.description ?? null,
      project.repositoryUrl ?? null,
      now,
      now,
    ];

    try {
      const result = await this.client.query(query, params);
      const id: number = result.rows[0]?.id as number;

      // Clear project-related caches
      await this.client.clearCache('project_*');

      this.emit('projectCreated', { id, name: project.name });
      return id;
    } catch (error: unknown) {
      this.emit('projectCreationError', { error, project });
      throw new Error(`Failed to create project: ${String(error)}`);
    }
  }

  /**
   * Get all projects
   */
  public async getProjects(): Promise<ProjectRecord[]> {
    const cacheKey = 'projects_all';

    const cached = (await this.client.getCachedResult(cacheKey)) as ProjectRecord[] | null;
    if (cached) {
      return cached;
    }

    const query = `
      SELECT id, name, description, repository_url, created_at, updated_at
      FROM projects
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.client.query(query, [], { readReplica: true });
      const projects = this.mapToProjectRecords(
        result.rows as Array<{
          id?: number;
          name: string;
          description?: string | null;
          repository_url?: string | null;
          created_at?: Date;
          updated_at?: Date;
        }>
      );

      await this.client.setCachedResult(cacheKey, projects, 600); // 10 minutes

      return projects;
    } catch (error: unknown) {
      this.emit('projectRetrievalError', { error });
      throw new Error(`Failed to retrieve projects: ${String(error)}`);
    }
  }

  // Bulk Operations

  /**
   * Bulk insert voice interactions
   */
  public async bulkInsertVoiceInteractions(
    interactions: Readonly<VoiceInteractionRecord[]>
  ): Promise<void> {
    if (interactions.length === 0) return;

    const query = `
      INSERT INTO voice_interactions 
      (session_id, voice_name, prompt, response, confidence, tokens_used, response_time, created_at)
      VALUES ${interactions
        .map((_: Readonly<VoiceInteractionRecord>, i: number) => {
          const base = i * 8 + 1;
          return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        })
        .join(', ')}
    `;

    const params = interactions.flatMap((interaction: Readonly<VoiceInteractionRecord>) => [
      interaction.sessionId,
      interaction.voiceName,
      interaction.prompt,
      interaction.response,
      interaction.confidence,
      interaction.tokensUsed,
      interaction.responseTime ?? null,
      interaction.createdAt ?? new Date(),
    ]);

    try {
      await this.client.transaction(async trx => {
        await trx.query(query, params);
      });

      this.emit('bulkVoiceInteractionsInserted', { count: interactions.length });
    } catch (error) {
      this.emit('bulkInsertError', {
        error,
        type: 'voice_interactions',
        count: interactions.length,
      });
      throw new Error(`Failed to bulk insert voice interactions: ${error}`);
    }
  }

  /**
   * Bulk insert code analyses
   */
  async bulkInsertCodeAnalyses(analyses: CodeAnalysisRecord[]): Promise<void> {
    if (analyses.length === 0) return;

    const query = `
      INSERT INTO code_analysis 
      (project_id, file_path, analysis_type, results, quality_score, created_at)
      VALUES ${analyses
        .map((_, i) => {
          const base = i * 6 + 1;
          return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        })
        .join(', ')}
    `;

    const params = analyses.flatMap(analysis => [
      analysis.projectId,
      analysis.filePath,
      analysis.analysisType,
      JSON.stringify(analysis.results),
      analysis.qualityScore || null,
      analysis.createdAt || new Date(),
    ]);

    try {
      await this.client.transaction(async trx => {
        await trx.query(query, params);
      });

      this.emit('bulkCodeAnalysesInserted', { count: analyses.length });
    } catch (error) {
      this.emit('bulkInsertError', { error, type: 'code_analyses', count: analyses.length });
      throw new Error(`Failed to bulk insert code analyses: ${error}`);
    }
  }

  // System Operations

  /**
   * Get database health status
   */
  async getHealth(): Promise<DatabaseHealth> {
    const startTime = Date.now();

    try {
      const connectionStatus = await this.client.healthCheck();
      const metrics = this.client.getMetrics();
      const responseTime = Date.now() - startTime;

      const health: DatabaseHealth = {
        connected: connectionStatus.master && connectionStatus.redis,
        responseTime,
        activeConnections: connectionStatus.activeConnections,
        queueSize: 0, // Would need actual queue monitoring
        cacheHitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) || 0,
      };

      this.emit('healthChecked', health);
      return health;
    } catch (error) {
      this.emit('healthCheckError', { error });
      throw new Error(`Failed to check database health: ${error}`);
    }
  }

  /**
   * Get comprehensive analytics combining all data types
   */
  public async getComprehensiveAnalytics(query: Readonly<AnalyticsQuery> = {}): Promise<{
    voice: ReturnType<DataAnalyticsService['analyzeVoiceInteractions']>;
    code: ReturnType<DataAnalyticsService['analyzeCodeAnalysisResults']>;
    database: ReturnType<PostgreSQLClient['getMetrics']>;
    recommendations: unknown;
    generatedAt: Date;
  }> {
    const [voiceAnalytics, codeAnalytics] = await Promise.all([
      this.getVoiceAnalytics(query),
      this.getCodeAnalysisAnalytics(query),
    ]);

    // Get database performance metrics
    const dbMetrics = this.client.getMetrics();
    const dbAnalytics = this.analyticsService.analyzeDatabasePerformance([]);

    // Generate optimization recommendations
    const recommendations = this.analyticsService.generateOptimizationRecommendations(
      voiceAnalytics,
      codeAnalytics,
      dbAnalytics
    );

    return {
      voice: voiceAnalytics,
      code: codeAnalytics,
      database: dbMetrics,
      recommendations,
      generatedAt: new Date(),
    };
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.client.close();
    this.emit('closed');
  }

  // Private helper methods

  private setupEventForwarding(): void {
    this.client.on('initialized', data => this.emit('databaseInitialized', data));
    this.client.on('queryExecuted', data => this.emit('queryExecuted', data));
    this.client.on('queryError', data => this.emit('queryError', data));
    this.client.on('transactionCompleted', data => this.emit('transactionCompleted', data));
    this.client.on('healthCheckCompleted', data => this.emit('healthCheckCompleted', data));
  }

  private mapToVoiceInteractionRecords(
    rows: ReadonlyArray<{
      id?: number;
      session_id: string;
      voice_name: string;
      prompt: string;
      response: string;
      confidence: number;
      tokens_used: number;
      response_time?: number | null;
      created_at?: Date;
    }>
  ): VoiceInteractionRecord[] {
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      voiceName: row.voice_name,
      prompt: row.prompt,
      response: row.response,
      confidence: row.confidence,
      tokensUsed: row.tokens_used,
      responseTime: row.response_time ?? undefined,
      createdAt: row.created_at,
    }));
  }

  private mapToProjectRecords(
    rows: ReadonlyArray<{
      id?: number;
      name: string;
      description?: string | null;
      repository_url?: string | null;
      created_at?: Date;
      updated_at?: Date;
    }>
  ): ProjectRecord[] {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      repositoryUrl: row.repository_url ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}

// Factory function for creating configured database adapters
export function createDatabaseAdapter(client: PostgreSQLClient): DatabaseAdapter {
  return new DatabaseAdapter(client);
}
