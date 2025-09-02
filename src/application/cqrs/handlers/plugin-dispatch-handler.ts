import type { Command, CommandHandler } from '../command-bus.js';

interface PluginExecutePayload { readonly name: string; readonly args: readonly unknown[]; }
type PluginExecuteResult = unknown;

interface PluginCommandEntry {
  handler: (...args: readonly unknown[]) => unknown;
}

interface SafeCommandRegistry {
  readonly getCommand: (name: string) => PluginCommandEntry | undefined;
}

export class PluginDispatchHandler implements CommandHandler<Readonly<PluginExecutePayload>, PluginExecuteResult> {
  public readonly type = 'plugin:execute';

  public constructor(private readonly registry: SafeCommandRegistry) {}

  public handle(command: Readonly<Command<Readonly<PluginExecutePayload>>>): PluginExecuteResult {
    const { name, args } = command.payload;
    if (!name) throw new Error('plugin:execute missing command name');
    const commandEntry = this.registry.getCommand(name);
    if (!commandEntry) throw new Error(`Command not found: ${name}`);
    return commandEntry.handler(...args);
  }
}

