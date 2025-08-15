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

type WorkflowState = 'initial' | 'exploring' | 'analyzing' | 'diagnosing' | 'concluding' | 'completed';

interface ProgressMetrics {
  filesExplored: Set<string>;
  directoriesListed: Set<string>;
  toolsUsed: Set<string>;
  criticalFilesRead: number;
  issuesFound: string[];
  completionSignals: string[];
}

interface ReActAgentContext {
  workingDirectory: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  currentPlan?: string[];
  recentToolUsage: Array<{ tool: string; timestamp: number; input: any }>;
  lastFileList?: string[];
  conversationMode: 'exploration' | 'analysis' | 'direct_response';
  workflowState: WorkflowState;
  progressMetrics: ProgressMetrics;
  maxIterations: number;
  currentIteration: number;
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
      recentToolUsage: [],
      conversationMode: 'exploration',
      workflowState: 'initial',
      progressMetrics: {
        filesExplored: new Set(),
        directoriesListed: new Set(),
        toolsUsed: new Set(),
        criticalFilesRead: 0,
        issuesFound: [],
        completionSignals: []
      },
      maxIterations: 15, // Increased from 8
      currentIteration: 0
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
    this.agentContext.recentToolUsage = [];
    this.agentContext.lastFileList = undefined;
    this.agentContext.conversationMode = 'exploration';
    this.agentContext.workflowState = 'initial';
    this.agentContext.progressMetrics = {
      filesExplored: new Set(),
      directoriesListed: new Set(),
      toolsUsed: new Set(),
      criticalFilesRead: 0,
      issuesFound: [],
      completionSignals: []
    };
    this.agentContext.currentIteration = 0;
  }

  async processRequest(input: string): Promise<string> {
    this.agentContext.messages.push({ role: 'user', content: input, timestamp: Date.now() });

    // Check if conversation history needs rotation
    if (this.agentContext.messages.length > 30) {
      await this.rotateConversationHistory();
    }

    // Handle state reset command
    if (input.toLowerCase().trim() === '/reset' || input.toLowerCase().trim() === '/clear') {
      return this.handleStateReset();
    }

    // Analyze intent and conversation mode
    const intentAnalysis = this.analyzeUserIntent(input);
    this.agentContext.conversationMode = intentAnalysis.mode;
    
    // Check if this can be answered directly without tools
    if (intentAnalysis.canAnswerDirectly) {
      return this.generateDirectResponse(input, intentAnalysis);
    }

    // Use intelligent model selection for this task
    const taskType = this.analyzeTaskType(input);
    const optimalModel = await this.modelSelector.selectOptimalModel(taskType, {
      complexity: this.assessComplexity(input),
      speed: 'medium',
      accuracy: 'high'
    });

    logger.info(`🧠 Selected optimal model: ${optimalModel} for task type: ${taskType}`);

    for (let i = 0; i < this.agentContext.maxIterations; i++) {
      this.agentContext.currentIteration = i;
      
      // Check if we should conclude based on progress
      if (this.shouldConcludeBasedOnProgress()) {
        logger.info(`🎯 Agent concluding after ${i} iterations based on progress signals`);
        const conclusion = this.generateProgressBasedConclusion();
        this.agentContext.messages.push({ role: 'assistant', content: conclusion, timestamp: Date.now() });
        return conclusion;
      }
      try {
        const prompt = this.constructPrompt();
        const validToolNames = [...this.tools.map(t => t.definition.name), 'final_answer'];
        const thoughtSchema = {
          type: "object",
          properties: {
            thought: {
              type: "string",
              description: "Your reasoning and plan for the next action."
            },
            tool: {
              type: "string",
              enum: validToolNames,
              description: "The name of the tool to use from the available tools."
            },
            toolInput: {
              type: "object",
              description: "The input parameters for the tool."
            }
          },
          required: ["thought", "tool", "toolInput"]
        };
        // Try without structured output first to debug
        const response = await this.model.generate(prompt);
        logger.info(`Agent iteration ${i + 1} - Raw response: ${response.slice(0, 300)}...`);
        
        try {
          const thought = this.parseResponse(response);
          
          if (thought.tool === 'final_answer') {
            let finalAnswer = thought.toolInput.answer as string;
            
            // If empty answer, generate one based on gathered information
            if (!finalAnswer || finalAnswer.trim() === '') {
              logger.warn('Final answer is empty, generating summary from conversation');
              finalAnswer = this.generateAnswerFromContext();
            }
            
            this.agentContext.messages.push({ role: 'assistant', content: finalAnswer, timestamp: Date.now() });
            
            // Record successful completion
            this.modelSelector.recordPerformance(optimalModel, taskType, true, Date.now() - this.getLastMessageTime(), 1.0);
            
            return finalAnswer;
          }

          const tool = this.tools.find(t => t.definition.name === thought.tool);
          if (!tool) {
            // Log available tool names for debugging
            const availableTools = this.tools.map(t => t.definition.name).join(', ');
            logger.error(`Unknown tool: ${thought.tool}. Available tools: ${availableTools}`);
            
            // Try to suggest the correct tool
            const suggestedTool = this.suggestCorrectTool(thought.tool);
            if (suggestedTool) {
              const errorMessage = `Unknown tool "${thought.tool}". Did you mean "${suggestedTool}"? Available tools: ${availableTools}`;
              this.agentContext.messages.push({ role: 'tool', content: JSON.stringify({ error: errorMessage }), timestamp: Date.now() });
              continue;
            }
            
            throw new Error(`Unknown tool: ${thought.tool}. Available tools: ${availableTools}`);
          }

          // Track tool usage to prevent loops
          this.trackToolUsage(thought.tool, thought.toolInput);
          
          // Update progress metrics
          this.updateProgressMetrics(thought.tool, thought.toolInput);
          
          // Check for repetitive tool usage with enhanced logic
          if (this.isRepetitiveToolUsage(thought.tool, thought.toolInput)) {
            logger.warn(`Preventing repetitive tool usage: ${thought.tool}`);
            
            // If we have enough progress, conclude
            if (this.hasMinimumProgress()) {
              const conclusion = this.generateProgressBasedConclusion();
              this.agentContext.messages.push({ role: 'assistant', content: conclusion, timestamp: Date.now() });
              return conclusion;
            } else {
              // Force tool diversification
              const diversificationMessage = this.suggestToolDiversification(thought.tool);
              this.agentContext.messages.push({ role: 'tool', content: JSON.stringify({ warning: diversificationMessage }), timestamp: Date.now() });
              continue;
            }
          }

          this.agentContext.messages.push({ role: 'assistant', content: JSON.stringify(thought), timestamp: Date.now() });
          
          const observation = await tool.execute(thought.toolInput);
          this.agentContext.messages.push({ role: 'tool', content: JSON.stringify(observation), timestamp: Date.now() });
          
          // Store file list results for context
          if (thought.tool === 'listFiles' && Array.isArray(observation)) {
            this.agentContext.lastFileList = observation.slice(0, 20); // Store first 20 files
          }

        } catch (parseError) {
          logger.error('Error parsing agent response:', parseError);
          logger.debug('Raw model response:', response);
          const errorMessage = parseError instanceof Error ? parseError.message : 'Failed to parse response';
          this.agentContext.messages.push({ role: 'tool', content: JSON.stringify({ error: errorMessage, rawResponse: response.slice(0, 200) }), timestamp: Date.now() });
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

    // Force final answer if we've exhausted iterations
    logger.warn(`Agent reached maximum iterations (${this.agentContext.maxIterations}), forcing comprehensive final answer`);
    const forcedAnswer = this.generateComprehensiveFinalAnswer();
    this.agentContext.messages.push({ role: 'assistant', content: forcedAnswer, timestamp: Date.now() });
    return forcedAnswer;
  }

  /**
   * Update progress metrics based on tool usage
   */
  private updateProgressMetrics(toolName: string, toolInput: any): void {
    const metrics = this.agentContext.progressMetrics;
    
    metrics.toolsUsed.add(toolName);
    
    if (toolName === 'listFiles') {
      const path = toolInput?.path || '.';
      metrics.directoriesListed.add(path);
      
      // Update workflow state
      if (this.agentContext.workflowState === 'initial') {
        this.agentContext.workflowState = 'exploring';
      }
    }
    
    if (toolName === 'readFile') {
      const filePath = toolInput?.path;
      if (filePath) {
        metrics.filesExplored.add(filePath);
        
        // Check if this is a critical file
        if (this.isCriticalFile(filePath)) {
          metrics.criticalFilesRead++;
        }
        
        // Update workflow state
        if (this.agentContext.workflowState === 'exploring') {
          this.agentContext.workflowState = 'analyzing';
        }
      }
    }
    
    if (toolName === 'lintCode' || toolName === 'getAst') {
      if (this.agentContext.workflowState === 'analyzing') {
        this.agentContext.workflowState = 'diagnosing';
      }
    }
    
    if (toolName === 'gitStatus' || toolName === 'gitDiff') {
      metrics.completionSignals.push('git_analysis_complete');
    }
  }

  /**
   * Check if a file is considered critical for analysis
   */
  private isCriticalFile(filePath: string): boolean {
    const criticalPatterns = [
      'package.json', 'tsconfig.json', '.eslintrc', 'README',
      /src\/.*\.(ts|js|tsx|jsx)$/, /\.config\.(ts|js)$/,
      /index\.(ts|js)$/, /main\.(ts|js)$/
    ];
    
    return criticalPatterns.some(pattern => 
      typeof pattern === 'string' ? filePath.includes(pattern) : pattern.test(filePath)
    );
  }

  /**
   * Check if agent should conclude based on progress
   */
  private shouldConcludeBasedOnProgress(): boolean {
    const metrics = this.agentContext.progressMetrics;
    
    // Conclude if we have comprehensive coverage
    const hasExploredStructure = metrics.directoriesListed.size >= 2;
    const hasReadCriticalFiles = metrics.criticalFilesRead >= 3;
    const hasUsedDiverseTools = metrics.toolsUsed.size >= 4;
    const hasReachedDiagnosing = this.agentContext.workflowState === 'diagnosing';
    
    // Or if we've made significant progress and are approaching iteration limit
    const approachingLimit = this.agentContext.currentIteration >= (this.agentContext.maxIterations * 0.7);
    const hasMinimalProgress = this.hasMinimumProgress();
    
    return (hasExploredStructure && hasReadCriticalFiles && hasUsedDiverseTools) ||
           (hasReachedDiagnosing && hasReadCriticalFiles) ||
           (approachingLimit && hasMinimalProgress);
  }

  /**
   * Check if we have minimum progress to provide a meaningful answer
   */
  private hasMinimumProgress(): boolean {
    const metrics = this.agentContext.progressMetrics;
    return metrics.directoriesListed.size >= 1 && 
           metrics.filesExplored.size >= 2 && 
           metrics.toolsUsed.size >= 3;
  }

  /**
   * Generate conclusion based on current progress
   */
  private generateProgressBasedConclusion(): string {
    const metrics = this.agentContext.progressMetrics;
    
    let conclusion = "## CodeBase Analysis Summary\n\n";
    
    // Project structure analysis
    conclusion += `**Project Structure**: Analyzed ${metrics.directoriesListed.size} directories and explored ${metrics.filesExplored.size} files.\n\n`;
    
    // Critical files analyzed
    if (metrics.criticalFilesRead > 0) {
      conclusion += `**Critical Files Reviewed**: ${metrics.criticalFilesRead} important configuration and source files examined.\n\n`;
    }
    
    // Tools used
    conclusion += `**Analysis Tools Used**: ${Array.from(metrics.toolsUsed).join(', ')}\n\n`;
    
    // Workflow state
    conclusion += `**Analysis Stage**: ${this.getWorkflowStateDescription()}\n\n`;
    
    // Issues found (extract from conversation)
    const issues = this.extractIssuesFromConversation();
    if (issues.length > 0) {
      conclusion += `**Issues Identified**:\n${issues.map(issue => `- ${issue}`).join('\n')}\n\n`;
    }
    
    // Recommendations
    conclusion += this.generateRecommendations();
    
    return conclusion;
  }

  /**
   * Generate comprehensive final answer when max iterations reached
   */
  private generateComprehensiveFinalAnswer(): string {
    const metrics = this.agentContext.progressMetrics;
    
    let answer = "## Comprehensive CodeBase Analysis (Max Iterations Reached)\n\n";
    
    answer += `After ${this.agentContext.currentIteration} iterations of systematic analysis:\n\n`;
    
    // Progress summary
    answer += `**Analysis Coverage**:\n`;
    answer += `- Directories explored: ${metrics.directoriesListed.size}\n`;
    answer += `- Files examined: ${metrics.filesExplored.size}\n`;
    answer += `- Critical files analyzed: ${metrics.criticalFilesRead}\n`;
    answer += `- Analysis tools utilized: ${Array.from(metrics.toolsUsed).join(', ')}\n\n`;
    
    // Current state
    answer += `**Current Analysis State**: ${this.getWorkflowStateDescription()}\n\n`;
    
    // Issues and findings
    const issues = this.extractIssuesFromConversation();
    if (issues.length > 0) {
      answer += `**Issues and Findings**:\n${issues.map(issue => `- ${issue}`).join('\n')}\n\n`;
    } else {
      answer += `**Status**: No critical issues detected in the analyzed portions of the codebase.\n\n`;
    }
    
    // Limitations and next steps
    answer += `**Analysis Limitations**: Due to iteration limits, this analysis may be incomplete. For a more thorough review, consider:\n`;
    answer += `- Running additional specific file analyses\n`;
    answer += `- Performing targeted linting on source files\n`;
    answer += `- Checking AST structure of complex components\n\n`;
    
    answer += this.generateRecommendations();
    
    return answer;
  }

  /**
   * Get human-readable workflow state description
   */
  private getWorkflowStateDescription(): string {
    const stateDescriptions = {
      'initial': 'Starting analysis',
      'exploring': 'Exploring project structure',
      'analyzing': 'Analyzing source files and configurations',
      'diagnosing': 'Diagnosing code quality and issues',
      'concluding': 'Finalizing analysis',
      'completed': 'Analysis complete'
    };
    return stateDescriptions[this.agentContext.workflowState] || 'Unknown state';
  }

  /**
   * Extract issues from conversation history
   */
  private extractIssuesFromConversation(): string[] {
    const issues: string[] = [];
    
    // Look for error patterns in tool results
    const toolMessages = this.agentContext.messages.filter(m => m.role === 'tool');
    
    for (const message of toolMessages) {
      try {
        const content = JSON.parse(message.content);
        if (content.error) {
          issues.push(`Tool error: ${content.error}`);
        }
        if (content.lintErrors && Array.isArray(content.lintErrors)) {
          issues.push(`Linting issues found: ${content.lintErrors.length} errors`);
        }
      } catch {
        // If message content contains obvious error indicators
        if (message.content.toLowerCase().includes('error') || 
            message.content.toLowerCase().includes('fail')) {
          issues.push('Analysis detected potential issues');
        }
      }
    }
    
    return issues;
  }

  /**
   * Generate recommendations based on current analysis
   */
  private generateRecommendations(): string {
    const metrics = this.agentContext.progressMetrics;
    let recommendations = "**Recommendations**:\n";
    
    if (metrics.criticalFilesRead < 3) {
      recommendations += "- Review critical configuration files (package.json, tsconfig.json, etc.)\n";
    }
    
    if (!metrics.toolsUsed.has('lintCode')) {
      recommendations += "- Run linting analysis on source files to check code quality\n";
    }
    
    if (!metrics.toolsUsed.has('gitStatus')) {
      recommendations += "- Check git status for uncommitted changes and repository health\n";
    }
    
    if (metrics.filesExplored.size < 5) {
      recommendations += "- Examine more source files for comprehensive analysis\n";
    }
    
    recommendations += "- Consider running automated tests if available\n";
    recommendations += "- Review dependencies for security vulnerabilities\n";
    
    return recommendations;
  }

  /**
   * Suggest tool diversification when repetitive usage detected
   */
  private suggestToolDiversification(repeatedTool: string): string {
    const suggestions: Record<string, string> = {
      'listFiles': 'Try reading specific files with readFile, or check git status',
      'readFile': 'Consider running linting analysis or checking AST structure',
      'gitStatus': 'Try reading configuration files or analyzing source code',
      'lintCode': 'Consider checking git status or reading other source files',
      'getAst': 'Try running linting or reading related files'
    };
    
    return suggestions[repeatedTool] || 'Try using different tools to gather more comprehensive information';
  }

  /**
   * Build exploration context to guide progressive tool usage
   */
  private buildExplorationContext(): string {
    const metrics = this.agentContext.progressMetrics;
    const iteration = this.agentContext.currentIteration;
    const maxIterations = this.agentContext.maxIterations;
    
    let progressContext = "Current exploration progress:\\n";
    
    // Progress summary
    progressContext += `- Iteration: ${iteration}/${maxIterations}\\n`;
    progressContext += `- Workflow State: ${this.getWorkflowStateDescription()}\\n`;
    progressContext += `- Tools used: ${Array.from(metrics.toolsUsed).join(', ') || 'none'}\\n`;
    progressContext += `- Directories explored: ${metrics.directoriesListed.size}\\n`;
    progressContext += `- Files examined: ${metrics.filesExplored.size}\\n`;
    progressContext += `- Critical files read: ${metrics.criticalFilesRead}\\n`;
    
    // Guidance based on state and progress
    if (metrics.toolsUsed.size === 0) {
      progressContext += "- NEXT: Start with listFiles to understand project structure\\n";
    } else if (this.agentContext.workflowState === 'exploring') {
      if (metrics.criticalFilesRead < 2) {
        progressContext += "- NEXT: Read critical files (package.json, tsconfig.json, main source files)\\n";
      } else {
        progressContext += "- NEXT: Check git status or run analysis tools\\n";
      }
    } else if (this.agentContext.workflowState === 'analyzing') {
      if (!metrics.toolsUsed.has('gitStatus')) {
        progressContext += "- NEXT: Check git status for repository health\\n";
      } else if (!metrics.toolsUsed.has('lintCode')) {
        progressContext += "- NEXT: Run linting on source files for code quality\\n";
      } else {
        progressContext += "- NEXT: Consider AST analysis or provide final analysis\\n";
      }
    } else if (this.agentContext.workflowState === 'diagnosing') {
      progressContext += "- NEXT: Complete analysis and provide comprehensive final_answer\\n";
    }
    
    // Warning if approaching limits
    if (iteration >= maxIterations * 0.8) {
      progressContext += "- ⚠️  WARNING: Approaching iteration limit - consider concluding analysis\\n";
    }
    
    return progressContext;
  }

  private constructPrompt(): string {
    const toolSchemas = this.tools.map(tool => zodToJsonSchema(tool.definition.parameters, tool.definition.name));
    const toolDescriptions = this.tools.map(tool => ` - ${tool.definition.name}: ${tool.definition.description}`).join('\n');

    const validTools = this.tools.map(t => t.definition.name).join(', ');
    
    // Build progressive context from previous actions
    const explorationProgress = this.buildExplorationContext();
    
    const systemPrompt = `You are a helpful AI assistant operating in a ReAct (Reasoning and Acting) framework. Your goal is to accomplish the user's request by thinking, selecting a tool, and observing the tool's output.

Available tools (MUST use these exact names):
${toolDescriptions}

CRITICAL: You can ONLY use these exact tool names: ${validTools}, final_answer

You MUST respond with a valid JSON object in this exact format:
{
  "thought": "Your reasoning and plan for the next action",
  "tool": "exact_tool_name_from_list_above", 
  "toolInput": { "parameter": "value" }
}

PROGRESSIVE EXPLORATION STRATEGY:
${explorationProgress}

TOOL USAGE EXAMPLES:
- To read files: {"tool": "readFile", "toolInput": {"path": "package.json"}}
- To list files: {"tool": "listFiles", "toolInput": {"path": "."}}
- To check git: {"tool": "gitStatus", "toolInput": {}}
- To analyze code: {"tool": "getAst", "toolInput": {"filePath": "src/main.ts"}}
- To check linting: {"tool": "lintCode", "toolInput": {"filePath": "src/main.ts"}}
- When finished: {"tool": "final_answer", "toolInput": {"answer": "Your complete response"}}

Previous conversation:
${this.agentContext.messages.slice(-15).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Working directory: ${this.agentContext.workingDirectory}

REQUIREMENTS:
- Use ONLY the exact tool names listed above
- Always provide valid JSON
- Think step by step and BUILD UPON previous discoveries
- Progress systematically: explore → analyze → diagnose → conclude
- Use "final_answer" when you have thoroughly analyzed the codebase
- When using "final_answer", provide a complete, helpful answer in the "answer" field
- DIVERSIFY your tool usage - don't repeat the same tool unnecessarily
- Read actual file contents to find specific errors and issues
- NEVER use empty answers - always summarize what you found

FINAL ANSWER EXAMPLE:
{"tool": "final_answer", "toolInput": {"answer": "Based on my comprehensive analysis, I found 3 critical issues: 1) TypeScript compilation errors in src/main.ts (line 45: undefined variable), 2) ESLint violations in 5 files, 3) Missing dependencies in package.json. The project structure is well-organized with 45 files, but needs these fixes for proper functionality."}`;

    return systemPrompt;
  }

  private parseResponse(response: string): Thought {
    try {
      // With structured output, response should be valid JSON directly
      let parsed;
      
      // Handle case where response is already an object
      if (typeof response === 'object' && response !== null) {
        parsed = response;
      } else {
        // Try direct parsing first (structured output case)
        try {
          parsed = JSON.parse(response);
        } catch {
          // Fallback: extract JSON from the response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in response');
          }
          parsed = JSON.parse(jsonMatch[0]);
        }
      }
      
      // Handle missing thought field by extracting from text before JSON
      if (!parsed.thought && parsed.tool && parsed.toolInput) {
        const textBeforeJson = response.split(/\{/)[0].trim();
        if (textBeforeJson) {
          parsed.thought = textBeforeJson.replace(/\n+/g, ' ').trim();
          logger.info('Extracted thought from text before JSON:', parsed.thought);
        } else {
          parsed.thought = `Using ${parsed.tool} tool`;
        }
      }
      
      // Validate the structure
      if (!parsed.thought || !parsed.tool || !parsed.toolInput) {
        throw new Error('Invalid response structure - missing required fields');
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
    // First try to extract JSON and thought from mixed response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool && parsed.toolInput) {
          // Extract thought from text before JSON if missing
          let thought = parsed.thought;
          if (!thought) {
            const textBeforeJson = response.split(/\{/)[0].trim();
            thought = textBeforeJson || `Using ${parsed.tool} tool`;
          }
          return {
            thought,
            tool: parsed.tool,
            toolInput: parsed.toolInput
          };
        }
      } catch (e) {
        // Continue to regex parsing
      }
    }
    
    // Simple pattern matching for common response patterns
    const thoughtMatch = response.match(/thought['":\s]*["']?([^"'\n}]+)["']?/i);
    const toolMatch = response.match(/tool['":\s]*["']?([^"'\s,\}]+)["']?/i);
    
    if (thoughtMatch && toolMatch) {
      let tool = toolMatch[1].trim().replace(/['"]/g, '');
      let toolInput = {};
      
      // Map common tool variations to correct names
      const toolMappings: Record<string, string> = {
        'read_file': 'readFile',
        'read': 'readFile',
        'list_files': 'listFiles',
        'list': 'listFiles',
        'write_file': 'writeFile', 
        'write': 'writeFile',
        'git_status': 'gitStatus',
        'final': 'final_answer',
        'answer': 'final_answer',
        'done': 'final_answer'
      };
      
      tool = toolMappings[tool.toLowerCase()] || tool;
      
      // Try to extract common parameters
      if (tool === 'readFile' || tool === 'writeFile' || tool === 'listFiles') {
        const pathMatch = response.match(/path['":\s]*["']?([^"'\s,\}\n]+)["']?/i);
        if (pathMatch) {
          toolInput = { path: pathMatch[1].trim().replace(/['"]/g, '') };
        } else {
          toolInput = { path: '.' };
        }
        
        // For writeFile, also try to extract content
        if (tool === 'writeFile') {
          const contentMatch = response.match(/content['":\s]*["']?([^"']+)["']?/i);
          if (contentMatch) {
            (toolInput as any).content = contentMatch[1].trim();
          }
        }
      } else if (tool === 'final_answer') {
        const answerMatch = response.match(/answer['":\s]*["']?([^"'}]+)["']?/i);
        if (answerMatch) {
          toolInput = { answer: answerMatch[1].trim() };
        } else {
          // Use the whole response as the answer
          toolInput = { answer: response.trim() };
        }
      } else {
        toolInput = {};
      }
      
      return {
        thought: thoughtMatch[1].trim(),
        tool,
        toolInput
      };
    }
    
    // If no structured data found, extract thought from beginning of response
    const lines = response.split('\n').filter(line => line.trim());
    const thought = lines.length > 0 ? lines[0].trim() : "I'll provide a direct response based on the available information";
    
    return {
      thought,
      tool: "final_answer",
      toolInput: { answer: response.trim() }
    };
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

  /**
   * Generate answer from conversation context when final_answer is empty
   */
  private generateAnswerFromContext(): string {
    const userMessages = this.agentContext.messages.filter(m => m.role === 'user');
    const toolResults = this.agentContext.messages.filter(m => m.role === 'tool');
    
    if (userMessages.length === 0) {
      return "I'm ready to help with your coding tasks. Please let me know what you'd like me to do.";
    }
    
    const lastUserMessage = userMessages[userMessages.length - 1].content;
    
    // Extract useful information from tool results
    const relevantInfo: string[] = [];
    
    for (const result of toolResults.slice(-10)) { // Last 10 tool results with expanded context
      try {
        const parsed = JSON.parse(result.content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // File list result
          relevantInfo.push(`Files found: ${parsed.slice(0, 10).join(', ')}${parsed.length > 10 ? ` and ${parsed.length - 10} more` : ''}`);
        } else if (parsed.fileName) {
          // AST result
          relevantInfo.push(`Analyzed file: ${parsed.fileName}`);
        } else if (parsed.staged !== undefined || parsed.modified !== undefined) {
          // Git status result
          relevantInfo.push(`Git status: ${JSON.stringify(parsed)}`);
        }
      } catch {
        // Skip unparseable results
      }
    }
    
    // Generate contextual response
    if (lastUserMessage.toLowerCase().includes('files') || lastUserMessage.toLowerCase().includes('project')) {
      const fileInfo = relevantInfo.find(info => info.includes('Files found'));
      if (fileInfo) {
        return `Based on my analysis, this project contains the following files:\n\n${fileInfo}\n\nThis appears to be a TypeScript/Node.js project with various configuration files, source code, and build outputs.`;
      }
    }
    
    if (relevantInfo.length > 0) {
      return `Based on my analysis:\n\n${relevantInfo.join('\n')}\n\nIs there anything specific you'd like me to help you with regarding this project?`;
    }
    
    return `I've analyzed your request: "${lastUserMessage}"\n\nHowever, I need more specific information to provide a complete answer. Could you please clarify what specific aspect you'd like me to help with?`;
  }

  /**
   * Suggest the correct tool name based on fuzzy matching
   */
  private suggestCorrectTool(invalidTool: string): string | null {
    const toolNames = this.tools.map(t => t.definition.name);
    const lowerInvalid = invalidTool.toLowerCase();
    
    // Direct substring matches
    for (const toolName of toolNames) {
      if (toolName.toLowerCase().includes(lowerInvalid) || lowerInvalid.includes(toolName.toLowerCase())) {
        return toolName;
      }
    }
    
    // Common mappings
    const mappings: Record<string, string> = {
      'read': 'readFile',
      'write': 'writeFile', 
      'list': 'listFiles',
      'dir': 'listFiles',
      'files': 'listFiles',
      'git': 'gitStatus',
      'status': 'gitStatus',
      'diff': 'gitDiff',
      'lint': 'lintCode',
      'ast': 'getAst',
      'final': 'final_answer',
      'answer': 'final_answer',
      'done': 'final_answer'
    };
    
    for (const [key, value] of Object.entries(mappings)) {
      if (lowerInvalid.includes(key)) {
        return value;
      }
    }
    for (const [key, value] of Object.entries(mappings)) {
      if (lowerInvalid.includes(key)) {
        return value;
      }
    }
    
    return null;
  }

  /**
   * Analyze user intent to determine conversation mode and response strategy
   */
  private analyzeUserIntent(input: string): {
    mode: 'exploration' | 'analysis' | 'direct_response';
    canAnswerDirectly: boolean;
    needsFileInfo: boolean;
    needsCodeAnalysis: boolean;
  } {
    const lowerInput = input.toLowerCase().trim();
    
    // Conversational/opinion questions that should be answered directly
    const conversationalPatterns = [
      /^(hi|hello|hey)$/,
      /what.*think.*it/,
      /what.*opinion/,
      /how.*feel/,
      /thoughts.*on/,
      /what.*about.*this/,
      /is.*good/,
      /is.*bad/,
      /like.*it/,
      /your.*view/
    ];
    
    const isConversational = conversationalPatterns.some(pattern => pattern.test(lowerInput));
    
    // Questions that require file information
    const fileInfoPatterns = [
      /list.*files/,
      /what.*files/,
      /show.*files/,
      /file.*structure/,
      /project.*structure/
    ];
    
    const needsFileInfo = fileInfoPatterns.some(pattern => pattern.test(lowerInput));
    
    // Questions that need code analysis
    const codeAnalysisPatterns = [
      /analyze.*code/,
      /review.*code/,
      /check.*code/,
      /find.*bug/,
      /lint/,
      /ast/
    ];
    
    const needsCodeAnalysis = codeAnalysisPatterns.some(pattern => pattern.test(lowerInput));
    
    // Determine if we can answer directly
    const canAnswerDirectly = isConversational || 
      (this.agentContext.lastFileList && (lowerInput.includes('think') || lowerInput.includes('opinion')));
    
    let mode: 'exploration' | 'analysis' | 'direct_response' = 'exploration';
    if (needsCodeAnalysis) mode = 'analysis';
    else if (canAnswerDirectly) mode = 'direct_response';
    
    return {
      mode,
      canAnswerDirectly: canAnswerDirectly || false,
      needsFileInfo,
      needsCodeAnalysis
    };
  }

  /**
   * Generate direct response without using tools
   */
  private async generateDirectResponse(input: string, analysis: any): Promise<string> {
    const lowerInput = input.toLowerCase();
    
    // Handle greetings
    if (lowerInput.match(/^(hi|hello|hey)$/)) {
      return "Hello! I'm here to help you with your coding project. I can analyze code, read files, check git status, and much more. What would you like me to help you with?";
    }
    
    // Handle opinion/analysis questions when we have context
    if (lowerInput.includes('think') || lowerInput.includes('opinion')) {
      if (this.agentContext.lastFileList) {
        return this.generateProjectOpinion();
      } else {
        // Need to get file info first, but do it efficiently
        return "Let me analyze your project structure first, then I'll share my thoughts.";
      }
    }
    
    // Use the model to generate a contextual response
    const contextualPrompt = `Based on our conversation history, provide a helpful response to: "${input}"
    
Conversation context:
${this.agentContext.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

Provide a direct, helpful response without using any tools.`;
    
    try {
      const response = await this.model.generate(contextualPrompt);
      this.agentContext.messages.push({ role: 'assistant', content: response, timestamp: Date.now() });
      return response;
    } catch (error) {
      return "I understand you're asking about the project. Let me help you with that. Could you be more specific about what aspect you'd like me to focus on?";
    }
  }

  /**
   * Generate opinion about the project based on current context
   */
  private generateProjectOpinion(): string {
    const fileCount = this.agentContext.lastFileList?.length || 0;
    const hasTypeScript = this.agentContext.lastFileList?.some(f => f.includes('.ts')) || false;
    const hasConfig = this.agentContext.lastFileList?.some(f => f.includes('config') || f.includes('.json')) || false;
    
    let opinion = "Based on my analysis of this project:\n\n";
    
    if (fileCount > 50) {
      opinion += `📈 This is a substantial project with ${fileCount}+ files, indicating a mature codebase.\n`;
    } else if (fileCount > 20) {
      opinion += "📊 This is a medium-sized project with good structure.\n";
    } else {
      opinion += "📝 This appears to be a focused, well-scoped project.\n";
    }
    
    if (hasTypeScript) {
      opinion += "⚡ Uses TypeScript, which is excellent for code quality and maintainability.\n";
    }
    
    if (hasConfig) {
      opinion += "⚙️ Has proper configuration files, showing good project setup.\n";
    }
    
    opinion += "\nThe project structure looks well-organized. Is there a specific aspect you'd like me to analyze in more detail?";
    
    return opinion;
  }

  /**
   * Track tool usage to prevent loops
   */
  private trackToolUsage(toolName: string, toolInput: any): void {
    const now = Date.now();
    this.agentContext.recentToolUsage.push({
      tool: toolName,
      timestamp: now,
      input: toolInput
    });
    
    // Keep only last 10 tool usages
    if (this.agentContext.recentToolUsage.length > 10) {
      this.agentContext.recentToolUsage.shift();
    }
  }

  /**
   * Check if tool usage is repetitive (enhanced with progression awareness)
   */
  private isRepetitiveToolUsage(toolName: string, toolInput: any): boolean {
    const recentUsage = this.agentContext.recentToolUsage;
    const now = Date.now();
    
    // Don't block progressive exploration - allow different paths/files
    const exactSameUsage = recentUsage.filter(usage => 
      usage.tool === toolName && 
      (now - usage.timestamp) < 300000 && // 5 minutes
      JSON.stringify(usage.input) === JSON.stringify(toolInput)
    );
    
    // Only block if EXACT same tool with EXACT same input used more than 2 times
    if (exactSameUsage.length >= 2) {
      return true;
    }
    
    // Special case: Allow multiple listFiles if exploring different directories
    if (toolName === 'listFiles') {
      const samePathUsage = recentUsage.filter(usage => 
        usage.tool === 'listFiles' && 
        usage.input?.path === toolInput?.path &&
        (now - usage.timestamp) < 180000 // 3 minutes
      );
      return samePathUsage.length >= 3; // Allow up to 3 times per path
    }
    
    // For readFile, allow reading different files
    if (toolName === 'readFile') {
      const sameFileUsage = recentUsage.filter(usage => 
        usage.tool === 'readFile' && 
        usage.input?.path === toolInput?.path &&
        (now - usage.timestamp) < 300000 // 5 minutes
      );
      return sameFileUsage.length >= 2; // Allow reading same file twice max
    }
    
    return false;
  }
  /**
   * Rotate conversation history when it gets too long
   */
  private async rotateConversationHistory(): Promise<void> {
    try {
      // Keep the most recent 10 messages
      const recentMessages = this.agentContext.messages.slice(-10);
      
      // Summarize the older conversation
      const olderMessages = this.agentContext.messages.slice(0, -10);
      if (olderMessages.length > 0) {
        const conversationSummary = await this.summarizeConversation(olderMessages);
        
        // Replace old messages with summary
        this.agentContext.messages = [
          { 
            role: 'system', 
            content: `Previous conversation summary: ${conversationSummary}`, 
            timestamp: Date.now() 
          },
          ...recentMessages
        ];
        
        logger.info(`📝 Rotated conversation history: ${olderMessages.length} messages summarized`);
      }
    } catch (error) {
      logger.warn('Failed to rotate conversation history:', error);
      // Fallback: just keep recent messages
      this.agentContext.messages = this.agentContext.messages.slice(-15);
    }
  }

  /**
   * Summarize conversation for history rotation
   */
  private async summarizeConversation(messages: Array<{ role: string; content: string }>): Promise<string> {
    try {
      const conversationText = messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');
      
      const summaryPrompt = `Summarize the following conversation in 2-3 sentences, focusing on the main topics discussed and any important context:\n\n${conversationText}`;
      
      const summary = await this.model.generate(summaryPrompt);
      return summary.trim();
    } catch (error) {
      // Fallback summary
      const userMessages = messages.filter(m => m.role === 'user');
      const topics = userMessages.map(m => m.content.slice(0, 50)).join(', ');
      return `Previous conversation covered: ${topics}`;
    }
  }

  /**
   * Handle state reset command
   */
  private handleStateReset(): string {
    const messageCount = this.agentContext.messages.length;
    const toolCount = this.agentContext.recentToolUsage.length;
    
    // Reset all agent state
    this.agentContext.messages = [];
    this.agentContext.recentToolUsage = [];
    this.agentContext.lastFileList = undefined;
    this.agentContext.conversationMode = 'exploration';
    this.agentContext.currentPlan = undefined;
    
    logger.info('🔄 Agent state reset by user command');
    
    return `🔄 **Agent State Reset**\n\nCleared:\n- ${messageCount} conversation messages\n- ${toolCount} recent tool usage records\n- Cached file listings\n- Current context and plans\n\nReady for a fresh start! How can I help you?`;
  }
}
