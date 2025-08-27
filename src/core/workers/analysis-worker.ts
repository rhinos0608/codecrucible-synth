/**
 * Worker Thread for Non-Blocking Code Analysis
 * Based on research-driven optimization report recommendations
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import { UnifiedModelClient } from '../../application/services/client.js';
import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';

export interface AnalysisTask {
  id: string;
  files: string[];
  prompt: string;
  options: any;
  timeout?: number;
}

export interface AnalysisResult {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

if (!isMainThread) {
  // Worker thread execution
  (async () => {
    try {
      const { task, config } = workerData as { task: AnalysisTask; config: any };
      const startTime = Date.now();

      // Initialize minimal client for analysis
      const client = new UnifiedModelClient(config);
      const voiceSystem = new VoiceArchetypeSystem(client, config);

      // Perform analysis
      const result = await performAnalysis(task, client, voiceSystem);

      const response: AnalysisResult = {
        id: task.id,
        success: true,
        result,
        duration: Date.now() - startTime,
      };

      parentPort?.postMessage(response);
    } catch (error) {
      const response: AnalysisResult = {
        id: workerData.task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - (workerData.startTime || Date.now()),
      };

      parentPort?.postMessage(response);
    }
  })();
}

/**
 * Worker Pool Manager for handling analysis tasks
 */
export class AnalysisWorkerPool {
  private workers: Worker[] = [];
  private activeWorkers = 0;
  private taskQueue: Array<{
    task: AnalysisTask;
    resolve: (result: AnalysisResult) => void;
    reject: (error: Error) => void;
  }> = [];

  private readonly maxWorkers: number;
  private readonly workerTimeout: number;

  constructor(maxWorkers = cpus().length, workerTimeout = 30000) {
    this.maxWorkers = maxWorkers;
    this.workerTimeout = workerTimeout;
  }

  /**
   * Execute analysis task in worker thread
   */
  async executeAnalysis(task: AnalysisTask, config: any): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue(config);
    });
  }

  /**
   * Process queued tasks
   */
  private async processQueue(config: any): Promise<void> {
    if (this.taskQueue.length === 0 || this.activeWorkers >= this.maxWorkers) {
      return;
    }

    const { task, resolve, reject } = this.taskQueue.shift()!;
    this.activeWorkers++;

    try {
      const worker = new Worker(__filename, {
        workerData: { task, config, startTime: Date.now() },
      });

      this.workers.push(worker);

      // Set up timeout
      const timeout = setTimeout(() => {
        worker.terminate();
        this.activeWorkers--;
        reject(new Error(`Analysis task ${task.id} timed out after ${this.workerTimeout}ms`));
        this.processQueue(config);
      }, task.timeout || this.workerTimeout);

      // Handle worker completion
      worker.on('message', (result: AnalysisResult) => {
        clearTimeout(timeout);
        this.activeWorkers--;
        this.removeWorker(worker);
        resolve(result);
        this.processQueue(config);
      });

      // Handle worker errors
      worker.on('error', error => {
        clearTimeout(timeout);
        this.activeWorkers--;
        this.removeWorker(worker);
        reject(error);
        this.processQueue(config);
      });

      // Handle worker exit
      worker.on('exit', code => {
        clearTimeout(timeout);
        this.activeWorkers--;
        this.removeWorker(worker);
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`));
        }
        this.processQueue(config);
      });
    } catch (error) {
      this.activeWorkers--;
      reject(error instanceof Error ? error : new Error(String(error)));
      this.processQueue(config);
    }
  }

  /**
   * Remove worker from pool
   */
  private removeWorker(worker: Worker): void {
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
    }
  }

  /**
   * Cleanup all workers
   */
  async cleanup(): Promise<void> {
    const terminatePromises = this.workers.map(async worker => worker.terminate());
    await Promise.allSettled(terminatePromises);
    this.workers = [];
    this.activeWorkers = 0;
    this.taskQueue = [];
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      activeWorkers: this.activeWorkers,
      queuedTasks: this.taskQueue.length,
      totalWorkers: this.workers.length,
      maxWorkers: this.maxWorkers,
    };
  }
}

/**
 * Perform actual analysis work
 */
async function performAnalysis(
  task: AnalysisTask,
  client: UnifiedModelClient,
  voiceSystem: VoiceArchetypeSystem
): Promise<any> {
  // Chunk files to prevent memory overload
  const CHUNK_SIZE = 10;
  const fileChunks = [];

  for (let i = 0; i < task.files.length; i += CHUNK_SIZE) {
    fileChunks.push(task.files.slice(i, i + CHUNK_SIZE));
  }

  const results = [];

  for (const chunk of fileChunks) {
    try {
      // Analyze chunk with appropriate voices
      const voices = ['analyzer', 'maintainer', 'security'];
      const chunkResult = await voiceSystem.generateMultiVoiceSolutions(
        voices,
        `Analyze these files: ${chunk.join(', ')}\n\n${task.prompt}`,
        { files: chunk }
      );

      results.push({
        files: chunk,
        analysis: chunkResult,
      });

      // Allow garbage collection between chunks
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      results.push({
        files: chunk,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    totalFiles: task.files.length,
    chunks: results,
    summary: generateAnalysisSummary(results),
  };
}

/**
 * Generate analysis summary
 */
function generateAnalysisSummary(results: any[]): any {
  const totalChunks = results.length;
  const successfulChunks = results.filter(r => !r.error).length;
  const errorChunks = results.filter(r => r.error).length;

  return {
    totalChunks,
    successfulChunks,
    errorChunks,
    successRate: Math.round((successfulChunks / totalChunks) * 100),
  };
}

// Export singleton instance
export const analysisWorkerPool = new AnalysisWorkerPool();
