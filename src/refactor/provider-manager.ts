
import { logger } from '../core/logger.js';
import { ProviderRepository, ProviderType, IProviderRepository, ProviderConfig } from '../core/providers/provider-repository.js';

export class ProviderManager {
    private providerRepository: IProviderRepository;

    constructor() {
        this.providerRepository = new ProviderRepository();
    }

    async initialize(): Promise<void> {
        // Initialize with empty providers array if none specified
        await this.initializeProviders([]);
    }

    async initializeProviders(providers: ProviderConfig[]): Promise<void> {
        logger.info('Starting background provider initialization');
        const startTime = Date.now();
    
        // Track initialization state
        const initResults = new Map<string, { success: boolean; error?: Error; duration: number }>();
    
        // Initialize providers with parallel execution and timeout handling
        const initPromises = providers.map(async providerConfig => {
          const providerStartTime = Date.now();
          try {
            logger.debug('Initializing provider', { type: providerConfig.type });
    
            // Add timeout for individual provider initialization
            const initTimeout = 10000; // 10 second timeout per provider
            const provider = await Promise.race([
              this.createProvider(providerConfig),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Provider ${providerConfig.type} initialization timeout`)),
                  initTimeout
                )
              ),
            ]);
    
            await this.providerRepository.initialize([providerConfig]);
            const duration = Date.now() - providerStartTime;
    
            initResults.set(providerConfig.type, { success: true, duration });
            logger.info('Provider initialized', { type: providerConfig.type, duration });
    
            // Emit individual provider ready event
            // this.emit('provider-ready', { type: providerConfig.type, provider, duration });
    
            return { type: providerConfig.type, success: true, duration };
          } catch (error) {
            const duration = Date.now() - providerStartTime;
            const errorObj = error instanceof Error ? error : new Error(String(error));
    
            initResults.set(providerConfig.type, { success: false, error: errorObj, duration });
            logger.warn('Provider failed', {
              type: providerConfig.type,
              duration,
              error: errorObj.message,
            });
    
            // Emit provider failure event
            // this.emit('provider-failed', { type: providerConfig.type, error: errorObj, duration });
    
            return { type: providerConfig.type, success: false, error: errorObj, duration };
          }
        });
    
        // Wait for all providers to complete (success or failure)
        await Promise.allSettled(initPromises);
    
        const totalDuration = Date.now() - startTime;
        const successCount = this.providerRepository.getAvailableProviders().size;
        const totalCount = providers.length;
    
        logger.info('Provider initialization completed', {
          successful: successCount,
          total: totalCount,
          duration: totalDuration,
        });
    
        // Log detailed results
        for (const [providerType, result] of initResults) {
          if (result.success) {
            logger.info(`✅ Provider ${providerType} ready (${result.duration}ms)`);
          } else {
            logger.warn(
              `❌ Provider ${providerType} failed (${result.duration}ms):`,
              result.error?.message
            );
          }
        }
    
        if (this.providerRepository.getAvailableProviders().size === 0) {
          logger.warn('⚠️ No providers successfully initialized. CLI will run in degraded mode.');
          throw new Error('No providers available');
        } else if (this.providerRepository.getAvailableProviders().size < totalCount) {
          logger.warn(
            `⚠️ Only ${successCount}/${totalCount} providers initialized. Some features may be limited.`
          );
        }
    }

    private async createProvider(config: ProviderConfig): Promise<any> {
        switch (config.type) {
          case 'ollama': {
            const { OllamaProvider } = await import('../providers/ollama.js');
            return new (OllamaProvider as any)(config);
          }
    
          case 'lm-studio': {
            const { LMStudioProvider } = await import('../providers/lm-studio.js');
            return new (LMStudioProvider as any)(config);
          }
    
          case 'huggingface': {
            // HuggingFace provider is not yet implemented - fallback to Ollama
            logger.warn('HuggingFace provider not implemented, falling back to Ollama');
            const { OllamaProvider: HFOllamaProvider } = await import('../providers/ollama.js');
            return new (HFOllamaProvider as any)({ ...config, type: 'ollama' });
          }
    
          default:
            throw new Error(`Unknown provider type: ${config.type}`);
        }
    }

    public selectProvider(model?: string): ProviderConfig | null {
        // Select provider based on model or availability
        if (model) {
          for (const [, provider] of this.providerRepository.getAvailableProviders()) {
            if (provider.supportsModel && provider.supportsModel(model)) {
              return provider;
            }
          }
        }
    
        // Return first available provider
        return this.providerRepository.getAvailableProviders().values().next().value;
    }

    public getProviders(): Map<string, any> {
        return this.providerRepository.getAvailableProviders();
    }

    public getProviderRepository(): IProviderRepository {
        return this.providerRepository;
    }
}
