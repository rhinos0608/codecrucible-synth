
import { CLIContext } from './cli.js';
import { logger } from './logger.js';
import chalk from 'chalk';
import { AutonomousErrorHandler, ErrorContext } from './autonomous-error-handler.js';
import { IntelligentModelSelector } from './intelligent-model-selector.js';

/**
 * ClaudeCodeClient - A simple client that mimics the behavior of Claude Code.
 */
export class ClaudeCodeClient {
  private context: CLIContext;
  private isActive = false;
  private errorHandler: AutonomousErrorHandler;
  private modelSelector: IntelligentModelSelector;
  private retryAttempts = new Map<string, number>();

  constructor(context: CLIContext) {
    this.context = context;
    this.errorHandler = new AutonomousErrorHandler();
    this.modelSelector = new IntelligentModelSelector();
  }

  /**
   * Start the Claude Code client
   */
  async start(): Promise<void> {
    console.log(chalk.cyan('🤖 CodeCrucible Claude Code Mode'));
    console.log(chalk.gray('   A simple, direct interface to the local AI model.\n'));

    try {
      this.isActive = true;
      console.log(chalk.green('✅ Claude Code client ready.'));
      console.log(chalk.gray('   Type your request, or "help" for examples\n'));
      
      // Start the interactive loop
      await this.interactiveLoop();
      
    } catch (error) {
      logger.error('Failed to start Claude Code client:', error);
      console.error(chalk.red('❌ Failed to start:'), error);
    }
  }

