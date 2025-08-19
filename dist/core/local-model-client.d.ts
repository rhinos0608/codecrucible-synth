/**
 * Local Model Client for CodeCrucible Synth
 * Provides interface to local AI models (Ollama, LM Studio)
 */
export interface LocalModelConfig {
    provider: 'ollama' | 'lmstudio';
    endpoint: string;
    model: string;
    timeout: number;
    temperature: number;
    maxTokens: number;
    streamingEnabled: boolean;
}
export interface ModelResponse {
    content: string;
    model: string;
    metadata: {
        tokens: number;
        duration: number;
        temperature: number;
    };
}
export interface VoiceResponse {
    content: string;
    voice: string;
    confidence: number;
}
export declare class LocalModelClient {
    private client;
    private config;
    constructor(config: LocalModelConfig);
    /**
     * Check connection to the model provider
     */
    checkConnection(): Promise<boolean>;
    /**
     * Check status of the model provider
     */
    checkStatus(): Promise<boolean>;
    /**
     * Generate response from model
     */
    generate(prompt: string): Promise<string>;
    /**
     * Generate voice-specific response
     */
    generateVoiceResponse(prompt: string, voice: string): Promise<VoiceResponse>;
    /**
     * Generate multiple voice responses
     */
    generateMultiVoiceResponses(prompt: string, voices: string[]): Promise<VoiceResponse[]>;
    /**
     * Analyze code with AI
     */
    analyzeCode(code: string, language?: string): Promise<string>;
    /**
     * List available models
     */
    getAvailableModels(): Promise<string[]>;
    /**
     * Get best available model for the task
     */
    getBestAvailableModel(): Promise<string>;
    private generateOllama;
    private generateLMStudio;
    private buildVoicePrompt;
    private buildCodeAnalysisPrompt;
    /**
     * Legacy compatibility methods
     */
    checkOllamaStatus(): Promise<boolean>;
    getAllAvailableModels(): Promise<any[]>;
    pullModel(name: string): Promise<boolean>;
}
export default LocalModelClient;
