// OpenAI service following AI_INSTRUCTIONS.md patterns and dual-transmission protocols
import OpenAI from 'openai';
import { logger, APIError } from './logger';
import type { CodePerspective, DevelopmentRole } from '@shared/schema';

// Security validation following AI_INSTRUCTIONS.md
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('Missing required environment variable: OPENAI_API_KEY');
}

const openai = new OpenAI({ 
  apiKey: OPENAI_API_KEY 
});

interface CodeGenerationRequest {
  prompt: string;
  perspectives: string[];
  roles: string[];
  analysisDepth: number;
  mergeStrategy: string;
  qualityFiltering: boolean;
  sessionId: number;
}

interface GeneratedSolution {
  voiceCombination: string;
  code: string;
  explanation: string;
  confidence: number;
  strengths: string[];
  considerations: string[];
  perspective: string;
  role: string;
}

class OpenAIService {
  // Core instruction template following AI_INSTRUCTIONS.md
  private getBaseInstructions(): string {
    return `You are a professional software developer working on CodeCrucible, a multi-perspective coding assistant.

CRITICAL INSTRUCTIONS - Always follow these patterns from AI_INSTRUCTIONS.md:

1. SECURITY REQUIREMENTS:
   - Validate all inputs with Zod schemas
   - Use parameterized queries, never string concatenation
   - Follow enterprise security patterns
   - Never expose sensitive information

2. CODE QUALITY STANDARDS:
   - Follow React 18 + TypeScript strict mode
   - Maximum 50 lines per component
   - Single responsibility principle
   - Use semantic HTML and accessibility features
   - Performance targets: <16ms renders, <200ms API responses

3. ARCHITECTURE PATTERNS:
   - Single source of truth state management
   - Consistent API request patterns with proper error handling
   - Apple design system compliance (12px radius, golden ratio spacing)
   - Functional animations only, respect reduced motion preferences

4. DUAL-TRANSMISSION PROTOCOLS:
   - Generate production-ready, secure, performant code
   - Follow established architectural patterns
   - Maintain consistency with existing codebase
   - Apply consciousness engine patterns for state updates

Your responses must be professional, secure, and follow these established patterns. Reference specific AI_INSTRUCTIONS.md sections when making architectural decisions.`;
  }

  // Generate perspective-specific system prompt
  private getPerspectivePrompt(perspective: string, role: string): string {
    const baseInstructions = this.getBaseInstructions();
    
    const perspectiveInstructions = {
      explorer: "Focus on innovative approaches, experimental patterns, and cutting-edge solutions. Consider emerging technologies and creative problem-solving methods.",
      maintainer: "Prioritize code maintainability, documentation, testing, and long-term sustainability. Focus on clean, readable, and well-structured solutions.",
      reviewer: "Emphasize code quality, security vulnerabilities, performance optimizations, and best practices. Provide critical analysis and improvement suggestions.",
      mentor: "Explain concepts clearly, provide educational context, and suggest learning opportunities. Focus on knowledge transfer and skill development.",
      "tech-lead": "Consider system architecture, scalability, team coordination, and technical decision-making. Balance technical excellence with practical constraints."
    };

    const roleInstructions = {
      "system-architect": "Focus on system design, scalability, integration patterns, and architectural decisions. Consider enterprise-level requirements.",
      "performance-engineer": "Prioritize performance optimization, memory efficiency, bundle size, and runtime performance. Apply Core Web Vitals standards.",
      "security-engineer": "Emphasize security best practices, vulnerability prevention, input validation, and secure coding patterns from AI_INSTRUCTIONS.md.",
      "frontend-developer": "Focus on React patterns, component architecture, UI/UX implementation, and frontend best practices following Apple design system."
    };

    return `${baseInstructions}

PERSPECTIVE: ${perspective}
${perspectiveInstructions[perspective as keyof typeof perspectiveInstructions] || "Apply general development best practices."}

ROLE: ${role}
${roleInstructions[role as keyof typeof roleInstructions] || "Apply role-specific expertise."}

You must generate code that follows AI_INSTRUCTIONS.md patterns and maintains consistency with the CodeCrucible architecture.`;
  }

