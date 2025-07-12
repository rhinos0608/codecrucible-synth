// OpenAI service following AI_INSTRUCTIONS.md patterns and dual-transmission protocols
import OpenAI from 'openai';
import { logger, APIError } from './logger';
import { createDevModeWatermark, isDevModeFeatureEnabled } from './lib/dev-mode';
import type { CodePerspective, DevelopmentRole } from '@shared/schema';

// Security validation following AI_INSTRUCTIONS.md
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Enhanced initialization with proper error handling
let openai: OpenAI | null = null;

try {
  if (OPENAI_API_KEY) {
    openai = new OpenAI({ 
      apiKey: OPENAI_API_KEY,
      // Add timeout and retry configuration following AI_INSTRUCTIONS.md patterns
      timeout: 30000,
      maxRetries: 2
    });
    logger.info('OpenAI client initialized successfully');
  } else {
    logger.warn('OpenAI API key not configured - using fallback responses');
  }
} catch (error) {
  logger.error('Failed to initialize OpenAI client', error as Error);
  openai = null;
}

interface ProjectContext {
  name: string;
  description?: string;
  code: string;
  language: string;
  tags?: string[];
}

interface CodeGenerationRequest {
  prompt: string;
  perspectives: string[];
  roles: string[];
  analysisDepth: number;
  mergeStrategy: string;
  qualityFiltering: boolean;
  sessionId: number;
  projectContext?: ProjectContext;
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
  private getPerspectivePrompt(perspective?: string, role?: string, projectContext?: ProjectContext): string {
    const baseInstructions = this.getBaseInstructions();
    
    // Add project context if provided - following AI_INSTRUCTIONS.md security patterns
    let contextSection = '';
    if (projectContext) {
      contextSection = `
=== PROJECT CONTEXT INTEGRATION ===
You are working with an existing project as context. Use this information to inform your code generation and ensure compatibility.

PROJECT DETAILS:
- Name: ${projectContext.name}
- Language: ${projectContext.language}
- Description: ${projectContext.description || 'No description provided'}
- Tags: ${Array.isArray(projectContext.tags) ? projectContext.tags.join(', ') : 'None'}

EXISTING CODE CONTEXT:
\`\`\`${projectContext.language}
${projectContext.code}
\`\`\`

CONTEXT INTEGRATION REQUIREMENTS:
- Ensure new code is compatible with the existing project structure
- Follow the same coding patterns and architectural style
- Consider how new functionality integrates with existing code
- Maintain consistency with the project's technology stack
- Build upon existing functions and modules where appropriate

`;
    }
    
    const perspectiveInstructions = {
      seeker: "Focus on innovative approaches, experimental patterns, and cutting-edge solutions. Consider emerging technologies and creative problem-solving methods.",
      steward: "Prioritize code maintainability, documentation, testing, and long-term sustainability. Focus on clean, readable, and well-structured solutions.",
      witness: "Emphasize code quality, security vulnerabilities, performance optimizations, and best practices. Provide critical analysis and improvement suggestions.",
      nurturer: "Explain concepts clearly, provide educational context, and suggest learning opportunities. Focus on knowledge transfer and skill development.",
      decider: "Consider system architecture, scalability, team coordination, and technical decision-making. Balance technical excellence with practical constraints."
    };

    const roleInstructions = {
      guardian: "Emphasize security best practices, vulnerability prevention, input validation, and secure coding patterns from AI_INSTRUCTIONS.md.",
      architect: "Focus on system design, scalability, integration patterns, and architectural decisions. Consider enterprise-level requirements.",
      designer: "Focus on React patterns, component architecture, UI/UX implementation, and frontend best practices following Apple design system.",
      optimizer: "Prioritize performance optimization, memory efficiency, bundle size, and runtime performance. Apply Core Web Vitals standards."
    };

    const perspectiveSection = perspective ? 
      `CODE ANALYSIS ENGINE: ${perspective}
${perspectiveInstructions[perspective as keyof typeof perspectiveInstructions] || "Apply general development best practices."}` :
      'CODE ANALYSIS ENGINE: General Development\nApply general development best practices.';

    const roleSection = role ?
      `CODE SPECIALIZATION ENGINE: ${role}
${roleInstructions[role as keyof typeof roleInstructions] || "Apply role-specific expertise."}` :
      'CODE SPECIALIZATION ENGINE: Full-Stack Developer\nApply full-stack development expertise.';

    return `${baseInstructions}
${contextSection}
${perspectiveSection}

${roleSection}

You must generate code that follows AI_INSTRUCTIONS.md patterns and maintains consistency with the CodeCrucible architecture.`;
  }

