import { spawn, ChildProcess } from 'child_process';
import { join, resolve, normalize } from 'path';
import * as path from 'path';
import { logger } from '../core/logger.js';
import chalk from 'chalk';
import { readFile, writeFile, access, stat, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import axios from 'axios';
import {
  AdvancedSecurityValidator,
  ValidationResult,
} from '../core/security/advanced-security-validator.js';
import { InputSanitizer } from '../core/security/input-sanitizer.js';

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
  id: string;
  name: string;
  process?: ChildProcess;
  enabled: boolean;
  status: 'stopped' | 'starting' | 'running' | 'error';
  lastError?: string;
  capabilities?: ServerCapabilities;
  performance?: PerformanceMetrics;
}

export interface ServerCapabilities {
  tools: ToolInfo[];
  resources: ResourceInfo[];
  prompts: PromptInfo[];
  lastDiscovered: Date;
}

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: any;
}

export interface ResourceInfo {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface PromptInfo {
  name: string;
  description?: string;
  arguments?: any[];
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  successRate: number;
  lastHealthCheck: Date;
  availability: number;
}

/**
 * MCP Server Manager
 *
 * Manages Model Context Protocol servers for extended functionality
 * Provides safe, sandboxed access to file system, git, terminal, and package management
 */
export class MCPServerManager {
  private config: MCPServerConfig;
  private servers: Map<string, MCPServer>;
  private isInitialized = false;
  private securityValidator: AdvancedSecurityValidator;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.servers = new Map();
    this.securityValidator = new AdvancedSecurityValidator({
      allowCodeExecution: false,
      allowFileAccess: true,
      allowNetworkAccess: false,
      requireSandbox: true,
      maxInputLength: 10000,
    });
    this.initializeServers();
  }

  /**
   * Initialize all enabled MCP servers
   */
  private initializeServers(): void {
    const serverConfigs = [
      { name: 'filesystem', enabled: this.config.filesystem.enabled },
      { name: 'git', enabled: this.config.git.enabled },
      { name: 'terminal', enabled: this.config.terminal.enabled },
      { name: 'packageManager', enabled: this.config.packageManager.enabled },
      { name: 'smithery', enabled: this.config.smithery?.enabled ?? false },
    ];

    serverConfigs.forEach(({ name, enabled }) => {
      this.servers.set(name, {
        id: name,
        name,
        enabled,
        status: 'stopped',
      });
    });

    logger.info(`Initialized ${this.servers.size} MCP servers`);
  }

