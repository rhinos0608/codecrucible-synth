import { z } from 'zod';
import { BaseTool } from './base-tool';
import { isAbsolute, join, relative } from 'path';
// Cache for import results to prevent circular dependency issues
const importCache = new Map<string, unknown>();

// Function to dynamically import eslint with enhanced error handling
async function tryImportESLint(): Promise<unknown> {
  const cacheKey = 'eslint';

  if (importCache.has(cacheKey)) {
    const cached = importCache.get(cacheKey);
    if (cached === 'loading') {
      return null;
    }
    return cached;
  }

  try {
    // Set loading state to prevent circular imports
    importCache.set(cacheKey, 'loading');

    const eslintModule = await import('eslint');

    // Validate that ESLint was imported correctly
    if (!('ESLint' in eslintModule)) {
      throw new Error('ESLint module imported but ESLint class not found');
    }

    const { ESLint } = eslintModule;

    // Cache the successful result
    importCache.set(cacheKey, ESLint);
    return ESLint;
  } catch (error) {
    // Cache the failure to prevent repeated attempts
    importCache.set(cacheKey, null);

    // Provide specific error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('Cannot find module')) {
        console.warn('ESLint is not installed. Install with: npm install eslint');
      } else if (error.message.includes('circular dependency')) {
        console.warn('Circular dependency detected when importing ESLint');
      } else if (error.message.includes('dynamic import')) {
        console.warn('Dynamic import not supported in this environment for ESLint');
      } else {
        console.warn(`Failed to import ESLint: ${error.message}`);
      }
    } else {
      console.warn('Failed to import ESLint: Unknown error type');
    }

    return null;
  }
}

// Function to dynamically import typescript with enhanced error handling
async function tryImportTypeScript(): Promise<typeof import('typescript') | null> {
  const cacheKey = 'typescript';

  if (importCache.has(cacheKey)) {
    const cached = importCache.get(cacheKey);
    return cached === 'loading' ? null : (cached as typeof import('typescript') | null);
  }

  try {
    // Set loading state to prevent circular imports
    importCache.set(cacheKey, 'loading');

    const tsModule = await import('typescript');

    // Validate that TypeScript was imported correctly
    if (!tsModule.createProgram) {
      throw new Error('TypeScript module imported but createProgram function not found');
    }

    // Cache the successful result
    importCache.set(cacheKey, tsModule);
    return tsModule;
  } catch (error) {
    // Cache the failure to prevent repeated attempts
    importCache.set(cacheKey, null);

    // Provide specific error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('Cannot find module')) {
        console.warn('TypeScript is not installed. Install with: npm install typescript');
      } else if (error.message.includes('circular dependency')) {
        console.warn('Circular dependency detected when importing TypeScript');
      } else if (error.message.includes('dynamic import')) {
        console.warn('Dynamic import not supported in this environment for TypeScript');
      } else if (error.message.includes('createProgram function not found')) {
        console.warn('Invalid TypeScript module: missing required API functions');
      } else {
        console.warn(`Failed to import TypeScript: ${error.message}`);
      }
    } else {
      console.warn('Failed to import TypeScript: Unknown error type');
    }

    return null;
  }
}

const LintCodeSchema = z.object({
  path: z.string().describe('The path to the file to lint.'),
});

export class LintCodeTool extends BaseTool<typeof LintCodeSchema.shape> {
  private eslint: unknown;
  private eslintAvailable: boolean;

  public constructor(private readonly agentContext: { readonly workingDirectory: string }) {
    super({
      name: 'lintCode',
      description: 'Lints a code file and returns the linting errors.',
      category: 'Code Analysis',
      parameters: LintCodeSchema,
    });

    this.eslintAvailable = false;
    this.eslint = null;

    // Initialize eslint asynchronously
    void this.initializeESLint();
  }

  private async initializeESLint(): Promise<void> {
    const ESLint = await tryImportESLint();
    if (ESLint && typeof ESLint === 'function') {
      this.eslintAvailable = true;
      // TypeScript cannot know the type of ESLint here, so we use 'unknown'
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.eslint = new (ESLint as new (options: { cwd: string }) => unknown)({
        cwd: this.agentContext.workingDirectory,
      });
    }
  }

