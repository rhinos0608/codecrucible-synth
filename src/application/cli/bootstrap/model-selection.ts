import { logger } from '../../../infrastructure/logging/logger.js';
import { toReadonlyRecord } from '../../../utils/type-guards.js';
import { createAdaptersFromProviders } from '../../services/adapter-factory.js';

export interface ModelSelectionResult {
  modelClient: import('../../services/model-client.js').UnifiedModelClient;
  selectedModelInfo: Awaited<
    ReturnType<
      typeof import('../../../infrastructure/user-interaction/model-selector.js').quickSelectModel
    >
  >;
}

export async function bootstrapModelSelection(
  isInteractive: boolean
): Promise<ModelSelectionResult> {
  const { UnifiedModelClient } = await import('../../services/model-client.js');
  const { ModelSelector, quickSelectModel } = await import(
    '../../../infrastructure/user-interaction/model-selector.js'
  );

  let selectedModelInfo;
  const interactive = isInteractive && process.stdin.isTTY;
  if (interactive) {
    try {
      const modelSelector = new ModelSelector();
      selectedModelInfo = await modelSelector.selectModel();
    } catch (error) {
      logger.warn(
        'Interactive model selection failed, using quick select:',
        toReadonlyRecord(error)
      );
      selectedModelInfo = await quickSelectModel();
    }
  } else {
    selectedModelInfo = await quickSelectModel();
  }

  const providersConfig = [
    {
      type: 'ollama' as const,
      name: 'ollama',
      endpoint: process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434',
      enabled: true,
      priority: 1,
      defaultModel: undefined,
      timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '110000', 10),
    },
    {
      type: 'lm-studio' as const,
      name: 'lm-studio',
      endpoint: process.env.LM_STUDIO_ENDPOINT ?? 'ws://localhost:8080',
      enabled: true,
      priority: 2,
      defaultModel: 'local-model',
      timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '110000', 10),
    },
    {
      type: 'claude' as const,
      name: 'claude',
      endpoint: process.env.CLAUDE_ENDPOINT ?? 'https://api.anthropic.com/v1/messages',
      enabled: !!process.env.ANTHROPIC_API_KEY,
      priority: 3,
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '110000', 10),
    },
    {
      type: 'huggingface' as const,
      name: 'huggingface',
      endpoint: process.env.HUGGINGFACE_ENDPOINT ?? 'https://api-inference.huggingface.co',
      enabled: !!process.env.HUGGINGFACE_API_KEY,
      priority: 4,
      apiKey: process.env.HUGGINGFACE_API_KEY,
      defaultModel: 'microsoft/DialoGPT-medium',
      timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '110000', 10),
    },
  ].filter(p => p.enabled);

  const adapters = createAdaptersFromProviders(providersConfig);

  const modelClientConfig = {
    adapters,
    defaultProvider: selectedModelInfo.provider,
    fallbackStrategy: 'priority',
    timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '30000', 10),
    retryAttempts: 3,
    enableCaching: true,
    enableMetrics: true,
  };
  const modelClient = new UnifiedModelClient(modelClientConfig);
  await modelClient.initialize();

  if (isInteractive) {
    logger.info(`Using model: ${selectedModelInfo.selectedModel.name}`);
  }

  try {
    process.env.DEFAULT_MODEL = selectedModelInfo.selectedModel.id;
    logger.info(`Set DEFAULT_MODEL to ${process.env.DEFAULT_MODEL}`);
  } catch {
    // noop
  }

  return { modelClient, selectedModelInfo };
}

export default bootstrapModelSelection;
