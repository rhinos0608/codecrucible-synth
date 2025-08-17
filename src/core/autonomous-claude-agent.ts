/**
 * Autonomous Claude-like Coding Agent
 * 
 * A comprehensive autonomous agent that replicates Claude's capabilities:
 * - Tool usage and file manipulation
 * - Multi-step reasoning and planning
 * - Code analysis and generation
 * - Self-reflection and capability assessment
 * - Learning and adaptation
 */

import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { LocalModelClient, ProjectContext, VoiceArchetype } from './local-model-client.js';
import { AgentResponse, SynthesisResponse, ResponseFactory } from './response-types.js';
import { LivingSpiralCoordinator, LivingSpiralResult } from './living-spiral-coordinator.js';
import { logger } from './logger.js';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { join, dirname, extname, relative } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

export interface AutonomousTask {
  id: string;
  description: string;
  type: 'analysis' | 'coding' | 'research' | 'planning' | 'synthesis';
  priority: number;
  dependencies: string[];
  context: Record<string, any>;
  tools: string[];
  expectedOutput: string;
  maxSteps: number;
  currentStep: number;
  reasoning: string[];
  status: 'pending' | 'active' | 'completed' | 'failed' | 'paused';
}

export interface ToolCall {
  tool: string;
  action: string;
  parameters: Record<string, any>;
  reasoning: string;
  expectedResult: string;
}

export interface ReasoningStep {
  step: number;
  thought: string;
  observation: string;
  plan: string[];
  toolCalls: ToolCall[];
  confidence: number;
  learnings: string[];
}

export interface AutonomousSession {
  sessionId: string;
  startTime: number;
  tasks: AutonomousTask[];
  completedSteps: ReasoningStep[];
  currentContext: ProjectContext;
  learningHistory: string[];
  capabilities: string[];
  limitations: string[];
  performance: {
    tasksCompleted: number;
    averageStepsPerTask: number;
    successRate: number;
    toolUsageStats: Record<string, number>;
  };
}

/**
 * Autonomous Claude-like Agent
 * 
 * Implements advanced reasoning, tool usage, and self-synthesis capabilities
 * similar to Claude's approach to problem-solving.
 */
export class AutonomousClaudeAgent {
  private voiceSystem: VoiceArchetypeSystem;
  private modelClient: LocalModelClient;
  private spiralCoordinator: LivingSpiralCoordinator;
  private session: AutonomousSession;
  private availableTools: Map<string, Function>;
  private workingDirectory: string;

  constructor(
    voiceSystem: VoiceArchetypeSystem, 
    modelClient: LocalModelClient,
    workingDirectory: string = process.cwd()
  ) {
    this.voiceSystem = voiceSystem;
    this.modelClient = modelClient;
    this.spiralCoordinator = voiceSystem.getLivingSpiralCoordinator();
    this.workingDirectory = workingDirectory;
    
    this.session = {
      sessionId: `session_${Date.now()}`,
      startTime: Date.now(),
      tasks: [],
      completedSteps: [],
      currentContext: { files: [] },
      learningHistory: [],
      capabilities: this.initializeCapabilities(),
      limitations: this.initializeLimitations(),
      performance: {
        tasksCompleted: 0,
        averageStepsPerTask: 0,
        successRate: 0,
        toolUsageStats: {}
      }
    };

    this.availableTools = this.initializeTools();
  }

