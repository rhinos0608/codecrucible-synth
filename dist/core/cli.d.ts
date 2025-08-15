import { LocalModelClient } from './local-model-client.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../config/config-manager.js';
interface CLIOptions {
    voices?: string;
    depth?: string;
    mode?: string;
    file?: string;
    project?: boolean;
    interactive?: boolean;
    council?: boolean;
}
export interface CLIContext {
    modelClient: LocalModelClient;
    voiceSystem: VoiceArchetypeSystem;
    mcpManager: MCPServerManager;
    config: AppConfig;
}
export declare class CodeCrucibleCLI {
    private context;
    constructor(context: CLIContext);
    handleGeneration(prompt: string, options: CLIOptions): Promise<void>;
    handleCouncilMode(prompt: string, options: any): Promise<void>;
    handleVoiceSpecific(voice: string, prompt: string): Promise<void>;
    handleFileOperation(operation: string, filepath: string, options: any): Promise<void>;
    handleProjectOperation(operation: string, options: any): Promise<void>;
    handleInteractiveMode(options: any): Promise<void>;
    handleConfig(options: any): Promise<void>;
    handleModelManagement(options: any): Promise<void>;
    handleVoiceManagement(options: any): Promise<void>;
    showExamples(): void;
    private displayIterativeResults;
    private parseVoices;
    private getProjectContext;
    private buildProjectContext;
    private detectLanguage;
    private displayResults;
    private handleFileOutput;
    private handleInteractiveAction;
    private handleModelSelection;
    private parseValue;
}
export {};
