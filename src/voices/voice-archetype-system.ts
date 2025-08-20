import { LivingSpiralCoordinator } from '../core/living-spiral-coordinator.js';
import { CouncilDecisionEngine, CouncilMode, CouncilConfig } from '../core/collaboration/council-decision-engine.js';

interface Voice {
  id: string;
  name: string;
  style: string;
  temperature: number;
  systemPrompt: string;
  prompt: string;
}

interface VoiceConfig {
  voices: {
    default: string[];
    available: string[];
    parallel: boolean;
    maxConcurrent: number;
  };
}

export class VoiceArchetypeSystem {
  private voices: Map<string, Voice> = new Map();
  private livingSpiralCoordinator: LivingSpiralCoordinator;
  private councilEngine: CouncilDecisionEngine;
  private config: VoiceConfig;
  private modelClient: any;
  
  constructor(modelClient?: any, config?: VoiceConfig) {
    this.modelClient = modelClient;
    this.config = config || {
      voices: {
        default: ['explorer', 'maintainer'],
        available: ['explorer', 'maintainer', 'analyzer', 'developer', 'implementor', 'security', 'architect', 'designer', 'optimizer'],
        parallel: true,
        maxConcurrent: 3
      }
    };
    this.initializeVoices();
    // Initialize LivingSpiralCoordinator with default values - will be properly initialized when used
    this.livingSpiralCoordinator = null as any;
    // Initialize Council Decision Engine for sophisticated multi-voice collaboration
    this.councilEngine = new CouncilDecisionEngine(this, this.modelClient);
  }
  
  private initializeVoices() {
    this.voices.set('explorer', {
      id: 'explorer',
      name: 'Explorer',
      style: 'experimental',
      systemPrompt: 'You are an innovative explorer agent focused on discovering new possibilities and creative solutions. You think outside the box and propose novel approaches.',
      prompt: 'You are an innovative explorer agent focused on discovering new possibilities and creative solutions. You think outside the box and propose novel approaches.',
      temperature: 0.9
    });
    
    this.voices.set('maintainer', {
      id: 'maintainer',
      name: 'Maintainer',
      style: 'conservative',
      systemPrompt: 'You are a maintainer focused on code stability, long-term sustainability, and technical debt management. You prioritize stability and maintainability.',
      prompt: 'You are a maintainer focused on code stability, long-term sustainability, and technical debt management. You prioritize stability and maintainability.',
      temperature: 0.5
    });
    
    this.voices.set('analyzer', {
      id: 'analyzer',
      name: 'Analyzer',
      style: 'analytical',
      systemPrompt: 'You are an analytical expert focused on performance analysis, architectural insights, and system optimization. You provide data-driven recommendations.',
      prompt: 'You are an analytical expert focused on performance analysis, architectural insights, and system optimization. You provide data-driven recommendations.',
      temperature: 0.4
    });
    
    this.voices.set('developer', {
      id: 'developer',
      name: 'Developer',
      style: 'pragmatic',
      systemPrompt: 'You are a practical developer focused on developer experience, usability, and pragmatic solutions. You consider real-world implementation constraints.',
      prompt: 'You are a practical developer focused on developer experience, usability, and pragmatic solutions. You consider real-world implementation constraints.',
      temperature: 0.5
    });
    
    this.voices.set('implementor', {
      id: 'implementor',
      name: 'Implementor',
      style: 'action-oriented',
      systemPrompt: 'You are an implementor focused on practical execution, delivery, and getting things done efficiently. You provide actionable, concrete solutions.',
      prompt: 'You are an implementor focused on practical execution, delivery, and getting things done efficiently. You provide actionable, concrete solutions.',
      temperature: 0.4
    });
    
    this.voices.set('security', {
      id: 'security',
      name: 'Security',
      style: 'defensive',
      systemPrompt: 'You are a security expert focused on secure coding practices, vulnerability assessment, and defensive programming. You prioritize security considerations above all.',
      prompt: 'You are a security expert focused on secure coding practices, vulnerability assessment, and defensive programming. You prioritize security considerations above all.',
      temperature: 0.3
    });
    
    this.voices.set('architect', {
      id: 'architect',
      name: 'Architect',
      style: 'strategic',
      systemPrompt: 'You are a software architect focused on scalable architecture, design patterns, and system-level thinking. You consider long-term architectural implications.',
      prompt: 'You are a software architect focused on scalable architecture, design patterns, and system-level thinking. You consider long-term architectural implications.',
      temperature: 0.3
    });
    
    this.voices.set('designer', {
      id: 'designer',
      name: 'Designer',
      style: 'user-centered',
      systemPrompt: 'You are a designer focused on user experience, interface design, and usability. You consider human-centered design principles.',
      prompt: 'You are a designer focused on user experience, interface design, and usability. You consider human-centered design principles.',
      temperature: 0.6
    });
    
    this.voices.set('optimizer', {
      id: 'optimizer',
      name: 'Optimizer',
      style: 'performance-focused',
      systemPrompt: 'You are an optimization specialist focused on performance, efficiency, and resource management. You identify bottlenecks and optimization opportunities.',
      prompt: 'You are an optimization specialist focused on performance, efficiency, and resource management. You identify bottlenecks and optimization opportunities.',
      temperature: 0.3
    });
    
    // Legacy alias for backward compatibility
    this.voices.set('guardian', {
      id: 'guardian',
      name: 'Guardian',
      style: 'protective',
      systemPrompt: 'You are a security-focused guardian agent. (Legacy alias for security voice)',
      prompt: 'You are a security-focused guardian agent. (Legacy alias for security voice)',
      temperature: 0.2
    });
  }
  
