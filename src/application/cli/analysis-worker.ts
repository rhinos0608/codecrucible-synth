import { parentPort } from 'worker_threads';

interface AnalysisTask {
  id: string | number;
  delay?: number;
  files?: unknown[];
}

parentPort?.on('message', (rawTask: unknown) => {
  (async (): Promise<void> => {
    const task = rawTask as AnalysisTask;
    try {
      const delay: number = typeof task.delay === 'number' ? task.delay : 0;
      await new Promise<void>(resolve => setTimeout(resolve, delay));
      const files = Array.isArray(task.files) ? task.files : [];
      const result = {
        totalFiles: files.length,
      };
      parentPort?.postMessage({ id: task.id, result });
    } catch (error) {
      parentPort?.postMessage({ id: task.id, error: (error as Error).message });
    }
  })().catch((error) => {
    parentPort?.postMessage({ id: (rawTask as AnalysisTask)?.id, error: (error as Error).message });
  });
});
