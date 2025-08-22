/**
 * Response Types System for CodeCrucible Synth
 * Provides structured response handling and validation
 */

import { logger } from './logger.js';

// Base Response Interface (for test compatibility)
export interface BaseResponse {
  success: boolean;
  timestamp: number;
  error?: ErrorResponse;
}

// Test-Compatible Response Types
export interface AgentResponse extends BaseResponse {
  content: string;
  confidence?: number;
  voiceId?: string;
  tokensUsed?: number;
  reasoning?: string;
  metadata?: ResponseMetadata;
  type?: ResponseType;
  quality?: number;
}

export interface SynthesisResponse extends BaseResponse {
  combinedContent: string;
  voicesUsed: string[];
  confidence: number;
  qualityScore: number;
  synthesisMode: string;
  reasoning: string;
}

export interface ToolResponse extends BaseResponse {
  toolName: string;
  result: any;
  executionTime?: number;
  retryCount?: number;
  metadata?: any;
}

export interface FileResponse extends BaseResponse {
  path: string;
  filePath?: string; // For test compatibility
  operation: string;
  content?: string;
  size?: number;
  language?: string;
  metadata?: any;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

export interface ResponseMetadata {
  timestamp: Date;
  duration: number;
  model: string;
  voice?: string;
  tokens: number;
  cost?: number;
}

export enum ResponseType {
  CODE_GENERATION = 'code_generation',
  CODE_ANALYSIS = 'code_analysis',
  CODE_REVIEW = 'code_review',
  DOCUMENTATION = 'documentation',
  EXPLANATION = 'explanation',
  ERROR_DIAGNOSIS = 'error_diagnosis',
  REFACTORING = 'refactoring',
  TESTING = 'testing',
  GENERAL = 'general',
}

// Specialized Response Types
export interface CodeGenerationResponse extends AgentResponse {
  type: ResponseType.CODE_GENERATION;
  code: string;
  language: string;
  framework?: string;
  dependencies: string[];
  tests?: string;
}

export interface CodeAnalysisResponse extends AgentResponse {
  type: ResponseType.CODE_ANALYSIS;
  analysis: {
    complexity: number;
    maintainability: number;
    performance: number;
    security: number;
    bugs: Bug[];
    suggestions: Suggestion[];
  };
}

export interface CodeReviewResponse extends AgentResponse {
  type: ResponseType.CODE_REVIEW;
  review: {
    overall: ReviewScore;
    comments: ReviewComment[];
    approvalStatus: 'approved' | 'changes_requested' | 'needs_review';
    summary: string;
  };
}

export interface Bug {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  location: {
    file?: string;
    line?: number;
    column?: number;
  };
  fix?: string;
}

export interface Suggestion {
  type: 'performance' | 'maintainability' | 'style' | 'security' | 'best_practice';
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  example?: string;
}

export interface ReviewComment {
  line?: number;
  type: 'praise' | 'suggestion' | 'issue' | 'question';
  severity: 'info' | 'minor' | 'major' | 'critical';
  message: string;
  fix?: string;
}

export interface ReviewScore {
  score: number; // 0-100
  breakdown: {
    functionality: number;
    maintainability: number;
    performance: number;
    security: number;
    style: number;
  };
}

// Response Validation
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Factory and Validator Classes
export class ResponseFactory {
  /**
   * Create a basic agent response (test-compatible)
   */
  static createAgentResponse(
    content: string,
    options: {
      confidence?: number;
      voiceId?: string;
      tokensUsed?: number;
      reasoning?: string;
    } = {}
  ): AgentResponse {
    return {
      success: true,
      timestamp: Date.now(),
      content,
      confidence: options.confidence || 0.8,
      voiceId: options.voiceId,
      tokensUsed: options.tokensUsed || 0,
      reasoning: options.reasoning || 'Agent response generated',
    };
  }

  /**
   * Create a synthesis response (test-compatible)
   */
  static createSynthesisResponse(
    combinedContent: string,
    voicesUsed: string[],
    options: {
      confidence?: number;
      qualityScore?: number;
      synthesisMode?: string;
      reasoning?: string;
    } = {}
  ): SynthesisResponse {
    return {
      success: true,
      timestamp: Date.now(),
      combinedContent,
      voicesUsed,
      confidence: options.confidence || 0.8,
      qualityScore: options.qualityScore || 85,
      synthesisMode: options.synthesisMode || 'competitive',
      reasoning: options.reasoning || 'Multi-voice synthesis completed',
    };
  }

