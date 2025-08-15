import { logger } from './logger.js';
import chalk from 'chalk';
import { readFile, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { spawn } from 'child_process';
import { glob } from 'glob';
/**
 * Simple Agentic Client - Like Claude Code
 *
 * Focuses on:
 * - Understanding the current codebase
 * - Reading and modifying files directly
 * - Executing commands when needed
 * - Simple interactive command processing
 */
export class SimpleAgenticClient {
    context;
    codebase;
    isActive = false;
    constructor(context) {
        this.context = context;
        this.codebase = {
            rootPath: process.cwd(),
            files: new Map(),
            structure: {},
            lastScanned: 0
        };
    }
    /**
     * Start the agentic client
     */
    async start() {
        console.log(chalk.cyan('🤖 CodeCrucible Autonomous Coding Agent'));
        console.log(chalk.gray('   Similar to Claude Code - I can read, understand, and modify your codebase\n'));
        try {
            // Scan the codebase first
            await this.scanCodebase();
            this.isActive = true;
            console.log(chalk.green('✅ Ready! I understand your codebase.'));
            console.log(chalk.gray('   Type what you want me to do, or "help" for examples\n'));
            // Start the interactive loop
            await this.interactiveLoop();
        }
        catch (error) {
            logger.error('Failed to start agentic client:', error);
            console.error(chalk.red('❌ Failed to start:'), error);
        }
    }
    /**
     * Scan the codebase to understand structure
     */
    async scanCodebase() {
        console.log(chalk.gray('📁 Scanning codebase...'));
        try {
            // Get all relevant files
            const files = await glob('**/*.{js,ts,jsx,tsx,py,java,cpp,c,h,cs,php,rb,go,rs,json,yaml,yml,md,txt}', {
                ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**', '**/*.log'],
                cwd: this.codebase.rootPath
            });
            // Load key files immediately
            const keyFiles = ['package.json', 'README.md', 'tsconfig.json', '.gitignore', 'Dockerfile'];
            for (const file of keyFiles) {
                try {
                    const content = await readFile(join(this.codebase.rootPath, file), 'utf8');
                    const stats = await stat(join(this.codebase.rootPath, file));
                    this.codebase.files.set(file, {
                        path: file,
                        content,
                        language: this.detectLanguage(extname(file)),
                        size: stats.size
                    });
                }
                catch {
                    // File doesn't exist, skip
                }
            }
            // Load structure info for other files (without content for performance)
            for (const file of files.slice(0, 50)) { // Limit files we track
                try {
                    const stats = await stat(join(this.codebase.rootPath, file));
                    if (stats.size < 50000) { // Only load small files immediately
                        const content = await readFile(join(this.codebase.rootPath, file), 'utf8');
                        this.codebase.files.set(file, {
                            path: file,
                            content,
                            language: this.detectLanguage(extname(file)),
                            size: stats.size
                        });
                    }
                    else {
                        // Just track the file exists
                        this.codebase.files.set(file, {
                            path: file,
                            content: '', // Will load on demand
                            language: this.detectLanguage(extname(file)),
                            size: stats.size
                        });
                    }
                }
                catch {
                    // Skip files that can't be read
                }
            }
            this.codebase.lastScanned = Date.now();
            console.log(chalk.green(`✅ Scanned ${this.codebase.files.size} files`));
        }
        catch (error) {
            logger.error('Failed to scan codebase:', error);
            console.log(chalk.yellow('⚠️  Could not scan codebase, continuing anyway'));
        }
    }
    /**
     * Interactive command loop
     */
    async interactiveLoop() {
        const inquirer = (await import('inquirer')).default;
        while (this.isActive) {
            try {
                const { command } = await inquirer.prompt({
                    type: 'input',
                    name: 'command',
                    message: chalk.blue('> ')
                });
                const trimmed = command.trim().toLowerCase();
                if (trimmed === 'exit' || trimmed === 'quit') {
                    console.log(chalk.yellow('👋 Goodbye!'));
                    this.isActive = false;
                    break;
                }
                if (trimmed === 'help') {
                    this.showHelp();
                    continue;
                }
                if (trimmed === 'status') {
                    this.showStatus();
                    continue;
                }
                if (command.trim()) {
                    await this.processCommand(command);
                }
                console.log(); // Add spacing
            }
            catch (error) {
                if (error instanceof Error && error.message.includes('User force closed')) {
                    console.log(chalk.yellow('\n👋 Goodbye!'));
                    this.isActive = false;
                    break;
                }
                console.error(chalk.red('Error:'), error);
            }
        }
    }
    /**
     * Process a natural language command
     */
    async processCommand(command) {
        console.log(chalk.blue(`🎯 Processing: ${command}\n`));
        try {
            // Use the developer voice for understanding commands
            const response = await this.context.modelClient.generateVoiceResponse({
                id: 'developer',
                name: 'Developer',
                systemPrompt: `You are an autonomous coding agent like Claude Code. You can read files, modify code, run commands, and help with development tasks.

Current codebase context:
- Root: ${this.codebase.rootPath}
- Files: ${Array.from(this.codebase.files.keys()).slice(0, 10).join(', ')}${this.codebase.files.size > 10 ? '...' : ''}

Available actions:
- Read files: "read <filename>" or "show me <filename>"
- Write files: "write <filename>" or "create <filename>"
- Run commands: "run <command>" or "execute <command>"
- Analyze code: "analyze <filename>" or "review <filename>"
- Explain: "explain <concept>" or "how does <filename> work"

Respond with:
1. What you understand from the request
2. What actions you'll take
3. Any questions if unclear

Be direct and helpful like Claude Code.`,
                temperature: 0.7,
                style: 'helpful'
            }, command, this.buildProjectContext());
            console.log(chalk.green('💡 Understanding:'));
            console.log(response.content);
            // Try to extract and execute specific actions
            await this.executeActions(command, response.content);
        }
        catch (error) {
            logger.error('Failed to process command:', error);
            console.error(chalk.red('❌ Command failed:'), error instanceof Error ? error.message : 'Unknown error');
        }
    }
    /**
     * Extract and execute specific actions from the response
     */
    async executeActions(originalCommand, response) {
        const lowerCommand = originalCommand.toLowerCase();
        // File reading
        if (lowerCommand.includes('read ') || lowerCommand.includes('show ') || lowerCommand.includes('cat ')) {
            const fileMatch = originalCommand.match(/(?:read|show|cat)\s+(.+)/i);
            if (fileMatch) {
                await this.readFile(fileMatch[1].trim());
            }
        }
        // File analysis
        else if (lowerCommand.includes('analyze ') || lowerCommand.includes('review ')) {
            const fileMatch = originalCommand.match(/(?:analyze|review)\s+(.+)/i);
            if (fileMatch) {
                await this.analyzeFile(fileMatch[1].trim());
            }
        }
        // Command execution
        else if (lowerCommand.includes('run ') || lowerCommand.includes('execute ')) {
            const cmdMatch = originalCommand.match(/(?:run|execute)\s+(.+)/i);
            if (cmdMatch) {
                await this.runCommand(cmdMatch[1].trim());
            }
        }
        // List files
        else if (lowerCommand.includes('list') || lowerCommand.includes('ls')) {
            this.listFiles();
        }
    }
    /**
     * Read and display a file
     */
    async readFile(filepath) {
        try {
            // Try exact match first
            let file = this.codebase.files.get(filepath);
            // If not found, try to find partial matches
            if (!file) {
                const matches = Array.from(this.codebase.files.keys()).filter(f => f.includes(filepath) || basename(f) === filepath);
                if (matches.length === 1) {
                    file = this.codebase.files.get(matches[0]);
                    filepath = matches[0];
                }
                else if (matches.length > 1) {
                    console.log(chalk.yellow(`Multiple files match "${filepath}":`));
                    matches.forEach(m => console.log(chalk.gray(`  ${m}`)));
                    return;
                }
            }
            // If still not found, try to read from disk
            if (!file) {
                try {
                    const content = await readFile(join(this.codebase.rootPath, filepath), 'utf8');
                    file = {
                        path: filepath,
                        content,
                        language: this.detectLanguage(extname(filepath)),
                        size: content.length
                    };
                    // Cache it
                    this.codebase.files.set(filepath, file);
                }
                catch {
                    console.log(chalk.red(`❌ File not found: ${filepath}`));
                    return;
                }
            }
            // If file content is empty (lazy loaded), load it now
            if (!file.content && file.size > 0) {
                try {
                    file.content = await readFile(join(this.codebase.rootPath, file.path), 'utf8');
                }
                catch (error) {
                    console.log(chalk.red(`❌ Could not read file: ${error}`));
                    return;
                }
            }
            console.log(chalk.green(`📄 ${file.path} (${file.language}, ${file.size} bytes):`));
            console.log(chalk.gray('─'.repeat(60)));
            // Show first 50 lines if file is very long
            const lines = file.content.split('\n');
            if (lines.length > 50) {
                console.log(lines.slice(0, 50).join('\n'));
                console.log(chalk.yellow(`\n... (${lines.length - 50} more lines, use 'cat ${filepath}' to see all)`));
            }
            else {
                console.log(file.content);
            }
        }
        catch (error) {
            console.error(chalk.red(`❌ Error reading file: ${error}`));
        }
    }
    /**
     * Analyze a file using AI
     */
    async analyzeFile(filepath) {
        console.log(chalk.blue(`🔍 Analyzing ${filepath}...`));
        try {
            // First read the file
            let file = this.codebase.files.get(filepath);
            if (!file) {
                // Try to find and read it
                await this.readFile(filepath);
                file = this.codebase.files.get(filepath);
            }
            if (!file || !file.content) {
                console.log(chalk.red(`❌ Could not load file for analysis: ${filepath}`));
                return;
            }
            const analysis = await this.context.modelClient.analyzeCode(file.content, file.language);
            console.log(chalk.green(`📊 Analysis of ${filepath}:`));
            console.log(analysis.analysis);
        }
        catch (error) {
            console.error(chalk.red(`❌ Analysis failed: ${error}`));
        }
    }
    /**
     * Run a command
     */
    async runCommand(command) {
        console.log(chalk.blue(`⚡ Running: ${command}`));
        return new Promise((resolve) => {
            const child = spawn('sh', ['-c', command], {
                cwd: this.codebase.rootPath,
                stdio: 'pipe'
            });
            child.stdout?.on('data', (data) => {
                console.log(data.toString());
            });
            child.stderr?.on('data', (data) => {
                console.log(chalk.red(data.toString()));
            });
            child.on('close', (code) => {
                if (code === 0) {
                    console.log(chalk.green('✅ Command completed successfully'));
                }
                else {
                    console.log(chalk.red(`❌ Command failed with code ${code}`));
                }
                resolve();
            });
        });
    }
    /**
     * List files in the codebase
     */
    listFiles() {
        console.log(chalk.green(`📁 Codebase files (${this.codebase.files.size} total):`));
        const filesByType = new Map();
        for (const [path, file] of this.codebase.files) {
            if (!filesByType.has(file.language)) {
                filesByType.set(file.language, []);
            }
            filesByType.get(file.language).push(path);
        }
        for (const [lang, files] of filesByType) {
            console.log(chalk.cyan(`\n${lang}:`));
            files.slice(0, 10).forEach(f => console.log(chalk.gray(`  ${f}`)));
            if (files.length > 10) {
                console.log(chalk.gray(`  ... and ${files.length - 10} more`));
            }
        }
    }
    /**
     * Show help information
     */
    showHelp() {
        console.log(chalk.cyan(`
🤖 CodeCrucible Autonomous Coding Agent

Available commands:
  read <file>     - Read and display a file
  analyze <file>  - Analyze a file with AI
  run <command>   - Execute a shell command
  list            - List files in codebase
  status          - Show current status
  help            - Show this help
  exit            - Exit the agent

Examples:
  read package.json
  analyze src/index.ts
  run npm test
  explain how authentication works
  create a new React component for user login
  fix the bug in the payment module
`));
    }
    /**
     * Show current status
     */
    showStatus() {
        console.log(chalk.green(`📊 Status:
  Root: ${this.codebase.rootPath}
  Files tracked: ${this.codebase.files.size}
  Last scan: ${new Date(this.codebase.lastScanned).toLocaleTimeString()}
  Model: ${this.context.config.model.name}
  Endpoint: ${this.context.config.model.endpoint}
`));
    }
    /**
     * Build project context for AI
     */
    buildProjectContext() {
        const keyFiles = Array.from(this.codebase.files.entries())
            .filter(([_, file]) => file.content && file.size < 10000) // Only include small files with content
            .slice(0, 5) // Limit context size
            .map(([path, file]) => ({
            path,
            content: file.content,
            language: file.language
        }));
        return { files: keyFiles };
    }
    /**
     * Detect programming language from file extension
     */
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
            '.rs': 'rust',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown',
            '.txt': 'text'
        };
        return langMap[ext.toLowerCase()] || 'text';
    }
}
//# sourceMappingURL=simple-agentic-client.js.map