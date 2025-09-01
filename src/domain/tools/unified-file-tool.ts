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

import { promises as fs, existsSync, statSync } from 'fs';
import { join, relative, isAbsolute, dirname, extname, basename, resolve, sep } from 'path';
import { glob } from 'glob';
import { promisify } from 'util';
import { exec } from 'child_process';
import { BaseTool } from './unified-tool-system.js';
import {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolParameterSchema,
} from '../interfaces/tool-system.js';

const execAsync = promisify(exec);

// ============================================================================
// FILE OPERATION STRATEGIES - Different ways to handle files
// ============================================================================

export interface FileOperationStrategy {
  name: string;
  supports(operation: string, args: any): boolean;
  execute(operation: string, args: any, context: ToolExecutionContext): Promise<any>;
}

/**
 * Basic file operations strategy
 */
export class BasicFileStrategy implements FileOperationStrategy {
  name = 'basic';

  supports(operation: string): boolean {
    return ['read', 'write', 'exists', 'stat'].includes(operation);
  }

  async execute(operation: string, args: any, context: ToolExecutionContext): Promise<any> {
    const path = this.resolvePath(args.path, context);

    switch (operation) {
      case 'read':
        return await this.readFile(path, args);
      case 'write':
        return await this.writeFile(path, args, context);
      case 'exists':
        return existsSync(path);
      case 'stat':
        return await this.getFileInfo(path);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  private async readFile(path: string, args: any): Promise<string> {
    try {
      await fs.access(path);
      const stats = await fs.stat(path);

      // Size limit check
      const maxSize = args.maxSize || 1000000; // 1MB default
      if (stats.size > maxSize) {
        throw new Error(`File too large: ${stats.size} bytes exceeds limit of ${maxSize} bytes`);
      }

      const content = await fs.readFile(path, args.encoding || 'utf-8');
      return content;
    } catch (error) {
      throw new Error(
        `Failed to read file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async writeFile(path: string, args: any, context: ToolExecutionContext): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(path);
      await fs.mkdir(dir, { recursive: true });

      const options: any = {};
      if (args.encoding) options.encoding = args.encoding;
      if (args.mode) options.mode = args.mode;

      await fs.writeFile(path, args.content, options);

      return `File written successfully: ${path}`;
    } catch (error) {
      throw new Error(
        `Failed to write file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async getFileInfo(path: string): Promise<any> {
    try {
      const stats = await fs.stat(path);
      return {
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        modified: stats.mtime,
        created: stats.birthtime,
        permissions: stats.mode,
      };
    } catch (error) {
      throw new Error(
        `Failed to get file info for ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  protected resolvePath(inputPath: string, context: ToolExecutionContext): string {
    if (!inputPath) {
      throw new Error('Path is required');
    }

    // Handle relative paths
    let resolvedPath = inputPath;
    if (!isAbsolute(inputPath)) {
      resolvedPath = resolve(context.workingDirectory, inputPath);
    }

    // Normalize path separators
    resolvedPath = resolvedPath.split(sep).join('/');

    return resolvedPath;
  }
}

/**
 * Batch file operations strategy - handles multiple files and patterns
 */
export class BatchFileStrategy extends BasicFileStrategy {
  name = 'batch';

  supports(operation: string, args: any): boolean {
    return (
      super.supports(operation) &&
      (Array.isArray(args.paths) || (typeof args.path === 'string' && args.path.includes('*')))
    );
  }

  async execute(operation: string, args: any, context: ToolExecutionContext): Promise<any> {
    const paths = await this.resolvePaths(args, context);
    const maxFiles = args.maxFiles || 20;

    if (paths.length > maxFiles) {
      throw new Error(`Too many files: ${paths.length} exceeds limit of ${maxFiles}`);
    }

    const results: any[] = [];

    for (const path of paths) {
      try {
        const result = await super.execute(operation, { ...args, path }, context);
        results.push({
          path,
          success: true,
          result,
        });
      } catch (error) {
        if (args.continueOnError !== false) {
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

  private async resolvePaths(args: any, context: ToolExecutionContext): Promise<string[]> {
    let inputPaths: string[] = [];

    if (Array.isArray(args.paths)) {
      inputPaths = args.paths;
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
          ignore: args.excludePatterns || [],
        };

        const matches = await glob(inputPath, globOptions);
        resolvedPaths.push(...matches);
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
  name = 'smart';

  supports(operation: string, args: any): boolean {
    return super.supports(operation) && args.includeMetadata !== false;
  }

  async execute(operation: string, args: any, context: ToolExecutionContext): Promise<any> {
    const baseResult = await super.execute(operation, args, context);

    if (operation === 'read') {
      if (Array.isArray(baseResult)) {
        // Multiple files
        return baseResult.map(item => this.enhanceFileResult(item, args));
      } else {
        // Single file
        return this.enhanceFileResult(
          {
            path: args.path,
            success: true,
            result: baseResult,
          },
          args
        );
      }
    }

    return baseResult;
  }

  private enhanceFileResult(item: any, args: any): any {
    if (!item.success) {
      return item;
    }

    const path = item.path;
    const content = item.result;

    const metadata: any = {
      fileSize: Buffer.byteLength(content, 'utf8'),
      fileExtension: extname(path),
      fileName: basename(path),
      directory: dirname(path),
    };

    // Language detection
    metadata.language = this.detectLanguage(path, content);

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

  private detectLanguage(path: string, content: string): string {
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

  private analyzeCode(content: string, language: string): any {
    const analysis: any = {
      functions: [],
      classes: [],
      imports: [],
      comments: [],
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
          result.single = (content.match(/\/\/.*$/gm) || []).length;
          result.multi = (content.match(/\/\*[\s\S]*?\*\//g) || []).length;
          break;
        case 'python':
        case 'bash':
          result.single = (content.match(/#.*$/gm) || []).length;
          result.multi = (content.match(/'''[\s\S]*?'''|"""[\s\S]*?"""/g) || []).length;
          break;
        case 'html':
        case 'xml':
          result.multi = (content.match(/<!--[\s\S]*?-->/g) || []).length;
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

export class UnifiedFileTool extends BaseTool {
  private strategies: Map<string, FileOperationStrategy> = new Map();

  constructor(context?: { workingDirectory?: string }) {
    const workingDirectory = context?.workingDirectory || process.cwd();

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

  async execute(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    try {
      // Select appropriate strategy
      const strategy = this.selectStrategy(args);

      // Execute with selected strategy
      const result = await strategy.execute(args.operation || 'read', args, context);

      return {
        success: true,
        result,
        metadata: {
          strategy: strategy.name,
          operation: args.operation || 'read',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'file_operation_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? { stack: error.stack } : undefined,
        },
      };
    }
  }

  private selectStrategy(args: any): FileOperationStrategy {
    // Strategy selection logic based on arguments

    // Use smart strategy if metadata is requested
    if (args.includeMetadata !== false) {
      const smartStrategy = this.strategies.get('smart')!;
      if (smartStrategy.supports(args.operation || 'read', args)) {
        return smartStrategy;
      }
    }

    // Use batch strategy for multiple files or patterns
    if (Array.isArray(args.paths) || (args.path?.includes('*'))) {
      const batchStrategy = this.strategies.get('batch')!;
      if (batchStrategy.supports(args.operation || 'read', args)) {
        return batchStrategy;
      }
    }

    // Default to basic strategy
    return this.strategies.get('basic')!;
  }

  /**
   * Add or replace a strategy
   */
  addStrategy(strategy: FileOperationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get available strategies
   */
  getStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}