  /**
   * Create a tool response (test-compatible)
   */
  static createToolResponse(
    toolName: string,
    result: any,
    options: {
      executionTime?: number;
      retryCount?: number;
      metadata?: any;
    } = {}
  ): ToolResponse {
    return {
      success: true,
      timestamp: Date.now(),
      toolName,
      result,
      executionTime: options.executionTime,
      retryCount: options.retryCount,
      metadata: options.metadata,
    };
  }

  /**
   * Create a file response (test-compatible)
   */
  static createFileResponse(
    path: string,
    operation: string,
    options: {
      content?: string;
      size?: number;
      language?: string;
      metadata?: any;
    } = {}
  ): FileResponse {
    return {
      success: true,
      timestamp: Date.now(),
      path,
      filePath: path, // For test compatibility
      operation,
      content: options.content,
      size: options.size,
      language: options.language,
      metadata: options.metadata,
    };
  }

  /**
   * Create an error response (test-compatible)
   */
  static createErrorResponse(code: string, message: string, details?: any): ErrorResponse {
    return {
      code,
      message,
      details,
      stack: new Error().stack,
    };
  }
  /**
   * Create a legacy-style response for backward compatibility
   */
  static createLegacyAgentResponse(
    content: string,
    type: ResponseType,
    metadata: Partial<ResponseMetadata> = {}
  ): any {
    return {
      content,
      type,
      quality: 0.8,
      confidence: 0.8,
      metadata: {
        timestamp: new Date(),
        duration: 0,
        model: 'unknown',
        tokens: 0,
        ...metadata,
      },
    };
  }

  /**
   * Create a code generation response
   */
  static createCodeGenerationResponse(
    code: string,
    language: string,
    metadata: Partial<ResponseMetadata> = {},
    options: {
      framework?: string;
      dependencies?: string[];
      tests?: string;
    } = {}
  ): CodeGenerationResponse {
    return {
      ...this.createLegacyAgentResponse(
        `Generated ${language} code`,
        ResponseType.CODE_GENERATION,
        metadata
      ),
      code,
      language,
      framework: options.framework,
      dependencies: options.dependencies || [],
      tests: options.tests,
      type: ResponseType.CODE_GENERATION,
    };
  }

  /**
   * Create a code analysis response
   */
  static createCodeAnalysisResponse(
    content: string,
    analysis: CodeAnalysisResponse['analysis'],
    metadata: Partial<ResponseMetadata> = {}
  ): CodeAnalysisResponse {
    return {
      ...this.createLegacyAgentResponse(content, ResponseType.CODE_ANALYSIS, metadata),
      analysis,
      type: ResponseType.CODE_ANALYSIS,
    };
  }

  /**
   * Create a code review response
   */
  static createCodeReviewResponse(
    content: string,
    review: CodeReviewResponse['review'],
    metadata: Partial<ResponseMetadata> = {}
  ): CodeReviewResponse {
    return {
      ...this.createLegacyAgentResponse(content, ResponseType.CODE_REVIEW, metadata),
      review,
      type: ResponseType.CODE_REVIEW,
    };
  }

