/**
 * Auto-Configurator - Iteration 7: Enhanced Model Management & Auto-Configuration
 * Automatically configures optimal dual-agent setup based on available models
 */

import { Logger } from '../logger.js';
import { IntelligentModelDetector, OptimalConfiguration } from './intelligent-model-detector.js';
import { DualAgentRealtimeSystem } from '../collaboration/dual-agent-realtime-system.js';
import chalk from 'chalk';

export interface AutoConfigResult {
  success: boolean;
  configuration: OptimalConfiguration;
  dualAgentSystem?: DualAgentRealtimeSystem;
  warnings: string[];
  recommendations: string[];
}

export class AutoConfigurator {
  private logger: Logger;
  private modelDetector: IntelligentModelDetector;
  private currentConfiguration: OptimalConfiguration | null = null;
  private currentDualAgent: DualAgentRealtimeSystem | null = null;

  constructor() {
    this.logger = new Logger('AutoConfigurator');
    this.modelDetector = new IntelligentModelDetector();
  }

  /**
   * Auto-configure dual-agent system with optimal models
   */
  async autoConfigureDualAgent(): Promise<AutoConfigResult> {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    this.logger.info('Starting auto-configuration...');

    try {
      // Detect available models
      await this.modelDetector.scanAvailableModels();

      // Check platform health
      const platformHealth = this.modelDetector.getPlatformHealth();
      if (!platformHealth.ollama) {
        warnings.push('Ollama not available - please start Ollama service');
      }
      if (!platformHealth.lmstudio) {
        warnings.push('LM Studio not available - dual-agent features will be limited');
        recommendations.push('Install and start LM Studio for enhanced auditing capabilities');
      }

      // Find optimal configuration
      const configuration = await this.modelDetector.findOptimalConfiguration();
      this.currentConfiguration = configuration;

      this.logger.info('Optimal configuration found:', {
        writer: `${configuration.writer.model} (${configuration.writer.platform})`,
        auditor: `${configuration.auditor.model} (${configuration.auditor.platform})`,
        confidence: `${(configuration.confidence * 100).toFixed(1)}%`,
      });

      // Create dual-agent system with optimal config
      const dualAgentSystem = this.createDualAgentSystem(configuration);
      this.currentDualAgent = dualAgentSystem;

      // Add recommendations based on configuration
      if (configuration.confidence < 0.7) {
        recommendations.push('Consider installing larger models for better code review quality');
      }
      if (configuration.writer.platform === configuration.auditor.platform) {
        recommendations.push(
          'Using different platforms (Ollama + LM Studio) would improve performance'
        );
      }

      return {
        success: true,
        configuration,
        dualAgentSystem,
        warnings,
        recommendations,
      };
    } catch (error) {
      this.logger.error('Auto-configuration failed:', error);

      // Try fallback configuration
      try {
        const fallbackConfig = await this.createFallbackConfiguration();

        return {
          success: true,
          configuration: fallbackConfig,
          dualAgentSystem: this.createDualAgentSystem(fallbackConfig),
          warnings: [...warnings, 'Using fallback configuration - limited functionality'],
          recommendations: [
            ...recommendations,
            'Install recommended models for full dual-agent capabilities',
          ],
        };
      } catch (fallbackError) {
        return {
          success: false,
          configuration: this.getMinimalConfiguration(),
          warnings: [...warnings, 'Auto-configuration failed - minimal functionality only'],
          recommendations: [...recommendations, 'Please install Ollama with at least one model'],
        };
      }
    }
  }

  /**
   * Create dual-agent system from configuration
   */
  private createDualAgentSystem(config: OptimalConfiguration): DualAgentRealtimeSystem {
    return new DualAgentRealtimeSystem({
      writer: {
        platform: 'ollama',
        model: config.writer.model,
        endpoint: 'http://localhost:11434',
        temperature: 0.7,
        maxTokens: 2048,
        keepAlive: '24h',
      },
      auditor: {
        platform: 'lmstudio' as const,
        model: config.auditor.model,
        endpoint:
          config.auditor.platform === 'lmstudio'
            ? 'http://localhost:1234/v1'
            : 'http://localhost:11434',
        temperature: 0.2,
        maxTokens: 1024,
        contextLength: 8192,
      },
      enableRealTimeAudit: true,
      auditInBackground: true,
      autoApplyFixes: false,
    });
  }

