/**
 * Cross-Platform Search Compatibility Module
 *
 * @description Provides unified search interface across Windows, macOS, and Linux
 * with platform-specific optimizations and tool detection
 */

import { platform, arch } from 'os';
import { spawn, SpawnOptions } from 'child_process';
import { join, normalize } from 'path';
import { logger } from '../logger.js';

interface SearchResult {
  file: string;
  line: number;
  column?: number;
  content: string;
  match?: string;
}

/**
 * Platform-specific search tool configuration
 */
export interface PlatformSearchTools {
  primaryTool: string; // Main search tool (ripgrep, etc.)
  fallbackTools: string[]; // Fallback options
  systemCommands: {
    find: string; // File finder command
    grep: string; // Text search command
    fileList: string; // Directory listing command
    processFilter: string; // Process filtering command
  };
  pathSeparator: string;
  caseSensitive: boolean; // Default case sensitivity
  shellOptions: {
    shell: string;
    shellArgs: string[];
  };
}

/**
 * Cross-platform search execution options
 */
export interface CrossPlatformSearchOptions {
  query: string;
  directory?: string;
  fileTypes?: string[];
  excludePaths?: string[];
  caseSensitive?: boolean;
  maxDepth?: number;
  timeout?: number;
  useSystemTools?: boolean; // Force system tools vs third-party
  preferPerformance?: boolean; // Optimize for speed vs accuracy
}

/**
 * Platform detection and configuration
 */
export class PlatformDetector {
  private static instance?: PlatformDetector;
  private platformConfig?: PlatformSearchTools;
  private toolAvailability: Map<string, boolean> = new Map();

  static getInstance(): PlatformDetector {
    if (!this.instance) {
      this.instance = new PlatformDetector();
    }
    return this.instance;
  }

  private constructor() {
    this.initializePlatformConfig();
  }

  /**
   * Initialize platform-specific configuration
   */
  private initializePlatformConfig(): void {
    const currentPlatform = platform();

    switch (currentPlatform) {
      case 'win32':
        this.platformConfig = this.getWindowsConfig();
        break;
      case 'darwin':
        this.platformConfig = this.getMacOSConfig();
        break;
      case 'linux':
        this.platformConfig = this.getLinuxConfig();
        break;
      default:
        logger.warn(`Unsupported platform: ${currentPlatform}, using Linux defaults`);
        this.platformConfig = this.getLinuxConfig();
    }

    logger.info(`Platform configuration initialized for ${currentPlatform}`);
  }

  /**
   * Windows-specific search tool configuration
   */
  private getWindowsConfig(): PlatformSearchTools {
    return {
      primaryTool: 'rg', // ripgrep
      fallbackTools: ['findstr', 'powershell'],
      systemCommands: {
        find: 'where',
        grep: 'findstr',
        fileList: 'dir',
        processFilter: 'findstr',
      },
      pathSeparator: '\\',
      caseSensitive: false, // Windows is case-insensitive by default
      shellOptions: {
        shell: 'cmd',
        shellArgs: ['/c'],
      },
    };
  }

  /**
   * macOS-specific search tool configuration
   */
  private getMacOSConfig(): PlatformSearchTools {
    return {
      primaryTool: 'rg', // ripgrep
      fallbackTools: ['ag', 'grep', 'find'],
      systemCommands: {
        find: 'find',
        grep: 'grep',
        fileList: 'ls',
        processFilter: 'grep',
      },
      pathSeparator: '/',
      caseSensitive: true,
      shellOptions: {
        shell: '/bin/bash',
        shellArgs: ['-c'],
      },
    };
  }

  /**
   * Linux-specific search tool configuration
   */
  private getLinuxConfig(): PlatformSearchTools {
    return {
      primaryTool: 'rg', // ripgrep
      fallbackTools: ['ag', 'ack', 'grep', 'find'],
      systemCommands: {
        find: 'find',
        grep: 'grep',
        fileList: 'ls',
        processFilter: 'grep',
      },
      pathSeparator: '/',
      caseSensitive: true,
      shellOptions: {
        shell: '/bin/bash',
        shellArgs: ['-c'],
      },
    };
  }

  /**
   * Get platform configuration
   */
  getPlatformConfig(): PlatformSearchTools {
    if (!this.platformConfig) {
      throw new Error('Platform configuration not initialized');
    }
    return this.platformConfig;
  }

  /**
   * Check if a search tool is available on the system
   */
  async isToolAvailable(toolName: string): Promise<boolean> {
    // Check cache first
    if (this.toolAvailability.has(toolName)) {
      return this.toolAvailability.get(toolName) ?? false;
    }

    try {
      const _config = this.getPlatformConfig();
      const checkCommand = platform() === 'win32' ? 'where' : 'which';

      const result = await this.executeCommand(checkCommand, [toolName], {
        timeout: 5000,
        stdio: 'pipe',
      });

      const isAvailable = result.exitCode === 0;
      this.toolAvailability.set(toolName, isAvailable);

      return isAvailable;
    } catch (error) {
      logger.debug(`Tool availability check failed for ${toolName}:`, error);
      this.toolAvailability.set(toolName, false);
      return false;
    }
  }

