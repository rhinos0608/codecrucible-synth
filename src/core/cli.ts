import { LocalModelClient, ProjectContext } from './local-model-client.js';
import { VoiceArchetypeSystem, SynthesisResult, IterativeResult } from '../voices/voice-archetype-system.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../config/config-manager.js';
import { logger } from './logger.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { readFile, stat, readdir } from 'fs/promises';
import { join, extname, relative } from 'path';
import { glob } from 'glob';

interface CLIOptions {
  voices?: string;
  depth?: string;
  mode?: string;
  file?: string;
  project?: boolean;
  interactive?: boolean;
  council?: boolean;
}

export interface CLIContext {
  modelClient: LocalModelClient;
  voiceSystem: VoiceArchetypeSystem;
  mcpManager: MCPServerManager;
  config: AppConfig;
}

export class CodeCrucibleCLI {
  private context: CLIContext;

  constructor(context: CLIContext) {
    this.context = context;
  }

  async handleGeneration(prompt: string, options: CLIOptions): Promise<void> {
    try {
      if (options.interactive) {
        await this.handleInteractiveMode(options);
        return;
      }

      if (!prompt) {
        console.log(chalk.yellow('💡 No prompt provided. Starting interactive mode...'));
        console.log(chalk.gray('   You can also use: cc "Your prompt here" for direct commands'));
        await this.handleInteractiveMode(options);
        return;
      }

      console.log(chalk.blue('🚀 Starting CodeCrucible generation...'));
      console.log(chalk.gray(`   Prompt: ${prompt}`));

      // Parse options
      const voices = this.parseVoices(options.voices || options.council ? 'all' : undefined);
      const synthesisMode = (options.mode as any) || 'competitive';
      const analysisDepth = parseInt(options.depth || '2');

      console.log(chalk.cyan(`   Voices: ${Array.isArray(voices) ? voices.join(', ') : voices}`));
      console.log(chalk.cyan(`   Mode: ${synthesisMode}`));

      // Get project context
      const projectContext = await this.getProjectContext(options.file, options.project);

      // Check for iterative mode
      if ((options as any).iterative || synthesisMode === 'iterative') {
        const spinner = ora('Starting iterative Writer/Auditor improvement loop...').start();
        
        try {
          spinner.stop();
          const iterativeResult = await this.context.voiceSystem.generateIterativeCodeImprovement(
            prompt,
            projectContext,
            parseInt((options as any).maxIterations || '5'),
            parseInt((options as any).qualityThreshold || '85')
          );

          this.displayIterativeResults(iterativeResult);
          
        } catch (error) {
          spinner.fail('Iterative generation failed');
          logger.error('Iterative generation failed:', error);
          console.error(chalk.red('❌ Iterative generation failed:'), error instanceof Error ? error.message : error);
        }
        return;
      }

      // Check if single voice mode
      if (Array.isArray(voices) && voices.length === 1) {
        // Single voice mode - no synthesis needed
        const spinner = ora(`Generating response from ${voices[0]}...`).start();
        
        try {
          const singleResponse = await this.context.voiceSystem.generateSingleVoiceResponse(
            prompt,
            voices[0],
            projectContext
          );

          spinner.succeed('Generation completed!');

          // Display single voice result
          console.log(chalk.green('\n📄 Response:\n'));
          console.log(singleResponse.content);
          
        } catch (error) {
          spinner.fail('Generation failed');
          logger.error('Single voice generation failed:', error);
          console.error(chalk.red('❌ Generation failed:'), error instanceof Error ? error.message : error);
        }
        return;
      }

      // Multi-voice mode with sequential processing
      const spinner = ora('Generating solutions from multiple voices sequentially...').start();
      
      try {
        const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(
          prompt,
          voices,
          projectContext
        );

        if (responses.length === 0) {
          spinner.fail('All voice generations failed');
          console.error(chalk.red('❌ All voice generations failed'));
          return;
        }

        if (responses.length === 1) {
          // Only one voice succeeded, display directly without synthesis
          spinner.succeed('Generation completed!');
          console.log(chalk.green('\n📄 Response:\n'));
          console.log(responses[0].content);
          return;
        }

        spinner.text = 'Synthesizing voice responses...';
        
        const synthesis = await this.context.voiceSystem.synthesizeVoiceResponses(
          responses,
          synthesisMode
        );

        spinner.succeed('Generation completed!');

        // Display results
        this.displayResults(synthesis, responses);

        // Handle file output
        if (options.file) {
          await this.handleFileOutput(options.file, synthesis.combinedCode);
        }

      } catch (error) {
        spinner.fail('Generation failed');
        throw error;
      }

    } catch (error) {
      logger.error('Generation failed:', error);
      console.error(chalk.red('❌ Generation failed:'), error instanceof Error ? error.message : error);
    }
  }

