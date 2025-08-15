import { CLIContext } from './cli.js';
import { ReActAgent } from './react-agent.js';
import { logger } from './logger.js';
import { FileWatcher, FileChangeEvent } from './file-watcher.js';
import chalk from 'chalk';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Enhanced Agentic Client - Advanced version with ReAct pattern
 * 
 * Features:
 * - ReAct (Reasoning → Acting → Observing) agent pattern
 * - Structured tool calling system
 * - Multi-step task planning and execution
 * - Persistent conversation memory
 * - Better code understanding and context
 */
export class EnhancedAgenticClient {
  private context: CLIContext;
  private agent: ReActAgent;
  private fileWatcher: FileWatcher;
  private isActive = false;
  private watchEnabled = true;
  private conversationHistory: Array<{ role: string; content: string; timestamp: number }> = [];

  constructor(context: CLIContext, options: { enableFileWatching?: boolean } = {}) {
    this.context = context;
    this.agent = new ReActAgent(context, process.cwd());
    this.watchEnabled = options.enableFileWatching ?? true;
    this.fileWatcher = new FileWatcher(process.cwd(), {
      debounceMs: 2000, // Longer debounce for less noise
      includeContent: true,
      maxFileSize: 512 * 1024 // 512KB max
    });
    this.setupFileWatcher();
  }

  /**
   * Setup file watcher for real-time assistance
   */
  private setupFileWatcher(): void {
    if (!this.watchEnabled) return;

    this.fileWatcher.on('change', this.handleFileChange.bind(this));
    this.fileWatcher.on('error', (error) => {
      logger.error('File watcher error:', error);
    });
    this.fileWatcher.on('ready', () => {
      logger.info('Real-time file watching active');
    });
  }

  /**
   * Handle file change events with contextual assistance
   */
  private async handleFileChange(event: FileChangeEvent): Promise<void> {
    try {
      // Only process significant code files
      if (!this.isSignificantFile(event.relativePath, event.language)) {
        return;
      }

      // Avoid noise from rapid changes
      if (Date.now() - event.timestamp > 5000) {
        return;
      }

      console.log(chalk.yellow(`\n📝 File ${event.type}: ${event.relativePath}`));
      
      if (event.type === 'change' && event.content) {
        // Analyze the change for potential issues or suggestions
        const analysis = await this.analyzeFileChange(event);
        if (analysis) {
          console.log(chalk.gray('💡 Suggestion:'), analysis);
        }
      }

    } catch (error) {
      logger.error('Error handling file change:', error);
    }
  }

  /**
   * Check if file is significant enough to trigger assistance
   */
  private isSignificantFile(filePath: string, language: string): boolean {
    const significantLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c',
      'csharp', 'php', 'ruby', 'go', 'rust'
    ];
    
    // Skip test files, config files, and generated files
    const skipPatterns = [
      /\.test\./,
      /\.spec\./,
      /\.config\./,
      /\.generated\./,
      /node_modules/,
      /\.min\./
    ];
    
    return significantLanguages.includes(language) && 
           !skipPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Analyze file changes and provide contextual suggestions
   */
  private async analyzeFileChange(event: FileChangeEvent): Promise<string | null> {
    if (!event.content || event.content.length > 10000) {
      return null;
    }

    try {
      // Use fast model for quick analysis
      const prompt = `Briefly analyze this ${event.language} code change for potential issues:

\`\`\`${event.language}
${event.content.slice(0, 2000)}\n\`\`\`

Provide a single, concise suggestion if you see any obvious issues, otherwise respond with "Looks good".`;
      
      const suggestion = await this.context.modelClient.generateFast(prompt, 150);
      
      if (suggestion.toLowerCase().includes('looks good')) {
        return null;
      }
      
      return suggestion.trim();
      
    } catch (error) {
      logger.error('Error analyzing file change:', error);
      return null;
    }
  }

