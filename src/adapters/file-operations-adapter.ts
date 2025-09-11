/**
 * File Operations Adapter
 * Translates between application layer and file system infrastructure
 *
 * Architecture Compliance:
 * - Adapter layer: translates between application and infrastructure
 * - Imports from Application & Domain layers
 * - Provides secure file operations with business rule validation
 * - Handles error translation and security enforcement
 */

import { EventEmitter } from 'events';
import {
  DirectoryListing,
  FileMetadata,
  FileSystemClient,
} from '../infrastructure/filesystem/file-system-client.js';
import {
  FileSecurityPolicy,
  FileSecurityService,
  PolicyUseCase,
  RiskLevel,
  FileOperation as SecurityFileOperation,
} from '../domain/services/file-security-service.js';
// Application layer interfaces
export interface SecureFileOperation {
  path: string;
  operation: FileOperationType;
  userId?: string;
  userRole?: string;
  context?: string;
  policy?: Partial<FileSecurityPolicy>;
}

export interface FileReadRequest extends SecureFileOperation {
  operation: FileOperationType.READ;
  encoding?: BufferEncoding;
  asBuffer?: boolean;
}

export interface FileWriteRequest extends SecureFileOperation {
  operation: FileOperationType.WRITE;
  content: string | Buffer;
  encoding?: BufferEncoding;
  overwrite?: boolean;
}

export interface FileCopyRequest extends SecureFileOperation {
  operation: FileOperationType.COPY;
  targetPath: string;
  overwrite?: boolean;
}

export interface FileMoveRequest extends SecureFileOperation {
  operation: FileOperationType.MOVE;
  targetPath: string;
  overwrite?: boolean;
}

export enum FileOperationType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  COPY = 'copy',
  MOVE = 'move',
  CREATE_DIRECTORY = 'create_directory',
  LIST_DIRECTORY = 'list_directory',
}

export interface SecurityViolation {
  readonly code: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

export interface SecureFileResult<T = unknown> {
  success: boolean;
  data?: T;
  securityViolations: SecurityViolation[];
  riskLevel: string;
  operationId: string;
  timestamp: Date;
  error?: string;
}

export interface FileSearchOptions {
  pattern: string;
  maxResults?: number;
  policy?: Partial<FileSecurityPolicy>;
  includeHidden?: boolean;
}

export interface SecureFileMetadata extends FileMetadata {
  securityStatus: {
    isSecure: boolean;
    riskLevel: string;
    violations: SecurityViolation[];
    recommendations: string[];
  };
}

/**
 * Secure File Operations Adapter
 * Provides secure file operations with business rule enforcement
 */
export class FileOperationsAdapter extends EventEmitter {
  private readonly fileSystemClient: FileSystemClient;
  private readonly securityService: FileSecurityService;
  private operationCounter: number = 0;

  public constructor(fileSystemClient: FileSystemClient, securityService?: FileSecurityService) {
    super();
    this.fileSystemClient = fileSystemClient;
    this.securityService = securityService ?? new FileSecurityService();

    // Forward events from infrastructure layer
    this.setupEventForwarding();
  }

  /**
   * Initialize the adapter
   */
  public async initialize(): Promise<void> {
    await this.fileSystemClient.initialize();
    this.emit('initialized');
  }

  /**
   * Helper function to compare RiskLevel enum values and return the higher risk
   */
  private getHigherRiskLevel(risk1: RiskLevel, risk2: RiskLevel): RiskLevel {
    const riskLevels = {
      [RiskLevel.MINIMAL]: 0,
      [RiskLevel.LOW]: 1,
      [RiskLevel.MEDIUM]: 2,
      [RiskLevel.HIGH]: 3,
      [RiskLevel.CRITICAL]: 4,
    };

    const score1 = riskLevels[risk1] || 0;
    const score2 = riskLevels[risk2] || 0;

    return score1 >= score2 ? risk1 : risk2;
  }

  // Secure File Operations

