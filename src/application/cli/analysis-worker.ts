import { parentPort } from 'worker_threads';

parentPort?.on('message', async (task: any) => {
  try {
    const delay = typeof task.delay === 'number' ? task.delay : 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    const result = {
      totalFiles: (task.files || []).length,
    };
    parentPort?.postMessage({ id: task.id, result });
  } catch (error) {
    parentPort?.postMessage({ id: task.id, error: (error as Error).message });
  }
});
