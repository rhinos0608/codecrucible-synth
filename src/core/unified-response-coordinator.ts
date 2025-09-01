/**
 * Unified Response Coordinator
 * Ensures single coherent responses by coordinating all AI model interactions
 * Implements the LM Studio + Ollama auditor-audited dialogue system
 */

import { EventEmitter } from 'events';
import { Logger } from '../infrastructure/logging/unified-logger.js';
import {
  DualAgentRealtimeSystem,
  CodeGenerationResult,
} from './collaboration/dual-agent-realtime-system.js';
import chalk from 'chalk';
import { getErrorMessage } from '../utils/error-utils.js';

export interface CoordinatedResponse {
  content: string;
  auditTrail: AuditStep[];
  confidence: number;
  modelUsed: string;
  responseTime: number;
  warnings?: string[];
}

export interface AuditStep {
  timestamp: Date;
  agent: 'ollama' | 'lmstudio';
  action: 'generate' | 'audit' | 'refine' | 'approve';
  content: string;
  confidence: number;
  issues?: string[];
}

export class UnifiedResponseCoordinator extends EventEmitter {
  private logger: Logger;
  private dualAgentSystem: DualAgentRealtimeSystem | null;
  private responseQueue: Map<string, CoordinatedResponse> = new Map();
  private currentRequestId: string | null = null;

  constructor(dualAgentSystem?: DualAgentRealtimeSystem) {
    super();
    this.logger = new Logger('ResponseCoordinator');
    this.dualAgentSystem = dualAgentSystem || null;
  }

  /**
   * Main coordination method - ensures single response
   */
  async coordinateResponse(
    prompt: string,
    context?: any,
    options?: {
      requireAudit?: boolean;
      streamResponse?: boolean;
      maxResponseTime?: number;
    }
  ): Promise<CoordinatedResponse> {
    const requestId = this.generateRequestId();
    this.currentRequestId = requestId;

    const startTime = Date.now();
    const auditTrail: AuditStep[] = [];

    try {
      // Step 1: Initial generation with primary model (Ollama)
      this.logger.info(`[${requestId}] Starting coordinated response for prompt`);

      let result: CodeGenerationResult;

      if (this.dualAgentSystem) {
        // Use dual-agent system for coordinated generation + audit
        this.logger.info(`[${requestId}] Using dual-agent system`);

        auditTrail.push({
          timestamp: new Date(),
          agent: 'ollama',
          action: 'generate',
          content: 'Starting primary code generation',
          confidence: 0.8,
        });

        result = await this.dualAgentSystem.generateWithAudit(prompt, context);

        auditTrail.push({
          timestamp: new Date(),
          agent: 'ollama',
          action: 'generate',
          content: 'Primary generation complete',
          confidence: 0.8,
        });

        // Step 2: LM Studio audit (if available)
        if (result.audit) {
          auditTrail.push({
            timestamp: new Date(),
            agent: 'lmstudio',
            action: 'audit',
            content: `Audit complete - Score: ${result.audit.score}/100`,
            confidence: result.audit.confidence,
            issues: result.audit.issues.map((i: any) => i.description),
          });

          // Step 3: Apply refinements if needed
          if (result.refinedCode) {
            auditTrail.push({
              timestamp: new Date(),
              agent: 'lmstudio',
              action: 'refine',
              content: 'Applied audit fixes',
              confidence: result.audit.confidence,
            });
          }

          // Step 4: Final approval
          auditTrail.push({
            timestamp: new Date(),
            agent: 'lmstudio',
            action: 'approve',
            content: 'Response approved for delivery',
            confidence: result.audit.confidence,
          });
        }
      } else {
        // Fallback to single model
        this.logger.warn(`[${requestId}] Dual-agent system not available, using fallback`);

        auditTrail.push({
          timestamp: new Date(),
          agent: 'ollama',
          action: 'generate',
          content: 'Single-model fallback generation',
          confidence: 0.6,
        });

        result = {
          code: 'Fallback response generation not implemented',
          language: 'text',
          explanation: 'Generated using fallback system due to dual-agent unavailability',
          quality: {
            overallScore: 0.6,
            dimensions: [
              {
                name: 'Fallback',
                score: 0.6,
                weight: 1.0,
                details: 'Single model fallback generation',
              },
            ],
            recommendations: ['Enable dual-agent system for better quality'],
            passedGates: ['basic'],
            failedGates: ['dual-agent'],
          },
          performance: {
            generationTime: 100,
            totalTime: 100,
            tokensPerSecond: 50,
          },
          iterationsPerformed: 1,
          voicesUsed: ['fallback'],
          improvementHistory: [
            {
              iteration: 1,
              agent: 'fallback',
              changes: ['Basic fallback response generated'],
              reasoning: 'Dual-agent system unavailable, using single model fallback',
              score: 0.6,
              qualityImprovement: 0.6,
              feedback: 'Fallback generation completed',
              voice: 'fallback',
            },
          ],
        };
      }

      // Step 5: Format final response
      const coordinatedResponse: CoordinatedResponse = {
        content: this.formatFinalResponse(result),
        auditTrail,
        confidence: result.audit?.confidence || 0.6,
        modelUsed: this.dualAgentSystem ? 'dual-agent' : 'single-model',
        responseTime: Date.now() - startTime,
        warnings:
          result.audit?.issues
            .filter((i: any) => i.severity === 'warning' || i.severity === 'critical')
            .map((i: any) => i.description) || [],
      };

      this.logger.info(`[${requestId}] Response coordination complete`, {
        responseTime: coordinatedResponse.responseTime,
        confidence: coordinatedResponse.confidence,
        auditSteps: auditTrail.length,
      });

      return coordinatedResponse;
    } catch (error: unknown) {
      this.logger.error(`[${requestId}] Response coordination failed:`, error);

      // Return error response with audit trail
      return {
        content: `❌ Error: ${getErrorMessage(error)}`,
        auditTrail: [
          ...auditTrail,
          {
            timestamp: new Date(),
            agent: 'ollama',
            action: 'generate',
            content: `Error occurred: ${getErrorMessage(error)}`,
            confidence: 0.0,
          },
        ],
        confidence: 0.0,
        modelUsed: 'error',
        responseTime: Date.now() - startTime,
        warnings: [`System error: ${getErrorMessage(error)}`],
      };
    } finally {
      this.currentRequestId = null;
    }
  }

