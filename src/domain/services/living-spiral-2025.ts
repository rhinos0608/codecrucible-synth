/**
 * Living Spiral 2025 - Optimized Implementation
 * Fixes critical issues identified in the assessment and implements 2025 best practices
 */

import { logger } from './logger.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { UnifiedModelClient } from '../refactor/unified-model-client.js';

export enum SpiralPhase {
  COLLAPSE = 'collapse',
  COUNCIL = 'council', 
  SYNTHESIS = 'synthesis',
  REBIRTH = 'rebirth',
  REFLECTION = 'reflection',
}

export interface EnhancedSpiralConfig {
  maxIterations: number;
  qualityThreshold: number;
  convergenceTarget: number;
  enableReflection: boolean;
  parallelVoices: boolean;
  councilSize: number;
  // 2025 enhancements
  enableContextPreservation: boolean;
  aiPoweredQualityAssessment: boolean;
  domainSpecificOptimization: boolean;
  requirementValidation: boolean;
  minimumIterations: number; // Prevent premature convergence
}

export interface SpiralContext {
  originalProblem: string;
  requirements: string[];
  constraints: string[];
  successCriteria: string[];
  previousPhaseOutputs: Map<SpiralPhase, string[]>;
  iterationHistory: EnhancedSpiralIteration[];
  qualityTrend: number[];
  stakeholderFeedback: string[];
}

export interface EnhancedSpiralIteration {
  phase: SpiralPhase;
  iteration: number;
  input: string;
  output: string;
  quality: number;
  voices: string[];
  context: SpiralContext;
  qualityBreakdown: QualityAssessment;
  metadata: {
    timestamp: Date;
    duration: number;
    convergence: number;
    aiConfidence: number;
    contextPreserved: boolean;
  };
}

export interface QualityAssessment {
  semanticCoherence: number;
  requirementCoverage: number;
  technicalAccuracy: number;
  implementationReady: number;
  stakeholderAlignment: number;
  overallQuality: number;
  criticalGaps: string[];
  strengths: string[];
  recommendations: string[];
}

export interface EnhancedSpiralResult {
  final: string;
  iterations: EnhancedSpiralIteration[];
  convergenceAchieved: boolean;
  totalIterations: number;
  quality: QualityAssessment;
  contextEvolution: SpiralContext[];
  effectivenessMetrics: {
    actualIterations: number;
    qualityImprovement: number;
    requirementsCovered: number;
    timeToValue: number;
    stakeholderSatisfaction: number;
  };
}

export class LivingSpiralCoordinator2025 {
  private voiceSystem: VoiceArchetypeSystem;
  private modelClient: UnifiedModelClient;
  private config: EnhancedSpiralConfig;
  private currentContext!: SpiralContext;

  constructor(
    voiceSystem: VoiceArchetypeSystem,
    modelClient: UnifiedModelClient,
    config: EnhancedSpiralConfig
  ) {
    this.voiceSystem = voiceSystem;
    this.modelClient = modelClient;
    this.config = config;
  }

