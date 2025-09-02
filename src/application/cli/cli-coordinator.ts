import { CommandParser } from './command-parser.js';
import { InteractionManager } from './interaction-manager.js';
import { SessionManager, CLISession } from './session-manager.js';
import { OutputFormatter } from './output-formatter.js';

/**
 * CLICoordinator orchestrates parsing, interaction and session management for
 * the command line experience. It intentionally delegates heavy lifting to
 * dedicated helpers to keep this file lightweight and maintainable.
 */
export class CLICoordinator {
  private interaction: InteractionManager | null = null;
  constructor(
    private sessions = new SessionManager(),
    private formatter = new OutputFormatter()
  ) {}

  /**
   * Entry point for CLI execution. Parses arguments and routes commands.
   */
  async run(argv: string[]): Promise<void> {
    const { command } = CommandParser.parseArgs(argv);
    const session = this.sessions.createSession();

    if (!command) {
      this.interaction = new InteractionManager();
      await this.repl(session);
      return;
    }

    switch (command) {
      case 'help':
        this.formatter.showHelp();
        break;
      case 'models':
        await this.formatter.showModels();
        break;
      default:
        this.formatter.print(`Unknown command: ${command}`);
    }

    this.sessions.endSession(session.id);
    this.interaction?.close();
    this.interaction = null;
  }

  /**
   * Start interactive REPL-style session.
   */
  private async repl(session: CLISession): Promise<void> {
    const interaction = this.interaction!;
    // this.interaction is guaranteed to be set before repl() is called
    let shouldContinue = true;
    while (shouldContinue) {
      const line = await interaction.ask('> ');
      if (this.shouldExit(line)) {
        shouldContinue = false;
        continue;
      }
      const parsed = CommandParser.parseInput(line);
      this.sessions.record(session.id, line);
      this.formatter.print(`Intent: ${parsed.intent}`);
    }
    interaction.close();
  }

  private shouldExit(line: string): boolean {
    return line.trim() === 'exit';
  }
}