  async handleCouncilMode(prompt: string, options: any): Promise<void> {
    const parsedVoices = options.voices ? this.parseVoices(options.voices) : this.context.config.voices.available;
    const councilVoices = Array.isArray(parsedVoices) ? parsedVoices : this.context.config.voices.available;

    console.log(chalk.magenta('🏛️  Convening the full Council of Voices...'));
    
    await this.handleGeneration(prompt, {
      ...options,
      voices: councilVoices.join(','),
      mode: 'collaborative'
    });
  }

  async handleVoiceSpecific(voice: string, prompt: string): Promise<void> {
    console.log(chalk.green(`🎭 Consulting ${voice}...`));
    
    const voiceArchetype = this.context.voiceSystem.getVoice(voice);
    if (!voiceArchetype) {
      console.error(chalk.red(`❌ Unknown voice: ${voice}`));
      console.log(chalk.gray('Available voices:'), this.context.config.voices.available.join(', '));
      return;
    }

    const spinner = ora(`${voice} is thinking...`).start();
    
    try {
      const projectContext = await this.getProjectContext();
      const response = await this.context.modelClient.generateVoiceResponse(
        voiceArchetype,
        prompt,
        projectContext
      );

      spinner.succeed(`${voice} has responded!`);

      console.log(chalk.bold(`\n🎭 ${response.voice}:`));
      console.log(chalk.gray(`Confidence: ${Math.round(response.confidence * 100)}%`));
      console.log(chalk.gray(`Tokens: ${response.tokens_used}`));
      console.log('\n' + response.content);

    } catch (error) {
      spinner.fail(`${voice} encountered an error`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red('❌ Error:', errorMessage));
      
      // Show troubleshooting help for common issues
      if (errorMessage.includes('Ollama') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
        const { LocalModelClient } = await import('./local-model-client.js');
        LocalModelClient.displayTroubleshootingHelp();
      }
      throw error;
    }
  }

