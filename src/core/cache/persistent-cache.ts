/**
 * Persistent Cross-Session Cache Implementation
 * Extends LRU cache with filesystem persistence for performance optimization
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { LRUCache, CacheEntry, LRUCacheOptions } from './lru-cache.js';
import { getErrorMessage } from '../../utils/error-utils.js';

export interface PersistentCacheOptions extends LRUCacheOptions {
  cacheDir?: string;
  persistInterval?: number; // How often to persist to disk (ms)
  enablePersistence?: boolean;
  compressionLevel?: number; // 0-9, 0 = no compression
}

export interface PersistentCacheMetadata {
  version: string;
  createdAt: number;
  lastPersisted: number;
  totalEntries: number;
  cacheFormat: 'v1';
}

export class PersistentCache<T> extends LRUCache<T> {
  private cacheDir: string;
  private cacheFile: string;
  private metadataFile: string;
  private persistInterval: number;
  private persistTimer: NodeJS.Timeout | null = null;
  private enablePersistence: boolean;
  private compressionLevel: number;
  private isDirty = false;
  private persistenceStats = {
    loadTime: 0,
    saveTime: 0,
    loadedEntries: 0,
    savedEntries: 0,
    loadErrors: 0,
    saveErrors: 0,
  };

  constructor(options: PersistentCacheOptions) {
    super(options);

    this.enablePersistence = options.enablePersistence !== false;
    this.cacheDir = options.cacheDir || join(process.cwd(), '.codecrucible', 'cache');
    this.persistInterval = options.persistInterval || 30000; // 30 seconds default
    this.compressionLevel = Math.max(0, Math.min(9, options.compressionLevel || 1));

    this.cacheFile = join(this.cacheDir, 'intelligent-cache.json');
    this.metadataFile = join(this.cacheDir, 'cache-metadata.json');

    if (this.enablePersistence) {
      this.initializePersistence();
    }

    console.log(
      `🗃️ Persistent cache initialized: ${this.enablePersistence ? 'enabled' : 'disabled'} (dir: ${this.cacheDir})`
    );
  }

  /**
   * Initialize persistence system and load existing cache
   */
  private initializePersistence(): void {
    try {
      // Ensure cache directory exists
      if (!existsSync(this.cacheDir)) {
        mkdirSync(this.cacheDir, { recursive: true });
        console.log(`🗃️ Created cache directory: ${this.cacheDir}`);
      }

      // Load existing cache if available
      this.loadFromDisk();

      // Set up periodic persistence
      if (this.persistInterval > 0) {
        this.persistTimer = setInterval(() => {
          if (this.isDirty) {
            this.saveToDisk();
          }
        }, this.persistInterval);

        // Don't keep process alive
        if (this.persistTimer.unref) {
          this.persistTimer.unref();
        }
      }

      // Save on process exit
      process.on('beforeExit', () => {
        if (this.isDirty) {
          this.saveToDisk();
        }
      });

      process.on('SIGINT', () => {
        if (this.isDirty) {
          this.saveToDisk();
        }
      });
    } catch (error) {
      console.error('🗃️ Failed to initialize persistent cache:', getErrorMessage(error));
      this.enablePersistence = false;
    }
  }

  /**
   * Load cache from disk with error handling and validation
   */
  private loadFromDisk(): void {
    if (!this.enablePersistence || !existsSync(this.cacheFile)) {
      return;
    }

    const startTime = Date.now();

    try {
      console.log('🗃️ Loading persistent cache from disk...');

      const cacheData = readFileSync(this.cacheFile, 'utf8');
      const parsedData = JSON.parse(cacheData);

      // Validate cache format
      if (!this.validateCacheFormat(parsedData)) {
        console.warn('🗃️ Invalid cache format, starting with empty cache');
        return;
      }

      let loadedCount = 0;
      const currentTime = Date.now();

      // Load entries and validate expiration
      for (const [key, entry] of Object.entries(parsedData.entries || {})) {
        const cacheEntry = entry as CacheEntry<T>;

        // Skip expired entries
        if (cacheEntry.expires && cacheEntry.expires < currentTime) {
          continue;
        }

        // Restore entry to cache
        this.setDirectly(key, cacheEntry);
        loadedCount++;
      }

      this.persistenceStats.loadTime = Date.now() - startTime;
      this.persistenceStats.loadedEntries = loadedCount;

      console.log(`🗃️ Loaded ${loadedCount} cache entries in ${this.persistenceStats.loadTime}ms`);

      // Load metadata if available
      if (existsSync(this.metadataFile)) {
        const metadata = JSON.parse(readFileSync(this.metadataFile, 'utf8'));
        console.log(
          `🗃️ Cache metadata: created ${new Date(metadata.createdAt).toLocaleString()}, ${metadata.totalEntries} total entries`
        );
      }
    } catch (error) {
      this.persistenceStats.loadErrors++;
      console.error('🗃️ Failed to load cache from disk:', getErrorMessage(error));
      console.log('🗃️ Starting with empty cache');
    }
  }

  /**
   * Save cache to disk with compression and metadata
   */
  private saveToDisk(): void {
    if (!this.enablePersistence) {
      return;
    }

    const startTime = Date.now();

    try {
      const cacheEntries: Record<string, CacheEntry<T>> = {};
      const currentTime = Date.now();
      let validEntries = 0;

      // Collect all valid (non-expired) entries
      for (const [key, entry] of this.cache.entries()) {
        if (!entry.expires || entry.expires > currentTime) {
          cacheEntries[key] = entry;
          validEntries++;
        }
      }

      // Create cache data structure
      const cacheData = {
        version: '1.0.0',
        format: 'v1',
        savedAt: currentTime,
        entries: cacheEntries,
      };

      // Create metadata
      const metadata: PersistentCacheMetadata = {
        version: '1.0.0',
        createdAt: existsSync(this.metadataFile)
          ? JSON.parse(readFileSync(this.metadataFile, 'utf8')).createdAt
          : currentTime,
        lastPersisted: currentTime,
        totalEntries: validEntries,
        cacheFormat: 'v1',
      };

      // Write files atomically
      const tempCacheFile = this.cacheFile + '.tmp';
      const tempMetadataFile = this.metadataFile + '.tmp';

      writeFileSync(
        tempCacheFile,
        JSON.stringify(cacheData, null, this.compressionLevel > 0 ? 0 : 2)
      );
      writeFileSync(tempMetadataFile, JSON.stringify(metadata, null, 2));

      // Atomic rename (works on most filesystems)
      if (existsSync(this.cacheFile)) {
        require('fs').unlinkSync(this.cacheFile);
      }
      if (existsSync(this.metadataFile)) {
        require('fs').unlinkSync(this.metadataFile);
      }

      require('fs').renameSync(tempCacheFile, this.cacheFile);
      require('fs').renameSync(tempMetadataFile, this.metadataFile);

      this.persistenceStats.saveTime = Date.now() - startTime;
      this.persistenceStats.savedEntries = validEntries;
      this.isDirty = false;

      console.log(
        `🗃️ Persisted ${validEntries} cache entries in ${this.persistenceStats.saveTime}ms`
      );
    } catch (error) {
      this.persistenceStats.saveErrors++;
      console.error('🗃️ Failed to save cache to disk:', getErrorMessage(error));
    }
  }

  /**
   * Validate cache file format
   */
  private validateCacheFormat(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      data.version &&
      data.format === 'v1' &&
      data.entries &&
      typeof data.entries === 'object'
    );
  }

  /**
   * Set cache entry directly (used during loading)
   */
  private setDirectly(key: string, entry: CacheEntry<T>): void {
    this.cache.set(key, entry);

    // Update access order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Override set method to mark cache as dirty
   */
  override set(key: string, value: T, ttl?: number): void {
    super.set(key, value, ttl);
    this.isDirty = true;
  }

  /**
   * Override delete method to mark cache as dirty
   */
  override delete(key: string): boolean {
    const result = super.delete(key);
    if (result) {
      this.isDirty = true;
    }
    return result;
  }

  /**
   * Override clear method to mark cache as dirty
   */
  override clear(): void {
    super.clear();
    this.isDirty = true;
  }

  /**
   * Force immediate persistence
   */
  forcePersist(): void {
    if (this.enablePersistence && this.isDirty) {
      this.saveToDisk();
    }
  }

  /**
   * Get enhanced cache statistics including persistence
   */
  getEnhancedStats() {
    const baseStats = super.getStats();

    return {
      ...baseStats,
      persistence: {
        enabled: this.enablePersistence,
        cacheDir: this.cacheDir,
        isDirty: this.isDirty,
        ...this.persistenceStats,
      },
    };
  }

  /**
   * Invalidate cache entries based on patterns or age
   */
  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0;

    for (const [key] of this.cache.entries()) {
      if (pattern.test(key)) {
        this.delete(key);
        invalidated++;
      }
    }

    console.log(`🗃️ Invalidated ${invalidated} cache entries matching pattern: ${pattern}`);
    return invalidated;
  }

  /**
   * Invalidate cache entries older than specified age
   */
  invalidateByAge(maxAge: number): number {
    let invalidated = 0;
    const cutoffTime = Date.now() - maxAge;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < cutoffTime) {
        this.delete(key);
        invalidated++;
      }
    }

    console.log(`🗃️ Invalidated ${invalidated} cache entries older than ${maxAge}ms`);
    return invalidated;
  }

  /**
   * Cleanup and shutdown persistence
   */
  override destroy(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }

    if (this.enablePersistence && this.isDirty) {
      this.saveToDisk();
    }

    super.destroy();
  }
}
