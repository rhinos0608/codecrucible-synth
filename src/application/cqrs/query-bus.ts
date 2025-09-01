export interface Query<TPayload = any> {
  type: string;
  payload: TPayload;
}

export interface QueryHandler<TPayload = any, TResult = any> {
  type: string;
  handle(query: Query<TPayload>): Promise<TResult> | TResult;
}

export type QueryMiddleware = (
  query: Query,
  next: () => Promise<any>
) => Promise<any>;

export class QueryBus {
  private handlers = new Map<string, QueryHandler<any, any>>();
  private middleware: QueryMiddleware[] = [];

  register(handler: QueryHandler<any, any>): void {
    this.handlers.set(handler.type, handler);
  }

  use(mw: QueryMiddleware): void {
    this.middleware.push(mw);
  }

  async execute<T = any>(query: Query): Promise<T> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`No query handler registered for type: ${query.type}`);
    }

    const invoke: () => Promise<any> = async () => handler.handle(query);
    let pipeline: () => Promise<any> = invoke;
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const mw = this.middleware[i];
      const next = pipeline;
      pipeline = () => mw(query, next);
    }
    return await pipeline();
  }
}
