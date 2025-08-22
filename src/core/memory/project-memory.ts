import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { logger } from '../logger.js';
import { SynthesisResult } from '../types.js';

export interface ProjectContext {
  guidance: string;
  preferences: VoicePreferences;
  constraints: string[];
  patterns: CodePattern[];
  history: InteractionSummary[];
  metadata: ProjectMetadata;
}

export interface VoicePreferences {
  primary: string[];
  secondary: string[];
  disabled: string[];
  customSettings: Record<string, any>;
}

export interface CodePattern {
  name: string;
  description: string;
  pattern: string;
  examples: string[];
  category: 'architectural' | 'stylistic' | 'security' | 'performance';
}

export interface InteractionSummary {
  timestamp: number;
  prompt: string;
  response: string;
  voicesUsed: string[];
  outcome: 'successful' | 'partial' | 'failed';
  userFeedback?: 'positive' | 'negative' | 'neutral';
  topics: string[];
}

export interface ProjectMetadata {
  name: string;
  type: 'web' | 'mobile' | 'desktop' | 'library' | 'tool' | 'other';
  languages: string[];
  frameworks: string[];
  lastUpdated: number;
  totalInteractions: number;
  averageComplexity: number;
}

export interface ContextLayer {
  level: 'global' | 'repo' | 'subfolder';
  path: string;
  content: ProjectContext;
  priority: number;
}

export interface ContextHierarchy {
  layers: ContextLayer[];
  merged: ProjectContext;
  conflicts: ContextConflict[];
}

export interface ContextConflict {
  property: string;
  layers: string[];
  resolution: 'merge' | 'override' | 'manual';
  value: any;
}

/**
 * Project Memory System implementing hierarchical context management
 * Inspired by Codex CLI's AGENTS.md pattern with intelligent merging
 */
export class ProjectMemorySystem {
  private contextPath: string;
  private globalContextPath: string;
  private cache: Map<string, ContextHierarchy>;
  private watchedPaths: Set<string>;

  constructor(workspaceRoot: string) {
    this.contextPath = path.join(workspaceRoot, '.codecrucible');
    this.globalContextPath = path.join(homedir(), '.codecrucible');
    this.cache = new Map();
    this.watchedPaths = new Set();

    logger.info('Project memory system initialized', {
      contextPath: this.contextPath,
      globalPath: this.globalContextPath,
    });
  }

  /**
   * Load and merge project context from hierarchy
   */
  async loadProjectContext(currentPath?: string): Promise<ProjectContext> {
    const hierarchy = await this.loadContextHierarchy(currentPath);
    this.cache.set(currentPath || 'default', hierarchy);

    return hierarchy.merged;
  }

  /**
   * Save project context at appropriate level
   */
  async saveProjectContext(
    context: Partial<ProjectContext>,
    level: 'global' | 'repo' | 'subfolder' = 'repo',
    subfolderPath?: string
  ): Promise<void> {
    let targetPath: string;

    switch (level) {
      case 'global':
        targetPath = this.globalContextPath;
        break;
      case 'repo':
        targetPath = this.contextPath;
        break;
      case 'subfolder':
        if (!subfolderPath) {
          throw new Error('Subfolder path required for subfolder context');
        }
        targetPath = path.join(subfolderPath, '.codecrucible');
        break;
    }

    await this.ensureDirectoryExists(targetPath);

    // Load existing context to merge
    const existing = await this.loadContextFromPath(targetPath).catch(() =>
      this.createDefaultContext()
    );
    const merged = this.mergeContexts([existing, context]);

    // Save individual files
    await this.saveContextFiles(targetPath, merged);

    // Invalidate cache
    this.cache.clear();

    logger.info(`Saved project context at ${level} level`, { targetPath });
  }

