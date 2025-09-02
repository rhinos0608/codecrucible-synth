/**
 * Pure File System Infrastructure Client
 * Handles only file system operations and I/O
 *
 * Architecture Compliance:
 * - Infrastructure layer: concrete implementation only
 * - No business logic for validation or security policies
 * - Pure file system client with error handling
 * - No module-level mutable state
 */

import { Stats, constants, createReadStream, createWriteStream, promises as fs } from 'fs';
import * as fsSync from 'fs';
import path, { dirname, extname, join, relative, resolve } from 'path';
import { EventEmitter } from 'events';
import { glob } from 'glob';
import { pipeline } from 'stream/promises';

export interface FileSystemConfig {
  rootPath: string;
  tempPath?: string;
  maxFileSize: number;
  allowedExtensions?: string[];
  forbiddenPaths?: string[];
  enableWatching: boolean;
  watchDebounceMs: number;
}

export interface FileMetadata {
  path: string;
  absolutePath: string;
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isFile: boolean;
  isDirectory: boolean;
  extension: string;
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

export interface DirectoryListing {
  path: string;
  files: FileMetadata[];
  directories: FileMetadata[];
  totalSize: number;
  fileCount: number;
  directoryCount: number;
}

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'move' | 'copy';
  sourcePath: string;
  targetPath?: string;
  timestamp: Date;
  size?: number;
  success: boolean;
  error?: string;
}

export interface FileWatchEvent {
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  path: string;
  timestamp: Date;
  metadata?: FileMetadata;
}

/**
 * Pure File System Client
 * Handles file system operations without business logic
 */
export class FileSystemClient extends EventEmitter {
  private readonly config: FileSystemConfig;
  private readonly watchers: Map<string, fsSync.FSWatcher> = new Map();
  private operationHistory: FileOperation[] = [];

