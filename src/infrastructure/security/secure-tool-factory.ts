import { E2BService } from '../../core/e2b/e2b-service.js';
import { SecurityValidator } from '../../core/e2b/security-validator.js';
import { E2BCodeExecutionTool } from '../tools/e2b/e2b-code-execution-tool.js';
import { E2BTerminalTool } from '../tools/e2b/e2b-terminal-tool.js';
import { SecureTerminalExecuteTool } from '../tools/secure-terminal-tools.js';
import { SecureExecutionManager } from './secure-execution-manager.js';
import { AdvancedInputValidator, ValidationLevel } from './input-validation-system.js';
import {
  SecurityAuditLogger,
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
} from './security-audit-logger.js';
import { RBACSystem, AuthorizationContext } from './production-rbac-system.js';
import { z } from 'zod';
import { logger } from '../logging/logger.js';
import crypto from 'crypto';

/**
 * Secure Tool Factory
 *
 * Provides secure, E2B-based alternatives to unsafe execution tools.
 * This factory ensures all code and command execution goes through
 * sandboxed E2B environments for maximum security.
 */
export class SecureToolFactory {
  private e2bService: E2BService | null = null;
  private securityValidator: SecurityValidator;
  private rbacSystem: RBACSystem;
  private auditLogger: SecurityAuditLogger;
  private isE2BAvailable: boolean = false;
  private toolExecutionCache = new Map<string, { result: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(rbacSystem: RBACSystem, auditLogger: SecurityAuditLogger) {
    this.securityValidator = new SecurityValidator();
    this.rbacSystem = rbacSystem;
    this.auditLogger = auditLogger;
    this.initializeE2BService();
  }

  /**
   * Initialize E2B service if API key is available
   */
  private async initializeE2BService(): Promise<void> {
    try {
      // Check if E2B API key is available
      const apiKey = process.env.E2B_API_KEY;
      if (!apiKey) {
        logger.warn('🔒 E2B API key not found. Secure execution will be limited.');
        logger.warn('💡 Set E2B_API_KEY environment variable to enable full sandboxing.');
        return;
      }

      this.e2bService = new E2BService({ apiKey });
      await this.e2bService.initialize();
      this.isE2BAvailable = true;

      logger.info('✅ E2B service initialized - secure execution enabled');
    } catch (error) {
      logger.warn('⚠️ E2B service initialization failed:', error);
      logger.warn('🔒 Falling back to restricted execution mode');
      this.isE2BAvailable = false;
    }
  }

  /**
   * Create secure code execution tool with comprehensive security validation
   */
  createCodeExecutionTool(agentContext: any): any {
    if (this.isE2BAvailable && this.e2bService) {
      logger.info('🔐 Using E2B sandboxed code execution');
      return new SecureE2BCodeExecutionTool(
        this.e2bService,
        agentContext,
        this.securityValidator,
        this.rbacSystem,
        this.auditLogger
      );
    }

    // If E2B is not available, return a restricted execution tool
    logger.warn('⚠️ E2B not available, using restricted execution mode');
    return new RestrictedCodeExecutionTool(agentContext, this.securityValidator, this.auditLogger);
  }

  /**
   * Create secure terminal execution tool
   */
  createTerminalTool(agentContext: any): any {
    if (this.isE2BAvailable && this.e2bService) {
      logger.info('🔐 Using secure E2B terminal execution');
      return new SecureE2BTerminalTool(
        this.e2bService,
        agentContext,
        this.securityValidator,
        this.rbacSystem,
        this.auditLogger
      );
    }

    logger.warn('⚠️ E2B not available, using restricted terminal mode');
    return new RestrictedTerminalTool(agentContext, this.securityValidator, this.auditLogger);
  }

  /**
   * Get security status
   */
  getSecurityStatus(): SecurityStatus {
    return {
      e2bAvailable: this.isE2BAvailable,
      sandboxingEnabled: this.isE2BAvailable,
      securityLevel: this.isE2BAvailable ? 'high' : 'restricted',
      recommendations: this.getSecurityRecommendations(),
    };
  }

  /**
   * Get security recommendations
   */
  private getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];

    if (!this.isE2BAvailable) {
      recommendations.push('Set up E2B API key for full sandboxed execution');
      recommendations.push('Visit https://e2b.dev to get API key');
      recommendations.push('Set E2B_API_KEY environment variable');
    }

    if (process.env.NODE_ENV !== 'production') {
      recommendations.push('Enable production mode for enhanced security');
    }

