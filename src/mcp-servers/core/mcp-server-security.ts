/**
 * MCP Server Security Manager
 * 
 * Centralized security validation and authorization for MCP operations
 * Implements defense-in-depth with input sanitization and path traversal protection
 * Follows Coding Grimoire security principles with fail-safe defaults
 * 
 * Memory-efficient with caching and lazy validation patterns
 */

import { logger } from '../../infrastructure/logging/unified-logger.js';
import { outputConfig } from '../../utils/output-config.js';
import path from 'path';
import { promises as fs } from 'fs';

export interface SecurityConfig {
  maxFileSize: number; // Maximum file size for read operations
  maxPathDepth: number; // Maximum directory traversal depth
  allowedExtensions: string[]; // Whitelisted file extensions
  blockedPaths: string[]; // Blacklisted path patterns
  sanitizeInputs: boolean; // Enable input sanitization
  enablePathTraversal: boolean; // Enable path traversal protection
  maxConcurrentOperations: number; // Limit concurrent security checks
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  operation: 'read' | 'write' | 'execute' | 'list' | 'stat';
  resourceType: 'file' | 'directory' | 'command' | 'network';
  requestedPath?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityValidationResult {
  allowed: boolean;
  sanitizedPath?: string;
  reason?: string;
  warnings: string[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    score: number; // 0-100
  };
}

/**
 * Centralized security manager with defense-in-depth validation
 */
export class MCPServerSecurity {
  private config: SecurityConfig;
  private pathCache: Map<string, SecurityValidationResult> = new Map();
  private concurrentOperations = 0;
  private blockedOperations = 0; // Track actual blocked operations
  private blockedPathPatterns: RegExp[] = [];
  private riskLevelCounts = { low: 0, medium: 0, high: 0, critical: 0 }; // Track risk levels

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB default
      maxPathDepth: 10,
      allowedExtensions: [
        '.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml',
        '.md', '.txt', '.log', '.csv', '.xml', '.html', '.css',
        '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h'
      ],
      blockedPaths: [
        'node_modules',
        '.git',
        '.env',
        'dist',
        'build',
        'target',
        '__pycache__',
        '.vscode',
        '.idea'
      ],
      sanitizeInputs: true,
      enablePathTraversal: true,
      maxConcurrentOperations: 10,
      ...config
    };

