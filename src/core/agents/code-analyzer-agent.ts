/**
 * Code Analyzer Agent - Performs sophisticated code analysis using the Ollama (quality) backend
 * Integrates with the existing UnifiedAgent system and voice archetypes
 */

import { UnifiedAgent } from '../agent.js';
import { ExecutionRequest, ExecutionResponse } from '../types.js';
import { UnifiedModelClient } from '../../refactor/unified-model-client.js';
import { PerformanceMonitor } from '../../utils/performance.js';
import { logger } from '../logger.js';

export class CodeAnalyzerAgent extends UnifiedAgent {
  constructor(modelClient: UnifiedModelClient, performanceMonitor: PerformanceMonitor) {
    super(modelClient, performanceMonitor);
  }

  async processRequest(input: string): Promise<ExecutionResponse> {
    logger.info('🔍 Code Analyzer Agent processing request');

    const request: ExecutionRequest = {
      id: `code-analysis-${Date.now()}`,
      input: `Code Analysis Task: ${input}
      
Please provide a comprehensive analysis including:
1. Code quality assessment
2. Architecture and design patterns
3. Performance considerations
4. Security implications
5. Maintainability and technical debt
6. Best practices compliance
7. Improvement recommendations`,
      type: 'analysis', // Routes to Ollama for deep analysis
      mode: 'quality', // Use quality mode for thorough analysis
    };

    const response = await this.execute(request);

    // Enhance with code analysis specific metadata
    if (response.success && response.result) {
      const enhancedResult = await this.enhanceCodeAnalysis(
        input,
        response.result as Record<string, unknown>
      );
      return {
        ...response,
        result: enhancedResult,
      };
    }

    return response;
  }

  private async enhanceCodeAnalysis(
    input: string,
    result: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return {
      ...result,
      analysisType: 'comprehensive-code-analysis',
      analysisFramework: {
        methodology: 'Living Spiral with Analyzer voice archetype',
        backend: 'Ollama (quality reasoning)',
        focus_areas: [
          'Code Quality',
          'Architecture Assessment',
          'Performance Analysis',
          'Security Review',
          'Maintainability',
          'Best Practices',
        ],
      },
      recommendations: {
        priority: 'high',
        categories: ['quality', 'security', 'performance', 'maintainability'],
        next_steps: [
          'Review analysis findings',
          'Prioritize improvements',
          'Implement recommendations',
          'Re-analyze for verification',
        ],
      },
      metadata: {
        ...((result.metadata as Record<string, unknown>) || {}),
        agentType: 'code-analyzer',
        voiceArchetype: 'analyzer',
        llmBackend: 'ollama-quality',
      },
    };
  }
}
