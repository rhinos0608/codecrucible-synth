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
    private streamingClient;
    private contextAwareCLI;
    private optimizedContextCLI;
    private resilientWrapper;
    private dualAgentSystem;
    private autoConfigurator;
    private logger;
    constructor(context: CLIContext);
    /**
     * Display synthesis results
     */
    private displayResults;
    /**
     * Display streaming responses in real-time
     */
    private displayStreamingResponse;
    private handleFileOutput;
    /**
     * Initialize context-aware CLI features (optimized)
     */
    private initializeContextAwareness;
    /**
     * Main entry point for the CLI
     */
    run(args: string[]): Promise<void>;
    private executeMainCLI;
    private showHelp;
    private parseOptions;
    private showStatus;
    private listModels;
    private showModelRecommendations;
    private getModelPerformance;
    private analyzeDirectory;
    private analyzeFile;
    private handleSlashCommand;
    private determineRequestType;
    private processPrompt;
    private executePromptProcessing;
    /**
     * Show comprehensive project intelligence
     */
    private showProjectIntelligence;
    /**
     * Show smart suggestions for current context
     */
    private showSmartSuggestions;
    /**
     * Display command suggestions in a formatted way
     */
    private displayCommandSuggestions;
    /**
     * Execute dual-agent code generation
     */
    private executeDualAgentGeneration;
    /**
     * Execute streaming dual-agent generation
     */
    private executeStreamingDualAgent;
    /**
     * Initialize dual-agent system with auto-configuration
     */
    private initializeDualAgentSystem;
    /**
     * Execute code audit
     */
    private executeCodeAudit;
    /**
     * Display system status
     */
    private displaySystemStatus;
}
export { CLI as CodeCrucibleCLI };
export default CLI;