  /**
   * Execute the enhanced Living Spiral process with 2025 best practices
   */
  async executeSpiralProcess(initialPrompt: string): Promise<EnhancedSpiralResult> {
    const iterations: EnhancedSpiralIteration[] = [];
    let convergenceAchieved = false;
    let iterationCount = 0;
    
    // Initialize enhanced context
    this.currentContext = await this.initializeContext(initialPrompt);

    logger.info('🌀 Starting Enhanced Living Spiral process', {
      prompt: initialPrompt.substring(0, 100),
      config: this.config,
    });

    while (iterationCount < this.config.maxIterations && !convergenceAchieved) {
      iterationCount++;

      const spiralIteration = await this.executeSingleEnhancedSpiral(
        iterationCount,
        iterations
      );

      iterations.push(spiralIteration);
      
      // Update context with iteration results
      this.updateContextWithIteration(spiralIteration);

      // Enhanced convergence detection with minimum iteration requirement
      if (iterationCount >= this.config.minimumIterations) {
        const shouldConverge = await this.evaluateConvergence(spiralIteration, iterations);
        if (shouldConverge) {
          convergenceAchieved = true;
          logger.info('✅ Enhanced Spiral convergence achieved', {
            iteration: iterationCount,
            quality: spiralIteration.quality,
            qualityBreakdown: spiralIteration.qualityBreakdown,
          });
        }
      }
    }

    const result: EnhancedSpiralResult = {
      final: iterations[iterations.length - 1]?.output || '',
      iterations,
      convergenceAchieved,
      totalIterations: iterationCount,
      quality: iterations[iterations.length - 1]?.qualityBreakdown || this.createEmptyQualityAssessment(),
      contextEvolution: iterations.map(iter => iter.context),
      effectivenessMetrics: this.calculateEffectivenessMetrics(iterations),
    };

    logger.info('🎯 Enhanced Living Spiral process completed', {
      iterations: iterationCount,
      converged: convergenceAchieved,
      effectivenessScore: result.effectivenessMetrics.stakeholderSatisfaction,
    });

    return result;
  }

  /**
   * Initialize enhanced context with AI-powered requirement extraction
   */
  private async initializeContext(prompt: string): Promise<SpiralContext> {
    const requirementExtractionPrompt = `
Analyze this problem statement and extract:

PROBLEM: ${prompt}

Extract:
1. REQUIREMENTS: Core functional and non-functional requirements
2. CONSTRAINTS: Technical, business, and resource limitations
3. SUCCESS_CRITERIA: Measurable outcomes that define success

Format as JSON:
{
  "requirements": ["req1", "req2", ...],
  "constraints": ["constraint1", "constraint2", ...], 
  "success_criteria": ["criteria1", "criteria2", ...]
}
`;

    const response = await this.modelClient.generate({ prompt: requirementExtractionPrompt });
    
    try {
      const extracted = JSON.parse(response.content);
      return {
        originalProblem: prompt,
        requirements: extracted.requirements || [],
        constraints: extracted.constraints || [],
        successCriteria: extracted.success_criteria || [],
        previousPhaseOutputs: new Map(),
        iterationHistory: [],
        qualityTrend: [],
        stakeholderFeedback: [],
      };
    } catch (error) {
      // Fallback to basic context if JSON parsing fails
      return {
        originalProblem: prompt,
        requirements: ['Address the core problem'],
        constraints: ['Resource and time limitations'],
        successCriteria: ['Provide a comprehensive solution'],
        previousPhaseOutputs: new Map(),
        iterationHistory: [],
        qualityTrend: [],
        stakeholderFeedback: [],
      };
    }
  }

  /**
   * Execute enhanced spiral iteration with context preservation
   */
  private async executeSingleEnhancedSpiral(
    iteration: number,
    previousIterations: EnhancedSpiralIteration[]
  ): Promise<EnhancedSpiralIteration> {
    const startTime = Date.now();

    logger.info(`🌀 Enhanced Spiral iteration ${iteration} starting`);

    // Build context-aware input
    const contextInput = this.buildContextAwareInput();

    // Execute phases with context preservation
    const collapsed = await this.enhancedCollapsePhase(contextInput);
    this.updatePhaseOutput(SpiralPhase.COLLAPSE, collapsed.output);

    const councilResults = await this.enhancedCouncilPhase(collapsed);
    this.updatePhaseOutput(SpiralPhase.COUNCIL, councilResults.output);

    const synthesized = await this.enhancedSynthesisPhase(councilResults);
    this.updatePhaseOutput(SpiralPhase.SYNTHESIS, synthesized.output);

    const reborn = await this.enhancedRebirthPhase(synthesized);
    this.updatePhaseOutput(SpiralPhase.REBIRTH, reborn.output);

    const reflected = this.config.enableReflection
      ? await this.enhancedReflectionPhase(reborn, previousIterations)
      : reborn;
    
    if (this.config.enableReflection) {
      this.updatePhaseOutput(SpiralPhase.REFLECTION, reflected.output);
    }

    const duration = Date.now() - startTime;
    
    // Enhanced AI-powered quality assessment
    const qualityAssessment = this.config.aiPoweredQualityAssessment
      ? await this.aiPoweredQualityAssessment(reflected.output)
      : await this.enhancedHeuristicQualityAssessment(reflected.output);

    const convergence = this.calculateEnhancedConvergence(previousIterations, qualityAssessment.overallQuality);

    return {
      phase: SpiralPhase.REFLECTION,
      iteration,
      input: contextInput,
      output: reflected.output,
      quality: qualityAssessment.overallQuality,
      voices: reflected.voices,
      context: { ...this.currentContext },
      qualityBreakdown: qualityAssessment,
      metadata: {
        timestamp: new Date(),
        duration,
        convergence,
        aiConfidence: qualityAssessment.technicalAccuracy,
        contextPreserved: this.config.enableContextPreservation,
      },
    };
  }

