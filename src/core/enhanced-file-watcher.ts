import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { logger } from './logger.js';
import path from 'path';
import micromatch from 'micromatch';

export interface FileWatcherConfig {
  watchPaths: string[];
  ignorePaths: string[];
  debounceMs: number;
  enabledEvents: ('add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir')[];
  fileFilters: string[];
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: any;
  timestamp: number;
}

export class EnhancedFileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private config: FileWatcherConfig;
  private debounceMap: Map<string, NodeJS.Timeout> = new Map();
  private isWatching: boolean = false;

  constructor(config: Partial<FileWatcherConfig> = {}) {
    super();
    
    this.config = {
      watchPaths: config.watchPaths || ['.'],
      ignorePaths: config.ignorePaths || [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '.next/**',
        '.nuxt/**',
        'coverage/**',
        '**/*.log',
        '**/.DS_Store',
        '**/Thumbs.db'
      ],
      debounceMs: config.debounceMs || 300,
      enabledEvents: config.enabledEvents || ['add', 'change', 'unlink'],
      fileFilters: config.fileFilters || [
        '**/*.ts',
        '**/*.js',
        '**/*.tsx',
        '**/*.jsx',
        '**/*.py',
        '**/*.java',
        '**/*.cpp',
        '**/*.c',
        '**/*.h',
        '**/*.go',
        '**/*.rs',
        '**/*.php',
        '**/*.rb',
        '**/*.cs',
        '**/*.swift',
        '**/*.kt',
        '**/*.scala',
        '**/*.json',
        '**/*.yaml',
        '**/*.yml',
        '**/*.toml',
        '**/*.md',
        '**/*.txt',
        '**/*.sql'
      ]
    };
  }

  async startWatching(): Promise<void> {
    if (this.isWatching) {
      logger.warn('File watcher is already running');
      return;
    }

    try {
      this.watcher = chokidar.watch(this.config.watchPaths, {
        ignored: this.config.ignorePaths,
        ignoreInitial: true,
        persistent: true,
        usePolling: false,
        interval: 1000,
        binaryInterval: 3000,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100
        }
      });

      this.setupEventHandlers();
      this.isWatching = true;

      logger.info(`🔍 Enhanced file watcher started monitoring: ${this.config.watchPaths.join(', ')}`);
      this.emit('watcher:started');
    } catch (error) {
      logger.error('Failed to start file watcher:', error);
      throw error;
    }
  }

  async stopWatching(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      return;
    }

    try {
      // Clear all pending debounce timers
      this.debounceMap.forEach(timer => clearTimeout(timer));
      this.debounceMap.clear();

      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;

      logger.info('📴 File watcher stopped');
      this.emit('watcher:stopped');
    } catch (error) {
      logger.error('Error stopping file watcher:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.watcher) return;

    // Set up event handlers for enabled events
    if (this.config.enabledEvents.includes('add')) {
      this.watcher.on('add', (filePath, stats) => {
        this.handleFileEvent('add', filePath, stats);
      });
    }

    if (this.config.enabledEvents.includes('change')) {
      this.watcher.on('change', (filePath, stats) => {
        this.handleFileEvent('change', filePath, stats);
      });
    }

    if (this.config.enabledEvents.includes('unlink')) {
      this.watcher.on('unlink', (filePath) => {
        this.handleFileEvent('unlink', filePath);
      });
    }

    if (this.config.enabledEvents.includes('addDir')) {
      this.watcher.on('addDir', (dirPath, stats) => {
        this.handleFileEvent('addDir', dirPath, stats);
      });
    }

    if (this.config.enabledEvents.includes('unlinkDir')) {
      this.watcher.on('unlinkDir', (dirPath) => {
        this.handleFileEvent('unlinkDir', dirPath);
      });
    }

    // Error handling
    this.watcher.on('error', (error) => {
      logger.error('File watcher error:', error);
      this.emit('watcher:error', error);
    });

    // Ready event
    this.watcher.on('ready', () => {
      logger.info('📂 File watcher ready and monitoring changes');
      this.emit('watcher:ready');
    });
  }

  private handleFileEvent(type: FileChangeEvent['type'], filePath: string, stats?: any): void {
    // Check if file matches our filters
    if (!this.shouldProcessFile(filePath)) {
      return;
    }

    const absolutePath = path.resolve(filePath);
    
    // Debounce rapid file changes
    const debounceKey = `${type}:${absolutePath}`;
    const existingTimer = this.debounceMap.get(debounceKey);
    
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceMap.delete(debounceKey);
      this.processFileEvent(type, absolutePath, stats);
    }, this.config.debounceMs);

    this.debounceMap.set(debounceKey, timer);
  }

  private shouldProcessFile(filePath: string): boolean {
    // Check against file filters
    const matchesFilter = this.config.fileFilters.length === 0 || 
      micromatch.isMatch(filePath, this.config.fileFilters);

    if (!matchesFilter) {
      return false;
    }

    // Additional checks for file types we definitely want to ignore
    const ignoredExtensions = ['.tmp', '.swp', '.swo', '.lock'];
    const hasIgnoredExtension = ignoredExtensions.some(ext => filePath.endsWith(ext));

    return !hasIgnoredExtension;
  }

  private processFileEvent(type: FileChangeEvent['type'], filePath: string, stats?: any): void {
    const event: FileChangeEvent = {
      type,
      path: filePath,
      stats,
      timestamp: Date.now()
    };

    logger.debug(`📝 File ${type}: ${path.basename(filePath)}`);
    
    // Emit specific event type
    this.emit(`file:${type}`, event);
    
    // Emit general file change event
    this.emit('file:change', event);

    // Emit analysis triggers for code files
    if (this.isCodeFile(filePath)) {
      this.emit('code:change', event);
      
      // Emit specific language events
      const language = this.detectLanguage(filePath);
      if (language) {
        this.emit(`code:${language}`, event);
      }
    }

    // Emit configuration change events
    if (this.isConfigFile(filePath)) {
      this.emit('config:change', event);
    }
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h',
      '.go', '.rs', '.php', '.rb', '.cs', '.swift', '.kt', '.scala'
    ];
    
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }

  private isConfigFile(filePath: string): boolean {
    const configFiles = [
      'package.json', 'tsconfig.json', 'webpack.config.js', '.eslintrc',
      'babel.config.js', 'jest.config.js', 'rollup.config.js', 'vite.config.js'
    ];
    
    const fileName = path.basename(filePath);
    return configFiles.includes(fileName) || 
           fileName.endsWith('.config.js') ||
           fileName.endsWith('.config.ts') ||
           fileName.endsWith('.config.json');
  }

  private detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath);
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.cs': 'csharp',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala'
    };

    return languageMap[ext] || null;
  }

  // Public methods for configuration updates
  public updateConfig(newConfig: Partial<FileWatcherConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isWatching) {
      logger.info('🔄 File watcher configuration updated, restarting...');
      this.stopWatching().then(() => this.startWatching());
    }
  }

  public addWatchPath(path: string): void {
    if (!this.config.watchPaths.includes(path)) {
      this.config.watchPaths.push(path);
      
      if (this.watcher) {
        this.watcher.add(path);
        logger.info(`📁 Added watch path: ${path}`);
      }
    }
  }

  public removeWatchPath(path: string): void {
    const index = this.config.watchPaths.indexOf(path);
    if (index > -1) {
      this.config.watchPaths.splice(index, 1);
      
      if (this.watcher) {
        this.watcher.unwatch(path);
        logger.info(`📁 Removed watch path: ${path}`);
      }
    }
  }

  public getWatchedPaths(): string[] {
    return [...this.config.watchPaths];
  }

  public isCurrentlyWatching(): boolean {
    return this.isWatching;
  }

  // Get current statistics
  public getWatcherStats(): { watchedPaths: number; isActive: boolean; configuredEvents: string[] } {
    return {
      watchedPaths: this.config.watchPaths.length,
      isActive: this.isWatching,
      configuredEvents: [...this.config.enabledEvents]
    };
  }
}