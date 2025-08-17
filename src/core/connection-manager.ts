import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from './logger.js';

export interface ConnectionPoolOptions {
  maxSockets: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  keepAlive: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
}

/**
 * Enhanced connection manager with retry logic and connection pooling
 * Addresses socket hang up errors and connection instability
 */
export class ConnectionManager {
  private pools = new Map<string, AxiosInstance>();
  private healthStatus = new Map<string, { healthy: boolean; lastCheck: number }>();
  private retryConfigs = new Map<string, RetryConfig>();

  constructor() {
    logger.info('Connection manager initialized');
  }

  /**
   * Create or get connection pool for an endpoint
   */
  getPool(endpoint: string, options?: Partial<ConnectionPoolOptions>): AxiosInstance {
    if (this.pools.has(endpoint)) {
      return this.pools.get(endpoint)!;
    }

    const defaultOptions: ConnectionPoolOptions = {
      maxSockets: 10,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      keepAlive: true
    };

    const finalOptions = { ...defaultOptions, ...options };

    const pool = axios.create({
      baseURL: endpoint,
      timeout: finalOptions.timeout,
      headers: {
        'Connection': finalOptions.keepAlive ? 'keep-alive' : 'close',
        'Keep-Alive': finalOptions.keepAlive ? 'timeout=30, max=1000' : undefined
      },
      // Connection pooling configuration
      maxRedirects: 3,
      validateStatus: (status) => status < 500, // Retry on 5xx errors
    });

    // Add response interceptor for automatic retries
    pool.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        // Don't retry if we've exceeded max attempts
        if (!config || config._retryCount >= finalOptions.retryAttempts) {
          return Promise.reject(error);
        }

        // Initialize retry count
        config._retryCount = config._retryCount || 0;
        config._retryCount++;

        // Calculate delay with exponential backoff
        const delay = finalOptions.retryDelay * Math.pow(2, config._retryCount - 1);
        
        logger.warn(`Request failed, retrying ${config._retryCount}/${finalOptions.retryAttempts} after ${delay}ms`, {
          endpoint,
          error: error.message,
          attempt: config._retryCount
        });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the request
        return pool(config);
      }
    );

    this.pools.set(endpoint, pool);
    
    // Set default retry config
    this.retryConfigs.set(endpoint, {
      maxAttempts: finalOptions.retryAttempts,
      baseDelay: finalOptions.retryDelay,
      maxDelay: 30000,
      exponentialBackoff: true
    });

    logger.info(`Created connection pool for ${endpoint}`, {
      maxSockets: finalOptions.maxSockets,
      timeout: finalOptions.timeout,
      retryAttempts: finalOptions.retryAttempts
    });

    return pool;
  }

  /**
   * Execute request with enhanced retry logic and circuit breaker
   */
  async executeWithRetry<T>(
    endpoint: string,
    requestFn: (client: AxiosInstance) => Promise<T>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const pool = this.getPool(endpoint);
    const retryConfig = { ...this.retryConfigs.get(endpoint)!, ...customRetryConfig };
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        // Check circuit breaker
        if (!await this.isHealthy(endpoint) && attempt === 1) {
          logger.warn(`Circuit breaker open for ${endpoint}, attempting anyway`);
        }

        const result = await requestFn(pool);
        
        // Mark as healthy on success
        this.markHealthy(endpoint);
        
        if (attempt > 1) {
          logger.info(`Request succeeded on attempt ${attempt}`, { endpoint });
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // Log the error
        logger.warn(`Request attempt ${attempt}/${retryConfig.maxAttempts} failed`, {
          endpoint,
          error: lastError.message,
          attempt
        });

        // Mark as unhealthy
        this.markUnhealthy(endpoint);
        
        // Don't retry on last attempt
        if (attempt === retryConfig.maxAttempts) {
          break;
        }

        // Calculate delay
        let delay = retryConfig.baseDelay;
        if (retryConfig.exponentialBackoff) {
          delay = Math.min(
            retryConfig.baseDelay * Math.pow(2, attempt - 1),
            retryConfig.maxDelay
          );
        }

        // Add jitter to prevent thundering herd
        delay += Math.random() * 1000;

        logger.debug(`Waiting ${delay}ms before retry ${attempt + 1}`, { endpoint });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`All ${retryConfig.maxAttempts} attempts failed for ${endpoint}: ${lastError?.message}`);
  }

  /**
   * Check if endpoint is healthy (circuit breaker pattern)
   */
  async isHealthy(endpoint: string): Promise<boolean> {
    const status = this.healthStatus.get(endpoint);
    
    if (!status) {
      return true; // Assume healthy if no status
    }

    // If healthy and checked recently, return true
    if (status.healthy && (Date.now() - status.lastCheck < 30000)) {
      return true;
    }

    // If unhealthy, try a quick health check
    if (!status.healthy && (Date.now() - status.lastCheck > 60000)) {
      try {
        const pool = this.getPool(endpoint, { timeout: 5000 });
        
        // Try a simple GET request to check health
        if (endpoint.includes('11434')) {
          await pool.get('/api/tags');
        } else if (endpoint.includes('1234')) {
          await pool.get('/v1/models');
        }
        
        this.markHealthy(endpoint);
        return true;
      } catch {
        this.markUnhealthy(endpoint);
        return false;
      }
    }

    return status.healthy;
  }

  /**
   * Mark endpoint as healthy
   */
  private markHealthy(endpoint: string): void {
    this.healthStatus.set(endpoint, {
      healthy: true,
      lastCheck: Date.now()
    });
  }

  /**
   * Mark endpoint as unhealthy
   */
  private markUnhealthy(endpoint: string): void {
    this.healthStatus.set(endpoint, {
      healthy: false,
      lastCheck: Date.now()
    });
  }

  /**
   * Get health status for all endpoints
   */
  getHealthStatus(): Record<string, { healthy: boolean; lastCheck: number }> {
    const status: Record<string, { healthy: boolean; lastCheck: number }> = {};
    
    for (const [endpoint, health] of this.healthStatus.entries()) {
      status[endpoint] = { ...health };
    }
    
    return status;
  }

  /**
   * Clear connection pools and reset health status
   */
  reset(): void {
    this.pools.clear();
    this.healthStatus.clear();
    this.retryConfigs.clear();
    logger.info('Connection manager reset');
  }

  /**
   * Dispose of all connections
   */
  dispose(): void {
    this.reset();
    logger.info('Connection manager disposed');
  }
}

// Global connection manager instance
export const connectionManager = new ConnectionManager();