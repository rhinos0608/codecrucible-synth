/**
 * Terminal Command Configuration
 * 
 * Provides security validation and policy management for terminal commands.
 * Integrates with the enterprise security framework.
 */

import { logger } from '../infrastructure/logging/logger.js';

export interface TerminalCommandPolicy {
  allowedCommands: string[];
  blockedCommands: string[];
  suspiciousPatterns: string[];
  maxOutputSize: number;
  logAllCommands: boolean;
  timeouts: {
    default: number;
    [command: string]: number;
  };
}

export interface CommandValidationResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

class TerminalCommandConfig {
  private policy: TerminalCommandPolicy | null = null;
  private allowAll: boolean = false;

  private readonly defaultPolicy: TerminalCommandPolicy = {
    allowedCommands: [
      // Basic system commands
      'ls', 'dir', 'pwd', 'cd', 'mkdir', 'rmdir', 'rm', 'del', 'copy', 'cp', 'mv', 'move',
      'cat', 'type', 'head', 'tail', 'grep', 'find', 'where', 'which',
      
      // Development tools
      'node', 'npm', 'yarn', 'pnpm', 'git', 'python', 'python3', 'pip', 'pip3',
      'cargo', 'rustc', 'go', 'java', 'javac', 'gcc', 'make', 'cmake',
      'docker', 'docker-compose', 'kubectl',
      
      // Text processing
      'echo', 'printf', 'sort', 'uniq', 'wc', 'cut', 'awk', 'sed',
      
      // Network tools (safe ones)
      'curl', 'wget', 'ping', 'traceroute',
      
      // Archive tools
      'tar', 'zip', 'unzip', 'gzip', 'gunzip'
    ],
    blockedCommands: [
      // Dangerous system commands
      'sudo', 'su', 'passwd', 'chpasswd', 'useradd', 'userdel', 'usermod',
      'chmod', 'chown', 'chgrp', 'mount', 'umount', 'fdisk', 'mkfs',
      'systemctl', 'service', 'killall', 'pkill',
      
      // Network security risks
      'nc', 'netcat', 'nmap', 'telnet', 'ftp', 'ssh', 'scp', 'rsync',
      
      // Potential malware/system modification
      'dd', 'format', 'diskpart', 'reg', 'regedit'
    ],
    suspiciousPatterns: [
      // Command injection attempts
      ';', '&&', '||', '|', '`', '$(',
      
      // File system traversal
      '../', '..\\', '/etc/passwd', '/etc/shadow',
      
      // Network connections
      'nc -', 'netcat -', '/dev/tcp/', 'bash -i',
      
      // Potential data exfiltration
      'curl -X POST', 'wget --post', 'base64', 'xxd'
    ],
    maxOutputSize: 1024 * 1024, // 1MB
    logAllCommands: true,
    timeouts: {
      default: 30000, // 30 seconds
      'npm install': 300000, // 5 minutes for npm install
      'cargo build': 300000, // 5 minutes for cargo build
      'docker build': 600000, // 10 minutes for docker build
    }
  };

  public async getPolicy(): Promise<TerminalCommandPolicy> {
    if (!this.policy) {
      // For now, use default policy
      // In future, this could load from external config file
      this.policy = { ...this.defaultPolicy };
      logger.info('Loaded default terminal command policy', {
        allowedCommands: this.policy.allowedCommands.length,
        blockedCommands: this.policy.blockedCommands.length
      });
    }
    return this.policy;
  }

  public async isCommandAllowed(command: string, args: string[] = []): Promise<CommandValidationResult> {
    const policy = await this.getPolicy();
    
    // If allow-all mode is enabled, allow everything (for full-access approval mode)
    if (this.allowAll) {
      return { allowed: true, reason: 'Allow-all mode enabled' };
    }

    // Check if command is explicitly blocked
    if (policy.blockedCommands.includes(command)) {
      return { 
        allowed: false, 
        reason: `Command '${command}' is explicitly blocked for security reasons` 
      };
    }

    // Check if command is explicitly allowed
    if (policy.allowedCommands.includes(command)) {
      return { allowed: true };
    }

    // Check for partial matches (e.g., "npm" should match "npm install")
    const hasAllowedPrefix = policy.allowedCommands.some(allowed => 
      command.startsWith(allowed + ' ') || allowed.startsWith(command + ' ')
    );

    if (hasAllowedPrefix) {
      return { allowed: true };
    }

    // By default, deny unknown commands
    return { 
      allowed: false, 
      reason: `Command '${command}' is not in the allowed list. Use system commands like 'node', 'npm', 'git' directly.`,
      requiresApproval: true
    };
  }

  public async checkSuspiciousPatterns(command: string, args: string[] = []): Promise<string[]> {
    const policy = await this.getPolicy();
    const fullCommand = [command, ...args].join(' ');
    
    const foundPatterns: string[] = [];
    
    for (const pattern of policy.suspiciousPatterns) {
      if (fullCommand.includes(pattern)) {
        foundPatterns.push(pattern);
      }
    }
    
    return foundPatterns;
  }

  public async getCommandTimeout(command: string): Promise<number> {
    const policy = await this.getPolicy();
    
    // Check for exact command match first
    if (policy.timeouts[command]) {
      return policy.timeouts[command];
    }
    
    // Check for partial matches
    for (const [timeoutCommand, timeout] of Object.entries(policy.timeouts)) {
      if (command.startsWith(timeoutCommand)) {
        return timeout;
      }
    }
    
    return policy.timeouts.default;
  }

  public setAllowAll(allowAll: boolean): void {
    this.allowAll = allowAll;
    logger.info(`Terminal command allow-all mode: ${allowAll ? 'enabled' : 'disabled'}`);
  }

  public getAllowAll(): boolean {
    return this.allowAll;
  }

  public async getMaxOutputSize(): Promise<number> {
    const policy = await this.getPolicy();
    return policy.maxOutputSize;
  }

  public async shouldLogCommand(): Promise<boolean> {
    const policy = await this.getPolicy();
    return policy.logAllCommands;
  }
}

// Export singleton instance
export const terminalCommandConfig = new TerminalCommandConfig();

// Types are already exported above with the interfaces