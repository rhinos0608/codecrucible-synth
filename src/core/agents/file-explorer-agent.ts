/**
 * File Explorer Agent - Handles file system operations and project exploration
 * Integrates with the existing UnifiedAgent system and MCP tools
 */

import { UnifiedAgent } from '../agent.js';
import { ExecutionRequest, ExecutionResponse } from '../types.js';
import { UnifiedModelClient } from '../../refactor/unified-model-client.js';
import { PerformanceMonitor } from '../../utils/performance.js';
import { logger } from '../logger.js';
import { promises as fs } from 'fs';
import { join, relative } from 'path';

export class FileExplorerAgent extends UnifiedAgent {
  constructor(modelClient: UnifiedModelClient, performanceMonitor: PerformanceMonitor) {
    super(modelClient, performanceMonitor);
  }

  async processRequest(input: string): Promise<ExecutionResponse> {
    logger.info('📁 File Explorer Agent processing request');

    // Check if this is a file system operation request
    if (this.isFileSystemRequest(input)) {
      return await this.handleFileSystemOperation(input);
    }

    // For general file-related analysis, use the UnifiedAgent with file-specific context
    const request: ExecutionRequest = {
      id: `file-explorer-${Date.now()}`,
      input: `File System Analysis: ${input}`,
      type: 'file-analysis',
      mode: 'fast', // File operations should be fast
    };

    const response = await this.execute(request);

    // Enhance with file-specific metadata
    if (response.success && response.result) {
      const enhancedResult = await this.enhanceWithFileContext(
        input,
        response.result as Record<string, unknown>
      );
      return {
        ...response,
        result: enhancedResult,
      };
    }

    return response;
  }

  private isFileSystemRequest(input: string): boolean {
    const fileSystemKeywords = [
      'list files',
      'show directory',
      'file structure',
      'explore folder',
      'find file',
      'search files',
      'directory tree',
      'project structure',
    ];
    return fileSystemKeywords.some(keyword => input.toLowerCase().includes(keyword));
  }

  private async handleFileSystemOperation(input: string): Promise<ExecutionResponse> {
    try {
      const workingDir = process.cwd();

      if (
        input.toLowerCase().includes('project structure') ||
        input.toLowerCase().includes('directory tree')
      ) {
        const structure = await this.getProjectStructureInternal(workingDir);
        return {
          success: true,
          result: {
            content: structure,
            operation: 'project-structure',
            directory: workingDir,
          },
          workflowId: `file-op-${Date.now()}`,
          executionTime: 0,
        };
      }

      if (input.toLowerCase().includes('list files')) {
        const files = await this.listFiles(workingDir);
        return {
          success: true,
          result: {
            content: `Files in ${workingDir}:\n${files.join('\n')}`,
            operation: 'list-files',
            files,
            directory: workingDir,
          },
          workflowId: `file-op-${Date.now()}`,
          executionTime: 0,
        };
      }

      // Default: provide file system status
      const stats = await this.getDirectoryStats(workingDir);
      return {
        success: true,
        result: {
          content: `Directory analysis for ${workingDir}:\n${JSON.stringify(stats, null, 2)}`,
          operation: 'directory-stats',
          stats,
          directory: workingDir,
        },
        workflowId: `file-op-${Date.now()}`,
        executionTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        result: {},
        error: `File system operation failed: ${error instanceof Error ? error.message : String(error)}`,
        workflowId: `file-op-${Date.now()}`,
        executionTime: 0,
      };
    }
  }

  private async getProjectStructureInternal(rootPath: string): Promise<string> {
    const structure: string[] = [];
    const maxDepth = 3;
    const ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.vscode'];

    const walkDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
      if (depth > maxDepth) return;

      try {
        const items = await fs.readdir(dirPath);

        for (const item of items) {
          if (ignorePatterns.some(pattern => item.includes(pattern))) continue;

          const itemPath = join(dirPath, item);
          const stats = await fs.stat(itemPath);
          const relativePath = relative(rootPath, itemPath);

          if (stats.isDirectory()) {
            structure.push(`${'  '.repeat(depth)}📁 ${relativePath}/`);
            await walkDirectory(itemPath, depth + 1);
          } else if (stats.isFile()) {
            const ext = item.split('.').pop()?.toLowerCase();
            const icon = this.getFileIcon(ext);
            structure.push(`${'  '.repeat(depth)}${icon} ${relativePath}`);
          }
        }
      } catch (error) {
        structure.push(`${'  '.repeat(depth)}❌ Error reading ${relative(rootPath, dirPath)}`);
      }
    };

    await walkDirectory(rootPath);
    return `Project Structure:\n${structure.slice(0, 100).join('\n')}${structure.length > 100 ? '\n... (truncated)' : ''}`;
  }

  private async listFiles(dirPath: string): Promise<string[]> {
    try {
      const items = await fs.readdir(dirPath);
      const files: string[] = [];

      for (const item of items) {
        const stats = await fs.stat(join(dirPath, item));
        if (stats.isFile()) {
          files.push(item);
        } else if (stats.isDirectory()) {
          files.push(`${item}/`);
        }
      }

      return files;
    } catch (error) {
      return [`Error reading directory: ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  private async getDirectoryStats(dirPath: string): Promise<Record<string, unknown>> {
    try {
      const items = await fs.readdir(dirPath);
      let fileCount = 0;
      let dirCount = 0;
      const fileTypes: Record<string, number> = {};

      for (const item of items) {
        const stats = await fs.stat(join(dirPath, item));
        if (stats.isFile()) {
          fileCount++;
          const ext = item.split('.').pop()?.toLowerCase() || 'no-extension';
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        } else if (stats.isDirectory()) {
          dirCount++;
        }
      }

      return {
        totalFiles: fileCount,
        totalDirectories: dirCount,
        fileTypeBreakdown: fileTypes,
        path: dirPath,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        path: dirPath,
      };
    }
  }

  private getFileIcon(ext?: string): string {
    const iconMap: Record<string, string> = {
      js: '📄',
      ts: '📄',
      tsx: '📄',
      jsx: '📄',
      json: '⚙️',
      md: '📝',
      css: '🎨',
      html: '🌐',
      py: '🐍',
      java: '☕',
      cpp: '⚡',
      c: '⚡',
      rs: '🦀',
    };
    return iconMap[ext || ''] || '📄';
  }

  private async enhanceWithFileContext(
    input: string,
    result: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return {
      ...result,
      fileSystemContext: {
        workingDirectory: process.cwd(),
        requestType: 'file-exploration',
        capabilities: [
          'Project structure analysis',
          'File listing and navigation',
          'Directory statistics',
          'File type analysis',
        ],
      },
      metadata: {
        ...((result.metadata as Record<string, unknown>) || {}),
        agentType: 'file-explorer',
        enhanced: true,
      },
    };
  }
}
