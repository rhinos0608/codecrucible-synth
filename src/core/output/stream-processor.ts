import { Readable } from 'stream';
import { EventEmitter } from 'events';
import { outputConfig } from '../../utils/output-config.js';

/**
 * StreamProcessor handles true streaming of data sources using Node streams.
 * It emits chunks as they arrive without buffering the entire content.
 */
class StreamProcessor extends EventEmitter {
  /**
   * Stream data from a Readable source. Chunks are emitted as 'chunk' events or
   * passed to an optional handler. This method resolves when the stream ends.
   */
  async process(readable: Readable, onChunk?: (chunk: Buffer) => void): Promise<void> {
    const handler = onChunk ?? ((chunk: Buffer) => this.emit('chunk', chunk));

    try {
      for await (const chunk of readable) {
        handler(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    } catch (err: any) {
      if (err?.code !== 'ERR_STREAM_DESTROYED') {
        throw err;
      }
    }

    this.emit('end');
  }

  /**
   * Create a Readable stream from a string or Buffer honoring configured chunk size.
   */
  createReadable(data: string | Buffer): Readable {
    return Readable.from(data, {
      highWaterMark: outputConfig.getStreamingChunkSize(),
    });
  }
}

export { StreamProcessor };