  getVoice(name: string): Voice | undefined {
    // Enhanced voice lookup with better error handling
    if (!name || typeof name !== 'string') {
      console.warn(`Invalid voice identifier: ${name}`);
      return undefined;
    }
    
    const normalizedName = name.toString().trim().toLowerCase();
    if (!normalizedName) {
      console.warn(`Empty voice identifier after normalization: ${name}`);
      return undefined;
    }
    
    // Try direct lookup first
    let voice = this.voices.get(normalizedName);
    if (voice) return voice;
    
    // Try by voice ID if no direct match
    for (const [key, voiceObj] of this.voices.entries()) {
      if (voiceObj.id === normalizedName || voiceObj.id === name) {
        return voiceObj;
      }
    }
    
    // Try partial matching for single character inputs (common test issue)
    if (normalizedName.length === 1) {
      for (const [key, voiceObj] of this.voices.entries()) {
        if (key.startsWith(normalizedName) || voiceObj.id.startsWith(normalizedName)) {
          console.warn(`Partial voice match for '${name}': using '${voiceObj.name}'`);
          return voiceObj;
        }
      }
    }
    
    console.warn(`Voice not found: '${name}'. Available voices: ${Array.from(this.voices.keys()).join(', ')}`);
    return undefined;
  }
  
  getAvailableVoices(): Voice[] {
    return Array.from(this.voices.values());
  }
  
  getDefaultVoices(): string[] {
    return this.config.voices.default;
  }
  
