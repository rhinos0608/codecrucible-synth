/**
 * Problem Solver Agent - Uses Living Spiral methodology for complex problem solving
 * Integrates with the existing UnifiedAgent system
 */

import { UnifiedAgent } from '../agent.js';
import { ExecutionRequest, ExecutionResponse } from '../types.js';
import { UnifiedModelClient } from '../client.js';
import { PerformanceMonitor } from '../../utils/performance.js';
import { logger } from '../logger.js';

export class ProblemSolverAgent extends UnifiedAgent {
  constructor(modelClient: UnifiedModelClient, performanceMonitor: PerformanceMonitor) {
    super(modelClient, performanceMonitor);
  }

  async processRequest(input: string): Promise<ExecutionResponse> {
    logger.info('🧩 Problem Solver Agent processing request');
    
    const request: ExecutionRequest = {
      id: `problem-${Date.now()}`,
      input,
      type: 'problem-solving',
      mode: 'quality' // Use quality mode for complex problem solving
    };

    // Use the sophisticated Living Spiral methodology through UnifiedAgent
    const response = await this.execute(request);
    
    // Enhance with problem-solving specific analysis
    if (response.success && response.result) {
      const enhancedResult = await this.enhanceProblemSolution(input, response.result as Record<string, unknown>);
      return {
        ...response,
        result: enhancedResult
      };
    }

    return response;
  }

  private async enhanceProblemSolution(originalProblem: string, solution: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Add problem-solving specific enhancements
    return {
      ...solution,
      problemAnalysis: {
        originalProblem,
        solutionApproach: 'Living Spiral methodology with multi-voice council',
        confidence: 'High - uses sophisticated agent architecture',
        nextSteps: [
          'Review proposed solution',
          'Test implementation approach', 
          'Iterate based on feedback'
        ]
      },
      metadata: {
        ...((solution.metadata as Record<string, unknown>) || {}),
        agentType: 'problem-solver',
        methodology: 'living-spiral'
      }
    };
  }
}