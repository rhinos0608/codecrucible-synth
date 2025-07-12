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

// Streaming interface for real-time ChatGPT-style generation
interface StreamGenerationOptions {
  prompt: string;
  perspectives: string[];
  roles: string[];
  sessionId: number;
  voiceId: string;
  type: 'perspective' | 'role';
  onChunk: (chunk: string) => void;
  onComplete: (solution: any) => Promise<void>;
}

class OpenAIService {
  // ChatGPT-style streaming generation following CodingPhilosophy.md consciousness principles
  async generateSolutionStream(options: StreamGenerationOptions): Promise<void> {
    const { prompt, sessionId, voiceId, type, onChunk, onComplete } = options;
    
    try {
      logger.info('Starting ChatGPT-style streaming generation', {
        requestId: `${sessionId}-${voiceId}`,
        type,
        promptLength: prompt.length,
        hasOpenAI: !!openai
      });

      // Enhanced OpenAI availability check following AI_INSTRUCTIONS.md patterns
      if (!openai || !OPENAI_API_KEY) {
        logger.error('OpenAI API key required for real-time streaming', { 
          voiceId, 
          type,
          hasClient: !!openai,
          hasKey: !!OPENAI_API_KEY 
        });
        
        // Use simulation only in development mode
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Development mode: Using streaming simulation fallback', { voiceId, type });
          await this.simulateStreamGeneration(voiceId, type, prompt, onChunk, onComplete);
          return;
        } else {
          throw new APIError(500, 'OpenAI API configuration required for streaming generation');
        }
      }

      // Get voice-specific system prompt
      const systemPrompt = this.getVoiceSystemPrompt(voiceId, type);
      const userPrompt = `Generate code for the following request: ${prompt}

Please provide a complete, production-ready solution following AI_INSTRUCTIONS.md patterns.
Include comprehensive code with proper error handling and modern best practices.`;

      logger.info('Creating OpenAI streaming completion', { voiceId, systemPromptLength: systemPrompt.length });

      // Create streaming completion
      const stream = await openai.chat.completions.create({
        model: "gpt-4o", // Latest model following blueprint instructions
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      });

      let accumulatedContent = '';
      let chunkCount = 0;

      // Process streaming chunks
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        
        if (content) {
          accumulatedContent += content;
          chunkCount++;
          
          // Send chunk to client via onChunk callback
          onChunk(content);
          
          // Add small delay for better visual effect
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      logger.info('OpenAI streaming completed', { 
        voiceId, 
        chunkCount, 
        totalLength: accumulatedContent.length 
      });

      // Generate final solution object
      const finalSolution = {
        voiceCombination: voiceId,
        code: this.extractCodeFromResponse(accumulatedContent),
        explanation: this.extractExplanationFromResponse(accumulatedContent),
        confidence: 85,
        strengths: this.extractStrengths(accumulatedContent),
        considerations: this.extractConsiderations(accumulatedContent),
        perspective: type === 'perspective' ? voiceId : '',
        role: type === 'role' ? voiceId : ''
      };

      // Call completion callback
      await onComplete(finalSolution);
      
    } catch (error) {
      logger.error('Streaming generation failed', error as Error, {
        requestId: `${sessionId}-${voiceId}`,
        errorMessage: error.message
      });
      
      // Fallback to simulated streaming
      logger.info('Falling back to simulated streaming', { voiceId, type });
      await this.simulateStreamGeneration(voiceId, type, prompt, onChunk, onComplete);
    }
  }

