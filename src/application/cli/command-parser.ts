import { randomUUID } from 'crypto';
import type { CLIOperationRequest, CLISession } from '../services/unified-cli-coordinator.js';

export interface ParsedCommandOptions {
  enableContextIntelligence: boolean;
  enablePerformanceOptimization: boolean;
  enableErrorResilience: boolean;
  [key: string]: unknown;
}

export function parseCommand(
  prompt: string,
  options: ParsedCommandOptions,
  session?: CLISession | null
): CLIOperationRequest {
  return {
    id: randomUUID(),
    type: 'prompt',
    input: prompt,
    options,
    session: session ?? undefined,
  };
}
