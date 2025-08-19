import { UnifiedModelClient } from './client.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { UnifiedAgent } from './agent.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../config/config-manager.js';
export interface CLIContext {
    modelClient: UnifiedModelClient;
    voiceSystem: VoiceArchetypeSystem;
    mcpManager: MCPServerManager;
    config: AppConfig;
    agentOrchestrator?: UnifiedAgent;
    autonomousAgent?: UnifiedAgent;
}
export declare class CLI {
    private context;
    private initialized;
    private workingDirectory;
    private fastModeClient;
    constructor(context: CLIContext);
    /**
     * Display synthesis results
     */
    private displayResults;
    private handleFileOutput;
    /**
     * Main entry point for the CLI
     */
    run(args: string[]): Promise<void>;
    private showHelp;
    private parseOptions;
    private showStatus;
    private listModels;
    private analyzeDirectory;
    private analyzeFile;
    private handleSlashCommand;
    private determineRequestType;
    private processPrompt;
}
export { CLI as CodeCrucibleCLI };
export default CLI;
