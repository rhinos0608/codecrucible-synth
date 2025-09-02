/**
 * Stream Chunk Protocol
 * 
 * Defines the unified streaming protocol between Rust executor and TypeScript
 * Enables true streaming with backpressure and resource monitoring
 * 
 * This is the key bridge that eliminates memory accumulation in TypeScript
 */

export interface StreamChunk {
  /** Unique identifier for this stream session */
  streamId: string;
  
  /** Sequence number for ordering chunks */
  sequence: number;
  
  /** Type of content being streamed */
  contentType: 'text' | 'binary' | 'json' | 'command_output' | 'file_content';
  
  /** The actual chunk data */
  data: string | Buffer;
  
  /** Size of this chunk in bytes */
  size: number;
  
  /** Metadata about the chunk */
  metadata: {
    /** Source of this chunk (file path, command, etc.) */
    source: string;
    
    /** Encoding if text */
    encoding?: 'utf8' | 'base64' | 'binary';
    
    /** MIME type if applicable */
    mimeType?: string;
    
    /** Total expected size if known */
    totalSize?: number;
    
    /** Progress percentage (0-100) */
    progress?: number;
    
    /** Whether this is the final chunk */
    isLast: boolean;
    
    /** Error message if chunk represents an error */
    error?: string;
    
    /** Compression used */
    compression?: 'gzip' | 'zstd' | 'none';
  };
  
  /** Timing information */
  timing: {
    /** When chunk was generated (Rust timestamp) */
    generatedAt: number;
    
    /** When chunk was sent to TypeScript */
    sentAt: number;
    
    /** Processing time in Rust (microseconds) */
    rustProcessingTime: number;
  };
  
  /** Resource usage for this chunk */
  resourceUsage?: {
    /** Memory used in Rust for this chunk */
    memoryBytes: number;
    
    /** CPU time used (microseconds) */
    cpuTime: number;
    
    /** IO operations performed */
    ioOperations: number;
  };
}

export interface StreamOptions {
  /** Maximum chunk size in bytes */
  chunkSize: number;
  
  /** Enable compression for chunks */
  compression: boolean;
  
  /** Buffer size for backpressure */
  bufferSize: number;
  
  /** Timeout for chunk processing */
  timeoutMs: number;
  
  /** Context type for adaptive configuration */
  contextType: 'fileAnalysis' | 'codeGeneration' | 'commandOutput' | 'searchResults' | 'default';
  
  /** Whether to include resource usage metrics */
  includeMetrics: boolean;
  
  /** Custom metadata to include in chunks */
  metadata?: Record<string, any>;
}

export interface StreamSession {
  /** Unique session identifier */
  id: string;
  
  /** Current state */
  state: 'initializing' | 'streaming' | 'completed' | 'error' | 'cancelled';
  
  /** Options used for this session */
  options: StreamOptions;
  
  /** Statistics */
  stats: {
    /** Total chunks processed */
    chunksProcessed: number;
    
    /** Total bytes streamed */
    bytesStreamed: number;
    
    /** Start time */
    startTime: number;
    
    /** End time */
    endTime?: number;
    
    /** Average chunk processing time (ms) */
    avgChunkTime: number;
    
    /** Peak memory usage during streaming */
    peakMemoryBytes: number;
  };
  
  /** Error if session failed */
  error?: string;
}

export type StreamEventType = 
  | 'chunk'        // New chunk received
  | 'progress'     // Progress update
  | 'completed'    // Stream completed successfully  
  | 'error'        // Stream failed
  | 'cancelled'    // Stream cancelled
  | 'backpressure' // Backpressure applied
  | 'resumed';     // Streaming resumed

export interface StreamEvent {
  type: StreamEventType;
  streamId: string;
  timestamp: number;
  data?: any;
  error?: string;
}

/**
 * Stream processor interface for TypeScript consumers
 */
export interface StreamProcessor {
  /** Process a single chunk */
  processChunk(chunk: StreamChunk): Promise<void>;
  
  /** Handle stream completion */
  onCompleted(session: StreamSession): Promise<void>;
  
  /** Handle stream error */
  onError(error: string, session: StreamSession): Promise<void>;
  
  /** Handle backpressure events */
  onBackpressure(streamId: string): Promise<void>;
}

/**
 * Resource limits for streaming operations
 */
export interface StreamResourceLimits {
  /** Maximum memory usage in bytes */
  maxMemoryBytes: number;
  
  /** Maximum CPU time in milliseconds */
  maxCpuTimeMs: number;
  
  /** Maximum stream duration in milliseconds */
  maxDurationMs: number;
  
  /** Maximum number of concurrent streams */
  maxConcurrentStreams: number;
  
  /** Maximum total bytes per stream */
  maxBytesPerStream: number;
}

/**
 * Utility functions for working with stream chunks
 */
export class StreamChunkUtils {
  /**
   * Combine multiple chunks into a single result (for small streams)
   */
  static combineChunks(chunks: StreamChunk[]): string {
    return chunks
      .sort((a, b) => a.sequence - b.sequence)
      .map(chunk => chunk.data.toString())
      .join('');
  }
  
  /**
   * Calculate total size from chunks
   */
  static calculateTotalSize(chunks: StreamChunk[]): number {
    return chunks.reduce((total, chunk) => total + chunk.size, 0);
  }
  
  /**
   * Find missing sequences in chunk array
   */
  static findMissingSequences(chunks: StreamChunk[]): number[] {
    const sequences = chunks.map(c => c.sequence).sort((a, b) => a - b);
    const missing: number[] = [];
    
    for (let i = 0; i < sequences.length - 1; i++) {
      const current = sequences[i];
      const next = sequences[i + 1];
      
      for (let seq = current + 1; seq < next; seq++) {
        missing.push(seq);
      }
    }
    
    return missing;
  }
  
  /**
   * Validate chunk integrity
   */
  static validateChunk(chunk: StreamChunk): boolean {
    return (
      chunk.streamId?.length > 0 &&
      chunk.sequence >= 0 &&
      chunk.data !== undefined &&
      chunk.size > 0 &&
      chunk.metadata?.source?.length > 0
    );
  }
  
  /**
   * Create stream options with adaptive defaults
   */
  static createStreamOptions(contextType: StreamOptions['contextType'], overrides?: Partial<StreamOptions>): StreamOptions {
    const baseOptions: StreamOptions = {
      chunkSize: 16 * 1024, // 16KB default
      compression: true,
      bufferSize: 64 * 1024, // 64KB buffer
      timeoutMs: 30000, // 30 second timeout
      contextType,
      includeMetrics: true,
      ...overrides
    };
    
    // Adaptive configuration based on context
    switch (contextType) {
      case 'fileAnalysis':
        baseOptions.chunkSize = 32 * 1024; // Larger chunks for analysis
        break;
      case 'commandOutput':
        baseOptions.chunkSize = 8 * 1024; // Smaller chunks for real-time output
        baseOptions.bufferSize = 32 * 1024;
        break;
      case 'codeGeneration':
        baseOptions.compression = false; // Disable compression for code
        break;
    }
    
    return baseOptions;
  }
}