// Custom Voice Profile Service - AI_INSTRUCTIONS.md Security Patterns
import { z } from 'zod';
import { db } from './db';
import { voiceProfiles } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from './logger';
import { openaiService } from './openai-service';
import { hasFeatureAccess } from './feature-access';

// Input validation schemas following AI_INSTRUCTIONS.md
const customVoiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(1000),
  personality: z.string().min(1).max(500),
  specialization: z.array(z.string()).min(1).max(10),
  chatStyle: z.enum(['analytical', 'friendly', 'direct', 'detailed']),
  ethicalStance: z.enum(['neutral', 'conservative', 'progressive']),
  perspective: z.string().min(1),
  role: z.string().min(1),
  avatar: z.string().optional(),
  isPublic: z.boolean().default(false),
  userId: z.string()
});

export type CustomVoiceRequest = z.infer<typeof customVoiceSchema>;

interface CodeExample {
  prompt: string;
  expectedOutput: string;
  quality: number;
}

interface VoiceTestResult {
  effectiveness: number;
  consistency: number;
  specialization_accuracy: number;
  style_adherence: number;
}

class CustomVoiceService {
  /**
   * Create a new custom voice profile with AI-generated prompt template
   * @param voiceData - Voice configuration data
   * @returns Created voice profile
   */
  async createCustomVoice(voiceData: CustomVoiceRequest): Promise<any> {
    try {
      // Validate input following AI_INSTRUCTIONS.md patterns
      const validatedData = customVoiceSchema.parse(voiceData);
      
      // Check feature access
      const subscriptionInfo = await this.checkSubscriptionAccess(validatedData.userId);
      if (!hasFeatureAccess(subscriptionInfo.tier, 'custom_voices')) {
        throw new Error('Custom voice profiles require Pro subscription or higher');
      }
      
      // Generate dynamic prompt template
      const promptTemplate = await this.generatePromptTemplate(validatedData);
      
      // Test the voice with sample prompts
      const testResults = await this.testCustomVoice(promptTemplate, validatedData);
      
      // Calculate initial effectiveness score
      const effectiveness = this.calculateInitialEffectiveness(testResults);
      
      // Create voice profile record
      const voiceProfile = await db.insert(voiceProfiles).values({
        userId: validatedData.userId,
        name: validatedData.name,
        description: validatedData.description,
        personality: validatedData.personality,
        chatStyle: validatedData.chatStyle,
        specialization: validatedData.specialization.join(', '),
        ethicalStance: validatedData.ethicalStance,
        perspective: validatedData.perspective,
        role: validatedData.role,
        avatar: validatedData.avatar || this.generateDefaultAvatar(validatedData),
        isDefault: false
      }).returning();
      
      logger.info('Custom voice profile created', {
        userId: validatedData.userId.substring(0, 8) + '...',
        voiceName: validatedData.name,
        effectiveness: effectiveness,
        specializations: validatedData.specialization
      });
      
      return {
        ...voiceProfile[0],
        promptTemplate,
        effectiveness,
        testResults
      };
    } catch (error) {
      logger.error('Failed to create custom voice', error as Error, {
        userId: voiceData.userId?.substring(0, 8) + '...',
        voiceName: voiceData.name
      });
      throw error;
    }
  }
  
