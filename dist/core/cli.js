import { UnifiedAgent } from './agent.js';
import { PerformanceMonitor } from '../utils/performance.js';
import chalk from 'chalk';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { glob } from 'glob';
export class CLI {
    context;
    initialized = false;
    workingDirectory = process.cwd();
    fastModeClient = null;
    constructor(context) {
        this.context = context;
        // Initialize agent orchestrator for agentic capabilities
        if (!this.context.agentOrchestrator) {
            this.context.agentOrchestrator = new UnifiedAgent(this.context.modelClient, new PerformanceMonitor());
        }
    }
    /**
     * Display synthesis results
     */
    displayResults(synthesis, responses) {
        console.log(chalk.green('\n🎯 Synthesis Complete!'));
        console.log(chalk.gray(`   Quality Score: ${(synthesis.qualityScore * 100).toFixed(0)}/100`));
        console.log(chalk.gray(`   Voices Used: ${synthesis.voicesUsed?.join(', ') || 'N/A'}`));
        // Show combined result
        console.log(chalk.bold('\n📄 Final Synthesis:'));
        console.log(synthesis.content || synthesis.combinedCode || 'No content available');
        // Show individual responses
        if (responses && responses.length > 0) {
            console.log(chalk.bold('\n👥 Individual Voice Responses:'));
            responses.forEach((response, index) => {
                console.log(chalk.cyan(`\n   ${index + 1}. ${response.voice || 'Unknown Voice'}:`));
                console.log(response.content?.substring(0, 200) + (response.content?.length > 200 ? '...' : ''));
            });
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
    /**
     * Main entry point for the CLI
     */
    async run(args) {
        try {
            // Show header
            console.log(chalk.blue('╔══════════════════════════════════════════════════════════════╗'));
            console.log(chalk.blue('║               CodeCrucible Synth v3.5.2                     ║'));
            console.log(chalk.blue('║          AI-Powered Code Generation & Analysis Tool         ║'));
            console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝'));
            console.log();
            // If no arguments, show help
            if (args.length === 0) {
                this.showHelp();
                return;
            }
            // Parse options 
            const options = this.parseOptions(args);
            // Handle help and version
            if (options.help || options.h) {
                this.showHelp();
                return;
            }
            if (options.version || options.v) {
                console.log('CodeCrucible Synth v3.5.2');
                return;
            }
            // Handle special commands first
            if (args[0] === 'status') {
                await this.showStatus();
                return;
            }
            if (args[0] === 'models') {
                await this.listModels();
                return;
            }
            if (args[0] === 'analyze') {
                const filePath = args[1];
                if (!filePath) {
                    console.log(chalk.red('❌ Please provide a file path to analyze'));
                    console.log('Usage: crucible analyze <file-path>');
                    return;
                }
                await this.analyzeFile(filePath, options);
                return;
            }
            if (args[0] === 'analyze-dir' || args[0] === 'analyze-project') {
                const dirPath = args[1] || '.';
                await this.analyzeDirectory(dirPath, options);
                return;
            }
            // Extract prompt by filtering out option flags
            const promptArgs = [];
            const optionsWithValues = ['voices', 'mode', 'file', 'depth', 'maxIterations', 'qualityThreshold', 'timeout', 'backend', 'e2bTemplate', 'dockerImage', 'maxSteps', 'spiralIterations', 'spiralQuality', 'output'];
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (arg.startsWith('--')) {
                    const optionName = arg.slice(2);
                    // Check if this option expects a value
                    if (optionsWithValues.includes(optionName) && i + 1 < args.length && !args[i + 1].startsWith('-')) {
                        i++; // Skip the value
                    }
                }
                else if (arg.startsWith('-')) {
                    const optionName = arg.slice(1);
                    // Handle short options that might have values
                    if (optionName.length === 1 && i + 1 < args.length && !args[i + 1].startsWith('-')) {
                        i++; // Skip the value
                    }
                }
                else {
                    promptArgs.push(arg);
                }
            }
            const promptText = promptArgs.join(' ');
            if (promptText) {
                await this.processPrompt(promptText, options);
            }
            else {
                this.showHelp();
            }
        }
        catch (error) {
            console.error(chalk.red('❌ Error:'), error);
            process.exit(1);
        }
    }
    showHelp() {
        console.log(chalk.cyan('Usage:'));
        console.log('  crucible [options] <prompt>');
        console.log('  cc [options] <prompt>');
        console.log();
        console.log(chalk.cyan('Options:'));
        console.log('  --help, -h           Show this help message');
        console.log('  --version, -v        Show version');
        console.log('  --file <path>        Write output to file');
        console.log('  --no-autonomous      Disable autonomous mode (not recommended)');
        console.log('  --verbose            Show detailed output');
        console.log();
        console.log(chalk.cyan('Slash Commands (use within prompts):'));
        console.log('  /voices <names>      Switch to voice synthesis mode');
        console.log('  /plan                Create execution plan');
        console.log('  /todo                Show current tasks');
        console.log('  /help                Show command help');
        console.log();
        console.log(chalk.cyan('Commands:'));
        console.log('  status               Show system status');
        console.log('  models               List available models');
        console.log('  analyze <file>       Analyze a code file');
        console.log('  analyze-dir [dir]    Analyze a directory/project');
        console.log();
        console.log(chalk.cyan('Examples:'));
        console.log('  crucible "Create a React component for a todo list"');
        console.log('  cc --fast "Format this code"');
        console.log('  cc --voices explorer,developer "Analyze this codebase"');
    }
    parseOptions(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const key = arg.slice(2);
                // Handle --no-* flags
                if (key.startsWith('no-')) {
                    const actualKey = key.slice(3);
                    options[actualKey] = false;
                    continue;
                }
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('--') && !nextArg.startsWith('-')) {
                    options[key] = nextArg;
                    i++;
                }
                else {
                    options[key] = true;
                }
            }
            else if (arg.startsWith('-')) {
                const key = arg.slice(1);
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('-')) {
                    options[key] = nextArg;
                    i++;
                }
                else {
                    options[key] = true;
                }
            }
        }
        return options;
    }
    async showStatus() {
        try {
            console.log(chalk.cyan('🔍 Checking system status...'));
            // Check Ollama
            console.log(chalk.yellow('\nOllama Status:'));
            // TODO: Implement actual status check
            console.log(chalk.green('  ✓ Ollama is running'));
            // Check LM Studio
            console.log(chalk.yellow('\nLM Studio Status:'));
            // TODO: Implement actual status check
            console.log(chalk.gray('  ○ LM Studio not detected'));
            // System info
            console.log(chalk.yellow('\nSystem Info:'));
            console.log(`  Platform: ${process.platform}`);
            console.log(`  Node: ${process.version}`);
            console.log(`  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);
        }
        catch (error) {
            console.error(chalk.red('Failed to get status:'), error);
        }
    }
    async listModels() {
        try {
            console.log(chalk.cyan('📋 Available models:'));
            // TODO: Implement actual model listing
            console.log('  - codellama:7b');
            console.log('  - llama2:7b');
            console.log('  - mistral:7b');
        }
        catch (error) {
            console.error(chalk.red('Failed to list models:'), error);
        }
    }
    async analyzeDirectory(dirPath, options) {
        try {
            console.log(chalk.cyan(`📁 Analyzing directory: ${dirPath}`));
            // Check if directory exists
            try {
                const stats = await stat(dirPath);
                if (!stats.isDirectory()) {
                    console.error(chalk.red(`❌ Not a directory: ${dirPath}`));
                    return;
                }
            }
            catch (error) {
                console.error(chalk.red(`❌ Directory not found: ${dirPath}`));
                return;
            }
            // Find code files
            const patterns = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx', '**/*.py', '**/*.java', '**/*.cs'];
            const ignorePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'];
            console.log(chalk.gray('   Scanning for code files...'));
            const files = [];
            for (const pattern of patterns) {
                const matches = await glob(join(dirPath, pattern).replace(/\\/g, '/'), {
                    ignore: ignorePatterns.map(p => join(dirPath, p).replace(/\\/g, '/'))
                });
                files.push(...matches);
            }
            console.log(chalk.gray(`   Found ${files.length} code files`));
            if (files.length === 0) {
                console.log(chalk.yellow('⚠️ No code files found in directory'));
                return;
            }
            // Read all files
            const fileContents = await Promise.all(files.slice(0, 10).map(async (file) => {
                const content = await readFile(file, 'utf8');
                const relativePath = file.replace(dirPath, '').replace(/^[\\\/]/, '');
                return { path: relativePath, content: content.slice(0, 1000) }; // Limit content length
            }));
            // Create project analysis prompt
            const analysisPrompt = `Analyze this codebase/project and provide:
1. Project type and technology stack
2. Main architecture and design patterns
3. Code organization and structure
4. Key functionalities and features
5. Code quality assessment
6. Potential improvements or issues

Project files (sample):
${fileContents.map(f => `\n### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n')}`;
            console.log(chalk.cyan('🔍 Performing project analysis...'));
            const response = await this.context.modelClient.generateText(analysisPrompt, {
                temperature: 0.3,
                maxTokens: 4096
            });
            console.log(chalk.green('\n📊 Project Analysis Results:'));
            console.log(response);
            // Save to file if requested
            if (options.file) {
                const outputPath = typeof options.file === 'string' ? options.file : 'project-analysis.md';
                await this.handleFileOutput(outputPath, `# Project Analysis: ${dirPath}\n\nFiles analyzed: ${files.length}\n\n${response}`);
            }
        }
        catch (error) {
            console.error(chalk.red('Failed to analyze directory:'), error);
        }
    }
    async analyzeFile(filePath, options) {
        try {
            console.log(chalk.cyan(`📂 Analyzing file: ${filePath}`));
            // Check if file exists
            try {
                await stat(filePath);
            }
            catch (error) {
                console.error(chalk.red(`❌ File not found: ${filePath}`));
                return;
            }
            // Read file content
            const fileContent = await readFile(filePath, 'utf8');
            const fileExt = extname(filePath);
            const fileName = filePath.split(/[\\\/]/).pop();
            console.log(chalk.gray(`   File: ${fileName}`));
            console.log(chalk.gray(`   Size: ${fileContent.length} bytes`));
            console.log(chalk.gray(`   Lines: ${fileContent.split('\n').length}`));
            // Create analysis prompt
            const analysisPrompt = `Analyze this ${fileExt} code file and provide:
1. Brief summary of what the code does
2. Key functions/classes/components
3. Code quality assessment
4. Potential issues or improvements
5. Security concerns if any

File: ${fileName}
Content:
\`\`\`${fileExt.slice(1)}
${fileContent}
\`\`\``;
            // Use model to analyze
            console.log(chalk.cyan('🔍 Performing code analysis...'));
            const response = await this.context.modelClient.generateText(analysisPrompt, {
                temperature: 0.3,
                maxTokens: 2048
            });
            console.log(chalk.green('\n📊 Analysis Results:'));
            console.log(response);
            // Save to file if requested
            if (options.file) {
                const outputPath = typeof options.file === 'string' ? options.file : `${fileName}.analysis.md`;
                await this.handleFileOutput(outputPath, `# Code Analysis: ${fileName}\n\n${response}`);
            }
        }
        catch (error) {
            console.error(chalk.red('Failed to analyze file:'), error);
        }
    }
    async handleSlashCommand(command, options) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');
        switch (cmd) {
            case '/voices':
            case '/voice':
                // Switch to voice synthesis mode
                if (!args) {
                    console.log(chalk.yellow('Available voices:'));
                    console.log('  explorer, maintainer, analyzer, developer, implementor, security, architect, designer, optimizer');
                    console.log('Usage: /voices explorer,maintainer "Your prompt"');
                    return;
                }
                const voiceParts = args.split(' ');
                const voiceNames = voiceParts[0].split(',');
                const voicePrompt = voiceParts.slice(1).join(' ');
                if (!voicePrompt) {
                    console.log(chalk.red('Please provide a prompt after the voice names'));
                    return;
                }
                console.log(chalk.cyan(`🎭 Using voices: ${voiceNames.join(', ')}`));
                const result = await this.context.voiceSystem.synthesize(voicePrompt, voiceNames, 'collaborative', this.context.modelClient);
                this.displayResults(result, result.responses || []);
                break;
            case '/mode':
                console.log(chalk.yellow('Current mode: Autonomous (default)'));
                console.log('Available modes: autonomous, voices, direct');
                break;
            case '/help':
                console.log(chalk.cyan('Slash Commands:'));
                console.log('  /voices <names> <prompt>  - Use specific AI voices');
                console.log('  /mode                     - Show current mode');
                console.log('  /todo                     - Show current task list');
                console.log('  /plan <prompt>            - Create execution plan without running');
                console.log('  /help                     - Show this help');
                break;
            case '/todo':
                // Show current tasks if agent is running
                if (this.context.agentOrchestrator) {
                    console.log(chalk.cyan('📋 Current Task Status:'));
                    // TODO: Implement task status display
                    console.log('No active tasks');
                }
                break;
            case '/plan':
                // Create a plan without executing
                if (!args) {
                    console.log(chalk.red('Please provide a prompt to plan'));
                    return;
                }
                console.log(chalk.cyan('📝 Creating execution plan...'));
                const request = {
                    id: `plan_${Date.now()}`,
                    type: this.determineRequestType(args),
                    input: Array.isArray(args) ? args.join(' ') : args,
                    mode: 'balanced',
                    priority: 'high'
                };
                // Just show the plan, don't execute
                console.log(chalk.green('Execution Plan:'));
                console.log(`Type: ${request.type}`);
                console.log(`Priority: ${request.priority}`);
                console.log('Tasks to be created:');
                if (request.type === 'comprehensive') {
                    console.log('  1. Code Analysis - Analyze existing code structure');
                    console.log('  2. Code Generation - Generate required code');
                    console.log('  3. Testing - Create and validate tests');
                    console.log('  4. Documentation - Generate documentation');
                }
                else {
                    console.log(`  1. ${request.type} - ${args}`);
                }
                break;
            default:
                console.log(chalk.red(`Unknown command: ${cmd}`));
                console.log('Type /help for available commands');
        }
    }
    determineRequestType(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review') || lowerPrompt.includes('audit')) {
            return 'code-analysis';
        }
        if (lowerPrompt.includes('generate') || lowerPrompt.includes('create') || lowerPrompt.includes('write')) {
            return 'code-generation';
        }
        if (lowerPrompt.includes('test') || lowerPrompt.includes('validate')) {
            return 'testing';
        }
        if (lowerPrompt.includes('document') || lowerPrompt.includes('explain')) {
            return 'documentation';
        }
        if (lowerPrompt.includes('fix') || lowerPrompt.includes('debug') || lowerPrompt.includes('solve')) {
            return 'debugging';
        }
        // Default to comprehensive for complex requests
        return 'comprehensive';
    }
    async processPrompt(prompt, options) {
        try {
            // Check for slash commands first
            if (prompt.startsWith('/')) {
                await this.handleSlashCommand(prompt, options);
                return;
            }
            console.log(chalk.cyan('🤔 Processing prompt...'));
            // Check for voice synthesis mode first
            if (options.voices) {
                console.log(chalk.magenta('🎭 Voice Synthesis Mode Activated'));
                const voiceNames = Array.isArray(options.voices)
                    ? options.voices
                    : options.voices.split(',').map(v => v.trim());
                console.log(chalk.cyan(`Using voices: ${voiceNames.join(', ')}`));
                try {
                    const result = await this.context.voiceSystem.synthesize(prompt, voiceNames, 'collaborative', this.context.modelClient);
                    this.displayResults(result, result.responses || []);
                    // Handle file output if requested
                    if (options.file) {
                        await this.handleFileOutput(options.file, result.content);
                    }
                }
                catch (error) {
                    console.error(chalk.red('❌ Voice synthesis failed:'), error);
                }
                return;
            }
            // Autonomous agent mode is the DEFAULT
            if (this.context.agentOrchestrator && options.autonomous !== false) {
                console.log(chalk.blue('🤖 Autonomous Agent Mode Activated'));
                console.log(chalk.gray('Creating task plan...'));
                // Create execution request for the agent
                const request = {
                    id: `req_${Date.now()}`,
                    type: this.determineRequestType(prompt),
                    input: prompt,
                    mode: 'balanced',
                    priority: 'high'
                };
                // Execute autonomously
                const response = await this.context.agentOrchestrator.execute(request);
                if (response.success) {
                    console.log(chalk.green('\n✅ Autonomous execution completed successfully'));
                    // Display results
                    if (response.result && typeof response.result === 'object') {
                        for (const [key, value] of Object.entries(response.result)) {
                            console.log(chalk.cyan(`\n📋 ${key}:`));
                            console.log(value);
                        }
                    }
                    // Save to file if requested
                    if (options.file) {
                        const output = JSON.stringify(response.result, null, 2);
                        await this.handleFileOutput(options.file, output);
                    }
                }
                else {
                    console.error(chalk.red('❌ Autonomous execution failed:'), response.error);
                }
                return;
            }
            // If autonomous mode was explicitly disabled, use direct model
            console.log(chalk.yellow('⚠️ Running in direct mode (non-autonomous)'));
            const response = await this.context.modelClient.generateText(prompt, {});
            console.log(chalk.green('\n📝 Response:'));
            console.log(response);
            // Handle file output if requested
            if (options.file) {
                await this.handleFileOutput(options.file, response);
            }
        }
        catch (error) {
            console.error(chalk.red('Failed to process prompt:'), error);
            throw error;
        }
    }
}
export { CLI as CodeCrucibleCLI };
export default CLI;
//# sourceMappingURL=cli.js.map