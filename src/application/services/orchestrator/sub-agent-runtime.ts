import type { IModelClient } from '../../../domain/interfaces/model-client.js';
import type { IMcpManager } from '../../../domain/interfaces/mcp-manager.js';
import { SubAgentOrchestrator, SubAgentOptions } from './sub-agent-orchestrator.js';

let modelClientRef: IModelClient | null = null;
let mcpManagerRef: IMcpManager | null = null;

export function setSubAgentDependencies(modelClient: IModelClient, mcpManager: IMcpManager): void {
  modelClientRef = modelClient;
  mcpManagerRef = mcpManager;
}

export async function runSubAgent(goal: string, options?: Readonly<SubAgentOptions>): Promise<{
  success: boolean;
  content: string;
  steps: Array<{ action: string; result: unknown }>;
}> {
  if (!modelClientRef || !mcpManagerRef) {
    throw new Error('SubAgent dependencies not initialized');
  }
  const agent = new SubAgentOrchestrator(modelClientRef, mcpManagerRef);
  return agent.run(goal, options);
}

