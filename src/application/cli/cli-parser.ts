/**
 * CLI Argument Parser
 * Handles parsing of command line arguments and options
 */

import { CLIOptions } from './cli-types.js';

export class CLIParser {
  /**
   * Parse slash commands for role switching
   */
  public static parseSlashCommand(input: string): { command: string; role?: string; content: string } {
    const slashCommandRegex = /^\/(\w+)(?:\s+(.*))?$/;
    const match = input.match(slashCommandRegex);

    if (match) {
      const [_, command, content = ''] = match;

      switch (command) {
        case 'auditor':
          return { command: 'role-switch', role: 'auditor', content };
        case 'writer':
          return { command: 'role-switch', role: 'writer', content };
        case 'auto':
          return { command: 'role-switch', role: 'auto', content };
        case 'help':
          return { command: 'slash-help', content };
        default:
          return { command: 'unknown-slash', content: input };
      }
    }

    return { command: 'none', content: input };
  }

  /**
   * Parse command line arguments into structured options
   */
  public static parseOptions(args: readonly string[]): CLIOptions {
    const options: CLIOptions = {};

    // Ensure a return value in all code paths
    if (args.length === 0) {
      return options;
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const nextArg = args[i + 1];

        switch (key) {
          case 'voices':
            if (nextArg && !nextArg.startsWith('--')) {
              options.voices = nextArg.split(',').map(v => v.trim());
              i++;
            }
            break;
          case 'mode':
            if (nextArg && !nextArg.startsWith('--')) {
              options.mode = nextArg as 'agentic' | 'iterative' | 'competitive' | 'collaborative' | 'consensus' | 'comprehensive' | 'analysis';
              i++;
            }
            break;

          case 'depth':
            if (nextArg && !nextArg.startsWith('--')) {
              options.depth = nextArg;
              i++;
            }
            break;

          case 'timeout':
            if (nextArg && !nextArg.startsWith('--')) {
              options.timeout = parseInt(nextArg, 10);
              i++;
            }
            break;

          case 'spiral-iterations':
            if (nextArg && !nextArg.startsWith('--')) {
              options.spiralIterations = parseInt(nextArg, 10);
              i++;
            }
            break;

          case 'spiral-quality':
            if (nextArg && !nextArg.startsWith('--')) {
              options.spiralQuality = parseFloat(nextArg);
              i++;
            }
            break;

          case 'max-steps':
            if (nextArg && !nextArg.startsWith('--')) {
              options.maxSteps = parseInt(nextArg, 10);
              i++;
            }
            break;

          case 'output':
            if (nextArg && !nextArg.startsWith('--')) {
              options.output = nextArg as 'text' | 'json' | 'table';
              i++;
            }
            break;

          case 'backend':
            if (nextArg && !nextArg.startsWith('--')) {
              options.backend = nextArg as 'auto' | 'docker' | 'e2b' | 'local_e2b' | 'local_process' | 'firecracker' | 'podman';
              i++;
            }
            break;

          case 'port':
            if (nextArg && !nextArg.startsWith('--')) {
              options.port = nextArg;
              i++;
            }
            break;

          case 'writer-model':
            if (nextArg && !nextArg.startsWith('--')) {
              options.writerModel = nextArg;
              i++;
            }
            break;

          case 'auditor-model':
            if (nextArg && !nextArg.startsWith('--')) {
              options.auditorModel = nextArg;
              i++;
            }
            break;

          // Sequential Review options
          case 'writer-provider':
            if (nextArg && !nextArg.startsWith('--')) {
              options.writerProvider = nextArg as 'ollama' | 'lm-studio';
              i++;
            }
            break;
          case 'auditor-provider':
            if (nextArg && !nextArg.startsWith('--')) {
              options.auditorProvider = nextArg as 'ollama' | 'lm-studio';
              i++;
            }
            break;
          case 'writer-temp':
            if (nextArg && !nextArg.startsWith('--')) {
              options.writerTemp = parseFloat(nextArg);
              i++;
            }
            break;
          case 'auditor-temp':
            if (nextArg && !nextArg.startsWith('--')) {
              options.auditorTemp = parseFloat(nextArg);
              i++;
            }
            break;
          case 'writer-tokens':
            if (nextArg && !nextArg.startsWith('--')) {
              options.writerTokens = parseInt(nextArg, 10);
              i++;
            }
            break;
          case 'auditor-tokens':
            if (nextArg && !nextArg.startsWith('--')) {
              options.auditorTokens = parseInt(nextArg, 10);
              i++;
            }
            break;
          case 'confidence-threshold':
            if (nextArg && !nextArg.startsWith('--')) {
              options.confidenceThreshold = parseFloat(nextArg);
              i++;
            }
            break;

          // Boolean flags
          case 'interactive':
            options.interactive = true;
            break;
          case 'spiral':
            options.spiral = true;
            break;
          case 'autonomous':
            options.autonomous = true;
            break;
          case 'council':
            options.council = true;
            break;
          case 'agentic':
            options.agentic = true;
            break;
          case 'quick':
            options.quick = true;
            break;
          case 'direct':
            options.direct = true;
            break;
          case 'verbose':
            options.verbose = true;
            break;
          case 'quiet':
            options.quiet = true;
            break;
          case 'fast':
            options.fast = true;
            break;
          case 'skip-init':
            options.skipInit = true;
            break;
          case 'iterative':
            options.iterative = true;
            break;
          case 'stream':
            options.stream = true;
            break;
          case 'no-stream':
            options.noStream = true;
            break;
          case 'enable-intelligence':
            options.enableIntelligence = true;
            break;
          case 'context-aware':
            options.contextAware = true;
            break;
          case 'smart-suggestions':
            options.smartSuggestions = true;
            break;
          case 'project-analysis':
            options.projectAnalysis = true;
            break;
          case 'dual-agent':
            options.dualAgent = true;
            break;
          case 'realtime-audit':
            options.realtimeAudit = true;
            break;
          case 'auto-fix':
            options.autoFix = true;
            break;
          case 'stream-generation':
            options.streamGeneration = true;
            break;

          // Sequential Review boolean flags
          case 'sequential-review':
            options.sequentialReview = true;
            break;
          case 'auto-audit':
            options.autoAudit = true;
            break;
          case 'apply-fixes':
            options.applyFixes = true;
            break;
          case 'save-result':
            options.saveResult = true;
            break;
          case 'show-code':
            options.showCode = true;
            break;
          case 'status':
            options.status = true;
            break;
          case 'optimize':
            options.optimize = true;
            break;
          case 'test':
            options.test = true;
            break;
          case 'models':
            options.models = true;
            break;
          case 'configure':
            options.configure = true;
            break;
          case 'server':
            options.server = true;
            break;
          case 'project':
            options.project = true;
            break;
          default:
            console.warn(`Unknown option: ${key}`);
            break;
        }
      } else if (arg.startsWith('-') && !arg.startsWith('--')) {
        switch (arg) {
          case '-v':
            options.verbose = true;
            break;
          case '-q':
            options.quiet = true;
            break;
          case '-i':
            options.interactive = true;
            break;
          case '-f':
            options.fast = true;
            break;
          case '-s':
            options.spiral = true;
            break;
          case '-a':
            options.autonomous = true;
            break;
          default:
            console.warn(`Unknown short option: ${arg}`);
            break;
        }
      }
    }

