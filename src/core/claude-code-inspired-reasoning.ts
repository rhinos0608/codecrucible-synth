import { logger } from './logger.js';
import { BaseTool } from './tools/base-tool.js';

/**
 * Enhanced Claude Code Inspired Reasoning System
 * 
 * Fixes:
 * 1. Better tool availability checking
 * 2. Smarter progression through analysis phases
 * 3. More aggressive completion criteria
 * 4. Better context accumulation
 */

export interface CodebaseContext {
  projectType: string;
  framework: string;
  dependencies: string[];
  structure: {
    directories: Map<string, string[]>;
    keyFiles: Map<string, any>;
    codeStructure: any;
  };
  issues: {
    security: string[];
    performance: string[];
    maintainability: string[];
    bugs: string[];
  };
  recommendations: {
    immediate: string[];
    longTerm: string[];
    architectural: string[];
  };
}

export interface GoalState {
  primaryGoal: 'audit' | 'analyze' | 'debug' | 'optimize' | 'explore' | 'create' | 'generate';
  specificObjectives: string[];
  progressMetrics: {
    contextGathered: number;
    issuesIdentified: number;
    recommendationsGenerated: number;
    confidence: number;
  };
  completionCriteria: {
    minContextItems: number;
    minRecommendations: number;
    requiredConfidence: number;
    maxIterations: number;
  };
}

export interface ReasoningOutput {
  reasoning: string;
  selectedTool: string;
  toolInput: any;
  confidence: number;
  shouldComplete: boolean;
  completionReason?: string;
}

export class ClaudeCodeInspiredReasoning {
  private codebaseContext: CodebaseContext;
  private goalState: GoalState;
  private tools: BaseTool[];
  private iterationCount: number = 0;
  private maxIterations: number = 6; // Reduced from 12
  private usedTools: Map<string, number> = new Map(); // Track usage count per tool
  private lastToolOutputs: Map<string, string> = new Map(); // Track outputs to detect progress
  private availableToolNames: Set<string>;
  private model: any;
  private plan: { tool: string; input: any; }[] = [];
  
  constructor(tools: BaseTool[], userGoal: string, model: any) {
    this.tools = tools;
    this.availableToolNames = new Set(tools.map(t => t.definition.name));
    this.goalState = this.parseGoalFromInput(userGoal);
    this.codebaseContext = this.initializeContext();
    this.model = model;
    
    logger.info(`🎯 Enhanced reasoning for: ${this.goalState.primaryGoal}`);
    logger.info(`📋 Objectives: ${this.goalState.specificObjectives.slice(0, 3).join(', ')}`);
  }

  public async createPlan(): Promise<void> {
    if (!this.model) {
      logger.warn('Model not available, using fallback plan generation');
      this.generateFallbackPlan();
      return;
    }

    const prompt = `
    Given the current goal: "${this.goalState.primaryGoal}"
    And the following available tools:
    ${this.tools.map(t => `- ${t.definition.name}: ${t.definition.description}`).join('\n')}

    Create a plan to achieve the goal. The plan should be a sequence of tool calls. Respond with a JSON array of objects, where each object has "tool" and "input" keys.
    `;

    try {
      const llmResponse = await this.model.generate(prompt);
      this.plan = JSON.parse(llmResponse);
    } catch (e) {
      logger.error('Error parsing LLM response for plan creation:', e);
      this.generateFallbackPlan();
    }
  }

  private generateFallbackPlan(): void {
    // Generate a deterministic plan based on goal type
    switch (this.goalState.primaryGoal) {
      case 'audit':
        this.plan = [
          { tool: 'readCodeStructure', input: { projectPath: '.' } },
          { tool: 'listFiles', input: { path: '.' } },
          { tool: 'readFile', input: { filePath: 'package.json' } }
        ];
        break;
      case 'analyze':
        this.plan = [
          { tool: 'listFiles', input: { path: '.' } },
          { tool: 'readCodeStructure', input: { projectPath: '.' } }
        ];
        break;
      default:
        this.plan = [
          { tool: 'listFiles', input: { path: '.' } }
        ];
    }
    logger.info(`Generated fallback plan with ${this.plan.length} steps`);
  }

  /**
   * Main reasoning cycle with improved progression
   */

