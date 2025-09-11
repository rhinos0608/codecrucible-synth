/**
 * Centralized Path Utilities
 *
 * Provides robust, cross-platform path normalization and validation
 * Consolidates scattered path logic throughout the codebase
 * Follows security-first principles with comprehensive validation
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { logger } from '../infrastructure/logging/unified-logger.js';
import { toReadonlyRecord } from './type-guards.js';

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
    /\.\.[/\\]/g, // Parent directory traversal
    /[<>:"|?*]/g, // Windows forbidden characters
    /[\x00-\x1F]/g, // Control characters (hexadecimal range)
    /\.{3,}/g, // Multiple consecutive dots
  ];

  private static readonly WINDOWS_RESERVED_NAMES = new Set([
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ]);

  /**
   * Intelligently normalize AI-generated paths without over-sanitization
   */
  public static normalizeAIPath(
    filePath: Readonly<string>,
    options: PathNormalizationOptions = {}
  ): string {
    if (!filePath || typeof filePath !== 'string') {
      return filePath || '.';
    }

    const { allowAbsolute = true, allowRelative = true, basePath = process.cwd() } = options;

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
          return `./${normalized}`;
        }

        return path.normalize(normalized);
      }
      return path.normalize(normalized);
    }

    // Default to current directory if nothing else applies
    return '.';
  }

  /**
   * Normalize path separators to Unix style for consistency
   */
  public static normalizePathSeparators(filePath: string): string {
    // Convert Windows backslashes to forward slashes
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Resolve paths safely with traversal protection
   */
  public static resolveSafePath(filePath: string, basePath: string = process.cwd()): string {
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
  public static async validatePath(
    filePath: string,
    options: Readonly<PathNormalizationOptions> = {}
  ): Promise<PathValidationResult> {
    const result: PathValidationResult = {
      isValid: true,
      normalizedPath: filePath,
      isAbsolute: false,
      isRelative: false,
      isDirectory: false,
      exists: false,
      warnings: [],
      securityIssues: [],
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
        result.securityIssues.push(
          `Path depth exceeds maximum (${pathDepth} > ${options.maxDepth})`
        );
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
  public static hasPathTraversal(filePath: string): boolean {
    const normalized = path.normalize(filePath);
    return (
      normalized.includes('..') || normalized.startsWith('../') || /[\/\\]..\./.test(normalized)
    );
  }

  /**
   * Get relative path between two paths safely
   */
  public static getRelativePath(from: string, to: string): string {
    try {
      const normalizedFrom = this.normalizeAIPath(from);
      const normalizedTo = this.normalizeAIPath(to);
      return path.relative(normalizedFrom, normalizedTo);
    } catch (error) {
      logger.warn(`Error calculating relative path from ${from} to ${to}`, {
        error: toReadonlyRecord(error),
      });
      return to; // Fallback to original path
    }
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  public static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed';
    }

    // Remove/replace dangerous characters
    let sanitized = filename
      .replace(/[<>:"|?*]/g, '_') // Windows forbidden chars
      .replace(/[\u0000-\u001f\u007f]/g, '') // Control characters
      .replace(/[\/\\]/g, '_') // Path separators
      .replace(/\.+$/, '') // Trailing dots
      .replace(/\s+$/, '') // Trailing spaces
      .trim();

    // Handle Windows reserved names
    if (process.platform === 'win32') {
      const baseName = sanitized.split('.')[0].toUpperCase();
      if (this.WINDOWS_RESERVED_NAMES.has(baseName)) {
        sanitized = `_${sanitized}`;
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
  public static isWithinBoundaries(filePath: string, allowedPaths: ReadonlyArray<string>): boolean {
    try {
      const normalizedPath = path.resolve(this.normalizeAIPath(filePath));

      // If no allowed paths specified, default to current working directory
      const pathsToCheck = allowedPaths.length > 0 ? allowedPaths : [process.cwd()];

      return pathsToCheck.some(allowedPath => {
        const normalizedAllowed = path.resolve(allowedPath);

        // Check if the path is exactly the allowed path or a subdirectory
        if (normalizedPath === normalizedAllowed) {
          return true; // Exact match is always allowed
        }

        // Check if it's a subdirectory
        const relativePath = path.relative(normalizedAllowed, normalizedPath);
        const isSubdirectory =
          !relativePath.startsWith('..') && !path.isAbsolute(relativePath) && relativePath !== '';

        // Additional check for Windows-style absolute paths that resolve to the same location
        if (process.platform === 'win32') {
          try {
            const absoluteAllowed = path.resolve(allowedPath);
            const absoluteFile = path.resolve(filePath);
            if (absoluteFile.startsWith(absoluteAllowed)) {
              return true;
            }
          } catch (err) {
            // Ignore resolution errors and continue with other checks
          }
        }

        return isSubdirectory;
      });
    } catch (error) {
      logger.warn(`Error checking path boundaries for ${filePath}`, {
        error: toReadonlyRecord(error),
      });
      return false;
    }
  }

  /**
   * Extract directory from path safely
   */
  public static getDirname(filePath: string): string {
    try {
      const normalized = this.normalizeAIPath(filePath);
      return path.dirname(normalized);
    } catch (error) {
      logger.warn(`Error getting dirname for ${filePath}`, { error: toReadonlyRecord(error) });
      return '.';
    }
  }

  /**
   * Join paths safely with normalization
   */
  public static joinPaths(...pathSegments: ReadonlyArray<string>): string {
    try {
      const normalizedSegments = pathSegments
        .filter(segment => segment && typeof segment === 'string')
        .map(segment => this.normalizeAIPath(segment));

      return path.join(...normalizedSegments);
    } catch (error) {
      logger.warn(`Error joining paths [${pathSegments.join(', ')}]`, {
        error: toReadonlyRecord(error),
      });
      return pathSegments[pathSegments.length - 1] || '.';
    }
  }

  /**
   * Resolve directory path with case-insensitive fallback for common directories
   */
  public static resolveCaseInsensitivePath(basePath: string, targetDir: string): string | null {
    try {
      // First try exact match
      const exactPath = path.join(basePath, targetDir);
      if (this.pathExists(exactPath)) {
        return exactPath;
      }

      // Common directory variations to check
      const variations = [
        targetDir.toLowerCase(),
        targetDir.toUpperCase(),
        targetDir.charAt(0).toUpperCase() + targetDir.slice(1).toLowerCase(),
        targetDir.charAt(0).toLowerCase() + targetDir.slice(1).toUpperCase(),
      ];

      for (const variation of variations) {
        const testPath = path.join(basePath, variation);
        if (this.pathExists(testPath)) {
          logger.debug(`Case-insensitive match found: ${targetDir} -> ${variation}`);
          return testPath;
        }
      }

      return null;
    } catch (error) {
      logger.warn(`Error resolving case-insensitive path for ${targetDir}`, {
        error: toReadonlyRecord(error),
      });
      return null;
    }
  }

  /**
   * Check if path exists synchronously (helper for case resolution)
   */
  private static pathExists(filePath: string): boolean {
    try {
      return fsSync.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

// Export convenient functions for common operations as arrow functions to avoid unbound method issues
export const normalizeAIPath = (filePath: string, options?: PathNormalizationOptions): string =>
  PathUtilities.normalizeAIPath(filePath, options);

export const normalizePathSeparators = (filePath: string): string =>
  PathUtilities.normalizePathSeparators(filePath);

export const resolveSafePath = (filePath: string, basePath?: string): string =>
  PathUtilities.resolveSafePath(filePath, basePath);

export const validatePath = async (
  filePath: string,
  options?: Readonly<PathNormalizationOptions>
): Promise<PathValidationResult> => PathUtilities.validatePath(filePath, options);

export const hasPathTraversal = (filePath: string): boolean =>
  PathUtilities.hasPathTraversal(filePath);

export const getRelativePath = (from: string, to: string): string =>
  PathUtilities.getRelativePath(from, to);

export const sanitizeFilename = (filename: string): string =>
  PathUtilities.sanitizeFilename(filename);

export const isWithinBoundaries = (filePath: string, allowedPaths: readonly string[]): boolean =>
  PathUtilities.isWithinBoundaries(filePath, allowedPaths);

export const getDirname = (filePath: string): string => PathUtilities.getDirname(filePath);

export const joinPaths = (...pathSegments: readonly string[]): string =>
  PathUtilities.joinPaths(...pathSegments);