  async generateSolution(
    request: CodeGenerationRequest,
    perspective?: string,
    role?: string
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
      const systemPrompt = this.getPerspectivePrompt(perspective, role, request.projectContext);
      
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

      let parsedResponse;
      
      if (openai && OPENAI_API_KEY) {
        // Use real OpenAI API with enhanced error handling
        logger.debug('Making OpenAI API request', { 
          requestId, 
          model: "gpt-4o", 
          systemPromptLength: systemPrompt.length,
          userPromptLength: userPrompt.length 
        });
        
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

        const content = response.choices[0]?.message?.content;
        if (!content) {
          logger.error('Empty response from OpenAI', null, { requestId, response });
          throw new APIError(500, 'Empty response from OpenAI API');
        }

        logger.debug('OpenAI API response received', { 
          requestId, 
          contentLength: content.length,
          finishReason: response.choices[0]?.finish_reason 
        });

        try {
          parsedResponse = JSON.parse(content);
        } catch (parseError) {
          logger.error('Failed to parse OpenAI JSON response', parseError as Error, { 
            requestId, 
            content: content.substring(0, 500) + '...' 
          });
          throw new APIError(500, 'Invalid JSON response from OpenAI API');
        }
      } else {
        // Fallback response for dev mode without API key
        logger.info('Using fallback response - no OpenAI API key configured', { requestId });
        
        // Map voice IDs to display names
        const perspectiveNames: { [key: string]: string } = {
          seeker: 'Explorer Code Analysis Engine',
          steward: 'Maintainer Code Analysis Engine',
          witness: 'Analyzer Code Analysis Engine',
          nurturer: 'Developer Code Analysis Engine',
          decider: 'Implementor Code Analysis Engine'
        };

        const roleNames: { [key: string]: string } = {
          guardian: 'Security Engineer Code Specialization Engine',
          architect: 'Systems Architect Code Specialization Engine',
          designer: 'UI/UX Engineer Code Specialization Engine',
          optimizer: 'Performance Engineer Code Specialization Engine'
        };
        
        const voiceName = perspective ? perspectiveNames[perspective] || perspective : 
                         role ? roleNames[role] || role : 'Code Engine';
        
        parsedResponse = {
          code: `// Generated by ${voiceName}
// Request: ${request.prompt.substring(0, 100)}...

import React from 'react';

const ExampleComponent: React.FC = () => {
  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Example Solution</h2>
      <p>This is a fallback response generated without OpenAI API.</p>
      <p>To get real AI-generated solutions, configure your OPENAI_API_KEY.</p>
    </div>
  );
};

export default ExampleComponent;`,
          explanation: `This is a fallback solution generated by ${voiceName} without OpenAI API. The component provides a basic structure for the requested: "${request.prompt.substring(0, 100)}..."`,
          confidence: 75,
          strengths: ["Basic React structure", "TypeScript support", "Responsive design"],
          considerations: ["Needs OpenAI API key for real solutions", "Basic implementation", "Requires customization"]
        };
      }
      
      // Add dev mode watermark if enabled
      const devWatermark = createDevModeWatermark();
      if (devWatermark) {
        // Prepend watermark to code and explanation
        parsedResponse.code = `// ${devWatermark}\n${parsedResponse.code}`;
        parsedResponse.explanation = `${devWatermark} ${parsedResponse.explanation}`;
      }
      
      const perspectiveName = perspective || null;
      const roleName = role || null;

      const solution: GeneratedSolution = {
        voiceCombination: perspectiveName && roleName ? `${perspectiveName} + ${roleName}` :
                         perspectiveName ? perspectiveName :
                         roleName ? roleName : 'General Development',
        code: parsedResponse.code || '// No code generated',
        explanation: parsedResponse.explanation || 'No explanation provided',
        confidence: Math.max(1, Math.min(100, parsedResponse.confidence || 75)),
        strengths: Array.isArray(parsedResponse.strengths) ? parsedResponse.strengths : ['AI-generated solution'],
        considerations: Array.isArray(parsedResponse.considerations) ? parsedResponse.considerations : ['Review implementation'],
        perspective: perspective || 'general',
        role: role || 'full-stack'
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
      // Check if OpenAI is available - following AI_INSTRUCTIONS.md security patterns
      if (!openai || !OPENAI_API_KEY) {
        logger.warn('OpenAI API not available for synthesis - using fallback', { sessionId });
        
        // Provide basic synthesis fallback
        const fallbackSynthesis = `// Synthesized Solution
// Combined ${solutions.length} voice perspectives

${solutions.map((sol, idx) => `
// Solution ${idx + 1}: ${sol.voiceCombination}
// Confidence: ${sol.confidence}%
${sol.code}
`).join('\n\n')}

// Note: This is a basic combination. Configure OPENAI_API_KEY for intelligent synthesis.`;

        return fallbackSynthesis;
      }

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
      
      // Handle specific OpenAI errors following AI_INSTRUCTIONS.md patterns
      if (error instanceof Error && error.message.includes('API key')) {
        throw new APIError(401, 'Invalid OpenAI API key configuration');
      }

      if (error instanceof Error && error.message.includes('quota')) {
        throw new APIError(429, 'OpenAI API quota exceeded. Please try again later.');
      }

      throw new APIError(500, `Solution synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const openaiService = new OpenAIService();