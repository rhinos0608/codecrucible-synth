/**
 * Command-Line Search Engine for CodeCrucible Synth
 * Replaces Vector RAG with high-performance ripgrep/find-based search
 * Based on research findings from RIPGREP_FIND_SEARCH_RESEARCH_2025-08-25
 */

import { spawn, SpawnOptions } from 'child_process';
import { logger } from '../logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface SearchOptions {
  query: string;
  fileTypes?: string[];
  excludePaths?: string[];
  includeHidden?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  multiline?: boolean;
  contextLines?: {
    before?: number;
    after?: number;
    context?: number;
  };
  maxResults?: number;
  timeout?: number;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context?: {
    before?: string[];
    after?: string[];
  };
  score: number;
}

export interface FileSearchResult {
  path: string;
  name: string;
  size: number;
  modified: Date;
  type: 'file' | 'directory';
}

/**
 * Advanced pattern generators for different programming languages
 * Based on comprehensive research from RIPGREP_FIND_SEARCH_RESEARCH_2025-08-25
 */
export class CodePatternGenerator {
  /**
   * Generate function definition patterns for multiple languages with advanced detection
   */
  static generateFunctionPattern(functionName: string, language?: string): string {
    const patterns = {
      typescript: [
        // Arrow functions with context
        `^(export\\s+)?(const|let|var)\\s+(${functionName})\\s*=\\s*(\\([^)]*\\)|[^=]+)\\s*=>`,
        // Traditional function declarations
        `^(export\\s+)?(async\\s+)?function\\s+(${functionName})\\s*\\(`,
        // Class methods
        `^\\s*(public|private|protected|static)?\\s*(async\\s+)?(${functionName})\\s*\\([^)]*\\)\\s*:\\s*\\w+`,
        // Interface method signatures
        `^\\s*(${functionName})\\s*\\([^)]*\\)\\s*:\\s*\\w+`,
      ].join('|'),

      javascript: [
        // Arrow functions
        `^(export\\s+)?(const|let|var)\\s+(${functionName})\\s*=\\s*(\\([^)]*\\)|[^=]+)\\s*=>`,
        // Traditional functions
        `^(export\\s+)?(async\\s+)?function\\s+(${functionName})\\s*\\(`,
        // Object method shorthand
        `^\\s*(${functionName})\\s*\\([^)]*\\)\\s*\\{`,
        // Class methods
        `^\\s*(async\\s+)?(${functionName})\\s*\\([^)]*\\)\\s*\\{`,
      ].join('|'),

      python: [
        // Function definitions with decorators
        `^(@\\w+(\\([^)]*\\))?\\s*)*(async\\s+)?def\\s+(${functionName})\\s*\\(`,
        // Simple function definitions
        `^(async\\s+)?def\\s+(${functionName})\\s*\\(`,
        // Lambda functions
        `(${functionName})\\s*=\\s*lambda\\s+[^:]+:`,
      ].join('|'),

      java: [
        // Method definitions with annotations
        `^\\s*(@\\w+(\\([^)]*\\))?\\s*)*(public|private|protected|static|final|abstract|synchronized)*\\s+(\\w+\\s+)*(${functionName})\\s*\\([^)]*\\)`,
        // Constructor patterns
        `^\\s*(public|private|protected)\\s+(${functionName})\\s*\\([^)]*\\)\\s*(throws\\s+\\w+(,\\s*\\w+)*)?\\s*\\{`,
      ].join('|'),

      csharp: [
        // Method definitions with attributes
        `^\\s*(\\[\\w+[^\\]]*\\]\\s*)*(public|private|protected|internal|static|virtual|override|abstract)*\\s+\\w+\\s+(${functionName})\\s*\\(`,
        // Property definitions
        `^\\s*(public|private|protected|internal)\\s+\\w+\\s+(${functionName})\\s*\\{`,
      ].join('|'),

      cpp: [
        // Function definitions with templates
        `^template\\s*<[^>]*>\\s*(\\w+\\s+)*(${functionName})\\s*\\([^)]*\\)`,
        // Class member functions
        `^(\\w+\\s+)*(\\w+::(${functionName}))\\s*\\([^)]*\\)(\\s+const)?(\\s+override|final)?\\s*\\{?`,
        // Operator overloading
        `^(\\w+\\s+)*operator\\s*([+\\-*/=<>!]+|\\(\\)|"")\\s*\\(`,
        // Regular functions
        `^(\\w+\\s+)+(${functionName})\\s*\\([^)]*\\)`,
      ].join('|'),

      rust: [
        // Function definitions
        `^(pub\\s+)?(async\\s+)?(unsafe\\s+)?fn\\s+(${functionName})(\\s*<[^>]*>)?\\s*\\(`,
        // Associated functions in impl blocks
        `^\\s*(pub\\s+)?fn\\s+(${functionName})(\\s*<[^>]*>)?\\s*\\(`,
      ].join('|'),

      go: [
        // Function definitions
        `^func\\s+(\\w+\\s+)?(${functionName})\\s*\\(`,
        // Method definitions
        `^func\\s+\\([^)]+\\)\\s+(${functionName})\\s*\\(`,
      ].join('|'),

      php: [
        // Function definitions
        `^(public|private|protected)?\\s*(static)?\\s*function\\s+(${functionName})\\s*\\(`,
        // Magic methods
        `^(public|private|protected)?\\s*function\\s+__(${functionName})\\s*\\(`,
      ].join('|'),

      swift: [
        // Function definitions
        `^(public|private|internal|fileprivate)?\\s*(static|class)?\\s*func\\s+(${functionName})(\\s*<[^>]*>)?\\s*\\(`,
        // Initializers
        `^(public|private|internal|fileprivate)?\\s*(convenience\\s+)?init\\s*\\(`,
      ].join('|'),

      kotlin: [
        // Function definitions
        `^(public|private|internal|protected)?\\s*(suspend\\s+)?fun\\s+(${functionName})(\\s*<[^>]*>)?\\s*\\(`,
        // Extension functions
        `^fun\\s+\\w+\\.(${functionName})(\\s*<[^>]*>)?\\s*\\(`,
      ].join('|'),
    };

    if (language && patterns[language as keyof typeof patterns]) {
      return patterns[language as keyof typeof patterns];
    }

    // Multi-language pattern combining all major patterns
    return [
      `(function\\s+${functionName}|${functionName}\\s*[=:]\\s*(?:function|\\(|async))`, // JS/TS
      `def\\s+${functionName}\\s*\\(`, // Python
      `fn\\s+${functionName}\\s*[<(]`, // Rust
      `func\\s+(?:\\w+\\s+)?${functionName}\\s*\\(`, // Go
      `(public|private|protected)?.*${functionName}\\s*\\(`, // Java/C#/C++
    ].join('|');
  }

