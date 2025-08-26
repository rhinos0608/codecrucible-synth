/**
 * Integration Guide for Unified Architecture
 * 
 * PURPOSE: Provide code examples and guidance for integrating with the
 * unified dependency injection architecture and resource coordination system
 * 
 * ADDRESSES: 
 * - Developer onboarding with new architecture
 * - Migration patterns from legacy systems
 * - Best practices for service integration
 */

import { 
  container,
  SERVICE_TOKENS,
  ServiceToken,
  ServiceRegistration,
  ServiceFactory,
  resolveService,
  registerService
} from '../di/unified-dependency-container.js';

import {
  resourceCoordinator,
  requestResource,
  releaseResource,
  ResourceAccessRequest,
  ResourceLock
} from '../coordination/resource-coordination-manager.js';

import {
  IBaseService,
  ICacheService,
  IConfigurationService,
  IModelSelectionService,
  IVoiceOrchestrationService,
  ServiceHealth,
  ServiceMetrics
} from '../contracts/service-contracts.js';

import { logger } from '../logger.js';

/**
 * EXAMPLE 1: Creating a New Service with Proper DI Integration
 */

// Step 1: Define your service interface extending IBaseService
export interface IMyCustomService extends IBaseService {
  processRequest(data: any): Promise<any>;
  getProcessingStats(): { totalRequests: number; successRate: number };
}

// Step 2: Implement the service with proper contract compliance
export class MyCustomService implements IMyCustomService {
  readonly serviceName = 'MyCustomService';
  readonly version = '1.0.0';
  readonly category = 'domain';
  
  private totalRequests = 0;
  private successfulRequests = 0;
  private startTime = Date.now();
  
  // Injected dependencies
  private cacheService: ICacheService;
  private configService: IConfigurationService;
  
  constructor(
    cacheService: ICacheService,
    configService: IConfigurationService
  ) {
    this.cacheService = cacheService;
    this.configService = configService;
  }
  
