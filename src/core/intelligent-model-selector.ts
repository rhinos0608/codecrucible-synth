import { logger } from './logger.js';
import { AutonomousErrorHandler } from './autonomous-error-handler.js';

export interface ModelCapability {
  name: string;
  strengths: string[];
  weaknesses: string[];
  recommendedFor: string[];
  size: 'small' | 'medium' | 'large';
  speed: 'fast' | 'medium' | 'slow';
}

/**
 * Intelligent Model Selector
 * 
 * Automatically selects the best model for each task based on:
 * - Task requirements
 * - Available resources
 * - Historical performance
 * - Model capabilities
 */
export class IntelligentModelSelector {
  private errorHandler: AutonomousErrorHandler;
  private performanceHistory = new Map<string, number[]>();
  
  // Model capability database
  private modelCapabilities: ModelCapability[] = [
    {
      name: 'codellama:34b',
      strengths: ['code generation', 'debugging', 'code analysis'],
      weaknesses: ['general chat', 'creative writing'],
      recommendedFor: ['coding', 'debugging', 'code_review'],
      size: 'large',
      speed: 'slow'
    },
    {
      name: 'codellama:13b', 
      strengths: ['code generation', 'fast responses'],
      weaknesses: ['complex reasoning'],
      recommendedFor: ['coding', 'simple_tasks'],
      size: 'medium',
      speed: 'medium'
    },
    {
      name: 'codellama:7b',
      strengths: ['fast responses', 'lightweight'],
      weaknesses: ['complex tasks', 'accuracy'],
      recommendedFor: ['simple_coding', 'quick_help'],
      size: 'small',
      speed: 'fast'
    },
    {
      name: 'llama3.1:70b',
      strengths: ['reasoning', 'complex tasks', 'accuracy'],
      weaknesses: ['speed', 'resource usage'],
      recommendedFor: ['planning', 'analysis', 'complex_reasoning'],
      size: 'large',
      speed: 'slow'
    },
    {
      name: 'llama3.2:8b',
      strengths: ['balance', 'general purpose', 'good speed'],
      weaknesses: ['not specialized'],
      recommendedFor: ['general', 'chat', 'mixed_tasks'],
      size: 'medium',
      speed: 'medium'
    },
    {
      name: 'qwen2.5:72b',
      strengths: ['multilingual', 'reasoning', 'coding'],
      weaknesses: ['speed', 'resource usage'],
      recommendedFor: ['complex_coding', 'analysis', 'planning'],
      size: 'large', 
      speed: 'slow'
    },
    {
      name: 'qwen2.5:7b',
      strengths: ['fast', 'coding', 'lightweight'],
      weaknesses: ['complex reasoning'],
      recommendedFor: ['simple_coding', 'quick_tasks'],
      size: 'small',
      speed: 'fast'
    },
    {
      name: 'gemma2:27b',
      strengths: ['reasoning', 'safety', 'accuracy'],
      weaknesses: ['speed'],
      recommendedFor: ['analysis', 'safe_operations'],
      size: 'large',
      speed: 'slow'
    },
    {
      name: 'gemma2:9b',
      strengths: ['balanced', 'efficient', 'safe'],
      weaknesses: ['not specialized'],
      recommendedFor: ['general', 'safe_operations'],
      size: 'medium',
      speed: 'medium'
    }
  ];

  constructor() {
    this.errorHandler = new AutonomousErrorHandler();
  }

  /**
   * Select the best model for a given task
   */
  async selectOptimalModel(
    taskType: string,
    requirements: {
      speed?: 'fast' | 'medium' | 'slow';
      accuracy?: 'high' | 'medium' | 'low';
      complexity?: 'simple' | 'medium' | 'complex';
      resources?: 'limited' | 'normal' | 'unlimited';
    } = {},
    availableModels: string[] = []
  ): Promise<string> {
    
    logger.info(`🧠 Selecting optimal model for task: ${taskType}`);
    
    // Get task-specific model preferences
    let candidates = this.getTaskSpecificModels(taskType);
    
    // Filter by availability if provided
    if (availableModels.length > 0) {
      candidates = candidates.filter(model => 
        availableModels.some(available => 
          available.includes(model.name.split(':')[0])
        )
      );
    }
    
    // Apply requirement filters
    candidates = this.filterByRequirements(candidates, requirements);
    
    // Sort by performance history and suitability
    candidates.sort((a, b) => {
      const aScore = this.calculateModelScore(a, taskType, requirements);
      const bScore = this.calculateModelScore(b, taskType, requirements);
      return bScore - aScore;
    });
    
    const selectedModel = candidates[0]?.name;
    
    if (selectedModel) {
      logger.info(`✅ Selected model: ${selectedModel} for task: ${taskType}`);
      return selectedModel;
    }
    
    // Fallback to most capable available model
    const fallback = await this.errorHandler.getRecommendedModel(taskType as any);
    logger.warn(`⚠️ No optimal model found, using fallback: ${fallback}`);
    return fallback;
  }

