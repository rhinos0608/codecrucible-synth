/**
 * Advanced Council Decision Engine for Multi-Voice Synthesis
 * Implements sophisticated voice collaboration with conflict resolution and consensus building
 * Enhanced with Claude Code patterns for enterprise-grade coordination
 */

import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
import { logger } from '../logger.js';
import { EventEmitter } from 'events';
import { subAgentIsolationSystem, IsolationLevel } from '../agents/sub-agent-isolation-system.js';
import { EnterpriseSecurityFramework } from '../security/enterprise-security-framework.js';

export interface VoicePerspective {
  voiceId: string;
  position: string;
  confidence: number;
  reasoning: string;
  supportingEvidence: string[];
  concerns: string[];
  alternatives: string[];
}

export interface CouncilDecision {
  finalDecision: string;
  consensusLevel: number; // 0-1
  participatingVoices: string[];
  perspectives: VoicePerspective[];
  conflictsResolved: ConflictResolution[];
  decisionRationale: string;
  dissent?: string[]; // Any remaining dissenting opinions
}

export interface ConflictResolution {
  conflictType: 'technical' | 'philosophical' | 'priority' | 'approach';
  conflictingVoices: string[];
  issue: string;
  resolution: string;
  resolutionMethod: 'consensus' | 'majority' | 'weighted' | 'expert-authority' | 'synthesis';
  confidence: number;
}

export enum CouncilMode {
  CONSENSUS = 'consensus', // Seek unanimous agreement
  MAJORITY = 'majority', // Go with majority opinion
  WEIGHTED = 'weighted', // Weight opinions by expertise
  DEBATE = 'debate', // Allow structured argument
  SYNTHESIS = 'synthesis', // Merge complementary aspects
}

export interface CouncilConfig {
  mode: CouncilMode;
  maxRounds: number;
  consensusThreshold: number; // 0-1, minimum agreement level
  allowDissent: boolean;
  requireExplanations: boolean;
  timeoutMs: number;
}

export class CouncilDecisionEngine extends EventEmitter {
  private voiceSystem: VoiceArchetypeSystem;
  private modelClient: any;
  private securityFramework: EnterpriseSecurityFramework;
  private performanceMetrics: Map<string, PerformanceMetric[]> = new Map();

  constructor(voiceSystem: VoiceArchetypeSystem, modelClient: any) {
    super();
    this.voiceSystem = voiceSystem;
    this.modelClient = modelClient;
    this.securityFramework = new EnterpriseSecurityFramework();
  }

  /**
   * Conduct a council session with sophisticated decision-making and enterprise security
   */
  async conductCouncilSession(
    prompt: string,
    voices: string[],
    config: CouncilConfig
  ): Promise<CouncilDecision> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    logger.info('🏛️ Starting council session', {
      sessionId,
      voices: voices.length,
      mode: config.mode,
      prompt: prompt.substring(0, 100),
    });

    this.emit('council:started', { sessionId, voices, config });

