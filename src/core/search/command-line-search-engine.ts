import { promisify } from 'util';
import { exec } from 'child_process';
import type { RAGQuery, RAGResult, Document } from './types.js';

const execAsync = promisify(exec);

export class CommandLineSearchEngine {
  constructor(private workspace: string) {}

  async search(query: RAGQuery): Promise<RAGResult> {
    const flags = ['-n'];
    if (!query.useRegex) {
      flags.push('-F');
    }
    const cmd = `rg ${flags.join(' ')} "${query.query}"`;
    try {
      const { stdout } = await execAsync(cmd, {
        cwd: this.workspace,
        maxBuffer: 1024 * 1024,
      });
      const documents: Document[] = stdout
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [filePath, , ...contentParts] = line.split(':');
          return { filePath, content: contentParts.join(':') };
        });
      return {
        documents,
        metadata: {
          searchMethod: 'ripgrep',
          confidence: documents.length > 0 ? 1 : 0,
        },
      };
    } catch {
      return { documents: [], metadata: { searchMethod: 'ripgrep', confidence: 0 } };
    }
  }
}
