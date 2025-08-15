import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { logger } from './logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  relativePath: string;
  language: string;
  content?: string;
  timestamp: number;
}

export interface WatcherOptions {
  patterns?: string[];
  ignorePatterns?: string[];
  debounceMs?: number;
  includeContent?: boolean;
  maxFileSize?: number; // in bytes
}

/**
 * Real-time file watcher for agentic coding assistance
 * Monitors project files and triggers contextual responses
 */
export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private workingDirectory: string;
  private options: WatcherOptions;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private isActive = false;

  constructor(workingDirectory: string, options: WatcherOptions = {}) {
    super();
    this.workingDirectory = workingDirectory;
    this.options = {
      patterns: options.patterns || ['**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs,php,rb,go,rs,json,md,yml,yaml}'],
      ignorePatterns: options.ignorePatterns || [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '.next/**',
        '.cache/**',
        'coverage/**',
        '*.log',
        '.env*',
        '*.tmp',
        '*.temp'
      ],
      debounceMs: options.debounceMs || 1000,
      includeContent: options.includeContent ?? true,
      maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB default
      ...options
    };
  }

  /**
   * Start watching files in the working directory
   */
  async start(): Promise<void> {
    if (this.isActive) {
      logger.warn('File watcher already active');
      return;
    }

    try {
      this.watcher = watch(this.options.patterns!, {
        cwd: this.workingDirectory,
        ignored: this.options.ignorePatterns,
        ignoreInitial: true,
        persistent: true,
        depth: 10, // Reasonable depth to prevent infinite recursion
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100
        }
      });

      this.watcher.on('add', (filePath) => this.handleFileEvent('add', filePath));
      this.watcher.on('change', (filePath) => this.handleFileEvent('change', filePath));
      this.watcher.on('unlink', (filePath) => this.handleFileEvent('unlink', filePath));
      
      this.watcher.on('error', (error) => {
        logger.error('File watcher error:', error);
        this.emit('error', error);
      });

      this.watcher.on('ready', () => {
        this.isActive = true;
        const watchedPaths = this.watcher?.getWatched();
        const fileCount = Object.values(watchedPaths || {}).flat().length;
        logger.info(`File watcher started, monitoring ${fileCount} files in ${this.workingDirectory}`);
        this.emit('ready');
      });

    } catch (error) {
      logger.error('Failed to start file watcher:', error);
      throw error;
    }
  }

  /**
   * Stop the file watcher
   */
  async stop(): Promise<void> {
    if (!this.isActive || !this.watcher) {
      return;
    }

    // Clear any pending debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    await this.watcher.close();
    this.watcher = null;
    this.isActive = false;
    
    logger.info('File watcher stopped');
    this.emit('stopped');
  }

  /**
   * Handle file system events with debouncing
   */
  private handleFileEvent(type: 'add' | 'change' | 'unlink', filePath: string): void {
    const fullPath = path.resolve(this.workingDirectory, filePath);
    
    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(fullPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(fullPath);
      await this.processFileEvent(type, filePath, fullPath);
    }, this.options.debounceMs);

    this.debounceTimers.set(fullPath, timer);
  }

  /**
   * Process the actual file event
   */
  private async processFileEvent(type: 'add' | 'change' | 'unlink', relativePath: string, fullPath: string): Promise<void> {
    try {
      const language = this.detectLanguage(relativePath);
      const event: FileChangeEvent = {
        type,
        path: fullPath,
        relativePath,
        language,
        timestamp: Date.now()
      };

      // Read file content if requested and file still exists
      if (this.options.includeContent && type !== 'unlink') {
        try {
          const stats = await fs.stat(fullPath);
          
          // Check file size limit
          if (stats.size > this.options.maxFileSize!) {
            logger.warn(`File ${relativePath} too large (${stats.size} bytes), skipping content`);
          } else {
            event.content = await fs.readFile(fullPath, 'utf-8');
          }
        } catch (error) {
          logger.warn(`Failed to read file ${relativePath}:`, error);
        }
      }

      logger.info(`File ${type}: ${relativePath} (${language})`);
      this.emit('change', event);
      this.emit(type, event);

    } catch (error) {
      logger.error(`Error processing file event for ${relativePath}:`, error);
    }
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.vue': 'vue',
      '.xml': 'xml',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bash': 'bash',
      '.zsh': 'zsh',
      '.fish': 'fish'
    };

    return languageMap[ext] || 'text';
  }

  /**
   * Check if watcher is active
   */
  isWatching(): boolean {
    return this.isActive;
  }

  /**
   * Get current watcher statistics
   */
  getStats(): { fileCount: number; watchedPaths: string[] } {
    if (!this.watcher) {
      return { fileCount: 0, watchedPaths: [] };
    }

    const watchedPaths = this.watcher.getWatched();
    const allPaths = Object.keys(watchedPaths).flatMap(dir => 
      watchedPaths[dir].map(file => path.join(dir, file))
    );

    return {
      fileCount: allPaths.length,
      watchedPaths: allPaths
    };
  }

  /**
   * Update watcher options and restart if necessary
   */
  async updateOptions(newOptions: Partial<WatcherOptions>): Promise<void> {
    const wasActive = this.isActive;
    
    if (wasActive) {
      await this.stop();
    }

    this.options = { ...this.options, ...newOptions };

    if (wasActive) {
      await this.start();
    }
  }
}