  // Fallback streaming simulation for when OpenAI is unavailable
  private async simulateStreamGeneration(
    voiceId: string, 
    type: 'perspective' | 'role', 
    prompt: string,
    onChunk: (chunk: string) => void,
    onComplete: (solution: any) => Promise<void>
  ): Promise<void> {
    logger.info('Starting simulated streaming generation', { voiceId, type });
    
    // Voice-specific simulated responses based on prompt context
    const getSimulatedResponse = (voiceId: string, prompt: string) => {
      const promptSummary = prompt.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '');
      
      const baseResponses = {
        seeker: `// Explorer: Investigating ${promptSummary}...
function exploratoryImplementation() {
  // Discovering innovative approaches
  const [state, setState] = useState(null);
  
  useEffect(() => {
    // Experimental implementation pattern
    const experiment = async () => {
      try {
        const result = await fetch('/api/innovative-endpoint');
        setState(result);
      } catch (error) {
        console.error('Exploration failed:', error);
      }
    };
    experiment();
  }, []);
  
  return <div className="innovative-ui">{state}</div>;
}`,
        
        steward: `// Maintainer: Robust ${promptSummary} implementation
function reliableImplementation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/data', {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return loading ? <div>Loading...</div> : error ? <div>Error: {error}</div> : <div>{data}</div>;
}`,
        
        witness: `// Analyzer: Deep analysis of ${promptSummary}
function analyticalImplementation() {
  // Comprehensive analysis and structured approach
  const [analysis, setAnalysis] = useState({
    data: null,
    metadata: null,
    insights: []
  });
  
  const performAnalysis = useCallback(async () => {
    const result = await fetch('/api/analyze');
    const data = await result.json();
    
    setAnalysis({
      data: data.core,
      metadata: data.meta,
      insights: data.patterns || []
    });
  }, []);
  
  return (
    <div className="analysis-dashboard">
      <section className="data-view">{analysis.data}</section>
      <section className="insights">{analysis.insights.map(i => <div key={i}>{i}</div>)}</section>
    </div>
  );
}`,
        
        nurturer: `// Developer: User-friendly ${promptSummary} solution
function userFriendlyImplementation() {
  const [userState, setUserState] = useState('welcome');
  
  const handleUserAction = (action) => {
    switch(action) {
      case 'start':
        setUserState('working');
        break;
      case 'complete':
        setUserState('success');
        break;
      default:
        setUserState('welcome');
    }
  };
  
  return (
    <div className="user-centered-design">
      <h2>Welcome to your solution</h2>
      <button onClick={() => handleUserAction('start')}>
        Get Started
      </button>
      {userState === 'working' && <div>Processing...</div>}
      {userState === 'success' && <div>Success!</div>}
    </div>
  );
}`,
        
        decider: `// Implementor: Action-oriented ${promptSummary}
function decisiveImplementation() {
  // Clear, executable solution
  const executeAction = async () => {
    const result = await fetch('/api/action', { method: 'POST' });
    return result.json();
  };
  
  return (
    <div className="action-interface">
      <button onClick={executeAction} className="primary-action">
        Execute Solution
      </button>
    </div>
  );
}`,
        
        guardian: `// Security Engineer: Secure ${promptSummary} implementation
function secureImplementation() {
  const [token, setToken] = useState(null);
  
  const authenticatedFetch = async (url) => {
    if (!token) {
      throw new Error('Authentication required');
    }
    
    return fetch(url, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
  };
  
  return (
    <div className="secure-component">
      <input 
        type="password" 
        onChange={(e) => setToken(e.target.value)}
        placeholder="Enter secure token"
      />
    </div>
  );
}`,
        
        architect: `// Systems Architect: Scalable ${promptSummary} architecture
class SystemArchitecture {
  constructor() {
    this.modules = new Map();
    this.dependencies = new Set();
  }
  
  registerModule(name, module) {
    this.modules.set(name, module);
    return this;
  }
  
  async initialize() {
    for (const [name, module] of this.modules) {
      await module.init();
    }
  }
}

const system = new SystemArchitecture()
  .registerModule('data', new DataModule())
  .registerModule('ui', new UIModule());`,
        
        designer: `// UI/UX Engineer: Beautiful ${promptSummary} interface
function BeautifulInterface() {
  return (
    <div className="modern-design bg-gradient-to-r from-blue-500 to-purple-600">
      <header className="glass-effect p-6">
        <h1 className="text-white text-2xl font-bold">Beautiful Solution</h1>
      </header>
      <main className="container mx-auto p-8">
        <div className="card shadow-xl bg-white rounded-lg p-6">
          <p className="text-gray-700">Elegant, user-centered design</p>
        </div>
      </main>
    </div>
  );
}`,
        
        optimizer: `// Performance Engineer: Optimized ${promptSummary}
import { memo, useMemo, useCallback } from 'react';

const OptimizedComponent = memo(() => {
  const memoizedData = useMemo(() => {
    return expensiveComputation();
  }, [dependencies]);
  
  const optimizedCallback = useCallback((data) => {
    return processData(data);
  }, []);
  
  return <div>{memoizedData}</div>;
});

// Lazy loading for better performance
const LazyComponent = React.lazy(() => import('./HeavyComponent'));`
      };
      
      return baseResponses[voiceId] || baseResponses.seeker;
    };
    