  /**
   * Parse response type from content
   */
  static inferResponseType(content: string): ResponseType {
    const lowerContent = content.toLowerCase();

    if (
      lowerContent.includes('```') ||
      lowerContent.includes('function') ||
      lowerContent.includes('class')
    ) {
      return ResponseType.CODE_GENERATION;
    }

    if (
      lowerContent.includes('analysis') ||
      lowerContent.includes('complexity') ||
      lowerContent.includes('bug')
    ) {
      return ResponseType.CODE_ANALYSIS;
    }

    if (
      lowerContent.includes('review') ||
      lowerContent.includes('approve') ||
      lowerContent.includes('changes')
    ) {
      return ResponseType.CODE_REVIEW;
    }

    if (
      lowerContent.includes('error') ||
      lowerContent.includes('exception') ||
      lowerContent.includes('debug')
    ) {
      return ResponseType.ERROR_DIAGNOSIS;
    }

    if (
      lowerContent.includes('refactor') ||
      lowerContent.includes('improve') ||
      lowerContent.includes('optimize')
    ) {
      return ResponseType.REFACTORING;
    }

    if (
      lowerContent.includes('test') ||
      lowerContent.includes('spec') ||
      lowerContent.includes('assert')
    ) {
      return ResponseType.TESTING;
    }

    if (
      lowerContent.includes('document') ||
      lowerContent.includes('readme') ||
      lowerContent.includes('guide')
    ) {
      return ResponseType.DOCUMENTATION;
    }

    return ResponseType.GENERAL;
  }
}

export class ResponseValidator {
  /**
   * Check if response is valid (test-compatible)
   */
  static isValidResponse(response: any): boolean {
    return (
      response &&
      typeof response === 'object' &&
      typeof response.success === 'boolean' &&
      typeof response.timestamp === 'number'
    );
  }

  /**
   * Check if response has error (test-compatible)
   */
  static hasError(response: BaseResponse): boolean {
    return response.success === false && !!response.error;
  }

  /**
   * Get error message from response (test-compatible)
   */
  static getErrorMessage(response: BaseResponse): string | null {
    return response.error?.message || null;
  }

  /**
   * Extract content from any response type (test-compatible)
   */
  static extractContent(response: AgentResponse | SynthesisResponse): string {
    if ('content' in response) {
      return response.content;
    }
    if ('combinedContent' in response) {
      return response.combinedContent;
    }
    return '';
  }
  /**
   * Validate any agent response
   */
  static validateResponse(response: AgentResponse): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic validation
    if (!response.content || response.content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Response content cannot be empty',
        severity: 'error',
      });
    }

    if ((response.quality ?? 0) < 0 || (response.quality ?? 0) > 1) {
      errors.push({
        field: 'quality',
        message: 'Quality score must be between 0 and 1',
        severity: 'error',
      });
    }

    if ((response.confidence ?? 0) < 0 || (response.confidence ?? 0) > 1) {
      errors.push({
        field: 'confidence',
        message: 'Confidence score must be between 0 and 1',
        severity: 'error',
      });
    }

    // Metadata validation
    if (!response.metadata?.timestamp) {
      warnings.push({
        field: 'metadata.timestamp',
        message: 'Timestamp should be provided',
        suggestion: 'Add timestamp for better tracking',
      });
    }

    if ((response.metadata?.duration ?? 0) < 0) {
      warnings.push({
        field: 'metadata.duration',
        message: 'Duration cannot be negative',
      });
    }

    // Type-specific validation
    if (response.type === ResponseType.CODE_GENERATION) {
      this.validateCodeGenerationResponse(response as CodeGenerationResponse, errors, warnings);
    } else if (response.type === ResponseType.CODE_ANALYSIS) {
      this.validateCodeAnalysisResponse(response as CodeAnalysisResponse, errors, warnings);
    } else if (response.type === ResponseType.CODE_REVIEW) {
      this.validateCodeReviewResponse(response as CodeReviewResponse, errors, warnings);
    }

    const score = this.calculateValidationScore(errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  private static validateCodeGenerationResponse(
    response: CodeGenerationResponse,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!response.code || response.code.trim().length === 0) {
      errors.push({
        field: 'code',
        message: 'Generated code cannot be empty',
        severity: 'error',
      });
    }

    if (!response.language) {
      errors.push({
        field: 'language',
        message: 'Programming language must be specified',
        severity: 'error',
      });
    }

    if (!response.dependencies) {
      warnings.push({
        field: 'dependencies',
        message: 'Dependencies array should be provided',
        suggestion: 'Include empty array if no dependencies',
      });
    }
  }

  private static validateCodeAnalysisResponse(
    response: CodeAnalysisResponse,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!response.analysis) {
      errors.push({
        field: 'analysis',
        message: 'Analysis object is required',
        severity: 'error',
      });
      return;
    }

    const { analysis } = response;

    // Validate score ranges
    const scores = ['complexity', 'maintainability', 'performance', 'security'];
    scores.forEach(score => {
      if (
        typeof (analysis as any)[score] !== 'number' ||
        (analysis as any)[score] < 0 ||
        (analysis as any)[score] > 100
      ) {
        errors.push({
          field: `analysis.${score}`,
          message: `${score} score must be a number between 0 and 100`,
          severity: 'error',
        });
      }
    });

    if (!Array.isArray(analysis.bugs)) {
      errors.push({
        field: 'analysis.bugs',
        message: 'Bugs must be an array',
        severity: 'error',
      });
    }

    if (!Array.isArray(analysis.suggestions)) {
      errors.push({
        field: 'analysis.suggestions',
        message: 'Suggestions must be an array',
        severity: 'error',
      });
    }
  }

  private static validateCodeReviewResponse(
    response: CodeReviewResponse,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!response.review) {
      errors.push({
        field: 'review',
        message: 'Review object is required',
        severity: 'error',
      });
      return;
    }

    const { review } = response;

    if (!review.overall || typeof review.overall.score !== 'number') {
      errors.push({
        field: 'review.overall',
        message: 'Overall score is required',
        severity: 'error',
      });
    }

    if (!['approved', 'changes_requested', 'needs_review'].includes(review.approvalStatus)) {
      errors.push({
        field: 'review.approvalStatus',
        message: 'Invalid approval status',
        severity: 'error',
      });
    }

    if (!Array.isArray(review.comments)) {
      errors.push({
        field: 'review.comments',
        message: 'Comments must be an array',
        severity: 'error',
      });
    }
  }

  private static calculateValidationScore(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    let score = 100;
    score -= errors.length * 20; // -20 points per error
    score -= warnings.length * 5; // -5 points per warning
    return Math.max(0, score);
  }

  /**
   * Sanitize response content
   */
  static sanitizeResponse(response: AgentResponse): AgentResponse {
    const sanitized = { ...response };

    // Remove potentially harmful content
    sanitized.content = sanitized.content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '');

    // Ensure quality and confidence are in valid range
    sanitized.quality = Math.max(0, Math.min(1, sanitized.quality ?? 0));
    sanitized.confidence = Math.max(0, Math.min(1, sanitized.confidence ?? 0));

    return sanitized;
  }
}