  public async execute(args: Readonly<z.infer<typeof LintCodeSchema>>): Promise<
    Array<{
      filePath: string;
      messages: Array<{
        ruleId: string | null;
        severity: number;
        message: string;
        line: number;
        column: number;
      }>;
      errorCount: number;
      warningCount: number;
      fixableErrorCount: number;
      fixableWarningCount: number;
      source: string;
      usedDeprecatedRules: unknown[];
    }>
  > {
    // Log the received arguments for debugging
    console.log('LintCodeTool received args:', JSON.stringify(args, null, 2));

    if (!args.path || args.path.trim() === '') {
      return [
        {
          filePath: args.path || 'undefined',
          messages: [
            {
              ruleId: null,
              severity: 2,
              message: `Path parameter is required for lintCode tool. Received args: ${JSON.stringify(
                args
              )}`,
              line: 1,
              column: 1,
            },
          ],
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          source: '',
          usedDeprecatedRules: [],
        },
      ];
    }

    if (!this.eslintAvailable) {
      return [
        {
          filePath: args.path,
          messages: [
            {
              ruleId: null,
              severity: 1,
              message:
                'ESLint not available in this environment. Install eslint package for linting functionality.',
              line: 1,
              column: 1,
            },
          ],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          source: '',
          usedDeprecatedRules: [],
        },
      ];
    }

    const fullPath = this.resolvePath(args.path);

    // Check if file exists before trying to lint
    try {
      const { access } = await import('fs/promises');
      await access(fullPath);
    } catch (error) {
      return [
        {
          filePath: args.path,
          messages: [
            {
              ruleId: null,
              severity: 2,
              message: `File not found at path '${args.path}' (resolved to '${fullPath}'). Please verify the file exists.`,
              line: 1,
              column: 1,
            },
          ],
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          source: '',
          usedDeprecatedRules: [],
        },
      ];
    }

    try {
      // eslint is of type unknown, so we need to assert its type
      interface ESLintType {
        lintFiles: (files: readonly string[]) => Promise<
          Array<{
            filePath: string;
            messages: Array<{
              ruleId: string | null;
              severity: number;
              message: string;
              line: number;
              column: number;
            }>;
            errorCount: number;
            warningCount: number;
            fixableErrorCount: number;
            fixableWarningCount: number;
            source: string;
            usedDeprecatedRules: unknown[];
          }>
        >;
      }
      const eslintInstance = this.eslint as ESLintType;
      return await eslintInstance.lintFiles([fullPath]);
    } catch (error) {
      return [
        {
          filePath: args.path,
          messages: [
            {
              ruleId: null,
              severity: 2,
              message: `Error linting file '${args.path}': ${error instanceof Error ? error.message : 'Unknown error'}`,
              line: 1,
              column: 1,
            },
          ],
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          source: '',
          usedDeprecatedRules: [],
        },
      ];
    }
  }