  async initialize(): Promise<void> {
    logger.info('🚀 Initializing MyCustomService');
    // Initialization logic here
  }
  
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up MyCustomService');
    // Cleanup logic here
  }
  
  getHealth(): ServiceHealth {
    const uptime = Date.now() - this.startTime;
    const errorRate = this.totalRequests > 0 
      ? (this.totalRequests - this.successfulRequests) / this.totalRequests 
      : 0;
    
    return {
      status: errorRate < 0.1 ? 'healthy' : 'degraded',
      lastChecked: new Date(),
      uptime,
      details: {
        totalRequests: this.totalRequests,
        successRate: this.successfulRequests / Math.max(this.totalRequests, 1),
        errorRate
      }
    };
  }
  
  getMetrics(): ServiceMetrics {
    return {
      requestCount: this.totalRequests,
      averageResponseTime: 150, // Would calculate actual average
      errorRate: (this.totalRequests - this.successfulRequests) / Math.max(this.totalRequests, 1),
      lastResetTime: new Date(this.startTime),
      customMetrics: {
        processingSuccessRate: this.successfulRequests / Math.max(this.totalRequests, 1)
      }
    };
  }
  
  async processRequest(data: any): Promise<any> {
    this.totalRequests++;
    
    try {
      // Use cache service
      const cacheKey = `request_${JSON.stringify(data)}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        this.successfulRequests++;
        return cached;
      }
      
      // Process request
      const result = await this.doProcessing(data);
      
      // Cache result
      await this.cacheService.set(cacheKey, result, { ttl: 300000 });
      
      this.successfulRequests++;
      return result;
      
    } catch (error) {
      logger.error('MyCustomService processing failed:', error);
      throw error;
    }
  }
  
  getProcessingStats(): { totalRequests: number; successRate: number } {
    return {
      totalRequests: this.totalRequests,
      successRate: this.successfulRequests / Math.max(this.totalRequests, 1)
    };
  }
  
  private async doProcessing(data: any): Promise<any> {
    // Actual processing logic
    return { processed: data, timestamp: Date.now() };
  }
}

// Step 3: Create a service factory
export class MyCustomServiceFactory implements ServiceFactory<IMyCustomService> {
  async create(dependencies: Map<string, any>): Promise<IMyCustomService> {
    const cacheService = dependencies.get(SERVICE_TOKENS.CACHE_SERVICE.name) as ICacheService;
    const configService = dependencies.get(SERVICE_TOKENS.CONFIG_SERVICE.name) as IConfigurationService;
    
    if (!cacheService || !configService) {
      throw new Error('MyCustomService requires CacheService and ConfigService');
    }
    
    return new MyCustomService(cacheService, configService);
  }
}

// Step 4: Register your service
export const MY_CUSTOM_SERVICE_TOKEN = new ServiceToken<IMyCustomService>('MyCustomService');

export function registerMyCustomService(): void {
  const registration: ServiceRegistration<IMyCustomService> = {
    token: MY_CUSTOM_SERVICE_TOKEN,
    factory: new MyCustomServiceFactory(),
    lifecycle: 'singleton',
    dependencies: [SERVICE_TOKENS.CACHE_SERVICE, SERVICE_TOKENS.CONFIG_SERVICE],
    metadata: {
      description: 'Custom service demonstrating proper DI integration',
      category: 'domain',
      priority: 60,
      healthCheckInterval: 45000
    }
  };
  
  registerService(registration);
}

/**
 * EXAMPLE 2: Using Services in Application Code
 */

export class ApplicationController {
  private modelSelectionService: IModelSelectionService | null = null;
  private voiceOrchestrationService: IVoiceOrchestrationService | null = null;
  private customService: IMyCustomService | null = null;
  
  async initialize(): Promise<void> {
    // Resolve services from DI container
    this.modelSelectionService = await resolveService(SERVICE_TOKENS.MODEL_SELECTION_SERVICE);
    this.voiceOrchestrationService = await resolveService(SERVICE_TOKENS.VOICE_ORCHESTRATION_SERVICE);
    this.customService = await resolveService(MY_CUSTOM_SERVICE_TOKEN);
    
    logger.info('✅ ApplicationController initialized with all dependencies');
  }
  
  async processUserRequest(request: any): Promise<any> {
    if (!this.modelSelectionService || !this.voiceOrchestrationService || !this.customService) {
      throw new Error('Services not initialized');
    }
    
    try {
      // Use services through their interfaces
      const modelSelection = await this.modelSelectionService.selectModel({
        taskType: 'general',
        requirements: { capabilities: ['text-generation'] }
      });
      
      const voiceSelection = await this.voiceOrchestrationService.selectVoices({
        taskType: 'analysis',
        requirements: { expertise: ['analysis'] }
      });
      
      const customResult = await this.customService.processRequest(request);
      
      return {
        model: modelSelection,
        voices: voiceSelection,
        customProcessing: customResult
      };
      
    } catch (error) {
      logger.error('Request processing failed:', error);
      throw error;
    }
  }
}

/**
 * EXAMPLE 3: Resource Coordination Usage
 */

export class ResourceAwareService implements IBaseService {
  readonly serviceName = 'ResourceAwareService';
  readonly version = '1.0.0';
  readonly category = 'infrastructure';
  
  private startTime = Date.now();
  
  getHealth(): ServiceHealth {
    return {
      status: 'healthy',
      lastChecked: new Date(),
      uptime: Date.now() - this.startTime
    };
  }
  
  getMetrics(): ServiceMetrics {
    return {
      requestCount: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastResetTime: new Date(this.startTime)
    };
  }
  
  async performCacheOperation(data: any): Promise<any> {
    // Request access to cache resource
    const resourceRequest: ResourceAccessRequest = {
      id: `cache_op_${Date.now()}`,
      requesterId: this.serviceName,
      resourceId: 'unified_cache_memory',
      accessType: 'write',
      priority: 'user',
      timeoutMs: 10000
    };
    
    let resourceLock: ResourceLock | null = null;
    
    try {
      // Acquire resource lock
      resourceLock = await requestResource(resourceRequest);
      logger.debug(`🔓 Acquired cache resource lock: ${resourceLock.id}`);
      
      // Perform cache operation
      const result = await this.doCacheOperation(data);
      
      return result;
      
    } catch (error) {
      logger.error('Cache operation failed:', error);
      throw error;
      
    } finally {
      // Always release resource lock
      if (resourceLock) {
        await releaseResource(resourceLock);
        logger.debug(`🔒 Released cache resource lock: ${resourceLock.id}`);
      }
    }
  }
  
  private async doCacheOperation(data: any): Promise<any> {
    // Simulate cache operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return { cached: data, timestamp: Date.now() };
  }
}

/**
 * EXAMPLE 4: Migration from Legacy Systems
 */

// Legacy service interface (before unified architecture)
interface LegacyVoiceService {
  selectVoice(criteria: any): any;
  processWithVoice(voice: any, input: string): Promise<string>;
}

// Migration adapter that bridges legacy code to new architecture
export class LegacyVoiceServiceAdapter implements LegacyVoiceService {
  private voiceOrchestrationService: IVoiceOrchestrationService | null = null;
  
  async initialize(): Promise<void> {
    // Resolve new service through DI
    this.voiceOrchestrationService = await resolveService(SERVICE_TOKENS.VOICE_ORCHESTRATION_SERVICE);
  }
  
  selectVoice(criteria: any): any {
    if (!this.voiceOrchestrationService) {
      throw new Error('Adapter not initialized');
    }
    
    // Adapt legacy interface to new service interface
    return this.voiceOrchestrationService.selectVoices({
      taskType: criteria.taskType || 'general',
      requirements: {
        expertise: criteria.expertise || [],
        complexity: criteria.complexity || 'medium'
      }
    });
  }
  
  async processWithVoice(voice: any, input: string): Promise<string> {
    if (!this.voiceOrchestrationService) {
      throw new Error('Adapter not initialized');
    }
    
    // Adapt to new multi-voice interface
    const result = await this.voiceOrchestrationService.orchestrateMultiVoice({
      prompt: input,
      voices: [voice],
      synthesisMode: 'sequential'
    });
    
    return result.synthesis;
  }
}

/**
 * EXAMPLE 5: Testing with Mock Services
 */

export class MockCacheService implements ICacheService {
  readonly serviceName = 'MockCacheService';
  readonly version = '1.0.0';
  readonly category = 'core';
  
  private cache = new Map<string, any>();
  private startTime = Date.now();
  
  getHealth(): ServiceHealth {
    return {
      status: 'healthy',
      lastChecked: new Date(),
      uptime: Date.now() - this.startTime
    };
  }
  
  getMetrics(): ServiceMetrics {
    return {
      requestCount: this.cache.size,
      averageResponseTime: 1,
      errorRate: 0,
      lastResetTime: new Date(this.startTime)
    };
  }
  
  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
  }
  
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
  
  async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const value = this.cache.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    return result;
  }
  
  async setMultiple<T>(entries: Map<string, T>): Promise<void> {
    for (const [key, value] of entries) {
      this.cache.set(key, value);
    }
  }
  
  getCacheStats() {
    return {
      size: this.cache.size,
      hitRate: 0.85,
      memoryUsage: this.cache.size * 100,
      evictionCount: 0
    };
  }
  
  async evictExpired(): Promise<number> {
    return 0;
  }
}

// Test setup function
export async function setupTestEnvironment(): Promise<void> {
  // Register mock services for testing
  const mockCacheFactory: ServiceFactory<ICacheService> = {
    async create(): Promise<ICacheService> {
      return new MockCacheService();
    }
  };
  
  const mockRegistration: ServiceRegistration<ICacheService> = {
    token: SERVICE_TOKENS.CACHE_SERVICE,
    factory: mockCacheFactory,
    lifecycle: 'singleton',
    dependencies: [],
    metadata: {
      description: 'Mock cache service for testing',
      category: 'core',
      priority: 100
    }
  };
  
  registerService(mockRegistration);
}

/**
 * INTEGRATION BEST PRACTICES
 */

export const INTEGRATION_BEST_PRACTICES = {
  serviceDesign: [
    'Always extend IBaseService for proper contract compliance',
    'Implement health checks that reflect actual service state',
    'Use dependency injection instead of direct imports',
    'Make services stateless where possible',
    'Use async/await for all service operations'
  ],
  
  resourceManagement: [
    'Always acquire resource locks before accessing shared resources',
    'Use try/finally blocks to ensure resource locks are released',
    'Set appropriate timeouts for resource requests',
    'Monitor resource contention and optimize accordingly',
    'Use priority levels to ensure critical operations get resources first'
  ],
  
  errorHandling: [
    'Let the unified error service handle error recovery',
    'Provide meaningful error context in service methods',
    'Use structured errors with appropriate severity levels',
    'Implement graceful degradation for non-critical failures',
    'Monitor error rates through service health metrics'
  ],
  
  testing: [
    'Use mock services that implement proper contracts',
    'Test service initialization and cleanup lifecycle',
    'Validate dependency injection configuration',
    'Test resource coordination under contention scenarios',
    'Verify service health and metrics accuracy'
  ],
  
  migration: [
    'Create adapter classes to bridge legacy interfaces',
    'Migrate services incrementally rather than all at once',
    'Maintain backward compatibility during migration',
    'Use feature flags to control new architecture adoption',
    'Monitor performance during migration to catch regressions'
  ]
} as const;

/**
 * COMMON INTEGRATION PATTERNS
 */

// Pattern 1: Service with external API dependency
export async function createServiceWithExternalAPI(): Promise<void> {
  // Resource coordination for external API rate limiting
  const apiRequest: ResourceAccessRequest = {
    id: `api_${Date.now()}`,
    requesterId: 'MyService',
    resourceId: 'external_api',
    accessType: 'read',
    priority: 'user',
    timeoutMs: 15000
  };
  
  const lock = await requestResource(apiRequest);
  try {
    // Make API call
  } finally {
    await releaseResource(lock);
  }
}

// Pattern 2: Service with caching
export async function serviceWithCaching<T>(
  cacheKey: string,
  dataFetcher: () => Promise<T>,
  ttlMs = 300000
): Promise<T> {
  const cacheService = await resolveService(SERVICE_TOKENS.CACHE_SERVICE);
  
  // Try cache first
  const cached = await cacheService.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch data
  const data = await dataFetcher();
  
  // Cache result
  await cacheService.set(cacheKey, data, { ttl: ttlMs });
  
  return data;
}

// Pattern 3: Service health monitoring
export function monitorServiceHealth(service: IBaseService): void {
  setInterval(() => {
    const health = service.getHealth();
    
    if (health.status !== 'healthy') {
      logger.warn(`⚠️ Service health issue: ${service.serviceName}`, {
        status: health.status,
        details: health.details
      });
    }
  }, 30000);
}

logger.info('📚 Integration Guide loaded - ready for unified architecture development');

export default {
  INTEGRATION_BEST_PRACTICES,
  examples: {
    MyCustomService,
    ApplicationController,
    ResourceAwareService,
    LegacyVoiceServiceAdapter,
    MockCacheService
  },
  patterns: {
    serviceWithCaching,
    monitorServiceHealth,
    createServiceWithExternalAPI
  },
  testing: {
    setupTestEnvironment
  }
};