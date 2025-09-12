import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { ProjectPaths } from '../../utils/project-paths.js';
import type { QueryResult, VectorRecord, VectorStore } from './vector-store.js';

interface LanceSearchBuilder {
  metricType: (metric: string) => LanceSearchBuilder;
  limit: (k: number) => LanceSearchBuilder;
  execute: () => Promise<unknown[]>;
}

interface LanceTable {
  add: (rows: unknown[]) => Promise<void>;
  delete: (where: string) => Promise<void>;
  search: (vector: readonly number[]) => LanceSearchBuilder;
  count?: () => Promise<number>;
  limit: (n: number) => { toArray: () => Promise<unknown[]> };
}

interface LanceDbConnection {
  openTable: (name: string) => Promise<LanceTable>;
  createTable: (name: string, data: unknown[]) => Promise<LanceTable>;
}

interface LanceDbModule {
  connect: (path: string) => Promise<LanceDbConnection>;
}

export class LanceVectorStore implements VectorStore {
  private dbPath: string;
  private tableName = 'repo_vectors';
  private table: LanceTable | null = null;

  public constructor(relativeDir = '.crucible/index/lancedb') {
    this.dbPath = ProjectPaths.resolveFromRoot(relativeDir);
  }

  public async initialize(): Promise<void> {
    await fs.mkdir(this.dbPath, { recursive: true });
  }

  private async getTable(): Promise<LanceTable> {
    if (this.table) return this.table;
    await fs.mkdir(this.dbPath, { recursive: true });
    
    try {
      // dynamic import to avoid hard dependency at startup
      const lancedbModule = await import('@lancedb/lancedb');
      const lancedb = lancedbModule as unknown as LanceDbModule;
      const db = await lancedb.connect(this.dbPath);
      
      try {
        this.table = await db.openTable(this.tableName);
      } catch {
        // create with minimal schema by inserting an empty batch later
        const initData = [
          {
            id: 'init',
            vector: new Array(8).fill(0),
            text: '',
            filePath: '__init__',
            meta: JSON.stringify({}),
          },
        ];
        this.table = await db.createTable(this.tableName, initData);
        await this.table.delete("id = 'init'");
      }
      return this.table;
    } catch (error) {
      throw new Error(`Failed to initialize LanceDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async upsert(records: Readonly<VectorRecord[]>): Promise<void> {
    const table = await this.getTable();
    const rows = records.map(r => ({
      id: r.id,
      vector: r.embedding,
      text: r.text,
      filePath: r.meta.filePath,
      meta: JSON.stringify(r.meta),
    }));
    await table.add(rows);
  }

  public async deleteByFile(filePath: string): Promise<void> {
    const table = await this.getTable();
    // Escape single quotes
    const escaped = filePath.replace(/'/g, "''");
    await table.delete(`filePath = '${escaped}'`);
  }

  public async query(embedding: readonly number[], k: number): Promise<QueryResult[]> {
    const table = await this.getTable();
    const result = await table.search(embedding).metricType('cosine').limit(k).execute();
    // result is an array of rows with columns including vector score? Lance returns _distance or _score
    return result.map((row: any) => {
      const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
      const rec: QueryResult = {
        id: row.id,
        embedding: row.vector as number[],
        text: row.text as string,
        meta,
        similarity: typeof row._distance === 'number' ? 1 - row._distance : row._score ?? 0,
      };
      return rec;
    });
  }

  public async count(): Promise<number> {
    const table = await this.getTable();
    // lancedb table has count() API
    try {
      return (await table.count?.()) ?? 0;
    } catch {
      // fallback: scan length
      const rows = await table.limit(1_000_000).toArray();
      return Array.isArray(rows) ? rows.length : 0;
    }
  }
}

export default LanceVectorStore;
