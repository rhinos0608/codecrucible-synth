import type { Command, CommandHandler } from '../command-bus.js';
import type { CommandRegistry } from '../../services/command-registry.js';

export class PluginDispatchHandler implements CommandHandler<{ name: string; args: any[] }, any> {
  public readonly type = 'plugin:execute';

  constructor(private readonly registry: CommandRegistry) {}

  async handle(command: Command<{ name: string; args: any[] }>): Promise<any> {
    const { name, args } = command.payload || ({} as any);
    if (!name) throw new Error('plugin:execute missing command name');
    return this.registry['commands'].get(name)!.handler(...(args || []));
  }
}

