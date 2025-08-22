/**
 * Unified Agent System
 * Consolidates: enhanced-agentic-client.ts, simple-agent.ts, complex-agent.ts,
 *              agentic-system.ts, agent-manager.ts, agent-orchestrator.ts
 * Created: 2024-12-19 | Purpose: Single agent system with all capabilities
 */

import { EventEmitter } from 'events';
import { UnifiedModelClient } from './client.js';
import { configManager, AgentConfig } from './config.js';
export type { AgentConfig };
import { PerformanceMonitor } from '../utils/performance.js';
import {
  ExecutionRequest,
  ExecutionResponse,
  Task,
  Workflow,
  ProjectContext,
  ExecutionResult,
} from './types.js';

export { ExecutionResult };

export interface AgentCapability {
  name: string;
  description: string;
  handler: (task: Task) => Promise<ExecutionResult>;
  priority: number;
  enabled: boolean;
}

export interface AgentMetrics {
  tasksCompleted: number;
  averageExecutionTime: number;
  successRate: number;
  errorCount: number;
  lastExecutionTime: number;
}

/**
 * Unified Agent System with all capabilities
 */
export class UnifiedAgent extends EventEmitter {
  private modelClient: UnifiedModelClient;
  private performanceMonitor: PerformanceMonitor;
  private config: AgentConfig = {
    enabled: true,
    mode: 'balanced',
    maxConcurrency: 3,
    enableCaching: true,
    enableMetrics: true,
    enableSecurity: true,
  };
  private capabilities: Map<string, AgentCapability>;
  private activeWorkflows: Map<string, Workflow>;
  private metrics: AgentMetrics;
  private executionQueue: Task[];

  constructor(modelClient: UnifiedModelClient, performanceMonitor: PerformanceMonitor) {
    super();
    // Increase max listeners to prevent memory leak warnings
    this.setMaxListeners(50);

    this.modelClient = modelClient;
    this.performanceMonitor = performanceMonitor;
    this.capabilities = new Map();
    this.activeWorkflows = new Map();
    this.executionQueue = [];
    this.metrics = {
      tasksCompleted: 0,
      averageExecutionTime: 0,
      successRate: 0,
      errorCount: 0,
      lastExecutionTime: 0,
    };

    this.initializeCapabilities();
    this.loadConfig();
  }

  /**
   * Initialize agent capabilities
   */
  private initializeCapabilities(): void {
    // Code Analysis Capability
    this.registerCapability({
      name: 'code-analysis',
      description: 'Analyze code quality, patterns, and improvements',
      priority: 10,
      enabled: true,
      handler: async task => this.handleCodeAnalysis(task),
    });

    // Code Generation Capability
    this.registerCapability({
      name: 'code-generation',
      description: 'Generate code based on specifications',
      priority: 9,
      enabled: true,
      handler: async task => this.handleCodeGeneration(task),
    });

    // Documentation Capability
    this.registerCapability({
      name: 'documentation',
      description: 'Generate and improve documentation',
      priority: 7,
      enabled: true,
      handler: async task => this.handleDocumentation(task),
    });

    // Testing Capability
    this.registerCapability({
      name: 'testing',
      description: 'Generate and optimize tests',
      priority: 8,
      enabled: true,
      handler: async task => this.handleTesting(task),
    });

    // Refactoring Capability
    this.registerCapability({
      name: 'refactoring',
      description: 'Refactor and optimize code',
      priority: 6,
      enabled: true,
      handler: async task => this.handleRefactoring(task),
    });

    // Bug Fixing Capability
    this.registerCapability({
      name: 'bug-fixing',
      description: 'Identify and fix bugs',
      priority: 10,
      enabled: true,
      handler: async task => this.handleBugFixing(task),
    });

    // Performance Optimization Capability
    this.registerCapability({
      name: 'performance-optimization',
      description: 'Optimize code performance',
      priority: 5,
      enabled: true,
      handler: async task => this.handlePerformanceOptimization(task),
    });

    // Security Analysis Capability
    this.registerCapability({
      name: 'security-analysis',
      description: 'Analyze code for security vulnerabilities',
      priority: 9,
      enabled: true,
      handler: async task => this.handleSecurityAnalysis(task),
    });
  }

  /**
   * Load configuration
   */
  private async loadConfig(): Promise<void> {
    this.config = await configManager.getAgentConfig();
  }