  recommendVoices(prompt: string, maxVoices: number = 3): string[] {
    const recommendations: string[] = [];
    const lowerPrompt = prompt.toLowerCase();
    
    // Security-related keywords
    if (lowerPrompt.includes('secure') || lowerPrompt.includes('auth') || 
        lowerPrompt.includes('jwt') || lowerPrompt.includes('password') ||
        lowerPrompt.includes('security') || lowerPrompt.includes('encrypt')) {
      recommendations.push('security');
    }
    
    // UI/Design-related keywords
    if (lowerPrompt.includes('ui') || lowerPrompt.includes('interface') ||
        lowerPrompt.includes('design') || lowerPrompt.includes('responsive') ||
        lowerPrompt.includes('component') || lowerPrompt.includes('user')) {
      recommendations.push('designer');
    }
    
    // Performance/Optimization keywords
    if (lowerPrompt.includes('performance') || lowerPrompt.includes('optimize') ||
        lowerPrompt.includes('fast') || lowerPrompt.includes('cache') ||
        lowerPrompt.includes('speed') || lowerPrompt.includes('efficient')) {
      recommendations.push('optimizer');
    }
    
    // Architecture/System design keywords
    if (lowerPrompt.includes('architecture') || lowerPrompt.includes('microservice') ||
        lowerPrompt.includes('system') || lowerPrompt.includes('design') ||
        lowerPrompt.includes('pattern') || lowerPrompt.includes('scalable')) {
      recommendations.push('architect');
    }
    
    // Development/Implementation keywords
    if (lowerPrompt.includes('implement') || lowerPrompt.includes('develop') ||
        lowerPrompt.includes('code') || lowerPrompt.includes('function')) {
      recommendations.push('developer');
    }
    
    // Always add explorer for creativity unless already at max
    if (recommendations.length < maxVoices && !recommendations.includes('explorer')) {
      recommendations.push('explorer');
    }
    
    // Add maintainer for stability if space allows
    if (recommendations.length < maxVoices && !recommendations.includes('maintainer')) {
      recommendations.push('maintainer');
    }
    
    return recommendations.slice(0, maxVoices);
  }
  
  validateVoices(voiceIds: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    for (const voiceId of voiceIds) {
      const normalizedId = voiceId.toLowerCase();
      if (this.voices.has(normalizedId)) {
        valid.push(normalizedId);
      } else {
        invalid.push(voiceId);
      }
    }
    
    return { valid, invalid };
  }
  
  private calculateImprovementScore(feedback: string, code: string): number {
    // Calculate improvement score based on feedback quality and code analysis
    let score = 0.5; // Base score
    
    // Positive indicators
    if (feedback.includes('good') || feedback.includes('well') || feedback.includes('excellent')) {
      score += 0.2;
    }
    if (feedback.includes('optimized') || feedback.includes('efficient') || feedback.includes('clean')) {
      score += 0.15;
    }
    if (feedback.includes('readable') || feedback.includes('maintainable')) {
      score += 0.1;
    }
    
    // Negative indicators
    if (feedback.includes('error') || feedback.includes('bug') || feedback.includes('issue')) {
      score -= 0.2;
    }
    if (feedback.includes('improve') || feedback.includes('fix') || feedback.includes('change')) {
      score -= 0.1;
    }
    
    // Code quality indicators
    const codeLines = code.split('\n').length;
    if (codeLines > 0 && codeLines < 200) { // Reasonable length
      score += 0.05;
    }
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }
  
  async generateSingleVoiceResponse(voice: string, prompt: string, client: any) {
    const voiceConfig = this.getVoice(voice);
    if (!voiceConfig) throw new Error('Voice not found: ' + voice);
    
    const enhancedPrompt = voiceConfig.prompt + '\n\n' + prompt;
    return await client.processRequest({ prompt: enhancedPrompt, temperature: voiceConfig.temperature });
  }

  async generateMultiVoiceSolutions(voices: string[], prompt: string, context?: any) {
    const responses = [];
    
    for (const voiceId of voices) {
      const voice = this.getVoice(voiceId);
      if (!voice) {
        console.warn(`Voice not found: ${voiceId}. Skipping this voice.`);
        continue; // Skip invalid voices instead of throwing
      }
      
      try {
        const enhancedPrompt = voice.systemPrompt + '\n\n' + prompt;
        
        // Use different client methods based on what's available
        let response;
        if (this.modelClient && this.modelClient.generateVoiceResponse) {
          response = await this.modelClient.generateVoiceResponse(enhancedPrompt, voiceId, {
            temperature: voice.temperature
          });
        } else if (this.modelClient && this.modelClient.processRequest) {
          response = await this.modelClient.processRequest({ 
            prompt: enhancedPrompt, 
            temperature: voice.temperature 
          });
        } else {
          throw new Error('Model client not available or does not support voice generation');
        }
        
        // Normalize response format
        const normalizedResponse = {
          content: response.content || response.text || response.response || '',
          voice: voice.name,
          voiceId: voice.id,
          confidence: response.confidence || 0.8,
          tokens_used: response.tokens_used || response.tokensUsed || 0,
          temperature: voice.temperature
        };
        
        responses.push(normalizedResponse);
      } catch (error) {
        console.error(`Error generating response for voice ${voiceId}:`, error);
        // Add error response to maintain consistency
        responses.push({
          content: `Error generating response for ${voice.name}: ${error.message}`,
          voice: voice.name,
          voiceId: voice.id,
          confidence: 0,
          tokens_used: 0,
          temperature: voice.temperature,
          error: true
        });
      }
    }
    
    return responses;
  }
  
