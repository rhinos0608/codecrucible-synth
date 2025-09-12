import { parseModelsArgs, ModelsCommandOptions } from './models-command.js';
import { parseToolsArgs, ToolsCommandOptions } from './tools-command.js';

export type ParsedCLIArgs =
  | { command: 'version' }
  | { command: 'help' }
  | { command: 'status' }
  | { command: 'models'; options: ModelsCommandOptions }
  | { command: 'tools'; options: ToolsCommandOptions }
  | { command: 'run'; args: readonly string[] };

export function parseCLIArgs(rawArgs: readonly string[]): ParsedCLIArgs {
  const args = rawArgs.length > 0 ? [...rawArgs] : process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    return { command: 'version' };
  }

  if (args.includes('--help') || args.includes('-h')) {
    return { command: 'help' };
  }

  const [first, ...rest] = args;

  if (first === 'status') {
    return { command: 'status' };
  }

  if (first === 'models') {
    return { command: 'models', options: parseModelsArgs(rest) };
  }

  if (first === 'tools') {
    return { command: 'tools', options: parseToolsArgs(rest) };
  }

  return { command: 'run', args };
}

export default parseCLIArgs;
