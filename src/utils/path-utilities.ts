/**
 * Centralized Path Utilities
 * 
 * Provides robust, cross-platform path normalization and validation
 * Consolidates scattered path logic throughout the codebase
 * Follows security-first principles with comprehensive validation
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../infrastructure/logging/unified-logger.js';

export interface PathValidationResult {
  isValid: boolean;
  normalizedPath: string;
  isAbsolute: boolean;
  isRelative: boolean;
  isDirectory: boolean;
  exists: boolean;
  warnings: string[];
  securityIssues: string[];
}

export interface PathNormalizationOptions {
  allowAbsolute?: boolean;
  allowRelative?: boolean;
  allowTraversal?: boolean;
  requireExists?: boolean;
  basePath?: string;
  maxDepth?: number;
}

/**
 * Centralized path utilities with cross-platform support
 */
export class PathUtilities {
  private static readonly DANGEROUS_PATTERNS = [
    /\.\.[\/\\]/g,    // Parent directory traversal
    /[<>:"|?*]/g,     // Windows forbidden characters
    /[\x00-\x1f]/g,   // Control characters
    /\.{3,}/g,        // Multiple consecutive dots
  ];

  private static readonly WINDOWS_RESERVED_NAMES = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  ]);

  /**
   * Intelligently normalize AI-generated paths without over-sanitization
   */
  static normalizeAIPath(filePath: string, options: PathNormalizationOptions = {}): string {
    if (!filePath || typeof filePath !== 'string') {
      return filePath || '.';
    }

    const {
      allowAbsolute = true,
      allowRelative = true,
      basePath = process.cwd(),
      maxDepth = 10
    } = options;

    let normalized = filePath.trim();

    // Handle Windows path separators first
    normalized = this.normalizePathSeparators(normalized);

    // Handle special cases without over-sanitization
    if (normalized === '.' || normalized === './' || normalized === '.\\') {
      return '.';
    }

    // Handle absolute paths more intelligently
    if (path.isAbsolute(normalized)) {
      if (!allowAbsolute) {
        // Convert to relative if absolute not allowed
        const relativePath = path.relative(basePath, normalized);
        return relativePath || '.';
      }
      // Keep absolute paths as-is if allowed
      return path.normalize(normalized);
    }

    // Handle relative paths
    if (allowRelative) {
      // Ensure relative paths are properly formatted
      if (!normalized.startsWith('./') && !normalized.startsWith('../') && normalized !== '.') {
        // If it's just a filename, make it explicitly relative
        if (!normalized.includes('/') && !normalized.includes('\\')) {
          return './' + normalized;
        }
      }
      
      return path.normalize(normalized);
    }

    // Default to current directory if nothing else applies
    return '.';
  }

  /**
   * Normalize path separators to Unix style for consistency
   */
  static normalizePathSeparators(filePath: string): string {
    // Convert Windows backslashes to forward slashes
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Resolve paths safely with traversal protection
   */
  static resolveSafePath(filePath: string, basePath: string = process.cwd()): string {
    const normalized = this.normalizeAIPath(filePath);
    const resolved = path.resolve(basePath, normalized);
    
    // Ensure the resolved path stays within the base path
    const relativePath = path.relative(basePath, resolved);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      logger.warn(`Path traversal detected: ${filePath} -> ${resolved}`);
      return basePath; // Return safe fallback
    }

    return resolved;
  }

  /**
   * Comprehensive path validation with detailed feedback
   */
  static async validatePath(filePath: string, options: PathNormalizationOptions = {}): Promise<PathValidationResult> {
    const result: PathValidationResult = {
      isValid: true,
      normalizedPath: filePath,
      isAbsolute: false,
      isRelative: false,
      isDirectory: false,
      exists: false,
      warnings: [],
      securityIssues: []
    };

    try {
      // Normalize the path
      result.normalizedPath = this.normalizeAIPath(filePath, options);
      result.isAbsolute = path.isAbsolute(result.normalizedPath);
      result.isRelative = !result.isAbsolute;

      // Check for dangerous patterns
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(filePath)) {
          result.securityIssues.push(`Dangerous pattern detected: ${pattern.source}`);
        }
      }

      // Check Windows reserved names
      const basename = path.basename(result.normalizedPath, path.extname(result.normalizedPath));
      if (process.platform === 'win32' && this.WINDOWS_RESERVED_NAMES.has(basename.toUpperCase())) {
        result.securityIssues.push(`Windows reserved name: ${basename}`);
      }

      // Check if path exists and get type
      try {
        const stats = await fs.stat(result.normalizedPath);
        result.exists = true;
        result.isDirectory = stats.isDirectory();
      } catch (error) {
        result.exists = false;
        if (options.requireExists) {
          result.isValid = false;
          result.warnings.push('Path does not exist');
        }
      }

      // Validate path depth
      const pathDepth = result.normalizedPath.split('/').length;
      if (options.maxDepth && pathDepth > options.maxDepth) {
        result.isValid = false;
        result.securityIssues.push(`Path depth exceeds maximum (${pathDepth} > ${options.maxDepth})`);
      }

      // Set overall validity
      result.isValid = result.securityIssues.length === 0;

    } catch (error) {
      result.isValid = false;
      result.warnings.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Check if a path attempts directory traversal
   */
  static hasPathTraversal(filePath: string): boolean {
    const normalized = path.normalize(filePath);
    return normalized.includes('..') || normalized.startsWith('../') || /[\/\\]\.\./.test(normalized);
  }

  /**
   * Get relative path between two paths safely
   */
  static getRelativePath(from: string, to: string): string {
    try {
      const normalizedFrom = this.normalizeAIPath(from);
      const normalizedTo = this.normalizeAIPath(to);
      return path.relative(normalizedFrom, normalizedTo);
    } catch (error) {
      logger.warn(`Error calculating relative path from ${from} to ${to}:`, error);
      return to; // Fallback to original path
    }
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed';
    }

    // Remove/replace dangerous characters
    let sanitized = filename
      .replace(/[<>:"|?*]/g, '_')           // Windows forbidden chars
      .replace(/[\x00-\x1f\x7f]/g, '')     // Control characters
      .replace(/[\/\\]/g, '_')             // Path separators
      .replace(/\.+$/, '')                 // Trailing dots
      .replace(/\s+$/, '')                 // Trailing spaces
      .trim();

    // Handle Windows reserved names
    if (process.platform === 'win32') {
      const baseName = sanitized.split('.')[0].toUpperCase();
      if (this.WINDOWS_RESERVED_NAMES.has(baseName)) {
        sanitized = '_' + sanitized;
      }
    }

    // Ensure we have something
    if (!sanitized) {
      return 'unnamed';
    }

    // Limit length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const base = path.basename(sanitized, ext).substring(0, 255 - ext.length);
      sanitized = base + ext;
    }

    return sanitized;
  }

  /**
   * Check if path is within allowed directory boundaries  
   */
  static isWithinBoundaries(filePath: string, allowedPaths: string[]): boolean {
    try {
      const normalizedPath = path.resolve(this.normalizeAIPath(filePath));
      
      return allowedPaths.some(allowedPath => {
        const normalizedAllowed = path.resolve(allowedPath);
        const relativePath = path.relative(normalizedAllowed, normalizedPath);
        return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
      });
    } catch (error) {
      logger.warn(`Error checking path boundaries for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Extract directory from path safely
   */
  static getDirname(filePath: string): string {
    try {
      const normalized = this.normalizeAIPath(filePath);
      return path.dirname(normalized);
    } catch (error) {
      logger.warn(`Error getting dirname for ${filePath}:`, error);
      return '.';
    }
  }

  /**
   * Join paths safely with normalization
   */
  static joinPaths(...pathSegments: string[]): string {
    try {
      const normalizedSegments = pathSegments
        .filter(segment => segment && typeof segment === 'string')
        .map(segment => this.normalizeAIPath(segment));
      
      return path.join(...normalizedSegments);
    } catch (error) {
      logger.warn(`Error joining paths [${pathSegments.join(', ')}]:`, error);
      return pathSegments[pathSegments.length - 1] || '.';
    }
  }
}

// Export convenient functions for common operations
export const {
  normalizeAIPath,
  normalizePathSeparators,
  resolveSafePath,
  validatePath,
  hasPathTraversal,
  getRelativePath,
  sanitizeFilename,
  isWithinBoundaries,
  getDirname,
  joinPaths
} = PathUtilities;