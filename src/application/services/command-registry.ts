import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import type { CommandBus, Command } from '../cqrs/command-bus.js';

export interface RegisteredCommandMeta {
  description?: string;
  version?: string;
  plugin?: string;
  tags?: string[];
}

export type RegisteredCommandHandler = (...args: any[]) => Promise<any> | any;

export interface RegisteredCommand {
  name: string;
  handler: RegisteredCommandHandler;
  meta?: RegisteredCommandMeta;
}

export class CommandRegistry {
  private readonly logger = createLogger('CommandRegistry');
  private readonly commands = new Map<string, RegisteredCommand>();

  constructor(private readonly bus?: CommandBus) {}

  register(name: string, handler: RegisteredCommandHandler, meta?: RegisteredCommandMeta): void {
    if (this.commands.has(name)) {
      this.logger.warn(`Command already registered: ${name}`);
      return;
    }
    this.commands.set(name, { name, handler, meta });
    this.logger.info(`Registered command: ${name}`);
  }

  list(): RegisteredCommand[] {
    return Array.from(this.commands.values()).map(c => ({ ...c }));
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  getCommand(name: string): { handler: (...args: readonly unknown[]) => unknown } | undefined {
    const entry = this.commands.get(name);
    if (!entry) {
      return undefined;
    }
    return { handler: entry.handler };
  }

  async execute(name: string, ...args: any[]): Promise<any> {
    const entry = this.commands.get(name);
    if (!entry) {
      throw new Error(`Command not found: ${name}`);
    }

    // If a bus is present, go through generic dispatch to apply middleware
    if (this.bus) {
      const cmd: Command = { type: 'plugin:execute', payload: { name, args } };
      // The PluginDispatchHandler must be registered on this.bus
      return this.bus.execute(cmd);
    }

    return entry.handler(...args);
  }
}
