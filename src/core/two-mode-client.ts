import { CLIContext } from './cli.js';
import { logger } from './logger.js';
import chalk from 'chalk';
import readline from 'readline';
import { LocalModelClient } from './local-model-client.js';

type Mode = 'write' | 'ask';

/**
 * Simple two-mode client: write mode for code generation, ask mode for questions
 * Navigate with left/right arrow keys
 */
export class TwoModeClient {
  private context: CLIContext;
  private model: LocalModelClient;
  private currentMode: Mode = 'ask';
  private rl: readline.Interface;
  private isProcessing = false;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(context: CLIContext) {
    this.context = context;
    this.model = context.modelClient;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt()
    });
    
    // Enable keypress events
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin);
  }

  async start() {
    console.clear();
    this.showHeader();
    
    // Handle keyboard input
    process.stdin.on('keypress', (str, key) => {
      if (this.isProcessing) return;
      
      if (key && key.name === 'left') {
        this.switchMode('ask');
      } else if (key && key.name === 'right') {
        this.switchMode('write');
      } else if (key && key.ctrl && key.name === 'c') {
        this.exit();
      } else if (key && key.name === 'escape') {
        this.clearInput();
      }
    });

    // Handle line input
    this.rl.on('line', async (input) => {
      if (this.isProcessing) {
        console.log(chalk.yellow('⏳ Still processing...'));
        return;
      }

      const trimmed = input.trim();
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      // Handle slash commands
      if (trimmed === '/exit' || trimmed === '/quit') {
        this.exit();
        return;
      }
      
      if (trimmed === '/clear') {
        console.clear();
        this.showHeader();
        this.rl.prompt();
        return;
      }

      if (trimmed === '/help') {
        this.showHelp();
        this.rl.prompt();
        return;
      }

      // Process based on mode
      this.isProcessing = true;
      try {
        await this.processInput(trimmed);
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error);
      } finally {
        this.isProcessing = false;
        this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      this.exit();
    });

    // Start the prompt
    this.rl.prompt();
  }

  private switchMode(mode: Mode) {
    if (this.currentMode === mode) return;
    
    this.currentMode = mode;
    console.log('');
    console.log(chalk.cyan(`🔄 Switched to ${mode.toUpperCase()} mode`));
    this.showModeIndicator();
    this.rl.setPrompt(this.getPrompt());
    this.rl.prompt();
  }

  private showHeader() {
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║       CodeCrucible - Two Mode Assistant      ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════╝'));
    console.log('');
    this.showModeIndicator();
    console.log('');
    console.log(chalk.gray('Use ← → arrow keys to switch modes | /help for commands | Ctrl+C to exit'));
    console.log('');
  }

  private showModeIndicator() {
    const askStyle = this.currentMode === 'ask' ? chalk.bold.green : chalk.gray;
    const writeStyle = this.currentMode === 'write' ? chalk.bold.blue : chalk.gray;
    
    console.log(`  ${askStyle('[ASK]')} ← → ${writeStyle('[WRITE]')}`);
    console.log(chalk.gray(`  ${this.currentMode === 'ask' ? 'Ask questions' : 'Generate code'}`));
  }

  private getPrompt(): string {
    const modeEmoji = this.currentMode === 'ask' ? '❓' : '✍️';
    const modeColor = this.currentMode === 'ask' ? chalk.green : chalk.blue;
    return modeColor(`${modeEmoji} ${this.currentMode.toUpperCase()} > `);
  }

  private showHelp() {
    console.log('');
    console.log(chalk.bold('Commands:'));
    console.log('  ← →        Switch between ASK and WRITE modes');
    console.log('  /clear     Clear the screen');
    console.log('  /help      Show this help');
    console.log('  /exit      Exit the assistant');
    console.log('  ESC        Clear current input');
    console.log('');
    console.log(chalk.bold('Modes:'));
    console.log('  ASK        Ask questions and get explanations');
    console.log('  WRITE      Generate code and implementations');
    console.log('');
  }

  private async processInput(input: string) {
    // Add to conversation history
    this.conversationHistory.push({ role: 'user', content: input });
    
    console.log(''); // Add spacing
    
    try {
      // Prepare the prompt based on mode
      const systemPrompt = this.currentMode === 'ask' 
        ? 'You are a helpful assistant. Answer questions clearly and concisely.'
        : 'You are a code generation assistant. Generate clean, well-commented code.';
      
      const prompt = `${systemPrompt}\n\nUser: ${input}\n\nAssistant:`;
      
      // Generate response
      console.log(chalk.gray('Thinking...'));
      
      const response = await this.model.generate(prompt);
      
      // Clear "Thinking..." line
      process.stdout.write('\x1b[1A\x1b[2K');
      
      // Display response with appropriate formatting
      if (this.currentMode === 'write') {
        console.log(chalk.blue('📝 Generated Code:'));
        console.log('');
        console.log(chalk.white(response));
      } else {
        console.log(chalk.green('💡 Answer:'));
        console.log('');
        console.log(chalk.white(response));
      }
      
      console.log(''); // Add spacing after response
      
      // Add to conversation history
      this.conversationHistory.push({ role: 'assistant', content: response });
      
    } catch (error) {
      // Try to provide a helpful response even if the model fails
      console.log(chalk.yellow('⚠️ Model unavailable, using fallback response'));
      
      if (this.currentMode === 'write') {
        console.log(chalk.blue('📝 Code template:'));
        console.log(this.getFallbackCode(input));
      } else {
        console.log(chalk.green('💡 Response:'));
        console.log(this.getFallbackAnswer(input));
      }
    }
  }

  private getFallbackCode(input: string): string {
    // Simple fallback code generation based on keywords
    if (input.toLowerCase().includes('function')) {
      return `function example() {
  // TODO: Implement ${input}
  console.log('Function implementation needed');
}`;
    }
    
    if (input.toLowerCase().includes('class')) {
      return `class Example {
  constructor() {
    // TODO: Initialize
  }
  
  // TODO: Implement methods for ${input}
}`;
    }
    
    return `// TODO: Implement ${input}\n// Code generation requires model connection`;
  }

  private getFallbackAnswer(input: string): string {
    return `I understand you're asking about: "${input}"
    
Unfortunately, I cannot provide a detailed response without model connection.
Please ensure Ollama is running with: ollama serve`;
  }

  private clearInput() {
    this.rl.write(null, { ctrl: true, name: 'u' });
  }

  private exit() {
    console.log('\n' + chalk.cyan('Goodbye! 👋'));
    process.exit(0);
  }
}