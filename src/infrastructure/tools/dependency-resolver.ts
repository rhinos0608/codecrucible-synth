import { logger } from '../logging/logger.js';

export interface ToolDependencies {
  [toolId: string]: string[];
}

export class DependencyResolver {
  private dependencies: ToolDependencies = {};

  register(toolId: string, deps: string[] = []): void {
    this.dependencies[toolId] = deps;
  }

  resolveOrder(toolIds: string[]): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string, stack: Set<string>) => {
      if (stack.has(id)) {
        throw new Error(`Circular dependency detected: ${id}`);
      }
      if (visited.has(id)) {
        return;
      }
      stack.add(id);
      for (const dep of this.dependencies[id] || []) {
        visit(dep, stack);
      }
      stack.delete(id);
      visited.add(id);
      order.push(id);
    };

    toolIds.forEach(id => visit(id, new Set()));
    logger.debug('Resolved dependency order', { order });
    return order;
  }
}
