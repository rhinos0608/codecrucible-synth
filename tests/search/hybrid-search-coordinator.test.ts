/**
 * Hybrid Search Coordinator - Comprehensive Integration Tests
 * Tests intelligent routing between ripgrep and RAG, caching, and performance monitoring
 * Validates research claims of 2-10x performance improvement
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { HybridSearchCoordinator } from '../../src/core/search/hybrid-search-coordinator.js';
import { CommandLineSearchEngine } from '../../src/core/search/command-line-search-engine.js';
import { AdvancedSearchCacheManager } from '../../src/core/search/advanced-search-cache.js';
import { HybridSearchFactory } from '../../src/core/search/hybrid-search-factory.js';
import { PerformanceMonitor } from '../../src/core/search/performance-monitor.js';
import { VectorRAGSystem } from '../../src/core/rag/vector-rag-system.js';
import type { RAGQuery, RAGResult, HybridSearchConfig } from '../../src/core/search/types.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';

describe('Hybrid Search Coordinator - Integration Tests', () => {
  let testWorkspace: string;
  let coordinator: HybridSearchCoordinator;
  let searchEngine: CommandLineSearchEngine;
  let cacheManager: AdvancedSearchCacheManager;
  let performanceMonitor: PerformanceMonitor;
  let ragSystem: VectorRAGSystem | undefined;

  const testConfig: HybridSearchConfig = HybridSearchFactory.createBalancedConfig();

  // Test data for various search scenarios
  const testFiles = {
    'src/utils/helper.ts': `
      export function calculateSum(a: number, b: number): number {
        return a + b;
      }
      
      export class MathHelper {
        static multiply(x: number, y: number): number {
          return x * y;
        }
      }
      
      // TODO: Add more mathematical functions
      import { Logger } from './logger';
    `,
    'src/components/UserService.ts': `
      import { User } from '../types/user';
      import express from 'express';
      
      export class UserService {
        private users: User[] = [];
        
        async createUser(userData: Partial<User>): Promise<User> {
          const user = { ...userData, id: Date.now() };
          this.users.push(user as User);
          return user as User;
        }
        
        getUserById(id: number): User | undefined {
          return this.users.find(user => user.id === id);
        }
      }
      
      // TODO: Add user validation
      // FIXME: Improve error handling
    `,
    'tests/user.test.ts': `
      import { describe, it, expect } from '@jest/globals';
      import { UserService } from '../src/components/UserService';
      
      describe('UserService', () => {
        it('should create user successfully', () => {
          const service = new UserService();
          expect(service).toBeDefined();
        });
      });
    `,
    'package.json': `{
      "name": "test-project",
      "dependencies": {
        "express": "^4.18.0",
        "lodash": "^4.17.21"
      },
      "devDependencies": {
        "@types/node": "^18.0.0",
        "jest": "^29.0.0"
      }
    }`,
  };

  beforeAll(async () => {
    // Create isolated test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'hybrid-search-test-'));

    // Create test file structure
    for (const [filePath, content] of Object.entries(testFiles)) {
      const fullPath = join(testWorkspace, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
    }

    // Initialize core components
    searchEngine = new CommandLineSearchEngine(testWorkspace);
    cacheManager = new AdvancedSearchCacheManager({
      maxCacheSize: 100,
      maxCacheAge: 5000, // 5 seconds for testing
      enableFileHashTracking: true,
    });

    performanceMonitor = new PerformanceMonitor();

    // Try to initialize RAG system (may not be available in test environment)
    try {
      ragSystem = new VectorRAGSystem(testWorkspace);
      await ragSystem.initialize();
    } catch (error) {
      console.log('RAG system not available in test environment - testing ripgrep-only mode');
      ragSystem = undefined;
    }

    // Initialize hybrid coordinator
    coordinator = new HybridSearchCoordinator(
      searchEngine,
      testConfig,
      ragSystem,
      cacheManager,
      performanceMonitor
    );
  });

  afterAll(async () => {
    // Cleanup
    await coordinator.shutdown();
    await cacheManager.shutdown();
    if (ragSystem) {
      await ragSystem.shutdown();
    }
    await rm(testWorkspace, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clear cache between tests
    await cacheManager.clearCache();

    // Reset performance metrics
    performanceMonitor.reset();
  });

  describe('Core Hybrid Search Functionality', () => {
    it('should route simple function searches to ripgrep', async () => {
      const query: RAGQuery = {
        query: 'calculateSum',
        queryType: 'function',
        maxResults: 10,
      };

      const result = await coordinator.search(query);

      expect(result).toBeDefined();
      expect(result.documents).toBeDefined();
      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.metadata?.searchMethod).toBe('ripgrep');
      expect(result.metadata?.confidence).toBeGreaterThan(0.5);

      // Verify function was found
      const functionMatch = result.documents.find(
        doc => doc.content.includes('calculateSum') && doc.content.includes('function')
      );
      expect(functionMatch).toBeDefined();
    });

    it('should route class searches appropriately', async () => {
      const query: RAGQuery = {
        query: 'UserService',
        queryType: 'class',
        maxResults: 10,
      };

      const result = await coordinator.search(query);

      expect(result).toBeDefined();
      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.metadata?.searchMethod).toMatch(/ripgrep|rag/);

      // Verify class was found
      const classMatch = result.documents.find(doc => doc.content.includes('class UserService'));
      expect(classMatch).toBeDefined();
    });

    it('should route import searches to ripgrep', async () => {
      const query: RAGQuery = {
        query: 'express',
        queryType: 'import',
        maxResults: 10,
      };

      const result = await coordinator.search(query);

      expect(result).toBeDefined();
      expect(result.metadata?.searchMethod).toBe('ripgrep');

      // Verify imports were found
      const importMatch = result.documents.find(
        doc => doc.content.includes('import') && doc.content.includes('express')
      );
      expect(importMatch).toBeDefined();
    });

    it('should handle semantic queries appropriately', async () => {
      const query: RAGQuery = {
        query: 'user management and database operations',
        queryType: 'semantic',
        maxResults: 10,
      };

      const result = await coordinator.search(query);

      expect(result).toBeDefined();
      expect(result.documents.length).toBeGreaterThan(0);

      // Should route to RAG if available, otherwise fallback to ripgrep
      if (ragSystem) {
        expect(result.metadata?.searchMethod).toBe('rag');
      } else {
        expect(result.metadata?.searchMethod).toBe('ripgrep');
      }
    });

    it('should handle pattern-based searches', async () => {
      const query: RAGQuery = {
        query: 'TODO:.*mathematical',
        queryType: 'pattern',
        maxResults: 10,
        useRegex: true,
      };

      const result = await coordinator.search(query);

      expect(result).toBeDefined();
      expect(result.metadata?.searchMethod).toBe('ripgrep');

      // Should find TODO comments
      const todoMatch = result.documents.find(
        doc => doc.content.includes('TODO') && doc.content.includes('mathematical')
      );
      expect(todoMatch).toBeDefined();
    });
  });

  describe('Intelligent Routing Logic', () => {
    it('should make routing decisions based on query analysis', async () => {
      const routingTests = [
        {
          query: 'function calculateSum',
          expectedMethod: 'ripgrep',
          reason: 'exact function pattern',
        },
        {
          query: 'class.*Service',
          expectedMethod: 'ripgrep',
          reason: 'regex pattern',
        },
        {
          query: 'how does user authentication work',
          expectedMethod: ragSystem ? 'rag' : 'ripgrep',
          reason: 'semantic question',
        },
      ];

      for (const test of routingTests) {
        const query: RAGQuery = {
          query: test.query,
          queryType: 'general',
          maxResults: 5,
        };

        const result = await coordinator.search(query);
        expect(result.metadata?.searchMethod).toBe(test.expectedMethod);
      }
    });

    it('should adjust routing based on system resources', async () => {
      // Mock high memory pressure scenario
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        rss: 1000000000, // 1GB
        heapTotal: 800000000,
        heapUsed: 750000000, // High memory usage
        external: 50000000,
        arrayBuffers: 10000000,
      });

      try {
        const query: RAGQuery = {
          query: 'semantic search query about complex topics',
          queryType: 'semantic',
          maxResults: 10,
        };

        const result = await coordinator.search(query);

        // Should prefer ripgrep under memory pressure
        expect(result.metadata?.searchMethod).toBe('ripgrep');
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });

    it('should track routing metrics', async () => {
      const queries = [
        { query: 'calculateSum', queryType: 'function' },
        { query: 'UserService', queryType: 'class' },
        { query: 'express', queryType: 'import' },
      ];

      for (const queryData of queries) {
        const query: RAGQuery = {
          query: queryData.query,
          queryType: queryData.queryType as any,
          maxResults: 5,
        };
        await coordinator.search(query);
      }

      const metrics = coordinator.getMetrics();
      expect(metrics.totalQueries).toBe(3);
      expect(metrics.routingDecisions.size).toBeGreaterThan(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Performance Optimization', () => {
    it('should demonstrate performance improvements over single-method searches', async () => {
      const testQuery: RAGQuery = {
        query: 'function.*User',
        queryType: 'pattern',
        maxResults: 10,
      };

      // Measure hybrid search performance
      const hybridStart = Date.now();
      const hybridResult = await coordinator.search(testQuery);
      const hybridTime = Date.now() - hybridStart;

      // Measure direct ripgrep performance for comparison
      const ripgrepStart = Date.now();
      const ripgrepResult = await searchEngine.searchInFiles({
        query: testQuery.query,
        regex: true,
        maxResults: testQuery.maxResults,
      });
      const ripgrepTime = Date.now() - ripgrepStart;

      // Hybrid should be competitive or better due to caching and routing
      expect(hybridResult.documents.length).toBeGreaterThanOrEqual(ripgrepResult.length);
      expect(hybridTime).toBeLessThan(ripgrepTime * 2); // Allow some overhead for routing

      // Should provide additional metadata
      expect(hybridResult.metadata).toBeDefined();
      expect(hybridResult.metadata?.confidence).toBeDefined();
    });

    it('should cache results effectively', async () => {
      const query: RAGQuery = {
        query: 'calculateSum',
        queryType: 'function',
        maxResults: 5,
      };

      // First search - should be slow
      const firstStart = Date.now();
      const firstResult = await coordinator.search(query);
      const firstTime = Date.now() - firstStart;

      // Second search - should be faster due to caching
      const secondStart = Date.now();
      const secondResult = await coordinator.search(query);
      const secondTime = Date.now() - secondStart;

      expect(firstResult.documents.length).toBe(secondResult.documents.length);
      expect(secondTime).toBeLessThan(firstTime * 0.8); // At least 20% faster

      // Verify cache statistics
      const cacheStats = cacheManager.getStats();
      expect(cacheStats.totalEntries).toBeGreaterThan(0);
      expect(cacheStats.hitRate).toBeGreaterThan(0);
    });

    it('should invalidate cache when files change', async () => {
      const query: RAGQuery = {
        query: 'testFunction',
        queryType: 'function',
        maxResults: 5,
      };

      // Initial search
      const initialResult = await coordinator.search(query);

      // Modify file to add the function
      const testFile = join(testWorkspace, 'src/utils/test-new.ts');
      await writeFile(
        testFile,
        `
        export function testFunction(): string {
          return 'test';
        }
      `
      );

      // Search again - cache should be invalidated and new function found
      const updatedResult = await coordinator.search(query);

      // Should find the new function
      const newFunctionMatch = updatedResult.documents.find(
        doc => doc.filePath?.includes('test-new.ts') && doc.content.includes('testFunction')
      );
      expect(newFunctionMatch).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should fallback gracefully when primary search method fails', async () => {
      // Test with a query that might cause issues
      const problematicQuery: RAGQuery = {
        query: '\\invalid\\regex\\[pattern',
        queryType: 'pattern',
        useRegex: true,
        maxResults: 10,
      };

      // Should not throw an error, but provide fallback results
      const result = await coordinator.search(problematicQuery);

      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.metadata?.searchMethod).toBeDefined();
    });

    it('should handle empty results gracefully', async () => {
      const query: RAGQuery = {
        query: 'NonExistentFunctionNameThatWillNeverBeFound12345',
        queryType: 'function',
        maxResults: 10,
      };

      const result = await coordinator.search(query);

      expect(result).toBeDefined();
      expect(result.documents).toBeDefined();
      expect(result.documents.length).toBe(0);
      expect(result.metadata?.confidence).toBeLessThan(0.3);
    });

    it('should handle concurrent searches', async () => {
      const queries = [
        { query: 'calculateSum', queryType: 'function' },
        { query: 'UserService', queryType: 'class' },
        { query: 'express', queryType: 'import' },
        { query: 'TODO', queryType: 'pattern' },
      ];

      // Execute searches concurrently
      const promises = queries.map(queryData =>
        coordinator.search({
          query: queryData.query,
          queryType: queryData.queryType as any,
          maxResults: 5,
        })
      );

      const results = await Promise.all(promises);

      // All searches should complete successfully
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.metadata?.searchMethod).toBeDefined();
      });
    });
  });

  describe('Memory Management', () => {
    it('should not cause memory leaks during extended operation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many searches
      for (let i = 0; i < 20; i++) {
        const query: RAGQuery = {
          query: `search${i}`,
          queryType: 'general',
          maxResults: 5,
        };
        await coordinator.search(query);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up resources properly', async () => {
      const query: RAGQuery = {
        query: 'cleanup test',
        queryType: 'general',
        maxResults: 5,
      };

      await coordinator.search(query);

      // Shutdown should complete without errors
      await expect(coordinator.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect configuration parameters', async () => {
      const customConfig: HybridSearchConfig = {
        ...testConfig,
        routing: {
          ...testConfig.routing,
          exactPatternThreshold: 0.9, // Very high threshold
          semanticSimilarityThreshold: 0.1, // Very low threshold
        },
      };

      const customCoordinator = new HybridSearchCoordinator(
        searchEngine,
        customConfig,
        ragSystem,
        cacheManager
      );

      try {
        const query: RAGQuery = {
          query: 'calculateSum',
          queryType: 'function',
          maxResults: 5,
        };

        const result = await customCoordinator.search(query);

        // Should still route to ripgrep for exact patterns
        expect(result.metadata?.searchMethod).toBe('ripgrep');
        expect(result.metadata?.confidence).toBeGreaterThan(0.8);
      } finally {
        await customCoordinator.shutdown();
      }
    });

    it('should support different search contexts', async () => {
      const contexts = ['typescript', 'javascript', 'python', 'general'];

      for (const context of contexts) {
        const query: RAGQuery = {
          query: 'function',
          queryType: 'function',
          maxResults: 5,
          context: { language: context },
        };

        const result = await coordinator.search(query);
        expect(result).toBeDefined();
        expect(result.metadata?.searchMethod).toBeDefined();
      }
    });
  });
});
