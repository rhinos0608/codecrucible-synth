import { spawn } from 'child_process';
import { join } from 'path';
import { logger } from '../core/logger.js';
import chalk from 'chalk';
import { readFile, writeFile, access, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import axios from 'axios';
/**
 * MCP Server Manager
 *
 * Manages Model Context Protocol servers for extended functionality
 * Provides safe, sandboxed access to file system, git, terminal, and package management
 */
export class MCPServerManager {
    config;
    servers;
    isInitialized = false;
    constructor(config) {
        this.config = config;
        this.servers = new Map();
        this.initializeServers();
    }
    /**
     * Initialize all enabled MCP servers
     */
    initializeServers() {
        const serverConfigs = [
            { name: 'filesystem', enabled: this.config.filesystem.enabled },
            { name: 'git', enabled: this.config.git.enabled },
            { name: 'terminal', enabled: this.config.terminal.enabled },
            { name: 'packageManager', enabled: this.config.packageManager.enabled },
            { name: 'smithery', enabled: this.config.smithery?.enabled ?? false }
        ];
        serverConfigs.forEach(({ name, enabled }) => {
            this.servers.set(name, {
                name,
                enabled,
                status: 'stopped'
            });
        });
        logger.info(`Initialized ${this.servers.size} MCP servers`);
    }
    /**
     * Start all enabled MCP servers
     */
    async startServers() {
        if (this.isInitialized) {
            logger.warn('MCP servers already initialized');
            return;
        }
        console.log(chalk.blue('🔧 Starting MCP servers...'));
        const startPromises = Array.from(this.servers.values())
            .filter(server => server.enabled)
            .map(server => this.startServer(server.name));
        await Promise.allSettled(startPromises);
        this.isInitialized = true;
        const runningServers = Array.from(this.servers.values()).filter(s => s.status === 'running');
        console.log(chalk.green(`✅ Started ${runningServers.length} MCP servers`));
    }
    /**
     * Start a specific MCP server
     */
    async startServer(serverName) {
        const server = this.servers.get(serverName);
        if (!server || !server.enabled) {
            return;
        }
        try {
            server.status = 'starting';
            console.log(chalk.gray(`  Starting ${serverName} server...`));
            // For now, we'll implement built-in MCP functionality
            // rather than spawning external processes
            await this.initializeBuiltinServer(serverName);
            server.status = 'running';
            logger.info(`MCP server started: ${serverName}`);
        }
        catch (error) {
            server.status = 'error';
            server.lastError = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to start MCP server ${serverName}:`, error);
        }
    }
    /**
     * Initialize built-in MCP server functionality
     */
    async initializeBuiltinServer(serverName) {
        // For this implementation, we're creating built-in MCP-like functionality
        // In a full implementation, you might spawn actual MCP server processes
        switch (serverName) {
            case 'filesystem':
                await this.initializeFilesystemServer();
                break;
            case 'git':
                await this.initializeGitServer();
                break;
            case 'terminal':
                await this.initializeTerminalServer();
                break;
            case 'packageManager':
                await this.initializePackageManagerServer();
                break;
            case 'smithery':
                await this.initializeSmitheryServer();
                break;
        }
    }
    /**
     * Stop all MCP servers
     */
    async stopServers() {
        console.log(chalk.yellow('🛑 Stopping MCP servers...'));
        const stopPromises = Array.from(this.servers.values())
            .filter(server => server.status === 'running')
            .map(server => this.stopServer(server.name));
        await Promise.allSettled(stopPromises);
        this.isInitialized = false;
        console.log(chalk.green('✅ All MCP servers stopped'));
    }
    /**
     * Stop a specific MCP server
     */
    async stopServer(serverName) {
        const server = this.servers.get(serverName);
        if (!server)
            return;
        try {
            if (server.process) {
                server.process.kill();
                server.process = undefined;
            }
            server.status = 'stopped';
            logger.info(`MCP server stopped: ${serverName}`);
        }
        catch (error) {
            logger.error(`Failed to stop MCP server ${serverName}:`, error);
        }
    }
    /**
     * Get server status
     */
    getServerStatus(serverName) {
        if (serverName) {
            const server = this.servers.get(serverName);
            if (!server) {
                throw new Error(`Server ${serverName} not found`);
            }
            return server;
        }
        return Array.from(this.servers.values());
    }
    // Built-in MCP Server Implementations
    /**
     * Initialize filesystem server functionality
     */
    async initializeFilesystemServer() {
        // Validate restricted paths
        for (const path of this.config.filesystem.restrictedPaths) {
            if (existsSync(path)) {
                logger.info(`Filesystem: Restricting access to ${path}`);
            }
        }
    }
    /**
     * Initialize git server functionality
     */
    async initializeGitServer() {
        // Check if we're in a git repository
        try {
            await access('.git');
            logger.info('Git: Repository detected');
        }
        catch {
            logger.warn('Git: No repository found in current directory');
        }
    }
    /**
     * Initialize terminal server functionality
     */
    async initializeTerminalServer() {
        logger.info(`Terminal: Allowed commands: ${this.config.terminal.allowedCommands.join(', ')}`);
        logger.info(`Terminal: Blocked commands: ${this.config.terminal.blockedCommands.join(', ')}`);
    }
    /**
     * Initialize package manager server functionality
     */
    async initializePackageManagerServer() {
        // Check for package.json
        try {
            await access('package.json');
            logger.info('PackageManager: package.json found');
        }
        catch {
            logger.warn('PackageManager: No package.json found');
        }
    }
    /**
     * Initialize Smithery MCP server functionality
     */
    async initializeSmitheryServer() {
        if (this.config.smithery?.apiKey && this.config.smithery?.profile) {
            logger.info('Smithery: API key and profile configured');
        }
        else {
            logger.warn('Smithery: API key and profile not configured');
        }
    }
    // MCP Server Operations
    /**
     * Safe file system operations
     */
    async readFileSecure(filePath) {
        if (!this.isPathAllowed(filePath)) {
            throw new Error(`Access denied: ${filePath}`);
        }
        try {
            return await readFile(filePath, 'utf8');
        }
        catch (error) {
            throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async writeFileSecure(filePath, content) {
        if (!this.isPathAllowed(filePath)) {
            throw new Error(`Access denied: ${filePath}`);
        }
        try {
            await writeFile(filePath, content, 'utf8');
            logger.info(`File written: ${filePath}`);
        }
        catch (error) {
            throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async listDirectorySecure(dirPath) {
        if (!this.isPathAllowed(dirPath)) {
            throw new Error(`Access denied: ${dirPath}`);
        }
        try {
            return await readdir(dirPath);
        }
        catch (error) {
            throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Safe command execution with enhanced security
     */
    async executeCommandSecure(command, args = []) {
        // Input validation and sanitization
        const sanitizedCommand = this.sanitizeCommandInput(command);
        const sanitizedArgs = args.map(arg => this.sanitizeCommandInput(arg));
        if (!this.isCommandAllowed(sanitizedCommand)) {
            throw new Error(`Command not allowed: ${sanitizedCommand}`);
        }
        // Additional security checks
        this.validateCommandSecurity(sanitizedCommand, sanitizedArgs);
        return new Promise((resolve, reject) => {
            const child = spawn(sanitizedCommand, sanitizedArgs, {
                cwd: this.getSafeCwd(),
                stdio: 'pipe',
                shell: false, // Prevent shell injection
                env: this.getSafeEnvironment(),
                timeout: 30000 // Built-in timeout
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                const chunk = data.toString();
                // Limit output size to prevent memory exhaustion
                if (stdout.length + chunk.length > 1024 * 1024) { // 1MB limit
                    child.kill();
                    reject(new Error('Command output too large'));
                    return;
                }
                stdout += chunk;
            });
            child.stderr?.on('data', (data) => {
                const chunk = data.toString();
                if (stderr.length + chunk.length > 1024 * 1024) { // 1MB limit
                    child.kill();
                    reject(new Error('Command error output too large'));
                    return;
                }
                stderr += chunk;
            });
            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                }
                else {
                    reject(new Error(`Command failed with code ${code}: ${stderr.substring(0, 500)}`));
                }
            });
            child.on('error', (error) => {
                reject(new Error(`Command execution error: ${error.message}`));
            });
            // Additional timeout safeguard
            setTimeout(() => {
                if (!child.killed) {
                    child.kill('SIGKILL');
                    reject(new Error('Command timeout - forcefully terminated'));
                }
            }, 35000);
        });
    }
    /**
     * Sanitize command input to prevent injection
     */
    sanitizeCommandInput(input) {
        if (typeof input !== 'string') {
            throw new Error('Command input must be a string');
        }
        // Remove null bytes and control characters
        let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        // Remove potential shell metacharacters for extra safety
        sanitized = sanitized.replace(/[;&|`$(){}[\]\\]/g, '');
        // Trim whitespace
        sanitized = sanitized.trim();
        if (sanitized.length === 0) {
            throw new Error('Command cannot be empty after sanitization');
        }
        if (sanitized.length > 255) {
            throw new Error('Command too long');
        }
        return sanitized;
    }
    /**
     * Additional security validation for commands
     */
    validateCommandSecurity(command, args) {
        // Check for path traversal attempts
        if (command.includes('..') || args.some(arg => arg.includes('..'))) {
            throw new Error('Path traversal attempt detected');
        }
        // Check for suspicious patterns
        const suspiciousPatterns = [
            /rm\s+-rf/i,
            /sudo/i,
            /su\s+/i,
            /chmod\s+\+x/i,
            /curl.*\|.*sh/i,
            /wget.*\|.*sh/i,
            /nc\s+.*-e/i, // netcat backdoor
            /python.*-c/i, // python one-liners can be dangerous
            /eval/i,
            /exec/i
        ];
        const fullCommand = [command, ...args].join(' ');
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(fullCommand)) {
                throw new Error(`Suspicious command pattern detected: ${pattern.source}`);
            }
        }
        // Limit number of arguments
        if (args.length > 20) {
            throw new Error('Too many command arguments');
        }
    }
    /**
     * Get safe current working directory
     */
    getSafeCwd() {
        try {
            const cwd = process.cwd();
            // Ensure we're not in a sensitive directory
            const sensitivePaths = ['/etc', '/usr/bin', '/bin', '/sbin', '/root'];
            if (sensitivePaths.some(path => cwd.startsWith(path))) {
                return process.env.HOME || '/tmp';
            }
            return cwd;
        }
        catch {
            return '/tmp';
        }
    }
    /**
     * Get safe environment variables
     */
    getSafeEnvironment() {
        const safeVars = ['PATH', 'HOME', 'USER', 'PWD', 'LANG', 'LC_ALL'];
        const safeEnv = {};
        for (const varName of safeVars) {
            if (process.env[varName]) {
                safeEnv[varName] = process.env[varName];
            }
        }
        return safeEnv;
    }
    /**
     * Git operations
     */
    async gitStatus() {
        if (!this.config.git.enabled) {
            throw new Error('Git server not enabled');
        }
        return await this.executeCommandSecure('git', ['status', '--porcelain']);
    }
    async gitAdd(files) {
        if (!this.config.git.enabled) {
            throw new Error('Git server not enabled');
        }
        return await this.executeCommandSecure('git', ['add', ...files]);
    }
    async gitCommit(message) {
        if (!this.config.git.enabled) {
            throw new Error('Git server not enabled');
        }
        if (this.config.git.safeModeEnabled && !message.trim()) {
            throw new Error('Commit message required in safe mode');
        }
        return await this.executeCommandSecure('git', ['commit', '-m', message]);
    }
    /**
     * Package manager operations
     */
    async installPackage(packageName, dev = false) {
        if (!this.config.packageManager.enabled) {
            throw new Error('Package manager server not enabled');
        }
        if (!this.config.packageManager.autoInstall) {
            throw new Error('Auto-install disabled. Manual confirmation required.');
        }
        const args = ['install', packageName];
        if (dev)
            args.push('--save-dev');
        return await this.executeCommandSecure('npm', args);
    }
    async runScript(scriptName) {
        if (!this.config.packageManager.enabled) {
            throw new Error('Package manager server not enabled');
        }
        return await this.executeCommandSecure('npm', ['run', scriptName]);
    }
    /**
     * Smithery web search
     */
    async smitheryWebSearch(query, numResults = 10) {
        if (!this.config.smithery?.enabled) {
            throw new Error('Smithery server not enabled');
        }
        if (!this.config.smithery?.apiKey || !this.config.smithery?.profile) {
            throw new Error('Smithery API key and profile not configured');
        }
        try {
            const response = await axios.get(`${this.config.smithery.baseUrl}/exa/mcp`, {
                params: {
                    api_key: this.config.smithery.apiKey,
                    profile: this.config.smithery.profile
                },
                headers: {
                    'Accept': 'application/json'
                }
            });
            return {
                query,
                results: response.data,
                numResults
            };
        }
        catch (error) {
            throw new Error(`Smithery web search failed: ${error.message || 'Unknown error'}`);
        }
    }
    // Security and validation methods
    /**
     * Check if a file path is allowed
     */
    isPathAllowed(filePath) {
        const normalizedPath = join(process.cwd(), filePath);
        // Check restricted paths
        for (const restrictedPath of this.config.filesystem.restrictedPaths) {
            if (normalizedPath.startsWith(restrictedPath)) {
                return false;
            }
        }
        // Check allowed paths
        if (this.config.filesystem.allowedPaths.length > 0) {
            for (const allowedPath of this.config.filesystem.allowedPaths) {
                const expandedPath = allowedPath.replace('~/', process.env.HOME + '/');
                if (normalizedPath.startsWith(expandedPath)) {
                    return true;
                }
            }
            return false; // Not in any allowed path
        }
        return true; // No restrictions
    }
    /**
     * Check if a command is allowed
     */
    isCommandAllowed(command) {
        // Check blocked commands
        for (const blockedCommand of this.config.terminal.blockedCommands) {
            if (command.includes(blockedCommand)) {
                return false;
            }
        }
        // Check allowed commands
        if (this.config.terminal.allowedCommands.length > 0) {
            return this.config.terminal.allowedCommands.some(allowedCommand => command.startsWith(allowedCommand));
        }
        return true; // No restrictions
    }
    /**
     * Health check for all servers
     */
    async healthCheck() {
        const health = {};
        for (const [name, server] of this.servers) {
            health[name] = {
                enabled: server.enabled,
                status: server.status,
                lastError: server.lastError
            };
        }
        return health;
    }
}
//# sourceMappingURL=mcp-server-manager.js.map