  /**
   * Start the enhanced agentic client
   */
  async start(): Promise<void> {
    console.log(chalk.cyan('🤖 CodeCrucible Enhanced Autonomous Agent'));
    console.log(chalk.gray('   Powered by ReAct pattern with advanced planning capabilities\n'));

    try {
      // Load conversation history if it exists
      await this.loadConversationHistory();
      
      // Start file watching if enabled
      if (this.watchEnabled) {
        await this.fileWatcher.start();
      }
      
      this.isActive = true;
      console.log(chalk.green('✅ Enhanced agent ready with the following capabilities:'));
      
      // Show available tools
      const tools = this.agent.getAvailableTools();
      console.log(chalk.gray('   Available tools:'));
      tools.forEach(tool => {
        console.log(chalk.gray(`   • ${tool.definition.name}: ${tool.definition.description}`));
      });
      
      console.log(chalk.gray('\n   Enhanced features:'));
      console.log(chalk.gray('   • Multi-step task planning'));
      if (this.watchEnabled) {
        console.log(chalk.gray('   • Real-time file watching'));
      }
      console.log(chalk.gray('   • Reasoning → Acting → Observing cycles'));
      console.log(chalk.gray('   • Persistent conversation memory'));
      console.log(chalk.gray('   • Advanced code understanding'));
      console.log(chalk.gray('   • Structured tool calling'));
      
      console.log(chalk.gray('\n   Type your request, or "help" for examples\n'));
      
      // Start the interactive loop
      await this.interactiveLoop();
      
    } catch (error) {
      logger.error('Failed to start enhanced agentic client:', error);
      console.error(chalk.red('❌ Failed to start:'), error);
    }
  }

