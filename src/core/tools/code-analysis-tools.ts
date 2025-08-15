
import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { join, relative, isAbsolute } from 'path';
// Function to dynamically import eslint
async function tryImportESLint(): Promise<any> {
  try {
    const eslintModule = await import('eslint');
    return eslintModule.ESLint;
  } catch (error) {
    return null;
  }
}

// Function to dynamically import typescript
async function tryImportTypeScript(): Promise<any> {
  try {
    const tsModule = await import('typescript');
    return tsModule;
  } catch (error) {
    return null;
  }
}

const LintCodeSchema = z.object({
  path: z.string().describe('The path to the file to lint.'),
});

export class LintCodeTool extends BaseTool {
  private eslint: any;
  private eslintAvailable: boolean;

  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'lintCode',
      description: 'Lints a code file and returns the linting errors.',
      category: 'Code Analysis',
      parameters: LintCodeSchema,
    });
    
    this.eslintAvailable = false;
    this.eslint = null;
    
    // Initialize eslint asynchronously
    this.initializeESLint();
  }
  
  private async initializeESLint(): Promise<void> {
    const ESLint = await tryImportESLint();
    if (ESLint) {
      this.eslintAvailable = true;
      this.eslint = new ESLint({ cwd: this.agentContext.workingDirectory });
    }
  }

  async execute(args: z.infer<typeof LintCodeSchema>): Promise<any[]> {
    // Log the received arguments for debugging
    console.log('LintCodeTool received args:', JSON.stringify(args, null, 2));
    
    if (!args || !args.path || args.path.trim() === '') {
      return [{
        filePath: args?.path || 'undefined',
        messages: [{
          ruleId: null,
          severity: 2,
          message: 'Path parameter is required for lintCode tool. Received args: ' + JSON.stringify(args),
          line: 1,
          column: 1
        }],
        errorCount: 1,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        source: '',
        usedDeprecatedRules: []
      }];
    }
    
    if (!this.eslintAvailable) {
      return [{
        filePath: args.path,
        messages: [{
          ruleId: null,
          severity: 1,
          message: 'ESLint not available in this environment. Install eslint package for linting functionality.',
          line: 1,
          column: 1
        }],
        errorCount: 0,
        warningCount: 1,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        source: '',
        usedDeprecatedRules: []
      }];
    }
    
    const fullPath = this.resolvePath(args.path);
    return await this.eslint.lintFiles([fullPath]);
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
        console.warn(`⚠️  Path conversion warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

export class GetAstTool extends BaseTool {
  private ts: any;
  private tsAvailable: boolean;

  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'getAst',
      description: 'Gets the Abstract Syntax Tree (AST) of a TypeScript file.',
      category: 'Code Analysis',
      parameters: GetAstSchema,
    });
    
    this.tsAvailable = false;
    this.ts = null;
    
    // Initialize typescript asynchronously
    this.initializeTypeScript();
  }
  
  private async initializeTypeScript(): Promise<void> {
    const ts = await tryImportTypeScript();
    if (ts) {
      this.tsAvailable = true;
      this.ts = ts;
    }
  }

  async execute(args: z.infer<typeof GetAstSchema>): Promise<any> {
    // Log the received arguments for debugging
    console.log('GetAstTool received args:', JSON.stringify(args, null, 2));
    
    if (!args || !args.path || args.path.trim() === '') {
      return {
        error: 'Path parameter is required for getAst tool. Received args: ' + JSON.stringify(args),
        fileName: args?.path || 'undefined',
        kind: 'InvalidInput',
        text: 'Invalid or missing path parameter',
        statements: [],
        childCount: 0,
        fullStart: 0,
        start: 0,
        end: 0
      };
    }
    
    if (!this.tsAvailable) {
      return {
        error: 'TypeScript not available in this environment. Install typescript package for AST functionality.',
        fileName: args.path,
        kind: 'NotAvailable',
        text: 'TypeScript compiler not available',
        statements: [],
        childCount: 0,
        fullStart: 0,
        start: 0,
        end: 0
      };
    }
    
    const fullPath = this.resolvePath(args.path);
    const program = this.ts.createProgram([fullPath], { allowJs: true });
    const sourceFile = program.getSourceFile(fullPath);
    if (!sourceFile) {
      throw new Error(`Could not find source file: ${fullPath}`);
    }
    
    // Convert AST to serializable format
    const astSummary = {
      fileName: sourceFile.fileName,
      kind: this.ts.SyntaxKind[sourceFile.kind],
      text: sourceFile.text.slice(0, 500) + (sourceFile.text.length > 500 ? '...' : ''),
      statements: sourceFile.statements.map((stmt: any) => ({
        kind: this.ts.SyntaxKind[stmt.kind],
        start: stmt.getStart(),
        end: stmt.getEnd()
      })).slice(0, 10), // Limit to first 10 statements
      childCount: sourceFile.getChildCount(),
      fullStart: sourceFile.getFullStart(),
      start: sourceFile.getStart(),
      end: sourceFile.getEnd()
    };
    
    return astSummary;
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
        console.warn(`⚠️  Path conversion warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
        resolvedPath = path;
      }
    }
    
    // Join with working directory to ensure proper resolution
    return join(this.agentContext.workingDirectory, resolvedPath);
  }
}