  /**
   * Store interaction in project history
   */
  async storeInteraction(
    prompt: string,
    response: SynthesisResult,
    context: ProjectContext,
    userFeedback?: 'positive' | 'negative' | 'neutral'
  ): Promise<void> {
    const interaction: InteractionSummary = {
      timestamp: Date.now(),
      prompt: prompt.substring(0, 200), // Truncate for storage
      response: (response.synthesis || '').substring(0, 500), // Truncate for storage
      voicesUsed: response.voicesUsed,
      outcome:
        (response.confidence || 0) > 0.7
          ? 'successful'
          : (response.confidence || 0) > 0.4
            ? 'partial'
            : 'failed',
      userFeedback,
      topics: this.extractTopics(prompt, response),
    };

    // Add to current context
    context.history.unshift(interaction);

    // Keep only last 50 interactions
    context.history = context.history.slice(0, 50);

    // Update metadata
    context.metadata.totalInteractions++;
    context.metadata.lastUpdated = Date.now();
    context.metadata.averageComplexity = this.calculateAverageComplexity(context.history);

    // Save updated context
    await this.saveProjectContext(context, 'repo');

    logger.debug('Stored interaction in project memory', {
      outcome: interaction.outcome,
      voicesUsed: interaction.voicesUsed.length,
      topics: interaction.topics.length,
    });
  }

  /**
   * Search interaction history
   */
  async searchHistory(
    query: string,
    options: {
      limit?: number;
      timeRange?: { start: number; end: number };
      outcome?: 'successful' | 'partial' | 'failed';
      voices?: string[];
    } = {}
  ): Promise<InteractionSummary[]> {
    const context = await this.loadProjectContext();
    const { limit = 10, timeRange, outcome, voices } = options;

    let results = context.history;

    // Filter by time range
    if (timeRange) {
      results = results.filter(
        interaction =>
          interaction.timestamp >= timeRange.start && interaction.timestamp <= timeRange.end
      );
    }

    // Filter by outcome
    if (outcome) {
      results = results.filter(interaction => interaction.outcome === outcome);
    }

    // Filter by voices
    if (voices && voices.length > 0) {
      results = results.filter(interaction =>
        voices.some(voice => interaction.voicesUsed.includes(voice))
      );
    }

    // Search in content
    if (query.trim()) {
      const searchTerms = query.toLowerCase().split(' ');
      results = results.filter(interaction => {
        const searchContent =
          `${interaction.prompt} ${interaction.response} ${interaction.topics.join(' ')}`.toLowerCase();
        return searchTerms.some(term => searchContent.includes(term));
      });
    }

    // Sort by relevance (timestamp for now, could be enhanced with scoring)
    results.sort((a, b) => b.timestamp - a.timestamp);

    return results.slice(0, limit);
  }

  /**
   * Get context recommendations for current task
   */
  async getContextRecommendations(currentPrompt: string): Promise<{
    relevantPatterns: CodePattern[];
    similarInteractions: InteractionSummary[];
    suggestedVoices: string[];
    constraints: string[];
  }> {
    const context = await this.loadProjectContext();
    const currentTopics = this.extractTopicsFromText(currentPrompt);

    // Find relevant patterns
    const relevantPatterns = context.patterns.filter(pattern => {
      const patternTerms = `${pattern.name} ${pattern.description}`.toLowerCase();
      return currentTopics.some(topic => patternTerms.includes(topic.toLowerCase()));
    });

    // Find similar interactions
    const similarInteractions = context.history
      .filter(interaction => {
        const commonTopics = interaction.topics.filter(topic =>
          currentTopics.some(current => current.toLowerCase().includes(topic.toLowerCase()))
        );
        return commonTopics.length > 0;
      })
      .slice(0, 5);

    // Suggest voices based on successful interactions
    const voiceUsageMap = new Map<string, number>();
    similarInteractions
      .filter(interaction => interaction.outcome === 'successful')
      .forEach(interaction => {
        interaction.voicesUsed.forEach(voice => {
          voiceUsageMap.set(voice, (voiceUsageMap.get(voice) || 0) + 1);
        });
      });

    const suggestedVoices = Array.from(voiceUsageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([voice]) => voice);

    return {
      relevantPatterns,
      similarInteractions,
      suggestedVoices,
      constraints: context.constraints,
    };
  }

