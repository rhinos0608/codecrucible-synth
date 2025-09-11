/**
 * Unified File Tool
 *
 * Replaces 6 different file tool implementations:
 * - file-tools.ts (basic)
 * - enhanced-file-tools.ts (glob patterns, multiple files)
 * - secure-file-tools.ts (security validation)
 * - cross-platform-file-tools.ts (platform compatibility)
 * - intelligent-file-reader-tool.ts (smart analysis)
 * - filesystem-tools.ts (filesystem operations)
 *
 * Uses Strategy and Decorator patterns for configurable behavior.
 */

import { existsSync, promises as fs } from 'fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'path';
import { glob } from 'glob';
import { normalizePathSeparators } from '../../utils/path-utilities.js';
import { BaseTool } from './unified-tool-system.js';
import {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolParameterSchema,
} from '../interfaces/tool-system.js';

// ============================================================================
// FILE OPERATION STRATEGIES - Different ways to handle files
// ============================================================================

export interface FileOperationStrategy {
  name: string;
  supports: (operation: string, args: Readonly<Record<string, unknown>>) => boolean;
  execute: (
    operation: string,
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ) => Promise<unknown>;
}

/**
 * Basic file operations strategy
 */
export class BasicFileStrategy implements FileOperationStrategy {
  public name = 'basic';

  public supports(operation: string, _args?: Readonly<Record<string, unknown>>): boolean {
    return ['read', 'write', 'exists', 'stat'].includes(operation);
  }

