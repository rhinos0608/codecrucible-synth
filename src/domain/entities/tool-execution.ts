/**
 * Tool Execution Domain Entity
 * Pure business logic for AI tool execution
 *
 * Living Spiral Council Applied:
 * - Domain-driven design with pure business entities
 * - No external dependencies or infrastructure concerns  
 * - Business rules for tool execution validation and result processing
 */

/**
 * Tool Name Value Object
 */
export class ToolName {
  private constructor(private readonly _value: string) {
    this.validateName(_value);
  }

  static create(value: string): ToolName {
    return new ToolName(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ToolName): boolean {
    return this._value === other._value;
  }

  isFileSystemTool(): boolean {
    return this._value.includes('filesystem');
  }

  isGitTool(): boolean {
    return this._value.includes('git');
  }

  isCodeTool(): boolean {
    return this._value.includes('code') || this._value.includes('analysis');
  }

  isTerminalTool(): boolean {
    return this._value.includes('terminal') || this._value.includes('execute');
  }

  /**
   * Business rule: Determine execution complexity based on tool type
   */
  estimateComplexity(): number {
    if (this.isTerminalTool()) return 0.8;
    if (this.isCodeTool()) return 0.7;
    if (this.isGitTool()) return 0.6;
    if (this.isFileSystemTool()) return 0.4;
    return 0.5; // Default
  }

  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Tool name cannot be empty');
    }
    
    if (name.length > 100) {
      throw new Error('Tool name too long (max 100 characters)');
    }
    
    // Basic validation for tool name format
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      throw new Error('Tool name must start with letter and contain only letters, numbers, underscore, or dash');
    }
  }
}

/**
 * Execution Status Value Object
 */
export class ExecutionStatus {
  private static readonly VALID_STATUSES = ['pending', 'running', 'success', 'failure', 'timeout'] as const;
  
  private constructor(private readonly _value: typeof ExecutionStatus.VALID_STATUSES[number]) {}

  static create(value: string): ExecutionStatus {
    if (!this.VALID_STATUSES.includes(value as any)) {
      throw new Error(`Invalid execution status: ${value}. Must be one of: ${this.VALID_STATUSES.join(', ')}`);
    }
    return new ExecutionStatus(value as any);
  }

  static pending(): ExecutionStatus {
    return new ExecutionStatus('pending');
  }

  static running(): ExecutionStatus {
    return new ExecutionStatus('running');
  }

  static success(): ExecutionStatus {
    return new ExecutionStatus('success');
  }

  static failure(): ExecutionStatus {
    return new ExecutionStatus('failure');
  }

  static timeout(): ExecutionStatus {
    return new ExecutionStatus('timeout');
  }

  get value(): string {
    return this._value;
  }

  equals(other: ExecutionStatus): boolean {
    return this._value === other._value;
  }

  isCompleted(): boolean {
    return this._value === 'success' || this._value === 'failure' || this._value === 'timeout';
  }

  isSuccessful(): boolean {
    return this._value === 'success';
  }

  isFailed(): boolean {
    return this._value === 'failure' || this._value === 'timeout';
  }

  isRunning(): boolean {
    return this._value === 'running';
  }

  isPending(): boolean {
    return this._value === 'pending';
  }
}

/**
 * Execution Duration Value Object
 */
export class ExecutionDuration {
  private constructor(private readonly _milliseconds: number) {
    this.validateDuration(_milliseconds);
  }

  static create(milliseconds: number): ExecutionDuration {
    return new ExecutionDuration(milliseconds);
  }

  static fromSeconds(seconds: number): ExecutionDuration {
    return new ExecutionDuration(seconds * 1000);
  }

  static zero(): ExecutionDuration {
    return new ExecutionDuration(0);
  }

  get milliseconds(): number {
    return this._milliseconds;
  }

  get seconds(): number {
    return this._milliseconds / 1000;
  }

  get minutes(): number {
    return this._milliseconds / (1000 * 60);
  }

  /**
   * Business rule: Check if execution duration indicates performance issue
   */
  isSlowExecution(): boolean {
    return this._milliseconds > 30000; // > 30 seconds
  }

  /**
   * Business rule: Check if execution duration indicates timeout risk
   */
  isNearTimeout(timeoutMs: number): boolean {
    return this._milliseconds > (timeoutMs * 0.8); // > 80% of timeout
  }

  add(other: ExecutionDuration): ExecutionDuration {
    return new ExecutionDuration(this._milliseconds + other._milliseconds);
  }

  subtract(other: ExecutionDuration): ExecutionDuration {
    return new ExecutionDuration(Math.max(0, this._milliseconds - other._milliseconds));
  }

  private validateDuration(milliseconds: number): void {
    if (milliseconds < 0) {
      throw new Error('Execution duration cannot be negative');
    }
  }
}