  constructor(config: FileSystemConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize the file system client
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure root path exists
      await this.ensureDirectory(this.config.rootPath);

      // Ensure temp path exists if specified
      if (this.config.tempPath) {
        await this.ensureDirectory(this.config.tempPath);
      }

      this.emit('initialized', {
        rootPath: this.config.rootPath,
        tempPath: this.config.tempPath,
      });
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  // File Operations

  /**
   * Read file contents
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const absolutePath = this.resolveAbsolutePath(filePath);
    const operation: FileOperation = {
      type: 'read',
      sourcePath: absolutePath,
      timestamp: new Date(),
      success: false,
    };

    try {
      await this.checkFileAccess(absolutePath, constants.R_OK);

      const content = await fs.readFile(absolutePath, encoding);
      const stats = await fs.stat(absolutePath);

      operation.success = true;
      operation.size = stats.size;
      this.recordOperation(operation);

      this.emit('fileRead', {
        path: absolutePath,
        size: stats.size,
        encoding,
      });

      return content;
    } catch (error) {
      operation.error = error instanceof Error ? error.message : String(error);
      this.recordOperation(operation);
      this.emit('fileReadError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Read file contents as buffer
   */
  async readFileBuffer(filePath: string): Promise<Buffer> {
    const absolutePath = this.resolveAbsolutePath(filePath);

    try {
      await this.checkFileAccess(absolutePath, constants.R_OK);
      const buffer = await fs.readFile(absolutePath);

      this.emit('fileRead', {
        path: absolutePath,
        size: buffer.length,
        encoding: 'buffer',
      });

      return buffer;
    } catch (error) {
      this.emit('fileReadError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Write file contents
   */
  async writeFile(
    filePath: string,
    content: string | Buffer,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(filePath);
    const operation: FileOperation = {
      type: 'write',
      sourcePath: absolutePath,
      timestamp: new Date(),
      success: false,
      size: typeof content === 'string' ? Buffer.byteLength(content, encoding) : content.length,
    };

    try {
      // Ensure parent directory exists
      await this.ensureDirectory(dirname(absolutePath));

      // Check if file exists and is writable, or if parent directory is writable
      try {
        await this.checkFileAccess(absolutePath, constants.W_OK);
      } catch {
        // File might not exist, check parent directory
        await this.checkFileAccess(dirname(absolutePath), constants.W_OK);
      }

      await fs.writeFile(absolutePath, content, encoding);

      operation.success = true;
      this.recordOperation(operation);

      this.emit('fileWritten', {
        path: absolutePath,
        size: operation.size,
        encoding: typeof content === 'string' ? encoding : 'buffer',
      });
    } catch (error) {
      operation.error = error instanceof Error ? error.message : String(error);
      this.recordOperation(operation);
      this.emit('fileWriteError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Append content to file
   */
  async appendFile(
    filePath: string,
    content: string | Buffer,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(filePath);

    try {
      // Ensure parent directory exists
      await this.ensureDirectory(dirname(absolutePath));

      await fs.appendFile(absolutePath, content, encoding);

      this.emit('fileAppended', {
        path: absolutePath,
        size: typeof content === 'string' ? Buffer.byteLength(content, encoding) : content.length,
      });
    } catch (error) {
      this.emit('fileAppendError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(filePath);
    const operation: FileOperation = {
      type: 'delete',
      sourcePath: absolutePath,
      timestamp: new Date(),
      success: false,
    };

    try {
      const stats = await fs.stat(absolutePath);
      await fs.unlink(absolutePath);

      operation.success = true;
      operation.size = stats.size;
      this.recordOperation(operation);

      this.emit('fileDeleted', {
        path: absolutePath,
        size: stats.size,
      });
    } catch (error) {
      operation.error = error instanceof Error ? error.message : String(error);
      this.recordOperation(operation);
      this.emit('fileDeleteError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    const absoluteSource = this.resolveAbsolutePath(sourcePath);
    const absoluteTarget = this.resolveAbsolutePath(targetPath);
    const operation: FileOperation = {
      type: 'copy',
      sourcePath: absoluteSource,
      targetPath: absoluteTarget,
      timestamp: new Date(),
      success: false,
    };

    try {
      await this.checkFileAccess(absoluteSource, constants.R_OK);
      await this.ensureDirectory(dirname(absoluteTarget));

      const stats = await fs.stat(absoluteSource);
      await fs.copyFile(absoluteSource, absoluteTarget);

      operation.success = true;
      operation.size = stats.size;
      this.recordOperation(operation);

      this.emit('fileCopied', {
        sourcePath: absoluteSource,
        targetPath: absoluteTarget,
        size: stats.size,
      });
    } catch (error) {
      operation.error = error instanceof Error ? error.message : String(error);
      this.recordOperation(operation);
      this.emit('fileCopyError', { sourcePath: absoluteSource, targetPath: absoluteTarget, error });
      throw error;
    }
  }

  /**
   * Move/rename file
   */
  async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    const absoluteSource = this.resolveAbsolutePath(sourcePath);
    const absoluteTarget = this.resolveAbsolutePath(targetPath);
    const operation: FileOperation = {
      type: 'move',
      sourcePath: absoluteSource,
      targetPath: absoluteTarget,
      timestamp: new Date(),
      success: false,
    };

    try {
      await this.checkFileAccess(absoluteSource, constants.W_OK);
      await this.ensureDirectory(dirname(absoluteTarget));

      const stats = await fs.stat(absoluteSource);
      await fs.rename(absoluteSource, absoluteTarget);

      operation.success = true;
      operation.size = stats.size;
      this.recordOperation(operation);

      this.emit('fileMoved', {
        sourcePath: absoluteSource,
        targetPath: absoluteTarget,
        size: stats.size,
      });
    } catch (error) {
      operation.error = error instanceof Error ? error.message : String(error);
      this.recordOperation(operation);
      this.emit('fileMoveError', { sourcePath: absoluteSource, targetPath: absoluteTarget, error });
      throw error;
    }
  }

  // Directory Operations

  /**
   * Create directory (recursive)
   */
  async createDirectory(dirPath: string): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(dirPath);

    try {
      await fs.mkdir(absolutePath, { recursive: true });

      this.emit('directoryCreated', { path: absolutePath });
    } catch (error) {
      this.emit('directoryCreateError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Delete directory (recursive)
   */
  async deleteDirectory(dirPath: string, recursive: boolean = false): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(dirPath);

    try {
      if (recursive) {
        await fs.rm(absolutePath, { recursive: true, force: true });
      } else {
        await fs.rmdir(absolutePath);
      }

      this.emit('directoryDeleted', { path: absolutePath, recursive });
    } catch (error) {
      this.emit('directoryDeleteError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string, recursive: boolean = false): Promise<DirectoryListing> {
    const absolutePath = this.resolveAbsolutePath(dirPath);

    try {
      await this.checkFileAccess(absolutePath, constants.R_OK);

      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const files: FileMetadata[] = [];
      const directories: FileMetadata[] = [];
      let totalSize = 0;

      for (const entry of entries) {
        const entryPath = join(absolutePath, entry.name);
        const stats = await fs.stat(entryPath);
        const metadata = await this.createFileMetadata(entryPath, stats);

        if (entry.isDirectory()) {
          directories.push(metadata);
          if (recursive) {
            const subListing = await this.listDirectory(entryPath, true);
            totalSize += subListing.totalSize;
          }
        } else {
          files.push(metadata);
          totalSize += stats.size;
        }
      }

      const listing: DirectoryListing = {
        path: absolutePath,
        files,
        directories,
        totalSize,
        fileCount: files.length,
        directoryCount: directories.length,
      };

      this.emit('directoryListed', {
        path: absolutePath,
        fileCount: files.length,
        directoryCount: directories.length,
        totalSize,
      });

      return listing;
    } catch (error) {
      this.emit('directoryListError', { path: absolutePath, error });
      throw error;
    }
  }

  // File System Queries

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath: string): Promise<FileMetadata> {
    const absolutePath = this.resolveAbsolutePath(filePath);

    try {
      const stats = await fs.stat(absolutePath);
      return await this.createFileMetadata(absolutePath, stats);
    } catch (error) {
      this.emit('metadataError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Check if file/directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    const absolutePath = this.resolveAbsolutePath(filePath);

    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find files matching pattern
   */
  async findFiles(
    pattern: string,
    options: { cwd?: string; maxResults?: number } = {}
  ): Promise<string[]> {
    const searchPath = options.cwd ? this.resolveAbsolutePath(options.cwd) : this.config.rootPath;

    try {
      const allMatches = await glob(pattern, {
        cwd: searchPath,
        absolute: true,
      });

      // Apply maxResults limit manually
      const matches = options.maxResults ? allMatches.slice(0, options.maxResults) : allMatches;

      this.emit('filesFound', {
        pattern,
        searchPath,
        count: matches.length,
      });

      return matches;
    } catch (error) {
      this.emit('findError', { pattern, searchPath, error });
      throw error;
    }
  }

  // Stream Operations

  /**
   * Create read stream for large files
   */
  createReadStream(
    filePath: string,
    options?: { start?: number; end?: number }
  ): NodeJS.ReadableStream {
    const absolutePath = this.resolveAbsolutePath(filePath);
    return createReadStream(absolutePath, options);
  }

  /**
   * Create write stream for large files
   */
  createWriteStream(filePath: string, options?: { flags?: string }): NodeJS.WritableStream {
    const absolutePath = this.resolveAbsolutePath(filePath);
    return createWriteStream(absolutePath, options);
  }

  /**
   * Stream copy for large files
   */
  async streamCopy(sourcePath: string, targetPath: string): Promise<void> {
    const absoluteSource = this.resolveAbsolutePath(sourcePath);
    const absoluteTarget = this.resolveAbsolutePath(targetPath);

    try {
      await this.ensureDirectory(dirname(absoluteTarget));

      const readStream = createReadStream(absoluteSource);
      const writeStream = createWriteStream(absoluteTarget);

      await pipeline(readStream, writeStream);

      this.emit('streamCopyCompleted', {
        sourcePath: absoluteSource,
        targetPath: absoluteTarget,
      });
    } catch (error) {
      this.emit('streamCopyError', {
        sourcePath: absoluteSource,
        targetPath: absoluteTarget,
        error,
      });
      throw error;
    }
  }

  // File Watching

  /**
   * Watch file or directory for changes
   */
  public async watchPath(filePath: string, recursive: boolean = false): Promise<void> {
    if (!this.config.enableWatching) {
      throw new Error('File watching is disabled in configuration');
    }

    const absolutePath = this.resolveAbsolutePath(filePath);

    try {
      // Verify the path exists before watching
      await fs.access(absolutePath);
      
      const watcher = fsSync.watch(absolutePath, { recursive });
      watcher.addListener('change', (eventType: string, filename: string | null) => {
        if (filename) {
          const fullPath = join(absolutePath, filename);
          this.emit('fileWatchEvent', {
            type: eventType === 'rename' ? 'renamed' : 'modified',
            path: fullPath,
            timestamp: new Date(),
          } as FileWatchEvent);
        }
      });

      this.watchers.set(absolutePath, watcher);

      this.emit('watchStarted', { path: absolutePath, recursive });
    } catch (error) {
      this.emit('watchError', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Stop watching a path
   */
  public unwatchPath(filePath: string): void {
    const absolutePath = this.resolveAbsolutePath(filePath);
    const watcher = this.watchers.get(absolutePath);

    if (watcher) {
      watcher.close();
      this.watchers.delete(absolutePath);
      this.emit('watchStopped', { path: absolutePath });
    }
  }

  // Configuration and Status

  /**
   * Get file system configuration
   */
  getConfig(): FileSystemConfig {
    return { ...this.config };
  }

  /**
   * Get operation history
   */
  getOperationHistory(limit?: number): FileOperation[] {
    return limit ? this.operationHistory.slice(-limit) : [...this.operationHistory];
  }

  /**
   * Clear operation history
   */
  clearOperationHistory(): void {
    this.operationHistory = [];
    this.emit('historyCleared');
  }

  /**
   * Get file system statistics
   */
  getStatistics(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    activeWatchers: number;
  } {
    const totalOperations = this.operationHistory.length;
    const successfulOperations = this.operationHistory.filter(op => op.success).length;
    const failedOperations = totalOperations - successfulOperations;

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      activeWatchers: this.watchers.size,
    };
  }

  /**
   * Close all watchers and cleanup
   */
  public close(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.emit('closed');
  }

  // Private helper methods

  private resolveAbsolutePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return resolve(filePath);
    }
    return resolve(this.config.rootPath, filePath);
  }

  private async checkFileAccess(filePath: string, mode: number): Promise<void> {
    await fs.access(filePath, mode);
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async createFileMetadata(filePath: string, stats: Stats): Promise<FileMetadata> {
    const relativePath = relative(this.config.rootPath, filePath);

    // Check permissions
    let readable = false;
    let writable = false;
    let executable = false;

    try {
      await fs.access(filePath, constants.R_OK);
      readable = true;
    } catch {
      // Intentionally left empty as permission check failure is expected
    }

    try {
      await fs.access(filePath, constants.W_OK);
      writable = true;
    } catch {
      // Permission check failure is expected and handled silently
    }

    try {
      await fs.access(filePath, constants.X_OK);
      executable = true;
    } catch {
      // Intentionally left empty as permission check failure is expected
    }

    return {
      path: relativePath,
      absolutePath: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      extension: extname(filePath),
      permissions: {
        readable,
        writable,
        executable,
      },
    };
  }

  private recordOperation(operation: FileOperation): void {
    this.operationHistory.push(operation);

    // Keep only last 1000 operations to prevent memory leaks
    if (this.operationHistory.length > 1000) {
      this.operationHistory = this.operationHistory.slice(-1000);
    }
  }
}

// Factory function for creating configured file system clients
export function createFileSystemClient(
  config: Partial<FileSystemConfig> & { rootPath: string }
): FileSystemClient {
  const defaultConfig: FileSystemConfig = {
    rootPath: config.rootPath,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    enableWatching: false,
    watchDebounceMs: 100,
  };

  return new FileSystemClient({ ...defaultConfig, ...config });
}