  /**
   * Generate class definition patterns with advanced language-specific detection
   */
  static generateClassPattern(className: string, language?: string): string {
    const patterns = {
      typescript: [
        // Class definitions
        `^(export\\s+)?(abstract\\s+)?class\\s+(${className})`,
        // Interface definitions with inheritance
        `^(export\\s+)?interface\\s+(${className})(\\s+extends\\s+\\w+)?\\s*\\{`,
        // Type definitions
        `^(export\\s+)?type\\s+(${className})(\\<[^>]*\\>)?\\s*=`,
      ].join('|'),

      javascript: [
        // ES6+ class definitions
        `^(export\\s+)?(default\\s+)?class\\s+(${className})`,
        // Constructor function pattern (legacy)
        `^function\\s+(${className})\\s*\\([^)]*\\)\\s*\\{`,
      ].join('|'),

      python: [
        // Class definitions with inheritance and metaclass
        `^class\\s+(${className})(\\([^)]*\\))?\\s*:`,
        // Dataclass definitions
        `^@dataclass\\s*\\nclass\\s+(${className})`,
      ].join('|'),

      java: [
        // Class definitions with modifiers and inheritance
        `^(public\\s+)?(abstract\\s+)?(final\\s+)?(class)\\s+(${className})(\\s+extends\\s+\\w+)?(\\s+implements\\s+[\\w,\\s]+)?\\s*\\{?`,
        // Interface and enum definitions
        `^(public\\s+)?(interface|enum)\\s+(${className})`,
        // Annotation definitions
        `^@interface\\s+(${className})\\s*\\{`,
      ].join('|'),

      csharp: [
        // Class definitions with attributes and modifiers
        `^(\\[\\w+[^\\]]*\\]\\s*)*(public|private|protected|internal)?\\s*(abstract|sealed)?\\s*(partial)?\\s*class\\s+(${className})`,
        // Struct definitions
        `^(public\\s+)?struct\\s+(${className})`,
        // Interface definitions
        `^(public\\s+)?interface\\s+(${className})`,
      ].join('|'),

      cpp: [
        // Class and struct definitions with templates
        `^(template\\s*<[^>]*>\\s*)?(class|struct)\\s+(${className})(\\s*:\\s*(public|private|protected)\\s+\\w+(,\\s*(public|private|protected)\\s+\\w+)*)?\\s*\\{?`,
        // Namespace definitions
        `^namespace\\s+(${className})\\s*\\{`,
      ].join('|'),

      rust: [
        // Struct definitions
        `^(pub\\s+)?struct\\s+(${className})(\\s*<[^>]*>)?\\s*\\{?`,
        // Enum definitions
        `^(pub\\s+)?enum\\s+(${className})(\\s*<[^>]*>)?\\s*\\{`,
        // Trait definitions
        `^(pub\\s+)?trait\\s+(${className})(\\s*<[^>]*>)?(\\s*:\\s*\\w+((\\s*\\+\\s*\\w+)*))?\`*\\{`,
      ].join('|'),

      go: [
        // Type definitions for structs and interfaces
        `^type\\s+(${className})\\s+(struct|interface)\\s*\\{`,
        // Type aliases
        `^type\\s+(${className})\\s+\\w+`,
      ].join('|'),
    };

    if (language && patterns[language as keyof typeof patterns]) {
      return patterns[language as keyof typeof patterns];
    }

    // Multi-language pattern
    return [
      `(class|interface|struct|trait|enum)\\s+(${className})`,
      `type\\s+(${className})\\s+(struct|interface)`,
      `^(export\\s+)?\\w*\\s*(${className}).*\\{`,
    ].join('|');
  }

