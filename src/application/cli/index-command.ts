import { Command } from 'commander';
import RepoIndexer from '../../infrastructure/indexing/repo-indexer.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ProjectPaths } from '../../utils/project-paths.js';
import { runIndexQueryTUI, runIndexUpdateTUI } from './index-tui.js';

export function attachIndexCommands(program: Command): void {
  const index = program.command('index').description('Vector index for the repo');

  index
    .command('update')
    .description('Index new/changed files (incremental)')
    .option('--full', 'Force full index scan', false)
    .action(async (opts: Readonly<{ full?: boolean }>) => {
      const idx = new RepoIndexer();
      if (opts.full) {
        // Clear manifest to force full reindex
        const path = ProjectPaths.resolveFromRoot('.crucible/index/manifest.json');
        try { await fs.unlink(path); } catch {}
      }
      const result = await idx.indexChanged();
      logger.info('Index update complete', result);
      console.log(`Indexed ${result.indexed} chunks, deleted ${result.deleted}. head=${result.head}`);
    });

  index
    .command('status')
    .description('Show index stats')
    .action(async () => {
      const idx = new RepoIndexer();
      const s = await idx.stats();
      console.log(JSON.stringify(s, null, 2));
    });

  index
    .command('query <text>')
    .description('Search the vector index with semantic similarity')
    .option('-k, --topk <n>', 'Top K results', (v: string) => parseInt(v, 10), 8)
    .action(async (text: string, opts: Readonly<{ topk?: number }>) => {
      const idx = new RepoIndexer();
      const res = await idx.query(text, opts.topk ?? 8);
      console.log(JSON.stringify(res, null, 2));
    });

  // Ink TUI helpers
  index
    .command('ui')
    .description('Interactive TUI for index operations')
    .option('-q, --query <text>', 'Run a semantic search query')
    .option('-k, --topk <n>', 'Top K results for query', (v: string) => parseInt(v, 10), 8)
    .action(async (opts: Readonly<{ query?: string; topk?: number }>) => {
      if (opts.query && opts.query.length > 0) {
        await runIndexQueryTUI(opts.query, opts.topk ?? 8);
      } else {
        await runIndexUpdateTUI();
      }
    });

  index
    .command('install-hooks')
    .description('Install git hooks to auto-update index on changes')
    .action(async () => {
      const root = ProjectPaths.resolveProjectRoot();
      const hooksDir = join(root, '.git', 'hooks');
      await fs.mkdir(hooksDir, { recursive: true });
      const hookContent = `#!/bin/sh\n# Auto-update vector index on repo changes\ncommand -v crucible >/dev/null 2>&1 || exit 0\ncrucible index update >/dev/null 2>&1 || true\n`;
      // Write common hooks
      for (const name of ['post-merge', 'post-checkout', 'post-commit']) {
        const file = join(hooksDir, name);
        await fs.writeFile(file, hookContent, { encoding: 'utf-8' });
        try { await fs.chmod(file, 0o755); } catch {}
      }
      console.log('Git hooks installed to auto-update index on repo changes.');
    });
}

export default attachIndexCommands;
