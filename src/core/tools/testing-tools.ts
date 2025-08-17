import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs } from 'fs';
import { join, relative, isAbsolute, dirname, extname } from 'path';
import { UnifiedModelClient } from '../client.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GenerateTestSchema = z.object({
  filePath: z.string().describe('Path to the file to generate tests for'),
  testType: z.enum(['unit', 'integration', 'e2e', 'component']).default('unit').describe('Type of test to generate'),
  testFramework: z.enum(['jest', 'mocha', 'vitest', 'jasmine', 'cypress', 'playwright']).default('jest').describe('Testing framework to use'),
  outputPath: z.string().optional().describe('Optional output path for the test file'),
  includeEdgeCases: z.boolean().default(true).describe('Whether to include edge case testing'),
  includeMocking: z.boolean().default(true).describe('Whether to include mocking examples'),
});

export class TestGeneratorTool extends BaseTool {
  private modelClient: UnifiedModelClient;

  constructor(
    private agentContext: { workingDirectory: string },
    modelClient: UnifiedModelClient
  ) {
    super({
      name: 'generateTests',
      description: 'Generates comprehensive test suites for existing code',
      category: 'Testing',
      parameters: GenerateTestSchema,
    });
    this.modelClient = modelClient;
  }

  async execute(args: z.infer<typeof GenerateTestSchema>): Promise<string> {
    try {
      const { filePath, testType, testFramework, outputPath, includeEdgeCases, includeMocking } = args;
      
      const fullPath = this.resolvePath(filePath);
      
      // Read the source code
      const sourceCode = await fs.readFile(fullPath, 'utf-8');
      
      // Determine output path
      const testFilePath = outputPath || this.generateTestFilePath(filePath, testFramework);
      
      // Generate test prompt
      const testPrompt = this.buildTestGenerationPrompt(
        sourceCode, 
        filePath, 
        testType, 
        testFramework, 
        includeEdgeCases, 
        includeMocking
      );
      
      // Generate tests using AI
      const generatedTests = await this.modelClient.generateText(testPrompt);
      const cleanTestCode = this.extractCodeFromResponse(generatedTests);
      
      // Ensure test directory exists
      await this.ensureDirectoryExists(testFilePath);
      
      // Write test file
      await fs.writeFile(testFilePath, cleanTestCode, 'utf-8');
      
      return `Generated ${testType} tests using ${testFramework} for ${filePath}\nTest file saved to: ${testFilePath}`;
      
    } catch (error) {
      return `Error generating tests: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private buildTestGenerationPrompt(
    sourceCode: string,
    filePath: string,
    testType: string,
    testFramework: string,
    includeEdgeCases: boolean,
    includeMocking: boolean
  ): string {
    const frameworkSetup = this.getFrameworkSetup(testFramework);
    
    return `You are an expert test engineer. Generate comprehensive ${testType} tests for the following code using ${testFramework}.

SOURCE CODE TO TEST:
File: ${filePath}
\`\`\`
${sourceCode}
\`\`\`

TEST REQUIREMENTS:
1. Generate ${testType} tests using ${testFramework}
2. Test all public methods and functions
3. Test both positive and negative scenarios
4. ${includeEdgeCases ? 'Include comprehensive edge case testing' : 'Focus on main functionality'}
5. ${includeMocking ? 'Include proper mocking for dependencies' : 'Use minimal mocking'}
6. Follow ${testFramework} best practices
7. Include setup and teardown as needed
8. Add descriptive test names and documentation
9. Ensure tests are isolated and deterministic
10. Include assertion coverage for all return values and side effects

FRAMEWORK SETUP:
${frameworkSetup}

TEST STRUCTURE:
- Group related tests in describe blocks
- Use clear, descriptive test names
- Include arrange, act, assert pattern
- Handle async operations properly
- Test error conditions and edge cases
- Mock external dependencies appropriately

Generate ONLY the complete test file code wrapped in triple backticks. Include necessary imports and setup.`;
  }

  private getFrameworkSetup(framework: string): string {
    const setups = {
      jest: `
Import examples:
\`\`\`typescript
import { jest } from '@jest/globals';
import { functionToTest, ClassToTest } from '../src/module';
\`\`\`

Mocking examples:
\`\`\`typescript
jest.mock('../src/dependency');
const mockFunction = jest.fn();
\`\`\``,
      
      mocha: `
Import examples:
\`\`\`typescript
import { expect } from 'chai';
import sinon from 'sinon';
import { functionToTest } from '../src/module';
\`\`\``,
      
      vitest: `
Import examples:
\`\`\`typescript
import { describe, it, expect, vi } from 'vitest';
import { functionToTest } from '../src/module';
\`\`\``,
      
      cypress: `
Cypress E2E test structure:
\`\`\`typescript
describe('Component E2E Tests', () => {
  beforeEach(() => {
    cy.visit('/page');
  });
});
\`\`\``,
      
      playwright: `
Playwright test structure:
\`\`\`typescript
import { test, expect } from '@playwright/test';
\`\`\``
    };

    return setups[framework as keyof typeof setups] || setups.jest;
  }

  private generateTestFilePath(sourceFilePath: string, framework: string): string {
    const ext = extname(sourceFilePath);
    const baseName = sourceFilePath.replace(ext, '');
    
    // Different frameworks have different conventions
    const testExtensions = {
      jest: '.test.ts',
      mocha: '.test.ts',
      vitest: '.test.ts',
      jasmine: '.spec.ts',
      cypress: '.cy.ts',
      playwright: '.spec.ts'
    };
    
    const testExt = testExtensions[framework as keyof typeof testExtensions] || '.test.ts';
    
    // Place tests in __tests__ directory or alongside source
    const testDir = join(dirname(sourceFilePath), '__tests__');
    const fileName = `${baseName}${testExt}`;
    
    return fileName.replace(/^src\//, 'src/__tests__/');
  }

  private extractCodeFromResponse(response: string): string {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const matches = [];
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      matches.push(match[1]);
    }
    
    if (matches.length > 0) {
      return matches.join('\n\n');
    }
    
    return response.trim();
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

const RunTestsSchema = z.object({
  testPattern: z.string().optional().describe('Pattern to match test files (e.g., "*.test.ts")'),
  testFramework: z.enum(['jest', 'mocha', 'vitest', 'npm', 'yarn']).default('npm').describe('Test runner to use'),
  coverage: z.boolean().default(false).describe('Whether to generate coverage report'),
  watch: z.boolean().default(false).describe('Whether to run tests in watch mode'),
  verbose: z.boolean().default(false).describe('Whether to run tests in verbose mode'),
  timeout: z.number().default(30000).describe('Test timeout in milliseconds'),
});

export class TestRunnerTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'runTests',
      description: 'Executes test suites and returns results',
      category: 'Testing',
      parameters: RunTestsSchema,
    });
  }

  async execute(args: z.infer<typeof RunTestsSchema>): Promise<string> {
    try {
      const { testPattern, testFramework, coverage, watch, verbose, timeout } = args;
      
      const command = this.buildTestCommand(testFramework, testPattern, coverage, watch, verbose);
      
      console.log(`Running tests with command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.agentContext.workingDirectory,
        timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      let result = '';
      if (stdout) result += `STDOUT:\n${stdout}\n`;
      if (stderr) result += `STDERR:\n${stderr}\n`;
      
      return result || 'Tests completed successfully with no output.';
      
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const stdout = error.stdout || '';
      const stderr = error.stderr || '';
      
      return `Test execution failed:\nError: ${errorMessage}\n${stdout ? `STDOUT:\n${stdout}\n` : ''}${stderr ? `STDERR:\n${stderr}\n` : ''}`;
    }
  }

  private buildTestCommand(
    framework: string,
    pattern?: string,
    coverage?: boolean,
    watch?: boolean,
    verbose?: boolean
  ): string {
    let command = '';
    
    switch (framework) {
      case 'jest':
        command = 'npx jest';
        if (pattern) command += ` --testPathPattern="${pattern}"`;
        if (coverage) command += ' --coverage';
        if (watch) command += ' --watch';
        if (verbose) command += ' --verbose';
        break;
        
      case 'mocha':
        command = 'npx mocha';
        if (pattern) command += ` "${pattern}"`;
        if (verbose) command += ' --reporter spec';
        break;
        
      case 'vitest':
        command = 'npx vitest';
        if (pattern) command += ` "${pattern}"`;
        if (coverage) command += ' --coverage';
        if (watch) command += ' --watch';
        break;
        
      case 'npm':
        command = 'npm test';
        break;
        
      case 'yarn':
        command = 'yarn test';
        break;
        
      default:
        command = 'npm test';
    }
    
    return command;
  }
}

const AnalyzeCoverageSchema = z.object({
  coverageFormat: z.enum(['lcov', 'html', 'text', 'json']).default('text').describe('Coverage report format'),
  threshold: z.number().min(0).max(100).default(80).describe('Minimum coverage threshold percentage'),
  includeUncovered: z.boolean().default(true).describe('Whether to include uncovered lines in the report'),
});

export class CoverageAnalyzerTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'analyzeCoverage',
      description: 'Analyzes test coverage and generates coverage reports',
      category: 'Testing',
      parameters: AnalyzeCoverageSchema,
    });
  }

  async execute(args: z.infer<typeof AnalyzeCoverageSchema>): Promise<string> {
    try {
      const { coverageFormat, threshold, includeUncovered } = args;
      
      // Run tests with coverage
      const coverageCommand = this.buildCoverageCommand(coverageFormat);
      
      console.log(`Analyzing coverage with command: ${coverageCommand}`);
      
      const { stdout, stderr } = await execAsync(coverageCommand, {
        cwd: this.agentContext.workingDirectory,
        timeout: 60000, // 1 minute timeout for coverage analysis
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      let result = `Coverage Analysis Complete\n\n`;
      
      if (stdout) {
        result += `Coverage Report:\n${stdout}\n\n`;
        
        // Extract coverage percentage if possible
        const coverageMatch = stdout.match(/All files\s+\|\s*([\d.]+)/);
        if (coverageMatch) {
          const coverage = parseFloat(coverageMatch[1]);
          result += `Overall Coverage: ${coverage}%\n`;
          
          if (coverage < threshold) {
            result += `⚠️  Coverage (${coverage}%) is below threshold (${threshold}%)\n`;
          } else {
            result += `✅ Coverage meets threshold (${threshold}%)\n`;
          }
        }
      }
      
      if (stderr) {
        result += `Warnings:\n${stderr}\n`;
      }
      
      // Check for coverage files
      const coverageFiles = await this.findCoverageFiles();
      if (coverageFiles.length > 0) {
        result += `\nCoverage reports generated:\n${coverageFiles.join('\n')}`;
      }
      
      return result;
      
    } catch (error: any) {
      return `Coverage analysis failed: ${error.message}`;
    }
  }

  private buildCoverageCommand(format: string): string {
    // Try to detect the test framework from package.json
    const commands = [
      `npx jest --coverage --coverageReporters=${format}`,
      `npx vitest --coverage --coverage.reporter=${format}`,
      `npm test -- --coverage`
    ];
    
    return commands[0]; // Default to Jest
  }

  private async findCoverageFiles(): Promise<string[]> {
    const coveragePaths = [
      'coverage/lcov-report/index.html',
      'coverage/index.html',
      'coverage/lcov.info',
      'coverage/coverage-final.json'
    ];
    
    const existingFiles = [];
    
    for (const path of coveragePaths) {
      try {
        const fullPath = join(this.agentContext.workingDirectory, path);
        await fs.access(fullPath);
        existingFiles.push(path);
      } catch {
        // File doesn't exist, continue
      }
    }
    
    return existingFiles;
  }
}