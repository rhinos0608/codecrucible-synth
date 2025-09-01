export interface Command<TPayload = any> {
  type: string;
  payload: TPayload;
}

export interface CommandHandler<TPayload = any, TResult = any> {
  type: string;
  handle(command: Command<TPayload>): Promise<TResult> | TResult;
}

export type CommandMiddleware = (
  command: Command,
  next: () => Promise<any>
) => Promise<any>;

export class CommandBus {
  private handlers = new Map<string, CommandHandler<any, any>>();
  private middleware: CommandMiddleware[] = [];

  register(handler: CommandHandler<any, any>): void {
    this.handlers.set(handler.type, handler);
  }

  use(mw: CommandMiddleware): void {
    this.middleware.push(mw);
  }

  async execute<T = any>(command: Command): Promise<T> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No command handler registered for type: ${command.type}`);
    }

    // Compose middleware pipeline
    const invoke: () => Promise<any> = async () => handler.handle(command);
    let pipeline: () => Promise<any> = invoke;
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const mw = this.middleware[i];
      const next = pipeline;
      pipeline = () => mw(command, next);
    }
    return await pipeline();
  }
}
