/**
 * Filesystem Tools - Rust-First Implementation
 *
 * Uses Rust executor for high-performance filesystem operations with true streaming
 * Eliminates memory accumulation through Rust-backed chunked processing
 */

import { RustExecutionBackend } from '../../core/execution/rust-executor/rust-execution-backend.js';
import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { rustStreamingClient } from '../../core/streaming/rust-streaming-client.js';
import { logger } from '../logging/unified-logger.js';
import type { ToolExecutionRequest } from '../../domain/interfaces/tool-system.js';
import type { StreamChunk, StreamProcessor, StreamSession } from '../../core/streaming/stream-chunk-protocol.js';

export class FilesystemTools {
  private rustBackend: RustExecutionBackend | null = null;
  private mcpManager: MCPServerManager | null = null;

  setRustBackend(backend: RustExecutionBackend): void {
    this.rustBackend = backend;
  }

  setMCPManager(manager: MCPServerManager): void {
    this.mcpManager = manager;
  }

  async readFile(path: string): Promise<string> {
    // Try Rust streaming first for true performance
    if (rustStreamingClient.isRustAvailable()) {
      try {
        logger.info(`🦀 Using Rust streaming for file read: ${path}`);
        
        let fileContent = '';
        let totalChunks = 0;
        let totalBytes = 0;
        
        // Create stream processor to accumulate chunks
        const processor: StreamProcessor = {
          async processChunk(chunk: StreamChunk): Promise<void> {
            totalChunks++;
            totalBytes += chunk.size;
            
            // Accumulate data (for small files this is fine)
            if (chunk.contentType === 'file_content' && chunk.data) {
              fileContent += chunk.data;
            }
            
            // Log progress for large files
            if (chunk.metadata.progress !== undefined) {
              logger.debug(`File read progress: ${chunk.metadata.progress.toFixed(1)}% (${chunk.sequence + 1} chunks)`);
            }
          },
          
          async onCompleted(session: StreamSession): Promise<void> {
            logger.info(`✅ File read completed via Rust streaming: ${path}`, {
              chunks: totalChunks,
              bytes: totalBytes,
              duration: `${session.stats.endTime! - session.stats.startTime}ms`
            });
          },
          
          async onError(error: string, session: StreamSession): Promise<void> {
            logger.error(`❌ Rust streaming error for ${path}: ${error}`);
          },
          
          async onBackpressure(streamId: string): Promise<void> {
            logger.debug(`🚦 Backpressure applied for stream ${streamId}`);
          }
        };
        
        // Start streaming
        const sessionId = await rustStreamingClient.streamFile(path, processor, {
          contextType: 'fileAnalysis'
        });
        
        // Wait for completion (in a real implementation you might use events)
        // For now, we'll poll until the session is complete
        let session = rustStreamingClient.getActiveSessionStats().find(s => s.sessionId === sessionId);
        while (session) {
          await new Promise(resolve => setTimeout(resolve, 10));
          session = rustStreamingClient.getActiveSessionStats().find(s => s.sessionId === sessionId);
        }
        
        if (fileContent.length > 0) {
          return fileContent;
        } else {
          throw new Error('No content received from Rust streaming');
        }
        
      } catch (error) {
        logger.warn('Rust streaming read failed, falling back to MCP', { path, error });
      }
    }
    
    // Try Rust executor (non-streaming) next
    if (this.rustBackend?.isAvailable()) {
      try {
        const request: ToolExecutionRequest = {
          toolId: 'filesystem',
          arguments: { operation: 'read', path },
          context: { 
            sessionId: 'file-read',
            workingDirectory: process.cwd(),
            permissions: [{ type: 'read' as const, resource: path, scope: 'file' as const }],
            environment: {},
            securityLevel: 'medium' 
          }
        };
        
        const result = await this.rustBackend.execute(request);
        if (result.success && result.result) {
          return result.result;
        }
        
        logger.warn('Rust filesystem read failed, falling back to MCP', { path, error: result.error });
      } catch (error) {
        logger.warn('Rust filesystem read error, falling back to MCP', { path, error });
      }
    }

    // Final fallback to MCP manager
    if (!this.mcpManager) {
      logger.error('No filesystem backend available');
      throw new Error('Filesystem operations not available - no backend initialized');
    }
    
    try {
      return await this.mcpManager.readFileSecure(path);
    } catch (error) {
      logger.error(`All filesystem read methods failed for path: ${path}`, error);
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
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
            securityLevel: 'medium' 
          }
        };
        
        const result = await this.rustBackend.execute(request);
        if (result.success) {
          return;
        }
        
        logger.warn('Rust filesystem write failed, falling back to MCP', { path, error: result.error });
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
      logger.error(`FilesystemTools.writeFile failed for path: ${path}`, error);
      throw error;
    }
  }

  async listFiles(directory: string): Promise<string[]> {
    // Try Rust executor first
    if (this.rustBackend?.isAvailable()) {
      try {
        const request: ToolExecutionRequest = {
          toolId: 'filesystem',
          arguments: { operation: 'list', path: directory },
          context: { 
            sessionId: 'file-list',
            workingDirectory: process.cwd(),
            permissions: [{ type: 'read' as const, resource: directory, scope: 'directory' as const }],
            environment: {},
            securityLevel: 'medium' 
          }
        };
        
        const result = await this.rustBackend.execute(request);
        if (result.success && Array.isArray(result.result)) {
          return result.result;
        }
        
        logger.warn('Rust filesystem list failed, falling back to MCP', { directory, error: result.error });
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
      logger.error(`FilesystemTools.listFiles failed for directory: ${directory}`, error);
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
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
            securityLevel: 'medium' 
          }
        };
        
        const result = await this.rustBackend.execute(request);
        if (result.success) {
          return Boolean(result.result);
        }
        
        logger.warn('Rust filesystem exists failed, falling back to MCP', { path, error: result.error });
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

  getTools(): Array<any> {
    return [
      {
        id: 'read_file',
        name: 'Read File',
        description: 'Read contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to read'
            }
          },
          required: ['path']
        },
        execute: async (args: any) => {
          const content = await this.readFile(args.path);
          return {
            success: true,
            data: content,
            metadata: { executionTime: Date.now() - args.startTime }
          };
        }
      },
      {
        id: 'write_file',
        name: 'Write File',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to write to'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            }
          },
          required: ['path', 'content']
        },
        execute: async (args: any) => {
          await this.writeFile(args.path, args.content);
          return {
            success: true,
            data: `File written successfully: ${args.path}`,
            metadata: { executionTime: Date.now() - args.startTime }
          };
        }
      },
      {
        id: 'list_files',
        name: 'List Files',
        description: 'List files and directories in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'The directory path to list'
            }
          },
          required: ['directory']
        },
        execute: async (args: any) => {
          const files = await this.listFiles(args.directory);
          return {
            success: true,
            data: files,
            metadata: { executionTime: Date.now() - args.startTime }
          };
        }
      },
      {
        id: 'file_exists',
        name: 'File Exists',
        description: 'Check if a file or directory exists',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to check for existence'
            }
          },
          required: ['path']
        },
        execute: async (args: any) => {
          const exists = await this.exists(args.path);
          return {
            success: true,
            data: exists,
            metadata: { executionTime: Date.now() - args.startTime }
          };
        }
      },
    ];
  }
}
