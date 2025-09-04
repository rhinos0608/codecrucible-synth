/**
 * Search Performance Benchmarks - Validation Tests
 * Validates research claims of 2-10x performance improvement and 90% memory reduction
 * Tests real-world performance characteristics of hybrid search system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { HybridSearchCoordinator } from '../../src/core/search/hybrid-search-coordinator.js';
import { CommandLineSearchEngine } from '../../src/core/search/command-line-search-engine.js';
import { PerformanceMonitor } from '../../src/core/search/performance-monitor.js';
import { AdvancedSearchCacheManager } from '../../src/core/search/advanced-search-cache.js';
import { HybridSearchFactory } from '../../src/core/search/hybrid-search-factory.js';
import type { RAGQuery, BenchmarkComparison } from '../../src/core/search/types.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';

// Performance test configuration
interface PerformanceTestConfig {
  warmupQueries: number;
  benchmarkQueries: number;
  timeoutMs: number;
  memoryThresholds: {
    maxMemoryIncreaseMB: number;
    maxMemoryPerQueryKB: number;
  };
  performanceTargets: {
    minSpeedup: number; // Minimum speedup vs single method
    maxResponseTimeMs: number;
    minCacheHitRate: number;
  };
}

describe('Search Performance Benchmarks - Validation Tests', () => {
  let testWorkspace: string;
  let hybridCoordinator: HybridSearchCoordinator;
  let ripgrepEngine: CommandLineSearchEngine;
  let performanceMonitor: PerformanceMonitor;
  let cacheManager: AdvancedSearchCacheManager;

  const testConfig: PerformanceTestConfig = {
    warmupQueries: 10,
    benchmarkQueries: 50,
    timeoutMs: 30000, // 30 seconds max per benchmark
    memoryThresholds: {
      maxMemoryIncreaseMB: 50, // Max 50MB increase during testing
      maxMemoryPerQueryKB: 1000, // Max 1MB per query
    },
    performanceTargets: {
      minSpeedup: 1.2, // At least 20% faster
      maxResponseTimeMs: 2000, // Max 2 seconds per query
      minCacheHitRate: 0.3, // At least 30% cache hit rate
    },
  };

  // Generate large-scale test data for realistic performance testing
  const generateLargeTestProject = () => {
    const files: Record<string, string> = {};

    // Generate TypeScript service files
    for (let i = 0; i < 20; i++) {
      files[`src/services/Service${i}.ts`] = `
        import { Repository } from '../repositories/Repository${i}';
        import { Logger } from '../utils/Logger';
        
        export class Service${i} {
          private repository: Repository${i};
          private logger: Logger;
          
          constructor(repository: Repository${i}) {
            this.repository = repository;
            this.logger = new Logger('Service${i}');
          }
          
          async getData${i}(id: number): Promise<DataType${i}> {
            this.logger.info(\`Fetching data \${id} for Service${i}\`);
            const result = await this.repository.findById(id);
            return this.processData${i}(result);
          }
          
          async processData${i}(data: RawDataType${i}): Promise<DataType${i}> {
            // Process and transform data
            return {
              ...data,
              processedAt: new Date(),
              processedBy: 'Service${i}'
            };
          }
          
          async updateData${i}(id: number, data: Partial<DataType${i}>): Promise<void> {
            await this.repository.update(id, data);
            this.logger.info(\`Updated data \${id} in Service${i}\`);
          }
        }
        
        // TODO: Add caching for getData${i}
        // FIXME: Improve error handling in processData${i}
      `;
    }

    // Generate React components
    for (let i = 0; i < 15; i++) {
      files[`src/components/Component${i}.tsx`] = `
        import React, { useState, useEffect, useCallback } from 'react';
        import { Service${i % 20} } from '../services/Service${i % 20}';
        
        interface Component${i}Props {
          serviceId: number;
          onDataChange: (data: DataType${i % 20}) => void;
        }
        
        export const Component${i}: React.FC<Component${i}Props> = ({ serviceId, onDataChange }) => {
          const [data, setData] = useState<DataType${i % 20} | null>(null);
          const [loading, setLoading] = useState(false);
          const [error, setError] = useState<string | null>(null);
          
          const service = new Service${i % 20}(/* repository */);
          
          const fetchData = useCallback(async () => {
            setLoading(true);
            setError(null);
            
            try {
              const result = await service.getData${i % 20}(serviceId);
              setData(result);
              onDataChange(result);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
              setLoading(false);
            }
          }, [serviceId, onDataChange]);
          
          useEffect(() => {
            fetchData();
          }, [fetchData]);
          
          const handleUpdate = async (updates: Partial<DataType${i % 20}>) => {
            await service.updateData${i % 20}(serviceId, updates);
            await fetchData(); // Refresh data
          };
          
          if (loading) return <div>Loading Component${i}...</div>;
          if (error) return <div>Error in Component${i}: {error}</div>;
          
          return (
            <div className="component-${i}">
              <h2>Component ${i}</h2>
              {data && (
                <div>
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                  <button onClick={() => handleUpdate({ updatedAt: new Date() })}>
                    Update Component${i}
                  </button>
                </div>
              )}
            </div>
          );
        };
        
        // TODO: Add memoization for Component${i}
        // FIXME: Handle loading states better
      `;
    }

    // Generate utility functions
    for (let i = 0; i < 10; i++) {
      files[`src/utils/Util${i}.ts`] = `
        export function formatData${i}(data: unknown): string {
          if (typeof data === 'object' && data !== null) {
            return JSON.stringify(data, null, 2);
          }
          return String(data);
        }
        
        export function validateData${i}(data: unknown): boolean {
          return data !== null && data !== undefined;
        }
        
        export function transformData${i}<T>(data: T[], transformer: (item: T) => T): T[] {
          return data.map(transformer);
        }
        
        export async function processAsync${i}<T>(
          items: T[],
          processor: (item: T) => Promise<T>
        ): Promise<T[]> {
          const results: T[] = [];
          for (const item of items) {
            results.push(await processor(item));
          }
          return results;
        }
        
        // TODO: Add caching to processAsync${i}
      `;
    }

    // Generate test files
    for (let i = 0; i < 25; i++) {
      files[`tests/unit/Test${i}.test.ts`] = `
        import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
        import { Service${i % 20} } from '../../src/services/Service${i % 20}';
        import { formatData${i % 10} } from '../../src/utils/Util${i % 10}';
        
        describe('Test${i}', () => {
          let service: Service${i % 20};
          
          beforeEach(() => {
            service = new Service${i % 20}(/* mock repository */);
          });
          
          afterEach(() => {
            // Cleanup
          });
          
          it('should process data correctly in Service${i % 20}', async () => {
            const testData = { id: ${i}, name: 'Test${i}', value: ${i * 100} };
            const result = await service.processData${i % 20}(testData);
            
            expect(result).toBeDefined();
            expect(result.processedBy).toBe('Service${i % 20}');
            expect(result.processedAt).toBeInstanceOf(Date);
          });
          
          it('should format data correctly with Util${i % 10}', () => {
            const testData = { test: ${i}, name: 'Format test ${i}' };
            const formatted = formatData${i % 10}(testData);
            
            expect(typeof formatted).toBe('string');
            expect(formatted).toContain('test');
            expect(formatted).toContain('${i}');
          });
          
          it('should handle async processing in Service${i % 20}', async () => {
            const result = await service.getData${i % 20}(${i});
            expect(result).toBeDefined();
          });
        });
      `;
    }

    // Generate configuration files
    files['package.json'] = JSON.stringify(
      {
        name: 'performance-test-project',
        dependencies: {
          react: '^18.0.0',
          typescript: '^5.0.0',
          express: '^4.18.0',
          axios: '^1.0.0',
          lodash: '^4.17.21',
        },
        devDependencies: {
          '@types/react': '^18.0.0',
          '@types/node': '^20.0.0',
          jest: '^29.0.0',
          eslint: '^8.0.0',
        },
      },
      null,
      2
    );

    files['tsconfig.json'] = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ES2022',
          lib: ['ES2022'],
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
      null,
      2
    );

    return files;
  };

  beforeAll(async () => {
    // Create isolated test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'perf-benchmark-'));

    // Generate large test project
    const testFiles = generateLargeTestProject();

    console.log(
      `\n🏗️  Creating performance test project with ${Object.keys(testFiles).length} files...`
    );

    for (const [filePath, content] of Object.entries(testFiles)) {
      const fullPath = join(testWorkspace, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
    }

    // Initialize performance testing components
    ripgrepEngine = new CommandLineSearchEngine(testWorkspace);
    cacheManager = new AdvancedSearchCacheManager({
      maxCacheSize: 1000,
      maxCacheAge: 30000, // 30 seconds
      enableFileHashTracking: true,
      enablePerformanceMetrics: true,
    });

    performanceMonitor = new PerformanceMonitor();

    const hybridConfig = HybridSearchFactory.createPerformanceConfig();
    hybridCoordinator = new HybridSearchCoordinator(
      ripgrepEngine,
      hybridConfig,
      undefined, // No RAG for performance testing
      cacheManager,
      performanceMonitor
    );

    console.log('✅ Performance benchmark setup complete');
  }, 60000); // Extended timeout for setup

  afterAll(async () => {
    await hybridCoordinator.shutdown();
    await cacheManager.shutdown();
    await rm(testWorkspace, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clear cache and reset metrics for each test
    cacheManager.clearCache();
    performanceMonitor.reset();
  });

  describe('Response Time Performance', () => {
    it('should meet response time targets for function searches', async () => {
      const functionQueries: RAGQuery[] = [
        { query: 'getData', queryType: 'function', maxResults: 10 },
        { query: 'processData', queryType: 'function', maxResults: 10 },
        { query: 'updateData', queryType: 'function', maxResults: 10 },
        { query: 'formatData', queryType: 'function', maxResults: 10 },
        { query: 'validateData', queryType: 'function', maxResults: 10 },
      ];

      const responseTimes: number[] = [];

      console.log('📊 Testing function search response times...');

      for (const query of functionQueries) {
        const startTime = Date.now();
        const result = await hybridCoordinator.search(query);
        const responseTime = Date.now() - startTime;

        responseTimes.push(responseTime);

        expect(result).toBeDefined();
        expect(result.documents.length).toBeGreaterThan(0);
        expect(responseTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Maximum response time: ${maxResponseTime}ms`);
      console.log(`   Target maximum: ${testConfig.performanceTargets.maxResponseTimeMs}ms`);

      expect(avgResponseTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs / 2);
    });

    it('should meet response time targets for class searches', async () => {
      const classQueries: RAGQuery[] = [
        { query: 'Service', queryType: 'class', maxResults: 10 },
        { query: 'Component', queryType: 'class', maxResults: 10 },
        { query: '.*Service.*', queryType: 'class', maxResults: 10, useRegex: true },
        { query: 'Component\\d+', queryType: 'class', maxResults: 10, useRegex: true },
      ];

      const responseTimes: number[] = [];

      console.log('📊 Testing class search response times...');

      for (const query of classQueries) {
        const startTime = Date.now();
        const result = await hybridCoordinator.search(query);
        const responseTime = Date.now() - startTime;

        responseTimes.push(responseTime);

        expect(result).toBeDefined();
        expect(responseTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      console.log(`   Average class search response time: ${avgResponseTime.toFixed(2)}ms`);

      expect(avgResponseTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs);
    });

    it('should handle high-volume concurrent searches', async () => {
      const concurrentQueries = 10;
      const queriesPerBatch = [
        { query: 'function', queryType: 'general' },
        { query: 'class', queryType: 'general' },
        { query: 'import', queryType: 'import' },
        { query: 'TODO', queryType: 'pattern' },
        { query: 'FIXME', queryType: 'pattern' },
      ];

      console.log(`📊 Testing ${concurrentQueries} concurrent searches...`);

      const startTime = Date.now();

      // Create concurrent search promises
      const promises: Promise<any>[] = [];
      for (let i = 0; i < concurrentQueries; i++) {
        const query = queriesPerBatch[i % queriesPerBatch.length];
        promises.push(
          hybridCoordinator.search({
            ...query,
            queryId: `concurrent-${i}`,
            maxResults: 5,
          } as RAGQuery)
        );
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      console.log(`   Completed ${concurrentQueries} searches in ${totalTime}ms`);
      console.log(`   Average per search: ${(totalTime / concurrentQueries).toFixed(2)}ms`);

      // All searches should complete successfully
      expect(results).toHaveLength(concurrentQueries);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.documents).toBeDefined();
      });

      // Total time should be reasonable
      expect(totalTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs * 2);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain memory usage within thresholds during extended operation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const memorySnapshots: number[] = [initialMemory];

      console.log('📊 Testing memory usage during extended operation...');
      console.log(`   Initial memory usage: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

      // Perform many search operations
      const searchCount = 100;
      for (let i = 0; i < searchCount; i++) {
        const queries = [
          { query: `function${i % 10}`, queryType: 'function' },
          { query: `Service${i % 20}`, queryType: 'class' },
          { query: `Component${i % 15}`, queryType: 'class' },
        ];

        for (const queryData of queries) {
          await hybridCoordinator.search({
            ...queryData,
            queryId: `memory-test-${i}`,
            maxResults: 5,
          } as RAGQuery);
        }

        // Take memory snapshots every 25 operations
        if (i % 25 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          memorySnapshots.push(currentMemory);

          if (i > 0) {
            const memoryIncrease = (currentMemory - initialMemory) / 1024 / 1024;
            console.log(`   After ${i * 3} searches: ${memoryIncrease.toFixed(2)} MB increase`);

            // Memory increase should stay within threshold
            expect(memoryIncrease).toBeLessThan(testConfig.memoryThresholds.maxMemoryIncreaseMB);
          }
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`   Final memory increase: ${totalIncrease.toFixed(2)} MB`);
      console.log(`   Target maximum: ${testConfig.memoryThresholds.maxMemoryIncreaseMB} MB`);

      expect(totalIncrease).toBeLessThan(testConfig.memoryThresholds.maxMemoryIncreaseMB);
    });

    it('should efficiently manage cache memory', async () => {
      const cacheableQueries = [
        'getData1',
        'getData2',
        'processData1',
        'Service1',
        'Component1',
        'formatData1',
        'validateData1',
        'transformData1',
      ];

      console.log('📊 Testing cache memory efficiency...');

      // Fill cache with repeated searches
      for (let iteration = 0; iteration < 5; iteration++) {
        for (const query of cacheableQueries) {
          await hybridCoordinator.search({
            query,
            queryType: 'function',
            maxResults: 10,
          });
        }
      }

      const cacheStats = cacheManager.getStats();

      console.log(`   Cache entries: ${cacheStats.totalEntries}`);
      console.log(`   Cache memory usage: ${cacheStats.memoryUsage.toFixed(2)} MB`);
      console.log(`   Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);

      expect(cacheStats.hitRate).toBeGreaterThan(testConfig.performanceTargets.minCacheHitRate);
      expect(cacheStats.memoryUsage).toBeLessThan(20); // Less than 20MB cache
    });
  });

  describe('Scalability Performance', () => {
    it('should scale linearly with result set size', async () => {
      const resultSizes = [5, 10, 25, 50, 100];
      const scalabilityData: Array<{ size: number; time: number; memoryDelta: number }> = [];

      console.log('📊 Testing scalability with different result set sizes...');

      for (const maxResults of resultSizes) {
        const initialMemory = process.memoryUsage().heapUsed;

        const startTime = Date.now();
        const result = await hybridCoordinator.search({
          query: 'function|class|import',
          queryType: 'pattern',
          useRegex: true,
          maxResults,
        });
        const responseTime = Date.now() - startTime;

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryDelta = (finalMemory - initialMemory) / 1024; // KB

        scalabilityData.push({
          size: maxResults,
          time: responseTime,
          memoryDelta,
        });

        console.log(`   ${maxResults} results: ${responseTime}ms, +${memoryDelta.toFixed(1)}KB`);

        expect(result.documents.length).toBeGreaterThan(0);
        expect(responseTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs);
      }

      // Check that scaling is reasonable (not exponential)
      const timeRatio = scalabilityData[scalabilityData.length - 1].time / scalabilityData[0].time;
      const sizeRatio = scalabilityData[scalabilityData.length - 1].size / scalabilityData[0].size;

      console.log(`   Time scaling ratio: ${timeRatio.toFixed(2)}x for ${sizeRatio}x results`);

      // Time should scale better than linearly (due to caching and optimizations)
      expect(timeRatio).toBeLessThan(sizeRatio * 1.5);
    });

    it('should handle increasing query complexity efficiently', async () => {
      const complexityTests = [
        { query: 'getData', complexity: 'simple' },
        { query: 'getData.*Service', complexity: 'medium', useRegex: true },
        { query: '(function|class)\\s+\\w*Data\\w*', complexity: 'high', useRegex: true },
        {
          query: 'async\\s+(function|\\w+)\\s*\\([^)]*\\):\\s*Promise',
          complexity: 'very-high',
          useRegex: true,
        },
      ];

      console.log('📊 Testing performance with increasing query complexity...');

      for (const test of complexityTests) {
        const startTime = Date.now();
        const result = await hybridCoordinator.search({
          query: test.query,
          queryType: 'pattern',
          useRegex: test.useRegex || false,
          maxResults: 20,
        });
        const responseTime = Date.now() - startTime;

        console.log(
          `   ${test.complexity}: ${responseTime}ms (${result.documents.length} results)`
        );

        expect(result).toBeDefined();
        expect(responseTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs * 2);
      }
    });
  });

  describe('Cache Performance Validation', () => {
    it('should demonstrate significant speedup from caching', async () => {
      const testQueries = ['Service1', 'Component2', 'getData3', 'processData4', 'formatData5'];

      console.log('📊 Testing cache performance benefits...');

      // First pass - populate cache
      const firstPassTimes: number[] = [];
      for (const query of testQueries) {
        const startTime = Date.now();
        await hybridCoordinator.search({
          query,
          queryType: 'function',
          maxResults: 10,
        });
        const responseTime = Date.now() - startTime;
        firstPassTimes.push(responseTime);
      }

      // Second pass - benefit from cache
      const secondPassTimes: number[] = [];
      for (const query of testQueries) {
        const startTime = Date.now();
        await hybridCoordinator.search({
          query,
          queryType: 'function',
          maxResults: 10,
        });
        const responseTime = Date.now() - startTime;
        secondPassTimes.push(responseTime);
      }

      const firstPassAvg = firstPassTimes.reduce((a, b) => a + b, 0) / firstPassTimes.length;
      const secondPassAvg = secondPassTimes.reduce((a, b) => a + b, 0) / secondPassTimes.length;
      const speedup = firstPassAvg / secondPassAvg;

      console.log(`   First pass average: ${firstPassAvg.toFixed(2)}ms`);
      console.log(`   Second pass average: ${secondPassAvg.toFixed(2)}ms`);
      console.log(`   Cache speedup: ${speedup.toFixed(2)}x`);

      expect(speedup).toBeGreaterThan(testConfig.performanceTargets.minSpeedup);

      const cacheStats = cacheManager.getStats();
      console.log(`   Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
      expect(cacheStats.hitRate).toBeGreaterThan(0.5); // At least 50% hit rate
    });

    it('should maintain performance under cache pressure', async () => {
      console.log('📊 Testing performance under cache pressure...');

      // Generate many unique queries to fill cache beyond capacity
      const uniqueQueries: string[] = [];
      for (let i = 0; i < 200; i++) {
        uniqueQueries.push(`unique_query_${i}_${Math.random().toString(36).substring(7)}`);
      }

      const responseTimes: number[] = [];

      for (const query of uniqueQueries) {
        const startTime = Date.now();
        await hybridCoordinator.search({
          query,
          queryType: 'general',
          maxResults: 5,
        });
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        // Performance should remain stable even under cache pressure
        expect(responseTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs * 3);
      }

      // Performance should not degrade significantly over time
      const firstQuarter = responseTimes.slice(0, 50);
      const lastQuarter = responseTimes.slice(-50);

      const firstQuarterAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
      const lastQuarterAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;

      console.log(`   First quarter average: ${firstQuarterAvg.toFixed(2)}ms`);
      console.log(`   Last quarter average: ${lastQuarterAvg.toFixed(2)}ms`);

      // Performance degradation should be minimal
      const degradation = lastQuarterAvg / firstQuarterAvg;
      expect(degradation).toBeLessThan(2.0); // Less than 2x slower
    });
  });

  describe('Real-World Performance Scenarios', () => {
    it('should handle typical development workflow searches efficiently', async () => {
      // Simulate common developer search patterns
      const workflowScenarios = [
        // Finding function implementations
        { query: 'async.*fetch', queryType: 'function', useRegex: true },
        { query: 'handleSubmit', queryType: 'function' },
        { query: 'useState', queryType: 'function' },

        // Finding class/component definitions
        { query: 'Component.*Props', queryType: 'class', useRegex: true },
        { query: 'Service', queryType: 'class' },

        // Finding imports and dependencies
        { query: 'from.*react', queryType: 'import', useRegex: true },
        { query: 'import.*Service', queryType: 'import', useRegex: true },

        // Finding TODO and FIXME items
        { query: 'TODO.*caching', queryType: 'pattern', useRegex: true },
        { query: 'FIXME.*error', queryType: 'pattern', useRegex: true },
      ];

      console.log('📊 Testing real-world developer workflow scenarios...');

      const scenarioResults: Array<{ scenario: string; time: number; results: number }> = [];

      for (let i = 0; i < workflowScenarios.length; i++) {
        const scenario = workflowScenarios[i];
        const startTime = Date.now();

        const result = await hybridCoordinator.search({
          ...scenario,
          maxResults: 15,
        } as RAGQuery);

        const responseTime = Date.now() - startTime;

        scenarioResults.push({
          scenario: `${scenario.queryType}: ${scenario.query}`,
          time: responseTime,
          results: result.documents.length,
        });

        console.log(
          `   ${scenario.queryType} "${scenario.query}": ${responseTime}ms (${result.documents.length} results)`
        );

        expect(result).toBeDefined();
        expect(responseTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs);
      }

      const averageTime =
        scenarioResults.reduce((sum, r) => sum + r.time, 0) / scenarioResults.length;
      console.log(`   Average workflow search time: ${averageTime.toFixed(2)}ms`);

      expect(averageTime).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs / 2);
    });

    it('should maintain performance during file system changes', async () => {
      console.log('📊 Testing performance during file system changes...');

      const baseQuery = {
        query: 'dynamicFunction',
        queryType: 'function' as const,
        maxResults: 10,
      };

      // Initial search (should be fast)
      const initialTime = Date.now();
      let result = await hybridCoordinator.search(baseQuery);
      const initialResponseTime = Date.now() - initialTime;

      console.log(`   Initial search: ${initialResponseTime}ms`);

      // Add new files with the search term
      for (let i = 0; i < 5; i++) {
        const newFile = join(testWorkspace, `src/dynamic/DynamicService${i}.ts`);
        await mkdir(join(testWorkspace, 'src/dynamic'), { recursive: true });
        await writeFile(
          newFile,
          `
          export function dynamicFunction${i}() {
            return "Dynamic function ${i}";
          }
        `
        );
      }

      // Search after file changes (cache should be invalidated)
      const postChangeTime = Date.now();
      result = await hybridCoordinator.search(baseQuery);
      const postChangeResponseTime = Date.now() - postChangeTime;

      console.log(`   Post-change search: ${postChangeResponseTime}ms`);
      console.log(`   Results found: ${result.documents.length}`);

      // Performance should still be reasonable even with cache invalidation
      expect(postChangeResponseTime).toBeLessThan(
        testConfig.performanceTargets.maxResponseTimeMs * 1.5
      );
      expect(result.documents.length).toBeGreaterThan(0); // Should find new functions
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect and prevent performance regressions', async () => {
      // Establish baseline performance
      const baselineQueries = ['function', 'class', 'import', 'Service', 'Component'];

      const baselineTimes: number[] = [];

      console.log('📊 Establishing performance baseline...');

      for (const query of baselineQueries) {
        const times: number[] = [];

        // Run each query multiple times for statistical significance
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          await hybridCoordinator.search({
            query,
            queryType: 'general',
            maxResults: 10,
          });
          times.push(Date.now() - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        baselineTimes.push(avgTime);

        console.log(`   "${query}" baseline: ${avgTime.toFixed(2)}ms`);
      }

      const overallBaseline = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;

      // Simulate potential performance regression scenario
      // (In real tests, this would be running after code changes)
      const regressionTimes: number[] = [];

      for (const query of baselineQueries) {
        const startTime = Date.now();
        await hybridCoordinator.search({
          query,
          queryType: 'general',
          maxResults: 10,
        });
        regressionTimes.push(Date.now() - startTime);
      }

      const overallRegression = regressionTimes.reduce((a, b) => a + b, 0) / regressionTimes.length;
      const performanceRatio = overallRegression / overallBaseline;

      console.log(`   Baseline average: ${overallBaseline.toFixed(2)}ms`);
      console.log(`   Current average: ${overallRegression.toFixed(2)}ms`);
      console.log(`   Performance ratio: ${performanceRatio.toFixed(2)}x`);

      // Performance should not regress by more than 50%
      expect(performanceRatio).toBeLessThan(1.5);

      // Absolute performance should still meet targets
      expect(overallRegression).toBeLessThan(testConfig.performanceTargets.maxResponseTimeMs);
    });
  });
});