    try {
      // Security validation of the prompt
      const securityValidation = await this.securityFramework.validateAgentAction(
        'council-engine',
        {
          type: 'code_generation',
          agentId: 'council-engine',
          payload: { prompt, voices },
          timestamp: new Date(),
          metadata: { sessionId },
        },
        {
          sessionId,
          permissions: ['voice_coordination', 'multi_agent_synthesis'],
          environment: 'production',
          riskProfile: 'medium',
        }
      );

      if (!securityValidation.allowed) {
        throw new Error(
          `Council session blocked by security policy: ${securityValidation.violations.map(v => v.description).join(', ')}`
        );
      }

      // Phase 1: Gather initial perspectives with performance tracking
      const perspectiveStartTime = Date.now();
      const initialPerspectives = await this.gatherInitialPerspectives(prompt, voices);
      this.trackPerformance('perspective_gathering', Date.now() - perspectiveStartTime, true);
      this.emit('council:perspectives_gathered', { count: initialPerspectives.length });

      // Phase 2: Identify conflicts
      const conflictStartTime = Date.now();
      const conflicts = this.identifyConflicts(initialPerspectives);
      this.trackPerformance('conflict_identification', Date.now() - conflictStartTime, true);
      this.emit('council:conflicts_identified', { conflicts: conflicts.length });

      // Phase 3: Resolve conflicts based on mode
      const resolutionStartTime = Date.now();
      const resolvedConflicts = await this.resolveConflicts(conflicts, initialPerspectives, config);
      this.trackPerformance('conflict_resolution', Date.now() - resolutionStartTime, true);

      // Phase 4: Build consensus or make decision
      const consensusStartTime = Date.now();
      const finalDecision = await this.buildConsensus(
        initialPerspectives,
        resolvedConflicts,
        config
      );
      this.trackPerformance('consensus_building', Date.now() - consensusStartTime, true);

      const totalDuration = Date.now() - startTime;
      this.trackPerformance('total_session', totalDuration, true);

      // Enhanced decision with performance metrics
      const enhancedDecision = {
        ...finalDecision,
        sessionId,
        duration: totalDuration,
        performanceMetrics: this.getSessionMetrics(sessionId),
      };

      this.emit('council:completed', { decision: enhancedDecision });
      return enhancedDecision;
    } catch (error) {
      this.trackPerformance('total_session', Date.now() - startTime, false);
      logger.error('Council session failed:', error);
      this.emit('council:failed', { sessionId, error });
      throw error;
    }
  }

  /**
   * Gather initial perspectives from all voices using isolated agents
   */
  private async gatherInitialPerspectives(
    prompt: string,
    voices: string[]
  ): Promise<VoicePerspective[]> {
    const perspectives: VoicePerspective[] = [];

    // Execute voice perspectives in parallel using isolated agents
    const perspectivePromises = voices.map(async voiceId => {
      try {
        const voice = this.voiceSystem.getVoice(voiceId);
        if (!voice) {
          logger.warn(`Voice not found: ${voiceId}`);
          return null;
        }

        // Create a specialized prompt for gathering perspectives
        const perspectivePrompt = `
${voice.systemPrompt}

COUNCIL TASK: Provide your perspective on the following:
${prompt}

Please structure your response as follows:
POSITION: Your main stance or recommendation
CONFIDENCE: Rate your confidence (0.0-1.0)
REASONING: Explain your logic and approach
EVIDENCE: Supporting points or examples
CONCERNS: Potential issues or risks you see
ALTERNATIVES: Other approaches you considered

Be specific and actionable. This will be part of a multi-voice council decision.
        `;

        // Execute using isolated agent for security and performance
        const result = await subAgentIsolationSystem.executeTask(
          'analysis',
          {
            voiceId,
            prompt: perspectivePrompt,
            voice: voice,
            model: this.modelClient,
          },
          {
            priority: 'high',
            timeout: 30000,
            isolationLevel: IsolationLevel.MEMORY,
            permissions: {
              apiAccess: {
                models: ['*'],
                rateLimit: 10,
                features: ['analysis', 'generation'],
              },
            },
          }
        );

        if (result.success && result.result) {
          return this.parseVoicePerspective(voiceId, result.result);
        } else {
          logger.error(`Failed to get perspective from ${voiceId}:`, result.error);
          return null;
        }
      } catch (error) {
        logger.error(`Error gathering perspective from ${voiceId}:`, error);
        return null;
      }
    });

    // Wait for all perspectives
    const results = await Promise.allSettled(perspectivePromises);

    // Collect successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        perspectives.push(result.value);
      }
    }

    logger.info(`Gathered ${perspectives.length} perspectives from ${voices.length} voices`);
    return perspectives;
  }

  /**
   * Parse a voice response into a structured perspective
   */
  private parseVoicePerspective(voiceId: string, response: string): VoicePerspective {
    const sections = this.extractSections(response);

    return {
      voiceId,
      position: sections.position || response.substring(0, 200),
      confidence: this.extractConfidence(sections.confidence),
      reasoning: sections.reasoning || '',
      supportingEvidence: this.extractList(sections.evidence),
      concerns: this.extractList(sections.concerns),
      alternatives: this.extractList(sections.alternatives),
    };
  }

  /**
   * Extract structured sections from voice response
   */
  private extractSections(response: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionPattern =
      /(POSITION|CONFIDENCE|REASONING|EVIDENCE|CONCERNS|ALTERNATIVES):\s*(.*?)(?=\n[A-Z]+:|$)/gs;

    let match;
    while ((match = sectionPattern.exec(response)) !== null) {
      sections[match[1].toLowerCase()] = match[2].trim();
    }

    return sections;
  }

  /**
   * Extract confidence score from text
   */
  private extractConfidence(text?: string): number {
    if (!text) return 0.5;

    const numberMatch = text.match(/([0-9]*\.?[0-9]+)/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[1]);
      return num > 1 ? num / 10 : num; // Handle both 0.8 and 8 formats
    }

    // Fallback to text analysis
    const lowerText = text.toLowerCase();
    if (lowerText.includes('very confident') || lowerText.includes('certain')) return 0.9;
    if (lowerText.includes('confident')) return 0.7;
    if (lowerText.includes('somewhat') || lowerText.includes('fairly')) return 0.6;
    if (lowerText.includes('uncertain') || lowerText.includes('unsure')) return 0.3;

    return 0.5;
  }

  /**
   * Extract list items from text
   */
  private extractList(text?: string): string[] {
    if (!text) return [];

    return text
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(item => item.length > 0);
  }

  /**
   * Identify conflicts between voice perspectives
   */
  private identifyConflicts(perspectives: VoicePerspective[]): ConflictResolution[] {
    const conflicts: ConflictResolution[] = [];

    // Compare perspectives pairwise to find conflicts
    for (let i = 0; i < perspectives.length; i++) {
      for (let j = i + 1; j < perspectives.length; j++) {
        const p1 = perspectives[i];
        const p2 = perspectives[j];

        const conflict = this.detectConflict(p1, p2);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts between two perspectives
   */
  private detectConflict(p1: VoicePerspective, p2: VoicePerspective): ConflictResolution | null {
    // Simple conflict detection based on contradictory keywords
    const pos1 = p1.position.toLowerCase();
    const pos2 = p2.position.toLowerCase();

    // Technical approach conflicts
    if (this.hasConflictingApproaches(pos1, pos2)) {
      return {
        conflictType: 'approach',
        conflictingVoices: [p1.voiceId, p2.voiceId],
        issue: `Different approaches: ${p1.voiceId} suggests "${p1.position.substring(0, 50)}" while ${p2.voiceId} suggests "${p2.position.substring(0, 50)}"`,
        resolution: '', // To be filled during resolution
        resolutionMethod: 'consensus',
        confidence: 0.7,
      };
    }

    // Priority conflicts
    if (this.hasPriorityConflict(p1, p2)) {
      return {
        conflictType: 'priority',
        conflictingVoices: [p1.voiceId, p2.voiceId],
        issue: `Priority conflict between security vs performance, or other trade-offs`,
        resolution: '',
        resolutionMethod: 'weighted',
        confidence: 0.6,
      };
    }

    return null;
  }

  /**
   * Check for conflicting technical approaches
   */
  private hasConflictingApproaches(pos1: string, pos2: string): boolean {
    const conflictPairs = [
      ['synchronous', 'asynchronous'],
      ['sql', 'nosql'],
      ['monolithic', 'microservice'],
      ['frontend', 'backend'],
      ['secure', 'fast'],
      ['simple', 'comprehensive'],
    ];

    return conflictPairs.some(
      ([approach1, approach2]) =>
        (pos1.includes(approach1) && pos2.includes(approach2)) ||
        (pos1.includes(approach2) && pos2.includes(approach1))
    );
  }

  /**
   * Check for priority conflicts
   */
  private hasPriorityConflict(p1: VoicePerspective, p2: VoicePerspective): boolean {
    // If one voice has strong security concerns and another emphasizes performance
    const p1Security = p1.concerns.some(c => c.toLowerCase().includes('security'));
    const p2Performance =
      p2.position.toLowerCase().includes('performance') ||
      p2.position.toLowerCase().includes('speed');

    return (
      (p1Security && p2Performance) ||
      (p2.concerns.some(c => c.toLowerCase().includes('security')) &&
        p1.position.toLowerCase().includes('performance'))
    );
  }

  /**
   * Resolve conflicts using the specified method
   */
  private async resolveConflicts(
    conflicts: ConflictResolution[],
    perspectives: VoicePerspective[],
    config: CouncilConfig
  ): Promise<ConflictResolution[]> {
    const resolved: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveIndividualConflict(conflict, perspectives, config);
        resolved.push(resolution);
      } catch (error) {
        logger.error(`Failed to resolve conflict:`, error);
        // Keep the unresolved conflict
        resolved.push(conflict);
      }
    }

    return resolved;
  }

  /**
   * Resolve a specific conflict
   */
  private async resolveIndividualConflict(
    conflict: ConflictResolution,
    perspectives: VoicePerspective[],
    config: CouncilConfig
  ): Promise<ConflictResolution> {
    // Get the conflicting perspectives
    const conflictingPerspectives = perspectives.filter(p =>
      conflict.conflictingVoices.includes(p.voiceId)
    );

    if (config.mode === CouncilMode.CONSENSUS) {
      return await this.resolveByConsensus(conflict, conflictingPerspectives);
    } else if (config.mode === CouncilMode.WEIGHTED) {
      return await this.resolveByExpertise(conflict, conflictingPerspectives);
    } else if (config.mode === CouncilMode.MAJORITY) {
      return this.resolveByMajority(conflict, perspectives);
    } else {
      return await this.resolveBySynthesis(conflict, conflictingPerspectives);
    }
  }

  /**
   * Resolve conflict by seeking consensus
   */
  private async resolveByConsensus(
    conflict: ConflictResolution,
    perspectives: VoicePerspective[]
  ): Promise<ConflictResolution> {
    // Create a synthesis prompt to find middle ground
    const synthesisPrompt = `
CONFLICT RESOLUTION TASK:

ISSUE: ${conflict.issue}

PERSPECTIVE 1 (${perspectives[0].voiceId}):
Position: ${perspectives[0].position}
Reasoning: ${perspectives[0].reasoning}

PERSPECTIVE 2 (${perspectives[1].voiceId}):
Position: ${perspectives[1].position}
Reasoning: ${perspectives[1].reasoning}

Please provide a synthesis that addresses both perspectives and finds a middle ground that both voices could accept. Focus on:
1. Common goals and values
2. Complementary aspects that can be combined
3. A practical compromise solution
4. How to address the core concerns of both sides

SYNTHESIS:
    `;

    try {
      const response = await this.modelClient.generateVoiceResponse(synthesisPrompt, 'architect', {
        temperature: 0.3,
      });

      return {
        ...conflict,
        resolution: response.content,
        resolutionMethod: 'consensus',
        confidence: 0.8,
      };
    } catch (error) {
      logger.error('Consensus resolution failed:', error);
      return conflict;
    }
  }

  /**
   * Resolve conflict by expertise weighting
   */
  private async resolveByExpertise(
    conflict: ConflictResolution,
    perspectives: VoicePerspective[]
  ): Promise<ConflictResolution> {
    // Determine which voice has more expertise for this type of conflict
    const expertiseWeights = this.calculateExpertiseWeights(conflict, perspectives);
    const dominantPerspective = expertiseWeights[0];

    return {
      ...conflict,
      resolution: `Resolved in favor of ${dominantPerspective.voiceId} due to higher expertise in ${conflict.conflictType}. Solution: ${dominantPerspective.position}`,
      resolutionMethod: 'weighted',
      confidence: dominantPerspective.confidence,
    };
  }

  /**
   * Calculate expertise weights for conflict resolution
   */
  private calculateExpertiseWeights(
    conflict: ConflictResolution,
    perspectives: VoicePerspective[]
  ): VoicePerspective[] {
    // Define expertise mapping
    const expertiseMap: Record<string, string[]> = {
      security: ['security', 'guardian'],
      performance: ['optimizer', 'analyzer'],
      architecture: ['architect'],
      implementation: ['developer', 'implementor'],
      'user-experience': ['designer'],
      maintenance: ['maintainer'],
    };

    // Weight perspectives based on expertise
    const weighted = perspectives.map(p => {
      let expertiseWeight = 1.0;

      // Check if voice has relevant expertise
      for (const [domain, voices] of Object.entries(expertiseMap)) {
        if (voices.includes(p.voiceId) && conflict.conflictType.includes(domain)) {
          expertiseWeight += 0.5;
        }
      }

      return {
        ...p,
        confidence: p.confidence * expertiseWeight,
      };
    });

    return weighted.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Resolve by majority opinion
   */
  private resolveByMajority(
    conflict: ConflictResolution,
    allPerspectives: VoicePerspective[]
  ): ConflictResolution {
    // This is simplified - in a real implementation, you'd analyze similarity of positions
    const majorityPosition = allPerspectives[0].position; // Placeholder

    return {
      ...conflict,
      resolution: `Resolved by majority consensus: ${majorityPosition}`,
      resolutionMethod: 'majority',
      confidence: 0.7,
    };
  }

  /**
   * Resolve by synthesis of approaches
   */
  private async resolveBySynthesis(
    conflict: ConflictResolution,
    perspectives: VoicePerspective[]
  ): Promise<ConflictResolution> {
    // Similar to consensus but more focused on combining different approaches
    const resolution = await this.resolveByConsensus(conflict, perspectives);
    return {
      ...resolution,
      resolutionMethod: 'synthesis',
    };
  }

  /**
   * Build final consensus from all perspectives and resolutions
   */
  private async buildConsensus(
    perspectives: VoicePerspective[],
    resolvedConflicts: ConflictResolution[],
    config: CouncilConfig
  ): Promise<CouncilDecision> {
    // Create final synthesis prompt
    const synthesisPrompt = `
COUNCIL DECISION SYNTHESIS

PERSPECTIVES:
${perspectives
  .map(
    p => `
${p.voiceId.toUpperCase()}:
- Position: ${p.position}
- Confidence: ${p.confidence}
- Key concerns: ${p.concerns.join(', ')}
`
  )
  .join('\n')}

RESOLVED CONFLICTS:
${resolvedConflicts
  .map(
    c => `
- ${c.issue}
- Resolution: ${c.resolution}
`
  )
  .join('\n')}

Please provide a final, unified decision that:
1. Incorporates the best aspects of all perspectives
2. Addresses the resolved conflicts appropriately
3. Provides a clear, actionable recommendation
4. Explains the rationale for the decision

FINAL DECISION:
    `;

    try {
      const response = await this.modelClient.generateVoiceResponse(synthesisPrompt, 'architect', {
        temperature: 0.4,
      });

      const consensusLevel = this.calculateConsensusLevel(perspectives, resolvedConflicts);

      return {
        finalDecision: response.content,
        consensusLevel,
        participatingVoices: perspectives.map(p => p.voiceId),
        perspectives,
        conflictsResolved: resolvedConflicts,
        decisionRationale: `Council decision synthesized from ${perspectives.length} perspectives with ${consensusLevel * 100}% consensus`,
        dissent:
          consensusLevel < config.consensusThreshold
            ? this.identifyDissent(perspectives, resolvedConflicts)
            : undefined,
      };
    } catch (error) {
      logger.error('Final consensus building failed:', error);
      throw error;
    }
  }

  /**
   * Calculate overall consensus level
   */
  private calculateConsensusLevel(
    perspectives: VoicePerspective[],
    resolvedConflicts: ConflictResolution[]
  ): number {
    const avgConfidence =
      perspectives.reduce((sum, p) => sum + p.confidence, 0) / perspectives.length;
    const conflictResolutionScore =
      resolvedConflicts.length > 0
        ? resolvedConflicts.reduce((sum, c) => sum + c.confidence, 0) / resolvedConflicts.length
        : 1.0;

    return (avgConfidence + conflictResolutionScore) / 2;
  }

  /**
   * Identify remaining dissenting opinions
   */
  private identifyDissent(
    perspectives: VoicePerspective[],
    resolvedConflicts: ConflictResolution[]
  ): string[] {
    return perspectives
      .filter(p => p.confidence < 0.6)
      .map(p => `${p.voiceId}: ${p.concerns.join(', ')}`);
  }

  /**
   * Performance tracking for council operations
   */
  private trackPerformance(operation: string, duration: number, success: boolean): void {
    const sessionMetrics = this.performanceMetrics.get('current') || [];
    sessionMetrics.push({
      operation,
      duration,
      success,
      timestamp: new Date(),
    });
    this.performanceMetrics.set('current', sessionMetrics);
  }

  /**
   * Get performance metrics for a session
   */
  private getSessionMetrics(sessionId: string): PerformanceMetric[] {
    return this.performanceMetrics.get('current') || [];
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `council_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Claude Code conciseness enhancement - summarize decision
   */
  async generateConciseDecision(decision: CouncilDecision): Promise<string> {
    // Following Claude Code's "fewer than 4 lines" requirement
    const lines = decision.finalDecision.split('\n').filter(line => line.trim());
    if (lines.length <= 4) {
      return decision.finalDecision;
    }

    // Extract key points and condense
    const keyPoints = lines
      .filter(line => line.includes(':') || line.includes('-') || line.includes('•'))
      .slice(0, 3)
      .map(line => line.replace(/^[-•*]\s*/, '').trim());

    return keyPoints.join('. ') + '.';
  }

  /**
   * Enterprise quality gate validation
   */
  async validateDecisionQuality(decision: CouncilDecision): Promise<{
    passed: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let score = 1.0;

    // Check consensus level
    if (decision.consensusLevel < 0.7) {
      issues.push('Low consensus level');
      score -= 0.2;
    }

    // Check for unresolved conflicts
    if (decision.conflictsResolved.some(c => !c.resolution)) {
      issues.push('Unresolved conflicts detected');
      score -= 0.3;
    }

    // Check participation
    if (decision.participatingVoices.length < 3) {
      issues.push('Insufficient voice participation');
      score -= 0.2;
    }

    // Check decision completeness
    if (decision.finalDecision.length < 50) {
      issues.push('Decision too brief - may lack detail');
      score -= 0.1;
    }

    return {
      passed: score >= 0.6 && issues.length === 0,
      score: Math.max(0, score),
      issues,
    };
  }
}

// Supporting interfaces for enhanced functionality
interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
}