  public reason(previousObservation?: string): ReasoningOutput {
    this.iterationCount++;

    // Create a plan if we don't have one
    if (this.plan.length === 0) {
        this.createPlan();
    }

    // Process observation and check for lack of progress
    if (previousObservation) {
      const madeProgress = this.extractActionableContext(previousObservation);
      
      // If we're not making progress, force completion
      if (!madeProgress && this.iterationCount > 3) {
        logger.warn('⚠️ No progress detected, forcing completion');
        return this.forceCompletion('Limited progress - providing analysis based on available data');
      }
    }

    // Check completion more aggressively
    const completionCheck = this.assessCompletion();
    if (completionCheck.shouldComplete) {
      return {
        reasoning: completionCheck.reasoning,
        selectedTool: 'final_answer',
        toolInput: { answer: this.generateComprehensiveReport() },
        confidence: completionCheck.confidence,
        shouldComplete: true,
        completionReason: completionCheck.reason
      };
    }

    // Select next tool from the plan
    const toolSelection = this.selectNextToolFromPlan();
    
    // If no good tool available, complete
    if (!toolSelection) {
      return this.forceCompletion('Analysis phase complete');
    }
    
    // Track tool usage
    const currentCount = this.usedTools.get(toolSelection.tool) || 0;
    this.usedTools.set(toolSelection.tool, currentCount + 1);
    
    // Prevent excessive use of same tool
    if (currentCount >= 2) {
      logger.warn(`⚠️ Tool ${toolSelection.tool} used too many times, forcing progression`);
      return this.forceCompletion('Sufficient data gathered');
    }

    return {
      reasoning: this.generateProgressReasoning(toolSelection),
      selectedTool: toolSelection.tool,
      toolInput: toolSelection.input,
      confidence: 0.8, // High confidence since it's from a plan
      shouldComplete: false
    };
  }

  /**
   * Force completion with current knowledge
   */
  private forceCompletion(reason: string): ReasoningOutput {
    return {
      reasoning: reason,
      selectedTool: 'final_answer',
      toolInput: { answer: this.generateComprehensiveReport() },
      confidence: this.goalState.progressMetrics.confidence,
      shouldComplete: true,
      completionReason: reason
    };
  }

  /**
   * Select next best tool based on what we haven't tried yet
   */
  private selectNextToolFromPlan(): { tool: string; input: any; confidence: number } | null {
    if (this.plan.length > 0) {
        const nextStep = this.plan.shift()!;
        return { ...nextStep, confidence: 0.8 }; // Add default confidence
    }
    return null;
  }

  /**
   * Check if tool is available and hasn't been overused
   */
  private canUseTool(toolName: string): boolean {
    if (!this.availableToolNames.has(toolName)) {
      logger.debug(`Tool ${toolName} not available`);
      return false;
    }
    
    const usageCount = this.usedTools.get(toolName) || 0;
    return usageCount < 2; // Max 2 uses per tool
  }

  /**
   * Check if tool was used recently (within last 2 iterations)
   */
  private hasUsedToolRecently(toolName: string): boolean {
    return (this.usedTools.get(toolName) || 0) > 1;
  }

  /**
   * Parse user goal with adjusted expectations
   */
  private parseGoalFromInput(userGoal: string): GoalState {
    const goal = userGoal.toLowerCase();
    
    let primaryGoal: GoalState['primaryGoal'] = 'explore';
    let specificObjectives: string[] = [];
    let completionCriteria = {
      minContextItems: 2, // Reduced from 3
      minRecommendations: 1, // Reduced from 2
      requiredConfidence: 0.5, // Reduced from 0.6
      maxIterations: 5
    };

    if (goal.includes('audit') || goal.includes('thorough')) {
      primaryGoal = 'audit';
      specificObjectives = [
        'Understand project structure',
        'Identify key components',
        'Generate recommendations'
      ];
      completionCriteria.minContextItems = 3; // Reduced from 4
    } else if (goal.includes('analyze') || goal.includes('review')) {
      primaryGoal = 'analyze';
      specificObjectives = [
        'Explore codebase structure',
        'Identify patterns',
        'Provide insights'
      ];
    } else if (goal.includes('debug') || goal.includes('error')) {
      primaryGoal = 'debug';
      specificObjectives = [
        'Find error sources',
        'Analyze issues',
        'Suggest fixes'
      ];
    }

    return {
      primaryGoal,
      specificObjectives,
      progressMetrics: {
        contextGathered: 0,
        issuesIdentified: 0,
        recommendationsGenerated: 0,
        confidence: 0
      },
      completionCriteria
    };
  }

