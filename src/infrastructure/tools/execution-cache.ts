export interface CachedItem {
  result: unknown;
  timestamp: number;
  ttl: number;
}

export class ExecutionCache extends Map<string, CachedItem> {
  public getValid(key: string): unknown {
    const cached = this.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    if (cached) {
      this.delete(key);
    }
    return null;
  }

  public setResult(key: string, result: unknown, ttl: number): void {
    this.set(key, { result, timestamp: Date.now(), ttl });
  }

  public startCleanup(): NodeJS.Timeout {
    return setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.entries()) {
        if (now - cached.timestamp > cached.ttl) {
          this.delete(key);
        }
      }
    }, 600000); // 10 minutes
  }
}

export function shouldCacheResult(result: unknown): boolean {
  if (result instanceof Error || JSON.stringify(result).length > 100000) {
    return false;
  }
  return true;
}
