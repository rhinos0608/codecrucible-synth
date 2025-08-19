/**
 * Local Model Client for CodeCrucible Synth
 * Provides interface to local AI models (Ollama, LM Studio)
 */
import axios from 'axios';
import { logger } from './logger.js';
export class LocalModelClient {
    client;
    config;
    constructor(config) {
        this.config = config;
        this.client = axios.create({
            baseURL: this.config.endpoint,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Check connection to the model provider
     */
    async checkConnection() {
        try {
            const endpoint = this.config.provider === 'ollama' ? '/api/tags' : '/v1/models';
            const response = await this.client.get(endpoint);
            return response.status === 200;
        }
        catch (error) {
            logger.warn(`Connection check failed for ${this.config.provider}:`, error.message);
            return false;
        }
    }
    /**
     * Check status of the model provider
     */
    async checkStatus() {
        return this.checkConnection();
    }
    /**
     * Generate response from model
     */
    async generate(prompt) {
        try {
            if (this.config.provider === 'ollama') {
                return await this.generateOllama(prompt);
            }
            else {
                return await this.generateLMStudio(prompt);
            }
        }
        catch (error) {
            logger.error('Generation failed:', error);
            throw new Error(`Model generation failed: ${error.message}`);
        }
    }
    /**
     * Generate voice-specific response
     */
    async generateVoiceResponse(prompt, voice) {
        const voicePrompt = this.buildVoicePrompt(prompt, voice);
        const content = await this.generate(voicePrompt);
        return {
            content,
            voice,
            confidence: 0.8 // Default confidence score
        };
    }
    /**
     * Generate multiple voice responses
     */
    async generateMultiVoiceResponses(prompt, voices) {
        const responses = await Promise.all(voices.map(voice => this.generateVoiceResponse(prompt, voice)));
        return responses;
    }
    /**
     * Analyze code with AI
     */
    async analyzeCode(code, language) {
        const analysisPrompt = this.buildCodeAnalysisPrompt(code, language);
        return await this.generate(analysisPrompt);
    }
    /**
     * List available models
     */
    async getAvailableModels() {
        try {
            if (this.config.provider === 'ollama') {
                const response = await this.client.get('/api/tags');
                return response.data.models?.map((model) => model.name) || [];
            }
            else {
                const response = await this.client.get('/v1/models');
                return response.data.data?.map((model) => model.id) || [];
            }
        }
        catch (error) {
            logger.warn('Failed to get available models:', error.message);
            return [];
        }
    }
    /**
     * Get best available model for the task
     */
    async getBestAvailableModel() {
        const models = await this.getAvailableModels();
        if (models.length === 0) {
            throw new Error('No models available');
        }
        // Prefer coding models
        const codingModels = models.filter(model => model.includes('code') || model.includes('deepseek') || model.includes('qwen'));
        return codingModels.length > 0 ? codingModels[0] : models[0];
    }
    async generateOllama(prompt) {
        const response = await this.client.post('/api/generate', {
            model: this.config.model,
            prompt,
            stream: false,
            options: {
                temperature: this.config.temperature,
                num_predict: this.config.maxTokens,
            },
        });
        return response.data.response || '';
    }
    async generateLMStudio(prompt) {
        const response = await this.client.post('/v1/chat/completions', {
            model: this.config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            stream: false,
        });
        return response.data.choices?.[0]?.message?.content || '';
    }
    buildVoicePrompt(prompt, voice) {
        const voicePersonalities = {
            explorer: 'You are an innovative explorer who pushes boundaries and investigates alternatives.',
            maintainer: 'You are a careful maintainer focused on long-term sustainability and clean code.',
            analyzer: 'You are a thorough analyzer who examines code for patterns and improvements.',
            developer: 'You are a practical developer focused on efficient implementation.',
            implementor: 'You are a detail-oriented implementor who ensures proper execution.',
            security: 'You are a security expert focused on identifying vulnerabilities and threats.',
            architect: 'You are a system architect focused on scalable and maintainable design.',
            designer: 'You are a user experience designer focused on usability and accessibility.',
            optimizer: 'You are a performance optimizer focused on efficiency and speed.',
            guardian: 'You are a quality guardian focused on code standards and best practices.',
        };
        const personality = voicePersonalities[voice] || voicePersonalities.developer;
        return `${personality}\n\n${prompt}`;
    }
    buildCodeAnalysisPrompt(code, language) {
        const langHint = language ? ` (${language})` : '';
        return `Please analyze the following code${langHint} and provide insights on:
1. Code quality and potential improvements
2. Security considerations
3. Performance optimizations
4. Best practices compliance

Code:
\`\`\`${language || 'text'}
${code}
\`\`\`

Please provide a comprehensive analysis with specific recommendations.`;
    }
    /**
     * Legacy compatibility methods
     */
    async checkOllamaStatus() {
        return this.checkConnection();
    }
    async getAllAvailableModels() {
        const models = await this.getAvailableModels();
        return models.map(name => ({ name, id: name }));
    }
    async pullModel(name) {
        if (this.config.provider !== 'ollama') {
            return false;
        }
        try {
            await this.client.post('/api/pull', { name });
            return true;
        }
        catch (error) {
            logger.error('Failed to pull model:', error);
            return false;
        }
    }
}
export default LocalModelClient;
//# sourceMappingURL=local-model-client.js.map