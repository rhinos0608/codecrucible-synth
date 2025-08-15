import { logger } from './logger.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { glob } from 'glob';
export class CodeCrucibleCLI {
    context;
    constructor(context) {
        this.context = context;
    }
    async handleGeneration(prompt, options) {
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
            const synthesisMode = options.mode || 'competitive';
            const analysisDepth = parseInt(options.depth || '2');
            console.log(chalk.cyan(`   Voices: ${voices.join(', ')}`));
            console.log(chalk.cyan(`   Mode: ${synthesisMode}`));
            // Get project context
            const projectContext = await this.getProjectContext(options.file, options.project);
            // Generate with spinner
            const spinner = ora('Generating solutions from multiple voices...').start();
            try {
                const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(prompt, voices, projectContext);
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
            console.error(chalk.red('❌ Generation failed:'), error instanceof Error ? error.message : error);
        }
    }
    async handleCouncilMode(prompt, options) {
        const councilVoices = options.voices ?
            this.parseVoices(options.voices) :
            this.context.config.voices.available;
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
            const projectContext = await this.getProjectContext();
            const response = await this.context.modelClient.generateVoiceResponse(voiceArchetype, prompt, projectContext);
            spinner.succeed(`${voice} has responded!`);
            console.log(chalk.bold(`\n🎭 ${response.voice}:`));
            console.log(chalk.gray(`Confidence: ${Math.round(response.confidence * 100)}%`));
            console.log(chalk.gray(`Tokens: ${response.tokens_used}`));
            console.log('\n' + response.content);
        }
        catch (error) {
            spinner.fail(`${voice} encountered an error`);
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
                    prompt = `Refactor this ${language} code to improve readability, maintainability, and performance while preserving functionality.`;
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
            await this.handleGeneration(prompt, { ...options, voices: voices.join(',') });
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
                    prompt = 'Suggest refactoring opportunities across this project to improve maintainability and performance.';
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
            console.log(chalk.cyan(`Analyzing ${files.length} files with voices: ${voices.join(', ')}`));
            const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(prompt, voices, projectContext);
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
        const defaultVoices = this.parseVoices(options.voices);
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
        if (options.status) {
            const spinner = ora('Checking model status...').start();
            try {
                const isReady = await this.context.modelClient.checkConnection();
                if (isReady) {
                    spinner.succeed('Model is ready!');
                    console.log(chalk.green('✅ gpt-oss-20b is available and responding'));
                }
                else {
                    spinner.fail('Model not available');
                    console.log(chalk.red('❌ gpt-oss-20b is not available'));
                    console.log(chalk.yellow('💡 Make sure Ollama is running: ollama serve'));
                    console.log(chalk.yellow('💡 Install model: ollama pull gpt-oss:20b'));
                }
            }
            catch (error) {
                spinner.fail('Status check failed');
                console.error(chalk.red('❌ Status check failed:'), error instanceof Error ? error.message : error);
            }
        }
        if (options.install) {
            console.log(chalk.blue('📦 To install gpt-oss-20b:'));
            console.log(chalk.gray('1. Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh'));
            console.log(chalk.gray('2. Pull model: ollama pull gpt-oss:20b'));
            console.log(chalk.gray('3. Start server: ollama serve'));
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
        console.log(chalk.bold('Configuration:'));
        console.log(chalk.green('  cc config --list'));
        console.log(chalk.green('  cc config --set voices.default=explorer,maintainer'));
    }
    // Helper methods
    parseVoices(voicesStr) {
        if (!voicesStr) {
            const defaultVoices = this.context.config.voices.default;
            // Ensure we always return an array
            return Array.isArray(defaultVoices) ? defaultVoices : ['explorer', 'maintainer'];
        }
        if (voicesStr === 'all') {
            const availableVoices = this.context.config.voices.available;
            // Ensure we always return an array
            return Array.isArray(availableVoices) ? availableVoices : ['explorer', 'maintainer', 'analyzer', 'developer'];
        }
        return voicesStr.split(',').map(v => v.trim().toLowerCase());
    }
    async getProjectContext(file, project) {
        const context = { files: [] };
        if (file) {
            try {
                const content = await readFile(file, 'utf8');
                const language = this.detectLanguage(extname(file));
                context.files.push({ path: file, content, language });
            }
            catch (error) {
                logger.warn(`Could not read file ${file}:`, error);
            }
        }
        if (project) {
            const files = await glob('**/*.{js,ts,jsx,tsx}', {
                ignore: ['node_modules/**', '.git/**', 'dist/**'],
                maxDepth: 3
            });
            const projectFiles = await this.buildProjectContext(files.slice(0, 5));
            context.files.push(...projectFiles);
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
        }
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
}
//# sourceMappingURL=cli.js.map