  private resolvePath(path: string): string {
    // Convert to relative path to comply with MCP workspace restrictions
    let resolvedPath = path;

    // If path is absolute, convert to relative to working directory
    if (isAbsolute(path)) {
      try {
        resolvedPath = relative(this.agentContext.workingDirectory, path);
        // If relative path starts with '..' it's outside working directory
        if (resolvedPath.startsWith('..')) {
          throw new Error(`Path ${path} is outside working directory`);
        }
      } catch (error) {
        // Fallback to using the path as-is but log the issue
        console.warn(
          `⚠️  Path conversion warning: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        resolvedPath = path;
      }
    }

    // Join with working directory to ensure proper resolution
    return join(this.agentContext.workingDirectory, resolvedPath);
  }
}

const GetAstSchema = z.object({
  path: z.string().describe('The path to the file to get the AST for.'),
});

export class GetAstTool extends BaseTool<typeof GetAstSchema.shape> {
  private ts: typeof import('typescript') | null;
  private tsAvailable: boolean;

  public constructor(private readonly agentContext: Readonly<{ workingDirectory: string }>) {
    super({
      name: 'getAst',
      description: 'Gets the Abstract Syntax Tree (AST) of a TypeScript file.',
      category: 'Code Analysis',
      parameters: GetAstSchema,
    });

    this.tsAvailable = false;
    this.ts = null;

    // Initialize typescript asynchronously
    void this.initializeTypeScript();
  }

  private async initializeTypeScript(): Promise<void> {
    const ts = await tryImportTypeScript();
    if (ts) {
      this.tsAvailable = true;
      this.ts = ts;
    }
  }

  public async execute(args: Readonly<z.infer<typeof GetAstSchema>>): Promise<{
    error?: string;
    fileName: string;
    kind: string;
    text: string;
    statements: Array<{ kind: string; start: number; end: number }>;
    childCount: number;
    fullStart: number;
    start: number;
    end: number;
  }> {
    // Log the received arguments for debugging
    console.log('GetAstTool received args:', JSON.stringify(args, null, 2));

    if (!args.path || args.path.trim() === '') {
      return {
        error: `Path parameter is required for getAst tool. Received args: ${JSON.stringify(args)}`,
        fileName: args.path || 'undefined',
        kind: 'InvalidInput',
        text: 'Invalid or missing path parameter',
        statements: [],
        childCount: 0,
        fullStart: 0,
        start: 0,
        end: 0,
      };
    }

    if (!this.tsAvailable) {
      return {
        error:
          'TypeScript not available in this environment. Install typescript package for AST functionality.',
        fileName: args.path,
        kind: 'NotAvailable',
        text: 'TypeScript compiler not available',
        statements: [],
        childCount: 0,
        fullStart: 0,
        start: 0,
        end: 0,
      };
    }

    const fullPath = this.resolvePath(args.path);

    // Check if file exists before trying to analyze
    try {
      const { access } = await import('fs/promises');
      await access(fullPath);
    } catch (error) {
      return {
        error: `File not found at path '${args.path}' (resolved to '${fullPath}'). Please verify the file exists.`,
        fileName: args.path,
        kind: 'FileNotFound',
        text: 'File does not exist',
        statements: [],
        childCount: 0,
        fullStart: 0,
        start: 0,
        end: 0,
      };
    }

    try {
      if (!this.ts) {
        return {
          error: `TypeScript API is not available.`,
          fileName: args.path,
          kind: 'NotAvailable',
          text: 'TypeScript compiler not available',
          statements: [],
          childCount: 0,
          fullStart: 0,
          start: 0,
          end: 0,
        };
      }
      const program = this.ts.createProgram([fullPath], { allowJs: true });
      const sourceFile = program.getSourceFile(fullPath);
      if (!sourceFile) {
        return {
          error: `TypeScript could not parse source file: ${fullPath}`,
          fileName: args.path,
          kind: 'ParseError',
          text: 'Unable to parse file as TypeScript/JavaScript',
          statements: [],
          childCount: 0,
          fullStart: 0,
          start: 0,
          end: 0,
        };
      }

      // Convert AST to serializable format
      if (!sourceFile || !this.ts) {
        return {
          error: `TypeScript could not parse source file or TypeScript API not available.`,
          fileName: args.path,
          kind: 'ParseError',
          text: 'Unable to parse file as TypeScript/JavaScript',
          statements: [],
          childCount: 0,
          fullStart: 0,
          start: 0,
          end: 0,
        };
      }

      const astSummary = {
        fileName: sourceFile.fileName,
        kind: this.ts.SyntaxKind[sourceFile.kind],
        text: sourceFile.text.slice(0, 500) + (sourceFile.text.length > 500 ? '...' : ''),
        statements:
          Array.isArray(sourceFile.statements) && this.ts
            ? sourceFile.statements
                .map((stmt: import('typescript').Node) => ({
                  kind: this.ts ? this.ts.SyntaxKind[stmt.kind] : 'Unknown',
                  start: typeof stmt.getStart === 'function' ? stmt.getStart() : 0,
                  end: typeof stmt.getEnd === 'function' ? stmt.getEnd() : 0,
                }))
                .slice(0, 10)
            : [],
        childCount: typeof sourceFile.getChildCount === 'function' ? sourceFile.getChildCount() : 0,
        fullStart: typeof sourceFile.getFullStart === 'function' ? sourceFile.getFullStart() : 0,
        start: typeof sourceFile.getStart === 'function' ? sourceFile.getStart() : 0,
        end: typeof sourceFile.getEnd === 'function' ? sourceFile.getEnd() : 0,
      };

      return astSummary;
    } catch (error) {
      return {
        error: `Error analyzing file '${args.path}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        fileName: args.path,
        kind: 'AnalysisError',
        text: 'Error during TypeScript analysis',
        statements: [],
        childCount: 0,
        fullStart: 0,
        start: 0,
        end: 0,
      };
    }
  }

  private resolvePath(path: string): string {
    // Convert to relative path to comply with MCP workspace restrictions
    let resolvedPath = path;

    // If path is absolute, convert to relative to working directory
    if (isAbsolute(path)) {
      try {
        resolvedPath = relative(this.agentContext.workingDirectory, path);
        // If relative path starts with '..' it's outside working directory
        if (resolvedPath.startsWith('..')) {
          throw new Error(`Path ${path} is outside working directory`);
        }
      } catch (error) {
        // Fallback to using the path as-is but log the issue
        console.warn(
          `⚠️  Path conversion warning: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        resolvedPath = path;
      }
    }

    // Join with working directory to ensure proper resolution
    return join(this.agentContext.workingDirectory, resolvedPath);
  }
}