  /**
   * Read file with security validation
   */
  public async readFile(
    request: Readonly<FileReadRequest>
  ): Promise<SecureFileResult<string | Buffer>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      // Validate security
      const securityValidation = this.securityService.validateFileAccess(
        {
          path: request.path,
          operation: SecurityFileOperation.READ,
          userId: request.userId ?? 'anonymous',
          userRole: request.userRole ?? 'user',
          context: request.context ?? 'file-operation',
        },
        request.policy
      );

      // Check if operation is allowed
      if (!securityValidation.isValid) {
        this.emit('securityViolation', {
          operationId,
          operation: 'read',
          path: request.path,
          violations: securityValidation.violations.map(v => ({
            code: typeof (v as any).code === 'string' ? (v as any).code : 'UNKNOWN',
            message: (v as any).message,
          })),
        });

        return {
          success: false,
          securityViolations: securityValidation.violations.map(v => ({
            code: (v as any).code ?? 'UNKNOWN',
            message: (v as any).message ?? 'Unknown violation',
          })),
          riskLevel: securityValidation.riskLevel,
          operationId,
          timestamp,
          error: 'Security validation failed',
        };
      }

      // Perform the operation
      let data: string | Buffer;
      if (request.asBuffer) {
        data = await this.fileSystemClient.readFileBuffer(request.path);
      } else {
        data = await this.fileSystemClient.readFile(request.path, request.encoding);
      }

      // Scan content for security issues
      const contentValidation = this.securityService.scanFileContent(data, request.path);

      if (!contentValidation.isValid) {
        this.emit('contentSecurityWarning', {
          operationId,
          path: request.path,
          violations: contentValidation.violations.map(v => ({
            code: typeof (v as any).code === 'string' ? (v as any).code : 'UNKNOWN',
            message:
              typeof (v as any).message === 'string' ? (v as any).message : 'Unknown violation',
          })),
        });
      }

      this.emit('fileRead', {
        operationId,
        path: request.path,
        size: Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data, request.encoding),
        securityStatus: contentValidation,
      });

