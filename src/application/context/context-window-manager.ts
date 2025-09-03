/**
 * Context Window Manager - Large Codebase Analysis
 *
 * Implements intelligent context window utilization patterns from industry leaders:
 * - Qwen CLI: 256K-512K context windows with hierarchical analysis
 * - Gemini CLI: 1M+ context windows with smart file prioritization
 * - Claude Code: Intelligent chunking and caching strategies
 *
 * Enables comprehensive codebase analysis that fits within model context limits
 * while maximizing relevant information density.
 */

import { readFile, stat } from 'fs/promises';
import { Stats } from 'fs';
import { extname, relative, dirname, join } from 'path';
import { glob } from 'glob';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface ContextWindow {
  maxTokens: number;
  usedTokens: number;
  availableTokens: number;
  efficiency: number; // 0-1, how well context is utilized
}

export interface FileAnalysisResult {
  path: string;
  priority: number; // 0-1, relevance to query
  tokens: number;
  summary?: string;
  keyElements?: string[];
  dependencies?: string[];
  complexity: 'low' | 'medium' | 'high';
}

export interface ContextChunk {
  id: string;
  files: FileAnalysisResult[];
  totalTokens: number;
  focusArea: string;
  summary: string;
  relationships: string[];
}

export interface CodebaseAnalysisResult {
  chunks: ContextChunk[];
  totalFiles: number;
  analyzedFiles: number;
  tokensUsed: number;
  contextEfficiency: number;
  priorityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
}

/**
 * Advanced Context Window Manager for large codebase analysis
 */
export class ContextWindowManager {
  private maxContextTokens: number;
  private tokenBuffer: number; // Reserve tokens for response
  private supportedExtensions: Set<string>;
  private excludePatterns: string[];
  private tokenCache: Map<string, number> = new Map();
  private analysisCache: Map<string, FileAnalysisResult> = new Map();