  /**
   * Start all enabled MCP servers
   */
  async startServers(): Promise<void> {
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
  async startServer(serverName: string): Promise<void> {
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
    } catch (error) {
      server.status = 'error';
      server.lastError = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to start MCP server ${serverName}:`, error);
    }
  }

  /**
   * Initialize built-in MCP server functionality
   */
  private async initializeBuiltinServer(serverName: string): Promise<void> {
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
  async stopServers(): Promise<void> {
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
  async stopServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) return;

    try {
      if (server.process) {
        server.process.kill();
        server.process = undefined;
      }

      server.status = 'stopped';
      logger.info(`MCP server stopped: ${serverName}`);
    } catch (error) {
      logger.error(`Failed to stop MCP server ${serverName}:`, error);
    }
  }

  /**
   * Get server status
   */
  getServerStatus(serverName?: string): MCPServer | MCPServer[] {
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
  private async initializeFilesystemServer(): Promise<void> {
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
  private async initializeGitServer(): Promise<void> {
    // Check if we're in a git repository
    try {
      await access('.git');
      logger.info('Git: Repository detected');
    } catch {
      logger.warn('Git: No repository found in current directory');
    }
  }

  /**
   * Initialize terminal server functionality
   */
  private async initializeTerminalServer(): Promise<void> {
    logger.info(`Terminal: Allowed commands: ${this.config.terminal.allowedCommands.join(', ')}`);
    logger.info(`Terminal: Blocked commands: ${this.config.terminal.blockedCommands.join(', ')}`);
  }

  /**
   * Initialize package manager server functionality
   */
  private async initializePackageManagerServer(): Promise<void> {
    // Check for package.json
    try {
      await access('package.json');
      logger.info('PackageManager: package.json found');
    } catch {
      logger.warn('PackageManager: No package.json found');
    }
  }

  /**
   * Initialize Smithery MCP server functionality
   */
  private async initializeSmitheryServer(): Promise<void> {
    if (this.config.smithery?.apiKey && this.config.smithery?.profile) {
      logger.info('Smithery: API key and profile configured');
    } else {
      logger.warn('Smithery: API key and profile not configured');
    }
  }

  // MCP Server Operations

  /**
   * Safe file system operations - SECURITY FIX for path traversal
   */
  async readFileSecure(filePath: string): Promise<string> {
    // SECURITY FIX: Additional validation using InputSanitizer
    const pathValidation = InputSanitizer.validateFilePath(filePath);

    if (!pathValidation.isValid) {
      const securityError = InputSanitizer.createSecurityError(pathValidation, 'file-read');
      logger.error('Path traversal attempt blocked', securityError);
      throw new Error(`Security violation: ${pathValidation.violations.join(', ')}`);
    }

    if (!this.isPathAllowed(filePath)) {
      logger.warn('File access denied by path policy', { filePath });
      throw new Error(`Access denied: ${filePath}`);
    }

    try {
      return await readFile(filePath, 'utf8');
    } catch (error) {
      logger.error('File read operation failed', { filePath, error });
      throw new Error(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async writeFileSecure(filePath: string, content: string): Promise<void> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    try {
      await writeFile(filePath, content, 'utf8');
      logger.info(`File written: ${filePath}`);
    } catch (error) {
      throw new Error(
        `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listDirectorySecure(dirPath: string): Promise<string[]> {
    if (!this.isPathAllowed(dirPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    try {
      return await readdir(dirPath);
    } catch (error) {
      throw new Error(
        `Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getFileStats(filePath: string): Promise<{
    exists: boolean;
    isFile: boolean;
    isDirectory: boolean;
    size: number;
    modified: string;
  }> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    try {
      const stats = await stat(filePath);
      return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    } catch (error) {
      return {
        exists: false,
        isFile: false,
        isDirectory: false,
        size: 0,
        modified: '',
      };
    }
  }

  /**
   * Safe command execution with enhanced security
   */
  async executeCommandSecure(command: string, args: string[] = []): Promise<string> {
    // Input validation and sanitization
    const sanitizedCommand = await this.sanitizeCommandInput(command);
    const sanitizedArgs = await Promise.all(args.map(arg => this.sanitizeCommandInput(arg)));

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
        timeout: 30000, // Built-in timeout
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        // Limit output size to prevent memory exhaustion
        if (stdout.length + chunk.length > 1024 * 1024) {
          // 1MB limit
          child.kill();
          reject(new Error('Command output too large'));
          return;
        }
        stdout += chunk;
      });

      child.stderr?.on('data', data => {
        const chunk = data.toString();
        if (stderr.length + chunk.length > 1024 * 1024) {
          // 1MB limit
          child.kill();
          reject(new Error('Command error output too large'));
          return;
        }
        stderr += chunk;
      });

      child.on('close', code => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr.substring(0, 500)}`));
        }
      });

      child.on('error', error => {
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
  private async sanitizeCommandInput(input: string): Promise<string> {
    if (typeof input !== 'string') {
      throw new Error('Command input must be a string');
    }

    // Use the advanced security validator
    const validationResult: ValidationResult = await this.securityValidator.validateInput(
      input,
      'command'
    );

    if (!validationResult.isValid || validationResult.riskLevel === 'critical') {
      logger.warn('Command blocked due to security violations:', {
        input: input.substring(0, 100) + '...',
        violations: validationResult.violations,
        riskLevel: validationResult.riskLevel,
      });
      throw new Error(
        `Command blocked: ${validationResult.violations[0]?.description || 'Security violation detected'}`
      );
    }

    if (validationResult.riskLevel === 'high') {
      logger.warn('High-risk command detected but allowed:', {
        input: input.substring(0, 100) + '...',
        violations: validationResult.violations,
      });
    }

    // Use sanitized input from validator
    const sanitized = validationResult.sanitizedInput || input;

    if (sanitized.trim().length === 0) {
      throw new Error('Command cannot be empty after sanitization');
    }

    if (sanitized.length > 255) {
      throw new Error('Command too long');
    }

    return sanitized.trim();
  }

  /**
   * Additional security validation for commands
   */
  private validateCommandSecurity(command: string, args: string[]): void {
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
      /exec/i,
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
  private getSafeCwd(): string {
    try {
      const cwd = process.cwd();
      // Ensure we're not in a sensitive directory
      const sensitivePaths = ['/etc', '/usr/bin', '/bin', '/sbin', '/root'];
      if (sensitivePaths.some(path => cwd.startsWith(path))) {
        return process.env.HOME || '/tmp';
      }
      return cwd;
    } catch {
      return '/tmp';
    }
  }

  /**
   * Get safe environment variables
   */
  private getSafeEnvironment(): Record<string, string> {
    const safeVars = ['PATH', 'HOME', 'USER', 'PWD', 'LANG', 'LC_ALL'];
    const safeEnv: Record<string, string> = {};

    for (const varName of safeVars) {
      if (process.env[varName]) {
        safeEnv[varName] = process.env[varName]!;
      }
    }

    return safeEnv;
  }

  /**
   * Git operations
   */
  async gitStatus(): Promise<string> {
    if (!this.config.git.enabled) {
      throw new Error('Git server not enabled');
    }

    return await this.executeCommandSecure('git', ['status', '--porcelain']);
  }

  async gitAdd(files: string[]): Promise<string> {
    if (!this.config.git.enabled) {
      throw new Error('Git server not enabled');
    }

    return await this.executeCommandSecure('git', ['add', ...files]);
  }

  async gitCommit(message: string): Promise<string> {
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
  async installPackage(packageName: string, dev = false): Promise<string> {
    if (!this.config.packageManager.enabled) {
      throw new Error('Package manager server not enabled');
    }

    if (!this.config.packageManager.autoInstall) {
      throw new Error('Auto-install disabled. Manual confirmation required.');
    }

    const args = ['install', packageName];
    if (dev) args.push('--save-dev');

    return await this.executeCommandSecure('npm', args);
  }

  async runScript(scriptName: string): Promise<string> {
    if (!this.config.packageManager.enabled) {
      throw new Error('Package manager server not enabled');
    }

    return await this.executeCommandSecure('npm', ['run', scriptName]);
  }

  /**
   * Smithery web search
   */
  async smitheryWebSearch(query: string, numResults: number = 10): Promise<any> {
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
          profile: this.config.smithery.profile,
        },
        headers: {
          Accept: 'application/json',
        },
      });

      return {
        query,
        results: response.data,
        numResults,
      };
    } catch (error: any) {
      throw new Error(`Smithery web search failed: ${error.message || 'Unknown error'}`);
    }
  }

  // Security and validation methods

  /**
   * Check if a file path is allowed - SECURITY FIX for path traversal vulnerability
   */
  private isPathAllowed(filePath: string): boolean {
    try {
      // SECURITY FIX: Prevent path traversal attacks
      if (!filePath || typeof filePath !== 'string') {
        return false;
      }

      // Normalize and resolve the path to prevent traversal
      const resolvedPath = path.resolve(filePath);
      const cwd = process.cwd();

      // Check for directory traversal attempts
      if (filePath.includes('..') || filePath.includes('~')) {
        return false;
      }

      // Ensure the resolved path is within the current working directory or explicitly allowed paths
      const normalizedPath = path.normalize(resolvedPath);

      // Additional security checks
      if (normalizedPath.includes('\0')) {
        // Null byte injection
        return false;
      }

      // Check if path is outside project directory (unless explicitly allowed)
      if (!normalizedPath.startsWith(cwd)) {
        // Only allow if explicitly in allowed paths
        if (this.config.filesystem.allowedPaths.length === 0) {
          return false;
        }
      }

      // Check restricted paths first
      for (const restrictedPath of this.config.filesystem.restrictedPaths) {
        const resolvedRestricted = path.resolve(restrictedPath);
        if (normalizedPath.startsWith(resolvedRestricted)) {
          return false;
        }
      }

      // Check allowed paths if they exist
      if (this.config.filesystem.allowedPaths.length > 0) {
        for (const allowedPath of this.config.filesystem.allowedPaths) {
          const expandedPath = allowedPath.replace('~/', (process.env.HOME || '') + '/');
          const resolvedAllowed = path.resolve(expandedPath);
          if (normalizedPath.startsWith(resolvedAllowed)) {
            return true;
          }
        }
        return false; // Not in any allowed path
      }

      // Default: only allow paths within current working directory
      return normalizedPath.startsWith(cwd);
    } catch (error) {
      // If path resolution fails, deny access
      return false;
    }
  }

  /**
   * Check if a command is allowed
   */
  private isCommandAllowed(command: string): boolean {
    // Check blocked commands
    for (const blockedCommand of this.config.terminal.blockedCommands) {
      if (command.includes(blockedCommand)) {
        return false;
      }
    }

    // Check allowed commands
    if (this.config.terminal.allowedCommands.length > 0) {
      return this.config.terminal.allowedCommands.some(allowedCommand =>
        command.startsWith(allowedCommand)
      );
    }

    return true; // No restrictions
  }

  /**
   * Enhanced MCP capability discovery following Claude Code patterns
   */
  async listServers(): Promise<MCPServer[]> {
    return Array.from(this.servers.values());
  }

  async discoverServerCapabilities(serverId: string): Promise<ServerCapabilities | null> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'running') {
      return null;
    }

    try {
      // Discover capabilities based on server type
      const capabilities = await this.performCapabilityDiscovery(serverId);

      // Cache capabilities
      server.capabilities = capabilities;

      return capabilities;
    } catch (error) {
      logger.error(`Capability discovery failed for ${serverId}:`, error);
      return null;
    }
  }