  /**
   * Register a new capability
   */
  registerCapability(capability: AgentCapability): void {
    this.capabilities.set(capability.name, capability);
    this.emit('capability-registered', capability);
  }

  /**
   * Execute agent request with intelligent routing
   */
  async execute(request: ExecutionRequest, _context?: ProjectContext): Promise<ExecutionResponse> {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();

    try {
      // Create workflow
      const workflow: Workflow = {
        id: workflowId,
        request: request as unknown as Record<string, unknown>,
        status: 'running',
        startTime: new Date(startTime),
        tasks: [],
        results: {} as Record<string, unknown>,
      };

      this.activeWorkflows.set(workflowId, workflow);
      this.emit('workflow-started', workflow);

      // Analyze request and create execution plan
      const executionPlan = await this.createExecutionPlan(request);
      workflow.tasks = executionPlan;

      // Execute plan
      const results = await this.executeWorkflow(workflow);

      // Complete workflow
      workflow.status = 'completed';
      workflow.endTime = new Date();
      workflow.results = results as unknown as Record<string, unknown>;

      const response: ExecutionResponse = {
        workflowId,
        success: true,
        result: results as unknown as Record<string, unknown>,
        results: results as unknown as Record<string, unknown>,
        executionTime: workflow.endTime.getTime() - workflow.startTime.getTime(),
      };

      this.updateMetrics(response);
      this.emit('workflow-completed', workflow);

      return response;
    } catch (error) {
      const workflow = this.activeWorkflows.get(workflowId);
      if (workflow) {
        workflow.status = 'failed';
        workflow.endTime = new Date();
        workflow.error = error instanceof Error ? error.message : String(error);
      }

      this.metrics.errorCount++;
      this.emit('workflow-failed', { workflowId, error });

      return {
        workflowId,
        success: false,
        result: {} as Record<string, unknown>,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  /**
   * Create execution plan based on request
   */
  private async createExecutionPlan(request: ExecutionRequest): Promise<Task[]> {
    const tasks: Task[] = [];
    const mode = request.mode || this.config.mode;

    // Determine request complexity and create appropriate tasks
    const isSimpleQuery = this.isSimpleQuery(request.input);
    const taskType = request.type || this.determineRequestType(request.input);

    // For simple queries, create only relevant tasks
    if (isSimpleQuery) {
      if (taskType === 'code-analysis' || request.input.toLowerCase().includes('analyze')) {
        tasks.push({
          id: this.generateTaskId(),
          type: 'code-analysis',
          capability: 'code-analysis',
          description: 'Analyze code structure and quality',
          input: request.input,
          priority: 'high',
          estimatedTime: mode === 'fast' ? 5000 : 15000,
        });
      } else {
        // For simple queries, create only one primary task
        const capability = this.getValidCapability(taskType);
        tasks.push({
          id: this.generateTaskId(),
          type: taskType,
          capability: capability,
          description: `Process ${taskType} request`,
          input: request.input,
          priority: 'high',
          estimatedTime: mode === 'fast' ? 5000 : 15000,
        });
      }
      return tasks;
    }

    // For complex requests, create comprehensive tasks
    if (request.type === 'code-analysis' || request.type === 'comprehensive') {
      tasks.push({
        id: this.generateTaskId(),
        type: 'code-analysis',
        capability: 'code-analysis',
        description: 'Analyze code structure and quality',
        input: request.input,
        priority: 'high',
        estimatedTime: mode === 'fast' ? 5000 : 15000,
      });
    }

    if (request.type === 'code-generation' || request.type === 'comprehensive') {
      tasks.push({
        id: this.generateTaskId(),
        type: 'code-generation',
        capability: 'code-generation',
        description: 'Generate required code',
        input: request.input,
        priority: 'high',
        estimatedTime: mode === 'fast' ? 10000 : 30000,
      });
    }

    if (request.type === 'testing' || request.type === 'comprehensive') {
      tasks.push({
        id: this.generateTaskId(),
        type: 'testing',
        capability: 'testing',
        description: 'Generate and validate tests',
        input: request.input,
        priority: 'medium',
        estimatedTime: mode === 'fast' ? 8000 : 20000,
      });
    }

    if (request.type === 'documentation' || request.type === 'comprehensive') {
      tasks.push({
        id: this.generateTaskId(),
        type: 'documentation',
        capability: 'documentation',
        description: 'Generate documentation',
        input: request.input,
        priority: 'medium',
        estimatedTime: mode === 'fast' ? 5000 : 15000,
      });
    }

    if (request.type === 'security-analysis' || request.type === 'comprehensive') {
      tasks.push({
        id: this.generateTaskId(),
        type: 'security-analysis',
        capability: 'security-analysis',
        description: 'Analyze security vulnerabilities',
        input: request.input,
        priority: 'high',
        estimatedTime: mode === 'fast' ? 10000 : 25000,
      });
    }

    // Sort tasks by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    tasks.sort(
      (a, b) =>
        (priorityOrder[b.priority || 'low'] || 1) - (priorityOrder[a.priority || 'low'] || 1)
    );

    // Apply mode-specific filtering
    if (mode === 'fast') {
      return tasks.slice(0, 2); // Only top 2 tasks in fast mode
    } else if (mode === 'balanced') {
      return tasks.slice(0, 4); // Top 4 tasks in balanced mode
    }

    return tasks; // All tasks in thorough mode
  }

  /**
   * Execute workflow tasks
   */
  private async executeWorkflow(workflow: Workflow): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const maxConcurrency = this.config.maxConcurrency;

    if (maxConcurrency === 1) {
      // Sequential execution
      for (const task of workflow.tasks) {
        const result = await this.executeTask(task);
        results.push(result);
        this.emit('task-completed', { task, result });
      }
    } else {
      // Parallel execution with concurrency limit
      const chunks = this.chunkArray(workflow.tasks, maxConcurrency);
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(chunk.map(task => this.executeTask(task)));
        results.push(...chunkResults);

        for (let i = 0; i < chunk.length; i++) {
          this.emit('task-completed', { task: chunk[i], result: chunkResults[i] });
        }
      }
    }

    return results;
  }

