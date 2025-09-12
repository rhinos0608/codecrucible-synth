import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Dynamic project path resolution utility
 * Handles cross-platform path resolution without hardcoded paths
 */
export class ProjectPaths {
  private static _projectRoot: string | null = null;
  private static _isInitialized = false;

  /**
   * Get the project root directory dynamically
   * Works by finding package.json or falling back to cwd
   */
  public static resolveProjectRoot(): string {
    if (this._projectRoot && this._isInitialized) {
      return this._projectRoot;
    }

    // Strategy 1: Find package.json walking up from current directory
    let currentDir = process.cwd();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        const fs = require('fs');
        const packageJsonPath = join(currentDir, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          
          // Verify this is our project by checking name
          if (packageJson.name === 'codecrucible-synth') {
            this._projectRoot = currentDir;
            this._isInitialized = true;
            return this._projectRoot;
          }
        }
        
        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
          break; // Reached root
        }
        currentDir = parentDir;
        attempts++;
      } catch {
        break;
      }
    }

    // Strategy 2: Use process.cwd() as fallback
    this._projectRoot = process.cwd();
    this._isInitialized = true;
    return this._projectRoot;
  }

  /**
   * Get current working directory for tools
   * This is what execute_command should use as workingDirectory
   */
  public static getCurrentWorkingDirectory(): string {
    return this.resolveProjectRoot();
  }

  /**
   * Resolve a path relative to project root
   */
  public static resolveFromRoot(relativePath: string): string {
    return resolve(this.resolveProjectRoot(), relativePath);
  }

  /**
   * Get platform-specific examples for tool documentation
   */
  public static getExamplePaths(): { workingDirectory: string; relativePath: string; absolutePath: string } {
    const projectRoot = this.resolveProjectRoot();
    
    return {
      workingDirectory: projectRoot,
      relativePath: 'src/index.ts',
      absolutePath: resolve(projectRoot, 'src/index.ts')
    };
  }

  /**
   * Get escaped path for JSON strings (handles Windows backslashes)
   */
  public static getEscapedPath(path: string): string {
    return path.replace(/\\/g, '\\\\');
  }

  /**
   * Reset the cached root (for testing)
   */
  public static reset(): void {
    this._projectRoot = null;
    this._isInitialized = false;
  }

  /**
   * Validate that a path is within the project boundaries (security)
   */
  public static isPathWithinProject(targetPath: string): boolean {
    try {
      const projectRoot = this.resolveProjectRoot();
      const resolvedPath = resolve(targetPath);
      const normalizedRoot = resolve(projectRoot);
      
      return resolvedPath.startsWith(normalizedRoot);
    } catch {
      return false;
    }
  }

  /**
   * Cross-platform path formatting for tool calls
   */
  public static formatPathForPlatform(path: string): string {
    // Normalize path separators for current platform
    return resolve(path);
  }
}

/**
 * Agent State Management Interface
 * Tracks tool execution state across agent invocations
 */
export interface AgentState {
  sessionId: string;
  projectRoot: string;
  currentWorkingDirectory: string;
  executedCommands: Array<{
    command: string;
    args: string[];
    timestamp: number;
    success: boolean;
    output?: string;
    error?: string;
  }>;
  toolCallHistory: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    timestamp: number;
    result: 'success' | 'error' | 'pending';
  }>;
  contextData: Record<string, unknown>;
}

/**
 * Agent State Manager
 * Manages persistent agent state across tool invocations
 */
export class AgentStateManager {
  private static states = new Map<string, AgentState>();
  
  /**
   * Initialize or get agent state for a session
   */
  public static getOrCreateState(sessionId: string): AgentState {
    if (!this.states.has(sessionId)) {
      const state: AgentState = {
        sessionId,
        projectRoot: ProjectPaths.resolveProjectRoot(),
        currentWorkingDirectory: ProjectPaths.getCurrentWorkingDirectory(),
        executedCommands: [],
        toolCallHistory: [],
        contextData: {}
      };
      this.states.set(sessionId, state);
    }
    
    return this.states.get(sessionId)!;
  }

  /**
   * Update agent state after tool execution
   */
  public static updateAfterToolCall(
    sessionId: string, 
    toolName: string, 
    parameters: Record<string, unknown>,
    result: 'success' | 'error' | 'pending',
    output?: string
  ): void {
    const state = this.getOrCreateState(sessionId);
    
    state.toolCallHistory.push({
      toolName,
      parameters,
      timestamp: Date.now(),
      result
    });

    // Track command executions specifically
    if (toolName === 'execute_command' && parameters.command) {
      state.executedCommands.push({
        command: parameters.command as string,
        args: (parameters.args as string[]) || [],
        timestamp: Date.now(),
        success: result === 'success',
        output,
        error: result === 'error' ? output : undefined
      });
    }
  }

  /**
   * Get execution context for tools
   */
  public static getExecutionContext(sessionId: string): {
    workingDirectory: string;
    recentCommands: string[];
    projectRoot: string;
  } {
    const state = this.getOrCreateState(sessionId);
    const recentCommands = state.executedCommands
      .slice(-5)
      .map(cmd => `${cmd.command} ${cmd.args.join(' ')}`);
    
    return {
      workingDirectory: state.currentWorkingDirectory,
      recentCommands,
      projectRoot: state.projectRoot
    };
  }

  /**
   * Clean up old sessions (memory management)
   */
  public static cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    
    for (const [sessionId, state] of this.states.entries()) {
      const lastActivity = Math.max(
        ...state.toolCallHistory.map(h => h.timestamp),
        ...state.executedCommands.map(c => c.timestamp)
      );
      
      if (now - lastActivity > maxAgeMs) {
        this.states.delete(sessionId);
      }
    }
  }
}