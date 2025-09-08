/**
 * Smart Model Selection with User Preferences and Dynamic Capability Detection
 *
 * Replaces hardcoded model priorities with user-configurable preferences
 * and dynamic capability detection using HuggingFace API.
 */

import { logger } from '../logging/unified-logger.js';
import { ModelInfo, ModelSelectionResult, ModelSelector } from './model-selector.js';
import { modelCapabilityService } from '../discovery/model-capability-service.js';
import { toErrorOrUndefined, toReadonlyRecord } from '../../utils/type-guards.js';

export interface SmartSelectionOptions {
  preferredModel?: string;
  requireFunctionCalling?: boolean;
  fallbackToBest?: boolean;
  provider?: 'ollama' | 'lm-studio' | 'huggingface' | 'openai' | 'anthropic';
}

/**
 * Smart model selector that uses user preferences and dynamic capability detection
 */
export class SmartModelSelector {
  private selector: ModelSelector;

  constructor() {
    this.selector = new ModelSelector();
  }

  /**
   * Select the best model based on user preferences and capabilities
   */
  public async selectModel(options: SmartSelectionOptions = {}): Promise<ModelSelectionResult> {
    // Get options from environment variables or parameters
    const {
      preferredModel = process.env.MODEL_PREFERRED,
      requireFunctionCalling = process.env.MODEL_REQUIRE_FUNCTION_CALLING !== 'false',
      fallbackToBest = process.env.MODEL_FALLBACK_TO_BEST !== 'false',
      provider,
    } = options;

    logger.info('🤖 Smart model selection started', {
      preferredModel: preferredModel ?? 'none',
      requireFunctionCalling,
      fallbackToBest,
      preferredProvider: provider ?? 'any',
    });

    // Discover available models
    const models = await this.selector.discoverModels();
    const availableModels = (models as readonly ModelInfo[]).filter(m => m.available);

    if (availableModels.length === 0) {
      throw new Error('No AI models available');
    }

    logger.info(
      `📋 Found ${availableModels.length} available models across ${[...new Set((availableModels as readonly ModelInfo[]).map(m => m.provider))].length} providers`
    );

    // Step 1: Try user's preferred model
    if (preferredModel?.trim()) {
      const result = await this.tryPreferredModel(
        availableModels,
        preferredModel,
        requireFunctionCalling
      );
      if (result) return result;
    }

    // Step 2: Try provider preference
    if (provider) {
      const result = await this.tryProviderPreference(
        availableModels,
        provider,
        requireFunctionCalling
      );
      if (result) return result;
    }

    // Step 3: Dynamic selection based on capabilities
    if (fallbackToBest) {
      return this.selectBestAvailable(availableModels, requireFunctionCalling);
    }

    // Step 4: Simple fallback
    const [fallbackModel] = availableModels;
    logger.info(`⚠️ Using simple fallback: ${fallbackModel.name} (${fallbackModel.provider})`);

    return {
      selectedModel: fallbackModel,
      provider: fallbackModel.provider,
    };
  }

  /**
   * Try to use the user's preferred model
   */
  private async tryPreferredModel(
    availableModels: ModelInfo[],
    preferredModelName: string,
    requireFunctionCalling: boolean
  ): Promise<ModelSelectionResult | null> {
    const preferredModel = availableModels.find(
      m =>
        m.name.toLowerCase().includes(preferredModelName.toLowerCase()) ||
        m.id?.toLowerCase().includes(preferredModelName.toLowerCase())
    );

    if (!preferredModel) {
      logger.warn(`⚠️ Preferred model "${preferredModelName}" not found in available models`);
      return null;
    }

    // Check function calling requirement
    if (requireFunctionCalling) {
      try {
        const supportsFunctionCalling = await modelCapabilityService.supportsFunctionCalling(
          preferredModel.name,
          preferredModel.provider
        );

        if (!supportsFunctionCalling) {
          logger.warn(
            `⚠️ Preferred model ${preferredModel.name} doesn't support function calling when required`
          );
          return null;
        }

        logger.info(`✅ Using preferred model: ${preferredModel.name} (supports function calling)`);
      } catch (error) {
        logger.warn(
          `⚠️ Could not verify function calling for preferred model ${preferredModel.name}:`,
          toReadonlyRecord(error)
        );
        logger.info(
          `✅ Using preferred model anyway: ${preferredModel.name} (function calling verification failed)`
        );
      }
    } else {
      logger.info(
        `✅ Using preferred model: ${preferredModel.name} (function calling not required)`
      );
    }

    return {
      selectedModel: preferredModel,
      provider: preferredModel.provider,
    };
  }