  /**
   * Create fallback configuration when optimal detection fails
   */
  private async createFallbackConfiguration(): Promise<OptimalConfiguration> {
    const models = await this.modelDetector.scanAvailableModels();

    if (models.length === 0) {
      throw new Error('No models available');
    }

    // Use the largest available model for both roles
    const bestModel = models.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0))[0];

    return {
      writer: {
        model: bestModel.name,
        platform: bestModel.platform,
        reasoning: 'Fallback: using best available model for writing',
      },
      auditor: {
        model: bestModel.name,
        platform: bestModel.platform,
        reasoning: 'Fallback: using same model for auditing',
      },
      confidence: 0.4,
    };
  }

  /**
   * Get minimal configuration when everything fails
   */
  private getMinimalConfiguration(): OptimalConfiguration {
    return {
      writer: {
        model: 'llama3.2:latest',
        platform: 'ollama',
        reasoning: 'Default model - may not be available',
      },
      auditor: {
        model: 'llama3.2:latest',
        platform: 'ollama',
        reasoning: 'Default model - may not be available',
      },
      confidence: 0.1,
    };
  }

  /**
   * Display configuration summary to user
   */
  displayConfiguration(result: AutoConfigResult): void {
    console.log(chalk.cyan('\n🤖 Dual-Agent Auto-Configuration'));
    console.log(chalk.gray('━'.repeat(50)));

    if (result.success) {
      console.log(
        chalk.green(
          `✅ Configuration successful (${(result.configuration.confidence * 100).toFixed(1)}% confidence)`
        )
      );

      console.log(chalk.yellow('\n📝 Writer Model:'));
      console.log(
        chalk.gray(
          `   ${result.configuration.writer.model} (${result.configuration.writer.platform})`
        )
      );
      console.log(chalk.gray(`   ${result.configuration.writer.reasoning}`));

      console.log(chalk.yellow('\n🔍 Auditor Model:'));
      console.log(
        chalk.gray(
          `   ${result.configuration.auditor.model} (${result.configuration.auditor.platform})`
        )
      );
      console.log(chalk.gray(`   ${result.configuration.auditor.reasoning}`));

      if (result.configuration.fallback) {
        console.log(chalk.yellow('\n🔄 Fallback Model:'));
        console.log(
          chalk.gray(
            `   ${result.configuration.fallback.model} (${result.configuration.fallback.platform})`
          )
        );
      }
    } else {
      console.log(chalk.red('❌ Auto-configuration failed'));
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      result.warnings.forEach(warning => {
        console.log(chalk.yellow(`   • ${warning}`));
      });
    }

    if (result.recommendations.length > 0) {
      console.log(chalk.blue('\n💡 Recommendations:'));
      result.recommendations.forEach(rec => {
        console.log(chalk.blue(`   • ${rec}`));
      });
    }

    console.log(chalk.gray('━'.repeat(50)));
  }

  /**
   * Get current configuration
   */
  getCurrentConfiguration(): OptimalConfiguration | null {
    return this.currentConfiguration;
  }

  /**
   * Get current dual-agent system
   */
  getCurrentDualAgent(): DualAgentRealtimeSystem | null {
    return this.currentDualAgent;
  }

  /**
   * Refresh and reconfigure
   */
  async refresh(): Promise<AutoConfigResult> {
    this.logger.info('Refreshing configuration...');

    if (this.currentDualAgent) {
      await this.currentDualAgent.shutdown();
    }

    return await this.autoConfigureDualAgent();
  }

  /**
   * Get system status report
   */
  async getStatusReport(): Promise<any> {
    const platformHealth = this.modelDetector.getPlatformHealth();
    const modelsSummary = this.modelDetector.getModelsSummary();

    return {
      platforms: {
        ollama: {
          status: platformHealth.ollama ? 'connected' : 'disconnected',
          endpoint: 'http://localhost:11434',
        },
        lmstudio: {
          status: platformHealth.lmstudio ? 'connected' : 'disconnected',
          endpoint: 'http://localhost:1234',
        },
      },
      models: modelsSummary,
      configuration: this.currentConfiguration
        ? {
            writer: this.currentConfiguration.writer.model,
            auditor: this.currentConfiguration.auditor.model,
            confidence: this.currentConfiguration.confidence,
          }
        : null,
      dualAgentReady: this.currentDualAgent !== null,
    };
  }
}

export default AutoConfigurator;