  async generateSolution(
    request: CodeGenerationRequest,
    perspective: string,
    role: string
  ): Promise<GeneratedSolution> {
    const requestId = `${request.sessionId}-${perspective}-${role}`;
    
    logger.info('Starting OpenAI code generation', {
      requestId,
      perspective,
      role,
      prompt: request.prompt.substring(0, 100) + '...',
      sessionId: request.sessionId
    });

    try {
      const systemPrompt = this.getPerspectivePrompt(perspective, role);
      
      const userPrompt = `
CODING REQUEST: ${request.prompt}

REQUIREMENTS:
- Analysis Depth: ${request.analysisDepth}/3
- Merge Strategy: ${request.mergeStrategy}
- Quality Filtering: ${request.qualityFiltering ? 'Enabled' : 'Disabled'}
- Must follow AI_INSTRUCTIONS.md patterns
- Generate production-ready TypeScript/React code
- Include proper error handling and security validation
- Follow Apple design system guidelines

Provide a JSON response with:
{
  "code": "// Your generated code here",
  "explanation": "Clear explanation of the approach and decisions",
  "confidence": 85,
  "strengths": ["Benefit 1", "Benefit 2", "Benefit 3"],
  "considerations": ["Consideration 1", "Consideration 2", "Consideration 3"]
}`;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new APIError(500, 'Empty response from OpenAI');
      }

      const parsedResponse = JSON.parse(content);
      
      const solution: GeneratedSolution = {
        voiceCombination: `${perspective} + ${role}`,
        code: parsedResponse.code || '// No code generated',
        explanation: parsedResponse.explanation || 'No explanation provided',
        confidence: Math.max(1, Math.min(100, parsedResponse.confidence || 75)),
        strengths: Array.isArray(parsedResponse.strengths) ? parsedResponse.strengths : ['AI-generated solution'],
        considerations: Array.isArray(parsedResponse.considerations) ? parsedResponse.considerations : ['Review implementation'],
        perspective,
        role
      };

      logger.info('OpenAI code generation completed', {
        requestId,
        confidence: solution.confidence,
        codeLength: solution.code.length,
        sessionId: request.sessionId
      });

      return solution;

    } catch (error) {
      logger.error('OpenAI code generation failed', error as Error, {
        requestId,
        perspective,
        role,
        sessionId: request.sessionId
      });

      if (error instanceof APIError) {
        throw error;
      }

      // Handle OpenAI API errors following AI_INSTRUCTIONS.md error patterns
      if (error instanceof Error && error.message.includes('API key')) {
        throw new APIError(401, 'Invalid OpenAI API key configuration');
      }

      if (error instanceof Error && error.message.includes('quota')) {
        throw new APIError(429, 'OpenAI API quota exceeded. Please try again later.');
      }

      throw new APIError(500, `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async synthesizeSolutions(solutions: GeneratedSolution[], sessionId: number): Promise<string> {
    logger.info('Starting solution synthesis', {
      sessionId,
      solutionCount: solutions.length
    });

    try {
      const systemPrompt = `${this.getBaseInstructions()}

You are synthesizing multiple code solutions into a final implementation. Follow AI_INSTRUCTIONS.md patterns:
- Maintain security and performance standards
- Apply single source of truth principles
- Use established architectural patterns
- Ensure Apple design system compliance`;

      const userPrompt = `
Synthesize these ${solutions.length} code solutions into a single, optimized implementation:

${solutions.map((sol, idx) => `
SOLUTION ${idx + 1} (${sol.voiceCombination}):
Confidence: ${sol.confidence}%
Code:
${sol.code}

Explanation: ${sol.explanation}
Strengths: ${sol.strengths.join(', ')}
Considerations: ${sol.considerations.join(', ')}
`).join('\n---\n')}

Requirements:
- Combine the best aspects of each solution
- Resolve any conflicts or inconsistencies
- Follow AI_INSTRUCTIONS.md patterns
- Maintain performance and security standards
- Provide a complete, production-ready implementation

Return only the final synthesized code with inline comments explaining key decisions.`;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent synthesis
        max_tokens: 3000
      });

      const synthesizedCode = response.choices[0].message.content || '';
      
      logger.info('Solution synthesis completed', {
        sessionId,
        outputLength: synthesizedCode.length
      });

      return synthesizedCode;

    } catch (error) {
      logger.error('Solution synthesis failed', error as Error, { sessionId });
      throw new APIError(500, `Solution synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const openaiService = new OpenAIService();