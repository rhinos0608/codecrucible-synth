/**
 * Execution Value Objects
 * Pure value objects for execution domain
 *
 * Living Spiral Council Applied:
 * - Value objects encapsulate simple domain concepts
 * - Immutable data structures with validation
 * - No dependencies on infrastructure
 */

/**
 * Execution ID Value Object
 */
export class ExecutionId {
  private constructor(private readonly _value: string) {
    this.validateId(_value);
  }

  static create(value: string): ExecutionId {
    return new ExecutionId(value);
  }

  static generate(): ExecutionId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return new ExecutionId(`exec_${timestamp}_${random}`);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ExecutionId): boolean {
    return this._value === other._value;
  }

  private validateId(id: string): void {
    if (!id || id.trim().length === 0) {
      throw new Error('Execution ID cannot be empty');
    }
    
    if (id.length > 100) {
      throw new Error('Execution ID too long (max 100 characters)');
    }
  }
}

/**
 * Task Description Value Object
 */
export class TaskDescription {
  private constructor(private readonly _value: string) {
    this.validateDescription(_value);
  }

  static create(value: string): TaskDescription {
    return new TaskDescription(value.trim());
  }

  get value(): string {
    return this._value;
  }

  get length(): number {
    return this._value.length;
  }

  get truncated(): string {
    return this._value.length > 100 
      ? `${this._value.substring(0, 100)}...` 
      : this._value;
  }

  equals(other: TaskDescription): boolean {
    return this._value === other._value;
  }

  contains(keyword: string): boolean {
    return this._value.toLowerCase().includes(keyword.toLowerCase());
  }

  private validateDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      throw new Error('Task description cannot be empty');
    }
  }
}

/**
 * Error Message Value Object
 */
export class ErrorMessage {
  private constructor(private readonly _message: string, private readonly _code?: string) {
    this.validateMessage(_message);
  }

  static create(message: string, code?: string): ErrorMessage {
    return new ErrorMessage(message.trim(), code);
  }

  static fromError(error: Error): ErrorMessage {
    return new ErrorMessage(error.message, error.name);
  }

  get message(): string {
    return this._message;
  }

  get code(): string | undefined {
    return this._code;
  }

  get hasCode(): boolean {
    return !!this._code;
  }

  equals(other: ErrorMessage): boolean {
    return this._message === other._message && this._code === other._code;
  }

  /**
   * Business rule: Check if error indicates a recoverable failure
   */
  isRecoverable(): boolean {
    const recoverablePatterns = [
      'timeout', 'network', 'temporary', 'retry', 'rate limit',
      'connection', 'unavailable', 'busy'
    ];
    
    const lowerMessage = this._message.toLowerCase();
    return recoverablePatterns.some(pattern => lowerMessage.includes(pattern));
  }

  /**
   * Business rule: Check if error indicates a user input problem
   */
  isUserInputError(): boolean {
    const inputErrorPatterns = [
      'invalid', 'missing', 'required', 'format', 'syntax',
      'not found', 'permission denied', 'unauthorized'
    ];
    
    const lowerMessage = this._message.toLowerCase();
    return inputErrorPatterns.some(pattern => lowerMessage.includes(pattern));
  }

  private validateMessage(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new Error('Error message cannot be empty');
    }
  }
}

/**
 * Timestamp Value Object
 */
export class Timestamp {
  private constructor(private readonly _date: Date) {}

  static create(date: Date = new Date()): Timestamp {
    return new Timestamp(new Date(date));
  }

  static fromString(dateString: string): Timestamp {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date string');
    }
    return new Timestamp(date);
  }

  static fromMilliseconds(ms: number): Timestamp {
    return new Timestamp(new Date(ms));
  }

  get date(): Date {
    return new Date(this._date);
  }

  get milliseconds(): number {
    return this._date.getTime();
  }

  get isoString(): string {
    return this._date.toISOString();
  }

  equals(other: Timestamp): boolean {
    return this._date.getTime() === other._date.getTime();
  }

  isAfter(other: Timestamp): boolean {
    return this._date.getTime() > other._date.getTime();
  }

  isBefore(other: Timestamp): boolean {
    return this._date.getTime() < other._date.getTime();
  }

  /**
   * Business rule: Check if timestamp is recent (within given milliseconds)
   */
  isRecent(withinMs: number = 300000): boolean { // Default 5 minutes
    const now = Date.now();
    return (now - this._date.getTime()) <= withinMs;
  }

  /**
   * Business rule: Check if timestamp indicates a stale operation
   */
  isStale(staleAfterMs: number = 3600000): boolean { // Default 1 hour
    const now = Date.now();
    return (now - this._date.getTime()) > staleAfterMs;
  }

  /**
   * Calculate duration from this timestamp to another
   */
  durationTo(other: Timestamp): Duration {
    const diffMs = Math.abs(other._date.getTime() - this._date.getTime());
    return Duration.fromMilliseconds(diffMs);
  }
}

/**
 * Duration Value Object
 */
export class Duration {
  private constructor(private readonly _milliseconds: number) {
    this.validateDuration(_milliseconds);
  }

  static create(milliseconds: number): Duration {
    return new Duration(milliseconds);
  }

  static fromSeconds(seconds: number): Duration {
    return new Duration(seconds * 1000);
  }

  static fromMinutes(minutes: number): Duration {
    return new Duration(minutes * 60 * 1000);
  }

  static fromMilliseconds(milliseconds: number): Duration {
    return new Duration(milliseconds);
  }

