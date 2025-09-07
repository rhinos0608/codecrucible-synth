export type DependencyHandler = (...args: unknown[]) => Promise<unknown>;

/**
 * DependencyResolver registers and resolves workflow dependencies such as
 * plugin commands or external services.
 */
export class DependencyResolver {
  private readonly handlers = new Map<string, DependencyHandler>();

  public register(name: string, handler: DependencyHandler): void {
    this.handlers.set(name, handler);
  }

  public resolve(name: string): DependencyHandler | undefined {
    return this.handlers.get(name);
  }
}