  private async performCapabilityDiscovery(serverId: string): Promise<ServerCapabilities> {
    // Implement capability discovery based on server type
    const tools: ToolInfo[] = [];
    const resources: ResourceInfo[] = [];
    const prompts: PromptInfo[] = [];

    switch (serverId) {
      case 'filesystem':
        tools.push(
          {
            name: 'read_file',
            description: 'Read file contents securely',
            inputSchema: { path: 'string' },
          },
          {
            name: 'write_file',
            description: 'Write file contents securely',
            inputSchema: { path: 'string', content: 'string' },
          },
          {
            name: 'list_directory',
            description: 'List directory contents',
            inputSchema: { path: 'string' },
          }
        );
        break;

      case 'git':
        tools.push(
          { name: 'git_status', description: 'Get git repository status', inputSchema: {} },
          {
            name: 'git_add',
            description: 'Stage files for commit',
            inputSchema: { files: 'string[]' },
          },
          {
            name: 'git_commit',
            description: 'Commit staged changes',
            inputSchema: { message: 'string' },
          }
        );
        break;

      case 'terminal':
        tools.push({
          name: 'execute_command',
          description: 'Execute terminal command securely',
          inputSchema: { command: 'string', args: 'string[]' },
        });
        break;

      case 'packageManager':
        tools.push(
          {
            name: 'install_package',
            description: 'Install npm package',
            inputSchema: { packageName: 'string', dev: 'boolean' },
          },
          {
            name: 'run_script',
            description: 'Run npm script',
            inputSchema: { scriptName: 'string' },
          }
        );
        break;

      case 'smithery':
        tools.push({
          name: 'web_search',
          description: 'Search the web using Smithery',
          inputSchema: { query: 'string', numResults: 'number' },
        });
        break;
    }

    return {
      tools,
      resources,
      prompts,
      lastDiscovered: new Date(),
    };
  }

