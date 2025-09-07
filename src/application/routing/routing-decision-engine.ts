import { HybridLLMRouter } from '../../providers/hybrid/hybrid-llm-router.js';
import { ModelSelection } from '../../domain/services/model-selection-service.js';
import { VoiceSelection } from '../../domain/services/voice-orchestration-service.js';
import { SelectionResult } from '../../providers/provider-selection-strategy.js';
import { RoutingContext, IntelligentRoutingDecision } from './routing-types.js';
import { ModelSelectionCoordinator } from './model-selection-coordinator.js';
import { VoiceIntegrationHandler } from './voice-integration-handler.js';

function buildFallbackChain(
  model: ModelSelection,
  provider: SelectionResult,
  voices: VoiceSelection
): Array<{ type: 'model' | 'provider' | 'voice'; option: string; reason: string }> {
  const chain: Array<{ type: 'model' | 'provider' | 'voice'; option: string; reason: string }> = [];
  if (model.fallbackModels && model.fallbackModels.length > 0) {
    chain.push({
      type: 'model',
      option: model.fallbackModels[0].name.value,
      reason: 'Fallback model',
    });
  }
  if (provider.fallbackChain && provider.fallbackChain.length > 0) {
    chain.push({
      type: 'provider',
      option: provider.fallbackChain[0],
      reason: 'Fallback provider',
    });
  }
  if (voices.supportingVoices && voices.supportingVoices.length > 0) {
    const voice = voices.supportingVoices[0];
    chain.push({ type: 'voice', option: voice.id ?? voice.name, reason: 'Supporting voice' });
  }
  return chain;
}

export class RoutingDecisionEngine {
  public constructor(
    private readonly modelCoordinator: ModelSelectionCoordinator,
    private readonly voiceHandler: VoiceIntegrationHandler,
    private readonly hybridRouter: HybridLLMRouter
  ) {}

  public async makeDecision(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { modelSelection, providerSelection } = await this.modelCoordinator.selectModel(context);
    const voiceSelection = await this.voiceHandler.selectVoices(context);

    let hybridRouting;
    let routingStrategy: 'single-model' | 'hybrid' | 'multi-voice' | 'load-balanced';

    if (context.preferences?.enableHybridRouting) {
      hybridRouting = await this.hybridRouter.routeTask(context.metrics ?? {});
      routingStrategy = 'hybrid';
    } else if (context.preferences?.enableLoadBalancing) {
      routingStrategy = 'load-balanced';
    } else if (
      context.preferences?.enableMultiVoice ||
      voiceSelection.supportingVoices.length > 0
    ) {
      routingStrategy = 'multi-voice';
    } else {
      routingStrategy = 'single-model';
    }

    const estimatedCost = modelSelection.estimatedCost;
    const estimatedLatency = hybridRouting
      ? hybridRouting.estimatedResponseTime
      : modelSelection.estimatedLatency;

    const decision: IntelligentRoutingDecision = {
      modelSelection,
      voiceSelection,
      providerSelection,
      hybridRouting,
      routingStrategy,
      confidence: routingStrategy === 'hybrid' ? 0.9 : 0.7,
      reasoning: 'Auto-generated decision',
      estimatedCost,
      estimatedLatency,
      estimatedQuality: modelSelection.primaryModel.parameters?.qualityRating ?? 0.7,
      fallbackChain: buildFallbackChain(modelSelection, providerSelection, voiceSelection),
      routingId,
      timestamp: Date.now(),
      context,
    };

    return Object.freeze(decision);
  }
}