    return recommendations;
  }

  /**
   * Shutdown E2B service
   */
  async shutdown(): Promise<void> {
    if (this.e2bService) {
      await this.e2bService.shutdown();
      logger.info('🔒 E2B service shut down');
    }
  }
}

/**
 * Security status interface
 */
export interface SecurityStatus {
  e2bAvailable: boolean;
  sandboxingEnabled: boolean;
  securityLevel: 'high' | 'restricted' | 'disabled';
  recommendations: string[];
}

/**
 * Base tool interface for restricted tools
 */
interface BaseTool {
  definition: {
    name: string;
    description: string;
    category: string;
    parameters?: any;
  };
  execute(args: any): Promise<any>;
}

/**
 * Restricted Code Execution Tool (fallback when E2B unavailable)
 */
class RestrictedCodeExecutionTool implements BaseTool {
  definition = {
    name: 'restrictedCodeExecution',
    description: 'Restricted code execution (E2B unavailable)',
    category: 'Code Execution',
  };
  private securityValidator: SecurityValidator;
  private auditLogger: SecurityAuditLogger;

  constructor(
    agentContext: any,
    securityValidator: SecurityValidator,
    auditLogger: SecurityAuditLogger
  ) {
    this.securityValidator = securityValidator;
    this.auditLogger = auditLogger;
  }

  async execute(args: any): Promise<any> {
    const executionId = crypto.randomBytes(16).toString('hex');

    try {
      logger.warn('🚨 Code execution requested but E2B sandboxing unavailable');

      // Log security violation
      await this.auditLogger.logSecurityViolation(
        AuditSeverity.HIGH,
        'restricted-code-tool',
        'Code execution attempted without proper sandboxing',
        { executionId },
        { code: `${args.code?.substring(0, 200)  }...`, language: args.language }
      );

      // Perform strict validation
      const validation = this.securityValidator.validateCode(args.code, args.language);
      if (!validation.isValid) {
        await this.auditLogger.logEvent(
          AuditEventType.SECURITY_VIOLATION,
          AuditSeverity.CRITICAL,
          AuditOutcome.FAILURE,
          'code-validation',
          'validate',
          'code-execution',
          `Code execution blocked: ${validation.reason}`,
          { executionId },
          { code: `${args.code?.substring(0, 200)  }...`, reason: validation.reason }
        );

        return {
          success: false,
          error: `Code execution blocked: ${validation.reason}`,
          securityWarning: 'E2B sandboxing not available - execution denied for security',
          executionId,
        };
      }

      return {
        success: false,
        error: 'Code execution requires E2B sandboxing for security',
        recommendation: 'Set up E2B API key to enable secure code execution',
        securityLevel: 'restricted',
        executionId,
      };
    } catch (error) {
      logger.error('Error in restricted code execution tool', error as Error);
      return {
        success: false,
        error: 'Internal security error',
        executionId,
      };
    }
  }
}

/**
 * Restricted Terminal Tool (fallback when E2B unavailable)
 */
class RestrictedTerminalTool implements BaseTool {
  definition = {
    name: 'restrictedTerminal',
    description: 'Restricted terminal execution (E2B unavailable)',
    category: 'Terminal Operations',
  };
  private securityValidator: SecurityValidator;
  private auditLogger: SecurityAuditLogger;

  constructor(
    agentContext: any,
    securityValidator: SecurityValidator,
    auditLogger: SecurityAuditLogger
  ) {
    this.securityValidator = securityValidator;
    this.auditLogger = auditLogger;
  }