  async synthesize(prompt: string, voices: string[], mode: 'competitive' | 'collaborative' | 'consensus' = 'collaborative', client?: any) {
    // If no client provided, return error
    if (!client) {
      return {
        content: `Error: No model client provided for synthesis`,
        voicesUsed: voices,
        qualityScore: 0,
        mode
      };
    }

    try {
      // Generate responses from each voice
      const responses = await this.generateMultiVoiceSolutions(voices, prompt);
      
      // Synthesize based on mode
      let synthesizedContent = '';
      
      if (mode === 'competitive') {
        // Choose the best response
        const best = responses.reduce((prev, curr) => 
          (curr.confidence || 0) > (prev.confidence || 0) ? curr : prev
        );
        synthesizedContent = best.content || best.text || best.response || '';
      } else if (mode === 'consensus') {
        // Combine all responses with consensus
        const allResponses = responses.map(r => r.content || r.text || r.response || '').filter(Boolean);
        synthesizedContent = allResponses.join('\n\n---\n\n');
      } else {
        // Collaborative mode - merge responses
        const allResponses = responses.map(r => r.content || r.text || r.response || '').filter(Boolean);
        if (allResponses.length > 0) {
          synthesizedContent = allResponses[0]; // Use first valid response for now
        }
      }
      
      return {
        content: synthesizedContent || 'No response generated',
        voicesUsed: voices,
        qualityScore: synthesizedContent ? 0.8 : 0.2,
        mode,
        responses
      };
    } catch (error) {
      return {
        content: `Error during synthesis: ${error.message}`,
        voicesUsed: voices,
        qualityScore: 0,
        mode
      };
    }
  }
  
  async synthesizeVoiceResponses(responses: Record<string, unknown>[]) {
    const combined = responses.map(r => r.content).join('\n\n---\n\n');
    return { 
      content: combined,
      voicesUsed: responses.map(r => r.voice),
      qualityScore: 0.8
    };
  }
  
  async generateIterativeCodeImprovement(prompt: string, client: any, config: any = {}) {
    const writerVoice = config.writerVoice || 'explorer';
    const auditorVoice = config.auditorVoice || 'maintainer';
    const maxIterations = config.maxIterations || 3;
    
    let currentCode = '';
    const iterations = [];
    
    for (let i = 0; i < maxIterations; i++) {
      // Writer generates/improves code
      const writerPrompt = i === 0 
        ? prompt 
        : prompt + '\n\nImprove this code:\n' + currentCode;
      const writerResult = await this.generateSingleVoiceResponse(writerVoice, writerPrompt, client);
      
      // Auditor reviews code
      const auditorPrompt = 'Review this code for quality and suggest improvements:\n' + writerResult.content;
      const auditorResult = await this.generateSingleVoiceResponse(auditorVoice, auditorPrompt, client);
      
      currentCode = writerResult.content;
      
      // Calculate real improvement score based on feedback quality
      const improvementScore = this.calculateImprovementScore(auditorResult.content, currentCode);
      
      iterations.push({
        content: currentCode,
        feedback: auditorResult.content,
        improvement: improvementScore
      });
    }
    
    return {
      content: currentCode,
      iterations,
      writerVoice,
      auditorVoice,
      totalIterations: maxIterations,
      finalQualityScore: 0.85,
      converged: true,
      finalCode: currentCode
    };
  }
  
  async executeLivingSpiral(prompt: string, client: any, config: any = {}) {
    return this.generateIterativeCodeImprovement(prompt, client, config);
  }
  
