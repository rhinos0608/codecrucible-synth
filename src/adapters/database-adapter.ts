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
  results: any;
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
  private client: PostgreSQLClient;
  private analyticsService: DataAnalyticsService;

  constructor(client: PostgreSQLClient) {
    super();
    this.client = client;
    this.analyticsService = new DataAnalyticsService();

    // Forward connection events
    this.setupEventForwarding();
  }

  /**
   * Initialize the database adapter
   */
  async initialize(): Promise<void> {
    await this.client.initialize();
    this.emit('initialized');
  }

  // Voice Interaction Operations

  /**
   * Store a voice interaction with performance tracking
   */
  async storeVoiceInteraction(interaction: VoiceInteractionRecord): Promise<number> {
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
      interaction.responseTime || null,
      interaction.createdAt || new Date(),
    ];

    try {
      const result = await this.client.query(query, params);
      const id = result.rows[0].id;

      this.emit('voiceInteractionStored', { id, sessionId: interaction.sessionId });
      return id;
    } catch (error) {
      this.emit('voiceInteractionError', { error, interaction });
      throw new Error(`Failed to store voice interaction: ${error}`);
    }
  }

  /**
   * Retrieve session history with pagination
   */
  async getSessionHistory(query: SessionHistoryQuery): Promise<VoiceInteractionRecord[]> {
    const cacheKey = `session_history:${query.sessionId}:${query.limit}:${query.offset}`;
    
    // Try cache first
    const cached = await this.client.getCachedResult(cacheKey);
    if (cached) {
      this.emit('sessionHistoryCacheHit', query);
      return cached;
    }

    let sql = `
      SELECT * FROM voice_interactions 
      WHERE session_id = $1
    `;
    const params: any[] = [query.sessionId];
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
      const interactions = this.mapToVoiceInteractionRecords(result.rows);

      // Cache results for 1 minute
      await this.client.setCachedResult(cacheKey, interactions, 60);

      this.emit('sessionHistoryRetrieved', { 
        sessionId: query.sessionId, 
        count: interactions.length 
      });

      return interactions;
    } catch (error) {
      this.emit('sessionHistoryError', { error, query });
      throw new Error(`Failed to retrieve session history: ${error}`);
    }
  }

  /**
   * Get voice interaction analytics
   */
  async getVoiceAnalytics(query: AnalyticsQuery = {}): Promise<any> {
    const cacheKey = `voice_analytics:${JSON.stringify(query)}`;
    
    // Try cache first
    const cached = await this.client.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT session_id, voice_name, confidence, tokens_used, response_time, created_at
      FROM voice_interactions
      WHERE 1=1
    `;
    const params: any[] = [];
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
      
      // Use domain service to analyze the data
      const analytics = this.analyticsService.analyzeVoiceInteractions(
        result.rows.map(row => ({
          sessionId: row.session_id,
          voiceName: row.voice_name,
          confidence: row.confidence,
          tokensUsed: row.tokens_used,
          createdAt: row.created_at,
          responseTime: row.response_time,
        }))
      );

      // Cache for 5 minutes
      await this.client.setCachedResult(cacheKey, analytics, 300);

      this.emit('voiceAnalyticsGenerated', { 
        totalInteractions: analytics.totalInteractions,
        voiceCount: analytics.voicePerformance.size 
      });

      return analytics;
    } catch (error) {
      this.emit('voiceAnalyticsError', { error, query });
      throw new Error(`Failed to generate voice analytics: ${error}`);
    }
  }

  // Code Analysis Operations

  /**
   * Store code analysis result
   */
  async storeCodeAnalysis(analysis: CodeAnalysisRecord): Promise<number> {
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
      analysis.qualityScore || null,
      analysis.createdAt || new Date(),
    ];

    try {
      const result = await this.client.query(query, params);
      const id = result.rows[0].id;

      this.emit('codeAnalysisStored', { id, projectId: analysis.projectId });
      return id;
    } catch (error) {
      this.emit('codeAnalysisError', { error, analysis });
      throw new Error(`Failed to store code analysis: ${error}`);
    }
  }

  /**
   * Get code analysis analytics
   */
  async getCodeAnalysisAnalytics(query: AnalyticsQuery = {}): Promise<any> {
    const cacheKey = `code_analytics:${JSON.stringify(query)}`;
    
    const cached = await this.client.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT project_id, file_path, analysis_type, quality_score, created_at
      FROM code_analysis
      WHERE 1=1
    `;
    const params: any[] = [];
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
        result.rows.map(row => ({
          projectId: row.project_id,
          filePath: row.file_path,
          analysisType: row.analysis_type,
          qualityScore: row.quality_score,
          createdAt: row.created_at,
          results: {}, // Results not needed for analytics
        }))
      );

      await this.client.setCachedResult(cacheKey, analytics, 300);

      this.emit('codeAnalyticsGenerated', { 
        totalAnalyses: analytics.totalAnalyses,
        avgQuality: analytics.averageQualityScore 
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
  async createProject(project: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const query = `
      INSERT INTO projects (name, description, repository_url, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const now = new Date();
    const params = [
      project.name,
      project.description || null,
      project.repositoryUrl || null,
      now,
      now,
    ];

    try {
      const result = await this.client.query(query, params);
      const id = result.rows[0].id;

      // Clear project-related caches
      await this.client.clearCache('project_*');

      this.emit('projectCreated', { id, name: project.name });
      return id;
    } catch (error) {
      this.emit('projectCreationError', { error, project });
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<ProjectRecord[]> {
    const cacheKey = 'projects_all';
    
    const cached = await this.client.getCachedResult(cacheKey);
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
      const projects = this.mapToProjectRecords(result.rows);

      await this.client.setCachedResult(cacheKey, projects, 600); // 10 minutes

      return projects;
    } catch (error) {
      this.emit('projectRetrievalError', { error });
      throw new Error(`Failed to retrieve projects: ${error}`);
    }
  }

  // Bulk Operations

  /**
   * Bulk insert voice interactions
   */
  async bulkInsertVoiceInteractions(interactions: VoiceInteractionRecord[]): Promise<void> {
    if (interactions.length === 0) return;

    const query = `
      INSERT INTO voice_interactions 
      (session_id, voice_name, prompt, response, confidence, tokens_used, response_time, created_at)
      VALUES ${interactions.map((_, i) => {
        const base = i * 8 + 1;
        return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      }).join(', ')}
    `;

    const params = interactions.flatMap(interaction => [
      interaction.sessionId,
      interaction.voiceName,
      interaction.prompt,
      interaction.response,
      interaction.confidence,
      interaction.tokensUsed,
      interaction.responseTime || null,
      interaction.createdAt || new Date(),
    ]);

    try {
      await this.client.transaction(async (trx) => {
        await trx.query(query, params);
      });

      this.emit('bulkVoiceInteractionsInserted', { count: interactions.length });
    } catch (error) {
      this.emit('bulkInsertError', { error, type: 'voice_interactions', count: interactions.length });
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
      VALUES ${analyses.map((_, i) => {
        const base = i * 6 + 1;
        return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      }).join(', ')}
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
      await this.client.transaction(async (trx) => {
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
  async getComprehensiveAnalytics(query: AnalyticsQuery = {}): Promise<any> {
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
    this.client.on('initialized', (data) => this.emit('databaseInitialized', data));
    this.client.on('queryExecuted', (data) => this.emit('queryExecuted', data));
    this.client.on('queryError', (data) => this.emit('queryError', data));
    this.client.on('transactionCompleted', (data) => this.emit('transactionCompleted', data));
    this.client.on('healthCheckCompleted', (data) => this.emit('healthCheckCompleted', data));
  }

  private mapToVoiceInteractionRecords(rows: any[]): VoiceInteractionRecord[] {
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      voiceName: row.voice_name,
      prompt: row.prompt,
      response: row.response,
      confidence: row.confidence,
      tokensUsed: row.tokens_used,
      responseTime: row.response_time,
      createdAt: row.created_at,
    }));
  }

  private mapToProjectRecords(rows: any[]): ProjectRecord[] {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      repositoryUrl: row.repository_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}

// Factory function for creating configured database adapters
export function createDatabaseAdapter(client: PostgreSQLClient): DatabaseAdapter {
  return new DatabaseAdapter(client);
}