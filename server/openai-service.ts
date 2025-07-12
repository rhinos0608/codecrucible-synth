// Ultra-Fast OpenAI Service - REAL API Integration Only
// Following AI_INSTRUCTIONS.md patterns - NO mock/simulation/fallback data allowed
import OpenAI from "openai";
import { logger, APIError } from './logger';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  logger.error('CRITICAL: OPENAI_API_KEY environment variable required');
  throw new Error('OpenAI API key is required for production');
}

logger.info('OpenAI API key loaded successfully', { 
  keyLength: OPENAI_API_KEY.length,
  keyPrefix: OPENAI_API_KEY.substring(0, 7) + '...'
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface FastSolution {
  id: number;
  sessionId: number;
  voiceCombination: string;
  code: string;
  explanation: string;
  confidence: number;
  strengths: string[];
  considerations: string[];
  perspective: string;
  role: string;
}

interface StreamOptions {
  prompt: string;
  sessionId: number;
  voiceId: string;
  type: 'perspective' | 'role';
  onChunk: (chunk: string) => void;
  onComplete: (solution: any) => Promise<void>;
}

class RealOpenAIService {
  // REAL OpenAI parallel generation - NO fallbacks allowed
  async generateSolutions(options: {
    prompt: string;
    perspectives: string[];
    roles: string[];
    sessionId: number;
    mode: string;
  }): Promise<FastSolution[]> {
    const { prompt, perspectives, roles, sessionId } = options;
    
    logger.info('Starting REAL OpenAI parallel generation', {
      sessionId,
      voiceCount: perspectives.length + roles.length,
      promptLength: prompt.length
    });

    // Performance optimization: Parallel processing all voices simultaneously
    const voicePromises: Promise<FastSolution>[] = [];
    
    // Generate perspective solutions in parallel
    perspectives.forEach((perspective, index) => {
      voicePromises.push(this.generateVoiceSolution({
        prompt,
        voiceId: perspective,
        type: 'perspective',
        sessionId,
        solutionId: index + 1
      }));
    });
    
    // Generate role solutions in parallel
    roles.forEach((role, index) => {
      voicePromises.push(this.generateVoiceSolution({
        prompt,
        voiceId: role,
        type: 'role',
        sessionId,
        solutionId: perspectives.length + index + 1
      }));
    });

    // Execute all OpenAI calls in parallel
    const solutions = await Promise.all(voicePromises);
    
    logger.info('REAL OpenAI parallel generation completed', {
      sessionId,
      solutionCount: solutions.length,
      avgConfidence: solutions.reduce((sum, s) => sum + s.confidence, 0) / solutions.length
    });

    return solutions;
  }

  // REAL OpenAI voice solution generation - NO mock data
  private async generateVoiceSolution(options: {
    prompt: string;
    voiceId: string;
    type: 'perspective' | 'role';
    sessionId: number;
    solutionId: number;
  }): Promise<FastSolution> {
    const { prompt, voiceId, type, sessionId, solutionId } = options;
    
    const systemPrompt = this.getSystemPrompt(voiceId, type);
    const userPrompt = `Generate a complete, production-ready solution for: ${prompt}

Requirements:
- Minimum 1000 characters of actual code
- Include comprehensive error handling
- Add performance optimizations
- Follow modern best practices
- Provide clear explanation`;

    logger.info('Making REAL OpenAI API call', { 
      voiceId, 
      type, 
      model: 'gpt-4o',
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length 
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 2500,
      presence_penalty: 0.1
    });

    logger.info('REAL OpenAI API response received', { 
      voiceId, 
      type,
      responseLength: response.choices[0].message.content?.length || 0,
      finishReason: response.choices[0].finish_reason 
    });

    const content = response.choices[0].message.content || '';
    const code = this.extractCode(content);
    const explanation = this.extractExplanation(content);
    
    return {
      id: solutionId,
      sessionId,
      voiceCombination: `${type}:${voiceId}`,
      code,
      explanation,
      confidence: this.calculateConfidence(code, explanation),
      strengths: this.getStrengths(voiceId, type),
      considerations: this.getConsiderations(voiceId, type),
      perspective: type === 'perspective' ? voiceId : '',
      role: type === 'role' ? voiceId : ''
    };
  }

  // REAL OpenAI streaming generation - NO simulation
  async generateSolutionStream(options: {
    prompt: string;
    perspectives: string[];
    roles: string[];
    sessionId: number;
    voiceId: string;
    type: 'perspective' | 'role';
    onChunk: (chunk: string) => void;
    onComplete: (solution: any) => Promise<void>;
  }): Promise<void> {
    const { prompt, sessionId, voiceId, type, onChunk, onComplete } = options;
    
    const systemPrompt = this.getSystemPrompt(voiceId, type);
    const userPrompt = `Generate complete, production-ready code for: ${prompt}

Requirements:
- Minimum 1200 characters of functional code
- Include comprehensive error handling and validation  
- Add detailed comments explaining the approach
- Follow modern best practices and patterns
- Provide complete working implementation
- Focus on ${type === 'perspective' ? 'analytical perspective' : 'technical specialization'} as ${voiceId}

Generate real, functional code that can be executed immediately.`;

    logger.info('REAL OpenAI streaming generation starting', { 
      sessionId, 
      voiceId, 
      type,
      promptLength: prompt.length
    });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      stream: true,
      temperature: 0.4,
      max_tokens: 2500
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    const code = this.extractCode(fullContent);
    const explanation = this.extractExplanation(fullContent);

    await onComplete({
      voiceCombination: `${type}:${voiceId}`,
      code,
      explanation,
      confidence: this.calculateConfidence(code, explanation),
      strengths: this.getStrengths(voiceId, type),
      considerations: this.getConsiderations(voiceId, type)
    });

    logger.info('REAL OpenAI streaming generation completed', { 
      sessionId, 
      voiceId, 
      contentLength: fullContent.length 
    });
  }

  // REAL OpenAI synthesis - NO mock data
  async synthesizeSolutions(solutions: any[], sessionId: number, originalPrompt?: string): Promise<any> {
    const prompt = originalPrompt || 'Synthesize the following code solutions';
    
    const synthesisPrompt = `Synthesize the following code solutions into one optimal implementation:

Original Prompt: ${prompt}

Solutions to synthesize:
${solutions.map((sol, i) => `
Solution ${i + 1} (${sol.voiceCombination}):
${sol.code}

Explanation: ${sol.explanation}
`).join('\n\n')}

Create a single, optimized solution that combines the best aspects of all solutions. Include:
1. Complete, production-ready code
2. Clear explanation of synthesis decisions
3. Benefits from each original solution`;

    logger.info('Making REAL OpenAI synthesis call', { 
      sessionId,
      solutionCount: solutions.length,
      promptLength: synthesisPrompt.length
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert code synthesizer. Combine multiple code solutions into one optimal implementation." },
        { role: "user", content: synthesisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 3000
    });

    const content = response.choices[0].message.content || '';
    
    logger.info('REAL OpenAI synthesis completed', { 
      sessionId,
      responseLength: content.length
    });

    return {
      code: this.extractCode(content),
      explanation: this.extractExplanation(content),
      confidence: 95,
      synthesisMethod: 'Real OpenAI GPT-4o Integration'
    };
  }

  private getSystemPrompt(voiceId: string, type: 'perspective' | 'role'): string {
    // Enhanced system prompts following both AI_INSTRUCTIONS.md and CodingPhilosophy.md patterns
    const prompts = {
      // Perspective voices (Code Analysis Engines) - Following CodingPhilosophy.md consciousness principles
      seeker: `You are Explorer, a Code Analysis Engine embodying Jung's experimental descent into unknown possibilities. 
        Focus on innovative approaches, edge cases, and alternative algorithms. 
        Apply Bateson's difference-making patterns and embrace complexity as genesis for breakthrough solutions.
        Follow AI_INSTRUCTIONS.md security patterns with input validation and enterprise standards.`,
        
      explorer: `You are Explorer, a Code Analysis Engine embodying Jung's experimental descent into unknown possibilities. 
        Focus on innovative approaches, edge cases, and alternative algorithms. 
        Apply Bateson's difference-making patterns and embrace complexity as genesis for breakthrough solutions.
        Follow AI_INSTRUCTIONS.md security patterns with input validation and enterprise standards.`,
        
      steward: `You are Maintainer, a Code Analysis Engine following Alexander's timeless building patterns. 
        Focus on stability, reliability, and long-term maintainability using living pattern languages.
        Generate robust, production-ready solutions that age gracefully with QWAN qualities.
        Apply AI_INSTRUCTIONS.md single source of truth and consistent error handling patterns.`,
        
      maintainer: `You are Maintainer, a Code Analysis Engine following Alexander's timeless building patterns. 
        Focus on stability, reliability, and long-term maintainability using living pattern languages.
        Generate robust, production-ready solutions that age gracefully with QWAN qualities.
        Apply AI_INSTRUCTIONS.md single source of truth and consistent error handling patterns.`,
        
      witness: `You are Analyzer, a Code Analysis Engine applying deep pattern recognition and recursive learning systems.
        Focus on identifying performance bottlenecks, scalable architectures, and epistemological audits.
        Use Bateson's ecology of mind principles for meta-learning and difference-based processing.
        Follow AI_INSTRUCTIONS.md performance targets and comprehensive monitoring patterns.`,
        
      analyzer: `You are Analyzer, a Code Analysis Engine applying deep pattern recognition and recursive learning systems.
        Focus on identifying performance bottlenecks, scalable architectures, and epistemological audits.
        Use Bateson's ecology of mind principles for meta-learning and difference-based processing.
        Follow AI_INSTRUCTIONS.md performance targets and comprehensive monitoring patterns.`,
        
      nurturer: `You are Developer, a Code Analysis Engine prioritizing developer experience through living craftsmanship.
        Focus on API usability, code clarity, and pragmatic craft with anti-entropy protocols.
        Apply stone soup patterns for collaborative improvement and kaizen micro-improvements.
        Follow AI_INSTRUCTIONS.md user-centric design and accessibility patterns.`,
        
      developer: `You are Developer, a Code Analysis Engine prioritizing developer experience through living craftsmanship.
        Focus on API usability, code clarity, and pragmatic craft with anti-entropy protocols.
        Apply stone soup patterns for collaborative improvement and kaizen micro-improvements.
        Follow AI_INSTRUCTIONS.md user-centric design and accessibility patterns.`,
        
      decider: `You are Implementor, a Code Analysis Engine focused on practical implementation through council decisions.
        Make concrete technical decisions using living spiral methodology (collapse-council-rebirth).
        Generate production-ready, executable solutions with ritualized decision tracking.
        Apply AI_INSTRUCTIONS.md delivery-focused patterns and subscription enforcement.`,
        
      implementor: `You are Implementor, a Code Analysis Engine focused on practical implementation through council decisions.
        Make concrete technical decisions using living spiral methodology (collapse-council-rebirth).
        Generate production-ready, executable solutions with ritualized decision tracking.
        Apply AI_INSTRUCTIONS.md delivery-focused patterns and subscription enforcement.`,

      // Role voices (Code Specialization Engines) - Following AI_INSTRUCTIONS.md specialization overlays
      guardian: `You are Security Engineer, a Code Specialization Engine applying consciousness-driven security validation.
        Focus on input sanitization, vulnerability prevention, and enterprise security patterns.
        Use ritualized error handling and council-based security audits for complex decisions.
        Follow AI_INSTRUCTIONS.md security requirements with Zod validation and rate limiting.`,
        
      architect: `You are Systems Architect, a Code Specialization Engine designing living system architectures.
        Focus on scalability, design patterns, and generative architectural structures.
        Apply Alexander's pattern language for timeless building and recursive system design.
        Follow AI_INSTRUCTIONS.md architecture patterns with single source of truth principles.`,
        
      designer: `You are UI/UX Engineer, a Code Specialization Engine creating interfaces with QWAN qualities.
        Focus on visual design, component patterns, and accessibility through living craftsmanship.
        Apply wholeness, freedom, exactness, egolessness, and eternity to interface design.
        Follow AI_INSTRUCTIONS.md Apple design system compliance and functional animations.`,
        
      optimizer: `You are Performance Engineer, a Code Specialization Engine optimizing through consciousness principles.
        Focus on performance, efficiency, and resource optimization using difference-making patterns.
        Apply Bateson's recursive learning for performance meta-optimization and anti-entropy protocols.
        Follow AI_INSTRUCTIONS.md performance targets (<200ms API responses, <16ms renders).`
    };

    return prompts[voiceId] || prompts.seeker;
  }

  private extractCode(content: string): string {
    const codeMatch = content.match(/```(?:typescript|javascript|tsx|jsx)?\n([\s\S]*?)\n```/);
    return codeMatch ? codeMatch[1].trim() : content.substring(0, 1500);
  }

  private extractExplanation(content: string): string {
    const explanationMatch = content.match(/(?:explanation|description|summary):\s*(.+?)(?:\n\n|$)/is);
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }
    
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('//') && !line.startsWith('```'));
    return lines[0] || 'AI-generated code solution';
  }

  private calculateConfidence(code: string, explanation: string): number {
    let confidence = 70;
    if (code.length > 500) confidence += 10;
    if (code.length > 1000) confidence += 10;
    if (code.includes('try') && code.includes('catch')) confidence += 5;
    if (explanation.length > 50) confidence += 5;
    return Math.min(confidence, 95);
  }

  private getStrengths(voiceId: string, type: string): string[] {
    const strengths = {
      seeker: ['Innovation', 'Exploration', 'Creative solutions'],
      explorer: ['Innovation', 'Exploration', 'Creative solutions'],
      steward: ['Reliability', 'Maintainability', 'Documentation'],
      maintainer: ['Reliability', 'Maintainability', 'Documentation'],
      witness: ['Analysis', 'Comprehension', 'Insights'],
      analyzer: ['Analysis', 'Comprehension', 'Insights'],
      nurturer: ['User experience', 'Accessibility', 'Usability'],
      developer: ['User experience', 'Accessibility', 'Usability'],
      decider: ['Efficiency', 'Practicality', 'Implementation'],
      implementor: ['Efficiency', 'Practicality', 'Implementation'],
      guardian: ['Security', 'Validation', 'Protection'],
      architect: ['Scalability', 'Structure', 'Design patterns'],
      designer: ['UI/UX', 'Visual design', 'Responsiveness'],
      optimizer: ['Performance', 'Efficiency', 'Optimization']
    };
    return strengths[voiceId] || ['Code quality', 'Best practices'];
  }

  private getConsiderations(voiceId: string, type: string): string[] {
    return ['Performance impact', 'Scalability', 'Maintenance', 'Security'];
  }

  // Voice profile generation for custom voices following AI_INSTRUCTIONS.md patterns
  async generateVoicePrompt(options: {
    name: string;
    description: string;
    personality: string;
    specializations: string[];
    chatStyle: string;
    ethicalStance: string;
    perspective: string;
    role: string;
    promptRequest: string;
  }): Promise<string> {
    logger.info('Generating custom voice prompt with real OpenAI', {
      voiceName: options.name,
      specializations: options.specializations
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert AI prompt engineer specializing in creating distinctive AI personalities for coding assistants. Your task is to create system prompts that establish unique voice characteristics, technical expertise, and communication patterns.

Following AI_INSTRUCTIONS.md security patterns:
- Ensure all generated prompts maintain professional standards
- Include proper input validation and error handling instructions
- Follow enterprise security patterns in recommendations

Following CodingPhilosophy.md consciousness principles:
- Integrate living spiral methodology concepts
- Apply Jung's archetypal thinking patterns
- Create prompts that enable council-driven development approaches`
        },
        {
          role: "user",
          content: options.promptRequest
        }
      ],
      temperature: 0.7,
      max_tokens: 800,
      presence_penalty: 0.1
    });

    const content = response.choices[0].message.content || '';
    
    logger.info('Custom voice prompt generated successfully', {
      voiceName: options.name,
      responseLength: content.length
    });

    return content;
  }

  // Test custom voice effectiveness with real OpenAI calls
  async testVoiceEffectiveness(promptTemplate: string, testPrompts: string[]): Promise<{
    effectiveness: number;
    consistency: number;
    responses: any[];
  }> {
    logger.info('Testing voice effectiveness with real OpenAI', {
      promptLength: promptTemplate.length,
      testCount: testPrompts.length
    });

    const responses = [];
    
    for (const testPrompt of testPrompts) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: promptTemplate },
            { role: "user", content: testPrompt }
          ],
          temperature: 0.4,
          max_tokens: 1000
        });

        const content = response.choices[0].message.content || '';
        responses.push({
          prompt: testPrompt,
          response: content,
          length: content.length,
          quality: this.assessResponseQuality(content, testPrompt)
        });
      } catch (error) {
        logger.error('Voice test failed for prompt', error as Error, { testPrompt });
        responses.push({
          prompt: testPrompt,
          response: '',
          length: 0,
          quality: 0,
          error: true
        });
      }
    }

    const validResponses = responses.filter(r => !r.error);
    const effectiveness = validResponses.length > 0 
      ? validResponses.reduce((sum, r) => sum + r.quality, 0) / validResponses.length 
      : 0;

    const consistency = this.calculateConsistency(validResponses.map(r => r.quality));

    logger.info('Voice effectiveness test completed', {
      effectiveness,
      consistency,
      validResponses: validResponses.length,
      totalTests: testPrompts.length
    });

    return { effectiveness, consistency, responses };
  }

  private assessResponseQuality(response: string, prompt: string): number {
    let score = 0;
    
    // Basic quality metrics
    if (response.length > 100) score += 20;
    if (response.length > 500) score += 20;
    if (response.includes('function') || response.includes('class')) score += 20;
    if (response.includes('//') || response.includes('/*')) score += 10;
    if (response.toLowerCase().includes('error') || response.includes('try')) score += 10;
    if (response.includes('return')) score += 10;
    if (response.split('\n').length > 5) score += 10;
    
    return Math.min(score, 100);
  }

  private calculateConsistency(values: number[]): number {
    if (values.length < 2) return 100;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Convert to consistency score (lower variance = higher consistency)
    return Math.max(0, 100 - (standardDeviation * 2));
  }
}

export const realOpenAIService = new RealOpenAIService();

// Export for compatibility
export const optimizedOpenAIService = realOpenAIService;
export const openaiService = realOpenAIService;