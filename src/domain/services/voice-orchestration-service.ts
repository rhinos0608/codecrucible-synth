/**
 * Voice Orchestration Domain Service
 * Pure business logic for multi-voice coordination and synthesis
 *
 * Living Spiral Council Applied:
 * - Domain service for business logic that doesn't fit in entities
 * - Pure business rules without infrastructure dependencies
 * - Coordination of multiple voice entities
 */

import { Voice } from '../entities/voice.js';
import { ProcessingRequest } from '../entities/request.js';
import { IVoiceRepository } from '../repositories/voice-repository.js';

/**
 * Voice Orchestration Service
 * Handles business logic for multi-voice synthesis and coordination
 */
export class VoiceOrchestrationService {
  constructor(private voiceRepository: IVoiceRepository) {}

  /**
   * Select optimal voices for a given request
   * Business rule: Balance expertise, diversity, and constraints
   */
  async selectVoicesForRequest(
    request: ProcessingRequest,
    preferences?: VoiceSelectionPreferences
  ): Promise<VoiceSelection> {
    const availableVoices = await this.voiceRepository.findEnabledVoices();

    if (availableVoices.length === 0) {
      throw new Error('No voices available for processing');
    }

    const requiredCapabilities = request.requiresCapabilities();
    const taskType = this.determineTaskType(request);

    // Apply constraints from request
    const candidateVoices = availableVoices.filter(voice => {
      if (request.constraints.excludedVoices?.includes(voice.id)) {
        return false;
      }
      return true;
    });

    // Must-include voices (if specified)
    const mustIncludeVoices: Voice[] = [];
    if (request.constraints.mustIncludeVoices) {
      for (const voiceId of request.constraints.mustIncludeVoices) {
        const voice = candidateVoices.find(v => v.id === voiceId);
        if (voice) {
          mustIncludeVoices.push(voice);
        }
      }
    }

    // Score and rank voices
    const scoredVoices = candidateVoices.map(voice => ({
      voice,
      score: voice.calculateRelevanceScore({
        taskType,
        requiredExpertise: requiredCapabilities,
      }),
    }));

    // Sort by score (descending)
    scoredVoices.sort((a, b) => b.score - a.score);

    // Select voices based on preferences and business rules
    const selectedVoices = this.selectOptimalVoiceSet(scoredVoices, mustIncludeVoices, preferences);

    return {
      primaryVoice: selectedVoices[0],
      supportingVoices: selectedVoices.slice(1),
      synthesisMode: this.determineSynthesisMode(selectedVoices, preferences),
      reasoning: this.generateSelectionReasoning(selectedVoices, scoredVoices),
    };
  }

  /**
   * Synthesize responses from multiple voices
   * Business rule: Combine voices based on confidence and expertise
   */
  synthesizeVoiceResponses(
    responses: VoiceResponse[],
    synthesisMode: SynthesisMode
  ): VoiceSynthesisResult {
    if (responses.length === 0) {
      throw new Error('No voice responses to synthesize');
    }

    if (responses.length === 1) {
      return {
        finalResponse: responses[0].content,
        synthesisMethod: 'single-voice',
        voiceContributions: responses,
        confidenceScore: responses[0].confidence,
        consensusLevel: 1.0,
      };
    }

    switch (synthesisMode) {
      case SynthesisMode.COMPETITIVE:
        return this.synthesizeCompetitive(responses);
      case SynthesisMode.COLLABORATIVE:
        return this.synthesizeCollaborative(responses);
      case SynthesisMode.CONSENSUS:
        return this.synthesizeConsensus(responses);
      case SynthesisMode.WEIGHTED:
        return this.synthesizeWeighted(responses);
      default:
        return this.synthesizeCollaborative(responses);
    }
  }