  /**
   * Execute individual task
   */
  private async executeTask(task: Task): Promise<ExecutionResult> {
    const capability = this.capabilities.get(task.capability || '');

    if (!capability || !capability.enabled) {
      throw new Error(`Capability '${task.capability || 'unknown'}' not available`);
    }

    const startTime = Date.now();
    this.emit('task-started', task);

    try {
      const result = await capability.handler(task);
      (result as ExecutionResult & { executionTime?: number; taskId?: string }).executionTime =
        Date.now() - startTime;
      (result as ExecutionResult & { executionTime?: number; taskId?: string }).taskId = task.id;

      return result;
    } catch (error) {
      return {
        success: false,
        content: '',
        metadata: {
          model: 'unknown',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  // Capability Handlers
  private async handleCodeAnalysis(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      let codeContent = '';
      let analysisPrompt = '';

      // Check if this is a project/directory analysis request
      const taskInput = task.input || '';
      const inputLower = (typeof taskInput === 'string' ? taskInput : '').toLowerCase();
      const isProjectAnalysis =
        inputLower.includes('project structure') ||
        inputLower.includes('analyze the project') ||
        inputLower.includes('codebase') ||
        inputLower.includes('directory') ||
        inputLower.includes('files in') ||
        inputLower.includes('analyze this') ||
        inputLower.includes('audit') ||
        inputLower.includes('thorough audit') ||
        inputLower.includes('comprehensive');

      console.log(`🔍 DEBUG: Input analysis - "${task.input || ''}"`);
      console.log(`🔍 DEBUG: Detected as project analysis: ${isProjectAnalysis}`);

      if (typeof taskInput === 'string' && isProjectAnalysis) {
        // Read project structure
        try {
          // File reading functionality moved to getProjectStructure method

          const projectRoot = process.cwd();
          const projectStructure = await this.getProjectStructure(projectRoot);

          analysisPrompt = `Analyze this project structure and codebase:\n\nProject Root: ${projectRoot}\n\n${projectStructure}\n\nPlease provide:\n1. Overview of the project architecture\n2. Key components and their relationships\n3. Code organization patterns\n4. Potential improvements\n5. Technology stack analysis`;
        } catch (error) {
          analysisPrompt = `Unable to read project structure: ${error instanceof Error ? error.message : String(error)}\n\nRequest: ${task.input || ''}`;
        }
      }
      // Check if input looks like a file path or contains file extension
      else if (
        typeof taskInput === 'string' &&
        (taskInput.includes('.') || taskInput.includes('/'))
      ) {
        // Try to read as file path
        try {
          const { readFile } = await import('fs/promises');
          const { resolve, extname } = await import('path');

          // Handle multiple potential file paths in the input
          const words = taskInput.split(/\s+/);
          const potentialPaths = words.filter(
            (word: string) =>
              word.includes('.') &&
              (word.endsWith('.js') ||
                word.endsWith('.ts') ||
                word.endsWith('.jsx') ||
                word.endsWith('.tsx') ||
                word.endsWith('.py') ||
                word.endsWith('.java') ||
                word.endsWith('.c') ||
                word.endsWith('.cpp') ||
                word.endsWith('.h') ||
                word.endsWith('.css') ||
                word.endsWith('.html') ||
                word.endsWith('.md'))
          );

          if (potentialPaths.length > 0) {
            const firstPath = potentialPaths[0];
            if (firstPath) {
              const filePath = resolve(firstPath);
              codeContent = await readFile(filePath, 'utf-8');
              const extension = extname(filePath);
              analysisPrompt = `Analyze this ${extension} code file (${filePath}) for quality, patterns, and improvements:\n\n${codeContent}`;
            } else {
              // Treat as direct code content
              codeContent = taskInput;
              analysisPrompt = `Analyze the following code for quality, patterns, and improvements:\n\n${codeContent}`;
            }
          } else {
            // Treat as direct code content
            codeContent = taskInput;
            analysisPrompt = `Analyze the following code for quality, patterns, and improvements:\n\n${codeContent}`;
          }
        } catch (fileError) {
          // If file reading fails, treat as direct code content
          codeContent = taskInput;
          analysisPrompt = `Analyze the following code for quality, patterns, and improvements:\n\n${codeContent}`;
        }
      } else {
        // Treat as direct code content
        codeContent = task.input || '' || '';
        analysisPrompt = `Analyze the following code for quality, patterns, and improvements:\n\n${codeContent}`;
      }

      // DEBUG: Log the actual prompt being sent to the AI model
      console.log('🔍 DEBUG: Analysis prompt being sent to AI model:');
      console.log('─'.repeat(80));
      console.log(analysisPrompt.substring(0, 500) + (analysisPrompt.length > 500 ? '...' : ''));
      console.log('─'.repeat(80));
      console.log(`Prompt length: ${analysisPrompt.length} characters`);

      const response = await this.modelClient.synthesize({
        prompt: analysisPrompt,
        model: 'default',
        temperature: 0.3,
        maxTokens: 2000,
      });

      // DEBUG: Log the response from the AI model
      console.log('🤖 DEBUG: AI model response:');
      console.log('─'.repeat(80));
      console.log(
        response.content.substring(0, 300) + (response.content.length > 300 ? '...' : '')
      );
      console.log('─'.repeat(80));

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokensUsed || 0,
          latency: Date.now() - startTime,
          type: 'code-analysis',
        },
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        content: `Error during code analysis: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          model: 'default',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  private async handleCodeGeneration(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Generate code based on the following requirements:\n\n${task.input || ''}`;

      const response = await this.modelClient.synthesize({
        prompt,
        model: 'default',
        temperature: 0.7,
        maxTokens: 3000,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokensUsed || 0,
          latency: Date.now() - startTime,
          type: 'code-generation',
        },
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        content: `Error during code generation: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          model: 'default',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  private async handleDocumentation(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Generate comprehensive documentation for:\n\n${task.input || ''}`;

      const response = await this.modelClient.synthesize({
        prompt,
        model: 'default',
        temperature: 0.5,
        maxTokens: 2500,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokensUsed || 0,
          latency: Date.now() - startTime,
          type: 'documentation',
        },
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        content: `Error during documentation generation: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          model: 'default',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  private async handleTesting(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Generate comprehensive tests for:\n\n${task.input || ''}`;

      const response = await this.modelClient.synthesize({
        prompt,
        model: 'default',
        temperature: 0.4,
        maxTokens: 2500,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokensUsed || 0,
          latency: Date.now() - startTime,
          type: 'testing',
        },
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        content: `Error during test generation: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          model: 'default',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  private async handleRefactoring(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Refactor and optimize the following code:\n\n${task.input || ''}`;

      const response = await this.modelClient.synthesize({
        prompt,
        model: 'default',
        temperature: 0.3,
        maxTokens: 3000,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokensUsed || 0,
          latency: Date.now() - startTime,
          type: 'refactoring',
        },
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        content: `Error during refactoring: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          model: 'default',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  private async handleBugFixing(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Identify and fix bugs in the following code:\n\n${task.input || ''}`;

      const response = await this.modelClient.synthesize({
        prompt,
        model: 'default',
        temperature: 0.2,
        maxTokens: 2500,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokensUsed || 0,
          latency: Date.now() - startTime,
          type: 'bug-fixing',
        },
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        content: `Error during bug fixing: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          model: 'default',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  private async handlePerformanceOptimization(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Optimize the performance of the following code:\n\n${task.input || ''}`;

      const response = await this.modelClient.synthesize({
        prompt,
        model: 'default',
        temperature: 0.3,
        maxTokens: 2500,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokensUsed || 0,
          latency: Date.now() - startTime,
          type: 'performance-optimization',
        },
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        content: `Error during performance optimization: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          model: 'default',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  private async handleSecurityAnalysis(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Analyze the following code for security vulnerabilities:\n\n${task.input || ''}`;

      const response = await this.modelClient.synthesize({
        prompt,
        model: 'default',
        temperature: 0.2,
        maxTokens: 2000,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokensUsed || 0,
          latency: Date.now() - startTime,
          type: 'security-analysis',
        },
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        content: `Error during security analysis: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          model: 'default',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  /**
   * Utility methods
   */
  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isSimpleQuery(input: string): boolean {
    const simplePatterns = [
      /^what\s+files\s+are\s+in/gi,
      /^list\s+files/gi,
      /^show\s+me/gi,
      /^explain\s+\w+$/gi,
      /^how\s+to\s+\w+$/gi,
      /^\w+\s+help$/gi,
    ];

    // Simple queries are typically short and don't need comprehensive analysis
    return input.length < 100 && simplePatterns.some(pattern => pattern.test(input));
  }

  private determineRequestType(input: string): string {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes('analyze') ||
      lowerInput.includes('review') ||
      lowerInput.includes('audit')
    ) {
      return 'code-analysis';
    }
    if (
      lowerInput.includes('generate') ||
      lowerInput.includes('create') ||
      lowerInput.includes('write')
    ) {
      return 'code-generation';
    }
    if (lowerInput.includes('test') || lowerInput.includes('spec')) {
      return 'testing';
    }
    if (lowerInput.includes('document') || lowerInput.includes('readme')) {
      return 'documentation';
    }
    if (lowerInput.includes('security') || lowerInput.includes('vulnerabilit')) {
      return 'security-analysis';
    }

    return 'code-analysis'; // Default
  }

  private getValidCapability(taskType: string): string {
    const validCapabilities = [
      'code-analysis',
      'code-generation',
      'documentation',
      'testing',
      'refactoring',
      'bug-fixing',
      'performance-optimization',
      'security-analysis',
    ];

    return validCapabilities.includes(taskType) ? taskType : 'code-analysis';
  }

  private async getProjectStructure(rootPath: string): Promise<string> {
    try {
      const { readdir, stat } = await import('fs/promises');
      const { join, relative } = await import('path');

      const structure: string[] = [];
      const maxDepth = 3; // Limit depth to avoid huge outputs
      const ignorePatterns = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.vscode',
        '.idea',
        'coverage',
        '.nyc_output',
        'logs',
        '*.log',
      ];

      const walkDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
        if (depth > maxDepth) return;

        try {
          const items = await readdir(dirPath);

          for (const item of items) {
            // Skip ignored patterns
            if (ignorePatterns.some(pattern => item.includes(pattern.replace('*', '')))) {
              continue;
            }

            const itemPath = join(dirPath, item);
            const stats = await stat(itemPath);
            const relativePath = relative(rootPath, itemPath);

            if (stats.isDirectory()) {
              structure.push(`${'  '.repeat(depth)}📁 ${relativePath}/`);
              await walkDirectory(itemPath, depth + 1);
            } else if (stats.isFile()) {
              const ext = item.split('.').pop()?.toLowerCase();
              const icon =
                ext === 'js' || ext === 'ts'
                  ? '📄'
                  : ext === 'json'
                    ? '⚙️'
                    : ext === 'md'
                      ? '📝'
                      : ext === 'css'
                        ? '🎨'
                        : '📄';
              structure.push(`${'  '.repeat(depth)}${icon} ${relativePath}`);
            }
          }
        } catch (error) {
          structure.push(`${'  '.repeat(depth)}❌ Error reading ${relative(rootPath, dirPath)}`);
        }
      };

      await walkDirectory(rootPath);

      return `Project Structure:\n${structure.slice(0, 100).join('\n')}${structure.length > 100 ? '\n... (truncated)' : ''}`;
    } catch (error) {
      return `Error reading project structure: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private updateMetrics(response: ExecutionResponse): void {
    this.metrics.tasksCompleted++;
    this.metrics.lastExecutionTime = response.executionTime || 0;

    if (response.success) {
      this.metrics.successRate =
        (this.metrics.successRate * (this.metrics.tasksCompleted - 1) + 1) /
        this.metrics.tasksCompleted;
    } else {
      this.metrics.successRate =
        (this.metrics.successRate * (this.metrics.tasksCompleted - 1)) /
        this.metrics.tasksCompleted;
    }

    const executionTime = response.executionTime || 0;
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (this.metrics.tasksCompleted - 1) + executionTime) /
      this.metrics.tasksCompleted;
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Clean up agent resources
   */
  async destroy(): Promise<void> {
    try {
      // Cancel any active workflows
      for (const workflow of this.activeWorkflows.values()) {
        workflow.status = 'completed';
      }
      this.activeWorkflows.clear();

      // Clear execution queue
      this.executionQueue.length = 0;

      // Clean up performance monitor
      if (this.performanceMonitor && typeof this.performanceMonitor.destroy === 'function') {
        this.performanceMonitor.destroy();
      }

      // Remove all listeners
      this.removeAllListeners();
    } catch (error) {
      console.error('Error during UnifiedAgent cleanup:', error);
    }
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): Workflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get available capabilities
   */
  getCapabilities(): AgentCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Enable/disable capability
   */
  setCapabilityEnabled(name: string, enabled: boolean): void {
    const capability = this.capabilities.get(name);
    if (capability) {
      capability.enabled = enabled;
      this.emit('capability-toggled', { name, enabled });
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<AgentConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await configManager.updateAgentConfig(this.config);
    this.emit('config-updated', this.config);
  }
}

// Legacy compatibility exports
export const timeoutManager = {
  async executeWithRetry<T>(fn: () => Promise<T>, retries: number = 3): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Max retries exceeded');
  },
};

interface EditSummary {
  total: number;
  approved: number;
  rejected: number;
}

interface EditConfirmationResult {
  approved: boolean;
  edits: unknown;
}

interface EditApplicationResult {
  success: boolean;
  edits: unknown;
}

interface ConfirmationResult {
  approved: unknown[];
  rejected: unknown[];
}

export const globalEditConfirmation = {
  getPendingEditsCount: () => 0,
  proposeEdits: async (edits: unknown): Promise<EditConfirmationResult> => ({
    approved: true,
    edits,
  }),
  confirmAllEdits: async (): Promise<ConfirmationResult> => ({ approved: [], rejected: [] }),
  applyEdits: async (edits: unknown): Promise<EditApplicationResult> => ({ success: true, edits }),
  clearPendingEdits: () => {},
  generateEditSummary: (): EditSummary => ({ total: 0, approved: 0, rejected: 0 }),
  displayEditSummary: (summary: EditSummary) => console.log('Edit Summary:', summary),
};

interface IndexResult {
  indexed: boolean;
  path: string;
}

export const globalRAGSystem = {
  indexPath: async (path: string, _options?: unknown): Promise<IndexResult> => ({
    indexed: true,
    path,
  }),
};

let shutdownHandlersRegistered = false;

export const registerShutdownHandler = (handler: () => void) => {
  if (!shutdownHandlersRegistered) {
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
    shutdownHandlersRegistered = true;
  }
};

export const createManagedInterval = (fn: () => void, interval: number) => {
  return setInterval(fn, interval);
};

export const clearManagedInterval = (id: NodeJS.Timeout) => {
  clearInterval(id);
};

export const initializeEditConfirmation = (_path: string, _options?: unknown) =>
  globalEditConfirmation;
export const createUnifiedModelClient = (config: Record<string, unknown>) => {
  // Create a basic config structure for compatibility
  const unifiedConfig = {
    providers: [],
    executionMode: 'auto' as const,
    fallbackChain: ['ollama', 'lm-studio'] as Array<
      'ollama' | 'lm-studio' | 'huggingface' | 'auto'
    >,
    performanceThresholds: {
      fastModeMaxTokens: 1000,
      timeoutMs: 30000,
      maxConcurrentRequests: 3,
    },
    security: {
      enableSandbox: true,
      maxInputLength: 10000,
      allowedCommands: [],
    },
    ...config,
  };
  return new UnifiedModelClient(unifiedConfig);
};

export interface AgentContext {
  modelClient: UnifiedModelClient;
  workingDirectory: string;
  config: AgentConfig;
}