  /**
   * Generate import/require patterns with comprehensive language support
   */
  static generateImportPattern(moduleName: string, language?: string): string {
    const patterns = {
      typescript: [
        // ES6 imports with various syntaxes
        `^import\\s+.*from\\s+['"][^'"]*${moduleName}[^'"]*['"]`,
        `^import\\s+['"][^'"]*${moduleName}[^'"]*['"]`,
        `^import\\s*\\{[^}]*\\}\\s+from\\s+['"][^'"]*${moduleName}[^'"]*['"]`,
        `^import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"][^'"]*${moduleName}[^'"]*['"]`,
      ].join('|'),

      javascript: [
        // ES6 imports and CommonJS require
        `^import\\s+.*from\\s+['"][^'"]*${moduleName}[^'"]*['"]`,
        `^require\\s*\\(\\s*['"][^'"]*${moduleName}[^'"]*['"]\\s*\\)`,
        `^const\\s+.*=\\s+require\\s*\\(\\s*['"][^'"]*${moduleName}[^'"]*['"]\\s*\\)`,
      ].join('|'),

      python: [
        // Various Python import patterns
        `^from\\s+[\\w.]*${moduleName}[\\w.]*\\s+import`,
        `^import\\s+[\\w.]*${moduleName}[\\w.]*`,
        `^from\\s+\\w+\\s+import\\s+.*${moduleName}`,
        `^import\\s+\\w+\\.${moduleName}`,
      ].join('|'),

      java: [
        // Java import statements
        `^import\\s+(static\\s+)?[\\w.]*${moduleName}[\\w.]*`,
        `^import\\s+(static\\s+)?[\\w.]*\\.${moduleName}\\s*;`,
      ].join('|'),

      csharp: [
        // C# using statements
        `^using\\s+[\\w.]*${moduleName}[\\w.]*`,
        `^using\\s+\\w+\\s*=\\s*[\\w.]*${moduleName}[\\w.]*`,
      ].join('|'),

      cpp: [
        // C++ include statements
        `^#include\\s*[<"][^<>"]*${moduleName}[^<>"]*[>"]`,
        `^#include\\s*"[^"]*${moduleName}[^"]*"`,
      ].join('|'),

      rust: [
        // Rust use statements
        `^use\\s+[\\w:]*${moduleName}[\\w:]*`,
        `^use\\s+\\w+::\\{[^}]*${moduleName}[^}]*\\}`,
        `^extern\\s+crate\\s+${moduleName}`,
      ].join('|'),

      go: [
        // Go import statements
        `^import\\s+"[^"]*${moduleName}[^"]*"`,
        `^import\\s+\\w+\\s+"[^"]*${moduleName}[^"]*"`,
        `^import\\s+\\(\\s*"[^"]*${moduleName}[^"]*"\\s*\\)`,
      ].join('|'),
    };

    if (language && patterns[language as keyof typeof patterns]) {
      return patterns[language as keyof typeof patterns];
    }

    // Multi-language fallback
    return [
      `^(import|from|#include|using|use)\\s+.*${moduleName}`,
      `require\\s*\\([^)]*${moduleName}[^)]*\\)`,
      `^extern\\s+crate\\s+${moduleName}`,
    ].join('|');
  }

