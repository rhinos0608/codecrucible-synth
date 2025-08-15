import { CLIContext } from './cli.js';
import { logger } from './logger.js';
import chalk from 'chalk';
import readline from 'readline';
import inquirer from 'inquirer';

type Mode = 'write' | 'ask';

/**
 * Simple two-mode client without raw mode complications
 */
export class SimpleTwoModeClient {
  private context: CLIContext;
  private model: any;
  private currentMode: Mode = 'ask';
  private rl: readline.Interface;
  private isProcessing = false;

  constructor(context: CLIContext) {
    this.context = context;
    this.model = context.modelClient;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.clear();
    this.showWelcome();
    
    // Main interaction loop
    await this.interactionLoop();
  }

  private showWelcome() {
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║       CodeCrucible - GPT-OSS-20B Ready       ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.gray('Commands:'));
    console.log(chalk.gray('  /mode    - Switch between ASK and WRITE modes'));
    console.log(chalk.gray('  /clear   - Clear the screen'));
    console.log(chalk.gray('  /help    - Show help'));
    console.log(chalk.gray('  /exit    - Exit the application'));
    console.log('');
  }

  private async interactionLoop() {
    while (true) {
      // Show current mode
      this.showModeIndicator();
      
      // Get user input
      const input = await this.getUserInput();
      
      if (!input || input.trim() === '') continue;
      
      // Handle commands
      if (input.startsWith('/')) {
        const handled = await this.handleCommand(input);
        if (!handled) break; // Exit command
        continue;
      }
      
      // Process based on mode
      await this.processInput(input);
    }
  }

  private showModeIndicator() {
    const modeColor = this.currentMode === 'ask' ? chalk.green : chalk.blue;
    const modeEmoji = this.currentMode === 'ask' ? '❓' : '✍️';
    const modeDesc = this.currentMode === 'ask' ? 'Ask questions' : 'Generate code';
    
    console.log('');
    console.log(modeColor(`${modeEmoji} Mode: ${this.currentMode.toUpperCase()} - ${modeDesc}`));
  }

  private async getUserInput(): Promise<string> {
    return new Promise((resolve) => {
      const modeColor = this.currentMode === 'ask' ? chalk.green : chalk.blue;
      const prompt = modeColor('> ');
      
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  private async handleCommand(command: string): Promise<boolean> {
    const cmd = command.toLowerCase().trim();
    
    switch (cmd) {
      case '/exit':
      case '/quit':
        this.exit();
        return false;
        
      case '/clear':
        console.clear();
        this.showWelcome();
        return true;
        
      case '/help':
        this.showHelp();
        return true;
        
      case '/mode':
        await this.switchMode();
        return true;
        
      default:
        console.log(chalk.yellow(`Unknown command: ${command}`));
        console.log(chalk.gray('Type /help for available commands'));
        return true;
    }
  }

  private async switchMode() {
    const { mode } = await inquirer.prompt([{
      type: 'list',
      name: 'mode',
      message: 'Select mode:',
      choices: [
        { name: '❓ ASK - Ask questions and get explanations', value: 'ask' },
        { name: '✍️ WRITE - Generate code and implementations', value: 'write' }
      ],
      default: this.currentMode === 'ask' ? 1 : 0
    }]);
    
    this.currentMode = mode;
    console.log(chalk.cyan(`Switched to ${mode.toUpperCase()} mode`));
  }

  private showHelp() {
    console.log('');
    console.log(chalk.bold('Available Commands:'));
    console.log('  /mode    - Switch between ASK and WRITE modes');
    console.log('  /clear   - Clear the screen');
    console.log('  /help    - Show this help');
    console.log('  /exit    - Exit the application');
    console.log('');
    console.log(chalk.bold('Current Modes:'));
    console.log('  ASK      - For questions, explanations, and understanding code');
    console.log('  WRITE    - For generating new code and implementations');
    console.log('');
  }

  private async processInput(input: string) {
    if (this.isProcessing) {
      console.log(chalk.yellow('Still processing previous request...'));
      return;
    }

    this.isProcessing = true;
    console.log(''); // Add spacing
    
    try {
      // Prepare prompt based on mode
      const systemPrompt = this.currentMode === 'ask' 
        ? 'You are a helpful AI assistant. Answer questions clearly and concisely. Be direct and to the point.'
        : 'You are a code generation assistant. Generate clean, well-commented, production-ready code.';
      
      const prompt = `${systemPrompt}\n\nUser: ${input}\n\nAssistant:`;
      
      // Show thinking indicator
      const thinkingMsg = chalk.gray('Thinking...');
      process.stdout.write(thinkingMsg);
      
      // Generate response
      const response = await this.model.generate(prompt);
      
      // Clear thinking message
      process.stdout.write('\r' + ' '.repeat(thinkingMsg.length) + '\r');
      
      // Display response with appropriate formatting
      if (this.currentMode === 'write') {
        console.log(chalk.blue('📝 Generated Code:'));
        console.log('');
        this.displayCode(response);
      } else {
        console.log(chalk.green('💡 Answer:'));
        console.log('');
        console.log(chalk.white(response));
      }
      
    } catch (error) {
      // Clear thinking message
      process.stdout.write('\r' + ' '.repeat(20) + '\r');
      
      console.log(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
      console.log(chalk.yellow('Make sure Ollama is running with: ollama serve'));
    } finally {
      this.isProcessing = false;
    }
  }

  private displayCode(code: string) {
    // Simple code formatting with syntax highlighting hints
    const lines = code.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
        // Comments
        console.log(chalk.gray(line));
      } else if (line.includes('function') || line.includes('class') || line.includes('const') || line.includes('let')) {
        // Keywords
        console.log(chalk.cyan(line));
      } else {
        console.log(line);
      }
    }
  }

  private exit() {
    console.log('\n' + chalk.cyan('Goodbye! 👋'));
    this.rl.close();
    process.exit(0);
  }
}