// Utility functions for response processing
export class ResponseProcessor {
  /**
   * Extract code blocks from response content
   */
  static extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
    const blocks: Array<{ language: string; code: string }> = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2],
      });
    }

    return blocks;
  }

  /**
   * Calculate response complexity
   */
  static calculateComplexity(response: AgentResponse): number {
    let complexity = 0;

    // Length factor
    complexity += Math.min(response.content.length / 1000, 5);

    // Code presence
    const codeBlocks = this.extractCodeBlocks(response.content);
    complexity += codeBlocks.length * 2;

    // Technical terms
    const technicalTerms = [
      'function',
      'class',
      'interface',
      'async',
      'await',
      'database',
      'api',
      'http',
      'json',
      'xml',
      'algorithm',
      'optimization',
      'performance',
    ];

    technicalTerms.forEach(term => {
      if (response.content.toLowerCase().includes(term)) {
        complexity += 0.5;
      }
    });

    return Math.min(complexity, 10);
  }

  /**
   * Merge multiple responses
   */
  static mergeResponses(responses: AgentResponse[]): AgentResponse {
    if (responses.length === 0) {
      throw new Error('Cannot merge empty response array');
    }

    if (responses.length === 1) {
      return responses[0];
    }

    const mergedContent = responses.map(r => r.content).join('\n\n---\n\n');
    const avgQuality = responses.reduce((sum, r) => sum + (r.quality ?? 0), 0) / responses.length;
    const avgConfidence =
      responses.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / responses.length;
    const totalDuration = responses.reduce((sum, r) => sum + (r.metadata?.duration ?? 0), 0);
    const totalTokens = responses.reduce((sum, r) => sum + (r.metadata?.tokens ?? 0), 0);

    return ResponseFactory.createLegacyAgentResponse(mergedContent, ResponseType.GENERAL, {
      duration: totalDuration,
      tokens: totalTokens,
      model: responses[0]?.metadata?.model,
    });
  }
}

// Export everything for easy access
export default {
  ResponseFactory,
  ResponseValidator,
  ResponseProcessor,
  ResponseType,
};