    const response = getSimulatedResponse(voiceId, prompt);

    
    // Simulate streaming by sending chunks
    const chunks = response.split('');
    for (let i = 0; i < chunks.length; i++) {
      onChunk(chunks[i]);
      await new Promise(resolve => setTimeout(resolve, 20)); // Simulate typing speed
    }
    
    // Complete the simulation
    await onComplete({
      voiceCombination: voiceId,
      code: response,
      explanation: `This is a simulated ${type} response from ${voiceId}. Real OpenAI integration would provide more dynamic content.`,
      confidence: 75,
      strengths: ['Simulated implementation', 'Fallback functionality'],
      considerations: ['Replace with real OpenAI when available'],
      perspective: type === 'perspective' ? voiceId : '',
      role: type === 'role' ? voiceId : ''
    });
  }

  // Extract explanation from mixed content
  private extractExplanationFromResponse(content: string): string {
    // Remove code blocks and extract explanation text
    const withoutCode = content.replace(/```[\s\S]*?```/g, '');
    return withoutCode.trim() || 'Implementation completed successfully.';
  }

  // Enhanced synthesis with real OpenAI integration - Following AI_INSTRUCTIONS.md patterns
  async synthesizeSolutions(options: { sessionId: number; solutions: any[]; mode: string }) {
    try {
      const { sessionId, solutions } = options;
      
      logger.info('Starting OpenAI-powered synthesis', { 
        sessionId, 
        solutionCount: solutions.length,
        hasApiKey: !!OPENAI_API_KEY 
      });

      // REAL OpenAI integration (no fallbacks unless explicitly no API key)
      if (!openai || !OPENAI_API_KEY) {
        throw new APIError(500, 'OpenAI API key required for synthesis. Please configure OPENAI_API_KEY environment variable.');
      }
      
      // Prepare comprehensive synthesis prompt
      const synthesisPrompt = this.buildSynthesisPrompt(solutions);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Latest model following blueprint guidelines
        messages: [
          {
            role: "system",
            content: `You are a senior software architect synthesizing multiple AI perspectives into a unified solution. 

Following CodingPhilosophy.md principles:
- Apply living spiral methodology for consciousness-driven development
- Integrate Jung's archetypal perspectives and Alexander's pattern language
- Create synthesis that transcends individual voice limitations

Following AI_INSTRUCTIONS.md patterns:
- Maintain security and input validation standards
- Apply single source of truth architectural principles
- Ensure production-ready implementation

Return a JSON object with:
- synthesizedCode: Complete, production-ready code implementation
- explanation: Comprehensive explanation of synthesis decisions
- confidence: Number 0-100 representing solution quality
- integratedApproaches: Array of specific approaches integrated
- securityConsiderations: Array of security measures implemented
- performanceOptimizations: Array of performance enhancements applied`
          },
          {
            role: "user", 
            content: synthesisPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Consistent synthesis output
        max_tokens: 4000 // Allow comprehensive responses
      });

      const synthesisResult = JSON.parse(response.choices[0].message.content || '{}');
      
      logger.info('OpenAI synthesis completed successfully', { 
        sessionId,
        outputLength: synthesisResult.synthesizedCode?.length || 0,
        confidence: synthesisResult.confidence
      });
      
      return {
        id: Date.now(),
        sessionId,
        synthesizedCode: synthesisResult.synthesizedCode || '',
        explanation: synthesisResult.explanation || '',
        confidence: synthesisResult.confidence || 85,
        integratedApproaches: synthesisResult.integratedApproaches || [],
        securityConsiderations: synthesisResult.securityConsiderations || [],
        performanceOptimizations: synthesisResult.performanceOptimizations || [],
        createdAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Real-time OpenAI synthesis failed', error as Error, { sessionId: options.sessionId });
      
      // Enhanced error handling following AI_INSTRUCTIONS.md
      if (error.message?.includes('API key')) {
        throw new APIError(500, 'OpenAI API configuration required for synthesis');
      }
      if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        throw new APIError(429, 'OpenAI API rate limit exceeded. Please try again shortly.');
      }
      
      throw new APIError(500, `Synthesis generation failed: ${error.message}`);
    }
  }

  private buildSynthesisPrompt(solutions: any[]): string {
    let prompt = "Synthesize these AI-generated solutions into one optimal implementation:\n\n";
    
    solutions.forEach((solution, index) => {
      prompt += `## Solution ${index + 1} (${solution.voiceCombination})\n`;
      prompt += `Code:\n${solution.code}\n\n`;
      prompt += `Explanation: ${solution.explanation}\n\n`;
      prompt += `Strengths: ${solution.strengths?.join(', ') || 'N/A'}\n\n`;
      prompt += `---\n\n`;
    });
    
    prompt += "Create a unified solution that combines the best aspects of all approaches.";
    return prompt;
  }

  // Get voice-specific system prompt for streaming
  private getVoiceSystemPrompt(voiceId: string, type: 'perspective' | 'role'): string {
    const baseInstructions = this.getBaseInstructions();
    
    if (type === 'perspective') {
      const perspectivePrompts = {
        seeker: `${baseInstructions}\n\nAs the Explorer perspective, focus on discovering innovative solutions, exploring new approaches, and questioning assumptions. Generate code that demonstrates curiosity and investigation.`,
        steward: `${baseInstructions}\n\nAs the Maintainer perspective, focus on code maintainability, reliability, and long-term sustainability. Generate robust, well-documented code with proper error handling.`,
        witness: `${baseInstructions}\n\nAs the Analyzer perspective, focus on understanding the problem deeply and providing analytical insights. Generate code with detailed analysis and comprehensive documentation.`,
        nurturer: `${baseInstructions}\n\nAs the Developer perspective, focus on user experience and creating supportive, intuitive solutions. Generate code that prioritizes usability and accessibility.`,
        decider: `${baseInstructions}\n\nAs the Implementor perspective, focus on making clear decisions and creating practical, actionable solutions. Generate efficient, production-ready code.`
      };
      return perspectivePrompts[voiceId] || baseInstructions;
    } else {
      const rolePrompts = {
        guardian: `${baseInstructions}\n\nAs the Security Engineer role, focus on security best practices, input validation, and secure coding patterns. Generate code with comprehensive security measures.`,
        architect: `${baseInstructions}\n\nAs the Systems Architect role, focus on scalable design patterns, proper architecture, and system integration. Generate well-structured, scalable code.`,
        designer: `${baseInstructions}\n\nAs the UI/UX Engineer role, focus on user interface design, responsive layouts, and user experience. Generate code with excellent visual design and usability.`,
        optimizer: `${baseInstructions}\n\nAs the Performance Engineer role, focus on optimization, efficiency, and performance best practices. Generate highly optimized, fast-executing code.`
      };
      return rolePrompts[voiceId] || baseInstructions;
    }
  }

  // Extract code from mixed response content
  private extractCodeFromResponse(content: string): string {
    const codeBlockRegex = /```(?:\w+)?\n?([\s\S]*?)```/g;
    const matches = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    
    return matches.join('\n\n') || content;
  }

  // Extract strengths from explanation
  private extractStrengths(explanation: string): string[] {
    const strengthsMatch = explanation.match(/(?:strengths?|benefits?|advantages?):\s*(.+?)(?:\n|$)/i);
    if (strengthsMatch) {
      return strengthsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }
    return ['Comprehensive implementation', 'Following best practices'];
  }

  // Extract considerations from explanation
  private extractConsiderations(explanation: string): string[] {
    const considerationsMatch = explanation.match(/(?:considerations?|limitations?|notes?):\s*(.+?)(?:\n|$)/i);
    if (considerationsMatch) {
      return considerationsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }
    return ['Consider performance implications', 'Review security measures'];
  }

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

  // Following CodingPhilosophy.md: Council-based consciousness patterns
  private getCodingPhilosophyInstructions(): string {
    return `ADDITIONAL CODING PHILOSOPHY INTEGRATION (CodingPhilosophy.md):

1. JUNG'S DESCENT PROTOCOL - Embrace Collapse as Genesis:
   - Acknowledge complexity, don't hide it
   - Create council space for synthesis when conflicts arise
   - Transform errors through council dialogue, not simple catch blocks
   - Code should invite multiple perspectives, not force single solutions

2. ALEXANDER'S PATTERN LANGUAGE - Timeless Way of Building:
   - Generate patterns that generate other patterns
   - Each component should unfold naturally from user needs
   - Focus on Quality Without A Name (QWAN) - code that feels alive
   - Build living systems that grow organically

3. CAMPBELL'S MYTHIC STRUCTURE - Heroic Journey Through Code:
   - Every function is a journey from problem to solution
   - Include departure (setup), transformation (logic), return (result)
   - Consider the user's journey through your code as a narrative
   - Code should guide users through conscious development

4. SPIRAL DYNAMICS - Evolutionary Consciousness Levels:
   - Write code that evolves user consciousness from beginner to master
   - Each interaction should deepen understanding of the system
   - Include progressive revelation - start simple, reveal complexity gradually
   - Support multiple levels of user sophistication simultaneously

Apply these principles alongside AI_INSTRUCTIONS.md security patterns.`;
  }

  // Generate perspective-specific system prompt
  private getPerspectivePrompt(perspective?: string, role?: string, projectContext?: ProjectContext): string {
    const baseInstructions = this.getBaseInstructions();
    const philosophyInstructions = this.getCodingPhilosophyInstructions();
    
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

Provide a JSON response with ACTUAL IMPLEMENTATION CODE (never use placeholder text):
{
  "code": "// REPLACE THIS COMMENT WITH ACTUAL REACT/TYPESCRIPT CODE FOR THE REQUEST",
  "explanation": "Clear explanation of the approach and decisions",
  "confidence": 85,
  "strengths": ["Benefit 1", "Benefit 2", "Benefit 3"],
  "considerations": ["Consideration 1", "Consideration 2", "Consideration 3"]
}

CRITICAL: The 'code' field must contain complete, functional React/TypeScript code that addresses the request. Never return placeholder comments or template code.

Example of what NOT to do:
- "// REPLACE THIS COMMENT WITH ACTUAL CODE"
- "// TODO: Implement functionality"
- Generic boilerplate templates

Example of what TO do:
- Complete, working implementation
- Proper React components with real functionality
- Actual business logic that solves the request`;

      let parsedResponse;
      
      // Debug OpenAI client status
      logger.debug('OpenAI client status check', {
        requestId,
        hasOpenAIClient: !!openai,
        hasAPIKey: !!OPENAI_API_KEY,
        keyLength: OPENAI_API_KEY?.length || 0
      });

      if (openai && OPENAI_API_KEY) {
        // Use real OpenAI API with enhanced error handling
        logger.info('Making OpenAI API request', { 
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

  // Following CodeCrucible Protocol: Integration with both instruction sets
  private buildCodingPhilosophyIntegration(): string {
    return `CODING_PHILOSOPHY.md Integration - The Living Spiral Engine:

Core Doctrine: All code must embody the Collapse-Council-Rebirth spiral and demonstrate Quality Without a Name (QWAN).

The Four Pillars of Living Code:
1. Jung's Descent Protocol - Embrace collapse as genesis of innovation
2. Alexander's Pattern Language - Generate recursive, living patterns
3. Campbell's Mythic Structure - Apply hero's journey to development cycles
4. Spiral Dynamics - Evolutionary consciousness in code architecture

Council Architecture Pattern:
- Every complex decision invokes multiple perspectives
- Synthesis emerges from patient dialogue between voices
- Solutions transcend individual viewpoints
- Recursive audit protocols ensure continuous evolution

Ritualized Development Process:
- Collapse: Acknowledge complexity without forcing solutions
- Council: Assemble relevant voices for multi-perspective analysis
- Synthesis: Create solutions that honor all voices
- Rebirth: Celebrate transformation and prepare next cycle

QWAN Assessment Criteria:
- Aliveness: Code feels vibrant and responsive
- Wholeness: All parts integrated harmoniously
- Self-Maintenance: Natural evolution and adaptation
- Elegance: Beautiful simplicity within complexity
- Clarity: Clear communication of intentions`;
  }

  private buildAIInstructionsPatterns(): string {
    return `AI_INSTRUCTIONS.md Security & Performance Requirements:

Security Patterns (WIZ Standards):
- Input validation with Zod schemas for all user data
- API authentication and rate limiting (15min/100 requests)
- Environment variable validation with error throwing
- User ownership verification for all data access

Performance Optimization:
- React.useCallback for event handlers and API calls
- React.useMemo for expensive calculations
- Component render optimization (<16ms targets)
- Accessibility compliance with ARIA attributes

TypeScript Strict Mode:
- Explicit type definitions for all interfaces
- No 'any' types except in controlled scenarios
- Proper error handling with try-catch blocks
- Interface-based architecture patterns

Production Readiness:
- Comprehensive error boundaries
- Loading states and skeleton UI
- Fallback mechanisms for API failures
- Security audit logging with sanitized data`;
  }

  // Parse OpenAI response into solution format following AI_INSTRUCTIONS.md patterns
  private parseOpenAIResponse(content: string, voiceId: string, type: 'perspective' | 'role'): GeneratedSolution {
    return {
      voiceCombination: voiceId,
      code: this.extractCodeFromResponse(content),
      explanation: this.extractExplanationFromResponse(content),
      confidence: 85,
      strengths: this.extractStrengths(content),
      considerations: this.extractConsiderations(content),
      perspective: type === 'perspective' ? voiceId : '',
      role: type === 'role' ? voiceId : ''
    };
  }

  // Simulation for fallback scenarios following CodingPhilosophy.md consciousness principles
  private async simulateStreamGeneration(
    voiceId: string, 
    type: 'perspective' | 'role', 
    prompt: string, 
    onChunk: (chunk: string) => void, 
    onComplete: (solution: any) => Promise<void>
  ): Promise<void> {
    const mockSolution = this.generateMockSolution(voiceId, prompt);
    
    logger.info('Starting simulated streaming generation', { 
      voiceId, 
      type, 
      mockResponseLength: mockSolution.code.length 
    });
    const chunks = mockSolution.code.split(' ');
    
    // Simulate typing with realistic delays
    for (const chunk of chunks) {
      onChunk(chunk + ' ');
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    }
    
    await onComplete({
      voiceCombination: voiceId,
      code: mockSolution.code,
      explanation: mockSolution.explanation,
      confidence: mockSolution.confidence,
      strengths: mockSolution.strengths,
      considerations: mockSolution.considerations,
      perspective: type === 'perspective' ? voiceId : '',
      role: type === 'role' ? voiceId : ''
    });
  }

  // Generate mock solution for fallback scenarios - Following CodingPhilosophy.md patterns
  private generateMockSolution(voiceId: string, prompt: string): GeneratedSolution {
    const promptSummary = prompt.substring(0, 50).replace(/[^a-zA-Z0-9 ]/g, '');
    
    const voiceResponses = {
      seeker: {
        code: `// Explorer: Investigating ${promptSummary}...
import React, { useState, useEffect } from 'react';

function ExploratoryImplementation() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    const experiment = async () => {
      try {
        const result = await fetch('/api/innovative-endpoint');
        setState(result);
      } catch (error) {
        console.error('Exploration failed:', error);
      }
    };
    experiment();
  }, []);
  
  return <div className="innovative-ui">{state}</div>;
}

