/**
 * Type definitions for performance optimization system
 */

export interface ModelResponse {
  content: string;
  tokenCount: number;
  fromCache: boolean;
  latency: number;
  metadata?: {
    optimizations?: string;
    originalTokens?: number;
    savedTokens?: number;
  };
}

export interface PerformanceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatency: number;
  tokensSaved: number;
  batcheProcessed: number;
  cacheHitRatio?: number;
  cacheSize?: number;
  embeddingCacheSize?: number;
}

export interface CacheEntry {
  response: string;
  tokenCount: number;
  timestamp: number;
  metadata?: {
    originalPromptLength?: number;
    optimizations?: string[];
  };
}

export interface OptimizationConfig {
  // Cache settings
  maxCacheSize: number;
  cacheMaxAge: number;
  
  // Tokenization settings
  maxTokensPerPrompt: number;
  contextWindowSize: number;
  chunkSize: number;
  
  // Batch settings
  batchSize: number;
  batchTimeoutMs: number;
  maxConcurrentBatches: number;
  
  // Model parameters
  temperature: number;
  topP: number;
  topK: number;
  
  // Performance settings
  enableStreaming: boolean;
  enableBatching: boolean;
  enableCaching: boolean;
}

export interface FastModeConfig {
  skipModelPreload: boolean;
  skipBenchmark: boolean;
  useMinimalVoices: boolean;
  disableMCP: boolean;
  lightweightMode: boolean;
}

export interface ContextRelevanceScore {
  content: string;
  score: number;
  relevantKeywords: string[];
}

export interface TokenEstimation {
  prompt: number;
  context: number;
  total: number;
  maxAllowed: number;
  needsTruncation: boolean;
}