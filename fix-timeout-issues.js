#!/usr/bin/env node

/**
 * CodeCrucible Synth - Timeout Issues Fix Script
 * 
 * This script addresses the primary timeout and connection issues
 * affecting the AI agent's performance with LM Studio and Ollama.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TimeoutFixer {
  constructor() {
    this.fixes = [];
    this.errors = [];
  }

  async run() {
    console.log('🔧 CodeCrucible Synth - Fixing Timeout Issues...\n');

    try {
      await this.fixLMStudioTimeouts();
      await this.fixOllamaTimeouts();
      await this.fixModelPreloaderConfig();
      await this.fixHybridClientTimeouts();
      await this.createOptimizedConfig();
      await this.updateTimeoutManager();
      
      this.displayResults();
    } catch (error) {
      console.error('❌ Fix script failed:', error);
      this.errors.push(`Script failure: ${error.message}`);
    }
  }

  /**
   * Fix LM Studio timeout configurations
   */
  async fixLMStudioTimeouts() {
    console.log('🏭 Fixing LM Studio timeout configurations...');

    try {
      const lmStudioPath = path.join(__dirname, 'src/core/lm-studio-client.ts');
      let content = await fs.readFile(lmStudioPath, 'utf-8');

      // Update timeout configurations
      const timeoutFixes = [
        {
          search: /timeout: 180000,/g,
          replace: 'timeout: 300000, // 5 minutes for initial model loading',
          description: 'Increased base timeout for model loading'
        },
        {
          search: /timeout: 10000/g,
          replace: 'timeout: 30000', // 30 seconds for keep-alive
          description: 'Increased keep-alive timeout'
        },
        {
          search: /keepAliveInterval: 30000/g,
          replace: 'keepAliveInterval: 120000', // 2 minutes between keep-alives
          description: 'Increased keep-alive interval'
        }
      ];

      let modified = false;
      for (const fix of timeoutFixes) {
        if (fix.search.test(content)) {
          content = content.replace(fix.search, fix.replace);
          this.fixes.push(`LM Studio: ${fix.description}`);
          modified = true;
        }
      }

      // Add enhanced error handling for connection issues
      const errorHandlingCode = `
  /**
   * Enhanced connection validation with retry logic
   */
  private async validateConnection(retries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.get('/v1/models', { 
          timeout: 15000,
          validateStatus: (status) => status < 500 
        });
        
        if (response.status === 200 && response.data?.data?.length > 0) {
          this.healthStatus = true;
          return true;
        }
      } catch (error) {
        const errorMsg = error.message || 'Unknown error';
        logger.warn(\`LM Studio connection attempt \${attempt}/\${retries} failed: \${errorMsg}\`);
        
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.healthStatus = false;
    return false;
  }

  /**
   * Improved model availability check with timeout handling
   */
  private async getAvailableModelsWithRetry(): Promise<string[]> {
    try {
      const isConnected = await this.validateConnection();
      if (!isConnected) {
        throw new Error('LM Studio server is not responding. Please ensure LM Studio is running with API server enabled.');
      }

      const response = await this.client.get('/v1/models', {
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      if (response.data?.data) {
        return response.data.data.map((model: any) => model.id);
      }
      
      return [];
    } catch (error) {
      logger.error('Failed to get available models from LM Studio:', error.message);
      throw new Error(\`LM Studio API Error: \${error.message}. Check if LM Studio is running on \${this.config.endpoint}\`);
    }
  }`;

      // Insert enhanced error handling before the last closing brace
      if (!content.includes('validateConnection')) {
        content = content.replace(/}\s*$/, errorHandlingCode + '\n}');
        this.fixes.push('LM Studio: Added enhanced connection validation');
        modified = true;
      }

      if (modified) {
        await fs.writeFile(lmStudioPath, content);
        console.log('  ✅ LM Studio timeout configurations updated');
      } else {
        console.log('  ℹ️ LM Studio configurations already optimized');
      }

    } catch (error) {
      this.errors.push(`LM Studio fix failed: ${error.message}`);
      console.log('  ❌ Failed to fix LM Studio timeouts');
    }
  }

  /**
   * Fix Ollama timeout and preloading configurations
   */
  async fixOllamaTimeouts() {
    console.log('🦙 Fixing Ollama timeout configurations...');

    try {
      const modelPreloaderPath = path.join(__dirname, 'src/core/model-preloader.ts');
      let content = await fs.readFile(modelPreloaderPath, 'utf-8');

      // Update preloader configurations
      const ollamaFixes = [
        {
          search: /keepAliveTime: '5m',/g,
          replace: "keepAliveTime: '15m', // Longer keep-alive for complex tasks",
          description: 'Increased model keep-alive time'
        },
        {
          search: /retryAttempts: 2,/g,
          replace: 'retryAttempts: 5, // More retries for reliability',
          description: 'Increased retry attempts'
        },
        {
          search: /loadTimeout: 30000,/g,
          replace: 'loadTimeout: 120000, // 2 minutes for large model loading',
          description: 'Increased model loading timeout'
        },
        {
          search: /maxConcurrentLoads: 1,/g,
          replace: 'maxConcurrentLoads: 2, // Allow parallel loading for small models',
          description: 'Increased concurrent loading capacity'
        }
      ];

      let modified = false;
      for (const fix of ollamaFixes) {
        if (fix.search.test(content)) {
          content = content.replace(fix.search, fix.replace);
          this.fixes.push(`Ollama: ${fix.description}`);
          modified = true;
        }
      }

      // Add enhanced model warmup logic
      const enhancedWarmupCode = `
  /**
   * Enhanced model warmup with progressive timeout strategy
   */
  private async warmupModelEnhanced(model: string): Promise<boolean> {
    const status = this.modelStatus.get(model);
    if (status?.isWarm && (Date.now() - (status.lastUsed || 0)) < 600000) {
      logger.debug(\`Model \${model} already warm and recently used\`);
      return true;
    }

    const timeouts = [30000, 60000, 120000]; // Progressive timeouts: 30s, 1m, 2m
    
    for (let attempt = 0; attempt < timeouts.length; attempt++) {
      try {
        logger.debug(\`Warming up model \${model} (attempt \${attempt + 1}/\${timeouts.length}, timeout: \${timeouts[attempt]}ms)\`);
        
        const warmupClient = axios.create({
          baseURL: this.config.endpoint,
          timeout: timeouts[attempt]
        });

        await warmupClient.post('/api/generate', {
          model,
          prompt: 'Hello', // Simple warmup prompt
          stream: false,
          keep_alive: this.config.keepAliveTime,
          options: { 
            num_predict: 1,
            temperature: 0.1 
          }
        });

        // Update status on success
        this.modelStatus.set(model, {
          model,
          status: 'loaded',
          isWarm: true,
          lastUsed: Date.now()
        });

        logger.info(\`✅ Model \${model} warmed up successfully on attempt \${attempt + 1}\`);
        return true;

      } catch (error) {
        const isLastAttempt = attempt === timeouts.length - 1;
        logger.warn(\`Model warmup attempt \${attempt + 1} failed for \${model}: \${error.message}\`);
        
        if (!isLastAttempt) {
          // Wait before retry with exponential backoff
          const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(\`❌ Failed to warm up model \${model} after \${timeouts.length} attempts\`);
    return false;
  }`;

      // Insert enhanced warmup logic
      if (!content.includes('warmupModelEnhanced')) {
        content = content.replace(/}\s*$/, enhancedWarmupCode + '\n}');
        this.fixes.push('Ollama: Added enhanced progressive warmup logic');
        modified = true;
      }

      if (modified) {
        await fs.writeFile(modelPreloaderPath, content);
        console.log('  ✅ Ollama timeout configurations updated');
      } else {
        console.log('  ℹ️ Ollama configurations already optimized');
      }

    } catch (error) {
      this.errors.push(`Ollama fix failed: ${error.message}`);
      console.log('  ❌ Failed to fix Ollama timeouts');
    }
  }

  /**
   * Update model preloader configuration
   */
  async fixModelPreloaderConfig() {
    console.log('🔄 Optimizing model preloader configuration...');

    try {
      const configPath = path.join(__dirname, 'config/hybrid-config.json');
      
      // Check if config file exists
      try {
        await fs.access(configPath);
      } catch {
        // Create config directory if it doesn't exist
        await fs.mkdir(path.dirname(configPath), { recursive: true });
      }

      const optimizedConfig = {
        hybrid: {
          enabled: true,
          escalationThreshold: 0.6,
          lmStudio: {
            endpoint: "http://localhost:1234",
            enabled: true,
            models: ["codellama-7b-instruct", "gemma-3-12b"],
            maxConcurrent: 2,
            streamingEnabled: true,
            taskTypes: ["template", "edit", "format", "boilerplate"],
            performance: {
              modelTtl: 900, // 15 minutes
              keepAliveEnabled: true,
              keepAliveInterval: 120000, // 2 minutes
              modelWarmupEnabled: true,
              connectionTimeout: 300000, // 5 minutes
              requestTimeout: 180000, // 3 minutes
              streamTimeout: 30000 // 30 seconds
            }
          },
          ollama: {
            endpoint: "http://localhost:11434",
            enabled: true,
            models: ["gemma:7b", "qwen2.5:7b"],
            maxConcurrent: 2,
            performance: {
              modelTtl: 1800, // 30 minutes
              keepAliveTime: "15m",
              maxRetries: 5,
              baseTimeout: 120000, // 2 minutes
              warmupTimeout: 180000, // 3 minutes
              concurrentPreloads: 2
            }
          }
        },
        performance: {
          cacheEnabled: true,
          cacheDuration: 300000, // 5 minutes
          timeoutStrategy: "adaptive",
          circuitBreakerEnabled: true
        },
        fallback: {
          autoFallback: true,
          retryAttempts: 3,
          retryDelay: 2000,
          circuitBreaker: {
            enabled: true,
            failureThreshold: 5,
            recoveryTimeout: 60000 // 1 minute
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(optimizedConfig, null, 2));
      this.fixes.push('Created optimized hybrid configuration with proper timeouts');
      console.log('  ✅ Model preloader configuration optimized');

    } catch (error) {
      this.errors.push(`Preloader config fix failed: ${error.message}`);
      console.log('  ❌ Failed to optimize model preloader configuration');
    }
  }

  /**
   * Fix hybrid client timeout handling
   */
  async fixHybridClientTimeouts() {
    console.log('🔀 Fixing hybrid client timeout handling...');

    try {
      const hybridClientPath = path.join(__dirname, 'src/core/hybrid-model-client.ts');
      let content = await fs.readFile(hybridClientPath, 'utf-8');

      // Add timeout override in generateResponse method
      const timeoutOverrideCode = `
  /**
   * Calculate adaptive timeout based on task complexity and provider
   */
  private calculateAdaptiveTimeout(classification: TaskClassification, provider: string): number {
    let baseTimeout = 60000; // 1 minute base

    // Adjust for complexity
    switch (classification.complexity) {
      case 'simple':
        baseTimeout = 30000; // 30 seconds
        break;
      case 'medium':
        baseTimeout = 90000; // 1.5 minutes
        break;
      case 'complex':
        baseTimeout = 300000; // 5 minutes
        break;
    }

    // Adjust for provider characteristics
    if (provider === 'lmstudio') {
      baseTimeout *= 1.5; // LM Studio needs more time for model loading
    }

    // Add buffer for model warmup
    if (classification.type === 'analysis' || classification.type === 'planning') {
      baseTimeout *= 2; // Complex tasks need more time
    }

    return Math.min(baseTimeout, 600000); // Max 10 minutes
  }`;

      // Insert adaptive timeout calculation
      if (!content.includes('calculateAdaptiveTimeout')) {
        content = content.replace(/private async executeRequest\(/, timeoutOverrideCode + '\n\n  private async executeRequest(');
        this.fixes.push('Hybrid Client: Added adaptive timeout calculation');
      }

      // Update executeRequest to use adaptive timeouts
      const executeRequestUpdate = content.replace(
        /(const lmResult = await this\.lmStudioClient\.generateCode\([^)]+\)[^;]*;)/,
        `// Use adaptive timeout
        const adaptiveTimeout = this.calculateAdaptiveTimeout(classification, 'lmstudio');
        const lmResult = await Promise.race([
          this.lmStudioClient.generateCode(prompt, contextStr ? [contextStr] : [], taskMetadata),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), adaptiveTimeout))
        ]) as any;`
      );

      if (executeRequestUpdate !== content) {
        content = executeRequestUpdate;
        this.fixes.push('Hybrid Client: Added adaptive timeout to LM Studio requests');
      }

      await fs.writeFile(hybridClientPath, content);
      console.log('  ✅ Hybrid client timeout handling updated');

    } catch (error) {
      this.errors.push(`Hybrid client fix failed: ${error.message}`);
      console.log('  ❌ Failed to fix hybrid client timeouts');
    }
  }

  /**
   * Create optimized configuration file
   */
  async createOptimizedConfig() {
    console.log('⚙️ Creating optimized system configuration...');

    try {
      const envPath = path.join(__dirname, '.env.timeout-optimized');
      
      const envConfig = `# CodeCrucible Synth - Optimized Timeout Configuration
# Generated by timeout fix script

# LM Studio Configuration
LMSTUDIO_ENDPOINT=http://localhost:1234
LMSTUDIO_TIMEOUT=300000
LMSTUDIO_KEEPALIVE_INTERVAL=120000
LMSTUDIO_MODEL_TTL=900

# Ollama Configuration  
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_TIMEOUT=120000
OLLAMA_KEEPALIVE_TIME=15m
OLLAMA_MAX_RETRIES=5

# Global Timeout Settings
DEFAULT_REQUEST_TIMEOUT=180000
MODEL_WARMUP_TIMEOUT=300000
HEALTH_CHECK_TIMEOUT=30000
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY=60000

# Performance Settings
ENABLE_MODEL_CACHING=true
ENABLE_REQUEST_DEDUPLICATION=true
ENABLE_ADAPTIVE_TIMEOUTS=true
MAX_CONCURRENT_REQUESTS=3

# Debugging
TIMEOUT_DEBUG_LOGGING=true
PERFORMANCE_MONITORING=true
`;

      await fs.writeFile(envPath, envConfig);
      this.fixes.push('Created optimized environment configuration');
      console.log('  ✅ Optimized configuration file created');

    } catch (error) {
      this.errors.push(`Config creation failed: ${error.message}`);
      console.log('  ❌ Failed to create optimized configuration');
    }
  }

  /**
   * Update timeout manager with better defaults
   */
  async updateTimeoutManager() {
    console.log('⏱️ Updating timeout manager configurations...');

    try {
      const timeoutManagerPath = path.join(__dirname, 'src/core/timeout-manager.ts');
      let content = await fs.readFile(timeoutManagerPath, 'utf-8');

      // Update timeout recommendations
      const updatedTimeouts = `
  static getRecommendedTimeout(operationType: string): number {
    const timeouts: Record<string, number> = {
      'model_generation': 300000,     // 5 minutes (increased from 2)
      'model_warmup': 180000,         // 3 minutes (new)
      'model_preload': 120000,        // 2 minutes (new)
      'file_analysis': 60000,         // 1 minute (increased from 30s)
      'project_scan': 120000,         // 2 minutes (increased from 1)
      'api_request': 60000,           // 1 minute (increased from 30s)
      'lmstudio_request': 300000,     // 5 minutes (new)
      'ollama_request': 180000,       // 3 minutes (new)
      'hybrid_request': 360000,       // 6 minutes (new)
      'file_operation': 30000,        // 30 seconds
      'database_operation': 15000,    // 15 seconds (increased from 5)
      'network_request': 30000,       // 30 seconds (increased from 15)
      'compilation': 600000,          // 10 minutes (increased from 5)
      'test_execution': 600000,       // 10 minutes
      'download': 300000,             // 5 minutes (increased from 2)
      'upload': 600000,               // 10 minutes (increased from 5)
      'interactive_input': 300000,    // 5 minutes
      'agent_orchestration': 1200000, // 20 minutes (increased from 10)
      'voice_synthesis': 300000,      // 5 minutes (increased from 3)
    };

    return timeouts[operationType] || 120000; // Default 2 minutes (increased from 1)
  }`;

      // Replace the existing method
      content = content.replace(
        /static getRecommendedTimeout\(operationType: string\): number \{[\s\S]*?\n {2}\}/,
        updatedTimeouts.trim()
      );

      this.fixes.push('Timeout Manager: Updated recommended timeouts for better reliability');

      await fs.writeFile(timeoutManagerPath, content);
      console.log('  ✅ Timeout manager configurations updated');

    } catch (error) {
      this.errors.push(`Timeout manager update failed: ${error.message}`);
      console.log('  ❌ Failed to update timeout manager');
    }
  }

  /**
   * Display fix results
   */
  displayResults() {
    console.log('\n🎯 Timeout Fix Results');
    console.log('═'.repeat(50));

    if (this.fixes.length > 0) {
      console.log('✅ Successfully Applied Fixes:');
      this.fixes.forEach(fix => console.log(`  • ${fix}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors Encountered:');
      this.errors.forEach(error => console.log(`  • ${error}`));
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Ensure LM Studio is running with API server enabled on port 1234');
    console.log('2. Verify Ollama is running and models are available');
    console.log('3. Test the hybrid client with the new timeout configurations');
    console.log('4. Monitor logs for remaining timeout issues');
    console.log('5. Consider using smaller models for faster response times');

    console.log('\n🏃‍♂️ Quick Test Commands:');
    console.log('  npm run test-hybrid');
    console.log('  node test-timeout-fixes.js');
    console.log('  node debug-agent.js');

    if (this.fixes.length > this.errors.length) {
      console.log('\n🎉 Timeout fixes completed successfully!');
      console.log('The AI agent should now have much better timeout handling.');
    } else {
      console.log('\n⚠️ Some fixes failed. Please review the errors and apply them manually.');
    }
  }
}

// Run the fix script
const fixer = new TimeoutFixer();
fixer.run().catch(console.error);
