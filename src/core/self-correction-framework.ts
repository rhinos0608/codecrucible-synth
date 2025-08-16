import { LocalModelClient } from './local-model-client.js';
import { logger } from './logger.js';
import { Task, WorkflowContext } from './agent-orchestrator.js';

export interface CorrectionAction {
  action: 'retry' | 'modify_approach' | 'switch_model' | 'escalate' | 'abort';
  target?: string;
  modifications?: any;
  reasoning: string;
  confidence: number;
}

export interface FailureAnalysis {
  errorType: string;
  rootCause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  analysis: string;
  suggestions: string[];
  fallbackStrategy: string;
  preventionMeasures: string[];
}

export interface CorrectionHistory {
  timestamp: number;
  errorType: string;
  correction: CorrectionAction;
  success: boolean;
  improvedPerformance: boolean;
}

/**
 * Self-Correction Framework for Autonomous Error Recovery
 * 
 * Provides:
 * - Intelligent error analysis and categorization
 * - Adaptive correction strategies
 * - Learning from failures to prevent recurrence
 * - Performance improvement through feedback loops
 * - Escalation strategies for unrecoverable errors
 */
export class SelfCorrectionFramework {
  private model: LocalModelClient;
  private correctionHistory: CorrectionHistory[] = [];
  private knownErrorPatterns: Map<string, CorrectionAction[]> = new Map();

  constructor(model: LocalModelClient) {
    this.model = model;
    this.initializeKnownPatterns();
  }

  /**
   * Initialize known error patterns and their corrections
   */
  private initializeKnownPatterns(): void {
    // Common error patterns and their proven corrections
    const patterns = new Map<string, CorrectionAction[]>([
      ['TimeoutError', [
        {
          action: 'switch_model',
          target: 'faster_model',
          reasoning: 'Switch to a faster model to avoid timeouts',
          confidence: 0.8
        },
        {
          action: 'modify_approach',
          modifications: { maxIterations: 5, timeout: 60000 },
          reasoning: 'Reduce complexity and increase timeout',
          confidence: 0.7
        }
      ]],
      
      ['ModelConnectionError', [
        {
          action: 'retry',
          reasoning: 'Connection issues are often temporary',
          confidence: 0.9
        },
        {
          action: 'switch_model',
          target: 'fallback_model',
          reasoning: 'Use backup model if primary is unavailable',
          confidence: 0.8
        }
      ]],
      
      ['ParseError', [
        {
          action: 'modify_approach',
          modifications: { structured_output: false, retries: 3 },
          reasoning: 'Disable structured output and increase parsing retries',
          confidence: 0.8
        },
        {
          action: 'retry',
          reasoning: 'Parsing errors can be intermittent',
          confidence: 0.6
        }
      ]],
      
      ['ResourceNotFoundError', [
        {
          action: 'modify_approach',
          modifications: { explore_first: true },
          reasoning: 'Explore project structure before accessing specific resources',
          confidence: 0.9
        }
      ]],
      
      ['InvalidToolInputError', [
        {
          action: 'modify_approach',
          modifications: { validate_inputs: true, sanitize: true },
          reasoning: 'Add input validation and sanitization',
          confidence: 0.9
        }
      ]]
    ]);

    this.knownErrorPatterns = patterns;
    logger.info(`🔧 Initialized ${patterns.size} error correction patterns`);
  }

  /**
   * Analyze a general failure and provide correction strategies
   */
  async analyzeFailure(
    userInput: string,
    errorMessage: string,
    context: any
  ): Promise<FailureAnalysis> {
    try {
      const analysisPrompt = `Analyze this system failure and provide detailed insights for autonomous recovery:

USER INPUT: "${userInput}"
ERROR: "${errorMessage}"
CONTEXT: ${JSON.stringify(context, null, 2)}

Provide a comprehensive failure analysis addressing:

1. ERROR CLASSIFICATION:
   - What type of error is this?
   - What is the most likely root cause?
   - How severe is this failure?

2. RECOVERY ASSESSMENT:
   - Is this error recoverable?
   - What are the key factors preventing success?
   - What alternative approaches could work?

3. IMPROVEMENT SUGGESTIONS:
   - Specific actions to fix the immediate issue
   - System improvements to prevent recurrence
   - Better error handling strategies

4. FALLBACK STRATEGY:
   - What should the system do if this error persists?
   - How can we provide value despite the failure?

Format your response as a detailed analysis with clear sections and actionable recommendations.`;

      const response = await this.model.generate(analysisPrompt);
      
      return this.parseFailureAnalysis(response, errorMessage);

    } catch (error) {
      logger.error('Failure analysis failed:', error);
      
      // Provide basic fallback analysis
      return this.createFallbackAnalysis(errorMessage);
    }
  }

