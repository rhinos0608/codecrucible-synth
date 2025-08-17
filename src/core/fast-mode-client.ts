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
      allowedCommands: ['echo', 'ls', 'pwd', 'node', 'npm', 'bash', 'sh', 'git', 'find', 'grep', 'wc', 'head', 'tail', 'cat', 'tree', 'du', 'cd']
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
    const promptLower = prompt.toLowerCase();

    // Check for audit/analysis requests
    if (promptLower.includes('audit') || promptLower.includes('analyze')) {
      return this.generateAuditTemplate(prompt);
    }

    // Check for specific code types
    if (promptLower.includes('react') && promptLower.includes('component')) {
      return this.generateReactComponentTemplate(prompt);
    }
    
    if (promptLower.includes('function') || promptLower.includes('method')) {
      return this.generateFunctionTemplate(prompt);
    }

    if (promptLower.includes('class')) {
      return this.generateClassTemplate(prompt);
    }

    // Check for documentation requests
    if (promptLower.includes('document') || promptLower.includes('readme')) {
      return this.generateDocumentationTemplate(prompt);
    }

    // Check for test requests
    if (promptLower.includes('test') || promptLower.includes('spec')) {
      return this.generateTestTemplate(prompt);
    }

    // Generic intelligent response
    return this.generateIntelligentResponse(prompt, context);
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

  private generateAuditTemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const auditScript = `#!/bin/bash
# Codebase Audit Script - Generated from: ${prompt}

echo "🔍 CodeCrucible Codebase Audit Report"
echo "======================================"
echo ""

echo "📁 Project Structure:"
find . -type d -name node_modules -prune -o -type d -print | head -15

echo ""
echo "📊 File Statistics:"
echo "TypeScript files: $(find . -name '*.ts' | wc -l)"
echo "JavaScript files: $(find . -name '*.js' | wc -l)" 
echo "JSON config files: $(find . -name '*.json' | wc -l)"
echo "Test files: $(find . -name '*.test.*' -o -name '*.spec.*' | wc -l)"

echo ""
echo "🔧 Key Configuration Files:"
ls -la package.json tsconfig.json README.md 2>/dev/null | grep -v "cannot access"

echo ""
echo "📝 Recent Git Activity:"
git log --oneline -5 2>/dev/null || echo "Not a git repository"

echo ""
echo "🚨 Potential Issues:"
echo "Large files: $(find . -size +1M -type f | head -5)"
echo "Node modules size: $(du -sh node_modules 2>/dev/null || echo 'No node_modules')"

echo ""
echo "✅ Audit Complete"`;

    return {
      code: auditScript,
      explanation: 'Generated comprehensive codebase audit script that analyzes project structure, file statistics, configuration, and potential issues',
      suggestions: [
        'Run this script to get detailed project insights',
        'Review large files and optimize if necessary',
        'Check test coverage percentage',
        'Ensure all configuration files are properly set up'
      ]
    };
  }

  private generateDocumentationTemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const readmeTemplate = `# ${this.extractProjectName(prompt) || 'Project Name'}

## Overview
Brief description of what this project does and its main purpose.

## Features
- Feature 1: Description
- Feature 2: Description  
- Feature 3: Description

## Installation

\`\`\`bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Build the project
npm run build
\`\`\`

## Usage

\`\`\`bash
# Run the application
npm start

# Run tests
npm test

# Run in development mode
npm run dev
\`\`\`

## Configuration
Description of configuration options and environment variables.

## API Documentation
If applicable, document your API endpoints here.

## Contributing
Guidelines for contributing to the project.

## License
Specify the license under which this project is released.
`;

    return {
      code: readmeTemplate,
      explanation: 'Generated comprehensive README.md template with standard sections for project documentation',
      suggestions: [
        'Customize the project name and description',
        'Add specific installation instructions for your project',
        'Include actual feature descriptions',
        'Add screenshots or examples if applicable'
      ]
    };
  }

  private generateTestTemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const testTemplate = `import { describe, it, expect, beforeEach, afterEach } from 'jest';
// Import the module/function you want to test
// import { functionToTest } from '../src/module';

describe('${this.extractTestSubject(prompt) || 'Test Suite'}', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('when testing basic functionality', () => {
    it('should handle valid input correctly', () => {
      // Arrange
      const input = 'test input';
      const expected = 'expected output';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle edge cases', () => {
      // Test edge cases like null, undefined, empty values
      expect(() => functionToTest(null)).toThrow();
      expect(functionToTest('')).toBe('');
    });
  });

  describe('when testing error conditions', () => {
    it('should throw error for invalid input', () => {
      expect(() => functionToTest('invalid')).toThrow('Expected error message');
    });
  });
});`;

    return {
      code: testTemplate,
      explanation: 'Generated comprehensive Jest test template with setup, teardown, and organized test cases',
      suggestions: [
        'Replace functionToTest with your actual function',
        'Add more specific test cases for your use case',
        'Include integration tests if needed',
        'Consider using test data builders for complex objects'
      ]
    };
  }

  private generateIntelligentResponse(prompt: string, context: string[]): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    // Analyze the prompt for intent
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('api') || promptLower.includes('endpoint')) {
      return this.generateAPITemplate(prompt);
    }
    
    if (promptLower.includes('config') || promptLower.includes('setup')) {
      return this.generateConfigTemplate(prompt);
    }
    
    if (promptLower.includes('database') || promptLower.includes('model')) {
      return this.generateDatabaseTemplate(prompt);
    }

    // Default intelligent response
    const genericCode = `// Generated template for: ${prompt}
// This appears to be a ${this.classifyPromptType(prompt)} request

/**
 * TODO: Implement the requested functionality
 * 
 * Prompt analysis suggests this involves:
 * ${this.analyzePromptRequirements(prompt).map(req => `* ${req}`).join('\n * ')}
 */

const implementation = {
  // Add your implementation here
  
  // Example structure based on the request:
  ${this.generateStructureSuggestion(prompt)}
};

export default implementation;`;

    return {
      code: genericCode,
      explanation: `Intelligent analysis of "${prompt}" suggests this is a ${this.classifyPromptType(prompt)} request. Generated structured template with analysis.`,
      suggestions: this.generateContextualSuggestions(prompt)
    };
  }

  private extractProjectName(prompt: string): string | null {
    const match = prompt.match(/(?:project|app|application)\s+(?:called|named|for)?\s*([A-Za-z][A-Za-z0-9\-_]*)/i);
    return match ? match[1] : null;
  }

  private extractTestSubject(prompt: string): string | null {
    const match = prompt.match(/test\s+(?:for\s+)?([A-Za-z][A-Za-z0-9]*)/i);
    return match ? match[1] : null;
  }

  private generateAPITemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const apiCode = `import express from 'express';
import { Request, Response } from 'express';

const router = express.Router();

// Generated API endpoint for: ${prompt}
router.get('/api/endpoint', async (req: Request, res: Response) => {
  try {
    // Implement your logic here
    const result = await processRequest(req.query);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function processRequest(query: any) {
  // Implementation logic
  return { message: 'Success' };
}

export default router;`;

    return {
      code: apiCode,
      explanation: 'Generated Express.js API endpoint template with error handling and TypeScript types',
      suggestions: [
        'Add input validation middleware',
        'Implement proper authentication if needed',
        'Add request logging and monitoring',
        'Consider rate limiting for production'
      ]
    };
  }

  private generateConfigTemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const configCode = `// Configuration for: ${prompt}
export interface AppConfig {
  // Environment settings
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  
  // Database configuration
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
  };
  
  // API settings
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  
  // Feature flags
  features: {
    enableFeatureX: boolean;
    enableLogging: boolean;
  };
}

const config: AppConfig = {
  NODE_ENV: (process.env.NODE_ENV as any) || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'myapp',
    username: process.env.DB_USER || 'user',
    password: process.env.DB_PASS || 'password'
  },
  
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    timeout: 30000,
    retries: 3
  },
  
  features: {
    enableFeatureX: process.env.ENABLE_FEATURE_X === 'true',
    enableLogging: process.env.ENABLE_LOGGING !== 'false'
  }
};

export default config;`;

    return {
      code: configCode,
      explanation: 'Generated TypeScript configuration template with environment variables and type safety',
      suggestions: [
        'Create a .env file with your environment variables',
        'Add validation for required configuration values',
        'Consider using a configuration library like dotenv',
        'Add different configs for different environments'
      ]
    };
  }

  private generateDatabaseTemplate(prompt: string): {
    code: string;
    explanation: string;
    suggestions: string[];
  } {
    const dbCode = `// Database model for: ${prompt}
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class ${this.toPascalCase(this.extractModelName(prompt) || 'Model')} {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Repository class for database operations
export class ${this.toPascalCase(this.extractModelName(prompt) || 'Model')}Repository {
  
  async findAll(): Promise<${this.toPascalCase(this.extractModelName(prompt) || 'Model')}[]> {
    // Implementation
    return [];
  }

  async findById(id: number): Promise<${this.toPascalCase(this.extractModelName(prompt) || 'Model')} | null> {
    // Implementation
    return null;
  }

  async create(data: Partial<${this.toPascalCase(this.extractModelName(prompt) || 'Model')}>): Promise<${this.toPascalCase(this.extractModelName(prompt) || 'Model')}> {
    // Implementation
    return {} as ${this.toPascalCase(this.extractModelName(prompt) || 'Model')};
  }

  async update(id: number, data: Partial<${this.toPascalCase(this.extractModelName(prompt) || 'Model')}>): Promise<${this.toPascalCase(this.extractModelName(prompt) || 'Model')} | null> {
    // Implementation  
    return null;
  }

  async delete(id: number): Promise<boolean> {
    // Implementation
    return true;
  }
}`;

    return {
      code: dbCode,
      explanation: 'Generated TypeORM entity and repository pattern with CRUD operations',
      suggestions: [
        'Customize the entity fields for your specific use case',
        'Add relationships to other entities if needed',
        'Implement validation decorators',
        'Add indexes for performance optimization'
      ]
    };
  }

  private extractModelName(prompt: string): string | null {
    const match = prompt.match(/(?:model|entity|table)\s+(?:for\s+)?([A-Za-z][A-Za-z0-9]*)/i);
    return match ? match[1] : null;
  }

  private classifyPromptType(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('api') || promptLower.includes('endpoint')) return 'API development';
    if (promptLower.includes('database') || promptLower.includes('model')) return 'database modeling';
    if (promptLower.includes('test')) return 'testing';
    if (promptLower.includes('config')) return 'configuration';
    if (promptLower.includes('component')) return 'UI component';
    if (promptLower.includes('function')) return 'utility function';
    if (promptLower.includes('class')) return 'class definition';
    if (promptLower.includes('audit') || promptLower.includes('analyze')) return 'code analysis';
    
    return 'general development';
  }

  private analyzePromptRequirements(prompt: string): string[] {
    const requirements = [];
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('error')) requirements.push('Error handling');
    if (promptLower.includes('async') || promptLower.includes('await')) requirements.push('Asynchronous operations');
    if (promptLower.includes('type') || promptLower.includes('interface')) requirements.push('Type definitions');
    if (promptLower.includes('test')) requirements.push('Unit testing');
    if (promptLower.includes('valid')) requirements.push('Input validation');
    if (promptLower.includes('secure')) requirements.push('Security considerations');
    if (promptLower.includes('perform')) requirements.push('Performance optimization');
    
    return requirements.length > 0 ? requirements : ['Basic implementation', 'Error handling', 'Type safety'];
  }

  private generateStructureSuggestion(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('function')) {
      return `process: (input: any) => any,\n  validate: (input: any) => boolean,\n  handleError: (error: Error) => void`;
    }
    
    if (promptLower.includes('class')) {
      return `constructor: () => void,\n  publicMethod: () => any,\n  privateMethod: () => any`;
    }
    
    if (promptLower.includes('api')) {
      return `endpoint: '/api/resource',\n  method: 'GET | POST | PUT | DELETE',\n  handler: async (req, res) => {}`;
    }
    
    return `init: () => void,\n  process: (data: any) => any,\n  cleanup: () => void`;
  }

  private generateContextualSuggestions(prompt: string): string[] {
    const suggestions = [
      'Consider adding comprehensive error handling',
      'Add type annotations for better code safety',
      'Include unit tests for reliability'
    ];
    
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('async')) {
      suggestions.push('Handle promise rejections properly');
    }
    
    if (promptLower.includes('api')) {
      suggestions.push('Add input validation and sanitization');
      suggestions.push('Implement proper HTTP status codes');
    }
    
    if (promptLower.includes('database')) {
      suggestions.push('Consider database migrations');
      suggestions.push('Add proper indexing for performance');
    }
    
    return suggestions;
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