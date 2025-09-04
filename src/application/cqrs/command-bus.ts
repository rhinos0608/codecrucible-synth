export interface Command<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface CommandHandler<TPayload = unknown, TResult = unknown> {
  type: string;
  handle: (command: Readonly<Command<TPayload>>) => Promise<TResult> | TResult;
}

export type CommandMiddleware = (
  command: Readonly<Command>,
  next: () => Promise<unknown>
) => Promise<unknown>;

export class CommandBus {
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly middleware: CommandMiddleware[] = [];

  public register(handler: Readonly<CommandHandler<unknown, unknown>>): void {
    this.handlers.set(handler.type, handler as CommandHandler);
  }

  public use(mw: CommandMiddleware): void {
    this.middleware.push(mw);
  }

  public async execute<T = unknown>(command: Readonly<Command>): Promise<T> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No command handler registered for type: ${command.type}`);
    }

    // Compose middleware pipeline
    const invoke: () => Promise<unknown> = async (): Promise<unknown> => handler.handle(command);
    let pipeline: () => Promise<unknown> = invoke;
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const mw = this.middleware[i];
      const next = pipeline;
      pipeline = async (): Promise<unknown> => mw(command, next);
    }
    return await pipeline() as T;
  }
}