  /**
   * Interactive command loop
   */
  private async interactiveLoop(): Promise<void> {
    const inquirer = (await import('inquirer')).default;
    
    while (this.isActive) {
      try {
        const { input } = await inquirer.prompt({
          type: 'input',
          name: 'input',
          message: chalk.blue('>>> ')
        });
        
        const trimmed = input.trim().toLowerCase();
        
        if (trimmed === 'exit' || trimmed === 'quit') {
          this.handleExit();
          break;
        }
        
        if (trimmed === 'help') {
          this.showHelp();
          continue;
        }
        
        if (input.trim()) {
          await this.processRequest(input.trim());
        }
        
        console.log(); // Add spacing
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('User force closed')) {
          this.handleExit();
          break;
        }
        console.error(chalk.red('Error:'), error);
      }
    }
  }

  /**
   * Process request with autonomous error handling and model selection
   */
  private async processRequest(input: string): Promise<void> {
    console.log(chalk.blue(`Processing: ${input}\n`));
    
    const startTime = Date.now();
    const taskType = this.analyzeTaskType(input);
    let currentModel = await this.modelSelector.selectOptimalModel(taskType, {
      complexity: this.assessComplexity(input),
      speed: 'medium',
      accuracy: 'high'
    });
    
    const retryKey = `${input.substring(0, 50)}-${currentModel}`;
    const previousAttempts = this.retryAttempts.get(retryKey) || 0;
    
    try {
      // Show thinking indicator
      const thinkingInterval = setInterval(() => {
        process.stdout.write(chalk.gray('.'));
      }, 500);
      
      logger.info(`🧠 Using model: ${currentModel} for ${taskType} task`);
      
      // Process with the selected model
      const response = await this.context.modelClient.generate(input);
      
      clearInterval(thinkingInterval);
      process.stdout.write('\n');
      
      // Record success
      const duration = Date.now() - startTime;
      this.modelSelector.recordPerformance(currentModel, taskType, true, duration, 1.0);
      this.retryAttempts.delete(retryKey); // Clear retry count on success
      
      // Display response
      console.log(chalk.green('Response:'));
      console.log(this.formatResponse(response));
      
    } catch (error) {
      logger.error('Failed to process request:', error);
      
      // Use autonomous error handling
      const errorContext: ErrorContext = {
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        operation: 'claude_code_generation',
        model: currentModel,
        context: { input, taskType, attempt: previousAttempts + 1 }
      };

      const recoveryActions = await this.errorHandler.analyzeAndRecover(errorContext);
      
      // Record failure
      const duration = Date.now() - startTime;
      this.modelSelector.recordPerformance(currentModel, taskType, false, duration, 0.0);
      
      // Check if we should retry with a different approach
      if (previousAttempts < 3) {
        this.retryAttempts.set(retryKey, previousAttempts + 1);
        
        // Check for model switch recommendation
        const switchAction = recoveryActions.find(action => action.action === 'switch_model');
        if (switchAction?.target) {
          console.log(chalk.yellow(`🔄 Autonomous recovery: Switching to ${switchAction.target}`));
          console.log(chalk.gray(`   Reason: ${switchAction.reason}`));
          
          // Wait a moment for any service restarts to complete
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Retry with the new approach
          return this.processRequest(input);
        }
        
        // If no specific model switch, try with a more capable model
        const fallbackModel = await this.modelSelector.getAdaptiveRecommendation(taskType, {
          urgency: 'high',
          complexity: 'complex',
          accuracy_needed: true,
          previous_failures: [currentModel]
        });
        
        if (fallbackModel !== currentModel) {
          console.log(chalk.yellow(`🔄 Autonomous recovery: Trying more capable model ${fallbackModel}`));
          
          // Wait a moment and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.processRequest(input);
        }
      }
      
      // Show user-friendly error with recovery information
      console.log(chalk.red('\n❌ Request failed after autonomous recovery attempts'));
      console.log(chalk.gray(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      
      if (recoveryActions.length > 0) {
        console.log(chalk.blue('\n🔧 Autonomous recovery actions taken:'));
        for (const action of recoveryActions) {
          console.log(chalk.gray(`   • ${action.action}: ${action.reason}`));
        }
      }
      
      console.log(chalk.blue('\n💡 Try:'));
      console.log(chalk.gray('   • Simplifying your request'));
      console.log(chalk.gray('   • Checking if Ollama is running: ollama serve'));
      console.log(chalk.gray('   • Checking model status: cc model --status'));
    }
  }

  /**
   * Format response for better display
   */
  private formatResponse(response: string): string {
    // Format code blocks
    const formattedResponse = response.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (_, lang, code) => {
      return `\n${chalk.gray('┌─ Code ' + (lang ? `(${lang})` : '') + ' ─'.repeat(50))}\n${chalk.cyan(code)}\n${chalk.gray('└─' + '─'.repeat(60))}\n`;
    });
    
    return formattedResponse;
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(chalk.cyan(`
🤖 CodeCrucible Claude Code Mode

COMMANDS:
  help     - Show this help message
  exit     - Exit the client

EXAMPLES:
  "Create a React component for a login form."
  "Write a Python function to calculate the factorial of a number."
  "Explain the difference between a class and an interface in TypeScript."
`));
  }

  /**
   * Handle graceful exit
   */
  private handleExit(): void {
    console.log(chalk.yellow('👋 Claude Code client shutting down. Goodbye!'));
    this.isActive = false;
  }

  /**
   * Analyze the type of task based on user input
   */
  private analyzeTaskType(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('code') || lowerInput.includes('function') || lowerInput.includes('implement') || lowerInput.includes('write')) {
      return 'coding';
    }
    
    if (lowerInput.includes('debug') || lowerInput.includes('fix') || lowerInput.includes('error') || lowerInput.includes('bug')) {
      return 'debugging';
    }
    
    if (lowerInput.includes('analyze') || lowerInput.includes('review') || lowerInput.includes('understand') || lowerInput.includes('explain')) {
      return 'analysis';
    }
    
    if (lowerInput.includes('plan') || lowerInput.includes('design') || lowerInput.includes('architecture') || lowerInput.includes('strategy')) {
      return 'planning';
    }
    
    return 'chat';
  }

  /**
   * Assess the complexity of a task
   */
  private assessComplexity(input: string): 'simple' | 'medium' | 'complex' {
    const lowerInput = input.toLowerCase();
    
    // Simple task indicators
    if (lowerInput.includes('simple') || lowerInput.includes('basic') || lowerInput.includes('quick') || 
        lowerInput.length < 50 || lowerInput.split(' ').length < 10) {
      return 'simple';
    }
    
    // Complex task indicators
    if (lowerInput.includes('complex') || lowerInput.includes('advanced') || lowerInput.includes('comprehensive') ||
        lowerInput.includes('architecture') || lowerInput.includes('system') || lowerInput.includes('full') ||
        lowerInput.length > 200 || lowerInput.split(' ').length > 40) {
      return 'complex';
    }
    
    return 'medium';
  }
}
