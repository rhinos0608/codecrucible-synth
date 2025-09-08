/**
 * File Security Domain Service
 * Pure business logic for file validation and security policies
 *
 * Architecture Compliance:
 * - Domain layer: pure business logic only
 * - Uses centralized PathUtilities for consistent path handling
 * - File security policies and validation rules
 * - Path sanitization and access control logic
 */

import { PathUtilities } from '../../utils/path-utilities.js';

export interface FileSecurityPolicy {
  allowedExtensions: string[];
  forbiddenExtensions: string[];
  maxFileSize: number;
  maxPathLength: number;
  allowedDirectories: string[];
  forbiddenDirectories: string[];
  requireExtension: boolean;
  allowSymlinks: boolean;
  allowHiddenFiles: boolean;
  scanForMalware: boolean;
}

export interface PathValidationResult {
  isValid: boolean;
  violations: SecurityViolation[];
  sanitizedPath: string;
  recommendations: string[];
}

export interface FileValidationResult {
  isValid: boolean;
  violations: SecurityViolation[];
  riskLevel: RiskLevel;
  recommendations: string[];
}

export interface SecurityViolation {
  type: ViolationType;
  severity: ViolationSeverity;
  description: string;
  originalValue: string;
  suggestedValue?: string;
}

export enum ViolationType {
  FORBIDDEN_EXTENSION = 'forbidden_extension',
  FILE_TOO_LARGE = 'file_too_large',
  PATH_TOO_LONG = 'path_too_long',
  FORBIDDEN_DIRECTORY = 'forbidden_directory',
  PATH_TRAVERSAL = 'path_traversal',
  HIDDEN_FILE = 'hidden_file',
  SYMLINK_DETECTED = 'symlink_detected',
  MALICIOUS_CONTENT = 'malicious_content',
  INVALID_CHARACTERS = 'invalid_characters',
  MISSING_EXTENSION = 'missing_extension',
}

