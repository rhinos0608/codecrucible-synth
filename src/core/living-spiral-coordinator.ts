/**
 * Living Spiral Methodology Coordinator
 * 
 * Implements the 5-phase Living Spiral methodology from the AI Coding Grimoire:
 * 1. Collapse → Decompose complexity into manageable atoms
 * 2. Council → Gather diverse perspectives and expertise  
 * 3. Synthesis → Merge wisdom into a unified design
 * 4. Rebirth → Implement, test, and deploy
 * 5. Reflection → Learn, adapt, and re-enter the spiral
 */

import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { LocalModelClient, VoiceResponse, VoiceArchetype, ProjectContext } from './local-model-client.js';
import { AgentResponse, SynthesisResponse, ResponseFactory } from './response-types.js';
import { AdvancedSynthesisResult, SynthesisMode } from './advanced-synthesis-engine.js';
import { logger } from './logger.js';

export interface SpiralPhaseResult {
  phase: SpiralPhase;
  content: string;
  voicesUsed: string[];
  confidence: number;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface SpiralIteration {
  iterationNumber: number;
  phases: SpiralPhaseResult[];
  finalResult: string;
  qualityScore: number;
  converged: boolean;
  startTime: number;
  endTime: number;
  totalDuration: number;
}

export interface LivingSpiralResult {
  iterations: SpiralIteration[];
  finalOutput: string;
  finalQualityScore: number;
  totalIterations: number;
  convergenceReason: string;
  overallConfidence: number;
  lessonsLearned: string[];
  recommendedNextSteps: string[];
  timestamp: number;
}

export enum SpiralPhase {
  COLLAPSE = 'collapse',
  COUNCIL = 'council', 
  SYNTHESIS = 'synthesis',
  REBIRTH = 'rebirth',
  REFLECTION = 'reflection'
}

export interface SpiralConfig {
  maxIterations: number;
  convergenceThreshold: number;
  qualityThreshold: number;
  enableAdaptiveLearning: boolean;
  voiceSelectionStrategy: 'auto' | 'fixed' | 'adaptive';
  synthesisMode: SynthesisMode;
  reflectionDepth: 'shallow' | 'medium' | 'deep';
}

/**
 * Living Spiral Coordinator
 * 
 * Orchestrates the 5-phase spiral methodology for complex problem solving
 * using multiple AI voice archetypes in structured collaboration.
 */
export class LivingSpiralCoordinator {
  private voiceSystem: VoiceArchetypeSystem;
  private modelClient: LocalModelClient;
  private defaultConfig: SpiralConfig = {
    maxIterations: 3,
    convergenceThreshold: 0.85,
    qualityThreshold: 85,
    enableAdaptiveLearning: true,
    voiceSelectionStrategy: 'adaptive',
    synthesisMode: SynthesisMode.ADAPTIVE,
    reflectionDepth: 'medium'
  };

  constructor(voiceSystem: VoiceArchetypeSystem, modelClient: LocalModelClient) {
    this.voiceSystem = voiceSystem;
    this.modelClient = modelClient;
  }

  /**
   * Execute the complete Living Spiral methodology for a complex task
   */
  async executeLivingSpiral(
    initialTask: string,
    context: ProjectContext,
    config: Partial<SpiralConfig> = {}
  ): Promise<LivingSpiralResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const iterations: SpiralIteration[] = [];
    let currentTask = initialTask;
    let previousQuality = 0;
    let converged = false;
    let convergenceReason = '';

    logger.info(`🌀 Starting Living Spiral execution: "${initialTask.substring(0, 50)}..."`);
    console.log(`🌀 Living Spiral Methodology - Processing: "${initialTask.substring(0, 60)}..."`);

