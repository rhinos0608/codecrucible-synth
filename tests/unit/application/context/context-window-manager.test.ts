import {
  ContextWindowManager,
  FileAnalysisResult,
} from '../../../src/application/context/context-window-manager.js';

describe('ContextWindowManager semantic chunking', () => {
  it('groups files using dependency graph', () => {
    const manager = new ContextWindowManager({ maxContextTokens: 1000, tokenBuffer: 0 });
    const files: FileAnalysisResult[] = [
      { path: '/a.ts', priority: 1, tokens: 10, complexity: 'low', dependencies: ['./b'] },
      { path: '/b.ts', priority: 1, tokens: 10, complexity: 'low', dependencies: ['./c'] },
      { path: '/c.ts', priority: 1, tokens: 10, complexity: 'low', dependencies: [] },
      { path: '/d.ts', priority: 1, tokens: 10, complexity: 'low', dependencies: [] },
    ];
    const chunks = (manager as any).createSemanticChunks(files, 1000);
    expect(chunks).toHaveLength(2);
    const firstChunk = chunks[0].files.map((f: FileAnalysisResult) => f.path).sort();
    expect(firstChunk).toEqual(['/a.ts', '/b.ts', '/c.ts'].sort());
    const secondChunk = chunks[1].files.map((f: FileAnalysisResult) => f.path);
    expect(secondChunk).toEqual(['/d.ts']);
  });
});