  /**
   * Generate TODO/FIXME/HACK comment patterns
   */
  static generateTodoPattern(): string {
    return `(?://|#|<!--)\\s*(TODO|FIXME|HACK|XXX|BUG|NOTE)\\s*[:]?\\s*(.*)`;
  }

  /**
   * Generate error handling patterns with comprehensive detection
   */
  static generateErrorPattern(language?: string): string {
    const patterns = {
      typescript: [
        `try\\s*\\{`,
        `catch\\s*\\([^)]*\\)\\s*\\{`,
        `throw\\s+new\\s+\\w*Error`,
        `Promise\\.reject\\s*\\(`,
        `\\.catch\\s*\\(`,
        `finally\\s*\\{`,
      ].join('|'),

      javascript: [
        `try\\s*\\{`,
        `catch\\s*\\([^)]*\\)\\s*\\{`,
        `throw\\s+new\\s+\\w*Error`,
        `Promise\\.reject\\s*\\(`,
        `\\.catch\\s*\\(`,
      ].join('|'),

      python: [
        `try\\s*:`,
        `except\\s+\\w*Error`,
        `raise\\s+\\w*Error`,
        `finally\\s*:`,
        `assert\\s+`,
      ].join('|'),

      java: [
        `try\\s*\\{`,
        `catch\\s*\\([^)]*Exception[^)]*\\)`,
        `throw\\s+new\\s+\\w*Exception`,
        `throws\\s+\\w*Exception`,
        `finally\\s*\\{`,
      ].join('|'),

      rust: [
        `Result\\s*<`,
        `Option\\s*<`,
        `panic!\\s*\\(`,
        `\\.unwrap\\s*\\(`,
        `\\.expect\\s*\\(`,
        `match\\s+.*\\{.*Err\\(`,
      ].join('|'),

      go: [`if\\s+err\\s*!=\\s*nil`, `return\\s+.*,\\s*err`, `panic\\s*\\(`, `recover\\s*\\(`].join(
        '|'
      ),
    };

    if (language && patterns[language as keyof typeof patterns]) {
      return patterns[language as keyof typeof patterns];
    }

    return `(try\\s*\\{|catch\\s*\\(|except\\s+|throw\\s+|panic|error|Error|Exception|Result\\s*<)`;
  }

  /**
   * Generate configuration and constants patterns
   */
  static generateConfigPattern(configName?: string): string {
    const name = configName ?? '\\w+';
    return [
      `^(export\\s+)?(const|let|var)\\s+(${name})\\s*=\\s*\\{`, // JS/TS objects
      `^${name}\\s*=\\s*\\{`, // Python dicts
      `^(public\\s+)?(static\\s+)?(final\\s+)?\\w+\\s+${name}\\s*=`, // Java constants
      `^#define\\s+${name}`, // C/C++ macros
      `^const\\s+${name}\\s*=`, // Go constants
      `^pub\\s+const\\s+${name}:`, // Rust constants
    ].join('|');
  }