  constructor(
    options: {
      maxContextTokens?: number;
      tokenBuffer?: number;
      supportedExtensions?: string[];
      excludePatterns?: string[];
    } = {}
  ) {
    // Match Ollama configuration: 256K context window
    this.maxContextTokens = options.maxContextTokens || 256000;
    this.tokenBuffer = options.tokenBuffer || 16000; // Reasonable buffer for model response

    this.supportedExtensions = new Set(
      options.supportedExtensions || [
        '.js',
        '.ts',
        '.jsx',
        '.tsx',
        '.py',
        '.java',
        '.cpp',
        '.c',
        '.h',
        '.css',
        '.scss',
        '.html',
        '.vue',
        '.svelte',
        '.md',
        '.json',
        '.yaml',
        '.yml',
        '.xml',
        '.sql',
        '.sh',
        '.bat',
        '.ps1',
        '.dockerfile',
        '.env',
        '.go',
        '.rs',
        '.rb',
        '.php',
        '.cs',
        '.swift',
        '.kt',
        '.dart',
        '.r',
        '.scala',
        '.clj',
        '.hs',
        '.elm',
        '.f90',
        '.m',
        '.pl',
        '.lua',
        '.nim',
      ]
    );

    this.excludePatterns = options.excludePatterns || [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/*.d.ts',
      '.DS_Store',
      'thumbs.db',
      '*.log',
      '.vscode/**',
      '.idea/**',
    ];
  }

  /**
   * Analyze entire codebase with intelligent context window utilization
   */
  async analyzeCodebase(
    basePath: string,
    query: string,
    options: {
      maxDepth?: number;
      prioritizeRecent?: boolean;
      includeTests?: boolean;
      includeDocs?: boolean;
      chunkStrategy?: 'priority' | 'hierarchical' | 'semantic';
    } = {}
  ): Promise<CodebaseAnalysisResult> {
    const startTime = Date.now();
    const availableTokens = this.maxContextTokens - this.tokenBuffer;

    logger.info(
      `🔍 Starting codebase analysis with ${availableTokens.toLocaleString()} token budget`
    );

    // Phase 1: Discover all relevant files
    const allFiles = await this.discoverFiles(basePath, {
      maxDepth: options.maxDepth || 5,
      includeTests: options.includeTests ?? true,
      includeDocs: options.includeDocs ?? true,
    });

    logger.info(`📁 Discovered ${allFiles.length} files for analysis`);

    // Phase 2: Analyze and prioritize files based on query
    const analyzedFiles = await this.analyzeAndPrioritizeFiles(allFiles, query, basePath);

    // Phase 3: Create context chunks with intelligent grouping
    const chunks = await this.createContextChunks(
      analyzedFiles,
      availableTokens,
      options.chunkStrategy || 'priority'
    );

    // Phase 4: Generate analysis statistics
    const result = this.generateAnalysisResult(chunks, allFiles.length, analyzedFiles);

    const analysisTime = Date.now() - startTime;
    logger.info(`✅ Codebase analysis completed in ${analysisTime}ms`);
    logger.info(`📊 Context efficiency: ${(result.contextEfficiency * 100).toFixed(1)}%`);

    return result;
  }

  /**
   * Discover relevant files in the codebase
   */
  private async discoverFiles(
    basePath: string,
    options: { maxDepth: number; includeTests: boolean; includeDocs: boolean }
  ): Promise<string[]> {
    const patterns = ['**/*'];

    // Add specific patterns based on options
    if (!options.includeTests) {
      this.excludePatterns.push('**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**');
    }

    if (!options.includeDocs) {
      this.excludePatterns.push('**/docs/**', '**/*.md', '**/README*');
    }

    try {
      const files = await glob(patterns, {
        cwd: basePath,
        ignore: this.excludePatterns,
        nodir: true,
        maxDepth: options.maxDepth,
        absolute: true,
      });

      // Filter by supported extensions
      return files.filter(file => this.supportedExtensions.has(extname(file).toLowerCase()));
    } catch (error) {
      logger.warn('Failed to discover files:', error);
      return [];
    }
  }

  /**
   * Analyze and prioritize files based on query relevance
   */
  private async analyzeAndPrioritizeFiles(
    files: string[],
    query: string,
    basePath: string
  ): Promise<FileAnalysisResult[]> {
    const results: FileAnalysisResult[] = [];
    const batchSize = 20; // Process files in batches for performance

    logger.info(`🔬 Analyzing ${files.length} files for relevance`);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map(async file => this.analyzeFile(file, query, basePath));

      try {
        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(
          (result): result is FileAnalysisResult => result !== null
        );
        const filteredCount = batchResults.length - validResults.length;

        results.push(...validResults);

        // Debug logging to understand filtering
        if (filteredCount > 0) {
          logger.info(
            `📋 Batch ${i}-${i + batchSize}: ${validResults.length} valid, ${filteredCount} filtered`
          );
        }
      } catch (error) {
        logger.warn(`Failed to analyze batch ${i}-${i + batchSize}:`, error);
      }

      // Progress logging for large codebases
      if (files.length > 100 && (i + batchSize) % 100 === 0) {
        logger.info(`📈 Progress: ${i + batchSize}/${files.length} files analyzed`);
      }
    }

    // Sort by priority (high to low)
    results.sort((a, b) => b.priority - a.priority);

    logger.info(`✅ File analysis complete, ${results.length} files prioritized`);
    return results;
  }

  /**
   * Analyze individual file for relevance and metadata
   */
  private async analyzeFile(
    filePath: string,
    query: string,
    basePath: string
  ): Promise<FileAnalysisResult | null> {
    try {
      // Check cache first
      const cacheKey = `${filePath}:${query.slice(0, 50)}`;
      if (this.analysisCache.has(cacheKey)) {
        const cachedResult = this.analysisCache.get(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
        return null;
      }

      const stats = await stat(filePath);
      const relativePath = relative(basePath, filePath);

      // Skip if file is too large (>1MB)
      if (stats.size > 1024 * 1024) {
        return null;
      }

      const content = await readFile(filePath, 'utf-8');
      const tokens = this.estimateTokens(content);

      // Calculate priority based on multiple factors
      const priority = this.calculateFilePriority(content, relativePath, query, stats);

      const result: FileAnalysisResult = {
        path: relativePath,
        priority,
        tokens,
        complexity: this.assessComplexity(content),
        summary: this.generateFileSummary(content, relativePath),
        keyElements: this.extractKeyElements(content),
        dependencies: this.extractDependencies(content),
      };

      // Cache the result
      this.analysisCache.set(cacheKey, result);
      return result;
    } catch (error) {
      // File read error - try to be more permissive
      try {
        // For binary files or encoding issues, still return basic info
        const stats = await stat(filePath);
        const relativePath = relative(basePath, filePath);

        if (stats.size > 1024 * 1024) {
          return null; // Still skip very large files
        }

        // Return minimal result for files we can't read
        return {
          path: relativePath,
          priority: 0.05, // Low but non-zero priority
          tokens: Math.ceil(stats.size / 4), // Rough estimate
          complexity: 'low' as const,
          summary: `Binary or unreadable file: ${relativePath}`,
          keyElements: [],
          dependencies: [],
        };
      } catch (statError) {
        // If we can't even stat the file, skip it
        return null;
      }
    }
  }

  /**
   * Calculate file priority based on query relevance
   */
  private calculateFilePriority(
    content: string,
    relativePath: string,
    query: string,
    stats: Stats
  ): number {
    let priority = 0.1; // Base priority for all files (was 0)
    const queryLower = query.toLowerCase();
    const pathLower = relativePath.toLowerCase();
    // Removed unused variable 'contentLower'

    // Project analysis queries should include more files by default
    const isProjectAnalysis =
      queryLower.includes('project') ||
      queryLower.includes('analyze') ||
      queryLower.includes('tell me about') ||
      queryLower.includes('about this');

    if (isProjectAnalysis) {
      priority += 0.2; // Boost for project analysis queries
    }

    // Path-based scoring (enhanced)
    if (pathLower.includes(queryLower)) priority += 0.3;
    if (pathLower.includes('index') || pathLower.includes('main')) priority += 0.3;
    if (pathLower.includes('src/')) priority += 0.2;
    if (pathLower.includes('core/') || pathLower.includes('lib/')) priority += 0.2;
    if (pathLower.includes('config') || pathLower.includes('setting')) priority += 0.15;

    // Important files for project understanding
    const filename = pathLower.split('/').pop() || '';
    if (
      [
        'package.json',
        'tsconfig.json',
        'readme.md',
        'index.ts',
        'index.js',
        'main.ts',
        'app.ts',
      ].includes(filename)
    ) {
      priority += 0.4;
    }

    // Content-based scoring (more lenient)
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    for (const word of queryWords) {
      if (['analyze', 'project', 'about'].includes(word)) continue; // Skip generic words
      const matches = (content.match(new RegExp(word, 'gi')) || []).length;
      priority += Math.min(matches * 0.03, 0.15); // Reduced individual impact but still meaningful
    }

    // File type scoring (enhanced for code files)
    const ext = extname(relativePath).toLowerCase();
    if (['.ts', '.js'].includes(ext)) priority += 0.2; // TypeScript/JavaScript priority
    if (['.py', '.java', '.cpp', '.go', '.rs'].includes(ext)) priority += 0.15; // Other code files
    if (['.json', '.yaml', '.yml'].includes(ext)) priority += 0.1; // Config files
    if (['.md', '.txt'].includes(ext)) priority += 0.08; // Documentation

    // Recency scoring (enhanced)
    const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified < 1)
      priority += 0.15; // Very recent
    else if (daysSinceModified < 7)
      priority += 0.1; // Recent
    else if (daysSinceModified < 30) priority += 0.05; // Somewhat recent

    // Size penalty for very large files (more lenient)
    if (content.length > 100000)
      priority *= 0.7; // Only penalize very large files
    else if (content.length > 50000) priority *= 0.9; // Light penalty for large files

    return Math.min(priority, 1.0);
  }

  /**
   * Create intelligent context chunks
   */
  private async createContextChunks(
    files: FileAnalysisResult[],
    availableTokens: number,
    strategy: 'priority' | 'hierarchical' | 'semantic'
  ): Promise<ContextChunk[]> {
    // Removed unused variable 'chunks'
    logger.debug(`Chunks initialized with strategy: ${strategy}`);
    // Removed unused variable 'currentChunk'
    const _currentTokens = 0;
    const _chunkId = 1;

    logger.info(`🧩 Creating context chunks with ${strategy} strategy`);

    switch (strategy) {
      case 'priority':
        return Promise.resolve(this.createPriorityChunks(files, availableTokens));

      case 'hierarchical':
        return Promise.resolve(this.createHierarchicalChunks(files, availableTokens));

      case 'semantic':
        return Promise.resolve(this.createSemanticChunks(files, availableTokens));

      default:
        return Promise.resolve(this.createPriorityChunks(files, availableTokens));
    }
  }

  /**
   * Create chunks based on priority (highest priority files first)
   */
  private createPriorityChunks(
    files: FileAnalysisResult[],
    availableTokens: number
  ): ContextChunk[] {
    const chunks: ContextChunk[] = [];
    const chunkTargetSize = availableTokens * 0.8; // Leave room for metadata

    let currentChunk: FileAnalysisResult[] = [];
    let currentTokens = 0;

    for (const file of files) {
      if (currentTokens + file.tokens > chunkTargetSize && currentChunk.length > 0) {
        // Create chunk and start new one
        chunks.push(this.finalizeChunk(currentChunk, chunks.length + 1));
        currentChunk = [];
        currentTokens = 0;
      }

      currentChunk.push(file);
      currentTokens += file.tokens;
    }

    // Add final chunk if there are remaining files
    if (currentChunk.length > 0) {
      chunks.push(this.finalizeChunk(currentChunk, chunks.length + 1));
    }

    logger.info(`✅ Created ${chunks.length} priority-based chunks`);
    return chunks;
  }

  /**
   * Create chunks based on hierarchical directory structure
   */
  private createHierarchicalChunks(
    files: FileAnalysisResult[],
    availableTokens: number
  ): ContextChunk[] {
    // Group files by directory
    const dirGroups = new Map<string, FileAnalysisResult[]>();

    for (const file of files) {
      const dir = file.path.split('/').slice(0, -1).join('/') || 'root';
      if (!dirGroups.has(dir)) dirGroups.set(dir, []);
      const group = dirGroups.get(dir);
      if (group) {
        group.push(file);
      }
    }

    // Create chunks from directory groups
    const chunks: ContextChunk[] = [];
    const chunkTargetSize = availableTokens * 0.8;

    for (const [dir, dirFiles] of dirGroups) {
      let currentChunk: FileAnalysisResult[] = [];
      let currentTokens = 0;

      // Sort files in directory by priority
      dirFiles.sort((a, b) => b.priority - a.priority);

      for (const file of dirFiles) {
        if (currentTokens + file.tokens > chunkTargetSize && currentChunk.length > 0) {
          chunks.push(this.finalizeChunk(currentChunk, chunks.length + 1, `Directory: ${dir}`));
          currentChunk = [];
          currentTokens = 0;
        }

        currentChunk.push(file);
        currentTokens += file.tokens;
      }

      if (currentChunk.length > 0) {
        chunks.push(this.finalizeChunk(currentChunk, chunks.length + 1, `Directory: ${dir}`));
      }
    }

    logger.info(
      `✅ Created ${chunks.length} hierarchical chunks from ${dirGroups.size} directories`
    );
    return chunks;
  }

  /**
   * Create chunks based on semantic relationships (dependencies, imports)
   */
  private createSemanticChunks(
    files: FileAnalysisResult[],
    availableTokens: number
  ): ContextChunk[] {
    const fileMap = new Map<string, FileAnalysisResult>();
    files.forEach(f => fileMap.set(f.path, f));

    const graph = new Map<string, Set<string>>();
    for (const file of files) {
      const dir = dirname(file.path);
      for (const dep of file.dependencies || []) {
        if (!dep.startsWith('.')) continue;
        const base = join(dir, dep);
        const candidates = [base, `${base}.ts`, `${base}.js`];
        const target = candidates.find(c => fileMap.has(c));
        if (target) {
          if (!graph.has(file.path)) graph.set(file.path, new Set());
          if (!graph.has(target)) graph.set(target, new Set());
          graph.get(file.path)!.add(target);
          graph.get(target)!.add(file.path);
        }
      }
    }

    const visited = new Set<string>();
    const components: FileAnalysisResult[][] = [];
    for (const file of files) {
      if (visited.has(file.path)) continue;
      const queue = [file.path];
      const group: FileAnalysisResult[] = [];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const result = fileMap.get(current);
        if (result) {
          group.push(result);
          const neighbors = graph.get(current);
          if (neighbors) {
            neighbors.forEach(n => {
              if (!visited.has(n)) queue.push(n);
            });
          }
        }
      }
      if (group.length > 0) components.push(group);
    }

    const chunkTargetSize = availableTokens * 0.8;
    const chunks: ContextChunk[] = [];
    let chunkId = 1;
    for (const group of components) {
      let current: FileAnalysisResult[] = [];
      let tokens = 0;
      for (const file of group) {
        if (tokens + file.tokens > chunkTargetSize && current.length > 0) {
          chunks.push(this.finalizeChunk(current, chunkId++));
          current = [];
          tokens = 0;
        }
        current.push(file);
        tokens += file.tokens;
      }
      if (current.length > 0) {
        chunks.push(this.finalizeChunk(current, chunkId++));
      }
    }

    logger.info(`✅ Created ${chunks.length} semantic chunks using dependency graph`);
    return chunks;
  }

