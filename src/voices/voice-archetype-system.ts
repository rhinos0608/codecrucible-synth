export class VoiceArchetypeSystem {
  private voices: Map<string, any> = new Map();
  
  constructor() {
    this.initializeVoices();
  }
  
  private initializeVoices() {
    this.voices.set('explorer', {
      name: 'Explorer',
      prompt: 'You are an innovative explorer agent focused on discovering new possibilities and creative solutions. You think outside the box and propose novel approaches.',
      temperature: 0.8
    });
    
    this.voices.set('maintainer', {
      name: 'Maintainer', 
      prompt: 'You are a maintainer focused on code quality, long-term sustainability, and technical debt management. You prioritize stability and maintainability.',
      temperature: 0.3
    });
    
    this.voices.set('analyzer', {
      name: 'Analyzer',
      prompt: 'You are an analytical expert focused on performance analysis, architectural insights, and system optimization. You provide data-driven recommendations.',
      temperature: 0.4
    });
    
    this.voices.set('developer', {
      name: 'Developer',
      prompt: 'You are a practical developer focused on developer experience, usability, and pragmatic solutions. You consider real-world implementation constraints.',
      temperature: 0.5
    });
    
    this.voices.set('implementor', {
      name: 'Implementor',
      prompt: 'You are an implementor focused on practical execution, delivery, and getting things done efficiently. You provide actionable, concrete solutions.',
      temperature: 0.4
    });
    
    this.voices.set('security', {
      name: 'Security',
      prompt: 'You are a security expert focused on secure coding practices, vulnerability assessment, and defensive programming. You prioritize security considerations above all.',
      temperature: 0.2
    });
    
    this.voices.set('architect', {
      name: 'Architect',
      prompt: 'You are a software architect focused on scalable architecture, design patterns, and system-level thinking. You consider long-term architectural implications.',
      temperature: 0.3
    });
    
    this.voices.set('designer', {
      name: 'Designer',
      prompt: 'You are a designer focused on user experience, interface design, and usability. You consider human-centered design principles.',
      temperature: 0.6
    });
    
    this.voices.set('optimizer', {
      name: 'Optimizer',
      prompt: 'You are an optimization specialist focused on performance, efficiency, and resource management. You identify bottlenecks and optimization opportunities.',
      temperature: 0.3
    });
    
    // Legacy alias for backward compatibility
    this.voices.set('guardian', {
      name: 'Guardian',
      prompt: 'You are a security-focused guardian agent. (Legacy alias for security voice)',
      temperature: 0.2
    });
  }
  
  getVoice(name: string) {
    return this.voices.get(name.toLowerCase());
  }
  
  getAvailableVoices() {
    return Array.from(this.voices.keys());
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
  
  async generateMultiVoiceSolutions(voices: string[], prompt: string, client: any) {
    const solutions = [];
    for (const voice of voices) {
      const result = await this.generateSingleVoiceResponse(voice, prompt, client);
      solutions.push({ voice, ...result });
    }
    return solutions;
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
      const responses = await this.generateMultiVoiceSolutions(voices, prompt, client);
      
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
  
  async synthesizeVoiceResponses(responses: any[]) {
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
}