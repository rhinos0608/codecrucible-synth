import { BaseSpecializedAgent } from './base-specialized-agent.js';
import { BaseAgentConfig, AgentDependencies, BaseAgentOutput } from './base-agent.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { logger } from './logger.js';
import { BaseTool } from './tools/base-tool.js';

export interface VoiceEnabledConfig extends BaseAgentConfig {
  voiceArchetype?: string;
  multiVoiceMode?: boolean;
  voicePreset?: string;
}

/**
 * Voice-Enabled Agent Base Class
 * 
 * Extends specialized agents with voice synthesis capabilities
 * allowing agents to use different voice personas and multi-voice reasoning
 */
export abstract class VoiceEnabledAgent extends BaseSpecializedAgent {
  protected voiceSystem: VoiceArchetypeSystem;
  protected voiceConfig: VoiceEnabledConfig;

  constructor(config: VoiceEnabledConfig, dependencies: AgentDependencies) {
    super(config, dependencies);
    this.voiceConfig = config;
    this.voiceSystem = dependencies.context.voiceSystem;
  }

  /**
   * Process request using voice-enhanced reasoning
   */
  public async processRequestWithVoice(
    input: string, 
    voiceArchetype?: string, 
    streaming?: boolean
  ): Promise<BaseAgentOutput> {
    try {
      const selectedVoice = voiceArchetype || this.voiceConfig.voiceArchetype || 'explorer';
      
      logger.info(`🎭 ${this.config.name} processing with voice: ${selectedVoice}`);

      // Use voice-specific reasoning
      if (this.voiceConfig.multiVoiceMode) {
        return await this.processWithMultiVoice(input, streaming);
      } else {
        return await this.processWithSingleVoice(input, selectedVoice, streaming);
      }
    } catch (error) {
      logger.error(`Voice-enabled processing failed for ${this.config.name}:`, error);
      // Fallback to standard processing
      return await this.processRequest(input, streaming);
    }
  }

