import { IAgent, AgentFeedback } from './agent-types.js';

/**
 * Handles agent feedback and learning updates.
 */
export class FeedbackProcessor {
  async process(agent: IAgent, feedback: AgentFeedback): Promise<void> {
    // Placeholder for persisting feedback and updating agent state
    await agent.learn(feedback);
  }
}
