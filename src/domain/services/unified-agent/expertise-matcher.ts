import { IAgent, AgentTask } from './agent-types.js';

/**
 * Matches agents to tasks based on expertise domains.
 * This is a simplified placeholder for the legacy matching logic.
 */
export class ExpertiseMatcher {
  matchAgents(task: AgentTask, agents: IAgent[]): IAgent[] {
    // TODO: implement real expertise matching using historical performance
    return agents;
  }
}
