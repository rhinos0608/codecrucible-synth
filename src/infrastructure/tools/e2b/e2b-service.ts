import { Sandbox } from '@e2b/code-interpreter';
import { logger } from '../../logging/logger.js';

/**
 * Execution result from E2B sandbox
 */
export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  resourceUsage?: ResourceUsage;
  files?: string[];
}

/**
 * Resource usage metrics
 */
export interface ResourceUsage {
  memory: number;
  cpu: number;
  diskSpace: number;
  networkRequests: number;
}

/**
 * Resource limits configuration
 */
export interface ResourceLimits {
  memory?: string;
  cpu?: string;
  diskSpace?: string;
  timeout?: number;
}

/**
 * E2B service configuration
 */
export interface E2BConfiguration {
  apiKey: string;
  defaultEnvironment: string;
  sessionTimeout: number;
  maxConcurrentSessions: number;
  resourceLimits: ResourceLimits;
}

/**
 * E2B service statistics
 */
export interface E2BServiceStats {
  isInitialized: boolean;
  activeSessions: number;
  maxConcurrentSessions: number;
  totalSessionsCreated: number;
  averageSessionAge: number;
}

/**
 * E2B Sandbox wrapper for session management
 */
export interface E2BSandbox {
  id: string;
  sandbox: Sandbox;
  createdAt: Date;
  lastUsed: Date;
  resourceLimits: ResourceLimits;
}

/**
 * Core E2B Service for managing sandboxed code execution
 *
 * This service provides secure, isolated code execution capabilities
 * using E2B sandboxes, replacing the unsafe direct execution methods.
 */