  /**
   * Load context hierarchy from global -> repo -> subfolder
   */
  private async loadContextHierarchy(currentPath?: string): Promise<ContextHierarchy> {
    const layers: ContextLayer[] = [];

    // Global context
    try {
      const globalContext = await this.loadContextFromPath(this.globalContextPath);
      layers.push({
        level: 'global',
        path: this.globalContextPath,
        content: globalContext,
        priority: 1,
      });
    } catch (error) {
      logger.debug('No global context found, using defaults');
    }

    // Repository context
    try {
      const repoContext = await this.loadContextFromPath(this.contextPath);
      layers.push({
        level: 'repo',
        path: this.contextPath,
        content: repoContext,
        priority: 2,
      });
    } catch (error) {
      logger.debug('No repository context found, using defaults');
    }

    // Subfolder context (if in subdirectory)
    if (currentPath && currentPath !== path.dirname(this.contextPath)) {
      const subfolderContextPath = path.join(currentPath, '.codecrucible');
      try {
        const subfolderContext = await this.loadContextFromPath(subfolderContextPath);
        layers.push({
          level: 'subfolder',
          path: subfolderContextPath,
          content: subfolderContext,
          priority: 3,
        });
      } catch (error) {
        logger.debug('No subfolder context found');
      }
    }

    // If no layers found, create default
    if (layers.length === 0) {
      const defaultContext = this.createDefaultContext();
      layers.push({
        level: 'repo',
        path: this.contextPath,
        content: defaultContext,
        priority: 2,
      });
    }

    // Merge contexts
    const merged = this.mergeContextLayers(layers);
    const conflicts = this.detectConflicts(layers);

    return {
      layers,
      merged,
      conflicts,
    };
  }

  /**
   * Load context from a specific path
   */
  private async loadContextFromPath(contextPath: string): Promise<ProjectContext> {
    const contextFile = path.join(contextPath, 'context.md');
    const voicesFile = path.join(contextPath, 'voices.yaml');
    const historyFile = path.join(contextPath, 'history.json');
    const patternsFile = path.join(contextPath, 'patterns.json');

    let guidance = '';
    let preferences: VoicePreferences = {
      primary: [],
      secondary: [],
      disabled: [],
      customSettings: {},
    };
    let history: InteractionSummary[] = [];
    let patterns: CodePattern[] = [];

    // Load guidance
    try {
      guidance = await fs.readFile(contextFile, 'utf-8');
    } catch (error) {
      logger.debug(`No context file found at ${contextFile}`);
    }

    // Load voice preferences
    try {
      const voicesContent = await fs.readFile(voicesFile, 'utf-8');
      const yaml = await import('js-yaml');
      preferences = yaml.load(voicesContent) as VoicePreferences;
    } catch (error) {
      logger.debug(`No voices file found at ${voicesFile}`);
    }

    // Load history
    try {
      const historyContent = await fs.readFile(historyFile, 'utf-8');
      history = JSON.parse(historyContent);
    } catch (error) {
      logger.debug(`No history file found at ${historyFile}`);
    }

    // Load patterns
    try {
      const patternsContent = await fs.readFile(patternsFile, 'utf-8');
      patterns = JSON.parse(patternsContent);
    } catch (error) {
      logger.debug(`No patterns file found at ${patternsFile}`);
    }

    return {
      guidance,
      preferences,
      constraints: [],
      patterns,
      history,
      metadata: {
        name: path.basename(path.dirname(contextPath)),
        type: 'other',
        languages: [],
        frameworks: [],
        lastUpdated: Date.now(),
        totalInteractions: history.length,
        averageComplexity: this.calculateAverageComplexity(history),
      },
    };
  }

