import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

interface PendingTask {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export class AnalysisWorkerPool {
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private queue: { task: any; resolve: (v: any) => void; reject: (r: any) => void }[] = [];
  private callbacks = new Map<string, PendingTask>();

  constructor(size = 2) {
    const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'analysis-worker.js');
    for (let i = 0; i < size; i++) {
      const worker = new Worker(workerPath, { type: 'module' });
      worker.on('message', msg => this.handleMessage(worker, msg));
      this.workers.push(worker);
      this.available.push(worker);
    }
  }

  private handleMessage(worker: Worker, msg: any): void {
    const cb = this.callbacks.get(msg.id);
    if (cb) {
      if (msg.error) {
        cb.reject(new Error(msg.error));
      } else {
        cb.resolve(msg.result);
      }
      this.callbacks.delete(msg.id);
    }
    this.available.push(worker);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.available.length === 0) return;
    const worker = this.available.shift();
    const { task, resolve, reject } = this.queue.shift()!;
    const id = randomUUID();
    this.callbacks.set(id, { resolve, reject });
    worker?.postMessage({ ...task, id });
  }

  runTask(task: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async destroy(): Promise<void> {
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers = [];
    this.available = [];
  }
}

export const analysisWorkerPool = new AnalysisWorkerPool();
