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
  display: (message: Readonly<string>, options?: Readonly<DisplayOptions>) => Promise<void>;

  /**
   * Display a warning message
   */
  warn: (message: Readonly<string>) => Promise<void>;

  /**
   * Display an error message
   */
  error: (message: Readonly<string>) => Promise<void>;

  /**
   * Display a success message
   */
  success: (message: Readonly<string>) => Promise<void>;

  /**
   * Display progress information
   */
  progress: (message: Readonly<string>, progress?: Readonly<number>) => Promise<void>;
}

export interface IUserInput {
  /**
   * Prompt the user for input
   */
  prompt: (question: Readonly<string>, options?: Readonly<PromptOptions>) => Promise<string>;

  /**
   * Prompt the user for confirmation (yes/no)
   */
  confirm: (question: Readonly<string>) => Promise<boolean>;

  /**
   * Present the user with multiple choices
   */
  select: (question: Readonly<string>, choices: ReadonlyArray<string>) => Promise<string>;
}

export interface DisplayOptions {
  type?: 'info' | 'warn' | 'error' | 'success' | 'debug' | 'verbose';
  stream?: boolean;
  prefix?: string;
  final?: boolean; // Indicates this is the final message in a streaming sequence
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
  emit: (event: 'display', message: Readonly<string>, options?: Readonly<DisplayOptions>) => void;
  emitPrompt: (
    event: 'prompt',
    question: Readonly<string>,
    options?: Readonly<PromptOptions>
  ) => void;
  emitProgress: (event: 'progress', message: Readonly<string>, progress?: Readonly<number>) => void;
  onDisplay: (
    event: 'display',
    handler: (message: Readonly<string>, options?: Readonly<DisplayOptions>) => void
  ) => void;
  onPrompt: (
    event: 'prompt',
    handler: (question: Readonly<string>, options?: Readonly<PromptOptions>) => void
  ) => void;
  onProgress: (
    event: 'progress',
    handler: (message: Readonly<string>, progress?: Readonly<number>) => void
  ) => void;
}