  /**
   * Save context files to disk
   */
  private async saveContextFiles(contextPath: string, context: ProjectContext): Promise<void> {
    // Save guidance
    const contextFile = path.join(contextPath, 'context.md');
    await fs.writeFile(
      contextFile,
      context.guidance || '# Project Context\n\nAdd project-specific guidance here.\n'
    );

    // Save voice preferences
    const voicesFile = path.join(contextPath, 'voices.yaml');
    const yaml = await import('js-yaml');
    await fs.writeFile(voicesFile, yaml.dump(context.preferences));

    // Save history (last 50 interactions only)
    const historyFile = path.join(contextPath, 'history.json');
    const recentHistory = context.history.slice(0, 50);
    await fs.writeFile(historyFile, JSON.stringify(recentHistory, null, 2));

    // Save patterns
    const patternsFile = path.join(contextPath, 'patterns.json');
    await fs.writeFile(patternsFile, JSON.stringify(context.patterns, null, 2));

    // Save metadata
    const metadataFile = path.join(contextPath, 'metadata.json');
    await fs.writeFile(metadataFile, JSON.stringify(context.metadata, null, 2));
  }

  /**
   * Merge multiple contexts with priority-based resolution
   */
  private mergeContextLayers(layers: ContextLayer[]): ProjectContext {
    const contexts = layers
      .sort((a, b) => a.priority - b.priority) // Lower priority first
      .map(layer => layer.content);

    return this.mergeContexts(contexts);
  }

  /**
   * Merge contexts with intelligent conflict resolution
   */
  private mergeContexts(contexts: Partial<ProjectContext>[]): ProjectContext {
    const merged: ProjectContext = this.createDefaultContext();

    for (const context of contexts) {
      if (!context) continue;

      // Merge guidance (concatenate with separators)
      if (context.guidance) {
        merged.guidance = merged.guidance
          ? `${merged.guidance}\n\n---\n\n${context.guidance}`
          : context.guidance;
      }

      // Merge voice preferences (later preferences override)
      if (context.preferences) {
        merged.preferences = {
          primary: context.preferences.primary || merged.preferences.primary,
          secondary: context.preferences.secondary || merged.preferences.secondary,
          disabled: [...merged.preferences.disabled, ...(context.preferences.disabled || [])],
          customSettings: {
            ...merged.preferences.customSettings,
            ...context.preferences.customSettings,
          },
        };
      }

      // Merge constraints (combine unique)
      if (context.constraints) {
        merged.constraints = [...new Set([...merged.constraints, ...context.constraints])];
      }

      // Merge patterns (combine unique by name)
      if (context.patterns) {
        const existingNames = new Set(merged.patterns.map(p => p.name));
        const newPatterns = context.patterns.filter(p => !existingNames.has(p.name));
        merged.patterns = [...merged.patterns, ...newPatterns];
      }

      // Merge history (combine and sort by timestamp)
      if (context.history) {
        merged.history = [...merged.history, ...context.history]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 100); // Keep only most recent 100
      }

      // Merge metadata (later values override)
      if (context.metadata) {
        merged.metadata = { ...merged.metadata, ...context.metadata };
      }
    }

