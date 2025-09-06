export interface CachedItem {
  result: any;
  timestamp: number;
  ttl: number;
}

export class ExecutionCache extends Map<string, CachedItem> {
  getValid(key: string): any | null {
    const cached = this.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    if (cached) {
      this.delete(key);
    }
    return null;
  }

  setResult(key: string, result: any, ttl: number): void {
    this.set(key, { result, timestamp: Date.now(), ttl });
  }

  startCleanup(): NodeJS.Timeout {
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

export function shouldCacheResult(result: any): boolean {
  if (result instanceof Error || JSON.stringify(result).length > 100000) {
    return false;
  }
  return true;
}
