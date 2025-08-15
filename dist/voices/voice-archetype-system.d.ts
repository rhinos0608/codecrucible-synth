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
     * Generate solutions from multiple voices
     */
    generateMultiVoiceSolutions(prompt: string, voiceIds: string[], context: ProjectContext): Promise<VoiceResponse[]>;
    /**
     * Generate responses in parallel for faster results
     */
    private generateParallel;
    /**
     * Generate responses sequentially for more stable results
     */
    private generateSequential;
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
