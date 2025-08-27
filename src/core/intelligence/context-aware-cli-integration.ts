/**
 * Context-Aware CLI Integration - Enhanced CLI with Project Intelligence
 * Iteration 3: Add enhanced context awareness and project intelligence
 */

import { EventEmitter } from 'events';
import { join, relative, basename, dirname } from 'path';
import { readFile, stat } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { Logger } from '../logger.js';
import {
  ProjectIntelligenceSystem,
  ProjectIntelligence,
  AnalysisOptions,
} from './project-intelligence-system.js';
import { ExecutionRequest } from '../types.js';
import { UnifiedModelClient } from '../../application/services/client.js';

export interface ContextAwareOptions {
  enableIntelligence?: boolean;
  maxContextFiles?: number;
  contextDepth?: number;
  intelligentSuggestions?: boolean;
  projectAnalysis?: boolean;
  smartNavigation?: boolean;
  contextualRecommendations?: boolean;
}

export interface ContextualPromptEnhancement {
  originalPrompt: string;
  enhancedPrompt: string;
  contextAdded: ContextInformation;
  confidence: number;
  suggestions: string[];
}

export interface ContextInformation {
  projectType: string;
  primaryLanguage: string;
  frameworks: string[];
  architecture: string;
  relevantFiles: string[];
  codePatterns: string[];
  dependencies: string[];
  recommendations: string[];
}

export interface SmartSuggestion {
  type: 'command' | 'file' | 'pattern' | 'improvement';
  title: string;
  description: string;
  action?: string;
  confidence: number;
  rationale: string;
}

export interface NavigationContext {
  currentPath: string;
  relatedFiles: string[];
  suggestedFiles: string[];
  keyDirectories: string[];
  navigationHistory: string[];
}

export interface IntelligentCommand {
  command: string;
  description: string;
  examples: string[];
  contextRelevance: number;
  suggestedArgs: string[];
}

export class ContextAwareCLIIntegration extends EventEmitter {
  private logger: Logger;
  private intelligenceSystem: ProjectIntelligenceSystem;
  private projectCache: Map<string, ProjectIntelligence> = new Map();
  private contextHistory: Map<string, ContextInformation[]> = new Map();
  private navigationHistory: string[] = [];
  private currentWorkingDir: string = process.cwd();

  constructor() {
    super();
    this.logger = new Logger('ContextAwareCLI');
    this.intelligenceSystem = new ProjectIntelligenceSystem();
  }

  /**
   * Initialize context-aware CLI with project intelligence
   */
  async initialize(
    workingDir: string = process.cwd(),
    options: ContextAwareOptions = {}
  ): Promise<void> {
    this.currentWorkingDir = workingDir;
    this.logger.info(`Initializing context-aware CLI in ${workingDir}`);

    if (options.enableIntelligence !== false) {
      try {
        await this.loadProjectIntelligence(workingDir, options);
      } catch (error) {
        this.logger.warn('Failed to load project intelligence:', error);
      }
    }

    this.emit('initialized', { workingDir, options });
  }

  /**
   * Load or update project intelligence
   */
  async loadProjectIntelligence(
    projectPath: string,
    options: ContextAwareOptions = {}
  ): Promise<ProjectIntelligence> {
    const spinner = ora('🧠 Analyzing project structure and generating intelligence...').start();

    try {
      const analysisOptions: AnalysisOptions = {
        force: false,
        maxDepth: options.contextDepth || 5,
        includeTests: true,
        skipLargeFiles: true,
        maxFileSize: 1024 * 1024, // 1MB
      };

      const intelligence = await this.intelligenceSystem.analyzeProject(
        projectPath,
        analysisOptions
      );
      this.projectCache.set(projectPath, intelligence);

      spinner.succeed(
        `🎯 Project intelligence loaded: ${intelligence.insights.projectType} project with ${intelligence.insights.primaryLanguage}`
      );

      // Display quick project overview
      this.displayProjectOverview(intelligence);

      return intelligence;
    } catch (error) {
      spinner.fail('❌ Failed to analyze project');
      throw error;
    }
  }

