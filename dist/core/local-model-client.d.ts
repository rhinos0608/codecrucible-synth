import { OptimizationConfig } from './vram-optimizer.js';
export interface LocalModelConfig {
    endpoint: string;
    model: string;
    timeout: number;
    maxTokens: number;
    temperature: number;
}
export interface VoiceResponse {
    content: string;
    voice: string;
    confidence: number;
    reasoning?: string;
    tokens_used: number;
}
export interface ProjectContext {
    files?: Array<{
        path: string;
        content: string;
        language: string;
    }>;
    projectType?: string;
    dependencies?: string[];
    gitStatus?: string;
    workingDirectory?: string;
    recentMessages?: any[];
}
export interface VoiceArchetype {
    id: string;
    name: string;
    systemPrompt: string;
    temperature: number;
    style: string;
}
/**
 * Enhanced Local Model Client for Ollama integration
 * Features automatic model detection, installation, and management
 */
export declare class LocalModelClient {
    private client;
    private config;
    private modelManager;
    private _cachedBestModel;
    private errorHandler;
    private modelSelector;
    private isOptimized;
    private fallbackModels;
    private preloadedModels;
    private modelWarmupPromises;
    private vramOptimizer;
    private currentOptimization;
    constructor(config: LocalModelConfig);
    /**
     * Calculate adaptive timeout based on system performance and model characteristics
     */
    private calculateAdaptiveTimeout;
    /**
     * Get dynamic timeout based on operation type and model status
     */
    private getDynamicTimeout;
    /**
     * Preload primary models for faster response times
     */
    private preloadPrimaryModels;
    /**
     * Preload a specific model into memory
     */
    private preloadModel;
    /**
     * Perform the actual model warmup with optimization
     */
    private performModelWarmup;
    /**
     * Initialize GPU optimization and hardware detection
     */
    private initializeGPUOptimization;
    /**
     * Check if the local model is available and responding
     * Enhanced with auto-setup capabilities
     */
    checkConnection(): Promise<boolean>;
    /**
     * Optimize a model for VRAM usage and apply optimizations
     */
    optimizeModelForVRAM(modelName: string): Promise<string>;
    /**
     * Get current optimization status
     */
    getOptimizationStatus(): OptimizationConfig | null;
    /**
     * Display VRAM optimization information
     */
    displayVRAMOptimization(modelName: string): void;
    /**
     * Smart autonomous model selection with VRAM optimization
     */
    getAvailableModel(taskType?: string): Promise<string>;
    /**
     * Quick health check for a model to see if it's responsive
     */
    private quickHealthCheck;
    /**
     * Find the first working model from available models
     */
    private findWorkingModel;
    /**
     * Assess task complexity for model selection
     */
    private assessComplexity;
    /**
     * Intelligently select the best model from available models
     */
    private selectBestAvailableModel;
    /**
     * Check if model is ready and available
     */
    isModelReady(model: string): Promise<boolean>;
    /**
     * Get list of available models from Ollama with intelligent filtering for system capabilities
     */
    getAvailableModels(): Promise<string[]>;
    /**
     * Filter models based on system capabilities to prevent VRAM exhaustion
     */
    private filterModelsBySystemCapabilities;
    /**
     * Suggest a working model if current one is not available
     */
    suggestWorkingModel(): Promise<string | null>;
    /**
     * Set the model to use (for manual selection)
     */
    setModel(modelName: string): void;
    /**
     * Get current model being used
     */
    getCurrentModel(): string;
    /**
     * Enable VRAM optimizations for large models
     */
    enableVRAMOptimizations(modelName?: string): Promise<void>;
    /**
     * Suggest optimal models for current system
     */
    suggestOptimalModels(): Promise<void>;
    /**
     * Display available models with VRAM compatibility
     */
    displayAvailableModels(): Promise<void>;
    /**
     * Select model by index or name
     */
    selectModel(selection: string | number): Promise<boolean>;
    /**
     * Extract model size from name
     */
    private extractModelSize;
    /**
     * Get model type/category
     */
    private getModelType;
    /**
     * Generate a response using a specific model and voice archetype
     */
    generateVoiceResponseWithModel(voice: VoiceArchetype, prompt: string, context: ProjectContext, modelName: string, retryCount?: number): Promise<VoiceResponse>;
    /**
     * Generate a response from a specific voice archetype
     */
    generateVoiceResponse(voice: VoiceArchetype, prompt: string, context: ProjectContext, retryCount?: number): Promise<VoiceResponse>;
    /**
     * Get the fastest available model prioritizing smaller models for speed and VRAM efficiency
     */
    private getFastestAvailableModel;
    /**
     * Analyze task type from prompt for intelligent model selection
     */
    private analyzeTaskType;
    /**
     * Try fallback models if primary fails
     */
    private tryFallbackModels;
    /**
     * Generate responses from multiple voices with optimized concurrency control
     */
    generateMultiVoiceResponses(voices: VoiceArchetype[], prompt: string, context: ProjectContext): Promise<VoiceResponse[]>;
    /**
     * Generate a single response from the local model with GPU optimization and error handling
     */
    generate(prompt: string, jsonSchema?: any): Promise<string>;
    /**
     * Streamlined API call for maximum speed - bypasses voice complexity
     */
    generateFast(prompt: string, maxTokens?: number): Promise<string>;
    /**
     * Analyze code with local model
     */
    analyzeCode(code: string, language: string): Promise<any>;
    /**
     * Enhance prompt with voice-specific instructions and context
     */
    private enhancePromptWithVoice;
    /**
     * Sanitize prompt input to prevent injection attacks
     */
    private sanitizePromptInput;
    /**
     * Sanitize project context to prevent injection
     */
    private sanitizeContext;
    /**
     * Sanitize file paths to prevent path traversal
     */
    private sanitizeFilePath;
    /**
     * Sanitize file content to prevent code injection
     */
    private sanitizeFileContent;
    /**
     * Basic string sanitization
     */
    private sanitizeString;
    /**
     * Format project context for the model
     */
    private formatContext;
    /**
     * Build request for Ollama endpoint with performance optimizations
     */
    private buildOllamaRequest;
    /**
     * Build request for OpenAI-compatible endpoint
     */
    private buildOpenAIRequest;
    /**
     * Parse response from voice generation
     */
    private parseVoiceResponse;
    /**
     * Parse a single response from the local model
     */
    private parseResponse;
    /**
     * Parse code analysis response
     */
    private parseAnalysisResponse;
    /**
     * Calculate confidence score based on response characteristics
     */
    private calculateConfidence;
    /**
     * Extract quality score from analysis content
     */
    private extractQualityScore;
    /**
     * Extract recommendations from analysis content
     */
    private extractRecommendations;
    /**
     * Display helpful troubleshooting information for common issues
     */
    static displayTroubleshootingHelp(): void;
}
