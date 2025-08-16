import axios from 'axios';
import { logger } from './logger.js';
import { EnhancedModelManager } from './enhanced-model-manager.js';
import { AutonomousErrorHandler } from './autonomous-error-handler.js';
import { IntelligentModelSelector } from './intelligent-model-selector.js';
import chalk from 'chalk';
/**
 * Enhanced Local Model Client for Ollama integration
 * Features automatic model detection, installation, and management
 */
export class LocalModelClient {
    client;
    config;
    modelManager;
    _cachedBestModel = null;
    errorHandler;
    modelSelector;
    // private gpuOptimizer: GPUOptimizer; // Disabled
    isOptimized = false;
    fallbackModels = []; // Dynamically populated from available models
    constructor(config) {
        this.config = config;
        this.modelManager = new EnhancedModelManager(config.endpoint);
        this.errorHandler = new AutonomousErrorHandler(config.endpoint);
        this.modelSelector = new IntelligentModelSelector();
        // this.gpuOptimizer = new GPUOptimizer(); // Disabled to prevent model downloads
        // Use configured timeout for proper generation
        const adjustedTimeout = config.timeout; // Use full configured timeout
        this.client = axios.create({
            baseURL: config.endpoint,
            timeout: adjustedTimeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        logger.info('Enhanced local model client initialized', {
            endpoint: config.endpoint,
            model: config.model,
            maxTokens: config.maxTokens
        });
        // Initialize GPU optimization asynchronously
        this.initializeGPUOptimization();
    }
    /**
     * Initialize GPU optimization and hardware detection
     */
    async initializeGPUOptimization() {
        // Skip GPU optimization in test environment to improve speed
        if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
            this.isOptimized = true;
            return;
        }
        try {
            // Use existing Ollama models only - no GPU optimization
            this.isOptimized = true;
            console.log(chalk.blue('🚀 Using Existing Ollama Models:'));
            console.log('   GPU optimization disabled - using available models');
            // Use default fallback models (already set in constructor)
            logger.info('Using existing models only', {
                configuredModel: this.config.model,
                fallbackModels: this.fallbackModels.slice(0, 3)
            });
        }
        catch (error) {
            logger.warn('GPU optimization failed, using CPU fallback:', error);
            this.isOptimized = true; // Mark as complete even if failed
        }
    }
    /**
     * Check if the local model is available and responding
     * Enhanced with auto-setup capabilities
     */
    async checkConnection() {
        try {
            // Quick ping test to Ollama with very short timeout
            const quickCheck = axios.create({
                baseURL: this.config.endpoint,
                timeout: 30000 // 30 second timeout for connection check
            });
            await quickCheck.get('/api/tags');
            logger.info('Ollama connection successful');
            return true;
        }
        catch (error) {
            logger.warn('Ollama connection failed - service may not be running:', error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }
    /**
     * Smart autonomous model selection - uses configured model or first available
     */
    async getAvailableModel(taskType = 'general') {
        // In test environment, always return configured model immediately
        if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
            return this.config.model === 'auto' ? 'gemma:latest' : this.config.model;
        }
        try {
            // Clear cache for fresh selection based on current task
            // (Only use cache for same task type in same session)
            if (this._cachedBestModel && !this._cachedBestModel.includes(taskType)) {
                this._cachedBestModel = null;
            }
            // Use cached model if available for same task type
            if (this._cachedBestModel) {
                return this._cachedBestModel;
            }
            // Handle "auto" model selection
            if (this.config.model === 'auto') {
                logger.info('🎯 Auto-selecting best runnable model...');
                try {
                    const bestModel = await this.modelSelector.getBestRunnableModel(taskType);
                    this._cachedBestModel = bestModel;
                    return bestModel;
                }
                catch (error) {
                    logger.warn('Auto-selection failed, falling back to available models:', error);
                    // Continue to fallback logic below
                }
            }
            // Get all available models from Ollama
            const availableModels = await this.getAvailableModels();
            if (availableModels.length === 0) {
                logger.warn('No models found on system, using configured model');
                return this.config.model;
            }
            // Smart autonomous selection: try configured model first, then first available
            const configExactMatch = availableModels.find(m => m === this.config.model) ||
                availableModels.find(m => m.includes(this.config.model.split(':')[0]));
            if (configExactMatch) {
                this._cachedBestModel = configExactMatch;
                logger.info(`✅ Using configured model: ${configExactMatch}`);
                return configExactMatch;
            }
            // If configured model not available, use the first available model
            const fallbackModel = availableModels[0];
            this._cachedBestModel = fallbackModel;
            logger.info(`🔄 Using first available model: ${fallbackModel}`);
            return fallbackModel;
        }
        catch (error) {
            logger.warn('Model selection failed, using configured model:', this.config.model);
            return this.config.model;
        }
    }
    /**
     * Quick health check for a model to see if it's responsive
     */
    async quickHealthCheck(model) {
        try {
            // Very simple test request with reasonable timeout
            const testClient = axios.create({
                baseURL: this.config.endpoint,
                timeout: 180000 // 3 minute timeout for health check
            });
            const testRequest = this.config.endpoint.includes('11434')
                ? {
                    model,
                    prompt: "test",
                    stream: false,
                    options: { num_predict: 1 }
                }
                : {
                    model,
                    messages: [{ role: "user", content: "test" }],
                    max_tokens: 1
                };
            const response = await testClient.post(this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions', testRequest);
            // If we get any response (even an error response), the model is at least loaded
            return response.status === 200;
        }
        catch (error) {
            logger.debug(`Health check failed for model ${model}:`, error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }
    /**
     * Find the first working model from available models
     */
    async findWorkingModel(availableModels) {
        // Simply use the first available model - no hardcoded preferences
        // User can select specific model with /models command
        if (availableModels.length > 0) {
            const firstModel = availableModels[0];
            logger.info(`✅ Using first available model: ${firstModel}`);
            return firstModel;
        }
        return null;
    }
    /**
     * Assess task complexity for model selection
     */
    assessComplexity(taskType) {
        const complexityMap = {
            'coding': 'complex',
            'debugging': 'complex',
            'analysis': 'medium',
            'planning': 'medium',
            'testing': 'medium',
            'general': 'simple'
        };
        return complexityMap[taskType] || 'simple';
    }
    /**
     * Intelligently select the best model from available models
     */
    async selectBestAvailableModel(availableModels, taskType = 'general') {
        // Autonomous selection: simply use first available model
        // User can choose specific model with /models command
        logger.debug(`Using first available model: ${availableModels[0]}`);
        return availableModels[0];
    }
    /**
     * Check if model is ready and available
     */
    async isModelReady(model) {
        try {
            return await this.modelManager.isModelAvailable(model);
        }
        catch (error) {
            logger.warn(`Model readiness check failed for ${model}:`, error);
            return false;
        }
    }
    /**
     * Get list of available models from Ollama with error handling
     * Filters out known problematic models
     */
    async getAvailableModels() {
        try {
            const quickCheck = axios.create({
                baseURL: this.config.endpoint,
                timeout: 30000 // 30 second timeout for model detection
            });
            const response = await quickCheck.get('/api/tags');
            const models = response.data.models || [];
            const modelNames = models.map((m) => m.name || m.model || '').filter(Boolean);
            // Use all available models - no hardcoded filtering
            const filteredModels = modelNames;
            logger.info(`🔍 Found ${filteredModels.length} available models`);
            return filteredModels;
        }
        catch (error) {
            logger.warn('Failed to get available models:', error);
            return [];
        }
    }
    /**
     * Suggest a working model if current one is not available
     */
    async suggestWorkingModel() {
        const availableModels = await this.getAvailableModels();
        if (availableModels.length === 0) {
            return null;
        }
        return this.selectBestAvailableModel(availableModels, 'general');
    }
    /**
     * Set the model to use (for manual selection)
     */
    setModel(modelName) {
        this.config.model = modelName;
        this._cachedBestModel = modelName;
        logger.info('Model manually set to:', modelName);
    }
    /**
     * Get current model being used
     */
    getCurrentModel() {
        return this._cachedBestModel || this.config.model;
    }
    /**
     * Display available models with descriptions
     */
    async displayAvailableModels() {
        const models = await this.getAvailableModels();
        if (models.length === 0) {
            console.log(chalk.red('❌ No models found on system'));
            console.log(chalk.yellow('💡 Install a model with: ollama pull <model-name>'));
            return;
        }
        console.log(chalk.green(`\n📋 Available Models (${models.length} found):\n`));
        models.forEach((model, index) => {
            const size = this.extractModelSize(model);
            const type = this.getModelType(model);
            const current = this.getCurrentModel() === model;
            const prefix = current ? chalk.green('→') : ' ';
            const modelDisplay = current ? chalk.green.bold(model) : chalk.cyan(model);
            console.log(`${prefix} ${index + 1}. ${modelDisplay}`);
            console.log(`    Type: ${type} | Size: ${size}`);
        });
        console.log(chalk.yellow(`\n💡 Current model: ${this.getCurrentModel()}`));
        console.log(chalk.gray('   Use "/model <number>" to switch models'));
    }
    /**
     * Select model by index or name
     */
    async selectModel(selection) {
        const models = await this.getAvailableModels();
        if (models.length === 0) {
            return false;
        }
        let selectedModel;
        if (typeof selection === 'number') {
            if (selection < 1 || selection > models.length) {
                return false;
            }
            selectedModel = models[selection - 1];
        }
        else {
            // Try exact match first
            selectedModel = models.find(m => m === selection) ||
                models.find(m => m.includes(selection)) ||
                models.find(m => selection.includes(m.split(':')[0])) || '';
            if (!selectedModel) {
                return false;
            }
        }
        this.setModel(selectedModel);
        console.log(chalk.green(`✅ Model changed to: ${selectedModel}`));
        return true;
    }
    /**
     * Extract model size from name
     */
    extractModelSize(modelName) {
        const sizeMatches = modelName.match(/(\d+\.?\d*[bmkBMK])/i);
        return sizeMatches ? sizeMatches[0] : 'Unknown';
    }
    /**
     * Get model type/category
     */
    getModelType(modelName) {
        const name = modelName.toLowerCase();
        if (name.includes('codellama') || name.includes('codegemma') || name.includes('deepseek-coder')) {
            return 'Coding';
        }
        if (name.includes('llama'))
            return 'General';
        if (name.includes('gemma'))
            return 'Efficient';
        if (name.includes('qwen'))
            return 'Multilingual';
        if (name.includes('phi'))
            return 'Reasoning';
        if (name.includes('mistral'))
            return 'Instruction';
        return 'General';
    }
    /**
     * Generate a response using a specific model and voice archetype
     */
    async generateVoiceResponseWithModel(voice, prompt, context, modelName, retryCount = 0) {
        const maxRetries = 1; // Reduced retries for speed
        // Pre-flight connection check
        const isConnected = await this.checkConnection();
        if (!isConnected) {
            throw new Error(`Ollama service unavailable for ${voice.name}. Please start with: ollama serve`);
        }
        try {
            const enhancedPrompt = this.enhancePromptWithVoice(voice, prompt, context);
            logger.info(`Generating response with ${voice.name} using model: ${modelName}`);
            const requestBody = this.config.endpoint.includes('11434')
                ? this.buildOllamaRequest(enhancedPrompt, voice, modelName)
                : this.buildOpenAIRequest(enhancedPrompt, voice, modelName);
            const response = await this.client.post(this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions', requestBody);
            return this.parseVoiceResponse(response.data, voice);
        }
        catch (error) {
            const isTimeout = error instanceof Error &&
                (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'));
            if (isTimeout) {
                throw new Error(`${voice.name} timed out. Ollama may be slow or the model '${modelName}' may not be available. Try: ollama pull ${modelName}`);
            }
            logger.error(`Voice generation failed for ${voice.name} with model ${modelName}:`, error);
            throw new Error(`Failed to generate response from ${voice.name} using ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate a response from a specific voice archetype
     */
    async generateVoiceResponse(voice, prompt, context, retryCount = 0) {
        const maxRetries = 2;
        try {
            const enhancedPrompt = this.enhancePromptWithVoice(voice, prompt, context);
            const taskType = this.analyzeTaskType(prompt);
            const model = await this.getAvailableModel(taskType);
            logger.info(`Generating response with ${voice.name} using model: ${model}`);
            const requestBody = this.config.endpoint.includes('11434')
                ? this.buildOllamaRequest(enhancedPrompt, voice, model)
                : this.buildOpenAIRequest(enhancedPrompt, voice, model);
            const response = await this.client.post(this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions', requestBody);
            // Record success
            this.modelSelector.recordPerformance(model, taskType, true, Date.now(), 1.0);
            return this.parseVoiceResponse(response.data, voice);
        }
        catch (error) {
            const isTimeout = error instanceof Error &&
                (error.message.includes('timeout') || error.name === 'AxiosError' && error.message.includes('exceeded'));
            // Use autonomous error handling for all errors, not just timeouts
            const taskType = this.analyzeTaskType(prompt);
            const currentModel = await this.getAvailableModel(taskType);
            const errorContext = {
                errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
                errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
                operation: 'voice_generation',
                model: currentModel,
                context: { voice: voice.name, taskType, retryCount }
            };
            // Record failure
            this.modelSelector.recordPerformance(currentModel, taskType, false, Date.now(), 0.0);
            // Get recovery actions
            const recoveryActions = await this.errorHandler.analyzeAndRecover(errorContext);
            // Check for model switching recommendation
            const switchAction = recoveryActions.find(action => action.action === 'switch_model');
            if (switchAction?.target && retryCount < maxRetries) {
                logger.warn(`🔄 ${voice.name}: Autonomous recovery switching to ${switchAction.target}`);
                logger.info(`   Reason: ${switchAction.reason}`);
                // Quick retry with recommended model
                await new Promise(resolve => setTimeout(resolve, 500));
                return this.generateVoiceResponseWithModel(voice, prompt, context, switchAction.target, retryCount + 1);
            }
            // If timeout and no specific recovery, try fast fallback models
            if (isTimeout && retryCount < maxRetries) {
                logger.warn(`⚡ ${voice.name}: Timeout, trying faster model...`);
                const fastModel = await this.getFastestAvailableModel();
                if (fastModel !== currentModel) {
                    return this.generateVoiceResponseWithModel(voice, prompt, context, fastModel, retryCount + 1);
                }
            }
            throw new Error(`Failed to generate response from ${voice.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get the fastest available model for quick responses with GPU optimization
     */
    async getFastestAvailableModel() {
        for (const model of this.fallbackModels) {
            const available = await this.modelManager.isModelAvailable(model);
            if (available) {
                const optimizedModel = model; // Use model as-is
                logger.info('Selected fastest GPU-optimized model:', optimizedModel);
                return optimizedModel;
            }
        }
        // Fallback with optimization
        const optimizedFallback = this.config.model; // Use configured model as-is
        return optimizedFallback;
    }
    /**
     * Analyze task type from prompt for intelligent model selection
     */
    analyzeTaskType(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('implement')) {
            return 'coding';
        }
        if (lowerPrompt.includes('debug') || lowerPrompt.includes('fix') || lowerPrompt.includes('error')) {
            return 'debugging';
        }
        if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review') || lowerPrompt.includes('explain')) {
            return 'analysis';
        }
        if (lowerPrompt.includes('plan') || lowerPrompt.includes('design') || lowerPrompt.includes('architecture')) {
            return 'planning';
        }
        return 'general';
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
     * Generate a single response from the local model with GPU optimization and error handling
     */
    async generate(prompt, jsonSchema) {
        // Pre-flight connection check
        const isConnected = await this.checkConnection();
        if (!isConnected) {
            throw new Error('Ollama service is not available. Please start Ollama with: ollama serve');
        }
        const taskType = this.analyzeTaskType(prompt);
        const startTime = Date.now();
        let model = await this.getAvailableModel(taskType);
        try {
            logger.info(`Generating streamlined response with model: ${model}`);
            const requestBody = this.config.endpoint.includes('11434')
                ? this.buildOllamaRequest(prompt, { temperature: this.config.temperature }, model, jsonSchema)
                : this.buildOpenAIRequest(prompt, { temperature: this.config.temperature }, model);
            const response = await this.client.post(this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions', requestBody);
            // Record successful performance
            const duration = Date.now() - startTime;
            this.modelSelector.recordPerformance(model, taskType, true, duration, 1.0);
            return this.parseResponse(response.data);
        }
        catch (error) {
            // Handle specific error types with helpful guidance
            const isTimeout = error instanceof Error &&
                (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'));
            const is404 = error instanceof Error &&
                (error.message.includes('status code 404') || error.message.includes('404'));
            const is500 = error instanceof Error &&
                error.message.includes('status code 500');
            if (isTimeout) {
                throw new Error('Ollama connection timeout. Try:\n1. Start Ollama: ollama serve\n2. Check if models are downloaded: ollama list\n3. Install a model: ollama pull <model-name>');
            }
            if (is404) {
                // Try to suggest an available model
                const suggestedModel = await this.suggestWorkingModel();
                const availableModels = await this.getAvailableModels();
                let errorMsg = `Model '${model}' not found. Try:\n1. Pull the model: ollama pull ${model}`;
                if (availableModels.length > 0) {
                    errorMsg += `\n2. Available models: ${availableModels.join(', ')}`;
                    if (suggestedModel) {
                        errorMsg += `\n3. Try using: ${suggestedModel}`;
                    }
                }
                else {
                    errorMsg += `\n2. No models found. Install one: ollama pull <model-name>`;
                }
                throw new Error(errorMsg);
            }
            if (is500) {
                throw new Error(`Ollama server error. The model '${model}' may be corrupted or incompatible.\nTry:\n1. Restart Ollama: Stop and run 'ollama serve'\n2. Re-pull the model: ollama pull ${model}\n3. Use a different model: type 'models' to select another`);
            }
            logger.error('Generation failed:', error);
            throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Streamlined API call for maximum speed - bypasses voice complexity
     */
    async generateFast(prompt, maxTokens) {
        try {
            // Get fastest model optimized for speed
            const fastModel = await this.getFastestAvailableModel();
            logger.info(`Fast generation with optimized model: ${fastModel}`);
            // Streamlined request with minimal overhead
            const requestBody = {
                model: fastModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.3, // Lower temperature for faster generation
                    num_predict: maxTokens || 512, // Limit tokens for speed
                    top_p: 0.8,
                    repeat_penalty: 1.05,
                    stop: ['\n\n', 'Human:', 'Assistant:']
                }
            };
            const response = await this.client.post('/api/generate', requestBody);
            return this.parseResponse(response.data);
        }
        catch (error) {
            logger.error('Fast generation failed:', error);
            // Single retry with absolute fastest fallback
            try {
                // Use current model as fallback
                logger.warn(`🚀 Ultra-fast fallback: ${this.config.model}`);
                const fallbackBody = {
                    model: this.config.model,
                    prompt: prompt.length > 500 ? prompt.substring(0, 500) + '...' : prompt, // Truncate for speed
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 256, // Very limited tokens
                        top_p: 0.7
                    }
                };
                const fallbackResponse = await this.client.post('/api/generate', fallbackBody);
                return this.parseResponse(fallbackResponse.data);
            }
            catch (fallbackError) {
                throw new Error(`Fast generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
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
            files: context.files?.map(file => ({
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
        if (context.files && context.files.length > 0) {
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
    buildOllamaRequest(prompt, voice, model, jsonSchema) {
        const baseRequest = {
            model: model || this.config.model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: voice.temperature || this.config.temperature,
                num_predict: this.config.maxTokens,
                top_p: 0.9,
                repeat_penalty: 1.1,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                stop: ['Human:', 'Assistant:', '<|endoftext|>']
            }
        };
        // Add structured output format if schema provided
        if (jsonSchema) {
            return {
                ...baseRequest,
                format: jsonSchema
            };
        }
        return baseRequest;
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
     * Parse a single response from the local model
     */
    parseResponse(data) {
        if (data.response) {
            // Ollama response format
            return data.response.trim();
        }
        else if (data.choices && data.choices[0]) {
            // OpenAI-compatible response format
            return data.choices[0].message?.content.trim() || data.choices[0].text.trim() || '';
        }
        else {
            throw new Error('Unexpected response format from local model');
        }
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
    /**
     * Display helpful troubleshooting information for common issues
     */
    static displayTroubleshootingHelp() {
        console.log(chalk.yellow('\n🔧 CodeCrucible Troubleshooting Guide:\n'));
        console.log(chalk.blue('1. Check Ollama Status:'));
        console.log('   ollama list                    # Check installed models');
        console.log('   curl http://localhost:11434    # Test if Ollama is running\n');
        console.log(chalk.blue('2. Start Ollama (if not running):'));
        console.log('   ollama serve                   # Start Ollama service\n');
        console.log(chalk.blue('3. Install Fast Models (Recommended):'));
        console.log('   ollama pull <model-name>       # Install any model you prefer\n');
        console.log(chalk.blue('4. Fix Model Errors:'));
        console.log('   For "Model not found" (404 errors):');
        console.log('   - Check config model name matches installed models');
        console.log('   - Update config to use available model name');
        console.log('   - Use /models command to select an available model\n');
        console.log(chalk.blue('5. Performance Tips:'));
        console.log('   - Use smaller models (1b-3b parameters) for speed');
        console.log('   - Ensure sufficient RAM (8GB+ recommended)');
        console.log('   - Close other heavy applications');
        console.log('   - Consider GPU acceleration if available\n');
        console.log(chalk.green('6. Alternative: Use OpenAI-compatible API:'));
        console.log('   Set endpoint to OpenAI-compatible service (port 8080)\n');
        console.log(chalk.red('Common Issues:'));
        console.log('   • 404 errors → Model not installed or wrong name');
        console.log('   • Timeout → Model too large for available resources');
        console.log('   • 500 errors → Model corrupted, try re-pulling');
    }
}
//# sourceMappingURL=local-model-client.js.map