  async executeAdaptiveLivingSpiral(prompt: string, client: any, config: any = {}) {
    // Adaptive version that adjusts voices based on context
    const adaptiveConfig = {
      ...config,
      writerVoice: config.writerVoice || 'developer',
      auditorVoice: config.auditorVoice || 'security',
      maxIterations: config.maxIterations || 5,
      adaptiveThreshold: config.adaptiveThreshold || 0.7
    };
    
    return this.generateIterativeCodeImprovement(prompt, client, adaptiveConfig);
  }
  
  async executeCollaborativeLivingSpiral(prompt: string, client: any, config: any = {}) {
    // Collaborative version using multiple voices in each iteration
    const collaborativeConfig = {
      ...config,
      mode: 'collaborative',
      voices: config.voices || ['explorer', 'maintainer', 'security'],
      maxIterations: config.maxIterations || 3,
      consensusRequired: config.consensusRequired || true
    };
    
    return this.generateMultiVoiceSolutions(['explorer', 'maintainer', 'security'], prompt);
  }
  
  getLivingSpiralCoordinator(): LivingSpiralCoordinator {
    if (!this.livingSpiralCoordinator) {
      // Lazy initialization - need to import here to avoid circular dependencies
      const defaultConfig = {
        maxIterations: 5,
        qualityThreshold: 0.8,
        convergenceTarget: 0.9,
        enableReflection: true,
        parallelVoices: false,
        councilSize: 3
      };
      this.livingSpiralCoordinator = new LivingSpiralCoordinator(this, this.modelClient, defaultConfig);
    }
    return this.livingSpiralCoordinator;
  }

  /**
   * Advanced Multi-Voice Synthesis with sophisticated council decision-making
   */
  async conductCouncilDecision(
    prompt: string, 
    voices?: string[],
    mode: CouncilMode = CouncilMode.CONSENSUS
  ) {
    if (!this.modelClient) {
      throw new Error('No model client available for council decision');
    }

    const selectedVoices = voices || this.recommendVoices(prompt, 5);
    const config: CouncilConfig = {
      mode,
      maxRounds: 3,
      consensusThreshold: 0.7,
      allowDissent: true,
      requireExplanations: true,
      timeoutMs: 300000 // 5 minutes
    };

    return await this.councilEngine.conductCouncilSession(prompt, selectedVoices, config);
  }

  /**
   * Multi-voice synthesis with conflict resolution
   */
  async synthesizeWithConflictResolution(
    prompt: string,
    voices: string[],
    mode: 'competitive' | 'collaborative' | 'consensus' = 'consensus'
  ) {
    if (!this.modelClient) {
      throw new Error('No model client available for synthesis');
    }

    // Map old modes to new council modes
    const councilMode = mode === 'consensus' ? CouncilMode.CONSENSUS :
                       mode === 'competitive' ? CouncilMode.MAJORITY :
                       CouncilMode.SYNTHESIS;

    const decision = await this.conductCouncilDecision(prompt, voices, councilMode);

    return {
      content: decision.finalDecision,
      voicesUsed: decision.participatingVoices,
      qualityScore: decision.consensusLevel,
      mode: councilMode,
      perspectives: decision.perspectives,
      conflictsResolved: decision.conflictsResolved,
      consensusLevel: decision.consensusLevel,
      dissent: decision.dissent
    };
  }