  /**
   * Get best available search tool for current platform
   */
  async getBestSearchTool(): Promise<string> {
    const config = this.getPlatformConfig();

    // Check primary tool first
    if (await this.isToolAvailable(config.primaryTool)) {
      return config.primaryTool;
    }

    // Try fallback tools
    for (const tool of config.fallbackTools) {
      if (await this.isToolAvailable(tool)) {
        logger.info(`Using fallback search tool: ${tool}`);
        return tool;
      }
    }

    // If no tools available, throw error
    throw new Error(`No search tools available on ${platform()}`);
  }

  /**
   * Execute command with platform-specific options
   */
  async executeCommand(
    command: string,
    args: string[],
    options: { timeout?: number; stdio?: string; cwd?: string } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const config = this.getPlatformConfig();

    return new Promise((resolve, reject) => {
      const spawnOptions: SpawnOptions = {
        shell: config.shellOptions.shell,
        stdio: (options.stdio as 'pipe' | 'inherit' | undefined) ?? 'pipe',
        cwd: options.cwd ?? process.cwd(),
        timeout: options.timeout ?? 30000,
      };

      // On Windows, adjust command execution
      if (platform() === 'win32') {
        // Use cmd for better compatibility
        spawnOptions.shell = 'cmd';
      }

      const child = spawn(command, args, spawnOptions);

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', data => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', data => {
          stderr += data.toString();
        });
      }

      child.on('close', code => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });

