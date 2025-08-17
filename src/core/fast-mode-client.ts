/**
 * Fast Mode Client - Minimal initialization for immediate usage
 * Bypasses heavy model preloading and system benchmarking
 */

import { EventEmitter } from 'events';
import { logger } from './logger.js';
import { PerformanceOptimizer } from './performance/performance-optimizer.js';
import { FastModeConfig } from './types/performance.js';
import { ExecutionManager } from './execution/execution-backend.js';

export interface FastModeOptions {
  skipModelPreload?: boolean;
  skipBenchmark?: boolean;
  useMinimalVoices?: boolean;
  enableCaching?: boolean;
  maxLatency?: number; // milliseconds
}

export class FastModeClient extends EventEmitter {
  private optimizer: PerformanceOptimizer;
  private executionManager: ExecutionManager | null = null;
  private config: FastModeConfig;
  private startTime: number;

  constructor(options: FastModeOptions = {}) {
    super();
    this.startTime = Date.now();
    
    this.config = {
      skipModelPreload: options.skipModelPreload !== false,
      skipBenchmark: options.skipBenchmark !== false,
      useMinimalVoices: options.useMinimalVoices !== false,
      disableMCP: true, // Disable heavy MCP servers
      lightweightMode: true
    };

    // Initialize with performance-optimized settings
    this.optimizer = new PerformanceOptimizer({
      enableCaching: options.enableCaching !== false,
      enableBatching: false, // Disable for simplicity
      enableStreaming: false, // Disable for simplicity
      temperature: 0.1, // More deterministic
      maxTokensPerPrompt: 2048, // Smaller context
      maxCacheSize: 100 // Smaller cache
    });

    this.optimizer.enableFastMode();

    logger.info('Fast mode client initialized', {
      initTime: Date.now() - this.startTime,
      config: this.config
    });
  }

  /**
   * Lightweight initialization without heavy dependencies
   */
  async initialize(): Promise<void> {
    const startInit = Date.now();

    try {
      // Initialize only essential components
      if (!this.config.skipBenchmark) {
        // Quick system check (< 1 second)
        await this.quickSystemCheck();
      }

      // Initialize minimal execution backend
      await this.initializeMinimalExecution();

      const initTime = Date.now() - startInit;
      logger.info('Fast mode initialization complete', {
        totalTime: initTime,
        fromStart: Date.now() - this.startTime
      });

      this.emit('ready', { initTime });
    } catch (error) {
      logger.error('Fast mode initialization failed', error);
      throw error;
    }
  }

  private async quickSystemCheck(): Promise<void> {
    // Ultra-lightweight system detection
    const os = await import('os');
    const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
    const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
    
    logger.info('Quick system check', {
      memory: `${freeMem}GB free / ${totalMem}GB total`,
      cores: os.cpus().length,
      platform: os.platform()
    });
  }

  private async initializeMinimalExecution(): Promise<void> {
    // Initialize only local process execution (fastest)
    const configs = [{
      type: 'local_process' as const,
      localSafeguards: true,
      allowedCommands: ['echo', 'ls', 'pwd', 'node', 'npm', 'bash', 'sh', 'git']
    }];

    this.executionManager = new ExecutionManager(configs);
    logger.info('Minimal execution backend initialized');
  }

  /**
   * Fast code generation without model dependencies
   */
  async generateCode(prompt: string, context: string[] = []): Promise<{
    code: string;
    explanation: string;
    suggestions: string[];
    fromCache: boolean;
    latency: number;
  }> {
    const startTime = Date.now();

    // Optimize prompt for speed
    const optimized = this.optimizer.optimizePrompt(prompt, context);
    
    // Try cache first
    const response = await this.optimizer.processBatch([{
      id: 'fast-gen',
      prompt: optimized.optimizedPrompt,
      context: optimized.relevantContext,
      priority: 1
    }]);

    const result = response.get('fast-gen');
    const latency = Date.now() - startTime;

    // Generate template-based response for speed
    const codeResult = this.generateTemplateResponse(prompt, optimized.relevantContext);

    return {
      ...codeResult,
      fromCache: result?.fromCache || false,
      latency
    };
  }

  private generateTemplateResponse(prompt: string, context: string[]): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    // Template-based code generation for immediate response
    const promptLower = prompt.toLowerCase();

    if (promptLower.includes('react') && promptLower.includes('component')) {
      return this.generateReactComponentTemplate(prompt);
    }
    
    if (promptLower.includes('function') || promptLower.includes('method')) {
      return this.generateFunctionTemplate(prompt);
    }

