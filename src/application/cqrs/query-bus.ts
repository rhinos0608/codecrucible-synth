export interface Query<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface QueryHandler<TPayload = unknown, TResult = unknown> {
  type: string;
  handle: (query: Readonly<Query<TPayload>>) => Promise<TResult> | TResult;
}

export type QueryMiddleware = (
  query: Readonly<Query>,
  next: () => Promise<unknown>
) => Promise<unknown>;

export class QueryBus {
  private readonly handlers = new Map<string, QueryHandler>();
  private readonly middleware: QueryMiddleware[] = [];

  public register(handler: Readonly<QueryHandler>): void {
    this.handlers.set(handler.type, handler);
  }

  public use(mw: QueryMiddleware): void {
    this.middleware.push(mw);
  }

  public async execute<T = unknown>(query: Readonly<Query>): Promise<T> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`No query handler registered for type: ${query.type}`);
    }

    const invoke = async (): Promise<unknown> => handler.handle(query);
    let pipeline: () => Promise<unknown> = invoke;
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const mw = this.middleware[i];
      const next = pipeline;
      pipeline = async (): Promise<unknown> => mw(query, next);
    }
    return (await pipeline()) as T;
  }
}
