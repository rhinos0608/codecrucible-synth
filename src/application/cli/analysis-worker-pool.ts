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
  private activeTasks = new Map<Worker, string>();
  private workerPath: string;

  constructor(size = 2) {
    // Use .ts for development (ts-node), .js for production (compiled)
    const ext = fileURLToPath(import.meta.url).endsWith('.ts') ? '.ts' : '.js';
    this.workerPath = join(dirname(fileURLToPath(import.meta.url)), `analysis-worker${ext}`);
    for (let i = 0; i < size; i++) {
      this.spawnWorker();
    }
  }

  private spawnWorker(): void {
    const worker = new Worker(this.workerPath, { type: 'module' });
    worker.on('message', msg => this.handleMessage(worker, msg));
    worker.on('error', err => this.handleFailure(worker, err));
    worker.on('exit', code => {
      if (code !== 0) {
        this.handleFailure(worker, new Error(`Worker exited with code ${code}`));
      }
    });
    worker.unref();
    this.workers.push(worker);
    this.available.push(worker);
  }

  private handleFailure(worker: Worker, err: Error): void {
    if (!this.workers.includes(worker)) return;
    const taskId = this.activeTasks.get(worker);
    if (taskId) {
      const cb = this.callbacks.get(taskId);
      cb?.reject(err);
      this.callbacks.delete(taskId);
      this.activeTasks.delete(worker);
    }
    this.removeWorker(worker);
    this.spawnWorker();
    this.processQueue();
  }

  private removeWorker(worker: Worker): void {
    this.workers = this.workers.filter(w => w !== worker);
    this.available = this.available.filter(w => w !== worker);
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
    this.activeTasks.delete(worker);
    this.available.push(worker);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.available.length === 0) return;
    const worker = this.available.shift()!;
    const { task, resolve, reject } = this.queue.shift()!;
    const id = randomUUID();
    this.callbacks.set(id, { resolve, reject });
    this.activeTasks.set(worker, id);
    worker.postMessage({ ...task, id });
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
    this.activeTasks.clear();
  }
}

export const analysisWorkerPool = new AnalysisWorkerPool();