  public async execute(
    operation: string,
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<unknown> {
    const path = this.resolvePath(String(args.path), context);

    switch (operation) {
      case 'read': {
        const result = await this.readFile(path, args);
        return result;
      }
      case 'write': {
        const { content, encoding, mode } = args as {
          content: string;
          encoding?: BufferEncoding;
          mode?: number;
        };
        if (typeof content !== 'string') {
          throw new Error('Content must be provided as a string for write operation');
        }
        await this.writeFile(path, { content, encoding, mode });
        return { success: true };
      }
      case 'exists':
        return existsSync(path);
      case 'stat': {
        const result = await this.getFileInfo(path);
        return result;
      }
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  private async readFile(
    path: string,
    args: Readonly<{ maxSize?: number; encoding?: BufferEncoding }>
  ): Promise<string> {
    try {
      await fs.access(path);
      const stats = await fs.stat(path);

      const maxSize = typeof args.maxSize === 'number' ? args.maxSize : 1000000; // 1MB default
      if (stats.size > maxSize) {
        throw new Error(`File too large: ${stats.size} bytes exceeds limit of ${maxSize} bytes`);
      }

      const encoding: BufferEncoding = typeof args.encoding === 'string' ? args.encoding : 'utf-8';
      const content = await fs.readFile(path, { encoding });
      return content.toString();
    } catch (error) {
      throw new Error(
        `Failed to read file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get file information for stat operation.
   */
  private async getFileInfo(path: string): Promise<{
    size: number;
    isFile: boolean;
    isDirectory: boolean;
    modified: Date;
    created: Date;
    permissions: number;
  }> {
    const stats = await fs.stat(path);
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      modified: stats.mtime,
      created: stats.birthtime,
      permissions: stats.mode,
    };
  }

  private async writeFile(
    path: string,
    args: Readonly<{ content: string; encoding?: BufferEncoding; mode?: number }>
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(path);
      await fs.mkdir(dir, { recursive: true });

      const options: { encoding?: BufferEncoding; mode?: number } = {};
      if (args.encoding) options.encoding = args.encoding;
      if (args.mode !== undefined) options.mode = args.mode;

      await fs.writeFile(path, args.content, options);

      // Success - no return value needed for void method
    } catch (error) {
      throw new Error(
        `Failed to write file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  protected resolvePath(inputPath: string, context: Readonly<ToolExecutionContext>): string {
    if (!inputPath) {
      throw new Error('Path is required');
    }
    const root = context.rootDirectory || context.workingDirectory;

    // Handle relative paths
    let resolvedPath = inputPath;
    if (!isAbsolute(inputPath)) {
      resolvedPath = resolve(context.workingDirectory, inputPath);
    }
    resolvedPath = resolve(resolvedPath); // Normalize and resolve

    // Use centralized path normalization for cross-platform consistency
    const normalizedPath = normalizePathSeparators(resolvedPath);
    const normalizedRoot = normalizePathSeparators(resolve(root));

    // Ensure path stays within root directory
    const relativeToRoot = relative(normalizedRoot, normalizedPath);
    if (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) {
      throw new Error(`Path outside of root directory is not allowed: ${normalizedPath}`);
    }

    return normalizedPath;
  }
}

/**
 * Batch file operations strategy - handles multiple files and patterns
 */
export class BatchFileStrategy extends BasicFileStrategy {
  public override name = 'batch';

  public override supports(operation: string, args: Readonly<Record<string, unknown>>): boolean {
    const hasPathsArray =
      Object.prototype.hasOwnProperty.call(args, 'paths') &&
      Array.isArray((args as { paths?: unknown }).paths);
    const hasGlobPath =
      Object.prototype.hasOwnProperty.call(args, 'path') &&
      typeof (args as { path?: unknown }).path === 'string' &&
      (args as { path: string }).path.includes('*');

    return super.supports(operation, args) && (hasPathsArray || hasGlobPath);
  }

  public override async execute(
    operation: string,
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<Array<{ path: string; success: boolean; result?: unknown; error?: string }>> {
    const paths = await this.resolvePaths(args, context);
    const maxFiles = typeof args.maxFiles === 'number' ? args.maxFiles : 20;

    if (paths.length > maxFiles) {
      throw new Error(`Too many files: ${paths.length} exceeds limit of ${maxFiles}`);
    }

    const results: Array<{ path: string; success: boolean; result?: unknown; error?: string }> = [];

    for (const path of paths) {
      try {
        const result = await super.execute(
          operation,
          { ...args, path } as Readonly<Record<string, unknown>>,
          context
        );
        results.push({
          path,
          success: true,
          result,
        });
      } catch (error) {
        if ((args as { continueOnError?: boolean }).continueOnError !== false) {
          results.push({
            path,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  private async resolvePaths(
    args: Readonly<{
      paths?: unknown;
      path?: unknown;
      excludePatterns?: unknown;
    }>,
    context: ToolExecutionContext
  ): Promise<string[]> {
    let inputPaths: string[] = [];

    if (Array.isArray(args.paths)) {
      inputPaths = (args.paths as unknown[]).filter((p): p is string => typeof p === 'string');
    } else if (typeof args.path === 'string') {
      inputPaths = [args.path];
    } else {
      throw new Error('Either path or paths must be provided');
    }

    const resolvedPaths: string[] = [];

    for (const inputPath of inputPaths) {
      if (inputPath.includes('*')) {
        // Glob pattern
        const globOptions = {
          cwd: context.workingDirectory,
          absolute: true,
          ignore: Array.isArray(args.excludePatterns)
            ? (args.excludePatterns as unknown[]).filter((p): p is string => typeof p === 'string')
            : [],
        };

        const matches = await glob(inputPath, globOptions);
        for (const match of matches) {
          // Re-validate each match against root directory restrictions
          resolvedPaths.push(this.resolvePath(match, context));
        }
      } else {
        // Regular path
        const resolved = this.resolvePath(inputPath, context);
        resolvedPaths.push(resolved);
      }
    }

    return [...new Set(resolvedPaths)]; // Remove duplicates
  }
}

/**
 * Smart file strategy - adds intelligent analysis and metadata
 */
export class SmartFileStrategy extends BatchFileStrategy {
  public override name = 'smart';

  public override supports(operation: string, args: Readonly<Record<string, unknown>>): boolean {
    return (
      super.supports(operation, args) &&
      (args as { includeMetadata?: boolean }).includeMetadata !== false
    );
  }

  public override async execute(
    operation: string,
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<{ path: string; success: boolean; result?: unknown; error?: string }[]> {
    const baseResult = await super.execute(operation, args, context);

    if (operation === 'read') {
      if (Array.isArray(baseResult)) {
        // Multiple files
        return baseResult.map(
          (item: Readonly<{ path: string; success: boolean; result?: unknown; error?: string }>) =>
            this.enhanceFileResult(item)
        );
      } else {
        // Single file
        return [
          this.enhanceFileResult({
            path: (args as { path?: string }).path ?? '',
            success: true,
            result: baseResult,
          }),
        ];
      }
    }
    return baseResult as { path: string; success: boolean; result?: unknown; error?: string }[];
  }

  private enhanceFileResult(
    item: Readonly<{ path: string; success: boolean; result?: unknown; error?: string }>
  ): Readonly<{
    path: string;
    success: boolean;
    result?: unknown;
    error?: string;
    metadata?: FileMetadata;
    enhanced?: boolean;
  }> {
    if (!item.success) {
      return item;
    }

    const { path, result: content } = item;

    const metadata: FileMetadata = {
      fileSize: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : 0,
      fileExtension: extname(path),
      fileName: basename(path),
      directory: dirname(path),
      language: typeof content === 'string' ? this.detectLanguage(path, content) : 'unknown',
      analysis: undefined,
      codeAnalysis: undefined,
    };

    // Content analysis
    if (typeof content === 'string') {
      metadata.analysis = {
        lineCount: content.split('\n').length,
        characterCount: content.length,
        wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
        isEmpty: content.trim().length === 0,
      };

      // Code-specific analysis
      if (this.isCodeFile(path)) {
        metadata.codeAnalysis = this.analyzeCode(content, metadata.language);
      }
    }

    return {
      ...item,
      metadata,
      enhanced: true,
    };
  }

  private detectLanguage(path: string, _content: string): string {
    const ext = extname(path).toLowerCase();

    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.rb': 'ruby',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.sh': 'bash',
      '.ps1': 'powershell',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.txt': 'text',
    };

    return languageMap[ext] || 'unknown';
  }

  private isCodeFile(path: string): boolean {
    const codeExtensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.rb',
      '.java',
      '.c',
      '.cpp',
      '.cs',
      '.php',
      '.go',
      '.rs',
      '.swift',
      '.kt',
      '.scala',
      '.sh',
    ];

    const ext = extname(path).toLowerCase();
    return codeExtensions.includes(ext);
  }

  private analyzeCode(content: string, language: string): CodeAnalysisResult {
    const analysis: CodeAnalysisResult = {
      functions: [],
      classes: [],
      imports: [],
      comments: { single: 0, multi: 0, total: 0 },
      complexity: 'unknown',
    };

    try {
      // Simple pattern-based analysis (would use proper parsers in production)
      switch (language) {
        case 'javascript':
        case 'typescript':
          analysis.functions = this.extractJSFunctions(content);
          analysis.classes = this.extractJSClasses(content);
          analysis.imports = this.extractJSImports(content);
          break;
        case 'python':
          analysis.functions = this.extractPythonFunctions(content);
          analysis.classes = this.extractPythonClasses(content);
          analysis.imports = this.extractPythonImports(content);
          break;
        default:
          analysis.note = `Code analysis not implemented for ${language}`;
      }

      // Count comments
      analysis.comments = this.countComments(content, language);
    } catch (error) {
      analysis.error = `Failed to analyze code: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return analysis;
  }

  private extractJSFunctions(content: string): string[] {
    const patterns = [
      /function\s+(\w+)\s*\(/g,
      /const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/g,
      /(\w+)\s*:\s*(?:async\s+)?(?:function\s*)?(?:\([^)]*\)|\w+)\s*=>/g,
    ];

    const functions: string[] = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        functions.push(match[1]);
      }
    }

    return [...new Set(functions)];
  }

  private extractJSClasses(content: string): string[] {
    const pattern = /class\s+(\w+)/g;
    const classes: string[] = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
      classes.push(match[1]);
    }

    return classes;
  }

  private extractJSImports(content: string): string[] {
    const patterns = [
      /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    const imports: string[] = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    return [...new Set(imports)];
  }

  private extractPythonFunctions(content: string): string[] {
    const pattern = /def\s+(\w+)\s*\(/g;
    const functions: string[] = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
      functions.push(match[1]);
    }

    return functions;
  }

  private extractPythonClasses(content: string): string[] {
    const pattern = /class\s+(\w+)/g;
    const classes: string[] = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
      classes.push(match[1]);
    }

    return classes;
  }

  private extractPythonImports(content: string): string[] {
    const patterns = [/import\s+([\w.]+)/g, /from\s+([\w.]+)\s+import/g];

    const imports: string[] = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    return [...new Set(imports)];
  }

  private countComments(
    content: string,
    language: string
  ): { single: number; multi: number; total: number } {
    const result = { single: 0, multi: 0, total: 0 };

    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
        case 'java':
        case 'c':
        case 'cpp':
          result.single = (content.match(/\/\/.*$/gm) ?? []).length;
          result.multi = (content.match(/\/\*[\s\S]*?\*\//g) ?? []).length;
          break;
        case 'python':
        case 'bash':
          result.single = (content.match(/#.*$/gm) ?? []).length;
          result.multi = (content.match(/'''[\s\S]*?'''|"""[\s\S]*?"""/g) ?? []).length;
          break;
        case 'html':
        case 'xml':
          result.multi = (content.match(/<!--[\s\S]*?-->/g) ?? []).length;
          break;
        default:
          // No comment patterns for other languages
          break;
      }

      result.total = result.single + result.multi;
    } catch (error) {
      // Ignore comment counting errors
    }

    return result;
  }
}

// ============================================================================
// UNIFIED FILE TOOL - Main tool implementation
// ============================================================================
// Types for metadata
// ============================================================================

interface CodeAnalysisResult {
  functions: string[];
  classes: string[];
  imports: string[];
  comments: { single: number; multi: number; total: number };
  complexity: string;
  note?: string;
  error?: string;
}

interface FileMetadata {
  fileSize: number;
  fileExtension: string;
  fileName: string;
  directory: string;
  language: string;
  analysis?: {
    lineCount: number;
    characterCount: number;
    wordCount: number;
    isEmpty: boolean;
  };
  codeAnalysis?: CodeAnalysisResult;
}

// ============================================================================
// UNIFIED FILE TOOL - Main tool implementation
// ============================================================================

export class UnifiedFileTool extends BaseTool {
  private readonly strategies: Map<string, FileOperationStrategy> = new Map();

  public constructor(context?: Readonly<{ workingDirectory?: string }>) {
    const workingDirectory = context?.workingDirectory ?? process.cwd();

    // Define comprehensive parameter schema
    const parameters: ToolParameterSchema = {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'File operation to perform',
          enum: ['read', 'write', 'exists', 'stat', 'list', 'delete', 'copy', 'move'],
          default: 'read',
        },
        path: {
          type: 'string',
          description: 'File path (single file or glob pattern)',
        },
        paths: {
          type: 'array',
          description: 'Multiple file paths (alternative to path)',
        },
        content: {
          type: 'string',
          description: 'Content to write (for write operations)',
        },
        encoding: {
          type: 'string',
          description: 'File encoding',
          enum: ['utf8', 'utf-8', 'ascii', 'base64', 'binary'],
          default: 'utf8',
        },
        maxSize: {
          type: 'number',
          description: 'Maximum file size in bytes',
          default: 1000000,
        },
        maxFiles: {
          type: 'number',
          description: 'Maximum number of files to process',
          default: 20,
        },
        includeMetadata: {
          type: 'boolean',
          description: 'Include file metadata and analysis',
          default: true,
        },
        continueOnError: {
          type: 'boolean',
          description: 'Continue processing other files if one fails',
          default: true,
        },
        excludePatterns: {
          type: 'array',
          description: 'Patterns to exclude when using globs',
          default: ['node_modules/**', '.git/**', '*.log'],
        },
        recursive: {
          type: 'boolean',
          description: 'Process directories recursively',
          default: false,
        },
        followSymlinks: {
          type: 'boolean',
          description: 'Follow symbolic links',
          default: false,
        },
      },
      required: ['operation'],
    };

    super({
      name: 'Unified File Tool',
      description:
        'Comprehensive file operations with configurable behavior - replaces 6 different file tool implementations',
      category: 'file',
      parameters,
      securityLevel: 'restricted',
      permissions: [
        { type: 'read', resource: workingDirectory, scope: 'directory' },
        { type: 'write', resource: workingDirectory, scope: 'directory' },
      ],
    });

    // Register strategies
    this.strategies.set('basic', new BasicFileStrategy());
    this.strategies.set('batch', new BatchFileStrategy());
    this.strategies.set('smart', new SmartFileStrategy());
  }

  public async execute(
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      // Select appropriate strategy
      const strategy = this.selectStrategy(args);

      // Execute with selected strategy
      const operation = typeof args.operation === 'string' ? args.operation : 'read';
      const result = await strategy.execute(operation, args, context);

      return {
        success: true,
        result,
        metadata: {
          strategy: strategy.name,
          operation,
          timestamp: new Date().toISOString(),
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'file_operation_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? { stack: error.stack } : undefined,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private selectStrategy(args: Readonly<Record<string, unknown>>): FileOperationStrategy {
    // Strategy selection logic based on arguments

    // Use smart strategy if metadata is requested
    const includeMetadata = typeof args.includeMetadata === 'boolean' ? args.includeMetadata : true;
    if (includeMetadata) {
      const smartStrategy = this.strategies.get('smart');
      if (
        smartStrategy &&
        smartStrategy.supports(typeof args.operation === 'string' ? args.operation : 'read', args)
      ) {
        return smartStrategy;
      }
    }

    // Use batch strategy for multiple files or patterns
    const hasPathsArray = Array.isArray(args.paths);
    const hasGlobPath = typeof args.path === 'string' && args.path.includes('*');
    if (hasPathsArray || hasGlobPath) {
      const batchStrategy = this.strategies.get('batch');
      if (
        batchStrategy &&
        batchStrategy.supports(typeof args.operation === 'string' ? args.operation : 'read', args)
      ) {
        return batchStrategy;
      }
    }

    // Default to basic strategy
    const basicStrategy = this.strategies.get('basic');
    if (!basicStrategy) {
      throw new Error('Basic file strategy is not available');
    }
    return basicStrategy;
  }

  /**
   * Add or replace a strategy
   */
  public addStrategy(strategy: Readonly<FileOperationStrategy>): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get available strategies
   */
  public getStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}
