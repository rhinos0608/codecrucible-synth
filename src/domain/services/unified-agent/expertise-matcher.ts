import { IAgent, AgentTask } from './agent-types.js';

/**
 * Matches agents to tasks based on expertise domains.
 * This is a simplified placeholder for the legacy matching logic.
 */
export class ExpertiseMatcher {
  matchAgents(task: AgentTask, agents: IAgent[]): IAgent[] {
    // Basic expertise matching: filter agents whose expertise matches the task's required domains.
    if (!task.expertiseDomains || !Array.isArray(task.expertiseDomains)) {
      throw new Error('Task does not specify required expertise domains. Expertise matching cannot be performed.');
    }
    return agents.filter(agent =>
      Array.isArray(agent.expertiseDomains) &&
      agent.expertiseDomains.some(domain => task.expertiseDomains.includes(domain))
    );
  }
}
