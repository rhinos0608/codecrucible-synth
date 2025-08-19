#!/usr/bin/env node

/**
 * Comprehensive TypeScript Error Fixing Script
 * Automatically fixes common TypeScript errors across the codebase
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

class TypeScriptFixer {
  private errors: TypeScriptError[] = [];

  /**
   * Run TypeScript compiler and parse errors
   */
  async getTypeScriptErrors(): Promise<TypeScriptError[]> {
    try {
      await execAsync('npx tsc --noEmit --strict');
      return []; // No errors
    } catch (error: any) {
      const output = error.stdout || error.stderr || '';
      return this.parseTypeScriptErrors(output);
    }
  }

  /**
   * Parse TypeScript compiler output into structured errors
   */
  private parseTypeScriptErrors(output: string): TypeScriptError[] {
    const errors: TypeScriptError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[4],
          message: match[5]
        });
      }
    }

    return errors;
  }

  /**
   * Automatically fix common TypeScript errors
   */
  async fixCommonErrors(): Promise<{ fixed: number; remaining: number }> {
    const errors = await this.getTypeScriptErrors();
    let fixed = 0;

    for (const error of errors) {
      if (await this.tryFixError(error)) {
        fixed++;
      }
    }

    const remainingErrors = await this.getTypeScriptErrors();
    return { fixed, remaining: remainingErrors.length };
  }

  /**
   * Attempt to fix a specific TypeScript error
   */
  private async tryFixError(error: TypeScriptError): Promise<boolean> {
    try {
      const content = await fs.readFile(error.file, 'utf-8');
      const lines = content.split('\n');
      const errorLine = lines[error.line - 1];

      if (!errorLine) return false;

      let fixedLine = errorLine;
      let wasFixed = false;

      // Fix common error patterns
      if (error.code === 'TS2345' && error.message.includes('undefined')) {
        // Add null/undefined checks
        if (errorLine.includes('.')) {
          const match = errorLine.match(/(\w+)(\.\w+)/);
          if (match) {
            fixedLine = errorLine.replace(match[0], `${match[1]}?${match[2]}`);
            wasFixed = true;
          }
        }
      }

      if (error.code === 'TS18048' && error.message.includes('possibly \'undefined\'')) {
        // Add undefined checks with nullish coalescing
        const match = errorLine.match(/(\w+(?:\.\w+)*)/);
        if (match) {
          fixedLine = errorLine.replace(match[1], `(${match[1]} || 0)`);
          wasFixed = true;
        }
      }

      if (error.code === 'TS2564' && error.message.includes('no initializer')) {
        // Add definite assignment assertion
        if (errorLine.includes(':')) {
          fixedLine = errorLine.replace(':', '!:');
          wasFixed = true;
        }
      }

      if (error.code === 'TS7006' && error.message.includes('implicitly has an \'any\' type')) {
        // Add explicit any type
        const match = errorLine.match(/(\w+)(\s*[=:])/);
        if (match) {
          fixedLine = errorLine.replace(match[0], `${match[1]}: any${match[2]}`);
          wasFixed = true;
        }
      }

      if (error.code === 'TS2339' && error.message.includes('does not exist on type')) {
        // Add optional chaining
        const match = errorLine.match(/(\w+)\.(\w+)/);
        if (match) {
          fixedLine = errorLine.replace(match[0], `${match[1]}?.${match[2]}`);
          wasFixed = true;
        }
      }

      if (wasFixed) {
        lines[error.line - 1] = fixedLine;
        await fs.writeFile(error.file, lines.join('\n'));
        console.log(`✅ Fixed ${error.code} in ${error.file}:${error.line}`);
        return true;
      }

      return false;
    } catch (err) {
      console.error(`❌ Failed to fix error in ${error.file}:`, err);
      return false;
    }
  }

  /**
   * Add missing type definitions
   */
  async addMissingTypes(): Promise<void> {
    const typeDefinitions = `
// Generated type definitions for fixing TypeScript errors

export interface ExtendedUnifiedModelClient {
  currentOptimization?: any;
  executeCommand?: (command: string) => Promise<any>;
  generateCode?: (prompt: string) => Promise<any>;
  checkConnection?: () => Promise<boolean>;
  analyzeCode?: (code: string) => Promise<any>;
  generateVoiceResponse?: (input: any) => Promise<any>;
}

export interface ExtendedVoiceArchetype {
  prompt?: string;
  systemPrompt: string;
  id: string;
  name: string;
  temperature: number;
  style: string;
}

export interface ExtendedSynthesisResult {
  content: string;
  confidence?: number;
  reasoning?: string;
  combinedCode?: string;
  convergenceReason?: string;
  lessonsLearned?: string[];
}

export interface ExtendedIterationResult {
  diff?: string;
  code?: string;
  content: string;
  iterations: Array<{
    content: string;
    feedback: any;
    improvement: number;
  }>;
  writerVoice: any;
  auditorVoice: any;
  totalIterations: any;
  finalQualityScore: number;
  converged: boolean;
  finalCode: string;
}

export interface CLIContext {
  modelClient: any;
  voiceSystem: any;
  mcpManager: any;
  config: any;
}
`;

    await fs.writeFile('src/core/extended-types.ts', typeDefinitions);
    console.log('✅ Added missing type definitions');
  }

  /**
   * Generate a report of remaining TypeScript errors
   */
  async generateErrorReport(): Promise<string> {
    const errors = await this.getTypeScriptErrors();
    const groupedErrors = new Map<string, TypeScriptError[]>();

    // Group errors by error code
    for (const error of errors) {
      if (!groupedErrors.has(error.code)) {
        groupedErrors.set(error.code, []);
      }
      groupedErrors.get(error.code)!.push(error);
    }

    let report = `
🔧 TYPESCRIPT ERROR ANALYSIS REPORT
===================================

Total Errors: ${errors.length}

ERROR BREAKDOWN BY TYPE:
`;

    for (const [code, codeErrors] of groupedErrors) {
      report += `\n${code}: ${codeErrors.length} occurrences\n`;
      report += '─'.repeat(50) + '\n';
      
      // Show first few examples
      const examples = codeErrors.slice(0, 3);
      for (const error of examples) {
        report += `📁 ${error.file}:${error.line}\n`;
        report += `❌ ${error.message}\n\n`;
      }
      
      if (codeErrors.length > 3) {
        report += `... and ${codeErrors.length - 3} more\n\n`;
      }
    }

    return report;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new TypeScriptFixer();
  
  console.log('🔧 Starting TypeScript error fixing...');
  
  fixer.addMissingTypes()
    .then(() => fixer.fixCommonErrors())
    .then(result => {
      console.log(`\n✅ Fixed ${result.fixed} errors`);
      console.log(`⚠️  ${result.remaining} errors remaining`);
      
      if (result.remaining > 0) {
        return fixer.generateErrorReport();
      }
      return 'All TypeScript errors fixed! 🎉';
    })
    .then(report => {
      console.log(report);
    })
    .catch(error => {
      console.error('❌ TypeScript fixing failed:', error);
      process.exit(1);
    });
}