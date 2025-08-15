import { CLIContext } from './cli.js';
import { ChildProcess } from 'child_process';
export interface AgenticOptions {
    watch?: boolean;
    port?: number;
    autoExecute?: boolean;
    maxFileSize?: number;
    excludePatterns?: string[];
}
export interface AgenticContext {
    currentDirectory: string;
    openFiles: Map<string, string>;
    projectStructure: any;
    recentChanges: Array<{
        file: string;
        type: 'modified' | 'created' | 'deleted';
        timestamp: number;
    }>;
    activeTask?: string;
    runningProcesses: Map<string, ChildProcess>;
}
/**
 * Agentic Client - Cursor/Claude Code-like functionality
 *
 * Provides autonomous coding assistance with:
 * - File watching and context awareness
 * - Automatic code generation and editing
 * - Project-wide understanding
 * - Real-time collaboration
 * - Command execution and testing
 */
export declare class AgenticClient {
    private context;
    private agenticContext;
    private fileWatcher?;
    private server?;
    private httpServer?;
    private socketServer?;
    private isRunning;
    constructor(context: CLIContext);
    /**
     * Start the agentic client with optional file watching
     */
    start(options?: AgenticOptions): Promise<void>;
    /**
     * Stop the agentic client
     */
    stop(): Promise<void>;
    /**
     * Process a natural language command
     */
    processCommand(command: string): Promise<void>;
    /**
     * Initialize project context by scanning files and understanding structure
     */
    private initializeProjectContext;
    /**
     * Start file watching for real-time context updates
     */
    private startFileWatching;
    /**
     * Start HTTP server for IDE integration
     */
    private startServer;
    /**
     * Setup REST API endpoints
     */
    private setupAPIEndpoints;
    /**
     * Setup WebSocket handlers
     */
    private setupWebSocketHandlers;
    /**
     * Handle file changes
     */
    private handleFileChange;
    /**
     * Analyze command intent using AI
     */
    private analyzeCommandIntent;
    /**
     * Handle code generation requests
     */
    private handleCodeGeneration;
    /**
     * Handle file operations
     */
    private handleFileOperation;
    /**
     * Handle project analysis
     */
    private handleProjectAnalysis;
    /**
     * Handle command execution
     */
    private handleCommandExecution;
    /**
     * Handle general queries
     */
    private handleGeneralQuery;
    /**
     * Start interactive command loop
     */
    private startInteractiveLoop;
    private buildProjectStructure;
    private loadKeyFiles;
    private updateProjectStructure;
    private shouldAutoAnalyze;
    private autoAnalyzeChange;
    private analyzeFile;
    private modifyFile;
    private detectLanguage;
    private handleRefactoring;
}
