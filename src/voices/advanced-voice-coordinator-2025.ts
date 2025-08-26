/**
 * Advanced Voice Coordination System (2025 Pattern)
 * Agent 3: Voice System Optimization Specialist
 * 
 * Advanced Features:
 * - Dynamic voice role assignment based on task complexity
 * - Voice expertise matching for specialized domains  
 * - Consensus building algorithms for voice disagreements
 * - Performance tracking for individual voice effectiveness
 * - Conflict resolution with weighted voting
 * - Real-time coordination optimization
 */

import { logger } from '../core/logger.js';
import { getErrorMessage } from '../utils/error-utils.js';

export interface VoiceExpertise {
  voiceId: string;
  domain: string;
  expertiseLevel: number; // 0-1 scale
  successRate: number;
  averageQuality: number;
  specializations: string[];
}

export interface CoordinationContext {
  taskType: string;
  complexity: 'simple' | 'moderate' | 'complex';
  timeConstraint: 'fast' | 'normal' | 'thorough';
  qualityRequirement: 'basic' | 'high' | 'critical';
  domainRequirements: string[];
  conflictTolerance: 'low' | 'medium' | 'high';
}

export interface VoiceAssignment {
  voiceId: string;
  role: 'lead' | 'specialist' | 'reviewer' | 'validator';
  weight: number;
  expertise: number;
  expectedContribution: string;
}

export interface ConflictResolution {
  conflicts: VoiceConflict[];
  resolutionStrategy: 'consensus' | 'weighted' | 'expertise' | 'majority';
  finalDecision: string;
  confidence: number;
  dissent: string[];
}

export interface VoiceConflict {
  voiceA: string;
  voiceB: string;
  conflictType: 'approach' | 'priority' | 'implementation' | 'quality';
  severity: number; // 0-1 scale
  description: string;
  possibleResolutions: string[];
}

export interface CoordinationResult {
  assignments: VoiceAssignment[];
  expectedQuality: number;
  estimatedTime: number;
  coordinationOverhead: number;
  conflictProbability: number;
  recommendations: string[];
}

/**
 * Advanced Voice Coordinator for optimal multi-voice collaboration
 */
export class AdvancedVoiceCoordinator2025 {
  private voiceExpertiseMap: Map<string, VoiceExpertise> = new Map();
  private collaborationHistory: Map<string, any[]> = new Map();
  private conflictPatterns: Map<string, VoiceConflict[]> = new Map();
  private performanceCache: Map<string, any> = new Map();

  constructor() {
    this.initializeVoiceExpertise();
    logger.info('🎭 Advanced Voice Coordinator initialized with expertise mapping');
  }

  /**
   * Initialize voice expertise profiles based on specializations
   */
  private initializeVoiceExpertise(): void {
    const expertiseProfiles: VoiceExpertise[] = [
      {
        voiceId: 'developer',
        domain: 'implementation',
        expertiseLevel: 0.9,
        successRate: 0.85,
        averageQuality: 0.82,
        specializations: ['coding', 'debugging', 'testing', 'api-design']
      },
      {
        voiceId: 'security',
        domain: 'security',
        expertiseLevel: 0.95,
        successRate: 0.88,
        averageQuality: 0.90,
        specializations: ['vulnerability-assessment', 'authentication', 'encryption', 'compliance']
      },
      {
        voiceId: 'architect',
        domain: 'design',
        expertiseLevel: 0.92,
        successRate: 0.87,
        averageQuality: 0.89,
        specializations: ['system-design', 'patterns', 'scalability', 'integration']
      },
      {
        voiceId: 'analyzer',
        domain: 'analysis',
        expertiseLevel: 0.88,
        successRate: 0.83,
        averageQuality: 0.84,
        specializations: ['performance', 'optimization', 'profiling', 'monitoring']
      },
      {
        voiceId: 'maintainer',
        domain: 'quality',
        expertiseLevel: 0.86,
        successRate: 0.89,
        averageQuality: 0.87,
        specializations: ['refactoring', 'documentation', 'best-practices', 'maintenance']
      },
      {
        voiceId: 'designer',
        domain: 'ux',
        expertiseLevel: 0.84,
        successRate: 0.81,
        averageQuality: 0.85,
        specializations: ['ui-design', 'user-experience', 'accessibility', 'usability']
      },
      {
        voiceId: 'optimizer',
        domain: 'performance',
        expertiseLevel: 0.90,
        successRate: 0.85,
        averageQuality: 0.86,
        specializations: ['optimization', 'caching', 'memory-management', 'efficiency']
      },
      {
        voiceId: 'implementor',
        domain: 'execution',
        expertiseLevel: 0.87,
        successRate: 0.84,
        averageQuality: 0.83,
        specializations: ['deployment', 'automation', 'ci-cd', 'production']
      },
      {
        voiceId: 'explorer',
        domain: 'innovation',
        expertiseLevel: 0.82,
        successRate: 0.78,
        averageQuality: 0.80,
        specializations: ['research', 'prototyping', 'experimentation', 'creativity']
      },
      {
        voiceId: 'guardian',
        domain: 'validation',
        expertiseLevel: 0.91,
        successRate: 0.92,
        averageQuality: 0.88,
        specializations: ['quality-gates', 'validation', 'compliance', 'reliability']
      }
    ];

    for (const profile of expertiseProfiles) {
      this.voiceExpertiseMap.set(profile.voiceId, profile);
    }
  }

