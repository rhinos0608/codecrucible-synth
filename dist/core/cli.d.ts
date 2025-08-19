import { UnifiedModelClient } from './client.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { UnifiedAgent } from './agent.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../config/config-manager.js';
interface CLIOptions {
    voices?: string | string[];
    depth?: string;
    mode?: 'competitive' | 'collaborative' | 'consensus' | 'iterative' | 'agentic' | 'comprehensive' | 'analysis';
    file?: string;
    project?: boolean;
    interactive?: boolean;
    spiral?: boolean;
    spiralIterations?: number;
    spiralQuality?: number;
    autonomous?: boolean;
    maxSteps?: number;
    council?: boolean;
    agentic?: boolean;
    quick?: boolean;
    direct?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    output?: 'text' | 'json' | 'table';
    timeout?: number;
    backend?: 'docker' | 'e2b' | 'local_e2b' | 'local_process' | 'firecracker' | 'podman' | 'auto';
    e2bTemplate?: string;
    dockerImage?: string;
    fast?: boolean;
    skipInit?: boolean;
    iterative?: boolean;
    maxIterations?: string;
    qualityThreshold?: string;
    stream?: boolean;
    noStream?: boolean;
    enableIntelligence?: boolean;
    contextAware?: boolean;
    smartSuggestions?: boolean;
    projectAnalysis?: boolean;
    dualAgent?: boolean;
    realtimeAudit?: boolean;
    autoFix?: boolean;
    streamGeneration?: boolean;
    writerModel?: string;
    auditorModel?: string;
    status?: boolean;
    optimize?: boolean;
    test?: boolean;
    models?: boolean;
    configure?: boolean;
    server?: boolean;
    port?: string;
    [key: string]: unknown;
}
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
    /**
     * Process prompt and return response (for testing)
     */
    processPrompt(prompt: string, options?: CLIOptions): Promise<string>;
    private processPromptInternal;
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
    /**
     * Initialize CLI with configuration and working directory
     */
    initialize(config?: any, workingDirectory?: string): Promise<void>;
    /**
     * Handle code generation requests
     */
    handleGeneration(prompt: string, options?: CLIOptions): Promise<void>;
    /**
     * Handle file analysis requests
     */
    handleAnalyze(files?: string[], options?: CLIOptions): Promise<void>;
    /**
     * Analyze a specific target (file or directory)
     */
    private analyzeTarget;
    /**
     * Get list of analyzable files in directory
     */
    private getAnalyzableFiles;
    /**
     * Clean up CLI resources
     */
    destroy(): Promise<void>;
    /**
     * Update CLI configuration (for testing)
     */
    updateConfiguration(newConfig: any): Promise<boolean>;
    /**
     * Legacy compatibility methods for existing tests
     */
    checkOllamaStatus(): Promise<boolean>;
    getAllAvailableModels(): Promise<any[]>;
    getAvailableModels(): Promise<any[]>;
    getBestAvailableModel(): Promise<string>;
    pullModel(name: string): Promise<boolean>;
}
export { CLI as CodeCrucibleCLI };
export default CLI;