  /**
   * Main autonomous processing method - replicates Claude's approach
   */
  async processAutonomously(
    userInput: string,
    context: ProjectContext = { files: [] }
  ): Promise<AgentResponse> {
    logger.info(`🤖 Autonomous processing: "${userInput.substring(0, 50)}..."`);
    console.log(chalk.cyan(`🤖 CodeCrucible Autonomous Agent`));
    console.log(chalk.white(`📝 Task: ${userInput}`));

    try {
      // Phase 1: Understand and Plan
      const understanding = await this.analyzeTaskAndCreatePlan(userInput, context);
      console.log(chalk.yellow(`🧠 Understanding: ${understanding.taskType}`));
      
      // Phase 2: Execute with Reasoning
      const execution = await this.executeWithReasoning(understanding, context);
      console.log(chalk.green(`✅ Execution completed with ${execution.steps.length} reasoning steps`));
      
      // Phase 3: Synthesize and Reflect
      const synthesis = await this.synthesizeAndReflect(execution, understanding);
      console.log(chalk.blue(`🔄 Synthesis quality: ${synthesis.confidence}/100`));
      
      // Phase 4: Self-Assessment and Learning
      const assessment = await this.performSelfAssessment(synthesis, userInput);
      this.updateLearningHistory(assessment.learnings);
      
      console.log(chalk.magenta(`📚 Learned: ${assessment.learnings.length} new insights`));
      
      return ResponseFactory.createAgentResponse(synthesis.result, {
        confidence: synthesis.confidence,
        reasoning: synthesis.reasoning,
        voiceId: 'autonomous-claude',
        tokensUsed: this.estimateTokenUsage(synthesis)
      });

    } catch (error) {
      logger.error('Autonomous processing failed:', error);
      return ResponseFactory.createAgentResponse(
        `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { confidence: 0.1 }
      );
    }
  }

  /**
   * Analyze task and create execution plan
   */
  private async analyzeTaskAndCreatePlan(
    userInput: string, 
    context: ProjectContext
  ): Promise<{
    taskType: string;
    complexity: number;
    requiredTools: string[];
    plan: string[];
    reasoning: string;
  }> {
    const analyzerVoice: VoiceArchetype = {
      id: 'task-analyzer',
      name: 'Task Analyzer',
      systemPrompt: `You are an expert task analyzer. Your role is to understand user requests and break them down into actionable plans.

Analyze the user's request and determine:
1. Task type (coding, analysis, research, planning, etc.)
2. Complexity level (1-10)
3. Required tools and capabilities
4. Step-by-step execution plan
5. Potential challenges and considerations

Be thorough and strategic in your analysis.`,
      temperature: 0.4,
      style: 'analytical'
    };

    const analysisPrompt = `Task Analysis Request:

User Input: ${userInput}

Project Context:
${context.files ? `- Files: ${context.files.length} files` : '- No files provided'}
${context.projectType ? `- Project Type: ${context.projectType}` : ''}
${context.workingDirectory ? `- Working Directory: ${context.workingDirectory}` : ''}

Available Tools: file reading/writing, code analysis, research, git operations, project exploration

Please provide:
1. **Task Classification**: What type of task is this?
2. **Complexity Assessment**: Rate 1-10 and explain
3. **Required Tools**: What tools will be needed?
4. **Execution Plan**: Step-by-step approach
5. **Challenges**: Potential issues and how to handle them

Be specific and actionable in your recommendations.`;

    const response = await this.modelClient.generateVoiceResponse(analyzerVoice, analysisPrompt, context);
    
    return {
      taskType: this.extractTaskType(response.content),
      complexity: this.extractComplexity(response.content),
      requiredTools: this.extractRequiredTools(response.content),
      plan: this.extractPlan(response.content),
      reasoning: response.content
    };
  }

  /**
   * Execute task with step-by-step reasoning (ReAct pattern)
   */
  private async executeWithReasoning(
    understanding: any,
    context: ProjectContext
  ): Promise<{
    steps: ReasoningStep[];
    finalResult: string;
    toolsUsed: string[];
  }> {
    const steps: ReasoningStep[] = [];
    const toolsUsed: string[] = [];
    let currentContext = { ...context };
    let stepCount = 0;
    const maxSteps = Math.min(understanding.complexity * 2, 15);

    console.log(chalk.cyan(`🔄 Beginning reasoning execution (max ${maxSteps} steps)`));

    while (stepCount < maxSteps) {
      stepCount++;
      
      console.log(chalk.dim(`   Step ${stepCount}/${maxSteps}: Thinking...`));
      
      // Generate reasoning step
      const reasoningStep = await this.generateReasoningStep(
        understanding,
        currentContext,
        steps,
        stepCount
      );

      steps.push(reasoningStep);
      console.log(chalk.white(`   💭 ${reasoningStep.thought.substring(0, 80)}...`));

      // Execute tool calls if any
      if (reasoningStep.toolCalls.length > 0) {
        for (const toolCall of reasoningStep.toolCalls) {
          console.log(chalk.green(`   🔧 Using tool: ${toolCall.tool} - ${toolCall.action}`));
          
          try {
            const result = await this.executeTool(toolCall, currentContext);
            toolsUsed.push(toolCall.tool);
            
            // Update context with tool results
            currentContext = this.updateContextWithToolResult(currentContext, toolCall, result);
            
          } catch (error) {
            logger.warn(`Tool execution failed: ${toolCall.tool}`, error);
            reasoningStep.observation += ` Tool ${toolCall.tool} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }

      // Check if task is complete
      if (this.isTaskComplete(reasoningStep, understanding)) {
        console.log(chalk.green(`   🎯 Task completed in ${stepCount} steps`));
        break;
      }
    }

    return {
      steps,
      finalResult: this.synthesizeStepsResult(steps),
      toolsUsed: [...new Set(toolsUsed)]
    };
  }

