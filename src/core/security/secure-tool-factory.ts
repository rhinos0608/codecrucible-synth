import { E2BService } from '../e2b/e2b-service.js';
import { SecurityValidator } from '../e2b/security-validator.js';
import { E2BCodeExecutionTool } from '../tools/e2b/e2b-code-execution-tool.js';
import { E2BTerminalTool } from '../tools/e2b/e2b-terminal-tool.js';
import { z } from 'zod';
import { logger } from '../logger.js';

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
  private isE2BAvailable: boolean = false;

  constructor() {
    this.securityValidator = new SecurityValidator();
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
   * Create secure code execution tool
   */
  createCodeExecutionTool(agentContext: any): any {
    if (this.isE2BAvailable && this.e2bService) {
      logger.info('🔐 Using E2B sandboxed code execution');
      return new E2BCodeExecutionTool(
        this.e2bService,
        agentContext,
        this.securityValidator
      );
    }

    // If E2B is not available, return a restricted execution tool
    logger.warn('⚠️ E2B not available, using restricted execution mode');
    return new RestrictedCodeExecutionTool(agentContext, this.securityValidator);
  }

  /**
   * Create secure terminal execution tool
   */
  createTerminalTool(agentContext: any): any {
    if (this.isE2BAvailable && this.e2bService) {
      logger.info('🔐 Using E2B sandboxed terminal execution');
      return new E2BTerminalTool(
        this.e2bService,
        agentContext,
        this.securityValidator
      );
    }

    // If E2B is not available, return a restricted terminal tool
    logger.warn('⚠️ E2B not available, using restricted terminal mode');
    return new RestrictedTerminalTool(agentContext, this.securityValidator);
  }

  /**
   * Get security status
   */
  getSecurityStatus(): SecurityStatus {
    return {
      e2bAvailable: this.isE2BAvailable,
      sandboxingEnabled: this.isE2BAvailable,
      securityLevel: this.isE2BAvailable ? 'high' : 'restricted',
      recommendations: this.getSecurityRecommendations()
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
    category: 'Code Execution'
  };
  private securityValidator: SecurityValidator;

  constructor(agentContext: any, securityValidator: SecurityValidator) {
    this.securityValidator = securityValidator;
  }

  async execute(args: any): Promise<any> {
    logger.warn('🚨 Code execution requested but E2B sandboxing unavailable');
    
    // Perform strict validation
    const validation = this.securityValidator.validateCode(args.code, args.language);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Code execution blocked: ${validation.reason}`,
        securityWarning: 'E2B sandboxing not available - execution denied for security'
      };
    }

    return {
      success: false,
      error: 'Code execution requires E2B sandboxing for security',
      recommendation: 'Set up E2B API key to enable secure code execution',
      securityLevel: 'restricted'
    };
  }
}

/**
 * Restricted Terminal Tool (fallback when E2B unavailable)
 */
class RestrictedTerminalTool implements BaseTool {
  definition = {
    name: 'restrictedTerminal',
    description: 'Restricted terminal execution (E2B unavailable)',
    category: 'Terminal Operations'
  };
  private securityValidator: SecurityValidator;

  constructor(agentContext: any, securityValidator: SecurityValidator) {
    this.securityValidator = securityValidator;
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
        securityLevel: 'restricted'
      };
    }

    // Even for safe commands, perform validation
    const validation = this.securityValidator.validateCommand(args.command);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Command validation failed: ${validation.reason}`,
        securityWarning: 'Command blocked by security policy'
      };
    }

    return {
      success: false,
      error: 'Terminal commands require E2B sandboxing for security',
      recommendation: 'Set up E2B API key to enable secure terminal access',
      securityLevel: 'restricted'
    };
  }
}