import type { RAGQuery, RAGResult } from './types.js';
import { CommandLineSearchEngine } from './command-line-search-engine.js';
import { AdvancedSearchCacheManager } from './advanced-search-cache.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { VectorRAGSystem } from '../rag/vector-rag-system.js';

export class HybridSearchCoordinator {
  public constructor(
    private readonly searchEngine: CommandLineSearchEngine,
    private readonly ragSystem?: VectorRAGSystem,
    private readonly cacheManager?: AdvancedSearchCacheManager,
    private readonly performanceMonitor?: PerformanceMonitor
  ) {}

  public async search(query: Readonly<RAGQuery>): Promise<RAGResult> {
    const cacheKey = JSON.stringify(query);
    const start = this.performanceMonitor?.startTimer();

    if (this.cacheManager) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        if (start) this.performanceMonitor?.endTimer(start);
        return cached;
      }
    }

    let result: RAGResult;
    if (query.queryType === 'semantic' && this.ragSystem) {
      result = await this.ragSystem.search(query);
    } else {
      result = await this.searchEngine.search(query);
    }

    if (this.cacheManager) {
      await this.cacheManager.set(cacheKey, result);
    }

    if (start) {
      this.performanceMonitor?.endTimer(start);
    }

    return result;
  }

  public async shutdown(): Promise<void> {
    // Add shutdown logic here if needed
  }
}
