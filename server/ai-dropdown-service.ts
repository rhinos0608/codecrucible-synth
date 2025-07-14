import { openai } from './openai.js';

// AI-powered dropdown suggestion service following AI_INSTRUCTIONS.md and CodingPhilosophy.md
export interface AIDropdownSuggestion {
  id: string;
  text: string;
  description: string;
  category: string;
  consciousness_level: number; // Jung's depth principle (1-10)
  pattern_quality: number; // Alexander's QWAN metric (1-10)
}

export interface AIDropdownRequest {
  field: string;
  context: string;
  consciousness_framework: string;
  pattern_language: string;
  learning_mode: string;
}

class AIDropdownService {
  // Generate consciousness-driven suggestions following Jung's Descent Protocol
  async generateSuggestions(request: AIDropdownRequest): Promise<AIDropdownSuggestion[]> {
    console.log('🧠 AI Dropdown Service - Processing request:', request);
    
    try {
      const systemPrompt = this.buildSystemPrompt(request);
      const userPrompt = this.buildUserPrompt(request);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8, // Enhanced creativity for diverse suggestions
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      const parsedResponse = JSON.parse(response);
      console.log('✅ AI Suggestions generated:', parsedResponse.suggestions?.length || 0);
      
      return parsedResponse.suggestions || [];
    } catch (error: any) {
      console.error('❌ AI Dropdown Service error:', error);
      throw new Error(`AI suggestion generation failed: ${error.message}`);
    }
  }

  // Build consciousness-integrated system prompt following CodingPhilosophy.md
  private buildSystemPrompt(request: AIDropdownRequest): string {
    return `You are an advanced AI dropdown suggestion engine integrated with consciousness-driven development principles.

FRAMEWORK INTEGRATION:
- Jung's Descent Protocol: Provide suggestions with varying consciousness depths (1=surface, 10=archetypal)
- Alexander's Pattern Language: Ensure suggestions have QWAN (Quality Without A Name) metrics
- Bateson's Recursive Learning: Generate suggestions that learn from context and improve over time
- Campbell's Mythic Journey: Structure suggestions around transformation and growth

CONSCIOUSNESS LEVELS:
1-3: Surface level (basic technical skills)
4-6: Practical mastery (experienced professional)
7-8: Wisdom integration (senior expertise)
9-10: Archetypal embodiment (thought leadership)

PATTERN QUALITY (QWAN):
1-3: Basic functionality
4-6: Well-crafted solutions
7-8: Elegant patterns
9-10: Timeless, living patterns

RESPONSE FORMAT:
{
  "suggestions": [
    {
      "id": "unique_id",
      "text": "suggestion_text",
      "description": "detailed_explanation",
      "category": "thematic_grouping",
      "consciousness_level": 1-10,
      "pattern_quality": 1-10
    }
  ]
}

Generate 8-12 diverse, high-quality suggestions that embody consciousness principles.`;
  }

  // Build context-aware user prompt
  private buildUserPrompt(request: AIDropdownRequest): string {
    const prompts = {
      specialization: this.getSpecializationPrompt(request.context),
      personality: this.getPersonalityPrompt(request.context),
      profile_name: this.getProfileNamePrompt(request.context),
      perspective: this.getPerspectivePrompt(request.context),
      role: this.getRolePrompt(request.context)
    };

    return prompts[request.field as keyof typeof prompts] || this.getGenericPrompt(request.field, request.context);
  }

  private getSpecializationPrompt(context: string): string {
    return `Generate AI-powered specialization suggestions for a code engine profile.

Context: ${context}

Create specializations that combine:
- Technical expertise (React, TypeScript, Node.js, Python, etc.)
- Domain knowledge (security, performance, architecture, etc.)
- Consciousness depth (from basic skills to archetypal mastery)

Examples of consciousness-integrated specializations:
- "Security architect specialising in React" (consciousness_level: 7, pattern_quality: 8)
- "Full-stack TypeScript engineer with DevOps mastery" (consciousness_level: 6, pattern_quality: 7)
- "Performance optimization sage for large-scale systems" (consciousness_level: 9, pattern_quality: 9)

Focus on combinations that create unique, valuable engineering perspectives.`;
  }

  private getPersonalityPrompt(context: string): string {
    return `Generate AI-powered personality suggestions for a code engine profile.

Context: ${context}

Create personalities that embody:
- Communication styles integrated with consciousness principles
- Problem-solving approaches following Jung's archetypal patterns
- Decision-making frameworks aligned with ethical development
- Collaboration patterns that enhance team consciousness

Examples:
- "Analytical guardian focused on security patterns and defensive coding practices"
- "Collaborative architect building timeless systems with team consciousness"
- "Pragmatic optimizer balancing performance with maintainable elegance"

Each personality should reflect deep technical wisdom combined with human consciousness development.`;
  }

  private getProfileNamePrompt(context: string): string {
    return `Generate AI-powered profile name suggestions for a code engine.

Context: ${context}

Create names that reflect:
- Technical mastery combined with consciousness evolution
- Jung's archetypal patterns (Explorer, Creator, Sage, Ruler, etc.)
- Alexander's timeless quality in naming
- Professional identity with depth and meaning

Examples:
- "The Security Sage" (consciousness_level: 9, pattern_quality: 8)
- "React Performance Guardian" (consciousness_level: 7, pattern_quality: 7)
- "Full-Stack Consciousness Engineer" (consciousness_level: 8, pattern_quality: 9)

Names should inspire confidence while reflecting deep technical and personal development.`;
  }

  private getPerspectivePrompt(context: string): string {
    return `Generate AI-powered perspective suggestions for code analysis engines.

Context: ${context}

Available base perspectives: Explorer, Maintainer, Analyzer, Developer, Implementor

Create enhanced perspectives that:
- Extend base perspectives with consciousness depth
- Integrate Jung's archetypal wisdom
- Reflect Alexander's pattern recognition
- Embody Bateson's systems thinking

Examples:
- "Deep Systems Explorer" (consciousness_level: 8, pattern_quality: 7)
- "Conscious Code Maintainer" (consciousness_level: 7, pattern_quality: 8)
- "Wisdom-Integrated Analyzer" (consciousness_level: 9, pattern_quality: 9)`;
  }

  private getRolePrompt(context: string): string {
    return `Generate AI-powered coding role suggestions for specialization engines.

Context: ${context}

Create roles that combine:
- Technical specialization with consciousness development
- Professional expertise with archetypal embodiment
- Practical skills with wisdom integration
- Individual mastery with team consciousness

Examples:
- "Conscious Full-Stack Engineer" (consciousness_level: 7, pattern_quality: 8)
- "Security Architecture Sage" (consciousness_level: 9, pattern_quality: 8)
- "Performance Optimization Guardian" (consciousness_level: 8, pattern_quality: 7)

Roles should reflect both technical mastery and human development integration.`;
  }

  private getGenericPrompt(field: string, context: string): string {
    return `Generate AI-powered suggestions for field: ${field}

Context: ${context}

Create suggestions that integrate consciousness principles with technical excellence.
Each suggestion should embody both practical value and deeper meaning.`;
  }
}

export const aiDropdownService = new AIDropdownService();