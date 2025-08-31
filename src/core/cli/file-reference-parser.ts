/**
 * File Reference Parser - Industry Standard @ Syntax Support
 * 
 * Implements Qwen CLI / Gemini CLI compatible @ syntax for file references:
 * - @src/main.js - Reference specific file
 * - @src/ - Reference entire directory 
 * - @. - Reference current directory
 * - @package.json - Reference file in root
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, resolve, relative, extname } from 'path';
import { glob } from 'glob';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface FileReference {
  original: string;
  path: string;
  type: 'file' | 'directory' | 'glob';
  exists: boolean;
  content?: string;
  files?: string[];
  size?: number;
}

export interface ParsedFileReferences {
  originalPrompt: string;
  enhancedPrompt: string;
  references: FileReference[];
  totalSize: number;
  contextSummary: string;
}

/**
 * File Reference Parser with industry-standard @ syntax
 */
export class FileReferenceParser {
  private maxFileSize: number;
  private maxTotalSize: number;
  private supportedExtensions: Set<string>;
  private excludePatterns: string[];

  constructor(options: {
    maxFileSize?: number;
    maxTotalSize?: number; 
    supportedExtensions?: string[];
    excludePatterns?: string[];
  } = {}) {
    this.maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB per file
    this.maxTotalSize = options.maxTotalSize || 10 * 1024 * 1024; // 10MB total
    this.supportedExtensions = new Set(options.supportedExtensions || [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.css', '.html', '.vue', '.svelte', '.md', '.json', '.yaml', '.yml',
      '.xml', '.sql', '.sh', '.bat', '.ps1', '.dockerfile', '.env'
    ]);
    this.excludePatterns = options.excludePatterns || [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '*.bundle.js',
      '.DS_Store',
      'thumbs.db'
    ];
  }

  /**
   * Parse @ syntax file references from prompt
   */
  async parseFileReferences(prompt: string, workingDir: string = process.cwd()): Promise<ParsedFileReferences> {
    const startTime = Date.now();
    
    // Match @ references: @path/to/file, @., @src/, etc.
    const fileRefRegex = /@([^\s]+)/g;
    const matches = Array.from(prompt.matchAll(fileRefRegex));
    
    if (matches.length === 0) {
      return {
        originalPrompt: prompt,
        enhancedPrompt: prompt,
        references: [],
        totalSize: 0,
        contextSummary: 'No file references found'
      };
    }

    logger.info(`🔍 Processing ${matches.length} file references...`);

    const references: FileReference[] = [];
    let totalSize = 0;
    
    for (const match of matches) {
      const originalRef = match[0]; // Full match including @
      const pathRef = match[1]; // Path without @
      
      try {
        const fileRef = await this.processFileReference(pathRef, workingDir);
        references.push({ ...fileRef, original: originalRef });
        totalSize += fileRef.size || 0;
        
        // Check total size limit
        if (totalSize > this.maxTotalSize) {
          logger.warn(`⚠️  Total file size exceeded limit (${this.formatBytes(totalSize)}), truncating...`);
          break;
        }
      } catch (error) {
        logger.warn(`❌ Failed to process reference ${originalRef}:`, error);
        references.push({
          original: originalRef,
          path: pathRef,
          type: 'file',
          exists: false,
          content: `Error: Could not read ${pathRef} - ${(error as Error).message}`
        });
      }
    }

    const enhancedPrompt = await this.buildEnhancedPrompt(prompt, references);
    const contextSummary = this.generateContextSummary(references, totalSize);
    
    logger.info(`✅ Processed ${references.length} file references in ${Date.now() - startTime}ms`);
    
    return {
      originalPrompt: prompt,
      enhancedPrompt,
      references,
      totalSize,
      contextSummary
    };
  }

  /**
   * Process a single file reference
   */
  private async processFileReference(pathRef: string, workingDir: string): Promise<Omit<FileReference, 'original'>> {
    const resolvedPath = this.resolvePath(pathRef, workingDir);
    
    try {
      const stats = await stat(resolvedPath);
      
      if (stats.isFile()) {
        return await this.processFile(resolvedPath);
      } else if (stats.isDirectory()) {
        return await this.processDirectory(resolvedPath);
      }
    } catch (error) {
      // File doesn't exist, check if it's a glob pattern
      if (pathRef.includes('*') || pathRef.includes('?')) {
        return await this.processGlobPattern(pathRef, workingDir);
      }
    }
    
    return {
      path: resolvedPath,
      type: 'file',
      exists: false,
      content: `File not found: ${pathRef}`
    };
  }

  /**
   * Process single file
   */
  private async processFile(filePath: string): Promise<Omit<FileReference, 'original'>> {
    const stats = await stat(filePath);
    
    if (stats.size > this.maxFileSize) {
      return {
        path: filePath,
        type: 'file',
        exists: true,
        size: stats.size,
        content: `File too large (${this.formatBytes(stats.size)}), showing first 1000 characters:\n\n${(await readFile(filePath, 'utf-8')).substring(0, 1000)}...`
      };
    }
    
    const ext = extname(filePath).toLowerCase();
    if (!this.supportedExtensions.has(ext)) {
      return {
        path: filePath,
        type: 'file',
        exists: true,
        size: stats.size,
        content: `Binary or unsupported file type: ${ext}`
      };
    }
    
    const content = await readFile(filePath, 'utf-8');
    
    return {
      path: filePath,
      type: 'file',
      exists: true,
      size: stats.size,
      content
    };
  }

