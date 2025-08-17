/**
 * Secure File Tools with Enhanced Error Handling
 * 
 * Secure file operations with comprehensive error handling,
 * input validation, and security measures.
 */

import { z } from 'zod';
import { promises as fs, existsSync, statSync } from 'fs';
import { join, resolve, dirname, relative, isAbsolute } from 'path';
import { glob } from 'glob';
import { 
  EnhancedBaseTool, 
  EnhancedToolConfig, 
  ToolExecutionContext 
} from './enhanced-base-tool.js';
import { 
  ErrorFactory, 
  ErrorCategory, 
  ErrorSeverity,
  InputValidator 
} from '../error-handling/structured-error-system.js';
import { logger } from '../logger.js';

/**
 * Secure File Read Tool with comprehensive error handling
 */
export class SecureFileReadTool extends EnhancedBaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const config: EnhancedToolConfig = {
      name: 'secureFileRead',
      description: 'Securely read files with validation, error handling, and security checks',
      category: 'File System',
      parameters: z.object({
        path: z.string().describe('File path to read'),
        maxSize: z.number().optional().default(1000000).describe('Maximum file size in bytes'),
        encoding: z.enum(['utf8', 'base64', 'binary']).optional().default('utf8'),
      }),
      securityLevel: 'high',
      timeoutMs: 15000,
      rateLimitPerMinute: 100,
      retryable: false // File operations shouldn't be retried
    };

    super(config);
  }

  protected async executeCore(params: any, context: ToolExecutionContext): Promise<any> {
    const { path, maxSize, encoding } = params;

    // Validate and resolve file path
    const pathValidation = InputValidator.validateFilePath(path);
    if (!pathValidation.success) {
      throw pathValidation.error;
    }

    const resolvedPath = this.resolveSecurePath(pathValidation.data);

    // Check if file exists
    if (!existsSync(resolvedPath)) {
      throw ErrorFactory.createError(
        `File not found: ${path}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.MEDIUM,
        {
          context: { requested_path: path, resolved_path: resolvedPath },
          userMessage: `The file '${path}' does not exist`,
          suggestedActions: [
            'Check if the file path is correct',
            'Verify the file exists in the specified location',
            'Use file listing to find available files'
          ]
        }
      );
    }

    // Check file permissions and size
    const stats = await this.getFileStats(resolvedPath);
    
    if (stats.size > maxSize) {
      throw ErrorFactory.createError(
        `File too large: ${stats.size} bytes (max: ${maxSize})`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        {
          context: { file_size: stats.size, max_size: maxSize },
          userMessage: 'File is too large to read',
          suggestedActions: [
            'Increase maxSize parameter',
            'Read file in chunks',
            'Use file streaming for large files'
          ]
        }
      );
    }

    // Check if it's actually a file (not directory)
    if (!stats.isFile()) {
      throw ErrorFactory.createError(
        `Path is not a file: ${path}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        {
          context: { path, is_directory: stats.isDirectory() },
          userMessage: 'Cannot read: path is not a file',
          suggestedActions: [
            'Provide a file path instead of directory',
            'Use directory listing tool for directories'
          ]
        }
      );
    }

    // Read file content
    try {
      const content = await fs.readFile(resolvedPath, encoding);
      
      return {
        content,
        metadata: {
          path: relative(this.agentContext.workingDirectory, resolvedPath),
          size: stats.size,
          modified: stats.mtime.toISOString(),
          encoding,
          type: this.getFileType(resolvedPath)
        }
      };
    } catch (error) {
      throw ErrorFactory.createError(
        `Failed to read file: ${(error as Error).message}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.HIGH,
        {
          context: { path, error_message: (error as Error).message },
          userMessage: 'Unable to read file content',
          suggestedActions: [
            'Check file permissions',
            'Verify file is not corrupted',
            'Try with different encoding'
          ],
          originalError: error as Error
        }
      );
    }
  }

  private resolveSecurePath(path: string): string {
    // Convert to absolute path relative to working directory
    const basePath = this.agentContext.workingDirectory;
    const resolvedPath = isAbsolute(path) ? path : resolve(basePath, path);

    // Security check: ensure path is within working directory
    const relativePath = relative(basePath, resolvedPath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw ErrorFactory.createError(
        'Access denied: path outside working directory',
        ErrorCategory.AUTHORIZATION,
        ErrorSeverity.HIGH,
        {
          context: { requested_path: path, working_directory: basePath },
          userMessage: 'Cannot access files outside the project directory',
          suggestedActions: ['Use paths within the current project directory'],
          recoverable: false
        }
      );
    }

    return resolvedPath;
  }

  private async getFileStats(path: string): Promise<any> {
    try {
      return await fs.stat(path);
    } catch (error) {
      throw ErrorFactory.createError(
        `Cannot access file: ${(error as Error).message}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.HIGH,
        {
          context: { path, error_message: (error as Error).message },
          userMessage: 'Cannot access file information',
          suggestedActions: [
            'Check file permissions',
            'Verify file path is correct'
          ],
          originalError: error as Error
        }
      );
    }
  }

  private getFileType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'txt': 'text'
    };
    
    return typeMap[ext] || 'unknown';
  }
}

