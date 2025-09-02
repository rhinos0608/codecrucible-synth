import { CLIParser } from './cli-parser.js';
import { naturalLanguageInterface, ParsedCommand } from './natural-language-interface.js';
import type { CLIOptions } from './cli-types.js';

/**
 * CommandParser bridges low-level CLI parsing utilities from the core layer
 * with application-level semantics. It exposes convenience helpers for
 * processing raw command-line arguments and interactive user input.
 */
export class CommandParser {
  /**
   * Parse process arguments into structured CLI options and command.
   */
  static parseArgs(argv: string[]): { command: string; options: CLIOptions; args: string[] } {
    // Remove node and script path
    const args = argv.slice(2);
    const { command, remainingArgs } = CLIParser.extractCommand(args);
    const options = CLIParser.parseOptions(args);
    return { command, options, args: remainingArgs };
  }

  /**
   * Parse a raw input line, handling slash commands and natural language.
   */
  static parseInput(input: string): ParsedCommand {
    const slash = CLIParser.parseSlashCommand(input);
    if (slash.command !== 'none') {
      return {
        intent: slash.command as ParsedCommand['intent'],
        confidence: 1,
        target: slash.role,
        originalInput: input,
        enhancedQuery: slash.content,
      };
    }
    return naturalLanguageInterface.parseCommand(input);
  }
}