  /**
   * Generate a single reasoning step using ReAct pattern
   */
  private async generateReasoningStep(
    understanding: any,
    context: ProjectContext,
    previousSteps: ReasoningStep[],
    stepNumber: number
  ): Promise<ReasoningStep> {
    const reasonerVoice: VoiceArchetype = {
      id: 'step-reasoner',
      name: 'Step Reasoner',
      systemPrompt: `You are an expert reasoning agent following the ReAct pattern. For each step:

1. **Think**: Analyze current situation and what needs to be done next
2. **Plan**: Determine specific actions to take
3. **Tool Selection**: Choose appropriate tools if needed
4. **Observation**: Analyze results and determine next steps

Be methodical, clear, and focused on making progress toward the goal.`,
      temperature: 0.5,
      style: 'methodical'
    };

    const stepPrompt = `Reasoning Step ${stepNumber}

Current Task: ${understanding.taskType}
Plan: ${understanding.plan.join(' → ')}

Previous Steps:
${previousSteps.map((step, i) => `Step ${i + 1}: ${step.thought}`).join('\n')}

Current Context:
${this.formatContextForReasoning(context)}

Available Tools:
- read_file: Read file contents
- write_file: Write content to file
- list_directory: List directory contents
- analyze_code: Analyze code structure and quality
- search_project: Search for patterns in project
- execute_command: Run system commands (with caution)

Your task: Provide the next reasoning step with:
1. **Thought**: What should I do next and why?
2. **Observation**: What do I currently know?
3. **Plan**: Next 2-3 specific actions
4. **Tools**: If tools are needed, specify which ones and how

Be specific and actionable. If the task is complete, state that clearly.`;

    const response = await this.modelClient.generateVoiceResponse(reasonerVoice, stepPrompt, context);
    
    return {
      step: stepNumber,
      thought: this.extractThought(response.content),
      observation: this.extractObservation(response.content),
      plan: this.extractNextPlan(response.content),
      toolCalls: this.extractToolCalls(response.content),
      confidence: response.confidence,
      learnings: this.extractLearnings(response.content)
    };
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolCall: ToolCall, context: ProjectContext): Promise<any> {
    const tool = this.availableTools.get(toolCall.tool);
    if (!tool) {
      throw new Error(`Tool ${toolCall.tool} not found`);
    }

    this.session.performance.toolUsageStats[toolCall.tool] = 
      (this.session.performance.toolUsageStats[toolCall.tool] || 0) + 1;

    return await tool(toolCall.parameters, context);
  }

  /**
   * Synthesize results and perform reflection
   */
  private async synthesizeAndReflect(
    execution: any,
    understanding: any
  ): Promise<{
    result: string;
    reasoning: string;
    confidence: number;
    quality: number;
    insights: string[];
  }> {
    // Use Living Spiral for complex synthesis
    if (understanding.complexity > 7) {
      const spiralResult = await this.spiralCoordinator.executeLivingSpiral(
        `Synthesize the execution results: ${execution.finalResult}`,
        this.session.currentContext,
        {
          maxIterations: 2,
          qualityThreshold: 85,
          voiceSelectionStrategy: 'adaptive'
        }
      );

      return {
        result: spiralResult.finalOutput,
        reasoning: spiralResult.convergenceReason,
        confidence: spiralResult.overallConfidence * 100,
        quality: spiralResult.finalQualityScore,
        insights: spiralResult.lessonsLearned
      };
    }

    // Simple synthesis for less complex tasks
    const synthesisVoice: VoiceArchetype = {
      id: 'synthesizer',
      name: 'Result Synthesizer',
      systemPrompt: 'You synthesize execution results into clear, actionable outputs. Focus on clarity, completeness, and practical value.',
      temperature: 0.6,
      style: 'practical'
    };

    const synthesisPrompt = `Synthesis Task:

Execution Steps: ${execution.steps.length}
Tools Used: ${execution.toolsUsed.join(', ')}
Intermediate Result: ${execution.finalResult}

Please synthesize this into:
1. **Final Result**: Clear, actionable output
2. **Quality Assessment**: How well was the task completed?
3. **Key Insights**: What was learned during execution?
4. **Recommendations**: Next steps or improvements

Be thorough and practical in your synthesis.`;

    const response = await this.modelClient.generateVoiceResponse(
      synthesisVoice, 
      synthesisPrompt, 
      this.session.currentContext
    );

    return {
      result: this.extractFinalResult(response.content),
      reasoning: response.content,
      confidence: response.confidence * 100,
      quality: this.assessQuality(response.content),
      insights: this.extractInsights(response.content)
    };
  }