  /**
   * Health check for all servers with performance metrics
   */
  async healthCheck(): Promise<{ [key: string]: any }> {
    const health: { [key: string]: any } = {};

    for (const [name, server] of this.servers) {
      const startTime = Date.now();
      let isHealthy = false;

      try {
        // Perform health check based on server type
        await this.performHealthCheck(server);
        isHealthy = true;
      } catch (error) {
        // Health check failed
      }

      const responseTime = Date.now() - startTime;

      // Update performance metrics
      if (!server.performance) {
        server.performance = {
          avgResponseTime: responseTime,
          successRate: isHealthy ? 1 : 0,
          lastHealthCheck: new Date(),
          availability: isHealthy ? 1 : 0,
        };
      } else {
        // Update running averages
        server.performance.avgResponseTime =
          server.performance.avgResponseTime * 0.9 + responseTime * 0.1;
        server.performance.successRate =
          server.performance.successRate * 0.9 + (isHealthy ? 0.1 : 0);
        server.performance.lastHealthCheck = new Date();
        server.performance.availability =
          server.performance.availability * 0.95 + (isHealthy ? 0.05 : 0);
      }

      health[name] = {
        enabled: server.enabled,
        status: server.status,
        lastError: server.lastError,
        performance: server.performance,
        capabilities: server.capabilities
          ? {
              toolCount: server.capabilities.tools.length,
              resourceCount: server.capabilities.resources.length,
              promptCount: server.capabilities.prompts.length,
              lastDiscovered: server.capabilities.lastDiscovered,
            }
          : null,
      };
    }

    return health;
  }

  private async performHealthCheck(server: MCPServer): Promise<void> {
    // Simple health check - in production would be more sophisticated
    if (server.status !== 'running') {
      throw new Error('Server not running');
    }

    // Server-specific health checks could be added here
    switch (server.id) {
      case 'filesystem':
        // Check if we can access current directory
        await this.listDirectorySecure('.');
        break;
      case 'git':
        // Check if git is available (if in a git repo)
        try {
          await this.gitStatus();
        } catch (error) {
          // Git might not be available, which is OK
        }
        break;
      // Add other server-specific health checks as needed
    }
  }
}
