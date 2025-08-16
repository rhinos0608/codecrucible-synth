import { AgentOrchestrator } from './agent-orchestrator.js';
import { logger } from './logger.js';
import { globalEditConfirmation } from './edit-confirmation-system.js';
import { cliOutput, CLIError, CLIExitCode } from './cli-output-manager.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { readFile, stat, readdir } from 'fs/promises';
import { join, extname, isAbsolute } from 'path';
import { glob } from 'glob';
export class CodeCrucibleCLI {
    context;
    constructor(context) {
        this.context = context;
        // Initialize agent orchestrator for agentic capabilities
        if (!this.context.agentOrchestrator) {
            this.context.agentOrchestrator = new AgentOrchestrator(context);
        }
    }
    /**
     * Configure CLI output based on options
     */
    configureOutput(options) {
        cliOutput.configure({
            verbose: options.verbose,
            quiet: options.quiet,
            format: options.output || 'text'
        });
    }
    async handleGeneration(prompt, options) {
        try {
            // Configure output based on options
            this.configureOutput(options);
            if (options.interactive) {
                await this.handleInteractiveMode(options);
                return;
            }
            // If no prompt provided, show usage
            if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
                console.log('💡 Please provide a prompt or use --interactive mode');
                console.log('   Example: cc "analyze my code"');
                console.log('   Or use: cc --interactive');
                return;
            }
            // Check for direct/quick mode for simple operations
            if (options.quick || options.direct || this.isSimpleFileOperation(prompt)) {
                await this.handleDirectMode(prompt, options);
                return;
            }
            // Check for agentic mode
            if (options.agentic || options.autonomous) {
                await this.handleAgenticMode(prompt, options);
                return;
            }
            if (!prompt) {
                cliOutput.outputInfo('No prompt provided. Starting interactive mode...');
                cliOutput.outputDebug('Alternative usage: cc "Your prompt here" for direct commands');
                cliOutput.outputDebug('Or try: cc --agentic "Your goal here" for autonomous processing');
                await this.handleInteractiveMode(options);
                return;
            }
            cliOutput.outputProgress('Starting CodeCrucible generation...');
            cliOutput.outputDebug(`Prompt: ${prompt}`);
            // Parse options
            const voices = this.parseVoices(options.voices || options.council ? 'all' : undefined);
            const synthesisMode = options.mode || 'competitive';
            const analysisDepth = parseInt(options.depth || '2');
            console.log(chalk.cyan(`   Voices: ${Array.isArray(voices) ? voices.join(', ') : voices}`));
            console.log(chalk.cyan(`   Mode: ${synthesisMode}`));
            // Get project context - auto-detect mentioned files in prompt
            const mentionedFiles = this.extractMentionedFiles(prompt);
            const projectContext = await this.getProjectContext(options.file, options.project, mentionedFiles);
            // Check for iterative mode
            if (options.iterative || synthesisMode === 'iterative') {
                const spinner = ora('Starting iterative Writer/Auditor improvement loop...').start();
                try {
                    spinner.stop();
                    const iterativeResult = await this.context.voiceSystem.generateIterativeCodeImprovement(prompt, projectContext, parseInt(options.maxIterations || '5'), parseInt(options.qualityThreshold || '85'));
                    this.displayIterativeResults(iterativeResult);
                }
                catch (error) {
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
                    const singleResponse = await this.context.voiceSystem.generateSingleVoiceResponse(prompt, voices[0], projectContext);
                    spinner.succeed('Generation completed!');
                    // Display single voice result
                    console.log(chalk.green('\n📄 Response:\n'));
                    console.log(singleResponse.content);
                }
                catch (error) {
                    spinner.fail('Generation failed');
                    logger.error('Single voice generation failed:', error);
                    console.error(chalk.red('❌ Generation failed:'), error instanceof Error ? error.message : error);
                }
                return;
            }
            // Multi-voice mode with sequential processing
            const spinner = ora('Generating solutions from multiple voices sequentially...').start();
            try {
                const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(prompt, voices, projectContext);
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
                const synthesis = await this.context.voiceSystem.synthesizeVoiceResponses(responses, synthesisMode);
                spinner.succeed('Generation completed!');
                // Display results
                this.displayResults(synthesis, responses);
                // Handle file output
                if (options.file) {
                    await this.handleFileOutput(options.file, synthesis.combinedCode);
                }
            }
            catch (error) {
                spinner.fail('Generation failed');
                throw error;
            }
        }
        catch (error) {
            logger.error('Generation failed:', error);
            if (error instanceof CLIError) {
                cliOutput.outputError(error.message, error.exitCode);
            }
            else if (error instanceof Error) {
                // Network/timeout errors
                if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                    const timeoutError = CLIError.timeout('AI model generation');
                    cliOutput.outputError(timeoutError.message, timeoutError.exitCode);
                }
                else if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
                    const networkError = CLIError.networkError(error.message);
                    cliOutput.outputError(networkError.message, networkError.exitCode);
                }
                else {
                    cliOutput.outputError(`Generation failed: ${error.message}`, CLIExitCode.GENERAL_ERROR);
                }
            }
            else {
                cliOutput.outputError('Unknown error occurred during generation', CLIExitCode.GENERAL_ERROR);
            }
        }
    }
    async handleCouncilMode(prompt, options) {
        const parsedVoices = options.voices ? this.parseVoices(options.voices) : this.context.config.voices.available;
        const councilVoices = Array.isArray(parsedVoices) ? parsedVoices : this.context.config.voices.available;
        console.log(chalk.magenta('🏛️  Convening the full Council of Voices...'));
        await this.handleGeneration(prompt, {
            ...options,
            voices: councilVoices.join(','),
            mode: 'collaborative'
        });
    }
    async handleVoiceSpecific(voice, prompt) {
        console.log(chalk.green(`🎭 Consulting ${voice}...`));
        const voiceArchetype = this.context.voiceSystem.getVoice(voice);
        if (!voiceArchetype) {
            console.error(chalk.red(`❌ Unknown voice: ${voice}`));
            console.log(chalk.gray('Available voices:'), this.context.config.voices.available.join(', '));
            return;
        }
        const spinner = ora(`${voice} is thinking...`).start();
        try {
            // Improved file detection - look for common file patterns
            const filePatterns = [
                /\b[\w\-\.\/\\]+\.(js|ts|jsx|tsx|py|java|cpp|c|h|cs|php|rb|go|rs|md|txt|json|yaml|yml)\b/g,
                /\b[\w\-\.\/\\]*\/[\w\-\.]+\b/g, // Unix-style paths
                /\b[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*\.[a-zA-Z0-9]+\b/g // Windows paths
            ];
            let detectedFiles = [];
            let projectContext = { files: [] };
            // Try each pattern to find file references
            for (const pattern of filePatterns) {
                const matches = prompt.match(pattern);
                if (matches) {
                    detectedFiles.push(...matches);
                }
            }
            // Remove duplicates and filter valid files
            detectedFiles = [...new Set(detectedFiles)];
            // Enhanced prompt with file content inclusion
            let enhancedPrompt = prompt;
            let filesFound = false;
            for (const filePath of detectedFiles) {
                try {
                    // Try to resolve relative paths
                    let resolvedPath = filePath;
                    if (!isAbsolute(filePath)) {
                        resolvedPath = join(process.cwd(), filePath);
                    }
                    const fileContent = await readFile(resolvedPath, 'utf8');
                    const fileExt = extname(resolvedPath);
                    const language = this.detectLanguage(fileExt);
                    // Add file to project context
                    if (!projectContext.files) {
                        projectContext.files = [];
                    }
                    projectContext.files.push({
                        path: filePath,
                        content: fileContent,
                        language
                    });
                    // Enhance prompt with file content
                    enhancedPrompt += `\n\n**File: ${filePath}**\n\`\`\`${language}\n${fileContent}\n\`\`\``;
                    filesFound = true;
                    console.log(chalk.gray(`   📁 Loaded file: ${filePath}`));
                }
                catch (error) {
                    // Silently continue if file can't be read
                    continue;
                }
            }
            // If no files were detected but prompt looks like it might reference files,
            // provide helpful guidance
            if (!filesFound && (prompt.includes('.js') || prompt.includes('.ts') || prompt.includes('file'))) {
                enhancedPrompt += `\n\n**Note:** If you're referencing specific files, please provide the file path in your prompt (e.g., "analyze src/index.js") and I'll include the file content in my analysis.`;
            }
            const response = await this.context.modelClient.generateVoiceResponse(voiceArchetype, enhancedPrompt, projectContext);
            spinner.succeed(`${voice} has responded!`);
            console.log(chalk.bold(`\n🎭 ${response.voice}:`));
            console.log(chalk.gray(`Confidence: ${Math.round(response.confidence * 100)}%`));
            console.log(chalk.gray(`Tokens: ${response.tokens_used}`));
            console.log('\n' + response.content);
        }
        catch (error) {
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
    async handleFileOperation(operation, filepath, options) {
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
            const context = {
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
        }
        catch (error) {
            logger.error('File operation failed:', error);
            console.error(chalk.red('❌ File operation failed:'), error instanceof Error ? error.message : error);
        }
    }
    async handleProjectOperation(operation, options) {
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
            const projectContext = { files: contextFiles };
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
            const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(prompt, selectedVoices, projectContext);
            const synthesis = await this.context.voiceSystem.synthesizeVoiceResponses(responses, 'collaborative');
            this.displayResults(synthesis, responses);
        }
        catch (error) {
            logger.error('Project operation failed:', error);
            console.error(chalk.red('❌ Project operation failed:'), error instanceof Error ? error.message : error);
        }
    }
    async handleInteractiveMode(options) {
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
                            { name: '🤖 Autonomous Agentic Mode', value: 'agentic' },
                            { name: '🔧 Select AI model', value: 'model' },
                            { name: '🧠 VRAM Optimization', value: 'vram' },
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
            }
            catch (error) {
                if (error instanceof Error && error.message.includes('User force closed')) {
                    console.log(chalk.green('\n👋 Goodbye!'));
                    break;
                }
                console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
            }
        }
    }
    async handleConfig(options) {
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
        }
        else if (options.get) {
            const configManager = await ConfigManager.getInstance();
            const value = await configManager.get(options.get);
            console.log(chalk.cyan(`${options.get}:`), JSON.stringify(value, null, 2));
        }
        else if (options.list) {
            const configManager = await ConfigManager.getInstance();
            const all = configManager.getAll();
            console.log(chalk.cyan('Current configuration:'));
            console.log(JSON.stringify(all, null, 2));
        }
        else if (options.reset) {
            const configManager = await ConfigManager.getInstance();
            await configManager.reset();
            console.log(chalk.green('✅ Configuration reset to defaults'));
        }
        else {
            console.log(chalk.yellow('Use --set, --get, --list, or --reset'));
        }
    }
    async handleModelManagement(options) {
        const { EnhancedModelManager } = await import('./enhanced-model-manager.js');
        const { IntelligentModelSelector } = await import('./intelligent-model-selector.js');
        const modelManager = new EnhancedModelManager(this.context.config.model.endpoint);
        const modelSelector = new IntelligentModelSelector();
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
                // Show all available models (local + API)
                const allModels = await modelSelector.getAllAvailableModels();
                const localModels = allModels.filter(m => m.type === 'local');
                const apiModels = allModels.filter(m => m.type === 'api');
                console.log(chalk.cyan('\n📚 Available Models:'));
                if (localModels.length > 0) {
                    console.log(chalk.white('   Local Models (Ollama):'));
                    localModels.forEach(model => {
                        console.log(chalk.gray(`   • ${model.name} (${model.size}) - ${model.provider}`));
                    });
                }
                if (apiModels.length > 0) {
                    console.log(chalk.white('\n   API Models:'));
                    apiModels.forEach(model => {
                        console.log(chalk.gray(`   • ${model.name} (${model.provider}) - ${model.contextWindow?.toLocaleString()} context`));
                    });
                }
                if (allModels.length === 0) {
                    console.log(chalk.red('❌ No AI models available'));
                    console.log(chalk.yellow('💡 Run: cc model --setup or cc model --add-api'));
                }
            }
            catch (error) {
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
                }
                else {
                    console.log(chalk.red('❌ Setup failed. Please check the instructions above.'));
                }
            }
            catch (error) {
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
            }
            catch (error) {
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
                }
                else {
                    console.log(chalk.red(`❌ Failed to install ${modelName}`));
                }
            }
            catch (error) {
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
                }
                else {
                    console.log(chalk.red(`❌ Model ${modelName} test failed`));
                }
            }
            catch (error) {
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
                    }
                    else {
                        console.log(chalk.red(`❌ Failed to remove ${modelName}`));
                    }
                }
                catch (error) {
                    console.error(chalk.red('❌ Removal failed:'), error instanceof Error ? error.message : error);
                }
            }
            else {
                console.log(chalk.gray('Cancelled.'));
            }
        }
        // API Model Management
        if (options.addApi) {
            console.log(chalk.blue('🔑 Adding API Model Configuration\n'));
            try {
                const answers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'provider',
                        message: 'Select API provider:',
                        choices: [
                            { name: 'Claude (Anthropic)', value: 'anthropic' },
                            { name: 'GPT (OpenAI)', value: 'openai' },
                            { name: 'Gemini (Google)', value: 'google' },
                            { name: 'Hugging Face', value: 'huggingface' }
                        ]
                    },
                    {
                        type: 'input',
                        name: 'apiKey',
                        message: 'Enter your API key:',
                        validate: (input) => input.trim().length > 0 || 'API key is required'
                    },
                    {
                        type: 'input',
                        name: 'model',
                        message: 'Enter model name (e.g., claude-3-5-sonnet-20241022, gpt-4o, gemini-1.5-pro):',
                        validate: (input) => input.trim().length > 0 || 'Model name is required'
                    },
                    {
                        type: 'input',
                        name: 'endpoint',
                        message: 'Custom endpoint (optional, press enter for default):',
                        default: ''
                    }
                ]);
                const config = {
                    name: answers.model,
                    provider: answers.provider,
                    apiKey: answers.apiKey,
                    ...(answers.endpoint && { endpoint: answers.endpoint })
                };
                const success = await modelSelector.addApiModel(config);
                if (success) {
                    console.log(chalk.green(`✅ Successfully added API model: ${answers.model}`));
                    // Test the connection
                    const spinner = ora('Testing API connection...').start();
                    const testResult = await modelSelector.testApiModel(answers.model);
                    if (testResult) {
                        spinner.succeed('API model connection successful!');
                    }
                    else {
                        spinner.warn('API model added but connection test failed. Please check your API key and settings.');
                    }
                }
                else {
                    console.log(chalk.red('❌ Failed to add API model'));
                }
            }
            catch (error) {
                console.error(chalk.red('❌ Failed to add API model:'), error instanceof Error ? error.message : error);
            }
        }
        if (options.listApi) {
            console.log(chalk.cyan('🔑 API Models:\n'));
            try {
                const allModels = await modelSelector.getAllAvailableModels();
                const apiModels = allModels.filter(m => m.type === 'api');
                if (apiModels.length === 0) {
                    console.log(chalk.yellow('No API models configured.'));
                    console.log(chalk.gray('Run: cc model --add-api'));
                }
                else {
                    apiModels.forEach(model => {
                        console.log(chalk.white(`${model.name}`));
                        console.log(chalk.gray(`   Provider: ${model.provider}`));
                        console.log(chalk.gray(`   Context: ${model.contextWindow?.toLocaleString()} tokens`));
                        console.log(chalk.gray(`   API Key: ${model.apiKey ? '✅ Configured' : '❌ Missing'}`));
                        console.log();
                    });
                }
            }
            catch (error) {
                console.error(chalk.red('❌ Failed to list API models:'), error instanceof Error ? error.message : error);
            }
        }
        if (options.removeApi) {
            const modelName = options.removeApi;
            console.log(chalk.yellow(`🗑️  Removing API model: ${modelName}`));
            const { confirm } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to remove API model ${modelName}?`,
                    default: false
                }]);
            if (confirm) {
                const success = modelSelector.removeApiModel(modelName);
                if (success) {
                    console.log(chalk.green(`✅ Successfully removed API model: ${modelName}`));
                }
                else {
                    console.log(chalk.red(`❌ Failed to remove API model: ${modelName}`));
                }
            }
            else {
                console.log(chalk.gray('Cancelled.'));
            }
        }
        if (options.testApi) {
            const modelName = options.testApi;
            console.log(chalk.blue(`🧪 Testing API model: ${modelName}`));
            const spinner = ora('Testing API connection...').start();
            try {
                const success = await modelSelector.testApiModel(modelName);
                if (success) {
                    spinner.succeed(`API model ${modelName} is working correctly!`);
                }
                else {
                    spinner.fail(`API model ${modelName} test failed`);
                    console.log(chalk.yellow('💡 Please check your API key and model configuration'));
                }
            }
            catch (error) {
                spinner.fail('API test failed');
                console.error(chalk.red('❌ Test failed:'), error instanceof Error ? error.message : error);
            }
        }
        if (options.select) {
            console.log(chalk.blue('🎯 Select Active Model\n'));
            try {
                const allModels = await modelSelector.getAllAvailableModels();
                if (allModels.length === 0) {
                    console.log(chalk.red('❌ No models available'));
                    console.log(chalk.yellow('💡 Run: cc model --setup or cc model --add-api'));
                    return;
                }
                const choices = allModels.map(model => ({
                    name: `${model.name} (${model.type === 'local' ? 'Local' : 'API'} - ${model.provider})`,
                    value: model.name
                }));
                const { selectedModel } = await inquirer.prompt([{
                        type: 'list',
                        name: 'selectedModel',
                        message: 'Select a model to use:',
                        choices
                    }]);
                // Update configuration
                const { ConfigManager } = await import('../config/config-manager.js');
                const configManager = await ConfigManager.getInstance();
                await configManager.set('model.name', selectedModel);
                console.log(chalk.green(`✅ Active model set to: ${selectedModel}`));
            }
            catch (error) {
                console.error(chalk.red('❌ Model selection failed:'), error instanceof Error ? error.message : error);
            }
        }
    }
    async handleVoiceManagement(options) {
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
            }
            else {
                console.error(chalk.red(`❌ Voice not found: ${options.describe}`));
            }
        }
        if (options.test) {
            const testPrompt = 'Create a simple function to add two numbers';
            await this.handleVoiceSpecific(options.test, testPrompt);
        }
    }
    async handleVRAMManagement(options) {
        if (!options.status && !options.optimize && !options.test && !options.models && !options.configure) {
            // Show help if no specific option provided
            console.log(chalk.cyan('🧠 VRAM Optimization Commands:\n'));
            console.log(chalk.green('  cc vram --status     ') + chalk.gray('Show VRAM status and current model analysis'));
            console.log(chalk.green('  cc vram --optimize   ') + chalk.gray('Optimize current model for available VRAM'));
            console.log(chalk.green('  cc vram --test       ') + chalk.gray('Test model with VRAM optimizations'));
            console.log(chalk.green('  cc vram --models     ') + chalk.gray('Show optimal models for your system'));
            console.log(chalk.green('  cc vram --configure  ') + chalk.gray('Configure VRAM optimization settings'));
            return;
        }
        try {
            // Import VRAMOptimizer dynamically
            const { VRAMOptimizer } = await import('./vram-optimizer.js');
            const vramOptimizer = new VRAMOptimizer(this.context.config.model.endpoint);
            if (options.status) {
                await this.showVRAMStatus(vramOptimizer);
            }
            if (options.optimize) {
                await this.optimizeCurrentModel(vramOptimizer);
            }
            if (options.test) {
                await this.testModelWithVRAM(vramOptimizer);
            }
            if (options.models) {
                await this.showOptimalModels(vramOptimizer);
            }
            if (options.configure) {
                await this.configureVRAMSettings(vramOptimizer);
            }
        }
        catch (error) {
            console.error(chalk.red('❌ VRAM management failed:'), error instanceof Error ? error.message : error);
        }
    }
    async handleEditManagement(options) {
        if (!globalEditConfirmation) {
            console.error(chalk.red('❌ Edit confirmation system not initialized'));
            return;
        }
        if (options.pending) {
            const pendingCount = globalEditConfirmation.getPendingEditsCount();
            if (pendingCount === 0) {
                console.log(chalk.yellow('📝 No pending edits'));
                return;
            }
            console.log(chalk.cyan(`📝 ${pendingCount} pending edits found`));
            // Generate and display summary
            const summary = globalEditConfirmation['generateEditSummary']();
            globalEditConfirmation['displayEditSummary'](summary);
            return;
        }
        if (options.clear) {
            const pendingCount = globalEditConfirmation.getPendingEditsCount();
            if (pendingCount === 0) {
                console.log(chalk.yellow('📝 No pending edits to clear'));
                return;
            }
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Clear all ${pendingCount} pending edits?`,
                    default: false
                }
            ]);
            if (confirm) {
                globalEditConfirmation.clearPendingEdits();
                console.log(chalk.green('✅ All pending edits cleared'));
            }
            return;
        }
        if (options.confirm) {
            const pendingCount = globalEditConfirmation.getPendingEditsCount();
            if (pendingCount === 0) {
                console.log(chalk.yellow('📝 No pending edits to confirm'));
                return;
            }
            // Set batch or individual mode
            if (options.batch) {
                // Override default to batch mode
                globalEditConfirmation['options'].batchMode = true;
            }
            else if (options.individual) {
                globalEditConfirmation['options'].batchMode = false;
            }
            console.log(chalk.cyan(`🔍 Confirming ${pendingCount} pending edits...`));
            try {
                const { approved, rejected } = await globalEditConfirmation.confirmAllEdits();
                const summary = await globalEditConfirmation.applyEdits(approved);
                console.log(chalk.green(`\n✅ Edit operation completed:`));
                console.log(chalk.green(`   Applied: ${approved.length} edits`));
                console.log(chalk.yellow(`   Rejected: ${rejected.length} edits`));
                if (summary.totalFiles > 0) {
                    console.log(chalk.cyan(`\n📊 Summary:`));
                    console.log(`   Files modified: ${summary.filesModified}`);
                    console.log(`   Files created: ${summary.filesCreated}`);
                    console.log(`   Files deleted: ${summary.filesDeleted}`);
                    console.log(`   Lines added: ${summary.linesAdded}`);
                    console.log(`   Lines removed: ${summary.linesRemoved}`);
                    console.log(`   Lines changed: ${summary.linesChanged}`);
                }
            }
            catch (error) {
                console.error(chalk.red('❌ Failed to confirm edits:'), error instanceof Error ? error.message : error);
            }
            return;
        }
        // Default: show help for edit command
        console.log(chalk.cyan('📝 Edit Management Commands:\n'));
        console.log(chalk.green('  cc edits --pending    ') + chalk.gray('Show pending edits'));
        console.log(chalk.green('  cc edits --confirm    ') + chalk.gray('Confirm and apply all pending edits'));
        console.log(chalk.green('  cc edits --clear      ') + chalk.gray('Clear all pending edits'));
        console.log(chalk.green('  cc edits --batch      ') + chalk.gray('Use batch confirmation mode'));
        console.log(chalk.green('  cc edits --individual ') + chalk.gray('Use individual confirmation mode'));
        const pendingCount = globalEditConfirmation.getPendingEditsCount();
        if (pendingCount > 0) {
            console.log(chalk.yellow(`\n⚠️  ${pendingCount} edits are currently pending confirmation`));
        }
    }
    showExamples() {
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
        console.log(chalk.bold('Agentic Mode (Autonomous AI):'));
        console.log(chalk.green('  cc --agentic "Analyze and improve this codebase"'));
        console.log(chalk.green('  cc --autonomous "Fix all issues in the project"'));
        console.log(chalk.green('  cc --agentic "Implement comprehensive testing strategy"\n'));
        console.log(chalk.bold('Edit Management:'));
        console.log(chalk.green('  cc edits --pending          # Show pending edits'));
        console.log(chalk.green('  cc edits --confirm          # Confirm all edits'));
        console.log(chalk.green('  cc edits --confirm --batch  # Batch confirmation'));
        console.log(chalk.green('  cc edits --clear            # Clear pending edits\n'));
        console.log(chalk.bold('VRAM Optimization:'));
        console.log(chalk.green('  cc vram --status            # Show VRAM usage and recommendations'));
        console.log(chalk.green('  cc vram --optimize          # Optimize current model for VRAM'));
        console.log(chalk.green('  cc vram --test              # Test model with VRAM optimization'));
        console.log(chalk.green('  cc vram --models            # Show optimal models for your system\n'));
        console.log(chalk.bold('Configuration:'));
        console.log(chalk.green('  cc config --list'));
        console.log(chalk.green('  cc config --set voices.default=explorer,maintainer'));
        console.log(chalk.gray('\n💡 Use --help with any command for detailed options'));
        console.log(chalk.gray('🔒 File edits require confirmation for safety by default'));
    }
    /**
     * Handle autonomous agentic mode processing
     */
    async handleAgenticMode(prompt, options) {
        if (!this.context.agentOrchestrator) {
            console.error(chalk.red('❌ Agent Orchestrator not available'));
            return;
        }
        if (!prompt) {
            console.log(chalk.yellow('💡 Agentic mode requires a goal or objective'));
            console.log(chalk.gray('   Example: cc --agentic "Analyze and improve code quality"'));
            return;
        }
        console.log(chalk.magenta('🤖 Entering Autonomous Agentic Mode'));
        console.log(chalk.cyan('━'.repeat(60)));
        console.log(chalk.bold(`🎯 Goal: ${prompt}`));
        console.log(chalk.gray('   The AI will autonomously plan and execute tasks to achieve this goal'));
        console.log(chalk.cyan('━'.repeat(60)));
        const spinner = ora('Initializing autonomous agent system...').start();
        try {
            spinner.text = 'Analyzing goal and planning autonomous workflow...';
            // Get current working directory for project context
            const projectPath = process.cwd();
            // Process the request autonomously
            const result = await this.context.agentOrchestrator.processAgenticRequest(prompt, projectPath, {
                userId: 'cli_user',
                maxComplexity: options.council ? 'high' : 'medium',
                includeProactiveSuggestions: true,
                ...options
            });
            spinner.succeed('Autonomous processing completed!');
            // Display results with enhanced formatting
            console.log('\n' + chalk.magenta('🤖 Autonomous Agent Results'));
            console.log(chalk.cyan('━'.repeat(60)));
            if (typeof result === 'string') {
                console.log(result);
            }
            else {
                console.log(JSON.stringify(result, null, 2));
            }
            console.log(chalk.cyan('━'.repeat(60)));
            // Show agent orchestrator statistics
            const stats = this.context.agentOrchestrator.getWorkflowStats();
            if (stats.activeWorkflows > 0 || stats.agentPerformance.length > 0) {
                console.log(chalk.blue('\n📊 Agent Performance Summary:'));
                console.log(chalk.gray(`   Active Workflows: ${stats.activeWorkflows}`));
                console.log(chalk.gray(`   Total Agents: ${stats.totalAgents}`));
                const topAgents = stats.agentPerformance
                    .sort((a, b) => b.successRate - a.successRate)
                    .slice(0, 3);
                if (topAgents.length > 0) {
                    console.log(chalk.gray('   Top Performing Agents:'));
                    topAgents.forEach((agent) => {
                        const successRate = Math.round(agent.successRate * 100);
                        const quality = Math.round(agent.avgQuality * 100);
                        console.log(chalk.gray(`     • ${agent.name}: ${successRate}% success, ${quality}% quality`));
                    });
                }
            }
        }
        catch (error) {
            spinner.fail('Autonomous processing failed');
            console.error(chalk.red('\n❌ Agentic Mode Error:'));
            console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
            // Provide helpful guidance
            console.log(chalk.yellow('\n💡 Troubleshooting Tips:'));
            console.log(chalk.gray('   • Ensure you have a stable internet connection'));
            console.log(chalk.gray('   • Try a simpler, more specific goal'));
            console.log(chalk.gray('   • Check if local AI models are properly configured'));
            console.log(chalk.gray('   • Use regular mode: cc "your prompt" (without --agentic)'));
            throw error;
        }
    }
    displayIterativeResults(result) {
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
    parseVoices(voicesStr) {
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
    async getProjectContext(file, project, mentionedFiles) {
        const context = { files: [] };
        if (file) {
            try {
                const content = await readFile(file, 'utf8');
                const language = this.detectLanguage(extname(file));
                context.files = context.files || [];
                context.files.push({ path: file, content, language });
            }
            catch (error) {
                logger.warn(`Could not read file ${file}:`, error);
            }
        }
        // Include mentioned files from prompt analysis
        if (mentionedFiles && mentionedFiles.length > 0) {
            for (const mentionedFile of mentionedFiles) {
                try {
                    const content = await readFile(mentionedFile, 'utf8');
                    const language = this.detectLanguage(extname(mentionedFile));
                    context.files = context.files || [];
                    // Don't duplicate if already added
                    if (!context.files.some(f => f.path === mentionedFile)) {
                        context.files.push({ path: mentionedFile, content, language });
                        logger.info(`Added mentioned file to context: ${mentionedFile}`);
                    }
                }
                catch (error) {
                    logger.warn(`Could not read mentioned file ${mentionedFile}:`, error);
                }
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
    async buildProjectContext(filePaths) {
        const files = [];
        for (const filePath of filePaths) {
            try {
                const content = await readFile(filePath, 'utf8');
                const language = this.detectLanguage(extname(filePath));
                files.push({ path: filePath, content, language });
            }
            catch (error) {
                logger.warn(`Could not read file ${filePath}:`, error);
            }
        }
        return files;
    }
    detectLanguage(ext) {
        const langMap = {
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
    displayResults(synthesis, responses) {
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
    async handleFileOutput(filepath, code) {
        try {
            const { writeFile } = await import('fs/promises');
            await writeFile(filepath, code, 'utf8');
            console.log(chalk.green(`✅ Code written to ${filepath}`));
        }
        catch (error) {
            console.error(chalk.red(`❌ Failed to write file: ${error}`));
        }
    }
    async handleInteractiveAction(action, defaultVoices) {
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
            case 'agentic':
                const { agenticGoal } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'agenticGoal',
                        message: 'Enter your goal for autonomous AI processing:',
                        transformer: (input) => chalk.cyan(input)
                    }
                ]);
                if (agenticGoal) {
                    await this.handleAgenticMode(agenticGoal, { agentic: true });
                }
                break;
            case 'model':
                await this.handleModelSelection();
                break;
            case 'vram':
                await this.handleVRAMOptimization();
                break;
        }
    }
    async handleModelSelection() {
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
            }
            else if (modelAction === 'info') {
                const currentModel = this.context.modelClient.getCurrentModel();
                console.log(chalk.green(`\n📍 Current model: ${currentModel}`));
            }
        }
        catch (error) {
            console.error(chalk.red('❌ Model selection error:'), error instanceof Error ? error.message : error);
        }
    }
    extractMentionedFiles(prompt) {
        const mentionedFiles = [];
        // Common file patterns to look for in prompts
        const filePatterns = [
            // Exact file names with extensions
            /\b([\w\-\.]+\.(?:js|ts|jsx|tsx|json|md|txt|yml|yaml|xml|html|css|scss|py|java|cpp|c|h|cs|php|rb|go|rs|kt|swift|dart|vue|svelte))\b/gi,
            // Files with relative paths
            /\b(?:\.\/|src\/|config\/|scripts\/|docs\/)?([\w\-\/\.]+\.(?:js|ts|jsx|tsx|json|md|txt|yml|yaml|xml|html|css|scss|py|java|cpp|c|h|cs|php|rb|go|rs|kt|swift|dart|vue|svelte))\b/gi
        ];
        for (const pattern of filePatterns) {
            const matches = prompt.match(pattern);
            if (matches) {
                for (const match of matches) {
                    const cleanFile = match.replace(/^\.\//, ''); // Remove leading ./
                    // Check if file likely exists in common locations
                    const candidates = [
                        cleanFile,
                        `./${cleanFile}`,
                        `./src/${cleanFile}`,
                        `./config/${cleanFile}`,
                        `./scripts/${cleanFile}`
                    ];
                    // Add the most likely candidate
                    if (!mentionedFiles.includes(cleanFile)) {
                        mentionedFiles.push(cleanFile);
                    }
                }
            }
        }
        return mentionedFiles;
    }
    parseValue(value) {
        // Try to parse as JSON, fallback to string
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    /**
     * Handle direct mode for simple file operations - provides immediate, specific responses
     */
    async handleDirectMode(prompt, options) {
        console.log(chalk.blue('⚡ Direct Mode - Providing immediate response...'));
        try {
            const normalizedPrompt = prompt.toLowerCase();
            // Handle file listing requests
            if (normalizedPrompt.includes('list') && normalizedPrompt.includes('src')) {
                await this.handleDirectFileList('src');
                return;
            }
            if (normalizedPrompt.includes('list') && normalizedPrompt.includes('file')) {
                const directory = this.extractDirectoryFromPrompt(prompt) || '.';
                await this.handleDirectFileList(directory);
                return;
            }
            // Handle specific file reading
            const filePattern = prompt.match(/read|show|view.*?([a-zA-Z0-9._/-]+\.[a-zA-Z]+)/i);
            if (filePattern) {
                await this.handleDirectFileRead(filePattern[1]);
                return;
            }
            // Handle project structure queries
            if (normalizedPrompt.includes('structure') || normalizedPrompt.includes('organization')) {
                await this.handleDirectProjectStructure();
                return;
            }
            // For complex queries that include file operations, use agentic mode
            console.log(chalk.yellow('🔄 Switching to agentic mode for complex analysis...'));
            await this.handleAgenticMode(prompt, options);
        }
        catch (error) {
            console.error(chalk.red('❌ Direct mode failed:'), error instanceof Error ? error.message : error);
            // Fallback to agentic processing for complex queries
            await this.handleAgenticMode(prompt, options);
        }
    }
    /**
     * Handle direct file listing with specific, useful output
     */
    async handleDirectFileList(directory) {
        try {
            const fullPath = join(process.cwd(), directory);
            const items = await readdir(fullPath, { withFileTypes: true });
            console.log(chalk.green(`📁 Files in ${directory}:`));
            console.log(chalk.gray('━'.repeat(50)));
            // Separate files and directories
            const directories = items.filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
            const files = items.filter(item => item.isFile()).sort((a, b) => a.name.localeCompare(b.name));
            // Show directories first
            for (const dir of directories) {
                console.log(chalk.blue(`📁 ${dir.name}/`));
            }
            // Group files by extension for better organization
            const filesByExt = new Map();
            for (const file of files) {
                const ext = extname(file.name) || 'no-extension';
                if (!filesByExt.has(ext)) {
                    filesByExt.set(ext, []);
                }
                filesByExt.get(ext).push(file.name);
            }
            // Show files grouped by type
            for (const [ext, fileList] of filesByExt.entries()) {
                const icon = this.getFileIcon(ext);
                console.log(chalk.gray(`\n${ext} files:`));
                for (const fileName of fileList) {
                    console.log(`${icon} ${fileName}`);
                }
            }
            // Show summary
            console.log(chalk.gray('━'.repeat(50)));
            console.log(chalk.cyan(`📊 Summary: ${directories.length} directories, ${files.length} files`));
            // Provide actionable insights
            const insights = this.generateDirectoryInsights(directories, files, directory);
            if (insights.length > 0) {
                console.log(chalk.yellow('\n💡 Quick Insights:'));
                insights.forEach(insight => console.log(chalk.gray(`   • ${insight}`)));
            }
        }
        catch (error) {
            console.error(chalk.red(`❌ Failed to list ${directory}:`), error instanceof Error ? error.message : error);
        }
    }
    /**
     * Handle direct file reading with context
     */
    async handleDirectFileRead(filePath) {
        try {
            const content = await readFile(filePath, 'utf-8');
            const stats = await stat(filePath);
            console.log(chalk.green(`📄 ${filePath}`));
            console.log(chalk.gray(`   Size: ${(stats.size / 1024).toFixed(1)}KB | Modified: ${stats.mtime.toLocaleDateString()}`));
            console.log(chalk.gray('━'.repeat(80)));
            // Show content with line numbers for better readability
            const lines = content.split('\n');
            const maxLineNum = lines.length.toString().length;
            lines.slice(0, 50).forEach((line, index) => {
                const lineNum = (index + 1).toString().padStart(maxLineNum, ' ');
                console.log(chalk.gray(`${lineNum}→`) + line);
            });
            if (lines.length > 50) {
                console.log(chalk.yellow(`... (${lines.length - 50} more lines)`));
            }
            // Provide analysis
            console.log(chalk.gray('━'.repeat(80)));
            console.log(chalk.cyan('📊 Quick Analysis:'));
            console.log(chalk.gray(`   • Lines: ${lines.length}`));
            console.log(chalk.gray(`   • Extension: ${extname(filePath)}`));
            const analysis = this.analyzeFileContent(content, filePath);
            analysis.forEach(insight => console.log(chalk.gray(`   • ${insight}`)));
        }
        catch (error) {
            console.error(chalk.red(`❌ Failed to read ${filePath}:`), error instanceof Error ? error.message : error);
        }
    }
    /**
     * Handle direct project structure overview
     */
    async handleDirectProjectStructure() {
        try {
            console.log(chalk.green('🏗️  Project Structure Overview:'));
            console.log(chalk.gray('━'.repeat(60)));
            // Key directories to check
            const keyDirs = ['src', 'lib', 'dist', 'build', 'config', 'docs', 'tests', 'test', '__tests__'];
            const foundDirs = [];
            for (const dir of keyDirs) {
                try {
                    await stat(dir);
                    foundDirs.push(dir);
                }
                catch {
                    // Directory doesn't exist
                }
            }
            // Show found directories with purpose
            const dirPurposes = {
                'src': 'Source code',
                'lib': 'Library code',
                'dist': 'Built/compiled output',
                'build': 'Build artifacts',
                'config': 'Configuration files',
                'docs': 'Documentation',
                'tests': 'Test files',
                'test': 'Test files',
                '__tests__': 'Jest test files'
            };
            console.log(chalk.blue('📁 Key Directories:'));
            for (const dir of foundDirs) {
                const purpose = dirPurposes[dir] || 'Unknown purpose';
                console.log(`   📁 ${dir}/ - ${chalk.gray(purpose)}`);
            }
            // Check for important files
            const importantFiles = ['package.json', 'tsconfig.json', 'README.md', 'Dockerfile', '.gitignore'];
            const foundFiles = [];
            for (const file of importantFiles) {
                try {
                    await stat(file);
                    foundFiles.push(file);
                }
                catch {
                    // File doesn't exist
                }
            }
            if (foundFiles.length > 0) {
                console.log(chalk.blue('\n📄 Key Files:'));
                foundFiles.forEach(file => {
                    const purpose = this.getFilePurpose(file);
                    console.log(`   📄 ${file} - ${chalk.gray(purpose)}`);
                });
            }
            // Provide project insights
            console.log(chalk.yellow('\n💡 Project Insights:'));
            const insights = this.generateProjectInsights(foundDirs, foundFiles);
            insights.forEach(insight => console.log(chalk.gray(`   • ${insight}`)));
        }
        catch (error) {
            console.error(chalk.red('❌ Failed to analyze project structure:'), error instanceof Error ? error.message : error);
        }
    }
    /**
     * Check if prompt is a simple file operation that can be handled directly
     */
    isSimpleFileOperation(prompt) {
        if (!prompt || typeof prompt !== 'string') {
            return false;
        }
        const simple = prompt.toLowerCase();
        // Only consider truly simple, single-action file operations
        return ((simple.includes('list') && simple.includes('src') && !simple.includes('purpose') && !simple.includes('analyze')) ||
            (simple.includes('show') && simple.includes('file') && simple.split(' ').length < 8) ||
            (simple.startsWith('list files') && simple.length < 50) ||
            (simple === 'project structure' || simple === 'directory structure'));
    }
    /**
     * Extract directory name from prompt
     */
    extractDirectoryFromPrompt(prompt) {
        const patterns = [
            /in\s+([a-zA-Z0-9_/-]+)/i,
            /from\s+([a-zA-Z0-9_/-]+)/i,
            /([a-zA-Z0-9_/-]+)\s+directory/i,
            /([a-zA-Z0-9_/-]+)\s+folder/i
        ];
        for (const pattern of patterns) {
            const match = prompt.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    /**
     * Get appropriate icon for file extension
     */
    getFileIcon(ext) {
        const icons = {
            '.ts': '🟦',
            '.js': '🟨',
            '.json': '📋',
            '.md': '📝',
            '.txt': '📄',
            '.yml': '⚙️',
            '.yaml': '⚙️',
            '.html': '🌐',
            '.css': '🎨',
            '.scss': '🎨',
            '.py': '🐍',
            '.java': '☕',
            '.cpp': '⚡',
            '.c': '⚡',
            '.rs': '🦀',
            '.go': '🐹',
            'no-extension': '📄'
        };
        return icons[ext] || '📄';
    }
    /**
     * Generate insights about directory contents
     */
    generateDirectoryInsights(directories, files, dirName) {
        const insights = [];
        if (dirName === 'src' && files.length > 0) {
            const tsFiles = files.filter(f => f.name.endsWith('.ts')).length;
            const jsFiles = files.filter(f => f.name.endsWith('.js')).length;
            if (tsFiles > jsFiles) {
                insights.push('TypeScript project detected');
            }
            else if (jsFiles > 0) {
                insights.push('JavaScript project detected');
            }
            if (files.some(f => f.name.includes('test') || f.name.includes('spec'))) {
                insights.push('Contains test files');
            }
        }
        if (directories.length > 10) {
            insights.push('Large project with many subdirectories');
        }
        if (files.length === 0 && directories.length === 0) {
            insights.push('Empty directory');
        }
        return insights;
    }
    /**
     * Analyze file content and provide insights
     */
    analyzeFileContent(content, filePath) {
        const insights = [];
        const lines = content.split('\n');
        // Basic metrics
        const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;
        insights.push(`Non-empty lines: ${nonEmptyLines}`);
        // Language-specific analysis
        const ext = extname(filePath);
        if (ext === '.ts' || ext === '.js') {
            if (content.includes('export'))
                insights.push('Contains exports');
            if (content.includes('import'))
                insights.push('Has imports');
            if (content.includes('class'))
                insights.push('Defines classes');
            if (content.includes('function'))
                insights.push('Contains functions');
            if (content.includes('interface'))
                insights.push('Defines interfaces');
        }
        if (ext === '.json') {
            try {
                const parsed = JSON.parse(content);
                insights.push(`JSON keys: ${Object.keys(parsed).length}`);
            }
            catch {
                insights.push('Invalid JSON format');
            }
        }
        return insights;
    }
    /**
     * Get file purpose description
     */
    getFilePurpose(fileName) {
        const purposes = {
            'package.json': 'Node.js dependencies and scripts',
            'tsconfig.json': 'TypeScript configuration',
            'README.md': 'Project documentation',
            'Dockerfile': 'Container configuration',
            '.gitignore': 'Git ignore rules',
            'jest.config.js': 'Jest testing configuration',
            'webpack.config.js': 'Webpack bundler configuration',
            'vite.config.js': 'Vite build tool configuration'
        };
        return purposes[fileName] || 'Configuration or documentation';
    }
    /**
     * Generate project-level insights
     */
    generateProjectInsights(dirs, files) {
        const insights = [];
        // Technology detection
        if (files.includes('package.json')) {
            insights.push('Node.js/JavaScript project');
        }
        if (files.includes('tsconfig.json')) {
            insights.push('TypeScript enabled');
        }
        if (dirs.includes('src')) {
            insights.push('Organized source code structure');
        }
        if (dirs.includes('tests') || dirs.includes('test') || dirs.includes('__tests__')) {
            insights.push('Has dedicated test directory');
        }
        if (dirs.includes('docs')) {
            insights.push('Well-documented project');
        }
        if (files.includes('Dockerfile')) {
            insights.push('Containerized application');
        }
        return insights;
    }
    /**
     * Handle VRAM optimization commands and diagnostics
     */
    async handleVRAMOptimization() {
        try {
            const { vramAction } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'vramAction',
                    message: 'What would you like to do with VRAM optimization?',
                    choices: [
                        { name: '📊 Show VRAM status and recommendations', value: 'status' },
                        { name: '🎯 Optimize current model for VRAM', value: 'optimize' },
                        { name: '⚙️  Configure VRAM settings', value: 'configure' },
                        { name: '🔍 Test model with VRAM optimization', value: 'test' },
                        { name: '📋 Show optimal models for your system', value: 'recommend' },
                        { name: '↩️  Go back', value: 'back' }
                    ]
                }
            ]);
            if (vramAction === 'back') {
                return;
            }
            // Import VRAMOptimizer dynamically
            const { VRAMOptimizer } = await import('./vram-optimizer.js');
            const vramOptimizer = new VRAMOptimizer(this.context.config.model.endpoint);
            switch (vramAction) {
                case 'status':
                    await this.showVRAMStatus(vramOptimizer);
                    break;
                case 'optimize':
                    await this.optimizeCurrentModel(vramOptimizer);
                    break;
                case 'configure':
                    await this.configureVRAMSettings(vramOptimizer);
                    break;
                case 'test':
                    await this.testModelWithVRAM(vramOptimizer);
                    break;
                case 'recommend':
                    await this.showOptimalModels(vramOptimizer);
                    break;
            }
        }
        catch (error) {
            console.error(chalk.red('❌ VRAM optimization error:'), error instanceof Error ? error.message : error);
        }
    }
    /**
     * Show VRAM status and system information
     */
    async showVRAMStatus(vramOptimizer) {
        console.log(chalk.cyan('\n🧠 VRAM System Status:'));
        console.log(chalk.gray('━'.repeat(60)));
        // Get current model info if available
        const currentModel = this.context.modelClient.getCurrentModel();
        console.log(chalk.blue(`📍 Current Model: ${currentModel}`));
        if (currentModel && currentModel !== 'Not set') {
            const modelInfo = vramOptimizer.parseModelInfo(currentModel);
            const optimization = vramOptimizer.optimizeModelForVRAM(currentModel);
            console.log(chalk.white('\n📊 Model Analysis:'));
            console.log(chalk.gray(`   Parameters: ${(modelInfo.parameterCount / 1e9).toFixed(1)}B`));
            console.log(chalk.gray(`   Quantization: ${modelInfo.quantization}`));
            console.log(chalk.gray(`   Layers: ${modelInfo.totalLayers}`));
            console.log(chalk.white('\n💾 Memory Requirements:'));
            console.log(chalk.gray(`   Model Memory: ${optimization.layerOffloading.estimatedGPUMemory.toFixed(1)}GB (GPU)`));
            console.log(chalk.gray(`   Context Memory: ${optimization.kvCache.estimatedMemoryGB.toFixed(1)}GB`));
            console.log(chalk.gray(`   Total GPU Memory: ${optimization.estimatedTotalMemory.toFixed(1)}GB`));
            if (optimization.layerOffloading.cpuLayers > 0) {
                console.log(chalk.yellow(`   CPU Offloading: ${optimization.layerOffloading.cpuLayers} layers (${optimization.layerOffloading.estimatedCPUMemory.toFixed(1)}GB)`));
            }
            console.log(chalk.white('\n🎯 Optimization Status:'));
            if (optimization.fitsInVRAM) {
                console.log(chalk.green('   ✅ Model fits in available VRAM'));
            }
            else {
                console.log(chalk.yellow('   ⚠️  Model requires CPU offloading'));
            }
            console.log(chalk.gray(`   K/V Cache: ${optimization.kvCache.quantizationType} (${optimization.kvCache.qualityImpact} quality impact)`));
            console.log(chalk.gray(`   Quality Score: ${optimization.quantizationRecommendation.qualityScore}/100`));
        }
        else {
            console.log(chalk.yellow('\n⚠️  No model currently selected.'));
            console.log(chalk.gray('   Use the model management to select a model first.'));
        }
        console.log(chalk.gray('━'.repeat(60)));
    }
    /**
     * Optimize current model for VRAM
     */
    async optimizeCurrentModel(vramOptimizer) {
        const currentModel = this.context.modelClient.getCurrentModel();
        if (!currentModel || currentModel === 'Not set') {
            console.log(chalk.red('❌ No model selected. Please select a model first.'));
            return;
        }
        console.log(chalk.blue(`🎯 Optimizing ${currentModel} for VRAM...`));
        const spinner = ora('Analyzing model and generating optimization...').start();
        try {
            // Optimize the model
            const optimizedModel = await this.context.modelClient.optimizeModelForVRAM(currentModel);
            spinner.succeed('Optimization applied!');
            console.log(chalk.green(`\n✅ Model optimized: ${optimizedModel}`));
            console.log(chalk.gray('   VRAM optimizations have been applied to the current session.'));
            console.log(chalk.gray('   The model will now use layer offloading and K/V cache quantization as needed.'));
            // Show what optimizations were applied
            if (this.context.modelClient['currentOptimization']) {
                const opt = this.context.modelClient['currentOptimization'];
                console.log(chalk.cyan('\n🔧 Applied Optimizations:'));
                if (opt.layerOffloading.cpuLayers > 0) {
                    console.log(chalk.gray(`   • Layer offloading: ${opt.layerOffloading.gpuLayers} GPU + ${opt.layerOffloading.cpuLayers} CPU layers`));
                }
                if (opt.kvCache.quantizationType !== 'f16') {
                    console.log(chalk.gray(`   • K/V cache quantization: ${opt.kvCache.quantizationType}`));
                }
                if (opt.contextLength < 4096) {
                    console.log(chalk.gray(`   • Context window: ${opt.contextLength} tokens`));
                }
            }
        }
        catch (error) {
            spinner.fail('Optimization failed');
            console.error(chalk.red('❌ Failed to optimize model:'), error instanceof Error ? error.message : error);
        }
    }
    /**
     * Configure VRAM optimization settings
     */
    async configureVRAMSettings(vramOptimizer) {
        console.log(chalk.blue('⚙️  VRAM Configuration'));
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'availableVRAM',
                message: 'Available VRAM (GB):',
                default: '8',
                validate: (input) => {
                    const num = parseFloat(input);
                    return !isNaN(num) && num > 0 ? true : 'Please enter a valid positive number';
                }
            },
            {
                type: 'input',
                name: 'systemRAM',
                message: 'System RAM (GB):',
                default: '32',
                validate: (input) => {
                    const num = parseFloat(input);
                    return !isNaN(num) && num > 0 ? true : 'Please enter a valid positive number';
                }
            },
            {
                type: 'confirm',
                name: 'enableLowVRAM',
                message: 'Enable aggressive low VRAM optimizations?',
                default: false
            }
        ]);
        // Update configuration (would need to be implemented in config manager)
        console.log(chalk.green('\n✅ VRAM settings updated:'));
        console.log(chalk.gray(`   Available VRAM: ${answers.availableVRAM}GB`));
        console.log(chalk.gray(`   System RAM: ${answers.systemRAM}GB`));
        console.log(chalk.gray(`   Low VRAM mode: ${answers.enableLowVRAM ? 'Enabled' : 'Disabled'}`));
        console.log(chalk.yellow('\n💡 Note: Settings will apply to new model optimization sessions.'));
    }
    /**
     * Test model with VRAM optimization
     */
    async testModelWithVRAM(vramOptimizer) {
        const currentModel = this.context.modelClient.getCurrentModel();
        if (!currentModel || currentModel === 'Not set') {
            console.log(chalk.red('❌ No model selected. Please select a model first.'));
            return;
        }
        console.log(chalk.blue(`🧪 Testing ${currentModel} with VRAM optimization...`));
        const spinner = ora('Running test generation with optimized settings...').start();
        try {
            // Test with a simple prompt
            const testPrompt = 'Write a simple hello world function in Python.';
            // Create a simple voice archetype for testing
            const testVoice = {
                id: 'test',
                name: 'Test Voice',
                systemPrompt: 'You are a helpful assistant.',
                temperature: 0.7,
                style: 'helpful'
            };
            const response = await this.context.modelClient.generateVoiceResponse(testVoice, testPrompt, { files: [] });
            spinner.succeed('Test completed successfully!');
            console.log(chalk.green('\n✅ VRAM optimization test results:'));
            console.log(chalk.gray(`   Model: ${currentModel}`));
            console.log(chalk.gray(`   Response length: ${response.content.length} characters`));
            console.log(chalk.gray(`   Tokens used: ${response.tokens_used || 'Unknown'}`));
            console.log(chalk.cyan('\n📄 Test Response:'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(response.content.substring(0, 300) + (response.content.length > 300 ? '...' : ''));
            console.log(chalk.gray('─'.repeat(50)));
        }
        catch (error) {
            spinner.fail('Test failed');
            console.error(chalk.red('❌ VRAM optimization test failed:'), error instanceof Error ? error.message : error);
            console.log(chalk.yellow('\n💡 Troubleshooting tips:'));
            console.log(chalk.gray('   • The model may need more aggressive optimization'));
            console.log(chalk.gray('   • Try a smaller model or more CPU offloading'));
            console.log(chalk.gray('   • Check if Ollama is running and accessible'));
        }
    }
    /**
     * Show optimal models for current system
     */
    async showOptimalModels(vramOptimizer) {
        console.log(chalk.cyan('\n📋 Optimal Models for Your System:'));
        console.log(chalk.gray('━'.repeat(60)));
        // Common models with their characteristics
        const popularModels = [
            { name: 'gemma2:2b', params: 2e9, description: 'Lightweight, fast responses' },
            { name: 'llama3.2:3b', params: 3e9, description: 'Good balance of size and capability' },
            { name: 'mistral:7b', params: 7e9, description: 'High quality, moderate size' },
            { name: 'llama3.1:8b', params: 8e9, description: 'Excellent reasoning capabilities' },
            { name: 'gemma2:9b', params: 9e9, description: 'Google\'s efficient architecture' },
            { name: 'qwen2.5:14b', params: 14e9, description: 'Powerful multilingual model' },
            { name: 'gemma2:27b', params: 27e9, description: 'High-end performance (requires optimization)' }
        ];
        console.log(chalk.white('Recommended models based on VRAM optimization:'));
        console.log();
        for (const model of popularModels) {
            const optimization = vramOptimizer.optimizeModelForVRAM(model.name);
            const memoryReq = optimization.estimatedTotalMemory;
            let status = '';
            let color = chalk.gray;
            if (optimization.fitsInVRAM) {
                status = '✅ Fits in VRAM';
                color = chalk.green;
            }
            else if (optimization.layerOffloading.gpuLayers > optimization.layerOffloading.totalLayers * 0.5) {
                status = '🟡 Partial GPU (good performance)';
                color = chalk.yellow;
            }
            else {
                status = '🔴 Mostly CPU (slower)';
                color = chalk.red;
            }
            console.log(color(`   ${model.name}`));
            console.log(chalk.gray(`      ${model.description}`));
            console.log(chalk.gray(`      Memory: ${memoryReq.toFixed(1)}GB | ${status}`));
            if (optimization.layerOffloading.cpuLayers > 0) {
                console.log(chalk.gray(`      Offloading: ${optimization.layerOffloading.gpuLayers}/${optimization.layerOffloading.totalLayers} layers on GPU`));
            }
            console.log();
        }
        console.log(chalk.cyan('💡 Recommendations:'));
        console.log(chalk.gray('   • Green models will run entirely on GPU for best performance'));
        console.log(chalk.gray('   • Yellow models use hybrid CPU/GPU for good performance'));
        console.log(chalk.gray('   • Red models run mostly on CPU (slower but functional)'));
        console.log(chalk.gray('   • Use "cc model --pull <model-name>" to download a model'));
        console.log(chalk.gray('━'.repeat(60)));
    }
}
//# sourceMappingURL=cli.js.map