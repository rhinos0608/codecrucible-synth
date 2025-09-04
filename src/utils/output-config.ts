/**
 * Output Configuration Module
 *
 * Centralizes configuration for file streaming, content truncation, and memory management.
 * Implements adaptive thresholds based on system resources and context requirements.
 *
 * @module OutputConfig
 */

interface OutputConfigOptions {
  // Streaming configuration
  streamingEnabled: boolean;
  streamingThresholdBytes: number;
  maxStreamingFileSizeBytes: number;
  streamingChunkSize: number;

  // Context truncation limits
  contextLimits: {
    fileAnalysis: number;
    codeGeneration: number;
    searchResults: number;
    commandOutput: number;
    default: number;
  };

  // Memory management
  maxBufferSize: number;
  cleanupIntervalMs: number;

  // Performance tuning
  adaptiveChunking: boolean;
  compressionEnabled: boolean;
}

class OutputConfiguration {
  private config: OutputConfigOptions;
  private systemMemoryMB: number = 0;

  public constructor() {
    // Initialize with safe defaults optimized for hybrid Rust/TypeScript architecture
    this.config = {
      streamingEnabled: true,
      streamingThresholdBytes: 64 * 1024, // 64KB - start streaming early
      maxStreamingFileSizeBytes: 500 * 1024 * 1024, // 500MB - reasonable limit
      streamingChunkSize: 16 * 1024, // 16KB chunks - balance memory/IO

      contextLimits: {
        fileAnalysis: 50000, // ~50K chars for AI analysis
        codeGeneration: 100000, // ~100K chars for code generation
        searchResults: 25000, // ~25K chars for search results
        commandOutput: 10000, // ~10K chars for command output
        default: 20000, // ~20K chars default
      },

      maxBufferSize: 10 * 1024 * 1024, // 10MB max buffer
      cleanupIntervalMs: 30000, // 30s cleanup interval

      adaptiveChunking: true,
      compressionEnabled: false, // Disabled for now due to CPU overhead
    };

    this.initializeSystemMetrics();
  }

  /**
   * Initialize system metrics for adaptive configuration
   */
  private initializeSystemMetrics(): void {
    try {
      // Get available memory (simplified - in production use proper system metrics)
      const memoryUsage = process.memoryUsage();
      this.systemMemoryMB = Math.floor(memoryUsage.heapUsed / (1024 * 1024));

      // Adjust limits based on available memory
      this.adjustConfigForSystemResources();
    } catch (error) {
      console.warn('OutputConfig: Unable to determine system metrics, using defaults');
    }
  }

  /**
   * Adjust configuration based on system resources
   */
  private adjustConfigForSystemResources(): void {
    if (this.systemMemoryMB < 512) {
      // Low memory system - reduce limits
      this.config.streamingThresholdBytes = 32 * 1024;
      this.config.maxStreamingFileSizeBytes = 100 * 1024 * 1024;
      this.config.streamingChunkSize = 8 * 1024;
      this.config.maxBufferSize = 5 * 1024 * 1024;

      // Reduce context limits
      Object.keys(this.config.contextLimits).forEach(key => {
        this.config.contextLimits[key as keyof typeof this.config.contextLimits] *= 0.5;
      });
    } else if (this.systemMemoryMB > 2048) {
      // High memory system - increase limits
      this.config.streamingThresholdBytes = 128 * 1024;
      this.config.streamingChunkSize = 32 * 1024;
      this.config.maxBufferSize = 50 * 1024 * 1024;
    }
  }

  /**
   * Check if streaming is enabled
   */
  public isStreamingEnabled(): boolean {
    return this.config.streamingEnabled;
  }

  /**
   * Get the byte threshold for when to start streaming
   */
  public getStreamingThresholdBytes(): number {
    return this.config.streamingThresholdBytes;
  }

  /**
   * Get the maximum file size for streaming operations
   */
  public getMaxStreamingFileSizeBytes(): number {
    return this.config.maxStreamingFileSizeBytes;
  }

  /**
   * Get the chunk size for streaming operations
   */
  public getStreamingChunkSize(): number {
    return this.config.streamingChunkSize;
  }

  /**
   * Get maximum buffer size for operations
   */
  public getMaxBufferSize(): number {
    return this.config.maxBufferSize;
  }

  /**
   * Truncate content for specific context types
   */
  public truncateForContext(content: string, contextType: string = 'default'): string {
    const limit =
      this.config.contextLimits[contextType as keyof typeof this.config.contextLimits] ||
      this.config.contextLimits.default;

    if (content.length <= limit) {
      return content;
    }

    // Smart truncation - try to preserve structure
    const truncated = content.substring(0, limit);
    const lastNewlineIndex = truncated.lastIndexOf('\n');

    if (lastNewlineIndex > limit * 0.8) {
      // Truncate at line boundary if we're not losing too much
      return `${truncated.substring(0, lastNewlineIndex)}
  \n\n[... truncated ${content.length - lastNewlineIndex} characters for context limits]`;
    } else {
      return `${truncated}
  [... truncated ${content.length - limit} characters for context limits]`;
    }
  }

  /**
   * Calculate adaptive chunk size based on file size and system resources
   */
  public getAdaptiveChunkSize(fileSize: number): number {
    if (!this.config.adaptiveChunking) {
      return this.config.streamingChunkSize;
    }

    // Adaptive chunking based on file size
    if (fileSize > 100 * 1024 * 1024) {
      return Math.max(this.config.streamingChunkSize * 4, 64 * 1024); // Larger chunks for big files
    } else if (fileSize < 10 * 1024) {
      return Math.min(this.config.streamingChunkSize / 2, 4 * 1024); // Smaller chunks for small files
    }

    return this.config.streamingChunkSize;
  }

  /**
   * Check if content should be streamed based on size and type
   */
  public shouldStream(contentSize: number, contentType?: string): boolean {
    if (!this.config.streamingEnabled) return false;

    // Always stream if above threshold
    if (contentSize > this.config.streamingThresholdBytes) return true;

    // Content-type specific thresholds
    if (contentType === 'binary' && contentSize > 16 * 1024) return true;
    if (contentType === 'text' && contentSize > 32 * 1024) return true;

    return false;
  }

  /**
   * Get configuration for command output limits
   */
  public getCommandOutputLimits(): {
    maxBufferSize: number;
    truncateAt: number;
    streamingThreshold: number;
  } {
    return {
      maxBufferSize: this.config.maxBufferSize,
      truncateAt: this.config.contextLimits.commandOutput,
      streamingThreshold: this.config.streamingThresholdBytes,
    };
  }

  /**
   * Update configuration at runtime (for testing and adaptation)
   */
  public updateConfig(updates: Readonly<Partial<OutputConfigOptions>>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration (for debugging/monitoring)
   */
  public getConfig(): Readonly<OutputConfigOptions> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Reset to defaults
   */
  public resetToDefaults(): void {
    this.constructor();
  }
}

// Export singleton instance
export const outputConfig = new OutputConfiguration();

// Export class for testing
export { OutputConfiguration };

// Export types for type checking
export type { OutputConfigOptions };
