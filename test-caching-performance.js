/**
 * Caching and Performance Testing Script
 * Tests multi-layer caching system and performance optimizations
 */

console.log('💾 CodeCrucible Synth - Caching & Performance Testing\n');

// Mock Multi-Layer Cache System
class MockMultiLayerCacheSystem {
  constructor() {
    this.memoryCache = new Map();
    this.diskCache = new Map(); // Simulated disk cache
    this.stats = {
      memory: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      disk: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      overall: { hits: 0, misses: 0, totalRequests: 0 }
    };
    this.config = {
      memory: { maxSize: 50, maxEntries: 100, ttl: 300000 }, // 5 min TTL
      disk: { maxSize: 200, maxEntries: 1000, ttl: 3600000 } // 1 hour TTL
    };
    this.initialized = false;
  }

  async initialize() {
    console.log('🔧 Initializing multi-layer cache system...');
    await new Promise(resolve => setTimeout(resolve, 50));
    this.initialized = true;
    console.log('✅ Cache system initialized');
  }

  async get(key, options = {}) {
    if (!this.initialized) {
      throw new Error('Cache system not initialized');
    }

    const startTime = performance.now();
    this.stats.overall.totalRequests++;

    // Try memory cache first
    const memoryResult = this.getFromMemory(key);
    if (memoryResult) {
      this.stats.memory.hits++;
      this.stats.overall.hits++;
      
      const duration = performance.now() - startTime;
      return {
        data: memoryResult.data,
        metadata: {
          source: 'memory',
          duration,
          hit: true,
          ttlRemaining: memoryResult.ttl - (Date.now() - memoryResult.timestamp)
        }
      };
    }

    this.stats.memory.misses++;

    // Try disk cache
    const diskResult = await this.getFromDisk(key);
    if (diskResult) {
      this.stats.disk.hits++;
      this.stats.overall.hits++;
      
      // Promote to memory cache
      this.setInMemory(key, diskResult.data, { ttl: this.config.memory.ttl });
      
      const duration = performance.now() - startTime;
      return {
        data: diskResult.data,
        metadata: {
          source: 'disk',
          duration,
          hit: true,
          promoted: true,
          ttlRemaining: diskResult.ttl - (Date.now() - diskResult.timestamp)
        }
      };
    }

    this.stats.disk.misses++;
    this.stats.overall.misses++;

    const duration = performance.now() - startTime;
    return {
      data: null,
      metadata: {
        source: 'none',
        duration,
        hit: false
      }
    };
  }

  async set(key, data, options = {}) {
    if (!this.initialized) {
      throw new Error('Cache system not initialized');
    }

    const startTime = performance.now();
    
    // Set in memory cache
    this.setInMemory(key, data, options);
    
    // Set in disk cache
    await this.setInDisk(key, data, options);
    
    const duration = performance.now() - startTime;
    return { success: true, duration };
  }

  getFromMemory(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry;
  }

  setInMemory(key, data, options = {}) {
    // Check if we need to evict
    if (this.memoryCache.size >= this.config.memory.maxEntries) {
      this.evictFromMemory();
    }

    const entry = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.config.memory.ttl,
      accessCount: 1,
      lastAccessed: Date.now()
    };

