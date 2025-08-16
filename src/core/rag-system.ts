/**
 * RAG (Retrieval-Augmented Generation) System inspired by Archon
 * Provides knowledge management, document embedding, and contextual retrieval
 */

import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { logger } from './logger.js';
import { glob } from 'glob';

export interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: 'file' | 'web' | 'manual';
    title?: string;
    tags?: string[];
    timestamp: number;
    size: number;
    language?: string;
  };
  embedding?: number[];
}

export interface SearchResult {
  document: Document;
  score: number;
  relevantChunks?: string[];
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  getDimensions(): number;
}

export interface RAGQuery {
  query: string;
  filters?: {
    source?: string;
    type?: 'file' | 'web' | 'manual';
    tags?: string[];
    language?: string;
  };
  maxResults?: number;
  minScore?: number;
}

export interface RAGResponse {
  results: SearchResult[];
  context: string;
  query: string;
  metadata: {
    totalDocuments: number;
    searchTime: number;
    sourcesUsed: string[];
  };
}

/**
 * Simple embedding provider using basic text vectorization
 * In production, this would use OpenAI embeddings, Sentence Transformers, etc.
 */
export class SimpleEmbeddingProvider implements EmbeddingProvider {
  private readonly dimensions = 384; // Standard embedding size

  async generateEmbedding(text: string): Promise<number[]> {
    // Simple TF-IDF-like embedding for demonstration
    // In production, use proper embedding models
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const wordFreq = new Map<string, number>();
    
    // Calculate word frequencies
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
    
    // Create a simple vector based on word frequencies and positions
    const embedding = new Array(this.dimensions).fill(0);
    let index = 0;
    
    for (const [word, freq] of wordFreq.entries()) {
      if (index >= this.dimensions) break;
      
      // Simple hash function to map words to vector positions
      const hash = this.simpleHash(word) % this.dimensions;
      embedding[hash] += freq / words.length;
      index++;
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Vector store for managing document embeddings and similarity search
 */
export class VectorStore {
  private documents: Map<string, Document> = new Map();
  private embeddingProvider: EmbeddingProvider;

  constructor(embeddingProvider: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider;
  }

  async addDocument(document: Document): Promise<void> {
    // Generate embedding if not provided
    if (!document.embedding) {
      document.embedding = await this.embeddingProvider.generateEmbedding(document.content);
    }
    
    this.documents.set(document.id, document);
    logger.debug(`Added document to vector store: ${document.id}`);
  }

  async removeDocument(id: string): Promise<boolean> {
    const removed = this.documents.delete(id);
    if (removed) {
      logger.debug(`Removed document from vector store: ${id}`);
    }
    return removed;
  }

  async search(query: string, maxResults: number = 10, minScore: number = 0.1): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingProvider.generateEmbedding(query);
    const results: SearchResult[] = [];

    for (const document of this.documents.values()) {
      if (!document.embedding) continue;

      const score = this.cosineSimilarity(queryEmbedding, document.embedding);
      
      if (score >= minScore) {
        results.push({
          document,
          score,
          relevantChunks: this.extractRelevantChunks(document.content, query)
        });
      }
    }

    // Sort by score descending and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private extractRelevantChunks(content: string, query: string, chunkSize: number = 200): string[] {
    const queryWords = query.toLowerCase().split(/\W+/);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const relevantChunks: { text: string; score: number }[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const chunk = sentences.slice(i, i + Math.ceil(chunkSize / 50)).join('. ');
      const chunkLower = chunk.toLowerCase();
      
      let score = 0;
      for (const word of queryWords) {
        if (chunkLower.includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        relevantChunks.push({ text: chunk.trim(), score });
      }
    }

    return relevantChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(chunk => chunk.text);
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  getAllDocuments(): Document[] {
    return Array.from(this.documents.values());
  }
}

/**
 * Main RAG system that combines document management with retrieval
 */
export class RAGSystem {
  private vectorStore: VectorStore;
  private embeddingProvider: EmbeddingProvider;

  constructor(embeddingProvider?: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider || new SimpleEmbeddingProvider();
    this.vectorStore = new VectorStore(this.embeddingProvider);
  }

  /**
   * Index a file or directory for RAG retrieval
   */
  async indexPath(path: string, options?: {
    recursive?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
  }): Promise<number> {
    const { recursive = true, includePatterns = ['**/*'], excludePatterns = ['node_modules/**', '.git/**', 'dist/**'] } = options || {};

    let indexed = 0;
    const patterns = includePatterns.map(pattern => join(path, pattern));

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        ignore: excludePatterns,
        nodir: true,
        maxDepth: recursive ? undefined : 1
      });

      for (const file of files) {
        try {
          const document = await this.createDocumentFromFile(file);
          await this.vectorStore.addDocument(document);
          indexed++;
        } catch (error) {
          logger.warn(`Failed to index file ${file}:`, error);
        }
      }
    }

    logger.info(`Indexed ${indexed} documents from path: ${path}`);
    return indexed;
  }

  /**
   * Add a document manually to the RAG system
   */
  async addDocument(content: string, metadata: Partial<Document['metadata']>): Promise<string> {
    const id = this.generateDocumentId();
    const document: Document = {
      id,
      content,
      metadata: {
        source: metadata.source || 'manual',
        type: metadata.type || 'manual',
        title: metadata.title || `Document ${id}`,
        tags: metadata.tags || [],
        timestamp: Date.now(),
        size: content.length,
        language: metadata.language || 'text',
        ...metadata
      }
    };

    await this.vectorStore.addDocument(document);
    logger.info(`Added document to RAG system: ${id}`);
    return id;
  }

  /**
   * Query the RAG system for relevant information
   */
  async query(ragQuery: RAGQuery): Promise<RAGResponse> {
    const startTime = Date.now();
    
    // Perform vector search
    const results = await this.vectorStore.search(
      ragQuery.query,
      ragQuery.maxResults || 10,
      ragQuery.minScore || 0.1
    );

    // Apply filters
    const filteredResults = this.applyFilters(results, ragQuery.filters);

    // Generate context from results
    const context = this.generateContext(filteredResults);

    const searchTime = Date.now() - startTime;
    const sourcesUsed = [...new Set(filteredResults.map(r => r.document.metadata.source))];

    return {
      results: filteredResults,
      context,
      query: ragQuery.query,
      metadata: {
        totalDocuments: this.vectorStore.getDocumentCount(),
        searchTime,
        sourcesUsed
      }
    };
  }

  /**
   * Get statistics about the RAG system
   */
  getStats() {
    const documents = this.vectorStore.getAllDocuments();
    const typeCount = new Map<string, number>();
    const sourceCount = new Map<string, number>();

    for (const doc of documents) {
      typeCount.set(doc.metadata.type, (typeCount.get(doc.metadata.type) || 0) + 1);
      sourceCount.set(doc.metadata.source, (sourceCount.get(doc.metadata.source) || 0) + 1);
    }

    return {
      totalDocuments: documents.length,
      embeddingDimensions: this.embeddingProvider.getDimensions(),
      documentsByType: Object.fromEntries(typeCount),
      documentsBySource: Object.fromEntries(sourceCount),
      totalSize: documents.reduce((sum, doc) => sum + doc.metadata.size, 0)
    };
  }

  private async createDocumentFromFile(filePath: string): Promise<Document> {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    const ext = extname(filePath);
    
    const language = this.detectLanguage(ext);
    const id = this.generateDocumentId();

    return {
      id,
      content,
      metadata: {
        source: filePath,
        type: 'file',
        title: filePath,
        timestamp: stats.mtime.getTime(),
        size: content.length,
        language
      }
    };
  }

  private detectLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.md': 'markdown',
      '.txt': 'text',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml'
    };

