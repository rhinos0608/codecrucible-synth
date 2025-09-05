import { logger } from '../../infrastructure/logging/unified-logger.js';

export function formatOutput(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    const content = (record.response ?? record.content) as unknown;
    if (typeof content === 'string') {
      return content;
    }
  }
  logger.warn('Unknown result format', { type: typeof result });
  return String(result ?? '');
}