export default ExploratoryImplementation;`,
        explanation: `Explorer analysis focuses on innovative approaches and experimental patterns for: ${promptSummary}`,
        confidence: 82,
        strengths: ["Innovative approach", "Experimental patterns", "Future-oriented thinking"],
        considerations: ["Needs validation", "Experimental nature", "May require refinement"]
      },
      
      steward: {
        code: `// Maintainer: Robust ${promptSummary} implementation
import React, { useState, useCallback } from 'react';

function ReliableImplementation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/data', {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return loading ? <div>Loading...</div> : error ? <div>Error: {error}</div> : <div>{data}</div>;
}

export default ReliableImplementation;`,
        explanation: `Maintainer analysis emphasizes stability, error handling, and robust patterns for: ${promptSummary}`,
        confidence: 88,
        strengths: ["Robust error handling", "Stable implementation", "Production-ready"],
        considerations: ["Conservative approach", "May need optimization", "Requires testing"]
      }
    };

    const response = voiceResponses[voiceId] || voiceResponses.seeker;
    
    return {
      voiceCombination: voiceId,
      code: response.code,
      explanation: response.explanation,
      confidence: response.confidence,
      strengths: response.strengths,
      considerations: response.considerations,
      perspective: voiceId,
      role: ''
    };
  }

  // Generate realistic fallback code for development
  private generateFallbackSolution(prompt: string, voiceId: string, type: string): string {
    const watermark = createDevModeWatermark();
    
    return `${watermark}