export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskLevel {
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface FileAccessRequest {
  path: string;
  operation: FileOperation;
  userId?: string;
  userRole?: string;
  context?: string;
}

export enum FileOperation {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXECUTE = 'execute',
  CREATE = 'create',
  MODIFY = 'modify',
}

/**
 * File Security Domain Service
 * Handles all file security validation and policy enforcement
 */
export class FileSecurityService {
  private readonly defaultPolicy: FileSecurityPolicy;

  public constructor(policy?: Readonly<Partial<FileSecurityPolicy>>) {
    this.defaultPolicy = {
      allowedExtensions: [
        '.txt',
        '.md',
        '.json',
        '.yaml',
        '.yml',
        '.js',
        '.ts',
        '.py',
        '.html',
        '.css',
      ],
      forbiddenExtensions: ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.jar'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxPathLength: 260, // Windows limitation
      allowedDirectories: [],
      forbiddenDirectories: ['/system', '/windows', '/boot', '/etc/passwd'],
      requireExtension: true,
      allowSymlinks: false,
      allowHiddenFiles: false,
      scanForMalware: true,
      ...policy,
    };
  }

  /**
   * Validate file path for security violations
   */
  public validatePath(path: string, policy?: Readonly<Partial<FileSecurityPolicy>>): PathValidationResult {
    const effectivePolicy = { ...this.defaultPolicy, ...policy };
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    // Sanitize path first
    const sanitizedPath = this.sanitizePath(path);

    // Check for path traversal attacks
    if (this.hasPathTraversal(path)) {
      violations.push({
        type: ViolationType.PATH_TRAVERSAL,
        severity: ViolationSeverity.CRITICAL,
        description: 'Path contains directory traversal sequences (../ or ..\\)',
        originalValue: path,
        suggestedValue: sanitizedPath,
      });
      recommendations.push('Use absolute paths or properly validated relative paths');
    }

    // Check path length
    if (path.length > effectivePolicy.maxPathLength) {
      violations.push({
        type: ViolationType.PATH_TOO_LONG,
        severity: ViolationSeverity.MEDIUM,
        description: `Path length ${path.length} exceeds maximum ${effectivePolicy.maxPathLength}`,
        originalValue: path,
      });
      recommendations.push('Consider shortening path or directory structure');
    }

    // Check for invalid characters
    const invalidChars = this.findInvalidCharacters(path);
    if (invalidChars.length > 0) {
      violations.push({
        type: ViolationType.INVALID_CHARACTERS,
        severity: ViolationSeverity.HIGH,
        description: `Path contains invalid characters: ${invalidChars.join(', ')}`,
        originalValue: path,
        suggestedValue: this.removeInvalidCharacters(path),
      });
      recommendations.push('Remove or replace invalid characters in path');
    }

    // Check forbidden directories
    const forbiddenDir = this.findForbiddenDirectory(path, effectivePolicy.forbiddenDirectories);
    if (forbiddenDir) {
      violations.push({
        type: ViolationType.FORBIDDEN_DIRECTORY,
        severity: ViolationSeverity.CRITICAL,
        description: `Path accesses forbidden directory: ${forbiddenDir}`,
        originalValue: path,
      });
      recommendations.push('Access files only in allowed directories');
    }

    // Check if accessing allowed directories (if specified)
    if (effectivePolicy.allowedDirectories.length > 0) {
      const isInAllowedDir = this.isInAllowedDirectory(path, effectivePolicy.allowedDirectories);
      if (!isInAllowedDir) {
        violations.push({
          type: ViolationType.FORBIDDEN_DIRECTORY,
          severity: ViolationSeverity.HIGH,
          description: 'Path is not in any allowed directory',
          originalValue: path,
        });
        recommendations.push(
          `Access files only in: ${effectivePolicy.allowedDirectories.join(', ')}`
        );
      }
    }

    // Check for hidden files
    if (!effectivePolicy.allowHiddenFiles && this.isHiddenFile(path)) {
      violations.push({
        type: ViolationType.HIDDEN_FILE,
        severity: ViolationSeverity.MEDIUM,
        description: 'Path references a hidden file or directory',
        originalValue: path,
      });
      recommendations.push('Avoid accessing hidden files unless explicitly needed');
    }

    return {
      isValid: violations.length === 0,
      violations,
      sanitizedPath,
      recommendations,
    };
  }

  /**
   * Validate file extension and content type
   */
  public validateFile(
    filePath: string,
    fileSize?: number,
    policy?: Readonly<Partial<FileSecurityPolicy>>
  ): FileValidationResult {
    const effectivePolicy = { ...this.defaultPolicy, ...policy };
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    const extension = this.extractExtension(filePath).toLowerCase();

    // Check if extension is required
    if (effectivePolicy.requireExtension && !extension) {
      violations.push({
        type: ViolationType.MISSING_EXTENSION,
        severity: ViolationSeverity.MEDIUM,
        description: 'File has no extension',
        originalValue: filePath,
      });
      recommendations.push('Add appropriate file extension');
    }

    // Check forbidden extensions
    if (extension && effectivePolicy.forbiddenExtensions.includes(extension)) {
      violations.push({
        type: ViolationType.FORBIDDEN_EXTENSION,
        severity: ViolationSeverity.CRITICAL,
        description: `File extension ${extension} is forbidden`,
        originalValue: filePath,
      });
      recommendations.push('Change file type or remove file');
    }

    // Check allowed extensions (if specified)
    if (
      extension &&
      effectivePolicy.allowedExtensions.length > 0 &&
      !effectivePolicy.allowedExtensions.includes(extension)
    ) {
      violations.push({
        type: ViolationType.FORBIDDEN_EXTENSION,
        severity: ViolationSeverity.HIGH,
        description: `File extension ${extension} is not in allowed list`,
        originalValue: filePath,
      });
      recommendations.push(
        `Use only allowed extensions: ${effectivePolicy.allowedExtensions.join(', ')}`
      );
    }

    // Check file size
    if (fileSize !== undefined && fileSize > effectivePolicy.maxFileSize) {
      violations.push({
        type: ViolationType.FILE_TOO_LARGE,
        severity: ViolationSeverity.HIGH,
        description: `File size ${this.formatFileSize(fileSize)} exceeds limit ${this.formatFileSize(effectivePolicy.maxFileSize)}`,
        originalValue: fileSize.toString(),
      });
      recommendations.push('Reduce file size or split into smaller files');
    }

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(violations, extension);

    return {
      isValid: violations.length === 0,
      violations,
      riskLevel,
      recommendations,
    };
  }

  /**
   * Validate file access request based on user permissions
   */
  public validateFileAccess(
    request: Readonly<FileAccessRequest>,
    policy?: Readonly<Partial<FileSecurityPolicy>>
  ): FileValidationResult {
    const pathValidation = this.validatePath(request.path, policy);
    const fileValidation = this.validateFile(request.path, undefined, policy);

    // Combine violations
    const allViolations = [...pathValidation.violations, ...fileValidation.violations];
    const allRecommendations = [
      ...pathValidation.recommendations,
      ...fileValidation.recommendations,
    ];

    // Add operation-specific validations
    const operationViolations = this.validateOperation(request);
    allViolations.push(...operationViolations.violations);
    allRecommendations.push(...operationViolations.recommendations);

    const riskLevel = this.calculateRiskLevel(allViolations, this.extractExtension(request.path));

    return {
      isValid: allViolations.length === 0,
      violations: allViolations,
      riskLevel,
      recommendations: [...new Set(allRecommendations)], // Remove duplicates
    };
  }

  /**
   * Sanitize file path using centralized PathUtilities
   */
  public sanitizePath(path: string): string {
    // Use centralized path normalization for consistency
    return PathUtilities.normalizeAIPath(path, {
      allowAbsolute: true,
      allowRelative: true,
      allowTraversal: false,
      basePath: process.cwd(),
    });
  }

  /**
   * Generate secure filename with random suffix
   */
  public generateSecureFilename(originalName: string, includeTimestamp: boolean = true): string {
    const sanitizedBase = this.sanitizeFilename(originalName);
    const extension = this.extractExtension(sanitizedBase);
    const baseName = sanitizedBase.replace(extension, '');

    let secureName = baseName;

    if (includeTimestamp) {
      const timestamp = Date.now();
      secureName += `_${timestamp}`;
    }

    // Add random suffix for uniqueness
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    secureName += `_${randomSuffix}`;

    return secureName + extension;
  }

  /**
   * Check if file content appears malicious (basic heuristics)
   */
  public scanFileContent(content: Readonly<string> | Readonly<Buffer>, filename: Readonly<string>): FileValidationResult {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    let stringContent: string;
    if (typeof content === 'string') {
      // content is a string here
      stringContent = content;
    } else if (Buffer.isBuffer(content)) {
      // Buffer.isBuffer is a type guard and narrows `content` to Buffer
      stringContent = content.toString('utf8', 0, Math.min(content.length, 10000));
    } else {
      // Fallback coercion for other possible read-only buffer-like types
      stringContent = String(content);
    }

    // Check for script injection patterns
    const scriptPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /eval\s*\(/gi,
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(stringContent)) {
        violations.push({
          type: ViolationType.MALICIOUS_CONTENT,
          severity: ViolationSeverity.HIGH,
          description: 'File contains potentially malicious script content',
          originalValue: filename,
        });
        recommendations.push('Review file content for malicious scripts');
        break;
      }
    }

    // Check for SQL injection patterns
    const sqlPatterns = [/union\s+select/gi, /drop\s+table/gi, /exec\s*\(/gi, /xp_cmdshell/gi];

    for (const pattern of sqlPatterns) {
      if (pattern.test(stringContent)) {
        violations.push({
          type: ViolationType.MALICIOUS_CONTENT,
          severity: ViolationSeverity.HIGH,
          description: 'File contains potential SQL injection patterns',
          originalValue: filename,
        });
        recommendations.push('Review file content for SQL injection attempts');
        break;
      }
    }

    // Check for executable signatures (simplified)
    if (Buffer.isBuffer(content)) {
      const executableSignatures = [
        [0x4d, 0x5a], // PE executable (MZ header)
        [0x7f, 0x45, 0x4c, 0x46], // ELF executable
        [0xca, 0xfe, 0xba, 0xbe], // Java class file
        [0xfe, 0xed, 0xfa, 0xce], // Mach-O executable (32-bit)
        [0xfe, 0xed, 0xfa, 0xcf], // Mach-O executable (64-bit)
      ];

      for (const signature of executableSignatures) {
        if (content.length >= signature.length) {
          let matches = true;
          for (let i = 0; i < signature.length; i++) {
            if (content[i] !== signature[i]) {
              matches = false;
              break;
            }
          }
          if (matches) {
            violations.push({
              type: ViolationType.MALICIOUS_CONTENT,
              severity: ViolationSeverity.CRITICAL,
              description: 'File appears to be an executable binary',
              originalValue: filename,
            });
            recommendations.push('Do not execute unknown binary files');
            break;
          }
        }
      }
    }

    const riskLevel = this.calculateRiskLevel(violations, this.extractExtension(filename));

    return {
      isValid: violations.length === 0,
      violations,
      riskLevel,
      recommendations,
    };
  }

  /**
   * Create a security policy for specific use case
   */
  public createPolicy(useCase: PolicyUseCase): FileSecurityPolicy {
    switch (useCase) {
      case PolicyUseCase.CODE_FILES:
        return {
          ...this.defaultPolicy,
          allowedExtensions: [
            '.js',
            '.ts',
            '.py',
            '.java',
            '.c',
            '.cpp',
            '.h',
            '.hpp',
            '.cs',
            '.go',
            '.rs',
            '.php',
            '.rb',
            '.swift',
          ],
          maxFileSize: 10 * 1024 * 1024, // 10MB
          requireExtension: true,
          scanForMalware: true,
        };

      case PolicyUseCase.CONFIG_FILES:
        return {
          ...this.defaultPolicy,
          allowedExtensions: [
            '.json',
            '.yaml',
            '.yml',
            '.toml',
            '.ini',
            '.conf',
            '.config',
            '.env',
          ],
          maxFileSize: 1 * 1024 * 1024, // 1MB
          requireExtension: true,
          allowHiddenFiles: true, // Config files are often hidden
        };

      case PolicyUseCase.DOCUMENT_FILES:
        return {
          ...this.defaultPolicy,
          allowedExtensions: ['.txt', '.md', '.pdf', '.doc', '.docx', '.rtf', '.odt'],
          maxFileSize: 100 * 1024 * 1024, // 100MB
          scanForMalware: true,
        };

      case PolicyUseCase.MEDIA_FILES:
        return {
          ...this.defaultPolicy,
          allowedExtensions: [
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.bmp',
            '.webp',
            '.mp4',
            '.mp3',
            '.wav',
            '.avi',
          ],
          maxFileSize: 500 * 1024 * 1024, // 500MB
          scanForMalware: false, // Media files rarely contain script-based malware
        };

      case PolicyUseCase.STRICT_SECURITY:
        return {
          ...this.defaultPolicy,
          allowedExtensions: ['.txt', '.json', '.yaml'],
          maxFileSize: 1 * 1024 * 1024, // 1MB
          maxPathLength: 100,
          requireExtension: true,
          allowSymlinks: false,
          allowHiddenFiles: false,
          scanForMalware: true,
        };

      default:
        return this.defaultPolicy;
    }
  }

  // Private helper methods

  private hasPathTraversal(path: string): boolean {
    // Use centralized path traversal detection for consistency
    return PathUtilities.hasPathTraversal(path);
  }

  private findInvalidCharacters(path: string): string[] {
    // Use a RegExp constructed from a string with escaped hex ranges to avoid
    // embedding raw control characters in the source file.
    const invalidChars = new RegExp('[<>:"|?*\\x00-\\x1f\\x7f]', 'g');
    const matches = path.match(invalidChars);
    return matches ? [...new Set(matches)] : [];
  }

  private removeInvalidCharacters(path: string): string {
    // Use the same RegExp construction for replacement to avoid control characters
    // in the literal regex.
    return path.replace(new RegExp('[<>:"|?*\\x00-\\x1f\\x7f]', 'g'), '');
  }

  private findForbiddenDirectory(path: string, forbiddenDirs: ReadonlyArray<string>): string | null {
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');

    for (const forbiddenDir of forbiddenDirs) {
      const normalizedForbidden = forbiddenDir.toLowerCase().replace(/\\/g, '/');
      if (normalizedPath.includes(normalizedForbidden)) {
        return forbiddenDir;
      }
    }

    return null;
  }

  private isInAllowedDirectory(path: string, allowedDirs: string[]): boolean {
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');

    return allowedDirs.some(allowedDir => {
      const normalizedAllowed = allowedDir.toLowerCase().replace(/\\/g, '/');
      return normalizedPath.startsWith(normalizedAllowed);
    });
  }

  private isHiddenFile(path: string): boolean {
    const parts = path.split('/');
    return parts.some(part => part.startsWith('.') && part !== '.' && part !== '..');
  }

  private extractExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

    if (lastDot > lastSlash && lastDot !== -1) {
      return filePath.substring(lastDot);
    }

    return '';
  }

  private sanitizeFilename(filename: string): string {
    // Remove path components
    let sanitized = filename.replace(/^.*[\\/]/, '');

    // Remove invalid characters
    sanitized = this.removeInvalidCharacters(sanitized);

    // Remove leading dots (except for extensions)
    sanitized = sanitized.replace(/^\.+/, '');

    // Ensure filename is not empty
    if (!sanitized) {
      sanitized = 'unnamed_file';
    }

    return sanitized;
  }

  private calculateRiskLevel(violations: SecurityViolation[], extension: string): RiskLevel {
    if (violations.length === 0) {
      return RiskLevel.MINIMAL;
    }

    let maxSeverityScore = 0;
    let totalSeverityScore = 0;

    const severityScores = {
      [ViolationSeverity.LOW]: 1,
      [ViolationSeverity.MEDIUM]: 2,
      [ViolationSeverity.HIGH]: 3,
      [ViolationSeverity.CRITICAL]: 4,
    };

    violations.forEach(violation => {
      const score = severityScores[violation.severity];
      totalSeverityScore += score;
      maxSeverityScore = Math.max(maxSeverityScore, score);
    });

    // Adjust for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js', '.jar'];
    if (dangerousExtensions.includes(extension.toLowerCase())) {
      totalSeverityScore += 2;
    }

    // Determine risk level based on severity
    if (maxSeverityScore >= 4 || totalSeverityScore >= 8) {
      return RiskLevel.CRITICAL;
    } else if (maxSeverityScore >= 3 || totalSeverityScore >= 6) {
      return RiskLevel.HIGH;
    } else if (maxSeverityScore >= 2 || totalSeverityScore >= 4) {
      return RiskLevel.MEDIUM;
    } else {
      return RiskLevel.LOW;
    }
  }

  private validateOperation(_request: Readonly<FileAccessRequest>): {
    violations: SecurityViolation[];
    recommendations: string[];
  } {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    // Add operation-specific validation logic here
    // For example, checking if user has permission for specific operations

    return { violations, recommendations };
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export enum PolicyUseCase {
  CODE_FILES = 'code_files',
  CONFIG_FILES = 'config_files',
  DOCUMENT_FILES = 'document_files',
  MEDIA_FILES = 'media_files',
  STRICT_SECURITY = 'strict_security',
}
