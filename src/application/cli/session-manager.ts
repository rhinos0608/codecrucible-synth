import { randomUUID } from 'node:crypto';

export interface CLISession {
  id: string;
  startTime: number;
  history: string[];
}

/**
 * SessionManager tracks CLI sessions and their lightweight history. It avoids
 * unbounded memory growth by trimming history to a configurable size.
 */
export class SessionManager {
  private sessions = new Map<string, CLISession>();
  constructor(private historyLimit = 50) {}

  createSession(): CLISession {
    const session: CLISession = {
      id: randomUUID(),
      startTime: Date.now(),
      history: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): CLISession | undefined {
    return this.sessions.get(id);
  }

  endSession(id: string): void {
    this.sessions.delete(id);
  }

  record(id: string, entry: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.history.push(entry);
    if (session.history.length > this.historyLimit) {
      session.history.shift();
    }
  }
}