/**
 * Tool Arguments Value Object (reused from reasoning-step.ts)
 */
export class ToolArguments {
  private constructor(private readonly _args: Record<string, any>) {}

  static create(args: Record<string, any>): ToolArguments {
    const clonedArgs = JSON.parse(JSON.stringify(args));
    return new ToolArguments(clonedArgs);
  }

  static empty(): ToolArguments {
    return new ToolArguments({});
  }

  get args(): Readonly<Record<string, any>> {
    return Object.freeze({ ...this._args });
  }

  hasArgument(name: string): boolean {
    return name in this._args;
  }

  getArgument(name: string): any {
    return this._args[name];
  }

  /**
   * Business rule: Check if arguments appear to be valid for the tool type
   */
  areValidFor(toolName: ToolName): boolean {
    if (toolName.isFileSystemTool()) {
      return this.hasArgument('path') || this.hasArgument('filename');
    }
    
    if (toolName.isGitTool()) {
      return this.hasArgument('repository') || this.hasArgument('command');
    }
    
    if (toolName.isTerminalTool()) {
      return this.hasArgument('command') || this.hasArgument('script');
    }
    
    return true; // For unknown tool types, assume valid
  }
}

/**
 * Tool Result Value Object
 */
export class ToolResult {
  private constructor(
    private readonly _output: any,
    private readonly _success: boolean,
    private readonly _errorMessage?: string
  ) {}

  static success(output: any): ToolResult {
    return new ToolResult(output, true);
  }

  static failure(errorMessage: string, output?: any): ToolResult {
    return new ToolResult(output, false, errorMessage);
  }

  get output(): any {
    return this._output;
  }

  get success(): boolean {
    return this._success;
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  isSuccess(): boolean {
    return this._success;
  }

  isFailure(): boolean {
    return !this._success;
  }

  hasOutput(): boolean {
    return this._output !== null && this._output !== undefined;
  }

  /**
   * Business rule: Check if result contains meaningful data
   */
  hasMeaningfulOutput(): boolean {
    if (!this.hasOutput()) return false;
    
    if (typeof this._output === 'string') {
      return this._output.trim().length > 0;
    }
    
    if (Array.isArray(this._output)) {
      return this._output.length > 0;
    }
    
    if (typeof this._output === 'object') {
      return Object.keys(this._output).length > 0;
    }
    
    return true;
  }

  /**
   * Business rule: Check if failure is recoverable
   */
  isRecoverableFailure(): boolean {
    if (this._success) return false;
    
    // Check for common recoverable errors
    const recoverablePatterns = [
      'file not found',
      'permission denied',
      'connection timeout',
      'rate limit',
      'temporary error'
    ];
    
    if (!this._errorMessage) return false;
    
    const errorLower = this._errorMessage.toLowerCase();
    return recoverablePatterns.some(pattern => errorLower.includes(pattern));
  }
}

/**
 * Tool Execution Entity - Core business object representing a tool execution
 */
export class ToolExecution {
  private readonly _executionId: string;
  private readonly _toolName: ToolName;
  private readonly _arguments: ToolArguments;
  private readonly _startTime: Date;
  private _status: ExecutionStatus;
  private _endTime?: Date;
  private _result?: ToolResult;
  private _duration: ExecutionDuration;

  constructor(
    executionId: string,
    toolName: ToolName,
    arguments_: ToolArguments,
    startTime: Date = new Date()
  ) {
    this.validateInputs(executionId);
    
    this._executionId = executionId;
    this._toolName = toolName;
    this._arguments = arguments_;
    this._startTime = new Date(startTime);
    this._status = ExecutionStatus.pending();
    this._duration = ExecutionDuration.zero();
  }

  // Getters
  get executionId(): string {
    return this._executionId;
  }

  get toolName(): ToolName {
    return this._toolName;
  }

  get arguments(): ToolArguments {
    return this._arguments;
  }

  get startTime(): Date {
    return new Date(this._startTime);
  }

  get status(): ExecutionStatus {
    return this._status;
  }

  get endTime(): Date | undefined {
    return this._endTime ? new Date(this._endTime) : undefined;
  }

  get result(): ToolResult | undefined {
    return this._result;
  }

  get duration(): ExecutionDuration {
    return this._duration;
  }

  // Business methods

  /**
   * Start the tool execution
   */
  start(): ToolExecution {
    if (!this._status.isPending()) {
      throw new Error(`Cannot start execution in ${this._status.value} state`);
    }
    
    const newExecution = this.clone();
    newExecution._status = ExecutionStatus.running();
    return newExecution;
  }

