import type { GitDiffResult, GitStatus } from './git-types.js';

const statusCache = new Map<string, GitStatus>();
const diffCache = new Map<string, GitDiffResult[]>();

export function cacheStatus(path: string, status: GitStatus): void {
  statusCache.set(path, status);
}

export function getCachedStatus(path: string): GitStatus | undefined {
  return statusCache.get(path);
}

export function cacheDiff(path: string, diff: GitDiffResult[]): void {
  diffCache.set(path, diff);
}

export function getCachedDiff(path: string): GitDiffResult[] | undefined {
  return diffCache.get(path);
}

export function clearCaches(): void {
  statusCache.clear();
  diffCache.clear();
}