    return merged;
  }

  /**
   * Detect conflicts between context layers
   */
  private detectConflicts(layers: ContextLayer[]): ContextConflict[] {
    const conflicts: ContextConflict[] = [];

    // Check for voice preference conflicts
    const voiceConflicts = this.detectVoiceConflicts(layers);
    conflicts.push(...voiceConflicts);

    return conflicts;
  }

  /**
   * Detect voice preference conflicts
   */
  private detectVoiceConflicts(layers: ContextLayer[]): ContextConflict[] {
    const conflicts: ContextConflict[] = [];

    // Check if same voice is in both primary and disabled
    const allPrimary = new Set<string>();
    const allDisabled = new Set<string>();

    layers.forEach(layer => {
      if (layer.content.preferences) {
        layer.content.preferences.primary?.forEach(voice => allPrimary.add(voice));
        layer.content.preferences.disabled?.forEach(voice => allDisabled.add(voice));
      }
    });

    const conflictingVoices = [...allPrimary].filter(voice => allDisabled.has(voice));

    if (conflictingVoices.length > 0) {
      conflicts.push({
        property: 'voice_preferences',
        layers: layers.map(l => l.level),
        resolution: 'override',
        value: conflictingVoices,
      });
    }

    return conflicts;
  }

  /**
   * Create default project context
   */
  private createDefaultContext(): ProjectContext {
    return {
      guidance: '# Project Context\n\nAdd project-specific guidance here.',
      preferences: {
        primary: ['explorer', 'maintainer'],
        secondary: ['analyzer', 'developer'],
        disabled: [],
        customSettings: {},
      },
      constraints: [],
      patterns: [],
      history: [],
      metadata: {
        name: 'Unknown',
        type: 'other',
        languages: [],
        frameworks: [],
        lastUpdated: Date.now(),
        totalInteractions: 0,
        averageComplexity: 0,
      },
    };
  }

  /**
   * Extract topics from prompt and response
   */
  private extractTopics(prompt: string, response: SynthesisResult): string[] {
    const text = `${prompt} ${response.synthesis}`;
    return this.extractTopicsFromText(text);
  }

  /**
   * Extract topics from text using simple keyword matching
   */
  private extractTopicsFromText(text: string): string[] {
    const topics = new Set<string>();
    const lowercaseText = text.toLowerCase();

    // Programming languages
    const languages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'rust',
      'go',
      'cpp',
      'c#',
      'php',
      'ruby',
    ];
    languages.forEach(lang => {
      if (lowercaseText.includes(lang)) topics.add(lang);
    });

    // Frameworks
    const frameworks = [
      'react',
      'vue',
      'angular',
      'express',
      'fastapi',
      'django',
      'spring',
      'flutter',
      'nextjs',
    ];
    frameworks.forEach(framework => {
      if (lowercaseText.includes(framework)) topics.add(framework);
    });

    // Technologies
    const technologies = [
      'database',
      'api',
      'rest',
      'graphql',
      'docker',
      'kubernetes',
      'aws',
      'git',
      'test',
      'security',
    ];
    technologies.forEach(tech => {
      if (lowercaseText.includes(tech)) topics.add(tech);
    });

    // Activity types
    const activities = [
      'debug',
      'refactor',
      'optimize',
      'implement',
      'design',
      'review',
      'fix',
      'create',
      'update',
    ];
    activities.forEach(activity => {
      if (lowercaseText.includes(activity)) topics.add(activity);
    });

    return Array.from(topics);
  }

  /**
   * Calculate average complexity from interaction history
   */
  private calculateAverageComplexity(history: InteractionSummary[]): number {
    if (history.length === 0) return 0;

    const complexitySum = history.reduce((sum, interaction) => {
      // Simple complexity scoring based on various factors
      let complexity = 0;

      // Prompt length factor
      complexity += Math.min(interaction.prompt.length / 100, 5);

      // Response length factor
      complexity += Math.min(interaction.response.length / 200, 5);

      // Number of voices used
      complexity += interaction.voicesUsed.length;

      // Topic count
      complexity += interaction.topics.length;

      return sum + Math.min(complexity, 10); // Cap at 10
    }, 0);

    return complexitySum / history.length;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Cleanup resources and save pending data
   */
  async dispose(): Promise<void> {
    // Save any cached contexts
    for (const [key, hierarchy] of this.cache.entries()) {
      try {
        await this.saveProjectContext(hierarchy.merged, 'repo');
      } catch (error) {
        logger.warn(`Failed to save cached context ${key}:`, error);
      }
    }

    this.cache.clear();
    this.watchedPaths.clear();

    logger.info('Project memory system disposed');
  }
}
