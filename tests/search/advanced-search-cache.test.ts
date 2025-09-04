/**
 * Advanced Search Cache - Comprehensive Tests
 * Tests file-hash based cache invalidation, performance optimization, and memory management
 * Validates cache hit rates and memory efficiency claims
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  AdvancedSearchCacheManager,
  CachedSearchExecutor,
} from '../../src/core/search/advanced-search-cache.js';
import type {
  CacheConfig,
  CacheEntry,
  CacheStats,
} from '../../src/core/search/advanced-search-cache.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';

describe('Advanced Search Cache - Comprehensive Tests', () => {
  let testWorkspace: string;
  let cacheManager: AdvancedSearchCacheManager;
  let cachedExecutor: CachedSearchExecutor;

  const testConfig: CacheConfig = {
    maxCacheSize: 50,
    maxCacheAge: 5000, // 5 seconds for testing
    enableFileHashTracking: true,
    enablePerformanceMetrics: true,
    compactionInterval: 1000, // 1 second for testing
    compressionThreshold: 1000, // 1KB for testing
  };

  // Mock search results for testing
  const mockSearchResults = {
    simple: {
      documents: [
        {
          filePath: 'test.ts',
          content: 'export function testFunction() {}',
          line: 1,
          column: 0,
          similarity: 0.95,
        },
      ],
      query: 'testFunction',
      totalDocuments: 1,
      processingTimeMs: 100,
    },
    complex: {
      documents: Array.from({ length: 10 }, (_, i) => ({
        filePath: `file${i}.ts`,
        content: `export function func${i}() { return ${i}; }`,
        line: i + 1,
        column: 0,
        similarity: 0.8 + i * 0.01,
      })),
      query: 'func.*',
      totalDocuments: 10,
      processingTimeMs: 250,
    },
  };

  beforeAll(async () => {
    // Create isolated test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'cache-test-'));

    // Create some test files for file tracking
    const testFiles = {
      'src/test.ts': 'export function testFunction() {}',
      'src/utils.ts': 'export function utilFunction() {}',
      'src/main.ts': 'import { testFunction } from "./test";',
    };

    for (const [filePath, content] of Object.entries(testFiles)) {
      const fullPath = join(testWorkspace, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
    }
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Create fresh cache manager for each test
    cacheManager = new AdvancedSearchCacheManager(testConfig);
    cachedExecutor = new CachedSearchExecutor(cacheManager);
  });

  afterEach(async () => {
    // Clean up cache manager
    await cacheManager.shutdown();
  });

  describe('Basic Caching Operations', () => {
    it('should cache and retrieve search results', async () => {
      const queryKey = 'test-query-1';
      const searchResults = mockSearchResults.simple;

      // Cache results
      await cacheManager.setCachedResults(queryKey, searchResults, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.9,
        duration: 100,
      });

      // Retrieve results
      const cached = await cacheManager.getCachedResults(queryKey);

      expect(cached).toBeDefined();
      expect(cached).toEqual(searchResults);
    });

    it('should return null for non-existent cache entries', async () => {
      const result = await cacheManager.getCachedResults('non-existent-key');
      expect(result).toBeNull();
    });

    it('should respect cache size limits', async () => {
      const promises: Promise<void>[] = [];

      // Add more entries than maxCacheSize
      for (let i = 0; i < testConfig.maxCacheSize + 10; i++) {
        promises.push(
          cacheManager.setCachedResults(`query-${i}`, mockSearchResults.simple, {
            searchMethod: 'ripgrep',
            queryType: 'function',
            confidence: 0.8,
            duration: 50,
          })
        );
      }

      await Promise.all(promises);

      // Allow maintenance to run
      await new Promise(resolve => setTimeout(resolve, 1500));

      const stats = cacheManager.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(testConfig.maxCacheSize);
    });

    it('should expire old cache entries', async () => {
      const queryKey = 'expiring-query';

      // Cache with short TTL
      await cacheManager.setCachedResults(queryKey, mockSearchResults.simple, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.8,
        duration: 50,
      });

      // Should be available immediately
      let cached = await cacheManager.getCachedResults(queryKey);
      expect(cached).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, testConfig.maxCacheAge + 100));

      // Should be expired now
      cached = await cacheManager.getCachedResults(queryKey, { maxAge: testConfig.maxCacheAge });
      expect(cached).toBeNull();
    });
  });

  describe('File-Hash Based Invalidation', () => {
    it('should track file modifications and invalidate cache', async () => {
      const testFile = join(testWorkspace, 'src/test.ts');
      const queryKey = 'file-tracking-query';

      // Cache results with file tracking
      await cacheManager.setCachedResults(queryKey, mockSearchResults.simple, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.9,
        duration: 100,
        filePaths: [testFile],
      });

      // Should be cached
      let cached = await cacheManager.getCachedResults(queryKey, {
        checkFileModifications: true,
      });
      expect(cached).toBeDefined();

      // Modify the file
      await writeFile(testFile, 'export function modifiedTestFunction() {}');

      // Should be invalidated due to file change
      cached = await cacheManager.getCachedResults(queryKey, {
        checkFileModifications: true,
      });
      expect(cached).toBeNull();
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = join(testWorkspace, 'non-existent.ts');
      const queryKey = 'missing-file-query';

      // Cache results with non-existent file
      await cacheManager.setCachedResults(queryKey, mockSearchResults.simple, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.9,
        duration: 100,
        filePaths: [nonExistentFile],
      });

      // Should invalidate due to missing file
      const cached = await cacheManager.getCachedResults(queryKey, {
        checkFileModifications: true,
      });
      expect(cached).toBeNull();
    });

    it('should track multiple files correctly', async () => {
      const testFiles = [
        join(testWorkspace, 'src/test.ts'),
        join(testWorkspace, 'src/utils.ts'),
        join(testWorkspace, 'src/main.ts'),
      ];
      const queryKey = 'multi-file-query';

      // Cache results with multiple files
      await cacheManager.setCachedResults(queryKey, mockSearchResults.complex, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.85,
        duration: 200,
        filePaths: testFiles,
      });

      // Should be cached
      let cached = await cacheManager.getCachedResults(queryKey, {
        checkFileModifications: true,
      });
      expect(cached).toBeDefined();

      // Modify one file
      await writeFile(testFiles[1], 'export function modifiedUtilFunction() {}');

      // Should be invalidated due to any file change
      cached = await cacheManager.getCachedResults(queryKey, {
        checkFileModifications: true,
      });
      expect(cached).toBeNull();
    });
  });

  describe('Cache Statistics and Analytics', () => {
    it('should track hit and miss rates', async () => {
      const queries = ['query1', 'query2', 'query3'];

      // Cache some results
      for (const query of queries) {
        await cacheManager.setCachedResults(query, mockSearchResults.simple, {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.8,
          duration: 50,
        });
      }

      // Generate cache hits
      for (const query of queries) {
        await cacheManager.getCachedResults(query);
      }

      // Generate cache misses
      await cacheManager.getCachedResults('miss1');
      await cacheManager.getCachedResults('miss2');

      const stats = cacheManager.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.missRate).toBeGreaterThan(0);
      expect(stats.hitRate + stats.missRate).toBeCloseTo(1, 2);
    });

    it('should track memory usage', async () => {
      const initialStats = cacheManager.getStats();
      const initialMemory = initialStats.memoryUsage;

      // Add large cache entries
      for (let i = 0; i < 10; i++) {
        await cacheManager.setCachedResults(`large-query-${i}`, mockSearchResults.complex, {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.8,
          duration: 100,
        });
      }

      const finalStats = cacheManager.getStats();
      expect(finalStats.memoryUsage).toBeGreaterThan(initialMemory);
      expect(finalStats.totalEntries).toBe(10);
    });

    it('should provide invalidation statistics', async () => {
      const testFile = join(testWorkspace, 'src/invalidation-test.ts');
      await writeFile(testFile, 'export function originalFunction() {}');

      // Cache and then invalidate multiple entries
      for (let i = 0; i < 5; i++) {
        await cacheManager.setCachedResults(`invalidation-${i}`, mockSearchResults.simple, {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.8,
          duration: 50,
          filePaths: [testFile],
        });
      }

      // Modify file to invalidate all entries
      await writeFile(testFile, 'export function modifiedFunction() {}');

      // Trigger invalidation checks
      for (let i = 0; i < 5; i++) {
        await cacheManager.getCachedResults(`invalidation-${i}`, {
          checkFileModifications: true,
        });
      }

      const stats = cacheManager.getStats();
      expect(stats.invalidationRate).toBeGreaterThan(0);
    });
  });

  describe('Pattern-Based Invalidation', () => {
    it('should invalidate cache entries by file pattern', async () => {
      const testFiles = [
        join(testWorkspace, 'src/component.tsx'),
        join(testWorkspace, 'src/utils.ts'),
        join(testWorkspace, 'tests/test.spec.ts'),
      ];

      // Create test files
      for (const file of testFiles) {
        const dir = file.substring(0, file.lastIndexOf('/'));
        await mkdir(dir, { recursive: true });
        await writeFile(file, 'export function testFunc() {}');
      }

      // Cache results for different files
      for (let i = 0; i < testFiles.length; i++) {
        await cacheManager.setCachedResults(`pattern-query-${i}`, mockSearchResults.simple, {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.8,
          duration: 50,
          filePaths: [testFiles[i]],
        });
      }

      // Invalidate only TypeScript files (not test files)
      const invalidatedCount = await cacheManager.invalidateByPattern({
        filePattern: /\.ts$/,
      });

      expect(invalidatedCount).toBe(1); // Only utils.ts should match

      // Verify correct entries were invalidated
      const remaining = await cacheManager.getCachedResults('pattern-query-0'); // component.tsx
      const invalidated = await cacheManager.getCachedResults('pattern-query-1'); // utils.ts
      const testFile = await cacheManager.getCachedResults('pattern-query-2'); // test.spec.ts

      expect(remaining).toBeDefined(); // .tsx file should remain
      expect(invalidated).toBeNull(); // .ts file should be invalidated
      expect(testFile).toBeDefined(); // .spec.ts file should remain
    });

    it('should invalidate by query pattern', async () => {
      const queries = ['function-search', 'class-search', 'import-search'];

      // Cache different types of queries
      for (const query of queries) {
        await cacheManager.setCachedResults(query, mockSearchResults.simple, {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.8,
          duration: 50,
        });
      }

      // Invalidate only function-related queries
      const invalidatedCount = await cacheManager.invalidateByPattern({
        queryPattern: /function/,
      });

      expect(invalidatedCount).toBe(1);

      // Verify correct entries were invalidated
      expect(await cacheManager.getCachedResults('function-search')).toBeNull();
      expect(await cacheManager.getCachedResults('class-search')).toBeDefined();
      expect(await cacheManager.getCachedResults('import-search')).toBeDefined();
    });

    it('should invalidate by search method', async () => {
      const queries = ['ripgrep-1', 'ripgrep-2', 'rag-1'];
      const methods = ['ripgrep', 'ripgrep', 'rag'] as const;

      // Cache results from different search methods
      for (let i = 0; i < queries.length; i++) {
        await cacheManager.setCachedResults(queries[i], mockSearchResults.simple, {
          searchMethod: methods[i],
          queryType: 'function',
          confidence: 0.8,
          duration: 50,
        });
      }

      // Invalidate only ripgrep results
      const invalidatedCount = await cacheManager.invalidateByPattern({
        searchMethod: 'ripgrep',
      });

      expect(invalidatedCount).toBe(2);

      // Verify correct entries were invalidated
      expect(await cacheManager.getCachedResults('ripgrep-1')).toBeNull();
      expect(await cacheManager.getCachedResults('ripgrep-2')).toBeNull();
      expect(await cacheManager.getCachedResults('rag-1')).toBeDefined();
    });
  });

  describe('Cache Preloading', () => {
    it('should preload common patterns', async () => {
      const patterns = [
        {
          query: 'export function',
          searchMethod: 'ripgrep' as const,
          executor: async () => mockSearchResults.simple,
        },
        {
          query: 'import.*from',
          searchMethod: 'ripgrep' as const,
          executor: async () => mockSearchResults.complex,
        },
      ];

      await cacheManager.preloadCommonPatterns(patterns);

      // Verify patterns were cached
      const stats = cacheManager.getStats();
      expect(stats.totalEntries).toBe(2);
    });

    it('should skip preloading already cached patterns', async () => {
      const pattern = {
        query: 'test-pattern',
        searchMethod: 'ripgrep' as const,
        executor: jest.fn().mockResolvedValue(mockSearchResults.simple),
      };

      // Manually cache the pattern first
      const queryKey = 'test-pattern-key';
      await cacheManager.setCachedResults(queryKey, mockSearchResults.simple, {
        searchMethod: 'ripgrep',
        queryType: 'preload',
        confidence: 0.8,
        duration: 50,
      });

      // Preload should skip already cached patterns
      await cacheManager.preloadCommonPatterns([pattern]);

      // Executor should not have been called
      expect(pattern.executor).not.toHaveBeenCalled();
    });
  });

  describe('Cache Export and Analysis', () => {
    it('should export cache for analysis', async () => {
      // Add some cache entries
      for (let i = 0; i < 5; i++) {
        await cacheManager.setCachedResults(`export-test-${i}`, mockSearchResults.simple, {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.8,
          duration: 50 + i * 10,
        });
      }

      const exportPath = join(testWorkspace, 'cache-export.json');
      await cacheManager.exportCache(exportPath);

      // Verify export file was created
      // (In a real test, we'd read and validate the JSON structure)
      const fs = await import('fs/promises');
      const exportExists = await fs
        .access(exportPath)
        .then(() => true)
        .catch(() => false);
      expect(exportExists).toBe(true);
    });
  });

  describe('Cached Search Executor', () => {
    it('should execute and cache search results automatically', async () => {
      const searchFunction = jest.fn().mockResolvedValue(mockSearchResults.simple);

      const result = await cachedExecutor.executeWithCache('auto-cache-test', searchFunction, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.9,
      });

      expect(result).toEqual(mockSearchResults.simple);
      expect(searchFunction).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const cachedResult = await cachedExecutor.executeWithCache(
        'auto-cache-test',
        searchFunction,
        {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.9,
        }
      );

      expect(cachedResult).toEqual(mockSearchResults.simple);
      expect(searchFunction).toHaveBeenCalledTimes(1); // Still only once
    });

    it('should bypass cache when requested', async () => {
      const searchFunction = jest.fn().mockResolvedValue(mockSearchResults.simple);

      // First call
      await cachedExecutor.executeWithCache('bypass-test', searchFunction, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.9,
      });

      // Second call with bypass
      await cachedExecutor.executeWithCache('bypass-test', searchFunction, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.9,
        bypassCache: true,
      });

      expect(searchFunction).toHaveBeenCalledTimes(2);
    });

    it('should track file dependencies automatically', async () => {
      const testFiles = [join(testWorkspace, 'src/dependency.ts')];
      await writeFile(testFiles[0], 'export function dependencyFunc() {}');

      const searchFunction = jest.fn().mockResolvedValue(mockSearchResults.simple);

      await cachedExecutor.executeWithCache('dependency-test', searchFunction, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.9,
        filePaths: testFiles,
      });

      // Modify the file
      await writeFile(testFiles[0], 'export function modifiedDependencyFunc() {}');

      // Should execute again due to file change
      await cachedExecutor.executeWithCache('dependency-test', searchFunction, {
        searchMethod: 'ripgrep',
        queryType: 'function',
        confidence: 0.9,
        filePaths: testFiles,
      });

      expect(searchFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory Management and Performance', () => {
    it('should perform automatic maintenance', async () => {
      // Fill cache beyond capacity
      for (let i = 0; i < testConfig.maxCacheSize + 20; i++) {
        await cacheManager.setCachedResults(`maintenance-${i}`, mockSearchResults.simple, {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.8,
          duration: 50,
        });
      }

      // Wait for maintenance cycle
      await new Promise(resolve => setTimeout(resolve, testConfig.compactionInterval + 500));

      const stats = cacheManager.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(testConfig.maxCacheSize);
    });

    it('should clear all cache entries', async () => {
      // Add some entries
      for (let i = 0; i < 10; i++) {
        await cacheManager.setCachedResults(`clear-test-${i}`, mockSearchResults.simple, {
          searchMethod: 'ripgrep',
          queryType: 'function',
          confidence: 0.8,
          duration: 50,
        });
      }

      let stats = cacheManager.getStats();
      expect(stats.totalEntries).toBe(10);

      // Clear cache
      await cacheManager.clearCache();

      stats = cacheManager.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.missRate).toBe(0);
    });

    it('should not leak memory during extended operation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many cache operations
      for (let cycle = 0; cycle < 5; cycle++) {
        // Fill cache
        for (let i = 0; i < 20; i++) {
          await cacheManager.setCachedResults(`leak-test-${cycle}-${i}`, mockSearchResults.simple, {
            searchMethod: 'ripgrep',
            queryType: 'function',
            confidence: 0.8,
            duration: 50,
          });
        }

        // Clear cache
        await cacheManager.clearCache();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
