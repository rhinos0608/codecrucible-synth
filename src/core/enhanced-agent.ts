#!/usr/bin/env node

import { existsSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import picocolors from 'picocolors';
import ora from 'ora';
import { EnhancedStartupIndexer, ProjectIndex } from './enhanced-startup-indexer.js';
import { StructuredResponseFormatter, createStructuredResponse, AnalysisResponse } from './structured-response-formatter.js';
import { logger } from './logger.js';

export interface EnhancedAgentConfig {
  projectPath: string;
  enableIndexing: boolean;
  enableDocumentationReading: boolean;
  enableStructuredOutput: boolean;
  enableInteractiveMode: boolean;
  cacheResults: boolean;
  maxCacheAge: number; // in minutes
  outputFormat: 'structured' | 'simple' | 'json';
  verboseLogging: boolean;
}

export interface CachedIndex {
  index: ProjectIndex;
  timestamp: number;
  hash: string;
}

export class EnhancedCodeCrucibleAgent {
  private config: EnhancedAgentConfig;
  private projectIndex: ProjectIndex | null = null;
  private formatter: StructuredResponseFormatter;
  private indexCache: Map<string, CachedIndex> = new Map();
  private startupCompleted = false;

  constructor(config: Partial<EnhancedAgentConfig> = {}) {
    this.config = {
      projectPath: process.cwd(),
      enableIndexing: true,
      enableDocumentationReading: true,
      enableStructuredOutput: true,
      enableInteractiveMode: false,
      cacheResults: true,
      maxCacheAge: 30, // 30 minutes
      outputFormat: 'structured',
      verboseLogging: false,
      ...config
    };

    this.formatter = new StructuredResponseFormatter({
      maxWidth: process.stdout.columns || 120,
      useColors: process.stdout.isTTY
    });

    if (this.config.verboseLogging) {
      // Enable verbose logging if logger supports it
      // logger.level = 'debug';
    }
  }

  async initialize(): Promise<void> {
    const startTime = performance.now();
    const spinner = ora('Initializing Enhanced CodeCrucible Agent...').start();

    try {
      // Phase 1: Project Detection
      spinner.text = 'Detecting project structure...';
      await this.detectProjectType();

      // Phase 2: Documentation Reading and Indexing
      if (this.config.enableIndexing) {
        spinner.text = 'Reading documentation and indexing codebase...';
        await this.buildProjectIndex();
      }

      // Phase 3: Initial Analysis
      if (this.projectIndex) {
        spinner.text = 'Performing initial analysis...';
        await this.performInitialAnalysis();
      }

      const endTime = performance.now();
      const initTime = Math.round(endTime - startTime);

      spinner.succeed(`Enhanced CodeCrucible Agent initialized in ${initTime}ms`);
      
      if (this.projectIndex) {
        this.displayWelcomeMessage();
      }

      this.startupCompleted = true;

    } catch (error) {
      spinner.fail('Failed to initialize Enhanced CodeCrucible Agent');
      logger.error('Initialization error:', error);
      throw error;
    }
  }

  async analyzeQuery(query: string): Promise<string> {
    if (!this.startupCompleted) {
      await this.initialize();
    }
    
    try {
      // If we have a project index, use it for enhanced analysis
      if (this.projectIndex) {
        const response = this.createProjectBasedResponse(query);
        
        if (this.config.outputFormat === 'json') {
          return JSON.stringify(response, null, 2);
        } else if (this.config.outputFormat === 'structured') {
          return this.formatter.renderResponse(response);
        } else {
          return response.summary;
        }
      }

      // Fallback to simple analysis
      return await this.performSimpleAnalysis(query);

    } catch (error) {
      logger.error('Analysis error:', error);
      return this.formatError(error);
    }
  }

  async analyzeCode(code: string, language: string): Promise<string> {
    if (!this.startupCompleted) {
      await this.initialize();
    }

    try {
      const response = createStructuredResponse(undefined, code, language, {
        maxWidth: process.stdout.columns || 120,
        useColors: process.stdout.isTTY
      });

      if (this.config.outputFormat === 'json') {
        return JSON.stringify(response, null, 2);
      } else if (this.config.outputFormat === 'structured') {
        return this.formatter.renderResponse(response);
      } else {
        return response.summary;
      }

    } catch (error) {
      logger.error('Code analysis error:', error);
      return this.formatError(error);
    }
  }

  async refreshIndex(): Promise<void> {
    const spinner = ora('Refreshing project index...').start();
    
    try {
      this.projectIndex = null;
      this.indexCache.clear();
      await this.buildProjectIndex();
      spinner.succeed('Project index refreshed successfully');
    } catch (error) {
      spinner.fail('Failed to refresh project index');
      throw error;
    }
  }

  getProjectSummary(): string | null {
    if (!this.projectIndex) {
      return null;
    }

    const response = createStructuredResponse(this.projectIndex, undefined, undefined, {
      maxWidth: process.stdout.columns || 120,
      useColors: process.stdout.isTTY
    });

    return this.formatter.renderResponse(response);
  }

  searchProject(query: string): string[] {
    if (!this.projectIndex) {
      return [];
    }

    const results: string[] = [];

    // Search using Lunr
    try {
      const lunrResults = this.projectIndex.searchIndex.lunr.search(query);
      results.push(...lunrResults.map(r => r.ref));
    } catch (error) {
      logger.debug('Lunr search error:', error);
    }

    // Search using Fuse.js
    try {
      const fuseResults = this.projectIndex.searchIndex.fuse.search(query);
      results.push(...fuseResults.map(r => r.item.relativePath));
    } catch (error) {
      logger.debug('Fuse search error:', error);
    }

    // Remove duplicates and return
    return [...new Set(results)];
  }

  private async detectProjectType(): Promise<void> {
    const projectPath = this.config.projectPath;
    
    // Check for common project files
    const projectFiles = [
      'package.json',
      'requirements.txt',
      'Cargo.toml',
      'go.mod',
      'composer.json',
      'pom.xml',
      'build.gradle'
    ];

    let projectType = 'generic';
    for (const file of projectFiles) {
      if (existsSync(join(projectPath, file))) {
        projectType = file.split('.')[0];
        break;
      }
    }

    logger.debug(`Detected project type: ${projectType}`);
  }

  private async buildProjectIndex(): Promise<void> {
    const cacheKey = this.config.projectPath;
    const cached = this.indexCache.get(cacheKey);
    
    // Check if we have a valid cached index
    if (cached && this.config.cacheResults) {
      const age = (Date.now() - cached.timestamp) / (1000 * 60); // age in minutes
      if (age < this.config.maxCacheAge) {
        this.projectIndex = cached.index;
        logger.debug('Using cached project index');
        return;
      }
    }

    // Build new index
    const indexer = new EnhancedStartupIndexer(this.config.projectPath);
    this.projectIndex = await indexer.indexProject();

    // Cache the result
    if (this.config.cacheResults) {
      this.indexCache.set(cacheKey, {
        index: this.projectIndex,
        timestamp: Date.now(),
        hash: this.calculateIndexHash(this.projectIndex)
      });
    }

    logger.debug('Project index built successfully');
  }

  private async performInitialAnalysis(): Promise<void> {
    if (!this.projectIndex) return;

    // Log key findings
    const { metadata, analysis } = this.projectIndex;
    
    logger.info(`Project "${metadata.name}" indexed:`, {
      files: metadata.totalFiles,
      languages: Object.keys(metadata.languages).length,
      frameworks: metadata.frameworks.length,
      qualityScore: analysis.patterns.qualityScore
    });

    // Check for common issues
    if (analysis.patterns.qualityScore < 60) {
      logger.warn('Project quality score is below 60. Consider improvements.');
    }

    if (analysis.coverage.documented / analysis.coverage.total < 0.3) {
      logger.warn('Documentation coverage is low (<30%). Consider adding more docs.');
    }

    if (analysis.dependencies.external.length > 50) {
      logger.warn('High number of external dependencies detected. Consider cleanup.');
    }
  }

  private createProjectBasedResponse(query: string): AnalysisResponse {
    if (!this.projectIndex) {
      throw new Error('Project index not available');
    }

    // Create enhanced response using project context
    const response = createStructuredResponse(this.projectIndex, undefined, undefined, {
      maxWidth: process.stdout.columns || 120,
      useColors: process.stdout.isTTY
    });

    // Enhance with query-specific insights
    if (query.toLowerCase().includes('performance')) {
      response.recommendations.unshift('Performance analysis requested - check complexity metrics');
    }

    if (query.toLowerCase().includes('security')) {
      response.recommendations.unshift('Security analysis requested - review dependencies');
    }

    if (query.toLowerCase().includes('documentation')) {
      response.recommendations.unshift('Documentation analysis requested - check coverage');
    }

    return response;
  }

  private async performSimpleAnalysis(query: string): Promise<string> {
    // Fallback analysis for when project index is not available
    return `CodeCrucible Analysis for: "${query}"\n\n` +
           `Unfortunately, detailed project analysis is not available because the project indexing failed or was disabled.\n` +
           `Enable indexing for enhanced analysis capabilities.\n\n` +
           `Query processed at: ${new Date().toISOString()}`;
  }

  private displayWelcomeMessage(): void {
    if (!this.projectIndex || !process.stdout.isTTY) return;

    const { metadata, analysis } = this.projectIndex;
    
    console.log('');
    console.log(picocolors.cyan('🔍 Enhanced CodeCrucible Agent Ready!'));
    console.log('');
    console.log(picocolors.bold(`Project: ${metadata.name} v${metadata.version}`));
    console.log(`Files: ${metadata.totalFiles} | Languages: ${Object.keys(metadata.languages).length} | Quality: ${analysis.patterns.qualityScore}/100`);
    console.log('');
    console.log(picocolors.green('✅ Project indexed and ready for intelligent analysis'));
    console.log(picocolors.gray('Use enhanced commands for detailed insights and recommendations'));
    console.log('');
  }

  private formatError(error: any): string {
    const timestamp = new Date().toISOString();
    return `❌ CodeCrucible Error [${timestamp}]\n\n` +
           `${error.message || 'Unknown error occurred'}\n\n` +
           `Please check your configuration and try again.`;
  }

  private calculateIndexHash(index: ProjectIndex): string {
    // Simple hash based on key metadata
    const hashString = JSON.stringify({
      totalFiles: index.metadata.totalFiles,
      totalSize: index.metadata.totalSize,
      lastUpdate: index.metadata.indexedAt
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(36);
  }

  // Getters for external access
  get isInitialized(): boolean {
    return this.startupCompleted;
  }

  get hasProjectIndex(): boolean {
    return this.projectIndex !== null;
  }

  get projectMetadata() {
    return this.projectIndex?.metadata || null;
  }

  get projectAnalysis() {
    return this.projectIndex?.analysis || null;
  }
}

// Export convenience function
export async function createEnhancedAgent(config?: Partial<EnhancedAgentConfig>): Promise<EnhancedCodeCrucibleAgent> {
  const agent = new EnhancedCodeCrucibleAgent(config);
  await agent.initialize();
  return agent;
}

// Export for direct CLI usage
export async function runEnhancedAnalysis(query: string, options: any = {}): Promise<string> {
  const agent = new EnhancedCodeCrucibleAgent({
    projectPath: options.cwd || process.cwd(),
    enableIndexing: options.index !== false,
    enableDocumentationReading: options.docs !== false,
    enableStructuredOutput: options.structured !== false,
    outputFormat: options.format || 'structured',
    verboseLogging: options.verbose || false
  });

  await agent.initialize();
  return await agent.analyzeQuery(query, options.context);
}