  /**
   * Get models suitable for specific task types
   */
  private getTaskSpecificModels(taskType: string): ModelCapability[] {
    const taskMappings = {
      'coding': ['coding', 'code_generation', 'debugging'],
      'analysis': ['analysis', 'reasoning', 'complex_reasoning'],
      'planning': ['planning', 'reasoning', 'complex_reasoning'],
      'chat': ['general', 'chat'],
      'debugging': ['coding', 'debugging', 'code_review'],
      'review': ['code_review', 'analysis'],
      'simple': ['simple_tasks', 'quick_help', 'simple_coding'],
      'complex': ['complex_reasoning', 'complex_coding', 'analysis']
    };
    
    const relevantTasks = taskMappings[taskType as keyof typeof taskMappings] || ['general'];
    
    return this.modelCapabilities.filter(model =>
      model.recommendedFor.some(task => relevantTasks.includes(task))
    );
  }

  /**
   * Filter models by requirements
   */
  private filterByRequirements(
    models: ModelCapability[],
    requirements: any
  ): ModelCapability[] {
    let filtered = [...models];
    
    // Speed requirements
    if (requirements.speed === 'fast') {
      filtered = filtered.filter(m => m.speed === 'fast');
    } else if (requirements.speed === 'slow') {
      // Allow medium and slow for slow requirement
      filtered = filtered.filter(m => m.speed !== 'fast');
    }
    
    // Resource constraints
    if (requirements.resources === 'limited') {
      filtered = filtered.filter(m => m.size === 'small' || m.size === 'medium');
    } else if (requirements.resources === 'unlimited') {
      // Prefer larger models for better quality
      filtered.sort((a, b) => {
        const sizeOrder = { 'small': 1, 'medium': 2, 'large': 3 };
        return sizeOrder[b.size] - sizeOrder[a.size];
      });
    }
    
    // Complexity requirements
    if (requirements.complexity === 'simple') {
      filtered = filtered.filter(m => 
        m.size === 'small' || m.speed === 'fast'
      );
    } else if (requirements.complexity === 'complex') {
      filtered = filtered.filter(m => 
        m.size === 'large' || m.strengths.includes('reasoning')
      );
    }
    
    return filtered;
  }

  /**
   * Calculate overall score for a model
   */
  private calculateModelScore(
    model: ModelCapability,
    taskType: string,
    requirements: any
  ): number {
    let score = 0;
    
    // Base suitability score (0-50)
    const taskMappings = {
      'coding': ['code generation', 'debugging', 'coding'],
      'analysis': ['reasoning', 'complex tasks', 'analysis'],
      'planning': ['reasoning', 'complex tasks'],
      'chat': ['general purpose', 'balance'],
      'simple': ['fast responses', 'lightweight']
    };
    
    const relevantStrengths = taskMappings[taskType as keyof typeof taskMappings] || [];
    const matchingStrengths = model.strengths.filter(strength =>
      relevantStrengths.some(relevant => strength.includes(relevant))
    );
    
    score += matchingStrengths.length * 10;
    
    // Performance history bonus (0-20)
    const historicalPerformance = this.getAveragePerformance(model.name, taskType);
    score += Math.min(historicalPerformance * 20, 20);
    
    // Requirements alignment (0-30)
    if (requirements.speed && model.speed === requirements.speed) score += 10;
    if (requirements.accuracy === 'high' && model.size === 'large') score += 10;
    if (requirements.resources === 'limited' && model.size === 'small') score += 10;
    
    return score;
  }

  /**
   * Get average performance for a model on specific task type
   */
  private getAveragePerformance(modelName: string, taskType: string): number {
    const key = `${modelName}-${taskType}`;
    const history = this.performanceHistory.get(key);
    
    if (!history || history.length === 0) return 0.5; // Default neutral score
    
    return history.reduce((sum, score) => sum + score, 0) / history.length;
  }

