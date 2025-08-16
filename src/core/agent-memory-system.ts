import Database from 'better-sqlite3';
import { join } from 'path';
import { logger } from './logger.js';
import { existsSync, mkdirSync } from 'fs';

export interface Memory {
  id: string;
  key: string;
  value: Record<string, unknown>;
  category: string;
  projectPath?: string;
  confidence: number;
  accessCount: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  tags: string[];
}

export interface Learning {
  id: string;
  sessionId: string;
  userInput: string;
  intent: string;
  tasksCompleted: number;
  success: boolean;
  duration: number;
  learnings: Record<string, unknown>[];
  suggestions: Record<string, unknown>[];
  projectPath?: string;
  confidence: number;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  category?: string;
  projectPath?: string;
  tags?: string[];
  minConfidence?: number;
  limit?: number;
  includeExpired?: boolean;
}

/**
 * Persistent Memory System for AI Agent Learning
 * 
 * Provides:
 * - Long-term storage of learnings and patterns
 * - Contextual memory retrieval
 * - Pattern recognition and knowledge building
 * - Performance tracking and optimization
 * - Cross-session learning continuity
 */
export class AgentMemorySystem {
  private db: Database.Database;
  private isInitialized = false;

  constructor(dbPath?: string) {
    // Default to user's .codecrucible directory
    const defaultDbPath = join(process.env.HOME || process.env.USERPROFILE || '.', '.codecrucible', 'agent-memory.db');
    const actualDbPath = dbPath || defaultDbPath;
    
    // Ensure directory exists
    const dbDir = join(actualDbPath, '..');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(actualDbPath);
    this.initializeDatabase();
  }

  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    try {
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');

      // Create memories table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          category TEXT NOT NULL,
          project_path TEXT,
          confidence REAL NOT NULL DEFAULT 1.0,
          access_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER,
          tags TEXT NOT NULL DEFAULT '[]'
        )
      `);

      // Create learnings table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS learnings (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          user_input TEXT NOT NULL,
          intent TEXT NOT NULL,
          tasks_completed INTEGER NOT NULL,
          success INTEGER NOT NULL,
          duration INTEGER NOT NULL,
          learnings TEXT NOT NULL DEFAULT '[]',
          suggestions TEXT NOT NULL DEFAULT '[]',
          project_path TEXT,
          confidence REAL NOT NULL DEFAULT 1.0,
          created_at INTEGER NOT NULL,
          metadata TEXT NOT NULL DEFAULT '{}'
        )
      `);

      // Create patterns table for knowledge extraction
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS patterns (
          id TEXT PRIMARY KEY,
          pattern_type TEXT NOT NULL,
          pattern_data TEXT NOT NULL,
          frequency INTEGER NOT NULL DEFAULT 1,
          confidence REAL NOT NULL DEFAULT 1.0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_seen INTEGER NOT NULL
        )
      `);

      // Create indexes for better performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
        CREATE INDEX IF NOT EXISTS idx_memories_project_path ON memories(project_path);
        CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence);
        CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
        
        CREATE INDEX IF NOT EXISTS idx_learnings_session_id ON learnings(session_id);
        CREATE INDEX IF NOT EXISTS idx_learnings_intent ON learnings(intent);
        CREATE INDEX IF NOT EXISTS idx_learnings_project_path ON learnings(project_path);
        CREATE INDEX IF NOT EXISTS idx_learnings_success ON learnings(success);
        CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings(created_at);
        
        CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type);
        CREATE INDEX IF NOT EXISTS idx_patterns_frequency ON patterns(frequency);
        CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence);
      `);

      this.isInitialized = true;
      logger.info('🧠 Agent Memory System initialized successfully');

      // Clean up expired memories on startup
      this.cleanupExpiredMemories();

    } catch (error) {
      logger.error('Failed to initialize Agent Memory System:', error);
      throw error;
    }
  }

  /**
   * Store a new memory
   */
  async storeMemory(memory: Omit<Memory, 'id' | 'accessCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO memories (
        id, key, value, category, project_path, confidence,
        access_count, created_at, updated_at, expires_at, tags
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      memory.key,
      JSON.stringify(memory.value),
      memory.category,
      memory.projectPath || null,
      memory.confidence,
      now,
      now,
      memory.expiresAt || null,
      JSON.stringify(memory.tags)
    );

    logger.debug(`📝 Stored memory: ${memory.key} (${memory.category})`);
    return id;
  }

  /**
   * Retrieve memories based on search criteria
   */
  async retrieveMemories(options: SearchOptions = {}): Promise<Memory[]> {
    let query = `
      SELECT * FROM memories 
      WHERE 1=1
    `;
    const params: any[] = [];

    // Add filters
    if (options.category) {
      query += ` AND category = ?`;
      params.push(options.category);
    }

    if (options.projectPath) {
      query += ` AND (project_path = ? OR project_path IS NULL)`;
      params.push(options.projectPath);
    }

    if (options.minConfidence !== undefined) {
      query += ` AND confidence >= ?`;
      params.push(options.minConfidence);
    }

    if (!options.includeExpired) {
      query += ` AND (expires_at IS NULL OR expires_at > ?)`;
      params.push(Date.now());
    }

    // Order by relevance (confidence * access_count) and recency
    query += ` ORDER BY (confidence * (access_count + 1)) DESC, created_at DESC`;

    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    const memories = rows.map(row => this.rowToMemory(row));

    // Update access counts for retrieved memories
    if (memories.length > 0) {
      const updateStmt = this.db.prepare(`
        UPDATE memories 
        SET access_count = access_count + 1, updated_at = ?
        WHERE id = ?
      `);
      
      const now = Date.now();
      for (const memory of memories) {
        updateStmt.run(now, memory.id);
      }
    }

    // Filter by tags if specified
    if (options.tags && options.tags.length > 0) {
      return memories.filter(memory => 
        options.tags!.some(tag => memory.tags.includes(tag))
      );
    }

    return memories;
  }

  /**
   * Retrieve relevant memories for a specific context
   */
  async retrieveRelevantMemories(
    query: string, 
    projectPath?: string, 
    limit: number = 10
  ): Promise<Array<{ key: string; value: any; confidence: number }>> {
    // First, try to find exact or partial key matches
    const keyMatches = await this.retrieveMemories({
      projectPath,
      limit: limit / 2,
      minConfidence: 0.5
    });

    // Filter by query relevance
    const queryWords = query.toLowerCase().split(/\s+/);
    const relevantMemories = keyMatches.filter(memory => {
      const memoryText = (memory.key + ' ' + JSON.stringify(memory.value)).toLowerCase();
      return queryWords.some(word => memoryText.includes(word));
    });

    // Add general high-confidence memories
    const generalMemories = await this.retrieveMemories({
      projectPath,
      minConfidence: 0.8,
      limit: limit - relevantMemories.length
    });

    const allMemories = [...relevantMemories, ...generalMemories];
    
    // Remove duplicates and limit results
    const uniqueMemories = Array.from(
      new Map(allMemories.map(m => [m.id, m])).values()
    ).slice(0, limit);

    return uniqueMemories.map(m => ({
      key: m.key,
      value: m.value,
      confidence: m.confidence
    }));
  }

  /**
   * Store a learning from a completed session
   */
  async storeLearning(learning: Omit<Learning, 'id' | 'createdAt'>): Promise<string> {
    const id = this.generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO learnings (
        id, session_id, user_input, intent, tasks_completed, success,
        duration, learnings, suggestions, project_path, confidence,
        created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      learning.sessionId,
      learning.userInput,
      learning.intent,
      learning.tasksCompleted,
      learning.success ? 1 : 0,
      learning.duration,
      JSON.stringify(learning.learnings),
      JSON.stringify(learning.suggestions),
      learning.projectPath || null,
      learning.confidence,
      now,
      JSON.stringify(learning.metadata)
    );

    // Extract and store patterns from this learning
    await this.extractAndStorePatterns(learning);

    // Convert learnings to long-term memories
    await this.convertLearningsToMemories(learning);

    logger.debug(`🎓 Stored learning from session: ${learning.sessionId}`);
    return id;
  }

  /**
   * Get learning statistics and insights
   */
  async getLearningStats(): Promise<any> {
    const stats = {
      totalLearnings: 0,
      successRate: 0,
      avgTasksPerSession: 0,
      avgDuration: 0,
      topIntents: [] as any[],
      topPatterns: [] as any[],
      memoryStats: {
        totalMemories: 0,
        categoriesCount: 0,
        avgConfidence: 0
      }
    };

    // Learning statistics
    const learningStatsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        AVG(CAST(success AS REAL)) as success_rate,
        AVG(tasks_completed) as avg_tasks,
        AVG(duration) as avg_duration
      FROM learnings
    `);
    const learningStats = learningStatsStmt.get() as any;

    stats.totalLearnings = learningStats.total;
    stats.successRate = learningStats.success_rate || 0;
    stats.avgTasksPerSession = learningStats.avg_tasks || 0;
    stats.avgDuration = learningStats.avg_duration || 0;

    // Top intents
    const topIntentsStmt = this.db.prepare(`
      SELECT intent, COUNT(*) as count
      FROM learnings
      GROUP BY intent
      ORDER BY count DESC
      LIMIT 5
    `);
    stats.topIntents = topIntentsStmt.all() as any[];

    // Top patterns
    const topPatternsStmt = this.db.prepare(`
      SELECT pattern_type, frequency, confidence
      FROM patterns
      ORDER BY frequency DESC, confidence DESC
      LIMIT 5
    `);
    stats.topPatterns = topPatternsStmt.all() as any[];

    // Memory statistics
    const memoryStatsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT category) as categories,
        AVG(confidence) as avg_confidence
      FROM memories
      WHERE expires_at IS NULL OR expires_at > ?
    `);
    const memoryStats = memoryStatsStmt.get(Date.now()) as any;

    stats.memoryStats = {
      totalMemories: memoryStats.total,
      categoriesCount: memoryStats.categories,
      avgConfidence: memoryStats.avg_confidence || 0
    };

    return stats;
  }

  /**
   * Extract and store patterns from learnings
   */
  private async extractAndStorePatterns(learning: Omit<Learning, 'id' | 'createdAt'>): Promise<void> {
    try {
      // Extract intent patterns
      await this.updatePattern('intent_frequency', learning.intent);

      // Extract success patterns
      if (learning.success) {
        await this.updatePattern('success_pattern', `${learning.intent}_success`);
      } else {
        await this.updatePattern('failure_pattern', `${learning.intent}_failure`);
      }

      // Extract duration patterns
      const durationCategory = learning.duration < 30000 ? 'fast' : 
                              learning.duration < 120000 ? 'medium' : 'slow';
      await this.updatePattern('duration_pattern', `${learning.intent}_${durationCategory}`);

      // Extract task complexity patterns
      const complexityCategory = learning.tasksCompleted < 3 ? 'simple' :
                                 learning.tasksCompleted < 7 ? 'moderate' : 'complex';
      await this.updatePattern('complexity_pattern', `${learning.intent}_${complexityCategory}`);

    } catch (error) {
      logger.warn('Failed to extract patterns from learning:', error);
    }
  }

  /**
   * Update or create a pattern
   */
  private async updatePattern(patternType: string, patternData: string): Promise<void> {
    const existingStmt = this.db.prepare(`
      SELECT * FROM patterns WHERE pattern_type = ? AND pattern_data = ?
    `);
    const existing = existingStmt.get(patternType, patternData);

    const now = Date.now();

    if (existing) {
      // Update existing pattern
      const updateStmt = this.db.prepare(`
        UPDATE patterns 
        SET frequency = frequency + 1, updated_at = ?, last_seen = ?
        WHERE id = ?
      `);
      updateStmt.run(now, now, (existing as any).id);
    } else {
      // Create new pattern
      const insertStmt = this.db.prepare(`
        INSERT INTO patterns (id, pattern_type, pattern_data, frequency, confidence, created_at, updated_at, last_seen)
        VALUES (?, ?, ?, 1, 1.0, ?, ?, ?)
      `);
      insertStmt.run(this.generateId(), patternType, patternData, now, now, now);
    }
  }

  /**
   * Convert valuable learnings to persistent memories
   */
  private async convertLearningsToMemories(learning: Omit<Learning, 'id' | 'createdAt'>): Promise<void> {
    // Store high-value learnings as memories
    if (learning.confidence > 0.7 && learning.success) {
      // Store successful intent patterns
      await this.storeMemory({
        key: `successful_intent_${learning.intent}`,
        value: {
          intent: learning.intent,
          tasksCompleted: learning.tasksCompleted,
          duration: learning.duration,
          userInput: learning.userInput.slice(0, 200),
          suggestions: learning.suggestions.slice(0, 3)
        },
        category: 'success_pattern',
        projectPath: learning.projectPath,
        confidence: learning.confidence,
        tags: ['success', learning.intent, 'pattern']
      });

      // Store specific learnings as individual memories
      for (const specificLearning of learning.learnings.slice(0, 3)) {
        if (specificLearning && typeof specificLearning === 'object') {
          await this.storeMemory({
            key: `learning_${(specificLearning as any).type || 'general'}`,
            value: specificLearning,
            category: 'specific_learning',
            projectPath: learning.projectPath,
            confidence: learning.confidence * 0.8,
            tags: ['learning', (specificLearning as any).type || 'general'],
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
          });
        }
      }
    }
  }

  /**
   * Clean up expired memories
   */
  private cleanupExpiredMemories(): void {
    try {
      const deleteStmt = this.db.prepare(`
        DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?
      `);
      const result = deleteStmt.run(Date.now());
      
      if (result.changes > 0) {
        logger.info(`🧹 Cleaned up ${result.changes} expired memories`);
      }

      // Also clean up old low-confidence memories
      const cleanupStmt = this.db.prepare(`
        DELETE FROM memories 
        WHERE confidence < 0.3 
        AND access_count = 0 
        AND created_at < ?
      `);
      const oldThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
      const cleanupResult = cleanupStmt.run(oldThreshold);

      if (cleanupResult.changes > 0) {
        logger.info(`🧹 Cleaned up ${cleanupResult.changes} low-value memories`);
      }

    } catch (error) {
      logger.warn('Failed to cleanup expired memories:', error);
    }
  }

  /**
   * Get insights about memory usage and patterns
   */
  async getInsights(): Promise<any> {
    const insights = {
      memoryHealth: 'good',
      recommendations: [] as string[],
      topCategories: [] as any[],
      learningTrends: [] as any[],
      patternInsights: [] as any[]
    };

    try {
      // Analyze memory health
      const healthStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          AVG(confidence) as avg_confidence,
          COUNT(CASE WHEN access_count = 0 THEN 1 END) as unused,
          COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at < ? THEN 1 END) as expired
        FROM memories
      `);
      const health = healthStmt.get(Date.now()) as any;

      if (health.avg_confidence < 0.5) {
        insights.memoryHealth = 'poor';
        insights.recommendations.push('Low average confidence - consider improving learning quality');
      }

      if (health.unused / health.total > 0.5) {
        insights.recommendations.push('Many unused memories - consider cleanup');
      }

      // Top categories
      const categoriesStmt = this.db.prepare(`
        SELECT category, COUNT(*) as count, AVG(confidence) as avg_confidence
        FROM memories
        GROUP BY category
        ORDER BY count DESC
        LIMIT 10
      `);
      insights.topCategories = categoriesStmt.all();

      // Learning trends
      const trendsStmt = this.db.prepare(`
        SELECT 
          DATE(created_at / 1000, 'unixepoch') as date,
          COUNT(*) as sessions,
          AVG(CAST(success AS REAL)) as success_rate
        FROM learnings
        WHERE created_at > ?
        GROUP BY DATE(created_at / 1000, 'unixepoch')
        ORDER BY date DESC
        LIMIT 7
      `);
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      insights.learningTrends = trendsStmt.all(weekAgo) as any[];

      // Pattern insights
      const patternStmt = this.db.prepare(`
        SELECT pattern_type, pattern_data, frequency, confidence
        FROM patterns
        WHERE frequency > 1
        ORDER BY frequency DESC, confidence DESC
        LIMIT 10
      `);
      insights.patternInsights = patternStmt.all() as any[];

    } catch (error) {
      logger.warn('Failed to generate insights:', error);
    }

    return insights;
  }

  /**
   * Convert database row to Memory object
   */
  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      key: row.key,
      value: JSON.parse(row.value),
      category: row.category,
      projectPath: row.project_path,
      confidence: row.confidence,
      accessCount: row.access_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      tags: JSON.parse(row.tags || '[]')
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      logger.info('🧠 Agent Memory System closed');
    }
  }

  /**
   * Get database statistics
   */
  getStats(): any {
    if (!this.isInitialized) return null;

    try {
      const memoriesCount = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as any;
      const learningsCount = this.db.prepare('SELECT COUNT(*) as count FROM learnings').get() as any;
      const patternsCount = this.db.prepare('SELECT COUNT(*) as count FROM patterns').get() as any;

      return {
        memories: memoriesCount.count,
        learnings: learningsCount.count,
        patterns: patternsCount.count,
        isInitialized: this.isInitialized
      };
    } catch (error) {
      logger.warn('Failed to get database stats:', error);
      return null;
    }
  }
}