  /**
   * Extract context with progress detection
   */
  private extractActionableContext(observation: string): boolean {
    const previousContextCount = this.goalState.progressMetrics.contextGathered;
    
    try {
      // Check for errors first
      if (observation.includes('Error:') || observation.includes('not found')) {
        logger.debug('Tool returned error, no progress made');
        return false;
      }

      // Try parsing as JSON
      let data: any;
      try {
        data = JSON.parse(observation);
      } catch {
        // If not JSON, try to extract information from formatted text
        data = this.extractFromFormattedText(observation);
      }

      // Extract meaningful information
      let madeProgress = false;

      // Package.json info
      if (data.name || observation.includes('"name"')) {
        if (!this.codebaseContext.projectType || this.codebaseContext.projectType === 'unknown') {
          this.codebaseContext.projectType = 'Node.js project';
          this.goalState.progressMetrics.contextGathered++;
          madeProgress = true;
        }
      }

      // Dependencies
      if (data.dependencies) {
        const depCount = Object.keys(data.dependencies).length;
        if (depCount > 0 && this.codebaseContext.dependencies.length === 0) {
          this.codebaseContext.dependencies = Object.keys(data.dependencies);
          this.goalState.progressMetrics.contextGathered++;
          madeProgress = true;
        }
      }

      // File listing
      if (Array.isArray(data) && data.length > 0) {
        this.codebaseContext.structure.directories.set('.', data);
        this.goalState.progressMetrics.contextGathered++;
        madeProgress = true;
        
        // Generate findings
        const fileCount = data.length;
        const hasPackageJson = data.includes('package.json');
        const hasSrc = data.some(f => f.includes('src'));
        
        if (hasPackageJson) {
          this.codebaseContext.recommendations.immediate.push('Review package.json for dependencies');
        }
        if (hasSrc) {
          this.codebaseContext.recommendations.longTerm.push('Analyze source code structure');
        }
      }

      // Code structure from readCodeStructure (formatted text)
      if (data.projectType || data.totalFiles || data.frameworks) {
        this.codebaseContext.projectType = data.projectType || data.primaryLanguage || 'Unknown project type';
        if (data.frameworks && data.frameworks.length > 0) {
          this.codebaseContext.framework = data.frameworks[0];
        } else if (data.buildSystem) {
          this.codebaseContext.framework = data.buildSystem;
        }
        this.goalState.progressMetrics.contextGathered += 2;
        madeProgress = true;
        
        // Add recommendations based on findings
        if (data.totalFiles) {
          this.codebaseContext.recommendations.immediate.push(`Codebase contains ${data.totalFiles} files`);
        }
        if (data.frameworks && data.frameworks.length > 0) {
          this.codebaseContext.recommendations.immediate.push(`Uses ${data.frameworks.join(', ')} framework(s)`);
        }
      }

      // Update confidence
      this.updateProgressMetrics();

      return madeProgress;

    } catch (error) {
      logger.debug('Failed to extract context:', error);
      return false;
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
    
    return data;
  }

  /**
   * Generate comprehensive report based on what we have
   */
  private generateComprehensiveReport(): string {
    const report = [];

    report.push(`# ${this.goalState.primaryGoal.toUpperCase()} REPORT\n`);
    
    // Only include sections we have data for
    if (this.codebaseContext.projectType && this.codebaseContext.projectType !== 'unknown') {
      report.push(`## Project Overview`);
      report.push(`- **Type**: ${this.codebaseContext.projectType}`);
      if (this.codebaseContext.framework && this.codebaseContext.framework !== 'unknown') {
        report.push(`- **Framework**: ${this.codebaseContext.framework}`);
      }
      if (this.codebaseContext.dependencies.length > 0) {
        report.push(`- **Dependencies**: ${this.codebaseContext.dependencies.length} packages`);
      }
      report.push('');
    }

    // Add findings if any
    const totalIssues = 
      this.codebaseContext.issues.security.length +
      this.codebaseContext.issues.performance.length +
      this.codebaseContext.issues.maintainability.length +
      this.codebaseContext.issues.bugs.length;

    if (totalIssues > 0) {
      report.push(`## Issues Found (${totalIssues} total)`);
      if (this.codebaseContext.issues.security.length > 0) {
        report.push(`### Security (${this.codebaseContext.issues.security.length})`);
        this.codebaseContext.issues.security.forEach(issue => report.push(`- ${issue}`));
      }
      report.push('');
    }

    // Recommendations
    const totalRecs = 
      this.codebaseContext.recommendations.immediate.length +
      this.codebaseContext.recommendations.longTerm.length;

    if (totalRecs > 0) {
      report.push(`## Recommendations`);
      if (this.codebaseContext.recommendations.immediate.length > 0) {
        report.push(`### Immediate Actions`);
        this.codebaseContext.recommendations.immediate.forEach(rec => report.push(`- ${rec}`));
      }
      if (this.codebaseContext.recommendations.longTerm.length > 0) {
        report.push(`### Long-term Improvements`);
        this.codebaseContext.recommendations.longTerm.forEach(rec => report.push(`- ${rec}`));
      }
      report.push('');
    }

    // Summary
    report.push(`## Analysis Summary`);
    report.push(`- **Iterations**: ${this.iterationCount}`);
    report.push(`- **Context Items**: ${this.goalState.progressMetrics.contextGathered}`);
    report.push(`- **Confidence**: ${(this.goalState.progressMetrics.confidence * 100).toFixed(0)}%`);
    
    // If we have very little data, acknowledge it
    if (this.goalState.progressMetrics.contextGathered < 2) {
      report.push('\n*Note: Limited data was available for analysis. For more detailed insights, please ensure the codebase is accessible.*');
    }

    return report.join('\n');
  }

  private generateProgressReasoning(toolSelection: { tool: string; input: any; confidence?: number }): string {
    const progress = this.goalState.progressMetrics;
    const percentage = (this.iterationCount / this.maxIterations * 100).toFixed(0);
    
    return `[${percentage}% complete] Using ${toolSelection.tool} to ${this.getToolPurpose(toolSelection.tool)}. Context: ${progress.contextGathered} items gathered.`;
  }

  private getToolPurpose(toolName: string): string {
    const purposes: Record<string, string> = {
      'readCodeStructure': 'analyze overall project structure',
      'listFiles': 'explore file organization',
      'readFile': 'examine specific file contents',
      'gitStatus': 'check version control status',
      'lintCode': 'analyze code quality',
      'getAst': 'examine code structure',
      'final_answer': 'provide comprehensive analysis'
    };
    return purposes[toolName] || 'gather additional context';
  }

  private initializeContext(): CodebaseContext {
    return {
      projectType: 'unknown',
      framework: 'unknown',
      dependencies: [],
      structure: {
        directories: new Map(),
        keyFiles: new Map(),
        codeStructure: {}
      },
      issues: {
        security: [],
        performance: [],
        maintainability: [],
        bugs: []
      },
      recommendations: {
        immediate: [],
        longTerm: [],
        architectural: []
      }
    };
  }

  private updateProgressMetrics(): void {
    const metrics = this.goalState.progressMetrics;
    const criteria = this.goalState.completionCriteria;
    
    // More generous confidence calculation
    const contextProgress = Math.min(metrics.contextGathered / criteria.minContextItems, 1);
    const iterationProgress = this.iterationCount / this.maxIterations;
    
    // Boost confidence when we have some context
    metrics.confidence = Math.max(contextProgress * 0.7, iterationProgress * 0.5);
  }

  private assessCompletion(): { shouldComplete: boolean; confidence: number; reasoning: string; reason?: string } {
    const metrics = this.goalState.progressMetrics;
    const criteria = this.goalState.completionCriteria;
    
    // Force completion at max iterations
    if (this.iterationCount >= this.maxIterations) {
      return {
        shouldComplete: true,
        confidence: Math.max(metrics.confidence, 0.5), // Reduced from 0.6
        reasoning: 'Analysis complete',
        reason: 'Max iterations reached'
      };
    }

    // Complete if we have enough context (more lenient)
    if (metrics.contextGathered >= Math.max(1, criteria.minContextItems - 1)) {
      return {
        shouldComplete: true,
        confidence: metrics.confidence,
        reasoning: 'Sufficient data gathered',
        reason: 'Context criteria met'
      };
    }

    // Complete if confidence is high enough (more lenient)
    if (metrics.confidence >= Math.max(0.4, criteria.requiredConfidence - 0.1)) { // Reduced threshold
      return {
        shouldComplete: true,
        confidence: metrics.confidence,
        reasoning: 'Analysis confidence threshold reached',
        reason: 'Confidence criteria met'
      };
    }

    return {
      shouldComplete: false,
      confidence: metrics.confidence,
      reasoning: `Continuing analysis (${metrics.contextGathered}/${criteria.minContextItems} context)`
    };
  }
}
