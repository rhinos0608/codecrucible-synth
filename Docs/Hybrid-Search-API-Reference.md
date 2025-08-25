# Hybrid Search System - API Reference

## Table of Contents
- [Core Classes](#core-classes)
- [Type Definitions](#type-definitions)
- [Configuration Interfaces](#configuration-interfaces)
- [Utility Functions](#utility-functions)
- [Error Types](#error-types)
- [Examples](#examples)

## Core Classes

### HybridSearchCoordinator

The main orchestrator that manages intelligent routing between search methods.

```typescript
class HybridSearchCoordinator extends EventEmitter {
  constructor(
    commandLineEngine: CommandLineSearchEngine,
    config: HybridSearchConfig,
    ragSystem?: VectorRAGSystem,
    cacheManager?: AdvancedSearchCacheManager,
    performanceMonitor?: PerformanceMonitor
  );

  // Primary search interface
  async search(query: RAGQuery): Promise<RAGResult>;

  // Metrics and monitoring
  getMetrics(): HybridSearchMetrics;
  getCacheStats(): CacheStats;

  // Cache management
  async clearCache(): Promise<void>;
  async preloadCommonPatterns(patterns: PreloadPattern[]): Promise<void>;

  // System management
  async shutdown(): Promise<void>;
  
  // Events: 'search-start', 'search-complete', 'cache-hit', 'cache-miss', 'routing-decision'
}
```

#### Methods

##### `search(query: RAGQuery): Promise<RAGResult>`
Executes intelligent hybrid search with automatic method routing.

**Parameters:**
- `query: RAGQuery` - Search query configuration

**Returns:** `Promise<RAGResult>` - Search results with metadata

**Example:**
```typescript
const result = await coordinator.search({
  query: 'UserService',
  queryType: 'class',
  maxResults: 10,
  context: { language: 'typescript' }
});
```

##### `getMetrics(): HybridSearchMetrics`
Returns comprehensive search performance metrics.

**Returns:** `HybridSearchMetrics` - Performance and usage statistics

**Example:**
```typescript
const metrics = coordinator.getMetrics();
console.log(`Average response time: ${metrics.averageResponseTime}ms`);
console.log(`Total queries processed: ${metrics.totalQueries}`);
```

---

### CommandLineSearchEngine

High-performance command-line search engine with cross-platform support.

```typescript
class CommandLineSearchEngine {
  constructor(workingDirectory: string);

  // Primary search interface
  async searchInFiles(options: SearchOptions): Promise<SearchResult[]>;

  // Tool detection and availability
  async detectAvailableTools(): Promise<SearchTool[]>;
  isToolAvailable(tool: SearchTool): Promise<boolean>;

  // Performance and caching
  getPerformanceStats(): EnginePerformanceStats;
  clearCache(): void;

  // Configuration
  setWorkingDirectory(directory: string): void;
  getWorkingDirectory(): string;
}
```

#### Methods

##### `searchInFiles(options: SearchOptions): Promise<SearchResult[]>`
Executes search with specified options using best available tool.

**Parameters:**
- `options: SearchOptions` - Search configuration

**Returns:** `Promise<SearchResult[]>` - Array of search results

**Example:**
```typescript
const results = await engine.searchInFiles({
  query: 'async function',
  regex: true,
  fileTypes: ['ts', 'js'],
  maxResults: 50,
  contextLines: { context: 3 }
});
```

##### `detectAvailableTools(): Promise<SearchTool[]>`
Detects and returns available search tools on the current platform.

**Returns:** `Promise<SearchTool[]>` - Available search tools

**Example:**
```typescript
const tools = await engine.detectAvailableTools();
console.log('Available tools:', tools); // ['ripgrep', 'powershell', 'grep']
```

---

### AdvancedSearchCacheManager

Intelligent caching system with file-hash based invalidation.

```typescript
class AdvancedSearchCacheManager {
  constructor(config?: Partial<CacheConfig>);

  // Cache operations
  async getCachedResults<T>(
    queryKey: string,
    options?: CacheRetrievalOptions
  ): Promise<T | null>;

  async setCachedResults<T>(
    queryKey: string,
    results: T,
    metadata: CacheMetadata
  ): Promise<void>;

  // Cache management
  async clearCache(): Promise<void>;
  async invalidateByPattern(pattern: InvalidationPattern): Promise<number>;
  async preloadCommonPatterns(patterns: PreloadPattern[]): Promise<void>;

  // Statistics and monitoring
  getStats(): CacheStats;
  async exportCache(filePath: string): Promise<void>;

  // System management
  async shutdown(): Promise<void>;
}
```

#### Methods

##### `getCachedResults<T>(queryKey: string, options?: CacheRetrievalOptions): Promise<T | null>`
Retrieves cached results with optional validation.

**Parameters:**
- `queryKey: string` - Unique cache key
- `options?: CacheRetrievalOptions` - Retrieval options

**Returns:** `Promise<T | null>` - Cached results or null if not found/expired

**Example:**
```typescript
const cached = await cacheManager.getCachedResults('search:UserService', {
  checkFileModifications: true,
  maxAge: 300000 // 5 minutes
});
```

##### `setCachedResults<T>(queryKey: string, results: T, metadata: CacheMetadata): Promise<void>`
Stores results in cache with metadata for intelligent invalidation.

**Parameters:**
- `queryKey: string` - Unique cache key
- `results: T` - Results to cache
- `metadata: CacheMetadata` - Cache metadata

**Example:**
```typescript
await cacheManager.setCachedResults('search:UserService', results, {
  searchMethod: 'ripgrep',
  queryType: 'class',
  confidence: 0.95,
  duration: 150,
  filePaths: ['/src/services/UserService.ts']
});
```

---

### CLISearchIntegration

CLI integration layer providing slash commands and command-line interface.

```typescript
class CLISearchIntegration {
  constructor(context: CLIContext, workingDirectory?: string);

  // Command registration
  registerSlashCommands(): Map<string, (args: string) => Promise<string>>;

  // Status and monitoring
  getSearchStatus(): string;

  // System management
  async shutdown(): Promise<void>;
}
```

#### Methods

##### `registerSlashCommands(): Map<string, (args: string) => Promise<string>>`
Registers and returns available slash commands.

**Returns:** `Map<string, Function>` - Map of command names to handler functions

**Example:**
```typescript
const commands = integration.registerSlashCommands();
const searchCommand = commands.get('search');
const result = await searchCommand('UserService --type class');
```

---

### PerformanceMonitor

Performance monitoring and benchmarking system.

```typescript
class PerformanceMonitor extends EventEmitter {
  constructor();

  // Monitoring
  startMonitoring(query: RAGQuery): string; // Returns monitoring ID
  endMonitoring(monitoringId: string): SearchPerformanceMetrics;

  // Benchmarking
  async runBenchmark(queries: BenchmarkQuery[]): Promise<BenchmarkComparison[]>;
  async compareMethods(
    query: RAGQuery,
    methods: SearchMethod[]
  ): Promise<MethodComparison>;

  // Reporting
  generateBenchmarkReport(results: BenchmarkComparison[]): void;
  getSystemMetrics(): SystemPerformanceMetrics;

  // Management
  reset(): void;
  
  // Events: 'benchmark-start', 'benchmark-complete', 'performance-warning'
}
```

---

## Type Definitions

### RAGQuery
```typescript
interface RAGQuery {
  query: string;
  queryType: 'function' | 'class' | 'import' | 'pattern' | 'general' | 'semantic';
  maxResults?: number;
  useRegex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  context?: {
    language?: string;
    fileTypes?: string[];
    excludePatterns?: string[];
  };
  queryId?: string;
  timeout?: number;
}
```

### RAGResult
```typescript
interface RAGResult {
  documents: SearchResultDocument[];
  query: string;
  totalDocuments: number;
  processingTimeMs: number;
  metadata?: {
    searchMethod: 'ripgrep' | 'rag' | 'hybrid' | 'fallback';
    confidence: number;
    reasoning?: string;
    cacheHit?: boolean;
    estimatedTime?: number;
    estimatedMemory?: number;
  };
  error?: string;
}
```

### SearchResult
```typescript
interface SearchResult {
  filePath?: string;
  line: number;
  column: number;
  content: string;
  match: string;
  similarity?: number;
  context?: {
    before?: string[];
    after?: string[];
  };
}
```

### SearchResultDocument
```typescript
interface SearchResultDocument {
  content: string;
  filePath?: string;
  line?: number;
  column?: number;
  similarity?: number;
  metadata?: {
    fileSize?: number;
    lastModified?: Date;
    language?: string;
  };
}
```

### SearchOptions
```typescript
interface SearchOptions {
  query: string;
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  fileTypes?: string[];
  excludePatterns?: string[];
  maxResults?: number;
  contextLines?: {
    before?: number;
    after?: number;
    context?: number;
  };
  timeout?: number;
}
```

### HybridSearchMetrics
```typescript
interface HybridSearchMetrics {
  totalQueries: number;
  averageResponseTime: number;
  routingDecisions: Map<string, number>;
  searchMethodUsage: {
    ripgrep: number;
    rag: number;
    hybrid: number;
    fallback: number;
  };
  cacheHitRate: number;
  performanceProfile: {
    fastQueries: number;  // <200ms
    mediumQueries: number; // 200-1000ms
    slowQueries: number;   // >1000ms
  };
}
```

### CacheStats
```typescript
interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageHitTime: number;
  averageMissTime: number;
  memoryUsage: number; // MB
  oldestEntry: Date;
  newestEntry: Date;
  invalidationRate: number;
  compressionRatio: number;
}
```

## Configuration Interfaces

### HybridSearchConfig
```typescript
interface HybridSearchConfig {
  routing: {
    exactPatternThreshold: number;      // 0.0 - 1.0
    semanticSimilarityThreshold: number; // 0.0 - 1.0
    memoryPressureThreshold: number;     // 0.0 - 1.0
    performanceTimeoutMs: number;
    enableLearning?: boolean;
  };
  caching: {
    maxCacheSize: number;
    maxCacheAge: number; // milliseconds
    enableFileHashTracking: boolean;
    enablePerformanceMetrics: boolean;
    compressionThreshold?: number; // bytes
  };
  performance: {
    enableMonitoring: boolean;
    benchmarkInterval?: number; // milliseconds
    adaptiveRouting?: boolean;
  };
  crossPlatform: {
    preferRipgrep?: boolean;
    enableFallback?: boolean;
    toolTimeout?: number; // milliseconds
  };
}
```

### CacheConfig
```typescript
interface CacheConfig {
  maxCacheSize: number;
  maxCacheAge: number; // milliseconds
  enableFileHashTracking: boolean;
  enablePerformanceMetrics: boolean;
  compactionInterval: number; // milliseconds
  compressionThreshold: number; // bytes
}
```

### CacheMetadata
```typescript
interface CacheMetadata {
  searchMethod: 'ripgrep' | 'rag' | 'hybrid' | 'find';
  queryType: string;
  confidence: number;
  duration: number;
  filePaths?: string[];
}
```

## Utility Functions

### CodePatternGenerator
```typescript
class CodePatternGenerator {
  static generateFunctionPattern(name: string, language?: string): string;
  static generateClassPattern(name: string, language?: string): string;
  static generateInterfacePattern(name: string): string;
  static generateImportPattern(module: string): string;
  static generateTestPattern(testName?: string, language?: string): string;
  static generateCommentPattern(commentType: 'TODO' | 'FIXME' | 'HACK'): string;
}
```

### HybridSearchFactory
```typescript
class HybridSearchFactory {
  static createDefaultConfig(): HybridSearchConfig;
  static createPerformanceConfig(): HybridSearchConfig;
  static createBalancedConfig(): HybridSearchConfig;
  static createMemoryOptimizedConfig(): HybridSearchConfig;
  
  static validateConfig(config: HybridSearchConfig): ConfigValidationResult;
}
```

### CrossPlatformSearch
```typescript
class CrossPlatformSearch {
  static async detectPlatform(): Promise<Platform>;
  static async getAvailableTools(platform?: Platform): Promise<SearchTool[]>;
  static generateCommand(
    tool: SearchTool, 
    query: string, 
    options: SearchOptions
  ): CommandConfig;
}
```

## Error Types

### SearchError
```typescript
class SearchError extends Error {
  constructor(
    message: string,
    public code: SearchErrorCode,
    public details?: unknown
  );
}

enum SearchErrorCode {
  TOOL_NOT_AVAILABLE = 'TOOL_NOT_AVAILABLE',
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',
  INVALID_REGEX = 'INVALID_REGEX',
  CACHE_ERROR = 'CACHE_ERROR',
  FILE_ACCESS_ERROR = 'FILE_ACCESS_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}
```

### CacheError
```typescript
class CacheError extends Error {
  constructor(
    message: string,
    public operation: CacheOperation,
    public details?: unknown
  );
}

enum CacheOperation {
  GET = 'GET',
  SET = 'SET',
  INVALIDATE = 'INVALIDATE',
  CLEAR = 'CLEAR'
}
```

## Examples

### Basic Search Implementation

```typescript
import { 
  HybridSearchCoordinator,
  CommandLineSearchEngine,
  AdvancedSearchCacheManager,
  HybridSearchFactory
} from './search';

// Initialize components
const engine = new CommandLineSearchEngine('/path/to/project');
const cache = new AdvancedSearchCacheManager();
const config = HybridSearchFactory.createBalancedConfig();

const coordinator = new HybridSearchCoordinator(
  engine,
  config,
  undefined, // No RAG system
  cache
);

// Execute search
const result = await coordinator.search({
  query: 'async function calculateTotal',
  queryType: 'function',
  maxResults: 10,
  context: { language: 'typescript' }
});

console.log(`Found ${result.documents.length} results`);
console.log(`Search method: ${result.metadata?.searchMethod}`);
console.log(`Confidence: ${result.metadata?.confidence}`);
```

### Advanced Cache Usage

```typescript
import { AdvancedSearchCacheManager, CachedSearchExecutor } from './search';

const cache = new AdvancedSearchCacheManager({
  maxCacheSize: 1000,
  maxCacheAge: 600000, // 10 minutes
  enableFileHashTracking: true
});

const executor = new CachedSearchExecutor(cache);

// Execute with automatic caching
const result = await executor.executeWithCache(
  'function-search:calculateTotal',
  async () => {
    // Your search logic here
    return await performExpensiveSearch();
  },
  {
    searchMethod: 'ripgrep',
    queryType: 'function',
    filePaths: ['/src/utils.ts']
  }
);

// Check cache statistics
const stats = cache.getStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

### CLI Integration Example

```typescript
import { CLISearchIntegration } from './search';

const context = {
  workingDirectory: '/path/to/project',
  outputFormat: 'detailed',
  verbose: true
};

const integration = new CLISearchIntegration(context);
const commands = integration.registerSlashCommands();

// Execute slash commands
const searchCommand = commands.get('search');
const result = await searchCommand('UserService --type class --lang typescript');

console.log(result);
// Output: "🔍 Search completed for: UserService (class search found 3 matches)"
```

### Performance Monitoring

```typescript
import { PerformanceMonitor } from './search';

const monitor = new PerformanceMonitor();

// Monitor individual queries
const monitoringId = monitor.startMonitoring({
  query: 'UserService',
  queryType: 'class'
});

// ... perform search ...

const metrics = monitor.endMonitoring(monitoringId);
console.log(`Search took ${metrics.totalTime}ms`);
console.log(`Memory used: ${metrics.memoryUsed / 1024 / 1024}MB`);

// Run comprehensive benchmarks
const benchmarkQueries = [
  { query: 'function', queryType: 'general' },
  { query: 'UserService', queryType: 'class' },
  { query: 'import.*react', queryType: 'import', useRegex: true }
];

const results = await monitor.runBenchmark(benchmarkQueries);
monitor.generateBenchmarkReport(results);
```

---

**API Version**: 1.0.0  
**Last Updated**: 2025-08-25  
**Compatibility**: CodeCrucible Synth v4.2.1+