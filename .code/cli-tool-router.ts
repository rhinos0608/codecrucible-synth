import type {
  CLIOperationRequest,
  CLIOperationResponse,
  UnifiedCLICoordinator,
} from '../services/unified-cli-coordinator.js';

export async function routeThroughTools(
  coordinator: Readonly<UnifiedCLICoordinator>,
  request: Readonly<CLIOperationRequest>
): Promise<CLIOperationResponse> {
  return coordinator.processOperation(request);
}