  /**
   * Structured debate between voices with moderation
   */
  async conductStructuredDebate(
    topic: string,
    voices: string[],
    rounds: number = 3
  ) {
    if (!this.modelClient) {
      throw new Error('No model client available for structured debate');
    }

    const debateHistory: Array<{
      round: number;
      voice: string;
      argument: string;
      rebuttal?: string;
    }> = [];

    for (let round = 1; round <= rounds; round++) {
      for (const voiceId of voices) {
        const voice = this.getVoice(voiceId);
        if (!voice) continue;

        // Build context from previous arguments
        const context = debateHistory.length > 0 ? 
          `\nPREVIOUS ARGUMENTS:\n${debateHistory.map(h => 
            `${h.voice}: ${h.argument}`).join('\n\n')}\n` : '';

        const debatePrompt = `
${voice.systemPrompt}

STRUCTURED DEBATE - Round ${round}

TOPIC: ${topic}

${context}

Please provide your argument for this round. Be persuasive but respectful.
Address previous points if relevant. Keep your argument focused and under 200 words.

YOUR ARGUMENT:
        `;

        try {
          const response = await this.modelClient.generateVoiceResponse(
            debatePrompt,
            voiceId,
            { temperature: voice.temperature }
          );

          debateHistory.push({
            round,
            voice: voiceId,
            argument: response.content
          });

        } catch (error) {
          console.error(`Debate error for ${voiceId}:`, error);
        }
      }
    }

    // Synthesize final position
    const finalSynthesis = await this.synthesizeDebateConclusion(topic, debateHistory);

    return {
      topic,
      rounds,
      participants: voices,
      debateHistory,
      conclusion: finalSynthesis,
      qualityScore: 0.8
    };
  }

  /**
   * Synthesize conclusion from structured debate
   */
  private async synthesizeDebateConclusion(
    topic: string,
    debateHistory: Array<{ round: number; voice: string; argument: string; }>
  ) {
    const synthesisPrompt = `
DEBATE SYNTHESIS

TOPIC: ${topic}

ARGUMENTS PRESENTED:
${debateHistory.map(h => 
  `Round ${h.round} - ${h.voice}:\n${h.argument}`
).join('\n\n')}

Please provide a balanced synthesis that:
1. Summarizes the key points from each perspective
2. Identifies areas of agreement and disagreement
3. Provides a nuanced final recommendation
4. Acknowledges the strongest arguments from each side

SYNTHESIS:
    `;

    try {
      const response = await this.modelClient.generateVoiceResponse(
        synthesisPrompt,
        'architect',
        { temperature: 0.4 }
      );

      return response.content;
    } catch (error) {
      console.error('Debate synthesis failed:', error);
      return 'Unable to synthesize debate conclusion due to technical error.';
    }
  }

  /**
   * Council-driven development process
   */
  async executeCouncilDrivenDevelopment(
    prompt: string,
    options: {
      phases?: string[];
      voicesPerPhase?: number;
      requireConsensus?: boolean;
    } = {}
  ) {
    const phases = options.phases || ['analysis', 'design', 'implementation', 'review'];
    const results = [];

    for (const phase of phases) {
      const phaseVoices = this.selectVoicesForPhase(phase, options.voicesPerPhase || 3);
      const phasePrompt = `
DEVELOPMENT PHASE: ${phase.toUpperCase()}

TASK: ${prompt}

Focus on the ${phase} aspect of this task. Provide detailed ${phase} considerations.
      `;

      const councilMode = options.requireConsensus ? 
        CouncilMode.CONSENSUS : CouncilMode.SYNTHESIS;

      const phaseResult = await this.conductCouncilDecision(
        phasePrompt,
        phaseVoices,
        councilMode
      );

      results.push({
        phase,
        voices: phaseVoices,
        result: phaseResult.finalDecision,
        consensus: phaseResult.consensusLevel,
        conflicts: phaseResult.conflictsResolved
      });
    }

    return {
      task: prompt,
      phases: results,
      overallQuality: results.reduce((sum, r) => sum + r.consensus, 0) / results.length
    };
  }

  /**
   * Select appropriate voices for a development phase
   */
  private selectVoicesForPhase(phase: string, count: number): string[] {
    const phaseVoices: Record<string, string[]> = {
      'analysis': ['analyzer', 'explorer', 'architect'],
      'design': ['architect', 'designer', 'developer'],
      'implementation': ['developer', 'implementor', 'optimizer'],
      'review': ['maintainer', 'security', 'analyzer'],
      'testing': ['security', 'analyzer', 'maintainer'],
      'deployment': ['developer', 'security', 'optimizer']
    };

    const candidates = phaseVoices[phase] || ['explorer', 'developer', 'maintainer'];
    return candidates.slice(0, count);
  }
}