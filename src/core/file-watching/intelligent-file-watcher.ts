/**
 * Intelligent File Watching System
 *
 * Provides comprehensive file watching with intelligent change detection,
 * agent integration, and proactive suggestions based on file changes.
 */

import { watch, FSWatcher, Stats } from 'fs';
import { readFile, stat } from 'fs/promises';
import { join, relative, extname, dirname, basename } from 'path';
import { EventEmitter } from 'events';
import { glob } from 'glob';
import { logger } from '../logger.js';
import {
  ErrorFactory,
  ErrorCategory,
  ErrorSeverity,
  ServiceResponse,
  ErrorHandler,
} from '../error-handling/structured-error-system.js';

// File change types
export enum FileChangeType {
  CREATED = 'created',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  MOVED = 'moved',
}

// File change event
export interface FileChangeEvent {
  type: FileChangeType;
  path: string;
  relativePath: string;
  timestamp: number;
  size?: number;
  extension: string;
  directory: string;
  filename: string;
  metadata?: {
    previousSize?: number;
    changeSize?: number;
    isLargeChange?: boolean;
    contentSummary?: string;
    language?: string;
    significance?: 'low' | 'medium' | 'high' | 'critical';
  };
}

// File watching configuration
export interface FileWatcherConfig {
  watchPaths: string[];
  includePatterns: string[];
  excludePatterns: string[];
  ignoreInitial: boolean;
  persistWatchers: boolean;
  debounceMs: number;
  maxFileSize: number;
  enableContentAnalysis: boolean;
  enableProactiveSuggestions: boolean;
  significanceThreshold: {
    smallChange: number; // bytes
    mediumChange: number; // bytes
    largeChange: number; // bytes
  };
  fileCategories: {
    source: string[];
    config: string[];
    documentation: string[];
    build: string[];
    test: string[];
  };
}

// Agent integration interface
export interface AgentIntegration {
  onFileChange: (event: FileChangeEvent) => Promise<void>;
  onSignificantChange: (events: FileChangeEvent[]) => Promise<void>;
  onProjectStructureChange: (summary: ProjectChangeSummary) => Promise<void>;
  generateSuggestions: (events: FileChangeEvent[]) => Promise<string[]>;
}

// Project change summary
export interface ProjectChangeSummary {
  totalChanges: number;
  changesByType: Record<FileChangeType, number>;
  changesByCategory: Record<string, number>;
  significantFiles: string[];
  summary: string;
  suggestions: string[];
  impactAnalysis: {
    buildImpact: boolean;
    testImpact: boolean;
    configImpact: boolean;
    documentationImpact: boolean;
  };
}

/**
 * Intelligent File Watcher with Agent Integration
 */
export class IntelligentFileWatcher extends EventEmitter {
  private config: FileWatcherConfig;
  private watchers = new Map<string, FSWatcher>();
  private fileStats = new Map<string, Stats>();
  private changeBuffer: FileChangeEvent[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private agentIntegration?: AgentIntegration;
  private isWatching = false;
  private watchStartTime = 0;

  constructor(config: Partial<FileWatcherConfig> = {}) {
    super();

    this.config = {
      watchPaths: ['.'],
      includePatterns: ['**/*'],
      excludePatterns: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '.next/**',
        'coverage/**',
        '*.log',
        '.env*',
        '*.tmp',
        '*.temp',
      ],
      ignoreInitial: true,
      persistWatchers: true,
      debounceMs: 500,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      enableContentAnalysis: true,
      enableProactiveSuggestions: true,
      significanceThreshold: {
        smallChange: 100,
        mediumChange: 1000,
        largeChange: 10000,
      },
      fileCategories: {
        source: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs'],
        config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.config', '.env'],
        documentation: ['.md', '.txt', '.rst', '.adoc'],
        build: ['package.json', 'Cargo.toml', 'pom.xml', 'build.gradle', 'Makefile'],
        test: ['.test.js', '.test.ts', '.spec.js', '.spec.ts', '_test.py', '_test.go'],
      },
      ...config,
    };

    this.setupEventHandlers();
  }

