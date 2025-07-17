// Team Consciousness Development Tracking
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { logger } from "../../lib/logger";
import type { DatabaseStorage } from "../storage";

interface ConsciousnessMetrics {
  individualLevel: number;
  teamAlignment: number;
  archetypeBalance: number;
  shadowIntegration: number;
  spiralProgression: number;
  overallConsciousness: number;
}

interface SpiralPhaseData {
  phase: 'collapse' | 'council' | 'synthesis' | 'rebirth';
  duration: number;
  participants: string[];
  achievements: string[];
  challenges: string[];
}

interface ArchetypeBalance {
  explorer: number;
  maintainer: number;
  analyzer: number;
  developer: number;
  implementor: number;
  balance: number;
}

interface TeamLearningPattern {
  patternType: string;
  frequency: number;
  effectiveness: number;
  lastOccurrence: Date;
  evolutionTrend: 'ascending' | 'stable' | 'descending';
}

export class TeamConsciousnessTracker {
  private consciousnessHistory: Map<string, ConsciousnessMetrics[]> = new Map();
  private spiralPhases: Map<string, SpiralPhaseData[]> = new Map();
  private learningPatterns: Map<string, TeamLearningPattern[]> = new Map();

  constructor(private storage: DatabaseStorage) {
    logger.info('Team Consciousness Tracker initialized', {
      trackingDimensions: ['individual', 'team', 'archetype', 'shadow', 'spiral'],
      methodology: 'Jung + Alexander + Bateson + Campbell integration'
    });
  }

  async trackTeamSession(teamId: string, sessionData: {
    participants: string[];
    voicesUsed: string[];
    duration: number;
    synthesisQuality: number;
    decisionsMade: number;
    conflictsResolved: number;
  }): Promise<ConsciousnessMetrics> {
    try {
      const metrics = await this.calculateConsciousnessMetrics(teamId, sessionData);
      
      // Store in consciousness history
      const history = this.consciousnessHistory.get(teamId) || [];
      history.push(metrics);
      this.consciousnessHistory.set(teamId, history.slice(-50)); // Keep last 50 entries

      // Update database with consciousness evolution
      await this.storage.updateTeamConsciousness(teamId, {
        consciousness: metrics.overallConsciousness,
        alignment: metrics.teamAlignment,
        archetypeBalance: metrics.archetypeBalance,
        spiralPhase: await this.getCurrentSpiralPhase(teamId),
        lastUpdate: new Date()
      });

      logger.info('Team consciousness tracked', {
        teamId,
        consciousness: metrics.overallConsciousness,
        alignment: metrics.teamAlignment,
        participantCount: sessionData.participants.length
      });

      return metrics;

    } catch (error) {
      logger.error('Failed to track team consciousness', { teamId, error });
      throw error;
    }
  }

  private async calculateConsciousnessMetrics(
    teamId: string, 
    sessionData: any
  ): Promise<ConsciousnessMetrics> {
    // Individual Level: Average consciousness of participants
    const individualLevel = await this.calculateIndividualConsciousness(sessionData.participants);
    
    // Team Alignment: How well team members work together
    const teamAlignment = this.calculateTeamAlignment(sessionData);
    
    // Archetype Balance: Distribution of voice archetypes used
    const archetypeBalance = this.calculateArchetypeBalance(sessionData.voicesUsed);
    
    // Shadow Integration: How well conflicts are resolved
    const shadowIntegration = this.calculateShadowIntegration(sessionData);
    
    // Spiral Progression: Movement through consciousness phases
    const spiralProgression = await this.calculateSpiralProgression(teamId, sessionData);
    
    // Overall consciousness using Jung's integration formula
    const overallConsciousness = this.calculateOverallConsciousness({
      individualLevel,
      teamAlignment,
      archetypeBalance,
      shadowIntegration,
      spiralProgression
    });

    return {
      individualLevel,
      teamAlignment,
      archetypeBalance,
      shadowIntegration,
      spiralProgression,
      overallConsciousness
    };
  }

  private async calculateIndividualConsciousness(participants: string[]): Promise<number> {
    let totalConsciousness = 0;
    let count = 0;

    for (const participantId of participants) {
      try {
        const user = await this.storage.getUserById(parseInt(participantId));
        if (user) {
          // Calculate individual consciousness based on usage patterns
          const userSessions = await this.storage.getVoiceSessionsByUser(user.id);
          const consciousnessLevel = this.calculateUserConsciousness(userSessions);
          totalConsciousness += consciousnessLevel;
          count++;
        }
      } catch (error) {
        logger.warn('Failed to get user consciousness', { participantId, error });
        // Use default consciousness level
        totalConsciousness += 5;
        count++;
      }
    }

    return count > 0 ? totalConsciousness / count : 5;
  }

  private calculateUserConsciousness(sessions: any[]): number {
    let consciousness = 5; // Base consciousness

    // Factor in session frequency
    if (sessions.length > 10) consciousness += 1;
    if (sessions.length > 50) consciousness += 1;

    // Factor in voice diversity
    const uniqueVoices = new Set(sessions.map(s => s.voiceCombination || s.voiceEngine));
    if (uniqueVoices.size > 3) consciousness += 0.5;
    if (uniqueVoices.size > 5) consciousness += 0.5;

    // Factor in synthesis usage
    const synthesisCount = sessions.filter(s => s.synthesized).length;
    if (synthesisCount > 5) consciousness += 1;

    return Math.min(consciousness, 10);
  }