  /**
   * Detect conflicts between voice responses
   * Business rule: Identify contradictory recommendations
   */
  detectVoiceConflicts(responses: VoiceResponse[]): VoiceConflict[] {
    const conflicts: VoiceConflict[] = [];

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const conflict = this.analyzeResponseConflict(responses[i], responses[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts between voices
   * Business rule: Use expertise, confidence, and reasoning quality
   */
  resolveVoiceConflicts(conflicts: VoiceConflict[], voices: Voice[]): ConflictResolution[] {
    return conflicts.map(conflict => {
      const voice1 = voices.find(v => v.id === conflict.voice1Id);
      const voice2 = voices.find(v => v.id === conflict.voice2Id);

      if (!voice1 || !voice2) {
        return {
          conflictId: conflict.id,
          resolution: 'unresolved',
          reasoning: 'Voice not found for conflict resolution',
          winningVoiceId: null,
        };
      }

      // Resolution logic based on expertise and confidence
      const voice1Expertise = voice1.expertise.filter(exp =>
        conflict.topic.toLowerCase().includes(exp.toLowerCase())
      ).length;

      const voice2Expertise = voice2.expertise.filter(exp =>
        conflict.topic.toLowerCase().includes(exp.toLowerCase())
      ).length;

      let winningVoiceId: string;
      let reasoning: string;

      if (voice1Expertise > voice2Expertise) {
        winningVoiceId = voice1.id;
        reasoning = `${voice1.name} has more relevant expertise in ${conflict.topic}`;
      } else if (voice2Expertise > voice1Expertise) {
        winningVoiceId = voice2.id;
        reasoning = `${voice2.name} has more relevant expertise in ${conflict.topic}`;
      } else if (conflict.voice1Confidence > conflict.voice2Confidence) {
        winningVoiceId = voice1.id;
        reasoning = `${voice1.name} expressed higher confidence in their recommendation`;
      } else {
        winningVoiceId = voice2.id;
        reasoning = `${voice2.name} expressed higher confidence in their recommendation`;
      }

      return {
        conflictId: conflict.id,
        resolution: 'resolved',
        reasoning,
        winningVoiceId,
      };
    });
  }

  // Private helper methods

  private determineTaskType(request: ProcessingRequest): 'creative' | 'analytical' | 'balanced' {
    switch (request.type) {
      case 'code-generation':
        return 'creative';
      case 'code-analysis':
      case 'optimization':
        return 'analytical';
      case 'architecture-design':
        return 'balanced';
      case 'review':
        return 'analytical';
      case 'documentation':
        return 'balanced';
      default:
        return 'balanced';
    }
  }

  private selectOptimalVoiceSet(
    scoredVoices: Array<{ voice: Voice; score: number }>,
    mustIncludeVoices: Voice[],
    preferences?: VoiceSelectionPreferences
  ): Voice[] {
    const maxVoices = preferences?.maxVoices || 3;
    const minVoices = preferences?.minVoices || 1;

    const selected: Voice[] = [...mustIncludeVoices];
    const remaining = scoredVoices.filter(
      sv => !mustIncludeVoices.some(mv => mv.id === sv.voice.id)
    );

    // Add highest scoring voices until we reach the target count
    for (const { voice } of remaining) {
      if (selected.length >= maxVoices) break;

      // Ensure diversity by avoiding too many similar voices
      const isDiverse = this.ensureVoiceDiversity(selected, voice);
      if (isDiverse || selected.length < minVoices) {
        selected.push(voice);
      }
    }

    return selected;
  }

  private ensureVoiceDiversity(selectedVoices: Voice[], candidateVoice: Voice): boolean {
    // Check style diversity
    const existingStyles = selectedVoices.map(v => v.style.value);
    if (existingStyles.includes(candidateVoice.style.value) && existingStyles.length > 1) {
      return false;
    }

    // Check temperature diversity
    const avgTemperature =
      selectedVoices.reduce((sum, v) => sum + v.temperature.value, 0) / selectedVoices.length;
    const temperatureDiff = Math.abs(candidateVoice.temperature.value - avgTemperature);

    return temperatureDiff > 0.2; // Require significant temperature difference
  }

  private determineSynthesisMode(
    selectedVoices: Voice[],
    preferences?: VoiceSelectionPreferences
  ): SynthesisMode {
    if (preferences?.synthesisMode) {
      return preferences.synthesisMode;
    }

    if (selectedVoices.length === 1) {
      return SynthesisMode.SINGLE;
    }

    // Default to collaborative for multiple voices
    return SynthesisMode.COLLABORATIVE;
  }

  private generateSelectionReasoning(
    selectedVoices: Voice[],
    allScoredVoices: Array<{ voice: Voice; score: number }>
  ): string {
    const reasons: string[] = [];

    if (selectedVoices.length === 1) {
      const primaryVoice = selectedVoices[0];
      reasons.push(`Selected ${primaryVoice.name} as the primary voice`);
      reasons.push(`Expertise: ${primaryVoice.expertise.join(', ')}`);
      reasons.push(
        `Style: ${primaryVoice.style.value}, Temperature: ${primaryVoice.temperature.value}`
      );
    } else {
      reasons.push(`Selected ${selectedVoices.length} voices for multi-voice synthesis:`);
      selectedVoices.forEach((voice, index) => {
        const score = allScoredVoices.find(sv => sv.voice.id === voice.id)?.score || 0;
        reasons.push(
          `${index + 1}. ${voice.name} (score: ${score.toFixed(2)}) - ${voice.expertise.slice(0, 2).join(', ')}`
        );
      });
    }

    return reasons.join('\n');
  }

  private synthesizeCompetitive(responses: VoiceResponse[]): VoiceSynthesisResult {
    // Pick the response with highest confidence
    const bestResponse = responses.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return {
      finalResponse: bestResponse.content,
      synthesisMethod: 'competitive',
      voiceContributions: responses,
      confidenceScore: bestResponse.confidence,
      consensusLevel: 0, // No consensus in competitive mode
    };
  }

  private synthesizeCollaborative(responses: VoiceResponse[]): VoiceSynthesisResult {
    // Combine responses based on expertise and confidence
    const combinedContent = responses
      .sort((a, b) => b.confidence - a.confidence)
      .map(r => r.content)
      .join('\n\n');

    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    const consensusLevel = this.calculateConsensusLevel(responses);

    return {
      finalResponse: combinedContent,
      synthesisMethod: 'collaborative',
      voiceContributions: responses,
      confidenceScore: avgConfidence,
      consensusLevel,
    };
  }

  private synthesizeConsensus(responses: VoiceResponse[]): VoiceSynthesisResult {
    // Find common elements across responses
    const consensusElements = this.findConsensusElements(responses);
    const consensusLevel = this.calculateConsensusLevel(responses);

    const finalResponse =
      consensusElements.length > 0 ? consensusElements.join('\n') : responses[0].content; // Fallback to first response

    return {
      finalResponse,
      synthesisMethod: 'consensus',
      voiceContributions: responses,
      confidenceScore: consensusLevel,
      consensusLevel,
    };
  }

  private synthesizeWeighted(responses: VoiceResponse[]): VoiceSynthesisResult {
    // Weight responses by confidence and voice expertise
    const weightedContent = responses
      .map(r => ({
        content: r.content,
        weight: r.confidence * (r.expertiseMatch || 1),
      }))
      .sort((a, b) => b.weight - a.weight)
      .map(r => r.content)
      .join('\n\n');

    const weightedConfidence =
      responses.reduce((sum, r) => sum + r.confidence * (r.expertiseMatch || 1), 0) /
      responses.reduce((sum, r) => sum + (r.expertiseMatch || 1), 0);

    return {
      finalResponse: weightedContent,
      synthesisMethod: 'weighted',
      voiceContributions: responses,
      confidenceScore: weightedConfidence,
      consensusLevel: this.calculateConsensusLevel(responses),
    };
  }

  private analyzeResponseConflict(
    response1: VoiceResponse,
    response2: VoiceResponse
  ): VoiceConflict | null {
    // Simple conflict detection based on contradictory keywords
    const conflictKeywords = [
      ['recommend', 'avoid'],
      ['good', 'bad'],
      ['should', 'should not'],
      ['yes', 'no'],
      ['correct', 'incorrect'],
    ];

    for (const [positive, negative] of conflictKeywords) {
      const r1HasPositive = response1.content.toLowerCase().includes(positive);
      const r1HasNegative = response1.content.toLowerCase().includes(negative);
      const r2HasPositive = response2.content.toLowerCase().includes(positive);
      const r2HasNegative = response2.content.toLowerCase().includes(negative);

      if ((r1HasPositive && r2HasNegative) || (r1HasNegative && r2HasPositive)) {
        return {
          id: `${response1.voiceId}-${response2.voiceId}-${positive}-${negative}`,
          voice1Id: response1.voiceId,
          voice2Id: response2.voiceId,
          topic: `${positive}/${negative}`,
          voice1Position: response1.content.substring(0, 200),
          voice2Position: response2.content.substring(0, 200),
          voice1Confidence: response1.confidence,
          voice2Confidence: response2.confidence,
          severity: 'medium',
        };
      }
    }

    return null;
  }

  private calculateConsensusLevel(responses: VoiceResponse[]): number {
    if (responses.length <= 1) return 1.0;

    // Simple consensus calculation based on content similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculateContentSimilarity(
          responses[i].content,
          responses[j].content
        );
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // Simple similarity based on common words (could be enhanced with NLP)
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private findConsensusElements(responses: VoiceResponse[]): string[] {
    // Find common sentences or concepts across responses
    const sentences = responses.map(r =>
      r.content
        .split('.')
        .map(s => s.trim())
        .filter(s => s.length > 0)
    );

    const consensusElements: string[] = [];

    // Find sentences that appear in multiple responses
    for (const sentence of sentences[0]) {
      const appearanceCount = sentences.filter(sentenceList =>
        sentenceList.some(s => this.calculateContentSimilarity(s, sentence) > 0.7)
      ).length;

      if (appearanceCount >= Math.ceil(responses.length / 2)) {
        consensusElements.push(sentence);
      }
    }

    return consensusElements;
  }
}

// Supporting interfaces and types

export interface VoiceSelectionPreferences {
  maxVoices?: number;
  minVoices?: number;
  synthesisMode?: SynthesisMode;
  preferredVoices?: string[];
  diversityWeight?: number;
}

export interface VoiceSelection {
  primaryVoice: Voice;
  supportingVoices: Voice[];
  synthesisMode: SynthesisMode;
  reasoning: string;
}

export interface VoiceResponse {
  voiceId: string;
  content: string;
  confidence: number;
  expertiseMatch?: number;
  processingTime?: number;
}

export interface VoiceSynthesisResult {
  finalResponse: string;
  synthesisMethod: string;
  voiceContributions: VoiceResponse[];
  confidenceScore: number;
  consensusLevel: number;
}

export interface VoiceConflict {
  id: string;
  voice1Id: string;
  voice2Id: string;
  topic: string;
  voice1Position: string;
  voice2Position: string;
  voice1Confidence: number;
  voice2Confidence: number;
  severity: 'low' | 'medium' | 'high';
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'resolved' | 'unresolved' | 'deferred';
  reasoning: string;
  winningVoiceId: string | null;
}

export enum SynthesisMode {
  SINGLE = 'single',
  COMPETITIVE = 'competitive',
  COLLABORATIVE = 'collaborative',
  CONSENSUS = 'consensus',
  WEIGHTED = 'weighted',
}
