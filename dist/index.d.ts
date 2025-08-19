import { CLI, CLIContext } from './core/cli.js';
export declare function initializeCLIContext(): Promise<{
    cli: CLI;
    context: CLIContext;
}>;
export { CLI } from './core/cli.js';
export { UnifiedModelClient } from './core/client.js';
export { ConfigManager } from './config/config-manager.js';
export declare function main(): Promise<void>;
export default initializeCLIContext;
