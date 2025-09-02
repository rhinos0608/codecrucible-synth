/**
 * E2B Code Execution Tool - Production Implementation
 * Integrates with RustExecutionBackend and security validation for real code execution
 */

import { RustExecutionBackend } from '../../../core/execution/rust-executor/rust-execution-backend.js';
import { SecurityValidator } from '../../../core/e2b/security-validator.js';
import { logger } from '../../logging/logger.js';
import { TerminalMCPServer } from '../../../mcp-servers/terminal-server.js';

export interface CodeExecutionRequest {
  code: string;
  language: string;
  timeout?: number;
  environment?: string;
  dependencies?: string[];
  workingDirectory?: string;
  sessionId?: string;
}

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
  exitCode?: number;
  sessionId?: string;
  securityReport?: {
    validated: boolean;
    issues: string[];
  };
}

export interface ExecutionEnvironment {
  id: string;
  language: string;
  workingDirectory: string;
  dependencies: string[];
  isReady: boolean;
  lastUsed: number;
}

export class E2BCodeExecutionTool {
  private readonly supportedLanguages = [
    'python', 'python3', 'javascript', 'typescript', 'node', 'bash', 'sh', 
    'rust', 'go', 'java', 'c', 'cpp', 'ruby', 'php'
  ];
  
  private rustBackend: RustExecutionBackend;
  private securityValidator: SecurityValidator;
  private terminalServer: TerminalMCPServer;
  private environments: Map<string, ExecutionEnvironment> = new Map();
  private environmentCounter = 0;

  constructor(workingDirectory: string = process.cwd()) {
    this.rustBackend = new RustExecutionBackend({
      enableProfiling: true,
      maxConcurrency: 4,
      timeoutMs: 60000,
      logLevel: 'info'
    });
    
    this.securityValidator = new SecurityValidator();
    
    this.terminalServer = new TerminalMCPServer({
      workingDirectory,
      timeout: 60000,
      maxOutputSize: 10 * 1024 * 1024, // 10MB for code output
    });
    
    logger.info('E2BCodeExecutionTool initialized with production backend');
  }

  async initialize(): Promise<void> {
    try {
      await this.securityValidator.initialize();
      
      // Initialize Rust backend if available
      try {
        await this.rustBackend.initialize();
        logger.info('Rust execution backend initialized successfully');
      } catch (error) {
        logger.warn('Rust backend not available, falling back to terminal execution:', error);
      }
      
      logger.info('E2BCodeExecutionTool initialization complete');
    } catch (error) {
      logger.error('Failed to initialize E2BCodeExecutionTool:', error);
      throw error;
    }
  }

  async executeCode(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const startTime = Date.now();
    const language = request.language.toLowerCase();

    try {
      // Validate language support
      if (!this.supportedLanguages.includes(language)) {
        return {
          success: false,
          error: `Unsupported language: ${request.language}. Supported: ${this.supportedLanguages.join(', ')}`,
          executionTime: Date.now() - startTime
        };
      }

      // Security validation of code
      const securityReport = await this.performSecurityValidation(request.code, language);
      if (!securityReport.validated) {
        return {
          success: false,
          error: `Security validation failed: ${securityReport.issues.join(', ')}`,
          executionTime: Date.now() - startTime,
          securityReport
        };
      }

      // Prepare execution environment
      const environment = await this.prepareEnvironment(request);
      
      // Execute code using the most appropriate method
      let result: CodeExecutionResult;
      
      if (this.canUseRustBackend(language)) {
        result = await this.executeViaRustBackend(request, environment);
      } else {
        result = await this.executeViaTerminalServer(request, environment);
      }

      // Add security report to successful results
      result.securityReport = securityReport;
      result.sessionId = environment.id;
      
      // Update environment usage
      environment.lastUsed = Date.now();
      
      return result;
      
    } catch (error) {
      logger.error('Code execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: Date.now() - startTime,
        securityReport: {
          validated: false,
          issues: ['Execution error occurred']
        }
      };
    }
  }

  async validateCode(code: string, language: string): Promise<boolean> {
    try {
      const securityReport = await this.performSecurityValidation(code, language);
      return securityReport.validated;
    } catch (error) {
      logger.error('Code validation failed:', error);
      return false;
    }
  }

  private async performSecurityValidation(code: string, language: string): Promise<{
    validated: boolean;
    issues: string[];
  }> {
    // Use the existing SecurityValidator for comprehensive validation
    const validationResult = await this.securityValidator.validateInput({
      type: 'code',
      content: code,
      context: { 
        language,
        operation: 'code_execution',
        environment: 'e2b_sandbox'
      }
    });

    return {
      validated: validationResult.isValid,
      issues: validationResult.isValid ? [] : [validationResult.reason || 'Security validation failed']
    };
  }