  /**
   * Finalize a context chunk with metadata
   */
  private finalizeChunk(files: FileAnalysisResult[], id: number, focusArea?: string): ContextChunk {
    const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);
    const _avgPriority = files.reduce((sum, f) => sum + f.priority, 0) / files.length;

    return {
      id: `chunk-${id}`,
      files,
      totalTokens,
      focusArea: focusArea || this.determineFocusArea(files),
      summary: this.generateChunkSummary(files),
      relationships: this.extractChunkRelationships(files),
    };
  }

  /**
   * Determine the focus area of a chunk based on its files
   */
  private determineFocusArea(files: FileAnalysisResult[]): string {
    const pathParts = files.map(f => f.path.split('/')).flat();
    const commonDirs = this.findMostCommon(pathParts.filter(p => !p.includes('.')));

    if (commonDirs.length > 0) {
      return `${commonDirs[0]} module`;
    }

    const extensions = files.map(f => extname(f.path));
    const commonExt = this.findMostCommon(extensions);

    if (commonExt.length > 0) {
      return `${commonExt[0]} files`;
    }

    return 'Mixed files';
  }

  /**
   * Generate analysis result with statistics
   */
  private generateAnalysisResult(
    chunks: ContextChunk[],
    totalFiles: number,
    analyzedFiles: FileAnalysisResult[]
  ): CodebaseAnalysisResult {
    const tokensUsed = chunks.reduce((sum, chunk) => sum + chunk.totalTokens, 0);
    const contextEfficiency = Math.min(
      tokensUsed / (this.maxContextTokens - this.tokenBuffer),
      1.0
    );

    // Calculate priority distribution
    const highPriority = analyzedFiles.filter(f => f.priority >= 0.7).length;
    const mediumPriority = analyzedFiles.filter(f => f.priority >= 0.3 && f.priority < 0.7).length;
    const lowPriority = analyzedFiles.filter(f => f.priority < 0.3).length;

    const recommendations: string[] = [];

    if (contextEfficiency < 0.5) {
      recommendations.push('Consider narrowing your query scope for more focused analysis');
    }

    if (chunks.length > 5) {
      recommendations.push(
        'Large codebase detected - analysis will be performed in multiple passes'
      );
    }

    if (highPriority < analyzedFiles.length * 0.1) {
      recommendations.push('No highly relevant files found - consider refining your query');
    }

    return {
      chunks,
      totalFiles,
      analyzedFiles: analyzedFiles.length,
      tokensUsed,
      contextEfficiency,
      priorityDistribution: {
        high: highPriority,
        medium: mediumPriority,
        low: lowPriority,
      },
      recommendations,
    };
  }

  // Utility methods
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for code, 1 token ≈ 3.5 characters for text
    const cacheKey = text.slice(0, 100) + text.length;
    if (this.tokenCache.has(cacheKey)) {
      const cachedValue = this.tokenCache.get(cacheKey);
      if (cachedValue !== undefined) {
        return cachedValue;
      }
      throw new Error(`Cache miss for key: ${cacheKey}`);
    }

    const estimated = Math.ceil(text.length / 3.8); // Conservative estimate
    this.tokenCache.set(cacheKey, estimated);
    return estimated;
  }

  private assessComplexity(content: string): 'low' | 'medium' | 'high' {
    const lines = content.split('\n').length;
    const cyclomaticComplexity = (
      content.match(/\b(if|else|for|while|switch|catch|&&|\|\|)\b/g) || []
    ).length;

    if (lines > 1000 || cyclomaticComplexity > 50) return 'high';
    if (lines > 300 || cyclomaticComplexity > 20) return 'medium';
    return 'low';
  }

  private generateFileSummary(content: string, path: string): string {
    const lines = content.split('\n');
    const firstNonEmptyLine = lines.find(line => line.trim().length > 0) || '';

    // Extract first comment or docstring if available
    if (firstNonEmptyLine.startsWith('/*') || firstNonEmptyLine.startsWith('/**')) {
      const commentEnd = content.indexOf('*/');
      if (commentEnd !== -1) {
        return content
          .slice(0, commentEnd + 2)
          .replace(/[/*]/g, '')
          .trim()
          .slice(0, 200);
      }
    }

    return `${path}: ${lines.length} lines, ${extname(path)} file`;
  }

  private extractKeyElements(content: string): string[] {
    const elements: string[] = [];

    // Extract function/class names (simple regex-based approach)
    const functions = content.match(
      /(?:function|const|let)\s+(\w+)|class\s+(\w+)|export\s+(?:function|class)\s+(\w+)/g
    );
    if (functions) {
      elements.push(...functions.slice(0, 10)); // Limit to 10 key elements
    }

    return elements;
  }

  private extractDependencies(content: string): string[] {
    const deps: string[] = [];
    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\))/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1] || match[2];
      if (dep && dep.startsWith('.')) {
        deps.push(dep);
      }
      if (deps.length >= 15) break;
    }
    return deps;
  }

  private generateChunkSummary(files: FileAnalysisResult[]): string {
    const fileCount = files.length;
    const avgPriority = files.reduce((sum, f) => sum + f.priority, 0) / files.length;
    const complexFiles = files.filter(f => f.complexity === 'high').length;

    return `${fileCount} files, avg priority: ${(avgPriority * 100).toFixed(0)}%, ${complexFiles} complex files`;
  }

  private extractChunkRelationships(files: FileAnalysisResult[]): string[] {
    // Extract common patterns or shared dependencies
    const allDeps = files.flatMap(f => f.dependencies || []);
    const commonDeps = this.findMostCommon(allDeps);
    return commonDeps.slice(0, 5);
  }

  private findMostCommon<T>(items: T[]): T[] {
    const counts = new Map<T, number>();
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([item]) => item);
  }

  /**
   * Clear analysis caches
   */
  clearCache(): void {
    this.tokenCache.clear();
    this.analysisCache.clear();
  }

  /**
   * Get current context window utilization stats
   */
  getContextStats(): ContextWindow {
    const usedTokens = Array.from(this.tokenCache.values()).reduce(
      (sum, tokens) => sum + tokens,
      0
    );
    const availableTokens = this.maxContextTokens - this.tokenBuffer;

    return {
      maxTokens: this.maxContextTokens,
      usedTokens,
      availableTokens: Math.max(0, availableTokens - usedTokens),
      efficiency: Math.min(usedTokens / availableTokens, 1.0),
    };
  }
}

// Export singleton instance
export const contextWindowManager = new ContextWindowManager();