    for (let iterationNum = 1; iterationNum <= finalConfig.maxIterations && !converged; iterationNum++) {
      console.log(`\n🔄 Spiral Iteration ${iterationNum}/${finalConfig.maxIterations}`);
      const iterationStart = Date.now();

      try {
        const iteration = await this.executeSpiralIteration(
          currentTask,
          context,
          finalConfig,
          iterationNum,
          iterations
        );

        iterations.push(iteration);

        // Check for convergence
        const qualityImprovement = iteration.qualityScore - previousQuality;
        const convergenceCheck = this.checkConvergence(
          iteration,
          qualityImprovement,
          finalConfig,
          iterationNum
        );

        converged = convergenceCheck.converged;
        convergenceReason = convergenceCheck.reason;

        if (converged) {
          console.log(`🎯 Spiral converged: ${convergenceReason}`);
          break;
        }

        // Prepare for next iteration using reflection insights
        const lastPhase = iteration.phases.find(p => p.phase === SpiralPhase.REFLECTION);
        if (lastPhase && lastPhase.metadata.nextIterationTask) {
          currentTask = lastPhase.metadata.nextIterationTask;
        }

        previousQuality = iteration.qualityScore;

      } catch (error) {
        logger.error(`Spiral iteration ${iterationNum} failed:`, error);
        convergenceReason = `Error in iteration ${iterationNum}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        break;
      }
    }

    if (!converged && iterations.length === finalConfig.maxIterations) {
      convergenceReason = 'Maximum iterations reached without convergence';
    }

    const result = this.compileFinalResult(iterations, convergenceReason, finalConfig);
    
    console.log(`\n🌀 Living Spiral Complete:`);
    console.log(`   📊 Final Quality Score: ${result.finalQualityScore}/100`);
    console.log(`   🔄 Total Iterations: ${result.totalIterations}`);
    console.log(`   🎯 Convergence: ${result.convergenceReason}`);
    console.log(`   📚 Lessons Learned: ${result.lessonsLearned.length}`);

    return result;
  }

  /**
   * Execute a single spiral iteration through all 5 phases
   */
  private async executeSpiralIteration(
    task: string,
    context: ProjectContext,
    config: SpiralConfig,
    iterationNum: number,
    previousIterations: SpiralIteration[]
  ): Promise<SpiralIteration> {
    const phases: SpiralPhaseResult[] = [];
    const iterationStart = Date.now();

    console.log(`   Phase 1/5: 💥 Collapse (Decomposition)`);
    const collapseResult = await this.executeCollapsePhase(task, context, previousIterations);
    phases.push(collapseResult);

    console.log(`   Phase 2/5: 🏛️ Council (Perspectives)`);
    const councilResult = await this.executeCouncilPhase(collapseResult.content, context, config);
    phases.push(councilResult);

    console.log(`   Phase 3/5: ⚗️ Synthesis (Integration)`);
    const synthesisResult = await this.executeSynthesisPhase(
      councilResult.metadata.councilResponses,
      config.synthesisMode,
      context
    );
    phases.push(synthesisResult);

    console.log(`   Phase 4/5: 🚀 Rebirth (Implementation)`);
    const rebirthResult = await this.executeRebirthPhase(synthesisResult.content, context);
    phases.push(rebirthResult);

    console.log(`   Phase 5/5: 🔍 Reflection (Learning)`);
    const reflectionResult = await this.executeReflectionPhase(
      phases,
      config,
      iterationNum,
      previousIterations,
      context
    );
    phases.push(reflectionResult);

    const iterationEnd = Date.now();
    const qualityScore = this.calculateIterationQuality(phases);

    return {
      iterationNumber: iterationNum,
      phases,
      finalResult: rebirthResult.content,
      qualityScore,
      converged: false, // Will be determined by convergence check
      startTime: iterationStart,
      endTime: iterationEnd,
      totalDuration: iterationEnd - iterationStart
    };
  }

  /**
   * Phase 1: Collapse - Decompose complexity into manageable atoms
   */
  private async executeCollapsePhase(
    task: string,
    context: ProjectContext,
    previousIterations: SpiralIteration[]
  ): Promise<SpiralPhaseResult> {
    const decomposerVoice: VoiceArchetype = {
      id: 'decomposer',
      name: 'Decomposer',
      systemPrompt: 'You are the Decomposer, a master of breaking down complex problems into manageable atomic components. Your role is to analyze complex tasks and decompose them into clear, actionable subtasks that can be addressed systematically.',
      temperature: 0.4,
      style: 'analytical'
    };

    let prompt = `LIVING SPIRAL - COLLAPSE PHASE

Task to Decompose: ${task}

Your mission is to break this task down into its atomic components. Analyze the complexity and create a structured decomposition that identifies:

1. Core problem atoms (fundamental issues to solve)
2. Dependencies and relationships between components
3. Risk factors and complexity hotspots
4. Priority ordering of components
5. Resource requirements for each component

`;

    // Include lessons from previous iterations if available
    if (previousIterations.length > 0) {
      const previousLessons = previousIterations
        .flatMap(iter => iter.phases)
        .filter(phase => phase.phase === SpiralPhase.REFLECTION)
        .map(phase => phase.metadata.lessons || [])
        .flat()
        .slice(-3); // Last 3 lessons

      if (previousLessons.length > 0) {
        prompt += `Previous Spiral Lessons:
${previousLessons.map((lesson, i) => `${i + 1}. ${lesson}`).join('\n')}

Consider these lessons in your decomposition.

`;
      }
    }

    prompt += `Provide a structured breakdown with clear priorities and actionable components.`;

    const response = await this.modelClient.generateVoiceResponse(decomposerVoice, prompt, context);

    return {
      phase: SpiralPhase.COLLAPSE,
      content: response.content,
      voicesUsed: ['decomposer'],
      confidence: response.confidence,
      timestamp: Date.now(),
      metadata: {
        decompositionComplexity: this.analyzeDecompositionComplexity(response.content),
        componentCount: this.extractComponentCount(response.content),
        riskFactors: this.extractRiskFactors(response.content)
      }
    };
  }

  /**
   * Phase 2: Council - Gather diverse perspectives and expertise
   */
  private async executeCouncilPhase(
    decomposedTask: string,
    context: ProjectContext,
    config: SpiralConfig
  ): Promise<SpiralPhaseResult> {
    // Select council voices based on task analysis
    const councilVoices = this.selectCouncilVoices(decomposedTask, config.voiceSelectionStrategy);

    const councilPrompt = `LIVING SPIRAL - COUNCIL PHASE

Decomposed Task Analysis:
${decomposedTask}

As a council member, provide your specialized perspective on this decomposed task. Focus on:

1. Your domain-specific insights and recommendations
2. Potential challenges and opportunities from your viewpoint  
3. Critical considerations that others might miss
4. Proposed approaches that align with your expertise
5. Integration points with other specialties

Be specific and actionable in your recommendations. This is a collaborative effort where all voices matter.`;

    // Generate responses from all council voices in parallel for efficiency
    const councilPromises = councilVoices.map(voiceId => 
      this.voiceSystem.generateSingleVoiceResponse(councilPrompt, voiceId, context)
        .catch(error => {
          logger.warn(`Council voice ${voiceId} failed:`, error);
          return null;
        })
    );

    const councilResponses = (await Promise.all(councilPromises))
      .filter(response => response !== null) as VoiceResponse[];

    if (councilResponses.length === 0) {
      throw new Error('No council voices provided valid responses');
    }

    // Combine council perspectives
    const combinedPerspectives = councilResponses
      .map(response => `**${response.voice} Perspective:**\n${response.content}`)
      .join('\n\n---\n\n');

    const avgConfidence = councilResponses.reduce((sum, r) => sum + r.confidence, 0) / councilResponses.length;

    return {
      phase: SpiralPhase.COUNCIL,
      content: combinedPerspectives,
      voicesUsed: councilResponses.map(r => r.voice),
      confidence: avgConfidence,
      timestamp: Date.now(),
      metadata: {
        councilResponses: councilResponses.map(r => ResponseFactory.createAgentResponse(r.content, {
          confidence: r.confidence,
          voiceId: r.voice,
          tokensUsed: r.tokens_used,
          reasoning: r.reasoning
        })),
        consensusLevel: this.analyzeConsensus(councilResponses),
        conflictAreas: this.identifyConflicts(councilResponses)
      }
    };
  }

  /**
   * Phase 3: Synthesis - Merge wisdom into a unified design
   */
  private async executeSynthesisPhase(
    councilResponses: AgentResponse[],
    synthesisMode: SynthesisMode,
    context: ProjectContext
  ): Promise<SpiralPhaseResult> {
    // Use the advanced synthesis engine for this phase
    const synthesisResult = await this.voiceSystem.synthesizeAdvanced(councilResponses, {
      mode: synthesisMode,
      qualityThreshold: 80,
      enableAdaptiveSynthesis: true,
      maxIterations: 2
    });

    return {
      phase: SpiralPhase.SYNTHESIS,
      content: synthesisResult.combinedContent,
      voicesUsed: synthesisResult.voicesUsed,
      confidence: synthesisResult.confidence,
      timestamp: Date.now(),
      metadata: {
        synthesisStrategy: synthesisResult.synthesisStrategy,
        qualityMetrics: synthesisResult.qualityMetrics,
        conflictAnalysis: synthesisResult.conflictAnalysis,
        voiceWeights: synthesisResult.voiceWeights,
        adaptiveAdjustments: synthesisResult.adaptiveAdjustments
      }
    };
  }

  /**
   * Phase 4: Rebirth - Implement, test, and deploy
   */
  private async executeRebirthPhase(
    synthesizedDesign: string,
    context: ProjectContext
  ): Promise<SpiralPhaseResult> {
    const implementerVoice: VoiceArchetype = {
      id: 'implementer',
      name: 'Implementer',
      systemPrompt: 'You are the Implementer, focused on turning designs into working reality. You excel at practical implementation, testing strategies, deployment planning, and ensuring that theoretical designs become robust, production-ready solutions.',
      temperature: 0.5,
      style: 'practical'
    };

    const implementationPrompt = `LIVING SPIRAL - REBIRTH PHASE

Synthesized Design:
${synthesizedDesign}

Your mission is to transform this design into actionable implementation. Provide:

1. **Implementation Plan**: Step-by-step execution strategy
2. **Code Structure**: Concrete code examples and architecture
3. **Testing Strategy**: Comprehensive testing approach
4. **Deployment Considerations**: Production readiness checklist
5. **Quality Gates**: Specific criteria for success
6. **Risk Mitigation**: Implementation risks and countermeasures

Focus on practical, implementable solutions that can be executed immediately. Include working code examples where appropriate.`;

    const response = await this.modelClient.generateVoiceResponse(implementerVoice, implementationPrompt, context);

    return {
      phase: SpiralPhase.REBIRTH,
      content: response.content,
      voicesUsed: ['implementer'],
      confidence: response.confidence,
      timestamp: Date.now(),
      metadata: {
        implementationComplexity: this.analyzeImplementationComplexity(response.content),
        codeBlocks: this.extractCodeBlocks(response.content),
        testingStrategy: this.extractTestingStrategy(response.content),
        deploymentReadiness: this.assessDeploymentReadiness(response.content)
      }
    };
  }

  /**
   * Phase 5: Reflection - Learn, adapt, and re-enter the spiral
   */
  private async executeReflectionPhase(
    phases: SpiralPhaseResult[],
    config: SpiralConfig,
    iterationNum: number,
    previousIterations: SpiralIteration[],
    context: ProjectContext = { files: [] }
  ): Promise<SpiralPhaseResult> {
    const reflectorVoice: VoiceArchetype = {
      id: 'reflector',
      name: 'Reflector',
      systemPrompt: 'You are the Reflector, a master of learning and adaptation. You analyze processes, outcomes, and experiences to extract valuable lessons and guide future improvements. You excel at pattern recognition and continuous improvement.',
      temperature: 0.6,
      style: 'analytical'
    };

    const phasesSummary = phases.map(phase => 
      `**${phase.phase.toUpperCase()} Phase** (Confidence: ${Math.round(phase.confidence * 100)}%):\n${phase.content.substring(0, 300)}...`
    ).join('\n\n');

    let reflectionPrompt = `LIVING SPIRAL - REFLECTION PHASE

Iteration ${iterationNum} Summary:
${phasesSummary}

Analyze this spiral iteration and provide:

1. **Quality Assessment**: Overall effectiveness of this iteration
2. **Lessons Learned**: Key insights and discoveries
3. **Pattern Recognition**: Recurring themes and successful approaches
4. **Improvement Opportunities**: What could be done better
5. **Next Iteration Guidance**: How to improve the next spiral turn
6. **Convergence Assessment**: Is the solution converging or needs refinement?

`;

    if (previousIterations.length > 0) {
      const totalPreviousIterations = previousIterations.length;
      const previousQuality = previousIterations[previousIterations.length - 1]?.qualityScore || 0;
      
      reflectionPrompt += `Previous Context:
- Total previous iterations: ${totalPreviousIterations}
- Previous quality score: ${previousQuality}/100
- Trend analysis: ${this.analyzeTrend(previousIterations)}

Consider this historical context in your reflection.

`;
    }

    reflectionPrompt += `Provide specific, actionable insights for continuous improvement.`;

    const response = await this.modelClient.generateVoiceResponse(reflectorVoice, reflectionPrompt, context);

    const lessons = this.extractLessons(response.content);
    const qualityAssessment = this.extractQualityAssessment(response.content);
    const convergenceAssessment = this.extractConvergenceAssessment(response.content);
    const nextIterationTask = this.extractNextIterationTask(response.content);

    return {
      phase: SpiralPhase.REFLECTION,
      content: response.content,
      voicesUsed: ['reflector'],
      confidence: response.confidence,
      timestamp: Date.now(),
      metadata: {
        lessons,
        qualityAssessment,
        convergenceAssessment,
        nextIterationTask,
        improvementOpportunities: this.extractImprovementOpportunities(response.content),
        patternRecognition: this.extractPatterns(response.content)
      }
    };
  }

  /**
   * Select appropriate council voices based on task analysis
   */
  private selectCouncilVoices(task: string, strategy: string): string[] {
    const baseVoices = this.voiceSystem.selectOptimalVoices(task, 4);
    
    switch (strategy) {
      case 'fixed':
        return ['developer', 'analyzer', 'security', 'maintainer'];
      
      case 'adaptive':
        // Always include core voices, then add specialized ones based on task
        const coreVoices = ['developer', 'analyzer'];
        const specializedVoices = baseVoices.filter(v => !coreVoices.includes(v));
        return [...coreVoices, ...specializedVoices.slice(0, 2)];
      
      case 'auto':
      default:
        return baseVoices;
    }
  }

  /**
   * Check if the spiral has converged
   */
  private checkConvergence(
    iteration: SpiralIteration,
    qualityImprovement: number,
    config: SpiralConfig,
    iterationNum: number
  ): { converged: boolean; reason: string } {
    // Quality threshold reached
    if (iteration.qualityScore >= config.qualityThreshold) {
      return { converged: true, reason: `Quality threshold reached (${iteration.qualityScore}/${config.qualityThreshold})` };
    }

    // Reflection phase indicates convergence
    const reflectionPhase = iteration.phases.find(p => p.phase === SpiralPhase.REFLECTION);
    if (reflectionPhase?.metadata.convergenceAssessment?.converged) {
      return { converged: true, reason: 'Reflection analysis indicates convergence' };
    }

    // Minimal quality improvement
    if (iterationNum > 1 && qualityImprovement < 5 && iteration.qualityScore > 70) {
      return { converged: true, reason: `Minimal quality improvement (${qualityImprovement.toFixed(1)} points)` };
    }

    // High confidence with good quality
    if (iteration.qualityScore > 80 && iteration.phases.every(p => p.confidence > 0.8)) {
      return { converged: true, reason: 'High confidence across all phases with good quality' };
    }

    return { converged: false, reason: 'Convergence criteria not met' };
  }

  /**
   * Calculate overall quality score for an iteration
   */
  private calculateIterationQuality(phases: SpiralPhaseResult[]): number {
    let score = 0;
    const weights = {
      [SpiralPhase.COLLAPSE]: 0.15,
      [SpiralPhase.COUNCIL]: 0.25,
      [SpiralPhase.SYNTHESIS]: 0.30,
      [SpiralPhase.REBIRTH]: 0.25,
      [SpiralPhase.REFLECTION]: 0.05
    };

    for (const phase of phases) {
      const phaseScore = phase.confidence * 100;
      const weight = weights[phase.phase] || 0.2;
      score += phaseScore * weight;
    }

    // Bonus for synthesis quality metrics
    const synthesisPhase = phases.find(p => p.phase === SpiralPhase.SYNTHESIS);
    if (synthesisPhase?.metadata.qualityMetrics) {
      const synthesisQuality = synthesisPhase.metadata.qualityMetrics.overall;
      score = (score * 0.8) + (synthesisQuality * 0.2);
    }

    return Math.min(Math.max(Math.round(score), 0), 100);
  }

  /**
   * Compile final result from all iterations
   */
  private compileFinalResult(
    iterations: SpiralIteration[],
    convergenceReason: string,
    config: SpiralConfig
  ): LivingSpiralResult {
    const bestIteration = iterations.reduce((best, current) => 
      current.qualityScore > best.qualityScore ? current : best
    );

    const allLessons = iterations
      .flatMap(iter => iter.phases)
      .filter(phase => phase.phase === SpiralPhase.REFLECTION)
      .flatMap(phase => phase.metadata.lessons || []);

    const allPatterns = iterations
      .flatMap(iter => iter.phases)
      .filter(phase => phase.phase === SpiralPhase.REFLECTION)
      .flatMap(phase => phase.metadata.patternRecognition || []);

    const avgConfidence = iterations.reduce((sum, iter) => {
      const iterAvg = iter.phases.reduce((pSum, phase) => pSum + phase.confidence, 0) / iter.phases.length;
      return sum + iterAvg;
    }, 0) / iterations.length;

    return {
      iterations,
      finalOutput: bestIteration.finalResult,
      finalQualityScore: bestIteration.qualityScore,
      totalIterations: iterations.length,
      convergenceReason,
      overallConfidence: avgConfidence,
      lessonsLearned: [...new Set(allLessons)], // Remove duplicates
      recommendedNextSteps: this.generateNextSteps(iterations, allPatterns),
      timestamp: Date.now()
    };
  }

  // Utility methods for analysis and extraction

  private analyzeDecompositionComplexity(content: string): number {
    const componentIndicators = [
      /\d+\./g, // Numbered lists
      /[-*]/g,  // Bullet points
      /component|module|part|element/gi
    ];
    
    let complexity = 0;
    componentIndicators.forEach(pattern => {
      complexity += (content.match(pattern) || []).length;
    });
    
    return Math.min(complexity / 10, 1); // Normalize to 0-1
  }

  private extractComponentCount(content: string): number {
    const numbered = content.match(/\d+\./g) || [];
    const bulleted = content.match(/^[-*]\s/gm) || [];
    return numbered.length + bulleted.length;
  }

  private extractRiskFactors(content: string): string[] {
    const riskKeywords = ['risk', 'challenge', 'difficult', 'complex', 'issue', 'problem'];
    const sentences = content.split(/[.!?]+/);
    
    return sentences
      .filter(sentence => riskKeywords.some(keyword => 
        sentence.toLowerCase().includes(keyword)
      ))
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 10)
      .slice(0, 5);
  }

  private analyzeConsensus(responses: VoiceResponse[]): number {
    // Simplified consensus analysis - in reality would use NLP
    const avgLength = responses.reduce((sum, r) => sum + r.content.length, 0) / responses.length;
    const lengthVariance = responses.reduce((sum, r) => 
      sum + Math.pow(r.content.length - avgLength, 2), 0) / responses.length;
    
    // Lower variance = higher consensus
    return Math.max(0, 1 - (Math.sqrt(lengthVariance) / avgLength));
  }

  private identifyConflicts(responses: VoiceResponse[]): string[] {
    // Simplified conflict detection
    const conflicts: string[] = [];
    
    // Look for contradictory keywords
    const contradictions = [
      ['fast', 'slow'], ['simple', 'complex'], ['secure', 'risky'],
      ['scalable', 'limited'], ['flexible', 'rigid']
    ];
    
    for (const [term1, term2] of contradictions) {
      const hasTerm1 = responses.some(r => r.content.toLowerCase().includes(term1));
      const hasTerm2 = responses.some(r => r.content.toLowerCase().includes(term2));
      
      if (hasTerm1 && hasTerm2) {
        conflicts.push(`${term1} vs ${term2}`);
      }
    }
    
    return conflicts;
  }

  private analyzeImplementationComplexity(content: string): number {
    const complexityIndicators = [
      /```/g, // Code blocks
      /class|function|interface/gi,
      /import|require|from/gi,
      /async|await|promise/gi
    ];
    
    let complexity = 0;
    complexityIndicators.forEach(pattern => {
      complexity += (content.match(pattern) || []).length;
    });
    
    return Math.min(complexity / 20, 1);
  }