  /**
   * Complete the tool execution with success
   */
  completeSuccess(result: any): ToolExecution {
    if (!this._status.isRunning()) {
      throw new Error(`Cannot complete execution in ${this._status.value} state`);
    }
    
    const newExecution = this.clone();
    newExecution._status = ExecutionStatus.success();
    newExecution._result = ToolResult.success(result);
    newExecution._endTime = new Date();
    newExecution._duration = ExecutionDuration.create(
      newExecution._endTime.getTime() - this._startTime.getTime()
    );
    
    return newExecution;
  }

  /**
   * Complete the tool execution with failure
   */
  completeFailure(errorMessage: string, output?: any): ToolExecution {
    if (!this._status.isRunning()) {
      throw new Error(`Cannot complete execution in ${this._status.value} state`);
    }
    
    const newExecution = this.clone();
    newExecution._status = ExecutionStatus.failure();
    newExecution._result = ToolResult.failure(errorMessage, output);
    newExecution._endTime = new Date();
    newExecution._duration = ExecutionDuration.create(
      newExecution._endTime.getTime() - this._startTime.getTime()
    );
    
    return newExecution;
  }

  /**
   * Mark execution as timed out
   */
  timeout(): ToolExecution {
    if (this._status.isCompleted()) {
      return this; // Already completed
    }
    
    const newExecution = this.clone();
    newExecution._status = ExecutionStatus.timeout();
    newExecution._result = ToolResult.failure('Execution timed out');
    newExecution._endTime = new Date();
    newExecution._duration = ExecutionDuration.create(
      newExecution._endTime.getTime() - this._startTime.getTime()
    );
    
    return newExecution;
  }

  /**
   * Business rule: Check if execution is taking too long
   */
  isRunningTooLong(maxDurationMs: number = 60000): boolean {
    if (!this._status.isRunning()) {
      return false;
    }
    
    const currentDuration = new Date().getTime() - this._startTime.getTime();
    return currentDuration > maxDurationMs;
  }

  /**
   * Business rule: Check if execution is successful and meaningful
   */
  isSuccessfulWithMeaningfulOutput(): boolean {
    return this._status.isSuccessful() && 
           this._result?.isSuccess() === true && 
           this._result.hasMeaningfulOutput();
  }

  /**
   * Business rule: Check if execution failed but might be recoverable
   */
  isRecoverableFailure(): boolean {
    return this._status.isFailed() && this._result?.isRecoverableFailure() === true;
  }

  /**
   * Business rule: Calculate execution efficiency score
   */
  calculateEfficiencyScore(): number {
    if (!this._status.isCompleted()) {
      return 0;
    }
    
    let score = 0;
    
    // Success contributes heavily to efficiency
    if (this._status.isSuccessful()) {
      score += 0.6;
    }
    
    // Meaningful output adds to efficiency
    if (this._result?.hasMeaningfulOutput()) {
      score += 0.2;
    }
    
    // Fast execution adds to efficiency
    if (!this._duration.isSlowExecution()) {
      score += 0.2;
    }
    
    return score;
  }

  /**
   * Business rule: Get execution insights for improvement
   */
  getExecutionInsights(): string[] {
    const insights: string[] = [];
    
    if (this._status.isSuccessful()) {
      if (this._duration.isSlowExecution()) {
        insights.push('Execution was slow - consider optimization');
      }
      
      if (this._result && !this._result.hasMeaningfulOutput()) {
        insights.push('Tool succeeded but provided no meaningful output');
      }
    }
    
    if (this._status.isFailed()) {
      if (this.isRecoverableFailure()) {
        insights.push('Failure appears recoverable - retry may succeed');
      }
      
      if (this._status.value === 'timeout') {
        insights.push('Execution timed out - consider increasing timeout or optimizing tool');
      }
    }
    
    if (!this._arguments.areValidFor(this._toolName)) {
      insights.push('Arguments may not be appropriate for this tool type');
    }
    
    return insights;
  }

  private clone(): ToolExecution {
    const newExecution = new ToolExecution(
      this._executionId,
      this._toolName,
      this._arguments,
      this._startTime
    );
    newExecution._status = this._status;
    newExecution._endTime = this._endTime;
    newExecution._result = this._result;
    newExecution._duration = this._duration;
    
    return newExecution;
  }

  private validateInputs(executionId: string): void {
    if (!executionId || executionId.trim().length === 0) {
      throw new Error('Execution ID cannot be empty');
    }
  }

  // Factory methods
  
  static createPending(toolName: string, arguments_: Record<string, any>): ToolExecution {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return new ToolExecution(
      executionId,
      ToolName.create(toolName),
      ToolArguments.create(arguments_)
    );
  }
}

/**
 * Configuration interface for external systems
 */
export interface ToolExecutionConfiguration {
  executionId: string;
  toolName: string;
  arguments: Record<string, any>;
  startTime: string;
  status: string;
  endTime?: string;
  result?: {
    output: any;
    success: boolean;
    errorMessage?: string;
  };
  duration: number;
}