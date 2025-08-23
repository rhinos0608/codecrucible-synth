
export interface REPLInterface {
    showStatus(): Promise<void>;
    listModels(): Promise<void>;
    executePromptProcessing(prompt: string, options: any): Promise<string>;
}
