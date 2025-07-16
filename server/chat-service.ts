import type { ChatSession, InsertChatMessage } from "@shared/schema";
import { storage } from "./storage";
import { realOpenAIService } from "./openai-service";

export class ChatService {
  // Process user message and generate AI response using OpenAI integration
  async processUserMessage(
    chatSessionId: number,
    userMessage: string
  ): Promise<{ userMsg: any, assistantMsg: any }> {
    try {
      // Get chat session
      const chatSession = await storage.getChatSession(chatSessionId);
      if (!chatSession) {
        throw new Error('Chat session not found');
      }
      
      // Store user message
      const userMsg = await storage.createChatMessage({
        chatSessionId,
        role: 'user',
        content: userMessage,
        messageType: 'user',
        createdAt: new Date()
      });
      
      // Get conversation history for context
      const recentMessages = await storage.getChatMessages(chatSessionId);
      
      // Get initial solution context if available
      let initialSolution = null;
      if (chatSession.initialSolutionId) {
        initialSolution = await storage.getSolution(chatSession.initialSolutionId);
      }

      // Use the enhanced OpenAI service for specialized voice responses
      const aiResponse = await realOpenAIService.generateChatResponse(
        chatSession.selectedVoice,
        recentMessages,
        initialSolution
      );

      // Store AI response
      const assistantMsg = await storage.createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: aiResponse,
        messageType: 'ai',
        createdAt: new Date()
      });
      
      console.log(`💬 Processed message in chat ${chatSessionId}: User(${userMessage.length} chars) → ${chatSession.selectedVoice}(${aiResponse.length} chars)`);
      
      return { userMsg, assistantMsg };
      
    } catch (error) {
      console.error('❌ Error processing user message:', error);
      
      // Store user message even if AI fails
      const userMsg = await storage.createChatMessage({
        chatSessionId,
        role: 'user',
        content: userMessage,
        messageType: 'user',
        createdAt: new Date()
      });
      
      // Create error response
      const assistantMsg = await storage.createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your message. Please try again.',
        messageType: 'ai',
        createdAt: new Date()
      });
      
      return { userMsg, assistantMsg };
    }
  }
}

export const chatService = new ChatService();