/**
 * Enhanced Search Integration for CodeCrucible Synth
 * Integrates command-line search engine with existing MCP tools
 * Provides backward compatibility while upgrading performance
 */

import { BaseTool } from '../tools/base-tool.js';
import {
  CommandLineSearchEngine,
  SearchOptions,
  SearchResult,
  FileSearchResult,
  CodePatternGenerator,
} from './command-line-search-engine.js';
import { logger } from '../logger.js';
import { z } from 'zod';
import * as path from 'path';

export interface EnhancedSearchResult {
  results: SearchResult[] | FileSearchResult[];
  metadata: {
    searchType: string;
    duration: number;
    totalResults: number;
    engine: 'ripgrep' | 'find' | 'hybrid';
    cacheHit: boolean;
  };
}

/**
 * Enhanced file content search tool using ripgrep
 */
export class EnhancedFileSearchTool extends BaseTool {
  private searchEngine: CommandLineSearchEngine;

  constructor(workingDirectory: string) {
    super({
      name: 'enhanced_file_search',
      description:
        'High-performance file content search using ripgrep with advanced pattern matching',
      category: 'Search',
      parameters: z.object({
        query: z.string().describe('Search query or pattern'),
        searchType: z
          .enum(['general', 'function', 'class', 'import', 'todo', 'error'])
          .optional()
          .describe('Type of code search to perform'),
        language: z
          .string()
          .optional()
          .describe('Programming language context (typescript, javascript, python, etc.)'),
        fileTypes: z
          .array(z.string())
          .optional()
          .describe('File extensions to include (js, ts, py, etc.)'),
        contextLines: z
          .number()
          .optional()
          .describe('Number of context lines before/after matches'),
        caseSensitive: z.boolean().optional().describe('Case sensitive search'),
        wholeWord: z.boolean().optional().describe('Match whole words only'),
        regex: z.boolean().optional().describe('Use regex pattern matching'),
        maxResults: z.number().optional().describe('Maximum number of results to return'),
      }),
    });

    this.searchEngine = new CommandLineSearchEngine(workingDirectory);
  }