    // Compile blocked path patterns for performance
    this.blockedPathPatterns = this.config.blockedPaths.map(pattern => 
      new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    );
  }

  /**
   * Track security validation results and update counters
   */
  private trackSecurityResult(result: SecurityValidationResult): SecurityValidationResult {
    // Track blocked operations
    if (!result.allowed) {
      this.blockedOperations++;
      logger.debug(`🚫 Blocked operation: ${result.reason}`);
    }

    // Track risk level counts
    const riskLevel = result.riskAssessment.level;
    if (riskLevel in this.riskLevelCounts) {
      (this.riskLevelCounts as any)[riskLevel]++;
    }

    return result;
  }

  /**
   * Validate file system operation with comprehensive security checks
   */
  async validateFileSystemOperation(
    filePath: string,
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    // Check cache first for performance
    const cacheKey = `${filePath}:${context.operation}`;
    const cached = this.pathCache.get(cacheKey);
    if (cached && Date.now() - (cached as any).timestamp < 30000) { // 30s cache
      return cached;
    }

    // Throttle concurrent operations to prevent DoS
    if (this.concurrentOperations >= this.config.maxConcurrentOperations) {
      return {
        allowed: false,
        reason: 'Too many concurrent security validations',
        warnings: ['Rate limited'],
        riskAssessment: {
          level: 'medium',
          factors: ['Rate limiting triggered'],
          score: 60
        }
      };
    }

    this.concurrentOperations++;
    
    try {
      const result = await this.performSecurityValidation(filePath, context);
      
      // Cache successful validations
      if (result.allowed) {
        (result as any).timestamp = Date.now();
        this.pathCache.set(cacheKey, result);
        
        // Limit cache size
        if (this.pathCache.size > 1000) {
          const firstKey = this.pathCache.keys().next().value;
          this.pathCache.delete(firstKey);
        }
      }
      
      return result;
      
    } finally {
      this.concurrentOperations--;
    }
  }

  /**
   * Core security validation logic
   */
  private async performSecurityValidation(
    filePath: string,
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const warnings: string[] = [];
    const riskFactors: string[] = [];
    let riskScore = 0;

    // 1. Input sanitization
    let sanitizedPath = filePath;
    if (this.config.sanitizeInputs) {
      sanitizedPath = this.sanitizePath(filePath);
      if (sanitizedPath !== filePath) {
        warnings.push('Path was sanitized');
        riskFactors.push('Input required sanitization');
        riskScore += 10;
      }
    }

    // 2. Path traversal protection
    if (this.config.enablePathTraversal) {
      const traversalResult = this.checkPathTraversal(sanitizedPath);
      if (!traversalResult.safe) {
        return {
          allowed: false,
          reason: 'Path traversal detected',
          warnings,
          riskAssessment: {
            level: 'critical',
            factors: ['Path traversal attempt'],
            score: 100
          }
        };
      }
      
      if (traversalResult.suspicious) {
        warnings.push('Suspicious path pattern detected');
        riskFactors.push('Unusual path structure');
        riskScore += 20;
      }
    }

    // 3. Path depth validation
    const pathDepth = sanitizedPath.split(path.sep).length;
    if (pathDepth > this.config.maxPathDepth) {
      return {
        allowed: false,
        reason: `Path depth exceeds limit (${pathDepth} > ${this.config.maxPathDepth})`,
        warnings,
        riskAssessment: {
          level: 'medium',
          factors: ['Excessive path depth'],
          score: 50
        }
      };
    }

    // 4. Blocked path patterns
    for (const pattern of this.blockedPathPatterns) {
      if (pattern.test(sanitizedPath)) {
        return {
          allowed: false,
          reason: 'Path matches blocked pattern',
          warnings,
          riskAssessment: {
            level: 'high',
            factors: ['Blocked path accessed'],
            score: 80
          }
        };
      }
    }

    // 5. File extension validation
    const ext = path.extname(sanitizedPath).toLowerCase();
    if (ext && !this.config.allowedExtensions.includes(ext)) {
      warnings.push('Potentially risky file extension');
      riskFactors.push('Non-whitelisted file extension');
      riskScore += 15;
    }

    // 6. File size validation (for read operations)
    if (context.operation === 'read') {
      try {
        const stats = await fs.stat(sanitizedPath);
        if (stats.size > this.config.maxFileSize) {
          return {
            allowed: false,
            reason: `File too large (${stats.size} bytes > ${this.config.maxFileSize} bytes)`,
            warnings,
            riskAssessment: {
              level: 'medium',
              factors: ['Oversized file'],
              score: 50
            }
          };
        }
        
        // Large files are risky for memory
        if (stats.size > outputConfig.getConfig().maxBufferSize) {
          warnings.push('Large file - streaming recommended');
          riskFactors.push('Large file size');
          riskScore += 10;
        }
        
      } catch (error) {
        // File doesn't exist - might be for write operation
        if (context.operation === 'read') {
          return {
            allowed: false,
            reason: 'File does not exist',
            warnings,
            riskAssessment: {
              level: 'low',
              factors: ['File not found'],
              score: 10
            }
          };
        }
      }
    }

    // 7. Context-specific validation
    if (context.riskLevel === 'critical') {
      riskScore += 30;
      riskFactors.push('High-risk operation context');
    }

    // 8. Calculate final risk level
    const riskLevel = this.calculateRiskLevel(riskScore);
    
    // 9. Make final authorization decision
    const allowed = this.isOperationAllowed(riskLevel, context);
    
    if (!allowed) {
      logger.warn('Security validation failed', {
        path: sanitizedPath,
        context,
        riskScore,
        riskLevel
      });
    }

    const result = {
      allowed,
      sanitizedPath,
      reason: allowed ? undefined : `Operation blocked due to ${riskLevel} risk level`,
      warnings,
      riskAssessment: {
        level: riskLevel,
        factors: riskFactors,
        score: riskScore
      }
    };

    // Cache result for performance
    const cacheKey = `${sanitizedPath}:${context.operation}`;
    this.pathCache.set(cacheKey, result);
    
    // Track security statistics
    return this.trackSecurityResult(result);
  }

  /**
   * Sanitize file path to prevent injection attacks
   */
  private sanitizePath(filePath: string): string {
    // Remove null bytes and control characters
    let sanitized = filePath.replace(/[\x00-\x1f\x7f]/g, '');
    
    // Normalize path separators
    sanitized = path.normalize(sanitized);
    
    // Remove consecutive dots (but allow single . and ..)
    sanitized = sanitized.replace(/\.{3,}/g, '..');
    
    // Remove trailing spaces and dots
    sanitized = sanitized.trim().replace(/[. ]+$/, '');
    
    return sanitized;
  }

  /**
   * Check for path traversal attacks
   */
  private checkPathTraversal(filePath: string): { safe: boolean; suspicious: boolean } {
    const normalizedPath = path.resolve(filePath);
    const suspicious = filePath.includes('..') || /[\/\\]{2,}/.test(filePath);
    
    // Check if path tries to escape current working directory
    const cwd = process.cwd();
    const safe = normalizedPath.startsWith(cwd);
    
    return { safe, suspicious };
  }

  /**
   * Calculate risk level based on score
   */
  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * Make authorization decision based on risk assessment
   */
  private isOperationAllowed(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    context: SecurityContext
  ): boolean {
    // Critical operations are never allowed
    if (riskLevel === 'critical') {
      return false;
    }
    
    // High-risk operations require approval (not implemented yet)
    if (riskLevel === 'high') {
      logger.warn('High-risk operation detected - manual approval required', context);
      return false; // Conservative default
    }
    
    // Medium and low risk operations are allowed
    return true;
  }

  /**
   * Validate command execution for security
   */
  async validateCommandExecution(
    command: string,
    args: string[],
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const warnings: string[] = [];
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Check for dangerous commands
    const dangerousCommands = [
      'rm', 'del', 'format', 'fdisk', 'mkfs',
      'dd', 'sudo', 'su', 'chmod', 'chown',
      'curl', 'wget', 'nc', 'netcat', 'telnet'
    ];
    
    if (dangerousCommands.includes(command.toLowerCase())) {
      riskScore += 50;
      riskFactors.push('Dangerous command detected');
    }

    // Check for shell injection patterns
    const shellPatterns = [
      /[;&|`$()]/,  // Shell metacharacters
      /\$\([^)]*\)/, // Command substitution
      /`[^`]*`/,     // Backtick execution
    ];
    
    const fullCommand = [command, ...args].join(' ');
    for (const pattern of shellPatterns) {
      if (pattern.test(fullCommand)) {
        riskScore += 30;
        riskFactors.push('Shell injection pattern detected');
        break;
      }
    }

    const riskLevel = this.calculateRiskLevel(riskScore);
    const allowed = this.isOperationAllowed(riskLevel, context);

    const result = {
      allowed,
      reason: allowed ? undefined : 'Command execution blocked for security',
      warnings,
      riskAssessment: {
        level: riskLevel,
        factors: riskFactors,
        score: riskScore
      }
    };

    // Track security statistics  
    return this.trackSecurityResult(result);
  }

  /**
   * Get security statistics for monitoring
   */
  getSecurityStats(): {
    cacheSize: number;
    concurrentOperations: number;
    blockedOperations: number;
    riskLevelCounts: Record<string, number>;
  } {
    return {
      cacheSize: this.pathCache.size,
      concurrentOperations: this.concurrentOperations,
      blockedOperations: this.blockedOperations, // Real blocked operations tracking
      riskLevelCounts: {
        low: this.riskLevelCounts.low,
        medium: this.riskLevelCounts.medium,
        high: this.riskLevelCounts.high,
        critical: this.riskLevelCounts.critical
      }
    };
  }

  /**
   * Clear security cache
   */
  clearCache(): void {
    this.pathCache.clear();
    logger.info('Security validation cache cleared');
  }
}

// Export singleton instance with default configuration
export const mcpServerSecurity = new MCPServerSecurity();