import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { logger } from '../logging/logger.js';
import { validateCommand } from '../../utils/command-security.js';
import { rustStreamingClient } from '../streaming/rust-streaming-client.js';
import type { StreamChunk, StreamProcessor } from '../streaming/stream-chunk-protocol.js';

const RustProcessSchema = z.object({
  action: z.enum(['start', 'read', 'list', 'kill', 'status', 'interact']),
  sessionId: z.string().optional(),
  command: z.string().optional(),
  input: z.string().optional(),
  timeout: z.number().optional().default(30000),
  interactive: z.boolean().optional().default(false),
});

export type RustProcessArgs = z.infer<typeof RustProcessSchema>;

interface Session {
  id: string;
  command: string;
  startTime: number;
  lastActivity: number;
  output: string[];
  interactive: boolean;
}

export class RustProcessManager extends BaseTool<typeof RustProcessSchema.shape> {
  private sessions = new Map<string, Session>();

  public constructor(private readonly ctx: Readonly<{ workingDirectory: string }>) {
    super({ name: 'rustProcessManager', description: 'Process manager backed by Rust streaming', category: 'Process Management', parameters: RustProcessSchema });
  }

  public getParameterSchema() { return RustProcessSchema; }

  public async execute(args: Readonly<RustProcessArgs>): Promise<unknown> {
    switch (args.action) {
      case 'start':
        return this.start(args);
      case 'read':
        return this.read(args);
      case 'list':
        return this.list();
      case 'kill':
        return this.kill(args);
      case 'status':
        return this.status(args);
      case 'interact':
        return this.interact(args);
      default:
        return { error: `Unknown action ${String(args.action)}` };
    }
  }

  private async start(args: Readonly<RustProcessArgs>): Promise<unknown> {
    if (!args.command) return { error: 'command is required' };
    const valid = validateCommand(args.command);
    if (!valid.isValid) return { error: `SECURITY BLOCKED: ${valid.reason}` };
    const [cmd, ...cmdArgs] = args.command.split(' ');

    const buffer: string[] = [];
    const processor: StreamProcessor = {
      processChunk: async (c: Readonly<StreamChunk>) => {
        const t = typeof c.data === 'string' ? c.data : (c.data as Buffer).toString('utf8');
        const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
        buffer.push(...lines);
      },
      onCompleted: async () => {},
      onError: async (e: string) => { buffer.push(`[ERROR] ${e}`); },
      onBackpressure: async () => {},
    };

    const streamId = await rustStreamingClient.streamCommand(cmd, cmdArgs, processor, { timeoutMs: args.timeout ?? 30000 });
    const session: Session = { id: streamId, command: args.command, startTime: Date.now(), lastActivity: Date.now(), output: buffer, interactive: !!args.interactive };
    this.sessions.set(streamId, session);
    await this.waitForOutput(session, args.timeout ?? 30000);
    return { success: true, sessionId: streamId, command: args.command, initialOutput: buffer.slice(0, 10).join('\n'), isRunning: true, interactive: !!args.interactive };
  }

  private async waitForOutput(s: Session, timeout: number): Promise<void> {
    const start = Date.now();
    return new Promise(res => {
      const tick = () => {
        if (s.output.length > 0 || Date.now() - start >= timeout) return res();
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  private read(args: Readonly<RustProcessArgs>): unknown {
    if (!args.sessionId) return { error: 'sessionId is required' };
    const s = this.sessions.get(args.sessionId);
    if (!s) return { error: `Session not found: ${args.sessionId}` };
    return { sessionId: s.id, command: s.command, isRunning: true, startTime: new Date(s.startTime).toISOString(), lastActivity: new Date(s.lastActivity).toISOString(), uptime: Date.now() - s.startTime, outputLines: s.output.length, recentOutput: s.output.slice(-50).join('\n'), isInteractive: s.interactive };
  }

  private async interact(args: Readonly<RustProcessArgs>): Promise<unknown> {
    if (!args.sessionId) return { error: 'sessionId is required' };
    const s = this.sessions.get(args.sessionId);
    if (!s) return { error: `Session not found: ${args.sessionId}` };
    if (!args.input) return { error: 'input is required' };
    const ok = await rustStreamingClient.sendInput(args.sessionId, args.input);
    if (!ok) return { error: 'Rust streaming does not support interactive input on this platform' };
    const initial = s.output.length;
    await this.waitForOutput(s, args.timeout ?? 5000);
    const newLines = s.output.slice(initial);
    return { success: true, sessionId: s.id, input: args.input, output: newLines.join('\n'), newLines: newLines.length, totalLines: s.output.length };
  }

  private list(): unknown {
    const sessions = Array.from(this.sessions.values()).map(s => ({ id: s.id, command: s.command, isRunning: true, pid: 0, uptime: Date.now() - s.startTime, lastActivity: new Date(s.lastActivity).toISOString(), isInteractive: s.interactive }));
    return { totalSessions: sessions.length, runningSessions: sessions.filter(x => x.isRunning).length, sessions };
  }

  private async kill(args: Readonly<RustProcessArgs>): Promise<unknown> {
    if (!args.sessionId) return { error: 'sessionId is required' };
    await rustStreamingClient.cancelStream(args.sessionId);
    this.sessions.delete(args.sessionId);
    return { success: true, sessionId: args.sessionId };
  }

  private status(args: Readonly<RustProcessArgs>): unknown {
    if (!args.sessionId) return { error: 'sessionId is required' };
    const s = this.sessions.get(args.sessionId);
    if (!s) return { error: `Session ${args.sessionId} not found` };
    return { sessionId: s.id, command: s.command, pid: 0, isRunning: true, startTime: new Date(s.startTime).toISOString(), lastActivity: new Date(s.lastActivity).toISOString(), uptime: Date.now() - s.startTime, outputLines: s.output.length, recentOutput: s.output.slice(-10).join('\n'), isInteractive: s.interactive };
  }
}

export default RustProcessManager;
