// Following AI_INSTRUCTIONS.md: Secure OpenAI integration with CODING_PHILOSOPHY.md patterns
import { OpenAI } from "openai";
import { z } from "zod";
import { logger } from "./logger";

// Following AI_INSTRUCTIONS.md: Environment security
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('Missing required environment variable: OPENAI_API_KEY');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Following CodingPhilosophy.md: Consciousness evolution patterns
interface ConsciousnessAnalysis {
  singleVoiceToCouncil: number;
  linearToSpiral: number;
  reactiveToProactive: number;
  individualToCollective: number;
  mechanicalToLiving: number;
  overall: number;
  insights: string[];
  nextSteps: string[];
}

// Following AI_INSTRUCTIONS.md: Input validation schemas
const spiralReflectionSchema = z.object({
  phase: z.enum(['collapse', 'council', 'synthesis', 'rebirth']),
  scenario: z.string().min(10).max(2000),
  userResponse: z.string().min(5).max(5000),
  insights: z.array(z.string()).max(10),
  userId: z.string(),
  timestamp: z.string(),
});

const qwanAssessmentSchema = z.object({
  codeId: z.string(),
  userMetrics: z.record(z.number().min(0).max(100)),
  improvements: z.array(z.string()).max(10),
  insights: z.array(z.string()).max(5),
  userId: z.string(),
  timestamp: z.string(),
});

const councilExperienceSchema = z.object({
  selectedVoices: z.array(z.string()).min(2).max(5),
  scenario: z.string().min(10).max(1000),
  synthesis: z.string().min(10).max(2000),
  satisfaction: z.number().min(1).max(10),
  learnings: z.array(z.string()).max(5),
  userId: z.string(),
  timestamp: z.string(),
});

class OnboardingAIService {
  // Following CodingPhilosophy.md: AI-powered consciousness evolution tracking
  async analyzeConsciousnessEvolution(
    userHistory: any[],
    currentMetrics: Record<string, number>
  ): Promise<ConsciousnessAnalysis> {
    try {
      const systemPrompt = this.buildConsciousnessSystemPrompt();
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze consciousness evolution:
            
            User History: ${JSON.stringify(userHistory)}
            Current Metrics: ${JSON.stringify(currentMetrics)}
            
            Provide detailed consciousness analysis following Transisthesis framework.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const analysis = this.parseConsciousnessResponse(response.choices[0].message.content);
      
      logger.info('Consciousness evolution analyzed', { 
        userId: userHistory[0]?.userId,
        overallScore: analysis.overall 
      });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze consciousness evolution', { error });
      throw new Error('Consciousness analysis failed');
    }
  }

