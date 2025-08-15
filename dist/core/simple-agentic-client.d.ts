import { CLIContext } from './cli.js';
export interface CodebaseFile {
    path: string;
    content: string;
    language: string;
    size: number;
}
export interface CodebaseContext {
    rootPath: string;
    files: Map<string, CodebaseFile>;
    structure: any;
    lastScanned: number;
}
/**
 * Simple Agentic Client - Like Claude Code
 *
 * Focuses on:
 * - Understanding the current codebase
 * - Reading and modifying files directly
 * - Executing commands when needed
 * - Simple interactive command processing
 */
export declare class SimpleAgenticClient {
    private context;
    private codebase;
    private isActive;
    constructor(context: CLIContext);
    /**
     * Start the agentic client
     */
    start(): Promise<void>;
    /**
     * Scan the codebase to understand structure
     */
    private scanCodebase;
    /**
     * Interactive command loop
     */
    private interactiveLoop;
    /**
     * Process a natural language command
     */
    private processCommand;
    /**
     * Extract and execute specific actions from the response
     */
    private executeActions;
    /**
     * Read and display a file
     */
    private readFile;
    /**
     * Analyze a file using AI
     */
    private analyzeFile;
    /**
     * Run a command
     */
    private runCommand;
    /**
     * List files in the codebase
     */
    private listFiles;
    /**
     * Show help information
     */
    private showHelp;
    /**
     * Show current status
     */
    private showStatus;
    /**
     * Build project context for AI
     */
    private buildProjectContext;
    /**
     * Detect programming language from file extension
     */
    private detectLanguage;
}