  /**
   * Perform self-assessment and learning
   */
  private async performSelfAssessment(synthesis: any, originalTask: string): Promise<{
    performance: number;
    learnings: string[];
    improvements: string[];
    capabilities: string[];
  }> {
    const assessorVoice: VoiceArchetype = {
      id: 'self-assessor',
      name: 'Self Assessor',
      systemPrompt: `You are a self-reflection expert. Analyze performance, extract learnings, and identify improvements.

Focus on:
- What worked well
- What could be improved
- New capabilities discovered
- Lessons for future tasks

Be honest and constructive in your assessment.`,
      temperature: 0.5,
      style: 'analytical'
    };

    const assessmentPrompt = `Self-Assessment Task:

Original Request: ${originalTask}
Final Result Quality: ${synthesis.quality}/100
Confidence: ${synthesis.confidence}/100
Reasoning Steps: ${this.session.completedSteps.length}

Performance Analysis:
${synthesis.reasoning}

Please assess:
1. **Performance Score**: Overall effectiveness (0-100)
2. **Key Learnings**: What was learned from this task?
3. **Improvement Areas**: What could be done better?
4. **New Capabilities**: What new abilities were demonstrated?

Be specific and actionable in your assessment.`;

    const response = await this.modelClient.generateVoiceResponse(
      assessorVoice, 
      assessmentPrompt, 
      this.session.currentContext
    );

    return {
      performance: this.extractPerformanceScore(response.content),
      learnings: this.extractLearnings(response.content),
      improvements: this.extractImprovements(response.content),
      capabilities: this.extractCapabilities(response.content)
    };
  }

