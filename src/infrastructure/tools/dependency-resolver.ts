import { logger } from '../logging/logger.js';

export interface ToolDependencies {
  [toolId: string]: string[];
}

export class DependencyResolver {
  private dependencies: ToolDependencies = {};

  public register(toolId: string, deps: readonly string[] = []): void {
    this.dependencies[toolId] = [...deps];
  }

  public resolveOrder(toolIds: readonly string[]): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string, stack: readonly string[]): void => {
      if (stack.includes(id)) {
        const cyclePath = [...stack, id].join(' -> ');
        throw new Error(`Circular dependency detected: ${cyclePath}`);
      }
      if (visited.has(id)) {
        return;
      }
      const newStack = [...stack, id];
      for (const dep of this.dependencies[id]) {
        visit(dep, newStack);
      }
      visited.add(id);
      order.push(id);
    };

    toolIds.forEach(id => {
      visit(id, []);
    });
    logger.debug('Resolved dependency order', { order });
    return order;
  }
}