  /**
   * Build context-aware input that preserves previous phase insights
   */
  private buildContextAwareInput(): string {
    if (!this.config.enableContextPreservation) {
      return this.currentContext.originalProblem;
    }

    const contextSummary = Array.from(this.currentContext.previousPhaseOutputs.entries())
      .map(([phase, outputs]) => `${phase.toUpperCase()}: ${outputs[outputs.length - 1] || 'N/A'}`)
      .join('\n\n');

    return `
ORIGINAL PROBLEM:
${this.currentContext.originalProblem}

REQUIREMENTS:
${this.currentContext.requirements.join('\n- ')}

CONSTRAINTS: 
${this.currentContext.constraints.join('\n- ')}

SUCCESS CRITERIA:
${this.currentContext.successCriteria.join('\n- ')}

PREVIOUS PHASE INSIGHTS:
${contextSummary}

QUALITY TREND: ${this.currentContext.qualityTrend.join(' → ')}
`;
  }

  /**
   * AI-powered quality assessment replacing simple heuristics
   */
  private async aiPoweredQualityAssessment(output: string): Promise<QualityAssessment> {
    const assessmentPrompt = `
Evaluate this solution against the requirements:

ORIGINAL REQUIREMENTS:
${this.currentContext.requirements.join('\n- ')}

CONSTRAINTS:
${this.currentContext.constraints.join('\n- ')}

SUCCESS CRITERIA:
${this.currentContext.successCriteria.join('\n- ')}

SOLUTION TO EVALUATE:
${output}

Provide assessment scores (0.0-1.0) and analysis:

{
  "semantic_coherence": <score>,
  "requirement_coverage": <score>, 
  "technical_accuracy": <score>,
  "implementation_ready": <score>,
  "stakeholder_alignment": <score>,
  "critical_gaps": ["gap1", "gap2"],
  "strengths": ["strength1", "strength2"],
  "recommendations": ["rec1", "rec2"]
}
`;

    const response = await this.modelClient.generate({ prompt: assessmentPrompt });
    
    try {
      const assessment = JSON.parse(response.content);
      const overallQuality = (
        assessment.semantic_coherence +
        assessment.requirement_coverage +
        assessment.technical_accuracy +
        assessment.implementation_ready +
        assessment.stakeholder_alignment
      ) / 5;

      return {
        semanticCoherence: assessment.semantic_coherence || 0.5,
        requirementCoverage: assessment.requirement_coverage || 0.5,
        technicalAccuracy: assessment.technical_accuracy || 0.5,
        implementationReady: assessment.implementation_ready || 0.5,
        stakeholderAlignment: assessment.stakeholder_alignment || 0.5,
        overallQuality,
        criticalGaps: assessment.critical_gaps || [],
        strengths: assessment.strengths || [],
        recommendations: assessment.recommendations || [],
      };
    } catch (error) {
      // Fallback to enhanced heuristic assessment
      return this.enhancedHeuristicQualityAssessment(output);
    }
  }

