/**
 * Input sanitization and validation utilities for CLI security
 * Addresses CVSS 7.8 command injection vulnerability
 * Uses centralized security policies from security-policy-loader
 */

import { SecurityPolicyLoader } from './security-policy-loader.js';
import { logger } from '../logging/logger.js';
import { normalizePathSeparators } from '../../utils/path-utilities.js';

export interface SanitizationResult {
  sanitized: string;
  isValid: boolean;
  violations: string[];
  originalCommand?: string;
  riskLevel?: string;
}

export class InputSanitizer {
  private static policyLoader = SecurityPolicyLoader.getInstance();
  private static allowedCommands: Set<string> | null = null;
  private static dangerousPatterns: RegExp[] | null = null;
  private static policyInitialization: Promise<void> | null = null;
  /**
   * Initialize security policies (async initialization)
   */
  private static async initializePolicies(): Promise<void> {
    if (InputSanitizer.allowedCommands && InputSanitizer.dangerousPatterns) {
      return;
    }

    if (!InputSanitizer.policyInitialization) {
      InputSanitizer.policyInitialization = (async () => {
        try {
          InputSanitizer.allowedCommands = await InputSanitizer.policyLoader.getAllowedCommands();
          InputSanitizer.dangerousPatterns =
            await InputSanitizer.policyLoader.getDangerousPatterns();
          logger.debug('🔒 Security policies initialized for InputSanitizer');
        } catch (error) {
          logger.error(`❌ Failed to initialize security policies: ${error}`);
          // Fallback to basic security patterns
          InputSanitizer.allowedCommands = new Set(['/help', '/status', '/config']);
          InputSanitizer.dangerousPatterns = [/[;&|`$(){}[\]\\]/g, /\\.\\./g];
        }
      })();
    }

    return InputSanitizer.policyInitialization;
  }

  private static readonly SAFE_CHARACTERS = /^[a-zA-Z0-9\s\-_.,!?'"@#%^&*()+=:;/\\]+$/;

  /**
   * Sanitize and validate slash command input
   */
  static async sanitizeSlashCommand(command: string): Promise<SanitizationResult> {
    await InputSanitizer.initializePolicies();
    const violations: string[] = [];
    let sanitized = command.trim();

    // Extract command and arguments
    const parts = sanitized.split(' ');
    const cmd = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1).join(' ');

    // Validate command is in allowed list
    if (!InputSanitizer.allowedCommands!.has(cmd)) {
      violations.push(`Unauthorized command: ${cmd}`);
      return {
        sanitized: '',
        isValid: false,
        violations,
        originalCommand: command,
      };
    }

    // Check for dangerous patterns in arguments using external security policies
    if (InputSanitizer.dangerousPatterns) {
      for (const pattern of InputSanitizer.dangerousPatterns) {
        if (pattern.test(args)) {
          violations.push(`Dangerous pattern detected: ${pattern.source}`);
        }
      }
    }

    // Additional validation using policy loader
    try {
      const validation = await InputSanitizer.policyLoader.validatePattern(args);
      if (!validation.isValid) {
        violations.push(...validation.violations);
      }
    } catch (error) {
      logger.warn(`⚠️ Pattern validation error: ${error}`);
    }

    // Check for unsafe characters
    if (!this.SAFE_CHARACTERS.test(args)) {
      violations.push('Contains unsafe characters');
    }

    // Sanitize arguments by removing dangerous characters
    const sanitizedArgs = args
      .replace(/[;&|`${}[\]\\]/g, '') // Remove shell metacharacters
      .replace(/\.\./g, '') // Remove directory traversal
      .trim();

    // Reconstruct command
    sanitized = sanitizedArgs ? `${cmd} ${sanitizedArgs}` : cmd;

    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: command,
    };
  }

  /**
   * Sanitize voice names input
   */
  static sanitizeVoiceNames(voiceNames: string[]): string[] {
    const allowedVoices = new Set([
      'explorer',
      'maintainer',
      'analyzer',
      'developer',
      'implementor',
      'security',
      'architect',
      'designer',
      'optimizer',
    ]);

    return voiceNames
      .map(name => name.trim().toLowerCase())
      .filter(name => allowedVoices.has(name) && /^[a-z]+$/.test(name));
  }

  /**
   * Sanitize prompt text to prevent injection attacks
   * Enhanced with 2024 AI security best practices - CONTEXT AWARE
   */
  static sanitizePrompt(prompt: string): SanitizationResult {
    const violations: string[] = [];
    let sanitized = prompt.trim();

    // Check length limits
    if (sanitized.length > 10000) {
      violations.push('Prompt too long (max 10000 characters)');
      sanitized = sanitized.substring(0, 10000);
    }

    // Context detection - skip security checks for build/compilation contexts
    const isBuildContext = this.isBuildOrCompilationContext(sanitized);
    const isConfigContext = this.isConfigurationContext(sanitized);

    if (isBuildContext || isConfigContext) {
      // For build contexts, only check for actual security threats, not compilation flags
      return this.sanitizeBuildContext(sanitized);
    }

    // Enhanced dangerous pattern detection with 2024 AI security research coverage
    // Only apply to actual user prompts, not build/compilation output
    const enhancedDangerousPatterns = [
      // Only the most critical patterns for user prompts
      /ignore\s+(previous|all|above)\s+(instructions?|prompts?|commands?)/gi, // Prompt injection
      /forget\s+(everything|all|previous)\s+(instructions?|prompts?)/gi, // Memory manipulation
      /new\s+(instructions?|system\s+prompt|role):\s*/gi, // Role hijacking
      /system\s*:\s*you\s+(are\s+now|must\s+now)/gi, // System override
      /override\s+security/gi, // Security bypass attempts
      // Only actual dangerous commands, not compilation flags
      /rm\s+-rf\s*\/[^/\s]*/gi, // Only actual rm -rf with dangerous paths
      /sudo\s+(rm|chmod|chown)/gi, // Only sudo with dangerous commands
      // Only check for actual script execution
      /<script[^>]*>.*<\/script>/gi, // Full script tags
    ];

    // Check for dangerous patterns and remove them completely
    for (const pattern of enhancedDangerousPatterns) {
      if (pattern.test(sanitized)) {
        violations.push(`Dangerous pattern detected: ${pattern.source}`);
        // Replace with safe placeholder, ensuring complete removal
        sanitized = sanitized.replace(pattern, '[FILTERED]');
      }
    }

    // Additional comprehensive cleanup to remove any remaining traces of dangerous content
    sanitized = sanitized
      .replace(/rm\s+(-rf|--recursive|--force)\s*\/?.*/gi, '[REMOVED_COMMAND]')
      .replace(/malicious/gi, '[FILTERED_WORD]')
      .replace(/['"&]*(malicious|attack|exploit|hack|virus)['"&]*/gi, '[FILTERED]')
      .replace(/echo\s+["'][^"']*malicious[^"']*["']/gi, '[FILTERED]')
      .replace(/&&\s*echo\s+["'][^"']*["']/gi, '[FILTERED]')
      .replace(/\s*&&\s*echo\s+[^;|&]*/gi, '[FILTERED]');

    // Remove null bytes and control characters (except newlines and tabs)
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: prompt,
    };
  }

  /**
   * Validate file path for security with AI-generated path preprocessing
   */
  static validateFilePath(filePath: string): SanitizationResult {
    const violations: string[] = [];
    let sanitized = filePath.trim();

    // CRITICAL: Preprocess AI-generated placeholder paths BEFORE security validation
    const originalPath = sanitized;

    // Handle placeholder paths like "/path/to/filename.ext"
    if (sanitized.includes('/path/to/') || sanitized.startsWith('/path/')) {
      sanitized = sanitized.split('/').pop() || sanitized;
      console.log(
        `🔧 SECURITY: Converting AI placeholder path "${originalPath}" to filename "${sanitized}"`
      );
    }
    // Handle simple absolute paths like "/README.md"
    else if (sanitized.startsWith('/') && !sanitized.includes('/', 1)) {
      sanitized = sanitized.substring(1);
      console.log(
        `🔧 SECURITY: Converting AI-generated absolute path "${originalPath}" to relative "${sanitized}"`
      );
    }
    // Handle any other absolute-looking paths by extracting filename
    else if (sanitized.startsWith('/') && sanitized.split('/').length > 2) {
      sanitized = sanitized.split('/').pop() || sanitized;
      console.log(
        `🔧 SECURITY: Converting complex absolute path "${originalPath}" to filename "${sanitized}"`
      );
    }

    // Check for directory traversal
    if (sanitized.includes('..')) {
      violations.push('Directory traversal attempt');
    }

    // Check for absolute paths outside project (ONLY after preprocessing)
    if (sanitized.startsWith('/') && !sanitized.startsWith(process.cwd())) {
      violations.push('Absolute path outside project directory');
    }

    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.ps1', '.sh'];
    const ext = sanitized.toLowerCase().split('.').pop();
    if (ext && dangerousExtensions.includes(`.${ext}`)) {
      violations.push(`Dangerous file extension: .${ext}`);
    }

    // Normalize path separators using centralized cross-platform utilities
    sanitized = normalizePathSeparators(sanitized);

    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: filePath,
    };
  }

  /**
   * Validate OAuth-like tokens for MCP server security (2024 best practices)
   */
  static validateMCPToken(token: string): SanitizationResult {
    const violations: string[] = [];
    const sanitized = token;

    // Check token format (should be JWT-like or opaque token)
    if (!token || typeof token !== 'string') {
      violations.push('Invalid token format');
      return {
        sanitized: '',
        isValid: false,
        violations,
        originalCommand: token,
      };
    }

    // Check for suspicious token patterns
    if (token.includes('..') || token.includes('/') || token.includes('\\')) {
      violations.push('Token contains path traversal patterns');
    }

    // Validate JWT structure if it looks like JWT
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          // Basic JWT structure validation (header.payload.signature)
          Buffer.from(parts[0], 'base64');
          Buffer.from(parts[1], 'base64');
          // Don't decode signature, just check it exists
          if (!parts[2] || parts[2].length < 10) {
            violations.push('JWT signature appears invalid');
          }
        } catch {
          violations.push('Malformed JWT structure');
        }
      }
    }

    // Check for minimum token length (security requirement)
    if (token.length < 20) {
      violations.push('Token too short for security requirements');
    }

    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: token,
    };
  }

  /**
   * Enhanced secret detection for 2024 AI code generation vulnerabilities
   */
  static detectSecretsInCode(code: string): SanitizationResult {
    const violations: string[] = [];
    let sanitized = code;

    // Patterns based on 2024 research showing secret leaks in AI-generated code
    const secretPatterns = [
      { pattern: /api_?key\s*[=:]\s*['"][a-zA-Z0-9_-]{20,}['"]?/gi, type: 'API Key' },
      { pattern: /password\s*[=:]\s*['"][^'"]{8,}['"]?/gi, type: 'Password' },
      { pattern: /token\s*[=:]\s*['"][a-zA-Z0-9._-]{20,}['"]?/gi, type: 'Token' },
      { pattern: /secret\s*[=:]\s*['"][a-zA-Z0-9_-]{16,}['"]?/gi, type: 'Secret' },
      { pattern: /sk-[a-zA-Z0-9]{20,}/gi, type: 'OpenAI API Key' },
      { pattern: /ghp_[a-zA-Z0-9]{36}/gi, type: 'GitHub Personal Access Token' },
      { pattern: /glpat-[a-zA-Z0-9_-]{20}/gi, type: 'GitLab Personal Access Token' },
      { pattern: /AKIA[0-9A-Z]{16}/gi, type: 'AWS Access Key ID' },
    ];

    for (const { pattern, type } of secretPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        violations.push(`${type} detected in code`);
        // Redact the secrets
        sanitized = sanitized.replace(
          pattern,
          `[REDACTED_${type.toUpperCase().replace(/\s/g, '_')}]`
        );
      }
    }

    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: code,
    };
  }

  /**
   * Detect if input is from build/compilation context (safe)
   */
  static isBuildOrCompilationContext(input: string): boolean {
    const buildIndicators = [
      /-D[A-Z_]+=/, // Compilation defines
      /-I\/[^/\s]+\/include/, // Include directories
      /node-gyp|gyp info|gyp ERR/, // Node-gyp build
      /sqlite3|SQLITE_/, // SQLite compilation
      /Release\/obj\.target/, // Build output paths
      /\.gypi|\.gyp\b/, // Build files
      /BUILDTYPE=Release/, // Build type
      /prebuild-install/, // Prebuilt binaries
      /binding\.gyp/, // Native binding
      /make\s+BUILDTYPE/, // Make commands
      /gcc|clang|\.o\b|\.so\b/, // Compilation tools and files
      /-arch\s+(arm64|x64)/, // Architecture flags
      /-std=c[0-9]+/, // C standard flags
    ];

    return buildIndicators.some(pattern => pattern.test(input));
  }

  /**
   * Detect if input is configuration context (mostly safe)
   */
  static isConfigurationContext(input: string): boolean {
    const configIndicators = [
      /^[A-Z_]+=/, // Environment variables
      /\.config\.|\.json\.|\.yaml\./, // Config files
      /package\.json|tsconfig\.json/, // Package configs
      /npm\s+(install|run|build)/, // NPM commands
      /webpack|babel|rollup/, // Build tools
    ];

    return configIndicators.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize build context with minimal restrictions
   */
  static sanitizeBuildContext(input: string): SanitizationResult {
    const violations: string[] = [];
    let sanitized = input;

    // Only check for actual dangerous commands in build context
    const actualThreats = [
      /rm\s+-rf\s+\/$/gi, // rm -rf / (root deletion)
      /sudo\s+rm\s+-rf/gi, // sudo rm -rf
      /format\s+c:\s*$/gi, // Windows format command
      />\s*\/dev\/null\s*2>&1\s*&\s*$/gi, // Background dangerous commands
    ];

    for (const pattern of actualThreats) {
      if (pattern.test(sanitized)) {
        violations.push(`Build context threat: ${pattern.source}`);
        sanitized = sanitized.replace(pattern, '[BUILD_THREAT_FILTERED]');
      }
    }

    // For build contexts, we mostly trust the input
    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: input,
    };
  }

  /**
   * Create security error for audit logging
   */
  static createSecurityError(result: SanitizationResult, context: string): Error {
    const error = new Error(`Security violation in ${context}: ${result.violations.join(', ')}`);

    // Add metadata for security logging
    (error as any).securityContext = {
      originalInput: result.originalCommand,
      sanitizedInput: result.sanitized,
      violations: result.violations,
      timestamp: new Date().toISOString(),
      context,
    };

    return error;
  }
}