/**
 * Secure File Write Tool with comprehensive error handling
 */
export class SecureFileWriteTool extends EnhancedBaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const config: EnhancedToolConfig = {
      name: 'secureFileWrite',
      description: 'Securely write files with validation, backup, and error handling',
      category: 'File System',
      parameters: z.object({
        path: z.string().describe('File path to write'),
        content: z.string().describe('Content to write to file'),
        encoding: z.enum(['utf8', 'base64', 'binary']).optional().default('utf8'),
        createBackup: z.boolean().optional().default(true).describe('Create backup of existing file'),
        overwrite: z.boolean().optional().default(false).describe('Allow overwriting existing files'),
      }),
      securityLevel: 'high',
      timeoutMs: 30000,
      rateLimitPerMinute: 50,
      retryable: false
    };

    super(config);
  }

  protected async executeCore(params: any, context: ToolExecutionContext): Promise<any> {
    const { path, content, encoding, createBackup, overwrite } = params;

    // Validate inputs
    const pathValidation = InputValidator.validateFilePath(path);
    if (!pathValidation.success) {
      throw pathValidation.error;
    }

    const contentValidation = InputValidator.validateString(content, 'content', {
      maxLength: 10000000 // 10MB limit for content
    });
    if (!contentValidation.success) {
      throw contentValidation.error;
    }

    const resolvedPath = this.resolveSecurePath(pathValidation.data);
    const fileExists = existsSync(resolvedPath);

    // Check overwrite permissions
    if (fileExists && !overwrite) {
      throw ErrorFactory.createError(
        `File already exists: ${path}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        {
          context: { path, overwrite_allowed: overwrite },
          userMessage: 'File already exists and overwrite is not allowed',
          suggestedActions: [
            'Set overwrite parameter to true',
            'Choose a different file name',
            'Delete the existing file first'
          ]
        }
      );
    }

    let backupPath: string | null = null;

    try {
      // Create backup if requested and file exists
      if (createBackup && fileExists) {
        backupPath = await this.createBackup(resolvedPath);
      }

      // Ensure directory exists
      await this.ensureDirectoryExists(dirname(resolvedPath));

      // Write file
      await fs.writeFile(resolvedPath, contentValidation.data, encoding);

      // Verify write was successful
      const stats = await fs.stat(resolvedPath);

      return {
        success: true,
        path: relative(this.agentContext.workingDirectory, resolvedPath),
        size: stats.size,
        backup_created: backupPath ? relative(this.agentContext.workingDirectory, backupPath) : null,
        encoding,
        created: !fileExists,
        overwritten: fileExists
      };

    } catch (error) {
      // Restore backup if write failed
      if (backupPath && fileExists) {
        try {
          await fs.copyFile(backupPath, resolvedPath);
          await fs.unlink(backupPath);
        } catch (restoreError) {
          logger.error('Failed to restore backup:', restoreError);
        }
      }

      throw ErrorFactory.createError(
        `Failed to write file: ${(error as Error).message}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.HIGH,
        {
          context: { path, error_message: (error as Error).message },
          userMessage: 'Unable to write file',
          suggestedActions: [
            'Check file permissions',
            'Verify directory exists',
            'Check available disk space'
          ],
          originalError: error as Error
        }
      );
    }
  }

  private resolveSecurePath(path: string): string {
    const basePath = this.agentContext.workingDirectory;
    const resolvedPath = isAbsolute(path) ? path : resolve(basePath, path);

    // Security check
    const relativePath = relative(basePath, resolvedPath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw ErrorFactory.createError(
        'Access denied: path outside working directory',
        ErrorCategory.AUTHORIZATION,
        ErrorSeverity.HIGH,
        {
          context: { requested_path: path, working_directory: basePath },
          userMessage: 'Cannot write files outside the project directory',
          suggestedActions: ['Use paths within the current project directory'],
          recoverable: false
        }
      );
    }

    return resolvedPath;
  }

  private async createBackup(originalPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${originalPath}.backup.${timestamp}`;

    try {
      await fs.copyFile(originalPath, backupPath);
      return backupPath;
    } catch (error) {
      throw ErrorFactory.createError(
        `Failed to create backup: ${(error as Error).message}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.HIGH,
        {
          context: { original_path: originalPath, backup_path: backupPath },
          userMessage: 'Unable to create file backup',
          suggestedActions: [
            'Check file permissions',
            'Verify available disk space',
            'Disable backup creation if not needed'
          ],
          originalError: error as Error
        }
      );
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw ErrorFactory.createError(
        `Failed to create directory: ${(error as Error).message}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.HIGH,
        {
          context: { directory_path: dirPath },
          userMessage: 'Unable to create directory',
          suggestedActions: [
            'Check directory permissions',
            'Verify parent directory exists',
            'Check available disk space'
          ],
          originalError: error as Error
        }
      );
    }
  }
}

/**
 * Secure File List Tool with comprehensive error handling
 */
export class SecureFileListTool extends EnhancedBaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const config: EnhancedToolConfig = {
      name: 'secureFileList',
      description: 'Securely list files and directories with filtering and metadata',
      category: 'File System',
      parameters: z.object({
        path: z.string().optional().default('.').describe('Directory path to list'),
        pattern: z.string().optional().describe('Glob pattern to filter files'),
        includeHidden: z.boolean().optional().default(false).describe('Include hidden files'),
        recursive: z.boolean().optional().default(false).describe('List files recursively'),
        maxDepth: z.number().optional().default(5).describe('Maximum recursion depth'),
        maxFiles: z.number().optional().default(1000).describe('Maximum number of files to return'),
      }),
      securityLevel: 'medium',
      timeoutMs: 20000,
      rateLimitPerMinute: 200
    };

    super(config);
  }

  protected async executeCore(params: any, context: ToolExecutionContext): Promise<any> {
    const { path, pattern, includeHidden, recursive, maxDepth, maxFiles } = params;

    // Validate path
    const pathValidation = InputValidator.validateFilePath(path);
    if (!pathValidation.success) {
      throw pathValidation.error;
    }

    const resolvedPath = this.resolveSecurePath(pathValidation.data);

    // Check if directory exists
    if (!existsSync(resolvedPath)) {
      throw ErrorFactory.createError(
        `Directory not found: ${path}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.MEDIUM,
        {
          context: { requested_path: path, resolved_path: resolvedPath },
          userMessage: `The directory '${path}' does not exist`,
          suggestedActions: [
            'Check if the directory path is correct',
            'Create the directory first',
            'Use parent directory path'
          ]
        }
      );
    }

    // Check if it's actually a directory
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw ErrorFactory.createError(
        `Path is not a directory: ${path}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        {
          context: { path, is_file: stats.isFile() },
          userMessage: 'Cannot list: path is not a directory',
          suggestedActions: [
            'Provide a directory path',
            'Use file read tool for individual files'
          ]
        }
      );
    }

    try {
      let files: string[] = [];

      if (pattern) {
        // Use glob pattern
        const globPattern = recursive ? join(path, '**', pattern) : join(path, pattern);
        files = await glob(globPattern, {
          cwd: this.agentContext.workingDirectory,
          dot: includeHidden,
          maxDepth: recursive ? maxDepth : 1
        });
      } else {
        // List directory contents
        files = await this.listDirectory(resolvedPath, recursive, maxDepth, includeHidden);
      }

      // Limit number of files
      if (files.length > maxFiles) {
        files = files.slice(0, maxFiles);
      }

      // Get file metadata
      const fileDetails = await Promise.all(
        files.map(async (file) => {
          try {
            const fullPath = isAbsolute(file) ? file : join(this.agentContext.workingDirectory, file);
            const fileStat = await fs.stat(fullPath);
            
            return {
              path: relative(this.agentContext.workingDirectory, fullPath),
              name: file.split('/').pop() || file.split('\\').pop(),
              size: fileStat.size,
              type: fileStat.isDirectory() ? 'directory' : 'file',
              modified: fileStat.mtime.toISOString(),
              created: fileStat.birthtime.toISOString(),
              permissions: fileStat.mode
            };
          } catch (error) {
            logger.warn(`Failed to get stats for file: ${file}`, error);
            return {
              path: file,
              name: file.split('/').pop() || file.split('\\').pop(),
              error: 'Unable to read file stats'
            };
          }
        })
      );

      return {
        directory: relative(this.agentContext.workingDirectory, resolvedPath),
        total_files: fileDetails.length,
        truncated: files.length >= maxFiles,
        files: fileDetails,
        filters: {
          pattern,
          include_hidden: includeHidden,
          recursive,
          max_depth: maxDepth
        }
      };

    } catch (error) {
      throw ErrorFactory.createError(
        `Failed to list directory: ${(error as Error).message}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.HIGH,
        {
          context: { path, error_message: (error as Error).message },
          userMessage: 'Unable to list directory contents',
          suggestedActions: [
            'Check directory permissions',
            'Verify directory is accessible',
            'Try with simpler filters'
          ],
          originalError: error as Error
        }
      );
    }
  }

  private resolveSecurePath(path: string): string {
    const basePath = this.agentContext.workingDirectory;
    const resolvedPath = isAbsolute(path) ? path : resolve(basePath, path);

    // Security check
    const relativePath = relative(basePath, resolvedPath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw ErrorFactory.createError(
        'Access denied: path outside working directory',
        ErrorCategory.AUTHORIZATION,
        ErrorSeverity.HIGH,
        {
          context: { requested_path: path, working_directory: basePath },
          userMessage: 'Cannot access directories outside the project directory',
          suggestedActions: ['Use paths within the current project directory'],
          recoverable: false
        }
      );
    }

    return resolvedPath;
  }

  private async listDirectory(
    dirPath: string,
    recursive: boolean,
    maxDepth: number,
    includeHidden: boolean,
    currentDepth: number = 0
  ): Promise<string[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const files: string[] = [];
    const entries = await fs.readdir(dirPath);

    for (const entry of entries) {
      if (!includeHidden && entry.startsWith('.')) {
        continue;
      }

      const fullPath = join(dirPath, entry);
      const relativePath = relative(this.agentContext.workingDirectory, fullPath);
      
      files.push(relativePath);

      if (recursive) {
        try {
          const stats = await fs.stat(fullPath);
          if (stats.isDirectory()) {
            const subFiles = await this.listDirectory(
              fullPath,
              recursive,
              maxDepth,
              includeHidden,
              currentDepth + 1
            );
            files.push(...subFiles);
          }
        } catch (error) {
          // Skip files we can't access
          logger.warn(`Cannot access: ${fullPath}`, error);
        }
      }
    }

    return files;
  }
}

// Tools exported above