  /**
   * Generate AI-powered prompt template for custom voice with REAL OpenAI integration
   */
  private async generatePromptTemplate(voiceData: CustomVoiceRequest): Promise<string> {
    try {
      // Real OpenAI integration for dynamic prompt generation following AI_INSTRUCTIONS.md
      const promptGenerationRequest = `Create a comprehensive system prompt for an AI coding assistant with these characteristics:

Name: ${voiceData.name}
Description: ${voiceData.description}
Personality: ${voiceData.personality}
Specializations: ${voiceData.specialization.join(', ')}
Communication Style: ${voiceData.chatStyle}
Ethical Stance: ${voiceData.ethicalStance}
Primary Perspective: ${voiceData.perspective}
Technical Role: ${voiceData.role}

Generate a detailed system prompt that:
1. Establishes the AI's unique personality and communication style
2. Defines specific technical expertise areas
3. Sets clear behavioral guidelines based on ethical stance
4. Includes specific instructions for the declared specializations
5. Creates distinctive voice characteristics that differentiate from other AI assistants

The prompt should be 200-400 words and ready for use as an OpenAI system message.`;

      logger.info('Generating custom voice prompt with real OpenAI', {
        voiceName: voiceData.name,
        specializations: voiceData.specialization
      });

      const response = await openaiService.generateVoicePrompt({
        name: voiceData.name,
        description: voiceData.description,
        personality: voiceData.personality,
        specializations: voiceData.specialization,
        chatStyle: voiceData.chatStyle,
        ethicalStance: voiceData.ethicalStance,
        perspective: voiceData.perspective,
        role: voiceData.role,
        promptRequest: promptGenerationRequest
      });

      logger.info('Custom voice prompt generated successfully', {
        voiceName: voiceData.name,
        promptLength: response.length
      });

      return response;

    } catch (error) {
      logger.error('Failed to generate OpenAI voice prompt, using fallback', error as Error);
      
      // Fallback template if OpenAI fails
      const basePrompts = {
        analytical: "Approach problems with systematic analysis and data-driven insights.",
        friendly: "Communicate with warmth and encouragement while maintaining technical accuracy.",
        direct: "Provide concise, straightforward solutions with minimal explanation overhead.",
        detailed: "Offer comprehensive explanations with step-by-step reasoning and context."
      };
      
      const ethicalFrameworks = {
        neutral: "Consider multiple perspectives and present balanced technical solutions.",
        conservative: "Prioritize stability, security, and proven patterns in your recommendations.",
        progressive: "Embrace innovative approaches and cutting-edge technologies when appropriate."
      };
      
      return `You are ${voiceData.name}, a specialized AI coding assistant with the following characteristics:

PERSONALITY: ${voiceData.personality}

SPECIALIZATIONS: ${voiceData.specialization.join(', ')}

COMMUNICATION STYLE: ${basePrompts[voiceData.chatStyle]}

ETHICAL APPROACH: ${ethicalFrameworks[voiceData.ethicalStance]}

CORE PERSPECTIVE: ${voiceData.perspective}
SPECIALIST ROLE: ${voiceData.role}

CUSTOM INSTRUCTIONS: ${voiceData.description}

When generating code solutions:
1. Always reflect your unique personality and communication style
2. Leverage your specialized knowledge areas: ${voiceData.specialization.join(', ')}
3. Apply your ethical framework to technical decisions
4. Maintain consistency with your defined role as ${voiceData.role}
5. Approach problems through the lens of ${voiceData.perspective}

Provide solutions that demonstrate your unique perspective while maintaining high technical quality.
    `.trim();
    
    return promptTemplate;
    }
  }
  
  /**
   * Test custom voice with sample prompts using REAL OpenAI integration
   */
  private async testCustomVoice(promptTemplate: string, voiceData: CustomVoiceRequest): Promise<VoiceTestResult> {
    // Real OpenAI integration for voice testing following AI_INSTRUCTIONS.md patterns
    const testPrompts = [
      "Create a simple React component for user authentication",
      "Implement error handling for a database connection",
      "Optimize a slow API endpoint performance"
    ];
    
    const results = [];
    
    for (const prompt of testPrompts) {
      try {
        const response = await openaiService.generateSolution({
          prompt,
          perspectives: [voiceData.perspective],
          roles: [voiceData.role],
          analysisDepth: 3,
          mergeStrategy: 'consensus',
          qualityFiltering: true,
          sessionId: 0, // Test session
          projectContext: {
            name: 'Voice Test',
            code: '',
            language: 'javascript'
          }
        }, promptTemplate);
        
        results.push({
          prompt,
          response: response[0]?.code || '',
          quality: this.assessResponseQuality(response[0], voiceData)
        });
      } catch (error) {
        logger.warn('Voice test failed for prompt', { prompt, error: (error as Error).message });
        results.push({ prompt, response: '', quality: 0 });
      }
    }
    
    return this.calculateTestMetrics(results, voiceData);
  }
  