  /**
   * Generate test patterns for various testing frameworks
   */
  static generateTestPattern(testName?: string, language?: string): string {
    const name = testName ?? '[^"\']*';

    const patterns = {
      javascript: [
        `describe\\s*\\(\\s*['"][^'"]*${name}[^'"]*['"]`,
        `it\\s*\\(\\s*['"][^'"]*${name}[^'"]*['"]`,
        `test\\s*\\(\\s*['"][^'"]*${name}[^'"]*['"]`,
        `expect\\s*\\([^)]*\\)\\.to`,
      ].join('|'),

      typescript: [
        `describe\\s*\\(\\s*['"][^'"]*${name}[^'"]*['"]`,
        `it\\s*\\(\\s*['"][^'"]*${name}[^'"]*['"]`,
        `test\\s*\\(\\s*['"][^'"]*${name}[^'"]*['"]`,
      ].join('|'),

      python: [
        `def\\s+test_${name}`,
        `class\\s+Test\\w*${name}`,
        `@pytest\\.mark\\.`,
        `assert\\s+`,
      ].join('|'),

      java: [
        `@Test\\s+.*${name}`,
        `@ParameterizedTest`,
        `assertTrue\\s*\\(`,
        `assertEquals\\s*\\(`,
      ].join('|'),

      rust: [`#\\[test\\]`, `#\\[cfg\\(test\\)\\]`, `assert_eq!`, `assert!`].join('|'),

      go: [`func\\s+Test${name}`, `func\\s+Benchmark${name}`, `t\\.Error`, `t\\.Assert`].join('|'),
    };

    if (language && patterns[language as keyof typeof patterns]) {
      return patterns[language as keyof typeof patterns];
    }

    return [
      `(describe|it|test)\\s*\\([^)]*${name}`,
      `def\\s+test_${name}`,
      `@Test.*${name}`,
      `func\\s+Test${name}`,
      `#\\[test\\]`,
      `(assert|expect)\\s*\\(`,
    ].join('|');
  }

  /**
   * Generate dependency and package patterns
   */
  static generateDependencyPattern(packageName?: string): string {
    const name = packageName ?? '[\\w.-]+';
    return [
      `"${name}"\\s*:\\s*"[^"]*"`, // package.json dependencies
      `${name}\\s*=\\s*"[^"]*"`, // Cargo.toml dependencies
      `implementation\\s+['"][^'"]*${name}[^'"]*['"]`, // Gradle dependencies
      `<dependency>.*${name}.*</dependency>`, // Maven dependencies
      `${name}\\s*==\\s*[\\d.]+`, // Python requirements
      `gem\\s+['"]${name}['"]`, // Ruby Gemfile
    ].join('|');
  }
}

/**
 * High-performance command-line search engine using ripgrep and find
 */