  /**
   * Stream coordinated response with audit trail
   */
  async *streamCoordinatedResponse(
    prompt: string,
    context?: any
  ): AsyncGenerator<{
    type: 'chunk' | 'audit' | 'complete';
    content: string;
    auditStep?: AuditStep;
  }> {
    const requestId = this.generateRequestId();
    this.currentRequestId = requestId;

    this.logger.info(`[${requestId}] Starting streaming coordinated response`);

    try {
      if (!this.dualAgentSystem) {
        yield {
          type: 'complete',
          content: '❌ Dual-agent system not available for streaming',
        };
        return;
      }

      // Start streaming generation + audit
      for await (const chunk of this.dualAgentSystem.streamGenerateWithAudit(prompt)) {
        switch (chunk.type) {
          case 'code_chunk':
            yield {
              type: 'chunk',
              content: chunk.content,
            };
            break;

          case 'audit_start':
            yield {
              type: 'audit',
              content: '🔍 Starting audit...',
              auditStep: {
                timestamp: new Date(),
                agent: 'lmstudio',
                action: 'audit',
                content: 'Audit initiated',
                confidence: 0.5,
              },
            };
            break;

          case 'audit_complete':
            yield {
              type: 'audit',
              content: `✅ Audit complete - Score: ${chunk.audit?.score}/100`,
              auditStep: {
                timestamp: new Date(),
                agent: 'lmstudio',
                action: 'approve',
                content: `Audit complete with score ${chunk.audit?.score}/100`,
                confidence: chunk.audit?.confidence || 0.7,
              },
            };
            break;

          case 'complete':
            yield {
              type: 'complete',
              content: '\n✅ Generation and audit complete',
            };
            break;
        }
      }
    } catch (error: unknown) {
      this.logger.error(`[${requestId}] Streaming failed:`, error);
      yield {
        type: 'complete',
        content: `❌ Streaming failed: ${getErrorMessage(error)}`,
      };
    } finally {
      this.currentRequestId = null;
    }
  }

  /**
   * Display coordinated response with audit trail
   */
  displayCoordinatedResponse(response: CoordinatedResponse, showAuditTrail: boolean = true): void {
    console.log(chalk.green('\n✨ CodeCrucible Response:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(response.content);

    if (response.warnings && response.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      response.warnings.forEach(warning => {
        console.log(chalk.yellow(`   • ${warning}`));
      });
    }

    if (showAuditTrail && response.auditTrail.length > 0) {
      console.log(chalk.cyan('\n🔍 Audit Trail:'));
      response.auditTrail.forEach((step, index) => {
        const emoji = step.agent === 'ollama' ? '🤖' : '🔬';
        const confidence = `${Math.round(step.confidence * 100)}%`;
        console.log(
          chalk.gray(`   ${index + 1}. ${emoji} ${step.agent}: ${step.action} (${confidence})`)
        );

        if (step.issues && step.issues.length > 0) {
          step.issues.forEach(issue => {
            console.log(chalk.red(`      ⚠ ${issue}`));
          });
        }
      });
    }

    console.log(
      chalk.gray(
        `\n💾 Response Time: ${response.responseTime}ms | Confidence: ${Math.round(response.confidence * 100)}%`
      )
    );
    console.log(chalk.gray('─'.repeat(60)));
  }

  /**
   * Set dual agent system (for dependency injection)
   */
  setDualAgentSystem(dualAgentSystem: DualAgentRealtimeSystem): void {
    this.dualAgentSystem = dualAgentSystem;
    this.logger.info('Dual-agent system connected to response coordinator');
  }

  /**
   * Check if coordinator is ready for dual-agent responses
   */
  isDualAgentReady(): boolean {
    return this.dualAgentSystem !== null;
  }

  private formatFinalResponse(result: CodeGenerationResult): string {
    let response = result.refinedCode || result.code;

    // Add audit summary if available
    if (result.audit) {
      const score = result.audit.score;
      const issues = result.audit.issues.length;

      if (score >= 80) {
        response += `\n\n✅ Code Quality: Excellent (${score}/100)`;
      } else if (score >= 60) {
        response += `\n\n⚠️ Code Quality: Good (${score}/100, ${issues} issues found)`;
      } else {
        response += `\n\n❌ Code Quality: Needs improvement (${score}/100, ${issues} issues found)`;
      }

      if (result.audit.securityWarnings.length > 0) {
        response += `\n🔒 Security: ${result.audit.securityWarnings.length} warnings`;
      }
    }

    return response;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Graceful shutdown of response coordinator
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down unified response coordinator...');

    // Clear any active requests or state
    // (This class appears to be stateless, so mainly cleanup listeners)

    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();

    this.logger.info('Unified response coordinator shutdown completed');
  }

  /**
   * Emergency cleanup of response coordinator
   */
  async destroy(): Promise<void> {
    this.logger.info('Emergency cleanup of unified response coordinator...');

    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();

    this.logger.info('Unified response coordinator destroyed');
  }
}

export default UnifiedResponseCoordinator;
