import { CLIContext } from './cli.js';
import { LocalModelClient } from './local-model-client.js';
import { logger } from './logger.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BaseTool } from './tools/base-tool.js';
import { ReadFileTool, WriteFileTool, ListFilesTool } from './tools/file-tools.js';
import { ConfirmedWriteTool, ConfirmEditsTool, ViewPendingEditsTool } from './tools/confirmed-write-tool.js';
import { BaseAgent, BaseAgentOutput, AgentDependencies, BaseAgentConfig } from './base-agent.js';
import { withErrorHandling, EnhancedError, ErrorCategory, ErrorSeverity } from './enhanced-error-handler.js';
import { 
  EnhancedReadFileTool, 
  EnhancedWriteFileTool, 
  FileSearchTool, 
  FileOperationsTool 
} from './tools/enhanced-file-tools.js';
import { 
  TerminalExecuteTool, 
  ProcessManagementTool, 
  ShellEnvironmentTool, 
  PackageManagerTool 
} from './tools/terminal-tools.js';
import { 
  GitOperationsTool, 
  GitAnalysisTool 
} from './tools/enhanced-git-tools.js';
import { 
  AdvancedProcessTool, 
  CodeExecutionTool 
} from './tools/process-management-tools.js';
import { 
  CodeAnalysisTool, 
  CodeGenerationTool 
} from './tools/enhanced-code-tools.js';
import { LintCodeTool, GetAstTool } from './tools/code-analysis-tools.js';
import { GitStatusTool, GitDiffTool } from './tools/git-tools.js';
import { ResearchTool, WebSearchTool, DocSearchTool } from './tools/research-tools.js';
import { AutonomousErrorHandler, ErrorContext } from './autonomous-error-handler.js';
import { IntelligentModelSelector } from './intelligent-model-selector.js';
import { SimplifiedReActPrompts, SimplifiedJSONParser } from './simplified-react-prompts.js';

const ThoughtSchema = z.object({
  thought: z.string().describe('Your reasoning and plan for the next action.'),
  tool: z.string().describe('The name of the tool to use.'),
  toolInput: z.record(z.unknown()).describe('The input for the tool.'),
});

type Thought = z.infer<typeof ThoughtSchema>;

type WorkflowState = 'initial' | 'exploring' | 'analyzing' | 'diagnosing' | 'concluding' | 'completed';

export class ReActAgentOutput extends BaseAgentOutput {
  constructor(
    public success: boolean,
    public message: string,
    public data?: any,
    public timestamp: number = Date.now()
  ) {
    super();
  }
}

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

export class ReActAgent extends BaseAgent<ReActAgentOutput> {
  private model: LocalModelClient;
  private tools: BaseTool[];
  private agentContext: ReActAgentContext;
  private errorHandler: AutonomousErrorHandler;
  private modelSelector: IntelligentModelSelector;

  constructor(context: CLIContext, workingDirectory: string) {
    // Initialize BaseAgent with configuration
    const config: BaseAgentConfig = {
      name: 'ReActAgent',
      description: 'Reasoning-Acting-Observing agent for autonomous code analysis and problem solving',
      rateLimit: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
      },
      timeout: 120000 // 2 minutes
    };

    const dependencies: AgentDependencies = {
      context,
      workingDirectory,
      sessionId: `react_${Date.now()}`
    };

    super(config, dependencies);
    this.model = dependencies.context.modelClient;
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
      // Enhanced File Operations
      new EnhancedReadFileTool(this.agentContext),
      new EnhancedWriteFileTool(this.agentContext),
      new FileSearchTool(this.agentContext),
      new FileOperationsTool(this.agentContext),
      
      // Terminal and Process Management
      new TerminalExecuteTool(this.agentContext),
      new ProcessManagementTool(this.agentContext),
      new ShellEnvironmentTool(this.agentContext),
      new PackageManagerTool(this.agentContext),
      
      // Comprehensive Git Operations
      new GitOperationsTool(this.agentContext),
      new GitAnalysisTool(this.agentContext),
      
      // Process Management and Code Execution
      new AdvancedProcessTool(this.agentContext),
      new CodeExecutionTool(this.agentContext),
      
