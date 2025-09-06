import { promisify } from 'util';
import { execFile } from 'child_process';
import type { RAGQuery, RAGResult, Document } from './types.js';

const execFileAsync = promisify(execFile);

export class CommandLineSearchEngine {
  constructor(private workspace: string) {}

  async search(query: RAGQuery): Promise<RAGResult> {
    const flags = ['-n', '--json'];
    if (!query.useRegex) {
      flags.push('-F');
    }
    try {
      const { stdout } = await execFileAsync('rg', [...flags, query.query], {
        cwd: this.workspace,
        maxBuffer: 1024 * 1024,
      });
      const documents: Document[] = stdout
        .split('\n')
        .filter(Boolean)
        .map(line => {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'match') {
              return {
                filePath: parsed.data.path.text as string,
                content: parsed.data.lines.text as string,
              } as Document;
            }
          } catch {
            return null;
          }
          return null;
        })
        .filter((doc): doc is Document => doc !== null);
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
