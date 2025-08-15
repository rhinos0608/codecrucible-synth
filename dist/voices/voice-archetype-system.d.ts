import { LocalModelClient, VoiceArchetype, VoiceResponse, ProjectContext } from '../core/local-model-client.js';
import { AppConfig } from '../config/config-manager.js';
export interface SynthesisResult {
    combinedCode: string;
    reasoning: string;
    confidence: number;
    qualityScore: number;
    voicesUsed: string[];
    synthesisMode: string;
    timestamp: number;
}
export interface VoicePreset {
    name: string;
    voices: string[];
    mode: string;
    description: string;
}
export interface CodeDiff {
    added: number;
    removed: number;
    modified: number;
}
export interface IterationLog {
    iteration: number;
    writerResponse: string;
    auditFeedback: string;
    code: string;
    qualityScore: number;
    diff: CodeDiff;
    timestamp: number;
}
export interface IterativeResult {
    finalCode: string;
    finalQualityScore: number;
    totalIterations: number;
    iterations: IterationLog[];
    converged: boolean;
    writerVoice: string;
    auditorVoice: string;
    timestamp: number;
}
/**
 * Enhanced Voice Archetype System
 *
 * Manages multiple AI voice personalities and synthesizes their responses
 * into cohesive solutions. Each voice brings different perspectives and expertise.
 */
export declare class VoiceArchetypeSystem {
    private modelClient;
    private config;
    private voices;
    private presets;
    constructor(modelClient: LocalModelClient, config: AppConfig);
    /**
     * Initialize voice archetypes from configuration
     */
    private initializeVoices;
    /**
     * Load voices configuration from YAML file
     */
    private loadVoicesConfig;
    /**
     * Initialize fallback voices if configuration loading fails
     */
    private initializeFallbackVoices;
    /**
     * Intelligently select optimal voices for the task
     */
    selectOptimalVoices(prompt: string, maxVoices?: number): string[];
    /**
     * Generate solutions from multiple voices with intelligent selection
     */
    generateMultiVoiceSolutions(prompt: string, voiceIds: string[] | 'auto', context: ProjectContext): Promise<VoiceResponse[]>;
    /**
     * Generate responses in parallel for faster results
     */
    private generateParallel;
    /**
     * Generate responses sequentially for more stable results with user feedback
     */
    private generateSequential;
    /**
     * Generate response from a single voice (no synthesis)
     */
    generateSingleVoiceResponse(prompt: string, voiceId: string, context: ProjectContext): Promise<VoiceResponse>;
    /**
     * Iterative Writer/Auditor loop for automated code improvement
     */
    generateIterativeCodeImprovement(prompt: string, context: ProjectContext, maxIterations?: number, qualityThreshold?: number): Promise<IterativeResult>;
    /**
     * Extract code blocks from response content
     */
    private extractCodeBlocks;
    /**
     * Calculate simple diff between two code strings
     */
    private calculateSimpleDiff;
    /**
     * Extract quality score from analysis content (reuse from LocalModelClient)
     */
    private extractQualityScore;
    /**
     * Synthesize voice responses into a unified solution
     */
    synthesizeVoiceResponses(responses: VoiceResponse[], mode?: string): Promise<SynthesisResult>;
    /**
     * Consensus synthesis - find common ground between all voices
     */
    private synthesizeConsensus;
    /**
     * Collaborative synthesis - integrate perspectives into hybrid approach
     */
    private synthesizeCollaborative;
    /**
     * Competitive synthesis - select the best aspects from each voice
     */
    private synthesizeCompetitive;
    /**
     * Parse synthesis response into structured result
     */
    private parseSynthesisResponse;
    /**
     * Calculate quality score for synthesis result
     */
    private calculateQualityScore;
    /**
     * Get available voice archetypes
     */
    getAvailableVoices(): VoiceArchetype[];
    /**
     * Get specific voice by ID
     */
    getVoice(id: string): VoiceArchetype | undefined;
    /**
     * Get available presets
     */
    getPresets(): VoicePreset[];
    /**
     * Get preset by name
     */
    getPreset(name: string): VoicePreset | undefined;
    /**
     * Apply a preset configuration
     */
    applyPreset(presetName: string, prompt: string, context: ProjectContext): Promise<SynthesisResult>;
    private capitalize;
    private chunkArray;
    private getDefaultVoicesConfig;
}
