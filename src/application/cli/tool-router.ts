import type {
  UnifiedCLICoordinator,
  CLIOperationRequest,
  CLIOperationResponse,
} from '../services/unified-cli-coordinator.js';

export async function routeThroughTools(
  coordinator: UnifiedCLICoordinator,
  request: CLIOperationRequest
): Promise<CLIOperationResponse> {
  return coordinator.processOperation(request);
}
