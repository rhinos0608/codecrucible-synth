/**
 * Standardized Response System for CodeCrucible
 * 
 * This module provides consistent response interfaces across all components
 * ensuring type safety and predictable data structures.
 */

/**
 * Base response interface that all responses should extend
 */
export interface BaseResponse {
  success: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Standard error information
 */
export interface ErrorInfo {
  code: string;
  message: string;
  details?: string;
  stack?: string;
}

/**
 * Agent response with consistent structure
 */
export interface AgentResponse extends BaseResponse {
  content: string;
  confidence: number;
  reasoning?: string;
  voiceId?: string;
  tokensUsed?: number;
  error?: ErrorInfo;
}

/**
 * Multi-voice synthesis response
 */
export interface SynthesisResponse extends BaseResponse {
  combinedContent: string;
  reasoning: string;
  confidence: number;
  qualityScore: number;
  voicesUsed: string[];
  synthesisMode: string;
  individualResponses?: AgentResponse[];
  error?: ErrorInfo;
}

/**
 * Tool execution response
 */
export interface ToolResponse extends BaseResponse {
  toolName: string;
  result?: any;
  executionTime: number;
  retryCount: number;
  error?: ErrorInfo;
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * File operation response
 */
export interface FileResponse extends BaseResponse {
  filePath: string;
  operation: 'read' | 'write' | 'delete' | 'analyze';
  content?: string;
  size?: number;
  language?: string;
  error?: ErrorInfo;
}

/**
 * Project analysis response
 */
export interface ProjectResponse extends BaseResponse {
  projectPath: string;
  fileCount: number;
  totalSize: number;
  languages: string[];
  structure: Record<string, any>;
  analysis?: string;
  recommendations?: string[];
  error?: ErrorInfo;
}

/**
 * Model operation response
 */
export interface ModelResponse extends BaseResponse {
  modelName: string;
  operation: 'generate' | 'analyze' | 'optimize' | 'configure';
  result?: any;
  performance?: {
    tokensPerSecond: number;
    memoryUsage: number;
    gpuUtilization?: number;
  };
  error?: ErrorInfo;
}

/**
 * Configuration response
 */
export interface ConfigResponse extends BaseResponse {
  operation: 'get' | 'set' | 'validate' | 'migrate';
  config?: Record<string, any>;
  changes?: Record<string, any>;
  validationErrors?: string[];
  error?: ErrorInfo;
}

/**
 * Search response (for MCP tools, file search, etc.)
 */
export interface SearchResponse extends BaseResponse {
  query: string;
  resultCount: number;
  results: Array<{
    title: string;
    content: string;
    url?: string;
    score?: number;
    metadata?: Record<string, any>;
  }>;
  totalTime: number;
  error?: ErrorInfo;
}

/**
 * Response factory for creating standardized responses
 */
export class ResponseFactory {
  
  static createSuccess<T extends BaseResponse>(
    type: new () => T,
    data: Partial<T>
  ): T {
    const response = new type();
    Object.assign(response, {
      success: true,
      timestamp: Date.now(),
      ...data
    });
    return response;
  }

  static createError<T extends BaseResponse>(
    type: new () => T,
    error: ErrorInfo,
    data?: Partial<T>
  ): T {
    const response = new type();
    Object.assign(response, {
      success: false,
      timestamp: Date.now(),
      error,
      ...data
    });
    return response;
  }

  static createAgentResponse(content: string, options: {
    confidence?: number;
    reasoning?: string;
    voiceId?: string;
    tokensUsed?: number;
  } = {}): AgentResponse {
    return {
      success: true,
      timestamp: Date.now(),
      content,
      confidence: options.confidence || 0.8,
      reasoning: options.reasoning,
      voiceId: options.voiceId,
      tokensUsed: options.tokensUsed
    };
  }

  static createSynthesisResponse(
    combinedContent: string,
    voicesUsed: string[],
    options: {
      reasoning?: string;
      confidence?: number;
      qualityScore?: number;
      synthesisMode?: string;
      individualResponses?: AgentResponse[];
    } = {}
  ): SynthesisResponse {
    return {
      success: true,
      timestamp: Date.now(),
      combinedContent,
      reasoning: options.reasoning || 'Multi-voice synthesis completed',
      confidence: options.confidence || 0.8,
      qualityScore: options.qualityScore || 85,
      voicesUsed,
      synthesisMode: options.synthesisMode || 'competitive',
      individualResponses: options.individualResponses
    };
  }

  static createToolResponse(
    toolName: string,
    result: any,
    options: {
      executionTime?: number;
      retryCount?: number;
      validation?: ToolResponse['validation'];
    } = {}
  ): ToolResponse {
    return {
      success: true,
      timestamp: Date.now(),
      toolName,
      result,
      executionTime: options.executionTime || 0,
      retryCount: options.retryCount || 0,
      validation: options.validation
    };
  }

  static createFileResponse(
    filePath: string,
    operation: FileResponse['operation'],
    options: {
      content?: string;
      size?: number;
      language?: string;
    } = {}
  ): FileResponse {
    return {
      success: true,
      timestamp: Date.now(),
      filePath,
      operation,
      content: options.content,
      size: options.size,
      language: options.language
    };
  }

  static createErrorResponse(
    code: string,
    message: string,
    details?: string
  ): ErrorInfo {
    return {
      code,
      message,
      details,
      stack: new Error().stack
    };
  }
}

/**
 * Response validation utilities
 */
export class ResponseValidator {
  
  static isValidResponse(response: any): response is BaseResponse {
    return response && 
           typeof response.success === 'boolean' &&
           typeof response.timestamp === 'number';
  }

  static hasError(response: BaseResponse): boolean {
    return !response.success || !!(response as any).error;
  }

  static getErrorMessage(response: BaseResponse): string {
    const error = (response as any).error;
    if (!error) return 'Unknown error';
    return error.message || 'Unknown error';
  }

  static extractContent(response: AgentResponse | SynthesisResponse): string {
    if ('content' in response) {
      return response.content;
    }
    if ('combinedContent' in response) {
      return response.combinedContent;
    }
    return '';
  }
}