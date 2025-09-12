import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { InteractionManager } from './interaction-manager.js';
import { CommandParser } from './command-parser.js';
import { CLISession, SessionManager } from './session-manager.js';
import { UnifiedCLICoordinator, CLIOperationRequest } from '../services/unified-cli-coordinator.js';

export type SessionMode = 'interactive' | 'command';

export interface ModeChangeHandler {
  (mode: SessionMode, session: CLISession | null): void;
}

/**
 * Handles interactive CLI sessions, routing user input through the
 * UnifiedCLICoordinator while tracking session state.
 */
export class InteractiveSessionHandler extends EventEmitter {
  private mode: SessionMode = 'interactive';
  private currentSession: CLISession | null = null;

  public constructor(
    private readonly coordinator: UnifiedCLICoordinator,
    private readonly interaction = new InteractionManager(),
    private readonly sessions = new SessionManager()
  ) {
    super();
  }

  /**
   * Start processing user input until the session ends.
   */
  public async start(): Promise<void> {
    this.currentSession = await Promise.resolve(this.sessions.createSession());
    this.emit('session:start', this.currentSession);

    while (this.mode === 'interactive') {
      const line = await this.interaction.ask('> ');
      const trimmed = line.trim();

      if (this.shouldExit(trimmed)) {
        this.switchMode('command');
        break;
      }

      if (trimmed.length === 0) continue;

      this.sessions.record(this.currentSession.id, trimmed);
      this.emit('command', trimmed);

      const request: CLIOperationRequest = {
        id: randomUUID(),
        type: 'prompt',
        input: trimmed,
        session: this.currentSession,
      };

      try {
        await this.coordinator.processOperation(request);
      } catch (error) {
        this.emit('error', error);
      }
    }

    if (this.currentSession) {
      this.sessions.endSession(this.currentSession.id);
      this.emit('session:end', this.currentSession);
      this.currentSession = null;
    }

    this.interaction.close();
  }

  public onModeChange(handler: ModeChangeHandler): void {
    this.on('modeChanged', handler);
  }

  public getMode(): SessionMode {
    return this.mode;
  }

  public switchMode(mode: SessionMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.emit('modeChanged', mode, this.currentSession);
    }
  }

  private shouldExit(line: string): boolean {
    const intent = CommandParser.parseInput(line).intent;
    return intent === 'exit';
  }
}
