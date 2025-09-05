import { randomUUID } from 'crypto';
import type { CLIOperationRequest, CLISession } from '../services/unified-cli-coordinator.js';

export interface ParsedCommandOptions {
  enableContextIntelligence: boolean;
  enablePerformanceOptimization: boolean;
  enableErrorResilience: boolean;
  // Required properties from ResilientOptions
  enableGracefulDegradation: boolean;
  retryAttempts: number;
  timeoutMs: number;
  fallbackMode: 'safe' | 'basic' | 'minimal';
  errorNotification: boolean;
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

// CLI coordinator expects a CommandParser class
export class CommandParser {
  static parseArgs(argv: string[]): { command?: string } {
    // Simple argument parsing - extract command from argv
    const command = argv[2]; // Skip node and script name
    return { command };
  }

  static parseInput(line: string): { intent: string } {
    // Simple intent parsing from user input
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith('help')) return { intent: 'help' };
    if (trimmed.startsWith('exit') || trimmed.startsWith('quit')) return { intent: 'exit' };
    return { intent: 'query' };
  }
}
