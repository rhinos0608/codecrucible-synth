import { ChildProcess } from 'child_process';
export interface MCPServerConfig {
    filesystem: {
        enabled: boolean;
        restrictedPaths: string[];
        allowedPaths: string[];
    };
    git: {
        enabled: boolean;
        autoCommitMessages: boolean;
        safeModeEnabled: boolean;
    };
    terminal: {
        enabled: boolean;
        allowedCommands: string[];
        blockedCommands: string[];
    };
    packageManager: {
        enabled: boolean;
        autoInstall: boolean;
        securityScan: boolean;
    };
    smithery?: {
        enabled: boolean;
        apiKey?: string;
        profile?: string;
        baseUrl?: string;
    };
}
export interface MCPServer {
    name: string;
    process?: ChildProcess;
    enabled: boolean;
    status: 'stopped' | 'starting' | 'running' | 'error';
    lastError?: string;
}
/**
 * MCP Server Manager
 *
 * Manages Model Context Protocol servers for extended functionality
 * Provides safe, sandboxed access to file system, git, terminal, and package management
 */
export declare class MCPServerManager {
    private config;
    private servers;
    private isInitialized;
    constructor(config: MCPServerConfig);
    /**
     * Initialize all enabled MCP servers
     */
    private initializeServers;
    /**
     * Start all enabled MCP servers
     */
    startServers(): Promise<void>;
    /**
     * Start a specific MCP server
     */
    startServer(serverName: string): Promise<void>;
    /**
     * Initialize built-in MCP server functionality
     */
    private initializeBuiltinServer;
    /**
     * Stop all MCP servers
     */
    stopServers(): Promise<void>;
    /**
     * Stop a specific MCP server
     */
    stopServer(serverName: string): Promise<void>;
    /**
     * Get server status
     */
    getServerStatus(serverName?: string): MCPServer | MCPServer[];
    /**
     * Initialize filesystem server functionality
     */
    private initializeFilesystemServer;
    /**
     * Initialize git server functionality
     */
    private initializeGitServer;
    /**
     * Initialize terminal server functionality
     */
    private initializeTerminalServer;
    /**
     * Initialize package manager server functionality
     */
    private initializePackageManagerServer;
    /**
     * Initialize Smithery MCP server functionality
     */
    private initializeSmitheryServer;
    /**
     * Safe file system operations
     */
    readFileSecure(filePath: string): Promise<string>;
    writeFileSecure(filePath: string, content: string): Promise<void>;
    listDirectorySecure(dirPath: string): Promise<string[]>;
    /**
     * Safe command execution with enhanced security
     */
    executeCommandSecure(command: string, args?: string[]): Promise<string>;
    /**
     * Sanitize command input to prevent injection
     */
    private sanitizeCommandInput;
    /**
     * Additional security validation for commands
     */
    private validateCommandSecurity;
    /**
     * Get safe current working directory
     */
    private getSafeCwd;
    /**
     * Get safe environment variables
     */
    private getSafeEnvironment;
    /**
     * Git operations
     */
    gitStatus(): Promise<string>;
    gitAdd(files: string[]): Promise<string>;
    gitCommit(message: string): Promise<string>;
    /**
     * Package manager operations
     */
    installPackage(packageName: string, dev?: boolean): Promise<string>;
    runScript(scriptName: string): Promise<string>;
    /**
     * Smithery web search
     */
    smitheryWebSearch(query: string, numResults?: number): Promise<any>;
    /**
     * Check if a file path is allowed
     */
    private isPathAllowed;
    /**
     * Check if a command is allowed
     */
    private isCommandAllowed;
    /**
     * Health check for all servers
     */
    healthCheck(): Promise<{
        [key: string]: any;
    }>;
}