      child.on('error', error => {
        reject(error);
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timeout after ${options.timeout}ms`));
        }, options.timeout);
      }
    });
  }
}

/**
 * Cross-platform search command builder
 */
export class CrossPlatformSearchCommandBuilder {
  private platformDetector: PlatformDetector;

  constructor() {
    this.platformDetector = PlatformDetector.getInstance();
  }

  /**
   * Build ripgrep command for cross-platform execution
   */
  buildRipgrepCommand(options: CrossPlatformSearchOptions): { command: string; args: string[] } {
    const args: string[] = [];

    // Base ripgrep arguments
    args.push('--json'); // JSON output for easier parsing
    args.push('--with-filename');
    args.push('--line-number');

    // Case sensitivity
    if (options.caseSensitive !== undefined) {
      args.push(options.caseSensitive ? '--case-sensitive' : '--ignore-case');
    }

    // File type filtering
    if (options.fileTypes && options.fileTypes.length > 0) {
      options.fileTypes.forEach(type => {
        args.push('--type', type);
      });
    }

    // Path exclusions
    if (options.excludePaths && options.excludePaths.length > 0) {
      options.excludePaths.forEach(path => {
        // Normalize paths for current platform
        const normalizedPath = this.normalizePath(path);
        args.push('--glob', `!${normalizedPath}`);
      });
    }

    // Max depth
    if (options.maxDepth) {
      args.push('--max-depth', options.maxDepth.toString());
    }

    // Add the search query
    args.push(options.query);

    // Add search directory
    if (options.directory) {
      args.push(this.normalizePath(options.directory));
    }

    return { command: 'rg', args };
  }

  /**
   * Build find command for cross-platform execution
   */
  buildFindCommand(options: CrossPlatformSearchOptions): { command: string; args: string[] } {
    const _config = this.platformDetector.getPlatformConfig();
    const _args: string[] = [];

    if (platform() === 'win32') {
      // Windows findstr command
      return this.buildWindowsFindCommand(options);
    } else {
      // Unix find + grep combination
      return this.buildUnixFindCommand(options);
    }
  }

  /**
   * Build Windows-specific find command using findstr
   */
  buildWindowsFindCommand(options: CrossPlatformSearchOptions): {
    command: string;
    args: string[];
  } {
    const args: string[] = [];

    // Basic findstr options
    args.push('/S'); // Search subdirectories
    args.push('/N'); // Show line numbers

    if (!options.caseSensitive) {
      args.push('/I'); // Case insensitive
    }

    // Add pattern
    args.push(`"${options.query}"`);

    // Add search path with file pattern
    const searchPath = options.directory ?? '.';
    const filePattern = options.fileTypes?.length
      ? options.fileTypes.map(ext => `*.${ext}`).join(' ')
      : '*.*';

    args.push(`"${join(searchPath, filePattern)}"`);

    return { command: 'findstr', args };
  }

  /**
   * Build Unix-specific find command with grep
   */
  buildUnixFindCommand(options: CrossPlatformSearchOptions): { command: string; args: string[] } {
    // This builds a complex find + grep pipeline
    const searchPath = options.directory ?? '.';
    const query = options.query;

    // Build find command for files
    const findArgs = [searchPath, '-type', 'f'];

    // Add file type filters
    if (options.fileTypes && options.fileTypes.length > 0) {
      const nameFilters = options.fileTypes.map(ext => `-name "*.${ext}"`);
      findArgs.push('\\(', ...nameFilters.join(' -o ').split(' '), '\\)');
    }

    // Add exclusions
    if (options.excludePaths && options.excludePaths.length > 0) {
      options.excludePaths.forEach(path => {
        findArgs.push('!', '-path', `"*${path}*"`);
      });
    }

    // Max depth
    if (options.maxDepth) {
      findArgs.splice(2, 0, '-maxdepth', options.maxDepth.toString());
    }

    // Pipe to grep
    const grepFlags = options.caseSensitive ? '-n' : '-ni';
    const command = `find ${findArgs.join(' ')} -exec grep ${grepFlags} "${query}" {} +`;

    return { command: 'bash', args: ['-c', command] };
  }

  /**
   * Build PowerShell command for Windows (alternative approach)
   */
  buildPowerShellCommand(options: CrossPlatformSearchOptions): { command: string; args: string[] } {
    const searchPath = options.directory ?? '.';
    const query = options.query.replace(/"/g, '""'); // Escape quotes

    // Build PowerShell script
    let script = `Get-ChildItem -Path "${searchPath}" -Recurse`;

    // Add file type filters
    if (options.fileTypes && options.fileTypes.length > 0) {
      const includes = options.fileTypes.map(ext => `"*.${ext}"`).join(',');
      script += ` -Include ${includes}`;
    }

    // Add exclusions
    if (options.excludePaths && options.excludePaths.length > 0) {
      const excludes = options.excludePaths.map(path => `"*${path}*"`).join(',');
      script += ` -Exclude ${excludes}`;
    }

    // Pipe to Select-String
    script += ` | Select-String -Pattern "${query}"`;

    if (!options.caseSensitive) {
      script += ' -CaseSensitive:$false';
    }

    script += ' | Select-Object -Property LineNumber,Filename,Line';

    return {
      command: 'powershell',
      args: ['-NoProfile', '-Command', script],
    };
  }

  /**
   * Normalize file paths for current platform
   */
  private normalizePath(path: string): string {
    const config = this.platformDetector.getPlatformConfig();
    return normalize(path.replace(/[/\\]/g, config.pathSeparator));
  }
}

/**
 * Main cross-platform search executor
 */
export class CrossPlatformSearchExecutor {
  private platformDetector: PlatformDetector;
  private commandBuilder: CrossPlatformSearchCommandBuilder;

  constructor() {
    this.platformDetector = PlatformDetector.getInstance();
    this.commandBuilder = new CrossPlatformSearchCommandBuilder();
  }

  /**
   * Execute search with automatic platform detection and tool selection
   */
  async executeSearch(options: CrossPlatformSearchOptions): Promise<SearchResult[]> {
    try {
      // Try ripgrep first (best performance)
      if (await this.platformDetector.isToolAvailable('rg')) {
        return await this.executeRipgrepSearch(options);
      }

      // Fall back to platform-specific tools
      if (platform() === 'win32') {
        // Try PowerShell, then findstr
        if (await this.platformDetector.isToolAvailable('powershell')) {
          return await this.executePowerShellSearch(options);
        } else {
          return await this.executeFindstrSearch(options);
        }
      } else {
        // Try ag, then find+grep
        if (await this.platformDetector.isToolAvailable('ag')) {
          return await this.executeSilverSearcherSearch(options);
        } else {
          return await this.executeFindGrepSearch(options);
        }
      }
    } catch (error) {
      logger.error('Cross-platform search failed:', error);
      throw error;
    }
  }

  /**
   * Execute ripgrep search (preferred method)
   */
  private async executeRipgrepSearch(options: CrossPlatformSearchOptions): Promise<SearchResult[]> {
    const { command, args } = this.commandBuilder.buildRipgrepCommand(options);
    const result = await this.platformDetector.executeCommand(command, args, {
      timeout: options.timeout,
    });

    if (result.exitCode !== 0 && result.stderr) {
      throw new Error(`Ripgrep failed: ${result.stderr}`);
    }

    return this.parseRipgrepOutput(result.stdout);
  }

  /**
   * Execute PowerShell search (Windows)
   */
  private async executePowerShellSearch(options: CrossPlatformSearchOptions): Promise<SearchResult[]> {
    const { command, args } = this.commandBuilder.buildPowerShellCommand(options);
    const result = await this.platformDetector.executeCommand(command, args, {
      timeout: options.timeout,
    });

    if (result.exitCode !== 0 && result.stderr) {
      throw new Error(`PowerShell search failed: ${result.stderr}`);
    }

    return this.parsePowerShellOutput(result.stdout);
  }

  /**
   * Execute findstr search (Windows fallback)
   */
  private async executeFindstrSearch(options: CrossPlatformSearchOptions): Promise<SearchResult[]> {
    const { command, args } = this.commandBuilder.buildWindowsFindCommand(options);
    const result = await this.platformDetector.executeCommand(command, args, {
      timeout: options.timeout,
    });

    return this.parseFindstrOutput(result.stdout);
  }

  /**
   * Execute Silver Searcher (ag) search (Unix)
   */
  private async executeSilverSearcherSearch(options: CrossPlatformSearchOptions): Promise<SearchResult[]> {
    // Similar to ripgrep but with ag command
    const args = ['--json', '--numbers', '--filename'];

    if (options.caseSensitive === false) {
      args.push('--ignore-case');
    }

    args.push(options.query);

    if (options.directory) {
      args.push(options.directory);
    }

    const result = await this.platformDetector.executeCommand('ag', args, {
      timeout: options.timeout,
    });

    return this.parseAgOutput(result.stdout);
  }

  /**
   * Execute find + grep search (Unix fallback)
   */
  private async executeFindGrepSearch(options: CrossPlatformSearchOptions): Promise<SearchResult[]> {
    const { command, args } = this.commandBuilder.buildUnixFindCommand(options);
    const result = await this.platformDetector.executeCommand(command, args, {
      timeout: options.timeout,
    });

    return this.parseFindGrepOutput(result.stdout);
  }

  /**
   * Parse ripgrep JSON output
   */
  private parseRipgrepOutput(output: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'match') {
          results.push({
            file: parsed.data.path.text,
            line: parsed.data.line_number,
            content: parsed.data.lines.text.trim(),
            match: parsed.data.lines.text.trim(),
            column: parsed.data.submatches?.[0]?.start ?? 0,
          });
        }
      } catch (e) {
        // Skip invalid JSON lines
        continue;
      }
    }

    return results;
  }

  /**
   * Parse PowerShell output
   */
  private parsePowerShellOutput(output: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      // PowerShell output format: LineNumber : Filename : Line
      const match = line.match(/^(\d+):([^:]+):(.+)$/);
      if (match) {
        results.push({
          file: match[2].trim(),
          line: parseInt(match[1], 10),
          content: match[3].trim(),
          match: match[3].trim(),
          column: 0,
        });
      }
    }

    return results;
  }

  /**
   * Parse findstr output
   */
  private parseFindstrOutput(output: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      // Findstr output format: filename:line:content
      const match = line.match(/^([^:]+):(\d+):(.+)$/);
      if (match) {
        results.push({
          file: match[1].trim(),
          line: parseInt(match[2], 10),
          content: match[3].trim(),
          match: match[3].trim(),
          column: 0,
        });
      }
    }

    return results;
  }

  /**
   * Parse ag (Silver Searcher) output
   */
  private parseAgOutput(output: string): SearchResult[] {
    // Similar to ripgrep JSON parsing
    return this.parseRipgrepOutput(output);
  }

  /**
   * Parse find + grep output
   */
  private parseFindGrepOutput(output: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      // find + grep output: filename:line:content
      const match = line.match(/^([^:]+):(\d+):(.+)$/);
      if (match) {
        results.push({
          file: match[1].trim(),
          line: parseInt(match[2], 10),
          content: match[3].trim(),
          match: match[3].trim(),
          column: 0,
        });
      }
    }

    return results;
  }

  /**
   * Get platform-specific search capabilities
   */
  async getSearchCapabilities(): Promise<{
    platform: string;
    architecture: string;
    availableTools: string[];
    preferredTool: string;
    supportedFeatures: string[];
  }> {
    const currentPlatform = platform();
    const currentArch = arch();
    const config = this.platformDetector.getPlatformConfig();

    // Check which tools are available
    const availableTools: string[] = [];
    const toolsToCheck = [config.primaryTool, ...config.fallbackTools];

    for (const tool of toolsToCheck) {
      if (await this.platformDetector.isToolAvailable(tool)) {
        availableTools.push(tool);
      }
    }

    const preferredTool = availableTools[0] ?? 'none';

    // Platform-specific features
    const supportedFeatures = ['text-search', 'file-filtering', 'path-exclusion'];

    if (currentPlatform === 'win32') {
      supportedFeatures.push('windows-path-handling', 'case-insensitive-default');
    } else {
      supportedFeatures.push('unix-permissions', 'symlink-following');
    }

    if (preferredTool === 'rg') {
      supportedFeatures.push('regex-search', 'json-output', 'fast-search');
    }

    return {
      platform: currentPlatform,
      architecture: currentArch,
      availableTools,
      preferredTool,
      supportedFeatures,
    };
  }
}
