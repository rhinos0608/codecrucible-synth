import { LocalModelClient } from './local-model-client.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../config/config-manager.js';
import { AgentOrchestrator } from './agent-orchestrator.js';
import { MultiLLMProvider } from './multi-llm-provider.js';
import { RAGSystem } from './rag-system.js';
interface CLIOptions {
    voices?: string;
    depth?: string;
    mode?: string;
    file?: string;
    project?: boolean;
    interactive?: boolean;
    council?: boolean;
    agentic?: boolean;
    autonomous?: boolean;
    quick?: boolean;
    direct?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    output?: 'text' | 'json' | 'table';
    timeout?: number;
}
export interface CLIContext {
    modelClient: LocalModelClient;
    voiceSystem: VoiceArchetypeSystem;
    mcpManager: MCPServerManager;
    config: AppConfig;
    agentOrchestrator?: AgentOrchestrator;
    multiLLMProvider?: MultiLLMProvider;
    ragSystem?: RAGSystem;
}
export declare class CodeCrucibleCLI {
    private context;
    constructor(context: CLIContext);
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
}
export {};