  /**
   * Initialize available tools
   */
  private initializeTools(): Map<string, Function> {
    const tools = new Map<string, Function>();

    // File operations
    tools.set('read_file', async (params: any, context: ProjectContext) => {
      const filePath = this.resolvePath(params.path);
      try {
        const content = await readFile(filePath, 'utf-8');
        return { success: true, content, path: filePath };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    tools.set('write_file', async (params: any, context: ProjectContext) => {
      const filePath = this.resolvePath(params.path);
      try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, params.content, 'utf-8');
        return { success: true, path: filePath, size: params.content.length };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    tools.set('list_directory', async (params: any, context: ProjectContext) => {
      const dirPath = this.resolvePath(params.path || '.');
      try {
        const items = await readdir(dirPath, { withFileTypes: true });
        return {
          success: true,
          items: items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: join(dirPath, item.name)
          }))
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    tools.set('analyze_code', async (params: any, context: ProjectContext) => {
      // Simplified code analysis
      const filePath = this.resolvePath(params.path);
      try {
        const content = await readFile(filePath, 'utf-8');
        const analysis = {
          lines: content.split('\n').length,
          functions: (content.match(/function\s+\w+/g) || []).length,
          classes: (content.match(/class\s+\w+/g) || []).length,
          imports: (content.match(/import.*from/g) || []).length,
          language: this.detectLanguage(filePath),
          complexity: this.estimateComplexity(content)
        };
        return { success: true, analysis, path: filePath };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    tools.set('search_project', async (params: any, context: ProjectContext) => {
      // Simplified project search
      const pattern = params.pattern;
      const results: any[] = [];
      
      try {
        const searchPath = this.resolvePath(params.path || '.');
        await this.searchInDirectory(searchPath, pattern, results);
        return { success: true, results, pattern };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    return tools;
  }

  /**
   * Initialize agent capabilities
   */
  private initializeCapabilities(): string[] {
    return [
      'File reading and writing',
      'Directory exploration',
      'Code analysis',
      'Project search',
      'Multi-step reasoning',
      'Tool orchestration',
      'Self-reflection',
      'Living Spiral synthesis',
      'Voice coordination',
      'Error handling',
      'Learning and adaptation'
    ];
  }

  /**
   * Initialize agent limitations
   */
  private initializeLimitations(): string[] {
    return [
      'Cannot execute arbitrary system commands',
      'Limited to local file system access',
      'No internet access for research',
      'Cannot modify system settings',
      'Limited by available tools',
      'Reasoning depth bounded by max steps'
    ];
  }

  // Utility methods for parsing and extraction

  private extractTaskType(content: string): string {
    const match = content.match(/task\s*(?:type|classification)[:\s]*([^\n]+)/i);
    return match ? match[1].trim() : 'general';
  }

  private extractComplexity(content: string): number {
    const match = content.match(/complexity[:\s]*(\d+)/i);
    return match ? parseInt(match[1]) : 5;
  }

  private extractRequiredTools(content: string): string[] {
    const match = content.match(/required\s*tools[:\s]*([^\n]+)/i);
    if (!match) return [];
    
    return match[1].split(',').map(tool => tool.trim().toLowerCase());
  }

  private extractPlan(content: string): string[] {
    const lines = content.split('\n');
    const planStart = lines.findIndex(line => /plan|steps/i.test(line));
    if (planStart === -1) return [];
    
    return lines.slice(planStart + 1)
      .filter(line => line.trim().match(/^\d+\.|\-|\*/))
      .map(line => line.replace(/^\d+\.|\-|\*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 8);
  }

  private extractThought(content: string): string {
    const match = content.match(/thought[:\s]*([^\n]+)/i);
    return match ? match[1].trim() : content.split('\n')[0].trim();
  }

  private extractObservation(content: string): string {
    const match = content.match(/observation[:\s]*([^\n]+)/i);
    return match ? match[1].trim() : '';
  }

  private extractNextPlan(content: string): string[] {
    const match = content.match(/plan[:\s]*([^]*?)(?=tools|$)/i);
    if (!match) return [];
    
    return match[1].split('\n')
      .filter(line => line.trim().match(/^\d+\.|\-|\*/))
      .map(line => line.replace(/^\d+\.|\-|\*/, '').trim())
      .slice(0, 3);
  }

  private extractToolCalls(content: string): ToolCall[] {
    const tools: ToolCall[] = [];
    const toolPattern = /tool[:\s]*(\w+).*?action[:\s]*([^\n]+)/gi;
    let match;
    
    while ((match = toolPattern.exec(content)) !== null) {
      tools.push({
        tool: match[1].toLowerCase(),
        action: match[2].trim(),
        parameters: {},
        reasoning: '',
        expectedResult: ''
      });
    }
    
    return tools;
  }

  private extractLearnings(content: string): string[] {
    const match = content.match(/learning[s]?[:\s]*([^]*?)(?=\n\n|$)/i);
    if (!match) return [];
    
    return match[1].split('\n')
      .filter(line => line.trim().match(/^\d+\.|\-|\*/))
      .map(line => line.replace(/^\d+\.|\-|\*/, '').trim())
      .slice(0, 3);
  }

  private extractFinalResult(content: string): string {
    const match = content.match(/final\s*result[:\s]*([^]*?)(?=quality|key|$)/i);
    return match ? match[1].trim() : content;
  }

  private extractInsights(content: string): string[] {
    const match = content.match(/insights?[:\s]*([^]*?)(?=recommendations|$)/i);
    if (!match) return [];
    
    return match[1].split('\n')
      .filter(line => line.trim().match(/^\d+\.|\-|\*/))
      .map(line => line.replace(/^\d+\.|\-|\*/, '').trim())
      .slice(0, 5);
  }

  private extractPerformanceScore(content: string): number {
    const match = content.match(/performance[:\s]*(\d+)/i);
    return match ? parseInt(match[1]) : 75;
  }

  private extractImprovements(content: string): string[] {
    const match = content.match(/improvement[s]?[:\s]*([^]*?)(?=capabilities|$)/i);
    if (!match) return [];
    
    return match[1].split('\n')
      .filter(line => line.trim().match(/^\d+\.|\-|\*/))
      .map(line => line.replace(/^\d+\.|\-|\*/, '').trim())
      .slice(0, 3);
  }

  private extractCapabilities(content: string): string[] {
    const match = content.match(/capabilities[:\s]*([^]*?)$/i);
    if (!match) return [];
    
    return match[1].split('\n')
      .filter(line => line.trim().match(/^\d+\.|\-|\*/))
      .map(line => line.replace(/^\d+\.|\-|\*/, '').trim())
      .slice(0, 3);
  }

  // Helper methods

  private resolvePath(path: string): string {
    if (path.startsWith('/') || path.includes(':')) {
      return path; // Absolute path
    }
    return join(this.workingDirectory, path);
  }

  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby'
    };
    return langMap[ext] || 'unknown';
  }

  private estimateComplexity(content: string): number {
    let complexity = 1;
    complexity += (content.match(/if|while|for|switch/g) || []).length;
    complexity += (content.match(/function|class|interface/g) || []).length * 2;
    complexity += Math.floor(content.length / 1000);
    return Math.min(complexity, 10);
  }

  private async searchInDirectory(dirPath: string, pattern: string, results: any[]): Promise<void> {
    try {
      const items = await readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = join(dirPath, item.name);
        
        if (item.isDirectory() && !item.name.startsWith('.')) {
          await this.searchInDirectory(fullPath, pattern, results);
        } else if (item.isFile()) {
          try {
            const content = await readFile(fullPath, 'utf-8');
            if (content.includes(pattern)) {
              results.push({
                file: fullPath,
                matches: (content.match(new RegExp(pattern, 'g')) || []).length
              });
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be accessed
    }
  }

  private formatContextForReasoning(context: ProjectContext): string {
    let formatted = '';
    if (context.files && context.files.length > 0) {
      formatted += `Files in context: ${context.files.length}\n`;
    }
    if (context.projectType) {
      formatted += `Project type: ${context.projectType}\n`;
    }
    if (context.workingDirectory) {
      formatted += `Working directory: ${context.workingDirectory}\n`;
    }
    return formatted || 'No specific context provided';
  }

  private isTaskComplete(step: ReasoningStep, understanding: any): boolean {
    const completionIndicators = [
      'complete', 'finished', 'done', 'accomplished', 
      'task is complete', 'successfully completed'
    ];
    
    const stepText = step.thought.toLowerCase();
    return completionIndicators.some(indicator => stepText.includes(indicator));
  }

  private synthesizeStepsResult(steps: ReasoningStep[]): string {
    if (steps.length === 0) return 'No reasoning steps completed';
    
    const lastStep = steps[steps.length - 1];
    return lastStep.thought + (lastStep.observation ? `\n\nFinal observation: ${lastStep.observation}` : '');
  }

  private updateContextWithToolResult(
    context: ProjectContext, 
    toolCall: ToolCall, 
    result: any
  ): ProjectContext {
    // Update context based on tool results
    const updatedContext = { ...context };
    
    if (toolCall.tool === 'read_file' && result.success) {
      updatedContext.files = updatedContext.files || [];
      updatedContext.files.push({
        path: result.path,
        content: result.content,
        language: this.detectLanguage(result.path)
      });
    }
    
    return updatedContext;
  }

  private assessQuality(content: string): number {
    // Simple quality assessment based on content characteristics
    let score = 50;
    
    if (content.length > 100) score += 10;
    if (content.includes('specific') || content.includes('detailed')) score += 10;
    if (content.includes('example') || content.includes('code')) score += 10;
    if (content.includes('step') || content.includes('plan')) score += 10;
    if (content.includes('recommendation') || content.includes('suggestion')) score += 10;
    
    return Math.min(score, 100);
  }

  private estimateTokenUsage(synthesis: any): number {
    // Rough token estimation
    return Math.floor(synthesis.result.length / 4) + 
           Math.floor(synthesis.reasoning.length / 4);
  }

  private updateLearningHistory(learnings: string[]): void {
    this.session.learningHistory.push(...learnings);
    // Keep only the most recent 50 learnings
    if (this.session.learningHistory.length > 50) {
      this.session.learningHistory = this.session.learningHistory.slice(-50);
    }
  }

  /**
   * Get current session information
   */
  getSession(): AutonomousSession {
    return { ...this.session };
  }

  /**
   * Get agent capabilities summary
   */
  getCapabilitiesSummary(): {
    capabilities: string[];
    limitations: string[];
    performance: any;
    learningHistory: string[];
  } {
    return {
      capabilities: this.session.capabilities,
      limitations: this.session.limitations,
      performance: this.session.performance,
      learningHistory: this.session.learningHistory.slice(-10)
    };
  }
}