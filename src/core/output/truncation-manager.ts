import { outputConfig } from '../../utils/output-config.js';

/**
 * TruncationManager enforces memory-safe limits on streamed content.
 * It tracks cumulative size and truncates with a clear marker when limits are exceeded.
 */
class TruncationManager {
  private readonly limit: number;
  private size = 0;
  private truncated = false;

  constructor(contextType: string = 'default') {
    const config = outputConfig.getConfig();
    this.limit =
      config.contextLimits[contextType as keyof typeof config.contextLimits] ??
      config.contextLimits.default;
  }

  /**
   * Append a chunk of text respecting the configured limit.
   * Returns the portion that fits and whether no more data should be accepted.
   */
  append(chunk: string): { text: string; done: boolean } {
    if (this.truncated) {
      return { text: '', done: true };
    }

    const remaining = this.limit - this.size;
    if (chunk.length <= remaining) {
      this.size += chunk.length;
      return { text: chunk, done: false };
    }

    const truncationMessage = '\n[Truncated]';
    const text = chunk.slice(0, remaining) + truncationMessage;
    this.size = text.length;
    this.truncated = true;
    return { text, done: true };
  }

  isTruncated(): boolean {
    return this.truncated;
  }
}

export { TruncationManager };
