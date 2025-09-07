export interface RAGQuery {
  query: string;
  queryType: 'function' | 'class' | 'import' | 'semantic' | 'pattern';
  maxResults?: number;
  useRegex?: boolean;
  includeContext?: boolean;
}

export interface Document {
  filePath: string;
  content: string;
  metadata?: {
    lineNumber?: number;
    absoluteOffset?: number;
    context?: {
      before: string[];
      after: string[];
    };
    submatches?: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  };
}

export interface RAGResult {
  documents: Document[];
  metadata?: {
    searchMethod: 'ripgrep' | 'rag';
    confidence: number;
    strategy?: string;
    executionTime?: number;
    cacheHit?: boolean;
    fallbackUsed?: boolean;
    warnings?: string[];
    statistics?: any;
    performance?: any;
    error?: string;
  };
}

export interface HybridSearchConfig {
  ragThreshold: number;
  ripgrepFallback: boolean;
}
