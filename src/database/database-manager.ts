import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { logger } from '../core/logger.js';

export interface DatabaseConfig {
  path: string;
  inMemory?: boolean;
  readonly?: boolean;
  backupPath?: string;
  enableWAL?: boolean;
}

/**
 * Local SQLite Database Manager for CodeCrucible
 * Completely self-contained with no external dependencies
 */
export class DatabaseManager {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = {
      enableWAL: true,
      ...config,
    };
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.inMemory) {
        logger.info('Initializing in-memory SQLite database');
        this.db = new Database(':memory:');
      } else {
        // Ensure directory exists
        const dbDir = join(process.cwd(), 'data');
        mkdirSync(dbDir, { recursive: true });

        const dbPath = join(dbDir, this.config.path);
        logger.info('Initializing SQLite database at:', dbPath);

        this.db = new Database(dbPath, {
          readonly: this.config.readonly || false,
          fileMustExist: false,
          timeout: 5000,
          verbose:
            process.env.NODE_ENV === 'development'
              ? (message?: unknown, ...additionalArgs: unknown[]) => {
                  if (typeof message === 'string') {
                    logger.debug(message, ...additionalArgs);
                  }
                }
              : undefined,
        });
      }

      // Enable WAL mode for better performance
      if (this.config.enableWAL && !this.config.inMemory) {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = 1000000');
        this.db.pragma('temp_store = memory');
        this.db.pragma('mmap_size = 268435456'); // 256MB
      }

      // Initialize schema
      await this.createTables();

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create application tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Voice interactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS voice_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        voice_name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
        confidence REAL NOT NULL,
        tokens_used INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        project_type TEXT,
        description TEXT,
        last_analyzed DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Code analysis results table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        analysis_type TEXT NOT NULL,
        results TEXT NOT NULL,
        quality_score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id)
      )
    `);

    // User sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        total_interactions INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0
      )
    `);

    // Configuration table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_voice_interactions_session 
      ON voice_interactions(session_id);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_voice_interactions_voice 
      ON voice_interactions(voice_name);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_code_analysis_project 
      ON code_analysis(project_id);
    `);

    logger.info('Database schema created/updated successfully');
  }

  /**
   * Store a voice interaction
   */
  async storeVoiceInteraction(interaction: {
    sessionId: string;
    voiceName: string;
    prompt: string;
    response: string;
    confidence: number;
    tokensUsed: number;
  }): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO voice_interactions 
      (session_id, voice_name, prompt, response, confidence, tokens_used)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      interaction.sessionId,
      interaction.voiceName,
      interaction.prompt,
      interaction.response,
      interaction.confidence,
      interaction.tokensUsed
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Store code analysis results
   */
  async storeCodeAnalysis(analysis: {
    projectId: number;
    filePath: string;
    analysisType: string;
    results: any;
    qualityScore?: number;
  }): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO code_analysis 
      (project_id, file_path, analysis_type, results, quality_score)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      analysis.projectId,
      analysis.filePath,
      analysis.analysisType,
      JSON.stringify(analysis.results),
      analysis.qualityScore || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get project by path
   */
  async getProjectByPath(path: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM projects WHERE path = ?');
    return stmt.get(path);
  }

  /**
   * Create or update project
   */
  async upsertProject(project: {
    name: string;
    path: string;
    projectType?: string;
    description?: string;
  }): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getProjectByPath(project.path);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE projects 
        SET name = ?, project_type = ?, description = ?, last_analyzed = CURRENT_TIMESTAMP
        WHERE path = ?
      `);
      stmt.run(project.name, project.projectType, project.description, project.path);
      return existing.id;
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO projects (name, path, project_type, description)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(project.name, project.path, project.projectType, project.description);
      return result.lastInsertRowid as number;
    }
  }

  /**
   * Get interaction history for a session
   */
  async getSessionHistory(sessionId: string, limit: number = 50): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM voice_interactions 
      WHERE session_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);

    return stmt.all(sessionId, limit);
  }

  /**
   * Get configuration value
   */
  async getConfig(key: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT value FROM app_config WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value || null;
  }

  /**
   * Set configuration value
   */
  async setConfig(key: string, value: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO app_config (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(key, value);
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stats = {
      totalInteractions: this.db.prepare('SELECT COUNT(*) as count FROM voice_interactions').get(),
      totalProjects: this.db.prepare('SELECT COUNT(*) as count FROM projects').get(),
      totalAnalysis: this.db.prepare('SELECT COUNT(*) as count FROM code_analysis').get(),
      dbSize: this.db
        .prepare(
          'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
        )
        .get(),
    };

    return stats;
  }

  /**
   * Backup database (only for file-based databases)
   */
  async backup(backupPath?: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    if (this.config.inMemory) throw new Error('Cannot backup in-memory database');

    const targetPath =
      backupPath ||
      this.config.backupPath ||
      join(process.cwd(), 'data', `backup_${Date.now()}.db`);

    await this.db.backup(targetPath);
    logger.info('Database backed up to:', targetPath);
    return targetPath;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Get the raw database instance (use with caution)
   */
  getRawDb(): Database.Database | null {
    return this.db;
  }
}
