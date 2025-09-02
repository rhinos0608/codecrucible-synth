import { CLIDisplay } from './cli-display.js';

/**
 * OutputFormatter centralizes how results and messages are rendered in the
 * terminal. It delegates rich formatting to core CLIDisplay utilities while
 * keeping the application layer decoupled from presentation specifics.
 */
export class OutputFormatter {
  showHelp(): void {
    CLIDisplay.showHelp();
  }

  showModels(): Promise<void> {
    return CLIDisplay.showModelRecommendations();
  }

  print(message: string): void {
    console.log(message);
  }
}