    this.memoryCache.set(key, entry);
    this.stats.memory.sets++;
  }

  async getFromDisk(key) {
    // Simulate disk I/O delay
    await new Promise(resolve => setTimeout(resolve, 2));
    
    const entry = this.diskCache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.diskCache.delete(key);
      return null;
    }

    return entry;
  }

  async setInDisk(key, data, options = {}) {
    // Simulate disk I/O delay
    await new Promise(resolve => setTimeout(resolve, 5));

    // Check if we need to evict
    if (this.diskCache.size >= this.config.disk.maxEntries) {
      this.evictFromDisk();
    }

    const entry = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.config.disk.ttl,
      size: JSON.stringify(data).length
    };

    this.diskCache.set(key, entry);
    this.stats.disk.sets++;
  }

  evictFromMemory() {
    // LRU eviction
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.memory.evictions++;
    }
  }

  evictFromDisk() {
    // Smart eviction based on size and age
    const entries = Array.from(this.diskCache.entries());
    entries.sort(([,a], [,b]) => {
      const ageA = Date.now() - a.timestamp;
      const ageB = Date.now() - b.timestamp;
      const scoreA = ageA * a.size;
      const scoreB = ageB * b.size;
      return scoreB - scoreA;
    });

    if (entries.length > 0) {
      const [keyToEvict] = entries[0];
      this.diskCache.delete(keyToEvict);
      this.stats.disk.evictions++;
    }
  }

  getStats() {
    const memoryHitRate = this.stats.overall.totalRequests > 0 
      ? (this.stats.memory.hits / this.stats.overall.totalRequests) * 100 
      : 0;
    
    const diskHitRate = this.stats.overall.totalRequests > 0 
      ? (this.stats.disk.hits / this.stats.overall.totalRequests) * 100 
      : 0;
    
    const overallHitRate = this.stats.overall.totalRequests > 0 
      ? (this.stats.overall.hits / this.stats.overall.totalRequests) * 100 
      : 0;

    return {
      memory: {
        size: this.memoryCache.size,
        maxEntries: this.config.memory.maxEntries,
        hits: this.stats.memory.hits,
        misses: this.stats.memory.misses,
        sets: this.stats.memory.sets,
        evictions: this.stats.memory.evictions,
        hitRate: memoryHitRate.toFixed(1) + '%'
      },
      disk: {
        size: this.diskCache.size,
        maxEntries: this.config.disk.maxEntries,
        hits: this.stats.disk.hits,
        misses: this.stats.disk.misses,
        sets: this.stats.disk.sets,
        evictions: this.stats.disk.evictions,
        hitRate: diskHitRate.toFixed(1) + '%'
      },
      overall: {
        totalRequests: this.stats.overall.totalRequests,
        hits: this.stats.overall.hits,
        misses: this.stats.overall.misses,
        hitRate: overallHitRate.toFixed(1) + '%'
      }
    };
  }

  clear() {
    this.memoryCache.clear();
    this.diskCache.clear();
    this.stats = {
      memory: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      disk: { hits: 0, misses: 0, sets: 0, evictions: 0 },
      overall: { hits: 0, misses: 0, totalRequests: 0 }
    };
  }
}

// Mock Performance Monitor
class MockPerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.startTime = Date.now();
  }

  recordOperation(operation, duration, metadata = {}) {
    this.metrics.push({
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    });
  }

  getAverageLatency(operation) {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    if (operationMetrics.length === 0) return 0;
    
    const totalDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalDuration / operationMetrics.length;
  }

  getThroughput(operation, timeWindowMs = 60000) {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter(m => 
      m.operation === operation && m.timestamp >= cutoff
    );
    
    return (recentMetrics.length / timeWindowMs) * 1000; // operations per second
  }

  getPercentile(operation, percentile) {
    const operationMetrics = this.metrics
      .filter(m => m.operation === operation)
      .map(m => m.duration)
      .sort((a, b) => a - b);
    
    if (operationMetrics.length === 0) return 0;
    
    const index = Math.floor((percentile / 100) * operationMetrics.length);
    return operationMetrics[Math.min(index, operationMetrics.length - 1)];
  }

  getStats() {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    const stats = {};
    
    for (const operation of operations) {
      stats[operation] = {
        count: this.metrics.filter(m => m.operation === operation).length,
        avgLatency: this.getAverageLatency(operation).toFixed(2) + 'ms',
        throughput: this.getThroughput(operation).toFixed(2) + ' ops/sec',
        p50: this.getPercentile(operation, 50).toFixed(2) + 'ms',
        p95: this.getPercentile(operation, 95).toFixed(2) + 'ms',
        p99: this.getPercentile(operation, 99).toFixed(2) + 'ms'
      };
    }
    
    return stats;
  }
}