  /**
   * Record performance for a model
   */
  recordPerformance(
    modelName: string,
    taskType: string,
    success: boolean,
    duration: number = 0,
    quality: number = 1
  ): void {
    const key = `${modelName}-${taskType}`;
    
    // Calculate composite score (0-1)
    // Success contributes 50%, speed 25%, quality 25%
    let score = success ? 0.5 : 0;
    
    if (duration > 0) {
      // Normalize duration (assume 30s is baseline, faster is better)
      const speedScore = Math.max(0, Math.min(0.25, 0.25 * (30 / duration)));
      score += speedScore;
    }
    
    score += quality * 0.25;
    
    const history = this.performanceHistory.get(key) || [];
    history.push(score);
    
    // Keep only last 10 performance records
    if (history.length > 10) {
      history.shift();
    }
    
    this.performanceHistory.set(key, history);
    
    logger.debug(`📊 Recorded performance for ${modelName} on ${taskType}: ${score.toFixed(2)}`);
  }

  /**
   * Get adaptive model recommendation based on context
   */
  async getAdaptiveRecommendation(
    taskType: string,
    context: {
      urgency?: 'low' | 'medium' | 'high';
      complexity?: 'simple' | 'medium' | 'complex';
      accuracy_needed?: boolean;
      resource_constraints?: boolean;
      previous_failures?: string[];
    } = {}
  ): Promise<string> {
    
    const requirements = {
      speed: context.urgency === 'high' ? 'fast' as const : 
             context.urgency === 'low' ? 'slow' as const : 'medium' as const,
      accuracy: context.accuracy_needed ? 'high' as const : 'medium' as const,
      complexity: context.complexity || 'medium' as const,
      resources: context.resource_constraints ? 'limited' as const : 'normal' as const
    };
    
    const selectedModel = await this.selectOptimalModel(taskType, requirements);
    
    // Avoid previously failed models if specified
    if (context.previous_failures && context.previous_failures.includes(selectedModel)) {
      logger.warn(`⚠️ Avoiding previously failed model: ${selectedModel}`);
      const alternatives = await this.getAlternativeModels(selectedModel, taskType, requirements);
      return alternatives[0] || selectedModel;
    }
    
    return selectedModel;
  }

  /**
   * Get alternative models when primary choice fails
   */
  async getAlternativeModels(
    failedModel: string,
    taskType: string,
    requirements: any
  ): Promise<string[]> {
    let candidates = this.getTaskSpecificModels(taskType);
    
    // Remove failed model
    candidates = candidates.filter(model => model.name !== failedModel);
    
    // Apply filters and sort
    candidates = this.filterByRequirements(candidates, requirements);
    candidates.sort((a, b) => {
      const aScore = this.calculateModelScore(a, taskType, requirements);
      const bScore = this.calculateModelScore(b, taskType, requirements);
      return bScore - aScore;
    });
    
    return candidates.map(model => model.name);
  }

  /**
   * Monitor and auto-switch models based on performance
   */
  async autoOptimizeModelSelection(): Promise<void> {
    logger.info('🔄 Running automatic model optimization...');
    
    // Analyze performance patterns
    const taskTypes = ['coding', 'analysis', 'planning', 'chat'];
    
    for (const taskType of taskTypes) {
      const modelPerformance = new Map<string, number>();
      
      // Calculate average performance for each model
      for (const [key, history] of this.performanceHistory.entries()) {
        const [modelName, task] = key.split('-');
        
        if (task === taskType && history.length >= 3) {
          const avgPerformance = history.reduce((sum, score) => sum + score, 0) / history.length;
          modelPerformance.set(modelName, avgPerformance);
        }
      }
      
      // Identify best performing model
      if (modelPerformance.size > 0) {
        const bestModel = Array.from(modelPerformance.entries())
          .sort(([,a], [,b]) => b - a)[0];
        
        logger.info(`📈 Best performing model for ${taskType}: ${bestModel[0]} (score: ${bestModel[1].toFixed(2)})`);
      }
    }
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): any {
    const data: any = {};
    
    for (const [key, history] of this.performanceHistory.entries()) {
      const [modelName, taskType] = key.split('-');
      
      if (!data[taskType]) data[taskType] = {};
      
      data[taskType][modelName] = {
        history: [...history],
        average: history.reduce((sum, score) => sum + score, 0) / history.length,
        samples: history.length
      };
    }
    
    return data;
  }
}