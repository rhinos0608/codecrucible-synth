/**
 * Core User Interaction Interfaces
 *
 * These interfaces break circular dependencies by providing abstractions
 * that tools can depend on instead of depending directly on CLI
 */

export interface IUserOutput {
  /**
   * Display a message to the user
   */
  display(message: string, options?: DisplayOptions): Promise<void>;

  /**
   * Display a warning message
   */
  warn(message: string): Promise<void>;

  /**
   * Display an error message
   */
  error(message: string): Promise<void>;

  /**
   * Display a success message
   */
  success(message: string): Promise<void>;

  /**
   * Display progress information
   */
  progress(message: string, progress?: number): Promise<void>;
}

export interface IUserInput {
  /**
   * Prompt the user for input
   */
  prompt(question: string, options?: PromptOptions): Promise<string>;

  /**
   * Prompt the user for confirmation (yes/no)
   */
  confirm(question: string): Promise<boolean>;

  /**
   * Present the user with multiple choices
   */
  select(question: string, choices: string[]): Promise<string>;
}

export interface DisplayOptions {
  type?: 'info' | 'warn' | 'error' | 'success';
  stream?: boolean;
  prefix?: string;
}

export interface PromptOptions {
  defaultValue?: string;
  required?: boolean;
  validation?: (input: string) => boolean | string;
}

/**
 * Combined interface for full user interaction
 */
export interface IUserInteraction extends IUserOutput, IUserInput {}

/**
 * Event-based user interaction for decoupled communication
 */
export interface IUserInteractionEvents {
  emit(event: 'display', message: string, options?: DisplayOptions): void;
  emit(event: 'prompt', question: string, options?: PromptOptions): void;
  emit(event: 'progress', message: string, progress?: number): void;
  on(event: 'display', handler: (message: string, options?: DisplayOptions) => void): void;
  on(event: 'prompt', handler: (question: string, options?: PromptOptions) => void): void;
  on(event: 'progress', handler: (message: string, progress?: number) => void): void;
}
