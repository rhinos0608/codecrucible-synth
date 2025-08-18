import axios from 'axios';
import { logger } from './logger.js';

interface RoutingMetric {
  lmStudioAttempts: number;
  lmStudioSuccess: number;
  ollamaAttempts: number;
  ollamaSuccess: number;
}

export class IntelligentModelSelector {
  private routingMetrics = new Map<string, RoutingMetric>();
  private endpoint: string;
  
  // OPTIMIZED: Cache health checks to reduce redundant API calls
  private healthCheckCache = new Map<string, { healthy: boolean; timestamp: number }>();
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds

  constructor(endpoint: string = 'http://localhost:11434') {
    this.endpoint = endpoint;
  }

  /**
   * Enhanced model selection with LM Studio support
   */
  async selectOptimalLLM(
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    requirements: {
      speed?: 'fast' | 'medium' | 'slow';
      accuracy?: 'high' | 'medium' | 'low';
      streaming?: boolean;
    } = {}
  ): Promise<{
    llm: 'lmstudio' | 'ollama';
    model: string;
    confidence: number;
    reasoning: string;
  }> {
    
    // Check availability of both services
    const [lmStudioAvailable, ollamaAvailable] = await Promise.all([
      this.checkLMStudioHealth(),
      this.checkOllamaHealth()
    ]);

    // Decision matrix based on task characteristics
    const decision = this.makeRoutingDecision(taskType, complexity, requirements, {
      lmStudioAvailable,
      ollamaAvailable
    });

    // Log routing decision for learning
    this.recordRoutingDecision(taskType, complexity, decision);

    return decision;
  }

  /**
   * Make routing decision based on task characteristics
   */
  private makeRoutingDecision(
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    requirements: {
      speed?: 'fast' | 'medium' | 'slow';
      accuracy?: 'high' | 'medium' | 'low';
      streaming?: boolean;
    },
    availability: { lmStudioAvailable: boolean; ollamaAvailable: boolean }
  ): { llm: 'lmstudio' | 'ollama'; model: string; confidence: number; reasoning: string } {
    
    // If only one service is available, use it
    if (!availability.lmStudioAvailable && availability.ollamaAvailable) {
      return {
        llm: 'ollama',
        model: 'codellama:34b',
        confidence: 0.8,
        reasoning: 'LM Studio unavailable, using Ollama fallback'
      };
    }
    
    if (availability.lmStudioAvailable && !availability.ollamaAvailable) {
      return {
        llm: 'lmstudio',
        model: 'codellama-7b-instruct',
        confidence: 0.7,
        reasoning: 'Ollama unavailable, using LM Studio fallback'
      };
    }

    // Both available - make optimal choice
    const fastTasks = ['template', 'format', 'edit', 'boilerplate'];
    const complexTasks = ['analysis', 'planning', 'debugging', 'architecture'];

    // Speed is prioritized
    if (requirements.speed === 'fast' || fastTasks.includes(taskType)) {
      return {
        llm: 'lmstudio',
        model: 'codellama-7b-instruct',
        confidence: 0.9,
        reasoning: 'Fast response required, using LM Studio'
      };
    }

    // Quality is prioritized
    if (complexity === 'complex' || complexTasks.includes(taskType)) {
      return {
        llm: 'ollama',
        model: 'codellama:34b',
        confidence: 0.9,
        reasoning: 'Complex task requiring deep reasoning, using Ollama'
      };
    }

    // Medium complexity - check historical performance
    const historicalPerformance = this.getHistoricalPerformance(taskType);
    
    if (historicalPerformance.lmStudio > historicalPerformance.ollama) {
      return {
        llm: 'lmstudio',
        model: 'codellama-7b-instruct',
        confidence: 0.8,
        reasoning: 'Historical performance favors LM Studio for this task type'
      };
    } else {
      return {
        llm: 'ollama',
        model: 'codellama:34b',
        confidence: 0.8,
        reasoning: 'Historical performance favors Ollama for this task type'
      };
    }
  }

  /**
   * OPTIMIZED: Check LM Studio health with caching
   */
  private async checkLMStudioHealth(): Promise<boolean> {
    const cacheKey = 'lmstudio';
    const cached = this.healthCheckCache.get(cacheKey);
    
    // Use cached result if less than 30 seconds old
    if (cached && (Date.now() - cached.timestamp) < this.HEALTH_CACHE_TTL) {
      return cached.healthy;
    }
    
    try {
      const response = await axios.get('http://localhost:1234/v1/models', { timeout: 5000 });
      const healthy = response.status === 200;
      this.healthCheckCache.set(cacheKey, { healthy, timestamp: Date.now() });
      return healthy;
    } catch {
      this.healthCheckCache.set(cacheKey, { healthy: false, timestamp: Date.now() });
      return false;
    }
  }

  /**
   * OPTIMIZED: Check Ollama health with caching
   */
  private async checkOllamaHealth(): Promise<boolean> {
    const cacheKey = 'ollama';
    const cached = this.healthCheckCache.get(cacheKey);
    
    // Use cached result if less than 30 seconds old
    if (cached && (Date.now() - cached.timestamp) < this.HEALTH_CACHE_TTL) {
      return cached.healthy;
    }
    
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`, { timeout: 5000 });
      const healthy = response.status === 200;
      this.healthCheckCache.set(cacheKey, { healthy, timestamp: Date.now() });
      return healthy;
    } catch {
      this.healthCheckCache.set(cacheKey, { healthy: false, timestamp: Date.now() });
      return false;
    }
  }

  /**
   * Get historical performance for a task type
   */
  private getHistoricalPerformance(taskType: string): { lmStudio: number; ollama: number } {
    const metric = this.routingMetrics.get(taskType);
    
    if (!metric) {
      return { lmStudio: 0.5, ollama: 0.5 }; // Default equal weight
    }

    return {
      lmStudio: metric.lmStudioSuccess / Math.max(1, metric.lmStudioAttempts),
      ollama: metric.ollamaSuccess / Math.max(1, metric.ollamaAttempts)
    };
  }

  /**
   * Record routing decision for learning
   */
  private recordRoutingDecision(
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    decision: { llm: 'lmstudio' | 'ollama' }
  ): void {
    const key = `${taskType}-${complexity}`;
    
    if (!this.routingMetrics.has(key)) {
      this.routingMetrics.set(key, {
        lmStudioAttempts: 0,
        lmStudioSuccess: 0,
        ollamaAttempts: 0,
        ollamaSuccess: 0
      });
    }

    const metric = this.routingMetrics.get(key)!;
    
    if (decision.llm === 'lmstudio') {
      metric.lmStudioAttempts++;
    } else {
      metric.ollamaAttempts++;
    }
  }

  /**
   * Record the success/failure of a routing decision
   */
  recordRoutingOutcome(
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    llm: 'lmstudio' | 'ollama',
    success: boolean
  ): void {
    const key = `${taskType}-${complexity}`;
    const metric = this.routingMetrics.get(key);
    
    if (metric) {
      if (llm === 'lmstudio' && success) {
        metric.lmStudioSuccess++;
      } else if (llm === 'ollama' && success) {
        metric.ollamaSuccess++;
      }
    }
  }
}