  /**
   * Set agent integration for intelligent suggestions
   */
  setAgentIntegration(integration: AgentIntegration): void {
    this.agentIntegration = integration;
    logger.info('Agent integration configured for file watcher');
  }

  /**
   * Start watching files
   */
  async startWatching(): Promise<ServiceResponse<void>> {
    try {
      if (this.isWatching) {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            {
              code: 'FILE_WATCHER_ALREADY_RUNNING',
              message: 'File watcher is already running',
              severity: 'medium',
              category: 'system',
              recoverable: true,
              suggestions: ['Stop current watcher before starting new one']
            },
            {
              operation: 'startWatching',
              timestamp: Date.now(),
              component: 'intelligent-file-watcher'
            }
          )
        );
      }

      logger.info('Starting intelligent file watcher', {
        watchPaths: this.config.watchPaths,
        includePatterns: this.config.includePatterns,
        excludePatterns: this.config.excludePatterns,
      });

      // Initialize file stats for existing files
      await this.initializeFileStats();

      // Start watching each path
      for (const watchPath of this.config.watchPaths) {
        await this.startWatchingPath(watchPath);
      }

      this.isWatching = true;
      this.watchStartTime = Date.now();

      this.emit('watcherStarted', {
        paths: this.config.watchPaths,
        timestamp: this.watchStartTime,
      });