export class CommandLineSearchEngine {
  private readonly workingDirectory: string;
  private readonly ripgrepPath: string;
  private readonly findPath: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
    this.ripgrepPath = process.platform === 'win32' ? 'rg.exe' : 'rg';
    this.findPath = process.platform === 'win32' ? 'where' : 'find';
  }

  /**
   * Search for text patterns in files using ripgrep
   */
  async searchInFiles(options: SearchOptions): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      const command = this.buildRipgrepCommand(options);
      logger.info(`🔍 Executing ripgrep search: ${command.join(' ')}`);

      const result = await this.executeCommand(command[0], command.slice(1), {
        cwd: this.workingDirectory,
        timeout: options.timeout ?? 10000,
      });

      const searchResults = this.parseRipgrepOutput(result.stdout, options);

      logger.info(
        `✅ Search completed in ${Date.now() - startTime}ms, found ${searchResults.length} results`
      );
      return searchResults;
    } catch (error) {
      logger.error('Ripgrep search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for files using find command
   */
  async searchFiles(
    pattern: string,
    options?: {
      type?: 'f' | 'd' | 'l';
      maxDepth?: number;
      minDepth?: number;
      size?: string;
      modified?: string;
      excludePaths?: string[];
      timeout?: number;
    }
  ): Promise<FileSearchResult[]> {
    const startTime = Date.now();

    try {
      const command = this.buildFindCommand(pattern, options);
      logger.info(`📁 Executing find command: ${command.join(' ')}`);

      const result = await this.executeCommand(command[0], command.slice(1), {
        cwd: this.workingDirectory,
        timeout: options?.timeout ?? 5000,
      });

      const fileResults = await this.parseFindOutput(result.stdout);

      logger.info(
        `✅ File search completed in ${Date.now() - startTime}ms, found ${fileResults.length} files`
      );
      return fileResults;
    } catch (error) {
      logger.error('Find search failed:', error);
      throw new Error(
        `File search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Intelligent code search with pattern detection
   */
  async intelligentCodeSearch(
    query: string,
    context?: {
      language?: string;
      searchType?: 'function' | 'class' | 'import' | 'todo' | 'error' | 'general';
      fileTypes?: string[];
    }
  ): Promise<SearchResult[]> {
    let pattern: string;

    // Generate appropriate pattern based on search type
    switch (context?.searchType) {
      case 'function':
        pattern = CodePatternGenerator.generateFunctionPattern(query, context.language);
        break;
      case 'class':
        pattern = CodePatternGenerator.generateClassPattern(query, context.language);
        break;
      case 'import':
        pattern = CodePatternGenerator.generateImportPattern(query, context.language);
        break;
      case 'todo':
        pattern = CodePatternGenerator.generateTodoPattern();
        break;
      case 'error':
        pattern = CodePatternGenerator.generateErrorPattern(context.language);
        break;
      default:
        pattern = query;
    }

    const searchOptions: SearchOptions = {
      query: pattern,
      regex: context?.searchType !== 'general',
      fileTypes: context?.fileTypes ?? this.getLanguageExtensions(context?.language),
      contextLines: { context: 3 },
      maxResults: 100,
    };

    return this.searchInFiles(searchOptions);
  }

  /**
   * Build ripgrep command with all options
   */
  private buildRipgrepCommand(options: SearchOptions): string[] {
    const cmd = [this.ripgrepPath];

    // Basic options
    if (!options.caseSensitive) cmd.push('--ignore-case');
    if (options.wholeWord) cmd.push('--word-regexp');
    if (options.regex) cmd.push('--regexp', options.query);
    else cmd.push('--fixed-strings', options.query);

    // Multiline support
    if (options.multiline) {
      cmd.push('--multiline');
      cmd.push('--multiline-dotall');
    }

    // Context lines
    if (options.contextLines) {
      if (options.contextLines.context) {
        cmd.push('--context', String(options.contextLines.context));
      } else {
        if (options.contextLines.before)
          cmd.push('--before-context', String(options.contextLines.before));
        if (options.contextLines.after)
          cmd.push('--after-context', String(options.contextLines.after));
      }
    }

    // File type filtering
    if (options.fileTypes && options.fileTypes.length > 0) {
      options.fileTypes.forEach(type => {
        cmd.push('--type', type);
      });
    }

    // Path exclusions
    if (options.excludePaths && options.excludePaths.length > 0) {
      options.excludePaths.forEach(pattern => {
        cmd.push('--glob', `!${pattern}`);
      });
    }

    // Hidden files
    if (options.includeHidden) cmd.push('--hidden');

    // Output format
    cmd.push('--line-number');
    cmd.push('--column');
    cmd.push('--with-filename');
    cmd.push('--no-heading');

    // Performance optimizations
    cmd.push('--max-count', String(options.maxResults ?? 100));
    cmd.push('--dfa-size-limit', '100M');

    return cmd;
  }

  /**
   * Build find command with options
   */
  private buildFindCommand(
    pattern: string,
    options?: {
      type?: 'f' | 'd' | 'l';
      maxDepth?: number;
      minDepth?: number;
      size?: string;
      modified?: string;
      excludePaths?: string[];
    }
  ): string[] {
    if (process.platform === 'win32') {
      // Windows: use 'where' command or PowerShell Get-ChildItem
      return [
        'powershell',
        '-Command',
        `Get-ChildItem -Path . -Recurse -Name "*${pattern}*" | Select-Object -First 100`,
      ];
    }

    const cmd = [this.findPath, '.'];

    // Depth limits
    if (options?.maxDepth) cmd.push('-maxdepth', String(options.maxDepth));
    if (options?.minDepth) cmd.push('-mindepth', String(options.minDepth));

    // File type
    if (options?.type) cmd.push('-type', options.type);

    // Name pattern
    cmd.push('-name', `*${pattern}*`);

    // Size filter
    if (options?.size) cmd.push('-size', options.size);

    // Modified time filter
    if (options?.modified) cmd.push('-mtime', options.modified);

    // Exclude paths
    if (options?.excludePaths && options.excludePaths.length > 0) {
      options.excludePaths.forEach(excludePath => {
        cmd.push('!', '-path', `*${excludePath}*`);
      });
    }

    return cmd;
  }

  /**
   * Parse ripgrep output into SearchResult objects
   */
  private parseRipgrepOutput(output: string, options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Format: filename:line:column:match
      const match = line.match(/^(.+?):(\d+):(\d+):(.*)$/);
      if (!match) continue;

      const [, file, lineStr, columnStr, matchText] = match;
      const lineNum = parseInt(lineStr, 10);
      const column = parseInt(columnStr, 10);

      // Calculate relevance score
      const score = this.calculateRelevanceScore(matchText, options.query);

      results.push({
        file: path.resolve(this.workingDirectory, file),
        line: lineNum,
        column,
        match: matchText.trim(),
        score,
      });
    }

    // Sort by relevance score
    return results.sort((a, b) => b.score - a.score).slice(0, options.maxResults ?? 100);
  }

  /**
   * Parse find output into FileSearchResult objects
   */
  private async parseFindOutput(output: string): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const fullPath = path.resolve(this.workingDirectory, line.trim());
        const stats = await fs.stat(fullPath);

        results.push({
          path: fullPath,
          name: path.basename(fullPath),
          size: stats.size,
          modified: stats.mtime,
          type: stats.isDirectory() ? 'directory' : 'file',
        });
      } catch (error) {
        // Skip files that can't be accessed
        continue;
      }
    }

    return results;
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(match: string, query: string): number {
    let score = 0;
    const lowerMatch = match.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match gets highest score
    if (lowerMatch.includes(lowerQuery)) {
      score += 100;

      // Bonus for exact word boundaries
      const wordBoundary = new RegExp(
        `\\b${lowerQuery.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`
      );
      if (wordBoundary.test(lowerMatch)) {
        score += 50;
      }

      // Bonus for beginning of line
      if (lowerMatch.trimStart().startsWith(lowerQuery)) {
        score += 25;
      }
    }

    // Fuzzy matching bonus
    const fuzzyScore = this.calculateFuzzyScore(lowerMatch, lowerQuery);
    score += fuzzyScore;

    return score;
  }

  /**
   * Calculate fuzzy matching score
   */
  private calculateFuzzyScore(text: string, query: string): number {
    if (query.length === 0) return 0;

    let score = 0;
    let queryIndex = 0;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        score += 1;
        queryIndex++;
      }
    }

    return (score / query.length) * 10;
  }

  /**
   * Get file extensions for a programming language
   */
  private getLanguageExtensions(language?: string): string[] {
    const extensions: Record<string, string[]> = {
      typescript: ['ts', 'tsx'],
      javascript: ['js', 'jsx', 'mjs', 'cjs'],
      python: ['py', 'pyx', 'pyi'],
      java: ['java'],
      csharp: ['cs'],
      cpp: ['cpp', 'cc', 'cxx', 'hpp', 'h'],
      rust: ['rs'],
      go: ['go'],
      php: ['php'],
      ruby: ['rb'],
      swift: ['swift'],
      kotlin: ['kt', 'kts'],
      scala: ['scala'],
    };

    return language ? (extensions[language] ?? []) : [];
  }

  /**
   * Execute command with timeout and error handling
   */
  private async executeCommand(
    command: string,
    args: string[],
    options: SpawnOptions & { timeout?: number }
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, options);

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = options.timeout
        ? setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
            reject(new Error(`Command timed out after ${options.timeout}ms`));
          }, options.timeout)
        : null;

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        if (timeout) clearTimeout(timeout);

        if (timedOut) return;

        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', error => {
        if (timeout) clearTimeout(timeout);
        if (!timedOut) reject(error);
      });
    });
  }
}

/**
 * Search result cache manager for performance optimization
 */
export class SearchCacheManager {
  private cache = new Map<string, { results: unknown; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.results as T;
  }

  setCached<T>(key: string, results: T): void {
    this.cache.set(key, { results, timestamp: Date.now() });

    // Cleanup old entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  generateKey(options: Record<string, unknown>): string {
    return JSON.stringify(options);
  }
}