  /**
   * Interactive command loop with enhanced capabilities
   */
  private async interactiveLoop(): Promise<void> {
    const inquirer = (await import('inquirer')).default;
    
    while (this.isActive) {
      try {
        const { input } = await inquirer.prompt({
          type: 'input',
          name: 'input',
          message: chalk.blue('🧠 ')
        });
        
        const trimmed = input.trim().toLowerCase();
        
        if (trimmed === 'exit' || trimmed === 'quit') {
          await this.handleExit();
          break;
        }
        
        if (trimmed === 'help') {
          this.showEnhancedHelp();
          continue;
        }

        if (trimmed === 'status') {
          this.showAgentStatus();
          continue;
        }

        if (trimmed === 'memory') {
          this.showMemory();
          continue;
        }

        if (trimmed === 'tools') {
          this.showAvailableTools();
          continue;
        }

        if (trimmed === 'clear') {
          this.clearMemory();
          continue;
        }
        
        if (input.trim()) {
          await this.processEnhancedRequest(input.trim());
        }
        
        console.log(); // Add spacing
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('User force closed')) {
          await this.handleExit();
          break;
        }
        console.error(chalk.red('Error:'), error);
      }
    }
  }

  /**
   * Process request using ReAct agent
   */
  private async processEnhancedRequest(input: string): Promise<void> {
    console.log(chalk.blue(`🎯 Processing: ${input}\n`));
    
    // Record the user input
    this.conversationHistory.push({
      role: 'user',
      content: input,
      timestamp: Date.now()
    });
    
    try {
      // Show thinking indicator
      const thinkingInterval = setInterval(() => {
        process.stdout.write(chalk.gray('.'));
      }, 500);
      
      // Process with ReAct agent
      const response = await this.agent.processRequest(input);
      
      clearInterval(thinkingInterval);
      process.stdout.write('\n');
      
      // Display response
      console.log(chalk.green('🤖 Agent Response:'));
      console.log(this.formatResponse(response));
      
      // Record the agent response
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });
      
      // Save conversation history
      await this.saveConversationHistory();
      
    } catch (error) {
      logger.error('Failed to process enhanced request:', error);
      console.error(chalk.red('❌ Request failed:'), error instanceof Error ? error.message : 'Unknown error');
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
   * Show enhanced help information
   */
  private showEnhancedHelp(): void {
    console.log(chalk.cyan(`
🧠 Enhanced CodeCrucible Agent

CAPABILITIES:
  Multi-step Planning  - Breaks complex tasks into executable steps
  Tool Integration     - Uses structured tools for file operations
  Memory Management    - Maintains conversation context
  Code Understanding   - Advanced analysis and generation

EXAMPLE REQUESTS:
  "Create a React authentication component with TypeScript"
  "Find all TODO comments in the codebase and create a report"
  "Refactor the user service to use proper error handling"
  "Analyze the performance of the database queries"
  "Set up testing for the payment module"
  "Add comprehensive documentation to the API endpoints"

ADVANCED COMMANDS:
  help     - Show this help message
  status   - Show agent status and capabilities
  memory   - Display conversation memory
  tools    - List available tools
  clear    - Clear conversation memory
  exit     - Exit the agent

The agent will automatically:
• Analyze your request and create a plan
• Execute necessary steps using appropriate tools
• Synthesize results into a comprehensive response
• Learn from the conversation context
`));
  }

  /**
   * Show current agent status
   */
  private showAgentStatus(): void {
    const agentContext = this.agent.getContext();
    const tools = this.agent.getAvailableTools();
    
    console.log(chalk.green(`🤖 Enhanced Agent Status:
  Working Directory: ${agentContext.workingDirectory}
  Conversation Messages: ${agentContext.messages.length}
  Available Tools: ${tools.length}
  Current Plan: ${agentContext.currentPlan ? `${agentContext.currentPlan.length} steps` : 'None'}
  Model: ${this.context.config.model.name}
  Endpoint: ${this.context.config.model.endpoint}
  
Tool Categories:
${tools.reduce((acc, tool) => {
  acc[tool.definition.category] = (acc[tool.definition.category] || 0) + 1;
  return acc;
}, {} as Record<string, number>).toString()}
`));
  }

  /**
   * Show conversation memory
   */
  private showMemory(): void {
    const agentContext = this.agent.getContext();
    
    console.log(chalk.cyan('💭 Conversation Memory:'));
    
    if (agentContext.messages.length === 0) {
      console.log(chalk.gray('  No messages in memory'));
      return;
    }
    
    agentContext.messages.slice(-10).forEach((msg, i) => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const roleColor = msg.role === 'user' ? chalk.blue : msg.role === 'assistant' ? chalk.green : chalk.gray;
      console.log(`${roleColor(msg.role)} [${time}]: ${msg.content.slice(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
    });
    
    if (agentContext.messages.length > 10) {
      console.log(chalk.gray(`  ... and ${agentContext.messages.length - 10} earlier messages`));
    }
  }

  /**
   * Show available tools
   */
  private showAvailableTools(): void {
    const tools = this.agent.getAvailableTools();
    
    console.log(chalk.cyan('🛠️  Available Tools:'));
    
    const toolsByCategory = tools.reduce((acc, tool) => {
      if (!acc[tool.definition.category]) acc[tool.definition.category] = [];
      acc[tool.definition.category].push(tool);
      return acc;
    }, {} as Record<string, typeof tools>);
    
    Object.entries(toolsByCategory).forEach(([category, categoryTools]) => {
      console.log(chalk.yellow(`\n${category.toUpperCase()}:`));
      categoryTools.forEach(tool => {
        console.log(chalk.gray(`  • ${tool.definition.name}: ${tool.definition.description}`));
        if (tool.definition.examples) {
          console.log(chalk.gray(`    Examples: ${tool.definition.examples.join(', ')}`));
        }
      });
    });
  }

  /**
   * Clear conversation memory
   */
  private clearMemory(): void {
    this.agent.reset();
    this.conversationHistory = [];
    console.log(chalk.yellow('🧹 Memory cleared'));
  }

  /**
   * Handle graceful exit
   */
  private async handleExit(): Promise<void> {
    console.log(chalk.yellow('💾 Saving conversation history...'));
    await this.saveConversationHistory();
    
    if (this.watchEnabled && this.fileWatcher.isWatching()) {
      console.log(chalk.yellow('⏹️  Stopping file watcher...'));
      await this.fileWatcher.stop();
    }
    
    console.log(chalk.yellow('👋 Enhanced agent shutting down. Goodbye!'));
    this.isActive = false;
  }

  /**
   * Load conversation history from disk
   */
  private async loadConversationHistory(): Promise<void> {
    try {
      const historyPath = join(process.cwd(), '.codecrucible', 'conversation-history.json');
      const content = await readFile(historyPath, 'utf8');
      this.conversationHistory = JSON.parse(content);
      
      // Restore agent memory with recent messages
      this.conversationHistory.slice(-20).forEach(msg => {
        // Add to agent memory (simplified)
        // The agent's addMessage method is private, so we'll let it rebuild context naturally
      });
      
      console.log(chalk.gray(`📖 Loaded ${this.conversationHistory.length} previous messages`));
    } catch {
      // No history file exists yet, start fresh
      this.conversationHistory = [];
    }
  }

  /**
   * Save conversation history to disk
   */
  private async saveConversationHistory(): Promise<void> {
    try {
      const historyPath = join(process.cwd(), '.codecrucible', 'conversation-history.json');
      
      // Ensure directory exists
      const fs = await import('fs/promises');
      await fs.mkdir(join(process.cwd(), '.codecrucible'), { recursive: true });
      
      // Keep only last 100 messages to avoid huge files
      const recentHistory = this.conversationHistory.slice(-100);
      await writeFile(historyPath, JSON.stringify(recentHistory, null, 2));
    } catch (error) {
      logger.warn('Failed to save conversation history:', error);
    }
  }
}