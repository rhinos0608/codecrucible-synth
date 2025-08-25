import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs, existsSync, statSync } from 'fs';
import { join, relative, isAbsolute, dirname, extname, basename, resolve } from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Enhanced File Reading Tool - Can read single files, multiple files, or directories
 */
export class EnhancedReadFileTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      paths: z
        .union([z.string(), z.array(z.string())])
        .describe(
          'File path(s) or glob pattern(s) to read. Can be single file, array of files, or glob patterns like "src/**/*.ts"'
        ),
      maxFiles: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum number of files to read (default: 20)'),
      maxSize: z
        .number()
        .optional()
        .default(100000)
        .describe('Maximum file size in bytes (default: 100KB)'),
      includeMetadata: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include file metadata (size, modified date, etc.)'),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe('Patterns to exclude (e.g., ["node_modules/**", "*.log"])'),
    });

    super({
      name: 'readFiles',
      description:
        'Read single or multiple files, supports glob patterns, directory traversal, and smart file filtering',
      category: 'File System',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      // Normalize paths to array
      const pathsInput = Array.isArray(args.paths) ? args.paths : [args.paths];
      let allPaths: string[] = [];

      // Expand glob patterns and collect all file paths
      for (const pathInput of pathsInput) {
        if (pathInput.includes('*') || pathInput.includes('?')) {
          // Handle glob patterns
          const matches = await glob(pathInput, {
            cwd: this.agentContext.workingDirectory,
            ignore: args.excludePatterns || ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
          });
          allPaths.push(...matches);
        } else {
          // Handle direct paths
          const fullPath = this.resolvePath(pathInput);
          if (existsSync(fullPath)) {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              // Read directory contents
              const dirFiles = await this.readDirectoryFiles(fullPath, args.excludePatterns);
              allPaths.push(...dirFiles);
            } else {
              allPaths.push(pathInput);
            }
          } else {
            return { error: `Path not found: ${pathInput}` };
          }
        }
      }

      // Remove duplicates and apply limits
      allPaths = [...new Set(allPaths)].slice(0, args.maxFiles);

      // Read all files
      const results = await Promise.all(allPaths.map(async path => this.readSingleFile(path, args)));

      // Filter out errors and organize results
      const successful = results.filter(r => !r.error);
      const errors = results.filter(r => r.error);

      return {
        summary: {
          totalFiles: allPaths.length,
          successful: successful.length,
          errors: errors.length,
          totalSize: successful.reduce((sum, r) => sum + (r.metadata?.size || 0), 0),
        },
        files: successful,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        error: `Failed to read files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async readDirectoryFiles(dirPath: string, excludePatterns?: string[]): Promise<string[]> {
    try {
      const files: string[] = [];
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = join(dirPath, item.name);
        const relativePath = relative(this.agentContext.workingDirectory, itemPath);

        // Check exclude patterns
        if (
          excludePatterns?.some(pattern => {
            if (!pattern || typeof pattern !== 'string') return false;
            return (
              relativePath.includes(pattern.replace('**', '')) ||
              item.name.match(new RegExp(pattern.replace('*', '.*')))
            );
          })
        ) {
          continue;
        }

        if (item.isFile()) {
          files.push(relativePath);
        } else if (item.isDirectory() && !item.name.startsWith('.')) {
          // Recursively read subdirectories (limited depth)
          const subFiles = await this.readDirectoryFiles(itemPath, excludePatterns);
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error) {
      return [];
    }
  }

  private async readSingleFile(path: string, args: any): Promise<any> {
    try {
      const fullPath = this.resolvePath(path);
      const stat = await fs.stat(fullPath);

      // Check file size limit
      if (stat.size > args.maxSize) {
        return {
          path,
          error: `File too large (${(stat.size / 1024).toFixed(1)}KB > ${(args.maxSize / 1024).toFixed(1)}KB limit)`,
          metadata: args.includeMetadata
            ? {
                size: stat.size,
                modified: stat.mtime,
                type: extname(path),
              }
            : undefined,
        };
      }

      const content = await fs.readFile(fullPath, 'utf-8');

      return {
        path,
        content,
        metadata: args.includeMetadata
          ? {
              size: stat.size,
              modified: stat.mtime,
              lines: content.split('\n').length,
              type: extname(path),
              encoding: 'utf-8',
            }
          : undefined,
      };
    } catch (error) {
      return {
        path,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

/**
 * Enhanced File Writing Tool - Supports batch operations and directory creation
 */
export class EnhancedWriteFileTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      operations: z
        .array(
          z.object({
            path: z.string().describe('File path to write'),
            content: z.string().describe('Content to write'),
            mode: z
              .enum(['write', 'append', 'prepend'])
              .optional()
              .default('write')
              .describe('Write mode'),
            createDirs: z
              .boolean()
              .optional()
              .default(true)
              .describe("Create parent directories if they don't exist"),
          })
        )
        .describe('Array of write operations to perform'),
      backup: z
        .boolean()
        .optional()
        .default(false)
        .describe('Create backup files before overwriting'),
    });

    super({
      name: 'writeFiles',
      description:
        'Write to single or multiple files with support for batch operations, directory creation, and backup',
      category: 'File System',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      const results = [];

      for (const operation of args.operations) {
        const result = await this.performWriteOperation(operation, args.backup);
        results.push(result);
      }

      const successful = results.filter(r => !r.error);
      const errors = results.filter(r => r.error);

      return {
        summary: {
          totalOperations: args.operations.length,
          successful: successful.length,
          errors: errors.length,
        },
        operations: results,
      };
    } catch (error) {
      return {
        error: `Batch write failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async performWriteOperation(operation: any, backup: boolean): Promise<any> {
    try {
      const fullPath = this.resolvePath(operation.path);

      // Create parent directories if needed
      if (operation.createDirs) {
        await fs.mkdir(dirname(fullPath), { recursive: true });
      }

      // Create backup if requested and file exists
      if (backup && existsSync(fullPath)) {
        const backupPath = `${fullPath}.backup.${Date.now()}`;
        await fs.copyFile(fullPath, backupPath);
      }

      // Perform write operation
      switch (operation.mode) {
        case 'write':
          await fs.writeFile(fullPath, operation.content, 'utf-8');
          break;
        case 'append':
          await fs.appendFile(fullPath, operation.content, 'utf-8');
          break;
        case 'prepend': {
          const existingContent = existsSync(fullPath) ? await fs.readFile(fullPath, 'utf-8') : '';
          await fs.writeFile(fullPath, operation.content + existingContent, 'utf-8');
          break;
        }
      }

      return {
        path: operation.path,
        mode: operation.mode,
        success: true,
        size: operation.content.length,
      };
    } catch (error) {
      return {
        path: operation.path,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

/**
 * File Search and Grep Tool
 */
export class FileSearchTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      pattern: z.string().describe('Search pattern (regex supported)'),
      paths: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Paths to search in (default: current directory)'),
      fileTypes: z
        .array(z.string())
        .optional()
        .describe('File extensions to include (e.g., [".ts", ".js"])'),
      excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
      caseSensitive: z.boolean().optional().default(false),
      wholeWord: z.boolean().optional().default(false),
      maxResults: z.number().optional().default(100),
      showContext: z.boolean().optional().default(true).describe('Show surrounding lines'),
      contextLines: z.number().optional().default(2).describe('Number of context lines to show'),
    });

    super({
      name: 'searchFiles',
      description: 'Search for patterns in files with grep-like functionality',
      category: 'File System',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      // Build search paths
      const searchPaths = args.paths
        ? Array.isArray(args.paths)
          ? args.paths
          : [args.paths]
        : ['.'];

      // Find all files to search
      let allFiles: string[] = [];
      for (const searchPath of searchPaths) {
        const files = await this.findFilesToSearch(
          searchPath,
          args.fileTypes,
          args.excludePatterns
        );
        allFiles.push(...files);
      }

      // Remove duplicates
      allFiles = [...new Set(allFiles)];

      // Perform search
      const results = [];
      let totalMatches = 0;

      for (const file of allFiles) {
        if (totalMatches >= args.maxResults) break;

        const fileResults = await this.searchInFile(file, args);
        if (fileResults.matches.length > 0) {
          results.push(fileResults);
          totalMatches += fileResults.matches.length;
        }
      }

      return {
        summary: {
          pattern: args.pattern,
          filesSearched: allFiles.length,
          filesWithMatches: results.length,
          totalMatches,
          truncated: totalMatches >= args.maxResults,
        },
        results,
      };
    } catch (error) {
      return {
        error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async findFilesToSearch(
    searchPath: string,
    fileTypes?: string[],
    excludePatterns?: string[]
  ): Promise<string[]> {
    try {
      const fullPath = this.resolvePath(searchPath);

      if (!existsSync(fullPath)) {
        return [];
      }

      const stat = statSync(fullPath);
      if (stat.isFile()) {
        return [searchPath];
      }

      // Build glob pattern
      let pattern = '**/*';
      if (fileTypes && fileTypes.length > 0) {
        if (fileTypes.length === 1) {
          pattern = `**/*${fileTypes[0]}`;
        } else {
          pattern = `**/*.{${fileTypes.map(t => t.replace('.', '')).join(',')}}`;
        }
      }

      const files = await glob(pattern, {
        cwd: fullPath,
        ignore: excludePatterns || ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      });

      return files.map(f => join(searchPath, f));
    } catch (error) {
      return [];
    }
  }

  private async searchInFile(filePath: string, args: any): Promise<any> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Build regex
      let regexFlags = 'g';
      if (!args.caseSensitive) regexFlags += 'i';

      let pattern = args.pattern;
      if (args.wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }

      const regex = new RegExp(pattern, regexFlags);
      const matches = [];

      // Search each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineMatches = [...line.matchAll(regex)];

        for (const match of lineMatches) {
          const result: any = {
            lineNumber: i + 1,
            column: match.index! + 1,
            match: match[0],
            line: line.trim(),
          };

          // Add context if requested
          if (args.showContext && args.contextLines > 0) {
            const start = Math.max(0, i - args.contextLines);
            const end = Math.min(lines.length - 1, i + args.contextLines);

            result.context = {
              before: lines.slice(start, i).map((l, idx) => ({
                lineNumber: start + idx + 1,
                content: l.trim(),
              })),
              after: lines.slice(i + 1, end + 1).map((l, idx) => ({
                lineNumber: i + idx + 2,
                content: l.trim(),
              })),
            };
          }

          matches.push(result);
        }
      }

      return {
        file: filePath,
        matches,
      };
    } catch (error) {
      return {
        file: filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
        matches: [],
      };
    }
  }

  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

/**
 * File Operations Tool - Copy, move, delete, etc.
 */
export class FileOperationsTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      operation: z.enum(['copy', 'move', 'delete', 'mkdir', 'rmdir', 'chmod', 'touch']),
      source: z.string().optional().describe('Source path for copy/move operations'),
      destination: z.string().optional().describe('Destination path for copy/move operations'),
      paths: z.array(z.string()).optional().describe('Paths for batch operations'),
      recursive: z
        .boolean()
        .optional()
        .default(false)
        .describe('Recursive operation for directories'),
      force: z
        .boolean()
        .optional()
        .default(false)
        .describe('Force operation (overwrite, delete non-empty)'),
      permissions: z.string().optional().describe('File permissions (e.g., "755")'),
    });

    super({
      name: 'fileOperations',
      description: 'Perform file system operations: copy, move, delete, create directories, etc.',
      category: 'File System',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      switch (args.operation) {
        case 'copy':
          return await this.copyOperation(args.source!, args.destination!, args.recursive);

        case 'move':
          return await this.moveOperation(args.source!, args.destination!);

        case 'delete':
          if (args.paths) {
            return await this.deleteMultiple(args.paths, args.force, args.recursive);
          } else {
            return await this.deleteOperation(args.source!, args.force, args.recursive);
          }

        case 'mkdir':
          return await this.mkdirOperation(args.paths || [args.destination!], args.recursive);

        case 'rmdir':
          return await this.rmdirOperation(args.paths || [args.source!], args.force);

        case 'chmod':
          return await this.chmodOperation(args.source!, args.permissions!);

        case 'touch':
          return await this.touchOperation(args.paths || [args.source!]);

        default:
          return { error: `Unknown operation: ${args.operation}` };
      }
    } catch (error) {
      return {
        error: `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async copyOperation(
    source: string,
    destination: string,
    recursive: boolean
  ): Promise<any> {
    try {
      const sourcePath = this.resolvePath(source);
      const destPath = this.resolvePath(destination);

      // Ensure destination directory exists
      await fs.mkdir(dirname(destPath), { recursive: true });

      const stat = await fs.stat(sourcePath);
      if (stat.isDirectory()) {
        if (!recursive) {
          return { error: 'Cannot copy directory without recursive flag' };
        }
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }

      return {
        success: true,
        operation: 'copy',
        source,
        destination,
        type: stat.isDirectory() ? 'directory' : 'file',
      };
    } catch (error) {
      return { error: `Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    const items = await fs.readdir(source, { withFileTypes: true });

    for (const item of items) {
      const sourcePath = join(source, item.name);
      const destPath = join(destination, item.name);

      if (item.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  private async moveOperation(source: string, destination: string): Promise<any> {
    try {
      const sourcePath = this.resolvePath(source);
      const destPath = this.resolvePath(destination);

      // Ensure destination directory exists
      await fs.mkdir(dirname(destPath), { recursive: true });

      await fs.rename(sourcePath, destPath);

      return {
        success: true,
        operation: 'move',
        source,
        destination,
      };
    } catch (error) {
      return { error: `Move failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async deleteOperation(path: string, force: boolean, recursive: boolean): Promise<any> {
    try {
      const fullPath = this.resolvePath(path);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        if (recursive || force) {
          await fs.rm(fullPath, { recursive: true, force });
        } else {
          await fs.rmdir(fullPath);
        }
      } else {
        await fs.unlink(fullPath);
      }

      return {
        success: true,
        operation: 'delete',
        path,
        type: stat.isDirectory() ? 'directory' : 'file',
      };
    } catch (error) {
      return {
        error: `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async deleteMultiple(paths: string[], force: boolean, recursive: boolean): Promise<any> {
    const results = [];

    for (const path of paths) {
      const result = await this.deleteOperation(path, force, recursive);
      results.push({ path, ...result });
    }

    const successful = results.filter(r => r.success);
    const errors = results.filter(r => r.error);

    return {
      summary: {
        total: paths.length,
        successful: successful.length,
        errors: errors.length,
      },
      results,
    };
  }

  private async mkdirOperation(paths: string[], recursive: boolean): Promise<any> {
    const results = [];

    for (const path of paths) {
      try {
        const fullPath = this.resolvePath(path);
        await fs.mkdir(fullPath, { recursive });
        results.push({ path, success: true });
      } catch (error) {
        results.push({
          path,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.success);
    const errors = results.filter(r => r.error);

    return {
      summary: {
        total: paths.length,
        successful: successful.length,
        errors: errors.length,
      },
      results,
    };
  }

  private async rmdirOperation(paths: string[], force: boolean): Promise<any> {
    return await this.deleteMultiple(paths, force, true);
  }

  private async chmodOperation(path: string, permissions: string): Promise<any> {
    try {
      const fullPath = this.resolvePath(path);
      const mode = parseInt(permissions, 8);
      await fs.chmod(fullPath, mode);

      return {
        success: true,
        operation: 'chmod',
        path,
        permissions,
      };
    } catch (error) {
      return { error: `Chmod failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async touchOperation(paths: string[]): Promise<any> {
    const results = [];

    for (const path of paths) {
      try {
        const fullPath = this.resolvePath(path);

        // Create file if it doesn't exist, update timestamp if it does
        if (existsSync(fullPath)) {
          const now = new Date();
          await fs.utimes(fullPath, now, now);
        } else {
          await fs.mkdir(dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, '', 'utf-8');
        }

        results.push({ path, success: true });
      } catch (error) {
        results.push({
          path,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.success);
    const errors = results.filter(r => r.error);

    return {
      summary: {
        total: paths.length,
        successful: successful.length,
        errors: errors.length,
      },
      results,
    };
  }

  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

// Re-export existing tools for compatibility
export { ReadFileTool, WriteFileTool, ListFilesTool } from './file-tools.js';
