/**
 * Use Case Interfaces - Domain Layer
 * 
 * Defines contracts for application use cases following clean architecture principles.
 * These interfaces define business operations without implementation details.
 */

export interface UseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}

export interface AnalysisRequest {
  filePath?: string;
  directoryPath?: string;
  content?: string;
  options?: {
    depth?: number;
    includeTests?: boolean;
    includeDocumentation?: boolean;
    focusAreas?: string[];
    outputFormat?: 'text' | 'json' | 'structured';
  };
}

export interface AnalysisResponse {
  success: boolean;
  analysis: {
    summary: string;
    insights: string[];
    recommendations: string[];
    codeQuality?: {
      score: number;
      issues: string[];
      suggestions: string[];
    };
    structure?: {
      files: number;
      classes: number;
      functions: number;
      dependencies: string[];
    };
  };
  metadata: {
    duration: number;
    linesAnalyzed?: number;
    filesAnalyzed?: number;
  };
  error?: string;
}

export interface GenerationRequest {
  prompt: string;
  context?: {
    projectType?: string;
    language?: string;
    framework?: string;
    existingFiles?: string[];
  };
  options?: {
    includeTests?: boolean;
    includeDocumentation?: boolean;
    codeStyle?: 'functional' | 'object-oriented' | 'mixed';
    outputFiles?: string[];
    dryRun?: boolean;
  };
}

export interface GenerationResponse {
  success: boolean;
  generated: {
    files: Array<{
      path: string;
      content: string;
      type: 'source' | 'test' | 'documentation' | 'config';
    }>;
    summary: string;
    changes?: string[];
  };
  metadata: {
    duration: number;
    tokensGenerated?: number;
    filesCreated: number;
  };
  error?: string;
}

// Use Case Interfaces
export interface IAnalyzeFileUseCase extends UseCase<AnalysisRequest, AnalysisResponse> {}

export interface IAnalyzeDirectoryUseCase extends UseCase<AnalysisRequest, AnalysisResponse> {}

export interface IGenerateCodeUseCase extends UseCase<GenerationRequest, GenerationResponse> {}