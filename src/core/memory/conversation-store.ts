import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../logger.js';
import { SynthesisResult } from '../types.js';
import { ProjectContext } from './project-memory.js';

export interface StoredInteraction {
  id: string;
  sessionId: string;
  timestamp: number;
  prompt: string;
  response: string;
  voicesUsed: string[];
  confidence: number;
  latency: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  topics: string[];
  contextHash: string;
  embedding?: number[]; // For semantic search
  metadata: Record<string, any>;
}

export interface ConversationSession {
  id: string;
  startTime: number;
  endTime?: number;
  totalInteractions: number;
  averageConfidence: number;
  topics: string[];
  workspaceRoot: string;
  userAgent?: string;
}

export interface SearchQuery {
  text?: string;
  sessionId?: string;
  timeRange?: { start: number; end: number };
  topics?: string[];
  voices?: string[];
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  interactions: StoredInteraction[];
  total: number;
  relevanceScores?: number[];
}

export interface ConversationAnalytics {
  totalInteractions: number;
  totalSessions: number;
  averageConfidence: number;
  topTopics: Array<{ topic: string; count: number }>;
  voiceUsage: Array<{ voice: string; count: number }>;
  dailyActivity: Array<{ date: string; interactions: number }>;
  averageLatency: number;
}

/**
 * Persistent conversation storage with semantic search capabilities
 * Provides SQL-based storage with embeddings for intelligent retrieval
 */
export class ConversationStore {
  private db?: Database;
  private dbPath: string;
  private initialized = false;

