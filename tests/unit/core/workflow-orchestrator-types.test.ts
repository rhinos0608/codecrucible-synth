/**
 * Compile-time type tests for workflow orchestrator dependencies.
 * Ensures OrchestratorDependencies uses domain interfaces.
 */

import type {
  OrchestratorDependencies,
  WorkflowContext,
} from '../../../src/domain/interfaces/workflow-orchestrator.js';
import type { IModelClient } from '../../../src/domain/interfaces/model-client.js';
import type { IMcpManager } from '../../../src/domain/interfaces/mcp-manager.js';
import type { IUnifiedSecurityValidator } from '../../../src/domain/services/unified-security-validator.js';
import type { IUnifiedConfigurationManager } from '../../../src/domain/services/unified-configuration-manager.js';
import type { IUserInteraction } from '../../../src/domain/interfaces/user-interaction.js';
import type { IEventBus } from '../../../src/domain/interfaces/event-bus.js';

describe('OrchestratorDependencies types', () => {
  it('should accept valid dependency implementations', () => {
    const deps: OrchestratorDependencies = {
      userInteraction: {} as IUserInteraction,
      eventBus: {} as IEventBus,
      modelClient: {} as IModelClient,
      mcpManager: {} as IMcpManager,
      securityValidator: {} as IUnifiedSecurityValidator,
      configManager: {} as IUnifiedConfigurationManager,
    };

    expect(deps).toBeDefined();
  });

  it('should support optional context', () => {
    const ctx: WorkflowContext = {
      sessionId: 'abc',
      workingDirectory: '.',
      permissions: [],
      securityLevel: 'low',
    };
    expect(ctx.sessionId).toBe('abc');
  });
});
