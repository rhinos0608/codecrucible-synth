import { LocalModelClient } from './local-model-client.js'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { CLIContext } from './cli.js';
import { logger } from './logger.js';
import chalk from 'chalk';
import { readFile, writeFile, stat } from 'fs/promises';
import { extname } from 'path';
import { watch, FSWatcher } from 'chokidar';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { spawn, ChildProcess } from 'child_process';
import { glob } from 'glob';

export interface AgenticOptions {
  watch?: boolean;
  port?: number;
  autoExecute?: boolean;
  maxFileSize?: number;
  excludePatterns?: string[];
}

export interface AgenticContext {
  currentDirectory: string;
  openFiles: Map<string, string>;
  projectStructure: any;
  recentChanges: Array<{
    file: string;
    type: 'modified' | 'created' | 'deleted';
    timestamp: number;
  }>;
  activeTask?: string;
  runningProcesses: Map<string, ChildProcess>;
}

/**
 * Agentic Client - Cursor/Claude Code-like functionality
 * 
 * Provides autonomous coding assistance with:
 * - File watching and context awareness
 * - Automatic code generation and editing
 * - Project-wide understanding
 * - Real-time collaboration
 * - Command execution and testing
 */
export class AgenticClient {
  private context: CLIContext;
  private agenticContext: AgenticContext;
  private fileWatcher?: FSWatcher;
  private server?: express.Application;
  private httpServer?: any;
  private socketServer?: SocketIOServer;
  private isRunning = false;

  constructor(context: CLIContext) {
    this.context = context;
    this.agenticContext = {
      currentDirectory: process.cwd(),
      openFiles: new Map(),
      projectStructure: {},
      recentChanges: [],
      runningProcesses: new Map()
    };
  }

