
declare module 'codecrucible-synth' {
  export interface CodeGenerationResult {
    code: string;
    analysis: string;
    model: string;
    timestamp: string;
  }

  export interface AnalysisResult {
    overview: any;
    suggestions: string[];
    architecture: string;
  }

  export class CodeCrucibleClient {
    constructor(config?: any);
    generate(prompt: string): Promise<CodeGenerationResult>;
    checkOllamaStatus(): Promise<boolean>;
    getAvailableModels(): Promise<string[]>;
    checkStatus(): Promise<any>;
  }

  export class UnifiedModelClient extends CodeCrucibleClient {
    troubleshootConnection(): Promise<any>;
    generateWithContext(prompt: string, context?: any): Promise<CodeGenerationResult>;
    analyzeCodebase(directory?: string): Promise<AnalysisResult>;
  }

  export default CodeCrucibleClient;
}
