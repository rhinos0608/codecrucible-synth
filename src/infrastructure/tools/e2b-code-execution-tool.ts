import { BaseTool } from './base-tool';
import { E2BService, ExecutionResult } from './e2b/e2b-service';
import { createLogger } from '../logging/logger-adapter';
import { z } from 'zod';

// Define the schema at the top level so we can reference it in the class generic
const E2BExecuteCodeSchema = z.object({
  code: z.string().describe('The code to execute'),
  language: z
    .enum(['python', 'javascript', 'bash'])
    .default('python')
    .describe('Programming language'),
  sessionId: z.string().optional().describe('Session ID for maintaining state (optional)'),
  installPackages: z.array(z.string()).optional().describe('Packages to install before execution'),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      })
    )
    .optional()
    .describe('Files to upload before execution'),
});

/**
 * E2B Code Execution Tool - Secure sandboxed code execution
 *
 * Replaces unsafe direct code execution with secure E2B sandboxes
 */
export class E2BCodeExecutionTool extends BaseTool<typeof E2BExecuteCodeSchema.shape> {
  private readonly e2bService: E2BService;
  private readonly sessionId: string;

  private readonly logger = createLogger('E2BTool');

  public constructor(
    agentContext: Readonly<{ workingDirectory: string }>,
    e2bService?: Readonly<E2BService>
  ) {
    super({
      name: 'e2bExecuteCode',
      description:
        'Execute code safely in an isolated E2B sandbox environment. Supports Python, JavaScript, and Bash.',
      category: 'execution',
      parameters: E2BExecuteCodeSchema,
      examples: [
        'Execute Python code: { code: "print(\\"Hello, World!\\")", language: "python" }',
        'Execute with packages: { code: "import requests", language: "python", installPackages: ["requests"] }',
        'Execute bash: { code: "ls -la", language: "bash" }',
      ],
    });

    this.e2bService = (e2bService ?? new E2BService()) as E2BService;
    this.sessionId = agentContext.workingDirectory.replace(/[^a-zA-Z0-9]/g, '_');
  }

  public async execute(
    args: z.infer<typeof E2BExecuteCodeSchema> & { user?: unknown }
  ): Promise<ExecutionResult & { sandbox: string; security: string }> {
    try {
      // ✅ SECURITY: Check authentication requirement from centralized security policies
      const { SecurityPolicyLoader } = await import('../security/security-policy-loader');
      const policyLoader = SecurityPolicyLoader.getInstance();
      const authConfig = await policyLoader.getAuthConfig();

      if (authConfig.e2b.requireAuthentication && !('user' in args && args.user)) {
        this.logger.error(
          '🚨 E2B code execution blocked: Authentication required by security policy'
        );
        return {
          success: false,
          output: '',
          error: 'Authentication required for code execution. Please authenticate first.',
          executionTime: 0,
          sandbox: 'auth-required',
          security: 'Security policy: Authentication validation failed',
        };
      }

      const {
        code,
        language = 'python',
        sessionId,
        installPackages,
        files,
      }: z.infer<typeof E2BExecuteCodeSchema> = args;

      const actualSessionId: string = sessionId ?? this.sessionId;

      this.logger.info(`🔒 Executing ${language} code in secure E2B sandbox: ${actualSessionId}`);

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
        this.logger.warn(`🚨 Security check failed for code execution: ${securityCheck.reason}`);
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
      if (files && Array.isArray(files) && files.length > 0) {
        for (const file of files) {
          await this.e2bService.uploadFile(actualSessionId, file.path, file.content);
          this.logger.info(`📁 Uploaded file to sandbox: ${file.path}`);
        }
      }

      // Install packages if specified
      if (installPackages && Array.isArray(installPackages) && installPackages.length > 0) {
        for (const pkg of installPackages) {
          this.logger.info(`📦 Installing package: ${pkg}`);
          const installResult = await this.e2bService.installPackage(
            actualSessionId,
            pkg,
            language === 'javascript' ? 'javascript' : 'python'
          );

          if (!installResult.success) {
            this.logger.warn(`⚠️ Package installation failed: ${pkg} - ${installResult.error}`);
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
      this.logger.info(
        `🔍 Code execution completed - Success: ${result.success}, Time: ${result.executionTime}ms`
      );
      if (result.error) {
        this.logger.warn(`⚠️ Execution error: ${result.error}`);
      }

      return enhancedResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('❌ E2B code execution failed:', error);

      return {
        success: false,
        output: '',
        error: `E2B execution failed: ${errorMessage}`,
        executionTime: 0,
        sandbox: (args as { sessionId?: string }).sessionId ?? this.sessionId,
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
  public getSandboxStatus(): { active: boolean; sessions: string[] } {
    return {
      active: this.e2bService.getStats().isInitialized,
      sessions: this.e2bService.getActiveSessions(),
    };
  }

  /**
   * Clean up sandbox for session
   */
  public cleanupSandbox(sessionId?: string): void {
    const actualSessionId = sessionId ?? this.sessionId;
    this.e2bService.destroySandbox(actualSessionId);
    this.logger.info(`🧹 Cleaned up sandbox: ${actualSessionId}`);
  }
}
