import { logger } from './logger.js';
import { BaseTool } from './tools/base-tool.js';

/**
 * Improved ReAct Reasoning System
 * 
 * Implements the proper Reasoning → Acting → Observing pattern
 * with better tool selection, context building, and completion logic
 */

export interface ReasoningState {
  goalUnderstanding: string;
  currentHypothesis: string;
  evidenceGathered: string[];
  nextActionPlan: string;
  completionConfidence: number; // 0-1
  iterationContext: IterationContext;
}

export interface IterationContext {
  iterationNumber: number;
  maxIterations: number;
  phase: 'analyze_goal' | 'explore_structure' | 'examine_details' | 'synthesize_findings' | 'complete';
  toolsUsed: Set<string>;
  filesExamined: Set<string>;
  directoriesExplored: Set<string>;
  keyFindings: string[];
  blockers: string[];
}

export interface ReasoningOutput {
  reasoning: string;
  selectedTool: string;
  toolInput: any;
  confidence: number;
  shouldComplete: boolean;
  completionReason?: string;
}

export class ImprovedReActReasoning {
  private state: ReasoningState;
  private tools: BaseTool[];
  
  constructor(tools: BaseTool[], userGoal: string) {
    this.tools = tools;
    this.state = {
      goalUnderstanding: this.analyzeUserGoal(userGoal),
      currentHypothesis: '',
      evidenceGathered: [],
      nextActionPlan: '',
      completionConfidence: 0,
      iterationContext: {
        iterationNumber: 0,
        maxIterations: 8,
        phase: 'analyze_goal',
        toolsUsed: new Set(),
        filesExamined: new Set(),
        directoriesExplored: new Set(),
        keyFindings: [],
        blockers: []
      }
    };
  }

  /**
   * Main reasoning cycle - implements the ReAct pattern
   */
  public reason(previousObservation?: string): ReasoningOutput {
    // Update state with previous observation
    if (previousObservation) {
      this.processObservation(previousObservation);
    }

    // Check if we should complete
    const completionCheck = this.shouldComplete();
    if (completionCheck.shouldComplete) {
      return {
        reasoning: completionCheck.reasoning,
        selectedTool: 'final_answer',
        toolInput: { answer: this.synthesizeFindings() },
        confidence: this.state.completionConfidence,
        shouldComplete: true,
        completionReason: completionCheck.reason
      };
    }

    // Advance phase if needed
    this.advancePhaseIfReady();

    // Generate reasoning based on current phase
    const reasoning = this.generateContextualReasoning();
    
    // Select optimal tool and input
    const toolSelection = this.selectOptimalTool();
    
    // Update iteration context
    this.state.iterationContext.iterationNumber++;
    this.state.iterationContext.toolsUsed.add(toolSelection.tool);

    return {
      reasoning,
      selectedTool: toolSelection.tool,
      toolInput: toolSelection.input,
      confidence: toolSelection.confidence,
      shouldComplete: false
    };
  }

  /**
   * Process observation from tool execution
   */
  private processObservation(observation: string): void {
    this.state.evidenceGathered.push(observation);
    
    // Extract structured information from observation
    const findings = this.extractFindings(observation);
    this.state.iterationContext.keyFindings.push(...findings);
    
    // Update completion confidence
    this.updateCompletionConfidence();
    
    // Check for blockers
    const blockers = this.extractBlockers(observation);
    this.state.iterationContext.blockers.push(...blockers);
    
    logger.info(`🧠 Processed observation: ${findings.length} findings, confidence: ${this.state.completionConfidence.toFixed(2)}`);
  }

  /**
   * Analyze user goal to understand intent
   */
  private analyzeUserGoal(userGoal: string): string {
    const goal = userGoal.toLowerCase();
    
    if (goal.includes('audit') || goal.includes('review') || goal.includes('analyze')) {
      return 'comprehensive_analysis';
    } else if (goal.includes('files') || goal.includes('structure') || goal.includes('project')) {
      return 'structural_exploration';
    } else if (goal.includes('fix') || goal.includes('debug') || goal.includes('error')) {
      return 'problem_diagnosis';
    } else if (goal.includes('optimize') || goal.includes('improve') || goal.includes('performance')) {
      return 'optimization_analysis';
    } else {
      return 'general_exploration';
    }
  }