  /**
   * Coordinate optimal voice assignments for a given context
   */
  async coordinateVoices(
    availableVoices: string[],
    context: CoordinationContext
  ): Promise<CoordinationResult> {
    logger.info('🎯 Coordinating voices for optimal collaboration', {
      taskType: context.taskType,
      complexity: context.complexity,
      voiceCount: availableVoices.length
    });

    // Analyze task requirements and match with voice expertise
    const domainAnalysis = this.analyzeDomainRequirements(context);
    const expertiseMatches = this.matchVoiceExpertise(availableVoices, domainAnalysis);
    
    // Assign roles based on expertise and task requirements
    const assignments = await this.assignVoiceRoles(expertiseMatches, context);
    
    // Calculate expected outcomes
    const expectedQuality = this.calculateExpectedQuality(assignments);
    const estimatedTime = this.estimateCoordinationTime(assignments, context);
    const coordinationOverhead = this.calculateCoordinationOverhead(assignments);
    const conflictProbability = this.assessConflictProbability(assignments);
    
    // Generate optimization recommendations
    const recommendations = this.generateCoordinationRecommendations(assignments, context);

    return {
      assignments,
      expectedQuality,
      estimatedTime,
      coordinationOverhead,
      conflictProbability,
      recommendations
    };
  }

  /**
   * Resolve conflicts between voice recommendations using advanced algorithms
   */
  async resolveVoiceConflicts(
    voiceResponses: Array<{ voiceId: string; content: string; confidence: number }>,
    context: CoordinationContext
  ): Promise<ConflictResolution> {
    // Detect conflicts between voice responses
    const conflicts = this.detectVoiceConflicts(voiceResponses);
    
    // Choose resolution strategy based on context and conflict types
    const resolutionStrategy = this.selectResolutionStrategy(conflicts, context);
    
    // Apply resolution algorithm
    const resolution = await this.applyConflictResolution(
      voiceResponses,
      conflicts,
      resolutionStrategy,
      context
    );

    logger.info('🔀 Voice conflicts resolved', {
      conflictCount: conflicts.length,
      strategy: resolutionStrategy,
      confidence: resolution.confidence
    });

    return resolution;
  }

  /**
   * Analyze domain requirements from coordination context
   */
  private analyzeDomainRequirements(context: CoordinationContext): string[] {
    const domains = [];
    
    // Map task type to required domains
    const taskDomainMapping = {
      'implementation': ['implementation', 'quality'],
      'security-review': ['security', 'implementation', 'quality'],
      'architecture': ['design', 'implementation', 'performance'],
      'optimization': ['performance', 'analysis', 'implementation'],
      'ui-design': ['ux', 'implementation', 'quality'],
      'analysis': ['analysis', 'performance', 'quality'],
      'deployment': ['execution', 'security', 'implementation'],
      'research': ['innovation', 'analysis', 'implementation']
    };

    const baseDomains = taskDomainMapping[context.taskType] || ['implementation'];
    domains.push(...baseDomains);

    // Add domain requirements explicitly specified
    if (context.domainRequirements) {
      domains.push(...context.domainRequirements);
    }

    // Add quality domain for high-quality requirements
    if (context.qualityRequirement === 'critical' && !domains.includes('validation')) {
      domains.push('validation');
    }

    return [...new Set(domains)]; // Remove duplicates
  }