  private calculateTeamAlignment(sessionData: any): number {
    let alignment = 5; // Base alignment

    // Factor in collaboration duration
    if (sessionData.duration > 1800) alignment += 1; // 30+ minutes
    if (sessionData.duration > 3600) alignment += 1; // 60+ minutes

    // Factor in synthesis quality
    alignment += (sessionData.synthesisQuality / 100) * 2;

    // Factor in conflict resolution
    if (sessionData.conflictsResolved > 0) {
      alignment += Math.min(sessionData.conflictsResolved * 0.5, 2);
    }

    // Factor in decisions made
    if (sessionData.decisionsMade > 0) {
      alignment += Math.min(sessionData.decisionsMade * 0.3, 1.5);
    }

    return Math.min(alignment, 10);
  }

  private calculateArchetypeBalance(voicesUsed: string[]): number {
    const archetypes = {
      explorer: 0, maintainer: 0, analyzer: 0, developer: 0, implementor: 0
    };

    // Count archetype usage
    for (const voice of voicesUsed) {
      const voiceLower = voice.toLowerCase();
      if (voiceLower.includes('explorer') || voiceLower.includes('seeker')) archetypes.explorer++;
      if (voiceLower.includes('maintainer') || voiceLower.includes('steward')) archetypes.maintainer++;
      if (voiceLower.includes('analyzer') || voiceLower.includes('witness')) archetypes.analyzer++;
      if (voiceLower.includes('developer') || voiceLower.includes('nurturer')) archetypes.developer++;
      if (voiceLower.includes('implementor') || voiceLower.includes('decider')) archetypes.implementor++;
    }

    // Calculate balance (lower variance = higher balance)
    const values = Object.values(archetypes);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    // Convert variance to balance score (0-10)
    const balance = Math.max(0, 10 - (variance * 2));
    
    return balance;
  }

  private calculateShadowIntegration(sessionData: any): number {
    let integration = 5; // Base integration

    // Higher conflict resolution indicates better shadow work
    if (sessionData.conflictsResolved > 0) {
      integration += Math.min(sessionData.conflictsResolved * 1.5, 3);
    }

    // Longer sessions with conflicts show deeper integration work
    if (sessionData.duration > 1800 && sessionData.conflictsResolved > 0) {
      integration += 1;
    }

    // Multiple decisions from conflicts show synthesis capability
    if (sessionData.decisionsMade > sessionData.conflictsResolved && sessionData.conflictsResolved > 0) {
      integration += 1;
    }

    return Math.min(integration, 10);
  }

  private async calculateSpiralProgression(teamId: string, sessionData: any): Promise<number> {
    const phases = this.spiralPhases.get(teamId) || [];
    
    // Determine current phase based on session characteristics
    let currentPhase: SpiralPhaseData['phase'] = 'collapse';
    
    if (sessionData.conflictsResolved > 0) currentPhase = 'council';
    if (sessionData.synthesisQuality > 70) currentPhase = 'synthesis';
    if (sessionData.decisionsMade > 2 && sessionData.synthesisQuality > 80) currentPhase = 'rebirth';

    // Add current phase
    phases.push({
      phase: currentPhase,
      duration: sessionData.duration,
      participants: sessionData.participants,
      achievements: [`Phase: ${currentPhase}`, `Quality: ${sessionData.synthesisQuality}%`],
      challenges: sessionData.conflictsResolved > 0 ? ['Conflicts resolved'] : []
    });

    this.spiralPhases.set(teamId, phases.slice(-20)); // Keep last 20 phases

    // Calculate progression based on phase advancement
    const phaseWeights = { collapse: 2, council: 5, synthesis: 8, rebirth: 10 };
    const recentPhases = phases.slice(-5); // Last 5 phases
    const avgProgression = recentPhases.reduce((sum, phase) => sum + phaseWeights[phase.phase], 0) / recentPhases.length;

    return avgProgression || 5;
  }

  private calculateOverallConsciousness(metrics: Omit<ConsciousnessMetrics, 'overallConsciousness'>): number {
    // Jung's integration formula with consciousness weighting
    const weights = {
      individualLevel: 0.2,
      teamAlignment: 0.25,
      archetypeBalance: 0.2,
      shadowIntegration: 0.15,
      spiralProgression: 0.2
    };

    const weightedSum = 
      metrics.individualLevel * weights.individualLevel +
      metrics.teamAlignment * weights.teamAlignment +
      metrics.archetypeBalance * weights.archetypeBalance +
      metrics.shadowIntegration * weights.shadowIntegration +
      metrics.spiralProgression * weights.spiralProgression;

    return Math.min(weightedSum, 10);
  }

  async getCurrentSpiralPhase(teamId: string): Promise<string> {
    const phases = this.spiralPhases.get(teamId) || [];
    const latestPhase = phases[phases.length - 1];
    return latestPhase?.phase || 'collapse';
  }

