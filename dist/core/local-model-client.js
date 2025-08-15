import axios from 'axios';
import { logger } from './logger.js';
/**
 * Enhanced Local Model Client for gpt-oss-20b integration
 * Completely self-contained with no external dependencies or environment variables
 */
export class LocalModelClient {
    client;
    config;
    fallbackModels = [
        'qwq:32b-preview-q4_K_M', 'gemma2:27b', 'gemma3n:latest', 'gemma:7b-instruct',
        'gpt-oss:20b', 'gpt-oss:120b', 'llama3.1:70b', 'qwen2.5:72b', 'codellama:34b',
        'qwq:32b', 'qwq', 'gemma3', 'gemma:7b', 'gemma', 'mistral', 'llama'
    ];
    constructor(config) {
        this.config = config;
        // Set very high timeout for large models - 32B models can take 3-5 minutes
        const adjustedTimeout = Math.max(config.timeout, 300000); // Minimum 5 minutes
        this.client = axios.create({
            baseURL: config.endpoint,
            timeout: adjustedTimeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        logger.info('Local model client initialized', {
            endpoint: config.endpoint,
            model: config.model,
            maxTokens: config.maxTokens
        });
    }
    /**
     * Check if the local model is available and responding
     */
    async checkConnection() {
        try {
            // For Ollama endpoint (detects both localhost:11434 and ollama references)
            if (this.config.endpoint.includes('11434') || this.config.endpoint.toLowerCase().includes('ollama')) {
                logger.info('Checking Ollama connection at:', this.config.endpoint);
                // Try to connect to Ollama API
                const response = await this.client.get('/api/tags');
                const models = response.data.models || [];
                logger.info('Available Ollama models:', models.map((m) => m.name));
                // Check for preferred models first, then accept any available model
                const hasPreferredModel = models.some((model) => this.fallbackModels.some(fallback => {
                    const modelBase = fallback.split(':')[0];
                    return model.name.toLowerCase().includes(modelBase.toLowerCase());
                }));
                if (!hasPreferredModel && models.length > 0) {
                    logger.info('No preferred models found, but will use available models:', {
                        availableModels: models.map((m) => m.name),
                        preferredModels: this.fallbackModels
                    });
                }
                else if (hasPreferredModel) {
                    logger.info('Found compatible models');
                }
                // Return true if any models are available
                if (models.length === 0) {
                    logger.error('No models available in Ollama');
                    return false;
                }
                logger.info('Compatible Ollama models found');
                return true;
            }
            // For direct OpenAI-compatible endpoint
            logger.info('Checking OpenAI-compatible endpoint at:', this.config.endpoint);
            const response = await this.client.get('/v1/models');
            const models = response.data.data || [];
            const hasCompatibleModel = models.some((model) => this.fallbackModels.some(fallback => model.id.includes(fallback)));
            logger.info('OpenAI-compatible endpoint check result:', hasCompatibleModel);
            return hasCompatibleModel;
        }
        catch (error) {
            logger.error('Model connection check failed:', error);
            return false;
        }
    }
    /**
     * Auto-detect and select the best available model
     */
    async getAvailableModel() {
        try {
            if (this.config.endpoint.includes('11434')) {
                const response = await this.client.get('/api/tags');
                const models = response.data.models || [];
                const modelNames = models.map((m) => m.name);
                // First, try exact matches
                for (const fallback of this.fallbackModels) {
                    if (modelNames.includes(fallback)) {
                        logger.info('Auto-selected exact match model:', fallback);
                        return fallback;
                    }
                }
                // Then try partial matches with improved logic
                for (const fallback of this.fallbackModels) {
                    const fallbackBase = fallback.split(':')[0].toLowerCase();
                    const found = models.find((model) => {
                        const modelBase = model.name.split(':')[0].toLowerCase();
                        return modelBase === fallbackBase || model.name.toLowerCase().includes(fallbackBase);
                    });
                    if (found) {
                        logger.info('Auto-selected compatible model:', found.name);
                        return found.name;
                    }
                }
                // If no preferred model found, use the first available model
                if (models.length > 0) {
                    const firstModel = models[0].name;
                    logger.info('No preferred model found, using first available:', firstModel);
                    return firstModel;
                }
            }
            // Fallback to configured model
            return this.config.model;
        }
        catch (error) {
            logger.warn('Could not auto-detect model, using configured model:', this.config.model);
            return this.config.model;
        }
    }
    /**
     * Check if model is ready (simple version without warmup to avoid timeouts)
     */
    async isModelReady(model) {
        try {
            // Just check if model exists in the list, don't try to generate
            if (this.config.endpoint.includes('11434')) {
                const response = await this.client.get('/api/tags');
                const models = response.data.models || [];
                return models.some((m) => m.name === model);
            }
            return true; // Assume ready for non-Ollama endpoints
        }
        catch (error) {
            logger.warn(`Model readiness check failed for ${model}:`, error);
            return false;
        }
    }
    /**
     * Generate a response from a specific voice archetype
     */
    async generateVoiceResponse(voice, prompt, context, retryCount = 0) {
        const maxRetries = 2;
        try {
            const enhancedPrompt = this.enhancePromptWithVoice(voice, prompt, context);
            const model = await this.getAvailableModel();
            logger.info(`Generating response with ${voice.name} using model: ${model}`);
            // Check if model is ready (no warmup to avoid timeouts)
            if (retryCount === 0) {
                const ready = await this.isModelReady(model);
                if (!ready) {
                    logger.warn(`Model ${model} may not be ready, but proceeding anyway`);
                }
            }
            const requestBody = this.config.endpoint.includes('11434')
                ? this.buildOllamaRequest(enhancedPrompt, voice, model)
                : this.buildOpenAIRequest(enhancedPrompt, voice, model);
            const response = await this.client.post(this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions', requestBody);
            return this.parseVoiceResponse(response.data, voice);
        }
        catch (error) {
            const isTimeout = error instanceof Error &&
                (error.message.includes('timeout') || error.name === 'AxiosError' && error.message.includes('exceeded'));
            if (isTimeout && retryCount < maxRetries) {
                logger.warn(`Timeout for ${voice.name}, retrying... (${retryCount + 1}/${maxRetries})`);
                // Wait 10 seconds before retry to let model stabilize
                await new Promise(resolve => setTimeout(resolve, 10000));
                return this.generateVoiceResponse(voice, prompt, context, retryCount + 1);
            }
            logger.error(`Voice generation failed for ${voice.name}:`, error);
            // Try with fallback models only if not a timeout issue
            if (!isTimeout) {
                const fallbackModel = await this.tryFallbackModels(voice, prompt, context);
                if (fallbackModel) {
                    return fallbackModel;
                }
            }
            throw new Error(`Failed to generate response from ${voice.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Try fallback models if primary fails
     */
    async tryFallbackModels(voice, prompt, context) {
        for (const fallbackModel of this.fallbackModels.slice(1)) { // Skip first (primary)
            try {
                logger.info(`Trying fallback model: ${fallbackModel}`);
                const enhancedPrompt = this.enhancePromptWithVoice(voice, prompt, context);
                const requestBody = this.config.endpoint.includes('11434')
                    ? this.buildOllamaRequest(enhancedPrompt, voice, fallbackModel)
                    : this.buildOpenAIRequest(enhancedPrompt, voice, fallbackModel);
                const response = await this.client.post(this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions', requestBody);
                return this.parseVoiceResponse(response.data, voice);
            }
            catch (error) {
                logger.warn(`Fallback model ${fallbackModel} also failed:`, error);
                continue;
            }
        }
        return null;
    }
    /**
     * Generate responses from multiple voices in parallel
     */
    async generateMultiVoiceResponses(voices, prompt, context) {
        logger.info(`Generating responses from ${voices.length} voices in parallel`);
        const promises = voices.map(voice => this.generateVoiceResponse(voice, prompt, context));
        try {
            const responses = await Promise.allSettled(promises);
            const successful = responses
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);
            if (successful.length === 0) {
                throw new Error('All voice responses failed');
            }
            logger.info(`Successfully generated ${successful.length}/${voices.length} voice responses`);
            return successful;
        }
        catch (error) {
            logger.error('Multi-voice generation failed:', error);
            throw error;
        }
    }
    /**
     * Analyze code with local model
     */
    async analyzeCode(code, language) {
        const prompt = `Analyze this ${language} code and provide:
1. Code quality assessment (1-10 score)
2. Potential improvements with specific examples
3. Security concerns and vulnerabilities
4. Performance considerations and optimizations
5. Architectural recommendations

Code to analyze:
\`\`\`${language}
${code}
\`\`\`

Provide a structured analysis with actionable recommendations.`;
        const model = await this.getAvailableModel();
        const requestBody = this.config.endpoint.includes('11434')
            ? this.buildOllamaRequest(prompt, { temperature: 0.3 }, model)
            : this.buildOpenAIRequest(prompt, { temperature: 0.3 }, model);
        try {
            const response = await this.client.post(this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions', requestBody);
            return this.parseAnalysisResponse(response.data);
        }
        catch (error) {
            logger.error('Code analysis failed:', error);
            throw error;
        }
    }
    /**
     * Enhance prompt with voice-specific instructions and context
     */
    enhancePromptWithVoice(voice, prompt, context) {
        // Sanitize and validate inputs to prevent prompt injection
        const sanitizedPrompt = this.sanitizePromptInput(prompt);
        const sanitizedContext = this.sanitizeContext(context);
        const contextInfo = this.formatContext(sanitizedContext);
        return `${voice.systemPrompt}

Project Context:
${contextInfo}

Task:
${sanitizedPrompt}

Instructions:
- Respond as ${voice.name} with your specific perspective and expertise
- Provide concrete, actionable solutions
- Include code examples where appropriate
- Consider the project context provided
- Be specific and detailed in your recommendations
- Format code blocks with proper language tags
- SECURITY NOTICE: Do not execute, evaluate, or suggest running any user-provided code without explicit review`;
    }
    /**
     * Sanitize prompt input to prevent injection attacks
     */
    sanitizePromptInput(prompt) {
        if (typeof prompt !== 'string') {
            throw new Error('Prompt must be a string');
        }
        // Remove null bytes and control characters except newlines
        let sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        // Detect and neutralize potential prompt injection patterns
        const injectionPatterns = [
            // System prompt overrides
            /system:\s*$/i,
            /assistant:\s*$/i,
            /user:\s*$/i,
            // Instruction overrides
            /ignore\s+(previous|all)\s+(instructions?|prompts?)/i,
            /disregard\s+(previous|all)\s+(instructions?|prompts?)/i,
            /forget\s+(everything|all)\s+(before|above)/i,
            // Role manipulation
            /you\s+are\s+now\s+/i,
            /act\s+as\s+/i,
            /pretend\s+to\s+be\s+/i,
            // Output format manipulation
            /respond\s+only\s+with/i,
            /output\s+format:/i,
            // Security bypass attempts
            /execute\s+this\s+code/i,
            /run\s+this\s+script/i,
            /eval\(.*\)/i,
            /exec\(.*\)/i
        ];
        // Check for injection patterns and neutralize them
        for (const pattern of injectionPatterns) {
            if (pattern.test(sanitized)) {
                logger.warn('Potential prompt injection attempt detected and neutralized');
                // Replace injection attempts with safe text
                sanitized = sanitized.replace(pattern, '[SYSTEM: Potential injection attempt removed]');
            }
        }
        // Limit prompt length to prevent token exhaustion attacks
        if (sanitized.length > 8000) {
            logger.warn('Prompt length exceeds limit, truncating');
            sanitized = sanitized.substring(0, 8000) + '\n[TRUNCATED: Prompt was too long]';
        }
        return sanitized;
    }
    /**
     * Sanitize project context to prevent injection
     */
    sanitizeContext(context) {
        const sanitizedContext = {
            files: context.files.map(file => ({
                path: this.sanitizeFilePath(file.path),
                content: this.sanitizeFileContent(file.content),
                language: file.language
            })),
            projectType: context.projectType ? this.sanitizeString(context.projectType) : undefined,
            dependencies: context.dependencies?.map(dep => this.sanitizeString(dep)),
            gitStatus: context.gitStatus ? this.sanitizeString(context.gitStatus) : undefined
        };
        return sanitizedContext;
    }
    /**
     * Sanitize file paths to prevent path traversal
     */
    sanitizeFilePath(path) {
        let sanitized = this.sanitizeString(path);
        // Remove path traversal attempts
        sanitized = sanitized.replace(/\.\.\//g, '');
        sanitized = sanitized.replace(/\.\.\\/g, '');
        // Normalize path separators
        sanitized = sanitized.replace(/\\/g, '/');
        return sanitized;
    }
    /**
     * Sanitize file content to prevent code injection
     */
    sanitizeFileContent(content) {
        let sanitized = this.sanitizeString(content);
        // Limit file content size
        if (sanitized.length > 50000) {
            sanitized = sanitized.substring(0, 50000) + '\n[TRUNCATED: File content was too large]';
        }
        return sanitized;
    }
    /**
     * Basic string sanitization
     */
    sanitizeString(input) {
        if (typeof input !== 'string') {
            return String(input);
        }
        // Remove null bytes and most control characters
        return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }
    /**
     * Format project context for the model
     */
    formatContext(context) {
        let formatted = '';
        if (context.projectType) {
            formatted += `Project Type: ${context.projectType}\n`;
        }
        if (context.dependencies?.length) {
            formatted += `Dependencies: ${context.dependencies.join(', ')}\n`;
        }
        if (context.gitStatus) {
            formatted += `Git Status: ${context.gitStatus}\n`;
        }
        if (context.files.length > 0) {
            formatted += '\nRelevant Files:\n';
            context.files.forEach(file => {
                formatted += `\n--- ${file.path} (${file.language}) ---\n`;
                // Intelligently truncate large files
                const content = file.content.length > 3000
                    ? file.content.substring(0, 1500) + '\n\n... [truncated] ...\n\n' + file.content.substring(file.content.length - 1500)
                    : file.content;
                formatted += `\`\`\`${file.language}\n${content}\n\`\`\`\n`;
            });
        }
        return formatted || 'No additional project context provided.';
    }
    /**
     * Build request for Ollama endpoint
     */
    buildOllamaRequest(prompt, voice, model) {
        return {
            model: model || this.config.model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: voice.temperature || this.config.temperature,
                num_predict: this.config.maxTokens,
                top_p: 0.9,
                repeat_penalty: 1.1,
                stop: ['Human:', 'Assistant:', '<|endoftext|>']
            }
        };
    }
    /**
     * Build request for OpenAI-compatible endpoint
     */
    buildOpenAIRequest(prompt, voice, model) {
        return {
            model: model || this.config.model,
            messages: [
                {
                    role: 'system',
                    content: voice.systemPrompt
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: voice.temperature || this.config.temperature,
            max_tokens: this.config.maxTokens,
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.1,
            stop: ['Human:', 'Assistant:']
        };
    }
    /**
     * Parse response from voice generation
     */
    parseVoiceResponse(data, voice) {
        let content;
        let tokensUsed = 0;
        if (data.response) {
            // Ollama response format
            content = data.response;
            tokensUsed = data.eval_count || 0;
        }
        else if (data.choices && data.choices[0]) {
            // OpenAI-compatible response format
            content = data.choices[0].message?.content || data.choices[0].text || '';
            tokensUsed = data.usage?.total_tokens || 0;
        }
        else {
            throw new Error('Unexpected response format from local model');
        }
        return {
            content: content.trim(),
            voice: voice.name,
            confidence: this.calculateConfidence(content, voice),
            tokens_used: tokensUsed
        };
    }
    /**
     * Parse code analysis response
     */
    parseAnalysisResponse(data) {
        const content = data.response || data.choices?.[0]?.message?.content || '';
        return {
            analysis: content,
            timestamp: Date.now(),
            model: this.config.model,
            qualityScore: this.extractQualityScore(content),
            recommendations: this.extractRecommendations(content)
        };
    }
    /**
     * Calculate confidence score based on response characteristics
     */
    calculateConfidence(content, voice) {
        let confidence = 0.5;
        // Length indicates thoroughness
        if (content.length > 500)
            confidence += 0.15;
        if (content.length > 1000)
            confidence += 0.1;
        if (content.length > 2000)
            confidence += 0.05;
        // Code blocks indicate concrete solutions
        const codeBlocks = (content.match(/```/g) || []).length / 2;
        confidence += Math.min(codeBlocks * 0.1, 0.2);
        // Technical terms indicate expertise
        const technicalTerms = /\b(function|class|interface|async|await|import|export|const|let|var|return|if|else|for|while|try|catch)\b/g;
        const matches = content.match(technicalTerms);
        if (matches) {
            confidence += Math.min(matches.length * 0.01, 0.1);
        }
        // Voice-specific adjustments
        switch (voice.style) {
            case 'experimental':
                // Explorer gets bonus for alternatives
                if (content.includes('alternative') || content.includes('approach'))
                    confidence += 0.1;
                break;
            case 'defensive':
                // Security gets bonus for security terms
                if (content.includes('security') || content.includes('validation'))
                    confidence += 0.1;
                break;
            case 'analytical':
                // Analyzer gets bonus for metrics
                if (content.includes('performance') || content.includes('optimization'))
                    confidence += 0.1;
                break;
        }
        return Math.min(Math.max(confidence, 0.1), 1.0);
    }
    /**
     * Extract quality score from analysis content
     */
    extractQualityScore(content) {
        const scoreMatch = content.match(/(\d+)\/10|(\d+) out of 10|score.*?(\d+)/i);
        if (scoreMatch) {
            const score = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3]);
            return isNaN(score) ? 7 : Math.min(Math.max(score, 1), 10);
        }
        return 7; // Default score
    }
    /**
     * Extract recommendations from analysis content
     */
    extractRecommendations(content) {
        const recommendations = [];
        // Look for numbered lists or bullet points
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.match(/^\d+\.|^[-*]\s+|^Recommendation:/i)) {
                recommendations.push(line.trim());
            }
        }
        return recommendations.length > 0 ? recommendations : ['General code review recommended'];
    }
}
//# sourceMappingURL=local-model-client.js.map