/**
 * Input sanitization and validation utilities for CLI security
 * Addresses CVSS 7.8 command injection vulnerability
 */

export interface SanitizationResult {
  sanitized: string;
  isValid: boolean;
  violations: string[];
  originalCommand?: string;
}

export class InputSanitizer {
  private static readonly ALLOWED_SLASH_COMMANDS = new Set([
    '/help',
    '/voices',
    '/voice',
    '/mode',
    '/todo',
    '/plan',
    '/dual',
    '/dualagent',
    '/stream',
    '/audit',
    '/autoconfig',
    '/config',
  ]);

  private static readonly DANGEROUS_PATTERNS = [
    /[;&|`$(){}[\]\\]/g, // Shell metacharacters
    /\.\./g, // Directory traversal
    /(rm|del|format|shutdown|reboot|halt)/i, // Dangerous commands
    /(exec|eval|system|spawn)/i, // Code execution
    /(<script|javascript:|data:)/i, // Script injection
    /(union|select|insert|update|delete|drop)/i, // SQL injection
    /(malicious|attack|exploit|hack|virus|trojan)/i, // Malicious keywords
  ];

  private static readonly SAFE_CHARACTERS = /^[a-zA-Z0-9\s\-_.,!?'"@#%^&*()+=:;/\\]+$/;

  /**
   * Sanitize and validate slash command input
   */
  static sanitizeSlashCommand(command: string): SanitizationResult {
    const violations: string[] = [];
    let sanitized = command.trim();

    // Extract command and arguments
    const parts = sanitized.split(' ');
    const cmd = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1).join(' ');

    // Validate command is in allowed list
    if (!this.ALLOWED_SLASH_COMMANDS.has(cmd)) {
      violations.push(`Unauthorized command: ${cmd}`);
      return {
        sanitized: '',
        isValid: false,
        violations,
        originalCommand: command,
      };
    }

    // Check for dangerous patterns in arguments
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(args)) {
        violations.push(`Dangerous pattern detected: ${pattern.source}`);
      }
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
   */
  static sanitizePrompt(prompt: string): SanitizationResult {
    const violations: string[] = [];
    let sanitized = prompt.trim();

    // Check length limits
    if (sanitized.length > 10000) {
      violations.push('Prompt too long (max 10000 characters)');
      sanitized = sanitized.substring(0, 10000);
    }

    // Enhanced dangerous pattern detection with more comprehensive coverage
    const enhancedDangerousPatterns = [
      /[;&|`$(){}[\]\\]/g, // Shell metacharacters
      /\.\./g, // Directory traversal
      /(rm|del|format|shutdown|reboot|halt)\s*(-[a-zA-Z]*\s*)*\s*[\/\\]*/gi, // Dangerous commands with flags
      /(exec|eval|system|spawn|cmd|sh|bash|powershell)/gi, // Code execution
      /(<script|javascript:|data:)/gi, // Script injection
      /(union|select|insert|update|delete|drop)/gi, // SQL injection
      /(malicious|attack|exploit|hack|virus|trojan|backdoor|payload)/gi, // Malicious keywords
      /echo\s+["'].*malicious.*["']/gi, // Echo commands with malicious content
      /&&\s*(echo|printf|cat|ls|dir)/gi, // Command chaining
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
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: prompt,
    };
  }

  /**
   * Validate file path for security
   */
  static validateFilePath(filePath: string): SanitizationResult {
    const violations: string[] = [];
    let sanitized = filePath.trim();

    // Check for directory traversal
    if (sanitized.includes('..')) {
      violations.push('Directory traversal attempt');
    }

    // Check for absolute paths outside project
    if (sanitized.startsWith('/') && !sanitized.startsWith(process.cwd())) {
      violations.push('Absolute path outside project directory');
    }

    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.ps1', '.sh'];
    const ext = sanitized.toLowerCase().split('.').pop();
    if (ext && dangerousExtensions.includes(`.${ext}`)) {
      violations.push(`Dangerous file extension: .${ext}`);
    }

    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/');

    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: filePath,
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
