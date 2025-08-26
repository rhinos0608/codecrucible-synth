/**
 * LLM Function Factory
 * Creates and manages LLM-powered function tools
 */

import { BaseToolImplementation, ToolContext, ToolResult } from './base-tool-implementation.js';

export interface LLMFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  examples?: Array<{
    input: any;
    output: any;
    description?: string;
  }>;
}

export interface LLMFunctionConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
}

export class LLMFunction extends BaseToolImplementation {
  readonly name: string;
  readonly description: string;
  readonly version = '1.0.0';
  
  private definition: LLMFunctionDefinition;
  private config: LLMFunctionConfig;

  constructor(definition: LLMFunctionDefinition, config: LLMFunctionConfig = {}) {
    super({
      requiresAuth: false,
      requiresNetwork: true,
      canCache: true,
      maxExecutionTime: config.timeout || 30000,
      supportedFormats: ['application/json', 'text/plain']
    });

    this.name = definition.name;
    this.description = definition.description;
    this.definition = definition;
    this.config = {
      model: 'default',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      retries: 3,
      ...config
    };
  }

  async execute(input: any, context?: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate input against parameters schema
      const validation = await this.validateParameters(input);
      if (!validation.valid) {
        return this.createErrorResult(`Invalid parameters: ${validation.errors.join(', ')}`);
      }

      // Execute the LLM function
      const result = await this.executeLLMFunction(input, context);
      
      const executionTime = Date.now() - startTime;
      
      return this.createSuccessResult(result, {
        executionTime,
        model: this.config.model,
        temperature: this.config.temperature
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(`Execution failed: ${error}`, 'error', context);
      
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error),
        { executionTime }
      );
    }
  }

  private async validateParameters(input: any): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    if (!input || typeof input !== 'object') {
      errors.push('Input must be an object');
      return { valid: false, errors };
    }

    // Check required parameters
    for (const required of this.definition.parameters.required) {
      if (!(required in input)) {
        errors.push(`Missing required parameter: ${required}`);
      }
    }

    // TODO: Add more sophisticated schema validation
    // For now, just check required fields
    
    return { valid: errors.length === 0, errors };
  }

  private async executeLLMFunction(input: any, context?: ToolContext): Promise<any> {
    // Mock LLM function execution
    // In a real implementation, this would call an LLM service
    
    this.log(`Executing LLM function with input: ${JSON.stringify(input)}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return mock result based on function name
    switch (this.name) {
      case 'text_analyzer':
        return {
          analysis: 'Text analysis complete',
          sentiment: 'positive',
          keywords: ['example', 'text', 'analysis']
        };
      
      case 'code_generator':
        return {
          code: '// Generated code\nfunction example() {\n  return "Hello, World!";\n}',
          language: 'javascript',
          explanation: 'A simple example function'
        };
      
      case 'data_transformer':
        return {
          transformed: input,
          format: 'json',
          timestamp: Date.now()
        };
      
      default:
        return {
          result: 'Function executed successfully',
          input: input,
          timestamp: Date.now()
        };
    }
  }

  getDefinition(): LLMFunctionDefinition {
    return { ...this.definition };
  }

  getConfig(): LLMFunctionConfig {
    return { ...this.config };
  }
}

export class LLMFunctionFactory {
  private functions: Map<string, LLMFunction> = new Map();
  private defaultConfig: LLMFunctionConfig;

  constructor(defaultConfig: LLMFunctionConfig = {}) {
    this.defaultConfig = defaultConfig;
  }

  createFunction(definition: LLMFunctionDefinition, config?: LLMFunctionConfig): LLMFunction {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const func = new LLMFunction(definition, mergedConfig);
    
    this.functions.set(definition.name, func);
    
    return func;
  }

  getFunction(name: string): LLMFunction | undefined {
    return this.functions.get(name);
  }

  getAllFunctions(): LLMFunction[] {
    return Array.from(this.functions.values());
  }

  removeFunction(name: string): boolean {
    return this.functions.delete(name);
  }

  clear(): void {
    this.functions.clear();
  }

  // Create common utility functions
  static createCommonFunctions(factory: LLMFunctionFactory): void {
    // Text Analysis Function
    factory.createFunction({
      name: 'text_analyzer',
      description: 'Analyzes text for sentiment, keywords, and other insights',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to analyze' },
          analysis_type: { 
            type: 'string', 
            enum: ['sentiment', 'keywords', 'summary', 'all'],
            description: 'Type of analysis to perform'
          }
        },
        required: ['text']
      }
    });

    // Code Generator Function
    factory.createFunction({
      name: 'code_generator',
      description: 'Generates code based on requirements',
      parameters: {
        type: 'object',
        properties: {
          requirements: { type: 'string', description: 'Description of what to generate' },
          language: { type: 'string', description: 'Programming language' },
          style: { type: 'string', description: 'Coding style preferences' }
        },
        required: ['requirements']
      }
    });

    // Data Transformer Function
    factory.createFunction({
      name: 'data_transformer',
      description: 'Transforms data from one format to another',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'object', description: 'The data to transform' },
          target_format: { type: 'string', description: 'Target format' },
          options: { type: 'object', description: 'Transformation options' }
        },
        required: ['data', 'target_format']
      }
    });
  }
}

export default LLMFunctionFactory;