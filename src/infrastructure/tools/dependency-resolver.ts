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

    const visit = (id: string, stack: string[]) => {
      if (stack.includes(id)) {
        const cyclePath = [...stack, id].join(' -> ');
        throw new Error(`Circular dependency detected: ${cyclePath}`);
      }
      if (visited.has(id)) {
        return;
      }
      stack.push(id);
      for (const dep of this.dependencies[id] || []) {
        visit(dep, stack);
      }
      stack.pop();
      visited.add(id);
      order.push(id);
    };

    toolIds.forEach(id => visit(id, []));
    logger.debug('Resolved dependency order', { order });
    return order;
  }
}
