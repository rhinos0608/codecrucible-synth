import { logger } from '../logging/logger.js';

export interface ToolRunResult {
  toolId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ResultAggregator {
  private readonly results: ToolRunResult[] = [];

  public add(result: Readonly<ToolRunResult>): void {
    this.results.push(result);
  }

  public combine(): { successes: ToolRunResult[]; errors: ToolRunResult[] } {
    const successes = this.results.filter((r: Readonly<ToolRunResult>) => r.success);
    const errors = this.results.filter((r: Readonly<ToolRunResult>) => !r.success);
    logger.debug('Aggregated tool results', {
      successes: successes.length,
      errors: errors.length,
    });
    return { successes, errors };
  }
}
