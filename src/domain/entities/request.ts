/**
 * Request Domain Entity
 * Pure business logic for processing requests
 * 
 * Living Spiral Council Applied:
 * - Domain-driven design with immutable request entities
 * - Business rules for request validation and prioritization
 * - No external dependencies or infrastructure concerns
 */

import { RequestPriority } from '../value-objects/voice-values.js';

/**
 * Processing Request Entity
 */
export class ProcessingRequest {
  private readonly _id: string;
  private readonly _content: string;
  private readonly _type: RequestType;
  private readonly _priority: RequestPriority;
  private readonly _context: RequestContext;
  private readonly _constraints: RequestConstraints;
  private readonly _timestamp: Date;
  private _status: RequestStatus;

  constructor(
    id: string,
    content: string,
    type: RequestType,
    priority: RequestPriority,
    context: RequestContext,
    constraints: RequestConstraints
  ) {
    this.validateInputs(id, content);
    
    this._id = id;
    this._content = content;
    this._type = type;
    this._priority = priority;
    this._context = context;
    this._constraints = constraints;
    this._timestamp = new Date();
    this._status = RequestStatus.PENDING;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get content(): string {
    return this._content;
  }

  get type(): RequestType {
    return this._type;
  }

  get priority(): RequestPriority {
    return this._priority;
  }

  get context(): RequestContext {
    return this._context;
  }

  get constraints(): RequestConstraints {
    return this._constraints;
  }

  get timestamp(): Date {
    return new Date(this._timestamp);
  }

  get status(): RequestStatus {
    return this._status;
  }

  // Business methods

  /**
   * Start processing this request
   */
  startProcessing(): ProcessingRequest {
    if (this._status !== RequestStatus.PENDING) {
      throw new Error(`Cannot start processing request in ${this._status} status`);
    }

    const newRequest = this.clone();
    newRequest._status = RequestStatus.PROCESSING;
    return newRequest;
  }

  /**
   * Complete this request successfully
   */
  complete(): ProcessingRequest {
    if (this._status !== RequestStatus.PROCESSING) {
      throw new Error(`Cannot complete request in ${this._status} status`);
    }

    const newRequest = this.clone();
    newRequest._status = RequestStatus.COMPLETED;
    return newRequest;
  }

  /**
   * Mark this request as failed
   */
  fail(error: string): ProcessingRequest {
    if (this._status === RequestStatus.COMPLETED) {
      throw new Error('Cannot fail a completed request');
    }

    const newRequest = this.clone();
    newRequest._status = RequestStatus.FAILED;
    return newRequest;
  }

  /**
   * Cancel this request
   */
  cancel(): ProcessingRequest {
    if (this._status === RequestStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed request');
    }

    const newRequest = this.clone();
    newRequest._status = RequestStatus.CANCELLED;
    return newRequest;
  }

  /**
   * Check if this request requires specific capabilities
   */
  requiresCapabilities(): string[] {
    const capabilities: string[] = [];

    switch (this._type) {
      case RequestType.CODE_GENERATION:
        capabilities.push('code-generation', 'syntax-validation');
        break;
      case RequestType.CODE_ANALYSIS:
        capabilities.push('code-analysis', 'pattern-recognition');
        break;
      case RequestType.ARCHITECTURE_DESIGN:
        capabilities.push('system-design', 'architecture-planning');
        break;
      case RequestType.DOCUMENTATION:
        capabilities.push('documentation', 'technical-writing');
        break;
      case RequestType.OPTIMIZATION:
        capabilities.push('performance-analysis', 'optimization');
        break;
      case RequestType.REVIEW:
        capabilities.push('code-review', 'quality-assessment');
        break;
    }

    // Add context-specific capabilities
    if (this._context.languages && this._context.languages.length > 0) {
      this._context.languages.forEach(lang => {
        capabilities.push(`${lang.toLowerCase()}-programming`);
      });
    }

    return capabilities;
  }

  /**
   * Calculate processing complexity score
   */
  calculateComplexity(): number {
    let complexity = 0.1; // Base complexity

    // Content length factor (30%)
    const contentComplexity = Math.min(this._content.length / 10000, 1.0);
    complexity += contentComplexity * 0.3;

    // Type complexity factor (40%)
    const typeComplexity = this.getTypeComplexity();
    complexity += typeComplexity * 0.4;

    // Context complexity factor (30%)
    const contextComplexity = this.getContextComplexity();
    complexity += contextComplexity * 0.3;

    return Math.min(1.0, complexity);
  }

  /**
   * Estimate processing time in milliseconds
   */
  estimateProcessingTime(): number {
    const baseTime = 1000; // 1 second base
    const complexity = this.calculateComplexity();
    const priorityMultiplier = this.getPriorityMultiplier();
    
    return baseTime * (1 + complexity * 3) * priorityMultiplier;
  }

  /**
   * Get request configuration
   */
  toConfig(): ProcessingRequestConfig {
    return {
      id: this._id,
      content: this._content,
      type: this._type,
      priority: this._priority.value,
      context: this._context,
      constraints: this._constraints,
      timestamp: this._timestamp.toISOString(),
      status: this._status,
    };
  }

  /**
   * Create request from configuration
   */
  static fromConfig(config: ProcessingRequestConfig): ProcessingRequest {
    const request = new ProcessingRequest(
      config.id,
      config.content,
      config.type,
      RequestPriority.create(config.priority),
      config.context,
      config.constraints
    );
    request._status = config.status;
    return request;
  }

  // Private helper methods

  private clone(): ProcessingRequest {
    const cloned = new ProcessingRequest(
      this._id,
      this._content,
      this._type,
      this._priority,
      this._context,
      this._constraints
    );
    cloned._status = this._status;
    return cloned;
  }

  private getTypeComplexity(): number {
    switch (this._type) {
      case RequestType.CODE_GENERATION:
        return 0.8;
      case RequestType.ARCHITECTURE_DESIGN:
        return 1.0;
      case RequestType.CODE_ANALYSIS:
        return 0.6;
      case RequestType.OPTIMIZATION:
        return 0.7;
      case RequestType.REVIEW:
        return 0.5;
      case RequestType.DOCUMENTATION:
        return 0.4;
      default:
        return 0.5;
    }
  }

  private getContextComplexity(): number {
    let complexity = 0;

    if (this._context.languages) {
      complexity += this._context.languages.length * 0.1;
    }

    if (this._context.frameworks) {
      complexity += this._context.frameworks.length * 0.1;
    }

    if (this._context.projectSize && this._context.projectSize > 1000) {
      complexity += 0.3;
    }

    return Math.min(1.0, complexity);
  }

  private getPriorityMultiplier(): number {
    switch (this._priority.value) {
      case 'low':
        return 1.5;
      case 'medium':
        return 1.0;
      case 'high':
        return 0.8;
      case 'critical':
        return 0.6;
      default:
        return 1.0;
    }
  }

  private validateInputs(id: string, content: string): void {
    if (!id || id.trim().length === 0) {
      throw new Error('Request ID cannot be empty');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Request content cannot be empty');
    }

    if (content.length > 100000) {
      throw new Error('Request content cannot exceed 100,000 characters');
    }
  }
}

/**
 * Request Type Enumeration
 */
export enum RequestType {
  CODE_GENERATION = 'code-generation',
  CODE_ANALYSIS = 'code-analysis',
  ARCHITECTURE_DESIGN = 'architecture-design',
  DOCUMENTATION = 'documentation',
  OPTIMIZATION = 'optimization',
  REVIEW = 'review',
}

/**
 * Request Status Enumeration
 */
export enum RequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Request Context Interface
 */
export interface RequestContext {
  languages?: string[];
  frameworks?: string[];
  projectSize?: number;
  existingCode?: string;
  requirements?: string[];
  constraints?: string[];
}

/**
 * Request Constraints Interface
 */
export interface RequestConstraints {
  maxResponseTime?: number;
  maxCost?: number;
  requiredQuality?: number;
  excludedVoices?: string[];
  mustIncludeVoices?: string[];
  outputFormat?: string;
}

/**
 * Request Configuration Interface
 */
export interface ProcessingRequestConfig {
  id: string;
  content: string;
  type: RequestType;
  priority: string;
  context: RequestContext;
  constraints: RequestConstraints;
  timestamp: string;
  status: RequestStatus;
}

/**
 * Request Factory
 */
export class RequestFactory {
  /**
   * Create a code generation request
   */
  static createCodeGeneration(
    id: string,
    content: string,
    priority: RequestPriority,
    context: RequestContext
  ): ProcessingRequest {
    return new ProcessingRequest(
      id,
      content,
      RequestType.CODE_GENERATION,
      priority,
      context,
      {}
    );
  }

  /**
   * Create a code analysis request
   */
  static createCodeAnalysis(
    id: string,
    content: string,
    priority: RequestPriority,
    context: RequestContext
  ): ProcessingRequest {
    return new ProcessingRequest(
      id,
      content,
      RequestType.CODE_ANALYSIS,
      priority,
      context,
      {}
    );
  }

  /**
   * Create an architecture design request
   */
  static createArchitectureDesign(
    id: string,
    content: string,
    priority: RequestPriority,
    context: RequestContext
  ): ProcessingRequest {
    return new ProcessingRequest(
      id,
      content,
      RequestType.ARCHITECTURE_DESIGN,
      priority,
      context,
      {}
    );
  }
}