import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * InteractionManager centralizes all user-facing I/O for the CLI. It keeps
 * readline usage contained so higher-level modules can remain agnostic of the
 * underlying mechanism.
 */
export class InteractionManager {
  private rl = readline.createInterface({ input, output });

  async ask(prompt: string): Promise<string> {
    return this.rl.question(prompt);
  }

  say(message: string): void {
    output.write(`${message}\n`);
  }

  close(): void {
    this.rl.close();
  }
}
