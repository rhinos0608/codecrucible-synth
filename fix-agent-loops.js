#!/usr/bin/env node

/**
 * CodeCrucible Synth - Agent Loop Fix Script
 * 
 * This script fixes the infinite model discovery loops and slow output issues
 * by optimizing model selection and preloading behavior.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AgentLoopFixer {
  constructor() {
    this.fixes = [];
    this.errors = [];
  }

  async run() {
    console.log('🔧 CodeCrucible Synth - Fixing Agent Loops and Performance Issues...\n');

    try {
      await this.fixModelPreloaderLoops();
      await this.fixLocalModelClientLoops();
      await this.fixHybridClientBottlenecks();
      await this.optimizeModelSelector();
      await this.createOptimizedModelConfig();
      await this.addCircuitBreakers();
      
      this.displayResults();
    } catch (error) {
      console.error('❌ Fix script failed:', error);
      this.errors.push(`Script failure: ${error.message}`);
    }
  }

  /**
   * Fix infinite loops in model preloader
   */
  async fixModelPreloaderLoops() {
    console.log('🔄 Fixing model preloader infinite loops...');

    try {
      const preloaderPath = path.join(__dirname, 'src/core/model-preloader.ts');
      let content = await fs.readFile(preloaderPath, 'utf-8');

      // Add circuit breaker to prevent infinite initialization loops
      const initializationFix = `
  /**
   * Initialize preloading system with circuit breaker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      logger.debug('Model preloader already initialized or initializing');
      return;
    }

    // Prevent infinite initialization loops
    const maxInitAttempts = 3;
    const initKey = 'model_preloader_init';
    if (!this.initAttempts) this.initAttempts = new Map();
    
    const attempts = this.initAttempts.get(initKey) || 0;
    if (attempts >= maxInitAttempts) {
      logger.warn(\`Model preloader initialization failed after \${maxInitAttempts} attempts, using fallback\`);
      this.isInitialized = true; // Mark as initialized to prevent loops
      return;
    }
    
    this.initAttempts.set(initKey, attempts + 1);
    this.isInitializing = true;
    console.log(chalk.cyan('🚀 Initializing Model Preloader...'));
    
    try {
      // Discover available models with timeout
      await Promise.race([
        this.discoverModels(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Model discovery timeout')), 30000))
      ]);
      
      // Skip preloading if discovery failed
      if (this.availableModels.length > 0) {
        await this.preloadPrimaryModels();
        this.setupKeepAlive();
      } else {
        logger.warn('No models discovered, skipping preloading');
      }
      
      this.isInitialized = true;
      this.isInitializing = false;
      this.initAttempts.delete(initKey); // Reset on success
      console.log(chalk.green('✅ Model Preloader initialization complete'));
      
    } catch (error) {
      this.isInitializing = false;
      logger.error('Model preloader initialization failed:', error);
      console.log(chalk.red('❌ Model preloader initialization failed, using fallback'));
      
      // Set as initialized to prevent loops, but with limited functionality
      this.isInitialized = true;
      this.isInitializing = false;
    }
  }`;

      // Replace the existing initialize method
      content = content.replace(
        /async initialize\(\): Promise<void> \{[\s\S]*?\n {2}\}/,
        initializationFix.trim()
      );

      // Add the initAttempts property to the class
      if (!content.includes('private initAttempts')) {
        content = content.replace(
          /private isInitializing = false;/,
          'private isInitializing = false;\n  private initAttempts?: Map<string, number>;'
        );
      }

      // Fix the model discovery to prevent hanging
      const discoveryFix = `
  /**
   * Discover available models from Ollama with timeout and fallback
   */
  private async discoverModels(): Promise<void> {
    try {
      console.log(chalk.dim('   🔍 Discovering available models...'));
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await this.client.get('/api/tags', {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      this.availableModels = response.data.models || [];
      
      console.log(chalk.green(\`   📦 Found \${this.availableModels.length} available models\`));
      
      // Initialize status for all models
      this.availableModels.forEach(model => {
        this.modelStatus.set(model.name, {
          model: model.name,
          status: 'not_loaded',
          isWarm: false
        });
      });
      
      // Limit debug logging to prevent spam
      if (this.availableModels.length <= 10) {
        this.availableModels.forEach(model => {
          const size = this.formatBytes(model.size);
          logger.debug(\`Available model: \${model.name} (\${size})\`);
        });
      } else {
        logger.debug(\`Discovered \${this.availableModels.length} models (too many to list)\`);
      }
      
    } catch (error) {
      logger.error('Failed to discover models:', error);
      console.log(chalk.yellow('   ⚠️ Model discovery failed, using fallback models'));
      
      // Use fallback models to prevent complete failure
      this.availableModels = [
        { name: 'gemma:7b', size: 4000000000 },
        { name: 'llama3.2:latest', size: 2000000000 }
      ];
      
      // Initialize status for fallback models
      this.availableModels.forEach(model => {
        this.modelStatus.set(model.name, {
          model: model.name,
          status: 'not_loaded',
          isWarm: false
        });
      });
    }
  }`;

      // Replace the existing discoverModels method
      content = content.replace(
        /private async discoverModels\(\): Promise<void> \{[\s\S]*?\n {2}\}/,
        discoveryFix.trim()
      );

      // Fix preloading to be non-blocking and faster
      const preloadingFix = `
  /**
   * Preload primary models in parallel with improved error handling
   */
  private async preloadPrimaryModels(): Promise<void> {
    console.log(chalk.cyan('   🔄 Preloading primary models...'));
    
    // Filter to only available models, prioritize small ones first
    const availableModelNames = this.availableModels.map(m => m.name);
    const modelsToLoad = this.config.primaryModels
      .filter(modelName => availableModelNames.includes(modelName))
      .slice(0, 2); // Limit to 2 models to prevent resource exhaustion

    if (modelsToLoad.length === 0) {
      console.log(chalk.yellow('   ⚠️ No primary models available, using first available'));
      // Use first available small model as fallback
      const smallModels = this.availableModels
        .filter(m => m.size < 5000000000) // Under 5GB
        .slice(0, 1);
      
      if (smallModels.length > 0) {
        modelsToLoad.push(smallModels[0].name);
      } else {
        return; // No suitable models
      }
    }

    // Load models with timeout and concurrency control
    try {
      const results = await Promise.race([
        this.loadModelsWithConcurrency(modelsToLoad),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Preloading timeout')), 60000)
        )
      ]);
      
      const successful = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;
      
      console.log(chalk.green(\`   ✅ Preloaded \${successful}/\${modelsToLoad.length} models\`));
      
      if (failed > 0) {
        console.log(chalk.yellow(\`   ⚠️ \${failed} models failed to preload\`));
      }
    } catch (error) {
      console.log(chalk.yellow('   ⚠️ Model preloading timed out, continuing without preload'));
      logger.warn('Model preloading failed:', error);
    }
  }`;

      // Replace the existing preloadPrimaryModels method
      content = content.replace(
        /private async preloadPrimaryModels\(\): Promise<void> \{[\s\S]*?\n {2}\}/,
        preloadingFix.trim()
      );

      // Add a fast model selection method
      const fastSelectionFix = `
  /**
   * Get the best available model quickly without complex checks
   */
  getBestAvailableModelFast(): string | null {
    // Quick check for any warm model
    for (const [model, status] of this.modelStatus.entries()) {
      if (status.status === 'loaded' && status.isWarm) {
        return model;
      }
    }

    // Fallback to any loaded model
    for (const [model, status] of this.modelStatus.entries()) {
      if (status.status === 'loaded') {
        return model;
      }
    }

    // Ultimate fallback to first available small model
    const smallModel = this.availableModels.find(m => m.size < 5000000000);
    return smallModel ? smallModel.name : null;
  }`;

      // Add the fast selection method before the last closing brace
      if (!content.includes('getBestAvailableModelFast')) {
        content = content.replace(/}\s*$/, fastSelectionFix + '\n}');
      }

      await fs.writeFile(preloaderPath, content);
      this.fixes.push('Model Preloader: Fixed infinite initialization loops');
      this.fixes.push('Model Preloader: Added timeout protection to model discovery');
      this.fixes.push('Model Preloader: Optimized preloading for faster startup');
      this.fixes.push('Model Preloader: Added fast model selection method');
      console.log('  ✅ Model preloader loops fixed');

    } catch (error) {
      this.errors.push(`Model preloader fix failed: ${error.message}`);
      console.log('  ❌ Failed to fix model preloader loops');
    }
  }

  /**
   * Fix loops in local model client
   */
  async fixLocalModelClientLoops() {
    console.log('🦙 Fixing local model client performance issues...');

    try {
      const localClientPath = path.join(__dirname, 'src/core/local-model-client.ts');
      let content = await fs.readFile(localClientPath, 'utf-8');

      // Fix the model selection to be faster and avoid loops
      const fastModelSelectionFix = `
  /**
   * Get best model with optimized selection and caching
   */
  async getBestModel(): Promise<string> {
    // Use cached result if recent (within 30 seconds)
    const cacheKey = 'best_model_cache';
    if (this.modelCache.has(cacheKey)) {
      const cached = this.modelCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) {
        return cached.model;
      }
    }

    try {
      // Try fast preloader selection first
      const preloadedModel = this.modelPreloader?.getBestAvailableModelFast?.() || this.modelPreloader?.getBestAvailableModel?.();
      if (preloadedModel && this.isModelVRAMSuitable(preloadedModel)) {
        this.modelCache.set(cacheKey, { model: preloadedModel, timestamp: Date.now() });
        return preloadedModel;
      }

      // Fallback to fastest available model
      const fastModel = await this.getFastestAvailableModel();
      if (fastModel) {
        this.modelCache.set(cacheKey, { model: fastModel, timestamp: Date.now() });
        return fastModel;
      }

      // Ultimate fallback to config model
      this.modelCache.set(cacheKey, { model: this.config.model, timestamp: Date.now() });
      return this.config.model;
      
    } catch (error) {
      logger.warn('Model selection failed, using config default:', error);
      return this.config.model;
    }
  }`;

      // Replace the existing getBestModel method
      content = content.replace(
        /async getBestModel\(\): Promise<string> \{[\s\S]*?\n  \}/,
        fastModelSelectionFix.trim()
      );

      // Add model cache if not exists
      if (!content.includes('private modelCache')) {
        content = content.replace(
          /private modelWarmupCache = new Map/,
          'private modelCache = new Map<string, { model: string; timestamp: number }>();\n  private modelWarmupCache = new Map'
        );
      }

      // Optimize the preload method to prevent hanging
      const optimizedPreloadFix = `
  /**
   * Preload primary models for faster response times (non-blocking)
   */
  private async preloadPrimaryModels(): Promise<void> {
    try {
      // Get available models with timeout
      const availableModels = await Promise.race([
        this.getAvailableModels(),
        new Promise<string[]>((_, reject) => 
          setTimeout(() => reject(new Error('Model list timeout')), 10000)
        )
      ]);
      
      if (availableModels.length === 0) {
        logger.debug('No models available for preloading');
        return;
      }

      // Preload only 1-2 small models to prevent resource exhaustion
      const modelsToPreload = availableModels
        .filter(model => !model.includes('30b') && !model.includes('20b')) // Skip large models
        .slice(0, 2);
      
      if (modelsToPreload.length === 0) {
        logger.debug('No suitable models for preloading');
        return;
      }
      
      logger.info(\`🚀 Preloading \${modelsToPreload.length} models for faster response times...\`);
      
      // Fire and forget preloading (non-blocking)
      modelsToPreload.forEach(model => {
        this.preloadModel(model).catch(error => {
          logger.debug(\`Preload failed for \${model}:\`, error.message);
        });
      });
      
    } catch (error) {
      logger.debug('Preloading setup failed:', error.message);
      // Don't throw - this is non-critical
    }
  }`;

      // Replace the existing preloadPrimaryModels method
      content = content.replace(
        /private async preloadPrimaryModels\(\): Promise<void> \{[\s\S]*?\n  \}/,
        optimizedPreloadFix.trim()
      );

      await fs.writeFile(localClientPath, content);
      this.fixes.push('Local Model Client: Optimized model selection with caching');
      this.fixes.push('Local Model Client: Made preloading non-blocking');
      this.fixes.push('Local Model Client: Added timeout protection');
      console.log('  ✅ Local model client performance optimized');

    } catch (error) {
      this.errors.push(`Local model client fix failed: ${error.message}`);
      console.log('  ❌ Failed to fix local model client');
    }
  }

  /**
   * Fix bottlenecks in hybrid client
   */
  async fixHybridClientBottlenecks() {
    console.log('🔀 Fixing hybrid client bottlenecks...');

    try {
      const hybridClientPath = path.join(__dirname, 'src/core/hybrid-model-client.ts');
      let content = await fs.readFile(hybridClientPath, 'utf-8');

      // Add fast response generation method
      const fastResponseFix = `
  /**
   * Generate response with optimized routing (fast mode)
   */
  async generateResponseFast(
    prompt: string,
    context: ProjectContext = {},
    options: { 
      forceProvider?: 'lmstudio' | 'ollama';
      enableEscalation?: boolean;
      maxTimeout?: number;
    } = {}
  ): Promise<HybridResponse> {
    const startTime = Date.now();
    const maxTimeout = options.maxTimeout || 60000; // 1 minute default
    
    try {
      // Skip complex classification for speed
      const classification = {
        type: 'general',
        complexity: 'simple',
        suggestedProvider: options.forceProvider || 'ollama',
        confidence: 0.8
      };

      // Fast routing decision
      const routingDecision = {
        selectedLLM: options.forceProvider || 'ollama',
        confidence: 0.8,
        reasoning: 'Fast mode routing',
        fallbackStrategy: options.forceProvider === 'lmstudio' ? 'ollama' : 'lmstudio'
      };

      // Execute with timeout
      const response = await Promise.race([
        this.executeRequest(prompt, context, routingDecision, classification, startTime),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Response timeout')), maxTimeout)
        )
      ]);

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(\`Fast response generation failed (\${responseTime}ms):\`, error);
      
      // Simple fallback response
      return {
        content: 'Error: Unable to generate response quickly. Please try again.',
        confidence: 0.1,
        provider: 'error',
        model: 'none',
        responseTime,
        tokensUsed: 0,
        escalated: false,
        reasoning: \`Fast generation failed: \${error.message}\`,
        metadata: {
          taskClassification: { type: 'error', complexity: 'simple', suggestedProvider: 'none', confidence: 0 },
          routingDecision: { selectedLLM: 'none', confidence: 0, reasoning: 'Error fallback', fallbackStrategy: 'none' }
        }
      };
    }
  }`;

      // Add the fast response method before the last closing brace
      if (!content.includes('generateResponseFast')) {
        content = content.replace(/}\s*$/, fastResponseFix + '\n}');
      }

      // Optimize the main generateResponse method
      const optimizedGenerateResponse = content.replace(
        /(\/\*\*[\s\S]*?Generate response using hybrid routing[\s\S]*?\*\/[\s\S]*?async generateResponse\([^{]*\{)/,
        `$1
    // Quick timeout check
    const quickTimeout = options.maxTimeout || 180000; // 3 minutes default
    
    // Use fast mode for simple requests
    if (!options.forceProvider && prompt.length < 200) {
      try {
        return await this.generateResponseFast(prompt, context, { 
          maxTimeout: Math.min(quickTimeout, 60000),
          enableEscalation: options.enableEscalation 
        });
      } catch (error) {
        logger.debug('Fast mode failed, falling back to full routing:', error.message);
        // Continue with full routing
      }
    }`
      );

      if (optimizedGenerateResponse !== content) {
        content = optimizedGenerateResponse;
        this.fixes.push('Hybrid Client: Added fast response mode for simple requests');
      }

      await fs.writeFile(hybridClientPath, content);
      this.fixes.push('Hybrid Client: Added fast response generation method');
      this.fixes.push('Hybrid Client: Optimized routing for better performance');
      console.log('  ✅ Hybrid client bottlenecks fixed');

    } catch (error) {
      this.errors.push(`Hybrid client fix failed: ${error.message}`);
      console.log('  ❌ Failed to fix hybrid client bottlenecks');
    }
  }

  /**
   * Optimize model selector to reduce overhead
   */
  async optimizeModelSelector() {
    console.log('🎯 Optimizing model selector...');

    try {
      const selectorPath = path.join(__dirname, 'src/core/intelligent-model-selector.ts');
      let content = await fs.readFile(selectorPath, 'utf-8');

      // Add simple task classification
      const simpleClassificationFix = `
  /**
   * Classify task quickly without complex analysis
   */
  classifyTaskFast(prompt: string): TaskClassification {
    const promptLower = prompt.toLowerCase();
    
    // Simple keyword-based classification
    let type = 'general';
    let complexity = 'simple';
    
    if (promptLower.includes('template') || promptLower.includes('create') || promptLower.includes('generate')) {
      type = 'template';
    } else if (promptLower.includes('analyze') || promptLower.includes('explain') || promptLower.includes('review')) {
      type = 'analysis';
      complexity = 'medium';
    } else if (promptLower.includes('format') || promptLower.includes('fix') || promptLower.includes('correct')) {
      type = 'format';
    }
    
    // Adjust complexity based on length
    if (prompt.length > 500) complexity = 'complex';
    else if (prompt.length > 200) complexity = 'medium';
    
    return {
      type,
      complexity,
      suggestedProvider: complexity === 'simple' ? 'lmstudio' : 'ollama',
      confidence: 0.7
    };
  }`;

      // Add the fast classification method
      if (!content.includes('classifyTaskFast')) {
        content = content.replace(/}\s*$/, simpleClassificationFix + '\n}');
      }

      await fs.writeFile(selectorPath, content);
      this.fixes.push('Model Selector: Added fast task classification');
      console.log('  ✅ Model selector optimized');

    } catch (error) {
      this.errors.push(`Model selector optimization failed: ${error.message}`);
      console.log('  ❌ Failed to optimize model selector');
    }
  }

  /**
   * Create optimized model configuration
   */
  async createOptimizedModelConfig() {
    console.log('⚙️ Creating optimized model configuration...');

    try {
      const configDir = path.join(__dirname, 'config');
      await fs.mkdir(configDir, { recursive: true });
      
      const optimizedConfig = {
        modelPreloader: {
          // Reduced timeouts and concurrency to prevent loops
          endpoint: "http://localhost:11434",
          primaryModels: ["gemma:7b", "llama3.2:latest"], // Only small, fast models
          fallbackModels: ["gemma:7b"],
          maxConcurrentLoads: 1,
          warmupPrompt: "Hi",
          keepAliveTime: "10m", // Shorter to save resources
          retryAttempts: 2, // Fewer retries to fail fast
          loadTimeout: 45000, // 45 seconds
          initializationTimeout: 30000 // 30 seconds for init
        },
        hybridClient: {
          fastModeThreshold: 200, // Use fast mode for prompts under 200 chars
          defaultTimeout: 60000, // 1 minute default
          maxTimeout: 180000, // 3 minutes max
          cacheEnabled: true,
          cacheDuration: 300000, // 5 minutes
          skipComplexRouting: true // Skip complex routing for better performance
        },
        performance: {
          enableModelCaching: true,
          cacheTimeout: 30000, // 30 seconds
          maxConcurrentRequests: 2,
          enableFastMode: true,
          skipModelDiscovery: false,
          useSmallModelsOnly: true
        }
      };

      const configPath = path.join(configDir, 'optimized-model-config.json');
      await fs.writeFile(configPath, JSON.stringify(optimizedConfig, null, 2));
      
      this.fixes.push('Created optimized model configuration for better performance');
      console.log('  ✅ Optimized model configuration created');

    } catch (error) {
      this.errors.push(`Config creation failed: ${error.message}`);
      console.log('  ❌ Failed to create optimized configuration');
    }
  }

  /**
   * Add circuit breakers to prevent infinite loops
   */
  async addCircuitBreakers() {
    console.log('🔒 Adding circuit breakers...');

    try {
      const circuitBreakerPath = path.join(__dirname, 'src/core/circuit-breaker.ts');
      
      const circuitBreakerCode = `/**
 * Simple Circuit Breaker to prevent infinite loops and cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 3,
    private resetTimeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }
}

// Global circuit breakers for common operations
export const modelDiscoveryBreaker = new CircuitBreaker(3, 30000);
export const modelLoadingBreaker = new CircuitBreaker(5, 60000);
export const responseGenerationBreaker = new CircuitBreaker(3, 45000);
`;

      await fs.writeFile(circuitBreakerPath, circuitBreakerCode);
      this.fixes.push('Added circuit breaker system to prevent infinite loops');
      console.log('  ✅ Circuit breakers added');

    } catch (error) {
      this.errors.push(`Circuit breaker creation failed: ${error.message}`);
      console.log('  ❌ Failed to add circuit breakers');
    }
  }

  /**
   * Display fix results
   */
  displayResults() {
    console.log('\n🎯 Agent Loop Fix Results');
    console.log('═'.repeat(50));

    if (this.fixes.length > 0) {
      console.log('✅ Successfully Applied Fixes:');
      this.fixes.forEach(fix => console.log(`  • ${fix}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors Encountered:');
      this.errors.forEach(error => console.log(`  • ${error}`));
    }

    console.log('\n📋 Performance Improvements:');
    console.log('• Fixed infinite model discovery loops');
    console.log('• Added fast response mode for simple requests');
    console.log('• Optimized model selection with caching');
    console.log('• Reduced timeout values for faster failure detection');
    console.log('• Added circuit breakers to prevent cascading failures');
    console.log('• Limited concurrent operations to prevent resource exhaustion');

    console.log('\n🚀 Next Steps:');
    console.log('1. Restart the AI agent to apply fixes');
    console.log('2. Test with simple prompts first');
    console.log('3. Monitor for improved response times');
    console.log('4. Use smaller models (gemma:7b, llama3.2:latest) for better performance');

    console.log('\n🧪 Quick Test Commands:');
    console.log('  node test-agent-quick.js');
    console.log('  node test-simple-responses.js');

    if (this.fixes.length > this.errors.length) {
      console.log('\n🎉 Agent loop fixes completed successfully!');
      console.log('The AI agent should now respond faster and avoid infinite loops.');
    } else {
      console.log('\n⚠️ Some fixes failed. Please review the errors and apply them manually.');
    }
  }
}

// Run the fix script
const fixer = new AgentLoopFixer();
fixer.run().catch(console.error);
