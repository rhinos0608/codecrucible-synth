export interface LLMProviderConfig {
    provider: 'openai' | 'google' | 'anthropic' | 'ollama';
    apiKey?: string;
    endpoint?: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    enabled: boolean;
}
export interface AppConfig {
    model: {
        endpoint: string;
        name: string;
        timeout: number;
        maxTokens: number;
        temperature: number;
    };
    llmProviders: {
        default: string;
        providers: Record<string, LLMProviderConfig>;
    };
    voices: {
        default: string[];
        available: string[];
        parallel: boolean;
        maxConcurrent: number;
    };
    database: {
        path: string;
        inMemory: boolean;
        enableWAL: boolean;
        backupEnabled: boolean;
        backupInterval: number;
    };
    safety: {
        commandValidation: boolean;
        fileSystemRestrictions: boolean;
        requireConsent: string[];
    };
    terminal: {
        shell: string;
        prompt: string;
        historySize: number;
        colorOutput: boolean;
    };
    vscode: {
        autoActivate: boolean;
        inlineGeneration: boolean;
        showVoicePanel: boolean;
    };
    mcp: {
        servers: {
            filesystem: {
                enabled: boolean;
                restrictedPaths: string[];
                allowedPaths: string[];
            };
            git: {
                enabled: boolean;
                autoCommitMessages: boolean;
                safeModeEnabled: boolean;
            };
            terminal: {
                enabled: boolean;
                allowedCommands: string[];
                blockedCommands: string[];
            };
            packageManager: {
                enabled: boolean;
                autoInstall: boolean;
                securityScan: boolean;
            };
            smithery: {
                enabled: boolean;
                apiKey?: string;
                profile?: string;
                baseUrl?: string;
            };
        };
    };
    performance: {
        responseCache: {
            enabled: boolean;
            maxAge: number;
            maxSize: number;
        };
        voiceParallelism: {
            maxConcurrent: number;
            batchSize: number;
        };
        contextManagement: {
            maxContextLength: number;
            compressionThreshold: number;
            retentionStrategy: string;
        };
    };
    logging: {
        level: string;
        toFile: boolean;
        maxFileSize: string;
        maxFiles: number;
    };
}
export declare class ConfigManager {
    private static instance;
    private config;
    private configPath;
    private defaultConfigPath;
    constructor();
    static load(): Promise<AppConfig>;
    static getInstance(): Promise<ConfigManager>;
    loadConfiguration(): Promise<AppConfig>;
    set(key: string, value: any): Promise<void>;
    get(key: string): Promise<any>;
    reset(): Promise<void>;
    getAll(): AppConfig;
    private saveUserConfig;
    private getHardcodedDefaults;
    /**
     * Encrypt sensitive configuration fields
     */
    private encryptSensitiveFields;
    /**
     * Decrypt sensitive configuration fields
     */
    private decryptSensitiveFields;
    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue;
    /**
     * Set nested value in object using dot notation
     */
    private setNestedValue;
}
