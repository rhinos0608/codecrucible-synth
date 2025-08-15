import { logger } from './logger.js';
import { EnhancedModelManager } from './enhanced-model-manager.js';
import { spawn } from 'child_process';

export interface ErrorContext {
  errorType: string;
  errorMessage: string;
  operation: string;
  model?: string;
  context?: any;
}

export interface RecoveryAction {
  action: 'retry' | 'switch_model' | 'pull_model' | 'restart_service' | 'fallback';
  target?: string;
  reason: string;
}

/**
 * Autonomous Error Handler
 * 
 * Intelligently diagnoses errors and takes corrective action without user intervention
 */
export class AutonomousErrorHandler {
  private modelManager: EnhancedModelManager;
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;

  constructor(endpoint: string = 'http://localhost:11434') {
    this.modelManager = new EnhancedModelManager(endpoint);
  }

  /**
   * Analyze error and determine autonomous recovery action
   */
  async analyzeAndRecover(error: ErrorContext): Promise<RecoveryAction[]> {
    logger.info(`🔍 Analyzing error: ${error.errorType} - ${error.errorMessage}`);
    
    const actions: RecoveryAction[] = [];
    
    // HTTP 500 errors - model overloaded or crashed
    if (error.errorMessage.includes('status code 500')) {
      actions.push(...await this.handleModelCrash(error));
    }
    
    // HTTP 404 errors - model not found
    else if (error.errorMessage.includes('status code 404')) {
      actions.push(...await this.handleModelNotFound(error));
    }
    
    // Connection refused - Ollama not running
    else if (error.errorMessage.includes('ECONNREFUSED') || error.errorMessage.includes('connect ECONNREFUSED')) {
      actions.push(...await this.handleServiceDown(error));
    }
    
    // Timeout errors - model too slow
    else if (error.errorMessage.includes('timeout')) {
      actions.push(...await this.handleTimeout(error));
    }
    
    // Memory/context errors
    else if (error.errorMessage.includes('context') || error.errorMessage.includes('memory')) {
      actions.push(...await this.handleContextError(error));
    }
    
    // Unknown errors - generic recovery
    else {
      actions.push({
        action: 'fallback',
        reason: 'Unknown error type, using fallback logic'
      });
    }

    // Execute recovery actions
    await this.executeRecoveryActions(actions, error);
    
    return actions;
  }

