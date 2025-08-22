import { logger } from '../logger.js';

/**
 * Validation result from security checks
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAlternative?: string;
}

/**
 * Security policy configuration
 */
export interface SecurityPolicy {
  allowNetworkAccess: boolean;
  allowFileSystemWrite: boolean;
  allowProcessSpawning: boolean;
  allowEnvironmentAccess: boolean;
  maxExecutionTime: number;
  allowedCommands: string[];
  blockedCommands: string[];
  allowedLanguages: string[];
}

/**
 * Default security policy for E2B execution
 */
const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  allowNetworkAccess: false,
  allowFileSystemWrite: true,
  allowProcessSpawning: false,
  allowEnvironmentAccess: false,
  maxExecutionTime: 30000, // 30 seconds
  allowedCommands: [
    'ls',
    'cat',
    'echo',
    'pwd',
    'whoami',
    'date',
    'grep',
    'find',
    'sort',
    'uniq',
    'head',
    'tail',
    'wc',
    'cut',
    'awk',
    'sed',
    'diff',
    'file',
    'which',
    'type',
  ],
  blockedCommands: [
    'rm',
    'rmdir',
    'delete',
    'del',
    'format',
    'fdisk',
    'mkfs',
    'dd',
    'shutdown',
    'reboot',
    'halt',
    'poweroff',
    'init',
    'service',
    'systemctl',
    'sudo',
    'su',
    'passwd',
    'chmod',
    'chown',
    'chgrp',
    'umask',
    'setuid',
    'mount',
    'umount',
    'crontab',
    'at',
    'batch',
    'nohup',
    'screen',
    'tmux',
    'ssh',
    'scp',
    'rsync',
    'wget',
    'curl',
    'nc',
    'netcat',
    'telnet',
    'ftp',
    'mail',
    'sendmail',
    'postfix',
    'apache',
    'nginx',
    'mysql',
    'postgres',
  ],
  allowedLanguages: ['python', 'javascript', 'bash', 'shell'],
};

/**
 * Security validation patterns for code and commands
 */
