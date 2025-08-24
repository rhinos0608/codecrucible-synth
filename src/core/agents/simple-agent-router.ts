/**
 * Simple Agent Router - 2025 Best Practices Implementation
 * Based on research: modular design, timeout/retry mechanisms, observability
 */

interface AgentRequest {
  prompt: string;
  voice?: string;
  timeout?: number;
  isCodingOperation?: boolean;
}

interface AgentResponse {
  content: string;
  voice: string;
  duration: number;
  success: boolean;
  error?: string;
}

export class SimpleAgentRouter {
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private static readonly CODING_KEYWORDS = [
    'implement', 'code', 'function', 'debug', 'refactor', 'typescript', 'javascript'
  ];

  /**
   * Route request to appropriate agent with performance optimizations
   */
  static async routeRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const timeout = request.timeout || this.DEFAULT_TIMEOUT;
    
    try {
      // Detect coding operation
      const isCoding = this.detectCodingOperation(request.prompt);
      
      // Build lightweight prompt based on operation type
      const systemPrompt = this.buildPrompt(request.voice || 'developer', isCoding);
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Agent timeout')), timeout);
      });
      
      // Create agent response promise (simplified)
      const responsePromise = this.generateResponse(systemPrompt, request.prompt);
      
      // Race between response and timeout
      const content = await Promise.race([responsePromise, timeoutPromise]);
      
      return {
        content,
        voice: request.voice || 'developer',
        duration: Date.now() - startTime,
        success: true
      };
      
    } catch (error) {
      return {
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        voice: request.voice || 'developer',
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static detectCodingOperation(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    return this.CODING_KEYWORDS.some(keyword => lowerPrompt.includes(keyword));
  }

  private static buildPrompt(voice: string, isCoding: boolean): string {
    const basePrompt = `You are ${voice} voice, an AI coding assistant.`;
    
    if (isCoding) {
      return `${basePrompt}

# CODING GUIDELINES
- Follow Living Spiral methodology: Collapse → Council → Synthesis → Rebirth → Reflection
- Apply TDD and security-first principles
- Write clean, maintainable code
- Provide concise, practical solutions`;
    }
    
    return `${basePrompt} Provide helpful, concise responses.`;
  }

  private static async generateResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    // Simplified response generation - in real implementation this would call the model client
    return `${systemPrompt}\n\nUser: ${userPrompt}\n\nResponse: [Generated response would go here]`;
  }
}