/**
 * Reasoning Step Domain Entity
 * Pure business logic for AI reasoning chain steps
 *
 * Living Spiral Council Applied:
 * - Domain-driven design with pure business entities
 * - No external dependencies or infrastructure concerns
 * - Business rules for reasoning step validation and flow
 */

/**
 * Reasoning Step Type Value Object
 */
export class ReasoningStepType {
  private static readonly VALID_TYPES = [
    'thought',
    'action',
    'observation',
    'conclusion',
    'error',
  ] as const;

  private constructor(private readonly _value: (typeof ReasoningStepType.VALID_TYPES)[number]) {}

  public static create(value: string): ReasoningStepType {
    if (!this.VALID_TYPES.includes(value as "thought" | "action" | "observation" | "conclusion" | "error")) {
      throw new Error(
        `Invalid reasoning step type: ${value}. Must be one of: ${this.VALID_TYPES.join(', ')}`
      );
    }
    return new ReasoningStepType(value as "thought" | "action" | "observation" | "conclusion" | "error");
  }

  static thought(): ReasoningStepType {
    return new ReasoningStepType('thought');
  }

  static action(): ReasoningStepType {
    return new ReasoningStepType('action');
  }

  static observation(): ReasoningStepType {
    return new ReasoningStepType('observation');
  }

  static conclusion(): ReasoningStepType {
    return new ReasoningStepType('conclusion');
  }

  static error(): ReasoningStepType {
    return new ReasoningStepType('error');
  }

  get value(): string {
    return this._value;
  }

  equals(other: ReasoningStepType): boolean {
    return this._value === other._value;
  }

  isActionStep(): boolean {
    return this._value === 'action';
  }

  isThinkingStep(): boolean {
    return (
      this._value === 'thought' || this._value === 'observation' || this._value === 'conclusion'
    );
  }

  isErrorStep(): boolean {
    return this._value === 'error';
  }
}

/**
 * Confidence Score Value Object
 */
export class ConfidenceScore {
  private constructor(private readonly _value: number) {
    this.validateRange(_value);
  }

  static create(value: number): ConfidenceScore {
    return new ConfidenceScore(value);
  }

  static low(): ConfidenceScore {
    return new ConfidenceScore(0.3);
  }

  static medium(): ConfidenceScore {
    return new ConfidenceScore(0.6);
  }

  static high(): ConfidenceScore {
    return new ConfidenceScore(0.9);
  }

  get value(): number {
    return this._value;
  }

  isHigh(): boolean {
    return this._value >= 0.8;
  }

  isMedium(): boolean {
    return this._value >= 0.5 && this._value < 0.8;
  }

  isLow(): boolean {
    return this._value < 0.5;
  }

  private validateRange(value: number): void {
    if (value < 0 || value > 1) {
      throw new Error('Confidence score must be between 0 and 1');
    }
  }
}

/**
 * Tool Arguments Value Object
 */
export class ToolArguments {
  private constructor(private readonly _args: Readonly<Record<string, unknown>>) {}

  public static create(args: Readonly<Record<string, unknown>>): ToolArguments {
    // Deep clone to ensure immutability
    const clonedArgs = JSON.parse(JSON.stringify(args)) as Record<string, unknown>;
    return new ToolArguments(clonedArgs);
  }

  public static empty(): ToolArguments {
    return new ToolArguments({});
  }

  public get args(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this._args });
  }

  public hasArgument(name: string): boolean {
    return name in this._args;
  }

  public getArgument(name: string): unknown {
    return this._args[name];
  }

  public withArgument(name: string, value: unknown): ToolArguments {
    const newArgs: Record<string, unknown> = { ...this._args, [name]: value };
    return new ToolArguments(newArgs);
  }
}

/**
 * Reasoning Step Entity - Core business object representing a step in AI reasoning chain
 */
export class ReasoningStep {
  private readonly _stepNumber: number;
  private readonly _type: ReasoningStepType;
  private readonly _content: string;
  private readonly _confidence: ConfidenceScore;
  private readonly _timestamp: Date;
  private readonly _toolName?: string;
  private readonly _toolArgs?: ToolArguments;
  private readonly _toolResult?: unknown;
  private readonly _executionTime?: number;
  private readonly _metadata: Readonly<Record<string, unknown>>;

  public constructor(
    stepNumber: number,
    type: ReasoningStepType,
    content: string,
    confidence: ConfidenceScore,
    timestamp: Date = new Date(),
    toolName?: string,
    toolArgs?: ToolArguments,
    toolResult?: unknown,
    executionTime?: number,
    metadata: Readonly<Record<string, unknown>> = {}
  ) {
    this.validateInputs(stepNumber, content);

    this._stepNumber = stepNumber;
    this._type = type;
    this._content = content;
    this._confidence = confidence;
    this._timestamp = new Date(timestamp);
    this._toolName = toolName;
    this._toolArgs = toolArgs;
    this._toolResult = toolResult;
    this._executionTime = executionTime;
    this._metadata = Object.freeze({ ...metadata });
  }

  // Getters
  public get stepNumber(): number {
    return this._stepNumber;
  }

  public get type(): ReasoningStepType {
    return this._type;
  }

  public get content(): string {
    return this._content;
  }