  private canUseRustBackend(language: string): boolean {
    // Check if language can be executed via Rust backend
    const rustSupportedLanguages = ['rust', 'python', 'javascript', 'typescript', 'bash'];
    return rustSupportedLanguages.includes(language) && this.rustBackend;
  }

  private async prepareEnvironment(request: CodeExecutionRequest): Promise<ExecutionEnvironment> {
    const environmentId = `env_${++this.environmentCounter}`;
    const workingDirectory = request.workingDirectory || process.cwd();

    const environment: ExecutionEnvironment = {
      id: environmentId,
      language: request.language,
      workingDirectory,
      dependencies: request.dependencies || [],
      isReady: false,
      lastUsed: Date.now()
    };

    // Install dependencies if specified
    if (request.dependencies && request.dependencies.length > 0) {
      await this.installDependencies(environment);
    }

    environment.isReady = true;
    this.environments.set(environmentId, environment);
    
    return environment;
  }

  private async installDependencies(environment: ExecutionEnvironment): Promise<void> {
    if (environment.dependencies.length === 0) return;

    logger.info(`Installing dependencies for ${environment.language}: ${environment.dependencies.join(', ')}`);

    try {
      let installCommand: string;
      
      switch (environment.language.toLowerCase()) {
        case 'python':
        case 'python3':
          installCommand = `pip install ${environment.dependencies.join(' ')}`;
          break;
        case 'javascript':
        case 'typescript':
        case 'node':
          installCommand = `npm install ${environment.dependencies.join(' ')}`;
          break;
        case 'rust':
          // For Rust, dependencies would be in Cargo.toml
          installCommand = 'cargo build';
          break;
        default:
          logger.warn(`Dependency installation not implemented for ${environment.language}`);
          return;
      }

      const result = await this.terminalServer.callTool('run_command', {
        command: installCommand,
        workingDirectory: environment.workingDirectory,
        timeout: 300000, // 5 minutes for dependency installation
        captureOutput: true
      });

      if (result.isError) {
        throw new Error(`Dependency installation failed: ${result.content[0]?.text}`);
      }

      logger.info('Dependencies installed successfully');
    } catch (error) {
      logger.error('Failed to install dependencies:', error);
      throw error;
    }
  }

  private async executeViaRustBackend(
    request: CodeExecutionRequest,
    environment: ExecutionEnvironment
  ): Promise<CodeExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info(`Executing ${request.language} code via Rust backend`);
      
      // Create a temporary file for the code
      const tempFile = await this.createTemporaryFile(request.code, request.language, environment);
      
      // Execute via Rust backend
      const result = await this.rustBackend.executeCode(
        tempFile,
        request.language,
        {
          workingDirectory: environment.workingDirectory,
          timeout: request.timeout || 30000,
          enableProfiling: true
        }
      );