  /**
   * Enhanced heuristic quality assessment (fallback)
   */
  private async enhancedHeuristicQualityAssessment(output: string): Promise<QualityAssessment> {
    const hasCode = output.includes('```');
    const hasStructure = /#{1,3}/.test(output) || /\d+\./.test(output);
    const hasDetail = output.length > 500;
    const hasActionable = /step|implement|create|build|deploy/.test(output.toLowerCase());
    const hasErrorHandling = output.toLowerCase().includes('error') || output.toLowerCase().includes('exception');
    const hasTesting = output.toLowerCase().includes('test') || output.toLowerCase().includes('validate');

    // More sophisticated scoring
    const semanticCoherence = hasStructure && hasDetail ? 0.8 : 0.4;
    const requirementCoverage = this.assessRequirementCoverage(output);
    const technicalAccuracy = hasCode && hasErrorHandling ? 0.8 : 0.5;
    const implementationReady = hasCode && hasActionable && hasTesting ? 0.9 : 0.4;
    const stakeholderAlignment = hasDetail && hasActionable ? 0.7 : 0.3;

    const overallQuality = (semanticCoherence + requirementCoverage + technicalAccuracy + implementationReady + stakeholderAlignment) / 5;

    return {
      semanticCoherence,
      requirementCoverage,
      technicalAccuracy,
      implementationReady,
      stakeholderAlignment,
      overallQuality,
      criticalGaps: this.identifyCriticalGaps(output),
      strengths: this.identifyStrengths(output),
      recommendations: ['Enhance with more specific implementation details', 'Add comprehensive error handling'],
    };
  }

  /**
   * Assess how well the output covers the original requirements
   */
  private assessRequirementCoverage(output: string): number {
    const outputLower = output.toLowerCase();
    const coveredRequirements = this.currentContext.requirements.filter(req => {
      const reqKeywords = req.toLowerCase().split(' ').filter(word => word.length > 3);
      return reqKeywords.some(keyword => outputLower.includes(keyword));
    });
    
    return this.currentContext.requirements.length > 0 
      ? coveredRequirements.length / this.currentContext.requirements.length
      : 0.5;
  }

  /**
   * Enhanced convergence evaluation with multiple criteria
   */
  private async evaluateConvergence(
    iteration: EnhancedSpiralIteration,
    previousIterations: EnhancedSpiralIteration[]
  ): Promise<boolean> {
    const qualityThresholdMet = iteration.qualityBreakdown.overallQuality >= this.config.qualityThreshold;
    const requirementCoverageMet = iteration.qualityBreakdown.requirementCoverage >= 0.8;
    const implementationReady = iteration.qualityBreakdown.implementationReady >= 0.7;
    
    // Check for quality improvement stagnation
    const recentQualities = previousIterations.slice(-2).map(iter => iter.qualityBreakdown.overallQuality);
    const isStagnant = recentQualities.length >= 2 && 
      Math.abs(recentQualities[1] - recentQualities[0]) < 0.05;

    // Require both quality threshold and meaningful progress
    return qualityThresholdMet && requirementCoverageMet && implementationReady && !isStagnant;
  }

  /**
   * Enhanced phases with context preservation
   */
  private async enhancedCollapsePhase(input: string): Promise<{ output: string; voices: string[] }> {
    const prompt = `
Act as The Explorer archetype. With full context from previous phases, decompose this enhanced problem:

${input}

Build upon any previous insights while identifying:
1. Core requirements and any missing elements
2. Key constraints and their implications
3. Essential sub-problems and dependencies  
4. Success criteria and validation approaches
5. Context from previous iterations

Provide comprehensive breakdown that advances our understanding.
`;
    
    const response = await this.modelClient.generate({ prompt });
    return { output: response.content, voices: ['explorer'] };
  }

