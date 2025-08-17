import { CLI } from './core/cli.js';
import { ConfigManager } from './config/config-manager.js';
import { UnifiedModelClient } from './core/client.js';
// import { EnhancedStartupIndexer } from './indexing/enhanced-startup-indexer.js';
import { PerformanceMonitor } from './utils/performance.js';
export async function initializeCLIContext() {
    try {
        const configManager = new ConfigManager();
        const config = await configManager.loadConfiguration();
        // Startup analysis disabled for now
        // if (config.autonomous?.enableStartupAnalysis) {
        //   const indexer = new EnhancedStartupIndexer();
        //   await indexer.performStartupAnalysis();
        // }
        const client = new UnifiedModelClient({
            providers: config.model?.providers || ['ollama'],
            defaultModel: config.model?.name || 'llama2',
            timeout: config.model?.timeout || 30000,
            maxTokens: config.model?.maxTokens || 2048,
            temperature: config.model?.temperature || 0.7
        });
        const performanceMonitor = new PerformanceMonitor();
        return new CLI(client, performanceMonitor);
    }
    catch (error) {
        console.error('Failed to initialize CLI context:', error);
        throw error;
    }
}
export { CLI } from './core/cli.js';
export { UnifiedModelClient } from './core/client.js';
export { ConfigManager } from './config/config-manager.js';
export default initializeCLIContext;
//# sourceMappingURL=index.js.map