  async handleFileOperation(operation: string, filepath: string, options: any): Promise<void> {
    console.log(chalk.blue(`📁 File ${operation}: ${filepath}`));

    try {
      const fileContent = await readFile(filepath, 'utf8');
      const fileExt = extname(filepath);
      const language = this.detectLanguage(fileExt);

      let prompt = '';
      switch (operation) {
        case 'analyze':
          prompt = `Analyze this ${language} file and provide insights on code quality, potential issues, and improvements.`;
          break;
        case 'refactor':
          prompt = `You are a senior software engineer specializing in code refactoring. Your task is to refactor the following ${language} code to improve:

1. **Readability** - Make the code clearer and more self-documenting
2. **Maintainability** - Reduce complexity and improve modularity  
3. **Performance** - Optimize for better efficiency where applicable
4. **Best Practices** - Apply modern ${language} patterns and conventions

**CRITICAL REQUIREMENTS:**
- Preserve ALL existing functionality and behavior
- Maintain the same public API/interface
- Add explanatory comments for significant changes
- Use modern ${language} features and patterns
- Follow established naming conventions
- Ensure type safety (if applicable)

**Original Code to Refactor:**
\`\`\`${language}
${fileContent}
\`\`\`

**Instructions:**
1. Analyze the code structure and identify refactoring opportunities
2. Provide the complete refactored code with improvements
3. Explain the key changes made and why they improve the code
4. Ensure the refactored code is production-ready

Respond with the refactored code in a code block, followed by a detailed explanation of changes.`;
          break;
        case 'explain':
          prompt = `Explain what this ${language} code does, including its purpose, key components, and how it works.`;
          break;
        case 'test':
          prompt = `Generate comprehensive unit tests for this ${language} code.`;
          break;
        default:
          console.error(chalk.red(`❌ Unknown operation: ${operation}`));
          return;
      }

      const context: ProjectContext = {
        files: [{
          path: filepath,
          content: fileContent,
          language
        }]
      };

      const voices = this.parseVoices(options.voices);
      
      // Use specialized voices for refactoring operations
      let selectedVoices = voices;
      if (operation === 'refactor' && (!options.voices || options.voices === 'auto')) {
        selectedVoices = ['refactoring-specialist', 'maintainer']; // Best voices for refactoring
      }
      
      await this.handleGeneration(prompt, { ...options, voices: Array.isArray(selectedVoices) ? selectedVoices.join(',') : selectedVoices });

    } catch (error) {
      logger.error('File operation failed:', error);
      console.error(chalk.red('❌ File operation failed:'), error instanceof Error ? error.message : error);
    }
  }

  async handleProjectOperation(operation: string, options: any): Promise<void> {
    console.log(chalk.blue(`🏗️  Project ${operation}`));

    try {
      const pattern = options.pattern || '**/*.{js,ts,jsx,tsx,py,java,cpp,c,h}';
      const files = await glob(pattern, { ignore: ['node_modules/**', '.git/**', 'dist/**'] });

      if (files.length === 0) {
        console.log(chalk.yellow('No files found matching pattern'));
        return;
      }

      console.log(chalk.gray(`Found ${files.length} files`));

      const contextFiles = await this.buildProjectContext(files.slice(0, 10)); // Limit to first 10 files
      const projectContext: ProjectContext = { files: contextFiles };

      let prompt = '';
      switch (operation) {
        case 'analyze':
          prompt = 'Analyze this project structure and provide insights on architecture, code quality, and potential improvements.';
          break;
        case 'refactor':
          prompt = `You are a senior software architect conducting a project-wide refactoring analysis. Based on the provided codebase files, identify and prioritize refactoring opportunities.

**Analysis Framework:**

1. **Architecture Assessment**
   - Evaluate overall code organization and structure
   - Identify architectural patterns and anti-patterns
   - Assess modularity and separation of concerns

2. **Code Quality Issues**
   - Find code duplication and opportunities for abstraction
   - Identify overly complex functions/classes that need simplification
   - Spot inconsistent naming conventions and coding styles

3. **Performance Optimization**
   - Identify performance bottlenecks and inefficiencies
   - Suggest optimization opportunities
   - Recommend better data structures or algorithms

4. **Maintainability Improvements**
   - Find tightly coupled components that need decoupling
   - Identify missing error handling and edge case management
   - Suggest improvements for testability

**Required Output:**
1. **Executive Summary** - Top 3-5 critical refactoring priorities
2. **Detailed Analysis** - Specific files and code sections to refactor
3. **Implementation Plan** - Step-by-step refactoring roadmap
4. **Risk Assessment** - Potential impacts and mitigation strategies
5. **Code Examples** - Before/after snippets for key improvements

Focus on actionable, specific recommendations with clear business value.`;
          break;
        case 'test':
          prompt = 'Analyze the project and suggest a comprehensive testing strategy with example test cases.';
          break;
        case 'document':
          prompt = 'Generate documentation for this project including README, API docs, and code comments.';
          break;
        default:
          console.error(chalk.red(`❌ Unknown operation: ${operation}`));
          return;
      }

      const voices = this.parseVoices(options.voices);
      
      // Use specialized voices for refactoring operations
      let selectedVoices = voices;
      if (operation === 'refactor' && (!options.voices || options.voices === 'auto')) {
        selectedVoices = ['refactoring-specialist', 'architect', 'maintainer']; // Best voices for project refactoring
      }
      
      console.log(chalk.cyan(`Analyzing ${files.length} files with voices: ${Array.isArray(selectedVoices) ? selectedVoices.join(', ') : selectedVoices}`));

      const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(
        prompt,
        selectedVoices,
        projectContext
      );

      const synthesis = await this.context.voiceSystem.synthesizeVoiceResponses(
        responses,
        'collaborative'
      );

      this.displayResults(synthesis, responses);

    } catch (error) {
      logger.error('Project operation failed:', error);
      console.error(chalk.red('❌ Project operation failed:'), error instanceof Error ? error.message : error);
    }
  }

