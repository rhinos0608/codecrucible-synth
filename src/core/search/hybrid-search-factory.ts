import type { HybridSearchConfig } from './types.js';

export class HybridSearchFactory {
  static createBalancedConfig(): HybridSearchConfig {
    return { ragThreshold: 0.5, ripgrepFallback: true };
  }
}
