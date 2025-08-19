import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs, existsSync, statSync, constants } from 'fs';
import { join, relative, isAbsolute, dirname, extname, basename, resolve, normalize, sep } from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { platform, EOL } from 'os';

const execAsync = promisify(exec);

/**
 * Cross-platform path utilities
 */
class CrossPlatformPath {
  static normalize(path: string): string {
    // Convert forward slashes to appropriate separator for the platform
    return normalize(path.replace(/\//g, sep));
  }

  static isWithinDirectory(targetPath: string, basePath: string): boolean {
    const relativePath = this.getRelativePath(targetPath, basePath);
    return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath);
  }

  static getRelativePath(targetPath: string, basePath: string): string {
    try {
      return relative(basePath, resolve(basePath, targetPath));
    } catch (error) {
      return '';
    }
  }

  static resolveSafePath(inputPath: string, workingDirectory: string): string {
    const normalized = this.normalize(inputPath);
    
    if (isAbsolute(normalized)) {
      // For absolute paths, check if they're within the working directory
      if (this.isWithinDirectory(normalized, workingDirectory)) {
        return normalized;
      }
      throw new Error(`Absolute path outside working directory: ${inputPath}`);
    }
    
    return resolve(workingDirectory, normalized);
  }
}

/**
 * Cross-platform encoding utilities
 */
class CrossPlatformEncoding {
  static readonly DEFAULT_ENCODING = 'utf8';
  
  static async detectEncoding(filePath: string): Promise<BufferEncoding> {
    try {
      const buffer = await fs.readFile(filePath);
      
      // Simple BOM detection
      if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf8';
      }
      
      if (buffer.length >= 2) {
        if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
          return 'utf16le';
        }
        if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
          return 'utf16le'; // Use utf16le for compatibility
        }
      }
      
      return this.DEFAULT_ENCODING;
    } catch (error) {
      return this.DEFAULT_ENCODING;
    }
  }

  static normalizeLineEndings(content: string, targetPlatform?: string): string {
    const target = targetPlatform || platform();
    
    // First normalize all line endings to \n
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Then convert to target platform
    switch (target) {
      case 'win32':
        return normalized.replace(/\n/g, '\r\n');
      case 'darwin':
      case 'linux':
      default:
        return normalized;
    }
  }
}

/**
 * Enhanced cross-platform file reader with terminal integration
 */