  async handleInteractiveMode(options: any): Promise<void> {
    console.log(chalk.magenta('🎯 Welcome to CodeCrucible Interactive Mode!'));
    console.log(chalk.gray('Type "exit" to quit, "help" for commands\n'));

    const parsedVoices = this.parseVoices(options.voices);
    const defaultVoices = Array.isArray(parsedVoices) ? parsedVoices : ['developer', 'analyzer'];

    while (true) {
      try {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: '💡 Generate code', value: 'generate' },
              { name: '📁 Analyze file', value: 'file' },
              { name: '🏗️  Project operation', value: 'project' },
              { name: '🎭 Single voice consultation', value: 'voice' },
              { name: '🤖 Select AI model', value: 'model' },
              { name: '⚙️  Configure settings', value: 'config' },
              { name: '🚪 Exit', value: 'exit' }
            ]
          }
        ]);

        if (action === 'exit') {
          console.log(chalk.green('👋 Goodbye!'));
          break;
        }

        await this.handleInteractiveAction(action, defaultVoices);

      } catch (error) {
        if (error instanceof Error && error.message.includes('User force closed')) {
          console.log(chalk.green('\n👋 Goodbye!'));
          break;
        }
        console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      }
    }
  }

  async handleConfig(options: any): Promise<void> {
    const { ConfigManager } = await import('../config/config-manager.js');

    if (options.set) {
      const [key, value] = options.set.split('=');
      if (!key || value === undefined) {
        console.error(chalk.red('❌ Invalid format. Use: --set key=value'));
        return;
      }

      const configManager = await ConfigManager.getInstance();
      await configManager.set(key, this.parseValue(value));
      console.log(chalk.green(`✅ Set ${key} = ${value}`));

    } else if (options.get) {
      const configManager = await ConfigManager.getInstance();
      const value = await configManager.get(options.get);
      console.log(chalk.cyan(`${options.get}:`), JSON.stringify(value, null, 2));

    } else if (options.list) {
      const configManager = await ConfigManager.getInstance();
      const all = configManager.getAll();
      console.log(chalk.cyan('Current configuration:'));
      console.log(JSON.stringify(all, null, 2));

    } else if (options.reset) {
      const configManager = await ConfigManager.getInstance();
      await configManager.reset();
      console.log(chalk.green('✅ Configuration reset to defaults'));

    } else {
      console.log(chalk.yellow('Use --set, --get, --list, or --reset'));
    }
  }

  async handleModelManagement(options: any): Promise<void> {
    const { EnhancedModelManager } = await import('./enhanced-model-manager.js');
    const modelManager = new EnhancedModelManager(this.context.config.model.endpoint);

    if (options.status) {
      const spinner = ora('Checking system status...').start();
      
      try {
        const status = await modelManager.checkOllamaStatus();
        const isReady = await this.context.modelClient.checkConnection();
        
        spinner.stop();
        
        console.log(chalk.cyan('\n🔍 System Status:'));
        console.log(chalk.gray(`   Ollama installed: ${status.installed ? '✅' : '❌'}`));
        console.log(chalk.gray(`   Ollama running: ${status.running ? '✅' : '❌'}`));
        if (status.version) {
          console.log(chalk.gray(`   Version: ${status.version}`));
        }
        
        if (isReady) {
          const bestModel = await modelManager.getBestAvailableModel();
          console.log(chalk.green(`✅ AI model ready: ${bestModel}`));
          
          // Show available models
          const models = await modelManager.getAvailableModels();
          const installed = models.filter(m => m.available);
          if (installed.length > 1) {
            console.log(chalk.cyan('\n📚 Available models:'));
            installed.forEach(model => {
              console.log(chalk.gray(`   • ${model.name} (${model.size})${model.name === bestModel ? ' ⭐ active' : ''}`));
            });
          }
        } else {
          console.log(chalk.red('❌ No AI models available'));
          console.log(chalk.yellow('💡 Run: cc model --setup'));
        }
        
      } catch (error) {
        spinner.fail('Status check failed');
        console.error(chalk.red('❌ Status check failed:'), error instanceof Error ? error.message : error);
      }
    }

    if (options.setup || options.install) {
      console.log(chalk.blue('🚀 Starting CodeCrucible setup...\n'));
      
      try {
        const result = await modelManager.autoSetup(true);
        
        if (result.success) {
          console.log(chalk.green('🎉 Setup completed successfully!'));
          console.log(chalk.gray(`   Model: ${result.model}`));
          console.log(chalk.gray('   You can now use CodeCrucible normally.\n'));
          
          // Update config with new model
          if (result.model) {
            const { ConfigManager } = await import('../config/config-manager.js');
            const configManager = await ConfigManager.getInstance();
            await configManager.set('model.name', result.model);
          }
        } else {
          console.log(chalk.red('❌ Setup failed. Please check the instructions above.'));
        }
        
      } catch (error) {
        console.error(chalk.red('❌ Setup failed:'), error instanceof Error ? error.message : error);
      }
    }

    if (options.list) {
      console.log(chalk.cyan('📚 Available Models:\n'));
      
      try {
        const models = await modelManager.getAvailableModels();
        
        models.forEach(model => {
          const status = model.available ? chalk.green('✅ Installed') : chalk.gray('⬇️  Available');
          console.log(chalk.white(`${model.name}`));
          console.log(chalk.gray(`   ${model.description}`));
          console.log(chalk.gray(`   Size: ${model.size} | Status: ${status}`));
          if (model.family) {
            console.log(chalk.gray(`   Family: ${model.family} | Parameters: ${model.parameters}`));
          }
          console.log();
        });
        
      } catch (error) {
        console.error(chalk.red('❌ Failed to list models:'), error instanceof Error ? error.message : error);
      }
    }

    if (options.pull) {
      const modelName = options.pull;
      console.log(chalk.blue(`📥 Pulling model: ${modelName}`));
      
      try {
        const success = await modelManager.pullModel(modelName);
        if (success) {
          console.log(chalk.green(`✅ Successfully installed ${modelName}!`));
        } else {
          console.log(chalk.red(`❌ Failed to install ${modelName}`));
        }
      } catch (error) {
        console.error(chalk.red('❌ Pull failed:'), error instanceof Error ? error.message : error);
      }
    }

    if (options.test) {
      const modelName = options.test === true ? await modelManager.getBestAvailableModel() : options.test;
      if (!modelName) {
        console.log(chalk.red('❌ No model specified and no models available'));
        return;
      }
      
      console.log(chalk.blue(`🧪 Testing model: ${modelName}`));
      
      try {
        const success = await modelManager.testModel(modelName);
        if (success) {
          console.log(chalk.green(`✅ Model ${modelName} is working correctly!`));
        } else {
          console.log(chalk.red(`❌ Model ${modelName} test failed`));
        }
      } catch (error) {
        console.error(chalk.red('❌ Test failed:'), error instanceof Error ? error.message : error);
      }
    }

    if (options.remove) {
      const modelName = options.remove;
      console.log(chalk.yellow(`🗑️  Removing model: ${modelName}`));
      
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to remove ${modelName}?`,
        default: false
      }]);
      
      if (confirm) {
        try {
          const success = await modelManager.removeModel(modelName);
          if (success) {
            console.log(chalk.green(`✅ Successfully removed ${modelName}!`));
          } else {
            console.log(chalk.red(`❌ Failed to remove ${modelName}`));
          }
        } catch (error) {
          console.error(chalk.red('❌ Removal failed:'), error instanceof Error ? error.message : error);
        }
      } else {
        console.log(chalk.gray('Cancelled.'));
      }
    }
  }

  async handleVoiceManagement(options: any): Promise<void> {
    if (options.list) {
      const voices = this.context.voiceSystem.getAvailableVoices();
      console.log(chalk.cyan('Available voices:'));
      voices.forEach(voice => {
        console.log(chalk.green(`🎭 ${voice.name} (${voice.id})`));
        console.log(chalk.gray(`   Style: ${voice.style}`));
        console.log(chalk.gray(`   Temperature: ${voice.temperature}`));
      });
    }

    if (options.describe) {
      const voice = this.context.voiceSystem.getVoice(options.describe);
      if (voice) {
        console.log(chalk.cyan(`🎭 ${voice.name}`));
        console.log(chalk.gray('System Prompt:'));
        console.log(voice.systemPrompt);
      } else {
        console.error(chalk.red(`❌ Voice not found: ${options.describe}`));
      }
    }

    if (options.test) {
      const testPrompt = 'Create a simple function to add two numbers';
      await this.handleVoiceSpecific(options.test, testPrompt);
    }
  }

  showExamples(): void {
    console.log(chalk.cyan('🎯 CodeCrucible Terminal Examples:\n'));

    console.log(chalk.bold('Basic Usage:'));
    console.log(chalk.green('  cc "Create a React component for user authentication"'));
    console.log(chalk.green('  cc "Build a REST API with Express and TypeScript"\n'));

    console.log(chalk.bold('Multi-Voice Generation:'));
    console.log(chalk.green('  cc --voices explorer,security "Create secure login system"'));
    console.log(chalk.green('  cc --council "Design microservices architecture"\n'));

    console.log(chalk.bold('File Operations:'));
    console.log(chalk.green('  cc file analyze src/auth.js'));
    console.log(chalk.green('  cc file refactor components/Button.tsx'));
    console.log(chalk.green('  cc file test utils/validation.ts\n'));

    console.log(chalk.bold('Project Operations:'));
    console.log(chalk.green('  cc project analyze --pattern "src/**/*.ts"'));
    console.log(chalk.green('  cc project document\n'));

    console.log(chalk.bold('Voice-Specific Consultation:'));
    console.log(chalk.green('  cc voice security "Review this authentication flow"'));
    console.log(chalk.green('  cc voice optimizer "Improve performance of this function"\n'));

    console.log(chalk.bold('Interactive Mode:'));
    console.log(chalk.green('  cc --interactive'));
    console.log(chalk.green('  cc i\n'));

    console.log(chalk.bold('Configuration:'));
    console.log(chalk.green('  cc config --list'));
    console.log(chalk.green('  cc config --set voices.default=explorer,maintainer'));
  }

  private displayIterativeResults(result: IterativeResult): void {
    console.log(chalk.green('\n🎉 Iterative Improvement Results:\n'));

    // Show summary
    console.log(chalk.cyan('📊 Summary:'));
    console.log(chalk.cyan(`   Writer: ${result.writerVoice}`));
    console.log(chalk.cyan(`   Auditor: ${result.auditorVoice}`));
    console.log(chalk.cyan(`   Total Iterations: ${result.totalIterations}`));
    console.log(chalk.cyan(`   Final Quality Score: ${result.finalQualityScore}/100`));
    console.log(chalk.cyan(`   Converged: ${result.converged ? '✅ Yes' : '❌ No'}\n`));

    // Show iteration details
    console.log(chalk.blue('🔄 Iteration Log:'));
    result.iterations.forEach((iteration, index) => {
      const isLast = index === result.iterations.length - 1;
      const prefix = isLast ? '└─' : '├─';
      
      console.log(chalk.gray(`${prefix} Iteration ${iteration.iteration}:`));
      console.log(chalk.gray(`   │ Quality: ${iteration.qualityScore}/100`));
      console.log(chalk.gray(`   │ Changes: +${iteration.diff.added} -${iteration.diff.removed} ~${iteration.diff.modified} lines`));
      console.log(chalk.gray(`   │ Code Length: ${iteration.code.length} chars`));
      
      if (!isLast) {
        console.log(chalk.gray('   │'));
      }
    });

    // Display final code
    console.log(chalk.green('\n💻 Final Optimized Code:'));
    console.log(chalk.gray('──────────────────────────────────────────────────'));
    console.log(result.finalCode);
    console.log(chalk.gray('──────────────────────────────────────────────────'));

    // Show final audit feedback
    if (result.iterations.length > 0) {
      const finalIteration = result.iterations[result.iterations.length - 1];
      console.log(chalk.blue('\n🔍 Final Audit Report:'));
      console.log(finalIteration.auditFeedback);
    }
  }

  // Helper methods
  private parseVoices(voicesStr?: string): string[] | 'auto' {
    if (!voicesStr) {
      // Use intelligent voice selection by default
      return 'auto';
    }

    if (voicesStr === 'auto') {
      return 'auto';
    }

    if (voicesStr === 'all') {
      const availableVoices = this.context.config.voices.available;
      // Ensure we always return an array
      return Array.isArray(availableVoices) ? availableVoices : ['explorer', 'maintainer', 'analyzer', 'developer'];
    }

    return voicesStr.split(',').map(v => v.trim().toLowerCase());
  }

  private async getProjectContext(file?: string, project?: boolean): Promise<ProjectContext> {
    const context: ProjectContext = { files: [] };

    if (file) {
      try {
        const content = await readFile(file, 'utf8');
        const language = this.detectLanguage(extname(file));
        context.files = context.files || [];
        context.files.push({ path: file, content, language });
      } catch (error) {
        logger.warn(`Could not read file ${file}:`, error);
      }
    }

    if (project) {
      const files = await glob('**/*.{js,ts,jsx,tsx}', { 
        ignore: ['node_modules/**', '.git/**', 'dist/**'],
        maxDepth: 3 
      });
      
      const projectFiles = await this.buildProjectContext(files.slice(0, 5));
      context.files = context.files || [];
      if (projectFiles) {
        context.files.push(...projectFiles);
      }
    }

    return context;
  }

  private async buildProjectContext(filePaths: string[]): Promise<ProjectContext['files']> {
    const files: ProjectContext['files'] = [];

    for (const filePath of filePaths) {
      try {
        const content = await readFile(filePath, 'utf8');
        const language = this.detectLanguage(extname(filePath));
        files.push({ path: filePath, content, language });
      } catch (error) {
        logger.warn(`Could not read file ${filePath}:`, error);
      }
    }

    return files;
  }

  private detectLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust'
    };

    return langMap[ext.toLowerCase()] || 'text';
  }

  private displayResults(synthesis: SynthesisResult, responses: any[]): void {
    console.log(chalk.bold('\n🎉 Generation Results:\n'));

    // Show voice contributions
    console.log(chalk.cyan('Voice Contributions:'));
    responses.forEach(response => {
      const confidence = Math.round(response.confidence * 100);
      console.log(chalk.green(`  🎭 ${response.voice}: ${confidence}% confidence`));
    });

    console.log(chalk.cyan(`\nSynthesis Mode: ${synthesis.voicesUsed.join(' + ')}`));
    console.log(chalk.cyan(`Quality Score: ${synthesis.qualityScore}/100`));
    console.log(chalk.cyan(`Confidence: ${Math.round(synthesis.confidence * 100)}%\n`));

    // Show code
    if (synthesis.combinedCode) {
      console.log(chalk.bold('💻 Generated Code:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(synthesis.combinedCode);
      console.log(chalk.gray('─'.repeat(50)));
    }

    // Show reasoning
    if (synthesis.reasoning) {
      console.log(chalk.bold('\n🧠 Synthesis Reasoning:'));
      console.log(synthesis.reasoning);
    }
  }

  private async handleFileOutput(filepath: string, code: string): Promise<void> {
    try {
      const { writeFile } = await import('fs/promises');
      await writeFile(filepath, code, 'utf8');
      console.log(chalk.green(`✅ Code written to ${filepath}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to write file: ${error}`));
    }
  }

  private async handleInteractiveAction(action: string, defaultVoices: string[]): Promise<void> {
    switch (action) {
      case 'generate':
        const { prompt } = await inquirer.prompt([
          { type: 'input', name: 'prompt', message: 'Enter your code generation prompt:' }
        ]);
        if (prompt) {
          await this.handleGeneration(prompt, { voices: defaultVoices.join(',') });
        }
        break;

      case 'file':
        const { filepath, operation } = await inquirer.prompt([
          { type: 'input', name: 'filepath', message: 'Enter file path:' },
          { 
            type: 'list', 
            name: 'operation', 
            message: 'Select operation:',
            choices: ['analyze', 'refactor', 'explain', 'test']
          }
        ]);
        if (filepath) {
          await this.handleFileOperation(operation, filepath, { voices: defaultVoices.join(',') });
        }
        break;

      case 'voice':
        const { voice, voicePrompt } = await inquirer.prompt([
          {
            type: 'list',
            name: 'voice',
            message: 'Select voice:',
            choices: this.context.config.voices.available
          },
          { type: 'input', name: 'voicePrompt', message: 'Enter prompt:' }
        ]);
        if (voicePrompt) {
          await this.handleVoiceSpecific(voice, voicePrompt);
        }
        break;

      case 'model':
        await this.handleModelSelection();
        break;
    }
  }

  private async handleModelSelection(): Promise<void> {
    try {
      // Show current model and available models
      await this.context.modelClient.displayAvailableModels();
      
      const { modelAction } = await inquirer.prompt([
        {
          type: 'list',
          name: 'modelAction',
          message: 'What would you like to do?',
          choices: [
            { name: '📋 Just show current model info', value: 'info' },
            { name: '🔄 Switch to different model', value: 'switch' },
            { name: '↩️  Go back', value: 'back' }
          ]
        }
      ]);
      
      if (modelAction === 'switch') {
        const availableModels = await this.context.modelClient.getAvailableModels();
        
        if (availableModels.length === 0) {
          console.log(chalk.red('❌ No models found. Please install a model first:'));
          console.log(chalk.yellow('   ollama pull gemma:2b'));
          return;
        }
        
        const modelChoices = availableModels.map((model, index) => ({
          name: `${index + 1}. ${model}`,
          value: index + 1
        }));
        
        const { selectedModel } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedModel',
            message: 'Select a model:',
            choices: [...modelChoices, { name: '↩️  Cancel', value: 'cancel' }]
          }
        ]);
        
        if (selectedModel !== 'cancel') {
          const success = await this.context.modelClient.selectModel(selectedModel);
          if (!success) {
            console.log(chalk.red('❌ Failed to select model'));
          }
        }
      } else if (modelAction === 'info') {
        const currentModel = this.context.modelClient.getCurrentModel();
        console.log(chalk.green(`\n📍 Current model: ${currentModel}`));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Model selection error:'), error instanceof Error ? error.message : error);
    }
  }

  private parseValue(value: string): any {
    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}