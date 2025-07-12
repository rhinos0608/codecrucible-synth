// Ultra-Fast OpenAI Service - Apple-Level Performance Standards
import OpenAI from "openai";
import { logger, APIError } from './logger';
import { isDevMode } from './lib/dev-mode';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  logger.error('Critical: OPENAI_API_KEY environment variable not found');
} else {
  logger.info('OpenAI API key loaded', { 
    keyLength: OPENAI_API_KEY.length,
    keyPrefix: OPENAI_API_KEY.substring(0, 7) + '...'
  });
}
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Performance-optimized interfaces
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

class OptimizedOpenAIService {
  // Ultra-fast parallel generation - Apple performance standards
  async generateSolutions(options: {
    prompt: string;
    perspectives: string[];
    roles: string[];
    sessionId: number;
    mode: string;
  }): Promise<FastSolution[]> {
    const { prompt, perspectives, roles, sessionId } = options;
    
    try {
      logger.info('Starting ultra-fast parallel generation', {
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
      
      // Execute all generations simultaneously for maximum speed
      const solutions = await Promise.all(voicePromises);
      
      logger.info('Ultra-fast generation completed', {
        sessionId,
        solutionCount: solutions.length,
        averageLength: Math.round(solutions.reduce((sum, sol) => sum + sol.code.length, 0) / solutions.length)
      });
      
      return solutions;
      
    } catch (error) {
      logger.error('Fast generation failed', error as Error, { sessionId });
      throw new APIError(500, `Generation failed: ${error.message}`);
    }
  }

  // Individual voice solution generation - optimized for speed
  private async generateVoiceSolution(options: {
    prompt: string;
    voiceId: string;
    type: 'perspective' | 'role';
    sessionId: number;
    solutionId: number;
  }): Promise<FastSolution> {
    const { prompt, voiceId, type, sessionId, solutionId } = options;
    
    try {
      // Fast system prompt selection
      const systemPrompt = this.getFastSystemPrompt(voiceId, type);
      
      // Optimized user prompt for speed
      const userPrompt = `Generate a complete, production-ready solution for: ${prompt}

Requirements:
- Minimum 1000 characters of actual code
- Include comprehensive error handling
- Add performance optimizations
- Follow modern best practices
- Provide clear explanation`;

      logger.info('Making OpenAI API call', { 
        voiceId, 
        type, 
        model: 'gpt-4o',
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length 
      });

      // OpenAI API call with performance settings
      const response = await openai!.chat.completions.create({
        model: "gpt-4o", // Latest, fastest model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.4, // Balance creativity and consistency
        max_tokens: 2500, // Sufficient for comprehensive solutions
        presence_penalty: 0.1 // Encourage diverse solutions
      });

      logger.info('OpenAI API response received', { 
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
        strengths: this.extractStrengths(voiceId, type),
        considerations: this.extractConsiderations(voiceId, type),
        perspective: type === 'perspective' ? voiceId : '',
        role: type === 'role' ? voiceId : ''
      };
      
    } catch (error) {
      logger.error('Voice generation failed', error as Error, { voiceId, type });
      
      // Development fallback for speed testing
      // Only use dev fallback if OpenAI completely unavailable
      if (isDevMode() && !openai) {
        return this.createDevFallback(options);
      }
      
      throw error;
    }
  }

  // Lightning-fast streaming generation with corrected signature
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
    
    try {
      if (!openai) {
        logger.warn('OpenAI not available, using dev fallback', { voiceId, sessionId });
        if (isDevMode()) {
          return this.simulateStreaming(options);
        }
        throw new APIError(500, 'OpenAI API key required');
      }

      const systemPrompt = this.getFastSystemPrompt(voiceId, type);
      const userPrompt = `Generate complete, production-ready code for: ${prompt}

Requirements:
- Minimum 800 characters of functional code
- Include error handling and validation
- Add comprehensive comments
- Follow modern best practices
- Provide working implementation

Focus on ${type === 'perspective' ? 'analytical perspective' : 'technical specialization'} as ${voiceId}.`;

      logger.info('Starting OpenAI streaming generation', { 
        sessionId, 
        voiceId, 
        type,
        promptLength: prompt.length 
      });

      // Real OpenAI streaming with optimal settings
      const stream = await openai.chat.completions.create({
        model: "gpt-4o", // Latest model for best performance
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2500,
        presence_penalty: 0.1
      });

      let content = '';
      let chunkCount = 0;
      
      // Ultra-fast chunk processing with real OpenAI
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          content += delta;
          chunkCount++;
          
          // Send chunk to client
          onChunk(delta);
          
          // Minimal delay for smooth visual effect (Apple-level UX)
          await new Promise(resolve => setTimeout(resolve, 15));
        }
      }

      logger.info('OpenAI streaming completed', { 
        sessionId, 
        voiceId, 
        contentLength: content.length,
        chunkCount 
      });

      // Extract and complete the solution
      const code = this.extractCode(content);
      const explanation = this.extractExplanation(content);
      
      await onComplete({
        voiceCombination: `${type}:${voiceId}`,
        code,
        explanation,
        confidence: this.calculateConfidence(code, explanation),
        strengths: this.extractStrengths(voiceId, type),
        considerations: this.extractConsiderations(voiceId, type),
        voiceId,
        type
      });
      
    } catch (error) {
      logger.error('OpenAI streaming failed', error as Error, { voiceId, sessionId });
      
      // Development fallback only
      if (isDevMode()) {
        logger.info('Using dev fallback for streaming', { voiceId });
        return this.simulateStreaming(options);
      }
      
      throw error;
    }
  }

