import parseCLIArgs, { ParsedCLIArgs } from './args-parser.js';

export function parseArguments(rawArgs: readonly string[]): ParsedCLIArgs {
  return parseCLIArgs(rawArgs);
}

export default parseArguments;