  /**
   * Match available voices to required domain expertise
   */
  private matchVoiceExpertise(availableVoices: string[], requiredDomains: string[]): Array<{
    voiceId: string;
    expertise: VoiceExpertise;
    domainMatch: number;
    overallScore: number;
  }> {
    const matches = [];

    for (const voiceId of availableVoices) {
      const expertise = this.voiceExpertiseMap.get(voiceId);
      if (!expertise) continue;

      // Calculate domain match score
      const domainMatch = this.calculateDomainMatch(expertise, requiredDomains);
      
      // Calculate overall score (domain match + expertise level + success rate)
      const overallScore = (domainMatch * 0.4) + (expertise.expertiseLevel * 0.3) + (expertise.successRate * 0.3);

      matches.push({
        voiceId,
        expertise,
        domainMatch,
        overallScore
      });
    }

    // Sort by overall score (highest first)
    return matches.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Calculate how well a voice's expertise matches required domains
   */
  private calculateDomainMatch(expertise: VoiceExpertise, requiredDomains: string[]): number {
    let matchScore = 0;
    
    // Primary domain match (full weight)
    if (requiredDomains.includes(expertise.domain)) {
      matchScore += 1.0;
    }

    // Specialization matches (partial weight)
    for (const specialization of expertise.specializations) {
      for (const domain of requiredDomains) {
        if (specialization.includes(domain) || domain.includes(specialization)) {
          matchScore += 0.3;
        }
      }
    }

    return Math.min(matchScore, 1.0); // Cap at 1.0
  }

  /**
   * Assign roles to voices based on expertise and context
   */
  private async assignVoiceRoles(
    expertiseMatches: Array<{ voiceId: string; expertise: VoiceExpertise; domainMatch: number; overallScore: number }>,
    context: CoordinationContext
  ): Promise<VoiceAssignment[]> {
    const assignments: VoiceAssignment[] = [];
    
    // Determine optimal team size based on complexity
    const teamSizes = { simple: 1, moderate: 2, complex: 3 };
    const targetTeamSize = Math.min(teamSizes[context.complexity], expertiseMatches.length);

    // Assign lead role to highest-scoring voice
    if (expertiseMatches.length > 0) {
      const leadMatch = expertiseMatches[0];
      assignments.push({
        voiceId: leadMatch.voiceId,
        role: 'lead',
        weight: 0.5,
        expertise: leadMatch.overallScore,
        expectedContribution: `Primary ${leadMatch.expertise.domain} leadership and coordination`
      });
    }

    // Assign specialist roles to remaining high-scoring voices
    for (let i = 1; i < targetTeamSize; i++) {
      if (i < expertiseMatches.length) {
        const specialistMatch = expertiseMatches[i];
        const role = i === targetTeamSize - 1 && context.qualityRequirement === 'critical' ? 'validator' : 'specialist';
        
        assignments.push({
          voiceId: specialistMatch.voiceId,
          role,
          weight: role === 'validator' ? 0.3 : 0.4,
          expertise: specialistMatch.overallScore,
          expectedContribution: `${specialistMatch.expertise.domain} expertise and specialized insights`
        });
      }
    }

    // Adjust weights to sum to 1.0
    const totalWeight = assignments.reduce((sum, assignment) => sum + assignment.weight, 0);
    assignments.forEach(assignment => {
      assignment.weight = assignment.weight / totalWeight;
    });

    return assignments;
  }

  /**
   * Detect conflicts between voice responses
   */
  private detectVoiceConflicts(
    voiceResponses: Array<{ voiceId: string; content: string; confidence: number }>
  ): VoiceConflict[] {
    const conflicts: VoiceConflict[] = [];
    
    for (let i = 0; i < voiceResponses.length; i++) {
      for (let j = i + 1; j < voiceResponses.length; j++) {
        const responseA = voiceResponses[i];
        const responseB = voiceResponses[j];
        
        // Detect conflicts using content analysis
        const conflict = this.analyzeResponseConflict(responseA, responseB);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Analyze potential conflicts between two voice responses
   */
  private analyzeResponseConflict(
    responseA: { voiceId: string; content: string; confidence: number },
    responseB: { voiceId: string; content: string; confidence: number }
  ): VoiceConflict | null {
    const contentA = responseA.content.toLowerCase();
    const contentB = responseB.content.toLowerCase();

    // Detect opposing keywords or approaches
    const conflictIndicators = [
      { keywords: ['synchronous', 'asynchronous'], type: 'approach' },
      { keywords: ['security', 'performance'], type: 'priority' },
      { keywords: ['simple', 'complex'], type: 'implementation' },
      { keywords: ['fast', 'thorough'], type: 'quality' }
    ];

    for (const indicator of conflictIndicators) {
      const hasKeywordA = indicator.keywords.some(kw => contentA.includes(kw));
      const hasKeywordB = indicator.keywords.some(kw => contentB.includes(kw));
      
      if (hasKeywordA && hasKeywordB) {
        // Check if they suggest different keywords from the same category
        const keywordsA = indicator.keywords.filter(kw => contentA.includes(kw));
        const keywordsB = indicator.keywords.filter(kw => contentB.includes(kw));
        
        if (keywordsA.some(kw => !keywordsB.includes(kw))) {
          return {
            voiceA: responseA.voiceId,
            voiceB: responseB.voiceId,
            conflictType: indicator.type as any,
            severity: this.calculateConflictSeverity(responseA.confidence, responseB.confidence),
            description: `Disagreement on ${indicator.type}: ${keywordsA.join(', ')} vs ${keywordsB.join(', ')}`,
            possibleResolutions: this.generateConflictResolutions(indicator.type as any)
          };
        }
      }
    }

    return null;
  }

  /**
   * Calculate conflict severity based on voice confidence levels
   */
  private calculateConflictSeverity(confidenceA: number, confidenceB: number): number {
    // Higher confidence in both responses = higher severity conflict
    const avgConfidence = (confidenceA + confidenceB) / 2;
    const confidenceDifference = Math.abs(confidenceA - confidenceB);
    
    // Severe if both are confident but disagree
    if (avgConfidence > 0.8 && confidenceDifference < 0.2) {
      return 0.9;
    }
    
    // Moderate if one is confident, other is not
    if (confidenceDifference > 0.3) {
      return 0.5;
    }
    
    // Low severity otherwise
    return 0.3;
  }

  /**
   * Generate possible resolutions for different conflict types
   */
  private generateConflictResolutions(conflictType: 'approach' | 'priority' | 'implementation' | 'quality'): string[] {
    const resolutionStrategies = {
      approach: [
        'Combine both approaches in a hybrid solution',
        'Use the approach with higher expertise backing',
        'Create A/B testing to determine optimal approach',
        'Sequential implementation (try approach A, fallback to B)'
      ],
      priority: [
        'Prioritize based on project requirements',
        'Implement both with priority ordering',
        'Seek stakeholder input on priority',
        'Use weighted scoring to balance priorities'
      ],
      implementation: [
        'Start with simpler approach and iterate',
        'Use modular design to support both implementations',
        'Choose based on team expertise and timeline',
        'Implement complex solution with simple fallback'
      ],
      quality: [
        'Define quality metrics and choose accordingly',
        'Use time-boxed approach (fast first, iterate for quality)',
        'Implement quality gates and checkpoints',
        'Balance quality with delivery constraints'
      ]
    };

    return resolutionStrategies[conflictType] || ['Seek additional expert input', 'Use majority vote', 'Escalate to senior decision maker'];
  }

  /**
   * Select resolution strategy based on conflicts and context
   */
  private selectResolutionStrategy(
    conflicts: VoiceConflict[],
    context: CoordinationContext
  ): 'consensus' | 'weighted' | 'expertise' | 'majority' {
    // No conflicts - use consensus
    if (conflicts.length === 0) {
      return 'consensus';
    }

    // High severity conflicts with critical quality requirements - use expertise
    if (conflicts.some(c => c.severity > 0.7) && context.qualityRequirement === 'critical') {
      return 'expertise';
    }

    // Low conflict tolerance - use weighted voting
    if (context.conflictTolerance === 'low') {
      return 'weighted';
    }

    // Time constraints - use majority
    if (context.timeConstraint === 'fast') {
      return 'majority';
    }

    // Default to weighted for balanced approach
    return 'weighted';
  }

  /**
   * Apply conflict resolution algorithm
   */
  private async applyConflictResolution(
    voiceResponses: Array<{ voiceId: string; content: string; confidence: number }>,
    conflicts: VoiceConflict[],
    strategy: 'consensus' | 'weighted' | 'expertise' | 'majority',
    context: CoordinationContext
  ): Promise<ConflictResolution> {
    let finalDecision = '';
    let confidence = 0;
    const dissent: string[] = [];

    switch (strategy) {
      case 'consensus':
        finalDecision = this.buildConsensusDecision(voiceResponses);
        confidence = 0.9;
        break;

      case 'weighted':
        const weightedResult = this.applyWeightedVoting(voiceResponses, conflicts);
        finalDecision = weightedResult.decision;
        confidence = weightedResult.confidence;
        dissent.push(...weightedResult.dissent);
        break;

      case 'expertise':
        const expertiseResult = this.selectByExpertise(voiceResponses, context);
        finalDecision = expertiseResult.decision;
        confidence = expertiseResult.confidence;
        dissent.push(...expertiseResult.dissent);
        break;

      case 'majority':
        const majorityResult = this.applyMajorityRule(voiceResponses);
        finalDecision = majorityResult.decision;
        confidence = majorityResult.confidence;
        dissent.push(...majorityResult.dissent);
        break;
    }

    return {
      conflicts,
      resolutionStrategy: strategy,
      finalDecision,
      confidence,
      dissent
    };
  }

  /**
   * Build consensus by combining all responses
   */
  private buildConsensusDecision(voiceResponses: Array<{ voiceId: string; content: string; confidence: number }>): string {
    const sections = voiceResponses.map(response => 
      `**${response.voiceId.toUpperCase()} PERSPECTIVE:**\n${response.content}`
    );
    
    return sections.join('\n\n---\n\n');
  }

  /**
   * Apply weighted voting based on voice expertise and confidence
   */
  private applyWeightedVoting(
    voiceResponses: Array<{ voiceId: string; content: string; confidence: number }>,
    conflicts: VoiceConflict[]
  ): { decision: string; confidence: number; dissent: string[] } {
    const weights = voiceResponses.map(response => {
      const expertise = this.voiceExpertiseMap.get(response.voiceId);
      const expertiseWeight = expertise ? expertise.expertiseLevel : 0.5;
      const confidenceWeight = response.confidence;
      
      return (expertiseWeight + confidenceWeight) / 2;
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const normalizedWeights = weights.map(weight => weight / totalWeight);

    // Select response with highest weight
    const maxWeightIndex = normalizedWeights.indexOf(Math.max(...normalizedWeights));
    const selectedResponse = voiceResponses[maxWeightIndex];

    // Identify dissenting voices
    const dissent = voiceResponses
      .filter((_, index) => index !== maxWeightIndex)
      .map(response => `${response.voiceId}: Alternative approach suggested`);

    return {
      decision: selectedResponse.content,
      confidence: normalizedWeights[maxWeightIndex],
      dissent
    };
  }

  /**
   * Select decision based on domain expertise
   */
  private selectByExpertise(
    voiceResponses: Array<{ voiceId: string; content: string; confidence: number }>,
    context: CoordinationContext
  ): { decision: string; confidence: number; dissent: string[] } {
    // Find voice with highest expertise for the task domain
    let bestMatch = voiceResponses[0];
    let bestExpertise = 0;

    for (const response of voiceResponses) {
      const expertise = this.voiceExpertiseMap.get(response.voiceId);
      if (expertise) {
        const domainMatch = this.calculateDomainMatch(expertise, [context.taskType]);
        const expertiseScore = expertise.expertiseLevel * domainMatch;
        
        if (expertiseScore > bestExpertise) {
          bestExpertise = expertiseScore;
          bestMatch = response;
        }
      }
    }

    const dissent = voiceResponses
      .filter(response => response.voiceId !== bestMatch.voiceId)
      .map(response => `${response.voiceId}: Different expertise perspective`);

    return {
      decision: bestMatch.content,
      confidence: bestExpertise,
      dissent
    };
  }

  /**
   * Apply simple majority rule
   */
  private applyMajorityRule(
    voiceResponses: Array<{ voiceId: string; content: string; confidence: number }>
  ): { decision: string; confidence: number; dissent: string[] } {
    // For simplicity, select response with highest confidence as "majority"
    const sortedByConfidence = [...voiceResponses].sort((a, b) => b.confidence - a.confidence);
    const winner = sortedByConfidence[0];

    const dissent = voiceResponses
      .filter(response => response.voiceId !== winner.voiceId)
      .map(response => `${response.voiceId}: Minority opinion`);

    return {
      decision: winner.content,
      confidence: winner.confidence,
      dissent
    };
  }

  /**
   * Calculate expected quality from voice assignments
   */
  private calculateExpectedQuality(assignments: VoiceAssignment[]): number {
    if (assignments.length === 0) return 0.5;

    const weightedQuality = assignments.reduce((sum, assignment) => {
      const expertise = this.voiceExpertiseMap.get(assignment.voiceId);
      const quality = expertise ? expertise.averageQuality : 0.7;
      return sum + (quality * assignment.weight);
    }, 0);

    return Math.min(weightedQuality, 1.0);
  }

  /**
   * Estimate coordination time based on assignments and context
   */
  private estimateCoordinationTime(
    assignments: VoiceAssignment[],
    context: CoordinationContext
  ): number {
    const baseTime = 1000; // Base time in ms
    
    // Time factors
    const complexityMultipliers = { simple: 1, moderate: 1.5, complex: 2.5 };
    const teamSizeMultiplier = 1 + (assignments.length - 1) * 0.3;
    const qualityMultiplier = context.qualityRequirement === 'critical' ? 1.4 : 1;
    
    return baseTime * complexityMultipliers[context.complexity] * teamSizeMultiplier * qualityMultiplier;
  }

  /**
   * Calculate coordination overhead
   */
  private calculateCoordinationOverhead(assignments: VoiceAssignment[]): number {
    if (assignments.length <= 1) return 0;
    
    // Overhead increases quadratically with team size
    const teamSize = assignments.length;
    return Math.min((teamSize * (teamSize - 1)) * 0.05, 0.4); // Cap at 40%
  }

  /**
   * Assess probability of conflicts
   */
  private assessConflictProbability(assignments: VoiceAssignment[]): number {
    if (assignments.length <= 1) return 0;

    // Calculate based on expertise diversity and historical patterns
    const expertiseDiversity = this.calculateExpertiseDiversity(assignments);
    const historicalConflictRate = 0.15; // 15% base conflict rate
    
    return Math.min(historicalConflictRate + (expertiseDiversity * 0.2), 0.6); // Cap at 60%
  }

  /**
   * Calculate expertise diversity among assignments
   */
  private calculateExpertiseDiversity(assignments: VoiceAssignment[]): number {
    const domains = new Set();
    
    for (const assignment of assignments) {
      const expertise = this.voiceExpertiseMap.get(assignment.voiceId);
      if (expertise) {
        domains.add(expertise.domain);
      }
    }

    return domains.size / assignments.length;
  }

  /**
   * Generate coordination recommendations
   */
  private generateCoordinationRecommendations(
    assignments: VoiceAssignment[],
    context: CoordinationContext
  ): string[] {
    const recommendations = [];

    // Team size recommendations
    if (assignments.length > 3 && context.timeConstraint === 'fast') {
      recommendations.push('Consider reducing team size for faster coordination');
    }

    // Expertise coverage recommendations
    const coveredDomains = new Set(assignments.map(a => {
      const expertise = this.voiceExpertiseMap.get(a.voiceId);
      return expertise?.domain;
    }));

    if (!coveredDomains.has('security') && context.qualityRequirement === 'critical') {
      recommendations.push('Consider adding security expertise for critical quality requirements');
    }

    // Conflict prevention recommendations
    const conflictProbability = this.assessConflictProbability(assignments);
    if (conflictProbability > 0.4) {
      recommendations.push('High conflict probability - establish clear decision-making process upfront');
    }

    if (recommendations.length === 0) {
      recommendations.push('Voice coordination is well-optimized for this context');
    }

    return recommendations;
  }

  /**
   * Get coordination analytics
   */
  getCoordinationAnalytics(): any {
    return {
      expertiseProfiles: Array.from(this.voiceExpertiseMap.values()),
      collaborationHistory: this.collaborationHistory.size,
      conflictPatterns: this.conflictPatterns.size,
      performanceMetrics: Object.fromEntries(this.performanceCache)
    };
  }

  /**
   * Update expertise based on performance feedback
   */
  updateVoiceExpertise(voiceId: string, feedback: {
    quality: number;
    success: boolean;
    domain: string;
  }): void {
    const expertise = this.voiceExpertiseMap.get(voiceId);
    if (!expertise) return;

    // Update with exponential moving average
    const alpha = 0.1;
    expertise.averageQuality = (1 - alpha) * expertise.averageQuality + alpha * feedback.quality;
    expertise.successRate = (1 - alpha) * expertise.successRate + alpha * (feedback.success ? 1 : 0);

    logger.debug('🎭 Voice expertise updated', {
      voiceId,
      newQuality: expertise.averageQuality.toFixed(3),
      newSuccessRate: expertise.successRate.toFixed(3)
    });
  }
}