  private extractCodeBlocks(content: string): string[] {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const matches = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }

  private extractTestingStrategy(content: string): string {
    const testingSections = content.match(/testing[\s\S]*?(?=\n\n|\n#|$)/gi);
    return testingSections ? testingSections[0] : '';
  }

  private assessDeploymentReadiness(content: string): number {
    const readinessIndicators = [
      'deployment', 'production', 'monitoring', 'logging',
      'scaling', 'security', 'backup', 'rollback'
    ];
    
    const matches = readinessIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator)
    );
    
    return matches.length / readinessIndicators.length;
  }

  private extractLessons(content: string): string[] {
    const lessonSections = content.match(/lessons?[\s\S]*?(?=\n\n|\n#|$)/gi);
    if (!lessonSections) return [];
    
    const lessons = lessonSections[0]
      .split(/\n/)
      .filter(line => line.trim().match(/^[-*\d]/))
      .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
      .filter(lesson => lesson.length > 10);
    
    return lessons.slice(0, 5);
  }

  private extractQualityAssessment(content: string): Record<string, any> {
    // Extract quality-related content
    const qualitySection = content.match(/quality[\s\S]*?(?=\n\n|\n#|$)/gi);
    return {
      assessment: qualitySection ? qualitySection[0] : '',
      score: this.extractScoreFromText(content)
    };
  }

  private extractConvergenceAssessment(content: string): Record<string, any> {
    const convergenceKeywords = ['converge', 'convergence', 'ready', 'complete', 'sufficient'];
    const hasConvergenceIndicators = convergenceKeywords.some(keyword =>
      content.toLowerCase().includes(keyword)
    );
    
    return {
      converged: hasConvergenceIndicators,
      confidence: hasConvergenceIndicators ? 0.8 : 0.3
    };
  }

  private extractNextIterationTask(content: string): string {
    const nextSections = content.match(/next[\s\S]*?(?=\n\n|\n#|$)/gi);
    return nextSections ? nextSections[0].trim() : '';
  }

  private extractImprovementOpportunities(content: string): string[] {
    const improvementSection = content.match(/improve[\s\S]*?(?=\n\n|\n#|$)/gi);
    if (!improvementSection) return [];
    
    return improvementSection[0]
      .split(/\n/)
      .filter(line => line.trim().match(/^[-*\d]/))
      .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
      .slice(0, 3);
  }

  private extractPatterns(content: string): string[] {
    const patternSection = content.match(/pattern[\s\S]*?(?=\n\n|\n#|$)/gi);
    if (!patternSection) return [];
    
    return patternSection[0]
      .split(/\n/)
      .filter(line => line.trim().length > 10)
      .slice(0, 3);
  }

  private extractScoreFromText(content: string): number {
    const scoreMatch = content.match(/(\d+)\/100|(\d+)%|score[:\s]*(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3]);
      return isNaN(score) ? 75 : Math.min(Math.max(score, 0), 100);
    }
    return 75; // Default score
  }

  private analyzeTrend(iterations: SpiralIteration[]): string {
    if (iterations.length < 2) return 'insufficient data';
    
    const scores = iterations.map(iter => iter.qualityScore);
    const trend = scores[scores.length - 1] - scores[0];
    
    if (trend > 10) return 'improving';
    if (trend < -10) return 'declining';
    return 'stable';
  }

  private generateNextSteps(iterations: SpiralIteration[], patterns: string[]): string[] {
    const steps: string[] = [];
    
    // Based on final iteration quality
    const lastIteration = iterations[iterations.length - 1];
    if (lastIteration.qualityScore < 80) {
      steps.push('Continue spiral iterations to improve solution quality');
    }
    
    // Based on patterns
    if (patterns.some(p => p.toLowerCase().includes('test'))) {
      steps.push('Implement comprehensive testing strategy');
    }
    
    if (patterns.some(p => p.toLowerCase().includes('performance'))) {
      steps.push('Conduct performance optimization review');
    }
    
    // Default recommendations
    if (steps.length === 0) {
      steps.push('Proceed with implementation');
      steps.push('Establish monitoring and feedback loops');
    }
    
    return steps;
  }
}