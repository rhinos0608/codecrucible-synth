/**
 * Voice Value Objects
 * Immutable domain values for voice configuration
 * 
 * Living Spiral Council Applied:
 * - Immutable value objects with built-in validation
 * - Type safety and business rule enforcement
 * - No external dependencies
 */

/**
 * Voice Style Value Object
 * Represents the behavioral style of a voice archetype
 */
export class VoiceStyle {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  static create(style: string): VoiceStyle {
    const normalizedStyle = style.toLowerCase().trim();
    
    if (!this.isValidStyle(normalizedStyle)) {
      throw new Error(
        `Invalid voice style: ${style}. Must be one of: ${this.getValidStyles().join(', ')}`
      );
    }

    return new VoiceStyle(normalizedStyle);
  }

  static experimental(): VoiceStyle {
    return new VoiceStyle('experimental');
  }

  static conservative(): VoiceStyle {
    return new VoiceStyle('conservative');
  }

  static analytical(): VoiceStyle {
    return new VoiceStyle('analytical');
  }

  static systematic(): VoiceStyle {
    return new VoiceStyle('systematic');
  }

  static creative(): VoiceStyle {
    return new VoiceStyle('creative');
  }

  static practical(): VoiceStyle {
    return new VoiceStyle('practical');
  }

  private static isValidStyle(style: string): boolean {
    return this.getValidStyles().includes(style);
  }

  private static getValidStyles(): string[] {
    return [
      'experimental',
      'conservative', 
      'analytical',
      'systematic',
      'creative',
      'practical'
    ];
  }

  equals(other: VoiceStyle): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * Voice Temperature Value Object
 * Represents the creativity/randomness level of a voice (0.0 to 1.0)
 */
export class VoiceTemperature {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  get value(): number {
    return this._value;
  }

  static create(temperature: number): VoiceTemperature {
    if (!this.isValidTemperature(temperature)) {
      throw new Error(
        `Invalid voice temperature: ${temperature}. Must be between 0.0 and 1.0`
      );
    }

    return new VoiceTemperature(Number(temperature.toFixed(2)));
  }

  static conservative(): VoiceTemperature {
    return new VoiceTemperature(0.3);
  }

  static balanced(): VoiceTemperature {
    return new VoiceTemperature(0.6);
  }

  static creative(): VoiceTemperature {
    return new VoiceTemperature(0.9);
  }

  private static isValidTemperature(temperature: number): boolean {
    return typeof temperature === 'number' &&
           !isNaN(temperature) &&
           temperature >= 0.0 &&
           temperature <= 1.0;
  }

  /**
   * Check if this temperature is suitable for creative tasks
   */
  isCreative(): boolean {
    return this._value >= 0.7;
  }

  /**
   * Check if this temperature is suitable for analytical tasks
   */
  isAnalytical(): boolean {
    return this._value <= 0.5;
  }

  /**
   * Check if this temperature is balanced
   */
  isBalanced(): boolean {
    return this._value > 0.5 && this._value < 0.7;
  }

  equals(other: VoiceTemperature): boolean {
    return Math.abs(this._value - other._value) < 0.01;
  }

  toString(): string {
    return this._value.toFixed(2);
  }
}

/**
 * Provider Type Value Object
 * Represents the type of AI model provider
 */
export class ProviderType {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  static create(type: string): ProviderType {
    const normalizedType = type.toLowerCase().trim();
    
    if (!this.isValidType(normalizedType)) {
      throw new Error(
        `Invalid provider type: ${type}. Must be one of: ${this.getValidTypes().join(', ')}`
      );
    }

    return new ProviderType(normalizedType);
  }

  static ollama(): ProviderType {
    return new ProviderType('ollama');
  }

  static lmStudio(): ProviderType {
    return new ProviderType('lm-studio');
  }

  static huggingface(): ProviderType {
    return new ProviderType('huggingface');
  }

  static auto(): ProviderType {
    return new ProviderType('auto');
  }

  private static isValidType(type: string): boolean {
    return this.getValidTypes().includes(type);
  }

  private static getValidTypes(): string[] {
    return ['ollama', 'lm-studio', 'huggingface', 'auto'];
  }

  equals(other: ProviderType): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * Model Name Value Object
 * Represents a validated AI model name
 */
export class ModelName {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  static create(name: string): ModelName {
    const trimmedName = name.trim();
    
    if (!trimmedName || trimmedName.length === 0) {
      throw new Error('Model name cannot be empty');
    }

    if (trimmedName.length > 100) {
      throw new Error('Model name cannot exceed 100 characters');
    }

    if (!/^[a-zA-Z0-9\-_:.\/]+$/.test(trimmedName)) {
      throw new Error(
        'Model name can only contain letters, numbers, hyphens, underscores, colons, dots, and forward slashes'
      );
    }

    return new ModelName(trimmedName);
  }

  equals(other: ModelName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * Request Priority Value Object
 * Represents the priority level of a processing request
 */
export class RequestPriority {
  private readonly _value: string;
  private readonly _numericValue: number;

  private constructor(value: string, numericValue: number) {
    this._value = value;
    this._numericValue = numericValue;
  }

  get value(): string {
    return this._value;
  }

  get numericValue(): number {
    return this._numericValue;
  }

  static create(priority: string): RequestPriority {
    const normalizedPriority = priority.toLowerCase().trim();
    
    switch (normalizedPriority) {
      case 'low':
        return new RequestPriority('low', 1);
      case 'medium':
        return new RequestPriority('medium', 2);
      case 'high':
        return new RequestPriority('high', 3);
      case 'critical':
        return new RequestPriority('critical', 4);
      default:
        throw new Error(
          `Invalid priority: ${priority}. Must be one of: low, medium, high, critical`
        );
    }
  }

  static low(): RequestPriority {
    return new RequestPriority('low', 1);
  }

  static medium(): RequestPriority {
    return new RequestPriority('medium', 2);
  }

  static high(): RequestPriority {
    return new RequestPriority('high', 3);
  }

  static critical(): RequestPriority {
    return new RequestPriority('critical', 4);
  }

  isHigherThan(other: RequestPriority): boolean {
    return this._numericValue > other._numericValue;
  }

  equals(other: RequestPriority): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}