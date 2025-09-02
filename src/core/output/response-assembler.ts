import { TruncationManager } from './truncation-manager.js';
import { outputConfig } from '../../utils/output-config.js';

/**
 * ResponseAssembler builds multi-chunk responses while honoring truncation
 * limits and maximum buffer sizes.
 */
class ResponseAssembler {
  private readonly chunks: string[] = [];
  private readonly truncation: TruncationManager;
  private size = 0;
  private readonly maxBuffer = outputConfig.getMaxBufferSize();

  constructor(contextType?: string) {
    this.truncation = new TruncationManager(contextType);
  }

  /**
   * Add a chunk to the response. Returns false if no more chunks should be added.
   */
  addChunk(chunk: Buffer): boolean {
    if (this.size >= this.maxBuffer) {
      return false;
    }

    const { text, done } = this.truncation.append(chunk.toString('utf8'));
    this.chunks.push(text);
    this.size += Buffer.byteLength(text);
    return !done && this.size < this.maxBuffer;
  }

  /**
   * Get the assembled response as a single string.
   */
  getResponse(): string {
    return this.chunks.join('');
  }
}

export { ResponseAssembler };