    return options;
  }

  /**
   * Extract the main command from arguments
   */
  public static extractCommand(args: readonly string[]): { command: string; remainingArgs: string[] } {
    const commands = ['analyze', 'generate', 'status', 'models', 'configure', 'help'];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (commands.includes(arg)) {
        return {
          command: arg,
          remainingArgs: args.slice(i + 1),
        };
      }
    }

    return {
      command: '',
      remainingArgs: [...args],
    };
  }

  /**
   * Check if arguments contain help flags
   */
  public static isHelpRequest(args: readonly string[]): boolean {
    return args.includes('--help') || args.includes('-h') || args.includes('help');
  }

  /**
   * Get non-option arguments (potential prompts or files)
   */
  public static getNonOptionArgs(args: readonly string[]): string[] {
    const nonOptions: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('-')) {
        // Skip this option and its value if it has one
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('-') && this.isOptionWithValue(arg)) {
          i++; // Skip the value
        }
      } else {
        nonOptions.push(arg);
      }
    }

    return nonOptions;
  }

  /**
   * Check if an option expects a value
   */
  private static isOptionWithValue(option: string): boolean {
    const optionsWithValues = [
      '--voices',
      '--mode',
      '--depth',
      '--timeout',
      '--spiral-iterations',
      '--spiral-quality',
      '--max-steps',
      '--output',
      '--backend',
      '--port',
      '--writer-model',
      '--auditor-model',
    ];

    return optionsWithValues.includes(option);
  }
}



// Removed duplicate extractCommand function to resolve conflicts.


