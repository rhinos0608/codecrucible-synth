/**
 * Optimized Context-Aware CLI - Performance Enhanced
 * Iteration 4: Optimize memory usage and performance
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger.js';
import {
  LazyProjectIntelligenceSystem,
  BasicProjectInfo,
} from './lazy-project-intelligence.js';
import { ProjectIntelligence } from './project-intelligence-system.js';
import {
  ContextAwareOptions,
  ContextualPromptEnhancement,
  ContextInformation,
  SmartSuggestion,
  IntelligentCommand,
} from './context-aware-cli-integration.js';
// import chalk from 'chalk';

export interface OptimizedContextOptions extends ContextAwareOptions {
  lazyLoading?: boolean;
  preloadInBackground?: boolean;
  quickStart?: boolean;
  maxInitTime?: number;
}

export interface QuickContextInfo {
  available: boolean;
  basic: BasicProjectInfo | null;
  fullLoaded: boolean;
  loading: boolean;
  confidence: number;
}

export class OptimizedContextAwareCLI extends EventEmitter {
  private logger: Logger;
  private lazyIntelligence: LazyProjectIntelligenceSystem;
  private currentWorkingDir: string = process.cwd();
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  constructor() {
    super();
    this.logger = new Logger('OptimizedContextCLI');
    this.lazyIntelligence = new LazyProjectIntelligenceSystem();
  }

  /**
   * Fast initialization with minimal project analysis
   */
  async quickInitialize(
    workingDir: string = process.cwd(),
    options: OptimizedContextOptions = {}
  ): Promise<void> {
    const startTime = Date.now();
    this.currentWorkingDir = workingDir;

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.performQuickInitialization(workingDir, options);

    try {
      await this.initializationPromise;

      const initTime = Date.now() - startTime;
      this.logger.info(`Quick initialization completed in ${initTime}ms`);
      this.isInitialized = true;

      this.emit('initialized', { workingDir, options, initTime });
    } catch (error) {
      this.logger.warn(`Quick initialization failed: ${error}`);
      this.isInitialized = false;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Perform quick initialization
   */
  private async performQuickInitialization(
    workingDir: string,
    options: OptimizedContextOptions
  ): Promise<void> {
    try {
      // Quick analysis only
      await this.lazyIntelligence.quickAnalysis(workingDir);

      // Preload full intelligence in background if enabled
      if (options.preloadInBackground !== false) {
        this.lazyIntelligence.preloadIntelligence(workingDir);
      }
    } catch (error) {
      this.logger.warn(`Quick initialization warning: ${error}`);
      // Don't throw - we can still work in basic mode
    }
  }

  /**
   * Enhanced prompt processing with lazy context loading
   */
  async enhancePromptWithContext(
    prompt: string,
    options: OptimizedContextOptions = {}
  ): Promise<ContextualPromptEnhancement> {
    const basic = await this.lazyIntelligence.getBasicInfo(this.currentWorkingDir);

    if (!basic) {
      return this.getEmptyEnhancement(prompt);
    }

    // Build context from basic info first
    const quickContext = this.buildQuickContext(basic);

    // Check if we should wait for full intelligence
    const shouldWaitForFull = this.shouldWaitForFullIntelligence(prompt, options);

    if (shouldWaitForFull) {
      try {
        const fullIntelligence = await this.lazyIntelligence.getFullIntelligence(
          this.currentWorkingDir
        );
        if (fullIntelligence) {
          return this.enhanceWithFullContext(prompt, fullIntelligence, options);
        }
      } catch (error) {
        this.logger.warn(`Full context loading failed, using basic context: ${error}`);
      }
    }

    // Use quick context enhancement
    return this.enhanceWithQuickContext(prompt, quickContext, options);
  }

  /**
   * Build quick context from basic project info
   */
  private buildQuickContext(basic: BasicProjectInfo): ContextInformation {
    return {
      projectType: basic.type,
      primaryLanguage: basic.language,
      frameworks: this.detectFrameworksFromBasic(basic),
      architecture: this.inferArchitectureFromBasic(basic),
      relevantFiles: [],
      codePatterns: this.getBasicPatterns(basic),
      dependencies: [],
      recommendations: this.getBasicRecommendations(basic),
    };
  }

  /**
   * Detect frameworks from basic info
   */
  private detectFrameworksFromBasic(basic: BasicProjectInfo): string[] {
    const frameworks: string[] = [];

    if (basic.hasPackageJson) {
      // We'd need to read package.json for accurate detection
      // For now, make educated guesses based on project type
      if (basic.type === 'application') {
        if (basic.language === 'TypeScript' || basic.language === 'JavaScript') {
          frameworks.push('Node.js');
        }
      }
    }

    return frameworks;
  }

  /**
   * Infer architecture from basic info
   */
  private inferArchitectureFromBasic(basic: BasicProjectInfo): string {
    if (basic.type === 'library') return 'modular';
    if (basic.type === 'service') return 'microservices';
    if (basic.hasTestDir) return 'layered';
    return 'unknown';
  }

  /**
   * Get basic code patterns
   */
  private getBasicPatterns(basic: BasicProjectInfo): string[] {
    const patterns: string[] = [];

    if (basic.hasTestDir) patterns.push('testing patterns');
    if (basic.language === 'TypeScript') patterns.push('type safety');
    if (basic.type === 'library') patterns.push('modular design');

    return patterns;
  }

  /**
   * Get basic recommendations
   */
  private getBasicRecommendations(basic: BasicProjectInfo): string[] {
    const recommendations: string[] = [];

    if (!basic.hasTestDir) {
      recommendations.push('Add comprehensive tests');
    }

    if (basic.estimatedSize === 'large' || basic.estimatedSize === 'huge') {
      recommendations.push('Consider modular architecture');
    }

    if (basic.language === 'Unknown') {
      recommendations.push('Improve code organization');
    }

    return recommendations;
  }

  /**
   * Determine if we should wait for full intelligence
   */
  private shouldWaitForFullIntelligence(prompt: string, options: OptimizedContextOptions): boolean {
    // Don't wait if quick start is enabled
    if (options.quickStart) return false;

    // Wait for specific keywords that benefit from full analysis
    const fullAnalysisKeywords = [
      'analyze',
      'review',
      'refactor',
      'architecture',
      'dependencies',
      'security',
      'performance',
      'structure',
      'patterns',
    ];

    const promptLower = prompt.toLowerCase();
    return fullAnalysisKeywords.some(keyword => promptLower.includes(keyword));
  }

  /**
   * Enhance prompt with quick context
   */
  private enhanceWithQuickContext(
    prompt: string,
    context: ContextInformation,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: OptimizedContextOptions
  ): ContextualPromptEnhancement {
    const enhancedPrompt = this.buildEnhancedPrompt(prompt, context, false);
    const suggestions = this.generateQuickSuggestions(context);

    return {
      originalPrompt: prompt,
      enhancedPrompt,
      contextAdded: context,
      confidence: this.calculateQuickConfidence(context),
      suggestions: suggestions.map(s => s.title),
    };
  }

  /**
   * Enhance prompt with full context
   */
  private enhanceWithFullContext(
    prompt: string,
    intelligence: ProjectIntelligence,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: OptimizedContextOptions
  ): ContextualPromptEnhancement {
    const context = this.buildFullContext(intelligence);
    const enhancedPrompt = this.buildEnhancedPrompt(prompt, context, true);
    const suggestions = this.generateFullSuggestions(intelligence);

    return {
      originalPrompt: prompt,
      enhancedPrompt,
      contextAdded: context,
      confidence: this.calculateFullConfidence(context),
      suggestions: suggestions.map(s => s.title),
    };
  }

  /**
   * Build enhanced prompt
   */
  private buildEnhancedPrompt(
    prompt: string,
    context: ContextInformation,
    isFull: boolean
  ): string {
    let enhancedPrompt = `# Project Context
**Project Type**: ${context.projectType}
**Primary Language**: ${context.primaryLanguage}
**Architecture**: ${context.architecture}`;

    if (context.frameworks.length > 0) {
      enhancedPrompt += `\n**Frameworks**: ${context.frameworks.join(', ')}`;
    }

    if (isFull && context.relevantFiles.length > 0) {
      enhancedPrompt += `\n\n**Relevant Files**:\n${context.relevantFiles
        .slice(0, 5)
        .map(f => `- ${f}`)
        .join('\n')}`;
    }

    if (context.codePatterns.length > 0) {
      enhancedPrompt += `\n\n**Code Patterns**: ${context.codePatterns.join(', ')}`;
    }

    if (context.recommendations.length > 0) {
      enhancedPrompt += `\n\n**Context Notes**: ${context.recommendations.slice(0, 3).join(', ')}`;
    }

    enhancedPrompt += `\n\n# User Request
${prompt}

Please provide a response considering the project context above.`;

    return enhancedPrompt;
  }

  /**
   * Build full context from intelligence
   */
  private buildFullContext(intelligence: ProjectIntelligence): ContextInformation {
    return {
      projectType: intelligence.insights.projectType,
      primaryLanguage: intelligence.insights.primaryLanguage,
      frameworks: intelligence.insights.frameworksDetected.map(f => f.name),
      architecture: intelligence.patterns.primaryPattern,
      relevantFiles: intelligence.structure.files
        .filter(f => f.importance === 'critical' || f.importance === 'high')
        .slice(0, 10)
        .map(f => f.path),
      codePatterns: intelligence.patterns.secondaryPatterns,
      dependencies: intelligence.dependencies.externalDependencies.slice(0, 10).map(d => d.name),
      recommendations: intelligence.recommendations.codeImprovement
        .filter(r => r.priority === 'high')
        .slice(0, 5)
        .map(r => r.description),
    };
  }

  /**
   * Generate quick suggestions
   */
  private generateQuickSuggestions(context: ContextInformation): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    if (context.primaryLanguage === 'TypeScript') {
      suggestions.push({
        type: 'command',
        title: 'Type Check',
        description: 'Run TypeScript type checking',
        action: 'tsc --noEmit',
        confidence: 0.9,
        rationale: 'TypeScript project detected',
      });
    }

    if (context.projectType === 'library') {
      suggestions.push({
        type: 'command',
        title: 'Build Library',
        description: 'Build the library for distribution',
        confidence: 0.8,
        rationale: 'Library project type',
      });
    }

    return suggestions;
  }

  /**
   * Generate full suggestions
   */
  private generateFullSuggestions(intelligence: ProjectIntelligence): SmartSuggestion[] {
    // Use the full intelligence system to generate comprehensive suggestions
    // This would be more detailed than quick suggestions
    const suggestions = this.generateQuickSuggestions(this.buildFullContext(intelligence));

    // Add intelligence-based suggestions
    if (intelligence.insights.codeQuality.testCoverage < 80) {
      suggestions.push({
        type: 'improvement',
        title: 'Improve Test Coverage',
        description: `Current coverage: ${intelligence.insights.codeQuality.testCoverage.toFixed(1)}%`,
        confidence: 0.85,
        rationale: 'Low test coverage detected',
      });
    }

    return suggestions;
  }

  /**
   * Calculate quick confidence
   */
  private calculateQuickConfidence(context: ContextInformation): number {
    let confidence = 0.3; // Base confidence for quick analysis

    if (context.projectType !== 'unknown') confidence += 0.2;
    if (context.primaryLanguage !== 'Unknown') confidence += 0.2;
    if (context.frameworks.length > 0) confidence += 0.1;
    if (context.codePatterns.length > 0) confidence += 0.1;

    return Math.min(confidence, 0.8); // Max 80% for quick analysis
  }

  /**
   * Calculate full confidence
   */
  private calculateFullConfidence(context: ContextInformation): number {
    let confidence = 0.6; // Base confidence for full analysis

    if (context.projectType !== 'unknown') confidence += 0.15;
    if (context.primaryLanguage !== 'Unknown') confidence += 0.1;
    if (context.frameworks.length > 0) confidence += 0.05;
    if (context.relevantFiles.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Get empty enhancement fallback
   */
  private getEmptyEnhancement(prompt: string): ContextualPromptEnhancement {
    return {
      originalPrompt: prompt,
      enhancedPrompt: prompt,
      contextAdded: {
        projectType: 'unknown',
        primaryLanguage: 'Unknown',
        frameworks: [],
        architecture: 'unknown',
        relevantFiles: [],
        codePatterns: [],
        dependencies: [],
        recommendations: [],
      },
      confidence: 0,
      suggestions: [],
    };
  }

  /**
   * Get quick context status
   */
  async getContextStatus(): Promise<QuickContextInfo> {
    const basic = await this.lazyIntelligence.getBasicInfo(this.currentWorkingDir);
    const fullLoaded = await this.lazyIntelligence.isFullyLoaded(this.currentWorkingDir);
    const loading = await this.lazyIntelligence.isLoading(this.currentWorkingDir);

    return {
      available: basic !== null,
      basic,
      fullLoaded,
      loading,
      confidence: basic ? this.calculateQuickConfidence(this.buildQuickContext(basic)) : 0,
    };
  }

  /**
   * Force load full intelligence
   */
  async loadFullIntelligence(force = false): Promise<ProjectIntelligence | null> {
    return await this.lazyIntelligence.getFullIntelligence(this.currentWorkingDir, force);
  }

  /**
   * Get intelligent commands (optimized)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getIntelligentCommands(context?: string): Promise<IntelligentCommand[]> {
    const basic = await this.lazyIntelligence.getBasicInfo(this.currentWorkingDir);
    if (!basic) return [];

    const commands: IntelligentCommand[] = [];

    // Language-specific commands
    if (basic.language === 'TypeScript') {
      commands.push({
        command: 'tsc',
        description: 'TypeScript compiler',
        examples: ['tsc', 'tsc --watch'],
        contextRelevance: 0.9,
        suggestedArgs: ['--watch', '--build', '--noEmit'],
      });
    }

    // Project type specific commands
    if (basic.hasPackageJson) {
      commands.push({
        command: 'npm test',
        description: 'Run package tests',
        examples: ['npm test', 'npm run test'],
        contextRelevance: 0.8,
        suggestedArgs: ['--watch', '--coverage'],
      });
    }

    return commands;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      isInitialized: this.isInitialized,
      contextStatus: this.getContextStatus(),
      lazyMetrics: this.lazyIntelligence.getMetrics(),
    };
  }

  /**
   * Clear all caches and reset
   */
  clearCache(): void {
    this.lazyIntelligence.clearCache();
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    this.lazyIntelligence.shutdown();
    this.removeAllListeners();
  }
}

export default OptimizedContextAwareCLI;
