export class PerformanceMonitor {
  private searchCount = 0;
  private totalTime = 0;

  startTimer(): bigint {
    return process.hrtime.bigint();
  }

  endTimer(start: bigint): void {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    this.searchCount++;
    this.totalTime += durationMs;
  }

  reset(): void {
    this.searchCount = 0;
    this.totalTime = 0;
  }
}