  private async enhancedCouncilPhase(collapsed: { output: string; voices: string[] }): Promise<{ output: string; voices: string[] }> {
    // Implementation similar to original but with context awareness
    const councilVoices = this.selectCouncilVoices();
    const perspectives: string[] = [];

    if (this.config.parallelVoices) {
      const responses = await this.voiceSystem.generateMultiVoiceSolutions(
        councilVoices,
        collapsed.output
      );
      perspectives.push(...responses.map((r: any) => r.content));
    } else {
      for (const voice of councilVoices) {
        const response = await this.voiceSystem.generateSingleVoiceResponse(
          voice,
          collapsed.output,
          this.modelClient
        );
        perspectives.push(response.content);
      }
    }

    const councilOutput = `ENHANCED COUNCIL PERSPECTIVES:\n\n${perspectives
      .map((p, i) => `### ${councilVoices[i].toUpperCase()} PERSPECTIVE:\n${p}`)
      .join('\n\n')}`;

    return { output: councilOutput, voices: councilVoices };
  }

  private async enhancedSynthesisPhase(council: { output: string; voices: string[] }): Promise<{ output: string; voices: string[] }> {
    const prompt = `
Act as The Architect archetype. Synthesize the council perspectives with full context awareness:

CONTEXT: ${this.buildContextAwareInput()}

COUNCIL PERSPECTIVES: ${council.output}

Your synthesis must:
1. Resolve conflicts with context from previous iterations
2. Create unified approach building on all previous insights
3. Address gaps identified in previous phases
4. Ensure comprehensive requirement coverage
5. Provide implementation-ready guidance

Deliver synthesis that represents collective wisdom enhanced by iterative refinement.
`;

    const response = await this.modelClient.generate({ prompt });
    return { output: response.content, voices: [...council.voices, 'architect'] };
  }

  private async enhancedRebirthPhase(synthesis: { output: string; voices: string[] }): Promise<{ output: string; voices: string[] }> {
    const prompt = `
Act as The Implementor archetype. Transform synthesis into concrete implementation with full context:

FULL CONTEXT: ${this.buildContextAwareInput()}

SYNTHESIS: ${synthesis.output}

Provide:
1. Specific implementation steps building on previous iterations
2. Complete code examples with error handling
3. Testing strategies covering all requirements
4. Deployment considerations with risk mitigation
5. Success metrics and validation approaches
6. Integration with previous phase insights

Focus on production-ready, validated solutions that address all identified requirements.
`;

    const response = await this.modelClient.generate({ prompt });
    return { output: response.content, voices: [...synthesis.voices, 'implementor'] };
  }

  private async enhancedReflectionPhase(
    rebirth: { output: string; voices: string[] },
    previousIterations: EnhancedSpiralIteration[]
  ): Promise<{ output: string; voices: string[] }> {
    const qualityHistory = previousIterations.map(iter => ({
      iteration: iter.iteration,
      quality: iter.qualityBreakdown.overallQuality.toFixed(2),
      gaps: iter.qualityBreakdown.criticalGaps,
    }));

    const prompt = `
Act as The Guardian archetype. Provide critical reflection with full context awareness:

FULL CONTEXT: ${this.buildContextAwareInput()}

CURRENT IMPLEMENTATION: ${rebirth.output}

QUALITY HISTORY: ${JSON.stringify(qualityHistory, null, 2)}

REQUIREMENTS COVERAGE: ${this.currentContext.requirements.map((req, i) => `${i+1}. ${req}`).join('\n')}

Provide comprehensive reflection on:
1. Quality assessment against original requirements  
2. Critical gaps requiring immediate attention
3. Lessons learned from iterative process
4. Specific recommendations for improvement
5. Deployment readiness with evidence
6. Need for continued iteration vs completion

Be rigorous in quality assessment and specific in recommendations.
`;

    const response = await this.modelClient.generate({ prompt });
    
    const finalOutput = `${rebirth.output}\n\n---\n\n## ENHANCED REFLECTION INSIGHTS:\n${response.content}`;
    return { output: finalOutput, voices: [...rebirth.voices, 'guardian'] };
  }

  /**
   * Utility methods for enhanced functionality
   */
  private updatePhaseOutput(phase: SpiralPhase, output: string): void {
    if (!this.currentContext.previousPhaseOutputs.has(phase)) {
      this.currentContext.previousPhaseOutputs.set(phase, []);
    }
    this.currentContext.previousPhaseOutputs.get(phase)!.push(output);
  }

  private updateContextWithIteration(iteration: EnhancedSpiralIteration): void {
    this.currentContext.iterationHistory.push(iteration);
    this.currentContext.qualityTrend.push(iteration.qualityBreakdown.overallQuality);
  }

  private selectCouncilVoices(): string[] {
    const allVoices = ['explorer', 'maintainer', 'analyzer', 'developer', 'security', 'architect'];
    
    if (this.config.councilSize >= allVoices.length) {
      return allVoices;
    }

    const selected = ['explorer', 'maintainer', 'security'];
    const remaining = allVoices.filter(v => !selected.includes(v));

    while (selected.length < this.config.councilSize && remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(randomIndex, 1)[0]);
    }

    return selected;
  }

  private calculateEnhancedConvergence(
    previousIterations: EnhancedSpiralIteration[],
    currentQuality: number
  ): number {
    if (previousIterations.length === 0) {
      return currentQuality;
    }

    const qualityTrend = previousIterations.map(iter => iter.qualityBreakdown.overallQuality);
    qualityTrend.push(currentQuality);

    if (qualityTrend.length < 2) {
      return currentQuality;
    }

    const improvement = currentQuality - qualityTrend[qualityTrend.length - 2];
    return Math.max(0, Math.min(1, currentQuality + improvement * 0.3));
  }

  private calculateEffectivenessMetrics(iterations: EnhancedSpiralIteration[]): any {
    if (iterations.length === 0) {
      return {
        actualIterations: 0,
        qualityImprovement: 0,
        requirementsCovered: 0,
        timeToValue: 0,
        stakeholderSatisfaction: 0,
      };
    }

    const firstQuality = iterations[0].qualityBreakdown.overallQuality;
    const lastQuality = iterations[iterations.length - 1].qualityBreakdown.overallQuality;
    
    return {
      actualIterations: iterations.length,
      qualityImprovement: lastQuality - firstQuality,
      requirementsCovered: iterations[iterations.length - 1].qualityBreakdown.requirementCoverage,
      timeToValue: iterations.reduce((sum, iter) => sum + iter.metadata.duration, 0),
      stakeholderSatisfaction: lastQuality,
    };
  }

  private identifyCriticalGaps(output: string): string[] {
    const gaps: string[] = [];
    
    if (!output.toLowerCase().includes('error') && !output.toLowerCase().includes('exception')) {
      gaps.push('Missing error handling strategy');
    }
    
    if (!output.toLowerCase().includes('test')) {
      gaps.push('No testing methodology defined');
    }
    
    if (!output.toLowerCase().includes('security')) {
      gaps.push('Security considerations not addressed');
    }
    
    return gaps;
  }

  private identifyStrengths(output: string): string[] {
    const strengths: string[] = [];
    
    if (output.includes('```')) {
      strengths.push('Includes concrete code examples');
    }
    
    if (/#{1,3}/.test(output)) {
      strengths.push('Well-structured presentation');
    }
    
    if (output.length > 1000) {
      strengths.push('Comprehensive detailed analysis');
    }
    
    return strengths;
  }

  private createEmptyQualityAssessment(): QualityAssessment {
    return {
      semanticCoherence: 0,
      requirementCoverage: 0,
      technicalAccuracy: 0,
      implementationReady: 0,
      stakeholderAlignment: 0,
      overallQuality: 0,
      criticalGaps: [],
      strengths: [],
      recommendations: [],
    };
  }
}

export default LivingSpiralCoordinator2025;