export class CrossPlatformFileReader extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      path: z.string().describe('File path to read'),
      encoding: z.string().optional().describe('File encoding (auto-detected if not specified)'),
      maxSize: z.number().optional().default(10 * 1024 * 1024).describe('Maximum file size in bytes (10MB default)'),
      normalizeLineEndings: z.boolean().optional().describe('Normalize line endings for current platform'),
      includeMetadata: z.boolean().optional().default(true).describe('Include file metadata'),
      followSymlinks: z.boolean().optional().default(true).describe('Follow symbolic links'),
    });

    super({
      name: 'crossPlatformReadFile',
      description: 'Read files with full cross-platform support, encoding detection, and terminal integration',
      category: 'File System',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<{
    success: boolean;
    path?: string;
    content?: string;
    metadata?: Record<string, unknown>;
    encoding?: string;
    error?: string;
  }> {
    try {
      const safePath = CrossPlatformPath.resolveSafePath(args.path, this.agentContext.workingDirectory);
      
      // Check file existence and permissions
      await this.validateFileAccess(safePath, args.followSymlinks);
      
      // Get file stats
      const stats = await fs.stat(safePath);
      
      // Check file size
      if (stats.size > args.maxSize) {
        return {
          success: false,
          error: `File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB exceeds ${(args.maxSize / 1024 / 1024).toFixed(2)}MB limit`
        };
      }
      
      // Detect or use specified encoding
      const encoding = (args.encoding as BufferEncoding) || await CrossPlatformEncoding.detectEncoding(safePath);
      
      // Read file content
      let content = await fs.readFile(safePath, encoding);
      
      // Normalize line endings if requested
      if (args.normalizeLineEndings !== false) {
        content = CrossPlatformEncoding.normalizeLineEndings(content);
      }
      
      const result: Record<string, unknown> = {
        success: true,
        path: args.path,
        content,
        encoding
      };
      
      if (args.includeMetadata) {
        result.metadata = {
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          mode: stats.mode,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          isSymbolicLink: stats.isSymbolicLink(),
          lines: content.split('\n').length,
          platform: platform(),
          extension: extname(safePath),
          basename: basename(safePath),
          dirname: dirname(safePath)
        };
      }
      
      return result as {
        success: boolean;
        path?: string;
        content?: string;
        metadata?: Record<string, unknown>;
        encoding?: string;
        error?: string;
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file '${args.path}': ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async validateFileAccess(filePath: string, followSymlinks: boolean): Promise<void> {
    // Check if file exists
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Check read permissions
    try {
      await fs.access(filePath, constants.R_OK);
    } catch (error) {
      throw new Error(`No read permission for file: ${filePath}`);
    }
    
    const stats = await fs.stat(filePath);
    
    // Handle symbolic links
    if (stats.isSymbolicLink() && !followSymlinks) {
      throw new Error(`Symbolic link not followed: ${filePath}`);
    }
    
    // Ensure it's a file, not a directory
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${filePath}`);
    }
  }
}

/**
 * Enhanced cross-platform file writer with terminal integration
 */
export class CrossPlatformFileWriter extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      path: z.string().describe('File path to write'),
      content: z.string().describe('Content to write'),
      encoding: z.string().optional().default('utf8').describe('File encoding'),
      mode: z.enum(['write', 'append', 'prepend']).optional().default('write').describe('Write mode'),
      createDirectories: z.boolean().optional().default(true).describe('Create parent directories if needed'),
      backup: z.boolean().optional().default(false).describe('Create backup of existing file'),
      normalizeLineEndings: z.boolean().optional().describe('Normalize line endings for current platform'),
      permissions: z.string().optional().describe('File permissions (Unix octal notation)'),
      atomicWrite: z.boolean().optional().default(true).describe('Use atomic write operations'),
    });

    super({
      name: 'crossPlatformWriteFile',
      description: 'Write files with full cross-platform support, atomic operations, and terminal integration',
      category: 'File System',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<{
    success: boolean;
    path?: string;
    size?: number;
    backup?: string;
    error?: string;
  }> {
    try {
      const safePath = CrossPlatformPath.resolveSafePath(args.path, this.agentContext.workingDirectory);
      
      // Create parent directories if needed
      if (args.createDirectories) {
        await fs.mkdir(dirname(safePath), { recursive: true });
      }
      
      // Create backup if requested and file exists
      let backupPath: string | undefined;
      if (args.backup && existsSync(safePath)) {
        backupPath = await this.createBackup(safePath);
      }
      
      // Normalize content line endings
      let content = args.content;
      if (args.normalizeLineEndings !== false) {
        content = CrossPlatformEncoding.normalizeLineEndings(content);
      }
      
      // Handle different write modes
      let finalContent = content;
      if (args.mode === 'append' && existsSync(safePath)) {
        const existingContent = await fs.readFile(safePath, args.encoding as BufferEncoding);
        finalContent = existingContent + content;
      } else if (args.mode === 'prepend' && existsSync(safePath)) {
        const existingContent = await fs.readFile(safePath, args.encoding as BufferEncoding);
        finalContent = content + existingContent;
      }
      
      // Perform atomic write
      if (args.atomicWrite) {
        await this.atomicWrite(safePath, finalContent, args.encoding as BufferEncoding);
      } else {
        await fs.writeFile(safePath, finalContent, args.encoding as BufferEncoding);
      }
      
      // Set permissions if specified (Unix-like systems only)
      if (args.permissions && platform() !== 'win32') {
        const mode = parseInt(args.permissions, 8);
        await fs.chmod(safePath, mode);
      }
      
      return {
        success: true,
        path: args.path,
        size: Buffer.byteLength(finalContent, args.encoding as BufferEncoding),
        backup: backupPath
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file '${args.path}': ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    await fs.copyFile(filePath, backupPath);
    return backupPath;
  }

  private async atomicWrite(filePath: string, content: string, encoding: BufferEncoding): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await fs.writeFile(tempPath, content, encoding);
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        if (existsSync(tempPath)) {
          await fs.unlink(tempPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}

/**
 * Cross-platform terminal command executor for code operations
 */
export class CrossPlatformTerminalCodeExecutor extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      operation: z.enum(['execute', 'validate', 'format', 'lint', 'compile']).describe('Operation to perform'),
      language: z.string().optional().describe('Programming language (auto-detected if not specified)'),
      code: z.string().optional().describe('Code to execute (for direct execution)'),
      filePath: z.string().optional().describe('File path for file-based operations'),
      args: z.array(z.string()).optional().describe('Additional arguments'),
      timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
      captureOutput: z.boolean().optional().default(true).describe('Capture stdout/stderr'),
      workingDirectory: z.string().optional().describe('Override working directory'),
    });

    super({
      name: 'crossPlatformTerminalCode',
      description: 'Execute code operations directly from terminal with cross-platform support',
      category: 'Terminal Code',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    exitCode?: number;
    command?: string;
  }> {
    try {
      const workingDir = args.workingDirectory || this.agentContext.workingDirectory;
      
      let command: string;
      let tempFile: string | undefined;
      
      switch (args.operation) {
        case 'execute':
          ({ command, tempFile } = await this.buildExecuteCommand(args, workingDir));
          break;
          
        case 'validate':
          command = await this.buildValidateCommand(args, workingDir);
          break;
          
        case 'format':
          command = await this.buildFormatCommand(args, workingDir);
          break;
          
        case 'lint':
          command = await this.buildLintCommand(args, workingDir);
          break;
          
        case 'compile':
          command = await this.buildCompileCommand(args, workingDir);
          break;
          
        default:
          throw new Error(`Unknown operation: ${args.operation}`);
      }
      
      // Execute command
      const result = await this.executeCommand(command, workingDir, args.timeout);
      
      // Clean up temporary file if created
      if (tempFile && existsSync(tempFile)) {
        await fs.unlink(tempFile);
      }
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode,
        command
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Terminal code operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async buildExecuteCommand(args: any, workingDir: string): Promise<{ command: string; tempFile?: string }> {
    const language = args.language || this.detectLanguage(args.filePath, args.code);
    
    if (args.code) {
      // Create temporary file for code execution
      const tempFile = join(workingDir, `temp_${Date.now()}.${this.getFileExtension(language)}`);
      await fs.writeFile(tempFile, args.code, 'utf8');
      
      return {
        command: this.getExecuteCommand(language, tempFile, args.args),
        tempFile
      };
    } else if (args.filePath) {
      const safePath = CrossPlatformPath.resolveSafePath(args.filePath, workingDir);
      return {
        command: this.getExecuteCommand(language, safePath, args.args)
      };
    } else {
      throw new Error('Either code or filePath must be specified for execution');
    }
  }

  private async buildValidateCommand(args: any, workingDir: string): Promise<string> {
    const language = args.language || this.detectLanguage(args.filePath, args.code);
    const filePath = args.filePath ? CrossPlatformPath.resolveSafePath(args.filePath, workingDir) : null;
    
    return this.getValidateCommand(language, filePath, args.args);
  }

  private async buildFormatCommand(args: any, workingDir: string): Promise<string> {
    const language = args.language || this.detectLanguage(args.filePath, args.code);
    const filePath = args.filePath ? CrossPlatformPath.resolveSafePath(args.filePath, workingDir) : null;
    
    return this.getFormatCommand(language, filePath, args.args);
  }

  private async buildLintCommand(args: any, workingDir: string): Promise<string> {
    const language = args.language || this.detectLanguage(args.filePath, args.code);
    const filePath = args.filePath ? CrossPlatformPath.resolveSafePath(args.filePath, workingDir) : null;
    
    return this.getLintCommand(language, filePath, args.args);
  }

  private async buildCompileCommand(args: any, workingDir: string): Promise<string> {
    const language = args.language || this.detectLanguage(args.filePath, args.code);
    const filePath = args.filePath ? CrossPlatformPath.resolveSafePath(args.filePath, workingDir) : null;
    
    return this.getCompileCommand(language, filePath, args.args);
  }

  private detectLanguage(filePath?: string, code?: string): string {
    if (filePath) {
      const ext = extname(filePath).toLowerCase();
      switch (ext) {
        case '.js': return 'javascript';
        case '.ts': return 'typescript';
        case '.py': return 'python';
        case '.java': return 'java';
        case '.cpp': case '.cc': case '.cxx': return 'cpp';
        case '.c': return 'c';
        case '.cs': return 'csharp';
        case '.go': return 'go';
        case '.rs': return 'rust';
        case '.rb': return 'ruby';
        case '.php': return 'php';
        default: return 'unknown';
      }
    }
    
    if (code) {
      // Simple heuristics for code detection
      if (code.includes('def ') || code.includes('import ') || code.includes('print(')) return 'python';
      if (code.includes('function ') || code.includes('const ') || code.includes('let ')) return 'javascript';
      if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) return 'typescript';
      if (code.includes('public class') || code.includes('public static void main')) return 'java';
      if (code.includes('#include') || code.includes('int main(')) return 'c';
    }
    
    return 'unknown';
  }

  private getFileExtension(language: string): string {
    switch (language) {
      case 'javascript': return 'js';
      case 'typescript': return 'ts';
      case 'python': return 'py';
      case 'java': return 'java';
      case 'cpp': return 'cpp';
      case 'c': return 'c';
      case 'csharp': return 'cs';
      case 'go': return 'go';
      case 'rust': return 'rs';
      case 'ruby': return 'rb';
      case 'php': return 'php';
      default: return 'txt';
    }
  }

  private getExecuteCommand(language: string, filePath: string, args: string[] = []): string {
    const quotedPath = `"${filePath}"`;
    const additionalArgs = args.join(' ');
    
    switch (language) {
      case 'javascript':
        return `node ${quotedPath} ${additionalArgs}`.trim();
      case 'typescript':
        return `npx tsx ${quotedPath} ${additionalArgs}`.trim();
      case 'python':
        return `python ${quotedPath} ${additionalArgs}`.trim();
      case 'java':
        return `javac ${quotedPath} && java ${basename(filePath, '.java')} ${additionalArgs}`.trim();
      case 'cpp':
        const outputName = platform() === 'win32' ? 'output.exe' : 'output';
        return `g++ ${quotedPath} -o ${outputName} && ./${outputName} ${additionalArgs}`.trim();
      case 'c':
        const cOutputName = platform() === 'win32' ? 'output.exe' : 'output';
        return `gcc ${quotedPath} -o ${cOutputName} && ./${cOutputName} ${additionalArgs}`.trim();
      case 'go':
        return `go run ${quotedPath} ${additionalArgs}`.trim();
      case 'rust':
        return `rustc ${quotedPath} && ./output ${additionalArgs}`.trim();
      case 'ruby':
        return `ruby ${quotedPath} ${additionalArgs}`.trim();
      case 'php':
        return `php ${quotedPath} ${additionalArgs}`.trim();
      default:
        throw new Error(`Execution not supported for language: ${language}`);
    }
  }

  private getValidateCommand(language: string, filePath: string | null, args: string[] = []): string {
    if (!filePath) throw new Error('File path required for validation');
    
    const quotedPath = `"${filePath}"`;
    const additionalArgs = args.join(' ');
    
    switch (language) {
      case 'javascript':
        return `node --check ${quotedPath} ${additionalArgs}`.trim();
      case 'typescript':
        return `npx tsc --noEmit ${quotedPath} ${additionalArgs}`.trim();
      case 'python':
        return `python -m py_compile ${quotedPath} ${additionalArgs}`.trim();
      case 'java':
        return `javac -Xlint ${quotedPath} ${additionalArgs}`.trim();
      default:
        throw new Error(`Validation not supported for language: ${language}`);
    }
  }

  private getFormatCommand(language: string, filePath: string | null, args: string[] = []): string {
    if (!filePath) throw new Error('File path required for formatting');
    
    const quotedPath = `"${filePath}"`;
    const additionalArgs = args.join(' ');
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        return `npx prettier --write ${quotedPath} ${additionalArgs}`.trim();
      case 'python':
        return `python -m black ${quotedPath} ${additionalArgs}`.trim();
      case 'java':
        return `java -jar google-java-format.jar --replace ${quotedPath} ${additionalArgs}`.trim();
      case 'go':
        return `go fmt ${quotedPath} ${additionalArgs}`.trim();
      case 'rust':
        return `rustfmt ${quotedPath} ${additionalArgs}`.trim();
      default:
        throw new Error(`Formatting not supported for language: ${language}`);
    }
  }

  private getLintCommand(language: string, filePath: string | null, args: string[] = []): string {
    if (!filePath) throw new Error('File path required for linting');
    
    const quotedPath = `"${filePath}"`;
    const additionalArgs = args.join(' ');
    
    switch (language) {
      case 'javascript':
        return `npx eslint ${quotedPath} ${additionalArgs}`.trim();
      case 'typescript':
        return `npx eslint ${quotedPath} ${additionalArgs}`.trim();
      case 'python':
        return `python -m flake8 ${quotedPath} ${additionalArgs}`.trim();
      default:
        throw new Error(`Linting not supported for language: ${language}`);
    }
  }

  private getCompileCommand(language: string, filePath: string | null, args: string[] = []): string {
    if (!filePath) throw new Error('File path required for compilation');
    
    const quotedPath = `"${filePath}"`;
    const additionalArgs = args.join(' ');
    
    switch (language) {
      case 'typescript':
        return `npx tsc ${quotedPath} ${additionalArgs}`.trim();
      case 'java':
        return `javac ${quotedPath} ${additionalArgs}`.trim();
      case 'cpp':
        return `g++ ${quotedPath} -o output ${additionalArgs}`.trim();
      case 'c':
        return `gcc ${quotedPath} -o output ${additionalArgs}`.trim();
      case 'go':
        return `go build ${quotedPath} ${additionalArgs}`.trim();
      case 'rust':
        return `rustc ${quotedPath} ${additionalArgs}`.trim();
      default:
        throw new Error(`Compilation not supported for language: ${language}`);
    }
  }

  private async executeCommand(command: string, workingDir: string, timeout: number): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve) => {
      const options = {
        cwd: workingDir,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        encoding: 'utf8' as const
      };

      exec(command, options, (error: any, stdout: any, stderr: any) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: error ? (error as any).code || 1 : 0
        });
      });
    });
  }
}

/**
 * Cross-platform directory operations
 */
export class CrossPlatformDirectoryOperations extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      operation: z.enum(['list', 'create', 'remove', 'tree', 'search']).describe('Directory operation'),
      path: z.string().describe('Directory path'),
      recursive: z.boolean().optional().default(false).describe('Recursive operation'),
      pattern: z.string().optional().describe('Search pattern for search operation'),
      includeHidden: z.boolean().optional().default(false).describe('Include hidden files/directories'),
      maxDepth: z.number().optional().default(10).describe('Maximum depth for recursive operations'),
    });

    super({
      name: 'crossPlatformDirectory',
      description: 'Cross-platform directory operations with enhanced functionality',
      category: 'File System',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<Record<string, unknown>> {
    try {
      const safePath = CrossPlatformPath.resolveSafePath(args.path, this.agentContext.workingDirectory);
      
      switch (args.operation) {
        case 'list':
          return await this.listDirectory(safePath, args.includeHidden);
        case 'create':
          return await this.createDirectory(safePath, args.recursive);
        case 'remove':
          return await this.removeDirectory(safePath, args.recursive);
        case 'tree':
          return await this.getDirectoryTree(safePath, args.maxDepth, args.includeHidden);
        case 'search':
          return await this.searchDirectory(safePath, args.pattern!, args.recursive, args.includeHidden);
        default:
          throw new Error(`Unknown operation: ${args.operation}`);
      }
    } catch (error) {
      return {
        success: false,
        error: `Directory operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async listDirectory(dirPath: string, includeHidden: boolean): Promise<Record<string, unknown>> {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const files: Record<string, unknown>[] = [];
    const directories: Record<string, unknown>[] = [];
    
    for (const item of items) {
      if (!includeHidden && item.name.startsWith('.')) {
        continue;
      }
      
      const itemPath = join(dirPath, item.name);
      const stats = await fs.stat(itemPath);
      
      const itemInfo = {
        name: item.name,
        path: itemPath,
        size: stats.size,
        modified: stats.mtime,
        permissions: stats.mode,
        type: item.isDirectory() ? 'directory' : 'file'
      };
      
      if (item.isDirectory()) {
        directories.push(itemInfo);
      } else {
        files.push(itemInfo);
      }
    }
    
    return {
      success: true,
      path: dirPath,
      files,
      directories,
      total: files.length + directories.length
    };
  }

  private async createDirectory(dirPath: string, recursive: boolean): Promise<Record<string, unknown>> {
    await fs.mkdir(dirPath, { recursive });
    
    return {
      success: true,
      path: dirPath,
      created: true,
      recursive
    };
  }

  private async removeDirectory(dirPath: string, recursive: boolean): Promise<Record<string, unknown>> {
    if (recursive) {
      await fs.rm(dirPath, { recursive: true, force: true });
    } else {
      await fs.rmdir(dirPath);
    }
    
    return {
      success: true,
      path: dirPath,
      removed: true,
      recursive
    };
  }

  private async getDirectoryTree(dirPath: string, maxDepth: number, includeHidden: boolean, currentDepth = 0): Promise<Record<string, unknown>> {
    if (currentDepth >= maxDepth) {
      return {
        name: basename(dirPath),
        path: dirPath,
        type: 'directory',
        children: [],
        truncated: true
      };
    }
    
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const children: Record<string, unknown>[] = [];
    
    for (const item of items) {
      if (!includeHidden && item.name.startsWith('.')) {
        continue;
      }
      
      const itemPath = join(dirPath, item.name);
      
      if (item.isDirectory()) {
        const subtree = await this.getDirectoryTree(itemPath, maxDepth, includeHidden, currentDepth + 1);
        children.push(subtree);
      } else {
        const stats = await fs.stat(itemPath);
        children.push({
          name: item.name,
          path: itemPath,
          type: 'file',
          size: stats.size,
          modified: stats.mtime
        });
      }
    }
    
    return {
      success: true,
      name: basename(dirPath),
      path: dirPath,
      type: 'directory',
      children,
      depth: currentDepth
    };
  }

  private async searchDirectory(dirPath: string, pattern: string, recursive: boolean, includeHidden: boolean): Promise<Record<string, unknown>> {
    const results: Record<string, unknown>[] = [];
    const regex = new RegExp(pattern, 'i');
    
    const searchRecursive = async (currentPath: string) => {
      const items = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const item of items) {
        if (!includeHidden && item.name.startsWith('.')) {
          continue;
        }
        
        const itemPath = join(currentPath, item.name);
        
        if (regex.test(item.name)) {
          const stats = await fs.stat(itemPath);
          results.push({
            name: item.name,
            path: itemPath,
            type: item.isDirectory() ? 'directory' : 'file',
            size: item.isFile() ? stats.size : undefined,
            modified: stats.mtime
          });
        }
        
        if (item.isDirectory() && recursive) {
          await searchRecursive(itemPath);
        }
      }
    };
    
    await searchRecursive(dirPath);
    
    return {
      success: true,
      pattern,
      searchPath: dirPath,
      results,
      count: results.length
    };
  }
}