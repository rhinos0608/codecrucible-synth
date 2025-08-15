import { CLIContext } from './cli.js';
import { logger } from './logger.js';
import chalk from 'chalk';
import { LocalModelClient } from './local-model-client.js';
import { ReActAgent } from './react-agent.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

interface Command {
  pattern: RegExp;
  handler: (match: RegExpMatchArray, input: string) => Promise<void>;
  description: string;
}

/**
 * Fully autonomous Claude Code-style client
 * No menus, no GUI, just natural conversation and work
 */
export class AutonomousClaudeClient {
  private context: CLIContext;
  private agent: ReActAgent;
  private isRunning = true;
  private currentDirectory = process.cwd();
  private conversationHistory: string[] = [];
  private rl: readline.Interface;
  private commands: Command[] = [];
  private isProcessing = false;

  constructor(context: CLIContext) {
    this.context = context;
    this.agent = new ReActAgent(context, this.currentDirectory);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: ''
    });
    this.setupCommands();
  }

  private setupCommands() {
    this.commands = [
      {
        pattern: /^\/help$/i,
        handler: async () => this.showHelp(),
        description: 'Show available commands'
      },
      {
        pattern: /^\/clear$/i,
        handler: async () => this.clearScreen(),
        description: 'Clear the screen'
      },
      {
        pattern: /^\/history$/i,
        handler: async () => this.showHistory(),
        description: 'Show conversation history'
      },
      {
        pattern: /^\/reset$/i,
        handler: async () => this.resetConversation(),
        description: 'Reset the conversation'
      },
      {
        pattern: /^\/cd\s+(.+)$/i,
        handler: async (match) => this.changeDirectory(match[1]),
        description: 'Change working directory'
      },
      {
        pattern: /^\/exit$/i,
        handler: async () => this.exit(),
        description: 'Exit the assistant'
      },
      {
        pattern: /^\/model\s+(.+)$/i,
        handler: async (match) => this.switchModel(match[1]),
        description: 'Switch to a different model'
      },
      {
        pattern: /^\/status$/i,
        handler: async () => this.showStatus(),
        description: 'Show system status'
      }
    ];
  }

  async start() {
    // Simple, clean startup - no menus or GUI
    console.log('CodeCrucible ready. Type your request or /help for commands.\n');
    
    // Start listening for input
    this.startInputLoop();
  }

  private startInputLoop() {
    this.rl.on('line', async (input) => {
      if (this.isProcessing) {
        console.log(chalk.yellow('Still processing previous request...'));
        return;
      }

      const trimmed = input.trim();
      if (!trimmed) return;

      this.isProcessing = true;
      
      try {
        // Check for slash commands
        const command = this.commands.find(cmd => cmd.pattern.test(trimmed));
        if (command) {
          const match = trimmed.match(command.pattern);
          if (match) {
            await command.handler(match, trimmed);
          }
        } else {
          // Natural language processing
          await this.processNaturalLanguage(trimmed);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error);
      } finally {
        this.isProcessing = false;
      }
    });

    this.rl.on('close', () => {
      console.log('\nGoodbye!');
      process.exit(0);
    });
  }

  private async processNaturalLanguage(input: string) {
    // Add to history
    this.conversationHistory.push(`User: ${input}`);
    
    // Detect intent from natural language
    const intent = this.detectIntent(input);
    
    switch (intent.type) {
      case 'code_generation':
        await this.generateCode(input);
        break;
      case 'file_operation':
        await this.handleFileOperation(intent.details);
        break;
      case 'explanation':
        await this.explainConcept(input);
        break;
      case 'debugging':
        await this.debugCode(intent.details);
        break;
      case 'refactoring':
        await this.refactorCode(intent.details);
        break;
      case 'testing':
        await this.generateTests(intent.details);
        break;
      case 'command':
        await this.executeCommand(intent.details);
        break;
      default:
        // Use the ReAct agent for complex tasks
        await this.handleWithAgent(input);
    }
  }

  private detectIntent(input: string): { type: string; details: any } {
    const lower = input.toLowerCase();
    
    // Code generation patterns
    if (lower.includes('create') || lower.includes('write') || lower.includes('generate') || 
        lower.includes('make') || lower.includes('build')) {
      return { type: 'code_generation', details: { prompt: input } };
    }
    
    // File operations
    if (lower.includes('read') || lower.includes('open') || lower.includes('show') || 
        lower.includes('edit') || lower.includes('modify')) {
      return { type: 'file_operation', details: { action: 'read', input } };
    }
    
    // Explanations
    if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does') ||
        lower.includes('why')) {
      return { type: 'explanation', details: { question: input } };
    }
    
    // Debugging
    if (lower.includes('debug') || lower.includes('fix') || lower.includes('error') || 
        lower.includes('bug')) {
      return { type: 'debugging', details: { problem: input } };
    }
    
    // Refactoring
    if (lower.includes('refactor') || lower.includes('improve') || lower.includes('optimize')) {
      return { type: 'refactoring', details: { target: input } };
    }
    
    // Testing
    if (lower.includes('test') || lower.includes('spec')) {
      return { type: 'testing', details: { scope: input } };
    }
    
    // Shell commands
    if (lower.startsWith('run ') || lower.startsWith('execute ') || lower.includes('npm') || 
        lower.includes('git')) {
      return { type: 'command', details: { command: input } };
    }
    
    return { type: 'general', details: { input } };
  }

  private async generateCode(prompt: string) {
    console.log(chalk.gray('Generating code...'));
    
    try {
      const response = await this.context.modelClient.generateFast(prompt, 2048);
      
      // Extract code from response if present
      const codeMatch = response.match(/```(\w+)?\n([\s\S]*?)```/);
      if (codeMatch) {
        const language = codeMatch[1] || 'javascript';
        const code = codeMatch[2];
        
        console.log(chalk.green(`\nGenerated ${language} code:`));
        console.log(chalk.cyan(code));
        
        // Ask if user wants to save it
        console.log(chalk.gray('\nWould you like me to save this to a file? (specify filename or say no)'));
        
      } else {
        console.log(response);
      }
      
      this.conversationHistory.push(`Assistant: Generated code for: ${prompt}`);
    } catch (error) {
      console.error(chalk.red('Failed to generate code:'), error);
    }
  }

  private async handleFileOperation(details: any) {
    const { action, input } = details;
    
    // Extract filename from natural language
    const fileMatch = input.match(/['"](.*?)['"]/);
    const filename = fileMatch ? fileMatch[1] : input.split(' ').pop();
    
    try {
      if (action === 'read') {
        const filepath = path.resolve(this.currentDirectory, filename);
        const content = await fs.readFile(filepath, 'utf-8');
        
        console.log(chalk.green(`\nContent of ${filename}:`));
        console.log(content);
        
        this.conversationHistory.push(`Assistant: Read file ${filename}`);
      }
    } catch (error) {
      console.error(chalk.red(`Cannot read ${filename}:`), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async explainConcept(question: string) {
    console.log(chalk.gray('Thinking...'));
    
    try {
      const response = await this.context.modelClient.generateFast(question, 1024);
      console.log('\n' + response);
      
      this.conversationHistory.push(`Assistant: Explained - ${question}`);
    } catch (error) {
      console.error(chalk.red('Failed to explain:'), error);
    }
  }

  private async debugCode(details: any) {
    console.log(chalk.gray('Analyzing issue...'));
    
    try {
      const prompt = `Debug this issue: ${details.problem}. Provide a solution.`;
      const response = await this.context.modelClient.generateFast(prompt, 2048);
      
      console.log(chalk.yellow('\nDebug Analysis:'));
      console.log(response);
      
      this.conversationHistory.push(`Assistant: Debugged - ${details.problem}`);
    } catch (error) {
      console.error(chalk.red('Failed to debug:'), error);
    }
  }

  private async refactorCode(details: any) {
    console.log(chalk.gray('Analyzing code for improvements...'));
    
    try {
      const response = await this.context.modelClient.generateFast(
        `Refactor and improve: ${details.target}`,
        2048
      );
      
      console.log(chalk.blue('\nRefactored Code:'));
      console.log(response);
      
      this.conversationHistory.push(`Assistant: Refactored code`);
    } catch (error) {
      console.error(chalk.red('Failed to refactor:'), error);
    }
  }

  private async generateTests(details: any) {
    console.log(chalk.gray('Generating tests...'));
    
    try {
      const response = await this.context.modelClient.generateFast(
        `Generate tests for: ${details.scope}`,
        2048
      );
      
      console.log(chalk.green('\nGenerated Tests:'));
      console.log(response);
      
      this.conversationHistory.push(`Assistant: Generated tests`);
    } catch (error) {
      console.error(chalk.red('Failed to generate tests:'), error);
    }
  }

  private async executeCommand(details: any) {
    const commandMatch = details.command.match(/(?:run|execute)\s+(.+)/i);
    const command = commandMatch ? commandMatch[1] : details.command;
    
    console.log(chalk.gray(`Executing: ${command}`));
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        cwd: this.currentDirectory,
        timeout: 30000 
      });
      
      if (stdout) console.log(stdout);
      if (stderr) console.error(chalk.yellow(stderr));
      
      this.conversationHistory.push(`Assistant: Executed command - ${command}`);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async handleWithAgent(input: string) {
    console.log(chalk.gray('Processing request...'));
    
    try {
      const response = await this.agent.processRequest(input);
      console.log('\n' + response);
      
      this.conversationHistory.push(`Assistant: ${response.substring(0, 100)}...`);
    } catch (error) {
      console.error(chalk.red('Failed to process:'), error);
    }
  }

  private async showHelp() {
    console.log(chalk.cyan('\nAvailable commands:'));
    this.commands.forEach(cmd => {
      const example = cmd.pattern.source.replace(/[\^$\\]/g, '');
      console.log(chalk.gray(`  ${example.padEnd(20)} - ${cmd.description}`));
    });
    
    console.log(chalk.cyan('\nNatural language examples:'));
    console.log(chalk.gray('  "Create a React component for a login form"'));
    console.log(chalk.gray('  "Explain how async/await works"'));
    console.log(chalk.gray('  "Debug this error: undefined is not a function"'));
    console.log(chalk.gray('  "Run npm test"'));
    console.log(chalk.gray('  "Show me the package.json file"'));
  }

  private async clearScreen() {
    console.clear();
    console.log('CodeCrucible ready.\n');
  }

  private async showHistory() {
    console.log(chalk.cyan('\nConversation History:'));
    this.conversationHistory.slice(-10).forEach(entry => {
      console.log(chalk.gray('  ' + entry));
    });
  }

  private async resetConversation() {
    this.conversationHistory = [];
    this.agent.reset();
    console.log(chalk.green('Conversation reset.'));
  }

  private async changeDirectory(dir: string) {
    try {
      const newPath = path.resolve(this.currentDirectory, dir);
      await fs.access(newPath);
      this.currentDirectory = newPath;
      process.chdir(newPath);
      console.log(chalk.green(`Changed to: ${this.currentDirectory}`));
    } catch (error) {
      console.error(chalk.red(`Cannot change to ${dir}`));
    }
  }

  private async switchModel(modelName: string) {
    console.log(chalk.gray(`Switching to model: ${modelName}...`));
    this.context.config.model.name = modelName;
    console.log(chalk.green(`Now using: ${modelName}`));
  }

  private async showStatus() {
    const status = {
      model: this.context.config.model.name,
      directory: this.currentDirectory,
      historySize: this.conversationHistory.length,
      agentMessages: this.agent.getContext().messages.length
    };
    
    console.log(chalk.cyan('\nSystem Status:'));
    Object.entries(status).forEach(([key, value]) => {
      console.log(chalk.gray(`  ${key}: ${value}`));
    });
  }

  private async exit() {
    console.log(chalk.yellow('Goodbye!'));
    this.isRunning = false;
    this.rl.close();
    process.exit(0);
  }
}