  /**
   * Process with a single voice archetype
   */
  private async processWithSingleVoice(
    input: string, 
    voiceArchetype: string, 
    streaming?: boolean
  ): Promise<BaseAgentOutput> {
    try {
      // Generate voice-specific enhanced prompt
      const voicePrompt = await this.enhancePromptForVoice(input, voiceArchetype);
      
      // Execute agent-specific processing with voice-enhanced prompt
      const result = await this.processRequest(voicePrompt, streaming);
      
      // Post-process result with voice characteristics
      const voiceEnhancedResult = await this.applyVoiceCharacteristics(result.message, voiceArchetype);
      
      return new BaseAgentOutput(result.success, voiceEnhancedResult, {
        ...result.data,
        voiceUsed: voiceArchetype,
        voiceMode: 'single'
      });
    } catch (error) {
      logger.error('Single voice processing failed:', error);
      return new BaseAgentOutput(false, `Voice processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process with multi-voice synthesis
   */
  private async processWithMultiVoice(input: string, streaming?: boolean): Promise<BaseAgentOutput> {
    try {
      // Get available voices for this agent type
      const suitableVoices = this.getSuitableVoicesForAgent();
      
      logger.info(`🎭 Multi-voice processing with voices: ${suitableVoices.join(', ')}`);
      
      // Generate responses from multiple voices
      const voiceResponses = await this.voiceSystem.generateMultiVoiceSolutions(
        input,
        suitableVoices,
        { 
          files: [{
            path: this.dependencies.workingDirectory,
            content: `Agent: ${this.config.name}, Tools: ${this.getAvailableTools().map(t => t.definition.name).join(', ')}`,
            language: 'text'
          }]
        }
      );
      
      // Synthesize the multi-voice responses
      const synthesis = await this.voiceSystem.synthesizeVoiceResponses(
        voiceResponses,
        'competitive' // Use competitive synthesis for better results
      );
      
      return new BaseAgentOutput(true, synthesis.combinedCode, {
        voiceResponses,
        synthesis,
        voicesUsed: suitableVoices,
        voiceMode: 'multi',
        confidence: synthesis.confidence
      });
    } catch (error) {
      logger.error('Multi-voice processing failed:', error);
      // Fallback to single voice
      return await this.processWithSingleVoice(input, 'explorer', streaming);
    }
  }

  /**
   * Enhance prompt based on voice archetype characteristics
   */
  private async enhancePromptForVoice(input: string, voiceArchetype: string): Promise<string> {
    const voiceCharacteristics = this.getVoiceCharacteristics(voiceArchetype);
    
    return `${voiceCharacteristics.systemPrompt}

Agent Context: You are ${this.config.name} - ${this.config.description}

Voice Personality: ${voiceCharacteristics.personality}

Task: ${input}

Approach this task with the ${voiceArchetype} perspective:
${voiceCharacteristics.approach}`;
  }

  /**
   * Apply voice characteristics to the result
   */
  private async applyVoiceCharacteristics(result: string, voiceArchetype: string): Promise<string> {
    const characteristics = this.getVoiceCharacteristics(voiceArchetype);
    
    // Add voice-specific formatting and tone
    const voiceHeader = `## ${characteristics.displayName} Analysis\n\n`;
    const voiceFooter = `\n\n*${characteristics.signature}*`;
    
    return voiceHeader + result + voiceFooter;
  }

  /**
   * Get suitable voices for this agent type
   */
  private getSuitableVoicesForAgent(): string[] {
    const agentVoiceMap: Record<string, string[]> = {
      'CodeAnalyzerAgent': ['maintainer', 'explorer', 'security', 'analyzer'],
      'GitManagerAgent': ['maintainer', 'developer', 'explorer'],
      'FileExplorerAgent': ['explorer', 'developer', 'maintainer'],
      'ResearchAgent': ['explorer', 'analyst', 'synthesizer'],
      'ProblemSolverAgent': ['analyzer', 'explorer', 'maintainer', 'developer']
    };

    return agentVoiceMap[this.config.name] || ['explorer', 'maintainer', 'developer'];
  }

  /**
   * Get voice characteristics for formatting
   */
  private getVoiceCharacteristics(voiceArchetype: string) {
    const characteristics: Record<string, any> = {
      explorer: {
        displayName: 'Explorer Voice',
        personality: 'Curious, innovative, looks for creative solutions and alternatives',
        approach: 'Investigate multiple approaches, consider edge cases, think outside the box',
        signature: '🔍 Explorer perspective: Innovation through exploration',
        systemPrompt: 'You are an innovative explorer who seeks creative solutions and alternative approaches.'
      },
      maintainer: {
        displayName: 'Maintainer Voice', 
        personality: 'Stability-focused, documentation-oriented, long-term thinking',
        approach: 'Ensure robustness, maintainability, and comprehensive documentation',
        signature: '🛠️ Maintainer perspective: Stability through careful planning',
        systemPrompt: 'You are a stability-focused maintainer who prioritizes long-term viability and documentation.'
      },
      security: {
        displayName: 'Security Voice',
        personality: 'Security-first, risk-aware, validation-focused',
        approach: 'Identify security risks, validate inputs, implement safeguards',
        signature: '🔒 Security perspective: Safety through vigilance',
        systemPrompt: 'You are a security-focused analyst who prioritizes safety and validation.'
      },
      analyzer: {
        displayName: 'Analyzer Voice',
        personality: 'Detail-oriented, pattern-focused, optimization-minded',
        approach: 'Analyze patterns, identify optimizations, focus on performance',
        signature: '📊 Analyzer perspective: Insight through analysis',
        systemPrompt: 'You are a detail-oriented analyzer who focuses on patterns and optimization.'
      },
      developer: {
        displayName: 'Developer Voice',
        personality: 'User-experience focused, API-design oriented, clarity-minded',
        approach: 'Prioritize developer experience, create clear interfaces, ensure usability',
        signature: '💻 Developer perspective: Excellence through experience',
        systemPrompt: 'You are a developer-focused voice who prioritizes user experience and clear interfaces.'
      }
    };

    return characteristics[voiceArchetype] || characteristics.explorer;
  }

  /**
   * Override this to enable voice processing by default
   */
  public async processRequest(input: string, streaming?: boolean): Promise<BaseAgentOutput> {
    // Check if voice processing is enabled
    if (this.voiceConfig.voiceArchetype || this.voiceConfig.multiVoiceMode) {
      return await this.processRequestWithVoice(input, this.voiceConfig.voiceArchetype, streaming);
    }
    
    // Fallback to base implementation
    return new BaseAgentOutput(false, 'Base processRequest not implemented - override in subclass');
  }
}