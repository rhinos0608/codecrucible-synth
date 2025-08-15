import { CLIContext } from './cli.js';
import { LocalModelClient } from './local-model-client.js';
import { logger } from './logger.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BaseTool } from './tools/base-tool.js';
import { ReadFileTool, WriteFileTool, ListFilesTool } from './tools/file-tools.js';
import { LintCodeTool, GetAstTool } from './tools/code-analysis-tools.js';
import { GitStatusTool, GitDiffTool } from './tools/git-tools.js';
import { AutonomousErrorHandler, ErrorContext } from './autonomous-error-handler.js';
import { IntelligentModelSelector } from './intelligent-model-selector.js';

const ThoughtSchema = z.object({
  thought: z.string().describe('Your reasoning and plan for the next action.'),
  tool: z.string().describe('The name of the tool to use.'),
  toolInput: z.record(z.unknown()).describe('The input for the tool.'),
});

type Thought = z.infer<typeof ThoughtSchema>;

interface ReActAgentContext {
  workingDirectory: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  currentPlan?: string[];
}

export class ReActAgent {
  private context: CLIContext;
  private model: LocalModelClient;
  private tools: BaseTool[];
  private agentContext: ReActAgentContext;
  private errorHandler: AutonomousErrorHandler;
  private modelSelector: IntelligentModelSelector;

  constructor(context: CLIContext, workingDirectory: string) {
    this.context = context;
    this.model = context.modelClient;
    this.agentContext = {
      workingDirectory,
      messages: [],
    };
    this.tools = [
      new ReadFileTool(this.agentContext),
      new WriteFileTool(this.agentContext),
      new ListFilesTool(this.agentContext),
      new LintCodeTool(this.agentContext),
      new GetAstTool(this.agentContext),
      new GitStatusTool(this.agentContext),
      new GitDiffTool(this.agentContext),
    ];
    
    // Initialize autonomous capabilities
    this.errorHandler = new AutonomousErrorHandler();
    this.modelSelector = new IntelligentModelSelector();
  }

  public getContext(): ReActAgentContext {
    return this.agentContext;
  }

  public getAvailableTools(): BaseTool[] {
    return this.tools;
  }

  public reset(): void {
    this.agentContext.messages = [];
    this.agentContext.currentPlan = undefined;
  }

  async processRequest(input: string): Promise<string> {
    this.agentContext.messages.push({ role: 'user', content: input, timestamp: Date.now() });

    // Use intelligent model selection for this task
    const taskType = this.analyzeTaskType(input);
    const optimalModel = await this.modelSelector.selectOptimalModel(taskType, {
      complexity: this.assessComplexity(input),
      speed: 'medium',
      accuracy: 'high'
    });

    logger.info(`🧠 Selected optimal model: ${optimalModel} for task type: ${taskType}`);

    for (let i = 0; i < 10; i++) { // Limit the number of iterations
      try {
        const prompt = this.constructPrompt();
        const response = await this.model.generate(prompt);
        
        try {
          const thought = this.parseResponse(response);
          
          if (thought.tool === 'final_answer') {
            const finalAnswer = thought.toolInput.answer as string;
            this.agentContext.messages.push({ role: 'assistant', content: finalAnswer, timestamp: Date.now() });
            
            // Record successful completion
            this.modelSelector.recordPerformance(optimalModel, taskType, true, Date.now() - this.getLastMessageTime(), 1.0);
            
            return finalAnswer;
          }

          const tool = this.tools.find(t => t.definition.name === thought.tool);
          if (!tool) {
            throw new Error(`Unknown tool: ${thought.tool}`);
          }

          this.agentContext.messages.push({ role: 'assistant', content: JSON.stringify(thought), timestamp: Date.now() });
          
          const observation = await tool.execute(thought.toolInput);
          this.agentContext.messages.push({ role: 'tool', content: JSON.stringify(observation), timestamp: Date.now() });

        } catch (parseError) {
          logger.error('Error parsing agent response:', parseError);
          const errorMessage = parseError instanceof Error ? parseError.message : 'Failed to parse response';
          this.agentContext.messages.push({ role: 'tool', content: JSON.stringify({ error: errorMessage }), timestamp: Date.now() });
        }

      } catch (error) {
        logger.error('Error in agent iteration:', error);
        
        // Use autonomous error handling
        const errorContext: ErrorContext = {
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          operation: 'agent_processing',
          model: optimalModel,
          context: { iteration: i, taskType, input }
        };

        const recoveryActions = await this.errorHandler.analyzeAndRecover(errorContext);
        
        // Check if we should switch models based on recovery actions
        for (const action of recoveryActions) {
          if (action.action === 'switch_model' && action.target) {
            logger.info(`🔄 Autonomous model switch: ${optimalModel} → ${action.target}`);
            // The model switch will be handled by the next iteration
            break;
          }
        }

        // Record failure for learning
        this.modelSelector.recordPerformance(optimalModel, taskType, false, Date.now() - this.getLastMessageTime(), 0.0);

        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        this.agentContext.messages.push({ role: 'tool', content: JSON.stringify({ error: errorMessage, recovery: recoveryActions.length > 0 ? 'autonomous_recovery_attempted' : 'no_recovery' }), timestamp: Date.now() });
      }
    }

    return 'The agent could not reach a final answer after autonomous error recovery attempts.';
  }

