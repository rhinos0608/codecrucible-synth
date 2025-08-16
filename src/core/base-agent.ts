/**
 * BaseAgent - Foundational agent class inspired by Archon's architecture
 * Provides rate limiting, error handling, and extensible agent framework
 */

import { logger } from './logger.js';
import { CLIContext } from './cli.js';

export interface RateLimitConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface BaseAgentConfig {
  name: string;
  description: string;
  rateLimit?: RateLimitConfig;
  timeout?: number;
}

export interface AgentDependencies {
  context: CLIContext;
  workingDirectory: string;
  sessionId?: string;
}

export abstract class BaseAgentOutput {
  abstract success: boolean;
  abstract message: string;
  abstract data?: any;
  abstract timestamp: number;
}

export class RateLimitHandler {
  private lastRequestTime: number = 0;
  private consecutiveFailures: number = 0;
  
  constructor(private config: RateLimitConfig) {}

  async handleRateLimit(
    operation: () => Promise<any>,
    onProgress?: (attempt: number, delay: number) => void
  ): Promise<any> {
    let attempt = 0;
    
    while (attempt < this.config.maxRetries) {
      try {
        // Implement rate limiting delay
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minDelay = this.calculateDelay(attempt);
        
        if (timeSinceLastRequest < minDelay) {
          const waitTime = minDelay - timeSinceLastRequest;
          
          if (onProgress) {
            onProgress(attempt + 1, waitTime);
          }
          
          logger.info(`Rate limiting: waiting ${waitTime}ms before attempt ${attempt + 1}`);
          await this.sleep(waitTime);
        }
        
        this.lastRequestTime = Date.now();
        const result = await operation();
        
        // Reset failure count on success
        this.consecutiveFailures = 0;
        return result;
        
      } catch (error) {
        attempt++;
        this.consecutiveFailures++;
        
        if (attempt >= this.config.maxRetries) {
          logger.error(`Rate limit handler: All ${this.config.maxRetries} attempts failed`, error);
          throw error;
        }
        
        const delay = this.calculateDelay(attempt);
        logger.warn(`Rate limit handler: Attempt ${attempt} failed, retrying in ${delay}ms`);
        
        if (onProgress) {
          onProgress(attempt + 1, delay);
        }
        
        await this.sleep(delay);
      }
    }
    
    throw new Error(`Rate limit handler: Exceeded maximum retries (${this.config.maxRetries})`);
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
    return Math.min(exponentialDelay, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getFailureCount(): number {
    return this.consecutiveFailures;
  }
}

export abstract class BaseAgent<TOutput extends BaseAgentOutput> {
  protected rateLimitHandler: RateLimitHandler;
  protected dependencies: AgentDependencies;
  
  constructor(
    protected config: BaseAgentConfig,
    dependencies: AgentDependencies
  ) {
    this.dependencies = dependencies;
    
    // Initialize rate limiting with default config if not provided
    const rateConfig = config.rateLimit || {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2
    };
    
    this.rateLimitHandler = new RateLimitHandler(rateConfig);
    
    logger.info(`BaseAgent initialized: ${config.name}`, {
      description: config.description,
      rateLimit: rateConfig,
      timeout: config.timeout
    });
  }

  /**
   * Abstract method for creating the agent - must be implemented by subclasses
   */
  protected abstract createAgent(): Promise<any>;

  /**
   * Abstract method for generating system prompts - must be implemented by subclasses
   */
  protected abstract generateSystemPrompt(): string;

  /**
   * Execute the agent with rate limiting and error handling
   */
  async run(
    input: string,
    options?: {
      streaming?: boolean;
      onProgress?: (attempt: number, delay: number) => void;
      timeout?: number;
    }
  ): Promise<TOutput> {
    const timeout = options?.timeout || this.config.timeout || 30000;
    
    try {
      return await Promise.race([
        this.executeWithRateLimit(input, options),
        this.createTimeoutPromise(timeout)
      ]);
    } catch (error) {
      logger.error(`BaseAgent execution failed for ${this.config.name}:`, error);
      throw error;
    }
  }

  private async executeWithRateLimit(
    input: string,
    options?: {
      streaming?: boolean;
      onProgress?: (attempt: number, delay: number) => void;
    }
  ): Promise<TOutput> {
    return this.rateLimitHandler.handleRateLimit(
      async () => {
        const agent = await this.createAgent();
        return await this.executeAgent(agent, input, options?.streaming);
      },
      options?.onProgress
    );
  }

  /**
   * Execute the agent - can be overridden by subclasses for custom execution logic
   */
  protected async executeAgent(agent: any, input: string, streaming?: boolean): Promise<TOutput> {
    // Default implementation - subclasses should override this
    throw new Error('executeAgent must be implemented by subclass');
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Agent execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Get agent statistics and health information
   */
  getStats() {
    return {
      name: this.config.name,
      description: this.config.description,
      consecutiveFailures: this.rateLimitHandler.getFailureCount(),
      rateConfig: this.config.rateLimit
    };
  }

  /**
   * Validate agent configuration
   */
  protected validateConfig(): void {
    if (!this.config.name || this.config.name.trim() === '') {
      throw new Error('Agent name is required');
    }
    
    if (!this.config.description || this.config.description.trim() === '') {
      throw new Error('Agent description is required');
    }
  }

  /**
   * Register tools that this agent can use
   */
  protected abstract getAvailableTools(): any[];

  /**
   * Get the current working directory for this agent
   */
  protected getWorkingDirectory(): string {
    return this.dependencies.workingDirectory;
  }

  /**
   * Get the CLI context for accessing model clients and services
   */
  protected getContext(): CLIContext {
    return this.dependencies.context;
  }
}

/**
 * Factory function for creating agents with proper dependency injection
 */
export function createAgent<T extends BaseAgent<any>>(
  AgentClass: new (config: BaseAgentConfig, dependencies: AgentDependencies) => T,
  config: BaseAgentConfig,
  dependencies: AgentDependencies
): T {
  const agent = new AgentClass(config, dependencies);
  logger.info(`Created agent: ${config.name}`);
  return agent;
}