  public get confidence(): ConfidenceScore {
    return this._confidence;
  }

  public get timestamp(): Date {
    return new Date(this._timestamp);
  }

  public get toolName(): string | undefined {
    return this._toolName;
  }

  public get toolArgs(): ToolArguments | undefined {
    return this._toolArgs;
  }

  public get toolResult(): unknown {
    return this._toolResult;
  }

  public get executionTime(): number | undefined {
    return this._executionTime;
  }

  public get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  // Business methods

  /**
   * Check if this step involves tool execution
   */
  isToolStep(): boolean {
    return this._type.isActionStep() && !!this._toolName;
  }

  /**
   * Check if this step represents thinking/reasoning
   */
  isReasoningStep(): boolean {
    return this._type.isThinkingStep();
  }

  /**
   * Check if this step encountered an error
   */
  hasError(): boolean {
    return this._type.isErrorStep();
  }

  /**
   * Business rule: A step is considered successful if it's not an error and has reasonable confidence
   */
  isSuccessful(): boolean {
    return !this.hasError() && !this._confidence.isLow();
  }

  /**
   * Business rule: A step requires attention if it has low confidence or is an error
   */
  requiresAttention(): boolean {
    return this.hasError() || this._confidence.isLow();
  }

  /**
   * Calculate the relative importance of this step in the reasoning chain
   */
  calculateImportance(): number {
    let importance = this._confidence.value;

    // Tool steps are generally more important for execution
    if (this.isToolStep()) {
      importance += 0.2;
    }

    // Error steps are critical
    if (this.hasError()) {
      importance += 0.5;
    }

    // Conclusion steps are important for final outcomes
    if (this._type.value === 'conclusion') {
      importance += 0.3;
    }

    return Math.min(1.0, importance);
  }

  /**
   * Create a new reasoning step with updated content while preserving other properties
   */
  withUpdatedContent(newContent: string): ReasoningStep {
    return new ReasoningStep(
      this._stepNumber,
      this._type,
      newContent,
      this._confidence,
      this._timestamp,
      this._toolName,
      this._toolArgs,
      this._toolResult,
      this._executionTime,
      this._metadata
    );
  }

  /**
   * Create a new reasoning step with tool execution result
   */
  public withToolResult(result: unknown, executionTime?: number): ReasoningStep {
    return new ReasoningStep(
      this._stepNumber,
      this._type,
      this._content,
      this._confidence,
      this._timestamp,
      this._toolName,
      this._toolArgs,
      result,
      executionTime,
      this._metadata
    );
  }

  /**
   * Export to configuration object for external systems
   */
  toConfig(): ReasoningStepConfiguration {
    return {
      step: this._stepNumber,
      type: this._type.value,
      content: this._content,
      toolName: this._toolName,
      toolArgs: this._toolArgs?.args,
      toolResult: this._toolResult,
      confidence: this._confidence.value,
      timestamp: this._timestamp.toISOString(),
      executionTime: this._executionTime,
      metadata: { ...this._metadata },
    };
  }

  /**
   * Create ReasoningStep from configuration
   */
  static fromConfig(config: ReasoningStepConfiguration): ReasoningStep {
    return new ReasoningStep(
      config.step,
      ReasoningStepType.create(config.type),
      config.content,
      ConfidenceScore.create(config.confidence),
      new Date(config.timestamp),
      config.toolName,
      config.toolArgs ? ToolArguments.create(config.toolArgs) : undefined,
      config.toolResult,
      config.executionTime,
      config.metadata || {}
    );
  }

  // Factory methods

  static createThoughtStep(
    stepNumber: number,
    content: string,
    confidence: ConfidenceScore
  ): ReasoningStep {
    return new ReasoningStep(stepNumber, ReasoningStepType.thought(), content, confidence);
  }

  static createActionStep(
    stepNumber: number,
    content: string,
    toolName: string,
    toolArgs: ToolArguments,
    confidence: ConfidenceScore
  ): ReasoningStep {
    return new ReasoningStep(
      stepNumber,
      ReasoningStepType.action(),
      content,
      confidence,
      new Date(),
      toolName,
      toolArgs
    );
  }

  static createObservationStep(
    stepNumber: number,
    content: string,
    confidence: ConfidenceScore
  ): ReasoningStep {
    return new ReasoningStep(stepNumber, ReasoningStepType.observation(), content, confidence);
  }

  static createConclusionStep(
    stepNumber: number,
    content: string,
    confidence: ConfidenceScore
  ): ReasoningStep {
    return new ReasoningStep(stepNumber, ReasoningStepType.conclusion(), content, confidence);
  }

  static createErrorStep(stepNumber: number, error: string): ReasoningStep {
    return new ReasoningStep(stepNumber, ReasoningStepType.error(), error, ConfidenceScore.low());
  }

  private validateInputs(stepNumber: number, content: string): void {
    if (stepNumber < 1) {
      throw new Error('Step number must be positive');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Reasoning step content cannot be empty');
    }
  }
}

/**
 * Configuration interface for external systems
 */
export interface ReasoningStepConfiguration {
  step: number;
  type: string;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  confidence: number;
  timestamp: string;
  executionTime?: number;
  metadata?: Record<string, unknown>;
}