  /**
   * Analyze a specific task failure and provide targeted corrections
   */
  async analyzeTaskFailure(
    task: Task,
    errorMessage: string,
    workflowContext: WorkflowContext
  ): Promise<{
    retryWithModifications: boolean;
    modifiedTaskDescription?: string;
    modifiedContext?: any;
    escalateToHuman: boolean;
    alternativeApproach?: string;
  }> {
    try {
      // Check if we have known patterns for this error type
      const errorType = this.classifyError(errorMessage);
      const knownCorrections = this.knownErrorPatterns.get(errorType);
      
      if (knownCorrections && knownCorrections.length > 0) {
        // Use known correction patterns
        const bestCorrection = this.selectBestCorrection(knownCorrections, task, workflowContext);
        return this.applyKnownCorrection(bestCorrection, task);
      }

      // Use LLM for novel error analysis
      const correctionPrompt = `Analyze this task failure and provide specific correction strategies:

FAILED TASK:
- ID: ${task.id}
- Description: "${task.description}"
- Priority: ${task.priority}
- Error Count: ${task.errorCount}/${task.maxRetries}
- Estimated Complexity: ${task.estimatedComplexity}

ERROR: "${errorMessage}"

WORKFLOW CONTEXT:
- Completed Tasks: ${workflowContext.completedTasks.length}
- Failed Tasks: ${workflowContext.failedTasks.length}
- Current Confidence: ${Math.round(workflowContext.confidence * 100)}%
- Project Type: ${workflowContext.projectType || 'Unknown'}

ANALYSIS REQUIRED:
1. Is this task worth retrying with modifications?
2. What specific modifications would improve success likelihood?
3. Should this escalate to human intervention?
4. What alternative approach could achieve the same goal?

Respond with JSON:
{
  "retryWithModifications": boolean,
  "modifiedTaskDescription": "string or null",
  "modifiedContext": object or null,
  "escalateToHuman": boolean,
  "alternativeApproach": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}`;

      const response = await this.model.generate(correctionPrompt);
      const correction = this.parseCorrectionResponse(response);
      
      // Record this correction attempt
      this.recordCorrectionOutcome(errorType, {
        action: correction.retryWithModifications ? 'modify_approach' : 'abort',
        modifications: correction.modifiedContext,
        reasoning: correction.reasoning || 'LLM analysis',
        confidence: correction.confidence || 0.5
      }, correction.retryWithModifications);

      return correction;

    } catch (error) {
      logger.error('Task failure analysis failed:', error);
      
      // Simple fallback strategy
      return {
        retryWithModifications: task.errorCount < task.maxRetries - 1,
        escalateToHuman: task.priority === 'critical',
        alternativeApproach: 'Simplify task scope and retry with basic approach'
      };
    }
  }

