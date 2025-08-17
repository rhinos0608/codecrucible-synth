import { SynthesisResponse } from './types.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../config/config-manager.js';
import { ExecutionResponse } from './types.js';
interface CLIOptions {
    voices?: string | string[];
    depth?: string;
    mode?: string;
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
}
export interface CLIContext {
    modelClient: LocalModelClient;
    voiceSystem: VoiceArchetypeSystem;
    mcpManager: MCPServerManager;
    config: AppConfig;
    agentOrchestrator?: AgentOrchestrator;
    autonomousAgent?: AutonomousClaudeAgent;
    multiLLMProvider?: MultiLLMProvider;
    ragSystem?: RAGSystem;
}
export declare class CLI {
    private context;
    private initialized;
    private workingDirectory;
    private fastModeClient;
    constructor(context: CLIContext);
    /**
     * Initialize the CLI with configuration and working directory
     * Required by integration tests
     */
    initialize(config: AppConfig, workingDirectory: string): Promise<void>;
    /**
     * Initialize fast mode for immediate usage (bypasses heavy initialization)
     */
    initializeFastMode(workingDirectory?: string): Promise<void>;
    /**
     * Process a prompt and return the result
     * Required by integration tests
     */
    processPrompt(prompt: string, options?: CLIOptions): Promise<string>;
    /**
     * Update configuration
     * Required by integration tests
     */
    updateConfiguration(newConfig: Partial<AppConfig>): boolean;
    /**
     * Configure CLI output based on options
     */
    configureOutput(options: CLIOptions): void;
    handleGeneration(prompt: string, options: CLIOptions): Promise<void>;
    handleCouncilMode(prompt: string, options: any): Promise<void>;
    handleVoiceSpecific(voice: string, prompt: string): Promise<void>;
    handleFileOperation(operation: string, filepath: string, options: any): Promise<void>;
    handleProjectOperation(operation: string, options: any): Promise<void>;
    handleInteractiveMode(options: any): Promise<void>;
    handleConfig(options: any): Promise<void>;
    handleModelManagement(options: any): Promise<void>;
    handleVoiceManagement(options: any): Promise<void>;
    handleVRAMManagement(options: any): Promise<void>;
    handleEditManagement(options: any): Promise<void>;
    showExamples(): void;
    /**
     * Handle autonomous agentic mode processing
     */
    handleAgenticMode(prompt: string, options: CLIOptions): Promise<void>;
    private displayIterativeResults;
    private parseVoices;
    private getProjectContext;
    private buildProjectContext;
    private detectLanguage;
    private displayResults;
    private handleFileOutput;
    private handleInteractiveAction;
    private handleModelSelection;
    private extractMentionedFiles;
    private parseValue;
    /**
     * Handle direct mode for simple file operations - provides immediate, specific responses
     */
    private handleDirectMode;
    /**
     * Handle direct file listing with specific, useful output
     */
    private handleDirectFileList;
    /**
     * Handle direct file reading with context
     */
    private handleDirectFileRead;
    /**
     * Handle direct project structure overview
     */
    private handleDirectProjectStructure;
    /**
     * Check if prompt is a simple file operation that can be handled directly
     */
    private isSimpleFileOperation;
    /**
     * Extract directory name from prompt
     */
    private extractDirectoryFromPrompt;
    /**
     * Get appropriate icon for file extension
     */
    private getFileIcon;
    /**
     * Generate insights about directory contents
     */
    private generateDirectoryInsights;
    /**
     * Analyze file content and provide insights
     */
    private analyzeFileContent;
    /**
     * Get file purpose description
     */
    private getFilePurpose;
    /**
     * Generate project-level insights
     */
    private generateProjectInsights;
    /**
     * Handle VRAM optimization commands and diagnostics
     */
    private handleVRAMOptimization;
    /**
     * Show VRAM status and system information
     */
    private showVRAMStatus;
    /**
     * Optimize current model for VRAM
     */
    private optimizeCurrentModel;
    /**
     * Configure VRAM optimization settings
     */
    private configureVRAMSettings;
    /**
     * Test model with VRAM optimization
     */
    private testModelWithVRAM;
    /**
     * Show optimal models for current system
     */
    private showOptimalModels;
    /**
     * Handle autonomous Claude agent processing and return the result content
     * Used by processPrompt for autonomous mode
     */
    private handleAutonomousWithReturn;
    /**
     * Handle fast mode processing with return value
     */
    private handleFastModeWithReturn;
    private isCommandRequest;
    private handleFastCommand;
    private extractCommandFromPrompt;
    private handleFastCodeGeneration;
    private readFileContent;
    /**
     * Handle agentic mode and return the result content
     * Used by processPrompt for testing
     */
    private handleAgenticModeWithReturn;
    /**
     * Handle Living Spiral methodology and return the result content
     * Used by processPrompt for spiral mode
     */
    private handleLivingSpiralWithReturn;
    /**
     * Handle generation mode and return the result content
     * Used by processPrompt for testing
     */
    private handleGenerationWithReturn;
    /**
     * Handle direct mode and return the result content
     * Used by processPrompt for testing
     */
    private handleDirectModeWithReturn;
    /**
     * Process prompt with standardized response format
     * Returns ExecutionResponse or SynthesisResponse objects
     */
    processPromptWithResponse(prompt: string, options?: CLIOptions): Promise<ExecutionResponse | SynthesisResponse>;
    /**
     * Handle agentic mode with standardized response
     */
    private handleAgenticModeWithResponse;
    /**
     * Handle generation mode with standardized response
     */
    private handleGenerationWithResponse;
    /**
     * Handle direct mode with standardized response
     */
    private handleDirectModeWithResponse;
    /**
     * Handle execution backend management commands
     */
    handleExecutionBackendCommand(options: any): Promise<void>;
}
export { CLI as CodeCrucibleCLI };
export default CLI;