  /**
   * Generate contextual reasoning based on current phase and findings
   */
  private generateContextualReasoning(): string {
    const ctx = this.state.iterationContext;
    
    let reasoning = `Phase: ${ctx.phase.replace('_', ' ')} (${ctx.iterationNumber}/${ctx.maxIterations})\n`;
    reasoning += `Goal: ${this.state.goalUnderstanding}\n`;
    
    switch (ctx.phase) {
      case 'analyze_goal':
        reasoning += `I need to understand the project structure before proceeding with analysis. `;
        reasoning += `Starting with project root exploration.`;
        break;
        
      case 'explore_structure':
        reasoning += `I have ${ctx.directoriesExplored.size} directories explored. `;
        reasoning += `Need to examine key files to understand the codebase architecture.`;
        break;
        
      case 'examine_details':
        reasoning += `Found ${ctx.keyFindings.length} key findings so far. `;
        reasoning += `Need to dive deeper into specific files for detailed analysis.`;
        break;
        
      case 'synthesize_findings':
        reasoning += `Have gathered sufficient evidence (${this.state.evidenceGathered.length} observations). `;
        reasoning += `Performing final validation before conclusions.`;
        break;
        
      case 'complete':
        reasoning += `Analysis complete with ${ctx.keyFindings.length} findings. Ready to provide comprehensive answer.`;
        break;
    }
    
    // Add context about blockers if any
    if (ctx.blockers.length > 0) {
      reasoning += `\nBlockers encountered: ${ctx.blockers.slice(-2).join(', ')}`;
    }
    
    return reasoning;
  }

  /**
   * Select optimal tool based on current phase and context
   */
  private selectOptimalTool(): { tool: string; input: any; confidence: number } {
    const ctx = this.state.iterationContext;
    
    // Prevent repetitive tool usage
    const lastTool = Array.from(ctx.toolsUsed).slice(-1)[0];
    
    switch (ctx.phase) {
      case 'analyze_goal':
        // Start with autonomous code structure analysis
        return {
          tool: 'readCodeStructure',
          input: { path: '.', maxFiles: 50, includeContent: false },
          confidence: 0.9
        };
        
      case 'explore_structure':
        // If we haven't read package.json yet, prioritize that (for dependency analysis)
        if (!ctx.filesExamined.has('package.json') && lastTool !== 'readFiles') {
          return {
            tool: 'readFiles',
            input: { files: ['package.json'], includeMetadata: true },
            confidence: 0.95
          };
        }
        
        // If we haven't listed root files yet, do that
        if (!ctx.directoriesExplored.has('.') && lastTool !== 'listFiles') {
          ctx.directoriesExplored.add('.'); // Mark as explored to prevent repeat
          return {
            tool: 'listFiles',
            input: { path: '.' },
            confidence: 0.8
          };
        }
        
        // Read key configuration files if not done
        const keyFiles = ['tsconfig.json', 'src/index.ts', 'README.md'].filter(
          file => !ctx.filesExamined.has(file)
        );
        
        if (keyFiles.length > 0 && lastTool !== 'readFiles') {
          return {
            tool: 'readFiles',
            input: { files: keyFiles.slice(0, 2), includeMetadata: true },
            confidence: 0.7
          };
        }
        
        // If we've tried everything, advance to next phase
        return {
          tool: 'gitStatus',
          input: {},
          confidence: 0.6
        };
        
      case 'examine_details':
        // Look for specific analysis based on goal
        if (this.state.goalUnderstanding.includes('analysis') && !ctx.toolsUsed.has('analyzeCode')) {
          const srcFiles = Array.from(ctx.filesExamined).filter(f => f.includes('.ts') || f.includes('.js'));
          if (srcFiles.length > 0) {
            return {
              tool: 'analyzeCode',
              input: { files: srcFiles.slice(0, 3), analysisType: 'comprehensive' },
              confidence: 0.8
            };
          }
        }
        
        // Check git status if not done
        if (!ctx.toolsUsed.has('gitStatus')) {
          return {
            tool: 'gitStatus',
            input: {},
            confidence: 0.7
          };
        }
        
        // Run linting if available
        if (!ctx.toolsUsed.has('lintCode')) {
          const lintableFiles = Array.from(ctx.filesExamined).filter(f => 
            f.endsWith('.ts') || f.endsWith('.js')
          );
          if (lintableFiles.length > 0) {
            return {
              tool: 'lintCode',
              input: { path: lintableFiles[0] },
              confidence: 0.6
            };
          }
        }
        
        // Read additional source files
        return {
          tool: 'listFiles',
          input: { path: 'src' },
          confidence: 0.5
        };
        
      case 'synthesize_findings':
        // Final checks before completion
        if (!ctx.toolsUsed.has('gitDiff')) {
          return {
            tool: 'gitDiff',
            input: {},
            confidence: 0.6
          };
        }
        
        // Force completion
        return {
          tool: 'final_answer',
          input: { answer: this.synthesizeFindings() },
          confidence: this.state.completionConfidence
        };
        
      default:
        return {
          tool: 'listFiles',
          input: { path: '.' },
          confidence: 0.3
        };
    }
  }