  /**
   * Generate autonomous recovery actions
   */
  async generateRecoveryActions(
    errorType: string,
    context: any
  ): Promise<CorrectionAction[]> {
    // Check known patterns first
    const knownActions = this.knownErrorPatterns.get(errorType);
    if (knownActions) {
      return knownActions;
    }

    // Generate new recovery actions using LLM
    const recoveryPrompt = `Generate autonomous recovery actions for this error type:

ERROR TYPE: ${errorType}
CONTEXT: ${JSON.stringify(context, null, 2)}

Based on the error and context, provide a prioritized list of recovery actions.
Each action should be specific and executable by an autonomous system.

Respond with JSON array:
[
  {
    "action": "retry|modify_approach|switch_model|escalate|abort",
    "target": "optional_target_specification",
    "modifications": "optional_modification_object",
    "reasoning": "why_this_action_helps",
    "confidence": 0.0-1.0
  }
]

Prioritize actions by likelihood of success and safety.`;

    try {
      const response = await this.model.generate(recoveryPrompt);
      const actions = this.parseRecoveryActions(response);
      
      // Cache successful patterns for future use
      if (actions.length > 0) {
        this.knownErrorPatterns.set(errorType, actions);
      }
      
      return actions;

    } catch (error) {
      logger.warn('Failed to generate recovery actions:', error);
      
      // Return basic retry action as fallback
      return [{
        action: 'retry',
        reasoning: 'Basic retry as fallback recovery',
        confidence: 0.3
      }];
    }
  }

  /**
   * Learn from correction outcomes to improve future performance
   */
  recordCorrectionOutcome(
    errorType: string,
    correction: CorrectionAction,
    success: boolean,
    performanceImprovement: boolean = false
  ): void {
    const history: CorrectionHistory = {
      timestamp: Date.now(),
      errorType,
      correction,
      success,
      improvedPerformance: performanceImprovement
    };

    this.correctionHistory.push(history);

    // Keep only recent history (last 100 entries)
    if (this.correctionHistory.length > 100) {
      this.correctionHistory.shift();
    }

    // Update known patterns based on outcomes
    this.updateKnownPatterns(errorType, correction, success);

    logger.debug(`📊 Recorded correction outcome: ${errorType} -> ${success ? 'success' : 'failure'}`);
  }

  /**
   * Get insights about correction effectiveness
   */
  getCorrectionInsights(): any {
    const insights = {
      totalCorrections: this.correctionHistory.length,
      successRate: 0,
      mostEffectiveActions: [],
      problematicErrors: [],
      improvementTrends: []
    };

    if (this.correctionHistory.length === 0) {
      return insights;
    }

    // Calculate overall success rate
    const successes = this.correctionHistory.filter(h => h.success).length;
    insights.successRate = successes / this.correctionHistory.length;

    // Find most effective actions
    const actionEffectiveness = new Map<string, { total: number; successes: number }>();
    
    for (const history of this.correctionHistory) {
      const action = history.correction.action;
      const current = actionEffectiveness.get(action) || { total: 0, successes: 0 };
      current.total++;
      if (history.success) current.successes++;
      actionEffectiveness.set(action, current);
    }

    (insights.mostEffectiveActions as any[]) = Array.from(actionEffectiveness.entries())
      .map(([action, stats]) => ({
        action,
        successRate: stats.successes / stats.total,
        totalUses: stats.total
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // Find problematic error types
    const errorStats = new Map<string, { total: number; successes: number }>();
    
    for (const history of this.correctionHistory) {
      const errorType = history.errorType;
      const current = errorStats.get(errorType) || { total: 0, successes: 0 };
      current.total++;
      if (history.success) current.successes++;
      errorStats.set(errorType, current);
    }

    (insights.problematicErrors as any[]) = Array.from(errorStats.entries())
      .map(([errorType, stats]) => ({
        errorType,
        failureRate: 1 - (stats.successes / stats.total),
        totalOccurrences: stats.total
      }))
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 5);

    return insights;
  }

  /**
   * Classify error type for pattern matching
   */
  private classifyError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TimeoutError';
    }
    if (message.includes('connection') || message.includes('network')) {
      return 'ModelConnectionError';
    }
    if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
      return 'ParseError';
    }
    if (message.includes('not found') || message.includes('no such file')) {
      return 'ResourceNotFoundError';
    }
    if (message.includes('invalid') && message.includes('input')) {
      return 'InvalidToolInputError';
    }
    if (message.includes('permission') || message.includes('access denied')) {
      return 'PermissionError';
    }
    if (message.includes('memory') || message.includes('out of')) {
      return 'ResourceError';
    }
    
    // Try to extract error class name
    const classMatch = message.match(/(\w+error|\w+exception)/i);
    if (classMatch) {
      return classMatch[1];
    }
    
