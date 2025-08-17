import { CLIContext } from './cli.js';
import { LocalModelClient } from './local-model-client.js';
import { logger } from './logger.js';
import { z } from 'zod';
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
import { GoogleWebSearchTool, RefDocumentationTool, RefReadUrlTool, ExaWebSearchTool } from './tools/real-research-tools.js';
import { AutonomousCodebaseAuditor } from './tools/autonomous-codebase-auditor.js';
import { CodeInjectionTool } from './tools/code-injection-tool.js';
import { CodeWriterTool } from './tools/code-writer-tool.js';
import { AutonomousErrorHandler, ErrorContext } from './autonomous-error-handler.js';
import { IntelligentModelSelector } from './intelligent-model-selector.js';
import { SimplifiedReActPrompts, SimplifiedJSONParser } from './simplified-react-prompts.js';
import { ReadCodeStructureTool } from './tools/read-code-structure-tool.js';
import { IntelligentFileReaderTool } from './tools/intelligent-file-reader-tool.js';
import { ClaudeCodeInspiredReasoning, ReasoningOutput } from './claude-code-inspired-reasoning.js';

const ThoughtSchema = z.object({
  thought: z.string().describe('Your reasoning and plan for the next action.'),
  tool: z.string().describe('The name of the tool to use.'),
  toolInput: z.record(z.unknown()).describe('The input for the tool.'),
});

type Thought = z.infer<typeof ThoughtSchema>;

type WorkflowState = 'initial' | 'exploring' | 'analyzing' | 'diagnosing' | 'concluding' | 'completed';

