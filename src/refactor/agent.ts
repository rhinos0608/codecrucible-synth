import { Task, ExecutionResult } from '../core/types.js';
import { UnifiedModelClient } from '../application/services/client.js';

export class Agent {
  private client: UnifiedModelClient;

  constructor(client: UnifiedModelClient) {
    this.client = client;
  }

  async handleCodeAnalysis(task: Task): Promise<ExecutionResult> {
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

      if (typeof taskInput === 'string' && isProjectAnalysis) {
        // Read project structure
        try {
          // File reading functionality moved to getProjectStructure method

          const projectRoot = process.cwd();
          const projectStructure = await this.client.getProjectStructure(projectRoot);

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

      const response = await this.client.synthesize({
        prompt: analysisPrompt,
        model: 'default',
        temperature: 0.3,
        maxTokens: 2000,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          model: 'default',
          tokens: response.tokens_used || 0,
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

  async handleCodeGeneration(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Generate code based on the following requirements:\n\n${task.input || ''}`;

      const response = await this.client.synthesize({
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
          tokens: response.tokens_used || 0,
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

  async handleDocumentation(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Generate comprehensive documentation for:\n\n${task.input || ''}`;

      const response = await this.client.synthesize({
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
          tokens: response.tokens_used || 0,
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

  async handleTesting(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Generate comprehensive tests for:\n\n${task.input || ''}`;

      const response = await this.client.synthesize({
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
          tokens: response.tokens_used || 0,
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

  async handleRefactoring(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Refactor and optimize the following code:\n\n${task.input || ''}`;

      const response = await this.client.synthesize({
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
          tokens: response.tokens_used || 0,
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

  async handleBugFixing(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Identify and fix bugs in the following code:\n\n${task.input || ''}`;

      const response = await this.client.synthesize({
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
          tokens: response.tokens_used || 0,
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

  async handlePerformanceOptimization(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Optimize the performance of the following code:\n\n${task.input || ''}`;

      const response = await this.client.synthesize({
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
          tokens: response.tokens_used || 0,
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

  async handleSecurityAnalysis(task: Task): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const prompt = `Analyze the following code for security vulnerabilities:\n\n${task.input || ''}`;

      const response = await this.client.synthesize({
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
          tokens: response.tokens_used || 0,
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
}