  /**
   * Process directory
   */
  private async processDirectory(dirPath: string): Promise<Omit<FileReference, 'original'>> {
    const files = await glob('**/*', {
      cwd: dirPath,
      ignore: this.excludePatterns,
      nodir: true,
      maxDepth: 3 // Limit depth for performance
    });
    
    // Filter by supported extensions
    const supportedFiles = files.filter(file => 
      this.supportedExtensions.has(extname(file).toLowerCase())
    ).slice(0, 50); // Limit number of files
    
    let totalContent = `Directory: ${dirPath}\nFiles found: ${supportedFiles.length}\n\n`;
    let totalSize = 0;
    
    for (const file of supportedFiles.slice(0, 20)) { // Show first 20 files
      const fullPath = join(dirPath, file);
      try {
        const fileRef = await this.processFile(fullPath);
        totalContent += `=== ${file} ===\n${fileRef.content}\n\n`;
        totalSize += fileRef.size || 0;
        
        if (totalSize > this.maxFileSize) {
          totalContent += `... (truncated, too much content)\n`;
          break;
        }
      } catch (error) {
        totalContent += `=== ${file} ===\nError reading file: ${(error as Error).message}\n\n`;
      }
    }
    
    return {
      path: dirPath,
      type: 'directory',
      exists: true,
      files: supportedFiles,
      size: totalSize,
      content: totalContent
    };
  }

  /**
   * Process glob pattern
   */
  private async processGlobPattern(pattern: string, workingDir: string): Promise<Omit<FileReference, 'original'>> {
    const files = await glob(pattern, {
      cwd: workingDir,
      ignore: this.excludePatterns,
      nodir: true,
      maxDepth: 5
    });
    
    const supportedFiles = files.filter(file => 
      this.supportedExtensions.has(extname(file).toLowerCase())
    ).slice(0, 30);
    
    if (supportedFiles.length === 0) {
      return {
        path: pattern,
        type: 'glob',
        exists: false,
        content: `No matching files found for pattern: ${pattern}`
      };
    }
    
    let content = `Glob pattern: ${pattern}\nMatched ${supportedFiles.length} files:\n\n`;
    let totalSize = 0;
    
    for (const file of supportedFiles) {
      const fullPath = resolve(workingDir, file);
      try {
        const fileRef = await this.processFile(fullPath);
        content += `=== ${file} ===\n${fileRef.content}\n\n`;
        totalSize += fileRef.size || 0;
        
        if (totalSize > this.maxFileSize) {
          content += `... (truncated, pattern matched more files)\n`;
          break;
        }
      } catch (error) {
        content += `=== ${file} ===\nError: ${(error as Error).message}\n\n`;
      }
    }
    
    return {
      path: pattern,
      type: 'glob',
      exists: true,
      files: supportedFiles,
      size: totalSize,
      content
    };
  }

  /**
   * Resolve path relative to working directory
   */
  private resolvePath(pathRef: string, workingDir: string): string {
    if (pathRef === '.') {
      return workingDir;
    }
    
    if (pathRef.startsWith('./') || pathRef.startsWith('../')) {
      return resolve(workingDir, pathRef);
    }
    
    // Try as relative to working directory first
    const relativePath = resolve(workingDir, pathRef);
    return relativePath;
  }

  /**
   * Build enhanced prompt with file contents
   */
  private async buildEnhancedPrompt(originalPrompt: string, references: FileReference[]): Promise<string> {
    let enhanced = originalPrompt;
    
    // Replace @ references with descriptive text
    for (const ref of references) {
      if (ref.exists && ref.content) {
        const replacement = `[File: ${ref.path}]\n${ref.content}\n[End of ${ref.path}]`;
        enhanced = enhanced.replace(ref.original, replacement);
      } else {
        enhanced = enhanced.replace(ref.original, `[File not found: ${ref.path}]`);
      }
    }
    
    return enhanced;
  }

  /**
   * Generate context summary
   */
  private generateContextSummary(references: FileReference[], totalSize: number): string {
    const successful = references.filter(r => r.exists).length;
    const failed = references.length - successful;
    
    let summary = `Processed ${references.length} file references (${successful} found, ${failed} missing)`;
    
    if (totalSize > 0) {
      summary += `, ${this.formatBytes(totalSize)} total`;
    }
    
    if (successful > 0) {
      const fileTypes = new Set(references.filter(r => r.exists).map(r => extname(r.path)));
      summary += `, file types: ${Array.from(fileTypes).join(', ')}`;
    }
    
    return summary;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }
}

// Export singleton instance
export const fileReferenceParser = new FileReferenceParser();