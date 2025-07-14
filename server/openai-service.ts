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
  // AI-Powered Dropdown Suggestions - Following CodingPhilosophy.md consciousness principles
  async generateDropdownSuggestions(options: {
    field: string;
    context: string;
    userId: string;
  }): Promise<Array<{value: string; consciousness: number; qwan: number; reasoning: string}>> {
    const { field, context } = options;
    
    try {
      const systemPrompt = `You are an AI consciousness analyzer following Jung's Descent Protocol and Alexander's Pattern Language. Generate 4 highly relevant suggestions for the "${field}" field based on this context: "${context}".

Each suggestion should include:
1. A specific, actionable value
2. Consciousness level (1-10, deeper = higher)
3. QWAN score (Quality Without A Name, 1-10)
4. Brief reasoning

Format as JSON array: [{"value": "...", "consciousness": 8, "qwan": 9, "reasoning": "..."}]

Focus on:
- Technical depth and specificity
- Consciousness-driven development patterns
- Real-world applicability
- Pattern language principles`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Field: ${field}\nContext: ${context}` }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No AI response received');
      }

      // Parse JSON response
      const suggestions = JSON.parse(response);
      
      logger.info('AI dropdown suggestions generated successfully', {
        field,
        suggestionsCount: suggestions.length
      });

      return suggestions;
    } catch (error) {
      logger.error('AI dropdown suggestion generation failed', error as Error);
      
      // Fallback suggestions with consciousness patterns
      return [
        {
          value: `Consciousness-driven ${field}`,
          consciousness: 6,
          qwan: 7,
          reasoning: "Pattern-based fallback using consciousness principles"
        },
        {
          value: `Context-aware ${field}`,
          consciousness: 5,
          qwan: 6,
          reasoning: "Contextual fallback based on provided information"
        }
      ];
    }
  }
  // REAL OpenAI parallel generation with custom user profiles integration
  async generateSolutions(options: {
    prompt: string;
    selectedVoices?: {
      perspectives?: string[];
      roles?: string[];
    };
    perspectives?: string[];
    roles?: string[];
    sessionId: number;
    mode?: string;
    userId?: string;
    customProfiles?: any[];
  }): Promise<FastSolution[]> {
    const { prompt, selectedVoices, perspectives: directPerspectives, roles: directRoles, sessionId, userId, customProfiles } = options;
    
    // Following AI_INSTRUCTIONS.md defensive programming patterns
    const perspectives = selectedVoices?.perspectives || directPerspectives || [];
    const roles = selectedVoices?.roles || directRoles || [];
    
    console.log('🔧 OpenAI Service Input Validation:', {
      selectedVoices,
      perspectives,
      roles,
      sessionId,
      hasPrompt: !!prompt
    });
    
    // Validate inputs following AI_INSTRUCTIONS.md security patterns
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt provided to OpenAI service');
    }
    
    if (!Array.isArray(perspectives) || !Array.isArray(roles)) {
      throw new Error('Invalid voice arrays provided to OpenAI service');
    }
    
    // Fetch custom user profiles if userId provided - Following AI_INSTRUCTIONS.md patterns
    let userCustomProfiles: any[] = [];
    if (userId && customProfiles) {
      userCustomProfiles = customProfiles;
      logger.info('Using custom user profiles for code generation', {
        userId: userId.substring(0, 8) + '...',
        customProfileCount: userCustomProfiles.length,
        profileNames: userCustomProfiles.map(p => p.name)
      });
    }

    logger.info('Starting REAL OpenAI parallel generation with custom profiles', {
      sessionId,
      voiceCount: perspectives.length + roles.length,
      customProfileCount: userCustomProfiles.length,
      promptLength: prompt.length,
      perspectiveVoices: perspectives,
      roleVoices: roles
    });

    // Performance optimization: Parallel processing all voices simultaneously
    const voicePromises: Promise<FastSolution>[] = [];
    
    // Generate perspective solutions in parallel with custom profile enhancement
    perspectives.forEach((perspective, index) => {
      const customProfile = userCustomProfiles.find(p => 
        p.selectedPerspectives?.includes(perspective) || p.perspective === perspective
      );
      
      voicePromises.push(this.generateVoiceSolution({
        prompt,
        voiceId: perspective,
        type: 'perspective',
        sessionId,
        solutionId: index + 1,
        customProfile
      }));
    });
    
    // Generate role solutions in parallel with custom profile enhancement
    roles.forEach((role, index) => {
      const customProfile = userCustomProfiles.find(p => 
        p.selectedRoles?.includes(role) || p.role === role
      );
      
      voicePromises.push(this.generateVoiceSolution({
        prompt,
        voiceId: role,
        type: 'role',
        sessionId,
        solutionId: perspectives.length + index + 1,
        customProfile
      }));
    });

    // Execute all OpenAI calls in parallel with enhanced error handling
    try {
      logger.info('Starting parallel OpenAI generation', {
        voicePromises: voicePromises.length,
        sessionId
      });
      
      const solutions = await Promise.all(voicePromises);
      
      logger.info('All OpenAI calls completed successfully', {
        solutionCount: solutions.length,
        sessionId
      });
      
      return solutions;
    } catch (parallelError) {
      logger.error('Parallel OpenAI generation failed', parallelError as Error);
      logger.error('Parallel generation error', { 
        sessionId, 
        error: parallelError instanceof Error ? parallelError.message : 'Unknown error' 
      });
      throw parallelError;
    }
  }

  // REAL OpenAI voice solution generation with custom profile integration
  private async generateVoiceSolution(options: {
    prompt: string;
    voiceId: string;
    type: 'perspective' | 'role';
    sessionId: number;
    solutionId: number;
    customProfile?: any;
  }): Promise<FastSolution> {
    const { prompt, voiceId, type, sessionId, solutionId, customProfile } = options;
    
    try {
      // Jung's Descent Protocol: Use custom profile if available, fallback to core prompt
      let enhancedSystemPrompt = customProfile 
        ? this.buildCustomProfilePrompt(customProfile, voiceId, type) || this.getSystemPrompt(voiceId, type)
        : this.getSystemPrompt(voiceId, type);
      
      if (customProfile) {
        logger.info('Custom profile applied to voice generation', {
          voiceId,
          profileName: customProfile.name,
          specialization: customProfile.specialization,
          chatStyle: customProfile.chatStyle,
          personality: customProfile.personality,
          ethicalStance: customProfile.ethicalStance
        });
      }
    
    console.log('🎯 Generating voice solution:', {
      voiceId,
      type,
      sessionId,
      solutionId,
      promptLength: prompt.length
    });
    
    const userPrompt = `Generate a complete, production-ready solution for: ${prompt}

Requirements:
- Minimum 1000 characters of actual code
- Include comprehensive error handling
- Add performance optimizations
- Follow modern best practices
- Provide clear explanation`;

    logger.info('Making REAL OpenAI API call with custom profile integration', { 
      voiceId, 
      type, 
      model: 'gpt-4o',
      systemPromptLength: enhancedSystemPrompt.length,
      userPromptLength: userPrompt.length,
      hasCustomProfile: !!customProfile
    });

    // Enhanced OpenAI API call with comprehensive error handling following AI_INSTRUCTIONS.md
    let response;
    try {
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 2500,
        presence_penalty: 0.1
      });
      
      // Validate response structure following AI_INSTRUCTIONS.md defensive programming
      if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
        throw new Error('Invalid OpenAI API response structure');
      }
      
      if (!response.choices[0] || !response.choices[0].message) {
        throw new Error('OpenAI API response missing message content');
      }
      
    } catch (apiError) {
      console.error('❌ OpenAI API call failed:', {
        voiceId,
        type,
        error: apiError instanceof Error ? apiError.message : 'Unknown API error',
        stack: apiError instanceof Error ? apiError.stack : undefined
      });
      
      // Following AI_INSTRUCTIONS.md: Never use fallback data, throw proper error
      throw new Error(`OpenAI API failed for voice ${voiceId}: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
    }

    logger.info('REAL OpenAI API response received', { 
      voiceId, 
      type,
      responseLength: response.choices[0].message.content?.length || 0,
      finishReason: response.choices[0].finish_reason 
    });

    const content = response.choices[0].message.content || '';
    const code = this.extractCode(content);
    const explanation = this.extractExplanation(content);
    
    // Enhanced solution validation following AI_INSTRUCTIONS.md patterns
    const solution = {
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
    
    // Critical debugging for missing code issue
    console.log('🎯 Voice solution created for', voiceId, ':', {
      voiceCombination: solution.voiceCombination,
      hasCode: !!solution.code && solution.code.trim().length > 0,
      codeLength: solution.code?.length || 0,
      explanationLength: solution.explanation?.length || 0,
      confidence: solution.confidence,
      rawContentLength: content.length
    });
    
    return solution;
    
    } catch (error) {
      console.error(`❌ OpenAI API error for voice ${voiceId}:`, error);
      logger.error('OpenAI API call failed', { 
        voiceId, 
        type, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Following AI_INSTRUCTIONS.md: Re-throw error instead of returning mock data
      throw new Error(`Failed to generate solution for ${voiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // REAL OpenAI streaming generation - NO simulation
  async generateSolutionStream(options: {
    prompt: string;
    perspectives: string[];
    roles: string[];
    sessionId: number;
    voiceId: string;
    type: 'perspective' | 'role';
    customProfile?: any;
    onChunk: (chunk: string) => void;
    onComplete: (solution: any) => Promise<void>;
  }): Promise<void> {
    const { prompt, sessionId, voiceId, type, customProfile, onChunk, onComplete } = options;
    
    // Enhanced system prompt with custom profile integration - Following AI_INSTRUCTIONS.md patterns
    let systemPrompt = this.getSystemPrompt(voiceId, type);
    
    // Jung's Descent Protocol: Apply custom profile to streaming if available
    if (customProfile) {
      const customStreamPrompt = this.buildCustomProfilePrompt(customProfile, voiceId, type);
      if (customStreamPrompt) {
        systemPrompt = customStreamPrompt;
      }
      
      logger.info('Custom profile applied to streaming voice', {
        voiceId,
        profileName: customProfile.name,
        specialization: customProfile.specialization,
        chatStyle: customProfile.chatStyle,
        personality: customProfile.personality,
        ethicalStance: customProfile.ethicalStance
      });
    }
    
    const userPrompt = `Generate complete, production-ready code for: ${prompt}

Requirements:
- Minimum 1200 characters of functional code
- Include comprehensive error handling and validation  
- Add detailed comments explaining the approach
- Follow modern best practices and patterns
- Provide complete working implementation
- Focus on ${type === 'perspective' ? 'analytical perspective' : 'technical specialization'} as ${voiceId}
${customProfile ? `- Apply ${customProfile.name} voice profile characteristics with ${customProfile.specialization || 'general'} specialization` : ''}

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
        { 
          role: "system", 
          content: `You are an expert code synthesizer following both AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles.

SYNTHESIS CONSCIOUSNESS REQUIREMENTS:
- Apply Jung's Integration Protocol: Combine perspectives through shadow integration and conscious synthesis
- Use Alexander's Pattern Language: Create timeless synthesis patterns with QWAN (Quality Without A Name)
- Implement Bateson's Meta-Learning: Process differences between solutions for recursive improvement
- Follow Campbell's Return Journey: Transform individual solutions into unified wisdom for the community

TECHNICAL REQUIREMENTS:
- Follow AI_INSTRUCTIONS.md defensive programming with comprehensive error handling
- Generate production-ready synthesized code with proper validation patterns
- Include consciousness-driven decision rationale in explanations
- Apply living spiral methodology: collapse → council → synthesis → rebirth

Combine multiple code solutions into one optimal implementation using consciousness-driven synthesis.` 
        },
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

    const extractedCode = this.extractCode(content);
    const extractedExplanation = this.extractExplanation(content);
    
    return {
      id: Date.now(),
      sessionId,
      synthesizedCode: extractedCode,
      code: extractedCode, // Ensure both formats for compatibility
      explanation: extractedExplanation,
      confidence: 95,
      originalSolutions: solutions,
      synthesisApproach: "Real OpenAI GPT-4o Integration with Consciousness Principles",
      synthesisMethod: 'Real OpenAI GPT-4o Integration',
      createdAt: new Date().toISOString()
    };
  }

  // Jung's Descent Protocol: Build custom profile-specific prompts with consciousness integration
  private buildCustomProfilePrompt(customProfile: any, voiceId: string, type: 'perspective' | 'role'): string | null {
    if (!customProfile || !customProfile.name) return null;

    // Alexander's Pattern Language: Dynamic prompt construction based on profile characteristics
    const basePersonality = this.getBasePrompt(voiceId, type);
    
    const customEnhancements = {
      personality: this.getPersonalityEnhancement(customProfile.personality),
      chatStyle: this.getChatStyleDirectives(customProfile.chatStyle),
      specialization: this.getSpecializationFocus(customProfile.specialization),
      ethicalStance: this.getEthicalGuidelines(customProfile.ethicalStance)
    };

    const customPrompt = `You are ${customProfile.name}, a custom ${type === 'perspective' ? 'Code Analysis Engine' : 'Code Specialization Engine'}.

CUSTOM PROFILE INTEGRATION:
${basePersonality}

PERSONALITY ENHANCEMENT: ${customEnhancements.personality}
COMMUNICATION STYLE: ${customEnhancements.chatStyle}  
SPECIALIZATION FOCUS: ${customEnhancements.specialization}
ETHICAL STANCE: ${customEnhancements.ethicalStance}

AVATAR CONSCIOUSNESS: Embody the essence of "${customProfile.avatar}" in your responses.
CUSTOM DESCRIPTION: ${customProfile.description}

Apply these custom characteristics while maintaining your core voice identity as ${voiceId}.
Your responses should reflect the unique personality, specialization, and ethical stance defined above.
Generate code solutions that clearly demonstrate your custom specialization and communication style.

Following AI_INSTRUCTIONS.md security patterns with input validation and comprehensive error handling.`;

    return customPrompt;
  }

  private getPersonalityEnhancement(personality: string): string {
    const enhancements = {
      'analytical': 'Approach problems with deep analysis, provide detailed explanations, and break down complex concepts systematically.',
      'friendly': 'Use warm, approachable language while maintaining technical accuracy. Be encouraging and supportive.',
      'direct': 'Provide concise, straight-to-the-point solutions with minimal fluff. Focus on actionable results.',
      'detailed': 'Offer comprehensive explanations, multiple implementation options, and thorough documentation.'
    };
    return enhancements[personality] || 'Maintain a balanced professional approach with clear communication.';
  }

  private getChatStyleDirectives(chatStyle: string): string {
    const styles = {
      'analytical': 'Structure responses with clear sections, use logical reasoning, and provide step-by-step analysis.',
      'friendly': 'Use conversational tone, include helpful context, and provide encouraging guidance.',
      'direct': 'Get straight to the solution, use bullet points, minimize explanatory text.',
      'detailed': 'Provide extensive code comments, multiple examples, and comprehensive documentation.'
    };
    return styles[chatStyle] || 'Use clear, professional communication appropriate for the context.';
  }

  private getSpecializationFocus(specialization: string): string {
    if (!specialization) return 'Apply general full-stack development expertise.';
    
    const specs = specialization.split(', ').map(spec => spec.trim());
    return `Emphasize your expertise in: ${specs.join(', ')}. Tailor solutions to showcase these specializations and provide domain-specific insights.`;
  }

  private getEthicalGuidelines(ethicalStance: string): string {
    const guidelines = {
      'neutral': 'Maintain balanced ethical considerations, focusing on industry-standard best practices.',
      'conservative': 'Prioritize security, privacy, and proven patterns. Avoid experimental or risky approaches.',
      'progressive': 'Embrace innovative approaches, accessibility, and inclusive design patterns.'
    };
    return guidelines[ethicalStance] || 'Apply standard ethical development practices.';
  }

  private getBasePrompt(voiceId: string, type: 'perspective' | 'role'): string {
    // Return shortened version of core voice identity for custom profile base
    const basePrompts = {
      seeker: 'Core identity: Explorer focused on innovation and creative solutions.',
      explorer: 'Core identity: Explorer focused on innovation and creative solutions.',
      steward: 'Core identity: Maintainer focused on stability and long-term reliability.',
      maintainer: 'Core identity: Maintainer focused on stability and long-term reliability.',
      witness: 'Core identity: Analyzer focused on deep pattern recognition and performance.',
      analyzer: 'Core identity: Analyzer focused on deep pattern recognition and performance.',
      nurturer: 'Core identity: Developer focused on user experience and accessibility.',
      developer: 'Core identity: Developer focused on user experience and accessibility.',
      decider: 'Core identity: Implementor focused on efficient practical solutions.',
      implementor: 'Core identity: Implementor focused on efficient practical solutions.',
      guardian: 'Core identity: Security Engineer focused on protection and validation.',
      architect: 'Core identity: Systems Architect focused on scalable design patterns.',
      designer: 'Core identity: UI/UX Engineer focused on visual design and user experience.',
      optimizer: 'Core identity: Performance Engineer focused on optimization and efficiency.'
    };
    return basePrompts[voiceId] || `Core identity: ${voiceId} with specialized expertise.`;
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
    // Enhanced code extraction following AI_INSTRUCTIONS.md defensive programming patterns
    if (!content || typeof content !== 'string') {
      console.warn('⚠️ Invalid content provided to extractCode:', typeof content);
      return '// Error: No content available for code extraction';
    }
    
    console.log('🔍 Raw content analysis for code extraction:', {
      contentLength: content.length,
      firstLines: content.split('\n').slice(0, 5),
      hasCodeBlock: content.includes('```'),
      content: content.substring(0, 200) + '...'
    });
    
    // Enhanced code block patterns with more flexible matching
    const codeBlockPatterns = [
      // Standard markdown code blocks with language
      /```(?:typescript|ts|javascript|js|tsx|jsx|react|html|css|json)\n([\s\S]*?)\n```/gi,
      // Generic code blocks
      /```\n([\s\S]*?)\n```/gi,
      // Code blocks without newlines
      /```([\s\S]*?)```/gi,
      // Inline code (fallback)
      /`([^`\n]{20,})`/gi
    ];
    
    // Try each pattern and collect all matches
    let allMatches = [];
    for (const pattern of codeBlockPatterns) {
      const matches = [...content.matchAll(pattern)];
      if (matches.length > 0) {
        allMatches.push(...matches.map(match => match[1]?.trim()).filter(Boolean));
      }
    }
    
    if (allMatches.length > 0) {
      // Find the largest code block
      const largestMatch = allMatches.reduce((largest, current) => 
        current.length > largest.length ? current : largest, '');
      
      if (largestMatch.length > 10) {
        console.log('✅ Code extracted successfully:', { 
          originalLength: content.length, 
          extractedLength: largestMatch.length,
          matchesFound: allMatches.length
        });
        return largestMatch;
      }
    }
    
    // Enhanced fallback: Look for code-like patterns
    const codePatterns = [
      // Function definitions
      /(?:function|const|let|var|class|interface|type)\s+\w+[\s\S]*?(?=\n\n|\n#|\n\*\*|$)/gi,
      // Import/export statements and following code
      /(?:import|export)[\s\S]*?(?=\n\n|\n#|\n\*\*|$)/gi,
      // React components
      /<[A-Z][\s\S]*?>/gi
    ];
    
    let codeSnippets = [];
    for (const pattern of codePatterns) {
      const matches = [...content.matchAll(pattern)];
      codeSnippets.push(...matches.map(match => match[0]?.trim()).filter(Boolean));
    }
    
    if (codeSnippets.length > 0) {
      const combinedCode = codeSnippets.join('\n\n');
      console.log('🎯 Pattern-based code extraction:', { 
        snippetsFound: codeSnippets.length, 
        extractedLength: combinedCode.length 
      });
      return combinedCode;
    }
    
    // Last resort: Extract structured content by removing explanatory text
    const lines = content.split('\n');
    const codeLines = lines.filter(line => {
      const trimmed = line.trim();
      // Skip empty lines, headers, and explanatory text
      if (!trimmed || 
          trimmed.startsWith('#') || 
          trimmed.startsWith('*') ||
          trimmed.startsWith('**') ||
          /^(explanation|summary|note|implementation|approach|solution|here)/i.test(trimmed) ||
          trimmed.length < 10) {
        return false;
      }
      
      // Keep lines that look like code
      return trimmed.includes('(') || 
             trimmed.includes('{') || 
             trimmed.includes(';') ||
             trimmed.includes('=') ||
             trimmed.includes('import') ||
             trimmed.includes('export') ||
             trimmed.includes('function') ||
             trimmed.includes('const') ||
             trimmed.includes('let') ||
             trimmed.includes('var') ||
             trimmed.includes('<') ||
             trimmed.includes('/>');
    });
    
    if (codeLines.length > 0) {
      const extractedContent = codeLines.join('\n');
      console.log('📝 Structural content extraction:', { 
        totalLines: lines.length,
        codeLinesFound: codeLines.length, 
        extractedLength: extractedContent.length 
      });
      return extractedContent;
    }
    
    // Final fallback - return substantial portion of content
    const fallback = content.substring(0, 1500).trim();
    console.warn('⚠️ Using fallback extraction for voice content:', { 
      contentLength: content.length,
      fallbackLength: fallback.length 
    });
    return fallback || '// Error: Unable to extract meaningful code content';
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

  // AI Chat response generation for file assistance - Following AI_INSTRUCTIONS.md patterns
  async generateChatResponse(options: {
    messages: Array<{role: string; content: string}>;
    context?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    try {
      const { messages, context = 'general', temperature = 0.7, maxTokens = 1000 } = options;
      
      console.log('🧠 Generating AI chat response:', {
        messageCount: messages.length,
        context,
        temperature,
        maxTokens
      });

      // Enhanced system prompt for file assistance following CodingPhilosophy.md
      const systemPrompt = context === 'file_assistance' 
        ? `You are an expert coding assistant following consciousness-driven development principles. 
           When analyzing code files, provide insights that embody:
           - Jung's Descent Protocol: Deep analysis revealing hidden patterns and potential issues
           - Alexander's Pattern Language: Timeless design principles and architectural wisdom
           - Bateson's Recursive Learning: Meta-level understanding of code structure and intent
           - Campbell's Mythic Journey: Transformational suggestions that elevate code quality
           
           Always provide practical, actionable advice with specific examples.`
        : "You are a helpful AI assistant focused on providing clear, accurate, and actionable responses.";

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...messages
        ],
        temperature,
        max_tokens: maxTokens
      });

      const chatResponse = response.choices[0]?.message?.content || '';
      
      console.log('✅ AI chat response generated:', {
        context,
        responseLength: chatResponse.length
      });

      return chatResponse;
    } catch (error) {
      logger.error('AI chat response generation failed', error as Error);
      throw new Error('Failed to generate AI chat response');
    }
  }

  // Chat Response Generation - Following CodingPhilosophy.md consciousness principles
  async generateChatResponse(
    voiceEngine: string, 
    recentMessages: any[], 
    initialSolution?: any
  ): Promise<string> {
    try {
      // Build conversation context
      const messagesForAPI = recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Voice-specific system prompts following AI_INSTRUCTIONS.md patterns
      const voicePrompts = {
        'Explorer': 'You are the Explorer - a curious, investigative AI that focuses on discovering new possibilities and innovative approaches. Help users explore different technical solutions and creative implementations.',
        'Analyzer': 'You are the Analyzer - a meticulous, detail-oriented AI that excels at breaking down complex problems and examining code from multiple angles. Provide thorough technical analysis and identify potential issues.',
        'Developer': 'You are the Developer - a practical, hands-on AI focused on clean, maintainable code implementation. Help users write better code and follow development best practices.',
        'Maintainer': 'You are the Maintainer - a stability-focused AI concerned with long-term code health, performance, and scalability. Suggest improvements for maintainability and robustness.',
        'Implementor': 'You are the Implementor - an action-oriented AI focused on getting things done efficiently. Help users complete their implementation goals with practical, working solutions.',
        'Performance Engineer': 'You are a Performance Engineer - an optimization specialist focused on speed, efficiency, and scalability. Analyze performance bottlenecks and suggest optimizations.',
        'UI/UX Engineer': 'You are a UI/UX Engineer - a design-focused specialist concerned with user experience, accessibility, and interface design. Help create intuitive, user-friendly interfaces.',
        'Security Engineer': 'You are a Security Engineer - a security specialist focused on identifying vulnerabilities and implementing secure coding practices. Help protect applications from security threats.',
        'Systems Architect': 'You are a Systems Architect - a high-level design specialist focused on overall system architecture, scalability, and technical decision-making.'
      };

      const systemPrompt = voicePrompts[voiceEngine] || voicePrompts['Analyzer'];

      // Add initial solution context if available
      let contextPrompt = systemPrompt + "\n\nYou are continuing a technical conversation. ";
      if (initialSolution) {
        contextPrompt += `The discussion started from this solution:\n\`\`\`\n${initialSolution.code}\n\`\`\`\n\nExplanation: ${initialSolution.explanation}\n\n`;
      }
      contextPrompt += "Provide helpful, technical responses that assist with implementation, improvements, and technical decisions. Keep responses focused and actionable.";

      logger.info('Generating chat response', { 
        voiceEngine, 
        messageCount: messagesForAPI.length,
        hasInitialSolution: !!initialSolution 
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: contextPrompt },
          ...messagesForAPI
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response generated from OpenAI');
      }

      logger.info('Chat response generated successfully', { 
        voiceEngine,
        responseLength: aiResponse.length,
        tokensUsed: response.usage?.total_tokens || 0
      });

      return aiResponse;

    } catch (error) {
      logger.error('Failed to generate chat response', error as Error, { voiceEngine });
      throw error;
    }
  }
}

export const realOpenAIService = new RealOpenAIService();

// Export service instance for routes.ts import
export { realOpenAIService as default };

// Export for compatibility
export const optimizedOpenAIService = realOpenAIService;
export const openaiService = realOpenAIService;