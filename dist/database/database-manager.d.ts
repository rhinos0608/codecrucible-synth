import Database from 'better-sqlite3';
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
export declare class DatabaseManager {
    private db;
    private config;
    constructor(config: DatabaseConfig);
    /**
     * Initialize the database connection
     */
    initialize(): Promise<void>;
    /**
     * Create application tables
     */
    private createTables;
    /**
     * Store a voice interaction
     */
    storeVoiceInteraction(interaction: {
        sessionId: string;
        voiceName: string;
        prompt: string;
        response: string;
        confidence: number;
        tokensUsed: number;
    }): Promise<number>;
    /**
     * Store code analysis results
     */
    storeCodeAnalysis(analysis: {
        projectId: number;
        filePath: string;
        analysisType: string;
        results: any;
        qualityScore?: number;
    }): Promise<number>;
    /**
     * Get project by path
     */
    getProjectByPath(path: string): Promise<any>;
    /**
     * Create or update project
     */
    upsertProject(project: {
        name: string;
        path: string;
        projectType?: string;
        description?: string;
    }): Promise<number>;
    /**
     * Get interaction history for a session
     */
    getSessionHistory(sessionId: string, limit?: number): Promise<any[]>;
    /**
     * Get configuration value
     */
    getConfig(key: string): Promise<string | null>;
    /**
     * Set configuration value
     */
    setConfig(key: string, value: string): Promise<void>;
    /**
     * Get database statistics
     */
    getStats(): Promise<any>;
    /**
     * Backup database (only for file-based databases)
     */
    backup(backupPath?: string): Promise<string>;
    /**
     * Close database connection
     */
    close(): Promise<void>;
    /**
     * Check if database is initialized
     */
    isInitialized(): boolean;
    /**
     * Get the raw database instance (use with caution)
     */
    getRawDb(): Database.Database | null;
}
