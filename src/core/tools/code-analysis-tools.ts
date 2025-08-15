
import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { ESLint } from 'eslint';
import { join, relative, isAbsolute } from 'path';
import * as ts from 'typescript';

const LintCodeSchema = z.object({
  path: z.string().describe('The path to the file to lint.'),
});

export class LintCodeTool extends BaseTool {
  private eslint: ESLint;

  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'lintCode',
      description: 'Lints a code file and returns the linting errors.',
      category: 'Code Analysis',
      parameters: LintCodeSchema,
    });
    this.eslint = new ESLint({ cwd: this.agentContext.workingDirectory });
  }

  async execute(args: z.infer<typeof LintCodeSchema>): Promise<ESLint.LintResult[]> {
    if (!args.path) {
      throw new Error('Path parameter is required for lintCode tool');
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
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'getAst',
      description: 'Gets the Abstract Syntax Tree (AST) of a TypeScript file.',
      category: 'Code Analysis',
      parameters: GetAstSchema,
    });
  }

  async execute(args: z.infer<typeof GetAstSchema>): Promise<any> {
    if (!args.path) {
      throw new Error('Path parameter is required for getAst tool');
    }
    const fullPath = this.resolvePath(args.path);
    const program = ts.createProgram([fullPath], { allowJs: true });
    const sourceFile = program.getSourceFile(fullPath);
    if (!sourceFile) {
      throw new Error(`Could not find source file: ${fullPath}`);
    }
    
    // Convert AST to serializable format
    const astSummary = {
      fileName: sourceFile.fileName,
      kind: ts.SyntaxKind[sourceFile.kind],
      text: sourceFile.text.slice(0, 500) + (sourceFile.text.length > 500 ? '...' : ''),
      statements: sourceFile.statements.map(stmt => ({
        kind: ts.SyntaxKind[stmt.kind],
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
