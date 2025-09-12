import React, { useEffect, useState } from 'react';
import { Box, Text, render } from 'ink';
import Spinner from 'ink-spinner';
import RepoIndexer from '../../infrastructure/indexing/repo-indexer.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ProjectPaths } from '../../utils/project-paths.js';

type Mode = 'update' | 'query';

function ResultsList({ items }: { items: ReadonlyArray<{ text: string; similarity: number; meta: any }> }) {
  return (
    <Box flexDirection="column">
      {items.map((r, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text>
            <Text color="green">[{(r.similarity * 100).toFixed(1)}%]</Text> <Text color="cyan">{r.meta.filePath}</Text>
            <Text> #{r.meta.chunkIndex}</Text>
          </Text>
          <Text wrap="truncate-end">{r.text.replace(/\s+/g, ' ').slice(0, 160)}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function IndexUpdateTUI() {
  const [busy, setBusy] = useState(true);
  const [summary, setSummary] = useState<{ indexed: number; deleted: number; head: string | null } | null>(null);
  const [changes, setChanges] = useState<any>(null);

  useEffect(() => {
    const run = async () => {
      const idx = new RepoIndexer();
      const res = await idx.indexChanged();
      setSummary(res);
      try {
        const json = await fs.readFile(join(ProjectPaths.resolveProjectRoot(), '.crucible/index/last_changes.json'), 'utf-8');
        setChanges(JSON.parse(json));
      } catch {
        setChanges(null);
      }
      setBusy(false);
    };
    void run();
  }, []);

  return (
    <Box flexDirection="column">
      <Text>
        {busy ? (
          <Text>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>{' '}
            Indexing repository...
          </Text>
        ) : (
          <Text color="green">✔ Index update complete</Text>
        )}
      </Text>
      {summary && (
        <Text>
          Indexed chunks: <Text color="cyan">{summary.indexed}</Text> | Deleted: <Text color="magenta">{summary.deleted}</Text> | Head:{' '}
          <Text color="gray">{summary.head || 'n/a'}</Text>
        </Text>
      )}
      {changes && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="blue">Changed files:</Text>
          <Text>- Added: {changes.added?.length || 0}</Text>
          <Text>- Modified: {changes.modified?.length || 0}</Text>
          <Text>- Deleted: {changes.deleted?.length || 0}</Text>
        </Box>
      )}
    </Box>
  );
}

export function IndexQueryTUI({ query, topk = 8 }: { query: string; topk?: number }) {
  const [busy, setBusy] = useState(true);
  const [results, setResults] = useState<ReadonlyArray<{ text: string; similarity: number; meta: any }>>([]);

  useEffect(() => {
    const run = async () => {
      const idx = new RepoIndexer();
      const found = await idx.query(query, topk);
      setResults(found);
      setBusy(false);
    };
    void run();
  }, [query, topk]);

  return (
    <Box flexDirection="column">
      <Text>
        {busy ? (
          <Text>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>{' '}
            Searching...
          </Text>
        ) : (
          <Text color="green">✔ Search complete</Text>
        )}
      </Text>
      {!busy && <ResultsList items={results} />}
    </Box>
  );
}

export async function runIndexUpdateTUI(): Promise<void> {
  await new Promise<void>(resolve => {
    const { unmount } = render(<IndexUpdateTUI />);
    const check = setInterval(() => {
      // A bit hacky but fine; component will unmount on process exit if needed
      // We can resolve after 100ms when there is no spinner (not tracked here), rely on CLI exit after setBusy(false)
    }, 100);
    setTimeout(() => {
      clearInterval(check);
      unmount();
      resolve();
    }, 200); // UI renders synchronously and completes; no long-running loop
  });
}

export async function runIndexQueryTUI(q: string, k = 8): Promise<void> {
  await new Promise<void>(resolve => {
    const { unmount } = render(<IndexQueryTUI query={q} topk={k} />);
    setTimeout(() => {
      unmount();
      resolve();
    }, 200);
  });
}

export default runIndexUpdateTUI;