    return 'UnknownError';
  }

  /**
   * Select best correction from known patterns
   */
  private selectBestCorrection(
    corrections: CorrectionAction[],
    task: Task,
    context: WorkflowContext
  ): CorrectionAction {
    // Sort by confidence and historical success
    const scored = corrections.map(correction => {
      let score = correction.confidence;
      
      // Boost score based on historical success
      const historicalSuccess = this.getHistoricalSuccess(correction.action);
      score += historicalSuccess * 0.2;
      
      // Adjust based on task priority
      if (task.priority === 'critical' && correction.action === 'escalate') {
        score += 0.3;
      }
      
      // Adjust based on context
      if (context.failedTasks.length > 3 && correction.action === 'abort') {
        score += 0.2; // Prefer to abort if many failures
      }
      
      return { correction, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].correction;
  }

  /**
   * Get historical success rate for an action type
   */
  private getHistoricalSuccess(action: string): number {
    const relevant = this.correctionHistory.filter(h => h.correction.action === action);
    if (relevant.length === 0) return 0.5; // Neutral for unknown actions
    
    const successes = relevant.filter(h => h.success).length;
    return successes / relevant.length;
  }

  /**
   * Apply known correction pattern
   */
  private applyKnownCorrection(
    correction: CorrectionAction,
    task: Task
  ): any {
    switch (correction.action) {
      case 'modify_approach':
        return {
          retryWithModifications: true,
          modifiedTaskDescription: task.description + ' (with enhanced error handling)',
          modifiedContext: correction.modifications,
          escalateToHuman: false
        };
      
      case 'retry':
        return {
          retryWithModifications: true,
          escalateToHuman: false,
          alternativeApproach: 'Simple retry with same parameters'
        };
      
      case 'escalate':
        return {
          retryWithModifications: false,
          escalateToHuman: true,
          alternativeApproach: 'Human intervention required'
        };
      
      default:
        return {
          retryWithModifications: false,
          escalateToHuman: false,
          alternativeApproach: correction.reasoning
        };
    }
  }

  /**
   * Parse failure analysis from LLM response
   */
  private parseFailureAnalysis(response: string, errorMessage: string): FailureAnalysis {
    try {
      // Extract key information using patterns
      const analysis = {
        errorType: this.classifyError(errorMessage),
        rootCause: this.extractSection(response, /root cause|cause/i) || 'Unknown cause',
        severity: this.extractSeverity(response),
        isRecoverable: /recoverable|can be fixed|fixable/i.test(response),
        analysis: response.slice(0, 500), // First 500 chars as summary
        suggestions: this.extractSuggestions(response),
        fallbackStrategy: this.extractSection(response, /fallback|alternative/i) || 'Retry with simpler approach',
        preventionMeasures: this.extractPreventionMeasures(response)
      };

      return analysis;

    } catch (error) {
      logger.warn('Failed to parse failure analysis:', error);
      return this.createFallbackAnalysis(errorMessage);
    }
  }

  /**
   * Extract suggestions from analysis text
   */
  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    
    // Look for numbered lists
    const numberedMatches = text.match(/\d+\.\s*([^.\n]+)/g);
    if (numberedMatches) {
      suggestions.push(...numberedMatches.map(m => m.replace(/^\d+\.\s*/, '')));
    }
    
    // Look for bullet points
    const bulletMatches = text.match(/[-*]\s*([^.\n]+)/g);
    if (bulletMatches) {
      suggestions.push(...bulletMatches.map(m => m.replace(/^[-*]\s*/, '')));
    }
    
    // If no structured suggestions found, extract sentences with action words
    if (suggestions.length === 0) {
      const actionSentences = text.match(/[^.!?]*(?:should|must|need to|try|consider|implement)[^.!?]*[.!?]/g);
      if (actionSentences) {
        suggestions.push(...actionSentences.slice(0, 3));
      }
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Extract section content by header pattern
   */
  private extractSection(text: string, headerPattern: RegExp): string | null {
    const lines = text.split('\n');
    let inSection = false;
    const sectionLines: string[] = [];
    
    for (const line of lines) {
      if (headerPattern.test(line)) {
        inSection = true;
        continue;
      }
      
      if (inSection) {
        if (line.trim() === '' || /^\d+\.|^[A-Z][A-Z\s]+:/.test(line)) {
          break; // End of section
        }
        sectionLines.push(line);
      }
    }
    
    return sectionLines.length > 0 ? sectionLines.join(' ').trim() : null;
  }

  /**
   * Extract severity from analysis text
   */
  private extractSeverity(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('critical') || textLower.includes('severe')) {
      return 'critical';
    }
    if (textLower.includes('high') || textLower.includes('major')) {
      return 'high';
    }
    if (textLower.includes('low') || textLower.includes('minor')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Extract prevention measures from analysis
   */
  private extractPreventionMeasures(text: string): string[] {
    const measures: string[] = [];
    
    // Look for prevention-related content
    const preventionSection = this.extractSection(text, /prevent|avoid|improve/i);
    if (preventionSection) {
      measures.push(preventionSection);
    }
    
    // Look for improvement suggestions
    const improvements = text.match(/(?:improve|enhance|better)[^.!?]*[.!?]/gi);
    if (improvements) {
      measures.push(...improvements.slice(0, 3));
    }
    
    return measures;
  }

  /**
   * Parse correction response from LLM
   */
  private parseCorrectionResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse correction response:', error);
    }
    
    // Fallback parsing
    return {
      retryWithModifications: /retry.*modif|modify.*retry/i.test(response),
      escalateToHuman: /escalate|human|manual/i.test(response),
      confidence: 0.5,
      reasoning: 'Fallback parsing'
    };
  }

  /**
   * Parse recovery actions from LLM response
   */
  private parseRecoveryActions(response: string): CorrectionAction[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const actions = JSON.parse(jsonMatch[0]);
        return actions.map((action: any) => ({
          action: action.action || 'retry',
          target: action.target,
          modifications: action.modifications,
          reasoning: action.reasoning || 'No reasoning provided',
          confidence: Math.max(0, Math.min(1, action.confidence || 0.5))
        }));
      }
    } catch (error) {
      logger.warn('Failed to parse recovery actions:', error);
    }
    
    return [];
  }

  /**
   * Create fallback analysis when parsing fails
   */
  private createFallbackAnalysis(errorMessage: string): FailureAnalysis {
    return {
      errorType: this.classifyError(errorMessage),
      rootCause: 'Analysis failed - using fallback assessment',
      severity: 'medium',
      isRecoverable: true,
      analysis: `Automatic analysis failed. Error: ${errorMessage}`,
      suggestions: [
        'Retry the operation with modified parameters',
        'Check system resources and connectivity',
        'Simplify the task scope and try again'
      ],
      fallbackStrategy: 'Use basic retry strategy with reduced complexity',
      preventionMeasures: [
        'Improve error handling and validation',
        'Add more robust fallback mechanisms'
      ]
    };
  }

  /**
   * Update known patterns based on correction outcomes
   */
  private updateKnownPatterns(
    errorType: string,
    correction: CorrectionAction,
    success: boolean
  ): void {
    if (!success) return; // Only update patterns for successful corrections
    
    const existing = this.knownErrorPatterns.get(errorType) || [];
    
    // Check if this correction already exists
    const existingIndex = existing.findIndex(c => 
      c.action === correction.action && 
      JSON.stringify(c.modifications) === JSON.stringify(correction.modifications)
    );
    
    if (existingIndex >= 0) {
      // Boost confidence for successful corrections
      existing[existingIndex].confidence = Math.min(1.0, existing[existingIndex].confidence + 0.1);
    } else {
      // Add new successful correction pattern
      existing.push({
        ...correction,
        confidence: Math.min(1.0, correction.confidence + 0.2)
      });
    }
    
    // Keep only top 5 patterns per error type
    existing.sort((a, b) => b.confidence - a.confidence);
    this.knownErrorPatterns.set(errorType, existing.slice(0, 5));
  }
}