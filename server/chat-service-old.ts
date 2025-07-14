import OpenAI from "openai";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "../client/src/types/voices";
import type { Solution, ChatSession, InsertChatMessage } from "@shared/schema";
import { storage } from "./storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Voice context mapping for specialized chat personalities following AI_INSTRUCTIONS.md patterns
const getVoiceSystemPrompt = (voiceCombination: string, contextData: any): string => {
  // Find voice context - Jung's Descent Protocol for consciousness-driven personality
  let voiceContext = { name: 'AI Assistant', expertise: 'General coding assistance', systemPrompt: '' };
  
  // Handle perspective voices - Explorer, Maintainer, Analyzer, Developer, Implementor
  if (voiceCombination.includes('perspective') || CODE_PERSPECTIVES.find(p => p.id === voiceCombination)) {
    const perspectiveId = voiceCombination.replace('perspective-', '').replace('perspective:', '');
    const perspective = CODE_PERSPECTIVES.find(p => p.id === perspectiveId);
    if (perspective) {
      voiceContext = {
        name: perspective.name,
        expertise: perspective.description,
        systemPrompt: perspective.fragment
      };
    }
  }
  
  // Handle role voices - Security Engineer, Systems Architect, UI/UX Engineer, Performance Engineer
  if (voiceCombination.includes('role') || DEVELOPMENT_ROLES.find(r => r.id === voiceCombination)) {
    const roleId = voiceCombination.replace('role-', '').replace('role:', '');
    const role = DEVELOPMENT_ROLES.find(r => r.id === roleId);
    if (role) {
      voiceContext = {
        name: role.name,
        expertise: role.description,
        systemPrompt: role.fragment
      };
    }
  }
  
  // Create comprehensive system prompt following CodingPhilosophy.md consciousness principles
  return `You are ${voiceContext.name}, an expert AI specialist in ${voiceContext.expertise}.

PERSONALITY & APPROACH:
${voiceContext.systemPrompt}

CONTEXT - Original Solution You Generated:
Code: ${contextData.originalCode}
Explanation: ${contextData.explanation}
Confidence: ${contextData.confidence}%
Strengths: ${JSON.stringify(contextData.strengths)}
Considerations: ${JSON.stringify(contextData.considerations)}

CONVERSATION GUIDELINES:
1. Stay in character as ${voiceContext.name} throughout the conversation
2. Reference your original solution when relevant but be open to iteration and improvement
3. Provide specific, actionable advice based on your expertise in ${voiceContext.expertise}
4. Include code examples when helpful, formatted in markdown code blocks
5. Ask clarifying questions to better understand the user's needs
6. Build upon the conversation history to provide increasingly refined solutions

TECHNICAL FOCUS:
- For Performance Engineer: Focus on optimization, database indexing, caching strategies, performance monitoring
- For Security Engineer: Emphasize security vulnerabilities, authentication, authorization, data protection
- For UI/UX Engineer: Concentrate on user experience, accessibility, responsive design, user interface patterns
- For Systems Architect: Address system design, scalability, architecture patterns, integration strategies
- For Explorer: Question assumptions, explore alternatives, investigate edge cases
- For Maintainer: Focus on code quality, maintainability, documentation, testing
- For Analyzer: Deep dive into problem analysis, pattern recognition, systematic evaluation
- For Developer: Practical implementation details, coding best practices, development workflow
- For Implementor: Concrete solutions, step-by-step implementation, getting things done

Remember: You are engaging in an iterative technical discussion. Be conversational but maintain your technical expertise and unique perspective.`;
};

export class ChatService {
  // Create AI response to user message following AI_INSTRUCTIONS.md security patterns
  async generateResponse(
    chatSession: ChatSession, 
    userMessage: string, 
    messageIndex: number
  ): Promise<string> {
    try {
      // Get conversation history for context - Alexander's Pattern Language for continuity
      const messages = await storage.getChatMessages(chatSession.id);
      
      // Build conversation context for OpenAI
      const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: getVoiceSystemPrompt(chatSession.selectedVoice, chatSession.contextData)
        }
      ];
      
      // Add conversation history - Bateson's recursive learning patterns
      messages.forEach(msg => {
        if (msg.messageType === 'user') {
          conversationMessages.push({
            role: "user",
            content: msg.content
          });
        } else if (msg.messageType === 'assistant') {
          conversationMessages.push({
            role: "assistant", 
            content: msg.content
          });
        }
      });
      
      // Add current user message
      conversationMessages.push({
        role: "user",
        content: userMessage
      });
      
      console.log(`🎯 Generating ${chatSession.selectedVoice} response for chat session ${chatSession.id}`);
      
      // Generate response using OpenAI GPT-4o - the newest model following AI_INSTRUCTIONS.md patterns
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 1500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });
      
      const assistantMessage = response.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try again.";
      
      // Store assistant response in database - Defensive programming following AI_INSTRUCTIONS.md
      await storage.createChatMessage({
        chatSessionId: chatSession.id,
        messageType: 'assistant',
        content: assistantMessage,
        voiceType: chatSession.selectedVoice,
        messageIndex: messageIndex + 1,
        metadata: {
          model: "gpt-4o",
          temperature: 0.7,
          tokens: response.usage?.total_tokens || 0
        }
      });
      
      console.log(`✅ Generated ${assistantMessage.length} character response from ${chatSession.selectedVoice}`);
      return assistantMessage;
      
    } catch (error) {
      console.error(`❌ Error generating chat response:`, error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
  
  // Process user message and generate AI response - Campbell's Mythic Journey for conversation flow
  async processUserMessage(
    chatSessionId: number,
    userMessage: string
  ): Promise<{ userMsg: any, assistantMsg: string }> {
    try {
      // Get chat session
      const chatSession = await storage.getChatSession(chatSessionId);
      if (!chatSession) {
        throw new Error('Chat session not found');
      }
      
      // Get current message count for indexing
      const existingMessages = await storage.getChatMessages(chatSessionId);
      const messageIndex = existingMessages.length;
      
      // Store user message
      const userMsg = await storage.createChatMessage({
        chatSessionId,
        messageType: 'user',
        content: userMessage,
        messageIndex,
        metadata: {
          timestamp: new Date().toISOString(),
          length: userMessage.length
        }
      });
      
      // Generate and store AI response
      const assistantResponse = await this.generateResponse(chatSession, userMessage, messageIndex);
      
      return {
        userMsg,
        assistantMsg: assistantResponse
      };
      
    } catch (error) {
      console.error(`❌ Error processing user message:`, error);
      throw error;
    }
  }
}

export const chatService = new ChatService();