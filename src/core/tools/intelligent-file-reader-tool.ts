import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { logger } from '../logger.js';
import { readFile, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

export interface IntelligentFileReaderInput {
  files: string[]; // Array of file paths to read
  maxFileSize?: number; // Max size per file in bytes
  includeMetadata?: boolean; // Include file metadata
  extractDefinitions?: boolean; // Extract code definitions
  maxFiles?: number; // Limit number of files to read
}

export interface FileReadResult {
  path: string;
  content: string;
  metadata?: {
    size: number;
    language: string;
    purpose: string;
    complexity: number;
  };
  definitions?: CodeDefinition[];
  parsed?: any;
  error?: string;
}

interface CodeDefinition {
  name: string;
  type: 'class' | 'function' | 'interface' | 'type' | 'constant';
  line: number;
  signature: string;
  isExported: boolean;
}

/**
 * Intelligent File Reader Tool - Reads multiple files with smart analysis
 *
 * Similar to how Claude Code and other agents read files selectively,
 * this tool reads multiple files and provides rich analysis of their content
 */
export class IntelligentFileReaderTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      files: z.array(z.string()).describe('Array of file paths to read'),
      maxFileSize: z
        .number()
        .optional()
        .default(200000)
        .describe('Max size per file in bytes (default: 200KB)'),
      includeMetadata: z.boolean().optional().default(true).describe('Include file metadata'),
      extractDefinitions: z.boolean().optional().default(true).describe('Extract code definitions'),
      maxFiles: z.number().optional().default(20).describe('Limit number of files to read'),
    });

    super({
      name: 'readFiles',
      description:
        'Intelligently read multiple files with automatic content analysis, definition extraction, and metadata',
      category: 'File System',
      parameters,
    });
  }

  async execute(input: z.infer<typeof this.definition.parameters>): Promise<string> {
    try {
      logger.info(`📖 IntelligentFileReaderTool: Reading ${input.files.length} files`);

      const maxFileSize = input.maxFileSize || 200000; // 200KB default
      const maxFiles = input.maxFiles || 20;
      const filesToRead = input.files.slice(0, maxFiles);
      const results: FileReadResult[] = [];

      // Read files in parallel (but limit concurrency)
      const batchSize = 5;
      for (let i = 0; i < filesToRead.length; i += batchSize) {
        const batch = filesToRead.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((filePath: string) => this.readSingleFile(filePath, maxFileSize, input))
        );
        results.push(...batchResults);
      }

      // Format results
      let output = `# 📖 Intelligent File Reading Results\n\n`;
      output += `**Read ${results.length} files** (requested: ${input.files.length})\n\n`;

      const successfulReads = results.filter(r => !r.error);
      const failedReads = results.filter(r => r.error);

      if (failedReads.length > 0) {
        output += `## ⚠️ Failed to Read (${failedReads.length})\n\n`;
        for (const failed of failedReads) {
          output += `- **${failed.path}**: ${failed.error}\n`;
        }
        output += '\n';
      }

      if (successfulReads.length === 0) {
        return output + '❌ No files were successfully read.';
      }

      // Show summary statistics
      if (input.includeMetadata) {
        const totalSize = successfulReads.reduce((sum, r) => sum + (r.metadata?.size || 0), 0);
        const languages = [
          ...new Set(successfulReads.map(r => r.metadata?.language).filter(Boolean)),
        ];
        const avgComplexity =
          successfulReads.reduce((sum, r) => sum + (r.metadata?.complexity || 0), 0) /
          successfulReads.length;

        output += `## 📊 Summary\n\n`;
        output += `- **Total Size**: ${(totalSize / 1024).toFixed(1)} KB\n`;
        output += `- **Languages**: ${languages.join(', ')}\n`;
        output += `- **Average Complexity**: ${avgComplexity.toFixed(1)}\n`;
        output += `- **Definitions Found**: ${successfulReads.reduce((sum, r) => sum + (r.definitions?.length || 0), 0)}\n\n`;
      }

      // Group files by type/language for better organization
      const filesByLanguage = successfulReads.reduce(
        (acc, result) => {
          const lang = result.metadata?.language || 'Unknown';
          if (!acc[lang]) acc[lang] = [];
          acc[lang].push(result);
          return acc;
        },
        {} as Record<string, FileReadResult[]>
      );

      // Show files by language
      for (const [language, files] of Object.entries(filesByLanguage)) {
        output += `## ${language} Files (${files.length})\n\n`;

        for (const result of files) {
          output += `### 📄 ${result.path}\n\n`;

          if (result.metadata) {
            output += `**Metadata**: ${(result.metadata.size / 1024).toFixed(1)}KB, `;
            output += `${result.metadata.purpose}, `;
            output += `Complexity: ${result.metadata.complexity}\n\n`;
          }

          // Show code definitions if extracted
          if (result.definitions && result.definitions.length > 0) {
            output += `**Code Definitions (${result.definitions.length}):**\n`;
            for (const def of result.definitions.slice(0, 10)) {
              // Show first 10
              output += `- \`${def.type}\` **${def.name}** (line ${def.line})${def.isExported ? ' 🔹' : ''}\n`;
            }
            if (result.definitions.length > 10) {
              output += `- ... and ${result.definitions.length - 10} more definitions\n`;
            }
            output += '\n';
          }

          // Show file content (truncated if large)
          let content = result.content;
          const maxContentLength = 3000; // Show first 3000 characters
          let isTruncated = false;

          if (content.length > maxContentLength) {
            content = content.substring(0, maxContentLength);
            isTruncated = true;
          }

          output += '```' + (result.metadata?.language?.toLowerCase() || '') + '\n';
          output += content;
          output += '\n```\n';

          if (isTruncated) {
            output += `\n*Content truncated (showing first ${maxContentLength} characters of ${result.content.length})*\n`;
          }

          output += '\n---\n\n';
        }
      }

      logger.info(
        `✅ IntelligentFileReaderTool: Successfully read ${successfulReads.length}/${results.length} files`
      );
      return output;
    } catch (error) {
      const errorMsg = `❌ IntelligentFileReaderTool failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg, error);
      return errorMsg;
    }
  }

  private async readSingleFile(
    filePath: string,
    maxFileSize: number,
    options: z.infer<typeof this.definition.parameters>
  ): Promise<FileReadResult> {
    try {
      const fullPath = join(this.agentContext.workingDirectory, filePath);

      // Check file size first
      const stats = await stat(fullPath);
      if (stats.size > maxFileSize) {
        return {
          path: filePath,
          content: '',
          error: `File too large: ${(stats.size / 1024).toFixed(1)}KB (max: ${(maxFileSize / 1024).toFixed(1)}KB)`,
        };
      }

      // Read file content
      const content = await readFile(fullPath, 'utf-8');
      const result: FileReadResult = { path: filePath, content };

      // Add metadata if requested
      if (options.includeMetadata) {
        result.metadata = {
          size: stats.size,
          language: this.detectLanguage(extname(filePath)),
          purpose: this.inferFilePurpose(filePath),
          complexity: this.calculateComplexity(content, this.detectLanguage(extname(filePath))),
        };
      }

      // Extract definitions if requested
      if (options.extractDefinitions) {
        const language = this.detectLanguage(extname(filePath));
        if (['JavaScript', 'TypeScript', 'JSX', 'TSX'].includes(language)) {
          result.definitions = this.extractCodeDefinitions(content);
        }
      }

      // Parse common file types
      const fileName = basename(filePath).toLowerCase();
      if (fileName === 'package.json') {
        result.parsed = JSON.parse(content);
      } else if (fileName === 'tsconfig.json') {
        result.parsed = JSON.parse(content);
      } else if (fileName === 'jest.config.cjs') {
        // For CJS, we can't just parse it. We can try to extract some info.
        const jestConfig: any = {};
        const transformMatch = content.match(/transform: ({[^}]*})/);
        if (transformMatch) {
          try {
            eval(`jestConfig.transform = ${transformMatch[1]}`);
          } catch (e) {
            // ignore
          }
        }
        result.parsed = jestConfig;
      }

      return result;
    } catch (error) {
      return {
        path: filePath,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private detectLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'JSX',
      '.tsx': 'TSX',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.md': 'Markdown',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.xml': 'XML',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
    };
    return langMap[ext.toLowerCase()] || 'Unknown';
  }

  private inferFilePurpose(filePath: string): string {
    const fileName = basename(filePath).toLowerCase();
    const dirPath = filePath.toLowerCase();

    if (fileName === 'index.js' || fileName === 'index.ts') return 'Entry Point';
    if (fileName === 'main.js' || fileName === 'main.ts') return 'Main Module';
    if (fileName === 'app.js' || fileName === 'app.ts') return 'Application Core';
    if (fileName.includes('config')) return 'Configuration';
    if (fileName.includes('test') || fileName.includes('spec')) return 'Test File';
    if (fileName.includes('util') || fileName.includes('helper')) return 'Utility';
    if (dirPath.includes('component')) return 'UI Component';
    if (dirPath.includes('service')) return 'Business Service';
    if (dirPath.includes('model')) return 'Data Model';
    if (dirPath.includes('controller')) return 'Controller';
    if (dirPath.includes('route') || dirPath.includes('api')) return 'API Route';
    if (fileName === 'readme.md') return 'Documentation';
    if (fileName === 'package.json') return 'Package Configuration';

    return 'Source Code';
  }

  private calculateComplexity(content: string, language: string): number {
    const lines = content.split('\n');
    let complexity = 0;

    // Language-specific complexity
    const complexityPatterns: Record<string, RegExp> = {
      JavaScript: /\b(if|for|while|switch|catch|try|&&|\|\|)|\?.*:/g,
      TypeScript: /\b(if|for|while|switch|catch|try|&&|\|\|)|\?.*:/g,
      Python: /\b(if|for|while|try|except|and|or)\b/g,
      Java: /\b(if|for|while|switch|catch|try|&&|\|\|)|\?.*:/g,
    };

    const pattern = complexityPatterns[language];
    if (pattern) {
      for (const line of lines) {
        const matches = line.match(pattern);
        if (matches) {
          complexity += matches.length;
        }
      }
    } else {
      // Generic complexity for other languages
      for (const line of lines) {
        const trimmed = line.trim();
        // Count complexity indicators
        if (trimmed.match(/\b(if|for|while|switch|catch|try)\b/)) complexity++;
        if (trimmed.includes('&&') || trimmed.includes('||')) complexity++;
        if (trimmed.includes('?') && trimmed.includes(':')) complexity++; // ternary
      }
    }

    // Nesting depth
    let nesting = 0;
    for (const line of lines) {
      if (line.includes('{') || line.includes('(')) {
        nesting++;
      }
      if (line.includes('}') || line.includes(')')) {
        nesting--;
      }
      complexity += nesting > 2 ? 1 : 0;
    }

    return Math.max(1, Math.round((complexity / Math.max(lines.length, 1)) * 100));
  }

  private extractCodeDefinitions(content: string): CodeDefinition[] {
    const definitions: CodeDefinition[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Simple regex-based extraction
      const patterns = [
        { regex: /^export\s+class\s+(\w+)/, type: 'class' as const },
        { regex: /^class\s+(\w+)/, type: 'class' as const },
        { regex: /^export\s+function\s+(\w+)/, type: 'function' as const },
        { regex: /^function\s+(\w+)/, type: 'function' as const },
        { regex: /^export\s+interface\s+(\w+)/, type: 'interface' as const },
        { regex: /^interface\s+(\w+)/, type: 'interface' as const },
        { regex: /^export\s+type\s+(\w+)/, type: 'type' as const },
        { regex: /^const\s+(\w+)\s*=\s*\(.*\)\s*=>/, type: 'function' as const },
        { regex: /^export\s+const\s+(\w+)/, type: 'constant' as const },
      ];

      for (const { regex, type } of patterns) {
        const match = line.match(regex);
        if (match) {
          definitions.push({
            name: match[1],
            type,
            line: i + 1,
            signature: line,
            isExported: line.includes('export'),
          });
        }
      }
    }

    return definitions;
  }
}