  /**
   * Enhance user prompts with project context
   */
  async enhancePromptWithContext(
    prompt: string,
    options: ContextAwareOptions = {}
  ): Promise<ContextualPromptEnhancement> {
    const intelligence = this.projectCache.get(this.currentWorkingDir);
    if (!intelligence) {
      return {
        originalPrompt: prompt,
        enhancedPrompt: prompt,
        contextAdded: this.getEmptyContext(),
        confidence: 0,
        suggestions: [],
      };
    }

    const contextInfo = await this.buildContextInformation(prompt, intelligence, options);
    const enhancedPrompt = this.constructEnhancedPrompt(prompt, contextInfo);
    const suggestions = await this.generateSmartSuggestions(prompt, intelligence);

    return {
      originalPrompt: prompt,
      enhancedPrompt,
      contextAdded: contextInfo,
      confidence: this.calculateContextConfidence(contextInfo),
      suggestions: suggestions.map(s => s.title),
    };
  }

  /**
   * Build contextual information for a given prompt
   */
  private async buildContextInformation(
    prompt: string,
    intelligence: ProjectIntelligence,
    options: ContextAwareOptions
  ): Promise<ContextInformation> {
    const relevantFiles = await this.findRelevantFiles(
      prompt,
      intelligence,
      options.maxContextFiles || 5
    );
    const codePatterns = this.identifyRelevantPatterns(prompt, intelligence);
    const recommendations = this.generateContextualRecommendations(prompt, intelligence);

    return {
      projectType: intelligence.insights.projectType,
      primaryLanguage: intelligence.insights.primaryLanguage,
      frameworks: intelligence.insights.frameworksDetected.map(f => f.name),
      architecture: intelligence.patterns.primaryPattern,
      relevantFiles,
      codePatterns,
      dependencies: intelligence.dependencies.externalDependencies.slice(0, 10).map(d => d.name),
      recommendations,
    };
  }