    return languageMap[ext.toLowerCase()] || 'text';
  }

  private applyFilters(results: SearchResult[], filters?: RAGQuery['filters']): SearchResult[] {
    if (!filters) return results;

    return results.filter(result => {
      const { metadata } = result.document;

      if (filters.source && !metadata.source.includes(filters.source)) {
        return false;
      }

      if (filters.type && metadata.type !== filters.type) {
        return false;
      }

      if (filters.language && metadata.language !== filters.language) {
        return false;
      }

      if (filters.tags && filters.tags.length > 0) {
        const docTags = metadata.tags || [];
        if (!filters.tags.some(tag => docTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });
  }

  private generateContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant information found.';
    }

    const contextParts: string[] = [];
    
    for (let i = 0; i < Math.min(results.length, 5); i++) {
      const result = results[i];
      const { document, relevantChunks } = result;
      
      contextParts.push(`## Source: ${document.metadata.source}`);
      
      if (relevantChunks && relevantChunks.length > 0) {
        contextParts.push(...relevantChunks.map(chunk => `${chunk.substring(0, 500)}${chunk.length > 500 ? '...' : ''}`));
      } else {
        const preview = document.content.substring(0, 500);
        contextParts.push(`${preview}${document.content.length > 500 ? '...' : ''}`);
      }
      
      contextParts.push(''); // Empty line for separation
    }

    return contextParts.join('\n');
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global RAG system instance
 */
export const globalRAGSystem = new RAGSystem();

/**
 * Convenience function to query the global RAG system
 */
export async function queryKnowledge(query: string, filters?: RAGQuery['filters']): Promise<RAGResponse> {
  return globalRAGSystem.query({ query, filters });
}