import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import { EnterpriseSecurityFramework } from '../../../infrastructure/security/enterprise-security-framework.js';
import { ResilientCLIWrapper } from '../../../infrastructure/resilience/resilient-cli-wrapper.js';
import { MetricsCollector } from '../../cli/metrics-collector.js';
import { UseCaseRouter } from '../../cli/use-case-router.js';
import { SessionManager } from '../../cli/session-manager.js';
import { logger } from '../../../infrastructure/logging/unified-logger.js';
import type {
  CLIOperationRequest,
  CLIOperationResponse,
  UnifiedCLIOptions,
} from '../unified-cli-coordinator.js';

interface Dependencies {
  securityFramework: EnterpriseSecurityFramework;
  metricsCollector: MetricsCollector;
  resilientWrapper: ResilientCLIWrapper;
  useCaseRouter: UseCaseRouter;
  sessionManager: SessionManager;
  calculateSystemHealth: () => number;
}

export interface ICLIOrchestrator {
  processOperation: (
    request: Readonly<CLIOperationRequest>,
    options: Readonly<UnifiedCLIOptions>
  ) => Promise<CLIOperationResponse>;
}

export class CLIOrchestrator implements ICLIOrchestrator {
  public constructor(private readonly deps: Dependencies) {}

  public async processOperation(
    request: Readonly<CLIOperationRequest>,
    options: UnifiedCLIOptions
  ): Promise<CLIOperationResponse> {
    const startTime = performance.now();
    const operationId = request.id || randomUUID();
    const {
      securityFramework,
      metricsCollector,
      resilientWrapper,
      useCaseRouter,
      sessionManager,
      calculateSystemHealth,
    } = this.deps;

    const traceSpan = metricsCollector.startOperation(operationId, request.type, {
      sessionId: request.session?.id,
    });

    try {
      const securityValidation = await securityFramework.validateOperation(
        JSON.stringify(request.input),
        { operationType: request.type, sessionId: request.session?.id }
      );

      if (!securityValidation.allowed) {
        logger.warn(
          `🚫 Security validation failed for operation ${operationId}:`,
          securityValidation.violations
        );

        metricsCollector.recordOperation(
          operationId,
          false,
          `Security validation failed: ${securityValidation.violations.join(', ')}`,
          undefined,
          traceSpan
        );

        return {
          id: operationId,
          success: false,
          error: `Security validation failed: ${securityValidation.violations.join(', ')}`,
          metrics: {
            processingTime: performance.now() - startTime,
            contextConfidence: 0,
            systemHealth: calculateSystemHealth(),
          },
        };
      }

      const resilientResult = await resilientWrapper.executeWithRecovery(
        async () => {
          try {
            // Primary operation - convert request to match UseCaseRouter interface
            const adaptedRequest = {
              ...request,
              input: (typeof request.input === 'string' || (typeof request.input === 'object' && request.input !== null)) 
                ? request.input 
                : String(request.input || ''),
            };
            return await useCaseRouter.executeOperation(adaptedRequest);
          } catch (error) {
            // Fallback operation - adapt session format and try again
            const adaptedSession = request.session ? {
              id: request.session.id,
              workingDirectory: request.session.workingDirectory || process.cwd(),
              context: request.session.context || {
                sessionId: request.session.id,
                workingDirectory: request.session.workingDirectory || process.cwd(),
                permissions: ['read', 'write'],
                securityLevel: 'medium' as const,
              },
            } : undefined;

            const routerRequest = {
              ...request,
              input: typeof request.input === 'string' ? request.input : '',
              session: adaptedSession,
            };
            return useCaseRouter.executeOperation(routerRequest);
          }
        },
        {
          name: `CLI-${request.type}`,
          component: 'UnifiedCLICoordinator',
          critical: request.type === 'execute',
          timeout: options.timeoutMs,
        },
        {
          enableGracefulDegradation: options.enableGracefulDegradation,
          retryAttempts: options.retryAttempts,
          timeoutMs: options.timeoutMs,
          fallbackMode: options.fallbackMode,
          errorNotification: options.errorNotification,
        }
      );

      const processingTime = performance.now() - startTime;

      metricsCollector.recordOperation(
        operationId,
        resilientResult.success,
        resilientResult.error,
        { recoveryActions: resilientResult.metrics?.recoveryActions || 0 },
        traceSpan
      );

      if (request.session?.id) {
        sessionManager.updateSessionMetrics(request.session.id, {
          commandsExecuted: 1,
          contextEnhancements: 1,
          errorsRecovered: resilientResult.metrics?.recoveryActions || 0,
          totalProcessingTime: processingTime,
        });
      }

      return {
        id: operationId,
        success: resilientResult.success,
        result: resilientResult.data,
        error: resilientResult.error,
        enhancements: {
          contextAdded: true,
          performanceOptimized: true,
          errorsRecovered: resilientResult.metrics?.recoveryActions || 0,
        },
        metrics: {
          processingTime,
          contextConfidence: 0.8,
          systemHealth: calculateSystemHealth(),
        },
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;

      metricsCollector.recordOperation(
        operationId,
        false,
        (error as Error).message,
        undefined,
        traceSpan
      );

      logger.error(`CLI operation ${operationId} failed:`, error);

      return {
        id: operationId,
        success: false,
        error: (error as Error).message,
        metrics: {
          processingTime,
          contextConfidence: 0,
          systemHealth: calculateSystemHealth(),
        },
      };
    }
  }
}

export default CLIOrchestrator;