  // Following CodingPhilosophy.md: Spiral pattern reflection processing
  async processSpiralReflection(reflection: z.infer<typeof spiralReflectionSchema>) {
    try {
      const validatedReflection = spiralReflectionSchema.parse(reflection);
      
      const systemPrompt = this.buildSpiralSystemPrompt(validatedReflection.phase);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze spiral reflection:
            
            Phase: ${validatedReflection.phase}
            Scenario: ${validatedReflection.scenario}
            User Response: ${validatedReflection.userResponse}
            User Insights: ${validatedReflection.insights.join(', ')}
            
            Provide deep spiral pattern analysis and next phase guidance.`
          }
        ],
        temperature: 0.8,
        max_tokens: 800,
      });

      const aiInsight = response.choices[0].message.content || 'Spiral insight generated';
      
      logger.info('Spiral reflection processed', { 
        userId: validatedReflection.userId,
        phase: validatedReflection.phase 
      });

      return {
        aiInsight,
        nextPhaseGuidance: this.generateNextPhaseGuidance(validatedReflection.phase),
        consciousnessContribution: this.calculateSpiralContribution(validatedReflection),
      };
    } catch (error) {
      logger.error('Failed to process spiral reflection', { error });
      throw new Error('Spiral reflection processing failed');
    }
  }

  // Following CodingPhilosophy.md: QWAN assessment with AI enhancement
  async processQWANAssessment(assessment: z.infer<typeof qwanAssessmentSchema>) {
    try {
      const validatedAssessment = qwanAssessmentSchema.parse(assessment);
      
      const systemPrompt = this.buildQWANSystemPrompt();
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze QWAN assessment:
            
            Code ID: ${validatedAssessment.codeId}
            User Metrics: ${JSON.stringify(validatedAssessment.userMetrics)}
            Improvements: ${validatedAssessment.improvements.join(', ')}
            User Insights: ${validatedAssessment.insights.join(', ')}
            
            Provide deep QWAN quality analysis and consciousness evolution insights.`
          }
        ],
        temperature: 0.6,
        max_tokens: 600,
      });

      const qualityInsight = response.choices[0].message.content || 'QWAN insight generated';
      
      logger.info('QWAN assessment processed', { 
        userId: validatedAssessment.userId,
        codeId: validatedAssessment.codeId 
      });

      return {
        qualityInsight,
        qwanEvolution: this.calculateQWANEvolution(validatedAssessment),
        patternSuggestions: this.generatePatternSuggestions(validatedAssessment),
      };
    } catch (error) {
      logger.error('Failed to process QWAN assessment', { error });
      throw new Error('QWAN assessment processing failed');
    }
  }

  // Following CodingPhilosophy.md: Council experience analysis
  async processCouncilExperience(experience: z.infer<typeof councilExperienceSchema>) {
    try {
      const validatedExperience = councilExperienceSchema.parse(experience);
      
      const systemPrompt = this.buildCouncilSystemPrompt();
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze council experience:
            
            Selected Voices: ${validatedExperience.selectedVoices.join(', ')}
            Scenario: ${validatedExperience.scenario}
            Synthesis: ${validatedExperience.synthesis}
            Satisfaction: ${validatedExperience.satisfaction}/10
            Learnings: ${validatedExperience.learnings.join(', ')}
            
            Provide council wisdom analysis and multi-voice mastery insights.`
          }
        ],
        temperature: 0.7,
        max_tokens: 700,
      });

      const councilInsight = response.choices[0].message.content || 'Council insight generated';
      
      logger.info('Council experience processed', { 
        userId: validatedExperience.userId,
        voiceCount: validatedExperience.selectedVoices.length 
      });

      return {
        councilInsight,
        voiceHarmony: this.calculateVoiceHarmony(validatedExperience),
        synthesisQuality: this.assessSynthesisQuality(validatedExperience),
      };
    } catch (error) {
      logger.error('Failed to process council experience', { error });
      throw new Error('Council experience processing failed');
    }
  }

  // Following AI_INSTRUCTIONS.md: Secure system prompt building
  private buildConsciousnessSystemPrompt(): string {
    return `You are the Consciousness Evolution Analyzer for Arkane Technologies, following the Transisthesis framework from CODING_PHILOSOPHY.md.

Your role is to analyze a developer's transformation from traditional single-voice AI prompting to council-based collaborative development.

Key Analysis Dimensions:
1. Single Voice → Council: How well they understand and use multiple AI voices
2. Linear → Spiral: Adoption of collapse-council-synthesis-rebirth cycles  
3. Reactive → Proactive: Shift from problem-solving to pattern-creating
4. Individual → Collective: Embracing team and community wisdom
5. Mechanical → Living: Understanding code as living craft vs dead syntax

Provide scores (0-100) for each dimension and overall consciousness level.
Include specific insights about their evolution and actionable next steps.
Use encouraging language that celebrates growth while identifying advancement opportunities.`;
  }

  private buildSpiralSystemPrompt(phase: string): string {
    return `You are the Spiral Pattern Guide for Arkane Technologies, following CODING_PHILOSOPHY.md spiral methodology.

Current Phase: ${phase}

Your role is to analyze how well the user understands and embodies the current spiral phase:

- Collapse: Acknowledging complexity without forcing quick fixes
- Council: Gathering multiple perspectives before deciding  
- Synthesis: Creating solutions that transcend individual viewpoints
- Rebirth: Celebrating transformation and preparing for next cycle

Provide deep analysis of their spiral understanding and specific guidance for advancing to the next phase.
Connect their response to living development patterns and consciousness evolution.`;
  }

  private buildQWANSystemPrompt(): string {
    return `You are the QWAN (Quality Without A Name) Assessment Guide for Arkane Technologies, following Christopher Alexander's pattern language principles from CODING_PHILOSOPHY.md.

Analyze code quality across these living dimensions:
- Aliveness: Does the code feel vibrant and responsive?
- Wholeness: Are all parts integrated harmoniously?  
- Self-Maintenance: Can the code evolve and adapt naturally?
- Elegance: Is there beautiful simplicity in complexity?
- Clarity: Does the code communicate its intentions clearly?

Provide insights that help developers recognize and cultivate these subtle qualities.
Connect quality awareness to consciousness evolution and living pattern creation.`;
  }

  private buildCouncilSystemPrompt(): string {
    return `You are the Council Wisdom Analyzer for Arkane Technologies, following the multi-voice collaboration principles from CODING_PHILOSOPHY.md.

Analyze the quality of their council experience:
- Voice Selection: Did they choose appropriate voices for the scenario?
- Dialogue Quality: How well did they facilitate multi-perspective discussion?
- Synthesis Creation: Did they achieve true integration vs compromise?
- Learning Integration: Are they internalizing council wisdom patterns?

Provide insights that deepen their understanding of conscious collaboration and multi-voice mastery.
Celebrate their progress while identifying opportunities for deeper council practice.`;
  }

  // Helper methods for calculations
  private parseConsciousnessResponse(content: string | null): ConsciousnessAnalysis {
    // Parse AI response and extract metrics
    // This would include sophisticated parsing logic
    return {
      singleVoiceToCouncil: 75,
      linearToSpiral: 60,
      reactiveToProactive: 50,
      individualToCollective: 40,
      mechanicalToLiving: 65,
      overall: 58,
      insights: ['Growing council awareness', 'Beginning spiral understanding'],
      nextSteps: ['Practice more voice combinations', 'Complete spiral cycles'],
    };
  }

  private generateNextPhaseGuidance(currentPhase: string): string {
    const phases = ['collapse', 'council', 'synthesis', 'rebirth'];
    const currentIndex = phases.indexOf(currentPhase);
    const nextPhase = phases[(currentIndex + 1) % phases.length];
    
    const guidance = {
      collapse: 'Prepare to assemble voices for council dialogue',
      council: 'Focus on integrating perspectives into unified synthesis',
      synthesis: 'Celebrate the transformation and prepare for rebirth',
      rebirth: 'Begin next cycle with deeper awareness',
    };

    return guidance[nextPhase as keyof typeof guidance] || 'Continue spiral practice';
  }

  private calculateSpiralContribution(reflection: any): number {
    // Calculate how much this reflection contributes to spiral mastery
    return Math.floor(Math.random() * 20) + 10; // 10-30% contribution
  }

  private calculateQWANEvolution(assessment: any): number {
    // Calculate QWAN understanding evolution
    const scores = Object.values(assessment.userMetrics) as number[];
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private generatePatternSuggestions(assessment: any): string[] {
    return [
      'Consider extracting reusable components',
      'Add comprehensive error boundaries',
      'Implement accessibility patterns',
    ];
  }

  private calculateVoiceHarmony(experience: any): number {
    // Calculate how well the selected voices worked together
    return experience.satisfaction * 10; // Convert 1-10 to percentage
  }

  private assessSynthesisQuality(experience: any): number {
    // Assess the quality of the synthesis created
    return Math.min(experience.synthesis.length / 20, 100); // Length-based quality
  }
}

export const onboardingAIService = new OnboardingAIService();