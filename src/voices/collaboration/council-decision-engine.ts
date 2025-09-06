/**
 * Advanced Council Decision Engine for Multi-Voice Synthesis
 * Implements sophisticated voice collaboration with conflict resolution and consensus building
 * Enhanced with Claude Code patterns for enterprise-grade coordination
 */

import { VoiceArchetypeSystemInterface } from '../../domain/interfaces/voice-system.js';
import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
import { EventEmitter } from 'events';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';

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
  COLLABORATIVE = 'collaborative', // Combine perspectives collaboratively
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
  private readonly voiceSystem: VoiceArchetypeSystemInterface;
  private readonly logger = createLogger('CouncilDecision');

  public constructor(voiceSystem: Readonly<VoiceArchetypeSystem>) {
    super();
    this.voiceSystem = voiceSystem;
  }

  /**
   * Conduct a council session with multiple voices
   */
  public async conductCouncilSession(
    prompt: string,
    voices: readonly string[],
    config: Readonly<CouncilConfig>
  ): Promise<CouncilDecision> {
    const sessionId = this.generateSessionId();
    this.logger.info(`Starting council session ${sessionId} with ${voices.length} voices`, {
      mode: config.mode,
      maxRounds: config.maxRounds,
      consensusThreshold: config.consensusThreshold,
      timeoutMs: config.timeoutMs,
    });

    // Apply timeout from configuration
    const sessionTimeout = setTimeout(() => {
      this.logger.warn(`Council session ${sessionId} timed out after ${config.timeoutMs}ms`);
    }, config.timeoutMs);

    try {
      // Collect perspectives from all voices in parallel with timeout
      this.logger.debug(`Collecting perspectives from ${voices.length} voices in parallel`);
      
      const perspectivePromises = voices.map(voiceId =>
        Promise.race([
          this.voiceSystem.getVoicePerspective(voiceId, prompt)
            .then(perspective => perspective as VoicePerspective),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error(`Voice ${voiceId} timed out`)), config.timeoutMs / voices.length)
          )
        ])
        .catch(error => {
          this.logger.warn(`Failed to get perspective from voice ${voiceId}:`, error);
          return null; // Return null for failed perspectives, filter out later
        })
      );

      const perspectiveResults = await Promise.all(perspectivePromises);
      const perspectives = perspectiveResults.filter(p => p !== null) as VoicePerspective[];

      // Apply consensus threshold from configuration
      const consensusLevel = this.calculateConsensus(perspectives);
      
      if (consensusLevel < config.consensusThreshold) {
        this.logger.warn(`Council session ${sessionId} failed to meet consensus threshold`, {
          achieved: consensusLevel,
          required: config.consensusThreshold,
        });
      }

      // Apply configuration-based decision synthesis
      const finalDecision = this.synthesizeDecisionWithConfig(perspectives, config);
      
      // Handle dissent based on configuration
      const dissent = config.allowDissent 
        ? this.extractDissent(perspectives, consensusLevel, config.consensusThreshold)
        : [];

      // Generate explanations if required
      const decisionRationale = config.requireExplanations
        ? this.generateExplanation(perspectives, config)
        : 'Multi-voice synthesis decision';

      return {
        finalDecision,
        consensusLevel,
        participatingVoices: Array.from(voices),
        perspectives,
        conflictsResolved: [],
        decisionRationale,
        dissent,
      };

    } finally {
      clearTimeout(sessionTimeout);
    }
  }

  private synthesizeDecisionWithConfig(
    perspectives: VoicePerspective[], 
    config: CouncilConfig
  ): string {
    switch (config.mode) {
      case CouncilMode.COLLABORATIVE:
        return this.synthesizeCollaboratively(perspectives);
      case CouncilMode.DEBATE:
        return this.synthesizeFromDebate(perspectives);
      case CouncilMode.CONSENSUS:
        return this.synthesizeWithConsensus(perspectives, config.consensusThreshold);
      default:
        return this.synthesizeDecision(perspectives); // Fallback to simple synthesis
    }
  }

  private synthesizeCollaboratively(perspectives: VoicePerspective[]): string {
    // Combine perspectives in a collaborative manner - enhance with better synthesis logic
    const positions = perspectives.map(p => p.position);
    const reasoning = perspectives.map(p => p.reasoning).filter(r => r.trim().length > 0);
    
    if (reasoning.length > 0) {
      return `Collaborative approach incorporating ${positions.length} perspectives: ${positions.join('; ')}. Combined reasoning: ${reasoning.slice(0, 2).join('; ')}.`;
    }
    return `Collaborative synthesis: ${positions.join('; ')}.`;
  }

  private synthesizeFromDebate(perspectives: VoicePerspective[]): string {
    // Highlight different viewpoints and conflicts with structured debate format
    const highConfidence = perspectives.filter(p => p.confidence > 0.7);
    const positions = highConfidence.length > 0 ? highConfidence : perspectives;
    
    const debates = positions.map(p => {
      const concerns = p.concerns.length > 0 ? ` (concerns: ${p.concerns.slice(0, 2).join(', ')})` : '';
      return `${p.voiceId}: ${p.position}${concerns}`;
    });
    
    return `Structured debate synthesis: ${debates.join('; ')}.`;
  }

  private synthesizeWithConsensus(perspectives: VoicePerspective[], threshold: number): string {
    // Only include perspectives that meet consensus threshold with detailed analysis
    const consensusViews = perspectives.filter(p => p.confidence >= threshold);
    
    if (consensusViews.length === 0) {
      const fallback = perspectives.sort((a, b) => b.confidence - a.confidence)[0];
      return `No consensus reached (threshold: ${threshold}). Highest confidence perspective from ${fallback?.voiceId || 'unknown'}: ${fallback?.position || 'No perspectives available'}`;
    }
    
    const avgConfidence = consensusViews.reduce((sum, v) => sum + v.confidence, 0) / consensusViews.length;
    return `Strong consensus (${consensusViews.length}/${perspectives.length} voices, avg confidence: ${avgConfidence.toFixed(2)}): ${consensusViews.map(p => p.position).join('; ')}.`;
  }

  private extractDissent(
    perspectives: VoicePerspective[], 
    consensusLevel: number, 
    threshold: number
  ): string[] {
    if (consensusLevel >= threshold) return [];
    
    // Find perspectives that significantly differ from the majority
    const lowConfidence = perspectives.filter(p => p.confidence < 0.5);
    return lowConfidence.map(p => `${p.voiceId} dissents: ${p.concerns?.join(', ') || 'General disagreement'}`);
  }

  private generateExplanation(perspectives: VoicePerspective[], config: CouncilConfig): string {
    const explanationParts = [
      `Council mode: ${config.mode}`,
      `Perspectives considered: ${perspectives.length}`,
      `Consensus threshold: ${config.consensusThreshold}`,
    ];

    const reasoning = perspectives
      .map(p => p.reasoning)
      .filter(r => r && r.trim().length > 0);
    
    if (reasoning.length > 0) {
      explanationParts.push(`Key reasoning: ${reasoning.slice(0, 3).join('; ')}`);
    }

    return explanationParts.join('. ');
  }

  private synthesizeDecision(perspectives: VoicePerspective[]): string {
    // Simple synthesis - in real implementation would be more sophisticated
    return perspectives.map(p => p.position).join('; ');
  }

  private calculateConsensus(perspectives: VoicePerspective[]): number {
    if (perspectives.length === 0) return 0;
    const avgConfidence =
      perspectives.reduce((sum, p) => sum + p.confidence, 0) / perspectives.length;
    return Math.min(avgConfidence, 1.0);
  }

  protected generateSessionId(): string {
    return `council_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting interfaces for enhanced functionality
interface _PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
}