  /**
   * Check if analysis should be completed
   */
  private shouldComplete(): { shouldComplete: boolean; reasoning: string; reason?: string } {
    const ctx = this.state.iterationContext;
    
    // Force completion if max iterations reached
    if (ctx.iterationNumber >= ctx.maxIterations) {
      return {
        shouldComplete: true,
        reasoning: 'Maximum iterations reached. Providing comprehensive analysis based on gathered evidence.',
        reason: 'max_iterations'
      };
    }
    
    // Complete if we have high confidence and sufficient evidence
    if (this.state.completionConfidence >= 0.8 && this.state.evidenceGathered.length >= 3) {
      return {
        shouldComplete: true,
        reasoning: 'High confidence analysis complete with sufficient evidence gathered.',
        reason: 'high_confidence'
      };
    }
    
    // Complete if we're in synthesize phase and have findings
    if (ctx.phase === 'synthesize_findings' && ctx.keyFindings.length >= 5) {
      return {
        shouldComplete: true,
        reasoning: 'Synthesis phase complete with comprehensive findings.',
        reason: 'synthesis_complete'
      };
    }
    
    // Complete if we've used many tools but hit blockers
    if (ctx.toolsUsed.size >= 6 && ctx.blockers.length >= 3) {
      return {
        shouldComplete: true,
        reasoning: 'Encountered multiple blockers despite tool usage. Providing analysis of accessible information.',
        reason: 'blocked_progress'
      };
    }
    
    return {
      shouldComplete: false,
      reasoning: 'Analysis incomplete. Need more evidence gathering.'
    };
  }

  /**
   * Advance to next phase based on progress
   */
  private advancePhaseIfReady(): void {
    const ctx = this.state.iterationContext;
    
    switch (ctx.phase) {
      case 'analyze_goal':
        if (ctx.toolsUsed.size >= 1) {
          ctx.phase = 'explore_structure';
          logger.info('🔄 Advanced to explore_structure phase');
        }
        break;
        
      case 'explore_structure':
        // More aggressive advancement - don't require too many files
        if (ctx.filesExamined.size >= 1 || ctx.iterationNumber >= 3) {
          ctx.phase = 'examine_details';
          logger.info('🔄 Advanced to examine_details phase');
        }
        break;
        
      case 'examine_details':
        // Advance if we have basic findings or used several tools
        if (ctx.keyFindings.length >= 2 || ctx.toolsUsed.size >= 4) {
          ctx.phase = 'synthesize_findings';
          logger.info('🔄 Advanced to synthesize_findings phase');
        }
        break;
        
      case 'synthesize_findings':
        // Complete quickly if we have any findings
        if (ctx.keyFindings.length >= 1 || ctx.iterationNumber >= 6) {
          ctx.phase = 'complete';
          logger.info('🔄 Advanced to complete phase');
        }
        break;
    }
  }

  /**
   * Extract findings from tool observation
   */
  private extractFindings(observation: string): string[] {
    const findings: string[] = [];
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(observation);
      
      if (Array.isArray(parsed)) {
        findings.push(`Found ${parsed.length} items in directory listing`);
        
        // Track examined files/directories
        for (const item of parsed) {
          if (typeof item === 'string') {
            if (item.includes('.')) {
              this.state.iterationContext.filesExamined.add(item);
            } else {
              this.state.iterationContext.directoriesExplored.add(item);
            }
          }
        }
      } else if (parsed.name || parsed.description || parsed.version) {
        findings.push(`Package info: ${parsed.name || 'unnamed'} v${parsed.version || 'unknown'}`);
        if (parsed.description) {
          findings.push(`Description: ${parsed.description}`);
        }
      } else if (parsed.branch || parsed.staged !== undefined) {
        findings.push(`Git status: ${JSON.stringify(parsed)}`);
      }
    } catch {
      // Handle plain text observations
      if (observation.includes('package.json')) {
        findings.push('Package configuration file examined');
        this.state.iterationContext.filesExamined.add('package.json');
      }
      
      if (observation.includes('tsconfig.json')) {
        findings.push('TypeScript configuration examined');
        this.state.iterationContext.filesExamined.add('tsconfig.json');
      }
      
      if (observation.includes('error') || observation.includes('Error')) {
        findings.push('Error detected in analysis');
      }
      
      if (observation.length > 100) {
        findings.push('Detailed file content analyzed');
      }
    }
    