  /**
   * Find files relevant to the user's prompt
   */
  private async findRelevantFiles(
    prompt: string,
    intelligence: ProjectIntelligence,
    maxFiles: number
  ): Promise<string[]> {
    const promptLower = prompt.toLowerCase();
    const relevantFiles: Array<{ path: string; score: number }> = [];

    // Score files based on relevance to prompt
    for (const file of intelligence.structure.files) {
      let score = 0;

      // Check filename relevance
      if (file.name.toLowerCase().includes(promptLower)) score += 10;

      // Check path relevance
      if (file.path.toLowerCase().includes(promptLower)) score += 5;

      // Boost important files
      if (file.importance === 'critical') score += 8;
      else if (file.importance === 'high') score += 4;

      // Language relevance
      if (promptLower.includes(file.language.toLowerCase())) score += 6;

      // Purpose relevance
      if (promptLower.includes('test') && file.purpose === 'test') score += 7;
      if (promptLower.includes('config') && file.purpose === 'config') score += 7;
      if (promptLower.includes('util') && file.purpose === 'utility') score += 5;

      // File type relevance
      if (promptLower.includes('component') && file.name.toLowerCase().includes('component'))
        score += 8;
      if (promptLower.includes('service') && file.name.toLowerCase().includes('service'))
        score += 8;
      if (promptLower.includes('model') && file.name.toLowerCase().includes('model')) score += 8;

      if (score > 0) {
        relevantFiles.push({ path: file.path, score });
      }
    }

    // Sort by score and return top files
    return relevantFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFiles)
      .map(f => f.path);
  }

  /**
   * Identify code patterns relevant to the prompt
   */
  private identifyRelevantPatterns(prompt: string, intelligence: ProjectIntelligence): string[] {
    const patterns: string[] = [];
    const promptLower = prompt.toLowerCase();

    // Architecture patterns
    if (intelligence.patterns.primaryPattern) {
      patterns.push(`${intelligence.patterns.primaryPattern} architecture`);
    }

    // Framework patterns
    for (const framework of intelligence.insights.frameworksDetected) {
      if (promptLower.includes(framework.name.toLowerCase())) {
        patterns.push(`${framework.name} patterns`);
      }
    }

    // Common development patterns
    if (promptLower.includes('async') || promptLower.includes('promise')) {
      patterns.push('asynchronous programming');
    }
    if (promptLower.includes('test')) {
      patterns.push('testing patterns');
    }
    if (promptLower.includes('error') || promptLower.includes('exception')) {
      patterns.push('error handling');
    }

    return patterns;
  }

  /**
   * Generate contextual recommendations
   */
  private generateContextualRecommendations(
    prompt: string,
    intelligence: ProjectIntelligence
  ): string[] {
    const recommendations: string[] = [];
    const promptLower = prompt.toLowerCase();

    // Code quality recommendations
    if (intelligence.insights.codeQuality.maintainabilityIndex < 70) {
      recommendations.push('Consider refactoring for better maintainability');
    }

    // Testing recommendations
    if (intelligence.insights.codeQuality.testCoverage < 80) {
      recommendations.push('Add more comprehensive tests');
    }

    // Security recommendations
    if (intelligence.insights.securityConcerns.length > 0) {
      recommendations.push('Review security concerns in the codebase');
    }

    // Performance recommendations
    if (intelligence.insights.performanceIndicators.some(p => p.status !== 'good')) {
      recommendations.push('Consider performance optimizations');
    }

    // Framework-specific recommendations
    for (const framework of intelligence.insights.frameworksDetected) {
      if (promptLower.includes(framework.name.toLowerCase())) {
        recommendations.push(`Follow ${framework.name} best practices`);
      }
    }

    return recommendations;
  }

  /**
   * Construct enhanced prompt with context
   */
  private constructEnhancedPrompt(prompt: string, context: ContextInformation): string {
    let enhancedPrompt = `# Project Context
**Project Type**: ${context.projectType}
**Primary Language**: ${context.primaryLanguage}
**Architecture**: ${context.architecture}`;

    if (context.frameworks.length > 0) {
      enhancedPrompt += `\n**Frameworks**: ${context.frameworks.join(', ')}`;
    }

    if (context.relevantFiles.length > 0) {
      enhancedPrompt += `\n\n**Relevant Files**:\n${context.relevantFiles.map(f => `- ${f}`).join('\n')}`;
    }

    if (context.codePatterns.length > 0) {
      enhancedPrompt += `\n\n**Code Patterns**: ${context.codePatterns.join(', ')}`;
    }

    if (context.recommendations.length > 0) {
      enhancedPrompt += `\n\n**Recommendations**: ${context.recommendations.join(', ')}`;
    }

    enhancedPrompt += `\n\n# User Request
${prompt}

Please provide a response that takes into account the project context above and follows the established patterns and practices in this codebase.`;

    return enhancedPrompt;
  }

  /**
   * Generate smart suggestions based on prompt and project context
   */
  async generateSmartSuggestions(
    prompt: string,
    intelligence: ProjectIntelligence
  ): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];
    const promptLower = prompt.toLowerCase();

    // Command suggestions
    if (promptLower.includes('test')) {
      suggestions.push({
        type: 'command',
        title: 'Run Tests',
        description: 'Execute the project test suite',
        action: 'npm test',
        confidence: 0.9,
        rationale: 'User mentioned testing',
      });
    }

    if (promptLower.includes('build')) {
      suggestions.push({
        type: 'command',
        title: 'Build Project',
        description: 'Build the project for production',
        action: 'npm run build',
        confidence: 0.85,
        rationale: 'User mentioned building',
      });
    }

    // File suggestions
    if (intelligence.structure.files.some(f => f.name.toLowerCase().includes('readme'))) {
      suggestions.push({
        type: 'file',
        title: 'Check Documentation',
        description: 'Review project README and documentation',
        confidence: 0.7,
        rationale: 'Documentation exists for context',
      });
    }

    // Pattern suggestions
    for (const pattern of intelligence.patterns.secondaryPatterns) {
      suggestions.push({
        type: 'pattern',
        title: `Apply ${pattern} Pattern`,
        description: `Consider using ${pattern} pattern for this implementation`,
        confidence: 0.6,
        rationale: `Pattern used elsewhere in codebase`,
      });
    }

    // Improvement suggestions
    if (intelligence.insights.codeQuality.maintainabilityIndex < 80) {
      suggestions.push({
        type: 'improvement',
        title: 'Refactor for Maintainability',
        description: 'Consider refactoring to improve code maintainability',
        confidence: 0.75,
        rationale: 'Current maintainability index is below optimal',
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  /**
   * Display project overview
   */
  private displayProjectOverview(intelligence: ProjectIntelligence): void {
    console.log(chalk.cyan('\n📊 Project Overview:'));
    console.log(chalk.gray(`   Type: ${intelligence.insights.projectType}`));
    console.log(chalk.gray(`   Language: ${intelligence.insights.primaryLanguage}`));
    console.log(chalk.gray(`   Architecture: ${intelligence.patterns.primaryPattern}`));
    console.log(
      chalk.gray(
        `   Files: ${intelligence.structure.totalFiles} (${intelligence.structure.totalDirectories} directories)`
      )
    );

    if (intelligence.insights.frameworksDetected.length > 0) {
      console.log(
        chalk.gray(
          `   Frameworks: ${intelligence.insights.frameworksDetected.map(f => f.name).join(', ')}`
        )
      );
    }

    const qualityColor =
      intelligence.insights.codeQuality.maintainabilityIndex >= 80
        ? chalk.green
        : intelligence.insights.codeQuality.maintainabilityIndex >= 60
          ? chalk.yellow
          : chalk.red;
    console.log(
      qualityColor(`   Code Quality: ${intelligence.insights.codeQuality.maintainabilityIndex}/100`)
    );
  }

  /**
   * Get navigation context for current directory
   */
  async getNavigationContext(): Promise<NavigationContext> {
    const intelligence = this.projectCache.get(this.currentWorkingDir);
    if (!intelligence) {
      return {
        currentPath: this.currentWorkingDir,
        relatedFiles: [],
        suggestedFiles: [],
        keyDirectories: [],
        navigationHistory: this.navigationHistory,
      };
    }

    // Find related files based on current location
    const currentRelative = relative(intelligence.structure.rootPath, this.currentWorkingDir);
    const relatedFiles = intelligence.structure.files
      .filter(f => f.path.startsWith(currentRelative))
      .slice(0, 10)
      .map(f => f.path);

    // Suggest important files
    const suggestedFiles = intelligence.structure.files
      .filter(f => f.importance === 'critical' || f.importance === 'high')
      .slice(0, 5)
      .map(f => f.path);

    // Key directories
    const keyDirectories = intelligence.structure.directories
      .filter(d => d.importance === 'high' && d.depth <= 2)
      .map(d => d.path);

    return {
      currentPath: this.currentWorkingDir,
      relatedFiles,
      suggestedFiles,
      keyDirectories,
      navigationHistory: this.navigationHistory,
    };
  }

  /**
   * Get intelligent command suggestions
   */
  async getIntelligentCommands(context?: string): Promise<IntelligentCommand[]> {
    const intelligence = this.projectCache.get(this.currentWorkingDir);
    if (!intelligence) {
      return this.getBasicCommands();
    }

    const commands: IntelligentCommand[] = [];

    // Add project-specific commands
    for (const pkg of intelligence.structure.packageFiles) {
      if (pkg.scripts) {
        for (const [script, command] of Object.entries(pkg.scripts)) {
          commands.push({
            command: `npm run ${script}`,
            description: `Run ${script} script: ${command}`,
            examples: [`npm run ${script}`],
            contextRelevance: 0.9,
            suggestedArgs: [],
          });
        }
      }
    }

    // Add framework-specific commands
    for (const framework of intelligence.insights.frameworksDetected) {
      const frameworkCommands = this.getFrameworkCommands(framework.name);
      commands.push(...frameworkCommands);
    }

    // Add language-specific commands
    const languageCommands = this.getLanguageCommands(intelligence.insights.primaryLanguage);
    commands.push(...languageCommands);

    return commands.sort((a, b) => b.contextRelevance - a.contextRelevance);
  }

  /**
   * Calculate context confidence score
   */
  private calculateContextConfidence(context: ContextInformation): number {
    let confidence = 0;

    if (context.projectType !== 'unknown') confidence += 0.2;
    if (context.primaryLanguage !== 'Unknown') confidence += 0.2;
    if (context.frameworks.length > 0) confidence += 0.2;
    if (context.relevantFiles.length > 0) confidence += 0.2;
    if (context.recommendations.length > 0) confidence += 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * Get basic commands when no project intelligence available
   */
  private getBasicCommands(): IntelligentCommand[] {
    return [
      {
        command: 'analyze',
        description: 'Analyze current project or file',
        examples: ['crucible analyze .', 'crucible analyze file.js'],
        contextRelevance: 0.8,
        suggestedArgs: ['.', '*.js', '*.ts'],
      },
      {
        command: 'help',
        description: 'Show available commands and options',
        examples: ['crucible help', 'crucible --help'],
        contextRelevance: 0.6,
        suggestedArgs: [],
      },
    ];
  }

  /**
   * Get framework-specific commands
   */
  private getFrameworkCommands(framework: string): IntelligentCommand[] {
    const frameworkMap: Record<string, IntelligentCommand[]> = {
      React: [
        {
          command: 'create-react-app',
          description: 'Create a new React application',
          examples: ['npx create-react-app my-app'],
          contextRelevance: 0.8,
          suggestedArgs: [],
        },
      ],
      Vue: [
        {
          command: 'vue create',
          description: 'Create a new Vue.js project',
          examples: ['vue create my-project'],
          contextRelevance: 0.8,
          suggestedArgs: [],
        },
      ],
      Express: [
        {
          command: 'express-generator',
          description: 'Generate Express application skeleton',
          examples: ['npx express-generator my-app'],
          contextRelevance: 0.8,
          suggestedArgs: [],
        },
      ],
    };

    return frameworkMap[framework] || [];
  }

  /**
   * Get language-specific commands
   */
  private getLanguageCommands(language: string): IntelligentCommand[] {
    const languageMap: Record<string, IntelligentCommand[]> = {
      JavaScript: [
        {
          command: 'node',
          description: 'Run JavaScript file with Node.js',
          examples: ['node app.js', 'node --version'],
          contextRelevance: 0.7,
          suggestedArgs: [],
        },
      ],
      TypeScript: [
        {
          command: 'tsc',
          description: 'TypeScript compiler',
          examples: ['tsc', 'tsc --watch'],
          contextRelevance: 0.8,
          suggestedArgs: ['--watch', '--build'],
        },
      ],
      Python: [
        {
          command: 'python',
          description: 'Run Python scripts',
          examples: ['python app.py', 'python -m pip install'],
          contextRelevance: 0.7,
          suggestedArgs: ['-m', '--version'],
        },
      ],
    };

    return languageMap[language] || [];
  }

  /**
   * Get empty context for fallback
   */
  private getEmptyContext(): ContextInformation {
    return {
      projectType: 'unknown',
      primaryLanguage: 'Unknown',
      frameworks: [],
      architecture: 'unknown',
      relevantFiles: [],
      codePatterns: [],
      dependencies: [],
      recommendations: [],
    };
  }

  /**
   * Update navigation history
   */
  updateNavigationHistory(path: string): void {
    this.navigationHistory.unshift(path);
    if (this.navigationHistory.length > 20) {
      this.navigationHistory.pop();
    }
    this.currentWorkingDir = path;
  }

  /**
   * Get cached project intelligence
   */
  getProjectIntelligence(path?: string): ProjectIntelligence | null {
    return this.projectCache.get(path || this.currentWorkingDir) || null;
  }

  /**
   * Clear project cache
   */
  clearProjectCache(path?: string): void {
    if (path) {
      this.projectCache.delete(path);
    } else {
      this.projectCache.clear();
    }
  }

  /**
   * Get system metrics
   */
  getMetrics(): any {
    return {
      cachedProjects: this.projectCache.size,
      navigationHistoryLength: this.navigationHistory.length,
      currentWorkingDir: this.currentWorkingDir,
      intelligenceSystem: this.intelligenceSystem.getSystemMetrics(),
    };
  }
}

export default ContextAwareCLIIntegration;
