import { LocalModelClient, VoiceArchetype, VoiceResponse, ProjectContext } from '../core/local-model-client.js';
import { AppConfig } from '../config/config-manager.js';
import { AgentResponse, SynthesisResponse } from '../core/response-types.js';
import { SynthesisConfig, SynthesisMode, AdvancedSynthesisResult } from '../core/advanced-synthesis-engine.js';
import { LivingSpiralCoordinator, LivingSpiralResult, SpiralConfig } from '../core/living-spiral-coordinator.js';
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
    private advancedSynthesisEngine;
    private livingSpiralCoordinator;
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
     * Recommend voices for a given prompt
     * Returns a list of recommended voice IDs based on prompt analysis
     */
    recommendVoices(prompt: string, maxConcurrent?: number): string[];
    /**
     * Validate voice IDs and return valid/invalid lists
     */
    validateVoices(voiceIds: string[]): {
        valid: string[];
        invalid: string[];
    };
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
    generateSingleVoiceResponse(prompt: string, voiceId: string, context: ProjectContext, temperatureOverride?: number): Promise<VoiceResponse>;
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
    /**
     * Get default voices configuration
     * Required by tests
     */
    getDefaultVoices(): string[];
    /**
     * Convert legacy SynthesisResult to standardized SynthesisResponse
     */
    synthesisResultToResponse(synthesisResult: SynthesisResult, individualResponses?: AgentResponse[]): SynthesisResponse;
    /**
     * Generate multi-voice solutions with standardized response format
     */
    generateStandardMultiVoiceSolutions(prompt: string, voiceIds: string[] | 'auto', context: ProjectContext): Promise<AgentResponse[]>;
    /**
     * Synthesize voice responses with standardized format
     */
    synthesizeStandardVoiceResponses(responses: AgentResponse[], mode?: string): Promise<SynthesisResponse>;
    /**
     * Advanced synthesis using the new synthesis engine
     */
    synthesizeAdvanced(responses: AgentResponse[], config?: Partial<SynthesisConfig>): Promise<AdvancedSynthesisResult>;
    /**
     * Get synthesis mode recommendations based on task analysis
     */
    recommendSynthesisMode(prompt: string, voiceCount: number): SynthesisMode;
    /**
     * Intelligent multi-voice processing with automatic mode selection
     */
    processWithIntelligentSynthesis(prompt: string, voiceIds?: string[] | 'auto', context?: ProjectContext): Promise<AdvancedSynthesisResult>;
    /**
     * Batch processing for multiple prompts with intelligent synthesis
     */
    processBatchWithIntelligentSynthesis(prompts: Array<{
        prompt: string;
        voices?: string[];
    }>, context?: ProjectContext): Promise<AdvancedSynthesisResult[]>;
    /**
     * Quality analysis for synthesis results
     */
    analyzeSynthesisQuality(result: AdvancedSynthesisResult): {
        grade: string;
        recommendations: string[];
        strengths: string[];
        weaknesses: string[];
    };
    /**
     * Dynamically adjust voice temperature based on task complexity and context
     */
    adjustVoiceTemperature(voice: VoiceArchetype, prompt: string, context: ProjectContext): VoiceArchetype;
    /**
     * Calculate prompt complexity score (0.0 - 1.0)
     */
    private calculatePromptComplexity;
    /**
     * Get voice configuration with style-aware defaults
     */
    getVoiceWithStyleDefaults(voiceId: string): VoiceArchetype | undefined;
    /**
     * Generate multi-voice responses with dynamic temperature adjustment
     */
    generateAdaptiveMultiVoiceSolutions(prompt: string, voiceIds: string[] | 'auto', context: ProjectContext, enableTemperatureAdjustment?: boolean): Promise<VoiceResponse[]>;
    /**
     * Execute Living Spiral methodology for complex problem solving
     */
    executeLivingSpiral(task: string, context?: ProjectContext, config?: Partial<SpiralConfig>): Promise<LivingSpiralResult>;
    /**
     * Execute Living Spiral with preset configuration
     */
    executeLivingSpiralWithPreset(task: string, presetName: string, context?: ProjectContext): Promise<LivingSpiralResult>;
    /**
     * Execute adaptive Living Spiral that learns from context
     */
    executeAdaptiveLivingSpiral(task: string, context?: ProjectContext, learningHistory?: LivingSpiralResult[]): Promise<LivingSpiralResult>;
    /**
     * Execute collaborative Living Spiral with external feedback
     */
    executeCollaborativeLivingSpiral(task: string, context?: ProjectContext, externalFeedback?: Array<{
        source: string;
        feedback: string;
        priority: number;
    }>): Promise<LivingSpiralResult>;
    /**
     * Get Living Spiral coordinator for direct access
     */
    getLivingSpiralCoordinator(): LivingSpiralCoordinator;
    /**
     * Calculate adaptive quality threshold based on learning history
     */
    private calculateAdaptiveQualityThreshold;
}