export class ReActAgentOutput extends BaseAgentOutput {
  constructor(
    success: boolean,
    message: string,
    data?: any,
    timestamp: number = Date.now()
  ) {
    super(success, message, data);
    this.timestamp = timestamp;
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

interface ContextKnowledge {
  projectName?: string;
  projectVersion?: string;
  projectType?: string;
  mainTechnologies: string[];
  fileStructure: Map<string, string[]>;
  keyFindings: string[];
  actionableInsights: string[];
}

interface ReActAgentContext {
  workingDirectory: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  currentPlan?: string[];
  recentToolUsage: Array<{ tool: string; timestamp: number; input: any; output?: string }>;
  lastFileList?: string[];
  conversationMode: 'exploration' | 'analysis' | 'direct_response';
  workflowState: WorkflowState;
  progressMetrics: ProgressMetrics;
  maxIterations: number;
  currentIteration: number;
  // NEW: Rich context knowledge
  knowledge: ContextKnowledge;
  // NEW: Track exact tool calls to prevent ANY repetition
  exactToolCalls: Set<string>;
}

export class ReActAgent extends BaseAgent<ReActAgentOutput> {
  private model: LocalModelClient;
  private tools: BaseTool[];
  private agentContext: ReActAgentContext;
  private errorHandler: AutonomousErrorHandler;
  private modelSelector: IntelligentModelSelector;
  private reasoning: ClaudeCodeInspiredReasoning | null = null;

  constructor(context: CLIContext, workingDirectory: string) {
    // Initialize BaseAgent with configuration
    const config: BaseAgentConfig = {
      name: 'ReActAgent',
      description: 'Enhanced reasoning-acting agent with improved loop prevention',
      rateLimit: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
      },
      timeout: 60000 // 1 minute timeout (reduced from 2)
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
      maxIterations: 5, // Reduced from 8 to force concise analysis
      currentIteration: 0,
      knowledge: {
        mainTechnologies: [],
        fileStructure: new Map(),
        keyFindings: [],
        actionableInsights: []
      },
      exactToolCalls: new Set()
    };
    this.tools = [
      // Prioritize intelligent tools
      new ReadCodeStructureTool(this.agentContext),
      new IntelligentFileReaderTool(this.agentContext),
      
      // Essential file operations
      new EnhancedReadFileTool(this.agentContext),
      new ListFilesTool(this.agentContext),
      new FileSearchTool(this.agentContext),
      
      // Code analysis
      new CodeAnalysisTool(this.agentContext),
      new LintCodeTool(this.agentContext),
      new GetAstTool(this.agentContext),
      
      // Git operations
      new GitStatusTool(this.agentContext),
      new GitDiffTool(this.agentContext),
      
      // Terminal operations
      new TerminalExecuteTool(this.agentContext),
      new PackageManagerTool(this.agentContext),
      
      // Writing tools
      new ConfirmedWriteTool(this.agentContext),
      new WriteFileTool(this.agentContext),
      new CodeInjectionTool(this.agentContext),
      new CodeWriterTool(this.agentContext),

      // Research Tools
      new GoogleWebSearchTool(this.agentContext),
      new RefDocumentationTool(this.agentContext),
      new RefReadUrlTool(this.agentContext),
      new ExaWebSearchTool(this.agentContext),

      // Autonomous Tools
      new AutonomousCodebaseAuditor(this.agentContext),
      
      // Legacy compatibility
      new ReadFileTool(this.agentContext),
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
    this.agentContext.knowledge = {
      mainTechnologies: [],
      fileStructure: new Map(),
      keyFindings: [],
      actionableInsights: []
    };
    this.agentContext.exactToolCalls = new Set();
  }

  async processRequest(input: string): Promise<string> {
    const requestStartTime = Date.now();
    const maxProcessingTime = this.config.timeout || 60000; // 1 minute
    
    this.agentContext.messages.push({ role: 'user', content: input, timestamp: Date.now() });

    // Analyze intent and check if we need tools at all
    const intentAnalysis = this.analyzeUserIntent(input);
    if (intentAnalysis.canAnswerDirectly) {
      return this.generateDirectResponse(input, intentAnalysis);
    }

    // Initialize enhanced reasoning
    this.reasoning = new ClaudeCodeInspiredReasoning(this.tools, input, this.model);
    logger.info('🧠 Initialized enhanced reasoning system');

    let lastObservation: string | undefined;
    let noProgressCount = 0;

    for (let i = 0; i < this.agentContext.maxIterations; i++) {
      this.agentContext.currentIteration = i;
      
      // Check for timeout
      if (Date.now() - requestStartTime > maxProcessingTime) {
        logger.warn(`⏰ Request timeout after ${Date.now() - requestStartTime}ms`);
        return this.generateFinalAnswerFromKnowledge("Request timed out - providing analysis based on gathered information.");
      }
      
      try {
        // Use enhanced reasoning
        const reasoningOutput: ReasoningOutput = this.reasoning!.reason(lastObservation);
        
        logger.info(`🧠 Iteration ${i + 1}: ${reasoningOutput.reasoning}`);
        logger.info(`🔧 Tool: ${reasoningOutput.selectedTool} (confidence: ${reasoningOutput.confidence.toFixed(2)})`);
        
        // Check for completion
        if (reasoningOutput.shouldComplete || i >= this.agentContext.maxIterations - 1) {
          const finalAnswer = reasoningOutput.toolInput.answer as string || this.generateFinalAnswerFromKnowledge();
          this.agentContext.messages.push({ role: 'assistant', content: finalAnswer, timestamp: Date.now() });
          return finalAnswer;
        }

        // ENHANCED: Strict duplicate prevention with smart progression
        const toolCallSignature = `${reasoningOutput.selectedTool}:${JSON.stringify(reasoningOutput.toolInput)}`;
        if (this.agentContext.exactToolCalls.has(toolCallSignature)) {
          logger.warn(`⚠️ Preventing duplicate tool call: ${toolCallSignature}`);
          
          // Force progression based on goal achievement
          const hasMinimumContext = this.agentContext.knowledge.keyFindings.length >= 2;
          const hasProjectInfo = this.agentContext.knowledge.projectName || this.agentContext.knowledge.projectType;
          const hasFileStructure = this.agentContext.knowledge.fileStructure.size > 0;
          
          if (hasMinimumContext && (hasProjectInfo || hasFileStructure)) {
            return this.generateFinalAnswerFromKnowledge("Sufficient information gathered - completing analysis.");
          }
          
          // Try to force different tool selection
          lastObservation = `Tool ${reasoningOutput.selectedTool} already used. Need different approach to gather more context.`;
          noProgressCount++;
          
          if (noProgressCount >= 2) {
            return this.generateFinalAnswerFromKnowledge("Completing analysis with available information to prevent loops.");
          }
          continue;
        }
        
        this.agentContext.exactToolCalls.add(toolCallSignature);

        // Find and execute tool
        const tool = this.tools.find(t => t.definition.name === reasoningOutput.selectedTool);
        if (!tool) {
          const availableTools = this.tools.map(t => t.definition.name).join(', ');
          logger.error(`Unknown tool: ${reasoningOutput.selectedTool}. Available: ${availableTools}`);
          lastObservation = `Error: Unknown tool "${reasoningOutput.selectedTool}"`;
          continue;
        }

        // Execute tool
        try {
          const observation = await tool.execute(reasoningOutput.toolInput);
          lastObservation = typeof observation === 'string' ? observation : JSON.stringify(observation);
          
          // ENHANCED: Extract knowledge from observation
          this.extractKnowledgeFromObservation(lastObservation, reasoningOutput.selectedTool);
          
          // Track tool usage with output
          this.agentContext.recentToolUsage.push({ 
            tool: reasoningOutput.selectedTool, 
            timestamp: Date.now(),
            input: reasoningOutput.toolInput,
            output: lastObservation.slice(0, 500)
          });
          
          // Store in messages
          this.agentContext.messages.push({ 
            role: 'tool', 
            content: lastObservation, 
            timestamp: Date.now() 
          });
          
          logger.info(`✅ Tool ${reasoningOutput.selectedTool} executed successfully`);
          noProgressCount = 0; // Reset on successful progress
          
        } catch (toolError) {
          const errorMessage = toolError instanceof Error ? toolError.message : 'Tool execution failed';
          lastObservation = `Error: ${errorMessage}`;
          logger.warn(`❌ Tool ${reasoningOutput.selectedTool} failed: ${errorMessage}`);
        }

      } catch (error) {
        logger.error('Error in agent iteration:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastObservation = `Error: ${errorMessage}`;
      }
    }

    // Reached max iterations - provide comprehensive answer
    return this.generateFinalAnswerFromKnowledge("Analysis complete after systematic exploration.");
  }

  /**
   * ENHANCED: Extract actionable knowledge from tool observations
   */
  private extractKnowledgeFromObservation(observation: string, toolName: string): void {
    try {
      // Parse if JSON
      let data: any;
      try {
        data = JSON.parse(observation);
      } catch {
        // If not JSON, try to extract information from formatted text
        data = this.extractFromFormattedText(observation);
      }

      // Extract based on tool type
      switch (toolName) {
        case 'readCodeStructure':
        case 'readFiles':
          if (data.projectType) this.agentContext.knowledge.projectType = data.projectType;
          if (data.framework) this.agentContext.knowledge.mainTechnologies.push(data.framework);
          if (data.frameworks && Array.isArray(data.frameworks)) {
            this.agentContext.knowledge.mainTechnologies.push(...data.frameworks);
          }
          if (data.totalFiles) this.agentContext.knowledge.keyFindings.push(`Project contains ${data.totalFiles} files`);
          if (data.definitions) this.agentContext.knowledge.keyFindings.push(`Found ${data.definitions.length} code definitions`);
          if (data.codeDefinitions && Array.isArray(data.codeDefinitions)) {
            this.agentContext.knowledge.keyFindings.push(`Found ${data.codeDefinitions.length} code definitions`);
          }
          break;
          
        case 'listFiles':
          if (Array.isArray(data)) {
            const dirs = data.filter(f => !f.includes('.'));
            const files = data.filter(f => f.includes('.'));
            this.agentContext.knowledge.fileStructure.set('.', data);
            this.agentContext.knowledge.keyFindings.push(`Directory contains ${dirs.length} folders and ${files.length} files`);
          }
          break;
          
        case 'readFile':
          if (typeof data === 'string' && data.includes('package.json')) {
            const nameMatch = data.match(/"name":\s*"([^"]+)"/);
            if (nameMatch) this.agentContext.knowledge.projectName = nameMatch[1];
            const versionMatch = data.match(/"version":\s*"([^"]+)"/);
            if (versionMatch) this.agentContext.knowledge.projectVersion = versionMatch[1];
          }
          if (typeof data === 'object' && data.name) {
            this.agentContext.knowledge.projectName = data.name;
          }
          if (typeof data === 'object' && data.version) {
            this.agentContext.knowledge.projectVersion = data.version;
          }
          break;
          
        case 'gitStatus':
          if (data.modified || data.staged) {
            this.agentContext.knowledge.keyFindings.push('Git repository with active changes detected');
          }
          if (typeof data === 'string' && (data.includes('modified') || data.includes('staged'))) {
            this.agentContext.knowledge.keyFindings.push('Git repository with active changes detected');
          }
          break;
      }

      // Track progress metrics
      if (this.agentContext.knowledge.keyFindings.length > 0) {
        this.agentContext.progressMetrics.criticalFilesRead++;
      }

      // Generate actionable insights based on accumulated knowledge
      if (this.agentContext.knowledge.keyFindings.length >= 2 && 
          this.agentContext.knowledge.actionableInsights.length === 0) {
        this.generateActionableInsights();
      }
      
    } catch (error) {
      logger.debug('Could not extract structured knowledge from observation');
    }
  }

  /**
   * Extract information from formatted text output
   */
  private extractFromFormattedText(text: string): any {
    const data: any = {};
    
    // Extract project overview information
    const projectTypeMatch = text.match(/Primary Language.*: (.+)/);
    if (projectTypeMatch) {
      data.projectType = projectTypeMatch[1].trim();
    }
    
    const totalFilesMatch = text.match(/Total Files.*: (\d+)/);
    if (totalFilesMatch) {
      data.totalFiles = parseInt(totalFilesMatch[1], 10);
    }
    
    const frameworksMatch = text.match(/Frameworks.*: ([^\n]+)/);
    if (frameworksMatch) {
      const frameworks = frameworksMatch[1].trim();
      if (frameworks !== 'None detected') {
        data.frameworks = frameworks.split(',').map(f => f.trim());
      }
    }
    
    const buildSystemMatch = text.match(/Build System.*: ([^\n]+)/);
    if (buildSystemMatch) {
      data.buildSystem = buildSystemMatch[1].trim();
    }
    
    // Extract code definitions count
    const definitionsMatch = text.match(/extracted (\d+) code definitions/);
    if (definitionsMatch) {
      data.definitions = Array(parseInt(definitionsMatch[1], 10)).fill(null);
    }
    
    return data;
  }

  /**
   * Generate actionable insights from accumulated knowledge
   */
  private generateActionableInsights(): void {
    const knowledge = this.agentContext.knowledge;
    
    if (knowledge.projectType) {
      knowledge.actionableInsights.push(`This is a ${knowledge.projectType} project`);
    }
    
    if (knowledge.mainTechnologies.length > 0) {
      knowledge.actionableInsights.push(`Technologies used: ${knowledge.mainTechnologies.join(', ')}`);
    }
    
    if (knowledge.projectName && knowledge.projectVersion) {
      knowledge.actionableInsights.push(`Project: ${knowledge.projectName} v${knowledge.projectVersion}`);
    }
  }

  /**
   * ENHANCED: Generate comprehensive final answer from accumulated knowledge
   */
  private generateFinalAnswerFromKnowledge(reason?: string): string {
    const knowledge = this.agentContext.knowledge;
    const metrics = this.agentContext.progressMetrics;
    
    let answer = "";
    
    if (reason) {
      answer += `${reason}\n\n`;
    }
    
    // Project overview if available
    if (knowledge.projectName || knowledge.projectType) {
      answer += "## Project Overview\\n";
      if (knowledge.projectName) answer += `**Name**: ${knowledge.projectName}\\n`;
      if (knowledge.projectVersion) answer += `**Version**: ${knowledge.projectVersion}\\n`;
      if (knowledge.projectType) answer += `**Type**: ${knowledge.projectType}\\n`;
      if (knowledge.mainTechnologies.length > 0) {
        answer += `**Technologies**: ${knowledge.mainTechnologies.join(', ')}\\n`;
      }
      answer += "\\n";
    }
    
    // Key findings
    if (knowledge.keyFindings.length > 0) {
      answer += "## Key Findings\\n";
      knowledge.keyFindings.forEach(finding => {
        answer += `- ${finding}\\n`;
      });
      answer += "\\n";
    }
    
    // Actionable insights
    if (knowledge.actionableInsights.length > 0) {
      answer += "## Insights\\n";
      knowledge.actionableInsights.forEach(insight => {
        answer += `- ${insight}\\n`;
      });
      answer += "\\n";
    }
    
    // Analysis summary
    answer += "## Analysis Summary\\n";
    answer += `- Analyzed ${metrics.directoriesListed.size} directories\\n`;
    answer += `- Examined ${metrics.filesExplored.size} files\\n`;
    answer += `- Used ${metrics.toolsUsed.size} different analysis tools\\n`;
    
    // Recommendations if applicable
    if (metrics.issuesFound.length > 0) {
      answer += "\\n## Issues Detected\\n";
      metrics.issuesFound.forEach(issue => {
        answer += `- ${issue}\\n`;
      });
    }
    
    return answer || "Analysis completed. Please provide more specific questions for detailed insights.";
  }

  /**
   * Analyze user intent to determine if tools are needed
   */
  private analyzeUserIntent(input: string): {
    mode: 'exploration' | 'analysis' | 'direct_response';
    canAnswerDirectly: boolean;
    needsFileInfo: boolean;
    needsCodeAnalysis: boolean;
  } {
    const lowerInput = input.toLowerCase().trim();
    
    // Simple greetings or questions
    const directResponsePatterns = [
      /^(hi|hello|hey)$/,
      /^(thanks|thank you)$/,
      /what.*think/,
      /how.*feel/,
      /can you help/
    ];
    
    const canAnswerDirectly = directResponsePatterns.some(p => p.test(lowerInput));
    
    return {
      mode: canAnswerDirectly ? 'direct_response' : 'analysis',
      canAnswerDirectly,
      needsFileInfo: lowerInput.includes('file') || lowerInput.includes('structure'),
      needsCodeAnalysis: lowerInput.includes('code') || lowerInput.includes('analyze')
    };
  }

  /**
   * Generate direct response without tools
   */
  private async generateDirectResponse(input: string, analysis: any): Promise<string> {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.match(/^(hi|hello|hey)$/)) {
      return "Hello! I'm ready to help analyze your codebase. What would you like me to examine?";
    }
    
    if (lowerInput.includes('thank')) {
      return "You're welcome! Let me know if you need any further analysis.";
    }
    
    return "I can help with that. Let me analyze your codebase to provide specific insights.";
  }
}