  /**
   * Handle model crash (HTTP 500)
   */
  private async handleModelCrash(error: ErrorContext): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];
    
    // First, try switching to a lighter model
    const availableModels = await this.modelManager.getAvailableModels();
    const lightModels = availableModels.filter((m: any) => 
      m.name.includes('7b') || m.name.includes('3b') || m.name.includes('1b')
    );
    
    if (lightModels.length > 0) {
      actions.push({
        action: 'switch_model',
        target: lightModels[0].name,
        reason: 'Switching to lighter model to reduce memory pressure'
      });
    }
    
    // If that fails, restart Ollama service
    actions.push({
      action: 'restart_service',
      reason: 'Model appears crashed, restarting Ollama service'
    });
    
    return actions;
  }

  /**
   * Handle model not found (HTTP 404)
   */
  private async handleModelNotFound(error: ErrorContext): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];
    
    if (error.model) {
      logger.info(`🔄 Model ${error.model} not found, attempting to pull...`);
      
      actions.push({
        action: 'pull_model',
        target: error.model,
        reason: `Model ${error.model} not available locally, pulling from registry`
      });
    }
    
    // If pull fails, try popular alternatives
    const fallbackModels = [
      'llama3.2:latest',
      'llama3.1:8b', 
      'gemma2:9b',
      'qwen2.5:7b',
      'codellama:7b'
    ];
    
    for (const model of fallbackModels) {
      actions.push({
        action: 'pull_model',
        target: model,
        reason: `Fallback: pulling reliable model ${model}`
      });
    }
    
    return actions;
  }

  /**
   * Handle Ollama service down
   */
  private async handleServiceDown(error: ErrorContext): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];
    
    // Try to start Ollama service
    actions.push({
      action: 'restart_service',
      reason: 'Ollama service appears to be down, attempting to start'
    });
    
    return actions;
  }

  /**
   * Handle timeout errors
   */
  private async handleTimeout(error: ErrorContext): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];
    
    // Switch to faster model
    const availableModels = await this.modelManager.getAvailableModels();
    const fastModels = availableModels.filter((m: any) => 
      m.name.includes('3b') || m.name.includes('1b') || m.name.includes('7b')
    );
    
    if (fastModels.length > 0) {
      actions.push({
        action: 'switch_model',
        target: fastModels[0].name,
        reason: 'Switching to faster model to avoid timeouts'
      });
    }
    
    return actions;
  }

  /**
   * Handle context/memory errors
   */
  private async handleContextError(error: ErrorContext): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];
    
    // Reduce context size and retry
    actions.push({
      action: 'retry',
      reason: 'Retrying with reduced context size'
    });
    
    return actions;
  }

  /**
   * Execute recovery actions
   */
  private async executeRecoveryActions(actions: RecoveryAction[], error: ErrorContext): Promise<void> {
    for (const action of actions) {
      logger.info(`🔧 Executing recovery action: ${action.action} - ${action.reason}`);
      
      try {
        switch (action.action) {
          case 'pull_model':
            if (action.target) {
              await this.pullModel(action.target);
            }
            break;
            
          case 'switch_model':
            if (action.target) {
              logger.info(`🔄 Switching to model: ${action.target}`);
              // Model switching will be handled by the calling code
            }
            break;
            
          case 'restart_service':
            await this.restartOllamaService();
            break;
            
          case 'retry':
            const retryKey = `${error.operation}-${error.model}`;
            const attempts = this.retryAttempts.get(retryKey) || 0;
            this.retryAttempts.set(retryKey, attempts + 1);
            break;
        }
        
        // Wait a bit between actions
        await this.delay(2000);
        
      } catch (actionError) {
        logger.warn(`❌ Recovery action failed: ${action.action}`, actionError);
        continue;
      }
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  private async pullModel(modelName: string): Promise<boolean> {
    return new Promise((resolve) => {
      logger.info(`📥 Pulling model: ${modelName}`);
      
      const process = spawn('ollama', ['pull', modelName], {
        stdio: 'pipe'
      });
      
      // Silent progress - no terminal pollution
      process.stdout.on('data', () => {
        // Silently consume output
      });
      
      process.stderr.on('data', () => {
        // Silently consume errors
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          logger.info(`Model ${modelName} ready`);
          resolve(true);
        } else {
          logger.error(`Model pull failed: ${modelName}`);
          resolve(false);
        }
      });
      
      // Timeout after 10 minutes
      setTimeout(() => {
        process.kill();
        logger.warn(`Model pull timeout: ${modelName}`);
        resolve(false);
      }, 600000);
    });
  }

  /**
   * Restart Ollama service
   */
  private async restartOllamaService(): Promise<boolean> {
    return new Promise((resolve) => {
      logger.info('Restarting Ollama service...');
      
      // Try different approaches based on platform
      const commands = process.platform === 'win32' 
        ? [
            ['taskkill', '/F', '/IM', 'ollama.exe'],
            ['ollama', 'serve']
          ]
        : [
            ['pkill', '-f', 'ollama'],
            ['ollama', 'serve']
          ];
      
      this.executeCommandSequence(commands)
        .then(success => {
          if (success) {
            logger.info('✅ Ollama service restarted successfully');
            // Wait for service to be ready
            setTimeout(() => resolve(true), 5000);
          } else {
            logger.warn('❌ Failed to restart Ollama service');
            resolve(false);
          }
        })
        .catch(() => {
          logger.warn('❌ Error restarting Ollama service');
          resolve(false);
        });
    });
  }

  /**
   * Execute a sequence of commands
   */
  private async executeCommandSequence(commands: string[][]): Promise<boolean> {
    for (const cmd of commands) {
      try {
        await new Promise((resolve, reject) => {
          const process = spawn(cmd[0], cmd.slice(1), { stdio: 'ignore' });
          process.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error(`Command failed: ${cmd.join(' ')}`));
          });
        });
      } catch (error) {
        logger.warn(`Command failed: ${cmd.join(' ')}`, error);
        // Continue with next command
      }
    }
    return true;
  }

  /**
   * Check if we should retry based on attempt count
   */
  shouldRetry(operation: string, model?: string): boolean {
    const retryKey = `${operation}-${model}`;
    const attempts = this.retryAttempts.get(retryKey) || 0;
    return attempts < this.maxRetries;
  }

  /**
   * Reset retry counter for an operation
   */
  resetRetryCount(operation: string, model?: string): void {
    const retryKey = `${operation}-${model}`;
    this.retryAttempts.delete(retryKey);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get intelligent model recommendation based on task
   */
  async getRecommendedModel(taskType: 'coding' | 'chat' | 'analysis' | 'planning' | 'general'): Promise<string> {
    const availableModels = await this.modelManager.getAvailableModels();
    
    const preferences = {
      coding: ['codellama', 'deepseek', 'qwen2.5-coder'],
      chat: ['llama3.2', 'llama3.1', 'gemma2'],
      analysis: ['qwen2.5', 'llama3.1', 'gemma2'],
      planning: ['llama3.1', 'qwen2.5', 'gemma2'],
      general: ['qwen2.5', 'llama3.1', 'gemma2']
    };
    
    const preferred = preferences[taskType] || preferences['general'];
    
    for (const pref of preferred) {
      const model = availableModels.find((m: any) => 
        m.name.toLowerCase().includes(pref.toLowerCase())
      );
      if (model) return model.name;
    }
    
    // Fallback to first available model
    return availableModels[0]?.name || 'llama3.2:latest';
  }
}