      return ErrorHandler.createSuccessResponse(undefined);
    } catch (error) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          {
            code: 'FILE_WATCHER_START_FAILED',
            message: `Failed to start file watcher: ${(error as Error).message}`,
            severity: 'high',
            category: 'system',
            recoverable: true,
            suggestions: [
              'Check file permissions',
              'Verify watch paths exist',
              'Try with fewer paths'
            ]
          },
          {
            operation: 'startWatching',
            timestamp: Date.now(),
            component: 'intelligent-file-watcher'
          },
          error as Error
        )
      );
    }
  }

  /**
   * Stop watching files
   */
  async stopWatching(): Promise<void> {
    logger.info('Stopping file watcher');

    // Close all watchers
    for (const [path, watcher] of this.watchers) {
      try {
        watcher.close();
        logger.debug(`Closed watcher for: ${path}`);
      } catch (error) {
        logger.warn(`Failed to close watcher for ${path}:`, error);
      }
    }

    this.watchers.clear();
    this.fileStats.clear();
    this.changeBuffer = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.isWatching = false;

    this.emit('watcherStopped', {
      duration: Date.now() - this.watchStartTime,
    });

    logger.info('File watcher stopped');
  }

  /**
   * Get current watching status
   */
  getStatus(): {
    isWatching: boolean;
    watchedPaths: string[];
    watchedFiles: number;
    uptime: number;
    recentChanges: number;
    bufferSize: number;
  } {
    return {
      isWatching: this.isWatching,
      watchedPaths: Array.from(this.watchers.keys()),
      watchedFiles: this.fileStats.size,
      uptime: this.isWatching ? Date.now() - this.watchStartTime : 0,
      recentChanges: this.changeBuffer.length,
      bufferSize: this.changeBuffer.length,
    };
  }

  /**
   * Get recent file changes
   */
  getRecentChanges(limit: number = 50): FileChangeEvent[] {
    return this.changeBuffer.slice(-limit);
  }

  /**
   * Manually trigger change processing
   */
  async processBufferedChanges(): Promise<void> {
    if (this.changeBuffer.length === 0) return;

    await this.processChangeBuffer();
  }

  private async initializeFileStats(): Promise<void> {
    for (const watchPath of this.config.watchPaths) {
      try {
        const files = await glob(this.config.includePatterns, {
          cwd: watchPath,
          ignore: this.config.excludePatterns,
          absolute: true,
        });

        for (const file of files) {
          try {
            const stats = await stat(file);
            if (stats.isFile() && stats.size <= this.config.maxFileSize) {
              this.fileStats.set(file, stats);
            }
          } catch (error) {
            logger.debug(`Could not stat file: ${file}`, error);
          }
        }

        logger.debug(`Initialized stats for ${files.length} files in ${watchPath}`);
      } catch (error) {
        logger.warn(`Failed to initialize file stats for ${watchPath}:`, error);
      }
    }
  }

  private async startWatchingPath(watchPath: string): Promise<void> {
    try {
      const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          this.handleFileChange(eventType, join(watchPath, filename));
        }
      });

      watcher.on('error', error => {
        logger.error(`File watcher error for ${watchPath}:`, error);
        this.emit('watcherError', { path: watchPath, error });
      });

      this.watchers.set(watchPath, watcher);
      logger.debug(`Started watching: ${watchPath}`);
    } catch (error) {
      logger.error(`Failed to start watching ${watchPath}:`, error);
      throw error;
    }
  }

  private async handleFileChange(eventType: string, filePath: string): Promise<void> {
    try {
      // Skip if file doesn't match patterns
      if (!this.shouldWatchFile(filePath)) {
        return;
      }

      const changeEvent = await this.createChangeEvent(eventType, filePath);
      if (changeEvent) {
        this.changeBuffer.push(changeEvent);
        this.emit('fileChange', changeEvent);

        // Debounced processing
        this.scheduleChangeProcessing();

        logger.debug(`File change detected: ${changeEvent.type} ${changeEvent.relativePath}`);
      }
    } catch (error) {
      logger.error(`Error handling file change for ${filePath}:`, error);
    }
  }

  private shouldWatchFile(filePath: string): boolean {
    const relativePath = relative(process.cwd(), filePath);

    // Check exclude patterns
    for (const pattern of this.config.excludePatterns) {
      if (
        relativePath.includes(pattern.replace('/**', '')) ||
        relativePath.match(pattern.replace('**/', '').replace('*', '.*'))
      ) {
        return false;
      }
    }

    // Check include patterns (simplified check)
    return true;
  }

  private async createChangeEvent(
    eventType: string,
    filePath: string
  ): Promise<FileChangeEvent | null> {
    try {
      const relativePath = relative(process.cwd(), filePath);
      const extension = extname(filePath);
      const directory = dirname(relativePath);
      const filename = basename(filePath);

      let changeType: FileChangeType;
      let currentStats: Stats | null = null;
      const metadata: FileChangeEvent['metadata'] = {};

      try {
        currentStats = await stat(filePath);
      } catch (error) {
        // File might be deleted
        changeType = FileChangeType.DELETED;
      }

      if (currentStats) {
        const previousStats = this.fileStats.get(filePath);

        if (!previousStats) {
          changeType = FileChangeType.CREATED;
        } else {
          changeType = FileChangeType.MODIFIED;

          // Calculate change metadata
          metadata.previousSize = previousStats.size;
          metadata.changeSize = currentStats.size - previousStats.size;
          metadata.isLargeChange =
            Math.abs(metadata.changeSize) > this.config.significanceThreshold.largeChange;

          // Determine significance
          const absChange = Math.abs(metadata.changeSize);
          if (absChange < this.config.significanceThreshold.smallChange) {
            metadata.significance = 'low';
          } else if (absChange < this.config.significanceThreshold.mediumChange) {
            metadata.significance = 'medium';
          } else if (absChange < this.config.significanceThreshold.largeChange) {
            metadata.significance = 'high';
          } else {
            metadata.significance = 'critical';
          }
        }

        // Update stats
        this.fileStats.set(filePath, currentStats);
      } else {
        // File was deleted
        changeType = FileChangeType.DELETED;
        this.fileStats.delete(filePath);
      }

      // Add language detection
      metadata.language = this.detectLanguage(extension);

      // Content analysis for significant changes
      if (
        this.config.enableContentAnalysis &&
        currentStats &&
        currentStats.size <= this.config.maxFileSize &&
        metadata.significance !== 'low'
      ) {
        try {
          const content = await readFile(filePath, 'utf8');
          metadata.contentSummary = this.generateContentSummary(content, extension);
        } catch (error) {
          logger.debug(`Could not analyze content for ${filePath}:`, error);
        }
      }

      return {
        type: changeType,
        path: filePath,
        relativePath,
        timestamp: Date.now(),
        size: currentStats?.size,
        extension,
        directory,
        filename,
        metadata,
      };
    } catch (error) {
      logger.error(`Failed to create change event for ${filePath}:`, error);
      return null;
    }
  }

  private scheduleChangeProcessing(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processChangeBuffer();
    }, this.config.debounceMs);
  }

  private async processChangeBuffer(): Promise<void> {
    if (this.changeBuffer.length === 0) return;

    const changes = [...this.changeBuffer];
    this.changeBuffer = [];

    try {
      // Group changes for analysis
      const significantChanges = changes.filter(
        change =>
          change.metadata?.significance === 'high' || change.metadata?.significance === 'critical'
      );

      // Generate project change summary
      const summary = this.generateProjectChangeSummary(changes);

      // Emit events
      this.emit('changesProcessed', { changes, summary });

      // Agent integration
      if (this.agentIntegration) {
        // Process individual changes
        for (const change of changes) {
          await this.agentIntegration.onFileChange(change);
        }

        // Process significant changes
        if (significantChanges.length > 0) {
          await this.agentIntegration.onSignificantChange(significantChanges);
        }

        // Process project structure changes
        await this.agentIntegration.onProjectStructureChange(summary);

        // Generate proactive suggestions
        if (this.config.enableProactiveSuggestions && changes.length > 0) {
          try {
            const suggestions = await this.agentIntegration.generateSuggestions(changes);
            if (suggestions.length > 0) {
              this.emit('suggestions', { changes, suggestions });
              logger.info('Generated proactive suggestions', {
                changesCount: changes.length,
                suggestionsCount: suggestions.length,
              });
            }
          } catch (error) {
            logger.warn('Failed to generate proactive suggestions:', error);
          }
        }
      }

      logger.info(`Processed ${changes.length} file changes`, {
        significantChanges: significantChanges.length,
        summary: summary.summary,
      });
    } catch (error) {
      logger.error('Error processing change buffer:', error);
    }
  }

  private generateProjectChangeSummary(changes: FileChangeEvent[]): ProjectChangeSummary {
    const changesByType: Record<FileChangeType, number> = {
      [FileChangeType.CREATED]: 0,
      [FileChangeType.MODIFIED]: 0,
      [FileChangeType.DELETED]: 0,
      [FileChangeType.MOVED]: 0,
    };

    const changesByCategory: Record<string, number> = {
      source: 0,
      config: 0,
      documentation: 0,
      build: 0,
      test: 0,
      other: 0,
    };

    const significantFiles: string[] = [];

    // Analyze changes
    for (const change of changes) {
      changesByType[change.type]++;

      const category = this.categorizeFile(change.extension, change.filename);
      changesByCategory[category]++;

      if (
        change.metadata?.significance === 'high' ||
        change.metadata?.significance === 'critical'
      ) {
        significantFiles.push(change.relativePath);
      }
    }

    // Generate impact analysis
    const impactAnalysis = {
      buildImpact: changesByCategory.build > 0 || changesByCategory.config > 0,
      testImpact: changesByCategory.test > 0,
      configImpact: changesByCategory.config > 0,
      documentationImpact: changesByCategory.documentation > 0,
    };

    // Generate summary text
    const summary = this.generateSummaryText(changes, changesByType, changesByCategory);

    // Generate suggestions
    const suggestions = this.generateBasicSuggestions(
      impactAnalysis,
      changesByType,
      significantFiles
    );

    return {
      totalChanges: changes.length,
      changesByType,
      changesByCategory,
      significantFiles,
      summary,
      suggestions,
      impactAnalysis,
    };
  }

  private categorizeFile(extension: string, filename: string): string {
    // Check build files first (by filename)
    if (this.config.fileCategories.build.includes(filename)) {
      return 'build';
    }

    // Check by extension
    for (const [category, extensions] of Object.entries(this.config.fileCategories)) {
      if (extensions.some(ext => extension.endsWith(ext) || filename.includes(ext))) {
        return category;
      }
    }

    return 'other';
  }

  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
    };

    return languageMap[extension] || 'unknown';
  }

  private generateContentSummary(content: string, extension: string): string {
    const lines = content.split('\n');
    const totalLines = lines.length;
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;

    // Basic analysis
    if (extension === '.js' || extension === '.ts') {
      const functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
      const classes = (content.match(/class\s+\w+/g) || []).length;
      return `${totalLines} lines, ${functions} functions, ${classes} classes`;
    } else if (extension === '.md') {
      const headers = (content.match(/^#+\s+/gm) || []).length;
      return `${totalLines} lines, ${headers} headers`;
    } else {
      return `${totalLines} lines (${nonEmptyLines} non-empty)`;
    }
  }

  private generateSummaryText(
    changes: FileChangeEvent[],
    changesByType: Record<FileChangeType, number>,
    changesByCategory: Record<string, number>
  ): string {
    const parts: string[] = [];

    if (changes.length === 1) {
      const change = changes[0];
      parts.push(`${change.type} ${change.relativePath}`);
    } else {
      parts.push(`${changes.length} files changed`);

      if (changesByType.created > 0) parts.push(`${changesByType.created} created`);
      if (changesByType.modified > 0) parts.push(`${changesByType.modified} modified`);
      if (changesByType.deleted > 0) parts.push(`${changesByType.deleted} deleted`);
    }

    const majorCategories = Object.entries(changesByCategory)
      .filter(([category, count]) => count > 0 && category !== 'other')
      .map(([category, count]) => `${count} ${category}`)
      .slice(0, 3);

    if (majorCategories.length > 0) {
      parts.push(`(${majorCategories.join(', ')})`);
    }

    return parts.join(' ');
  }

  private generateBasicSuggestions(
    impactAnalysis: ProjectChangeSummary['impactAnalysis'],
    changesByType: Record<FileChangeType, number>,
    significantFiles: string[]
  ): string[] {
    const suggestions: string[] = [];

    if (impactAnalysis.buildImpact) {
      suggestions.push('Consider running build to ensure configuration changes are valid');
    }

    if (impactAnalysis.testImpact) {
      suggestions.push('Run tests to verify changes to test files');
    }

    if (changesByType.created > 0) {
      suggestions.push('Review new files for proper integration and documentation');
    }

    if (significantFiles.length > 0) {
      suggestions.push(`Review significant changes in: ${significantFiles.slice(0, 3).join(', ')}`);
    }

    if (changesByType.deleted > 0) {
      suggestions.push('Verify deleted files are not referenced elsewhere in the project');
    }

    return suggestions;
  }

  private setupEventHandlers(): void {
    this.on('fileChange', (event: FileChangeEvent) => {
      logger.debug('File change event', {
        type: event.type,
        path: event.relativePath,
        significance: event.metadata?.significance,
      });
    });

    this.on('suggestions', ({ changes, suggestions }) => {
      logger.info('Proactive suggestions generated', {
        changesCount: changes.length,
        suggestions,
      });
    });

    this.on('watcherError', ({ path, error }) => {
      logger.error(`File watcher error for ${path}`, error);
    });
  }
}

// Export the main class and interfaces
export default IntelligentFileWatcher;