  static zero(): Duration {
    return new Duration(0);
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

  get hours(): number {
    return this._milliseconds / (1000 * 60 * 60);
  }

  equals(other: Duration): boolean {
    return this._milliseconds === other._milliseconds;
  }

  isLongerThan(other: Duration): boolean {
    return this._milliseconds > other._milliseconds;
  }

  isShorterThan(other: Duration): boolean {
    return this._milliseconds < other._milliseconds;
  }

  add(other: Duration): Duration {
    return new Duration(this._milliseconds + other._milliseconds);
  }

  subtract(other: Duration): Duration {
    return new Duration(Math.max(0, this._milliseconds - other._milliseconds));
  }

  multiply(factor: number): Duration {
    if (factor < 0) {
      throw new Error('Duration multiplication factor cannot be negative');
    }
    return new Duration(this._milliseconds * factor);
  }

  /**
   * Business rule: Check if duration indicates a slow operation
   */
  isSlowOperation(): boolean {
    return this._milliseconds > 30000; // > 30 seconds
  }

  /**
   * Business rule: Check if duration is within acceptable limits
   */
  isAcceptable(maxMs: number): boolean {
    return this._milliseconds <= maxMs;
  }

  /**
   * Business rule: Check if duration indicates a timeout risk
   */
  isNearTimeout(timeoutMs: number, threshold: number = 0.8): boolean {
    return this._milliseconds > (timeoutMs * threshold);
  }

  toString(): string {
    if (this._milliseconds < 1000) {
      return `${this._milliseconds}ms`;
    } else if (this._milliseconds < 60000) {
      return `${Math.round(this.seconds * 10) / 10}s`;
    } else if (this._milliseconds < 3600000) {
      return `${Math.round(this.minutes * 10) / 10}min`;
    } else {
      return `${Math.round(this.hours * 10) / 10}h`;
    }
  }

  private validateDuration(milliseconds: number): void {
    if (milliseconds < 0) {
      throw new Error('Duration cannot be negative');
    }
  }
}

/**
 * Resource Identifier Value Object
 */
export class ResourceIdentifier {
  private constructor(
    private readonly _type: string,
    private readonly _id: string
  ) {
    this.validateInputs(_type, _id);
  }

  static create(type: string, id: string): ResourceIdentifier {
    return new ResourceIdentifier(type.toLowerCase(), id);
  }

  static tool(toolName: string): ResourceIdentifier {
    return new ResourceIdentifier('tool', toolName);
  }

  static model(modelName: string): ResourceIdentifier {
    return new ResourceIdentifier('model', modelName);
  }

  static execution(executionId: string): ResourceIdentifier {
    return new ResourceIdentifier('execution', executionId);
  }

  get type(): string {
    return this._type;
  }

  get id(): string {
    return this._id;
  }

  get fullId(): string {
    return `${this._type}:${this._id}`;
  }

  equals(other: ResourceIdentifier): boolean {
    return this._type === other._type && this._id === other._id;
  }

  isTool(): boolean {
    return this._type === 'tool';
  }

  isModel(): boolean {
    return this._type === 'model';
  }

  isExecution(): boolean {
    return this._type === 'execution';
  }

  toString(): string {
    return this.fullId;
  }

  private validateInputs(type: string, id: string): void {
    if (!type || type.trim().length === 0) {
      throw new Error('Resource type cannot be empty');
    }
    
    if (!id || id.trim().length === 0) {
      throw new Error('Resource ID cannot be empty');
    }
    
    const validTypes = ['tool', 'model', 'execution', 'plan', 'workflow', 'step'];
    if (!validTypes.includes(type.toLowerCase())) {
      throw new Error(`Invalid resource type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }
}

/**
 * Quality Score Value Object
 */
export class QualityScore {
  private constructor(private readonly _value: number) {
    this.validateScore(_value);
  }

  static create(value: number): QualityScore {
    return new QualityScore(value);
  }

  static excellent(): QualityScore {
    return new QualityScore(0.95);
  }

  static good(): QualityScore {
    return new QualityScore(0.8);
  }

  static acceptable(): QualityScore {
    return new QualityScore(0.6);
  }

  static poor(): QualityScore {
    return new QualityScore(0.3);
  }

  get value(): number {
    return this._value;
  }

  equals(other: QualityScore): boolean {
    return Math.abs(this._value - other._value) < 0.001;
  }

  isHighQuality(): boolean {
    return this._value >= 0.8;
  }

  isAcceptable(): boolean {
    return this._value >= 0.6;
  }

  isPoor(): boolean {
    return this._value < 0.5;
  }

  isGreaterThan(other: QualityScore): boolean {
    return this._value > other._value;
  }

  isLessThan(other: QualityScore): boolean {
    return this._value < other._value;
  }

  /**
   * Business rule: Calculate weighted average with another quality score
   */
  weightedAverage(other: QualityScore, thisWeight: number = 0.5): QualityScore {
    if (thisWeight < 0 || thisWeight > 1) {
      throw new Error('Weight must be between 0 and 1');
    }
    
    const otherWeight = 1 - thisWeight;
    const average = (this._value * thisWeight) + (other._value * otherWeight);
    
    return new QualityScore(average);
  }

  toString(): string {
    return `${Math.round(this._value * 100)}%`;
  }

  private validateScore(score: number): void {
    if (score < 0 || score > 1) {
      throw new Error('Quality score must be between 0 and 1');
    }
  }
}