    if (promptLower.includes('class')) {
      return this.generateClassTemplate(prompt);
    }

    // Generic template
    return {
      code: this.generateGenericTemplate(prompt),
      explanation: `Generated template-based response for: ${prompt}`,
      suggestions: [
        'Consider adding error handling',
        'Add type annotations if using TypeScript',
        'Include unit tests for this code'
      ]
    };
  }

  private generateReactComponentTemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const componentName = this.extractComponentName(prompt) || 'MyComponent';
    
    const code = `import React from 'react';

interface ${componentName}Props {
  // Add your props here
}

const ${componentName}: React.FC<${componentName}Props> = (props) => {
  return (
    <div className="${componentName.toLowerCase()}">
      <h2>${componentName}</h2>
      {/* Add your component content here */}
    </div>
  );
};

export default ${componentName};`;

    return {
      code,
      explanation: `Generated a basic React component template for ${componentName}`,
      suggestions: [
        'Add PropTypes or TypeScript interfaces for type safety',
        'Consider using React hooks for state management',
        'Add CSS modules or styled-components for styling',
        'Include unit tests with React Testing Library'
      ]
    };
  }

  private generateFunctionTemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const functionName = this.extractFunctionName(prompt) || 'myFunction';
    
    const code = `/**
 * ${prompt}
 */
function ${functionName}(params) {
  try {
    // Implementation goes here
    return result;
  } catch (error) {
    console.error('Error in ${functionName}:', error);
    throw error;
  }
}

export { ${functionName} };`;

    return {
      code,
      explanation: `Generated function template for ${functionName}`,
      suggestions: [
        'Add parameter validation',
        'Include comprehensive error handling',
        'Add JSDoc documentation',
        'Consider async/await if dealing with promises'
      ]
    };
  }

  private generateClassTemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const className = this.extractClassName(prompt) || 'MyClass';
    
    const code = `class ${className} {
  constructor(options = {}) {
    this.options = { ...this.getDefaults(), ...options };
    this.initialize();
  }

  getDefaults() {
    return {
      // Default options here
    };
  }

  initialize() {
    // Initialization logic here
  }

  // Add your methods here
}

export { ${className} };`;

    return {
      code,
      explanation: `Generated class template for ${className}`,
      suggestions: [
        'Add private/public method annotations',
        'Implement proper getter/setter methods',
        'Add validation in constructor',
        'Consider using TypeScript for better type safety'
      ]
    };
  }

  private generateGenericTemplate(prompt: string): string {
    return `// Generated template for: ${prompt}

// TODO: Implement the requested functionality
// This is a basic template to get you started

const implementation = () => {
  // Your code here
};

export default implementation;`;
  }

  private extractComponentName(prompt: string): string | null {
    const match = prompt.match(/(?:component|Component)\s+(?:for\s+)?(?:a\s+)?([A-Za-z][A-Za-z0-9]*)/i);
    return match ? this.toPascalCase(match[1]) : null;
  }

  private extractFunctionName(prompt: string): string | null {
    const match = prompt.match(/(?:function|method)\s+(?:to\s+|for\s+|that\s+)?([A-Za-z][A-Za-z0-9]*)/i);
    return match ? this.toCamelCase(match[1]) : null;
  }

  private extractClassName(prompt: string): string | null {
    const match = prompt.match(/(?:class|Class)\s+(?:for\s+)?(?:a\s+)?([A-Za-z][A-Za-z0-9]*)/i);
    return match ? this.toPascalCase(match[1]) : null;
  }

  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1).toLowerCase();
  }

  /**
   * Fast command execution
   */
  async executeCommand(command: string, options: {
    workingDirectory?: string;
    timeout?: number;
  } = {}): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    latency: number;
  }> {
    const startTime = Date.now();

    if (!this.executionManager) {
      throw new Error('Execution manager not initialized');
    }

    try {
      const result = await this.executionManager.execute(command, {
        workingDirectory: options.workingDirectory,
        timeout: options.timeout || 5000
      });

      return {
        success: result.success,
        stdout: result.success ? result.data.stdout : '',
        stderr: result.success ? result.data.stderr : (typeof result.error === 'string' ? result.error : result.error?.message || 'Unknown error'),
        exitCode: result.success ? result.data.exitCode : 1,
        latency: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.optimizer.getMetrics(),
      fastModeEnabled: true,
      totalInitTime: Date.now() - this.startTime
    };
  }

  /**
   * Check if fast mode is ready
   */
  isReady(): boolean {
    return this.executionManager !== null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.optimizer.clearCache();
    logger.info('Fast mode client cleaned up');
  }
}

export default FastModeClient;