  /**
   * Calculate effectiveness metrics from test results
   */
  private calculateTestMetrics(results: any[], voiceData: CustomVoiceRequest): VoiceTestResult {
    const avgQuality = results.reduce((sum, r) => sum + r.quality, 0) / results.length;
    
    return {
      effectiveness: Math.min(avgQuality * 100, 100),
      consistency: this.calculateConsistency(results),
      specialization_accuracy: this.assessSpecializationAccuracy(results, voiceData),
      style_adherence: this.assessStyleAdherence(results, voiceData)
    };
  }
  
  /**
   * Assess response quality based on voice characteristics
   */
  private assessResponseQuality(response: any, voiceData: CustomVoiceRequest): number {
    if (!response || !response.code) return 0;
    
    let score = 0.5; // Base score
    
    // Check for specialization relevance
    const hasSpecializationKeywords = voiceData.specialization.some(spec => 
      response.code.toLowerCase().includes(spec.toLowerCase()) ||
      response.explanation?.toLowerCase().includes(spec.toLowerCase())
    );
    
    if (hasSpecializationKeywords) score += 0.2;
    
    // Check code quality indicators
    if (response.code.length > 100) score += 0.1;
    if (response.explanation && response.explanation.length > 50) score += 0.1;
    if (response.strengths && response.strengths.length > 0) score += 0.1;
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate consistency across multiple test responses
   */
  private calculateConsistency(results: any[]): number {
    const qualities = results.map(r => r.quality);
    const variance = this.calculateVariance(qualities);
    return Math.max(0, 100 - (variance * 100));
  }
  
  /**
   * Assess how well responses match declared specializations
   */
  private assessSpecializationAccuracy(results: any[], voiceData: CustomVoiceRequest): number {
    const relevantResponses = results.filter(r => 
      voiceData.specialization.some(spec => 
        r.response.toLowerCase().includes(spec.toLowerCase())
      )
    );
    
    return (relevantResponses.length / results.length) * 100;
  }
  
  /**
   * Assess adherence to declared communication style
   */
  private assessStyleAdherence(results: any[], voiceData: CustomVoiceRequest): number {
    // Simplified style assessment based on response characteristics
    const styleKeywords = {
      analytical: ['analyze', 'systematic', 'data', 'metrics', 'measure'],
      friendly: ['help', 'easy', 'simple', 'great', 'nice'],
      direct: ['simply', 'just', 'only', 'quick', 'straightforward'],
      detailed: ['comprehensive', 'thoroughly', 'step-by-step', 'detailed', 'explanation']
    };
    
    const targetKeywords = styleKeywords[voiceData.chatStyle] || [];
    const matchingResponses = results.filter(r => 
      targetKeywords.some(keyword => 
        r.response.toLowerCase().includes(keyword)
      )
    );
    
    return (matchingResponses.length / results.length) * 100;
  }
  
  /**
   * Calculate statistical variance
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
  
  /**
   * Calculate initial effectiveness score
   */
  private calculateInitialEffectiveness(testResults: VoiceTestResult): number {
    return Math.round(
      (testResults.effectiveness * 0.4) +
      (testResults.consistency * 0.2) +
      (testResults.specialization_accuracy * 0.2) +
      (testResults.style_adherence * 0.2)
    );
  }
  
  /**
   * Generate default avatar based on voice characteristics
   */
  private generateDefaultAvatar(voiceData: CustomVoiceRequest): string {
    const avatarThemes = {
      analytical: 'scientist',
      friendly: 'mentor',
      direct: 'professional',
      detailed: 'teacher'
    };
    
    return avatarThemes[voiceData.chatStyle] || 'default';
  }
  
  /**
   * Check user subscription access for custom voices
   */
  private async checkSubscriptionAccess(userId: string): Promise<{ tier: string }> {
    // This would integrate with the subscription service
    // For now, return a basic structure
    return { tier: 'pro' }; // Placeholder
  }
}

export const customVoiceService = new CustomVoiceService();