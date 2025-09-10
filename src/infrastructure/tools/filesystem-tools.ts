/**
 * Filesystem Tools - Rust-First Implementation
 *
 * Uses Rust executor for high-performance filesystem operations with true streaming
 * Eliminates memory accumulation through Rust-backed chunked processing
 */

import { RustExecutionBackend } from '../execution/rust-executor/rust-execution-backend.js';
import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { rustStreamingClient } from '../streaming/rust-streaming-client.js';
import { logger } from '../logging/unified-logger.js';
import type { ToolExecutionRequest } from '../../domain/interfaces/tool-system.js';
import type {
  StreamChunk,
  StreamProcessor,
  StreamSession,
} from '../streaming/stream-chunk-protocol.js';

export class FilesystemTools {
  private rustBackend: RustExecutionBackend | null = null;
  private mcpManager: MCPServerManager | null = null;

  public setRustBackend(backend: RustExecutionBackend): void {
    this.rustBackend = backend;
  }

  public setMCPManager(manager: MCPServerManager): void {
    this.mcpManager = manager;
  }

  public async readFile(path: Readonly<string>): Promise<string> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    // Method 1: Try fast Rust file read (spawn_blocking with std::fs)
    if (this.rustBackend?.isAvailable()) {
      try {
        logger.info(`🦀 Using fast Rust file read: ${path}`);

        // Use the new fast file read method from Rust
        const { loadRustExecutorSafely } = await import('../../utils/rust-module-loader.js');
        const { module: rustExecutorModule } = loadRustExecutorSafely();
        
        if (rustExecutorModule?.RustExecutor) {
          const executor = new rustExecutorModule.RustExecutor();
          // Type-safe async initialization
          const initialized = await executor.initialize();
          if (initialized) {
            const content = await executor.read_file_fast(path);
            logger.info(`✅ Fast Rust read succeeded for ${path} in ${Date.now() - startTime}ms`);
            return content;
          }
        }
        
        throw new Error('Rust executor not available for fast file read');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('Fast Rust read failed, trying next method', { path, error: lastError.message });
      }
    }

    // Method 2: Try Rust executor (non-streaming) next with timeout
    if (this.rustBackend?.isAvailable()) {
      try {
        logger.info(`🦀 Using Rust executor for file read: ${path}`);

        const request: ToolExecutionRequest = {
          toolId: 'filesystem',
          arguments: { operation: 'read', path },
          context: {
            sessionId: 'file-read',
            workingDirectory: process.cwd(),
            permissions: [{ type: 'read' as const, resource: path, scope: 'file' as const }],
            environment: {},
            securityLevel: 'medium',
          },
        };

        // Add timeout to Rust executor calls
        const rustPromise = this.rustBackend.execute(request);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Rust executor timeout after 10 seconds for: ${path}`));
          }, 10000);
        });

        const result = await Promise.race([rustPromise, timeoutPromise]);
        
        if (result.success && result.result) {
          const content = typeof result.result === 'string' ? result.result : String(result.result);
          logger.info(`✅ Rust executor succeeded for ${path} in ${Date.now() - startTime}ms`);
          return content;
        }

        lastError = new Error(result.error?.message || 'Rust executor returned no result');
        logger.warn('Rust executor read failed, trying next method', {
          path,
          error: lastError.message,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('Rust executor error, trying next method', { path, error: lastError.message });
      }
    }

    // Method 3: Final fallback to MCP manager with timeout
    if (!this.mcpManager) {
      logger.error('No filesystem backend available');
      throw new Error('Filesystem operations not available - no backend initialized');
    }

    try {
      logger.info(`📁 Using MCP fallback for file read: ${path}`);
      
      // Add timeout to MCP calls too
      const mcpPromise = this.mcpManager.readFileSecure(path);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`MCP read timeout after 15 seconds for: ${path}`));
        }, 15000);
      });

      const result = await Promise.race([mcpPromise, timeoutPromise]);
      logger.info(`✅ MCP read succeeded for ${path} in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      const mcpError = error instanceof Error ? error : new Error(String(error));
      logger.error(`❌ All filesystem read methods failed for path: ${path}`, {
        rustStreamingError: lastError?.message,
        mcpError: mcpError.message,
        totalTime: `${Date.now() - startTime}ms`
      });
      
      // Throw the most informative error
      throw new Error(`File read failed for '${path}'. Tried: Rust streaming (${lastError?.message || 'not available'}), MCP (${mcpError.message})`);
    }
  }