  constructor(workspaceRoot: string) {
    const codecrucibleDir = path.join(workspaceRoot, '.codecrucible');
    this.dbPath = path.join(codecrucibleDir, 'conversations.db');

    logger.info('Conversation store initialized', { dbPath: this.dbPath });
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

      // Open database
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      // Create tables
      await this.createTables();

      // Create indexes for performance
      await this.createIndexes();

      this.initialized = true;
      logger.info('Conversation store database initialized');
    } catch (error) {
      logger.error('Failed to initialize conversation store:', error);
      throw error;
    }
  }

  /**
   * Store interaction with optional semantic embedding
   */
  async storeInteraction(
    prompt: string,
    response: SynthesisResult,
    context: ProjectContext,
    sessionId: string,
    userFeedback?: 'positive' | 'negative' | 'neutral'
  ): Promise<string> {
    await this.ensureInitialized();

    const id = this.generateId();
    const timestamp = Date.now();
    const contextHash = this.hashContext(context);
    const topics = this.extractTopics(prompt, response.synthesis || '');

    // Generate embedding for semantic search (simplified for now)
    const embedding = await this.generateEmbedding(prompt + ' ' + response.synthesis);

    const interaction: StoredInteraction = {
      id,
      sessionId,
      timestamp,
      prompt,
      response: response.synthesis || '',
      voicesUsed: response.voicesUsed,
      confidence: response.confidence || 0,
      latency: response.latency || 0,
      userFeedback,
      topics,
      contextHash,
      embedding,
      metadata: {
        modelUsed: response.modelUsed,
        reasoning:
          typeof response.reasoning === 'object' &&
          response.reasoning &&
          'steps' in response.reasoning &&
          Array.isArray((response.reasoning as any).steps)
            ? (response.reasoning as any).steps.length
            : 0,
        promptTokens: prompt.length, // Simplified token count
        responseTokens: (response.synthesis || '').length,
      },
    };

    try {
      await this.db!.run(
        `
        INSERT INTO interactions (
          id, session_id, timestamp, prompt, response, voices_used, 
          confidence, latency, user_feedback, topics, context_hash, 
          embedding, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          interaction.id,
          interaction.sessionId,
          interaction.timestamp,
          interaction.prompt,
          interaction.response,
          JSON.stringify(interaction.voicesUsed),
          interaction.confidence,
          interaction.latency,
          interaction.userFeedback,
          JSON.stringify(interaction.topics),
          interaction.contextHash,
          JSON.stringify(interaction.embedding),
          JSON.stringify(interaction.metadata),
        ]
      );

      // Update session statistics
      await this.updateSessionStats(sessionId, interaction);

      logger.debug('Stored interaction', {
        id: interaction.id,
        sessionId: interaction.sessionId,
        topics: interaction.topics.length,
        confidence: interaction.confidence,
      });

      return id;
    } catch (error) {
      logger.error('Failed to store interaction:', error);
      throw error;
    }
  }

  /**
   * Search interactions with text and semantic similarity
   */
  async searchInteractions(query: SearchQuery): Promise<SearchResult> {
    await this.ensureInitialized();

    let sql = `
      SELECT i.*, s.workspace_root
      FROM interactions i
      LEFT JOIN sessions s ON i.session_id = s.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Add filters
    if (query.text) {
      sql += ` AND (i.prompt LIKE ? OR i.response LIKE ?)`;
      const searchPattern = `%${query.text}%`;
      params.push(searchPattern, searchPattern);
    }

    if (query.sessionId) {
      sql += ` AND i.session_id = ?`;
      params.push(query.sessionId);
    }

    if (query.timeRange) {
      sql += ` AND i.timestamp BETWEEN ? AND ?`;
      params.push(query.timeRange.start, query.timeRange.end);
    }

    if (query.topics && query.topics.length > 0) {
      sql += ` AND (${query.topics.map(() => 'i.topics LIKE ?').join(' OR ')})`;
      query.topics.forEach(topic => params.push(`%"${topic}"%`));
    }

    if (query.voices && query.voices.length > 0) {
      sql += ` AND (${query.voices.map(() => 'i.voices_used LIKE ?').join(' OR ')})`;
      query.voices.forEach(voice => params.push(`%"${voice}"%`));
    }

    if (query.minConfidence !== undefined) {
      sql += ` AND i.confidence >= ?`;
      params.push(query.minConfidence);
    }

    // Order by timestamp descending
    sql += ` ORDER BY i.timestamp DESC`;

    // Add pagination
    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);

      if (query.offset) {
        sql += ` OFFSET ?`;
        params.push(query.offset);
      }
    }

    try {
      const rows = await this.db!.all(sql, params);

      const interactions: StoredInteraction[] = rows.map(row => this.mapRowToInteraction(row));

      // Get total count
      const countSql = sql
        .replace(/SELECT i\.\*, s\.workspace_root/, 'SELECT COUNT(*)')
        .replace(/ORDER BY i\.timestamp DESC.*$/, '');
      const countResult = await this.db!.get(countSql, params.slice(0, -2)); // Remove LIMIT/OFFSET params
      const total = countResult['COUNT(*)'] || 0;

      // Calculate relevance scores if text search
      let relevanceScores: number[] | undefined;
      if (query.text) {
        relevanceScores = await this.calculateRelevanceScores(query.text, interactions);
      }

      logger.debug('Search completed', {
        query: query.text?.substring(0, 50),
        results: interactions.length,
        total,
      });

      return {
        interactions,
        total,
        relevanceScores,
      };
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Get conversation session by ID
   */
  async getSession(sessionId: string): Promise<ConversationSession | null> {
    await this.ensureInitialized();

    try {
      const row = await this.db!.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);

      if (!row) return null;

      return {
        id: row.id,
        startTime: row.start_time,
        endTime: row.end_time,
        totalInteractions: row.total_interactions,
        averageConfidence: row.average_confidence,
        topics: JSON.parse(row.topics || '[]'),
        workspaceRoot: row.workspace_root,
        userAgent: row.user_agent,
      };
    } catch (error) {
      logger.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Start a new conversation session
   */
  async startSession(workspaceRoot: string, userAgent?: string): Promise<string> {
    await this.ensureInitialized();

    const sessionId = this.generateId();
    const startTime = Date.now();

    try {
      await this.db!.run(
        `
        INSERT INTO sessions (id, start_time, workspace_root, user_agent, total_interactions, average_confidence, topics)
        VALUES (?, ?, ?, ?, 0, 0, '[]')
      `,
        [sessionId, startTime, workspaceRoot, userAgent]
      );

      logger.info('Started conversation session', { sessionId, workspaceRoot });
      return sessionId;
    } catch (error) {
      logger.error('Failed to start session:', error);
      throw error;
    }
  }

  /**
   * End a conversation session
   */
  async endSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.db!.run(
        `
        UPDATE sessions 
        SET end_time = ?
        WHERE id = ?
      `,
        [Date.now(), sessionId]
      );

      logger.info('Ended conversation session', { sessionId });
    } catch (error) {
      logger.error(`Failed to end session ${sessionId}:`, error);
    }
  }

  /**
   * Get conversation analytics
   */
  async getAnalytics(timeRange?: { start: number; end: number }): Promise<ConversationAnalytics> {
    await this.ensureInitialized();

    try {
      let whereClause = '';
      const params: any[] = [];

      if (timeRange) {
        whereClause = 'WHERE timestamp BETWEEN ? AND ?';
        params.push(timeRange.start, timeRange.end);
      }

      // Total interactions and sessions
      const totals = await this.db!.get(
        `
        SELECT 
          COUNT(*) as total_interactions,
          COUNT(DISTINCT session_id) as total_sessions,
          AVG(confidence) as average_confidence,
          AVG(latency) as average_latency
        FROM interactions 
        ${whereClause}
      `,
        params
      );

      // Top topics
      const topicsQuery = await this.db!.all(
        `
        SELECT topics 
        FROM interactions 
        ${whereClause}
        ORDER BY timestamp DESC 
        LIMIT 1000
      `,
        params
      );

      const topicCounts = new Map<string, number>();
      topicsQuery.forEach(row => {
        try {
          const topics = JSON.parse(row.topics || '[]');
          topics.forEach((topic: string) => {
            topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
          });
        } catch (error) {
          // Ignore JSON parse errors
        }
      });

      const topTopics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      // Voice usage
      const voicesQuery = await this.db!.all(
        `
        SELECT voices_used 
        FROM interactions 
        ${whereClause}
        ORDER BY timestamp DESC 
        LIMIT 1000
      `,
        params
      );

      const voiceCounts = new Map<string, number>();
      voicesQuery.forEach(row => {
        try {
          const voices = JSON.parse(row.voices_used || '[]');
          voices.forEach((voice: string) => {
            voiceCounts.set(voice, (voiceCounts.get(voice) || 0) + 1);
          });
        } catch (error) {
          // Ignore JSON parse errors
        }
      });

      const voiceUsage = Array.from(voiceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([voice, count]) => ({ voice, count }));

      // Daily activity (last 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const dailyQuery = await this.db!.all(
        `
        SELECT 
          DATE(timestamp / 1000, 'unixepoch') as date,
          COUNT(*) as interactions
        FROM interactions 
        WHERE timestamp > ?
        GROUP BY DATE(timestamp / 1000, 'unixepoch')
        ORDER BY date
      `,
        [thirtyDaysAgo]
      );

      const dailyActivity = dailyQuery.map(row => ({
        date: row.date,
        interactions: row.interactions,
      }));

      return {
        totalInteractions: totals.total_interactions || 0,
        totalSessions: totals.total_sessions || 0,
        averageConfidence: totals.average_confidence || 0,
        averageLatency: totals.average_latency || 0,
        topTopics,
        voiceUsage,
        dailyActivity,
      };
    } catch (error) {
      logger.error('Failed to get analytics:', error);
      throw error;
    }
  }

  /**
   * Update user feedback for an interaction
   */
  async updateFeedback(
    interactionId: string,
    feedback: 'positive' | 'negative' | 'neutral'
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.db!.run(
        `
        UPDATE interactions 
        SET user_feedback = ? 
        WHERE id = ?
      `,
        [feedback, interactionId]
      );

      logger.debug('Updated interaction feedback', { interactionId, feedback });
    } catch (error) {
      logger.error(`Failed to update feedback for ${interactionId}:`, error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    // Sessions table
    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        total_interactions INTEGER DEFAULT 0,
        average_confidence REAL DEFAULT 0,
        topics TEXT DEFAULT '[]',
        workspace_root TEXT,
        user_agent TEXT
      )
    `);

    // Interactions table
    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
        voices_used TEXT DEFAULT '[]',
        confidence REAL DEFAULT 0,
        latency INTEGER DEFAULT 0,
        user_feedback TEXT,
        topics TEXT DEFAULT '[]',
        context_hash TEXT,
        embedding TEXT,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      )
    `);
  }

  /**
   * Create database indexes for performance
   */
  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_interactions_session_id ON interactions(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_confidence ON interactions(confidence)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_topics ON interactions(topics)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_root)',
    ];

    for (const indexSql of indexes) {
      await this.db!.exec(indexSql);
    }
  }

  /**
   * Map database row to StoredInteraction
   */
  private mapRowToInteraction(row: any): StoredInteraction {
    return {
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      prompt: row.prompt,
      response: row.response,
      voicesUsed: JSON.parse(row.voices_used || '[]'),
      confidence: row.confidence,
      latency: row.latency,
      userFeedback: row.user_feedback,
      topics: JSON.parse(row.topics || '[]'),
      contextHash: row.context_hash,
      embedding: JSON.parse(row.embedding || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }

  /**
   * Update session statistics
   */
  private async updateSessionStats(
    sessionId: string,
    interaction: StoredInteraction
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const newTotal = session.totalInteractions + 1;
    const newAverage =
      (session.averageConfidence * session.totalInteractions + interaction.confidence) / newTotal;

    // Merge topics
    const existingTopics = new Set(session.topics);
    interaction.topics.forEach(topic => existingTopics.add(topic));
    const mergedTopics = Array.from(existingTopics);

    await this.db!.run(
      `
      UPDATE sessions 
      SET total_interactions = ?, average_confidence = ?, topics = ?
      WHERE id = ?
    `,
      [newTotal, newAverage, JSON.stringify(mergedTopics), sessionId]
    );
  }

  /**
   * Generate simple embedding for semantic search
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // This is a simplified embedding generation
    // In a real implementation, you would use a proper embedding model
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(100).fill(0);

    // Simple hash-based embedding
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      embedding[hash % 100] += 1;
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }

    return embedding;
  }

  /**
   * Calculate relevance scores for search results
   */
  private async calculateRelevanceScores(
    query: string,
    interactions: StoredInteraction[]
  ): Promise<number[]> {
    const queryEmbedding = await this.generateEmbedding(query);

    return interactions.map(interaction => {
      if (!interaction.embedding || interaction.embedding.length === 0) {
        // Fallback to text similarity
        return this.calculateTextSimilarity(query, interaction.prompt + ' ' + interaction.response);
      }

      // Calculate cosine similarity
      return this.cosineSimilarity(queryEmbedding, interaction.embedding);
    });
  }

  /**
   * Calculate cosine similarity between vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Calculate text similarity (fallback)
   */
  private calculateTextSimilarity(query: string, text: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const textWords = text.toLowerCase().split(/\s+/);

    const matches = textWords.filter(word => queryWords.has(word)).length;
    return matches / Math.max(queryWords.size, textWords.length);
  }

  /**
   * Extract topics from text
   */
  private extractTopics(prompt: string, response: string): string[] {
    const text = `${prompt} ${response}`.toLowerCase();
    const topics = new Set<string>();

    // Programming languages
    const languages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'rust',
      'go',
      'cpp',
      'c#',
      'php',
    ];
    languages.forEach(lang => {
      if (text.includes(lang)) topics.add(lang);
    });

    // Technologies
    const technologies = [
      'react',
      'vue',
      'angular',
      'docker',
      'kubernetes',
      'git',
      'database',
      'api',
    ];
    technologies.forEach(tech => {
      if (text.includes(tech)) topics.add(tech);
    });

    return Array.from(topics);
  }

  /**
   * Generate hash for context
   */
  private hashContext(context: ProjectContext): string {
    const str = JSON.stringify({
      guidance: context.guidance?.substring(0, 100),
      preferences: context.preferences,
      patterns: context.patterns.map(p => p.name),
    });

    return this.simpleHash(str).toString();
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Close database connection
   */
  async dispose(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = undefined;
      this.initialized = false;
      logger.info('Conversation store disposed');
    }
  }
}