    return findings;
  }

  /**
   * Extract blockers from observation
   */
  private extractBlockers(observation: string): string[] {
    const blockers: string[] = [];
    
    if (observation.includes('not found') || observation.includes('does not exist')) {
      blockers.push('File/directory not found');
    }
    
    if (observation.includes('permission denied') || observation.includes('access denied')) {
      blockers.push('Permission denied');
    }
    
    if (observation.includes('error') || observation.includes('Error')) {
      blockers.push('Tool execution error');
    }
    
    return blockers;
  }

  /**
   * Update completion confidence based on gathered evidence
   */
  private updateCompletionConfidence(): void {
    const ctx = this.state.iterationContext;
    
    let confidence = 0;
    
    // Base confidence from tools used
    confidence += Math.min(ctx.toolsUsed.size * 0.1, 0.4);
    
    // Confidence from files examined
    confidence += Math.min(ctx.filesExamined.size * 0.05, 0.3);
    
    // Confidence from findings
    confidence += Math.min(ctx.keyFindings.length * 0.03, 0.2);
    
    // Penalty for blockers
    confidence -= ctx.blockers.length * 0.05;
    
    // Phase bonus
    const phaseBonus = {
      'analyze_goal': 0.0,
      'explore_structure': 0.1,
      'examine_details': 0.2,
      'synthesize_findings': 0.3,
      'complete': 0.4
    };
    confidence += phaseBonus[ctx.phase] || 0;
    
    this.state.completionConfidence = Math.max(0, Math.min(1, confidence));
  }

  /**
   * Synthesize findings into comprehensive answer
   */
  private synthesizeFindings(): string {
    const ctx = this.state.iterationContext;
    
    let synthesis = `## Comprehensive Analysis Results\n\n`;
    
    // Analysis scope
    synthesis += `**Analysis Scope:**\n`;
    synthesis += `- Tools used: ${Array.from(ctx.toolsUsed).join(', ')}\n`;
    synthesis += `- Files examined: ${ctx.filesExamined.size}\n`;
    synthesis += `- Directories explored: ${ctx.directoriesExplored.size}\n`;
    synthesis += `- Confidence level: ${(this.state.completionConfidence * 100).toFixed(0)}%\n\n`;
    
    // Key findings
    if (ctx.keyFindings.length > 0) {
      synthesis += `**Key Findings:**\n`;
      ctx.keyFindings.forEach((finding, i) => {
        synthesis += `${i + 1}. ${finding}\n`;
      });
      synthesis += '\n';
    }
    
    // Files examined
    if (ctx.filesExamined.size > 0) {
      synthesis += `**Files Analyzed:**\n`;
      Array.from(ctx.filesExamined).forEach(file => {
        synthesis += `- ${file}\n`;
      });
      synthesis += '\n';
    }
    
    // Issues/blockers if any
    if (ctx.blockers.length > 0) {
      synthesis += `**Issues Encountered:**\n`;
      ctx.blockers.forEach((blocker, i) => {
        synthesis += `- ${blocker}\n`;
      });
      synthesis += '\n';
    }
    
    // Recommendations
    synthesis += `**Recommendations:**\n`;
    if (ctx.filesExamined.size < 3) {
      synthesis += `- Consider examining more key files for deeper analysis\n`;
    }
    if (!ctx.toolsUsed.has('gitStatus')) {
      synthesis += `- Check git repository status for development context\n`;
    }
    if (!ctx.toolsUsed.has('lintCode')) {
      synthesis += `- Run code linting for quality assessment\n`;
    }
    
    synthesis += `\nAnalysis completed with ${ctx.iterationNumber} iterations.`;
    
    return synthesis;
  }
}