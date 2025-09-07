import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

interface PendingTask {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

export class AnalysisWorkerPool {
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private readonly queue: {
    task: unknown;
    resolve: (v: unknown) => void;
    reject: (r: unknown) => void;
  }[] = [];
  private readonly callbacks = new Map<string, PendingTask>();

  public constructor(size = 2) {
    // Use .ts for development (ts-node), .js for production (compiled)
    const ext = fileURLToPath(import.meta.url).endsWith('.ts') ? '.ts' : '.js';
    const workerPath = join(dirname(fileURLToPath(import.meta.url)), `analysis-worker${ext}`);
    for (let i = 0; i < size; i++) {
      const worker = new Worker(workerPath, { workerData: null });
      worker.on('message', (msg: unknown) => {
        this.handleMessage(worker, msg);
      });
      this.workers.push(worker);
      this.available.push(worker);
    }
  }

  private handleMessage(worker: Worker, msg: unknown): void {
    type WorkerResponse = Readonly<{ id?: string; error?: string; result?: unknown }>;

    if (typeof msg !== 'object' || msg === null) {
      // unknown message shape; return worker to available pool and continue
      this.available.push(worker);
      this.processQueue();
      return;
    }

    const m = msg as WorkerResponse;
    const { id } = m;
    if (typeof id !== 'string') {
      // no valid id on message; return worker to available pool and continue
      this.available.push(worker);
      this.processQueue();
      return;
    }

    const cb = this.callbacks.get(id);
    if (cb) {
      if (typeof m.error === 'string') {
        cb.reject(new Error(m.error));
      } else {
        cb.resolve(m.result);
      }
      this.callbacks.delete(id);
    }

    this.available.push(worker);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.available.length === 0) return;
    const worker = this.available.shift();
    const next = this.queue.shift();
    if (!next) return;
    const { task, resolve, reject } = next;
    const id = randomUUID();
    this.callbacks.set(id, { resolve, reject });
    if (task && typeof task === 'object') {
      worker?.postMessage({ ...task, id });
    } else {
      worker?.postMessage({ task, id });
    }
  }

  public async runTask<T = unknown>(task: T): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  public async destroy(): Promise<void> {
    await Promise.all(this.workers.map(async (w: Readonly<Worker>) => w.terminate()));
    this.workers = [];
    this.available = [];
  }
}

export const analysisWorkerPool = new AnalysisWorkerPool();