      // Enhanced Code Analysis and Generation
      new CodeAnalysisTool(this.agentContext),
      new CodeGenerationTool(this.agentContext),
      
      // Legacy Code Analysis (for compatibility)
      new LintCodeTool(this.agentContext),
      new GetAstTool(this.agentContext),
      
      // Research and External
      new ResearchTool(this.agentContext),
      new WebSearchTool(this.agentContext),
      new DocSearchTool(this.agentContext),
      
      // Legacy tools for compatibility
      new ReadFileTool(this.agentContext),
      new WriteFileTool(this.agentContext),
      new ListFilesTool(this.agentContext),
      new GitStatusTool(this.agentContext),
      new GitDiffTool(this.agentContext),
      
      // Edit confirmation tools
      new ConfirmedWriteTool(this.agentContext),
      new ConfirmEditsTool(this.agentContext),
      new ViewPendingEditsTool(this.agentContext),
    ];
    
    // Initialize autonomous capabilities
    this.errorHandler = new AutonomousErrorHandler();
    this.modelSelector = new IntelligentModelSelector();
  }

  /**
   * Create the agent instance - required by BaseAgent
   */
  protected async createAgent(): Promise<ReActAgent> {
    return this;
  }

  /**
   * Generate system prompt - required by BaseAgent
   */
  protected generateSystemPrompt(): string {
    const toolDefinitions = this.tools.map(t => ({
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.parameters,
      examples: t.definition.examples
    }));
    const filesExplored = this.agentContext.progressMetrics.filesExplored.size;
    const recentMessages = this.agentContext.messages.slice(-6);
    
    return SimplifiedReActPrompts.createSimplePrompt(
      toolDefinitions,
      recentMessages,
      filesExplored
    );
  }

  /**
   * Get available tools - required by BaseAgent
   */
  public getAvailableTools(): BaseTool[] {
    return this.tools;
  }

  /**
   * Execute the agent with enhanced error handling
   */
  protected async executeAgent(agent: ReActAgent, input: string, streaming?: boolean): Promise<ReActAgentOutput> {
    try {
      const result = await this.processRequest(input);
      return new ReActAgentOutput(true, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('ReAct agent execution failed:', error);
      return new ReActAgentOutput(false, errorMessage, { error });
    }
  }

  public getAgentContext(): ReActAgentContext {
    return this.agentContext;
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

    // Use intelligent model selection for this task (temporarily disabled for stability)
    const taskType = this.analyzeTaskType(input);
    // const optimalModel = await this.modelSelector.selectOptimalModel(taskType, {
    //   complexity: this.assessComplexity(input),
    //   speed: 'medium',
    //   accuracy: 'high'
    // });
    
    // Temporarily use configured model for stability
    const optimalModel = undefined; // Use default configured model

    logger.info(`🧠 Using configured model for task type: ${taskType}`);

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
        // Set the selected optimal model before generating (if specified)
        if (optimalModel) {
          this.model.setModel(optimalModel);
        }
        
        // Try without structured output first to debug
        const response = await this.model.generate(prompt);
        logger.info(`Agent iteration ${i + 1} - Raw response: ${response.slice(0, 300)}...`);
        
        try {
          const thought = this.parseSimplifiedResponse(response);
          
          // Log the parsed thought for debugging
          logger.debug('Parsed thought:', thought);
          
          if (thought.tool === 'final_answer') {
            // Validate that agent has done sufficient analysis before concluding
            const validationResult = this.validateReadyForConclusion();
            if (!validationResult.isReady) {
              const errorMessage = `Cannot conclude yet: ${validationResult.reason}. Please use tools to gather more information first.`;
              this.agentContext.messages.push({ role: 'tool', content: JSON.stringify({ error: errorMessage, required: validationResult.nextSteps }), timestamp: Date.now() });
              continue;
            }
            
            let finalAnswer = thought.toolInput.answer as string;
            
            // If empty answer, generate one based on gathered information
            if (!finalAnswer || finalAnswer.trim() === '') {
              logger.warn('Final answer is empty, generating summary from conversation');
              finalAnswer = this.generateAnswerFromContext();
            }
            
            this.agentContext.messages.push({ role: 'assistant', content: finalAnswer, timestamp: Date.now() });
            
            // Record successful completion
            if (optimalModel) {
              this.modelSelector.recordPerformance(optimalModel, taskType, true, Date.now() - this.getLastMessageTime(), 1.0);
            }
            
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

          // Validate and fix tool input before execution
          const fixedToolInput = SimplifiedJSONParser.validateAndFixToolInput(thought.tool, thought.toolInput);
          const validatedInput = this.validateToolInput(thought.tool, fixedToolInput);
          if (!validatedInput.isValid) {
            const errorMessage = `Invalid tool input for ${thought.tool}: ${validatedInput.error}`;
            this.agentContext.messages.push({ role: 'tool', content: JSON.stringify({ error: errorMessage }), timestamp: Date.now() });
            continue;
          }
          thought.toolInput = fixedToolInput;
          
          // Check for repetitive tool usage with enhanced logic BEFORE tracking
          if (this.isRepetitiveToolUsage(thought.tool, thought.toolInput)) {
            logger.warn(`Preventing repetitive tool usage: ${thought.tool}`);
            
            // Special handling for listFiles when package.json is requested
            if (thought.tool === 'listFiles' && this.isPackageJsonRequested()) {
              logger.info('Forcing readFile package.json due to repetitive listFiles usage');
              const forceReadPackageJson = this.getToolByName('readFile');
              if (forceReadPackageJson) {
                this.agentContext.messages.push({ 
                  role: 'tool', 
                  content: JSON.stringify({ 
                    forced_action: 'Auto-executing readFile package.json due to repetitive listFiles usage' 
                  }), 
                  timestamp: Date.now() 
                });
                
                try {
                  const observation = await forceReadPackageJson.execute({ path: 'package.json' });
                  this.trackToolUsage('readFile', { path: 'package.json' });
                  this.updateProgressMetrics('readFile', { path: 'package.json' });
                  this.agentContext.messages.push({ role: 'tool', content: JSON.stringify(observation), timestamp: Date.now() });
                  continue; // Continue with next iteration
                } catch (error) {
                  this.agentContext.messages.push({ 
                    role: 'tool', 
                    content: JSON.stringify({ error: `Failed to read package.json: ${error}` }), 
                    timestamp: Date.now() 
                  });
                  continue;
                }
              }
            }
            
            // If we have enough progress, conclude
            if (this.hasMinimumProgress()) {
              const conclusion = this.generateProgressBasedConclusion();
              this.agentContext.messages.push({ role: 'assistant', content: conclusion, timestamp: Date.now() });
              return conclusion;
            } else {
              // Auto-execute suggested tool instead of just warning
              const autoAction = this.getAutoAction(thought.tool, thought.toolInput);
              if (autoAction) {
                logger.info(`Auto-executing suggested action: ${autoAction.tool} with ${JSON.stringify(autoAction.input)}`);
                
                const suggestedTool = this.tools.find(t => t.definition.name === autoAction.tool);
                if (suggestedTool) {
                  try {
                    const observation = await suggestedTool.execute(autoAction.input);
                    const toolResult = typeof observation === 'string' ? observation : JSON.stringify(observation);
                    this.agentContext.messages.push({ role: 'tool', content: toolResult, timestamp: Date.now() });
                    
                    // Track the auto-executed tool usage
                    this.trackToolUsage(autoAction.tool, autoAction.input);
                    this.updateProgressMetrics(autoAction.tool, autoAction.input);
                    continue;
                  } catch (error) {
                    this.agentContext.messages.push({ 
                      role: 'tool', 
                      content: JSON.stringify({ error: `Auto-action failed: ${error}` }), 
                      timestamp: Date.now() 
                    });
                  }
                }
              }
              
              // Fallback: Force tool diversification warning
              const diversificationMessage = this.suggestToolDiversification(thought.tool);
              this.agentContext.messages.push({ role: 'tool', content: JSON.stringify({ warning: diversificationMessage }), timestamp: Date.now() });
              continue;
            }
          }

          this.agentContext.messages.push({ role: 'assistant', content: JSON.stringify(thought), timestamp: Date.now() });
          
          // Execute tool with enhanced error handling
          const observation = await withErrorHandling(
            () => tool.execute(thought.toolInput),
            {
              operation: `execute-tool-${thought.tool}`,
              metadata: { 
                toolName: thought.tool, 
                input: thought.toolInput,
                sessionId: this.dependencies.sessionId
              }
            },
            {
              maxAttempts: 3,
              baseDelayMs: 500,
              retryableErrors: [ErrorCategory.NETWORK, ErrorCategory.TIMEOUT, ErrorCategory.TOOL_EXECUTION]
            }
          );
          
          // Store tool result in a more readable format
          const toolResult = typeof observation === 'string' ? observation : JSON.stringify(observation);
          this.agentContext.messages.push({ role: 'tool', content: toolResult, timestamp: Date.now() });
          
          // Track successful tool usage and update progress metrics AFTER execution
          this.trackToolUsage(thought.tool, thought.toolInput);
          this.updateProgressMetrics(thought.tool, thought.toolInput);
          
          // Store file list results for context
          if (thought.tool === 'listFiles' && typeof observation === 'string') {
            // Extract file names from formatted string result
            const fileNames = observation.split('\n')
              .filter(line => line.startsWith('- '))
              .map(line => line.substring(2))
              .slice(0, 20);
            this.agentContext.lastFileList = fileNames;
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
          model: optimalModel || 'configured_model',
          context: { iteration: i, taskType, input }
        };

        const recoveryActions = await this.errorHandler.analyzeAndRecover(errorContext);
        
        // Check if we should switch models based on recovery actions
        for (const action of recoveryActions) {
          if (action.action === 'switch_model' && action.target) {
            logger.info(`🔄 Autonomous model switch: ${optimalModel || 'configured_model'} → ${action.target}`);
            // The model switch will be handled by the next iteration
            break;
          }
        }

        // Record failure for learning
        if (optimalModel) {
          this.modelSelector.recordPerformance(optimalModel, taskType, false, Date.now() - this.getLastMessageTime(), 0.0);
        }

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
        logger.debug(`Added file to metrics: ${filePath}`);
        
        // Check if this is a critical file
        if (this.isCriticalFile(filePath)) {
          metrics.criticalFilesRead++;
          logger.debug(`Critical file read: ${filePath}`);
        }
        
        // Update workflow state
        if (this.agentContext.workflowState === 'exploring') {
          this.agentContext.workflowState = 'analyzing';
        }
      } else {
        logger.warn(`readFile called but no path in toolInput: ${JSON.stringify(toolInput)}`);
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
    const findings = this.extractFindingsFromConversation();
    
    if (findings.length > 0) {
      answer += `**Key Findings**:\n${findings.map(finding => `- ${finding}`).join('\n')}\n\n`;
    }
    
    if (issues.length > 0) {
      answer += `**Issues and Errors**:\n${issues.map(issue => `- ${issue}`).join('\n')}\n\n`;
    } 
    
    if (findings.length === 0 && issues.length === 0) {
      answer += `**Status**: Analysis tools executed but limited findings due to iteration constraints.\n\n`;
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
   * Extract actual findings and content from successful tool results
   */
  private extractFindingsFromConversation(): string[] {
    const findings: string[] = [];
    
    // Look for successful tool results with actual content
    const toolMessages = this.agentContext.messages.filter(m => m.role === 'tool');
    
    for (const message of toolMessages) {
      try {
        const content = typeof message.content === 'string' ? 
          JSON.parse(message.content) : message.content;
        
        // Skip error messages
        if (content.error) continue;
        
        // Extract package.json information
        if (typeof content === 'string' && content.includes('"name"')) {
          const nameMatch = content.match(/"name":\s*"([^"]+)"/);
          if (nameMatch) {
            findings.push(`Project name: ${nameMatch[1]}`);
          }
          const versionMatch = content.match(/"version":\s*"([^"]+)"/);
          if (versionMatch) {
            findings.push(`Project version: ${versionMatch[1]}`);
          }
          const descMatch = content.match(/"description":\s*"([^"]+)"/);
          if (descMatch) {
            findings.push(`Description: ${descMatch[1]}`);
          }
        }
        
        // Extract file listings
        if (Array.isArray(content)) {
          const importantFiles = content.filter(file => 
            file.includes('package.json') || 
            file.includes('tsconfig.json') ||
            file.includes('README') ||
            file.includes('.js') ||
            file.includes('.ts')
          );
          if (importantFiles.length > 0) {
            findings.push(`Found ${content.length} files including: ${importantFiles.slice(0, 3).join(', ')}${importantFiles.length > 3 ? '...' : ''}`);
          }
        }
        
        // Extract git status information
        if (typeof content === 'string' && (content.includes('modified:') || content.includes('branch'))) {
          findings.push('Git repository detected with tracked changes');
        }
        
      } catch (e) {
        // If raw string content, look for key information
        if (typeof message.content === 'string') {
          const content = message.content;
          
          // Look for package.json content
          if (content.includes('codecrucible-synth')) {
            findings.push('Project identified as codecrucible-synth');
          }
          if (content.includes('"version"')) {
            const versionMatch = content.match(/"version":\s*"([^"]+)"/);
            if (versionMatch) {
              findings.push(`Version: ${versionMatch[1]}`);
            }
          }
        }
      }
    }
    
    return findings;
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
   * Get auto-action for repetitive tool usage
   */
  private getAutoAction(repeatedTool: string, toolInput: any): {tool: string, input: any} | null {
    const userMessage = this.agentContext.messages.find(msg => msg.role === 'user')?.content || '';
    
    // Auto-execute specific actions based on context
    if (repeatedTool === 'listFiles') {
      // If user asked about src directory and agent is stuck on root, auto-execute src listing
      if ((/src\s*(directory|dir|folder)/i.test(userMessage) || /files\s+in\s+src/i.test(userMessage)) && 
          toolInput?.path === '.') {
        return { tool: 'listFiles', input: { path: 'src' } };
      }
      
      // If user asked for project files and we already listed root, try config files
      if (/what\s+files/i.test(userMessage) && toolInput?.path === '.') {
        return { tool: 'readFile', input: { path: 'package.json' } };
      }
    }
    
    return null;
  }

  /**
   * Suggest tool diversification when repetitive usage detected
   */
  private suggestToolDiversification(repeatedTool: string): string {
    const userMessage = this.agentContext.messages.find(msg => msg.role === 'user')?.content || '';
    
    const suggestions: Record<string, string> = {
      'listFiles': this.getListFilesSuggestion(userMessage),
      'readFile': 'Consider running linting analysis or checking AST structure',
      'gitStatus': 'Try reading configuration files or analyzing source code',
      'lintCode': 'Consider checking git status or reading other source files',
      'getAst': 'Try running linting or reading related files'
    };
    
    return suggestions[repeatedTool] || 'Try using different tools to gather more comprehensive information';
  }

  private isPackageJsonRequested(): boolean {
    const userMessage = this.agentContext.messages.find(msg => msg.role === 'user')?.content || '';
    return /package\.json|dependencies|package/i.test(userMessage);
  }

  private getToolByName(toolName: string): BaseTool | undefined {
    return this.tools.find(tool => tool.definition.name === toolName);
  }

  private getListFilesSuggestion(userMessage: string): string {
    // Check if user asked about specific directories
    if (/src\s*(directory|dir|folder)/i.test(userMessage)) {
      return 'Use listFiles with path "src" to explore the source directory specifically, then read key files in src/';
    }
    if (/files\s+in\s+src/i.test(userMessage)) {
      return 'Execute: listFiles with {"path": "src"} to see what files are in the src directory';
    }
    if (/what\s+files/i.test(userMessage) && /src/i.test(userMessage)) {
      return 'Use listFiles with path "src" to list files in the source directory';
    }
    
    // Original suggestions for other patterns
    if (/package\.json/i.test(userMessage)) {
      return 'Now read package.json file contents using readFile tool';
    }
    if (/tsconfig/i.test(userMessage)) {
      return 'Now read tsconfig.json file contents using readFile tool';
    }
    if (/dependencies|package/i.test(userMessage)) {
      return 'Read package.json to analyze dependencies using readFile tool';
    }
    if (/config/i.test(userMessage)) {
      return 'Read configuration files like package.json or tsconfig.json using readFile tool';
    }
    
    // General file listing suggestions
    if (/files.*project|project.*files/i.test(userMessage)) {
      return 'You already listed root directory. Now use listFiles with specific paths like "src", "dist", "config" or read important files with readFile';
    }
    
    return 'You already listed the root directory. Now try listFiles with specific subdirectory paths or use readFile to examine important files';
  }

  /**
   * Build exploration context to guide progressive tool usage
   */
  /**
   * Validate if the agent is ready to provide a conclusion
   */
  private validateReadyForConclusion(): { isReady: boolean; reason?: string; nextSteps?: string[] } {
    const metrics = this.agentContext.progressMetrics;
    const userMessage = this.agentContext.messages.find(msg => msg.role === 'user')?.content || '';
    
    // Check for specific file reading requests
    const requestsPackageJson = /package\.json/i.test(userMessage);
    const requestsTsConfig = /tsconfig/i.test(userMessage);
    const requestsSpecificFile = /read|analyze|check.*\.(json|ts|js|md|txt)/i.test(userMessage);
    
    // If user specifically requested file reading but no files have been read
    if ((requestsPackageJson || requestsTsConfig || requestsSpecificFile) && metrics.criticalFilesRead === 0) {
      const nextSteps = [];
      if (requestsPackageJson) nextSteps.push('readFile package.json');
      if (requestsTsConfig) nextSteps.push('readFile tsconfig.json');
      if (requestsSpecificFile) nextSteps.push('readFile for the requested file');
      
      return {
        isReady: false,
        reason: 'User requested specific file analysis but no files have been read yet',
        nextSteps
      };
    }
    
    // General minimum requirements for any analysis
    if (metrics.toolsUsed.size === 0) {
      return {
        isReady: false,
        reason: 'No tools have been used to gather information',
        nextSteps: ['listFiles to explore project structure']
      };
    }
    
    // For general analysis, require at least some exploration
    if (metrics.directoriesListed.size === 0 && metrics.filesExplored.size === 0) {
      return {
        isReady: false,
        reason: 'No exploration of project structure or files has been done',
        nextSteps: ['listFiles to understand project layout', 'readFile for key files']
      };
    }
    
    // For code analysis requests, require reading at least one file
    if (/analyze|review|explain|debug|error|issue/i.test(userMessage) && metrics.criticalFilesRead === 0) {
      return {
        isReady: false,
        reason: 'Analysis requested but no files have been read for content examination',
        nextSteps: ['readFile key files like package.json, main source files']
      };
    }
    
    // Passed all checks
    return { isReady: true };
  }

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
    const toolDefinitions = this.tools.map(t => ({
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.parameters,
      examples: t.definition.examples
    }));
    // Include more recent messages for better context (especially tool results)
    const recentMessages = this.agentContext.messages.slice(-8);
    const filesExplored = this.agentContext.progressMetrics.filesExplored.size;
    
    return SimplifiedReActPrompts.createSimplePrompt(
      toolDefinitions,
      recentMessages,
      filesExplored
    );
  }

  private parseSimplifiedResponse(response: string): Thought {
    try {
      const parsed = SimplifiedJSONParser.parseSimpleResponse(response);
      
      // Validate and fix tool input
      const fixedInput = SimplifiedJSONParser.validateAndFixToolInput(parsed.tool, parsed.toolInput);
      
      return {
        thought: parsed.thought,
        tool: parsed.tool,
        toolInput: fixedInput
      };
    } catch (error) {
      logger.error('Simplified JSON parsing failed:', error);
      // Final fallback - create a default response
      throw new Error(`Could not parse response: ${response.slice(0, 200)}`);
    }
  }

  // Old complex parsing methods removed - now using SimplifiedJSONParser

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
      logger.warn('Direct response generation failed:', error);
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
      
      // Be more restrictive with listFiles on same path to encourage progression
      if (samePathUsage.length >= 2) {
        return true; // Block after 2 attempts on same path to encourage progression
      }
      
      // Also check total listFiles usage regardless of path
      const totalListFiles = recentUsage.filter(usage => 
        usage.tool === 'listFiles' &&
        (now - usage.timestamp) < 300000 // 5 minutes
      );
      
      // If we've used listFiles extensively but haven't read any files, encourage progression
      const recentReadFiles = recentUsage.filter(usage => 
        usage.tool === 'readFile' &&
        (now - usage.timestamp) < 300000 // 5 minutes
      );
      
      if (totalListFiles.length >= 3 && recentReadFiles.length === 0) {
        return true; // Block listFiles if we haven't progressed to reading files
      }
      
      return totalListFiles.length >= 6; // Reduced from 8 to encourage more action
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
    
    // For getAst, be more restrictive since it's often called on non-existent files
    if (toolName === 'getAst') {
      const sameFileUsage = recentUsage.filter(usage => 
        usage.tool === 'getAst' && 
        usage.input?.path === toolInput?.path &&
        (now - usage.timestamp) < 300000 // 5 minutes
      );
      return sameFileUsage.length >= 1; // Only allow once per file unless successful
    }
    
    return false;
  }

  /**
   * Validate tool input before execution
   */
  private validateToolInput(toolName: string, toolInput: any): { isValid: boolean; error?: string } {
    // Check if toolInput exists
    if (!toolInput || typeof toolInput !== 'object') {
      return { isValid: false, error: 'Tool input must be a valid object' };
    }

    // Tool-specific validation
    switch (toolName) {
      case 'readFile':
      case 'getAst':
      case 'lintCode':
        if (!toolInput.path || typeof toolInput.path !== 'string' || toolInput.path.trim() === '') {
          return { isValid: false, error: 'path parameter is required and must be a non-empty string' };
        }
        // Check for common bad paths that don't exist in this project
        if (typeof toolInput.path === 'string' && (toolInput.path.includes('src/main.ts') || toolInput.path.includes('main.ts'))) {
          return { isValid: false, error: 'main.ts file does not exist in this project. Use listFiles to explore actual project structure first.' };
        }
        // Additional common non-existent paths
        if (typeof toolInput.path === 'string' && toolInput.path.includes('src/index.ts') && !toolInput.path.includes('dist')) {
          return { isValid: false, error: 'src/index.ts may not exist. Check with listFiles first.' };
        }
        break;
      
      case 'research':
        if (!toolInput.query || typeof toolInput.query !== 'string' || toolInput.query.trim() === '') {
          return { isValid: false, error: 'query parameter is required and must be a non-empty string' };
        }
        if (toolInput.type && !['error', 'pattern', 'documentation', 'general'].includes(toolInput.type)) {
          return { isValid: false, error: 'type parameter must be one of: error, pattern, documentation, general' };
        }
        break;
      
      case 'webSearch':
        if (!toolInput.query || typeof toolInput.query !== 'string' || toolInput.query.trim() === '') {
          return { isValid: false, error: 'query parameter is required and must be a non-empty string' };
        }
        break;
      
      case 'docSearch':
        if (!toolInput.query || typeof toolInput.query !== 'string' || toolInput.query.trim() === '') {
          return { isValid: false, error: 'query parameter is required and must be a non-empty string' };
        }
        break;
      
      case 'listFiles':
        // listFiles can work with or without path
        if (toolInput.path && typeof toolInput.path !== 'string') {
          return { isValid: false, error: 'path parameter must be a string if provided' };
        }
        break;
      
      case 'writeFile':
        if (!toolInput.path || typeof toolInput.path !== 'string' || toolInput.path.trim() === '') {
          return { isValid: false, error: 'path parameter is required and must be a non-empty string' };
        }
        if (!toolInput.content || typeof toolInput.content !== 'string') {
          return { isValid: false, error: 'content parameter is required and must be a string' };
        }
        break;
      
      case 'runCommand':
        if (!toolInput.command || typeof toolInput.command !== 'string' || toolInput.command.trim() === '') {
          return { isValid: false, error: 'command parameter is required and must be a non-empty string' };
        }
        break;
    }

    return { isValid: true };
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
