import { logger } from '../logging/unified-logger.js';
import { toReadonlyRecord } from '../../utils/type-guards.js';
import {
  IWorkflowOrchestrator,
  type WorkflowRequest,
} from '../../domain/interfaces/workflow-orchestrator.js';

export interface PromptClassification {
  intent: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export class PromptIntentClassifier {
  public constructor(private readonly orchestrator: IWorkflowOrchestrator) {}

  public async classify(prompt: string): Promise<PromptClassification> {
    const request: WorkflowRequest = {
      id: `classify-${Date.now()}`,
      type: 'prompt',
      payload: {
        input: `Classify the user's intent and risk level. Respond with JSON {"intent":string,"riskLevel":"low"|"medium"|"high"}.\nPROMPT:\n${prompt}`,
        options: { stream: false },
      },
    };

    try {
      const response = await this.orchestrator.processRequest(request);
      if (response.success && typeof response.result === 'string') {
        const parsed = JSON.parse(response.result) as PromptClassification;
        if (parsed.intent && parsed.riskLevel) {
          return parsed;
        }
      }
    } catch (error) {
      logger.warn('PromptIntentClassifier failed', toReadonlyRecord(error));
    }

    return { intent: 'unknown', riskLevel: 'medium' };
  }
}

export default PromptIntentClassifier;
