// CLI Parser Interface
// Application layer CLI parsing interface

export interface CLIParseResult {
  command: string;
  args: string[];
  options: Record<string, unknown>;
  flags: string[];
  isValid: boolean;
  errors?: string[];
}

export interface CLIParserInterface {
  parse: (input: readonly string[] | string) => CLIParseResult;
  validateArgs: (command: string, args: readonly string[]) => boolean;
  getUsage: (command?: string) => string;
}

export class CLIParser implements CLIParserInterface {
  private readonly commands = new Map<
    string,
    {
      description: string;
      args: string[];
      options: Record<string, string>;
    }
  >();

  public constructor() {
    this.setupCommands();
  }

  private setupCommands(): void {
    this.commands.set('analyze', {
      description: 'Analyze code files',
      args: ['file'],
      options: {
        '--format': 'Output format (json, text)',
        '--depth': 'Analysis depth (shallow, deep)',
      },
    });

    this.commands.set('generate', {
      description: 'Generate code',
      args: ['prompt'],
      options: {
        '--output': 'Output file',
        '--model': 'AI model to use',
      },
    });

    this.commands.set('status', {
      description: 'Show system status',
      args: [],
      options: {},
    });
  }

  public parse(input: string | readonly string[]): CLIParseResult {
    let args: string[];
    if (Array.isArray(input)) {
      args = Array.from(input as readonly string[]);
    } else if (typeof input === 'string') {
      args = input.split(' ').filter((s): s is string => Boolean(s));
    } else {
      args = [];
    }

    if (args.length === 0) {
      return {
        command: '',
        args: [],
        options: {},
        flags: [],
        isValid: false,
        errors: ['No command provided'],
      };
    }

    const [command, ...restArgs] = args;
    const remainingArgs: string[] = [];
    const options: Record<string, unknown> = {};
    const flags: string[] = [];

    for (let i = 0; i < restArgs.length; i++) {
      const arg: string = restArgs[i];

      if (arg.startsWith('--')) {
        if (arg.includes('=')) {
          const [key, value] = arg.split('=', 2);
          options[key] = value;
        } else if (
          i + 1 < restArgs.length &&
          typeof restArgs[i + 1] === 'string' &&
          !restArgs[i + 1].startsWith('-')
        ) {
          options[arg] = restArgs[i + 1];
          i++; // Skip next arg as it's the value
        } else {
          flags.push(arg);
        }
      } else if (arg.startsWith('-')) {
        flags.push(arg);
      } else {
        remainingArgs.push(arg);
      }
    }

    const isValid = this.validateCommand(command);

    return {
      command,
      args: remainingArgs,
      options,
      flags,
      isValid,
      errors: isValid ? undefined : [`Unknown command: ${command}`],
    };
  }

  public validateArgs(command: string, args: readonly string[]): boolean {
    const commandInfo = this.commands.get(command);
    if (!commandInfo) return false;

    return args.length >= commandInfo.args.length;
  }

  private validateCommand(command: string): boolean {
    return this.commands.has(command);
  }

  public getUsage(command?: string): string {
    if (command) {
      const commandInfo = this.commands.get(command);
      if (!commandInfo) {
        return `Unknown command: ${command}`;
      }

      const usage = [`Usage: ${command}`];

      if (commandInfo.args.length > 0) {
        usage.push(commandInfo.args.map((arg: string) => `<${arg}>`).join(' '));
      }

      usage.push(`\n${commandInfo.description}\n`);

      if (Object.keys(commandInfo.options).length > 0) {
        usage.push('Options:');
        Object.entries(commandInfo.options).forEach(([option, desc]: readonly [string, string]) => {
          usage.push(`  ${option}  ${desc}`);
        });
      }

      return usage.join(' ');
    }

    const allCommands = Array.from(this.commands.entries())
      .map(
        ([cmd, info]: readonly [string, { description: string }]) => `  ${cmd}  ${info.description}`
      )
      .join('\n');

    return `Available commands:\n${allCommands}`;
  }
}

export const cliParser = new CLIParser();
