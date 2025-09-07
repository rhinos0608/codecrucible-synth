import { spawn } from 'child_process';
import type { RAGQuery, RAGResult, Document } from './types.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class CommandLineSearchEngine {
  constructor(private workspace: string, private timeoutMs: number = 10000) {}

  async search(query: RAGQuery): Promise<RAGResult> {
    // Input sanitization to prevent command injection
    const sanitizedQuery = this.sanitizeQuery(query.query);
    
    if (!sanitizedQuery) {
      logger.warn('Empty or invalid search query after sanitization');
      return { documents: [], metadata: { searchMethod: 'ripgrep', confidence: 0 } };
    }

    // Build command args array to avoid shell injection
    const args = ['-n', '--json']; // Use JSON output for robust parsing
    if (!query.useRegex) {
      args.push('-F');
    }
    args.push(sanitizedQuery);

    try {
      const stdout = await this.executeRipgrep(args);
      const documents = this.parseRipgrepJsonOutput(stdout);
      return {
        documents,
        metadata: {
          searchMethod: 'ripgrep',
          confidence: documents.length > 0 ? 1 : 0,
        },
      };
    } catch (error) {
      logger.warn('Ripgrep search failed:', error);
      return { documents: [], metadata: { searchMethod: 'ripgrep', confidence: 0 } };
    }
  }

  private sanitizeQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }
    
    // Remove potentially dangerous characters and sequences
    const sanitized = query
      .replace(/[;&|`$(){}[\]]/g, '') // Remove shell metacharacters
      .replace(/\.\./g, '') // Remove path traversal attempts
      .trim();
    
    // Limit length to prevent buffer overflow attempts
    return sanitized.slice(0, 1000);
  }

  private executeRipgrep(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use AbortSignal.timeout for 2025 compliance
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Search timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const child = spawn('rg', args, {
        cwd: this.workspace,
        signal: controller.signal,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0 || code === 1) { // 0 = found, 1 = not found (both valid)
          resolve(stdout);
        } else {
          reject(new Error(`ripgrep exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  private parseRipgrepJsonOutput(output: string): Document[] {
    if (!output.trim()) {
      return [];
    }

    const documents: Document[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      try {
        const match = JSON.parse(line);
        if (match.type === 'match' && match.data) {
          const { path, lines, line_number } = match.data;
          const content = lines?.text || '';
          documents.push({
            filePath: path.text,
            content: `Line ${line_number}: ${content}`,
          });
        }
      } catch (parseError) {
        // Skip malformed JSON lines
        continue;
      }
    }

    return documents;
  }
}
