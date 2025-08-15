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
    files: Array<{
        path: string;
        content: string;
        language: string;
    }>;
    projectType?: string;
    dependencies?: string[];
    gitStatus?: string;
}
export interface VoiceArchetype {
    id: string;
    name: string;
    systemPrompt: string;
    temperature: number;
    style: string;
}
/**
 * Enhanced Local Model Client for gpt-oss-20b integration
 * Completely self-contained with no external dependencies or environment variables
 */
export declare class LocalModelClient {
    private client;
    private config;
    private fallbackModels;
    constructor(config: LocalModelConfig);
    /**
     * Check if the local model is available and responding
     */
    checkConnection(): Promise<boolean>;
    /**
     * Auto-detect and select the best available model
     */
    getAvailableModel(): Promise<string>;
    /**
     * Check if model is ready (simple version without warmup to avoid timeouts)
     */
    isModelReady(model: string): Promise<boolean>;
    /**
     * Generate a response from a specific voice archetype
     */
    generateVoiceResponse(voice: VoiceArchetype, prompt: string, context: ProjectContext, retryCount?: number): Promise<VoiceResponse>;
    /**
     * Try fallback models if primary fails
     */
    private tryFallbackModels;
    /**
     * Generate responses from multiple voices in parallel
     */
    generateMultiVoiceResponses(voices: VoiceArchetype[], prompt: string, context: ProjectContext): Promise<VoiceResponse[]>;
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
     * Build request for Ollama endpoint
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
}
