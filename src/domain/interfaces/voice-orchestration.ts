/**
 * Voice Orchestration Interface - Domain Layer
 * 
 * Domain interface for voice orchestration and multi-voice AI collaboration.
 * Abstraction for voice archetype systems following clean architecture principles.
 */

export interface Voice {
  name: string;
  archetype: string;
  expertise: string[];
  personality: string;
}

export interface VoiceResponse {
  voiceName: string;
  response: string;
  confidence: number;
  reasoning: string;
}

export interface CouncilSession {
  id: string;
  topic: string;
  voices: Voice[];
  responses: VoiceResponse[];
  consensus?: string;
  startTime: number;
  endTime?: number;
}

export interface IVoiceOrchestrationService {
  /**
   * Get available voices
   */
  getAvailableVoices(): Voice[];

  /**
   * Select appropriate voices for a given context
   */
  selectVoicesForContext(context: string, maxVoices?: number): Promise<Voice[]>;

  /**
   * Execute a council session with multiple voices
   */
  executeCouncil(topic: string, voices: Voice[]): Promise<CouncilSession>;

  /**
   * Get a single voice response
   */
  getSingleVoiceResponse(voice: Voice, prompt: string): Promise<VoiceResponse>;

  /**
   * Generate multi-voice solutions (legacy compatibility method)
   */
  generateMultiVoiceSolutions(voices: string[], prompt: string, context?: any): Promise<VoiceResponse[]>;

  /**
   * Generate single voice response (legacy compatibility method)
   */
  generateSingleVoiceResponse(voice: string, prompt: string, client?: any): Promise<VoiceResponse>;

  /**
   * Get a voice response by name
   */
  getVoiceResponse(voiceName: string, prompt: string): Promise<VoiceResponse>;

  /**
   * Synthesize multiple voice responses into consensus
   */
  synthesizeResponses(responses: VoiceResponse[]): Promise<string>;

  /**
   * Evaluate voice response quality
   */
  evaluateResponseQuality(response: VoiceResponse): Promise<number>;
}