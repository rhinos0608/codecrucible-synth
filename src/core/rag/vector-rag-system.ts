import { CommandLineSearchEngine } from '../search/command-line-search-engine.js';
import type { RAGQuery, RAGResult } from '../search/types.js';

export class VectorRAGSystem {
  private searchEngine: CommandLineSearchEngine;

  constructor(workspace: string) {
    this.searchEngine = new CommandLineSearchEngine(workspace);
  }

  async initialize(): Promise<void> {
    // no initialization required in this simplified version
  }

  async search(query: RAGQuery): Promise<RAGResult> {
    const result = await this.searchEngine.search(query);
    return {
      ...result,
      metadata: { searchMethod: 'rag', confidence: result.documents.length > 0 ? 0.8 : 0 },
    };
  }

  async shutdown(): Promise<void> {
    // no cleanup required
  }
}
