/**
 * Simple lifecycle management utilities
 * Replacement for functions previously in agent.js
 */

type ShutdownHandler = () => Promise<void> | void;
type IntervalId = NodeJS.Timeout;

const shutdownHandlers: ShutdownHandler[] = [];
const managedIntervals = new Set<IntervalId>();

/**
 * Register a shutdown handler to be called on process termination
 */
export function registerShutdownHandler(handler: ShutdownHandler): void {
  shutdownHandlers.push(handler);
}

/**
 * Create a managed interval that will be automatically cleared on shutdown
 */
export function createManagedInterval(
  callback: () => void | Promise<void>,
  ms: number
): IntervalId {
  const intervalId = setInterval(async () => {
    try {
      await callback();
    } catch (error) {
      console.error('Error in managed interval:', error);
    }
  }, ms);

  managedIntervals.add(intervalId);
  return intervalId;
}

/**
 * Clear a managed interval
 */
export function clearManagedInterval(intervalId: IntervalId): void {
  clearInterval(intervalId);
  managedIntervals.delete(intervalId);
}

/**
 * Execute all shutdown handlers and clear managed intervals
 */
async function executeShutdown(): Promise<void> {
  // Clear all managed intervals
  for (const intervalId of managedIntervals) {
    clearInterval(intervalId);
  }
  managedIntervals.clear();

  // Execute shutdown handlers
  await Promise.allSettled(
    shutdownHandlers.map(async handler => {
      try {
        await handler();
      } catch (error) {
        console.error('Error in shutdown handler:', error);
      }
    })
  );
}

// Register process event handlers
let shutdownInProgress = false;

async function handleShutdown(signal: string): Promise<void> {
  if (shutdownInProgress) {
    return;
  }
  shutdownInProgress = true;

  console.log(`Received ${signal}, initiating graceful shutdown...`);

  try {
    await executeShutdown();
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => handleShutdown('SIGINT'));
process.on('SIGTERM', async () => handleShutdown('SIGTERM'));
process.on('beforeExit', async () => handleShutdown('beforeExit'));