      // Clean up temporary file
      await this.cleanupTemporaryFile(tempFile);

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        executionTime: Date.now() - startTime,
        memoryUsed: result.memoryUsage,
        exitCode: result.exitCode
      };
    } catch (error) {
      logger.error('Rust backend execution failed:', error);
      throw error;
    }
  }

  private async executeViaTerminalServer(
    request: CodeExecutionRequest,
    environment: ExecutionEnvironment
  ): Promise<CodeExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info(`Executing ${request.language} code via terminal server`);
      
      // Create execution command based on language
      const { command, tempFile } = await this.prepareExecutionCommand(request, environment);
      
      // Execute via terminal server
      const result = await this.terminalServer.callTool('run_command', {
        command,
        workingDirectory: environment.workingDirectory,
        timeout: request.timeout || 30000,
        captureOutput: true,
        environment: {
          ...process.env,
          PYTHONPATH: environment.workingDirectory,
          NODE_PATH: environment.workingDirectory
        }
      });

      // Clean up temporary file if created
      if (tempFile) {
        await this.cleanupTemporaryFile(tempFile);
      }

      if (result.isError) {
        return {
          success: false,
          error: result.content[0]?.text || 'Terminal execution failed',
          executionTime: Date.now() - startTime
        };
      }

      const executionResult = JSON.parse(result.content[0]?.text || '{}');
      
      return {
        success: executionResult.exitCode === 0,
        output: executionResult.stdout,
        error: executionResult.stderr,
        executionTime: Date.now() - startTime,
        exitCode: executionResult.exitCode
      };
    } catch (error) {
      logger.error('Terminal server execution failed:', error);
      throw error;
    }
  }

  private async prepareExecutionCommand(
    request: CodeExecutionRequest,
    environment: ExecutionEnvironment
  ): Promise<{ command: string; tempFile?: string }> {
    const language = request.language.toLowerCase();

    switch (language) {
      case 'python':
      case 'python3':
        if (request.code.includes('import ') || request.code.includes('from ')) {
          // For scripts with imports, create a temporary file
          const tempFile = await this.createTemporaryFile(request.code, language, environment);
          return { command: `python3 "${tempFile}"`, tempFile };
        } else {
          // For simple code, use direct execution
          return { command: `python3 -c "${request.code.replace(/"/g, '\\"')}"` };
        }

      case 'javascript':
      case 'node':
        return { command: `node -e "${request.code.replace(/"/g, '\\"')}"` };

      case 'typescript':
        const tempFile = await this.createTemporaryFile(request.code, language, environment);
        return { command: `npx tsx "${tempFile}"`, tempFile };

      case 'bash':
      case 'sh':
        return { command: request.code };

      case 'rust':
        const rustFile = await this.createTemporaryFile(request.code, language, environment);
        const executableName = rustFile.replace('.rs', '');
        return { 
          command: `rustc "${rustFile}" -o "${executableName}" && "${executableName}"`,
          tempFile: rustFile
        };

      default:
        throw new Error(`Execution command preparation not implemented for ${language}`);
    }
  }

  private async createTemporaryFile(
    code: string,
    language: string,
    environment: ExecutionEnvironment
  ): Promise<string> {
    const extension = this.getFileExtension(language);
    const filename = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    const filepath = `${environment.workingDirectory}/${filename}`;

    // Use the terminal server to create the file
    const result = await this.terminalServer.callTool('run_command', {
      command: `cat > "${filepath}"`,
      workingDirectory: environment.workingDirectory,
      captureOutput: true,
      stdin: code
    });

    if (result.isError) {
      throw new Error(`Failed to create temporary file: ${result.content[0]?.text}`);
    }

    return filepath;
  }

  private async cleanupTemporaryFile(filepath: string): Promise<void> {
    try {
      await this.terminalServer.callTool('run_command', {
        command: `rm -f "${filepath}"`,
        captureOutput: true
      });
    } catch (error) {
      logger.warn(`Failed to cleanup temporary file ${filepath}:`, error);
    }
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      'python': 'py',
      'python3': 'py',
      'javascript': 'js',
      'typescript': 'ts',
      'node': 'js',
      'bash': 'sh',
      'sh': 'sh',
      'rust': 'rs',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'ruby': 'rb',
      'php': 'php'
    };
    
    return extensions[language.toLowerCase()] || 'txt';
  }

  getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  async getEnvironmentInfo(environmentId: string): Promise<ExecutionEnvironment | undefined> {
    return this.environments.get(environmentId);
  }

  async cleanupEnvironment(environmentId: string): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) return;

    try {
      // Clean up any temporary files in the environment
      await this.terminalServer.callTool('run_command', {
        command: `find "${environment.workingDirectory}" -name "temp_*" -type f -delete`,
        workingDirectory: environment.workingDirectory,
        captureOutput: true
      });

      this.environments.delete(environmentId);
      logger.info(`Cleaned up execution environment: ${environmentId}`);
    } catch (error) {
      logger.error(`Failed to cleanup environment ${environmentId}:`, error);
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up E2B code execution environments...');
    
    const environmentIds = Array.from(this.environments.keys());
    const cleanupPromises = environmentIds.map(id => this.cleanupEnvironment(id));
    
    await Promise.allSettled(cleanupPromises);
    
    // Cleanup the Rust backend
    if (this.rustBackend) {
      try {
        await this.rustBackend.cleanup();
      } catch (error) {
        logger.warn('Failed to cleanup Rust backend:', error);
      }
    }
    
    this.environments.clear();
    logger.info('E2B code execution cleanup complete');
  }

  // Health check method for monitoring
  async healthCheck(): Promise<{
    isHealthy: boolean;
    activeEnvironments: number;
    rustBackendAvailable: boolean;
    details: Record<string, any>;
  }> {
    const now = Date.now();
    const staleThreshold = 60 * 60 * 1000; // 1 hour
    
    // Check for stale environments
    const staleEnvironments = Array.from(this.environments.values()).filter(
      env => now - env.lastUsed > staleThreshold
    );
    
    // Clean up stale environments
    if (staleEnvironments.length > 0) {
      logger.info(`Cleaning up ${staleEnvironments.length} stale execution environments`);
      await Promise.allSettled(
        staleEnvironments.map(env => this.cleanupEnvironment(env.id))
      );
    }

    // Check Rust backend health
    let rustBackendAvailable = false;
    try {
      if (this.rustBackend) {
        const healthResult = await this.rustBackend.healthCheck();
        rustBackendAvailable = healthResult.includes('healthy');
      }
    } catch (error) {
      logger.warn('Rust backend health check failed:', error);
    }

    return {
      isHealthy: true,
      activeEnvironments: this.environments.size,
      rustBackendAvailable,
      details: {
        totalEnvironments: this.environments.size,
        staleEnvironments: staleEnvironments.length,
        supportedLanguages: this.supportedLanguages,
        lastCleanup: now
      }
    };
  }
}