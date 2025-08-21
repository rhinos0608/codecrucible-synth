import { BaseTool } from './base-tool.js';
import { E2BService, ExecutionResult } from '../e2b/e2b-service.js';
import { logger } from '../logger.js';
import { z } from 'zod';

/**
 * E2B Code Execution Tool - Secure sandboxed code execution
 *
 * Replaces unsafe direct code execution with secure E2B sandboxes
 */
export class E2BCodeExecutionTool extends BaseTool {
  private e2bService: E2BService;
  private sessionId: string;

  constructor(agentContext: { workingDirectory: string }, e2bService?: E2BService) {
    super({
      name: 'e2bExecuteCode',
      description:
        'Execute code safely in an isolated E2B sandbox environment. Supports Python, JavaScript, and Bash.',
      category: 'execution',
      parameters: z.object({
        code: z.string().describe('The code to execute'),
        language: z
          .enum(['python', 'javascript', 'bash'])
          .default('python')
          .describe('Programming language'),
        sessionId: z.string().optional().describe('Session ID for maintaining state (optional)'),
        installPackages: z
          .array(z.string())
          .optional()
          .describe('Packages to install before execution'),
        files: z
          .array(
            z.object({
              path: z.string(),
              content: z.string(),
            })
          )
          .optional()
          .describe('Files to upload before execution'),
      }),
      examples: [
        'Execute Python code: { code: "print(\\"Hello, World!\\")", language: "python" }',
        'Execute with packages: { code: "import requests", language: "python", installPackages: ["requests"] }',
        'Execute bash: { code: "ls -la", language: "bash" }',
      ],
    });

    this.e2bService = e2bService || new E2BService();
    this.sessionId = agentContext.workingDirectory.replace(/[^a-zA-Z0-9]/g, '_');
  }

  async execute(args: any): Promise<ExecutionResult & { sandbox: string; security: string }> {
    try {
      const { code, language = 'python', sessionId, installPackages, files } = args;
      const actualSessionId = sessionId || this.sessionId;

      logger.info(`🔒 Executing ${language} code in secure E2B sandbox: ${actualSessionId}`);

      // Initialize E2B service if needed
      if (!this.e2bService.getStats().isInitialized) {
        if (process.env.E2B_API_KEY) {
          await this.e2bService.initialize();
        } else {
          return {
            success: false,
            output: '',
            error: 'E2B API key not configured. Code execution disabled for security.',
            executionTime: 0,
            sandbox: 'disabled',
            security: 'E2B API key required',
          };
        }
      }

      // Validate code for basic security
      const securityCheck = this.validateCodeSecurity(code, language);
      if (!securityCheck.safe) {
        logger.warn(`🚨 Security check failed for code execution: ${securityCheck.reason}`);
        return {
          success: false,
          output: '',
          error: `Security check failed: ${securityCheck.reason}`,
          executionTime: 0,
          sandbox: actualSessionId,
          security: 'blocked',
        };
      }

      // Upload files if specified
      if (files && files.length > 0) {
        for (const file of files) {
          await this.e2bService.uploadFile(actualSessionId, file.path, file.content);
          logger.info(`📁 Uploaded file to sandbox: ${file.path}`);
        }
      }

      // Install packages if specified
      if (installPackages && installPackages.length > 0) {
        for (const pkg of installPackages) {
          logger.info(`📦 Installing package: ${pkg}`);
          const installResult = await this.e2bService.installPackage(
            actualSessionId,
            pkg,
            language === 'javascript' ? 'javascript' : 'python'
          );

          if (!installResult.success) {
            logger.warn(`⚠️ Package installation failed: ${pkg} - ${installResult.error}`);
          }
        }
      }

      // Execute the code
      const result = await this.e2bService.executeCode(actualSessionId, code, language);

      // Add security and sandbox information
      const enhancedResult = {
        ...result,
        sandbox: actualSessionId,
        security: 'e2b_sandboxed',
      };

      // Log execution for audit
      logger.info(
        `🔍 Code execution completed - Success: ${result.success}, Time: ${result.executionTime}ms`
      );
      if (result.error) {
        logger.warn(`⚠️ Execution error: ${result.error}`);
      }

      return enhancedResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ E2B code execution failed:', error);

      return {
        success: false,
        output: '',
        error: `E2B execution failed: ${errorMessage}`,
        executionTime: 0,
        sandbox: args.sessionId || this.sessionId,
        security: 'error',
      };
    }
  }

  /**
   * Basic security validation for code execution
   */
  private validateCodeSecurity(code: string, language: string): { safe: boolean; reason?: string } {
    const codeUpper = code.toUpperCase();

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      // File system manipulation
      /RM\s+-RF\s+\/|RMDIR\s+\/|DEL\s+\/|FORMAT\s+C:/i,
      // Network access that might be harmful
      /CURL.*SUDO|WGET.*SUDO|DOWNLOAD.*EXEC/i,
      // System manipulation
      /SHUTDOWN|REBOOT|HALT|KILL\s+-9|KILLALL/i,
      // Process manipulation
      /FORK\s*\(\)|EXEC\s*\(|SYSTEM\s*\(/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          safe: false,
          reason: `Potentially dangerous pattern detected: ${pattern.source}`,
        };
      }
    }

    // Language-specific checks
    if (language === 'bash') {
      // Bash-specific dangerous patterns
      if (
        codeUpper.includes(':(){ :|:& }') || // Fork bomb
        codeUpper.includes('DD IF=/DEV/ZERO') || // Disk fill
        codeUpper.includes(':(){ :|:& };:')
      ) {
        // Fork bomb variant
        return { safe: false, reason: 'Dangerous bash pattern detected' };
      }
    }

    // Check for excessive length (potential DoS)
    if (code.length > 50000) {
      return { safe: false, reason: 'Code too long (potential DoS)' };
    }

    return { safe: true };
  }

  /**
   * Get sandbox status for the current session
   */
  async getSandboxStatus(): Promise<{ active: boolean; sessions: string[] }> {
    return {
      active: this.e2bService.getStats().isInitialized,
      sessions: this.e2bService.getActiveSessions(),
    };
  }

  /**
   * Clean up sandbox for session
   */
  async cleanupSandbox(sessionId?: string): Promise<void> {
    const actualSessionId = sessionId || this.sessionId;
    await this.e2bService.destroySandbox(actualSessionId);
    logger.info(`🧹 Cleaned up sandbox: ${actualSessionId}`);
  }
}
