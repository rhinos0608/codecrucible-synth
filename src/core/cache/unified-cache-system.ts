/**
 * Unified Cache System
 * Simple implementation for testing purposes
 */

export class UnifiedCache {
  private cache: Map<string, any> = new Map();
  
  async get(key: string): Promise<any> {
    return this.cache.get(key);
  }
  
  async set(key: string, value: any): Promise<void> {
    this.cache.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
  
  async destroy(): Promise<void> {
    this.cache.clear();
  }
}

export const unifiedCache = new UnifiedCache();