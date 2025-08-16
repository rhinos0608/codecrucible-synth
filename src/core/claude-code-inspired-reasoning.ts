import { logger } from './logger.js';
import { BaseTool } from './tools/base-tool.js';

/**
 * Claude Code Inspired Reasoning System
 * 
 * Implements effective patterns observed in Claude Code:
 * 1. Goal-driven tool selection
 * 2. Context accumulation and rich understanding
 * 3. Specific, actionable outputs
 * 4. Multi-step workflow with clear progression
 * 5. Quality completion criteria
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
  primaryGoal: 'audit' | 'analyze' | 'debug' | 'optimize' | 'explore';
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
  private maxIterations: number = 12;
  private usedTools: Set<string> = new Set();
  
  constructor(tools: BaseTool[], userGoal: string) {
    this.tools = tools;
    this.goalState = this.parseGoalFromInput(userGoal);
    this.codebaseContext = this.initializeContext();
    
    logger.info(`🎯 Initialized goal-driven reasoning for: ${this.goalState.primaryGoal}`);
    logger.info(`📋 Objectives: ${this.goalState.specificObjectives.join(', ')}`);
  }

  /**
   * Main reasoning cycle - follows Claude Code's goal-driven approach
   */
  public reason(previousObservation?: string): ReasoningOutput {
    this.iterationCount++;

    // Process previous observation with rich context extraction
    if (previousObservation) {
      this.extractActionableContext(previousObservation);
    }

    // Check if we can complete with high-quality output
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

    // Select tool based on goal and current context gaps
    const toolSelection = this.selectGoalDrivenTool();
    
    // Track tool usage to prevent loops
    this.usedTools.add(toolSelection.tool);
    
    // Generate contextual reasoning
    const reasoning = this.generateProgressReasoning(toolSelection);

    return {
      reasoning,
      selectedTool: toolSelection.tool,
      toolInput: toolSelection.input,
      confidence: toolSelection.confidence,
      shouldComplete: false
    };
  }

  /**
   * Parse user goal into structured objectives (like Claude Code's context analysis)
   */
  private parseGoalFromInput(userGoal: string): GoalState {
    const goal = userGoal.toLowerCase();
    
    let primaryGoal: GoalState['primaryGoal'] = 'explore';
    let specificObjectives: string[] = [];
    let completionCriteria = {
      minContextItems: 5,
      minRecommendations: 3,
      requiredConfidence: 0.8
    };

    if (goal.includes('audit') || goal.includes('thorough')) {
      primaryGoal = 'audit';
      specificObjectives = [
        'Analyze project structure and architecture',
        'Identify security vulnerabilities',
        'Review code quality and maintainability',
        'Check performance bottlenecks',
        'Evaluate dependencies and configuration',
        'Generate actionable recommendations'
      ];
      completionCriteria = {
        minContextItems: 8,
        minRecommendations: 5,
        requiredConfidence: 0.85
      };
    } else if (goal.includes('analyze') || goal.includes('review')) {
      primaryGoal = 'analyze';
      specificObjectives = [
        'Understand codebase structure',
        'Identify architectural patterns',
        'Review key components',
        'Assess code quality',
        'Provide improvement suggestions'
      ];
    } else if (goal.includes('debug') || goal.includes('fix') || goal.includes('error')) {
      primaryGoal = 'debug';
      specificObjectives = [
        'Identify error sources',
        'Analyze stack traces and logs',
        'Check configuration issues',
        'Review recent changes',
        'Provide fix recommendations'
      ];
    } else if (goal.includes('optimize') || goal.includes('performance')) {
      primaryGoal = 'optimize';
      specificObjectives = [
        'Profile performance bottlenecks',
        'Analyze memory usage patterns',
        'Review algorithmic complexity',
        'Check resource utilization',
        'Suggest optimization strategies'
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
   * Extract actionable context from observations (Claude Code's rich context building)
   */
  private extractActionableContext(observation: string): void {
    try {
      // Try to parse structured data
      let data: any;
      try {
        data = JSON.parse(observation);
      } catch {
        data = { raw: observation };
      }

      // Extract project type and framework information
      if (data.packageJson || observation.includes('package.json')) {
        this.analyzePackageInfo(data);
      }

      // Extract file structure information from readCodeStructure results
      if (data.projectType || data.framework || data.totalFiles || observation.includes('Discovered') || observation.includes('TypeScript project')) {
        this.analyzeProjectStructure(data);
      }

      // Extract code structure information
      if (data.definitions || data.classes || data.keyFiles || observation.includes('function') || observation.includes('class') || observation.includes('definitions')) {
        this.analyzeCodeStructure(data);
      }

      // Extract issues and problems
      if (observation.includes('error') || observation.includes('warning') || observation.includes('deprecated')) {
        this.extractIssues(observation);
      }

      // Extract files information
      if (data.files || data.totalFiles || observation.includes('files')) {
        this.analyzeFileStructure(data, observation);
      }

      // Update progress metrics
      this.updateProgressMetrics();

      logger.info(`🧠 Context updated: ${this.goalState.progressMetrics.contextGathered} items, confidence: ${this.goalState.progressMetrics.confidence.toFixed(2)}`);

    } catch (error) {
      logger.warn(`⚠️ Failed to extract context from observation: ${error}`);
    }
  }

  /**
   * Select tool based on goal and context gaps (Claude Code's smart tool selection)
   */
  private selectGoalDrivenTool(): { tool: string; input: any; confidence: number } {
    // Check what context we're missing for our goal
    const contextGaps = this.identifyContextGaps();
    
    // Prioritize based on goal and missing context, but avoid recently used tools
    for (const gap of contextGaps) {
      switch (gap.type) {
        case 'project_structure':
          if (!this.usedTools.has('readCodeStructure')) {
            return {
              tool: 'readCodeStructure',
              input: { path: '.', maxFiles: 50, includeContent: true },
              confidence: 0.9
            };
          }
          // If readCodeStructure was already used, try file listing
          return {
            tool: 'listFiles',
            input: { path: '.', recursive: true },
            confidence: 0.8
          };

        case 'package_analysis':
          return {
            tool: 'readFiles',
            input: { 
              files: ['package.json', 'package-lock.json', 'yarn.lock'], 
              includeMetadata: true 
            },
            confidence: 0.95
          };

        case 'configuration_analysis':
          return {
            tool: 'readFiles',
            input: { 
              files: ['tsconfig.json', '.eslintrc.js', 'webpack.config.js', 'vite.config.ts'],
              includeMetadata: true 
            },
            confidence: 0.85
          };

        case 'security_analysis':
          return {
            tool: 'searchFiles',
            input: { 
              pattern: '(password|secret|token|api_key|private_key)',
              includeLineNumbers: true 
            },
            confidence: 0.8
          };

        case 'performance_analysis':
          return {
            tool: 'analyzeCode',
            input: { 
              type: 'performance',
              includeComplexity: true 
            },
            confidence: 0.8
          };

        case 'git_context':
          return {
            tool: 'gitStatus',
            input: {},
            confidence: 0.7
          };

        case 'dependencies_check':
          return {
            tool: 'executeCommand',
            input: { 
              command: 'npm audit --audit-level=moderate --json',
              timeout: 30000 
            },
            confidence: 0.75
          };
      }
    }

    // Fallback to directory listing if no specific gaps identified
    return {
      tool: 'listFiles',
      input: { path: '.', recursive: true },
      confidence: 0.6
    };
  }

  /**
   * Identify what context we're missing to achieve our goal
   */
  private identifyContextGaps(): Array<{ type: string; priority: number; reasoning: string }> {
    const gaps: Array<{ type: string; priority: number; reasoning: string }> = [];

    // Check if we understand the project structure (but only if not already analyzed)
    if (Object.keys(this.codebaseContext.structure.directories).length === 0 && this.codebaseContext.projectType === 'unknown') {
      gaps.push({
        type: 'project_structure',
        priority: 10,
        reasoning: 'Need to understand project layout and architecture'
      });
    }

    // Check if we have package information
    if (this.codebaseContext.dependencies.length === 0) {
      gaps.push({
        type: 'package_analysis',
        priority: 9,
        reasoning: 'Need to analyze dependencies and project configuration'
      });
    }

    // Goal-specific context gaps
    switch (this.goalState.primaryGoal) {
      case 'audit':
        if (this.codebaseContext.issues.security.length === 0) {
          gaps.push({
            type: 'security_analysis',
            priority: 8,
            reasoning: 'Audit requires security vulnerability assessment'
          });
        }
        if (this.codebaseContext.issues.performance.length === 0) {
          gaps.push({
            type: 'performance_analysis',
            priority: 7,
            reasoning: 'Audit requires performance bottleneck identification'
          });
        }
        gaps.push({
          type: 'dependencies_check',
          priority: 6,
          reasoning: 'Audit requires dependency vulnerability scan'
        });
        break;

      case 'optimize':
        gaps.push({
          type: 'performance_analysis',
          priority: 9,
          reasoning: 'Optimization requires performance profiling'
        });
        break;

      case 'debug':
        gaps.push({
          type: 'git_context',
          priority: 8,
          reasoning: 'Debugging requires understanding recent changes'
        });
        break;
    }

    // Check if we need configuration analysis
    if (!this.codebaseContext.structure.keyFiles.has('tsconfig.json') && !this.codebaseContext.structure.keyFiles.has('package.json')) {
      gaps.push({
        type: 'configuration_analysis',
        priority: 7,
        reasoning: 'Need to understand build and configuration setup'
      });
    }

    // Sort by priority (highest first)
    return gaps.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate comprehensive report (Claude Code's actionable output style)
   */
  private generateComprehensiveReport(): string {
    const report = [];

    // Executive Summary
    report.push(`# ${this.goalState.primaryGoal.toUpperCase()} REPORT\n`);
    
    // Project Overview
    report.push(`## Project Overview`);
    report.push(`- **Type**: ${this.codebaseContext.projectType}`);
    report.push(`- **Framework**: ${this.codebaseContext.framework}`);
    report.push(`- **Dependencies**: ${this.codebaseContext.dependencies.length} packages`);
    report.push('');

    // Key Findings
    if (this.codebaseContext.issues.security.length > 0) {
      report.push(`## 🔒 Security Issues (${this.codebaseContext.issues.security.length})`);
      this.codebaseContext.issues.security.forEach((issue, i) => {
        report.push(`${i + 1}. ${issue}`);
      });
      report.push('');
    }

    if (this.codebaseContext.issues.performance.length > 0) {
      report.push(`## ⚡ Performance Issues (${this.codebaseContext.issues.performance.length})`);
      this.codebaseContext.issues.performance.forEach((issue, i) => {
        report.push(`${i + 1}. ${issue}`);
      });
      report.push('');
    }

    if (this.codebaseContext.issues.maintainability.length > 0) {
      report.push(`## 🔧 Maintainability Issues (${this.codebaseContext.issues.maintainability.length})`);
      this.codebaseContext.issues.maintainability.forEach((issue, i) => {
        report.push(`${i + 1}. ${issue}`);
      });
      report.push('');
    }

    // Recommendations
    if (this.codebaseContext.recommendations.immediate.length > 0) {
      report.push(`## 🚀 Immediate Actions Required`);
      this.codebaseContext.recommendations.immediate.forEach((rec, i) => {
        report.push(`${i + 1}. ${rec}`);
      });
      report.push('');
    }

    if (this.codebaseContext.recommendations.longTerm.length > 0) {
      report.push(`## 📈 Long-term Improvements`);
      this.codebaseContext.recommendations.longTerm.forEach((rec, i) => {
        report.push(`${i + 1}. ${rec}`);
      });
      report.push('');
    }

    // Architecture Analysis
    if (this.codebaseContext.recommendations.architectural.length > 0) {
      report.push(`## 🏗️ Architectural Recommendations`);
      this.codebaseContext.recommendations.architectural.forEach((rec, i) => {
        report.push(`${i + 1}. ${rec}`);
      });
      report.push('');
    }

    // Context Summary
    report.push(`## 📊 Analysis Context`);
    report.push(`- **Files Analyzed**: ${this.codebaseContext.structure.keyFiles.size}`);
    report.push(`- **Issues Identified**: ${this.goalState.progressMetrics.issuesIdentified}`);
    report.push(`- **Recommendations**: ${this.goalState.progressMetrics.recommendationsGenerated}`);
    report.push(`- **Confidence Level**: ${(this.goalState.progressMetrics.confidence * 100).toFixed(1)}%`);

    return report.join('\n');
  }

  private generateProgressReasoning(toolSelection: { tool: string; input: any; confidence: number }): string {
    const progress = this.goalState.progressMetrics;
    const objective = this.goalState.specificObjectives[Math.min(progress.contextGathered, this.goalState.specificObjectives.length - 1)];
    
    return `**Iteration ${this.iterationCount}**: Working on "${objective}" (${progress.contextGathered}/${this.goalState.completionCriteria.minContextItems} context items gathered, ${(progress.confidence * 100).toFixed(1)}% confidence). Selected ${toolSelection.tool} to gather additional context about the codebase.`;
  }

  // Helper methods for context analysis
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

  private analyzePackageInfo(data: any): void {
    try {
      const pkg = data.packageJson || data;
      if (pkg.dependencies || pkg.devDependencies) {
        this.codebaseContext.dependencies = [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {})
        ];
        
        // Identify framework
        if (pkg.dependencies?.react) this.codebaseContext.framework = 'React';
        else if (pkg.dependencies?.vue) this.codebaseContext.framework = 'Vue';
        else if (pkg.dependencies?.angular) this.codebaseContext.framework = 'Angular';
        else if (pkg.dependencies?.express) this.codebaseContext.framework = 'Express';
        else if (pkg.dependencies?.next) this.codebaseContext.framework = 'Next.js';
        
        // Identify project type
        if (pkg.dependencies?.electron) this.codebaseContext.projectType = 'Electron App';
        else if (this.codebaseContext.framework !== 'unknown') this.codebaseContext.projectType = 'Web Application';
        else if (pkg.bin) this.codebaseContext.projectType = 'CLI Tool';
        else this.codebaseContext.projectType = 'Node.js Package';

        this.goalState.progressMetrics.contextGathered++;
      }
    } catch (error) {
      logger.warn('Failed to analyze package info:', error);
    }
  }

  private analyzeProjectStructure(data: any): void {
    try {
      // Extract project type and framework from readCodeStructure output
      if (data.projectType && this.codebaseContext.projectType === 'unknown') {
        this.codebaseContext.projectType = data.projectType;
        this.goalState.progressMetrics.contextGathered++;
      }
      
      if (data.framework && this.codebaseContext.framework === 'unknown') {
        this.codebaseContext.framework = data.framework;
        this.goalState.progressMetrics.contextGathered++;
      }

      // Mark that we've analyzed project structure
      if (data.totalFiles || data.directories) {
        this.codebaseContext.structure.directories.set('analyzed', ['true']);
        this.goalState.progressMetrics.contextGathered++;
      }
    } catch (error) {
      logger.warn('Failed to analyze project structure:', error);
    }
  }

  private analyzeCodeStructure(data: any): void {
    try {
      // Extract code definitions and structure
      if (data.definitions || data.keyFiles) {
        this.codebaseContext.structure.codeStructure = data;
        this.goalState.progressMetrics.contextGathered++;
      }
    } catch (error) {
      logger.warn('Failed to analyze code structure:', error);
    }
  }

  private analyzeFileStructure(data: any, observation: string): void {
    try {
      // Extract file information
      if (data.files && Array.isArray(data.files)) {
        data.files.forEach((file: any) => {
          if (file.path) {
            this.codebaseContext.structure.keyFiles.set(file.path, file);
          }
        });
        this.goalState.progressMetrics.contextGathered++;
      } else if (observation.includes('total') && observation.includes('files')) {
        // Extract file count information
        this.goalState.progressMetrics.contextGathered++;
      }
    } catch (error) {
      logger.warn('Failed to analyze file structure:', error);
    }
  }

  private extractIssues(observation: string): void {
    // Extract security issues
    if (observation.includes('password') || observation.includes('secret')) {
      this.codebaseContext.issues.security.push('Potential hardcoded secrets detected');
      this.codebaseContext.recommendations.immediate.push('Review and secure sensitive data handling');
    }

    // Extract performance issues
    if (observation.includes('nested loop') || observation.includes('O(n²)')) {
      this.codebaseContext.issues.performance.push('Inefficient algorithm detected');
      this.codebaseContext.recommendations.longTerm.push('Optimize algorithmic complexity');
    }

    this.goalState.progressMetrics.issuesIdentified++;
  }

  private updateProgressMetrics(): void {
    const metrics = this.goalState.progressMetrics;
    const criteria = this.goalState.completionCriteria;
    
    // Calculate confidence based on progress
    const contextProgress = Math.min(metrics.contextGathered / criteria.minContextItems, 1);
    const recommendationProgress = Math.min(metrics.recommendationsGenerated / criteria.minRecommendations, 1);
    
    metrics.confidence = (contextProgress + recommendationProgress) / 2;
  }

  private assessCompletion(): { shouldComplete: boolean; confidence: number; reasoning: string; reason?: string } {
    const metrics = this.goalState.progressMetrics;
    const criteria = this.goalState.completionCriteria;
    
    // Check if we've reached iteration limit
    if (this.iterationCount >= this.maxIterations) {
      return {
        shouldComplete: true,
        confidence: metrics.confidence,
        reasoning: `Reached maximum iterations (${this.maxIterations}). Providing analysis based on gathered context.`,
        reason: 'Max iterations reached'
      };
    }

    // Check if we've met completion criteria
    const hasEnoughContext = metrics.contextGathered >= criteria.minContextItems;
    const hasEnoughRecommendations = metrics.recommendationsGenerated >= criteria.minRecommendations;
    const hasHighConfidence = metrics.confidence >= criteria.requiredConfidence;

    if (hasEnoughContext && hasEnoughRecommendations && hasHighConfidence) {
      return {
        shouldComplete: true,
        confidence: metrics.confidence,
        reasoning: `${this.goalState.primaryGoal} complete with high confidence analysis.`,
        reason: 'Quality criteria met'
      };
    }

    return {
      shouldComplete: false,
      confidence: metrics.confidence,
      reasoning: `Continuing analysis: ${metrics.contextGathered}/${criteria.minContextItems} context, ${metrics.recommendationsGenerated}/${criteria.minRecommendations} recommendations, ${(metrics.confidence * 100).toFixed(1)}% confidence`
    };
  }
}