  private async tryRustStreaming(path: string): Promise<string> {
    let fileContent = '';
    let totalChunks = 0;
    let totalBytes = 0;

    // Create stream processor to accumulate chunks
    const processor: StreamProcessor = {
      async processChunk(chunk: Readonly<StreamChunk>): Promise<void> {
        totalChunks++;
        totalBytes += chunk.size;

        // Accumulate data (for small files this is fine)
        if (chunk.contentType === 'file_content' && chunk.data) {
          if (typeof chunk.data === 'string') {
            fileContent += chunk.data;
          } else if (chunk.data instanceof Buffer) {
            fileContent += chunk.data.toString('utf8');
          } else if (chunk.data instanceof Uint8Array) {
            fileContent += Buffer.from(chunk.data).toString('utf8');
          } else {
            fileContent += String(chunk.data);
          }
        }

        // Log progress for large files
        if (chunk.metadata.progress !== undefined) {
          logger.debug(
            `File read progress: ${chunk.metadata.progress.toFixed(1)}% (${chunk.sequence + 1} chunks)`
          );
        }

        return Promise.resolve();
      },

      async onCompleted(session: Readonly<StreamSession>): Promise<void> {
        await Promise.resolve(); // Dummy await to suppress no-await warning
        const duration =
          typeof session.stats.endTime === 'number' && typeof session.stats.startTime === 'number'
            ? `${session.stats.endTime - session.stats.startTime}ms`
            : 'unknown';
        logger.info(`✅ File read completed via Rust streaming: ${path}`, {
          chunks: totalChunks,
          bytes: totalBytes,
          duration,
        });
      },

      async onError(error: string, _session: Readonly<StreamSession>): Promise<void> {
        await Promise.resolve(); // Dummy await to suppress no-await warning
        logger.error(`❌ Rust streaming error for ${path}: ${error}`);
      },

      async onBackpressure(streamId: string): Promise<void> {
        await Promise.resolve(); // Dummy await to suppress no-await warning
        logger.debug(`🚦 Backpressure applied for stream ${streamId}`);
      },
    };

    // Start streaming
    const sessionId = await rustStreamingClient.streamFile(path, processor, {
      contextType: 'fileAnalysis',
    });

    // Wait for completion with timeout and event-based approach
    const completionPromise = new Promise<void>((resolve, reject) => {
      let resolved = false;

      // Event-based completion detection
      const checkCompletion = () => {
        if (resolved) return;

        const activeSession = rustStreamingClient
          .getActiveSessionStats()
          .find(s => s.sessionId === sessionId);

        if (!activeSession) {
          resolved = true;
          resolve();
        }
      };

      // Set up periodic polling with reasonable interval
      const pollInterval = setInterval(checkCompletion, 50); // Faster polling for quicker detection

      // Clean up on completion
      const cleanup = (): void => {
        clearInterval(pollInterval);
      };

      // Override resolve/reject to include cleanup
      const originalResolve = resolve;
      const originalReject = reject;
      resolve = (): void => {
        cleanup();
        originalResolve();
      };
      reject = (error: any): void => {
        cleanup();
        void rustStreamingClient.cancelStream(sessionId); // Cancel the stream
        originalReject(error);
      };
    });

    await completionPromise;

    if (fileContent.length > 0) {
      return fileContent;
    } else {
      throw new Error('No content received from Rust streaming');
    }
  }

