import { Readable } from 'stream';
import { StreamProcessor } from './stream-processor.js';
import { ResponseAssembler } from './response-assembler.js';
import { FormatTransformer } from './format-transformer.js';

interface ProcessOptions {
  format?: 'json' | 'yaml' | 'markdown';
  contextType?: string;
  onChunk?: (chunk: string) => void;
}

/**
 * OutputCoordinator orchestrates streaming, truncation, and formatting.
 */
class OutputCoordinator {
  private readonly streamProcessor = new StreamProcessor();
  private readonly formatter = new FormatTransformer();

  /**
   * Process a readable stream and return the final formatted response.
   * If onChunk is provided, chunks are forwarded as they arrive.
   */
  async process(readable: Readable, options: ProcessOptions = {}): Promise<string> {
    const assembler = new ResponseAssembler(options.contextType);

    await this.streamProcessor.process(readable, chunk => {
      const keepGoing = assembler.addChunk(chunk);
      options.onChunk?.(chunk.toString('utf8'));
      if (!keepGoing) {
        readable.destroy();
      }
    });

    const raw = assembler.getResponse();
    if (!options.format) {
      return raw;
    }

    // Attempt to parse JSON for structured formats
    try {
      const parsed = JSON.parse(raw);
      return this.formatter.to(options.format, parsed);
    } catch {
      return this.formatter.to(options.format, raw);
    }
  }
}

export { OutputCoordinator };
