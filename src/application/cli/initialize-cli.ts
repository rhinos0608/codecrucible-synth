import { CLIOptions } from '../interfaces/unified-cli.js';
import initialize from '../bootstrap/initialize.js';

export async function initializeCLI(cliOptions: Readonly<CLIOptions>, isInteractive: boolean) {
  return initialize(cliOptions as CLIOptions, isInteractive);
}

export default initializeCLI;
