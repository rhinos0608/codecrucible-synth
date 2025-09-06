export interface RAGQuery {
  query: string;
  queryType: 'function' | 'class' | 'import' | 'semantic' | 'pattern';
  maxResults?: number;
  useRegex?: boolean;
}

export interface Document {
  filePath: string;
  content: string;
}

export interface RAGResult {
  documents: Document[];
  metadata?: {
    searchMethod: 'ripgrep' | 'rag';
    confidence: number;
  };
}

export interface HybridSearchConfig {
  ragThreshold: number;
  ripgrepFallback: boolean;
}
