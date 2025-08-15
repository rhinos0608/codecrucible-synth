import { CLIContext } from '../core/cli.js';
export interface ServerOptions {
    port: number;
    host: string;
    cors?: boolean;
    auth?: {
        enabled: boolean;
        token?: string;
    };
}
/**
 * Server Mode for IDE Integration
 *
 * Provides HTTP and WebSocket APIs for IDE extensions and external tools
 * Compatible with VS Code, JetBrains IDEs, and other development environments
 */
export declare function startServerMode(context: CLIContext, options: ServerOptions): Promise<void>;
