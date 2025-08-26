// Streaming Manager
// Core layer streaming functionality

import { EventEmitter } from 'events';

export interface StreamData {
  id: string;
  content: string;
  timestamp: number;
  finished: boolean;
  metadata?: Record<string, unknown>;
}

export interface StreamConfig {
  bufferSize: number;
  maxStreams: number;
  timeout: number;
  enableCompression: boolean;
}

export interface StreamingManagerInterface {
  createStream(streamId: string): Promise<string>;
  writeToStream(streamId: string, data: StreamData): Promise<void>;
  readFromStream(streamId: string): Promise<StreamData[]>;
  closeStream(streamId: string): Promise<void>;
  getActiveStreams(): string[];
}

export class StreamingManager extends EventEmitter implements StreamingManagerInterface {
  private config: StreamConfig;
  private streams = new Map<string, StreamBuffer>();
  private streamTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(config: Partial<StreamConfig> = {}) {
    super();
    
    this.config = {
      bufferSize: 1000,
      maxStreams: 100,
      timeout: 300000, // 5 minutes
      enableCompression: false,
      ...config
    };
  }

  async createStream(streamId: string): Promise<string> {
    if (this.streams.has(streamId)) {
      throw new Error(`Stream ${streamId} already exists`);
    }

    if (this.streams.size >= this.config.maxStreams) {
      throw new Error('Maximum number of streams reached');
    }

    const buffer = new StreamBuffer(this.config.bufferSize);
    this.streams.set(streamId, buffer);

    // Set timeout for stream
    const timeout = setTimeout(() => {
      this.closeStream(streamId);
      this.emit('stream:timeout', { streamId });
    }, this.config.timeout);
    
    this.streamTimeouts.set(streamId, timeout);

    this.emit('stream:created', { streamId });
    return streamId;
  }

  async writeToStream(streamId: string, data: StreamData): Promise<void> {
    const buffer = this.streams.get(streamId);
    if (!buffer) {
      throw new Error(`Stream ${streamId} not found`);
    }

    buffer.add(data);
    this.emit('stream:data', { streamId, data });

    if (data.finished) {
      this.emit('stream:finished', { streamId });
    }
  }

  async readFromStream(streamId: string): Promise<StreamData[]> {
    const buffer = this.streams.get(streamId);
    if (!buffer) {
      throw new Error(`Stream ${streamId} not found`);
    }

    return buffer.read();
  }

  async closeStream(streamId: string): Promise<void> {
    const buffer = this.streams.get(streamId);
    if (!buffer) {
      return; // Stream already closed or doesn't exist
    }

    this.streams.delete(streamId);
    
    const timeout = this.streamTimeouts.get(streamId);
    if (timeout) {
      clearTimeout(timeout);
      this.streamTimeouts.delete(streamId);
    }

    this.emit('stream:closed', { streamId });
  }

  getActiveStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  // Utility methods
  async getStreamStats(streamId: string): Promise<{
    bufferSize: number;
    dataCount: number;
    isActive: boolean;
  } | null> {
    const buffer = this.streams.get(streamId);
    if (!buffer) {
      return null;
    }

    return {
      bufferSize: buffer.getSize(),
      dataCount: buffer.getDataCount(),
      isActive: true
    };
  }

  async cleanup(): Promise<void> {
    const activeStreams = this.getActiveStreams();
    
    for (const streamId of activeStreams) {
      await this.closeStream(streamId);
    }

    this.emit('streaming:cleanup');
  }

  // Stream health check
  async healthCheck(): Promise<{
    activeStreams: number;
    maxStreams: number;
    healthy: boolean;
  }> {
    const activeStreams = this.streams.size;
    const healthy = activeStreams < this.config.maxStreams * 0.9; // 90% threshold

    return {
      activeStreams,
      maxStreams: this.config.maxStreams,
      healthy
    };
  }

  /**
   * Start streaming content progressively with token callback
   * Used by request handlers for progressive content delivery
   */
  async startStream(
    content: string, 
    onToken: (token: { content: string; index: number; finished: boolean }) => void,
    streamConfig?: any
  ): Promise<void> {
    const chunkSize = streamConfig?.chunkSize || 10;
    const delay = streamConfig?.delay || 50;
    
    // Split content into chunks for streaming
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }
    
    // Stream chunks progressively
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLast = i === chunks.length - 1;
      
      onToken({
        content: chunk,
        index: i,
        finished: isLast
      });
      
      // Add delay between chunks to simulate real streaming
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

class StreamBuffer {
  private data: StreamData[] = [];
  private maxSize: number;
  private readPosition = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  add(data: StreamData): void {
    this.data.push(data);
    
    // Remove old data if buffer is full
    if (this.data.length > this.maxSize) {
      this.data.shift();
      if (this.readPosition > 0) {
        this.readPosition--;
      }
    }
  }

  read(): StreamData[] {
    const unreadData = this.data.slice(this.readPosition);
    this.readPosition = this.data.length;
    return unreadData;
  }

  getSize(): number {
    return this.data.length;
  }

  getDataCount(): number {
    return this.data.length - this.readPosition;
  }
}

export const streamingManager = new StreamingManager();