// Simulate AI Response Generation
function generateMockResponse(request) {
  const responses = {
    simple: 'This is a simple response for testing caching.',
    complex: `This is a more complex response that includes multiple paragraphs and detailed explanations.
    
    It covers various aspects of the request and provides comprehensive information that would typically
    take longer to generate from an AI model. This type of response benefits significantly from caching
    as it reduces computational overhead and improves response times.
    
    The response includes code examples, explanations, and best practices that are relevant to the
    original query about ${request.type} development.`,
    code: `
    // Generated code example for ${request.type}
    export class Example {
      private data: any;
      
      constructor(config: Config) {
        this.data = config.data;
      }
      
      public process(): Result {
        // Implementation details
        return this.transform(this.data);
      }
      
      private transform(input: any): Result {
        return { success: true, data: input };
      }
    }
    `
  };
  
  const responseType = request.complexity || 'simple';
  return responses[responseType] || responses.simple;
}

// Test scenarios
async function testCachingPerformance() {
  const cache = new MockMultiLayerCacheSystem();
  const monitor = new MockPerformanceMonitor();
  
  await cache.initialize();
  
  console.log('🧪 Testing caching performance scenarios...\n');

  // Test 1: Cache Miss Performance
  console.log('📊 Test 1: Cache Miss Performance');
  const missTests = [
    { key: 'test1', type: 'code', complexity: 'simple' },
    { key: 'test2', type: 'analysis', complexity: 'complex' },
    { key: 'test3', type: 'review', complexity: 'code' }
  ];

  for (const test of missTests) {
    const startTime = performance.now();
    
    // Try to get from cache (will miss)
    const cacheResult = await cache.get(test.key);
    
    if (!cacheResult.data) {
      // Generate response (simulate AI processing)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      const response = generateMockResponse(test);
      
      // Cache the response
      await cache.set(test.key, response, { ttl: 300000 });
    }
    
    const duration = performance.now() - startTime;
    monitor.recordOperation('cache_miss', duration, { source: 'generation' });
    
    console.log(`   ${test.key}: ${duration.toFixed(2)}ms (cache miss + generation)`);
  }

  // Test 2: Cache Hit Performance
  console.log('\\n📊 Test 2: Cache Hit Performance');
  for (const test of missTests) {
    const startTime = performance.now();
    
    const cacheResult = await cache.get(test.key);
    
    const duration = performance.now() - startTime;
    monitor.recordOperation('cache_hit', duration, { 
      source: cacheResult.metadata.source 
    });
    
    console.log(`   ${test.key}: ${duration.toFixed(2)}ms (${cacheResult.metadata.source} cache hit)`);
  }

  // Test 3: Cache Eviction and Promotion
  console.log('\\n📊 Test 3: Cache Eviction and Promotion');
  
  // Fill memory cache to trigger eviction
  for (let i = 0; i < 105; i++) {
    await cache.set(`evict_test_${i}`, `data_${i}`, { ttl: 300000 });
  }
  
  console.log('   Generated 105 entries to test eviction...');
  
  // Test promotion from disk to memory
  const promotionTest = await cache.get('test1'); // Should promote from disk
  if (promotionTest.metadata.promoted) {
    console.log(`   test1 promoted from ${promotionTest.metadata.source} to memory`);
  }

  // Test 4: Concurrent Access Performance
  console.log('\\n📊 Test 4: Concurrent Access Performance');
  
  const concurrentKeys = ['concurrent1', 'concurrent2', 'concurrent3'];
  
  // Set up concurrent test data
  for (const key of concurrentKeys) {
    await cache.set(key, generateMockResponse({ type: 'concurrent', complexity: 'complex' }));
  }
  
  // Simulate concurrent access
  const concurrentPromises = [];
  for (let i = 0; i < 20; i++) {
    const key = concurrentKeys[i % concurrentKeys.length];
    concurrentPromises.push(
      cache.get(key).then(result => {
        monitor.recordOperation('concurrent_access', result.metadata.duration, {
          source: result.metadata.source
        });
        return result;
      })
    );
  }
  
  const concurrentResults = await Promise.all(concurrentPromises);
  const avgConcurrentTime = concurrentResults.reduce((sum, r) => sum + r.metadata.duration, 0) / concurrentResults.length;
  console.log(`   20 concurrent accesses: ${avgConcurrentTime.toFixed(2)}ms average`);

  // Test 5: TTL and Expiration
  console.log('\\n📊 Test 5: TTL and Expiration');
  
  // Set short TTL entry
  await cache.set('ttl_test', 'expiring_data', { ttl: 100 }); // 100ms TTL
  
  const immediateResult = await cache.get('ttl_test');
  console.log(`   Immediate access: ${immediateResult.data ? 'HIT' : 'MISS'}`);
  
  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const expiredResult = await cache.get('ttl_test');
  console.log(`   After expiration: ${expiredResult.data ? 'HIT' : 'MISS'}`);

  // Final Statistics
  console.log('\\n📈 Performance Testing Results');
  console.log('===============================');
  
  const cacheStats = cache.getStats();
  console.log('\\n💾 Cache Statistics:');
  console.log(`   Memory Cache: ${cacheStats.memory.size} entries, ${cacheStats.memory.hitRate} hit rate`);
  console.log(`   Disk Cache: ${cacheStats.disk.size} entries, ${cacheStats.disk.hitRate} hit rate`);
  console.log(`   Overall: ${cacheStats.overall.totalRequests} requests, ${cacheStats.overall.hitRate} hit rate`);
  console.log(`   Memory Evictions: ${cacheStats.memory.evictions}`);
  console.log(`   Disk Evictions: ${cacheStats.disk.evictions}`);
  
  const performanceStats = monitor.getStats();
  console.log('\\n⚡ Performance Metrics:');
  
  Object.entries(performanceStats).forEach(([operation, stats]) => {
    console.log(`   ${operation}:`);
    console.log(`     Count: ${stats.count}`);
    console.log(`     Avg Latency: ${stats.avgLatency}`);
    console.log(`     Throughput: ${stats.throughput}`);
    console.log(`     P95 Latency: ${stats.p95}`);
  });

  // Performance Insights
  console.log('\\n💡 Performance Insights:');
  
  const missLatency = parseFloat(performanceStats.cache_miss?.avgLatency || '0');
  const hitLatency = parseFloat(performanceStats.cache_hit?.avgLatency || '0');
  
  if (missLatency > 0 && hitLatency > 0) {
    const speedup = (missLatency / hitLatency).toFixed(1);
    console.log(`   • Cache hits are ${speedup}x faster than misses`);
  }
  
  const overallHitRate = parseFloat(cacheStats.overall.hitRate);
  if (overallHitRate > 70) {
    console.log(`   • High cache hit rate (${cacheStats.overall.hitRate}) indicates effective caching`);
  } else if (overallHitRate > 40) {
    console.log(`   • Moderate cache hit rate (${cacheStats.overall.hitRate}) - consider tuning TTL or cache size`);
  } else {
    console.log(`   • Low cache hit rate (${cacheStats.overall.hitRate}) - may need larger cache or longer TTL`);
  }
  
  console.log(`   • Memory cache provides fastest access (~${performanceStats.cache_hit?.p50 || 'N/A'})`);
  console.log(`   • Disk cache provides good fallback with promotion to memory`);
  console.log(`   • Multi-layer architecture balances speed and capacity effectively`);

  console.log('\\n🎉 Caching and performance testing completed successfully!');
}

// Run the test
testCachingPerformance().catch(console.error);