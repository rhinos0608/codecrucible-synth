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
import * as path from 'path';
import { promises as fs, statSync } from 'fs';
import { PathUtilities } from '../../utils/path-utilities.js';

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
  
  // Throttling for verbose path debug logs
  private pathLogThrottler = {
    count: 0,
    lastLogged: 0,
    logInterval: 30000, // Log every 30 seconds max
    sampleRate: 100,    // Log every 100th validation
    warningThreshold: 1000 // Warn if high volume
  };

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB default
      maxPathDepth: 10,
      allowedExtensions: [
        '.js',
        '.ts',
        '.jsx',
        '.tsx',
        '.json',
        '.yaml',
        '.yml',
        '.md',
        '.txt',
        '.log',
        '.csv',
        '.xml',
        '.html',
        '.css',
        '.py',
        '.rs',
        '.go',
        '.java',
        '.c',
        '.cpp',
        '.h',
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
        '.idea',
      ],
      sanitizeInputs: true,
      enablePathTraversal: true,
      maxConcurrentOperations: 10,
      ...config,
    };

    // Compile blocked path patterns for performance
    this.blockedPathPatterns = this.config.blockedPaths.map(
      pattern => new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
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
    if (cached && Date.now() - (cached as any).timestamp < 30000) {
      // 30s cache
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
          score: 60,
        },
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
          if (firstKey !== undefined) {
            this.pathCache.delete(firstKey);
          }
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
            score: 100,
          },
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
          score: 50,
        },
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
            score: 80,
          },
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

    // 6. File/directory validation (for read operations)
    if (context.operation === 'read') {
      try {
        const stats = await fs.stat(sanitizedPath);
        
        // If it's a directory, allow directory operations
        if (stats.isDirectory()) {
          riskFactors.push('Directory operation');
          riskScore += 5; // Lower risk for directory operations
        }
        // If it's a file, validate size
        else if (stats.isFile()) {
          if (stats.size > this.config.maxFileSize) {
            return {
              allowed: false,
              reason: `File too large (${stats.size} bytes > ${this.config.maxFileSize} bytes)`,
              warnings,
              riskAssessment: {
                level: 'medium',
                factors: ['Oversized file'],
                score: 50,
              },
            };
          }

          // Large files are risky for memory
          if (stats.size > outputConfig.getConfig().maxBufferSize) {
            warnings.push('Large file - streaming recommended');
            riskFactors.push('Large file size');
            riskScore += 10;
          }
        }
      } catch (error) {
        // Path doesn't exist - provide specific error messages based on context
        const { reason, actionableAdvice } = this.generateSpecificPathError(sanitizedPath, context);
        
        warnings.push(actionableAdvice);
        
        return {
          allowed: false,
          reason,
          warnings,
          riskAssessment: {
            level: 'low',
            factors: ['Path not found', 'Missing resource'],
            score: 10,
          },
        };
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
        riskLevel,
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
        score: riskScore,
      },
    };

    // Cache result for performance
    const cacheKey = `${sanitizedPath}:${context.operation}`;
    this.pathCache.set(cacheKey, result);

    // Track security statistics
    return this.trackSecurityResult(result);
  }

  /**
   * Sanitize file path using centralized utilities
   */
  private sanitizePath(filePath: string): string {
    // Use centralized path normalization with security features
    return PathUtilities.normalizeAIPath(filePath, {
      allowAbsolute: true,
      allowRelative: true,
      allowTraversal: false,
      basePath: process.cwd()
    });
  }

  /**
   * Check for path traversal attacks using centralized utilities
   */
  private checkPathTraversal(filePath: string): { safe: boolean; suspicious: boolean } {
    const hasTraversal = PathUtilities.hasPathTraversal(filePath);
    const isWithinBounds = PathUtilities.isWithinBoundaries(filePath, [process.cwd()]);
    
    const safe = !hasTraversal && isWithinBounds;
    const suspicious = hasTraversal || !isWithinBounds;

    // Throttled debug logging to prevent spam
    this.logPathValidationThrottled(filePath, hasTraversal, isWithinBounds, safe, suspicious);

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
      'rm',
      'del',
      'format',
      'fdisk',
      'mkfs',
      'dd',
      'sudo',
      'su',
      'chmod',
      'chown',
      'curl',
      'wget',
      'nc',
      'netcat',
      'telnet',
    ];

    if (dangerousCommands.includes(command.toLowerCase())) {
      riskScore += 50;
      riskFactors.push('Dangerous command detected');
    }

    // Check for shell injection patterns
    const shellPatterns = [
      /[;&|`$()]/, // Shell metacharacters
      /\$\([^)]*\)/, // Command substitution
      /`[^`]*`/, // Backtick execution
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
        score: riskScore,
      },
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
        critical: this.riskLevelCounts.critical,
      },
    };
  }

  /**
   * Clear security cache
   */
  clearCache(): void {
    this.pathCache.clear();
    logger.info('Security validation cache cleared');
  }

  /**
   * Generate specific error messages and actionable advice for missing paths
   */
  private generateSpecificPathError(
    sanitizedPath: string, 
    context: SecurityContext
  ): { reason: string; actionableAdvice: string } {
    const pathExtension = path.extname(sanitizedPath);
    const hasExtension = pathExtension.length > 0;
    const operation = context.operation;
    const resourceType = context.resourceType;

    // Determine likely intended type based on context clues
    const isLikelyFile = hasExtension || 
                         operation === 'read' || 
                         resourceType === 'file' ||
                         sanitizedPath.includes('.');
    
    const isLikelyDirectory = !hasExtension || 
                              operation === 'list' || 
                              resourceType === 'directory' ||
                              sanitizedPath.endsWith('/') ||
                              sanitizedPath.endsWith('\\');

    // Generate specific error message
    let reason: string;
    let actionableAdvice: string;

    if (isLikelyFile && !isLikelyDirectory) {
      reason = `File does not exist: ${sanitizedPath}`;
      
      // Provide specific advice for files
      const fileName = path.basename(sanitizedPath);
      const directory = path.dirname(sanitizedPath);
      
      actionableAdvice = this.generateFileAdvice(fileName, directory, pathExtension, operation);
      
    } else if (isLikelyDirectory && !isLikelyFile) {
      reason = `Directory does not exist: ${sanitizedPath}`;
      
      // Provide specific advice for directories
      actionableAdvice = this.generateDirectoryAdvice(sanitizedPath, operation);
      
    } else {
      // Ambiguous case - provide both possibilities
      reason = `Path does not exist: ${sanitizedPath}`;
      actionableAdvice = `Check if this path should be a file or directory. ` +
                        `Verify the path exists and you have access permissions.`;
    }

    return { reason, actionableAdvice };
  }

  /**
   * Generate specific advice for missing files
   */
  private generateFileAdvice(fileName: string, directory: string, extension: string, operation: string): string {
    const advice: string[] = [];

    // Operation-specific advice
    switch (operation) {
      case 'read':
        advice.push(`Ensure the file '${fileName}' exists in '${directory}'`);
        break;
      case 'write':
        advice.push(`The file '${fileName}' will be created in '${directory}'`);
        break;
      default:
        advice.push(`Verify the file '${fileName}' exists`);
    }

    // Extension-specific advice
    if (extension) {
      const commonExtensions: Record<string, string> = {
        '.js': 'JavaScript file',
        '.ts': 'TypeScript file', 
        '.json': 'JSON configuration file',
        '.md': 'Markdown documentation file',
        '.txt': 'text file',
        '.log': 'log file',
        '.env': 'environment configuration file'
      };
      
      const fileType = commonExtensions[extension.toLowerCase()];
      if (fileType) {
        advice.push(`Expected ${fileType}`);
      }
    }

    // Directory-specific advice
    const fullPath = path.join(directory, fileName);
    if (directory !== '.' && directory !== fullPath) {
      advice.push(`Check if directory '${directory}' exists`);
    }

    return advice.join('. ') + '.';
  }

  /**
   * Generate specific advice for missing directories
   */
  private generateDirectoryAdvice(directoryPath: string, operation: string): string {
    const advice: string[] = [];
    const dirName = path.basename(directoryPath);
    const parentDir = path.dirname(directoryPath);

    // Operation-specific advice
    switch (operation) {
      case 'list':
        advice.push(`Directory '${dirName}' not found for listing contents`);
        break;
      case 'read':
        advice.push(`Cannot access directory '${dirName}' for reading`);
        break;
      case 'write':
        advice.push(`Directory '${dirName}' must exist before writing files to it`);
        break;
      default:
        advice.push(`Directory '${dirName}' does not exist`);
    }

    // Parent directory advice
    if (parentDir !== '.' && parentDir !== directoryPath) {
      advice.push(`Verify parent directory '${parentDir}' exists`);
    }

    // Common directory patterns advice
    const commonDirPatterns = ['src', 'dist', 'build', 'node_modules', 'test', 'tests'];
    if (commonDirPatterns.includes(dirName.toLowerCase())) {
      advice.push(`'${dirName}' is typically a project directory`);
    }

    // Creation advice for write operations
    if (operation === 'write') {
      advice.push(`Consider creating the directory first`);
    }

    return advice.join('. ') + '.';
  }

  /**
   * Throttled path validation logging to prevent spam
   */
  private logPathValidationThrottled(
    filePath: string, 
    hasTraversal: boolean, 
    isWithinBounds: boolean, 
    safe: boolean, 
    suspicious: boolean
  ): void {
    this.pathLogThrottler.count++;
    const now = Date.now();
    
    // Check if we should log based on sample rate or time interval
    const shouldLogSample = this.pathLogThrottler.count % this.pathLogThrottler.sampleRate === 0;
    const shouldLogTime = (now - this.pathLogThrottler.lastLogged) > this.pathLogThrottler.logInterval;
    const shouldLogSuspicious = suspicious; // Always log suspicious activity
    
    if (shouldLogSample || shouldLogTime || shouldLogSuspicious) {
      // Use debug level instead of info to reduce noise
      const logLevel = suspicious ? 'warn' : 'debug';
      const logData = {
        originalPath: filePath,
        hasTraversal,
        isWithinBounds,
        safe,
        suspicious,
        validationCount: this.pathLogThrottler.count,
        ...(shouldLogSample && { reason: 'sample' }),
        ...(shouldLogTime && { reason: 'time-interval' }),
        ...(shouldLogSuspicious && { reason: 'suspicious-activity' })
      };
      
      if (logLevel === 'warn') {
        logger.warn(`[SECURITY] Suspicious path validation:`, logData);
      } else {
        logger.debug(`[SECURITY] Path validation sample:`, logData);
      }
      
      this.pathLogThrottler.lastLogged = now;
    }
    
    // Warn about high volume of path validations (potential DoS or bug)
    if (this.pathLogThrottler.count > 0 && 
        this.pathLogThrottler.count % this.pathLogThrottler.warningThreshold === 0) {
      logger.warn(`[SECURITY] High volume of path validations detected`, {
        totalValidations: this.pathLogThrottler.count,
        timeElapsed: now - (this.pathLogThrottler.lastLogged - this.pathLogThrottler.logInterval),
        avgPerSecond: Math.round(this.pathLogThrottler.count / ((now - (this.pathLogThrottler.lastLogged - this.pathLogThrottler.logInterval)) / 1000)),
        possibleCause: 'DoS attack, infinite loop, or excessive file operations'
      });
    }
  }
}

// Export singleton instance with default configuration
export const mcpServerSecurity = new MCPServerSecurity();