      return {
        success: true,
        data,
        securityViolations: contentValidation.violations.map(v => ({
          code: (v as any).code,
          message: (v as any).message,
          ...v,
        })),
        riskLevel: contentValidation.riskLevel,
        operationId,
        timestamp,
      };
    } catch (error) {
      this.emit('fileOperationError', {
        operationId,
        operation: 'read',
        path: request.path,
        error,
      });

      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Write file with security validation
   */
  public async writeFile(request: FileWriteRequest): Promise<SecureFileResult<void>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      // Validate security
      const securityValidation = this.securityService.validateFileAccess(
        {
          path: request.path,
          operation: SecurityFileOperation.WRITE,
          userId: request.userId ?? 'anonymous',
          userRole: request.userRole ?? 'user',
          context: request.context ?? 'file-operation',
        },
        request.policy
      );

      if (!securityValidation.isValid) {
        return {
          success: false,
          securityViolations: securityValidation.violations.map(v => ({
            code: v.type,
            message: v.description,
          })),
          riskLevel: securityValidation.riskLevel,
          operationId,
          timestamp,
          error: 'Security validation failed',
        };
      }

      // Check if file exists and overwrite policy
      const exists = await this.fileSystemClient.exists(request.path);
      if (exists && !request.overwrite) {
        return {
          success: false,
          securityViolations: [],
          riskLevel: 'low',
          operationId,
          timestamp,
          error: 'File exists and overwrite is disabled',
        };
      }

      // Validate content before writing
      const contentValidation = this.securityService.scanFileContent(request.content, request.path);

      if (!contentValidation.isValid && contentValidation.riskLevel === 'critical') {
        return {
          success: false,
          securityViolations: contentValidation.violations.map(v => ({
            code: v.type,
            message: v.description,
            ...v,
          })),
          riskLevel: contentValidation.riskLevel,
          operationId,
          timestamp,
          error: 'Content validation failed - critical security risk',
        };
      }

      // Perform the operation
      await this.fileSystemClient.writeFile(request.path, request.content, request.encoding);

      this.emit('fileWritten', {
        operationId,
        path: request.path,
        size: Buffer.isBuffer(request.content)
          ? request.content.length
          : Buffer.byteLength(request.content, request.encoding),
        securityStatus: contentValidation,
      });

      return {
        success: true,
        securityViolations: contentValidation.violations.map(v => ({
          code: v.type,
          message: v.description,
          ...v,
        })),
        riskLevel: contentValidation.riskLevel,
        operationId,
        timestamp,
      };
    } catch (error) {
      this.emit('fileOperationError', {
        operationId,
        operation: 'write',
        path: request.path,
        error,
      });

      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete file with security validation
   */
  public async deleteFile(request: Readonly<SecureFileOperation>): Promise<SecureFileResult<void>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      // Validate security
      const securityValidation = this.securityService.validateFileAccess(
        {
          path: request.path,
          operation: SecurityFileOperation.DELETE,
          userId: request.userId ?? 'anonymous',
          userRole: request.userRole ?? 'user',
          context: request.context ?? 'file-operation',
        },
        request.policy
      );

      if (!securityValidation.isValid) {
        return {
          success: false,
          securityViolations: securityValidation.violations.map(v => ({
            code: (v as any).code ?? 'UNKNOWN',
            message: (v as any).message ?? 'Unknown violation',
          })),
          riskLevel: securityValidation.riskLevel,
          operationId,
          timestamp,
          error: 'Security validation failed',
        };
      }

      // Perform the operation
      await this.fileSystemClient.deleteFile(request.path);

      this.emit('fileDeleted', {
        operationId,
        path: request.path,
      });

      return {
        success: true,
        securityViolations: [],
        riskLevel: 'minimal',
        operationId,
        timestamp,
      };
    } catch (error) {
      this.emit('fileOperationError', {
        operationId,
        operation: 'delete',
        path: request.path,
        error,
      });

      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Copy file with security validation
   */
  public async copyFile(request: Readonly<FileCopyRequest>): Promise<SecureFileResult<void>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      // Validate source file security
      const sourceValidation = this.securityService.validateFileAccess(
        {
          path: request.path,
          operation: SecurityFileOperation.READ,
          userId: request.userId ?? 'anonymous',
          userRole: request.userRole ?? 'user',
          context: request.context ?? 'file-operation',
        },
        request.policy
      );

      // Validate target path security
      const targetValidation = this.securityService.validateFileAccess(
        {
          path: request.targetPath,
          operation: SecurityFileOperation.WRITE,
          userId: request.userId ?? 'anonymous',
          userRole: request.userRole ?? 'user',
          context: request.context ?? 'file-operation',
        },
        request.policy
      );

      const combinedViolations = [...sourceValidation.violations, ...targetValidation.violations];

      if (
        combinedViolations.length > 0 &&
        (!sourceValidation.isValid || !targetValidation.isValid)
      ) {
        return {
          success: false,
          securityViolations: combinedViolations.map(v => ({
            code: (v as any).code ?? 'UNKNOWN',
            message: (v as any).message ?? 'Unknown violation',
          })),
          riskLevel: this.getHigherRiskLevel(
            sourceValidation.riskLevel,
            targetValidation.riskLevel
          ),
          operationId,
          timestamp,
          error: 'Security validation failed',
        };
      }

      // Check target exists and overwrite policy
      const targetExists = await this.fileSystemClient.exists(request.targetPath);
      if (targetExists && !request.overwrite) {
        return {
          success: false,
          securityViolations: [],
          riskLevel: 'low',
          operationId,
          timestamp,
          error: 'Target file exists and overwrite is disabled',
        };
      }

      // Perform the operation
      await this.fileSystemClient.copyFile(request.path, request.targetPath);

      this.emit('fileCopied', {
        operationId,
        sourcePath: request.path,
        targetPath: request.targetPath,
      });

      return {
        success: true,
        securityViolations: combinedViolations.map(v => ({
          code: v.type,
          message: v.description,
        })),
        riskLevel: this.getHigherRiskLevel(sourceValidation.riskLevel, targetValidation.riskLevel),
        operationId,
        timestamp,
      };
    } catch (error) {
      this.emit('fileOperationError', {
        operationId,
        operation: 'copy',
        sourcePath: request.path,
        targetPath: request.targetPath,
        error,
      });

      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Move file with security validation
   */
  public async moveFile(request: Readonly<FileMoveRequest>): Promise<SecureFileResult<void>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      // Validate source file security
      const sourceValidation = this.securityService.validateFileAccess(
        {
          path: request.path,
          operation: SecurityFileOperation.DELETE, // Moving requires delete permission on source
          userId: request.userId ?? 'anonymous',
          userRole: request.userRole ?? 'user',
          context: request.context ?? 'file-operation',
        },
        request.policy
      );

      // Validate target path security
      const targetValidation = this.securityService.validateFileAccess(
        {
          path: request.targetPath,
          operation: SecurityFileOperation.WRITE,
          userId: request.userId ?? 'anonymous',
          userRole: request.userRole ?? 'user',
          context: request.context ?? 'file-operation',
        },
        request.policy
      );

      const combinedViolations: ReadonlyArray<SecurityViolation> = [
        ...sourceValidation.violations.map(v => ({
          code: typeof (v as any).code === 'string' ? (v as any).code : 'UNKNOWN',
          message:
            typeof (v as any).message === 'string' ? (v as any).message : 'Unknown violation',
        })),
        ...targetValidation.violations.map(v => ({
          code: typeof (v as any).code === 'string' ? (v as any).code : 'UNKNOWN',
          message:
            typeof (v as any).message === 'string' ? (v as any).message : 'Unknown violation',
        })),
      ];

      if (
        combinedViolations.length > 0 &&
        (!sourceValidation.isValid || !targetValidation.isValid)
      ) {
        return {
          success: false,
          securityViolations: [...combinedViolations],
          riskLevel: this.getHigherRiskLevel(
            sourceValidation.riskLevel,
            targetValidation.riskLevel
          ),
          operationId,
          timestamp,
          error: 'Security validation failed',
        };
      }

      // Check target exists and overwrite policy
      const targetExists = await this.fileSystemClient.exists(request.targetPath);
      if (targetExists && !request.overwrite) {
        return {
          success: false,
          securityViolations: [],
          riskLevel: 'low',
          operationId,
          timestamp,
          error: 'Target file exists and overwrite is disabled',
        };
      }

      // Perform the operation
      await this.fileSystemClient.moveFile(request.path, request.targetPath);

      this.emit('fileMoved', {
        operationId,
        sourcePath: request.path,
        targetPath: request.targetPath,
      });

      return {
        success: true,
        securityViolations: [...combinedViolations],
        riskLevel: this.getHigherRiskLevel(sourceValidation.riskLevel, targetValidation.riskLevel),
        operationId,
        timestamp,
      };
    } catch (error) {
      this.emit('fileOperationError', {
        operationId,
        operation: 'move',
        sourcePath: request.path,
        targetPath: request.targetPath,
        error,
      });

      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Directory Operations

  /**
   * Create directory with security validation
   */
  public async createDirectory(
    request: Readonly<SecureFileOperation>
  ): Promise<SecureFileResult<void>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      // Validate path security
      const securityValidation = this.securityService.validatePath(request.path, request.policy);

      if (!securityValidation.isValid) {
        return {
          success: false,
          securityViolations: securityValidation.violations.map(v => ({
            code: typeof (v as any).code === 'string' ? (v as any).code : 'UNKNOWN',
            message:
              typeof (v as any).message === 'string' ? (v as any).message : 'Unknown violation',
            ...v,
          })),
          riskLevel: 'medium',
          operationId,
          timestamp,
          error: 'Path validation failed',
        };
      }

      // Perform the operation
      await this.fileSystemClient.createDirectory(request.path);

      this.emit('directoryCreated', {
        operationId,
        path: request.path,
      });

      return {
        success: true,
        securityViolations: [],
        riskLevel: 'minimal',
        operationId,
        timestamp,
      };
    } catch (error) {
      this.emit('fileOperationError', {
        operationId,
        operation: 'create_directory',
        path: request.path,
        error,
      });

      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List directory with security filtering
   */
  public async listDirectory(
    request: Readonly<SecureFileOperation & { recursive?: boolean }>
  ): Promise<SecureFileResult<DirectoryListing>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      // Validate path security
      const securityValidation = this.securityService.validateFileAccess(
        {
          path: request.path,
          operation: SecurityFileOperation.READ,
          userId: request.userId ?? 'anonymous',
          userRole: request.userRole ?? 'user',
          context: request.context ?? 'file-operation',
        },
        request.policy
      );

      if (!securityValidation.isValid) {
        return {
          success: false,
          securityViolations: securityValidation.violations.map(v => ({
            code: typeof (v as any).code === 'string' ? (v as any).code : 'UNKNOWN',
            message:
              typeof (v as any).message === 'string' ? (v as any).message : 'Unknown violation',
          })),
          riskLevel: securityValidation.riskLevel,
          operationId,
          timestamp,
          error: 'Security validation failed',
        };
      }

      // Perform the operation
      const listing = await this.fileSystemClient.listDirectory(request.path, request.recursive);

      // Apply security filtering to results
      const secureFiles = await Promise.all(
        listing.files.map(async file => this.addSecurityMetadata(file, request.policy))
      );

      const secureDirectories = await Promise.all(
        listing.directories.map(async dir => this.addSecurityMetadata(dir, request.policy))
      );

      const secureListing = {
        ...listing,
        files: secureFiles.filter(
          file => file.securityStatus.isSecure || file.securityStatus.riskLevel !== 'critical'
        ),
        directories: secureDirectories.filter(
          dir => dir.securityStatus.isSecure || dir.securityStatus.riskLevel !== 'critical'
        ),
      };

      this.emit('directoryListed', {
        operationId,
        path: request.path,
        fileCount: secureListing.files.length,
        directoryCount: secureListing.directories.length,
      });

      return {
        success: true,
        data: secureListing,
        securityViolations: [],
        riskLevel: 'minimal',
        operationId,
        timestamp,
      };
    } catch (error) {
      this.emit('fileOperationError', {
        operationId,
        operation: 'list_directory',
        path: request.path,
        error,
      });

      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // File Search and Discovery

  /**
   * Search files with security filtering
   */
  public async searchFiles(
    options: Readonly<FileSearchOptions>
  ): Promise<SecureFileResult<string[]>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      // Perform the search
      const findOptions: { maxResults?: number } = {};
      if (options.maxResults !== undefined) {
        findOptions.maxResults = options.maxResults;
      }
      const matches = await this.fileSystemClient.findFiles(options.pattern, findOptions);

      // Filter results based on security policy
      const secureMatches: string[] = [];

      for (const match of matches) {
        const pathValidation = this.securityService.validatePath(match, options.policy);
        const fileValidation = this.securityService.validateFile(match, undefined, options.policy);

        // Include file if it passes security validation or is low risk
        if (
          (pathValidation.isValid && fileValidation.isValid) ||
          (fileValidation.riskLevel !== 'critical' && pathValidation.isValid)
        ) {
          // Check for hidden files
          if (!options.includeHidden && this.isHiddenFile(match)) {
            continue;
          }

          secureMatches.push(match);
        }
      }

      this.emit('filesSearched', {
        operationId,
        pattern: options.pattern,
        totalMatches: matches.length,
        secureMatches: secureMatches.length,
      });

      return {
        success: true,
        data: secureMatches,
        securityViolations: [],
        riskLevel: 'minimal',
        operationId,
        timestamp,
      };
    } catch (error) {
      this.emit('fileOperationError', {
        operationId,
        operation: 'search',
        path: options.pattern,
        error,
      });

      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get secure file metadata
   */
  public async getSecureFileMetadata(
    filePath: string,
    policy?: Readonly<Partial<FileSecurityPolicy>>
  ): Promise<SecureFileResult<SecureFileMetadata>> {
    const operationId = this.generateOperationId();
    const timestamp = new Date();

    try {
      const metadata = await this.fileSystemClient.getFileMetadata(filePath);
      const secureMetadata = this.addSecurityMetadata(metadata, policy);

      return {
        success: true,
        data: secureMetadata,
        securityViolations: secureMetadata.securityStatus.violations,
        riskLevel: secureMetadata.securityStatus.riskLevel,
        operationId,
        timestamp,
      };
    } catch (error) {
      return {
        success: false,
        securityViolations: [],
        riskLevel: 'unknown',
        operationId,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Security Policy Management

  /**
   * Create security policy for specific use case
   */
  public createSecurityPolicy(useCase: PolicyUseCase): FileSecurityPolicy {
    return this.securityService.createPolicy(useCase);
  }

  /**
   * Generate secure filename
   */
  public generateSecureFilename(originalName: string, includeTimestamp: boolean = true): string {
    return this.securityService.generateSecureFilename(originalName, includeTimestamp);
  }

  /**
   * Close the adapter and cleanup resources
   */
  public close(): void {
    this.fileSystemClient.close();
    this.emit('closed');
  }

  // Private helper methods

  private setupEventForwarding(): void {
    this.fileSystemClient.on('initialized', data => this.emit('fileSystemInitialized', data));
    this.fileSystemClient.on('fileRead', data =>
      this.emit('fileSystemOperation', { ...data, operation: 'read' })
    );
    this.fileSystemClient.on('fileWritten', data =>
      this.emit('fileSystemOperation', { ...data, operation: 'write' })
    );
    this.fileSystemClient.on('fileDeleted', data =>
      this.emit('fileSystemOperation', { ...data, operation: 'delete' })
    );
    this.fileSystemClient.on('fileCopied', data =>
      this.emit('fileSystemOperation', { ...data, operation: 'copy' })
    );
    this.fileSystemClient.on('fileMoved', data =>
      this.emit('fileSystemOperation', { ...data, operation: 'move' })
    );
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${++this.operationCounter}`;
  }

  private addSecurityMetadata(
    metadata: Readonly<FileMetadata>,
    policy?: Readonly<Partial<FileSecurityPolicy>>
  ): SecureFileMetadata {
    const pathValidation = this.securityService.validatePath(metadata.absolutePath, policy);
    const fileValidation = this.securityService.validateFile(
      metadata.absolutePath,
      metadata.size,
      policy
    );

    // Map violations to ensure they have code and message properties
    const allViolations: SecurityViolation[] = [
      ...pathValidation.violations.map(v => ({
        code: (v as any).code ?? 'UNKNOWN',
        message: (v as any).message ?? 'Unknown violation',
        ...v,
      })),
      ...fileValidation.violations.map(v => ({
        code: (v as any).code ?? 'UNKNOWN',
        message: (v as any).message ?? 'Unknown violation',
        ...v,
      })),
    ];
    const isSecure = allViolations.length === 0;
    const recommendations = [
      ...new Set([
        ...(pathValidation.recommendations ?? []),
        ...(fileValidation.recommendations ?? []),
      ]),
    ];

    return {
      ...metadata,
      securityStatus: {
        isSecure,
        riskLevel: fileValidation.riskLevel,
        violations: allViolations,
        recommendations,
      },
    };
  }

  /**
   * Helper to check if a file is hidden (starts with a dot, but not '.' or '..')
   */
  private isHiddenFile(filename: string): boolean {
    return filename ? filename.startsWith('.') && filename !== '.' && filename !== '..' : false;
  }
}

// Factory function for creating configured file operations adapters
export function createFileOperationsAdapter(
  fileSystemClient: FileSystemClient,
  securityPolicy?: Partial<FileSecurityPolicy>
): FileOperationsAdapter {
  const securityService = new FileSecurityService(securityPolicy);
  return new FileOperationsAdapter(fileSystemClient, securityService);
}
