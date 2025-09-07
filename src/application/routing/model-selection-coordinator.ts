import {
  IModelSelectionService,
  ModelSelection,
} from '../../domain/services/model-selection-service.js';
import {
  IProviderSelectionStrategy,
  SelectionResult,
} from '../../providers/provider-selection-strategy.js';
import { RoutingContext } from './routing-types.js';

export class ModelSelectionCoordinator {
  public constructor(
    private readonly modelService: IModelSelectionService,
    private readonly providerStrategy: IProviderSelectionStrategy
  ) {}

  public async selectModel(
    context: RoutingContext
  ): Promise<{ modelSelection: ModelSelection; providerSelection: SelectionResult }> {
    const prioritize = context.preferences?.prioritizeSpeed
      ? 'speed'
      : context.preferences?.prioritizeQuality
        ? 'quality'
        : undefined;

    const modelSelection = await this.modelService.selectOptimalModel(context.request, {
      prioritize,
    });
    const providerSelection = this.providerStrategy.selectProvider({
      taskType: context.request.type?.toString(),
      complexity: context.priority,
      requiresTools: context.preferences?.learningEnabled,
      prioritizeSpeed: context.preferences?.enableLoadBalancing,
      model: modelSelection.primaryModel?.name?.value,
    });
    return { modelSelection, providerSelection };
  }
}
