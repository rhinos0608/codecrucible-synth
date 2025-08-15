
import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { ESLint } from 'eslint';
import { join } from 'path';
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
    const fullPath = join(this.agentContext.workingDirectory, args.path);
    return await this.eslint.lintFiles([fullPath]);
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

  async execute(args: z.infer<typeof GetAstSchema>): Promise<ts.Node> {
    const fullPath = join(this.agentContext.workingDirectory, args.path);
    const program = ts.createProgram([fullPath], { allowJs: true });
    const sourceFile = program.getSourceFile(fullPath);
    if (!sourceFile) {
      throw new Error(`Could not find source file: ${fullPath}`);
    }
    return sourceFile;
  }
}