const SECURITY_PATTERNS = {
  // Command injection patterns
  COMMAND_INJECTION: [
    /;\s*rm\s+-rf/, // Dangerous deletion
    /\|\s*sh/, // Pipe to shell
    /\|\s*bash/, // Pipe to bash
    /\$\(.*\)/, // Command substitution
    /`.*`/, // Backtick command execution
    /&&\s*rm/, // Chain dangerous commands
    /\|\s*nc/, // Pipe to netcat
    />\s*\/dev\/null.*&/, // Background dangerous processes
  ],

  // Network access patterns
  NETWORK_ACCESS: [
    /wget\s+/, // Download files
    /curl\s+/, // Make HTTP requests
    /nc\s+.*\d+/, // Netcat with port
    /ssh\s+/, // SSH connections
    /scp\s+/, // Secure copy
    /ftp\s+/, // FTP connections
    /telnet\s+/, // Telnet connections
    /rsync\s+.*::/, // Remote rsync
  ],

  // File system abuse patterns
  FILE_SYSTEM_ABUSE: [
    /rm\s+-rf\s+\//, // Delete root
    /chmod\s+777/, // Dangerous permissions
    /chown\s+root/, // Change to root ownership
    />>\s*\/etc\//, // Append to system files
    />\s*\/etc\//, // Overwrite system files
    /\/dev\/sd[a-z]/, // Direct disk access
    /\/proc\//, // Process filesystem access
    /\/sys\//, // System filesystem access
  ],

  // Privilege escalation patterns
  PRIVILEGE_ESCALATION: [
    /sudo\s+/, // Sudo usage
    /su\s+/, // Switch user
    /passwd\s*$/, // Change password
    /setuid\s*\(/, // Set user ID
    /setgid\s*\(/, // Set group ID
    /exec\s*\(/, // Execute with privileges
  ],

  // Process manipulation patterns
  PROCESS_MANIPULATION: [
    /kill\s+-9/, // Force kill processes
    /killall\s+/, // Kill all processes
    /pkill\s+/, // Kill processes by name
    /nohup\s+/, // Run in background
    /&\s*$/, // Background process
    /fork\s*\(/, // Fork processes
    /clone\s*\(/, // Clone processes
  ],

  // Environment manipulation patterns
  ENVIRONMENT_MANIPULATION: [
    /export\s+PATH=/, // Modify PATH
    /export\s+LD_/, // Modify library paths
    /unset\s+/, // Unset environment variables
    /env\s+-i/, // Clear environment
    /exec\s+env/, // Execute with modified environment
  ],

  // Code injection patterns (for code validation)
  CODE_INJECTION: [
    /__import__\s*\(\s*['""]os['""]\s*\)/, // Python os import
    /__import__\s*\(\s*['""]subprocess['""]\s*\)/, // Python subprocess import
    /eval\s*\(/, // Dangerous eval
    /exec\s*\(/, // Dangerous exec
    /compile\s*\(/, // Code compilation
    /globals\s*\(\s*\)/, // Access to globals
    /locals\s*\(\s*\)/, // Access to locals
    /getattr\s*\(/, // Dynamic attribute access
    /setattr\s*\(/, // Dynamic attribute setting
    /delattr\s*\(/, // Dynamic attribute deletion
  ],
};

/**
 * Comprehensive security validator for E2B code execution
 */
export class SecurityValidator {
  private policy: SecurityPolicy;

  constructor(policy?: Partial<SecurityPolicy>) {
    this.policy = { ...DEFAULT_SECURITY_POLICY, ...policy };
  }

  /**
   * Validate a command before execution
   */
  validateCommand(command: string): ValidationResult {
    const trimmedCommand = command.trim();

    if (!trimmedCommand) {
      return {
        isValid: false,
        reason: 'Empty command not allowed',
        severity: 'low',
      };
    }

    // Check for explicitly blocked commands
    const commandWord = trimmedCommand.split(' ')[0].toLowerCase();
    if (this.policy.blockedCommands.includes(commandWord)) {
      return {
        isValid: false,
        reason: `Command '${commandWord}' is explicitly blocked`,
        severity: 'critical',
        suggestedAlternative: this.getSafeAlternative(commandWord),
      };
    }

    // Check against security patterns
    const patternCheck = this.checkSecurityPatterns(trimmedCommand);
    if (!patternCheck.isValid) {
      return patternCheck;
    }

    // Check for network access if not allowed
    if (!this.policy.allowNetworkAccess) {
      for (const pattern of SECURITY_PATTERNS.NETWORK_ACCESS) {
        if (pattern.test(trimmedCommand)) {
          return {
            isValid: false,
            reason: 'Network access is not allowed',
            severity: 'high',
          };
        }
      }
    }

    // Check for process spawning if not allowed
    if (!this.policy.allowProcessSpawning) {
      for (const pattern of SECURITY_PATTERNS.PROCESS_MANIPULATION) {
        if (pattern.test(trimmedCommand)) {
          return {
            isValid: false,
            reason: 'Process spawning/manipulation is not allowed',
            severity: 'high',
          };
        }
      }
    }

    // All checks passed
    return {
      isValid: true,
      severity: 'low',
    };
  }

  /**
   * Validate code before execution
   */
  validateCode(code: string, language: string): ValidationResult {
    // Check if language is allowed
    if (!this.policy.allowedLanguages.includes(language.toLowerCase())) {
      return {
        isValid: false,
        reason: `Language '${language}' is not allowed`,
        severity: 'critical',
      };
    }

    // Check for code injection patterns
    for (const pattern of SECURITY_PATTERNS.CODE_INJECTION) {
      if (pattern.test(code)) {
        return {
          isValid: false,
          reason: 'Potentially dangerous code injection pattern detected',
          severity: 'critical',
        };
      }
    }

    // Language-specific validation
    switch (language.toLowerCase()) {
      case 'python':
        return this.validatePythonCode(code);
      case 'javascript':
        return this.validateJavaScriptCode(code);
      case 'bash':
      case 'shell':
        return this.validateBashCode(code);
      default:
        return this.validateGenericCode(code);
    }
  }

  /**
   * Validate Python code specifically
   */
  private validatePythonCode(code: string): ValidationResult {
    const dangerousPatterns = [
      /import\s+os\b/, // Direct os import
      /import\s+subprocess\b/, // Direct subprocess import
      /import\s+sys\b/, // Direct sys import
      /from\s+os\s+import/, // Import from os
      /from\s+subprocess\s+import/, // Import from subprocess
      /__builtins__/, // Access to builtins
      /open\s*\(\s*['"][^'"]*\/etc\//, // Open system files
      /open\s*\(\s*['"][^'"]*\/proc\//, // Open proc files
      /open\s*\(\s*['"][^'"]*\/sys\//, // Open sys files
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          isValid: false,
          reason: 'Dangerous Python pattern detected',
          severity: 'high',
        };
      }
    }

    return { isValid: true, severity: 'low' };
  }

  /**
   * Validate JavaScript code specifically
   */
  private validateJavaScriptCode(code: string): ValidationResult {
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]/, // Node.js child_process
      /require\s*\(\s*['"]fs['"]/, // Node.js filesystem
      /require\s*\(\s*['"]os['"]/, // Node.js os module
      /process\.env/, // Environment access
      /process\.exit/, // Process exit
      /eval\s*\(/, // Dangerous eval
      /Function\s*\(/, // Function constructor
      /setTimeout\s*\(.*eval/, // Delayed eval
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          isValid: false,
          reason: 'Dangerous JavaScript pattern detected',
          severity: 'high',
        };
      }
    }

    return { isValid: true, severity: 'low' };
  }

  /**
   * Validate Bash code specifically
   */
  private validateBashCode(code: string): ValidationResult {
    // Bash code validation is the same as command validation
    return this.validateCommand(code);
  }

  /**
   * Validate generic code
   */
  private validateGenericCode(code: string): ValidationResult {
    // Basic validation for any code type
    const suspiciousPatterns = [
      /\beval\b/, // Eval functions
      /\bexec\b/, // Exec functions
      /\bsystem\b/, // System calls
      /\bshell\b/, // Shell access
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(code)) {
        return {
          isValid: false,
          reason: 'Potentially dangerous code pattern detected',
          severity: 'medium',
        };
      }
    }

    return { isValid: true, severity: 'low' };
  }

  /**
   * Validate file operation
   */
  validateFileOperation(operation: string, path: string): ValidationResult {
    // Normalize path
    const normalizedPath = path.replace(/\/+/g, '/').replace(/\.\./g, '');

    // Check for system file access
    const systemPaths = [
      '/etc/',
      '/proc/',
      '/sys/',
      '/dev/',
      '/boot/',
      '/root/',
      '/usr/bin/',
      '/usr/sbin/',
      '/bin/',
      '/sbin/',
    ];

    for (const systemPath of systemPaths) {
      if (normalizedPath.startsWith(systemPath)) {
        return {
          isValid: false,
          reason: `Access to system path '${systemPath}' is not allowed`,
          severity: 'critical',
        };
      }
    }

    // Check operation type
    if (operation === 'write' && !this.policy.allowFileSystemWrite) {
      return {
        isValid: false,
        reason: 'File system write operations are not allowed',
        severity: 'high',
      };
    }

    // Check for dangerous file types
    const dangerousExtensions = ['.sh', '.bat', '.exe', '.com', '.scr', '.pif'];
    const fileExtension = path.toLowerCase().substring(path.lastIndexOf('.'));

    if (dangerousExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        reason: `File type '${fileExtension}' is not allowed`,
        severity: 'high',
      };
    }

    return { isValid: true, severity: 'low' };
  }

  /**
   * Check against all security patterns
   */
  private checkSecurityPatterns(input: string): ValidationResult {
    // Check command injection
    for (const pattern of SECURITY_PATTERNS.COMMAND_INJECTION) {
      if (pattern.test(input)) {
        return {
          isValid: false,
          reason: 'Command injection pattern detected',
          severity: 'critical',
        };
      }
    }

    // Check file system abuse
    for (const pattern of SECURITY_PATTERNS.FILE_SYSTEM_ABUSE) {
      if (pattern.test(input)) {
        return {
          isValid: false,
          reason: 'File system abuse pattern detected',
          severity: 'critical',
        };
      }
    }

    // Check privilege escalation
    for (const pattern of SECURITY_PATTERNS.PRIVILEGE_ESCALATION) {
      if (pattern.test(input)) {
        return {
          isValid: false,
          reason: 'Privilege escalation attempt detected',
          severity: 'critical',
        };
      }
    }

    // Check environment manipulation
    for (const pattern of SECURITY_PATTERNS.ENVIRONMENT_MANIPULATION) {
      if (pattern.test(input)) {
        return {
          isValid: false,
          reason: 'Environment manipulation detected',
          severity: 'high',
        };
      }
    }

    return { isValid: true, severity: 'low' };
  }

  /**
   * Get safe alternative for blocked commands
   */
  private getSafeAlternative(command: string): string | undefined {
    const alternatives: Record<string, string> = {
      rm: 'Use file management operations instead',
      sudo: 'Operations run in isolated sandbox',
      wget: 'Use file upload functionality',
      curl: 'Use file upload functionality',
      ssh: 'Not available in sandbox environment',
      mount: 'Filesystem is managed automatically',
      chmod: 'File permissions are managed automatically',
    };

    return alternatives[command];
  }

  /**
   * Log security violation
   */
  logSecurityViolation(
    sessionId: string,
    violationType: string,
    content: string,
    severity: string
  ): void {
    logger.warn(`🚨 Security violation in session ${sessionId}:`, {
      type: violationType,
      severity,
      content: content.substring(0, 200),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update security policy
   */
  updatePolicy(newPolicy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
    logger.info('🔒 Security policy updated');
  }

  /**
   * Get current security policy
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  /**
   * Create a validator with stricter security
   */
  static createStrictValidator(): SecurityValidator {
    return new SecurityValidator({
      allowNetworkAccess: false,
      allowFileSystemWrite: false,
      allowProcessSpawning: false,
      allowEnvironmentAccess: false,
      maxExecutionTime: 15000, // 15 seconds
      blockedCommands: [...DEFAULT_SECURITY_POLICY.blockedCommands, 'pip', 'npm', 'apt', 'yum'],
      allowedLanguages: ['python'],
    });
  }

  /**
   * Create a validator with relaxed security for development
   */
  static createDevelopmentValidator(): SecurityValidator {
    return new SecurityValidator({
      allowNetworkAccess: true,
      allowFileSystemWrite: true,
      allowProcessSpawning: false,
      allowEnvironmentAccess: false,
      maxExecutionTime: 60000, // 60 seconds
      allowedLanguages: ['python', 'javascript', 'bash', 'shell'],
    });
  }
}
