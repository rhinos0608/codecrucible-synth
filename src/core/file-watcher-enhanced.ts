import chokidar from 'chokidar';
import { logger } from './logger.js';
import { ProactiveTaskSuggester, ProjectContext } from './proactive-suggester.js';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { Stats } from 'fs';

/**
 * File change event types
 */
export enum FileChangeType {
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed'
}

/**
 * File change event
 */
export interface FileChangeEvent {
  type: FileChangeType;
  filePath: string;
  previousPath?: string;
  timestamp: Date;
  stats?: {
    size: number;
    mtime: Date;
  };
}

/**
 * Watch configuration
 */
export interface WatchConfig {
  paths: string[];
  ignored?: string[];
  ignoreInitial?: boolean;
  followSymlinks?: boolean;
  depth?: number;
  enableSuggestions?: boolean;
  suggestionDebounce?: number;
}

/**
 * Enhanced File Watcher with Proactive Suggestions
 * 
 * Monitors file system changes and provides real-time project analysis
 * with proactive suggestions for improvements and next steps.
 */
export class EnhancedFileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private config: WatchConfig;
  private proactiveSuggester: ProactiveTaskSuggester;
  private isWatching: boolean = false;
  private suggestionTimer: NodeJS.Timeout | null = null;
  private projectContext: ProjectContext | null = null;
  private fileCache: Map<string, { content: string; lastModified: Date; size: number }> = new Map();
  private changeBuffer: FileChangeEvent[] = [];

  constructor(config: WatchConfig) {
    super();
    this.config = {
      ignoreInitial: true,
      followSymlinks: false,
      depth: 10,
      enableSuggestions: true,
      suggestionDebounce: 2000, // 2 seconds
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.log',
        '**/*.tmp',
        ...config.ignored || []
      ],
      ...config
    };

    this.proactiveSuggester = new ProactiveTaskSuggester();
    
    logger.info('🔍 Enhanced File Watcher initialized', {
      paths: this.config.paths,
      suggestionsEnabled: this.config.enableSuggestions
    });
  }

  /**
   * Start watching files
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      logger.warn('File watcher is already running');
      return;
    }

    try {
      this.watcher = chokidar.watch(this.config.paths, {
        ignored: this.config.ignored,
        ignoreInitial: this.config.ignoreInitial,
        followSymlinks: this.config.followSymlinks,
        depth: this.config.depth,
        persistent: true
      });

      this.setupEventHandlers();
      this.isWatching = true;

      // Build initial project context
      await this.buildProjectContext();

      logger.info(`📁 File watcher started, monitoring ${this.config.paths.length} path(s)`);
      this.emit('watchingStarted', { paths: this.config.paths });

    } catch (error) {
      logger.error('❌ Failed to start file watcher:', error);
      throw error;
    }
  }

  /**
   * Stop watching files
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      return;
    }

    try {
      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;

      if (this.suggestionTimer) {
        clearTimeout(this.suggestionTimer);
        this.suggestionTimer = null;
      }

      logger.info('🛑 File watcher stopped');
      this.emit('watchingStopped');

    } catch (error) {
      logger.error('❌ Failed to stop file watcher:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for file system events
   */
  private setupEventHandlers(): void {
    if (!this.watcher) return;

    this.watcher
      .on('add', (filePath, stats) => this.handleFileEvent(FileChangeType.ADDED, filePath, stats))
      .on('change', (filePath, stats) => this.handleFileEvent(FileChangeType.MODIFIED, filePath, stats))
      .on('unlink', (filePath) => this.handleFileEvent(FileChangeType.DELETED, filePath))
      .on('addDir', (dirPath) => logger.debug(`📁 Directory added: ${dirPath}`))
      .on('unlinkDir', (dirPath) => logger.debug(`📁 Directory removed: ${dirPath}`))
      .on('error', (error) => {
        logger.error('❌ File watcher error:', error);
        this.emit('error', error);
      })
      .on('ready', () => {
        logger.info('✅ File watcher ready');
        this.emit('ready');
      });
  }

  /**
   * Handle individual file events
   */
  private async handleFileEvent(
    type: FileChangeType, 
    filePath: string, 
    stats?: Stats
  ): Promise<void> {
    try {
      const event: FileChangeEvent = {
        type,
        filePath,
        timestamp: new Date(),
        stats: stats ? {
          size: stats.size,
          mtime: stats.mtime
        } : undefined
      };

      logger.debug(`📝 File ${type}: ${filePath}`);
      
      // Add to change buffer
      this.changeBuffer.push(event);
      
      // Update file cache
      await this.updateFileCache(filePath, type);

      // Emit event immediately
      this.emit('fileChange', event);
      
      // Trigger smart analysis
      await this.triggerSmartAnalysis(event);

      // Schedule suggestion update if enabled
      if (this.config.enableSuggestions) {
        this.schedulesuggestionUpdate();
      }

    } catch (error) {
      logger.error(`❌ Error handling file event for ${filePath}:`, error);
    }
  }

  /**
   * Update internal file cache
   */
  private async updateFileCache(filePath: string, changeType: FileChangeType): Promise<void> {
    try {
      if (changeType === FileChangeType.DELETED) {
        this.fileCache.delete(filePath);
        return;
      }

      // Only cache text files
      if (!this.isTextFile(filePath)) {
        return;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      this.fileCache.set(filePath, {
        content,
        lastModified: stats.mtime,
        size: stats.size
      });

    } catch (error) {
      // File might be deleted or inaccessible
      this.fileCache.delete(filePath);
    }
  }

  /**
   * Trigger smart analysis based on file changes
   */
  private async triggerSmartAnalysis(event: FileChangeEvent): Promise<void> {
    const ext = path.extname(event.filePath).toLowerCase();
    const basename = path.basename(event.filePath);

    // React to specific file types
    if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs'].includes(ext)) {
      this.emit('codeChange', {
        ...event,
        language: this.getLanguageFromExtension(ext),
        suggestions: await this.getInstantSuggestions(event)
      });
    }

    if (basename === 'package.json' && event.type === FileChangeType.MODIFIED) {
      this.emit('dependencyChange', event);
    }

    if (['.test.', '.spec.'].some(pattern => event.filePath.includes(pattern))) {
      this.emit('testChange', event);
    }

    if (basename.toLowerCase().includes('readme') || basename.toLowerCase().includes('doc')) {
      this.emit('documentationChange', event);
    }
  }

  /**
   * Get instant suggestions for immediate feedback
   */
  private async getInstantSuggestions(event: FileChangeEvent): Promise<string[]> {
    const suggestions: string[] = [];
    const cachedFile = this.fileCache.get(event.filePath);

    if (!cachedFile) return suggestions;

    // Quick syntax-based suggestions
    if (cachedFile.content.includes('TODO') || cachedFile.content.includes('FIXME')) {
      suggestions.push('Code contains TODO/FIXME comments that need attention');
    }

    if (cachedFile.content.includes('console.log') && !event.filePath.includes('.test.')) {
      suggestions.push('Consider removing console.log statements from production code');
    }

    if (cachedFile.content.split('\n').length > 300) {
      suggestions.push('Large file detected - consider breaking into smaller modules');
    }

    if (cachedFile.content.includes('eval(')) {
      suggestions.push('⚠️ Security risk: eval() usage detected');
    }

    return suggestions;
  }

  /**
   * Schedule suggestion update with debouncing
   */
  private schedulesuggestionUpdate(): void {
    if (this.suggestionTimer) {
      clearTimeout(this.suggestionTimer);
    }

    this.suggestionTimer = setTimeout(async () => {
      await this.updateSuggestions();
    }, this.config.suggestionDebounce);
  }

  /**
   * Update proactive suggestions based on current project state
   */
  private async updateSuggestions(): Promise<void> {
    try {
      if (!this.projectContext) {
        await this.buildProjectContext();
      }

      if (this.projectContext) {
        const suggestions = await this.proactiveSuggester.generateSuggestions(this.projectContext);
        
        this.emit('suggestionsUpdated', {
          suggestions,
          changesSince: this.changeBuffer.length,
          timestamp: new Date()
        });

        // Clear change buffer after processing
        this.changeBuffer = [];
      }

    } catch (error) {
      logger.error('❌ Failed to update suggestions:', error);
    }
  }

  /**
   * Build project context from current files
   */
  private async buildProjectContext(): Promise<void> {
    try {
      const files = [];
      const dependencies = [];
      
      // Process cached files
      for (const [filePath, fileData] of this.fileCache.entries()) {
        files.push({
          path: filePath,
          content: fileData.content,
          language: this.getLanguageFromExtension(path.extname(filePath)),
          lastModified: fileData.lastModified,
          size: fileData.size
        });
      }

      // Extract dependencies from package.json if available
      const packageJsonFile = this.fileCache.get('package.json');
      if (packageJsonFile) {
        try {
          const packageJson = JSON.parse(packageJsonFile.content);
          dependencies.push(
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {})
          );
        } catch (error) {
          logger.warn('Failed to parse package.json for dependencies');
        }
      }

      this.projectContext = {
        files,
        dependencies,
        userActivity: {
          lastActiveFile: this.getLastModifiedFile(),
          focusAreas: this.getFocusAreas(),
          workingPattern: this.getWorkingPattern()
        }
      };

      logger.debug(`📊 Project context updated: ${files.length} files, ${dependencies.length} dependencies`);

    } catch (error) {
      logger.error('❌ Failed to build project context:', error);
    }
  }

  /**
   * Helper methods
   */
  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.java', '.cs', '.cpp', '.c', '.h',
      '.html', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml',
      '.md', '.txt', '.conf', '.ini', '.env', '.gitignore', '.gitattributes'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext) || 
           path.basename(filePath).toLowerCase().includes('readme') ||
           path.basename(filePath).toLowerCase().includes('license');
  }

  private getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.vue': 'vue',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };
    
    return languageMap[ext.toLowerCase()] || 'text';
  }

  private getLastModifiedFile(): string {
    let lastFile = '';
    let lastTime = 0;
    
    for (const [filePath, fileData] of this.fileCache.entries()) {
      if (fileData.lastModified.getTime() > lastTime) {
        lastTime = fileData.lastModified.getTime();
        lastFile = filePath;
      }
    }
    
    return lastFile;
  }

  private getFocusAreas(): string[] {
    const areas = new Set<string>();
    
    // Analyze recent changes to determine focus areas
    const recentChanges = this.changeBuffer.filter(
      change => Date.now() - change.timestamp.getTime() < 3600000 // Last hour
    );
    
    for (const change of recentChanges) {
      const ext = path.extname(change.filePath).toLowerCase();
      
      if (['.test.', '.spec.'].some(pattern => change.filePath.includes(pattern))) {
        areas.add('testing');
      }
      
      if (change.filePath.includes('security') || change.filePath.includes('auth')) {
        areas.add('security');
      }
      
      if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
        areas.add('styling');
      }
      
      if (change.filePath.includes('api') || change.filePath.includes('endpoint')) {
        areas.add('api');
      }
    }
    
    return Array.from(areas);
  }

  private getWorkingPattern(): string {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'late-night';
  }

  /**
   * Public API methods
   */
  
  /**
   * Get current project context
   */
  getProjectContext(): ProjectContext | null {
    return this.projectContext;
  }

  /**
   * Get current suggestions
   */
  async getCurrentSuggestions() {
    if (!this.projectContext) {
      await this.buildProjectContext();
    }
    
    if (this.projectContext) {
      return await this.proactiveSuggester.generateSuggestions(this.projectContext);
    }
    
    return [];
  }

  /**
   * Get file cache statistics
   */
  getStats() {
    return {
      isWatching: this.isWatching,
      filesTracked: this.fileCache.size,
      recentChanges: this.changeBuffer.length,
      watchPaths: this.config.paths,
      suggestionsEnabled: this.config.enableSuggestions
    };
  }

  /**
   * Force refresh of project context
   */
  async refreshContext(): Promise<void> {
    await this.buildProjectContext();
    if (this.config.enableSuggestions) {
      await this.updateSuggestions();
    }
  }

  /**
   * Add new paths to watch
   */
  addPaths(paths: string[]): void {
    if (this.watcher) {
      this.watcher.add(paths);
      this.config.paths.push(...paths);
      logger.info(`📁 Added ${paths.length} new paths to watch`);
    }
  }

  /**
   * Remove paths from watching
   */
  removePaths(paths: string[]): void {
    if (this.watcher) {
      this.watcher.unwatch(paths);
      this.config.paths = this.config.paths.filter(p => !paths.includes(p));
      logger.info(`📁 Removed ${paths.length} paths from watch`);
    }
  }
}