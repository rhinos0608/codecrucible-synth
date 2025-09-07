import { describe, it, expect } from '@jest/globals';
import { UnifiedCLICoordinator } from '../../src/application/services/unified-cli-coordinator.js';
import { CLIResilienceManager } from '../../src/application/services/cli/resilience-manager.js';
import { ResilientCLIWrapper } from '../../src/infrastructure/resilience/resilient-cli-wrapper.js';
import type { ICLIParser } from '../../src/application/services/cli/command-parser.js';
import type { ICLIOrchestrator } from '../../src/application/services/cli/cli-orchestrator.js';
import type {
  CLIOperationRequest,
  CLIOperationResponse,
  UnifiedCLIOptions,
} from '../../src/application/services/unified-cli-coordinator.js';

class TestParser implements ICLIParser {
  public parse(_args: readonly string[]): CLIOperationRequest {
    return { id: '1', type: 'prompt', input: 'hi' };
  }
}

class TestOrchestrator implements ICLIOrchestrator {
  public lastRequest: CLIOperationRequest | undefined;
  public async processOperation(
    request: Readonly<CLIOperationRequest>,
    _options: UnifiedCLIOptions
  ): Promise<CLIOperationResponse> {
    this.lastRequest = request as CLIOperationRequest;
    return {
      id: request.id,
      success: true,
      metrics: { processingTime: 0, contextConfidence: 0, systemHealth: 1 },
    };
  }
}

describe('Unified CLI modular components', () => {
  it('wires parser and orchestrator via dependency injection', async () => {
    const parser = new TestParser();
    const orchestrator = new TestOrchestrator();
    const resilienceManager = new CLIResilienceManager(new ResilientCLIWrapper());
    const coordinator = new UnifiedCLICoordinator(
      {},
      {
        parser,
        resilienceManager,
        orchestrator,
      }
    );

    await coordinator.initialize({
      orchestrator: {} as any,
      userInteraction: { display: async () => {} } as any,
      eventBus: { emit: () => {}, on: () => {} } as any,
    });

    await coordinator.executeFromArgs(['test']);
    expect(orchestrator.lastRequest?.input).toBe('hi');
  });
});