export class E2BService {
  private sandboxPool: Map<string, E2BSandbox> = new Map();
  private config: E2BConfiguration;
  private isInitialized: boolean = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<E2BConfiguration>) {
    this.config = {
      apiKey: process.env.E2B_API_KEY || '',
      defaultEnvironment: 'base',
      sessionTimeout: 3600000, // 1 hour
      maxConcurrentSessions: 10,
      resourceLimits: {
        memory: '512MB',
        cpu: '0.5',
        diskSpace: '1GB',
        timeout: 30000, // 30 seconds
      },
      ...config,
    };

    if (!this.config.apiKey) {
      logger.warn('E2B API key not found. Code execution will be disabled.');
    }
  }

  /**
   * Initialize the E2B service
   */
  async initialize(): Promise<void> {
    try {
      if (!this.config.apiKey) {
        throw new Error('E2B API key is required');
      }

      // Test connection by creating a temporary sandbox
      await this.testConnection();

      this.isInitialized = true;
      logger.info('✅ E2B service initialized successfully');

      // Start cleanup timer for expired sessions
      this.startCleanupTimer();
    } catch (error) {
      logger.error('❌ Failed to initialize E2B service:', error);
      throw error;
    }
  }

  /**
   * Test E2B connection by creating and destroying a sandbox
   */
  private async testConnection(): Promise<void> {
    try {
      const testSandbox = await Sandbox.create({
        apiKey: this.config.apiKey,
      });

      const result = await testSandbox.runCode('print("E2B connection test successful")');

      if (!result.text || !result.text.includes('successful')) {
        throw new Error('E2B connection test failed');
      }

      // Note: E2B sandboxes auto-cleanup, no explicit close needed
      logger.info('🔗 E2B connection test passed');
    } catch (error) {
      throw new Error(
        `E2B connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a new sandbox for a session
   */
  public async createSandbox(sessionId: string, _environment?: string): Promise<E2BSandbox> {
    if (!this.isInitialized) {
      throw new Error('E2B service not initialized');
    }

    if (this.sandboxPool.has(sessionId)) {
      logger.warn(`Sandbox already exists for session ${sessionId}, returning existing`);
      const existingSandbox = this.sandboxPool.get(sessionId);
      if (!existingSandbox) {
        throw new Error(`Sandbox for session ${sessionId} was unexpectedly null`);
      }
      return existingSandbox;
    }

    if (this.sandboxPool.size >= this.config.maxConcurrentSessions) {
      // Clean up old sessions to make room
      this.cleanupOldestSession();
    }

    try {
      logger.info(`🚀 Creating E2B sandbox for session: ${sessionId}`);
      const startTime = Date.now();

      const sandbox = await Sandbox.create({
        apiKey: this.config.apiKey,
      });

      const e2bSandbox: E2BSandbox = {
        id: sessionId,
        sandbox,
        createdAt: new Date(),
        lastUsed: new Date(),
        resourceLimits: this.config.resourceLimits,
      };

      this.sandboxPool.set(sessionId, e2bSandbox);

      const creationTime = Date.now() - startTime;
      logger.info(`✅ Sandbox created for session ${sessionId} in ${creationTime}ms`);

      return e2bSandbox;
    } catch (error) {
      logger.error(`❌ Failed to create sandbox for session ${sessionId}:`, error);
      throw new Error(
        `Failed to create E2B sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get existing sandbox for a session
   */
  public getSandbox(sessionId: string): E2BSandbox | null {
    const sandbox = this.sandboxPool.get(sessionId);

    if (sandbox) {
      // Update last used timestamp
      sandbox.lastUsed = new Date();
      return sandbox;
    }

    return null;
  }

  /**
   * Get or create sandbox for a session
   */
  public async getOrCreateSandbox(sessionId: string): Promise<E2BSandbox> {
    const existing = this.getSandbox(sessionId);
    if (existing) {
      return existing;
    }

    return this.createSandbox(sessionId);
  }

  /**
   * Execute code in a sandbox
   */
  public async executeCode(
    sessionId: string,
    code: string,
    language: string = 'python'
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const e2bSandbox = await this.getOrCreateSandbox(sessionId);
      const { sandbox } = e2bSandbox;

      logger.info(`🔧 Executing ${language} code in session ${sessionId}`);
      logger.debug(`Code to execute: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`);

      // Execute the code based on language
      const result = await this.executeByLanguage(sandbox, code, language);

      const executionTime = Date.now() - startTime;

      const executionResult: ExecutionResult = {
        success: !result.error,
        output: result.text || (result.logs ? result.logs.stdout.join('\n') : ''),
        error: result.error?.name || (result.logs ? result.logs.stderr.join('\n') : undefined),
        executionTime,
        files: result.results
          ?.map(r => r.filename)
          .filter((filename): filename is string => Boolean(filename)),
      };

      logger.info(
        `✅ Code execution completed in ${executionTime}ms - Success: ${executionResult.success}`
      );

      if (executionResult.error) {
        logger.warn(`Execution error: ${executionResult.error}`);
      }

      return executionResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`❌ Code execution failed for session ${sessionId}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime,
      };
    }
  }

  /**
   * Execute code based on language type
   */
  private async executeByLanguage(
    sandbox: Sandbox,
    code: string,
    language: string
  ): Promise<{
    text?: string;
    error?: { name: string };
    logs?: { stdout: string[]; stderr: string[] };
    results?: Array<{ filename?: string }>;
  }> {
    switch (language.toLowerCase()) {
      case 'python':
      case 'py': {
        const execution = await sandbox.runCode(code);
        return {
          text: execution.text,
          error: execution.error,
          logs: execution.logs,
          results: execution.results?.map(result => ({
            filename: this.extractFilename(result),
          })),
        };
      }

      case 'javascript':
      case 'js': {
        // Convert to Python execution of JavaScript-like logic where possible
        const pythonCode = this.convertJSToPython(code);
        const execution = await sandbox.runCode(pythonCode);
        return {
          text: execution.text,
          error: execution.error,
          logs: execution.logs,
          results: execution.results?.map(result => ({
            filename: this.extractFilename(result),
          })),
        };
      }

      case 'bash':
      case 'shell': {
        // Execute bash commands safely
        const bashCode = `
import subprocess
import sys

try:
    result = subprocess.run(${JSON.stringify(code)}, shell=True, capture_output=True, text=True, timeout=30)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    sys.exit(result.returncode)
except subprocess.TimeoutExpired:
    print("Command timed out", file=sys.stderr)
    sys.exit(1)
`;
        const execution = await sandbox.runCode(bashCode);
        return {
          text: execution.text,
          error: execution.error,
          logs: execution.logs,
          results: execution.results?.map(result => ({
            filename: this.extractFilename(result),
          })),
        };
      }

      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Safely extract filename from execution result
   */
  private extractFilename(result: unknown): string | undefined {
    if (result && typeof result === 'object' && 'filename' in result) {
      const { filename } = result as { filename: unknown };
      return typeof filename === 'string' ? filename : undefined;
    }
    return undefined;
  }

  /**
   * Convert simple JavaScript to Python (basic conversion)
   */
  private convertJSToPython(jsCode: string): string {
    // Basic JS to Python conversion for simple operations
    const pythonCode = jsCode
      .replace(/console\.log\(/g, 'print(')
      .replace(/let\s+/g, '')
      .replace(/const\s+/g, '')
      .replace(/var\s+/g, '')
      .replace(/===\s/g, '== ')
      .replace(/!==\s/g, '!= ')
      .replace(/true/g, 'True')
      .replace(/false/g, 'False')
      .replace(/null/g, 'None');

    return pythonCode;
  }

  /**
   * Upload file to sandbox
   */
  async uploadFile(sessionId: string, filePath: string, content: string): Promise<void> {
    try {
      const e2bSandbox = await this.getOrCreateSandbox(sessionId);

      // Use Python to write the file
      const writeCode = `
with open(${JSON.stringify(filePath)}, 'w') as f:
    f.write(${JSON.stringify(content)})
print(f"File written to {${JSON.stringify(filePath)}}")
`;

      await e2bSandbox.sandbox.runCode(writeCode);
      logger.info(`📄 File uploaded to sandbox ${sessionId}: ${filePath}`);
    } catch (error) {
      logger.error(`❌ Failed to upload file to session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Download file from sandbox
   */
  public async downloadFile(sessionId: string, filePath: string): Promise<string> {
    try {
      const e2bSandbox = this.getSandbox(sessionId);
      if (!e2bSandbox) {
        throw new Error(`No sandbox found for session ${sessionId}`);
      }

      // Use Python to read the file
      const readCode = `
try:
    with open(${JSON.stringify(filePath)}, 'r') as f:
        content = f.read()
    print(content)
except FileNotFoundError:
    print(f"ERROR: File not found: {${JSON.stringify(filePath)}}")
except Exception as e:
    print(f"ERROR: {e}")
`;

      const result = await e2bSandbox.sandbox.runCode(readCode);

      if (result.text && result.text.startsWith('ERROR:')) {
        throw new Error(result.text);
      }

      logger.info(`📥 File downloaded from sandbox ${sessionId}: ${filePath}`);
      return result.text ?? '';
    } catch (error) {
      logger.error(`❌ Failed to download file from session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Destroy a sandbox and clean up resources
   */
  public destroySandbox(sessionId: string): void {
    try {
      const e2bSandbox = this.sandboxPool.get(sessionId);

      if (e2bSandbox) {
        // Note: E2B sandboxes auto-cleanup, just remove from pool
        this.sandboxPool.delete(sessionId);
        logger.info(`🗑️ Sandbox destroyed for session: ${sessionId}`);
      }
    } catch (error) {
      logger.error(`❌ Failed to destroy sandbox for session ${sessionId}:`, error);
      // Still remove from pool even if cleanup failed
      this.sandboxPool.delete(sessionId);
    }
  }

  /**
   * Clean up the oldest session to make room for new ones
   */
  private cleanupOldestSession(): void {
    if (this.sandboxPool.size === 0) return;

    let oldestSession: string | null = null;
    let oldestTime = Date.now();

    for (const [sessionId, sandbox] of this.sandboxPool.entries()) {
      if (sandbox.lastUsed.getTime() < oldestTime) {
        oldestTime = sandbox.lastUsed.getTime();
        oldestSession = sessionId;
      }
    }

    if (oldestSession) {
      logger.info(`🧹 Cleaning up oldest session: ${oldestSession}`);
      this.destroySandbox(oldestSession);
    }
  }

  /**
   * Start cleanup timer for expired sessions
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 300000); // Clean up every 5 minutes
  }
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Destroy all active sandboxes
    Array.from(this.sandboxPool.keys()).forEach(sessionId => {
      this.destroySandbox(sessionId);
    });

    this.sandboxPool.clear();
    this.isInitialized = false;

    logger.info('✅ E2B service shut down successfully');
  }

  /**
  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, sandbox] of this.sandboxPool.entries()) {
      const timeSinceLastUse = now - sandbox.lastUsed.getTime();
      if (timeSinceLastUse > this.config.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    if (expiredSessions.length > 0) {
      logger.info(`🧹 Cleaning up ${expiredSessions.length} expired sessions`);

      for (const sessionId of expiredSessions) {
        this.destroySandbox(sessionId);
      }
    }
  }
  /**
   * Install package in a sandbox
   */
  async installPackage(
    sessionId: string,
    packageName: string,
    language: 'python' | 'javascript' = 'python'
  ): Promise<ExecutionResult> {
    try {
      const e2bSandbox = await this.getOrCreateSandbox(sessionId);

      let installCommand: string;

      if (language === 'python') {
        installCommand = `
import subprocess
import sys

try:
    result = subprocess.run([sys.executable, '-m', 'pip', 'install', '${packageName}'], 
                          capture_output=True, text=True, timeout=60)
    if result.returncode == 0:
        print(f"Successfully installed {packageName}")
        print(result.stdout)
    else:
        print(f"Failed to install {packageName}")
        print(result.stderr)
        raise Exception(f"Installation failed: {result.stderr}")
except subprocess.TimeoutExpired:
    raise Exception("Package installation timed out")
except Exception as e:
    raise Exception(f"Installation error: {str(e)}")
`;
      } else {
        // JavaScript package installation via npm (if available in sandbox)
        installCommand = `
import subprocess
import sys

try:
    result = subprocess.run(['npm', 'install', '${packageName}'], 
                          capture_output=True, text=True, timeout=60)
    if result.returncode == 0:
        print(f"Successfully installed {packageName}")
        print(result.stdout)
    else:
        print(f"Failed to install {packageName}")
        print(result.stderr)
        raise Exception(f"Installation failed: {result.stderr}")
except subprocess.TimeoutExpired:
    raise Exception("Package installation timed out")
except Exception as e:
    raise Exception(f"Installation error: {str(e)}")
`;
      }

      const result = await e2bSandbox.sandbox.runCode(installCommand);

      return {
        success: !result.error,
        output: result.text || '',
        error: result.error?.name,
        executionTime: 0, // Not tracking this for package installation
      };
    } catch (error) {
      logger.error(`❌ Failed to install package ${packageName} in session ${sessionId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown package installation error',
        executionTime: 0,
      };
    }
  }

  /**
   * Get list of active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sandboxPool.keys());
  }

  /**
   * Get service statistics
   */
  public getStats(): E2BServiceStats {
    const totalSessionsCreated = this.sandboxPool.size;
    const now = Date.now();
    const averageSessionAge =
      this.sandboxPool.size > 0
        ? Array.from(this.sandboxPool.values()).reduce(
            (sum, sandbox) => sum + (now - sandbox.createdAt.getTime()),
            0
          ) / this.sandboxPool.size
        : 0;

    return {
      isInitialized: this.isInitialized,
      activeSessions: this.sandboxPool.size,
      maxConcurrentSessions: this.config.maxConcurrentSessions,
      totalSessionsCreated,
      averageSessionAge,
    };
  }
}