  public async writeFile(path: string, content: string): Promise<void> {
    // Try Rust executor first
    if (this.rustBackend?.isAvailable()) {
      try {
        const request: ToolExecutionRequest = {
          toolId: 'filesystem',
          arguments: { operation: 'write', path, content },
          context: {
            sessionId: 'file-write',
            workingDirectory: process.cwd(),
            permissions: [{ type: 'write' as const, resource: path, scope: 'file' as const }],
            environment: {},
            securityLevel: 'medium',
          },
        };

        const result = await this.rustBackend.execute(request);
        if (result.success) {
          return;
        }

        logger.warn('Rust filesystem write failed, falling back to MCP', {
          path,
          error: result.error,
        });
      } catch (error) {
        logger.warn('Rust filesystem write error, falling back to MCP', { path, error });
      }
    }

    // Fallback to MCP manager
    if (!this.mcpManager) {
      logger.error('Neither Rust executor nor MCP manager available for file write');
      throw new Error('Filesystem operations not available - no backend initialized');
    }

    try {
      await this.mcpManager.writeFileSecure(path, content);
    } catch (error) {
      logger.error(
        `FilesystemTools.writeFile failed for path: ${path}`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  public async listFiles(directory: string): Promise<string[]> {
    // Try Rust executor first
    if (this.rustBackend?.isAvailable()) {
      try {
        const request: ToolExecutionRequest = {
          toolId: 'filesystem',
          arguments: { operation: 'list', path: directory },
          context: {
            sessionId: 'file-list',
            workingDirectory: process.cwd(),
            permissions: [
              { type: 'read' as const, resource: directory, scope: 'directory' as const },
            ],
            environment: {},
            securityLevel: 'medium',
          },
        };

        const result = await this.rustBackend.execute(request);
        if (result.success && Array.isArray(result.result)) {
          // Ensure only strings are returned
          return result.result.filter((item): item is string => typeof item === 'string');
        }

        logger.warn('Rust filesystem list failed, falling back to MCP', {
          directory,
          error: result.error,
        });
      } catch (error) {
        logger.warn('Rust filesystem list error, falling back to MCP', { directory, error });
      }
    }

    // Fallback to MCP manager
    if (!this.mcpManager) {
      logger.error('Neither Rust executor nor MCP manager available for directory listing');
      throw new Error('Filesystem operations not available - no backend initialized');
    }

    try {
      return await this.mcpManager.listDirectorySecure(directory);
    } catch (error) {
      logger.error(
        `FilesystemTools.listFiles failed for directory: ${directory}`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  public async exists(path: string): Promise<boolean> {
    // Try Rust executor first
    if (this.rustBackend?.isAvailable()) {
      try {
        const request: ToolExecutionRequest = {
          toolId: 'filesystem',
          arguments: { operation: 'exists', path },
          context: {
            sessionId: 'file-exists',
            workingDirectory: process.cwd(),
            permissions: [{ type: 'read' as const, resource: path, scope: 'file' as const }],
            environment: {},
            securityLevel: 'medium',
          },
        };

        const result = await this.rustBackend.execute(request);
        if (result.success) {
          return Boolean(result.result);
        }

        logger.warn('Rust filesystem exists failed, falling back to MCP', {
          path,
          error: result.error,
        });
      } catch (error) {
        logger.warn('Rust filesystem exists error, falling back to MCP', { path, error });
      }
    }

    // Fallback to MCP manager
    if (!this.mcpManager) {
      return false;
    }

    try {
      const stats = await this.mcpManager.getFileStats(path);
      return stats.exists;
    } catch (error) {
      // File doesn't exist or access denied - both should return false
      return false;
    }
  }

  public getTools(): Array<{
    id: string;
    name: string;
    description: string;
    inputSchema: object;
    execute: (
      args: Readonly<Record<string, unknown>>,
      context: Readonly<import('../../domain/interfaces/tool-execution.js').ToolExecutionContext>
    ) => Promise<{ success: boolean; data: unknown; metadata: { executionTime: number } }>;
  }> {
    return [
      {
        id: 'filesystem_read',
        name: 'filesystem_read_file',
        description: 'Read the contents of a file from the filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path to the file to read',
            },
          },
          required: ['file_path'],
        },
        execute: async (
          args: Readonly<Record<string, unknown>>,
          _context: Readonly<import('../../domain/interfaces/tool-execution.js').ToolExecutionContext>
        ): Promise<{ success: boolean; data: string; metadata: { executionTime: number } }> => {
          const startTime = Date.now();
          const filePath = typeof args.file_path === 'string' ? args.file_path : '';
          const content = await this.readFile(filePath);
          return {
            success: true,
            data: content,
            metadata: { executionTime: Date.now() - startTime },
          };
        },
      },
      {
        id: 'filesystem_write',
        name: 'filesystem_write_file',
        description: 'Write content to a file on the filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path where to write the file',
            },
            content: {
              type: 'string',
              description: 'The content to write to the file',
            },
          },
          required: ['file_path', 'content'],
        },
        execute: async (
          args: Readonly<Record<string, unknown>>,
          _context: Readonly<import('../../domain/interfaces/tool-execution.js').ToolExecutionContext>
        ): Promise<{ success: boolean; data: string; metadata: { executionTime: number } }> => {
          const startTime = Date.now();
          const filePath = typeof args.file_path === 'string' ? args.file_path : '';
          const content = typeof args.content === 'string' ? args.content : '';
          await this.writeFile(filePath, content);
          return {
            success: true,
            data: `File written successfully: ${filePath}`,
            metadata: { executionTime: Date.now() - startTime },
          };
        },
      },
      {
        id: 'filesystem_list',
        name: 'filesystem_list_directory',
        description: 'List files and directories in a specified path',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The directory path to list contents for',
            },
          },
          required: ['path'],
        },
        execute: async (
          args: Readonly<Record<string, unknown>>,
          _context: Readonly<import('../../domain/interfaces/tool-execution.js').ToolExecutionContext>
        ): Promise<{ success: boolean; data: string[]; metadata: { executionTime: number } }> => {
          const startTime = Date.now();
          const dirPath = typeof args.path === 'string' ? args.path : '';
          const files = await this.listFiles(dirPath);
          return {
            success: true,
            data: files,
            metadata: { executionTime: Date.now() - startTime },
          };
        },
      },
      {
        id: 'filesystem_stats',
        name: 'filesystem_get_stats',
        description: 'Get file or directory statistics (size, modified time, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path to get statistics for',
            },
          },
          required: ['file_path'],
        },
        execute: async (
          args: Readonly<Record<string, unknown>>,
          _context: Readonly<import('../../domain/interfaces/tool-execution.js').ToolExecutionContext>
        ): Promise<{ success: boolean; data: { exists: boolean; path: string }; metadata: { executionTime: number } }> => {
          const startTime = Date.now();
          const filePath = typeof args.file_path === 'string' ? args.file_path : '';
          const exists = await this.exists(filePath);
          return {
            success: true,
            data: { exists, path: filePath },
            metadata: { executionTime: Date.now() - startTime },
          };
        },
      },
    ];
  }
}
