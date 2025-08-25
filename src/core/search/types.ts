/**
 * Type definitions for the Hybrid Search System
 */

export interface RAGQuery {
  query: string;
  queryType: 'function' | 'class' | 'import' | 'pattern' | 'general' | 'semantic' | 'todo' | 'error';
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

export interface SearchResultDocument {
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

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: {
    filePath?: string;
    language?: string;
    lastModified?: Date;
  };
}

export interface ScoredDocument {
  document: VectorDocument;
  score: number;
  relevanceExplanation?: string;
  highlightedContent?: string;
}

export interface RAGResult {
  documents: ScoredDocument[];
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

export interface SearchResult {
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

export interface HybridSearchConfig {
  routing: {
    exactPatternThreshold: number;
    semanticSimilarityThreshold: number;
    memoryPressureThreshold: number;
    performanceTimeoutMs: number;
    enableLearning?: boolean;
  };
  caching: {
    maxCacheSize: number;
    maxCacheAge: number;
    enableFileHashTracking: boolean;
    enablePerformanceMetrics: boolean;
    compressionThreshold?: number;
  };
  performance: {
    enableMonitoring: boolean;
    benchmarkInterval?: number;
    adaptiveRouting?: boolean;
  };
  crossPlatform: {
    preferRipgrep?: boolean;
    enableFallback?: boolean;
    toolTimeout?: number;
  };
}

export interface HybridSearchMetrics {
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
    fastQueries: number;
    mediumQueries: number;
    slowQueries: number;
  };
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageHitTime: number;
  averageMissTime: number;
  memoryUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
  invalidationRate: number;
  compressionRatio: number;
}

export interface SearchOptions {
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

export interface CacheMetadata {
  searchMethod: 'ripgrep' | 'rag' | 'hybrid' | 'find';
  queryType: string;
  confidence: number;
  duration: number;
  filePaths?: string[];
}

export interface CacheConfig {
  maxCacheSize: number;
  maxCacheAge: number;
  enableFileHashTracking: boolean;
  enablePerformanceMetrics: boolean;
  compactionInterval: number;
  compressionThreshold: number;
}

export type SearchTool = 'ripgrep' | 'powershell' | 'grep' | 'find';
export type SearchMethod = 'ripgrep' | 'rag' | 'hybrid' | 'fallback';