  // Development simulation for testing
  private async simulateStreaming(options: any): Promise<void> {
    const { voiceId, type, onChunk, onComplete } = options;
    
    const devCode = `// DEV-GEN 🔧 Real-time streaming for ${voiceId}
function ${voiceId}Solution() {
  // Production-ready implementation
  const result = performOptimizedOperation();
  
  if (!result) {
    throw new Error('Operation failed');
  }
  
  return {
    success: true,
    data: result,
    timestamp: new Date()
  };
}

// Helper function with error handling
function performOptimizedOperation() {
  try {
    // Advanced logic here
    return 'Optimized result';
  } catch (error) {
    console.error('Operation failed:', error);
    return null;
  }
}`;

    // Simulate streaming chunks
    const chunks = devCode.split(' ');
    for (const chunk of chunks) {
      onChunk(chunk + ' ');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await onComplete({
      voiceCombination: `${type}:${voiceId}`,
      code: devCode,
      explanation: `Fast development solution for ${voiceId} ${type}.`,
      confidence: 85,
      strengths: this.extractStrengths(voiceId, type),
      considerations: this.extractConsiderations(voiceId, type),
      voiceId,
      type
    });
  }

  // Ultra-fast synthesis with real OpenAI
  async synthesizeSolutions(options: {
    sessionId: number;
    solutions: any[];
    mode: string;
  }) {
    const { sessionId, solutions } = options;
    
    try {
      if (!openai) {
        throw new APIError(500, 'OpenAI API required for synthesis');
      }

      // Fast synthesis prompt
      const synthesisPrompt = `Synthesize these ${solutions.length} AI solutions into one optimal implementation:

${solutions.map((sol, i) => `## Solution ${i + 1} (${sol.voiceCombination})
${sol.code.substring(0, 1000)}...
Key: ${sol.explanation.substring(0, 200)}...`).join('\n\n')}

Create a unified, production-ready solution that combines the best aspects.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert software architect. Synthesize solutions into one optimal implementation. Return JSON with: synthesizedCode, explanation, confidence, integratedApproaches, securityConsiderations, performanceOptimizations."
          },
          { role: "user", content: synthesisPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Consistent synthesis
        max_tokens: 3000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        synthesizedCode: result.synthesizedCode || 'Synthesis completed',
        explanation: result.explanation || 'Solutions merged successfully',
        confidence: result.confidence || 90,
        integratedApproaches: result.integratedApproaches || solutions.map(s => s.voiceCombination),
        securityConsiderations: result.securityConsiderations || ['Input validation', 'Error handling'],
        performanceOptimizations: result.performanceOptimizations || ['Code optimization', 'Efficient algorithms']
      };
      
    } catch (error) {
      logger.error('Synthesis failed', error as Error, { sessionId });
      throw new APIError(500, `Synthesis failed: ${error.message}`);
    }
  }

  // Fast system prompts optimized for performance
  private getFastSystemPrompt(voiceId: string, type: 'perspective' | 'role'): string {
    const base = "You are an expert software engineer. Generate production-ready code with comprehensive solutions.";
    
    if (type === 'perspective') {
      const prompts = {
        seeker: `${base} Focus on innovation and exploration. Generate curious, investigative solutions.`,
        steward: `${base} Focus on maintainability and reliability. Generate robust, well-documented code.`,
        witness: `${base} Focus on deep analysis and understanding. Generate comprehensive, analytical solutions.`,
        nurturer: `${base} Focus on user experience and accessibility. Generate user-friendly, intuitive code.`,
        decider: `${base} Focus on practical implementation. Generate efficient, production-ready solutions.`
      };
      return prompts[voiceId] || prompts.seeker;
    } else {
      const prompts = {
        guardian: `${base} Focus on security and validation. Generate secure, protected code.`,
        architect: `${base} Focus on scalable design patterns. Generate well-structured, scalable code.`,
        designer: `${base} Focus on UI/UX and design. Generate beautiful, responsive interfaces.`,
        optimizer: `${base} Focus on performance and efficiency. Generate optimized, fast code.`
      };
      return prompts[voiceId] || prompts.architect;
    }
  }

  // Fast code extraction
  private extractCode(content: string): string {
    const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
    return codeMatch ? codeMatch[1].trim() : content.substring(0, 1500);
  }

  // Fast explanation extraction
  private extractExplanation(content: string): string {
    const withoutCode = content.replace(/```[\s\S]*?```/g, '').trim();
    return withoutCode || 'Implementation completed successfully.';
  }

  // Fast confidence calculation
  private calculateConfidence(code: string, explanation: string): number {
    const codeLength = code.length;
    const hasErrorHandling = /try|catch|error|throw/i.test(code);
    const hasDocumentation = explanation.length > 50;
    
    let confidence = 70;
    if (codeLength > 500) confidence += 10;
    if (codeLength > 1000) confidence += 10;
    if (hasErrorHandling) confidence += 5;
    if (hasDocumentation) confidence += 5;
    
    return Math.min(confidence, 95);
  }

  // Fast strengths extraction
  private extractStrengths(voiceId: string, type: string): string[] {
    const strengths = {
      seeker: ['Innovation', 'Exploration', 'Creative solutions'],
      steward: ['Reliability', 'Maintainability', 'Documentation'],
      witness: ['Analysis', 'Comprehension', 'Insights'],
      nurturer: ['User experience', 'Accessibility', 'Usability'],
      decider: ['Efficiency', 'Practicality', 'Implementation'],
      guardian: ['Security', 'Validation', 'Protection'],
      architect: ['Scalability', 'Structure', 'Design patterns'],
      designer: ['UI/UX', 'Visual design', 'Responsiveness'],
      optimizer: ['Performance', 'Efficiency', 'Optimization']
    };
    return strengths[voiceId] || ['Code quality', 'Best practices'];
  }

  // Fast considerations extraction
  private extractConsiderations(voiceId: string, type: string): string[] {
    return ['Performance impact', 'Scalability', 'Maintenance', 'Security'];
  }

  // Development fallback for testing
  private createDevFallback(options: any): FastSolution {
    return {
      id: options.solutionId,
      sessionId: options.sessionId,
      voiceCombination: `${options.type}:${options.voiceId}`,
      code: `// DEV-GEN 🔧 Fast solution for: ${options.prompt.substring(0, 50)}...\n\nfunction optimizedSolution() {\n  // Production-ready implementation\n  return 'Fast development solution';\n}`,
      explanation: `Fast development solution generated for ${options.voiceId} ${options.type}.`,
      confidence: 85,
      strengths: this.extractStrengths(options.voiceId, options.type),
      considerations: this.extractConsiderations(options.voiceId, options.type),
      perspective: options.type === 'perspective' ? options.voiceId : '',
      role: options.type === 'role' ? options.voiceId : ''
    };
  }
}

export const optimizedOpenAIService = new OptimizedOpenAIService();

// Legacy exports for compatibility
export const openaiService = optimizedOpenAIService;