  async execute(args: any): Promise<any> {
    logger.warn('🚨 Terminal command requested but E2B sandboxing unavailable');

    // Only allow very safe read-only commands
    const safeCommands = ['ls', 'pwd', 'whoami', 'date', 'echo', 'cat', 'head', 'tail'];
    const command = args.command.trim().split(' ')[0];

    if (!safeCommands.includes(command)) {
      return {
        success: false,
        error: `Command '${command}' not allowed without E2B sandboxing`,
        recommendation: 'Set up E2B API key to enable secure command execution',
        allowedCommands: safeCommands,
        securityLevel: 'restricted',
      };
    }

    // Even for safe commands, perform validation
    const validation = this.securityValidator.validateCommand(args.command);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Command validation failed: ${validation.reason}`,
        securityWarning: 'Command blocked by security policy',
      };
    }

    return {
      success: false,
      error: 'Terminal commands require E2B sandboxing for security',
      recommendation: 'Set up E2B API key to enable secure terminal access',
      securityLevel: 'restricted',
    };
  }
}

/**
 * Enhanced Secure E2B Code Execution Tool with RBAC and audit logging
 */
class SecureE2BCodeExecutionTool implements BaseTool {
  definition = {
    name: 'secureCodeExecution',
    description: 'Secure sandboxed code execution with RBAC',
    category: 'Code Execution',
    parameters: z.object({
      code: z.string().min(1).max(50000),
      language: z.enum(['python', 'javascript', 'typescript', 'bash', 'shell']),
      timeout: z.number().optional().default(30000),
      context: z.any().optional(),
    }),
  };

  constructor(
    private e2bService: E2BService,
    private agentContext: any,
    private securityValidator: SecurityValidator,
    private rbacSystem: RBACSystem,
    private auditLogger: SecurityAuditLogger
  ) {}

  async execute(args: any): Promise<any> {
    const executionId = crypto.randomBytes(16).toString('hex');
    const startTime = Date.now();

    try {
      // Input validation
      const inputValidation = AdvancedInputValidator.validateInput(args.code, 'code', {
        level: ValidationLevel.STRICT,
        allowScripts: true,
        allowFileOperations: true,
        maxLength: 50000,
      });

      if (!inputValidation.success) {
        await this.auditLogger.logEvent(
          AuditEventType.SECURITY_VIOLATION,
          AuditSeverity.HIGH,
          AuditOutcome.FAILURE,
          'secure-code-tool',
          'validate_input',
          'code-execution',
          'Code execution blocked by input validation',
          {
            userId: this.agentContext.userId,
            sessionId: this.agentContext.sessionId,
            executionId,
          },
          { reason: (inputValidation as any).error.message }
        );

        return {
          success: false,
          error: 'Code validation failed',
          details: (inputValidation as any).error.message,
          executionId,
        };
      }

      // Authorization check
      const authResult = await this.rbacSystem.authorize({
        userId: this.agentContext.userId,
        sessionId: this.agentContext.sessionId,
        resource: 'ai_model',
        action: 'execute',
        context: {
          data: { tool: 'code_execution', language: args.language },
          ipAddress: this.agentContext.ipAddress,
          userAgent: this.agentContext.userAgent,
        },
      });

      if (!authResult.granted) {
        await this.auditLogger.logAuthorization(
          AuditOutcome.FAILURE,
          this.agentContext.userId,
          'code-execution',
          'execute',
          {
            userId: this.agentContext.userId,
            sessionId: this.agentContext.sessionId,
            executionId,
          },
          { reason: authResult.reason }
        );

        return {
          success: false,
          error: 'Access denied',
          details: authResult.reason,
          executionId,
        };
      }

      // Security validation
      const securityValidation = this.securityValidator.validateCode(args.code, args.language);
      if (!securityValidation.isValid) {
        await this.auditLogger.logSecurityViolation(
          AuditSeverity.HIGH,
          'secure-code-tool',
          `Malicious code detected: ${securityValidation.reason}`,
          {
            userId: this.agentContext.userId,
            sessionId: this.agentContext.sessionId,
            executionId,
          },
          { code: `${args.code.substring(0, 200)  }...`, language: args.language }
        );

        return {
          success: false,
          error: 'Security validation failed',
          details: securityValidation.reason,
          executionId,
        };
      }

      // Execute in E2B sandbox
      logger.info('Executing code in E2B sandbox', { executionId, language: args.language });

      const result = await this.e2bService.executeCode(
        executionId,
        inputValidation.data.sanitizedValue,
        args.language || 'python'
      );

      // Log successful execution
      await this.auditLogger.logEvent(
        AuditEventType.DATA_ACCESS,
        AuditSeverity.LOW,
        AuditOutcome.SUCCESS,
        'secure-code-tool',
        'execute',
        'code-execution',
        'Code executed successfully in sandbox',
        {
          userId: this.agentContext.userId,
          sessionId: this.agentContext.sessionId,
          executionId,
        },
        {
          language: args.language,
          executionTime: Date.now() - startTime,
          outputLength: result.output?.length || 0,
        }
      );

      return {
        success: true,
        result,
        executionId,
        executionTime: Date.now() - startTime,
        securityLevel: 'high',
      };
    } catch (error) {
      await this.auditLogger.logEvent(
        AuditEventType.ERROR_EVENT,
        AuditSeverity.MEDIUM,
        AuditOutcome.ERROR,
        'secure-code-tool',
        'execute',
        'code-execution',
        'Code execution failed with error',
        {
          userId: this.agentContext.userId,
          sessionId: this.agentContext.sessionId,
          executionId,
        },
        { error: (error as Error).message }
      );

      logger.error('Secure code execution failed', error as Error, { executionId });
      return {
        success: false,
        error: 'Execution failed',
        details: (error as Error).message,
        executionId,
      };
    }
  }
}

/**
 * Enhanced Secure E2B Terminal Tool with RBAC and audit logging
 */
class SecureE2BTerminalTool implements BaseTool {
  definition = {
    name: 'secureTerminal',
    description: 'Secure sandboxed terminal execution with RBAC',
    category: 'Terminal Operations',
    parameters: z.object({
      command: z.string().min(1).max(1000),
      timeout: z.number().optional().default(30000),
      workingDirectory: z.string().optional(),
    }),
  };

  constructor(
    private e2bService: E2BService,
    private agentContext: any,
    private securityValidator: SecurityValidator,
    private rbacSystem: RBACSystem,
    private auditLogger: SecurityAuditLogger
  ) {}

  async execute(args: any): Promise<any> {
    const executionId = crypto.randomBytes(16).toString('hex');
    const startTime = Date.now();

    try {
      // Input validation
      const commandValidation = AdvancedInputValidator.validateCommand(args.command);
      if (!commandValidation.success) {
        await this.auditLogger.logSecurityViolation(
          AuditSeverity.HIGH,
          'secure-terminal-tool',
          'Dangerous command blocked',
          {
            userId: this.agentContext.userId,
            sessionId: this.agentContext.sessionId,
            executionId,
          },
          { command: args.command, reason: (commandValidation as any).error.message }
        );

        return {
          success: false,
          error: 'Command validation failed',
          details: (commandValidation as any).error.message,
          executionId,
        };
      }

      // Authorization check
      const authResult = await this.rbacSystem.authorize({
        userId: this.agentContext.userId,
        sessionId: this.agentContext.sessionId,
        resource: 'system',
        action: 'execute',
        context: {
          data: { tool: 'terminal', command: args.command },
          ipAddress: this.agentContext.ipAddress,
          userAgent: this.agentContext.userAgent,
        },
      });

      if (!authResult.granted) {
        await this.auditLogger.logAuthorization(
          AuditOutcome.FAILURE,
          this.agentContext.userId,
          'terminal-execution',
          'execute',
          {
            userId: this.agentContext.userId,
            sessionId: this.agentContext.sessionId,
            executionId,
          },
          { command: args.command, reason: authResult.reason }
        );

        return {
          success: false,
          error: 'Access denied',
          details: authResult.reason,
          executionId,
        };
      }

      // Security validation
      const securityValidation = this.securityValidator.validateCommand(args.command);
      if (!securityValidation.isValid) {
        await this.auditLogger.logSecurityViolation(
          AuditSeverity.CRITICAL,
          'secure-terminal-tool',
          `Malicious command detected: ${securityValidation.reason}`,
          {
            userId: this.agentContext.userId,
            sessionId: this.agentContext.sessionId,
            executionId,
          },
          { command: args.command }
        );

        return {
          success: false,
          error: 'Security validation failed',
          details: securityValidation.reason,
          executionId,
        };
      }

      // Execute in E2B sandbox
      logger.info('Executing command in E2B sandbox', { executionId, command: args.command });

      const result = await this.e2bService.executeCode(executionId, commandValidation.data, 'bash');

      // Log successful execution
      await this.auditLogger.logEvent(
        AuditEventType.SYSTEM_EVENT,
        AuditSeverity.LOW,
        AuditOutcome.SUCCESS,
        'secure-terminal-tool',
        'execute',
        'terminal-execution',
        'Command executed successfully in sandbox',
        {
          userId: this.agentContext.userId,
          sessionId: this.agentContext.sessionId,
          executionId,
        },
        {
          command: args.command,
          executionTime: Date.now() - startTime,
          exitCode: result.success ? 0 : 1,
        }
      );

      return {
        success: true,
        result,
        executionId,
        executionTime: Date.now() - startTime,
        securityLevel: 'high',
      };
    } catch (error) {
      await this.auditLogger.logEvent(
        AuditEventType.ERROR_EVENT,
        AuditSeverity.MEDIUM,
        AuditOutcome.ERROR,
        'secure-terminal-tool',
        'execute',
        'terminal-execution',
        'Terminal execution failed with error',
        {
          userId: this.agentContext.userId,
          sessionId: this.agentContext.sessionId,
          executionId,
        },
        { command: args.command, error: (error as Error).message }
      );

      logger.error('Secure terminal execution failed', error as Error, { executionId });
      return {
        success: false,
        error: 'Execution failed',
        details: (error as Error).message,
        executionId,
      };
    }
  }
}
