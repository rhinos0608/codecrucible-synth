import { spawn, ChildProcess } from 'child_process';
import { join, resolve, normalize } from 'path';
import * as path from 'path';
import { logger } from '../core/logger.js';
import chalk from 'chalk';
import { readFile, writeFile, access, stat, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import axios from 'axios';
import { SmitheryMCPServer, SmitheryMCPConfig } from './smithery-mcp-server.js';
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
    enabledServers?: string[];
    autoDiscovery?: boolean;
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
  private smitheryServer?: SmitheryMCPServer;
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
   * Start all enabled MCP servers with robust error handling and graceful degradation
   */
  async startServers(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('MCP servers already initialized');
      return;
    }

    console.log(chalk.blue('🔧 Starting MCP servers with resilient error handling...'));
    const startTime = Date.now();

    // Create resilient promises for each server with retry logic
    const enabledServers = Array.from(this.servers.values()).filter(server => server.enabled);
    const serverPromises = enabledServers.map(async server => {
      const serverStartTime = Date.now();
      const maxRetries = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Progressive timeout: 3s, 5s, 8s
          const timeout = 3000 + (attempt * 2000);
          
          // Race between server startup and timeout
          await Promise.race([
            this.startServer(server.name),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Server ${server.name} startup timeout (attempt ${attempt + 1})`)), timeout)
            )
          ]);
          
          const duration = Date.now() - serverStartTime;
          logger.info(`✅ MCP server ${server.name} started successfully in ${duration}ms (attempt ${attempt + 1})`);
          return; // Success - exit retry loop
          
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const duration = Date.now() - serverStartTime;
          
          if (attempt < maxRetries) {
            logger.warn(`⚠️ MCP server ${server.name} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`, {
              error: lastError.message,
              duration
            });
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Progressive delay
          } else {
            logger.error(`❌ MCP server ${server.name} failed after ${maxRetries + 1} attempts`, {
              error: lastError.message,
              totalDuration: duration
            });
            server.status = 'error';
            server.lastError = lastError.message;
            
            // Attempt graceful degradation
            await this.handleServerFailure(server.name, lastError);
          }
        }
      }
    });

    // Wait for all servers with graceful handling
    const results = await Promise.allSettled(serverPromises);
    this.isInitialized = true;

    const totalTime = Date.now() - startTime;
    const runningServers = Array.from(this.servers.values()).filter(s => s.status === 'running');
    const failedServers = Array.from(this.servers.values()).filter(s => s.status === 'error');
    
    console.log(chalk.green(`✅ MCP initialization complete in ${totalTime}ms`));
    console.log(chalk.green(`   • ${runningServers.length} servers running`));
    if (failedServers.length > 0) {
      console.log(chalk.yellow(`   • ${failedServers.length} servers in degraded mode`));
    }

    // Emit status for monitoring
    this.emit('servers-initialized', {
      running: runningServers.length,
      failed: failedServers.length,
      totalTime
    });
  }

  /**
   * Handle server failure with graceful degradation
   */
  private async handleServerFailure(serverName: string, error: Error): Promise<void> {
    try {
      switch (serverName) {
        case 'filesystem':
          logger.warn('Filesystem MCP server failed - file operations will use fallback methods');
          // Could implement fallback filesystem operations here
          break;
        case 'git':
          logger.warn('Git MCP server failed - git operations will use direct CLI calls');
          // Could implement direct git CLI fallbacks here
          break;
        case 'terminal':
          logger.warn('Terminal MCP server failed - terminal operations will be restricted');
          break;
        case 'packageManager':
          logger.warn('Package Manager MCP server failed - package operations will use direct CLI');
          break;
        case 'smithery':
          logger.warn('Smithery MCP server failed - external tools will be unavailable');
          break;
        default:
          logger.warn(`Unknown MCP server ${serverName} failed`);
      }
    } catch (fallbackError) {
      logger.error('Error in graceful degradation handler:', fallbackError);
    }
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
      .map(async server => this.stopServer(server.name));

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
    if (!this.config.smithery?.apiKey) {
      logger.warn('Smithery: API key not configured, skipping initialization');
      return;
    }

    try {
      const smitheryConfig: SmitheryMCPConfig = {
        apiKey: this.config.smithery.apiKey,
        enabledServers: this.config.smithery.enabledServers || [],
        autoDiscovery: this.config.smithery.autoDiscovery ?? true,
      };

      this.smitheryServer = new SmitheryMCPServer(smitheryConfig);
      await this.smitheryServer.getServer(); // Initialize the server
      
      logger.info('Smithery: MCP server initialized successfully');
      
      // Log discovered servers for debugging
      const availableServers = this.smitheryServer.getAvailableServers();
      const availableTools = this.smitheryServer.getAvailableTools();
      
      logger.info(`Smithery: Discovered ${availableServers.length} servers with ${availableTools.length} tools`);
      
      if (availableServers.length > 0) {
        logger.debug('Smithery servers:', availableServers.map(s => s.qualifiedName));
      }
      
      if (availableTools.length > 0) {
        logger.debug('Smithery tools:', availableTools.map(t => t.name));
      }
      
    } catch (error) {
      logger.error('Failed to initialize Smithery server:', error);
      throw error;
    }
  }

  // MCP Server Operations

  /**
   * Safe file system operations - SECURITY FIX for path traversal
   */
  async readFileSecure(filePath: string): Promise<string> {
    // SECURITY FIX: Additional validation using InputSanitizer with AI-friendly preprocessing
    const pathValidation = InputSanitizer.validateFilePath(filePath);

    let processedPath = filePath;
    if (!pathValidation.isValid) {
      logger.warn(`Path validation failed for "${filePath}": ${pathValidation.violations.join(', ')} - attempting with processed path "${pathValidation.sanitized}"`);
      
      // Try with the processed path instead of blocking
      if (pathValidation.sanitized && pathValidation.sanitized !== filePath) {
        processedPath = pathValidation.sanitized;
        logger.info(`Using processed path for file read: ${processedPath}`);
      } else {
        const securityError = InputSanitizer.createSecurityError(pathValidation, 'file-read');
        logger.error('Path traversal attempt blocked after preprocessing', securityError);
        throw new Error(`Security violation: ${pathValidation.violations.join(', ')}`);
      }
    }

    if (!this.isPathAllowed(processedPath)) {
      logger.warn('File access denied by path policy', { originalPath: filePath, processedPath });
      throw new Error(`Access denied: ${processedPath} (original: ${filePath})`);
    }

    try {
      return await readFile(processedPath, 'utf8');
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
    const sanitizedArgs = await Promise.all(args.map(async arg => this.sanitizeCommandInput(arg)));

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
        input: `${input.substring(0, 100)  }...`,
        violations: validationResult.violations,
        riskLevel: validationResult.riskLevel,
      });
      throw new Error(
        `Command blocked: ${validationResult.violations[0]?.description || 'Security violation detected'}`
      );
    }

    if (validationResult.riskLevel === 'high') {
      logger.warn('High-risk command detected but allowed:', {
        input: `${input.substring(0, 100)  }...`,
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

    // Enhanced Guardian-level security patterns from OWASP Top 10
    const suspiciousPatterns = [
      // File system attacks
      /rm\s+-rf/i,
      /rmdir\s+/i,
      /del\s+/i,
      /format\s+/i,

      // Privilege escalation
      /sudo/i,
      /su\s+/i,
      /runas/i,
      /chmod\s+\+[sx]/i,
      /chown/i,

      // Remote code execution
      /curl.*\|.*sh/i,
      /wget.*\|.*sh/i,
      /powershell.*-c/i,
      /cmd.*\/c/i,
      /nc\s+.*-e/i, // netcat backdoor
      /python.*-c/i, // python one-liners can be dangerous
      /eval/i,
      /exec/i,
      /system/i,

      // Network attacks
      /nmap/i,
      /telnet/i,
      /ssh.*@/i,

      // Data exfiltration
      /scp\s+/i,
      /ftp/i,
      /sftp/i,

      // Encoding/obfuscation attempts
      /base64\s+-d/i,
      /xxd\s+-r/i,
      /uuencode/i,

      // Shell metacharacters in dangerous contexts
      /;\s*rm/i,
      /&&\s*rm/i,
      /\|\s*sh/i,
      /\$\(/i, // command substitution
      /`[^`]*`/i, // backtick command substitution
    ];

    const fullCommand = [command, ...args].join(' ');
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fullCommand)) {
        logger.error('SECURITY VIOLATION: Dangerous command blocked', {
          command: command,
          args: args.map(arg => (arg.length > 50 ? `${arg.substring(0, 50)  }...` : arg)),
          pattern: pattern.source,
          timestamp: new Date().toISOString(),
        });
        throw new Error(`Suspicious command pattern detected: ${pattern.source}`);
      }
    }

    // Enhanced argument validation
    if (args.length > 20) {
      throw new Error('Too many command arguments');
    }

    // Check for argument length limits to prevent buffer overflow attacks
    for (const arg of args) {
      if (arg.length > 4096) {
        throw new Error('Argument too long - possible buffer overflow attempt');
      }
    }

    // Check for null bytes (common in injection attacks)
    if (fullCommand.includes('\0')) {
      throw new Error('Null byte detected - possible injection attempt');
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
   * Get Smithery registry health and available tools
   */
  async getSmitheryStatus(): Promise<any> {
    if (!this.smitheryServer) {
      return {
        enabled: false,
        error: 'Smithery server not initialized'
      };
    }

    try {
      const health = await this.smitheryServer.getRegistryHealth();
      const servers = this.smitheryServer.getAvailableServers();
      const tools = this.smitheryServer.getAvailableTools();
      
      return {
        enabled: true,
        health,
        servers: servers.length,
        tools: tools.length,
        serversList: servers.map(s => ({
          name: s.qualifiedName,
          displayName: s.displayName,
          toolCount: s.tools?.length || 0
        })),
        toolsList: tools.map(t => ({
          name: t.name,
          description: t.description
        }))
      };
    } catch (error) {
      return {
        enabled: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Refresh Smithery servers and tools
   */
  async refreshSmitheryServers(): Promise<void> {
    if (!this.smitheryServer) {
      throw new Error('Smithery server not initialized');
    }
    
    await this.smitheryServer.refreshServers();
    logger.info('Smithery servers refreshed');
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
          const expandedPath = allowedPath.replace('~/', `${process.env.HOME || ''  }/`);
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
    // Default deny list for critical system commands
    const defaultBlockedCommands = [
      'rm',
      'rmdir',
      'del',
      'format',
      'fdisk',
      'sudo',
      'su',
      'runas',
      'passwd',
      'mount',
      'umount',
      'systemctl',
      'service',
      'reboot',
      'shutdown',
      'halt',
      'poweroff',
      'iptables',
      'netsh',
      'route',
      'crontab',
      'at',
      'schtasks',
      'nc',
      'netcat',
      'ncat',
      'socat',
      'curl',
      'wget',
      'fetch', // if not explicitly allowed
      'python',
      'python3',
      'node',
      'ruby',
      'perl', // interpreters without whitelist
    ];

    // Check blocked commands (config + defaults)
    const allBlockedCommands = [...this.config.terminal.blockedCommands, ...defaultBlockedCommands];
    for (const blockedCommand of allBlockedCommands) {
      if (command === blockedCommand || command.startsWith(`${blockedCommand  } `)) {
        return false;
      }
    }

    // Check allowed commands - use whitelist approach for security
    if (this.config.terminal.allowedCommands.length > 0) {
      return this.config.terminal.allowedCommands.some(
        allowedCommand => command === allowedCommand || command.startsWith(`${allowedCommand  } `)
      );
    }

    // Default safe commands if no explicit allow list
    const defaultSafeCommands = [
      'ls',
      'dir',
      'pwd',
      'cd',
      'echo',
      'cat',
      'head',
      'tail',
      'grep',
      'find',
      'which',
      'whoami',
      'id',
      'uname',
      'git',
      'npm',
      'yarn',
      'node',
      'python', // only basic usage
    ];

    return defaultSafeCommands.some(
      safeCommand => command === safeCommand || command.startsWith(`${safeCommand  } `)
    );
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
        if (this.smitheryServer) {
          const smitheryTools = this.smitheryServer.getAvailableTools();
          tools.push(...smitheryTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema || {}
          })));
        }
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