  private constructPrompt(): string {
    const toolSchemas = this.tools.map(tool => zodToJsonSchema(tool.definition.parameters, tool.definition.name));
    const toolDescriptions = this.tools.map(tool => ` - ${tool.definition.name}: ${tool.definition.description}`).join('\n');

    const systemPrompt = `You are a helpful AI assistant operating in a ReAct (Reasoning and Acting) framework. Your goal is to accomplish the user's request by thinking, selecting a tool, and observing the tool's output.

You have access to the following tools:
${toolDescriptions}

You must respond in the following JSON format:
${JSON.stringify(zodToJsonSchema(ThoughtSchema), null, 2)}

When you have the final answer, use the tool "final_answer" with the answer in the toolInput.answer field.

Examples:
{
  "thought": "I need to read the package.json file to understand the project structure",
  "tool": "readFile",
  "toolInput": { "path": "package.json" }
}

{
  "thought": "The user asked for help and I have gathered enough information to provide a complete answer",
  "tool": "final_answer", 
  "toolInput": { "answer": "Based on my analysis, here is the solution..." }
}

Previous conversation:
${this.agentContext.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current working directory: ${this.agentContext.workingDirectory}

Remember:
- Always think step by step in your "thought" field
- Choose the most appropriate tool for the task
- Use "final_answer" only when you have a complete response for the user
- Be specific and actionable in your responses`;

    return systemPrompt;
  }

  private parseResponse(response: string): Thought {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the structure
      if (!parsed.thought || !parsed.tool || !parsed.toolInput) {
        throw new Error('Invalid response structure');
      }

      return parsed as Thought;
    } catch (error) {
      logger.error('Failed to parse agent response:', error);
      logger.debug('Raw response:', response);
      
      // Fallback parsing attempt
      try {
        return this.fallbackParse(response);
      } catch (fallbackError) {
        throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private fallbackParse(response: string): Thought {
    // Simple pattern matching for common response patterns
    const thoughtMatch = response.match(/thought['":\s]+([^"'\n]+)/i);
    const toolMatch = response.match(/tool['":\s]+([^"'\s,\}]+)/i);
    
    if (thoughtMatch && toolMatch) {
      const tool = toolMatch[1].trim().replace(/['"]/g, '');
      let toolInput = {};
      
      // Try to extract path for file operations
      if (tool.includes('File') || tool.includes('list')) {
        const pathMatch = response.match(/path['":\s]+['"]*([^"'\s,\}\n]+)['"]*|path['":\s]*['"]*([^"'\n]+)['"]/i);
        if (pathMatch) {
          toolInput = { path: (pathMatch[1] || pathMatch[2] || '.').trim() };
        } else {
          toolInput = { path: '.' }; // Default to current directory
        }
      }
      
      return {
        thought: thoughtMatch[1].trim(),
        tool,
        toolInput
      };
    }
    
    throw new Error('Could not extract structured data from response');
  }

  /**
   * Analyze the type of task based on user input
   */
  private analyzeTaskType(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('code') || lowerInput.includes('function') || lowerInput.includes('implement') || lowerInput.includes('write')) {
      return 'coding';
    }
    
    if (lowerInput.includes('debug') || lowerInput.includes('fix') || lowerInput.includes('error') || lowerInput.includes('bug')) {
      return 'debugging';
    }
    
    if (lowerInput.includes('analyze') || lowerInput.includes('review') || lowerInput.includes('understand') || lowerInput.includes('explain')) {
      return 'analysis';
    }
    
    if (lowerInput.includes('plan') || lowerInput.includes('design') || lowerInput.includes('architecture') || lowerInput.includes('strategy')) {
      return 'planning';
    }
    
    if (lowerInput.includes('test') || lowerInput.includes('testing') || lowerInput.includes('spec')) {
      return 'testing';
    }
    
    return 'general';
  }

  /**
   * Assess the complexity of a task
   */
  private assessComplexity(input: string): 'simple' | 'medium' | 'complex' {
    const lowerInput = input.toLowerCase();
    
    // Simple task indicators
    if (lowerInput.includes('simple') || lowerInput.includes('basic') || lowerInput.includes('quick') || 
        lowerInput.length < 50 || lowerInput.split(' ').length < 10) {
      return 'simple';
    }
    
    // Complex task indicators
    if (lowerInput.includes('complex') || lowerInput.includes('advanced') || lowerInput.includes('comprehensive') ||
        lowerInput.includes('architecture') || lowerInput.includes('system') || lowerInput.includes('full') ||
        lowerInput.length > 200 || lowerInput.split(' ').length > 40) {
      return 'complex';
    }
    
    return 'medium';
  }

  /**
   * Get the timestamp of the last message for performance tracking
   */
  private getLastMessageTime(): number {
    if (this.agentContext.messages.length === 0) {
      return Date.now();
    }
    return this.agentContext.messages[this.agentContext.messages.length - 1].timestamp;
  }
} 