  async getTeamConsciousnessEvolution(teamId: string, days: number = 30): Promise<ConsciousnessMetrics[]> {
    const history = this.consciousnessHistory.get(teamId) || [];
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return history.filter((_, index) => {
      // Simple time filtering based on array position (recent entries)
      return index >= Math.max(0, history.length - days);
    });
  }

  async identifyLearningPatterns(teamId: string): Promise<TeamLearningPattern[]> {
    const patterns = this.learningPatterns.get(teamId) || [];
    
    // Analyze session patterns
    const sessions = await this.storage.getTeamSessions(teamId);
    const newPatterns = this.extractLearningPatterns(sessions);
    
    // Merge with existing patterns
    const mergedPatterns = this.mergeLearningPatterns(patterns, newPatterns);
    this.learningPatterns.set(teamId, mergedPatterns);
    
    return mergedPatterns;
  }

  private extractLearningPatterns(sessions: any[]): TeamLearningPattern[] {
    const patterns: TeamLearningPattern[] = [];
    
    // Pattern: Regular collaboration frequency
    const sessionFrequency = sessions.length / 30; // Sessions per day average
    if (sessionFrequency > 0.5) {
      patterns.push({
        patternType: 'high_collaboration_frequency',
        frequency: sessionFrequency,
        effectiveness: Math.min(sessionFrequency * 2, 10),
        lastOccurrence: new Date(),
        evolutionTrend: 'ascending'
      });
    }

    // Pattern: Voice diversity usage
    const uniqueVoices = new Set(sessions.map(s => s.voiceCombination)).size;
    if (uniqueVoices > 3) {
      patterns.push({
        patternType: 'voice_diversity',
        frequency: uniqueVoices / 9, // Normalized by total possible voices
        effectiveness: Math.min(uniqueVoices * 1.2, 10),
        lastOccurrence: new Date(),
        evolutionTrend: 'ascending'
      });
    }

    // Pattern: Synthesis progression
    const synthesisRate = sessions.filter(s => s.synthesized).length / sessions.length;
    if (synthesisRate > 0.3) {
      patterns.push({
        patternType: 'synthesis_mastery',
        frequency: synthesisRate,
        effectiveness: synthesisRate * 10,
        lastOccurrence: new Date(),
        evolutionTrend: 'ascending'
      });
    }

    return patterns;
  }

  private mergeLearningPatterns(existing: TeamLearningPattern[], newPatterns: TeamLearningPattern[]): TeamLearningPattern[] {
    const merged = [...existing];
    
    for (const newPattern of newPatterns) {
      const existingIndex = merged.findIndex(p => p.patternType === newPattern.patternType);
      if (existingIndex >= 0) {
        // Update existing pattern
        const old = merged[existingIndex];
        merged[existingIndex] = {
          ...newPattern,
          evolutionTrend: newPattern.effectiveness > old.effectiveness ? 'ascending' : 
                          newPattern.effectiveness < old.effectiveness ? 'descending' : 'stable'
        };
      } else {
        // Add new pattern
        merged.push(newPattern);
      }
    }
    
    return merged;
  }

  // Public API for external integration
  async getTeamConsciousnessReport(teamId: string): Promise<{
    currentMetrics: ConsciousnessMetrics;
    evolution: ConsciousnessMetrics[];
    learningPatterns: TeamLearningPattern[];
    spiralPhase: string;
    recommendations: string[];
  }> {
    const history = this.consciousnessHistory.get(teamId) || [];
    const currentMetrics = history[history.length - 1] || {
      individualLevel: 5, teamAlignment: 5, archetypeBalance: 5,
      shadowIntegration: 5, spiralProgression: 5, overallConsciousness: 5
    };

    const evolution = await this.getTeamConsciousnessEvolution(teamId);
    const learningPatterns = await this.identifyLearningPatterns(teamId);
    const spiralPhase = await this.getCurrentSpiralPhase(teamId);
    const recommendations = this.generateRecommendations(currentMetrics, learningPatterns);

    return {
      currentMetrics,
      evolution,
      learningPatterns,
      spiralPhase,
      recommendations
    };
  }

  private generateRecommendations(metrics: ConsciousnessMetrics, patterns: TeamLearningPattern[]): string[] {
    const recommendations: string[] = [];

    if (metrics.archetypeBalance < 6) {
      recommendations.push('Increase voice diversity in team sessions for better archetypal balance');
    }

    if (metrics.shadowIntegration < 6) {
      recommendations.push('Focus on conflict resolution and shadow work integration');
    }

    if (metrics.spiralProgression < 7) {
      recommendations.push('Advance through spiral phases: Collapse → Council → Synthesis → Rebirth');
    }

    if (patterns.find(p => p.patternType === 'synthesis_mastery')?.effectiveness < 5) {
      recommendations.push('Practice synthesis techniques to improve solution integration');
    }

    if (metrics.overallConsciousness > 8) {
      recommendations.push('Excellent consciousness level! Consider mentoring other teams');
    }

    return recommendations.slice(0, 3); // Top 3 recommendations
  }
}