  /**
   * Try to use models from preferred provider
   */
  private async tryProviderPreference(
    availableModels: ModelInfo[],
    preferredProvider: string,
    requireFunctionCalling: boolean
  ): Promise<ModelSelectionResult | null> {
    const providerModels = availableModels.filter(m => m.provider === preferredProvider);

    if (providerModels.length === 0) {
      logger.warn(`⚠️ No available models found for preferred provider: ${preferredProvider}`);
      return null;
    }

    // Score and select best model from preferred provider
    const bestFromProvider = await this.selectBestFromModels(
      providerModels,
      requireFunctionCalling
    );

    if (bestFromProvider) {
      logger.info(
        `✅ Selected best model from preferred provider ${preferredProvider}: ${bestFromProvider.selectedModel.name}`
      );
      return bestFromProvider;
    }

    return null;
  }

  /**
   * Select the best available model based on capability scoring
   */
  private async selectBestAvailable(
    availableModels: readonly ModelInfo[],
    requireFunctionCalling: boolean
  ): Promise<ModelSelectionResult> {
    return this.selectBestFromModels(availableModels, requireFunctionCalling);
  }

  /**
   * Score models and select the best one
   */
  private async selectBestFromModels(
    models: readonly ModelInfo[],
    requireFunctionCalling: boolean
  ): Promise<ModelSelectionResult> {
    logger.info(`🎯 Scoring ${models.length} models for selection...`);

    const scoredModels = await Promise.all(
      models.map(async model => {
        let score = 0;
        const reasons = [];

        // Base availability score
        score += 10;
        reasons.push('available');

        // Provider reliability scores
        switch (model.provider) {
          case 'ollama':
            score += 8; // Most reliable for function calling
            reasons.push('ollama-reliable');
            break;
          case 'lm-studio':
            score += 5; // Less reliable but still good
            reasons.push('lm-studio');
            break;
          case 'openai':
          case 'anthropic':
            score += 10; // Cloud providers are very reliable
            reasons.push('cloud-provider');
            break;
          default:
            score += 3;
            reasons.push('unknown-provider');
        }

        // Function calling capability check
        if (requireFunctionCalling) {
          try {
            const capabilities = await modelCapabilityService.getModelCapabilities(
              model.name,
              model.provider
            );

            if (capabilities.functionCalling) {
              score += 15;
              reasons.push(`function-calling-${capabilities.confidence.toFixed(1)}`);
            } else {
              score -= 10; // Penalize heavily for missing required capability
              reasons.push('no-function-calling');
            }

            // Bonus for other capabilities
            if (capabilities.toolUse) {
              score += 5;
              reasons.push('tool-use');
            }
            if (capabilities.jsonMode) {
              score += 3;
              reasons.push('json-mode');
            }
          } catch (error) {
            logger.debug(`Could not check capabilities for ${model.name}:`, toReadonlyRecord(error));
            // Give moderate score for unknown capabilities
            score += 3;
            reasons.push('unknown-capabilities');
          }
        }

        // Model family bonuses (based on actual benchmark performance)
        const modelNameLower = model.name.toLowerCase();
        if (modelNameLower.includes('llama3.1')) {
          // Llama 3.1 is EXCELLENT at function calling: 89.06% BFCL accuracy (8B), 90.76% (70B)
          score += 18; // Highest score for proven excellent function calling
          reasons.push('llama3.1-excellent-functions');
        } else if (modelNameLower.includes('qwen2.5-coder:7b') || modelNameLower.includes('qwen2.5-coder:14b') || modelNameLower.includes('qwen2.5-coder:32b')) {
          score += 15; // Excellent function calling and coding (7B+ models)
          reasons.push('qwen2.5-coder-7b+-excellent');
        } else if (modelNameLower.includes('qwen2.5-coder:3b')) {
          score += 10; // Good but 3B is at transition point for function calling
          reasons.push('qwen2.5-coder-3b-good');
        } else if (modelNameLower.includes('deepseek-coder')) {
          score += 12; // Great for coding with function calling
          reasons.push('deepseek-coder-excellent');
        } else if (modelNameLower.includes('mistral') || modelNameLower.includes('mixtral')) {
          score += 14; // Native function calling support
          reasons.push('mistral-native-functions');
        } else if (modelNameLower.includes('llama3.2')) {
          score += 8; // Good but not as proven as 3.1
          reasons.push('llama3.2-good');
        } else if (modelNameLower.includes('coder')) {
          score += 8; // Coding models
          reasons.push('coding-model');
        } else if (modelNameLower.includes('instruct')) {
          score += 5; // Instruction-tuned
          reasons.push('instruction-tuned');
        }

        // Size considerations (larger models significantly better for function calling)
        if (model.size) {
          const size = model.size.toLowerCase();
          if (size.includes('70b') || size.includes('32b') || size.includes('27b') || size.includes('20b')) {
            score += 8; // Very large models excel at function calling
            if (requireFunctionCalling) score += 4; // Extra bonus for function calling
            reasons.push('very-large-model');
          } else if (size.includes('13b') || size.includes('14b')) {
            score += 6;
            if (requireFunctionCalling) score += 2;
            reasons.push('large-model');
          } else if (size.includes('7b') || size.includes('8b')) {
            score += 4;
            if (requireFunctionCalling) score += 1;
            reasons.push('medium-model');
          } else if (size.includes('3b')) {
            score += 2; // 3B is transition point - usable but not ideal for function calling
            if (requireFunctionCalling) score -= 1; // Small penalty for function calling
            reasons.push('small-model-transition');
          } else if (size.includes('1b') || size.includes('2b')) {
            score += 0; // Too small for reliable function calling
            if (requireFunctionCalling) score -= 3; // Significant penalty
            reasons.push('very-small-model');
          }
        }

        return {
          model,
          score,
          reasons: reasons.join(', '),
        };
      })
    );

    // Sort by score (highest first)
    scoredModels.sort((a, b) => b.score - a.score);

    const [bestModel] = scoredModels;

    logger.info(`✅ Selected best model: ${bestModel.model.name}`, {
      score: bestModel.score,
      reasons: bestModel.reasons,
      provider: bestModel.model.provider,
    });

    // Log top 3 for debugging
    if (scoredModels.length > 1) {
      logger.debug(
        'Top 3 model candidates:',
        toReadonlyRecord(scoredModels.slice(0, 3).map(m => ({
          name: m.model.name,
          score: m.score,
          provider: m.model.provider,
        })))
      );
    }

    return {
      selectedModel: bestModel.model,
      provider: bestModel.model.provider,
    };
  }
}

/**
 * Quick selection function that uses smart selection logic
 */
export async function smartQuickSelectModel(
  options: Readonly<SmartSelectionOptions> = {}
): Promise<ModelSelectionResult> {
  const selector = new SmartModelSelector();
  return selector.selectModel(options);
}

// Export the smart selector as singleton
export const smartModelSelector = new SmartModelSelector();
