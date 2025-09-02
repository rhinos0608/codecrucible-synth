import { logger } from '../logging/logger.js';

export interface ToolRunResult {
  toolId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ResultAggregator {
  private results: ToolRunResult[] = [];

  add(result: ToolRunResult): void {
    this.results.push(result);
  }

  combine() {
    const successes = this.results.filter(r => r.success);
    const errors = this.results.filter(r => !r.success);
    logger.debug('Aggregated tool results', {
      successes: successes.length,
      errors: errors.length,
    });
    return { successes, errors };
  }
}