// ${voiceId.charAt(0).toUpperCase() + voiceId.slice(1)} ${type} Solution
// Prompt: ${prompt.substring(0, 100)}...

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SolutionProps {
  data: any[];
  onUpdate: (data: any) => void;
}

export function ${voiceId.charAt(0).toUpperCase() + voiceId.slice(1)}Solution({ data, onUpdate }: SolutionProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleProcess = async () => {
    setLoading(true);
    try {
      // ${voiceId} specific implementation
      const processed = data.map(item => ({
        ...item,
        processed: true,
        timestamp: new Date().toISOString()
      }));
      
      setResult(processed);
      onUpdate(processed);
    } catch (error) {
      console.error('Processing failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">
        ${voiceId.charAt(0).toUpperCase() + voiceId.slice(1)} Implementation
      </h3>
      
      <div className="space-y-4">
        <Button 
          onClick={handleProcess} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Processing...' : 'Execute Solution'}
        </Button>
        
        {result && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <pre className="text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}`;
  }
  }

  // Extract explanation from mixed response content
  private extractExplanationFromResponse(content: string): string {
    // Look for explanation sections
    const explanationMatch = content.match(/(?:explanation|description|summary):\s*(.+?)(?:\n\n|$)/is);
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }
    
    // Fallback to first paragraph
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('//') && !line.startsWith('```'));
    return lines[0] || 'AI-generated code solution';
  }
}

export const openaiService = new OpenAIService();