  async execute(params: {
    query: string;
    searchType?: 'general' | 'function' | 'class' | 'import' | 'todo' | 'error';
    language?: string;
    fileTypes?: string[];
    contextLines?: number;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regex?: boolean;
    maxResults?: number;
  }): Promise<EnhancedSearchResult> {
    const startTime = Date.now();

    try {
      logger.info(
        `🔍 Enhanced file search: ${params.query} (type: ${params.searchType ?? 'general'})`
      );

      let results: SearchResult[];

      if (params.searchType && params.searchType !== 'general') {
        // Use intelligent code search
        results = await this.searchEngine.intelligentCodeSearch(params.query, {
          language: params.language,
          searchType: params.searchType,
          fileTypes: params.fileTypes,
        });
      } else {
        // Use general text search
        const searchOptions: SearchOptions = {
          query: params.query,
          fileTypes: params.fileTypes,
          caseSensitive: params.caseSensitive ?? false,
          wholeWord: params.wholeWord ?? false,
          regex: params.regex ?? false,
          contextLines: params.contextLines ? { context: params.contextLines } : undefined,
          maxResults: params.maxResults ?? 50,
        };

        results = await this.searchEngine.searchInFiles(searchOptions);
      }

      const duration = Date.now() - startTime;

      logger.info(`✅ Enhanced search completed in ${duration}ms, found ${results.length} results`);

      return {
        results,
        metadata: {
          searchType: params.searchType ?? 'general',
          duration,
          totalResults: results.length,
          engine: 'ripgrep',
          cacheHit: false,
        },
      };
    } catch (error) {
      logger.error('Enhanced file search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Enhanced file finder tool using find/locate
 */
export class EnhancedFileFinderTool extends BaseTool {
  private searchEngine: CommandLineSearchEngine;

  constructor(workingDirectory: string) {
    super({
      name: 'enhanced_file_finder',
      description: 'High-performance file and directory discovery using find command',
      category: 'Search',
      parameters: z.object({
        pattern: z.string().describe('File name pattern to search for'),
        type: z.enum(['file', 'directory', 'any']).optional().describe('Type of filesystem object'),
        maxDepth: z.number().optional().describe('Maximum directory depth to search'),
        minDepth: z.number().optional().describe('Minimum directory depth to search'),
        size: z.string().optional().describe('File size filter (e.g. +1M, -500k)'),
        modified: z.string().optional().describe('Modified time filter (e.g. -1, +7)'),
        excludePaths: z.array(z.string()).optional().describe('Paths to exclude from search'),
        maxResults: z.number().optional().describe('Maximum number of results'),
      }),
    });

    this.searchEngine = new CommandLineSearchEngine(workingDirectory);
  }

  async execute(params: {
    pattern: string;
    type?: 'file' | 'directory' | 'any';
    maxDepth?: number;
    minDepth?: number;
    size?: string;
    modified?: string;
    excludePaths?: string[];
    maxResults?: number;
  }): Promise<EnhancedSearchResult> {
    const startTime = Date.now();

    try {
      logger.info(`📁 Enhanced file finder: ${params.pattern}`);

      const fileTypeMap: Record<string, 'f' | 'd' | undefined> = {
        file: 'f',
        directory: 'd',
        any: undefined,
      };

      const results = await this.searchEngine.searchFiles(params.pattern, {
        type: fileTypeMap[params.type ?? 'any'],
        maxDepth: params.maxDepth,
        minDepth: params.minDepth,
        size: params.size,
        modified: params.modified,
        excludePaths: params.excludePaths,
      });

      // Limit results
      const limitedResults = results.slice(0, params.maxResults ?? 50);
      const duration = Date.now() - startTime;

      logger.info(
        `✅ File finder completed in ${duration}ms, found ${limitedResults.length} results`
      );

      return {
        results: limitedResults,
        metadata: {
          searchType: 'file_finder',
          duration,
          totalResults: limitedResults.length,
          engine: 'find',
          cacheHit: false,
        },
      };
    } catch (error) {
      logger.error('Enhanced file finder failed:', error);
      throw new Error(
        `File search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Smart code analysis tool with pattern-based search
 */
export class SmartCodeAnalysisTool extends BaseTool {
  private searchEngine: CommandLineSearchEngine;

  constructor(workingDirectory: string) {
    super({
      name: 'smart_code_analysis',
      description: 'Intelligent code analysis using advanced pattern matching and search',
      category: 'Analysis',
      parameters: z.object({
        analysisType: z
          .enum([
            'functions',
            'classes',
            'imports',
            'todos',
            'errors',
            'dependencies',
            'complexity',
          ])
          .describe('Type of code analysis'),
        targetName: z
          .string()
          .optional()
          .describe('Specific function, class, or module name to analyze'),
        language: z.string().optional().describe('Programming language context'),
        includeTests: z.boolean().optional().describe('Include test files in analysis'),
        outputFormat: z
          .enum(['summary', 'detailed', 'raw'])
          .optional()
          .describe('Output format level'),
      }),
    });

    this.searchEngine = new CommandLineSearchEngine(workingDirectory);
  }

  async execute(params: {
    analysisType:
      | 'functions'
      | 'classes'
      | 'imports'
      | 'todos'
      | 'errors'
      | 'dependencies'
      | 'complexity';
    targetName?: string;
    language?: string;
    includeTests?: boolean;
    outputFormat?: 'summary' | 'detailed' | 'raw';
  }): Promise<Record<string, unknown>> {
    const startTime = Date.now();

    try {
      logger.info(
        `🧠 Smart code analysis: ${params.analysisType} ${params.targetName ? `for ${params.targetName}` : ''}`
      );

      const results = await this.performAnalysis(params);
      const duration = Date.now() - startTime;

      logger.info(`✅ Code analysis completed in ${duration}ms`);

      return {
        analysis: results,
        metadata: {
          analysisType: params.analysisType,
          duration,
          language: params.language,
          includeTests: params.includeTests ?? false,
          outputFormat: params.outputFormat ?? 'summary',
        },
      };
    } catch (error) {
      logger.error('Smart code analysis failed:', error);
      throw new Error(
        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async performAnalysis(params: {
    analysisType: string;
    targetName?: string;
    language?: string;
    includeTests?: boolean;
    outputFormat?: string;
  }): Promise<Record<string, unknown>> {
    switch (params.analysisType) {
      case 'functions':
        return this.analyzeFunctions(params.targetName, params.language);

      case 'classes':
        return this.analyzeClasses(params.targetName, params.language);

      case 'imports':
        return this.analyzeImports(params.targetName, params.language);

      case 'todos':
        return this.analyzeTodos();

      case 'errors':
        return this.analyzeErrorHandling(params.language);

      case 'dependencies':
        return this.analyzeDependencies(params.language);

      case 'complexity':
        return this.analyzeComplexity(params.language);

      default:
        throw new Error(`Unknown analysis type: ${params.analysisType}`);
    }
  }

  private async analyzeFunctions(targetName?: string, language?: string): Promise<Record<string, unknown>> {
    const query = targetName ?? '[a-zA-Z_][a-zA-Z0-9_]*';
    const pattern = CodePatternGenerator.generateFunctionPattern(query, language);

    const results = await this.searchEngine.searchInFiles({
      query: pattern,
      regex: true,
      fileTypes: this.getLanguageExtensions(language),
      contextLines: { context: 2 },
      maxResults: 100,
    });

    return {
      totalFunctions: results.length,
      functions: results.map(r => ({
        name: this.extractFunctionName(r.match),
        file: path.relative(this.searchEngine['workingDirectory'], r.file),
        line: r.line,
        signature: r.match.trim(),
      })),
    };
  }

  private async analyzeClasses(targetName?: string, language?: string): Promise<Record<string, unknown>> {
    const query = targetName ?? '[A-Z][a-zA-Z0-9_]*';
    const pattern = CodePatternGenerator.generateClassPattern(query, language);

    const results = await this.searchEngine.searchInFiles({
      query: pattern,
      regex: true,
      fileTypes: this.getLanguageExtensions(language),
      contextLines: { context: 3 },
      maxResults: 100,
    });

    return {
      totalClasses: results.length,
      classes: results.map(r => ({
        name: this.extractClassName(r.match),
        file: path.relative(this.searchEngine['workingDirectory'], r.file),
        line: r.line,
        definition: r.match.trim(),
      })),
    };
  }

  private async analyzeImports(targetName?: string, language?: string): Promise<Record<string, unknown>> {
    const query = targetName ?? '\\w+';
    const pattern = CodePatternGenerator.generateImportPattern(query, language);

    const results = await this.searchEngine.searchInFiles({
      query: pattern,
      regex: true,
      fileTypes: this.getLanguageExtensions(language),
      maxResults: 200,
    });

    const importMap = new Map<string, number>();
    results.forEach(r => {
      const module = this.extractModuleName(r.match);
      if (module) {
        importMap.set(module, (importMap.get(module) ?? 0) + 1);
      }
    });

    return {
      totalImports: results.length,
      uniqueModules: importMap.size,
      topModules: Array.from(importMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([module, count]) => ({ module, usageCount: count })),
      allImports: results.map(r => ({
        statement: r.match.trim(),
        file: path.relative(this.searchEngine['workingDirectory'], r.file),
        line: r.line,
      })),
    };
  }

  private async analyzeTodos(): Promise<Record<string, unknown>> {
    const pattern = CodePatternGenerator.generateTodoPattern();

    const results = await this.searchEngine.searchInFiles({
      query: pattern,
      regex: true,
      contextLines: { context: 1 },
      maxResults: 500,
    });

    const todoTypes = new Map<string, number>();
    const todos = results.map(r => {
      const match = r.match.match(/(?:\/\/|#|<!--)\s*(TODO|FIXME|HACK|XXX|BUG|NOTE)\s*[:]?\s*(.*)/);
      const type = match?.[1] ?? 'UNKNOWN';
      const description = match?.[2] ?? r.match;

      todoTypes.set(type, (todoTypes.get(type) ?? 0) + 1);

      return {
        type,
        description: description.trim(),
        file: path.relative(this.searchEngine['workingDirectory'], r.file),
        line: r.line,
      };
    });

    return {
      totalTodos: results.length,
      todoBreakdown: Object.fromEntries(todoTypes),
      todos: todos.slice(0, 100), // Limit for display
    };
  }

  private async analyzeErrorHandling(language?: string): Promise<Record<string, unknown>> {
    const pattern = CodePatternGenerator.generateErrorPattern(language);

    const results = await this.searchEngine.searchInFiles({
      query: pattern,
      regex: true,
      fileTypes: this.getLanguageExtensions(language),
      contextLines: { context: 2 },
      maxResults: 200,
    });

    const errorTypes = new Map<string, number>();
    results.forEach(r => {
      const match = r.match.toLowerCase();
      if (match.includes('try'))
        errorTypes.set('try-catch', (errorTypes.get('try-catch') ?? 0) + 1);
      else if (match.includes('throw')) errorTypes.set('throw', (errorTypes.get('throw') ?? 0) + 1);
      else if (match.includes('error')) errorTypes.set('error', (errorTypes.get('error') ?? 0) + 1);
      else if (match.includes('panic')) errorTypes.set('panic', (errorTypes.get('panic') ?? 0) + 1);
      else errorTypes.set('other', (errorTypes.get('other') ?? 0) + 1);
    });

    return {
      totalErrorHandlers: results.length,
      errorTypes: Object.fromEntries(errorTypes),
      handlers: results.slice(0, 50).map(r => ({
        code: r.match.trim(),
        file: path.relative(this.searchEngine['workingDirectory'], r.file),
        line: r.line,
      })),
    };
  }

  private async analyzeDependencies(language?: string): Promise<Record<string, unknown>> {
    // Look for package files based on language
    const packageFiles: Record<string, string[]> = {
      javascript: ['package.json'],
      typescript: ['package.json'],
      python: ['requirements.txt', 'setup.py', 'pyproject.toml'],
      java: ['pom.xml', 'build.gradle'],
      csharp: ['*.csproj', 'packages.config'],
      rust: ['Cargo.toml'],
      go: ['go.mod'],
    };

    const filesToCheck = language
      ? packageFiles[language] ?? []
      : Object.values(packageFiles).flat();

    const results = await this.searchEngine.searchFiles(
      filesToCheck.length > 0 ? filesToCheck[0] : 'package.json'
    );

    return {
      dependencyFiles: results.slice(0, 10).map(r => ({
        file: path.relative(this.searchEngine['workingDirectory'], r.path),
        type: this.getDependencyFileType(r.name),
        size: r.size,
        modified: r.modified,
      })),
    };
  }

  private async analyzeComplexity(language?: string): Promise<Record<string, unknown>> {
    // Simple complexity metrics based on patterns
    const patterns = [
      { name: 'conditionals', pattern: '(if\\s*\\(|else\\s+if|switch\\s*\\(|case\\s+)', weight: 1 },
      { name: 'loops', pattern: '(for\\s*\\(|while\\s*\\(|do\\s*\\{|forEach)', weight: 2 },
      {
        name: 'functions',
        pattern: CodePatternGenerator.generateFunctionPattern('\\w+', language),
        weight: 1,
      },
      {
        name: 'classes',
        pattern: CodePatternGenerator.generateClassPattern('\\w+', language),
        weight: 2,
      },
    ];

    const complexityData: Record<string, unknown> = {};

    for (const pattern of patterns) {
      const results = await this.searchEngine.searchInFiles({
        query: pattern.pattern,
        regex: true,
        fileTypes: this.getLanguageExtensions(language),
        maxResults: 1000,
      });

      complexityData[pattern.name] = {
        count: results.length,
        weight: pattern.weight,
        score: results.length * pattern.weight,
      };
    }

    const totalScore = (Object.values(complexityData) as Record<string, unknown>[]).reduce(
      (sum: number, data: Record<string, unknown>) => sum + (data.score as number),
      0
    );

    return {
      complexityScore: totalScore,
      breakdown: complexityData,
      assessment: this.getComplexityAssessment(totalScore),
    };
  }

  private extractFunctionName(match: string): string {
    const patterns = [
      /function\s+(\w+)/,
      /(\w+)\s*[=:]\s*(?:function|\(|async)/,
      /def\s+(\w+)/,
      /fn\s+(\w+)/,
      /func\s+(?:\w+\s+)?(\w+)/,
    ];

    for (const pattern of patterns) {
      const found = match.match(pattern);
      if (found) return found[1];
    }

    return 'unknown';
  }

  private extractClassName(match: string): string {
    const patterns = [
      /(?:class|interface|struct|trait)\s+(\w+)/,
      /type\s+(\w+)\s+(?:struct|interface)/,
    ];

    for (const pattern of patterns) {
      const found = match.match(pattern);
      if (found) return found[1];
    }

    return 'unknown';
  }

  private extractModuleName(match: string): string | null {
    const patterns = [
      /from\s+['"]([^'"]+)['"]/,
      /import\s+['"]([^'"]+)['"]/,
      /require\(['"]([^'"]+)['"]\)/,
      /import\s+.*['"]([^'"]+)['"]/,
      /#include\s*[<"]([^>"]+)[>"]/,
      /use\s+([^;]+)/,
    ];

    for (const pattern of patterns) {
      const found = match.match(pattern);
      if (found) return found[1];
    }

    return null;
  }

  private getLanguageExtensions(language?: string): string[] {
    const extensions: Record<string, string[]> = {
      typescript: ['ts', 'tsx'],
      javascript: ['js', 'jsx', 'mjs'],
      python: ['py', 'pyx'],
      java: ['java'],
      csharp: ['cs'],
      rust: ['rs'],
      go: ['go'],
    };

    return language ? extensions[language] ?? [] : [];
  }

  private getDependencyFileType(filename: string): string {
    const types: Record<string, string> = {
      'package.json': 'npm',
      'requirements.txt': 'pip',
      'setup.py': 'setuptools',
      'pyproject.toml': 'poetry',
      'pom.xml': 'maven',
      'build.gradle': 'gradle',
      'Cargo.toml': 'cargo',
      'go.mod': 'go modules',
    };

    return types[filename] ?? 'unknown';
  }

  private getComplexityAssessment(score: number): string {
    if (score < 50) return 'Low complexity - well-structured code';
    if (score < 100) return 'Medium complexity - manageable structure';
    if (score < 200) return 'High complexity - consider refactoring';
    return 'Very high complexity - refactoring recommended';
  }
}

/**
 * Unified search facade that integrates all search capabilities
 */
export class UnifiedSearchFacade {
  private fileSearchTool: EnhancedFileSearchTool;
  private fileFinderTool: EnhancedFileFinderTool;
  private codeAnalysisTool: SmartCodeAnalysisTool;

  constructor(workingDirectory: string) {
    this.fileSearchTool = new EnhancedFileSearchTool(workingDirectory);
    this.fileFinderTool = new EnhancedFileFinderTool(workingDirectory);
    this.codeAnalysisTool = new SmartCodeAnalysisTool(workingDirectory);
  }

  /**
   * Universal search method that routes to appropriate tool
   */
  async search(
    query: string,
    options: {
      type?: 'content' | 'files' | 'analysis';
      context?: Record<string, unknown>;
    } = {}
  ): Promise<unknown> {
    switch (options.type) {
      case 'files':
        return this.fileFinderTool.execute({ pattern: query, ...options.context });

      case 'analysis':
        return this.codeAnalysisTool.execute({
          analysisType: 'functions',
          targetName: query,
          ...options.context,
        });

      case 'content':
      default:
        return this.fileSearchTool.execute({ query, ...options.context });
    }
  }

  /**
   * Get all available tools for MCP integration
   */
  getAllTools(): BaseTool[] {
    return [this.fileSearchTool, this.fileFinderTool, this.codeAnalysisTool];
  }
}