  /**
   * Start the agentic client with optional file watching
   */
  async start(options: AgenticOptions = {}): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️  Agentic client is already running'));
      return;
    }

    console.log(chalk.green('🤖 Starting CodeCrucible Agentic Client...'));
    
    try {
      // Initialize project structure
      await this.initializeProjectContext();
      
      // Start file watching if enabled
      if (options.watch) {
        await this.startFileWatching(options);
      }
      
      // Start server for IDE integration
      if (options.port) {
        await this.startServer(options.port);
      }
      
      this.isRunning = true;
      console.log(chalk.green('✅ Agentic client started successfully'));
      
      // Start interactive loop
      await this.startInteractiveLoop();
      
    } catch (error) {
      logger.error('Failed to start agentic client:', error);
      console.error(chalk.red('❌ Failed to start agentic client:'), error);
    }
  }

  /**
   * Stop the agentic client
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log(chalk.yellow('🛑 Stopping agentic client...'));
    
    // Stop file watching
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }
    
    // Stop server
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    // Kill running processes
    for (const [name, process] of this.agenticContext.runningProcesses) {
      console.log(chalk.gray(`Stopping process: ${name}`));
      process.kill();
    }
    
    this.isRunning = false;
    console.log(chalk.green('✅ Agentic client stopped'));
  }

  /**
   * Process a natural language command
   */
  async processCommand(command: string): Promise<void> {
    console.log(chalk.blue(`🎯 Processing: ${command}`));
    
    try {
      // Analyze the command to determine intent
      const intent = await this.analyzeCommandIntent(command);
      
      switch (intent.type) {
        case 'code_generation':
          await this.handleCodeGeneration(command, intent);
          break;
        case 'file_operation':
          await this.handleFileOperation(command, intent);
          break;
        case 'project_analysis':
          await this.handleProjectAnalysis(command, intent);
          break;
        case 'execution':
          await this.handleCommandExecution(command, intent);
          break;
        case 'refactoring':
          await this.handleRefactoring(command, intent);
          break;
        default:
          await this.handleGeneralQuery(command);
      }
      
    } catch (error) {
      logger.error('Failed to process command:', error);
      console.error(chalk.red('❌ Command failed:'), error);
    }
  }

  /**
   * Initialize project context by scanning files and understanding structure
   */
  private async initializeProjectContext(): Promise<void> {
    console.log(chalk.gray('📁 Scanning project structure...'));
    
    try {
      // Get all relevant files
      const files = await glob('**/*.{js,ts,jsx,tsx,py,java,cpp,c,h,cs,php,rb,go,rs,json,yaml,yml,md}', {
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**'],
        cwd: this.agenticContext.currentDirectory
      });
      
      // Build project structure
      this.agenticContext.projectStructure = await this.buildProjectStructure(files);
      
      // Load key configuration files
      await this.loadKeyFiles();
      
      console.log(chalk.green(`✅ Project scanned: ${files.length} files`));
      
    } catch (error) {
      logger.error('Failed to initialize project context:', error);
    }
  }

  /**
   * Start file watching for real-time context updates
   */
  private async startFileWatching(options: AgenticOptions): Promise<void> {
    console.log(chalk.gray('👀 Starting file watcher...'));
    
    const excludePatterns = options.excludePatterns || [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '.next/**',
      '**/*.log'
    ];
    
    this.fileWatcher = watch('.', {
      ignored: excludePatterns,
      persistent: true,
      ignoreInitial: true
    });
    
    this.fileWatcher
      .on('change', (path) => this.handleFileChange(path, 'modified'))
      .on('add', (path) => this.handleFileChange(path, 'created'))
      .on('unlink', (path) => this.handleFileChange(path, 'deleted'));
    
    console.log(chalk.green('✅ File watcher started'));
  }

  /**
   * Start HTTP server for IDE integration
   */
  private async startServer(port: number): Promise<void> {
    this.server = express();
    this.httpServer = createServer(this.server);
    this.socketServer = new SocketIOServer(this.httpServer, {
      cors: { origin: '*' }
    });
    
    // Configure middleware
    this.server.use(express.json({ limit: '10mb' }));
    this.server.use(express.urlencoded({ extended: true }));
    
    // REST API endpoints
    this.setupAPIEndpoints();
    
    // WebSocket handling
    this.setupWebSocketHandlers();
    
    return new Promise((resolve) => {
      this.httpServer!.listen(port, () => {
        console.log(chalk.green(`🌐 Server running on http://localhost:${port}`));
        resolve();
      });
    });
  }

  /**
   * Setup REST API endpoints
   */
  private setupAPIEndpoints(): void {
    if (!this.server) return;
    
    // Health check
    this.server.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: Date.now() });
    });
    
    // Process command
    this.server.post('/command', async (req, res) => {
      try {
        const { command } = req.body;
        await this.processCommand(command);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
    
    // Get project context
    this.server.get('/context', (req, res) => {
      res.json({
        directory: this.agenticContext.currentDirectory,
        structure: this.agenticContext.projectStructure,
        recentChanges: this.agenticContext.recentChanges.slice(-10),
        activeTask: this.agenticContext.activeTask
      });
    });
    
    // Get file content
    this.server.get('/file/*', async (req, res) => {
      try {
        const filePath = (req.params as any)[0];
        const content = await readFile(filePath, 'utf8');
        res.json({ content, path: filePath });
      } catch (error) {
        res.status(404).json({ error: 'File not found' });
      }
    });
    
    // Update file content
    this.server.put('/file/*', async (req, res) => {
      try {
        const filePath = (req.params as any)[0];
        const { content } = req.body;
        await writeFile(filePath, content, 'utf8');
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Write failed' });
      }
    });
  }

  /**
   * Setup WebSocket handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.socketServer) return;
    
    this.socketServer.on('connection', (socket) => {
      console.log(chalk.gray(`🔌 Client connected: ${socket.id}`));
      
      // Send current context
      socket.emit('context', {
        directory: this.agenticContext.currentDirectory,
        structure: this.agenticContext.projectStructure,
        recentChanges: this.agenticContext.recentChanges.slice(-5)
      });
      
      // Handle command processing
      socket.on('command', async (data) => {
        try {
          await this.processCommand(data.command);
          socket.emit('command_result', { success: true });
        } catch (error) {
          socket.emit('command_result', { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });
      
      socket.on('disconnect', () => {
        console.log(chalk.gray(`🔌 Client disconnected: ${socket.id}`));
      });
    });
  }

  /**
   * Handle file changes
   */
  private async handleFileChange(filePath: string, type: 'modified' | 'created' | 'deleted'): Promise<void> {
    console.log(chalk.gray(`📝 File ${type}: ${filePath}`));
    
    // Add to recent changes
    this.agenticContext.recentChanges.push({
      file: filePath,
      type,
      timestamp: Date.now()
    });
    
    // Keep only last 100 changes
    if (this.agenticContext.recentChanges.length > 100) {
      this.agenticContext.recentChanges.shift();
    }
    
    // Update project structure if needed
    if (type === 'created' || type === 'deleted') {
      await this.updateProjectStructure(filePath, type);
    }
    
    // Notify connected clients
    if (this.socketServer) {
      this.socketServer.emit('file_change', { file: filePath, type, timestamp: Date.now() });
    }
    
    // Auto-analyze significant changes
    if (type === 'modified' && this.shouldAutoAnalyze(filePath)) {
      await this.autoAnalyzeChange(filePath);
    }
  }

  /**
   * Analyze command intent using AI
   */
  private async analyzeCommandIntent(command: string): Promise<any> {
    const analysisPrompt = `Analyze this coding command and determine the intent and required actions:

Command: "${command}"

Respond with JSON in this format:
{
  "type": "code_generation|file_operation|project_analysis|execution|refactoring|general",
  "confidence": 0.0-1.0,
  "target_files": ["file1.ts", "file2.js"],
  "actions": ["create", "modify", "delete", "analyze"],
  "language": "typescript|javascript|python|etc",
  "priority": "low|medium|high",
  "estimated_complexity": 1-5
}`;

    try {
      const response = await this.context.modelClient.generateVoiceResponse(
        {
          id: 'analyzer',
          name: 'Analyzer',
          systemPrompt: 'You are a command intent analyzer. Respond only with valid JSON.',
          temperature: 0.3,
          style: 'analytical'
        },
        analysisPrompt,
        { files: [] }
      );
      
      return JSON.parse(response.content);
    } catch (error) {
      logger.error('Failed to analyze command intent:', error);
      return { type: 'general', confidence: 0.5 };
    }
  }

  /**
   * Handle code generation requests
   */
  private async handleCodeGeneration(command: string, intent: any): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars // eslint-disable-line @typescript-eslint/no-unused-vars
    console.log(chalk.blue('🔨 Generating code...'));
    
    // Get appropriate voices for code generation
    const voices = intent.language === 'typescript' || intent.language === 'javascript' 
      ? ['developer', 'maintainer', 'implementor']
      : ['explorer', 'implementor'];
    
    // Generate code using multi-voice synthesis
    const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(
      command,
      voices,
      { files: Array.from(this.agenticContext.openFiles.entries()).map(([path, content]) => ({
        path,
        content,
        language: this.detectLanguage(extname(path))
      })) }
    );
    
    const synthesis = await this.context.voiceSystem.synthesizeVoiceResponses(responses, 'competitive');
    
    // Display results
    console.log(chalk.green('✅ Code generated:'));
    console.log(synthesis.combinedCode);
    
    // Ask if user wants to save to file
    if (synthesis.combinedCode && intent.target_files?.length > 0) {
      const inquirer = (await import('inquirer')).default;
      const { shouldSave } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldSave',
          message: `Save generated code to ${intent.target_files[0]}?`,
          default: true
        }
      ]);
      
      if (shouldSave) {
        await writeFile(intent.target_files[0], synthesis.combinedCode, 'utf8');
        console.log(chalk.green(`✅ Code saved to ${intent.target_files[0]}`));
      }
    }
  }

  /**
   * Handle file operations
   */
  private async handleFileOperation(command: string, intent: any): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars // eslint-disable-line @typescript-eslint/no-unused-vars
    console.log(chalk.blue('📄 Performing file operation...'));
    
    if (intent.target_files?.length > 0) {
      for (const filePath of intent.target_files) {
        if (intent.actions.includes('analyze')) {
          await this.analyzeFile(filePath);
        }
        if (intent.actions.includes('modify')) {
          await this.modifyFile(filePath, command);
        }
      }
    }
  }

  /**
   * Handle project analysis
   */
  private async handleProjectAnalysis(command: string, intent: any): Promise<void> {
    console.log(chalk.blue('🔍 Analyzing project...'));
    
    const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(
      command,
      ['analyzer', 'architect', 'security'],
      { 
        files: Object.keys(this.agenticContext.projectStructure).slice(0, 10).map(path => ({
          path,
          content: this.agenticContext.openFiles.get(path) || '',
          language: this.detectLanguage(extname(path))
        }))
      }
    );
    
    const synthesis = await this.context.voiceSystem.synthesizeVoiceResponses(responses, 'collaborative');
    
    console.log(chalk.green('📊 Project Analysis:'));
    console.log(synthesis.combinedCode);
  }

  /**
   * Handle command execution
   */
  private async handleCommandExecution(command: string, intent: any): Promise<void> {
    console.log(chalk.blue('⚡ Executing command...'));
    
    // Extract actual command to run
    const cmdMatch = command.match(/run\s+(.+)|execute\s+(.+)|npm\s+(.+)|yarn\s+(.+)/i);
    if (!cmdMatch) {
      console.log(chalk.yellow('⚠️  Could not extract command to execute'));
      return;
    }
    
    const actualCommand = cmdMatch[1] || cmdMatch[2] || cmdMatch[3] || cmdMatch[4];
    
    console.log(chalk.gray(`Running: ${actualCommand}`));
    
    const child = spawn('sh', ['-c', actualCommand], {
      cwd: this.agenticContext.currentDirectory,
      stdio: 'pipe'
    });
    
    const processId = `cmd_${Date.now()}`;
    this.agenticContext.runningProcesses.set(processId, child);
    
    child.stdout?.on('data', (data) => {
      console.log(chalk.gray(data.toString()));
    });
    
    child.stderr?.on('data', (data) => {
      console.log(chalk.red(data.toString()));
    });
    
    child.on('close', (code) => {
      this.agenticContext.runningProcesses.delete(processId);
      if (code === 0) {
        console.log(chalk.green('✅ Command completed successfully'));
      } else {
        console.log(chalk.red(`❌ Command failed with code ${code}`));
      }
    });
  }

  /**
   * Handle general queries
   */
  private async handleGeneralQuery(command: string): Promise<void> {
    console.log(chalk.blue('💭 Processing general query...'));
    
    const response = await this.context.modelClient.generateVoiceResponse(
      {
        id: 'developer',
        name: 'Developer',
        systemPrompt: 'You are a helpful coding assistant. Provide clear, actionable answers.',
        temperature: 0.7,
        style: 'helpful'
      },
      command,
      { files: [] }
    );
    
    console.log(chalk.green('💡 Response:'));
    console.log(response.content);
  }

  /**
   * Start interactive command loop
   */
  private async startInteractiveLoop(): Promise<void> {
    const inquirer = (await import('inquirer')).default;
    
    console.log(chalk.cyan('\n🎯 CodeCrucible Agentic Mode Active'));
    console.log(chalk.gray('Type your commands in natural language, or "exit" to quit\n'));
    
    while (this.isRunning) {
      try {
        const { command } = await inquirer.prompt({
          type: 'input',
          name: 'command',
          message: chalk.blue('CC> ')
        });
        
        if (command.toLowerCase().trim() === 'exit') {
          await this.stop();
          break;
        }
        
        if (command.trim()) {
          await this.processCommand(command);
        }
        
        console.log(); // Add spacing
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('User force closed')) {
          await this.stop();
          break;
        }
        console.error(chalk.red('Error:'), error);
      }
    }
  }

  // Helper methods
  private async buildProjectStructure(files: string[]): Promise<any> {
    const structure: any = {};
    
    for (const file of files.slice(0, 50)) { // Limit for performance
      try {
        const stats = await stat(file);
        structure[file] = {
          size: stats.size,
          modified: stats.mtime,
          type: extname(file)
        };
      } catch (error) {
        // File might have been deleted
      }
    }
    
    return structure;
  }

  private async loadKeyFiles(): Promise<void> {
    const keyFiles = ['package.json', 'tsconfig.json', 'README.md', '.gitignore'];
    
    for (const file of keyFiles) {
      try {
        const content = await readFile(file, 'utf8');
        this.agenticContext.openFiles.set(file, content);
      } catch (error) {
        // File doesn't exist
      }
    }
  }

  private async updateProjectStructure(filePath: string, type: 'created' | 'deleted'): Promise<void> {
    if (type === 'created') {
      try {
        const stats = await stat(filePath);
        this.agenticContext.projectStructure[filePath] = {
          size: stats.size,
          modified: stats.mtime,
          type: extname(filePath)
        };
      } catch (error) {
        // File might have been deleted already
      }
    } else if (type === 'deleted') {
      delete this.agenticContext.projectStructure[filePath];
    }
  }

  private shouldAutoAnalyze(filePath: string): boolean {
    const importantFiles = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java'];
    return importantFiles.includes(extname(filePath));
  }

  private async autoAnalyzeChange(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf8');
      console.log(chalk.gray(`🔍 Auto-analyzing changes in ${filePath}...`));
      
      // Simple analysis - could be expanded
      const lines = content.split('\n');
      if (lines.length > 1000) {
        console.log(chalk.yellow(`⚠️  Large file detected: ${filePath} (${lines.length} lines)`));
      }
    } catch (error) {
      // File might have been deleted
    }
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf8');
      const language = this.detectLanguage(extname(filePath));
      
      const analysis = await this.context.modelClient.analyzeCode(content, language);
      
      console.log(chalk.green(`📋 Analysis of ${filePath}:`));
      console.log(analysis.analysis);
    } catch (error) {
      console.error(chalk.red(`Failed to analyze ${filePath}:`), error);
    }
  }

  private async modifyFile(filePath: string, request: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf8');
      
      const modificationPrompt = `Modify this file based on the request: "${request}"

Current file content:
\`\`\`
${content}
\`\`\`

Provide the complete modified file content.`;

      const response = await this.context.modelClient.generateVoiceResponse(
        {
          id: 'implementor',
          name: 'Implementor',
          systemPrompt: 'You are a code modification specialist. Provide complete, working code.',
          temperature: 0.5,
          style: 'precise'
        },
        modificationPrompt,
        { files: [{ path: filePath, content, language: this.detectLanguage(extname(filePath)) }] }
      );
      
      // Extract code from response
      const codeMatch = response.content.match(/```[\w]*\n([\s\S]*?)\n```/);
      const modifiedContent = codeMatch ? codeMatch[1] : response.content;
      
      await writeFile(filePath, modifiedContent, 'utf8');
      console.log(chalk.green(`✅ Modified ${filePath}`));
      
    } catch (error) {
      console.error(chalk.red(`Failed to modify ${filePath}:`), error);
    }
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

  private async handleRefactoring(command: string, intent: any): Promise<void> {
    console.log(chalk.blue('🔧 Performing refactoring...'));
    
    if (intent.target_files?.length > 0) {
      const voices = ['maintainer', 'architect', 'analyzer'];
      
      const responses = await this.context.voiceSystem.generateMultiVoiceSolutions(
        `Refactor this code: ${command}`,
        voices,
        {
          files: await Promise.all(
            intent.target_files.map(async (filePath: string) => {
              try {
                const content = await readFile(filePath, 'utf8');
                return {
                  path: filePath,
                  content,
                  language: this.detectLanguage(extname(filePath))
                };
              } catch (error) {
                return null;
              }
            })
          ).then(files => files.filter(Boolean))
        }
      );
      
      const synthesis = await this.context.voiceSystem.synthesizeVoiceResponses(responses, 'consensus');
      
      console.log(chalk.green('🔧 Refactoring suggestions:'));
      console.log(synthesis.combinedCode);
    }
  }
}