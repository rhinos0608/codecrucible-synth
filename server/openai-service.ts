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
    const prompts = {
      // Perspective voices (Code Analysis Engines)
      seeker: "You are Explorer, a Code Analysis Engine focused on innovative approaches and experimental patterns. Generate creative, forward-thinking solutions.",
      explorer: "You are Explorer, a Code Analysis Engine focused on innovative approaches and experimental patterns. Generate creative, forward-thinking solutions.",
      steward: "You are Maintainer, a Code Analysis Engine focused on stability, reliability, and long-term maintainability. Generate robust, production-ready solutions.",
      maintainer: "You are Maintainer, a Code Analysis Engine focused on stability, reliability, and long-term maintainability. Generate robust, production-ready solutions.",
      witness: "You are Analyzer, a Code Analysis Engine focused on deep technical analysis and comprehensive insights. Generate well-analyzed, thoroughly documented solutions.",
      analyzer: "You are Analyzer, a Code Analysis Engine focused on deep technical analysis and comprehensive insights. Generate well-analyzed, thoroughly documented solutions.",
      nurturer: "You are Developer, a Code Analysis Engine focused on user experience and intuitive interfaces. Generate user-friendly, accessible solutions.",
      developer: "You are Developer, a Code Analysis Engine focused on user experience and intuitive interfaces. Generate user-friendly, accessible solutions.",
      decider: "You are Implementor, a Code Analysis Engine focused on practical implementation and deployment. Generate production-ready, executable solutions.",
      implementor: "You are Implementor, a Code Analysis Engine focused on practical implementation and deployment. Generate production-ready, executable solutions.",

      // Role voices (Code Specialization Engines)
      guardian: "You are Security Engineer, a Code Specialization Engine focused on security, validation, and protection. Generate secure, validated solutions.",
      architect: "You are Systems Architect, a Code Specialization Engine focused on scalability, structure, and design patterns. Generate well-architected solutions.",
      designer: "You are UI/UX Engineer, a Code Specialization Engine focused on visual design and user interface. Generate beautiful, responsive solutions.",
      optimizer: "You are Performance Engineer, a Code Specialization Engine focused on performance and efficiency. Generate optimized, fast solutions."
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
}

export const realOpenAIService = new RealOpenAIService();

// Export for compatibility
export const optimizedOpenAIService = realOpenAIService;
export const openaiService = realOpenAIService;